/*
 * Parameter values (features, army rules, spec defaults) checked against their ParamSpec.
 */
import { Id, type ParamSpec, type ParamValue } from '@hexbattle/schema';
import type { Context } from './context.ts';

/* * Values */

/** Checks one set of values against the specs of a mechanic. */
export function checkParams(
	ctx: Context,
	file: string,
	path: string,
	values: Readonly<Record<string, ParamValue>> | undefined,
	specs: Readonly<Record<string, ParamSpec>> | undefined,
	owner: string,
): void {
	const given = values ?? {};
	const known = specs ?? {};
	for (const name of Object.keys(given)) {
		if (!(name in known)) {
			ctx.report('E_PARAM_UNKNOWN', file, `${path}.${name}`, `${owner} has no param "${name}"`);
		}
	}
	for (const [name, spec] of Object.entries(known)) {
		const value = given[name];
		if (value === undefined) {
			if (spec.required) {
				ctx.report('E_PARAM_REQUIRED', file, path, `${owner} needs param "${name}"`);
			}
			continue;
		}
		checkValue(ctx, file, `${path}.${name}`, value, spec, `${owner}.${name}`);
	}
}

/** Checks one value: type, allowed and excluded values, range and reference target. */
export function checkValue(
	ctx: Context,
	file: string,
	path: string,
	value: ParamValue,
	spec: ParamSpec,
	owner: string,
): void {
	if (!hasType(value, spec.type)) {
		ctx.report('E_PARAM_TYPE', file, path, `${owner} must be of type ${spec.type}, got ${JSON.stringify(value)}`);
		return;
	}
	if (spec.values && !spec.values.includes(value)) {
		ctx.report(
			'E_PARAM_VALUE',
			file,
			path,
			`${owner}: ${JSON.stringify(value)} is not one of ${JSON.stringify(spec.values)}`,
		);
	}
	if (spec.exclude?.includes(value)) {
		ctx.report('E_PARAM_VALUE', file, path, `${owner}: ${JSON.stringify(value)} is not allowed`);
	}
	if (typeof value === 'number') {
		if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
			ctx.report('E_PARAM_RANGE', file, path, `${owner}: ${String(value)} is outside ${range(spec)}`);
		}
	}
	if (spec.ref && typeof value === 'string') {
		const exists = spec.ref === 'mechanic' ? ctx.mechanics.has(value) : ctx.markers.has(value);
		if (!exists) {
			ctx.report('E_PARAM_REF', file, path, `${owner}: unknown ${spec.ref} "${value}"`);
		}
	}
}

/* * Helpers */

function hasType(value: ParamValue, type: ParamSpec['type']): boolean {
	switch (type) {
		case 'integer':
			return Number.isInteger(value);
		case 'number':
			return typeof value === 'number';
		case 'string':
			return typeof value === 'string';
		case 'boolean':
			return typeof value === 'boolean';
		case 'id':
			return Id.safeParse(value).success;
	}
}

function range(spec: ParamSpec): string {
	return `${spec.min === undefined ? '−∞' : String(spec.min)}…${spec.max === undefined ? '∞' : String(spec.max)}`;
}
