/*
 * Unit tests of the common types.
 */
import { describe, expect, it } from 'vitest';
import { Anchor, ArmyScopedId, AssetRef, Id, Side, Text } from './common.ts';

/* * Ids */
describe('Id', () => {
	it.each(['melee', 'iron_gang', 'zniszczone_miasto2013', 'oficer_i'])('accepts %s', (value) => {
		expect(Id.safeParse(value).success).toBe(true);
	});
	it.each(['Melee', 'żeton', 'iron-gang', '_melee', 'melee_', 'a__b', '', 'moloch.klaun'])(
		'rejects "%s"',
		(value) => {
			expect(Id.safeParse(value).success).toBe(false);
		},
	);
});

describe('ArmyScopedId', () => {
	it('accepts <army_id>.<slug>', () => {
		expect(ArmyScopedId.safeParse('moloch.opancerzony_lowca').success).toBe(true);
	});
	it.each(['moloch', 'moloch.', '.klaun', 'moloch.klaun.x', 'Moloch.klaun'])('rejects "%s"', (value) => {
		expect(ArmyScopedId.safeParse(value).success).toBe(false);
	});
});

/* * Texts */
describe('Text', () => {
	it('requires Polish, English optional', () => {
		expect(Text.safeParse({ pl: 'Cios' }).success).toBe(true);
		expect(Text.safeParse({ pl: 'Cios', en: 'Melee' }).success).toBe(true);
		expect(Text.safeParse({ en: 'Melee' }).success).toBe(false);
	});
	it('rejects empty texts and unknown keys', () => {
		expect(Text.safeParse({ pl: '  ' }).success).toBe(false);
		expect(Text.safeParse({ pl: 'Cios', de: 'Hieb' }).success).toBe(false);
	});
});

/* * Assets */
describe('AssetRef', () => {
	it.each(['moloch/klaun_front.png', 'moloch/logo.svg', 'skins/borgo/x/sztab_front.png', 'markers/wound.png'])(
		'accepts %s',
		(value) => {
			expect(AssetRef.safeParse(value).success).toBe(true);
		},
	);
	it.each(['/moloch/klaun.png', 'moloch/Klaun.png', 'moloch/klaun.webp', '../x.png', 'moloch\\klaun.png'])(
		'rejects %s',
		(value) => {
			expect(AssetRef.safeParse(value).success).toBe(false);
		},
	);
});

/* * Anchors */
describe('Anchor', () => {
	it.each([{ edge: 0 }, { edge: 5, i: 1 }, { corner: 3 }, { slot: 'c4' }, { slot: null }, { center: true }])(
		'accepts %j',
		(value) => {
			expect(Anchor.safeParse(value).success).toBe(true);
		},
	);
	it.each([
		{ edge: 6 },
		{ edge: 1.5 },
		{ corner: -1 },
		{ slot: 'x1' },
		{ center: false },
		{ edge: 0, corner: 1 },
		{},
	])('rejects %j', (value) => {
		expect(Anchor.safeParse(value).success).toBe(false);
	});
});

/* * Sides */
describe('Side', () => {
	it('keeps own and allied apart', () => {
		expect(Side.options).toEqual(['own', 'allied', 'enemy', 'all']);
	});
});
