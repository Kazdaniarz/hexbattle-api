/*
 * Downloads the published images of a running API (the public one or another copy) into a local folder, checking
 * every file: SVGs by SHA-256, WebP variants by format and size. Files already present and correct are kept.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AssetRef, Index } from '@hexbattle/schema';
import sharp from 'sharp';
import { publishedImages, sha256, type PublishedImage } from './assets.ts';

/* * Types */

export interface FetchOptions {
	/** Base address of the API, without `/v1`, e.g. `https://api.hexbattle.online`. */
	from: string;
	/** Folder that receives the images at their published paths (the contents of /v1/assets/). */
	outDir: string;
	/** Download again even when a correct copy exists. */
	force?: boolean;
	/** Parallel downloads. */
	concurrency?: number;
	/** Per-request time limit. */
	timeoutMs?: number;
}

export interface FetchResult {
	downloaded: string[];
	kept: string[];
	failed: { path: string; reason: string }[];
}

const DEFAULTS = { concurrency: 4, timeoutMs: 30_000 };
const USER_AGENT = 'hexbattle-api images:fetch';

/* * Fetch */

export async function fetchImages(options: FetchOptions): Promise<FetchResult> {
	const base = `${options.from.replace(/\/+$/, '')}/v1/`;
	const index = Index.parse(await getJson(`${base}index.json`, options.timeoutMs ?? DEFAULTS.timeoutMs));
	const images = Object.entries(index.assets.files).flatMap(([ref, entry]) => {
		if (!AssetRef.safeParse(ref).success) {
			throw new Error(`index.json lists an invalid image name "${ref}"`);
		}
		return publishedImages(ref, entry);
	});

	const result: FetchResult = { downloaded: [], kept: [], failed: [] };
	const queue = [...images];
	const worker = async (): Promise<void> => {
		for (let image = queue.shift(); image; image = queue.shift()) {
			await fetchOne(image, `${base}${index.assets.base}`, options, result);
		}
	};
	await Promise.all(Array.from({ length: options.concurrency ?? DEFAULTS.concurrency }, worker));
	for (const list of [result.downloaded, result.kept]) list.sort();
	result.failed.sort((a, b) => a.path.localeCompare(b.path));
	return result;
}

async function fetchOne(
	image: PublishedImage,
	assetsUrl: string,
	options: FetchOptions,
	result: FetchResult,
): Promise<void> {
	const target = path.join(options.outDir, image.path);
	if (!options.force && (await check(image, await readIfExists(target))) === undefined) {
		result.kept.push(image.path);
		return;
	}
	try {
		const body = await getBuffer(`${assetsUrl}${image.path}`, options.timeoutMs ?? DEFAULTS.timeoutMs);
		const problem = await check(image, body);
		if (problem) {
			result.failed.push({ path: image.path, reason: problem });
			return;
		}
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, body);
		result.downloaded.push(image.path);
	} catch (error) {
		result.failed.push({ path: image.path, reason: error instanceof Error ? error.message : String(error) });
	}
}

/* * Checks */

/** Undefined when the bytes are a correct copy of the image, otherwise what is wrong. */
export async function check(image: PublishedImage, body: Buffer | undefined): Promise<string | undefined> {
	if (!body) {
		return 'missing';
	}
	if (image.kind === 'svg') {
		return sha256(body) === image.sha256 ? undefined : 'SHA-256 differs from index.json';
	}
	try {
		const { format, width, height } = await sharp(body).metadata();
		if (format !== 'webp') {
			return `not a WebP image (${format})`;
		}
		return Math.max(width, height) === image.size
			? undefined
			: `size ${String(width)}×${String(height)}, expected ${String(image.size)}`;
	} catch {
		return 'not a readable image';
	}
}

/* * HTTP */

async function get(url: string, timeoutMs: number): Promise<Response> {
	const response = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT },
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${String(response.status)} for ${url}`);
	}
	return response;
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
	return (await get(url, timeoutMs)).json();
}

async function getBuffer(url: string, timeoutMs: number): Promise<Buffer> {
	return Buffer.from(await (await get(url, timeoutMs)).arrayBuffer());
}

async function readIfExists(file: string): Promise<Buffer | undefined> {
	try {
		return await readFile(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
}
