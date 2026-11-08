/*
 * Public JSON Schemas generated from the Zod schemas (never written by hand).
 */
import {
	Army,
	ArmyQueryResult,
	BoardSkinQueryResult,
	MarkerQueryResult,
	SkinQueryResult,
	BoardSkin,
	BoardSkinsIndex,
	BoardsFile,
	Index,
	MarkersFile,
	MechanicQueryResult,
	MechanicsFile,
	ReleaseArmy,
	Skin,
	SkinsIndex,
	TileQueryResult,
} from '@hexbattle/schema';
import { z } from 'zod';

/* * Files */

/** Source files in data/, keyed by the generated schema's file name (editor validation). */
export const FILE_SCHEMAS = {
	army: Army,
	mechanics: MechanicsFile,
	markers: MarkersFile,
	skin: Skin,
	board_skin: BoardSkin,
} as const;

/** Published files and query responses under /v1/, keyed by the generated schema's file name (served in /v1/schema/). */
export const RELEASE_SCHEMAS = {
	index: Index,
	army: ReleaseArmy,
	mechanics: MechanicsFile,
	markers: MarkersFile,
	boards: BoardsFile,
	skin: Skin,
	skins_index: SkinsIndex,
	board_skin: BoardSkin,
	board_skins_index: BoardSkinsIndex,
	query_tiles: TileQueryResult,
	query_armies: ArmyQueryResult,
	query_mechanics: MechanicQueryResult,
	query_markers: MarkerQueryResult,
	query_skins: SkinQueryResult,
	query_board_skins: BoardSkinQueryResult,
} as const;

export type FileKind = keyof typeof FILE_SCHEMAS;
export type ReleaseKind = keyof typeof RELEASE_SCHEMAS;

/* * Generation */

/** JSON Schema (draft 2020-12) of a Zod schema; shared types are emitted once under `$defs`. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'throw' });
}
