/*
 * Mechanics registry (`mechanics.json`): every game element defined once, referenced by id from tiles and armies.
 */
import { z } from 'zod';
import { Id, Text } from './common.ts';

/* * Vocabulary */

/** What kind of game element a mechanic is; each mechanic id maps to one handler in the game engine. */
export const MechanicKind = z.enum([
	'attack',
	'defense',
	'net',
	'connector',
	'trap',
	'container',
	'ability',
	'initiative',
	'effect',
	'status',
	'army_rule',
]);
export type MechanicKind = z.infer<typeof MechanicKind>;

/** Where a mechanic may appear on a tile face; `none` = army rules printed on no tile. */
export const Placement = z.enum(['edge', 'corner', 'slot', 'center', 'none']);
export type Placement = z.infer<typeof Placement>;

/** Badge colour, which decides activation and scope: gold, silver, grey, red, lavender, blue. */
export const BadgeCategory = z.enum(['unit', 'hq', 'hidden', 'ambush', 'forced', 'power']);
export type BadgeCategory = z.infer<typeof BadgeCategory>;

/** A single parameter value as stored on a feature. */
export const ParamValue = z.union([z.number(), z.string(), z.boolean()]);
export type ParamValue = z.infer<typeof ParamValue>;

/* * Parameters */

/** Definition of one parameter of a mechanic (type, limits, template word forms). */
export const ParamSpec = z.strictObject({
	type: z.enum(['integer', 'number', 'string', 'boolean', 'id']),
	required: z.boolean().optional(),
	default: ParamValue.optional(),
	values: z.array(ParamValue).min(1).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	// ? forbidden values, e.g. an amount of 0
	exclude: z.array(ParamValue).min(1).optional(),
	// ? word form per value, used by description templates
	labels: z.record(z.string(), Text).optional(),
	// ? numbers rendered with a sign in templates (+1 / −1)
	signed: z.boolean().optional(),
	// ? what an `id` parameter points at
	ref: z.enum(['mechanic', 'marker']).optional(),
});
export type ParamSpec = z.infer<typeof ParamSpec>;

/* * Mechanic */

/** One registry entry. `description` is player-facing and may be a template filled from the feature's values. */
export const Mechanic = z
	.strictObject({
		id: Id,
		kind: MechanicKind,
		name: Text,
		// ? plural for lists, e.g. "Ciosy" for a tile with Cios on several edges
		name_plural: Text.optional(),
		aliases: z.array(z.string().min(1)).min(1).optional(),
		description: Text,
		// ? army-specific mechanic; absent = global
		scope: z.strictObject({ army: Id }).optional(),
		placement: z.array(Placement).min(1),
		params: z.record(Id, ParamSpec).optional(),
		allowed_categories: z.array(BadgeCategory).min(1).optional(),
		// ? badges printed per effect, e.g. 2 for a two-badge ability
		badge_count: z.int().min(1).optional(),
		official: z.boolean(),
	})
	.meta({ id: 'Mechanic' });
export type Mechanic = z.infer<typeof Mechanic>;

/* * Terms */

/** Shared word forms used by templates; `side` fills `{side}`. */
export const Terms = z.strictObject({
	side: z.strictObject({ own: Text, allied: Text, enemy: Text, all: Text }),
});
export type Terms = z.infer<typeof Terms>;

/* * File */

/** Source and published file `mechanics.json`. */
export const MechanicsFile = z
	.strictObject({
		terms: Terms,
		mechanics: z.array(Mechanic).min(1),
	})
	.meta({ id: 'MechanicsFile' });
export type MechanicsFile = z.infer<typeof MechanicsFile>;
