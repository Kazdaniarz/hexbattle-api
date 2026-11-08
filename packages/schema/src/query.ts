/*
 * Query service (/v1/query/…): accepted URL parameters and response shapes. Parameters arrive as strings;
 * lists are comma-separated. Unknown parameters are rejected.
 */
import { z } from 'zod';
import { TileCategory } from './army.ts';
import { ArmyScopedId, Id, Side } from './common.ts';
import { MarkerPlacement, MarkerType } from './markers.ts';
import { Mechanic, MechanicKind, Placement } from './mechanics.ts';
import { ReleaseArmy, ReleaseTile } from './release.ts';
import { BoardSkin, Skin } from './skins.ts';

/* * Parameter types */

/** Comma-separated list of allowed values: `moloch,borgo`. */
function list<T extends z.ZodType<unknown, string>>(item: T) {
	return z
		.string()
		.transform((value) => value.split(',').map((part) => part.trim()))
		.pipe(z.array(item).min(1).max(30));
}

const Count = z.coerce.number().int().min(0).max(1000);
const Text = z.string().trim().min(1).max(50);

export const QUERY_LIMIT = { default: 100, max: 500 } as const;

const Paging = {
	limit: z.coerce.number().int().min(1).max(QUERY_LIMIT.max).default(QUERY_LIMIT.default),
	offset: z.coerce.number().int().min(0).default(0),
};

/**
 * Lookup by id or name, shared by every query. `name` matches part of the name in any language, ignoring case
 * and Polish letters; with `exact=true` it must be the whole name.
 */
function lookup<T extends z.ZodType<unknown, string>>(idType: T) {
	return {
		id: list(idType).optional(),
		name: Text.optional(),
		exact: z.stringbool().optional(),
	};
}

/** Top-level tile fields `fields=` may pick; `army` is the tile's army id. */
export const TILE_FIELDS = ['army', ...Object.keys(ReleaseTile.shape)] as const;

/** Top-level army fields `fields=` may pick. */
export const ARMY_FIELDS = Object.keys(ReleaseArmy.shape) as [keyof typeof ReleaseArmy.shape];

/* * Tiles */

/** `/v1/query/tiles` parameters. `min_strength` and `side` refine `mechanic` and need it. */
export const TileQuery = z
	.strictObject({
		...lookup(ArmyScopedId),
		army: list(Id).optional(),
		category: list(TileCategory).optional(),
		mechanic: Id.optional(),
		min_strength: z.coerce.number().int().min(1).optional(),
		side: Side.optional(),
		hp: Count.optional(),
		min_hp: Count.optional(),
		max_hp: Count.optional(),
		initiative: Count.optional(),
		min_initiative: Count.optional(),
		copies: Count.optional(),
		min_copies: Count.optional(),
		fields: list(z.enum(TILE_FIELDS)).optional(),
		...Paging,
	})
	.refine((query) => query.mechanic !== undefined || (query.min_strength === undefined && query.side === undefined), {
		message: 'min_strength and side need mechanic',
		path: ['mechanic'],
	});
export type TileQuery = z.infer<typeof TileQuery>;

/* * Armies */

/** `/v1/query/armies` parameters. */
export const ArmyQuery = z.strictObject({
	...lookup(Id),
	origin: list(z.enum(['base_game', 'expansion'])).optional(),
	official: z.stringbool().optional(),
	fields: list(z.enum(ARMY_FIELDS)).optional(),
	...Paging,
});
export type ArmyQuery = z.infer<typeof ArmyQuery>;

/* * Mechanics */

/** `/v1/query/mechanics` parameters. */
export const MechanicQuery = z.strictObject({
	...lookup(Id),
	kind: list(MechanicKind).optional(),
	placement: list(Placement).optional(),
	used_by: Id.optional(),
	...Paging,
});
export type MechanicQuery = z.infer<typeof MechanicQuery>;

/* * Markers */

/** `/v1/query/markers` parameters. */
export const MarkerQuery = z.strictObject({
	...lookup(Id),
	placement: list(MarkerPlacement).optional(),
	...Paging,
});
export type MarkerQuery = z.infer<typeof MarkerQuery>;

/* * Skins */

/** `/v1/query/skins` parameters. */
export const SkinQuery = z.strictObject({
	...lookup(ArmyScopedId),
	army: list(Id).optional(),
	...Paging,
});
export type SkinQuery = z.infer<typeof SkinQuery>;

/** `/v1/query/board_skins` parameters. */
export const BoardSkinQuery = z.strictObject({
	...lookup(Id),
	default: z.stringbool().optional(),
	...Paging,
});
export type BoardSkinQuery = z.infer<typeof BoardSkinQuery>;

/* * Responses */

function result<T extends z.ZodType>(item: T) {
	return z.strictObject({
		/** The parameters as understood, with defaults filled in. */
		query: z.record(z.string(), z.unknown()),
		/** Matches before paging. */
		total: z.int().min(0),
		results: z.array(item),
	});
}

/** A tile with its army id; with `fields=` only the picked fields. */
export const TileResult = ReleaseTile.partial().extend({ army: Id.optional() });
export type TileResult = z.infer<typeof TileResult>;

/** An army as in its file; with `fields=` only the picked fields. */
export const ArmyResult = ReleaseArmy.partial();
export type ArmyResult = z.infer<typeof ArmyResult>;

export const TileQueryResult = result(TileResult).meta({ id: 'TileQueryResult' });
export type TileQueryResult = z.infer<typeof TileQueryResult>;

export const ArmyQueryResult = result(ArmyResult).meta({ id: 'ArmyQueryResult' });
export type ArmyQueryResult = z.infer<typeof ArmyQueryResult>;

export const MechanicQueryResult = result(Mechanic).meta({ id: 'MechanicQueryResult' });
export type MechanicQueryResult = z.infer<typeof MechanicQueryResult>;

export const MarkerQueryResult = result(MarkerType).meta({ id: 'MarkerQueryResult' });
export type MarkerQueryResult = z.infer<typeof MarkerQueryResult>;

export const SkinQueryResult = result(Skin).meta({ id: 'SkinQueryResult' });
export type SkinQueryResult = z.infer<typeof SkinQueryResult>;

export const BoardSkinQueryResult = result(BoardSkin).meta({ id: 'BoardSkinQueryResult' });
export type BoardSkinQueryResult = z.infer<typeof BoardSkinQueryResult>;

/** Error body of every rejected request. */
export const QueryError = z.strictObject({
	error: z.string(),
	details: z.array(z.strictObject({ param: z.string(), message: z.string() })).optional(),
});
export type QueryError = z.infer<typeof QueryError>;
