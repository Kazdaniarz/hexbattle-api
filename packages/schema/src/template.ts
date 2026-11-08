/*
 * Description templates: parsing and rendering of placeholders filled from a feature's values.
 * Every consumer (build, app) renders descriptions with these functions.
 *
 * Placeholders:
 *   {param}                  value, its label, a referenced mechanic's name, or a signed number
 *   {param±N}                number with an offset, e.g. {factor-1}
 *   {param:one,few,many}     "N form" with the Polish plural form of N
 *   {param@sign:Pos,Neg}     the first word for a positive number, the second for a negative one
 *   {param@abs}              the number without its sign (combinable with :one,few,many)
 *   {side}                   the word form of the feature's side
 */
import type { Feature } from './army.ts';
import type { Lang, Side, Text } from './common.ts';
import type { Mechanic, ParamValue, Terms } from './mechanics.ts';

/* * Types */

export type TemplatePart = { text: string } | { placeholder: Placeholder };

export interface Placeholder {
	/** Original source, e.g. `{factor-1:hex,hexy,hexów}`. */
	source: string;
	/** Parameter name, or `side`. */
	param: string;
	offset?: number;
	modifier?: 'abs' | { sign: [string, string] };
	plural?: [string, string, string];
}

export interface TemplateError {
	source: string;
	message: string;
}

/** Everything a render needs besides the template: the feature's values and the shared word forms. */
export interface RenderContext {
	lang: Lang;
	params: Readonly<Record<string, ParamValue>>;
	side?: Side;
	/** Word forms of `{side}`. */
	sideTerms: Readonly<Record<Side, Text>>;
	/** Word form of a labelled value: (param, value) → text, or undefined when the param has no labels. */
	label: (param: string, value: ParamValue) => Text | undefined;
	/** Name of a referenced mechanic for `ref: mechanic` params, or undefined. */
	refName: (param: string, value: ParamValue) => Text | undefined;
	/** Params rendered with a sign (+1 / −1). */
	isSigned: (param: string) => boolean;
}

/* * Parsing */

const PLACEHOLDER = /\{([^{}]*)\}/g;
const BODY = /^([a-z][a-z0-9_]*)([+-]\d+)?(?:@(abs|sign:([^,:]*),([^,:]*)))?(?::([^,]*),([^,]*),([^,]*))?$/;

/** Splits a template into text and placeholders; malformed placeholders are reported, never guessed. */
export function parseTemplate(template: string): { parts: TemplatePart[]; errors: TemplateError[] } {
	const parts: TemplatePart[] = [];
	const errors: TemplateError[] = [];
	let last = 0;
	for (const match of template.matchAll(PLACEHOLDER)) {
		if (match.index > last) {
			parts.push({ text: template.slice(last, match.index) });
		}
		last = match.index + match[0].length;
		const placeholder = parsePlaceholder(match[0], match[1] ?? '');
		if ('message' in placeholder) {
			errors.push(placeholder);
		} else {
			parts.push({ placeholder });
		}
	}
	if (last < template.length) {
		parts.push({ text: template.slice(last) });
	}
	const stray = template.replace(PLACEHOLDER, '').search(/[{}]/);
	if (stray !== -1) {
		errors.push({ source: template, message: 'unbalanced brace' });
	}
	return { parts, errors };
}

function parsePlaceholder(source: string, body: string): Placeholder | TemplateError {
	const match = BODY.exec(body);
	if (!match) {
		return { source, message: 'malformed placeholder' };
	}
	const [, param = '', offset, modifier, signPositive, signNegative, one, few, many] = match;
	if (modifier?.startsWith('sign') && (signPositive === '' || signNegative === '')) {
		return { source, message: '@sign needs exactly 2 non-empty forms' };
	}
	if (one !== undefined && (one === '' || few === '' || many === '')) {
		return { source, message: 'a plural needs 3 non-empty forms' };
	}
	if (modifier?.startsWith('sign') && one !== undefined) {
		return { source, message: '@sign cannot be combined with a plural' };
	}
	const placeholder: Placeholder = { source, param };
	if (offset !== undefined) {
		placeholder.offset = Number(offset);
	}
	if (modifier === 'abs') {
		placeholder.modifier = 'abs';
	} else if (modifier !== undefined) {
		placeholder.modifier = { sign: [signPositive ?? '', signNegative ?? ''] };
	}
	if (one !== undefined) {
		placeholder.plural = [one, few ?? '', many ?? ''];
	}
	return placeholder;
}

