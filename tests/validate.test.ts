/*
 * Semantic validation: the clean fixture passes, and every issue code has a fixture change that triggers it.
 */
import type { Army, Feature, Mechanic, Tile } from '@hexbattle/schema';
import { describe, expect, it } from 'vitest';
import type { SourceData } from '../tools/lib/data-files.ts';
import { ISSUE_CODES, type IssueCode } from '../tools/lib/issues.ts';
import { validate, type ValidateOptions } from '../tools/lib/validate/index.ts';
import { army as freshArmy, source, text } from './fixtures/source.ts';

/* * Helpers */

const DEV: ValidateOptions = { release: false, requireLangs: [] };

function armyOf(s: SourceData): Army {
	const army = s.armies[0]?.data;
	if (!army) throw new Error('fixture has no army');
	return army;
}

function tileOf(s: SourceData, slug: string): Tile {
	const tile = armyOf(s).tiles?.find((t) => t.id === `testowa.${slug}`);
	if (!tile) throw new Error(`fixture has no tile ${slug}`);
	return tile;
}

function featuresOf(s: SourceData, slug: string): Feature[] {
	const face = tileOf(s, slug).faces[0];
	if (!face) throw new Error(`fixture tile ${slug} has no face`);
	return face.features;
}

function featureOf(s: SourceData, slug: string, mechanic: string): Feature {
	const feature = featuresOf(s, slug).find((f) => f.mechanic === mechanic);
	if (!feature) throw new Error(`fixture tile ${slug} has no ${mechanic}`);
	return feature;
}

function mechanicOf(s: SourceData, id: string): Mechanic {
	const mechanic = s.mechanics?.data.mechanics.find((m) => m.id === id);
	if (!mechanic) throw new Error(`fixture has no mechanic ${id}`);
	return mechanic;
}

function codes(s: SourceData, options: ValidateOptions = DEV): IssueCode[] {
	return validate(s, options).map((issue) => issue.code);
}

/* * Clean fixture */

describe('clean fixture', () => {
	it('has no issues in a dev build or a release build', () => {
		expect(validate(source(), DEV)).toEqual([]);
		expect(validate(source(), { release: true, requireLangs: ['en'] })).toEqual([]);
	});
});

/* * One case per code */

interface Case {
	code: IssueCode;
	name: string;
	options?: Partial<ValidateOptions>;
	change: (s: SourceData) => void;
}

