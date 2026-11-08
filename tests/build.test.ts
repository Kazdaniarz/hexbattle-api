/*
 * The build: published files, derived values and the board layout, on the test fixture.
 */
import type { Index, ReleaseArmy } from '@hexbattle/schema';
import { describe, expect, it } from 'vitest';
import { standardBoard } from '../tools/lib/board.ts';
import { build, type BuildOptions } from '../tools/lib/build.ts';
import { completeness, deriveTile, skinCoverage } from '../tools/lib/derive.ts';
import { RELEASE_SCHEMAS } from '../tools/lib/json-schema.ts';
import { army, manifestFor, skin, source } from './fixtures/source.ts';

/* * Helpers */

const OPTIONS: BuildOptions = {
	release: true,
	requireLangs: [],
	datasetVersion: '1.2.3',
	generatedAt: new Date('2026-03-29T01:30:00Z'),
	manifest: manifestFor(source()),
};

function tileById(id: string) {
	const tile = army().tiles?.find((t) => t.id === id);
	if (!tile) throw new Error(`no tile ${id}`);
	return tile;
}

/* * Files */

describe('build', () => {
	const { files, issues } = build(source(), OPTIONS);

	it('writes every published file', () => {
		expect(issues).toEqual([]);
		expect([...files.keys()].sort()).toEqual([
			'armies/testowa.json',
			'board_skins/index.json',
			'board_skins/plansza.json',
			'boards.json',
			'index.json',
			'markers.json',
			'mechanics.json',
			...Object.keys(RELEASE_SCHEMAS)
				.map((kind) => `schema/${kind}.schema.json`)
				.sort(),
			'skins/index.json',
			'skins/testowa.wariant.json',
		]);
	});
	it('fills the index meta from the options, in UTC', () => {
		const index = files.get('index.json') as Index;
		expect(index.meta).toEqual({
			dataset_version: '1.2.3',
			languages: ['pl', 'en'],
			generated_at: '2026-03-29T01:30:00.000Z',
			build: 'release',
		});
	});
	it('produces files that parse with the published schemas', () => {
		const schemaFor = (file: string) => {
			if (file === 'index.json') return RELEASE_SCHEMAS.index;
			if (file === 'boards.json') return RELEASE_SCHEMAS.boards;
			if (file === 'mechanics.json') return RELEASE_SCHEMAS.mechanics;
			if (file === 'markers.json') return RELEASE_SCHEMAS.markers;
			if (file === 'skins/index.json') return RELEASE_SCHEMAS.skins_index;
			if (file === 'board_skins/index.json') return RELEASE_SCHEMAS.board_skins_index;
			if (file.startsWith('armies/')) return RELEASE_SCHEMAS.army;
			if (file.startsWith('skins/')) return RELEASE_SCHEMAS.skin;
			if (file.startsWith('board_skins/')) return RELEASE_SCHEMAS.board_skin;
			return undefined;
		};
		for (const [file, value] of files) {
			const schema = schemaFor(file);
			if (schema) expect(schema.safeParse(value).success, file).toBe(true);
		}
	});
	it('adds derived values to the army and its tiles', () => {
		const release = files.get('armies/testowa.json') as ReleaseArmy;
		expect(release.derived.mechanics_used).toContain('push');
		expect(release.tiles?.every((tile) => tile.derived.initiative.length >= 0)).toBe(true);
	});
	it('publishes nothing when there are errors', () => {
		const broken = source();
		broken.armies[0]?.data.tiles?.push({ ...tileById('testowa.odepchniecie') });
		const result = build(broken, OPTIONS);
		expect(result.files.size).toBe(0);
		expect(result.issues.map((issue) => issue.code)).toContain('E_TILE_DUP');
	});
	it('lists only Polish as complete when an English text is missing', () => {
		const partial = source();
		const first = partial.armies[0];
		if (first) first.data.name = { pl: 'Testowa' };
		expect((build(partial, OPTIONS).files.get('index.json') as Index).meta.languages).toEqual(['pl']);
	});
});

/* * Derived values */

describe('deriveTile', () => {
	it('uses the base HP of a Sztab and 1 + Wytrzymałość for units', () => {
		expect(deriveTile(tileById('testowa.sztab'))).toEqual({ hp: 20, initiative: [0] });
		expect(deriveTile(tileById('testowa.wojownik'))).toEqual({ hp: 2, initiative: [2] });
	});
	it('gives an instant no HP', () => {
		expect(deriveTile(tileById('testowa.odepchniecie'))).toEqual({ initiative: [] });
	});
	it('derives Moduł reach from links, or global without links', () => {
		const oficer = tileById('testowa.oficer');
		expect(deriveTile(oficer).module_reach).toEqual({ type: 'linked', edges: [0], range: 1 });
		const face = oficer.faces[0];
		if (face) face.features = face.features.filter((f) => f.mechanic !== 'module_link');
		expect(deriveTile(oficer).module_reach).toEqual({ type: 'global' });
	});
});

describe('completeness', () => {
	it('is complete, in progress or a skeleton', () => {
		expect(completeness(army()).status).toBe('complete');
		const short = army();
		short.tiles = short.tiles?.slice(0, 1);
		expect(completeness(short)).toMatchObject({ status: 'in_progress', copies_recorded: 1, deck_size: 35 });
		const skeleton = army();
		delete skeleton.tiles;
		expect(completeness(skeleton).status).toBe('skeleton');
	});
});

describe('skinCoverage', () => {
	it('counts tiles, the Sztab and the back', () => {
		expect(skinCoverage(skin(), army())).toEqual({ tiles: 1, all_tiles: false, includes_hq: true, back: true });
	});
});

/* * Board */

describe('standardBoard', () => {
	const board = standardBoard();
	const zone = (name: string) => board.hexes.filter((hex) => hex.zone === name);

	it('has 19 play hexes, 12 side hexes and 6 corners', () => {
		expect([zone('play').length, zone('outer_side').length, zone('outer_corner').length]).toEqual([19, 12, 6]);
	});
	it('walks the outer ring clockwise from the N corner', () => {
		expect(board.hexes[19]?.id).toBe('0,-3');
		expect(board.water_ring.slice(0, 3)).toEqual(['1,-3', '2,-3', '3,-2']);
	});
	it('links the two side hexes around each corner', () => {
		expect(board.virtual_links[0]).toEqual(['-1,-2', '1,-3']);
		expect(board.virtual_links).toHaveLength(6);
	});
});
