/*
 * Downloads the published images into .cache/fetched/ for a copy built without the private masters;
 * pnpm build then copies them into dist/v1/assets/.
 * Usage: node tools/images-fetch.ts [--from https://api.hexbattle.online] [--force]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { fetchImages } from './lib/fetch-images.ts';
import { FETCHED_FOLDER } from './lib/images.ts';

const FETCHED_DIR = path.join(fileURLToPath(new URL('../', import.meta.url)), FETCHED_FOLDER);
const PUBLIC_API = 'https://api.hexbattle.online';

/* * Options */

const { values } = parseArgs({
	options: {
		from: { type: 'string', default: PUBLIC_API },
		force: { type: 'boolean', default: false },
	},
});
if (!/^https?:\/\/[^/]+/.test(values.from)) {
	console.error(`✖ --from must be an http(s) address, e.g. ${PUBLIC_API}`);
	process.exit(1);
}

/* * Fetch */

console.log(`… reading the image list from ${values.from}/v1/index.json`);
const result = await fetchImages({ from: values.from, outDir: FETCHED_DIR, force: values.force }).catch(
	(error: unknown) => {
		console.error(
			`✖ cannot read ${values.from}/v1/index.json: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	},
);
for (const failure of result.failed) {
	console.log(`✖ ${failure.path}: ${failure.reason}`);
}
console.log(
	`✔ ${String(result.downloaded.length)} downloaded, ${String(result.kept.length)} already present, ${String(result.failed.length)} failed – in .cache/fetched/ (run pnpm build next)`,
);
if (result.failed.length > 0) {
	process.exit(1);
}
