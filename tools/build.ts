/*
 * Builds the published API into dist/v1/: JSON files and images. Images are made from the private masters when
 * ASSETS_DIR is set, otherwise copied from images downloaded by pnpm images:fetch (.cache/fetched/); with neither
 * (e.g. in CI) the data and the manifest are still checked, but no images are written.
 * Usage: node tools/build.ts [--release] [--require-lang en]
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Lang } from '@hexbattle/schema';
import { AssetManifest, checkMasters, MANIFEST_FILE } from './lib/assets.ts';
import { build } from './lib/build.ts';
import { loadSourceData, parseFile } from './lib/data-files.ts';
import { copyFetchedImages, FETCHED_FOLDER, folderExists, writeImages } from './lib/images.ts';
import { isError, type Issue } from './lib/issues.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'dist', 'v1');
const CACHE_DIR = path.join(ROOT, '.cache', 'images');
const FETCHED_DIR = path.join(ROOT, FETCHED_FOLDER);
const ASSETS_DIR = process.env.ASSETS_DIR;

/* * Options */

const { values } = parseArgs({
	options: {
		release: { type: 'boolean', default: false },
		'require-lang': { type: 'string', multiple: true, default: [] },
	},
});
const requireLangs = values['require-lang'].map((lang) => Lang.parse(lang));
const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as { version: string };

/* * Build */

const source = await loadSourceData(DATA_DIR);
const parsedManifest = parseFile(MANIFEST_FILE, await readFile(path.join(ROOT, MANIFEST_FILE), 'utf8'), AssetManifest);
const manifest = parsedManifest.data ?? { assets: {} };
const { files, issues } = build(source, {
	release: values.release,
	requireLangs,
	datasetVersion: version,
	generatedAt: new Date(),
	manifest,
});
issues.unshift(...parsedManifest.issues);
if (ASSETS_DIR) {
	issues.push(...(await checkMasters(manifest, ASSETS_DIR, values.release)));
}
report(issues);
if (issues.some(isError)) {
	process.exit(1);
}

await rm(OUT_DIR, { recursive: true, force: true });
for (const [file, value] of files) {
	const target = path.join(OUT_DIR, file);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, JSON.stringify(value));
}
if (ASSETS_DIR) {
	const converted = await writeImages(manifest, {
		assetsDir: ASSETS_DIR,
		outDir: path.join(OUT_DIR, 'assets'),
		cacheDir: CACHE_DIR,
	});
	console.log(
		`✔ images: ${String(Object.keys(manifest.assets).length)} masters, ${String(converted)} WebP variants converted`,
	);
} else if (await folderExists(FETCHED_DIR)) {
	const missing = await copyFetchedImages(manifest, FETCHED_DIR, path.join(OUT_DIR, 'assets'));
	console.log(`✔ images: copied from ${FETCHED_FOLDER}/ (downloaded by pnpm images:fetch)`);
	if (missing.length > 0) {
		console.log(
			`⚠ ${String(missing.length)} image file(s) not downloaded yet, e.g. ${missing[0] ?? ''} – run pnpm images:fetch`,
		);
	}
} else {
	console.log('⚠ no images: set ASSETS_DIR (masters) or run pnpm images:fetch – data and manifest checked only');
}
console.log(`✔ ${values.release ? 'release' : 'dev'} build ${version}: ${String(files.size)} JSON files in dist/v1/`);

/* * Report */

function report(list: readonly Issue[]): void {
	for (const issue of list) {
		const where = issue.path ? `${issue.file} › ${issue.path}` : issue.file;
		console.log(`${isError(issue) ? '✖' : '⚠'} ${issue.code} ${where}: ${issue.message}`);
	}
	const errors = list.filter(isError).length;
	if (list.length > 0) {
		console.log(`${String(errors)} error(s), ${String(list.length - errors)} warning(s)`);
	}
}