const CASES: Case[] = [
	// ? registry
	{
		code: 'E_MECH_DUP',
		name: 'mechanic twice',
		change: (s) => s.mechanics?.data.mechanics.push(mechanicOf(s, 'armor')),
	},
	{
		code: 'E_MARKER_DUP',
		name: 'marker twice',
		change: (s) => {
			const [rana] = s.markers?.data.markers ?? [];
			if (rana) s.markers?.data.markers.push(rana);
		},
	},
	{
		code: 'E_MECH_SCOPE',
		name: 'scoped to an unknown army',
		change: (s) => (mechanicOf(s, 'scoped').scope = { army: 'nikt' }),
	},
	{
		code: 'E_MECH_SCOPE',
		name: 'scoped mechanic used by another army',
		change: (s) => s.armies.push({ file: 'armies/druga.json', data: { ...freshArmy(), id: 'druga' } }),
	},
	{
		code: 'E_PARAM_LABELS',
		name: 'labels without a value',
		change: (s) => {
			const stat = mechanicOf(s, 'modify_stat').params?.stat;
			if (stat) stat.labels = { ...stat.labels, ranged: text('siłę strzału') };
		},
	},
	{
		code: 'E_TEMPLATE',
		name: 'malformed placeholder',
		change: (s) => (mechanicOf(s, 'push').description = text('Pcha {x y}.')),
	},
	{
		code: 'E_TEMPLATE',
		name: 'unknown param',
		change: (s) => (mechanicOf(s, 'push').description = text('Pcha {distance}.')),
	},
	{
		code: 'E_TEMPLATE',
		name: 'plural on a string',
		change: (s) => (mechanicOf(s, 'modify_stat').description = text('{stat:a,b,c} {side}.')),
	},
	{
		code: 'E_TEMPLATE',
		name: '@sign with one form',
		change: (s) => (mechanicOf(s, 'modify_stat').description = text('{amount@sign:Zwiększa} {stat} {side}.')),
	},
	{
		code: 'E_TEMPLATE',
		name: 'plural with two forms',
		change: (s) => (mechanicOf(s, 'modify_stat').description = text('{amount:a,b} {stat} {side}.')),
	},
	{
		code: 'E_TEMPLATE_LABEL',
		name: 'string param without labels',
		change: (s) => {
			const stat = mechanicOf(s, 'modify_stat').params?.stat;
			if (stat) delete stat.labels;
		},
	},
	{
		code: 'E_TEMPLATE_LABEL',
		name: 'label without the template language',
		change: (s) => {
			const stat = mechanicOf(s, 'modify_stat').params?.stat;
			if (stat) stat.labels = { melee: { pl: 'siłę ciosu' } };
		},
	},
	// ? params
	{
		code: 'E_PARAM_REQUIRED',
		name: 'strength missing',
		change: (s) => delete featureOf(s, 'wojownik', 'melee').params,
	},
	{
		code: 'E_PARAM_TYPE',
		name: 'strength as text',
		change: (s) => (featureOf(s, 'wojownik', 'melee').params = { strength: '2' }),
	},
	{
		code: 'E_PARAM_TYPE',
		name: 'id param not an id',
		change: (s) => (featureOf(s, 'oficer', 'grant_ability').params = { ability: 'Mobilność' }),
	},
	{
		code: 'E_PARAM_VALUE',
		name: 'range not in values',
		change: (s) => (featureOf(s, 'oficer', 'module_link').params = { range: 3 }),
	},
	{
		code: 'E_PARAM_VALUE',
		name: 'excluded amount',
		change: (s) => (featureOf(s, 'oficer', 'modify_stat').params = { stat: 'melee', amount: 0 }),
	},
	{
		code: 'E_PARAM_VALUE',
		name: 'invalid default',
		change: (s) => {
			const range = mechanicOf(s, 'module_link').params?.range;
			if (range) range.default = 5;
		},
	},
	{
		code: 'E_PARAM_RANGE',
		name: 'strength 0',
		change: (s) => (featureOf(s, 'wojownik', 'melee').params = { strength: 0 }),
	},
	{
		code: 'E_PARAM_RANGE',
		name: 'min greater than max',
		change: (s) => {
			const value = mechanicOf(s, 'initiative').params?.value;
			if (value) value.max = -1;
		},
	},
	{
		code: 'E_PARAM_UNKNOWN',
		name: 'unknown param',
		change: (s) => (featureOf(s, 'wojownik', 'armor').params = { strength: 1 }),
	},
	{
		code: 'E_PARAM_UNKNOWN',
		name: 'unknown army-rule param',
		change: (s) => (armyOf(s).rules = [{ rule: 'test_rule', params: { x: 1 } }]),
	},
	{
		code: 'E_PARAM_REF',
		name: 'ability that does not exist',
		change: (s) => (featureOf(s, 'oficer', 'grant_ability').params = { ability: 'latanie' }),
	},
	// ? army
	{
		code: 'E_ARMY_ID',
		name: 'file name differs',
		change: (s) => s.armies[0] && (s.armies[0].file = 'armies/inna.json'),
	},
	{ code: 'W_NOT_OFFICIAL', name: 'fan army', change: (s) => (armyOf(s).official = false) },
	{ code: 'W_ARMY_INCOMPLETE', name: 'no display', change: (s) => delete armyOf(s).display },
	{
		code: 'E_ARMY_INCOMPLETE',
		name: 'no deck in a release',
		options: { release: true },
		change: (s) => delete armyOf(s).deck,
	},
	{
		code: 'E_MANUAL_LANG_DUP',
		name: 'two Polish manuals',
		change: (s) => {
			const display = armyOf(s).display;
			if (display)
				display.manual = [
					{ language: 'pl', pdf_url: 'https://example.com/a.pdf' },
					{ language: 'pl', pdf_url: 'https://example.com/b.pdf' },
				];
		},
	},
	{ code: 'E_RULE_UNKNOWN', name: 'unknown rule', change: (s) => (armyOf(s).rules = [{ rule: 'gamble' }]) },
	{ code: 'E_RULE_KIND', name: 'rule is a mechanic', change: (s) => (armyOf(s).rules = [{ rule: 'melee' }]) },
	{
		code: 'E_RULE_DUP',
		name: 'rule twice',
		change: (s) => (armyOf(s).rules = [{ rule: 'test_rule' }, { rule: 'test_rule' }]),
	},
	{ code: 'E_DECK_SIZE', name: 'too many tiles', change: (s) => (tileOf(s, 'wojownik').copies = 31) },
	{
		code: 'E_DECK_SIZE',
		name: 'too few tiles in a release',
		options: { release: true },
		change: (s) => (tileOf(s, 'wojownik').copies = 29),
	},
	{ code: 'W_DECK_INCOMPLETE', name: 'too few tiles', change: (s) => (tileOf(s, 'wojownik').copies = 29) },
	{ code: 'E_HQ_COUNT', name: 'two Sztab copies', change: (s) => (tileOf(s, 'sztab').copies = 2) },
	{
		code: 'E_HQ_COUNT',
		name: 'a warrior as the Sztab',
		change: (s) => (tileOf(s, 'wojownik').setup_role = 'starting_hq'),
	},
	{
		code: 'E_HP_MARKER_TILE',
		name: 'HP marker for a warrior',
		change: (s) => {
			const display = armyOf(s).display;
			if (display) display.hp_markers = [{ tile_id: 'testowa.wojownik', image: 'testowa/hp_marker.png' }];
		},
	},
	// ? tiles
	{ code: 'E_TILE_DUP', name: 'tile twice', change: (s) => armyOf(s).tiles?.push(tileOf(s, 'odepchniecie')) },
	{
		code: 'E_TILE_PREFIX',
		name: 'foreign prefix',
		change: (s) => (tileOf(s, 'odepchniecie').id = 'inna.odepchniecie'),
	},
	{
		code: 'E_DRAFT',
		name: 'draft in a release',
		options: { release: true },
		change: (s) => (tileOf(s, 'wojownik').status = 'draft'),
	},
	{ code: 'E_HQ_HP', name: 'Sztab without hp', change: (s) => delete tileOf(s, 'sztab').hp },
	{ code: 'E_HP_ON_UNIT', name: 'warrior with hp', change: (s) => (tileOf(s, 'wojownik').hp = 10) },
	{
		code: 'E_MODULE_EMPTY',
		name: 'Moduł with links only',
		change: (s) =>
			(tileOf(s, 'oficer').faces = [
				{ side: 'front', playable: true, image: 'testowa/oficer_front.png', features: [] },
			]),
	},
	{
		code: 'E_FACE_DUP',
		name: 'two front faces',
		change: (s) => {
			const tile = tileOf(s, 'odepchniecie');
			const [face] = tile.faces;
			if (face) tile.faces = [face, face];
		},
	},
	{
		code: 'E_FACE_PLAYABLE',
		name: 'no playable face',
		change: (s) => {
			tileOf(s, 'odepchniecie').faces.forEach((face) => (face.playable = false));
		},
	},
	{
		code: 'E_IMAGE_PATH',
		name: 'tile image name',
		change: (s) => {
			tileOf(s, 'odepchniecie').faces.forEach((face) => (face.image = 'testowa/push.png'));
		},
	},
	{
		code: 'E_IMAGE_PATH',
		name: 'board skin image name',
		change: (s) => s.boardSkins[0] && (s.boardSkins[0].data.image = 'board_skins/x.png'),
	},
	// ? features
	{
		code: 'E_MECH_UNKNOWN',
		name: 'unknown mechanic',
		change: (s) => featuresOf(s, 'wojownik').push({ mechanic: 'gauss', at: { edge: 4 } }),
	},
	{ code: 'E_AT_MISSING', name: 'no anchor', change: (s) => delete featureOf(s, 'wojownik', 'armor').at },
	{
		code: 'E_PLACEMENT',
		name: 'attack in a badge position',
		change: (s) => (featureOf(s, 'wojownik', 'melee').at = { slot: 'e3' }),
	},
	{
		code: 'E_PLACEMENT',
		name: 'army rule on a tile',
		change: (s) => featuresOf(s, 'wojownik').push({ mechanic: 'test_rule', at: { center: true } }),
	},
	{
		code: 'E_PLACEMENT',
		name: 'anchor on a nested feature',
		change: (s) =>
			(featureOf(s, 'wojownik', 'module_feature').effects = [{ mechanic: 'push', at: { center: true } }]),
	},
	{
		code: 'E_SLOT_UNREAD',
		name: 'unread badge on a verified tile',
		change: (s) => (featureOf(s, 'wojownik', 'toughness').at = { slot: null }),
	},
	{
		code: 'W_SLOT_UNREAD',
		name: 'unread badge on a draft tile',
		change: (s) => {
			tileOf(s, 'wojownik').status = 'draft';
			featureOf(s, 'wojownik', 'toughness').at = { slot: null };
		},
	},
	{
		code: 'E_SLOT_DUP',
		name: 'two badges on c4',
		change: (s) => (featureOf(s, 'wojownik', 'toughness').at = { slot: 'c4' }),
	},
	{
		code: 'E_SLOT_OVERLAP',
		name: 'badges on c4 and e5',
		change: (s) => (featureOf(s, 'wojownik', 'toughness').at = { slot: 'e5' }),
	},
	{
		code: 'E_CATEGORY',
		name: 'silver Wytrzymałość',
		change: (s) => (featureOf(s, 'wojownik', 'toughness').category = 'hq'),
	},
	{
		code: 'E_CATEGORY',
		name: 'category on Inicjatywa',
		change: (s) => (featureOf(s, 'wojownik', 'initiative').category = 'unit'),
	},
	{
		code: 'E_CATEGORY_MISSING',
		name: 'no category',
		change: (s) => delete featureOf(s, 'wojownik', 'toughness').category,
	},
	{
		code: 'E_BADGE_GROUP',
		name: 'group shared with another mechanic',
		change: (s) => {
			const scoped = mechanicOf(s, 'scoped');
			scoped.badge_count = 2;
			scoped.params = { group: { type: 'string', required: true } };
			featuresOf(s, 'sztab').push({
				mechanic: 'scoped',
				at: { slot: 'c0' },
				category: 'unit',
				params: { group: 'a' },
			});
			featureOf(s, 'wojownik', 'scoped').params = { group: 'b' };
		},
	},
	{
		code: 'E_BADGE_COUNT',
		name: 'one badge of a pair',
		change: (s) => {
			const sztab = featuresOf(s, 'sztab');
			sztab.splice(
				sztab.findIndex((f) => f.mechanic === 'aura_pair'),
				1,
			);
		},
	},
	{
		code: 'E_EFFECT_SIDE',
		name: 'side on an attack',
		change: (s) => (featureOf(s, 'wojownik', 'melee').side = 'enemy'),
	},
	{
		code: 'E_EFFECT_SIDE',
		name: 'no side for {side}',
		change: (s) => delete featureOf(s, 'oficer', 'modify_stat').side,
	},
	{
		code: 'E_CONTAINER',
		name: 'effects on an attack',
		change: (s) => (featureOf(s, 'wojownik', 'melee').effects = [{ mechanic: 'push' }]),
	},
	{
		code: 'E_CONTAINER',
		name: 'empty container',
		change: (s) => delete featureOf(s, 'wojownik', 'module_feature').effects,
	},
	{
		code: 'E_EDGE_DUP_ATTACK',
		name: 'Cios twice on one edge',
		change: (s) => featuresOf(s, 'wojownik').push({ mechanic: 'melee', at: { edge: 0 }, params: { strength: 1 } }),
	},
	{
		code: 'E_MODULE_FEATURE_EDGE',
		name: 'Moduł feature beside Sieć',
		change: (s) => featuresOf(s, 'wojownik').push({ mechanic: 'net', at: { edge: 3 } }),
	},
	{
		code: 'E_MODULE_FEATURE_EDGE',
		name: 'Moduł feature beside a trap',
		change: (s) => featuresOf(s, 'wojownik').push({ mechanic: 'trap_edge', at: { edge: 3 } }),
	},
	// ? skins
	{ code: 'E_SKIN_DUP', name: 'skin twice', change: (s) => s.skins[0] && s.skins.push(s.skins[0]) },
	{ code: 'E_FILE_NAME', name: 'skin file name', change: (s) => s.skins[0] && (s.skins[0].file = 'skins/inny.json') },
	{
		code: 'E_FILE_NAME',
		name: 'board skin file name',
		change: (s) => s.boardSkins[0] && (s.boardSkins[0].file = 'board_skins/inna.json'),
	},
	{
		code: 'E_SKIN_PREFIX',
		name: 'foreign prefix',
		change: (s) => s.skins[0] && (s.skins[0].data.id = 'inna.wariant'),
	},
	{ code: 'E_SKIN_ARMY', name: 'unknown army', change: (s) => s.skins[0] && (s.skins[0].data.army = 'nikt') },
	{
		code: 'E_SKIN_TILE',
		name: 'unknown tile',
		change: (s) => s.skins[0] && (s.skins[0].data.tiles = { 'testowa.nikt': {} }),
	},
	{
		code: 'E_SKIN_FACE',
		name: 'back image for a one-face tile',
		change: (s) =>
			s.skins[0] &&
			(s.skins[0].data.tiles = { 'testowa.sztab': { back: 'skins/testowa/wariant/sztab_back.png' } }),
	},
	{
		code: 'E_SKIN_ART_ONLY',
		name: 'art-only without an image',
		change: (s) => s.skins[0] && (s.skins[0].data.tiles = { 'testowa.sztab': { back_art_only: true } }),
	},
	{
		code: 'E_SKIN_IMAGE_PATH',
		name: 'tile image name',
		change: (s) =>
			s.skins[0] && (s.skins[0].data.tiles = { 'testowa.sztab': { front: 'skins/testowa/sztab.png' } }),
	},
	{
		code: 'E_SKIN_IMAGE_PATH',
		name: 'back image name',
		change: (s) => s.skins[0] && (s.skins[0].data.back = 'testowa/back.png'),
	},
	{
		code: 'E_BOARD_SKIN_DUP',
		name: 'board skin twice',
		change: (s) =>
			s.boardSkins.push({
				file: 'board_skins/plansza.json',
				data: {
					...s.boardSkins[0]?.data,
					id: 'plansza',
					name: text('P'),
					official: true,
					image: 'board_skins/plansza.png',
				},
			}),
	},
	{
		code: 'E_BOARD_SKIN_DEFAULT',
		name: 'no default',
		change: (s) => s.boardSkins[0] && delete s.boardSkins[0].data.default,
	},
	{
		code: 'E_BOARD_SKIN_DEFAULT',
		name: 'no board skin in a release',
		options: { release: true },
		change: (s) => (s.boardSkins = []),
	},
	// ? languages
	{ code: 'W_LANG_MISSING', name: 'Polish only', change: (s) => (armyOf(s).name = { pl: 'Testowa' }) },
	{
		code: 'E_LANG_MISSING',
		name: 'English required',
		options: { requireLangs: ['en'] },
		change: (s) => (armyOf(s).name = { pl: 'Testowa' }),
	},
];

describe.each(CASES)('$code – $name', ({ code, options, change }) => {
	it('is reported', () => {
		const s = source();
		change(s);
		expect(codes(s, { ...DEV, ...options })).toContain(code);
	});
});

/* * Catalogue */

describe('issue catalogue', () => {
	it('has a triggering fixture for every code', () => {
		// ? E_SCHEMA: tests/data.test.ts, image codes: tests/assets.test.ts
		const elsewhere = ['E_SCHEMA', 'E_ASSET_MISSING', 'W_ASSET_MISSING', 'W_ASSET_UNUSED', 'E_ASSET_HASH'];
		const covered = new Set<string>([...elsewhere, ...CASES.map((c) => c.code)]);
		expect(Object.keys(ISSUE_CODES).filter((code) => !covered.has(code))).toEqual([]);
	});
});
