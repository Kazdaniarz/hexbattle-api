/*
 * Test-only source data: a small vocabulary and a fake army that pass every check. NOT API data.
 * Each call returns a fresh copy that a test may change.
 */
import type { Army, BoardSkin, Feature, MarkersFile, Mechanic, MechanicsFile, Skin, Tile } from '@hexbattle/schema';
import { type AssetManifest, collectAssetRefs } from '../../tools/lib/assets.ts';
import type { SourceData } from '../../tools/lib/data-files.ts';

/* * Helpers */

/** Text in both languages, so the clean fixture has no language warnings. */
export function text(pl: string): { pl: string; en: string } {
	return { pl, en: pl };
}

function mechanic(fields: Omit<Mechanic, 'name' | 'description' | 'official'> & { description?: string }): Mechanic {
	const { description = 'Opis.', ...rest } = fields;
	return { ...rest, name: text(rest.id), description: text(description), official: true };
}

function tile(id: string, fields: Partial<Tile> & { features: Feature[] }): Tile {
	const { features, ...rest } = fields;
	const slug = id.split('.')[1] ?? '';
	return {
		id,
		name: text(slug),
		category: 'warrior',
		copies: 1,
		setup_role: 'draw_pile',
		status: 'verified',
		faces: [{ side: 'front', playable: true, image: `testowa/${slug}_front.png`, features }],
		...rest,
	};
}

/* * Vocabulary */

export function mechanicsFile(): MechanicsFile {
	return {
		terms: {
			side: {
				own: text('własnych'),
				allied: text('sojuszniczych'),
				enemy: text('wrogich'),
				all: text('wszystkich'),
			},
		},
		mechanics: [
			mechanic({
				id: 'melee',
				kind: 'attack',
				placement: ['edge'],
				params: { strength: { type: 'integer', required: true, min: 1 } },
			}),
			mechanic({ id: 'armor', kind: 'defense', placement: ['edge'] }),
			mechanic({ id: 'net', kind: 'net', placement: ['edge'] }),
			mechanic({ id: 'trap_edge', kind: 'trap', placement: ['edge'] }),
			mechanic({
				id: 'module_link',
				kind: 'connector',
				placement: ['edge'],
				params: { range: { type: 'integer', required: true, values: [1, 2], default: 1 } },
			}),
			mechanic({
				id: 'initiative',
				kind: 'initiative',
				placement: ['slot'],
				params: { value: { type: 'integer', required: true, min: 0 } },
			}),
			mechanic({ id: 'toughness', kind: 'ability', placement: ['slot'], allowed_categories: ['unit'] }),
			mechanic({
				id: 'aura_pair',
				kind: 'ability',
				placement: ['slot'],
				allowed_categories: ['hq'],
				badge_count: 2,
				params: { group: { type: 'string', required: true } },
			}),
			mechanic({
				id: 'modify_stat',
				kind: 'effect',
				placement: ['center'],
				description: '{amount@sign:Zwiększa,Zmniejsza} {stat} {side} jednostek o {amount@abs}.',
				params: {
					stat: { type: 'string', required: true, values: ['melee'], labels: { melee: text('siłę ciosu') } },
					amount: { type: 'integer', required: true, signed: true, exclude: [0] },
				},
			}),
			mechanic({
				id: 'grant_ability',
				kind: 'effect',
				placement: ['center'],
				description: 'Daje cechę {ability}.',
				params: { ability: { type: 'id', required: true, ref: 'mechanic' } },
			}),
			mechanic({ id: 'push', kind: 'effect', placement: ['center'] }),
			mechanic({ id: 'module_feature', kind: 'container', placement: ['edge'] }),
			mechanic({
				id: 'test_rule',
				kind: 'army_rule',
				placement: ['none'],
				params: { count: { type: 'integer', min: 1 } },
			}),
			mechanic({
				id: 'scoped',
				kind: 'ability',
				placement: ['slot'],
				allowed_categories: ['unit'],
				scope: { army: 'testowa' },
			}),
		],
	};
}