/** True when the placeholder only makes sense for a number (offset, plural, @abs, @sign). */
export function isNumericPlaceholder(placeholder: Placeholder): boolean {
	return placeholder.offset !== undefined || placeholder.modifier !== undefined || placeholder.plural !== undefined;
}

/* * Rendering */

/** Polish plural form index: 0 = one (1), 1 = few (2–4, 22–24…, not 12–14), 2 = many (everything else). */
export function pluralIndex(count: number): 0 | 1 | 2 {
	const n = Math.abs(count);
	if (n === 1) {
		return 0;
	}
	const lastDigit = n % 10;
	const lastTwo = n % 100;
	return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? 1 : 2;
}

/** Number with a sign; negative numbers use the minus sign (U+2212). */
export function signed(value: number): string {
	return value > 0 ? `+${String(value)}` : value < 0 ? `−${String(-value)}` : '0';
}

/** Renders a template that passed validation. Throws on a value it cannot fill (a data bug). */
export function renderTemplate(template: string, context: RenderContext): string {
	const { parts, errors } = parseTemplate(template);
	if (errors.length > 0) {
		throw new Error(`malformed template: ${errors.map((error) => error.source).join(', ')}`);
	}
	return parts.map((part) => ('text' in part ? part.text : renderPlaceholder(part.placeholder, context))).join('');
}

/**
 * Player-facing description of a feature: the mechanic's template filled with the feature's values
 * (missing values fall back to the param defaults). `mechanicById` resolves `ref: mechanic` params.
 */
export function renderDescription(
	mechanic: Mechanic,
	feature: Pick<Feature, 'params' | 'side'>,
	terms: Terms,
	mechanicById: (id: string) => Mechanic | undefined,
	lang: Lang = 'pl',
): string {
	const specs = mechanic.params ?? {};
	const params: Record<string, ParamValue> = {};
	for (const [name, spec] of Object.entries(specs)) {
		const value = feature.params?.[name] ?? spec.default;
		if (value !== undefined) {
			params[name] = value;
		}
	}
	return renderTemplate(mechanic.description[lang] ?? mechanic.description.pl, {
		lang,
		params,
		...(feature.side && { side: feature.side }),
		sideTerms: terms.side,
		label: (param, value) => specs[param]?.labels?.[String(value)],
		refName: (param, value) =>
			specs[param]?.ref === 'mechanic' && typeof value === 'string' ? mechanicById(value)?.name : undefined,
		isSigned: (param) => specs[param]?.signed === true,
	});
}

function renderPlaceholder(placeholder: Placeholder, context: RenderContext): string {
	const text = (value: Text): string => value[context.lang] ?? value.pl;
	if (placeholder.param === 'side') {
		if (context.side === undefined) {
			throw new Error(`${placeholder.source}: the feature has no side`);
		}
		return text(context.sideTerms[context.side]);
	}
	const value = context.params[placeholder.param];
	if (value === undefined) {
		throw new Error(`${placeholder.source}: no value for "${placeholder.param}"`);
	}
	if (!isNumericPlaceholder(placeholder)) {
		const word = context.label(placeholder.param, value) ?? context.refName(placeholder.param, value);
		if (word) {
			return text(word);
		}
		return typeof value === 'number' && context.isSigned(placeholder.param) ? signed(value) : String(value);
	}
	if (typeof value !== 'number') {
		throw new Error(`${placeholder.source}: "${placeholder.param}" is not a number`);
	}
	const { modifier, plural } = placeholder;
	if (typeof modifier === 'object') {
		return value > 0 ? modifier.sign[0] : modifier.sign[1];
	}
	const number = (modifier === 'abs' ? Math.abs(value) : value) + (placeholder.offset ?? 0);
	if (plural) {
		return `${String(number)} ${plural[pluralIndex(number)]}`;
	}
	return modifier === undefined && context.isSigned(placeholder.param) ? signed(number) : String(number);
}
