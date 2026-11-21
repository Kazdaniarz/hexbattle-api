/*
 * Checks of the mechanics registry (param specs, labels, description templates) and of the marker types.
 */
import { isNumericPlaceholder, parseTemplate, type Lang, type Mechanic, type ParamSpec } from '@hexbattle/schema';
import type { Context } from './context.ts';
import { checkValue } from './params.ts';

const FILE = 'mechanics.json';

/* * Mechanics */

export function checkMechanics(ctx: Context, mechanics: readonly Mechanic[]): void {
	mechanics.forEach((mechanic, index) => {
		const path = `mechanics[${String(index)}]`;
		if (mechanic.scope && !ctx.armies.has(mechanic.scope.army)) {
			ctx.report(
				'E_MECH_SCOPE',
				FILE,
				`${path}.scope.army`,
				`${mechanic.id}: unknown army "${mechanic.scope.army}"`,
			);
		}
		for (const [name, spec] of Object.entries(mechanic.params ?? {})) {
			checkSpec(ctx, `${path}.params.${name}`, spec, `${mechanic.id}.${name}`);
		}
		for (const lang of Object.keys(mechanic.description) as Lang[]) {
			checkTemplate(ctx, `${path}.description.${lang}`, mechanic, lang);
		}
		checkImages(ctx, path, mechanic);
	});
}

/**
 * Pictures: under `mechanics/`, each variant's params are the mechanic's own with valid values, no two pictures for the
 * same params (at most one general picture).
 */
function checkImages(ctx: Context, path: string, mechanic: Mechanic): void {
	const seen = new Set<string>();
	(mechanic.images ?? []).forEach((picture, index) => {
		const at = `${path}.images[${String(index)}]`;
		if (!picture.image.startsWith('mechanics/')) {
			ctx.report('E_MECH_IMAGE', FILE, `${at}.image`, `${mechanic.id}: pictures live under "mechanics/"`);
		}
		const params = picture.params ?? {};
		for (const [name, value] of Object.entries(params)) {
			const spec = mechanic.params?.[name];
			if (spec === undefined) {
				ctx.report('E_MECH_IMAGE', FILE, `${at}.params.${name}`, `${mechanic.id}: no parameter "${name}"`);
				continue;
			}
			checkValue(ctx, FILE, `${at}.params.${name}`, value, spec, `${mechanic.id}.${name}`);
		}
		const key = JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
		if (seen.has(key)) {
			ctx.report('E_MECH_IMAGE', FILE, at, `${mechanic.id}: two pictures for the same parameters`);
		}
		seen.add(key);
	});
}

/** A spec must be consistent with itself: labels match its values, the default is a valid value. */
function checkSpec(ctx: Context, path: string, spec: ParamSpec, owner: string): void {
	if (spec.min !== undefined && spec.max !== undefined && spec.min > spec.max) {
		ctx.report('E_PARAM_RANGE', FILE, path, `${owner}: min is greater than max`);
	}
	if (spec.labels) {
		const keys = Object.keys(spec.labels).sort();
		const values = (spec.values ?? []).map(String).sort();
		if (JSON.stringify(keys) !== JSON.stringify(values)) {
			ctx.report('E_PARAM_LABELS', FILE, `${path}.labels`, `${owner}: labels must match values exactly`);
		}
	}
	if (spec.default !== undefined) {
		checkValue(ctx, FILE, `${path}.default`, spec.default, spec, `${owner} default`);
	}
}

/** Every placeholder is well-formed, names a param, and can be rendered in the template's language. */
function checkTemplate(ctx: Context, path: string, mechanic: Mechanic, lang: Lang): void {
	const template = mechanic.description[lang];
	if (template === undefined) {
		return;
	}
	const { parts, errors } = parseTemplate(template);
	for (const error of errors) {
		ctx.report('E_TEMPLATE', FILE, path, `${mechanic.id}: ${error.source}: ${error.message}`);
	}
	for (const part of parts) {
		if (!('placeholder' in part) || part.placeholder.param === 'side') {
			continue;
		}
		const { placeholder } = part;
		const spec = mechanic.params?.[placeholder.param];
		const where = `${mechanic.id}: ${placeholder.source}`;
		if (!spec) {
			ctx.report('E_TEMPLATE', FILE, path, `${where}: unknown param "${placeholder.param}"`);
			continue;
		}
		const isNumber = spec.type === 'integer' || spec.type === 'number';
		if (isNumericPlaceholder(placeholder)) {
			if (!isNumber) {
				ctx.report('E_TEMPLATE', FILE, path, `${where}: offset, plural, @sign and @abs need a number`);
			}
			continue;
		}
		if (isNumber || (spec.type === 'id' && spec.ref === 'mechanic')) {
			continue;
		}
		if (!spec.labels) {
			ctx.report('E_TEMPLATE_LABEL', FILE, path, `${where}: a ${spec.type} param needs labels`);
		} else if (Object.values(spec.labels).some((label) => label[lang] === undefined)) {
			ctx.report('E_TEMPLATE_LABEL', FILE, path, `${where}: a label has no "${lang}" text`);
		}
	}
}

/* * Templates */

/** True when the mechanic's description uses `{side}` in any language. */
export function usesSide(mechanic: Mechanic): boolean {
	return Object.values(mechanic.description).some(
		(template) =>
			template !== undefined &&
			parseTemplate(template).parts.some((part) => 'placeholder' in part && part.placeholder.param === 'side'),
	);
}
