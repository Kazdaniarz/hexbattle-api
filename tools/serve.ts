/*
 * Serves the built API locally at http://localhost:8080/v1/ with the query service at /v1/query/
 * (run pnpm build first). Usage: node tools/serve.ts [--port 8080]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadCatalogue } from './lib/query.ts';
import { createApiServer } from './lib/server.ts';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));

const { values } = parseArgs({ options: { port: { type: 'string', default: '8080' } } });
const port = Number(values.port);

const catalogue = await loadCatalogue(path.join(DIST_DIR, 'v1')).catch((error: unknown) => {
	console.log(`⚠ no built data for the query service (${String(error)}) – run pnpm build`);
	return undefined;
});

createApiServer(DIST_DIR, catalogue).listen(port, '127.0.0.1', () => {
	console.log(`✔ serving ${path.join(DIST_DIR, 'v1')} at http://localhost:${String(port)}/v1/ (Ctrl+C to stop)`);
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
