/*
 * Unit tests of the description templates: parsing, Polish plurals, rendering.
 */
import { describe, expect, it } from 'vitest';
import { parseTemplate, pluralIndex, renderTemplate, signed, type RenderContext } from './template.ts';

/* * Helpers */

function context(params: RenderContext['params'], extra: Partial<RenderContext> = {}): RenderContext {
	return {
		lang: 'pl',
		params,
		sideTerms: {
			own: { pl: 'własnych' },
			allied: { pl: 'sojuszniczych' },
			enemy: { pl: 'wrogich' },
			all: { pl: 'wszystkich' },
		},
		label: () => undefined,
		refName: () => undefined,
		isSigned: () => false,
		...extra,
	};
}

/* * Parsing */
describe('parseTemplate', () => {
	it('splits text and placeholders', () => {
		const { parts, errors } = parseTemplate('o {factor-1:hex,hexy,hexów} na {side}.');
		expect(errors).toEqual([]);
		expect(parts).toEqual([
			{ text: 'o ' },
			{
				placeholder: {
					source: '{factor-1:hex,hexy,hexów}',
					param: 'factor',
					offset: -1,
					plural: ['hex', 'hexy', 'hexów'],
				},
			},
			{ text: ' na ' },
			{ placeholder: { source: '{side}', param: 'side' } },
			{ text: '.' },
		]);
	});
	it.each([
		'{}',
		'{Amount}',
		'{amount@sign:A}',
		'{amount:a,b}',
		'{amount@sign:A,B:x,y,z}',
		'{amount@bad}',
		'x } y',
		'{a {b}',
	])('reports %s', (template) => {
		expect(parseTemplate(template).errors).not.toEqual([]);
	});
});

/* * Plurals */
describe('pluralIndex', () => {
	it.each([
		[1, 0],
		[2, 1],
		[4, 1],
		[5, 2],
		[12, 2],
		[14, 2],
		[22, 1],
		[25, 2],
		[0, 2],
		[-2, 1],
	])('%i → %i', (count, index) => {
		expect(pluralIndex(count)).toBe(index);
	});
});

/* * Rendering */
describe('renderTemplate', () => {
	it('renders sign words and absolute values', () => {
		const template = '{amount@sign:Zwiększa,Zmniejsza} Inicjatywę {side} jednostek o {amount@abs}.';
		expect(renderTemplate(template, context({ amount: -1 }, { side: 'enemy' }))).toBe(
			'Zmniejsza Inicjatywę wrogich jednostek o 1.',
		);
		expect(renderTemplate(template, context({ amount: 2 }, { side: 'allied' }))).toBe(
			'Zwiększa Inicjatywę sojuszniczych jednostek o 2.',
		);
	});
	it('renders plurals with offsets', () => {
		const template = '{factor:Ruch,Ruchy,Ruchów}, o {factor-1:hex,hexy,hexów}';
		expect(renderTemplate(template, context({ factor: 2 }))).toBe('2 Ruchy, o 1 hex');
		expect(renderTemplate(template, context({ factor: 6 }))).toBe('6 Ruchów, o 5 hexów');
	});
	it('renders labels, referenced names and signed numbers', () => {
		const extra: Partial<RenderContext> = {
			label: (param) => (param === 'stat' ? { pl: 'siłę ciosu' } : undefined),
			refName: (param) => (param === 'ability' ? { pl: 'Mobilność' } : undefined),
			isSigned: (param) => param === 'amount',
		};
		expect(
			renderTemplate(
				'{stat} {ability} {amount}',
				context({ stat: 'melee', ability: 'mobility', amount: -1 }, extra),
			),
		).toBe('siłę ciosu Mobilność −1');
	});
	it('throws on a missing value or side', () => {
		expect(() => renderTemplate('{amount}', context({}))).toThrow();
		expect(() => renderTemplate('{side}', context({}))).toThrow();
	});
	it('formats signed numbers with a real minus sign', () => {
		expect([signed(1), signed(-1), signed(0)]).toEqual(['+1', '−1', '0']);
	});
});
