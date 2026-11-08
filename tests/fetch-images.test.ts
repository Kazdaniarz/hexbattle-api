/*
 * pnpm images:fetch: downloading and checking the published images from a running API, and copying them into a build.
 */
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Index } from '@hexbattle/schema';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publishedImages, sha256 } from '../tools/lib/assets.ts';
import { build } from '../tools/lib/build.ts';
import { check, fetchImages } from '../tools/lib/fetch-images.ts';
import { copyFetchedImages } from '../tools/lib/images.ts';
import { createApiServer } from '../tools/lib/server.ts';
import { manifestFor, source } from './fixtures/source.ts';

/* * Setup: a published copy of the fixture with real images */

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
const manifest = manifestFor(source());
for (const [ref, entry] of Object.entries(manifest.assets)) {
	if (ref.endsWith('.svg')) entry.sha256 = sha256(SVG);
}
const { files } = build(source(), {
	release: true,
	requireLangs: [],
	datasetVersion: '1.0.0',
	generatedAt: new Date(0),
	manifest,
});
const index = files.get('index.json') as Index;
const images = Object.entries(index.assets.files).flatMap(([ref, entry]) => publishedImages(ref, entry));

let root = '';
let server: Server;
let from = '';

async function webp(size: number, format: 'webp' | 'png' = 'webp'): Promise<Buffer> {
	const image = sharp({
		create: { width: size, height: Math.round((size * 771) / 891), channels: 4, background: '#663399' },
	});
	return format === 'webp' ? image.webp().toBuffer() : image.png().toBuffer();
}

async function publish(dir: string, imagePath: string, body: Buffer): Promise<void> {
	await mkdir(path.dirname(path.join(dir, 'v1', 'assets', imagePath)), { recursive: true });
	await writeFile(path.join(dir, 'v1', 'assets', imagePath), body);
}

beforeAll(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'hexbattle-fetch-'));
	const published = path.join(root, 'published');
	for (const [file, value] of files) {
		await mkdir(path.dirname(path.join(published, 'v1', file)), { recursive: true });
		await writeFile(path.join(published, 'v1', file), JSON.stringify(value));
	}
	for (const image of images) {
		await publish(published, image.path, image.kind === 'svg' ? SVG : await webp(image.size));
	}
	server = createApiServer(published);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	from = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
	await new Promise<void>((resolve) =>
		server.close(() => {
			resolve();
		}),
	);
	await rm(root, { recursive: true, force: true });
});

/* * Fetch */

describe('fetchImages', () => {
	it('downloads every published file once, then keeps correct copies', async () => {
		const outDir = path.join(root, 'out-1');
		const first = await fetchImages({ from: `${from}/`, outDir });
		expect([first.downloaded.length, first.kept.length, first.failed]).toEqual([images.length, 0, []]);
		expect(await readdir(path.join(outDir, 'testowa'))).toContain('wojownik_front@512.webp');
		const second = await fetchImages({ from, outDir });
		expect([second.downloaded.length, second.kept.length]).toEqual([0, images.length]);
	});
	it('downloads again a local copy that is broken, or everything with force', async () => {
		const outDir = path.join(root, 'out-2');
		await fetchImages({ from, outDir });
		await writeFile(path.join(outDir, 'testowa', 'wojownik_front@128.webp'), 'broken');
		expect((await fetchImages({ from, outDir })).downloaded).toEqual(['testowa/wojownik_front@128.webp']);
		expect((await fetchImages({ from, outDir, force: true })).downloaded).toHaveLength(images.length);
	});
	it('fails a file the server sends wrong, and keeps the rest', async () => {
		const published = path.join(root, 'published');
		await publish(published, 'testowa/sztab_front@256.webp', await webp(300));
		await publish(published, 'testowa/back@128.webp', await webp(128, 'png'));
		await publish(published, 'testowa/logo.svg', Buffer.from('<svg/>'));
		const result = await fetchImages({ from, outDir: path.join(root, 'out-3') });
		expect(result.failed).toEqual([
			{ path: 'testowa/back@128.webp', reason: 'not a WebP image (png)' },
			{ path: 'testowa/logo.svg', reason: 'SHA-256 differs from index.json' },
			{ path: 'testowa/sztab_front@256.webp', reason: 'size 300×260, expected 256' },
		]);
		expect(result.downloaded).toHaveLength(images.length - 3);
	});
	it('reports a server that does not answer', async () => {
		await expect(
			fetchImages({ from: 'http://127.0.0.1:9', outDir: path.join(root, 'out-4'), timeoutMs: 2000 }),
		).rejects.toThrow();
	});
});

describe('check', () => {
	it('names what is wrong with a copy', async () => {
		expect(await check({ path: 'a.svg', kind: 'svg', sha256: sha256(SVG) }, SVG)).toBeUndefined();
		expect(await check({ path: 'a@128.webp', kind: 'webp', size: 128 }, undefined)).toBe('missing');
		expect(await check({ path: 'a@128.webp', kind: 'webp', size: 128 }, Buffer.from('x'))).toBe(
			'not a readable image',
		);
	});
});

/* * Build from fetched images */

describe('copyFetchedImages', () => {
	it('copies downloaded images into the build and lists the missing ones', async () => {
		const fetched = path.join(root, 'out-1');
		const outDir = path.join(root, 'dist-assets');
		expect(await copyFetchedImages(manifest, fetched, outDir)).toEqual([]);
		expect(await readdir(path.join(outDir, 'board_skins'))).toContain('plansza@891.webp');
		await rm(path.join(fetched, 'markers'), { recursive: true });
		expect(await copyFetchedImages(manifest, fetched, path.join(root, 'dist-assets-2'))).toEqual(
			publishedImages('markers/wound.png', { sha256: '', width: 891, height: 771 }).map((image) => image.path),
		);
	});
});
