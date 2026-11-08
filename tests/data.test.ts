/*
 * The repository data: every file in data/ parses with its schema, and the loader reports bad files.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Army, Index, ReleaseArmy, renderDescription } from '@hexbattle/schema';
import { describe, expect, it } from 'vitest';
import { AssetManifest, MANIFEST_FILE } from '../tools/lib/assets.ts';
import { build } from '../tools/lib/build.ts';
import { loadSourceData, parseFile } from '../tools/lib/data-files.ts';
import { validate } from '../tools/lib/validate/index.ts';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL(`../${MANIFEST_FILE}`, import.meta.url));

/* * Repository data */
describe('data/', async () => {
	const source = await loadSourceData(DATA_DIR);

	it('parses without schema errors', () => {
		expect(source.issues).toEqual([]);
	});
	it('has the registry, the markers and at least one army and board skin', () => {
		expect(source.mechanics).toBeDefined();
		expect(source.markers).toBeDefined();
		expect(source.armies.length).toBeGreaterThan(0);
		expect(source.boardSkins.length).toBeGreaterThan(0);
	});
	it('passes the release checks with only language warnings', () => {
		const issues = validate(source, { release: true, requireLangs: [] });
		expect(issues.filter((issue) => issue.code !== 'W_LANG_MISSING')).toEqual([]);
	});
	it('builds a release with every army complete and every image in the manifest', () => {
		const manifest = AssetManifest.parse(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
		const options = {
			release: true,
			requireLangs: [],
			datasetVersion: '0.0.0',
			generatedAt: new Date(0),
			manifest,
		};
		const { files, issues } = build(source, options);
		expect(issues.filter((issue) => issue.code !== 'W_LANG_MISSING')).toEqual([]);
		const index = Index.parse(files.get('index.json'));
		expect(index.armies.map((army) => army.completeness.status)).toEqual(index.armies.map(() => 'complete'));
		for (const army of index.armies) {
			expect(ReleaseArmy.safeParse(files.get(army.href)).success, army.href).toBe(true);
		}
	});
	it('renders the description of every feature', () => {
		const mechanics = new Map(source.mechanics?.data.mechanics.map((mechanic) => [mechanic.id, mechanic]));
		const terms = source.mechanics?.data.terms;
		if (!terms) throw new Error('no terms');
		const rendered = source.armies.flatMap(({ data }) =>
			(data.tiles ?? []).flatMap((tile) =>
				tile.faces.flatMap((face) =>
					face.features.map((feature) => {
						const mechanic = mechanics.get(feature.mechanic);
						if (!mechanic) throw new Error(`unknown mechanic ${feature.mechanic}`);
						return [
							tile.id,
							renderDescription(mechanic, feature, terms, (id) => mechanics.get(id)),
						] as const;
					}),
				),
			),
		);
		expect(rendered.every(([, description]) => !/[{}]/.test(description))).toBe(true);
		expect(new Map(rendered.filter(([id]) => id === 'posterunek.dywersant')).get('posterunek.dywersant')).toBe(
			'Zmniejsza Inicjatywę połączonych wrogich jednostek o 1. Efekty z kilku źródeł sumują się.',
		);
	});
});

/* * Loader */
describe('parseFile', () => {
	it('reports invalid JSON as E_SCHEMA', () => {
		const { data, issues } = parseFile('armies/x.json', '{', Army);
		expect(data).toBeUndefined();
		expect(issues).toMatchObject([{ code: 'E_SCHEMA', file: 'armies/x.json' }]);
	});
	it('reports schema mismatches with their path', () => {
		const text = JSON.stringify({ id: 'x', name: { pl: 'X' }, official: true, origin: 'base_game', notes: '' });
		const { issues } = parseFile('armies/x.json', text, Army);
		expect(issues).toMatchObject([{ code: 'E_SCHEMA', file: 'armies/x.json', path: '' }]);
	});
	it('rejects a $schema pointer (editors map the schemas instead)', () => {
		const text = JSON.stringify({ $schema: 'x', id: 'x', name: { pl: 'X' }, official: true, origin: 'base_game' });
		expect(parseFile('armies/x.json', text, Army).issues).toHaveLength(1);
	});
	it('formats nested paths', () => {
		const text = JSON.stringify({ id: 'x', name: { pl: '' }, official: true, origin: 'base_game' });
		const { issues } = parseFile('armies/x.json', text, Army);
		expect(issues).toMatchObject([{ path: 'name.pl' }]);
	});
});
