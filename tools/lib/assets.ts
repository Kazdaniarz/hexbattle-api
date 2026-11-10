/*
 * Image assets: the manifest (published path → private master file + SHA-256), the images the data references,
 * and the WebP variants each image gets. The masters themselves live outside the repository.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AssetRef, type Army } from '@hexbattle/schema';
import sharp from 'sharp';
import { z } from 'zod';
import type { SourceData } from './data-files.ts';
import type { Issue } from './issues.ts';

/* * Manifest */

export const MANIFEST_FILE = 'assets.manifest.json';

/** One image: where its master is (relative to the masters folder; default = the published path) and its hash. */
export const ManifestEntry = z.strictObject({
	source: z.string().min(1).optional(),
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
	bytes: z.int().min(1),
	width: z.int().min(1).optional(),
	height: z.int().min(1).optional(),
});
export type ManifestEntry = z.infer<typeof ManifestEntry>;

export const AssetManifest = z.strictObject({ assets: z.record(AssetRef, ManifestEntry) });
export type AssetManifest = z.infer<typeof AssetManifest>;

/* * WebP variants */

export const WEBP = {
	quality: 88,
	sizes: [512, 256, 128],
	sizesByPrefix: { 'board_skins/': [4096, 2048, 1024] } as Record<string, number[]>,
	name: '{path without .png}@{size}.webp',
} as const;

/**
 * WebP sizes (longest side) a PNG gets: its prefix's sizes, never larger than the master. PNGs are published only
 * as WebP, so a master smaller than every size gets one variant at its own size.
 */
export function webpSizes(assetPath: string, entry: Pick<ManifestEntry, 'width' | 'height'>): number[] {
	if (!assetPath.endsWith('.png') || entry.width === undefined || entry.height === undefined) {
		return [];
	}
	const longest = Math.max(entry.width, entry.height);
	const prefix = Object.keys(WEBP.sizesByPrefix).find((key) => assetPath.startsWith(key));
	const sizes = (prefix ? (WEBP.sizesByPrefix[prefix] ?? []) : WEBP.sizes).filter((size) => size <= longest);
	return sizes.length > 0 ? sizes : [longest];
}

/** Published path of one WebP variant: `moloch/klaun_front.png` → `moloch/klaun_front@512.webp`. */
export function webpPath(assetPath: string, size: number): string {
	return `${assetPath.replace(/\.png$/, '')}@${String(size)}.webp`;
}

/** One file published under /v1/assets/ and how to recognise a correct copy of it. */
export type PublishedImage =
	{ path: string; kind: 'svg'; sha256: string } | { path: string; kind: 'webp'; size: number };

/** Every file an image name is published as: the SVG itself, or each WebP variant of a PNG. */
export function publishedImages(
	assetPath: string,
	entry: { sha256: string; webp: readonly number[] } | Pick<ManifestEntry, 'sha256' | 'width' | 'height'>,
): PublishedImage[] {
	if (assetPath.endsWith('.svg')) {
		return [{ path: assetPath, kind: 'svg', sha256: entry.sha256 }];
	}
	const sizes = 'webp' in entry ? entry.webp : webpSizes(assetPath, entry);
	return sizes.map((size) => ({ path: webpPath(assetPath, size), kind: 'webp', size }));
}

/* * References */

/** Every image path the data references, with the first file that references it. */
export function collectAssetRefs(source: SourceData): Map<string, string> {
	const refs = new Map<string, string>();
	const add = (file: string, ref: string | undefined) => {
		if (ref !== undefined && !refs.has(ref)) refs.set(ref, file);
	};
	for (const { file, data } of source.armies) {
		collectArmy(data).forEach((ref) => {
			add(file, ref);
		});
	}
	for (const marker of source.markers?.data.markers ?? []) {
		Object.values(marker.images ?? {}).forEach((ref) => {
			add('markers.json', ref);
		});
	}
	for (const { file, data } of source.skins) {
		add(file, data.back);
		Object.values(data.tiles).forEach((images) => {
			add(file, images.front);
			add(file, images.back);
		});
	}
	for (const { file, data } of source.boardSkins) {
		add(file, data.image);
	}
	return refs;
}