export function markersFile(): MarkersFile {
	return {
		markers: [
			{
				id: 'wound',
				name: text('Rana'),
				unlimited: true,
				two_sided: false,
				placement: 'unit',
				images: { front: 'markers/wound.png' },
				size: 'standard',
				official_component: true,
			},
		],
	};
}

/* * Army */

export function army(): Army {
	return {
		id: 'testowa',
		name: text('Testowa'),
		official: true,
		origin: 'base_game',
		display: {
			colors: { primary: '#112233', layout: 'solid' },
			logo: { image: 'testowa/logo.svg' },
			back: 'testowa/back.png',
			hp_markers: [{ tile_id: 'testowa.sztab', image: 'testowa/hp_marker.png' }],
		},
		rules: [{ rule: 'test_rule', params: { count: 1 } }],
		deck: { size: 35 },
		tiles: [
			tile('testowa.sztab', {
				category: 'hq',
				setup_role: 'starting_hq',
				hp: 20,
				features: [
					{ mechanic: 'melee', at: { edge: 0 }, params: { strength: 1 } },
					{ mechanic: 'initiative', at: { slot: 'c5' }, params: { value: 0 } },
					{ mechanic: 'aura_pair', at: { slot: 'c1' }, category: 'hq', params: { group: 'a' } },
					{ mechanic: 'aura_pair', at: { slot: 'c3' }, category: 'hq', params: { group: 'a' } },
				],
			}),
			tile('testowa.wojownik', {
				copies: 30,
				features: [
					{ mechanic: 'melee', at: { edge: 0 }, params: { strength: 2 } },
					{ mechanic: 'armor', at: { edge: 1 } },
					{ mechanic: 'module_feature', at: { edge: 3 }, effects: [{ mechanic: 'push' }] },
					{ mechanic: 'initiative', at: { slot: 'c4' }, params: { value: 2 } },
					{ mechanic: 'toughness', at: { slot: 'c2' }, category: 'unit' },
					{ mechanic: 'scoped', at: { slot: 'c0' }, category: 'unit' },
				],
			}),
			tile('testowa.oficer', {
				category: 'module',
				copies: 2,
				features: [
					{ mechanic: 'module_link', at: { edge: 0 }, params: { range: 1 } },
					{
						mechanic: 'modify_stat',
						at: { center: true },
						params: { stat: 'melee', amount: 1 },
						side: 'allied',
					},
					{
						mechanic: 'grant_ability',
						at: { center: true },
						params: { ability: 'toughness' },
						side: 'allied',
					},
				],
			}),
			tile('testowa.odepchniecie', {
				category: 'instant',
				copies: 2,
				features: [{ mechanic: 'push', at: { center: true } }],
			}),
		],
	};
}

/* * Skins */

export function skin(): Skin {
	return {
		id: 'testowa.wariant',
		name: text('Wariant'),
		official: true,
		army: 'testowa',
		tiles: { 'testowa.sztab': { front: 'skins/testowa/wariant/sztab_front.png', front_art_only: true } },
		back: 'skins/testowa/wariant/back.png',
	};
}

export function boardSkin(): BoardSkin {
	return { id: 'plansza', name: text('Plansza'), official: true, image: 'board_skins/plansza.png', default: true };
}

/* * Source */

/** The whole clean source, as the loader would return it. */
export function source(): SourceData {
	return {
		mechanics: { file: 'mechanics.json', data: mechanicsFile() },
		markers: { file: 'markers.json', data: markersFile() },
		armies: [{ file: 'armies/testowa.json', data: army() }],
		skins: [{ file: 'skins/testowa.wariant.json', data: skin() }],
		boardSkins: [{ file: 'board_skins/plansza.json', data: boardSkin() }],
		issues: [],
	};
}

/* * Manifest */

/** A manifest listing every image the source references, with made-up hashes and tile-sized PNGs. */
export function manifestFor(s: SourceData): AssetManifest {
	const assets: AssetManifest['assets'] = {};
	for (const ref of collectAssetRefs(s).keys()) {
		assets[ref] = {
			sha256: '0'.repeat(64),
			bytes: 1,
			...(ref.endsWith('.png') && { width: 891, height: 771 }),
		};
	}
	return { assets };
}
