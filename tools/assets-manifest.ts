/*
 * Updates assets.manifest.json from the masters folder (ASSETS_DIR): one entry per image the data references,
 * with its SHA-256, size and dimensions. A master stored under another name keeps its `source` from the
 * current manifest; add `source` by hand for a new image whose master is named differently.
 * Usage: pnpm assets:manifest
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { collectAssetRefs, describeMaster, MANIFEST_FILE, ManifestEntry, readMaster } from './lib/assets.ts';
import { loadSourceData } from './lib/data-files.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANIFEST_PATH = path.join(ROOT, MANIFEST_FILE);

const CurrentManifest = z.strictObject({
	assets: z.record(z.string(), z.union([ManifestEntry, z.strictObject({ source: z.string().min(1) })])),
});
type CurrentManifest = z.infer<typeof CurrentManifest>;

/* * Inputs */

const assetsDir = process.env.ASSETS_DIR;
if (!assetsDir) {
	console.error('✖ ASSETS_DIR is not set (copy .env.example to .env)');
	process.exit(1);
}
const current = await readCurrent();
const source = await loadSourceData(path.join(ROOT, 'data'));
const refs = collectAssetRefs(source);

/* * Update */

const next: CurrentManifest = { assets: {} };
const missing: string[] = [];
for (const ref of [...refs.keys()].sort()) {
	const sourcePath = current.assets[ref]?.source;
	const master = await readMaster(assetsDir, sourcePath ?? ref);
	if (!master) {
		missing.push(`${ref}${sourcePath ? ` (source "${sourcePath}")` : ''}`);
		const kept = current.assets[ref];
		if (kept) next.assets[ref] = kept;
		continue;
	}
	next.assets[ref] = await describeMaster(master, sourcePath, ref.endsWith('.png'));
}
await writeFile(MANIFEST_PATH, `${JSON.stringify(next, null, '\t')}\n`);

const dropped = Object.keys(current.assets).filter((ref) => !refs.has(ref));
console.log(`✔ ${MANIFEST_FILE}: ${String(Object.keys(next.assets).length)} images`);
dropped.forEach((ref) => {
	console.log(`− removed (no longer referenced): ${ref}`);
});
missing.forEach((ref) => {
	console.log(`✖ master not found: ${ref} – add "source" for it in ${MANIFEST_FILE}`);
});
if (missing.length > 0) {
	process.exit(1);
}

/* * Helpers */

/** The current manifest; an entry may hold only a hand-written `source` until its master is described. */
async function readCurrent(): Promise<CurrentManifest> {
	try {
		return CurrentManifest.parse(JSON.parse(await readFile(MANIFEST_PATH, 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { assets: {} };
		}
		throw error;
	}
}
