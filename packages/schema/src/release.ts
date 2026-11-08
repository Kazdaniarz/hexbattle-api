/*
 * Published files under /v1/: the source records plus values derived by the build, the index and the boards.
 */
import { z } from 'zod';
import { Army, Tile } from './army.ts';
import { HexIndex, Id, Lang, Text } from './common.ts';
import { BoardSkin } from './skins.ts';

/* * Derived values */

/** Where a Moduł's effects reach: its linked edges (with range), or the whole board when it has no links. */
export const ModuleReach = z.discriminatedUnion('type', [
	z.strictObject({ type: z.literal('linked'), edges: z.array(HexIndex).min(1), range: z.int().min(1) }),
	z.strictObject({ type: z.literal('global') }),
]);
export type ModuleReach = z.infer<typeof ModuleReach>;

/**
 * Per tile: HP of tiles that stand on the board as units (Sztab/Obiekt base HP, otherwise 1 + own Wytrzymałość
 * badges), printed Inicjatywa values, Moduł reach.
 */
export const TileDerived = z.strictObject({
	hp: z.int().min(1).optional(),
	initiative: z.array(z.int().min(0)),
	module_reach: ModuleReach.optional(),
});
export type TileDerived = z.infer<typeof TileDerived>;

/** How far an army is recorded: `complete` = every deck tile recorded and verified. */
export const Completeness = z.strictObject({
	tiles_recorded: z.int().min(0),
	copies_recorded: z.int().min(0),
	deck_size: z.int().min(0),
	draft_tiles: z.int().min(0),
	status: z.enum(['skeleton', 'in_progress', 'complete']),
});
export type Completeness = z.infer<typeof Completeness>;

/** Per army: mechanic ids the app needs handlers for, marker pools and board zones it needs, completeness. */
export const ArmyDerived = z.strictObject({
	mechanics_used: z.array(Id),
	required_pools: z.array(Id),
	board_roles: z.array(Id),
	completeness: Completeness,
});
export type ArmyDerived = z.infer<typeof ArmyDerived>;

/* * Published army */

export const ReleaseTile = Tile.extend({ derived: TileDerived }).meta({ id: 'ReleaseTile' });
export type ReleaseTile = z.infer<typeof ReleaseTile>;

/** `armies/<id>.json` as published. */
export const ReleaseArmy = Army.extend({
	tiles: z.array(ReleaseTile).min(1).optional(),
	derived: ArmyDerived,
}).meta({ id: 'ReleaseArmy' });
export type ReleaseArmy = z.infer<typeof ReleaseArmy>;

/* * Boards */

export const BoardZone = z.enum(['play', 'outer_side', 'outer_corner']);
export type BoardZone = z.infer<typeof BoardZone>;

/** A board layout only; the table background is a board skin, hexes and trackers are drawn by the app. */
export const Board = z
	.strictObject({
		id: Id,
		name: Text,
		orientation: z.literal('flat_top'),
		coordinates: z.literal('axial'),
		/** Axial step for each edge direction, clockwise from the top. */
		directions: z.array(z.strictObject({ edge: HexIndex, dq: z.int(), dr: z.int() })).length(6),
		hexes: z.array(z.strictObject({ id: z.string(), q: z.int(), r: z.int(), zone: BoardZone })),
		zone_roles: z.strictObject({ outer_side: z.array(Id), outer_corner: z.array(Id) }),
		/** Pairs of side hexes linked across a corner. */
		virtual_links: z.array(z.tuple([z.string(), z.string()])),
		/** Outer side hexes in clockwise order. */
		water_ring: z.array(z.string()),
		hp_track: z.strictObject({ min: z.int(), max: z.int() }),
	})
	.meta({ id: 'Board' });
export type Board = z.infer<typeof Board>;

/** `boards.json`. */
export const BoardsFile = z.strictObject({ boards: z.array(Board).min(1) }).meta({ id: 'BoardsFile' });
export type BoardsFile = z.infer<typeof BoardsFile>;

/* * Indexes */

/** What a skin covers: number of tiles, the whole army or not, the Sztab/Obiekt, its own tile back. */
export const SkinCoverage = z.strictObject({
	tiles: z.int().min(0),
	all_tiles: z.boolean(),
	includes_hq: z.boolean(),
	back: z.boolean(),
});
export type SkinCoverage = z.infer<typeof SkinCoverage>;

/** `skins/index.json`: every army skin with its army and coverage. */
export const SkinsIndex = z
	.strictObject({
		skins: z.array(
			z.strictObject({
				id: z.string(),
				army: Id,
				name: Text,
				official: z.boolean(),
				href: z.string(),
				coverage: SkinCoverage,
			}),
		),
	})
	.meta({ id: 'SkinsIndex' });
export type SkinsIndex = z.infer<typeof SkinsIndex>;

/** `board_skins/index.json`: every board skin and the default one. */
export const BoardSkinsIndex = z
	.strictObject({
		default: Id.optional(),
		board_skins: z.array(BoardSkin.pick({ id: true, name: true, official: true }).extend({ href: z.string() })),
	})
	.meta({ id: 'BoardSkinsIndex' });
export type BoardSkinsIndex = z.infer<typeof BoardSkinsIndex>;

/**
 * Published images under `base`: an image named `….png` in the data is served only as WebP variants named
 * `<path without .png>@<size>.webp` (size = longest side, never larger than the original); SVGs are served as they are.
 */
export const AssetsInfo = z.strictObject({
	base: z.string(),
	webp: z.strictObject({
		quality: z.int().min(1).max(100),
		sizes: z.array(z.int().min(1)),
		sizes_by_prefix: z.record(z.string(), z.array(z.int().min(1))),
		name: z.string(),
	}),
	/** Per image: content hash (changes when the image is replaced), pixel size of PNGs, WebP sizes available. */
	files: z.record(
		z.string(),
		z.strictObject({
			sha256: z.string().regex(/^[0-9a-f]{64}$/),
			width: z.int().min(1).optional(),
			height: z.int().min(1).optional(),
			webp: z.array(z.int().min(1)),
		}),
	),
});
export type AssetsInfo = z.infer<typeof AssetsInfo>;

/** `index.json`: release metadata, the army list and links to every other file. */
export const Index = z
	.strictObject({
		meta: z.strictObject({
			/** Semver of the data release; a new value means new data. */
			dataset_version: z.string().regex(/^\d+\.\d+\.\d+$/),
			/** Languages complete in this release. */
			languages: z.array(Lang).min(1),
			/** UTC instant of the build. */
			generated_at: z.iso.datetime(),
			build: z.enum(['dev', 'release']),
		}),
		armies: z.array(
			Army.pick({ id: true, name: true, official: true, origin: true }).extend({
				href: z.string(),
				completeness: Completeness,
			}),
		),
		files: z.strictObject({
			mechanics: z.string(),
			markers: z.string(),
			boards: z.string(),
			skins: z.string(),
			board_skins: z.string(),
			schemas: z.string(),
		}),
		assets: AssetsInfo,
	})
	.meta({ id: 'Index' });
export type Index = z.infer<typeof Index>;