function collectArmy(army: Army): (string | undefined)[] {
	const display = army.display;
	return [
		display?.logo.image,
		display?.back,
		...(display?.hp_markers ?? []).map((marker) => marker.image),
		...(army.tiles ?? []).flatMap((tile) => tile.faces.map((face) => face.image)),
	];
}

/* * Checks */

/** Data against the manifest: every referenced image listed (an error in a release), every listed image used. */
export function checkManifest(refs: ReadonlyMap<string, string>, manifest: AssetManifest, release: boolean): Issue[] {
	const issues: Issue[] = [];
	for (const [ref, file] of refs) {
		if (!(ref in manifest.assets)) {
			const code = release ? 'E_ASSET_MISSING' : 'W_ASSET_MISSING';
			issues.push({ code, file, message: `"${ref}" is not in ${MANIFEST_FILE}` });
		}
	}
	for (const ref of Object.keys(manifest.assets)) {
		if (!refs.has(ref)) {
			issues.push({
				code: 'W_ASSET_UNUSED',
				file: MANIFEST_FILE,
				path: ref,
				message: `"${ref}" is not used by any data`,
			});
		}
	}
	return issues;
}

/** Masters against the manifest: each master exists and still has the recorded hash. */
export async function checkMasters(manifest: AssetManifest, masters: Masters, release: boolean): Promise<Issue[]> {
	const issues: Issue[] = [];
	for (const [ref, entry] of Object.entries(manifest.assets)) {
		const master = await findMaster(masters, ref, entry.source);
		if (!master) {
			const code = release ? 'E_ASSET_MISSING' : 'W_ASSET_MISSING';
			issues.push({ code, file: MANIFEST_FILE, path: ref, message: `master "${entry.source ?? ref}" not found` });
		} else if (sha256(master) !== entry.sha256) {
			const message = `master "${entry.source ?? ref}" changed – run pnpm assets:manifest`;
			issues.push({ code: 'E_ASSET_HASH', file: MANIFEST_FILE, path: ref, message });
		}
	}
	return issues;
}

/* * Masters */

export function sha256(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Where masters are read from: the private masters folder (ASSETS_DIR) and, optionally, staged masters
 * (STAGED_ASSETS_DIR) – new or replaced images not published yet (the dashboard's working copy), stored under
 * their published path. A staged master wins over the masters folder.
 */
export interface Masters {
	assetsDir: string;
	stagedDir?: string | undefined;
}

/** The master of an image: the staged one under its published path, else the masters folder's (`source` or path). */
export async function findMaster(
	masters: Masters,
	ref: string,
	source: string | undefined,
): Promise<Buffer | undefined> {
	if (masters.stagedDir !== undefined) {
		const staged = await readMaster(masters.stagedDir, ref);
		if (staged) {
			return staged;
		}
	}
	return readMaster(masters.assetsDir, source ?? ref);
}

/** Whether a staged master exists for the image (its manifest entry then has no `source`). */
export async function isStaged(masters: Masters, ref: string): Promise<boolean> {
	return masters.stagedDir !== undefined && (await readMaster(masters.stagedDir, ref)) !== undefined;
}

/** The master's bytes, or undefined when the file does not exist. */
export async function readMaster(assetsDir: string, source: string): Promise<Buffer | undefined> {
	try {
		return await readFile(path.join(assetsDir, source));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
}

/** A manifest entry for a master: hash, size, and pixel dimensions of PNGs. */
export async function describeMaster(
	buffer: Buffer,
	source: string | undefined,
	isPng: boolean,
): Promise<ManifestEntry> {
	const entry: ManifestEntry = { ...(source && { source }), sha256: sha256(buffer), bytes: buffer.length };
	if (isPng) {
		const { width, height } = await sharp(buffer).metadata();
		entry.width = width;
		entry.height = height;
	}
	return entry;
}
