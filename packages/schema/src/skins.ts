/*
 * Cosmetic records kept apart from the armies: army skins (`skins/<skin_id>.json`) and board skins
 * (`board_skins/<id>.json`). Neither ever changes a game feature.
 */
import { z } from 'zod';
import { ArmyScopedId, AssetRef, Id, Point, Slot, Text } from './common.ts';

/* * Army skin */

/**
 * Where one badge of the tile's front face is drawn in this skin's art: `feature` = its index in the front face's
 * features, `slot` (and `pos`) as on the unturned skin image. Game meaning unchanged.
 */
export const SkinBadge = z.strictObject({
	feature: z.int().min(0),
	slot: Slot,
	pos: Point.optional(),
});
export type SkinBadge = z.infer<typeof SkinBadge>;

/**
 * Replacement images for one tile; `*_art_only` = a face printed without iconography. A skin's art may be printed
 * turned against the tile data (`turn`: the image shows the tile turned k x 60 degrees clockwise – turn it back by as
 * much to lay it over the data's edges) and may draw badges at other spots (`badges`, front face only).
 */
export const SkinTile = z.strictObject({
	front: AssetRef.optional(),
	back: AssetRef.optional(),
	front_art_only: z.boolean().optional(),
	back_art_only: z.boolean().optional(),
	turn: z.int().min(1).max(5).optional(),
	badges: z.array(SkinBadge).min(1).optional(),
});
export type SkinTile = z.infer<typeof SkinTile>;

/**
 * One skin of one army: a single tile (e.g. a Sztab skin), several tiles or the whole army. An army skin may also bring
 * its own HP markers and mechanic pictures.
 */
export const Skin = z
	.strictObject({
		id: ArmyScopedId,
		name: Text,
		official: z.boolean(),
		army: Id,
		// ? the game edition this skin's art comes from, e.g. „Edycja Roku Molocha”
		edition: Text.optional(),
		// ? the order the army's skins were released in (1 = the first after Domyślna); lists follow it
		order: z.int().min(1).optional(),
		tiles: z.record(ArmyScopedId, SkinTile),
		// ? tile-back image of this skin
		back: AssetRef.optional(),
		// ? an army skin that always draws its own Sztab: no Sztab skin can be chosen with it
		own_hq: z.literal(true).optional(),
		// ? the skin's own HP markers, used instead of the army's while the skin is chosen – one per Sztab (or Obiekt)
		hp_markers: z
			.array(
				z.strictObject({
					tile_id: ArmyScopedId.optional(),
					image: AssetRef,
				}),
			)
			.min(1)
			.optional(),
		// ? the skin's own drawing of mechanic pictures, keyed by the default picture it replaces; shown for this army
		// only, always in its own colours (never recoloured like a mono glyph)
		mechanic_images: z.record(AssetRef, AssetRef).optional(),
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
