/*
 * Unit tests of the army, tile and feature schemas, and of the skin records.
 */
import { describe, expect, it } from 'vitest';
import { Army, Feature, Tile } from './army.ts';
import { BoardSkin, Skin } from './skins.ts';

/* * Fixtures */
const warrior = {
	id: 'moloch.example',
	name: { pl: 'Przykład' },
	category: 'warrior',
	copies: 1,
	setup_role: 'draw_pile',
	status: 'verified',
	faces: [
		{
			side: 'front',
			playable: true,
			image: 'moloch/example_front.png',
			features: [
				{ mechanic: 'ranged', at: { edge: 0 }, params: { strength: 1 } },
				{ mechanic: 'initiative', at: { slot: 'c4' }, params: { value: 2 } },
				{ mechanic: 'wytrzymalosc', at: { slot: 'c2' }, category: 'unit' },
			],
		},
	],
};

const display = {
	colors: { primary: '#8D2418', secondary: '#4E0505', layout: 'solid' },
	logo: { image: 'moloch/logo.svg' },
	back: 'moloch/back.png',
	hp_markers: [{ tile_id: 'moloch.sztab', image: 'moloch/hp_marker.png' }],
};

const army = {
	id: 'moloch',
	name: { pl: 'Moloch' },
	official: true,
	origin: 'base_game',
	display,
	deck: { size: 35 },
	tiles: [warrior],
};

/* * Feature */
describe('Feature', () => {
	it('accepts flags, riders, cost and side', () => {
		const feature = {
			mechanic: 'net',
			at: { edge: 1 },
			flags: { friendly_fire: true },
			riders: ['jad'],
			cost: { gamble: 2 },
			side: 'enemy',
		};
		expect(Feature.safeParse(feature).success).toBe(true);
	});
	it('nests effects in a Moduł feature without their own anchor', () => {
		const feature = {
			mechanic: 'module_feature',
			at: { edge: 4 },
			effects: [{ mechanic: 'modify_stat', params: { stat: 'hp', amount: 1 }, side: 'allied' }],
		};
		expect(Feature.safeParse(feature).success).toBe(true);
	});
	it('needs at least two options in a choice', () => {
		const option = [{ mechanic: 'push', side: 'enemy' }];
		expect(Feature.safeParse({ mechanic: 'choice', at: { center: true }, options: [option, option] }).success).toBe(
			true,
		);
		expect(Feature.safeParse({ mechanic: 'choice', at: { center: true }, options: [option] }).success).toBe(false);
	});
	it('rejects notes, uncertain marks, false flags and unknown riders', () => {
		const base = { mechanic: 'melee', at: { edge: 0 }, params: { strength: 1 } };
		expect(Feature.safeParse({ ...base, notes: 'x' }).success).toBe(false);
		expect(Feature.safeParse({ ...base, uncertain: true }).success).toBe(false);
		expect(Feature.safeParse({ ...base, flags: { friendly_fire: false } }).success).toBe(false);
		expect(Feature.safeParse({ ...base, riders: ['ogien'] }).success).toBe(false);
	});
	it('rejects nested features with an invalid anchor', () => {
		const feature = {
			mechanic: 'module_feature',
			at: { edge: 4 },
			effects: [{ mechanic: 'medyk', at: { edge: 9 } }],
		};
		expect(Feature.safeParse(feature).success).toBe(false);
	});
});

/* * Tile */
describe('Tile', () => {
	it('accepts a warrior', () => {
		expect(Tile.safeParse(warrior).success).toBe(true);
	});
	it('accepts only Sztab or Obiekt base HP', () => {
		expect(Tile.safeParse({ ...warrior, category: 'hq', hp: 20 }).success).toBe(true);
		expect(Tile.safeParse({ ...warrior, hp: 2 }).success).toBe(false);
	});
	it('rejects zero copies, a plain tile id and three faces', () => {
		const face = warrior.faces[0];
		expect(Tile.safeParse({ ...warrior, copies: 0 }).success).toBe(false);
		expect(Tile.safeParse({ ...warrior, id: 'example' }).success).toBe(false);
		expect(Tile.safeParse({ ...warrior, faces: [face, face, face] }).success).toBe(false);
	});
});

/* * Army */
describe('Army', () => {
	it('accepts a complete army and a skeleton', () => {
		expect(Army.safeParse(army).success).toBe(true);
		expect(
			Army.safeParse({ id: 'moloch', name: { pl: 'Moloch' }, official: true, origin: 'base_game' }).success,
		).toBe(true);
	});
	it('accepts rules, pools, swap and manuals', () => {
		const full = {
			...army,
			display: { ...display, manual: [{ language: 'pl', pdf_url: 'https://example.com/moloch.pdf' }] },
			rules: [{ rule: 'gamble', params: { start: 2, max: 7 } }],
			pools: [{ marker: 'siec', count: 4, pool_type: 'limiting' }],
			deck: { size: 36, swap: [{ tile: 'moloch.example', mode: 'optional_replace_any_one', reveal: true }] },
		};
		expect(Army.safeParse(full).success).toBe(true);
	});
	it('rejects empty rules and pools (omit the section instead)', () => {
		expect(Army.safeParse({ ...army, rules: [] }).success).toBe(false);
		expect(Army.safeParse({ ...army, pools: [] }).success).toBe(false);
	});
	it('rejects lowercase colours, plain-http manuals and removed fields', () => {
		const lowercase = { ...display, colors: { ...display.colors, primary: '#8d2418' } };
		const http = { ...display, manual: [{ language: 'pl', pdf_url: 'http://example.com/m.pdf' }] };
		expect(Army.safeParse({ ...army, display: lowercase }).success).toBe(false);
		expect(Army.safeParse({ ...army, display: http }).success).toBe(false);
		expect(Army.safeParse({ ...army, skins: [] }).success).toBe(false);
		expect(Army.safeParse({ ...army, color_sources: [] }).success).toBe(false);
	});
	it('accepts a deck of 35 or 36 only', () => {
		expect(Army.safeParse({ ...army, deck: { size: 34 } }).success).toBe(false);
	});
});

/* * Skins */
describe('Skin and BoardSkin', () => {
	it('accepts a one-tile Sztab skin', () => {
		const skin = {
			id: 'borgo.przykladowy',
			name: { pl: 'Przykładowy' },
			official: true,
			army: 'borgo',
			tiles: { 'borgo.sztab': { front: 'skins/borgo/przykladowy/sztab_front.png', front_art_only: true } },
		};
		expect(Skin.safeParse(skin).success).toBe(true);
		expect(Skin.safeParse({ ...skin, tiles: { sztab: {} } }).success).toBe(false);
	});
	it('accepts a default board skin, never default: false', () => {
		const board = {
			id: 'zniszczone_miasto2013',
			name: { pl: 'Zniszczone miasto (2013)' },
			official: true,
			image: 'board_skins/zniszczone_miasto2013.png',
			default: true,
		};
		expect(BoardSkin.safeParse(board).success).toBe(true);
		expect(BoardSkin.safeParse({ ...board, default: false }).success).toBe(false);
	});
});
