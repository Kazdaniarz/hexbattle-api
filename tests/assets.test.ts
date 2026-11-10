/*
 * Images: manifest checks, master checks, WebP sizes and the image step, on generated test images.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	type AssetManifest,
	checkManifest,
	checkMasters,
	collectAssetRefs,
	describeMaster,
	findMaster,
	isStaged,
	webpPath,
	webpSizes,
} from '../tools/lib/assets.ts';
import { writeImages } from '../tools/lib/images.ts';
import { manifestFor, source } from './fixtures/source.ts';

/* * Manifest checks */

describe('checkManifest', () => {
	const refs = collectAssetRefs(source());

	it('collects every image the data references', () => {
		expect([...refs.keys()]).toEqual(
			expect.arrayContaining([
				'testowa/logo.svg',
				'testowa/back.png',
				'testowa/hp_marker.png',
				'testowa/sztab_front.png',
				'markers/wound.png',
				'skins/testowa/wariant/sztab_front.png',
				'skins/testowa/wariant/back.png',
				'board_skins/plansza.png',
			]),
		);
	});
	it('passes when the manifest lists exactly the referenced images', () => {
		expect(checkManifest(refs, manifestFor(source()), true)).toEqual([]);
	});
	it('reports an unlisted image (error in a release, warning otherwise)', () => {
		const manifest = manifestFor(source());
		delete manifest.assets['markers/wound.png'];
		expect(checkManifest(refs, manifest, true).map((issue) => issue.code)).toEqual(['E_ASSET_MISSING']);
		expect(checkManifest(refs, manifest, false).map((issue) => issue.code)).toEqual(['W_ASSET_MISSING']);
	});
	it('reports a listed image nobody uses', () => {
		const manifest = manifestFor(source());
		manifest.assets['testowa/old_front.png'] = { sha256: '1'.repeat(64), bytes: 1 };
		expect(checkManifest(refs, manifest, true).map((issue) => issue.code)).toEqual(['W_ASSET_UNUSED']);
	});
});

/* * WebP sizes */

describe('webpSizes', () => {
	it('never enlarges and uses the board sizes for board skins', () => {
		expect(webpSizes('testowa/a_front.png', { width: 891, height: 771 })).toEqual([512, 256, 128]);
		expect(webpSizes('markers/wound.png', { width: 430, height: 430 })).toEqual([256, 128]);
		expect(webpSizes('board_skins/plansza.png', { width: 5032, height: 3328 })).toEqual([4096, 2048, 1024]);
		expect(webpSizes('testowa/logo.svg', {})).toEqual([]);
	});
	it('gives a master smaller than every size one variant at its own size', () => {
		expect(webpSizes('markers/maly.png', { width: 100, height: 90 })).toEqual([100]);
		expect(webpSizes('markers/rowny.png', { width: 512, height: 400 })).toEqual([512, 256, 128]);
	});
	it('names variants after the master', () => {
		expect(webpPath('moloch/klaun_front.png', 512)).toBe('moloch/klaun_front@512.webp');
	});
});

/* * Masters and the image step */

describe('masters', () => {
	let root = '';
	let manifest: AssetManifest = { assets: {} };

	beforeAll(async () => {
		root = await mkdtemp(path.join(tmpdir(), 'hexbattle-assets-'));
		const png = await sharp({ create: { width: 600, height: 400, channels: 4, background: '#336699' } })
			.png()
			.toBuffer();
		await writeFile(path.join(root, 'tile.png'), png);
		await writeFile(path.join(root, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
		manifest = {
			assets: {
				'testowa/a_front.png': await describeMaster(png, 'tile.png', true),
				'testowa/logo.svg': await describeMaster(Buffer.from('<svg/>'), 'logo.svg', false),
			},
		};
	});
	afterAll(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it('records hash, size and PNG dimensions', () => {
		expect(manifest.assets['testowa/a_front.png']).toMatchObject({ source: 'tile.png', width: 600, height: 400 });
	});
	it('reports a missing master and a changed one', async () => {
		const broken: AssetManifest = {
			assets: { ...manifest.assets, 'testowa/b_front.png': { sha256: '2'.repeat(64), bytes: 1 } },
		};
		const codes = (await checkMasters(broken, { assetsDir: root }, true)).map(
			(issue) => `${issue.code} ${issue.path ?? ''}`,
		);
		expect(codes).toEqual(['E_ASSET_HASH testowa/logo.svg', 'E_ASSET_MISSING testowa/b_front.png']);
	});
	it('takes a staged master (stored under its published path) before the masters folder', async () => {
		const staged = path.join(root, 'staged');
		const replaced = await sharp({
			create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
		})
			.png()
			.toBuffer();
		await mkdir(path.join(staged, 'testowa'), { recursive: true });
		await writeFile(path.join(staged, 'testowa', 'a_front.png'), replaced);
		const masters = { assetsDir: root, stagedDir: staged };
		expect(await isStaged(masters, 'testowa/a_front.png')).toBe(true);
		expect(await isStaged(masters, 'testowa/logo.svg')).toBe(false);
		expect(await findMaster(masters, 'testowa/a_front.png', 'tile.png')).toEqual(replaced);
		expect(await findMaster({ assetsDir: root }, 'testowa/a_front.png', 'tile.png')).not.toEqual(replaced);
		// ? the manifest still records the old master, so the staged one counts as changed until it is recorded
		const codes = (await checkMasters(manifest, masters, true)).map((issue) => `${issue.code} ${issue.path ?? ''}`);
		expect(codes).toContain('E_ASSET_HASH testowa/a_front.png');
		const recorded: AssetManifest = {
			assets: { ...manifest.assets, 'testowa/a_front.png': await describeMaster(replaced, undefined, true) },
		};
		expect((await checkMasters(recorded, masters, true)).map((issue) => issue.path)).not.toContain(
			'testowa/a_front.png',
		);
	});
	it('writes WebP variants and SVGs but never the PNG master, converting each variant only once', async () => {
		const images = manifest;
		const dirs = { assetsDir: root, outDir: path.join(root, 'out'), cacheDir: path.join(root, 'cache') };
		expect(await writeImages(images, dirs)).toBe(3);
		expect((await readdir(path.join(root, 'out', 'testowa'))).sort()).toEqual([
			'a_front@128.webp',
			'a_front@256.webp',
			'a_front@512.webp',
			'logo.svg',
		]);
		const variant = await readFile(path.join(root, 'out', 'testowa', 'a_front@256.webp'));
		const { width, height } = await sharp(variant).metadata();
		expect([width, height]).toEqual([256, 171]);
		expect(await writeImages(images, dirs)).toBe(0);
	});
});
