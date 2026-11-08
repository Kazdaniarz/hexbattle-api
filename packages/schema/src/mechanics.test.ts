/*
 * Unit tests of the mechanics registry and the markers file schemas.
 */
import { describe, expect, it } from 'vitest';
import { MarkersFile } from './markers.ts';
import { Mechanic, MechanicsFile } from './mechanics.ts';

/* * Fixtures */
const melee = {
	id: 'melee',
	kind: 'attack',
	name: { pl: 'Cios' },
	name_plural: { pl: 'Ciosy' },
	description: { pl: 'Atak wręcz.' },
	placement: ['edge'],
	params: { strength: { type: 'integer', required: true, min: 1 } },
	official: true,
};

const modifyStat = {
	id: 'modify_stat',
	kind: 'effect',
	name: { pl: 'Modyfikator' },
	description: { pl: '{amount@sign:Zwiększa,Zmniejsza} {stat} połączonych {side} jednostek o {amount@abs}.' },
	placement: ['center'],
	params: {
		stat: { type: 'string', required: true, values: ['melee'], labels: { melee: { pl: 'siłę ciosu' } } },
		amount: { type: 'integer', required: true, signed: true, exclude: [0] },
	},
	official: true,
};

const terms = {
	side: {
		own: { pl: 'własnych' },
		allied: { pl: 'sojuszniczych' },
		enemy: { pl: 'wrogich' },
		all: { pl: 'wszystkich' },
	},
};

/* * Mechanic */
describe('Mechanic', () => {
	it('accepts an edge attack and a templated effect', () => {
		expect(Mechanic.safeParse(melee).success).toBe(true);
		expect(Mechanic.safeParse(modifyStat).success).toBe(true);
	});
	it.each(['rules', 'sources', 'refs', 'category_behaviour', 'notes'])(
		'rejects a "%s" field (game objects only)',
		(key) => {
			expect(Mechanic.safeParse({ ...melee, [key]: [] }).success).toBe(false);
		},
	);
	it('rejects an unknown kind, an empty placement and an unknown param type', () => {
		expect(Mechanic.safeParse({ ...melee, kind: 'spell' }).success).toBe(false);
		expect(Mechanic.safeParse({ ...melee, placement: [] }).success).toBe(false);
		expect(Mechanic.safeParse({ ...melee, params: { strength: { type: 'float' } } }).success).toBe(false);
	});
	it('requires a description', () => {
		const withoutDescription: Record<string, unknown> = { ...melee };
		delete withoutDescription.description;
		expect(Mechanic.safeParse(withoutDescription).success).toBe(false);
	});
});

/* * Mechanics file */
describe('MechanicsFile', () => {
	it('accepts terms + mechanics', () => {
		expect(MechanicsFile.safeParse({ terms, mechanics: [melee, modifyStat] }).success).toBe(true);
	});
	it('requires every side term', () => {
		const side: Record<string, unknown> = { ...terms.side };
		delete side.all;
		expect(MechanicsFile.safeParse({ terms: { side }, mechanics: [melee] }).success).toBe(false);
	});
});

/* * Markers file */
describe('MarkersFile', () => {
	const rana = {
		id: 'rana',
		name: { pl: 'Rana' },
		unlimited: true,
		two_sided: false,
		placement: 'unit',
		images: { front: 'markers/rana.png' },
		size: 'standard',
		official_component: true,
	};
	it('accepts a marker with images and one without', () => {
		const hpMarker: Record<string, unknown> = { ...rana, id: 'hp_marker', placement: 'hp_track' };
		delete hpMarker.images;
		expect(MarkersFile.safeParse({ markers: [rana, hpMarker] }).success).toBe(true);
	});
	it('rejects sources and unknown image kinds', () => {
		expect(MarkersFile.safeParse({ markers: [{ ...rana, sources: [] }] }).success).toBe(false);
		expect(MarkersFile.safeParse({ markers: [{ ...rana, images: { side: 'markers/rana.png' } }] }).success).toBe(
			false,
		);
	});
});
