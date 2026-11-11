/*
 * Army file (`armies/<army_id>.json`): display data, army rules, marker pools, deck and tiles with their features.
 */
import { z } from 'zod';
import { Anchor, ArmyScopedId, AssetRef, Id, Lang, Point, Side, Text } from './common.ts';
import { BadgeCategory, ParamValue } from './mechanics.ts';

/* * Feature */

/** Printed riders on an attack. */
export const Rider = z.enum(['jad', 'paraliz']);
export type Rider = z.infer<typeof Rider>;

/**
 * A placed game element: a mechanic id at an anchor with its values. Containers nest further features.
 * The type is written out because it is recursive: inferred, it would be lost in the published declarations.
 */
export interface Feature {
	mechanic: Id;
	// ? required on a face; nested effects and choice options take their place from the container
	at?: Anchor | undefined;
	// ? badges only: the exact drawn position when it matters (set in the dashboard by dragging)
	pos?: Point | undefined;
	params?: Record<Id, ParamValue> | undefined;
	category?: BadgeCategory | undefined;
	// ? absent = false
	flags?: { friendly_fire?: true | undefined; zombie_only?: true | undefined } | undefined;
	riders?: Rider[] | undefined;
	cost?: { hq_hp?: number | undefined; gamble?: number | undefined } | undefined;
	side?: Side | undefined;
	// ? container features: Moduł feature and technology bonus
	effects?: Feature[] | undefined;
	// ? container feature `choice`: exactly one option is played
	options?: Feature[][] | undefined;
}

export const Feature: z.ZodType<Feature> = z
	.strictObject({
		mechanic: Id,
		at: Anchor.optional(),
		pos: Point.optional(),
		params: z.record(Id, ParamValue).optional(),
		category: BadgeCategory.optional(),
		flags: z
			.strictObject({
				friendly_fire: z.literal(true).optional(),
				zombie_only: z.literal(true).optional(),
			})
			.optional(),
		riders: z.array(Rider).min(1).optional(),
		cost: z
			.strictObject({
				hq_hp: z.int().min(1).optional(),
				gamble: z.int().min(1).optional(),
			})
			.optional(),
		side: Side.optional(),
		get effects() {
			return z.array(Feature).min(1).optional();
		},
		get options() {
			return z.array(z.array(Feature).min(1)).min(2).optional();
		},
	})
	.meta({ id: 'Feature' });

/* * Tile */

/** One printed side of a tile. */
export const Face = z.strictObject({
	side: z.enum(['front', 'back']),
	playable: z.boolean(),
	image: AssetRef,
	features: z.array(Feature),
});
export type Face = z.infer<typeof Face>;

export const TileCategory = z.enum([
	'hq',
	'object',
	'warrior',
	'module',
	'implant',
	'instant',
	'ground',
	'technology',
	'swap',
]);
export type TileCategory = z.infer<typeof TileCategory>;

export const SetupRole = z.enum(['draw_pile', 'starting_hq', 'starting_object', 'companion', 'swap_in']);
export type SetupRole = z.infer<typeof SetupRole>;

/** One tile type with its number of copies. Unit HP and similar values are derived by the build, never stored. */
export const Tile = z
	.strictObject({
		id: ArmyScopedId,
		name: Text,
		category: TileCategory,
		copies: z.int().min(1),
		setup_role: SetupRole,
		// ? explicit override, e.g. a tile that is always a Wojownik despite a Moduł feature
		rule_role: z.literal('warrior').optional(),
		// ? base HP of a Sztab (20) or Obiekt (10) only
		hp: z.union([z.literal(20), z.literal(10)]).optional(),
		// ? verified = checked against the official image; release builds refuse drafts
		status: z.enum(['draft', 'verified']),
		faces: z.array(Face).min(1).max(2),
	})
	.meta({ id: 'Tile' });
export type Tile = z.infer<typeof Tile>;

/* * Display */

/** `#RRGGBB`, uppercase. */
export const HexColor = z.string().regex(/^#[0-9A-F]{6}$/, 'expected an uppercase #RRGGBB colour');

export const Display = z.strictObject({
	colors: z.strictObject({
		primary: HexColor,
		secondary: HexColor.optional(),
		layout: z.enum(['solid', 'diagonal_split']),
	}),
	// ? upright SVG logo; never changed by skins
	logo: z.strictObject({ image: AssetRef }),
	back: AssetRef,
	// ? one per Sztab (or Obiekt)
	hp_markers: z
		.array(
			z.strictObject({
				tile_id: ArmyScopedId.optional(),
				image: AssetRef,
			}),
		)
		.min(1),
	// ? official army manual per language – the one non-game element in the API
	manual: z
		.array(
			z.strictObject({
				language: Lang,
				pdf_url: z.url({ protocol: /^https$/ }),
			}),
		)
		.min(1)
		.optional(),
});
export type Display = z.infer<typeof Display>;

/* * Rules, pools, deck */

/** Pointer to an `army_rule` mechanic: a rule printed on no tile. */
export const ArmyRule = z.strictObject({
	rule: Id,
	params: z.record(Id, ParamValue).optional(),
});
export type ArmyRule = z.infer<typeof ArmyRule>;

/** Army markers: `limiting` = the count limits play, `sized_to_sources` = enough for every source. */
export const Pool = z.strictObject({
	marker: Id,
	count: z.int().min(1),
	pool_type: z.enum(['limiting', 'sized_to_sources']),
	variants: z.record(Id, z.int().min(1)).optional(),
});
export type Pool = z.infer<typeof Pool>;

export const Deck = z.strictObject({
	size: z.union([z.literal(35), z.literal(36)]),
	swap: z
		.array(
			z.strictObject({
				tile: ArmyScopedId,
				mode: z.literal('optional_replace_any_one'),
				reveal: z.literal(true),
			}),
		)
		.min(1)
		.optional(),
});
export type Deck = z.infer<typeof Deck>;

/* * Army */

/** Where an army comes from: the base game, an expansion, or a mini-expansion (minidodatek). */
export const ArmyOrigin = z.enum(['base_game', 'expansion', 'mini_expansion']);
export type ArmyOrigin = z.infer<typeof ArmyOrigin>;

/**
 * Source and published army file. `display`, `deck` and `tiles` may be missing while an army is being
 * recorded; a release build requires them. Absent `rules` / `pools` = standard game / no army markers.
 */
export const Army = z
	.strictObject({
		id: Id,
		name: Text,
		official: z.boolean(),
		// ? base game, expansion (a full army) or mini-expansion (minidodatek)
		origin: ArmyOrigin,
		display: Display.optional(),
		rules: z.array(ArmyRule).min(1).optional(),
		pools: z.array(Pool).min(1).optional(),
		deck: Deck.optional(),
		tiles: z.array(Tile).min(1).optional(),
	})
	.meta({ id: 'Army' });
export type Army = z.infer<typeof Army>;
