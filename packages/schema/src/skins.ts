/*
 * Cosmetic records kept apart from the armies: army skins (`skins/<skin_id>.json`) and board skins
 * (`board_skins/<id>.json`). Neither ever changes a game feature.
 */
import { z } from 'zod';
import { ArmyScopedId, AssetRef, Id, Text } from './common.ts';

/* * Army skin */

/** Replacement images for one tile; `*_art_only` = a face printed without iconography. */
export const SkinTile = z.strictObject({
	front: AssetRef.optional(),
	back: AssetRef.optional(),
	front_art_only: z.boolean().optional(),
	back_art_only: z.boolean().optional(),
});
export type SkinTile = z.infer<typeof SkinTile>;

/** One skin of one army: a single tile (e.g. a Sztab skin), several tiles or the whole army. */
export const Skin = z
	.strictObject({
		id: ArmyScopedId,
		name: Text,
		official: z.boolean(),
		army: Id,
		tiles: z.record(ArmyScopedId, SkinTile),
		// ? tile-back image of this skin
		back: AssetRef.optional(),
	})
	.meta({ id: 'Skin' });
export type Skin = z.infer<typeof Skin>;

/* * Board skin */

/** A table background, chosen by the lobby host; exactly one board skin is the default. */
export const BoardSkin = z
	.strictObject({
		id: Id,
		name: Text,
		official: z.boolean(),
		image: AssetRef,
		default: z.literal(true).optional(),
	})
	.meta({ id: 'BoardSkin' });
export type BoardSkin = z.infer<typeof BoardSkin>;
