/*
 * Serves the built API (dist/v1/) and the query service (run pnpm build first). A new build is picked up by
 * itself: the query service reloads its data when index.json changes.
 * Default: http://localhost:8080/v1/, reachable only from this computer.
 * Usage: node tools/serve.ts [--host 0.0.0.0] [--port 8080]   (or the HOST / PORT environment variables)
 */
import { watchFile } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadCatalogue } from './lib/query.ts';
import { createApiServer } from './lib/server.ts';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));

/* * Options */

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = '8080';

const { values } = parseArgs({
	options: {
		host: { type: 'string', default: process.env.HOST ?? DEFAULT_HOST },
		port: { type: 'string', default: process.env.PORT ?? DEFAULT_PORT },
	},
});
const host = values.host;
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	console.error(`✖ invalid port "${values.port}" (1–65535)`);
	process.exit(1);
}

/* * Start */

let catalogue = await loadCatalogue(path.join(DIST_DIR, 'v1')).catch((error: unknown) => {
	console.log(`⚠ no built data for the query service (${String(error)}) – run pnpm build`);
	return undefined;
});

const server = createApiServer(DIST_DIR, () => catalogue);

// ? a new build (pnpm build, or a publish from the dashboard): the query service follows it
watchFile(path.join(DIST_DIR, 'v1', 'index.json'), { interval: 2000 }, (current) => {
	if (current.mtimeMs === 0) return;
	loadCatalogue(path.join(DIST_DIR, 'v1'))
		.then((next) => {
			catalogue = next;
			console.log('✔ query service: new build loaded');
		})
		.catch((error: unknown) => {
			console.log(`⚠ new build not loaded (${String(error)})`);
		});
}).unref();
server.on('error', (error) => {
	console.error(`✖ cannot listen on ${host}:${String(port)}: ${error.message}`);
	process.exit(1);
});
server.listen(port, host, () => {
	const shown = host === DEFAULT_HOST ? 'localhost' : host;
	console.log(`✔ serving ${path.join(DIST_DIR, 'v1')} at http://${shown}:${String(port)}/v1/ (Ctrl+C to stop)`);
	if (host !== DEFAULT_HOST && host !== 'localhost') {
		console.log('⚠ reachable from other computers on the network');
	}
	if (catalogue) {
		const tiles = catalogue.armies.reduce((sum, army) => sum + (army.tiles?.length ?? 0), 0);
		const counts = [
			`${String(catalogue.armies.length)} armies`,
			`${String(tiles)} tiles`,
			`${String(catalogue.mechanics.length)} mechanics`,
			`${String(catalogue.markers.length)} markers`,
			`${String(catalogue.skins.length)} skins`,
			`${String(catalogue.boardSkins.length)} board skins`,
		];
		console.log(`✔ query service: ${counts.join(', ')}`);
	}
});
