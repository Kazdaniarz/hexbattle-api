/*
 * Writes the published images: PNG masters only as WebP variants (the masters stay private), SVG logos as they are.
 * Variants are cached by master hash, so unchanged images are not converted again.
 */
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { type AssetManifest, publishedImages, readMaster, WEBP, webpPath, webpSizes } from './assets.ts';

/* * Types */

export interface ImageDirs {
	/** Private masters folder (ASSETS_DIR). */
	assetsDir: string;
	/** Published assets folder, e.g. dist/v1/assets. */
	outDir: string;
	/** Variant cache, kept between builds. */
	cacheDir: string;
}

/* * Write */

/** Writes every manifest image and its variants; returns the number of variants converted (not from cache). */
export async function writeImages(manifest: AssetManifest, dirs: ImageDirs): Promise<number> {
	let converted = 0;
	await mkdir(dirs.cacheDir, { recursive: true });
	for (const [ref, entry] of Object.entries(manifest.assets)) {
		const master = await readMaster(dirs.assetsDir, entry.source ?? ref);
		if (!master) {
			throw new Error(`master of ${ref} not found (checked before writing)`);
		}
		if (!ref.endsWith('.png')) {
			await writeTo(path.join(dirs.outDir, ref), master);
		}
		for (const size of webpSizes(ref, entry)) {
			const cached = path.join(dirs.cacheDir, `${entry.sha256}@${String(size)}.webp`);
			if (!(await exists(cached))) {
				const webp = await sharp(master)
					.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
					.webp({ quality: WEBP.quality })
					.toBuffer();
				await writeFile(cached, webp);
				converted++;
			}
			const target = path.join(dirs.outDir, webpPath(ref, size));
			await mkdir(path.dirname(target), { recursive: true });
			await copyFile(cached, target);
		}
	}
	return converted;
}

/* * Fetched images */

/** Where `pnpm images:fetch` stores downloaded images, relative to the repository (git-ignored). */
export const FETCHED_FOLDER = '.cache/fetched';

/**
 * Copies downloaded images (instead of making them from masters) into the published folder;
 * returns the published paths that were not there.
 */
export async function copyFetchedImages(
	manifest: AssetManifest,
	fetchedDir: string,
	outDir: string,
): Promise<string[]> {
	const missing: string[] = [];
	for (const [ref, entry] of Object.entries(manifest.assets)) {
		for (const image of publishedImages(ref, entry)) {
			const source = path.join(fetchedDir, image.path);
			if (!(await exists(source))) {
				missing.push(image.path);
				continue;
			}
			const target = path.join(outDir, image.path);
			await mkdir(path.dirname(target), { recursive: true });
			await copyFile(source, target);
		}
	}
	return missing;
}

/** True when the folder exists. */
export async function folderExists(folder: string): Promise<boolean> {
	return exists(folder);
}

/* * Helpers */

async function writeTo(target: string, buffer: Buffer): Promise<void> {
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, buffer);
}

async function exists(file: string): Promise<boolean> {
	try {
		await stat(file);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}
