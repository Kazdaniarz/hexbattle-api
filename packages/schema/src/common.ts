/*
 * Common types shared by every API file: ids, texts, asset references, anchors, sides.
 */
import { z } from 'zod';

/* * Ids */

/** ASCII slug: lowercase letters and digits, `_` separators, Polish letters transliterated (ż→z, ł→l…). */
const SLUG = '[a-z0-9]+(?:_[a-z0-9]+)*';

/** Plain id (army, mechanic, marker, board skin): `iron_gang`, `melee`, `zniszczone_miasto2013`. */
export const Id = z.string().regex(new RegExp(`^${SLUG}$`), 'expected a snake_case ASCII id');
export type Id = z.infer<typeof Id>;

/** Id scoped to an army (tile, skin): `<army_id>.<slug>`, e.g. `moloch.klaun`. */
export const ArmyScopedId = z
	.string()
	.regex(new RegExp(`^${SLUG}\\.${SLUG}$`), 'expected an army-scoped id "<army_id>.<slug>"');
export type ArmyScopedId = z.infer<typeof ArmyScopedId>;

/* * Texts */

/** Languages of player-facing texts; Polish is required, English is optional. */
export const Lang = z.enum(['pl', 'en']);
export type Lang = z.infer<typeof Lang>;

/** Player-facing text: Polish required, English optional. */
export const Text = z.strictObject({
	pl: z.string().trim().min(1),
	en: z.string().trim().min(1).optional(),
});
export type Text = z.infer<typeof Text>;

/* * Assets */

/** Published path of an image under `/v1/assets/`, e.g. `moloch/klaun_front.png`, `moloch/logo.svg`. */
export const AssetRef = z
	.string()
	.regex(/^[a-z0-9_]+(?:\/[a-z0-9_]+)*\.(?:png|svg)$/, 'expected a lowercase asset path ending in .png or .svg');
export type AssetRef = z.infer<typeof AssetRef>;

/* * Anchors */

/** Edge or corner index, clockwise from the top (0 = north edge / upper-right corner). */
export const HexIndex = z.int().min(0).max(5);

/** The 12 badge positions at 30° steps: `c` = corner directions, `e` = edge directions. */
export const Slot = z.enum(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'e0', 'e1', 'e2', 'e3', 'e4', 'e5']);
export type Slot = z.infer<typeof Slot>;

/** Where a feature sits on a tile face: edge (+ order along it), corner, badge position or centre. */
export const Anchor = z.union([
	z.strictObject({ edge: HexIndex, i: z.int().min(0).optional() }),
	z.strictObject({ corner: HexIndex }),
	// ? null = badge not read yet, allowed on draft tiles only (rejected by the release build)
	z.strictObject({ slot: Slot.nullable() }),
	z.strictObject({ center: z.literal(true) }),
]);
export type Anchor = z.infer<typeof Anchor>;

/* * Sides */

/** Who an effect applies to: only own tiles, own + teammates, enemies, everyone. */
export const Side = z.enum(['own', 'allied', 'enemy', 'all']);
export type Side = z.infer<typeof Side>;
