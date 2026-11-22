/*
 * Checks of army skins and board skins.
 */
import type { Army, BoardSkin, Skin, SkinTile, Slot, Tile } from '@hexbattle/schema';
import type { DataFile } from '../data-files.ts';
import { insideHex, SLOT_RING } from './army.ts';
import type { Context } from './context.ts';

/* * Army skins */

export function checkSkins(ctx: Context, skins: readonly DataFile<Skin>[]): void {
	const seen = new Set<string>();
	const orders = new Map<string, string>();
	for (const { file, data: skin } of skins) {
		if (skin.order !== undefined) {
			const key = `${skin.army}:${String(skin.order)}`;
			const other = orders.get(key);
			if (other !== undefined) {
				ctx.report(
					'E_SKIN_ORDER',
					file,
					'order',
					`${skin.army}: order ${String(skin.order)} is also ${other}'s`,
				);
			}
			orders.set(key, skin.id);
		}
		if (seen.has(skin.id)) {
			ctx.report('E_SKIN_DUP', file, 'id', `skin "${skin.id}" is defined twice`);
		}
		seen.add(skin.id);
		if (file !== `skins/${skin.id}.json`) {
			ctx.report('E_FILE_NAME', file, 'id', `skin id "${skin.id}" must match its file name`);
		}
		const [prefix, slug = ''] = skin.id.split('.');
		if (prefix !== skin.army) {
			ctx.report('E_SKIN_PREFIX', file, 'id', `skin "${skin.id}" must start with "${skin.army}."`);
		}
		const army = ctx.armies.get(skin.army);
		if (!army) {
			ctx.report('E_SKIN_ARMY', file, 'army', `unknown army "${skin.army}"`);
			continue;
		}
		const folder = `skins/${skin.army}/${slug}`;
		if (skin.back !== undefined && skin.back !== `${folder}/back.png`) {
			ctx.report('E_SKIN_IMAGE_PATH', file, 'back', `expected "${folder}/back.png", got "${skin.back}"`);
		}
		checkSkinExtras(ctx, file, skin, army, folder);
		for (const [tileId, images] of Object.entries(skin.tiles)) {
			const path = `tiles.${tileId}`;
			const tile = army.tiles?.find((t) => t.id === tileId);
			if (!tile) {
				ctx.report('E_SKIN_TILE', file, path, `${skin.army} has no tile "${tileId}"`);
				continue;
			}
			const tileSlug = tileId.split('.')[1] ?? '';
			for (const side of ['front', 'back'] as const) {
				const image = images[side];
				if (images[`${side}_art_only`] && image === undefined) {
					ctx.report('E_SKIN_ART_ONLY', file, path, `${side}_art_only needs a ${side} image`);
				}
				if (image === undefined) {
					continue;
				}
				// ? a one-sided tile shown in a skin may carry its own default front on the reverse (e.g. a Sztab skin
				// with the art on one side and the standard Sztab on the other) – the data's image, no copy of it
				const ownFront = tile.faces.find((face) => face.side === 'front')?.image;
				if (side === 'back' && image === ownFront && !tile.faces.some((face) => face.side === 'back')) {
					continue;
				}
				if (!tile.faces.some((face) => face.side === side)) {
					ctx.report('E_SKIN_FACE', file, `${path}.${side}`, `${tileId} has no ${side} face`);
				}
				const expected = `${folder}/${tileSlug}_${side}.png`;
				if (image !== expected) {
					ctx.report('E_SKIN_IMAGE_PATH', file, `${path}.${side}`, `expected "${expected}", got "${image}"`);
				}
			}
			checkSkinLayout(ctx, file, path, tile, images);
		}
	}
}

/**
 * What an army skin may bring besides tile images: its own Sztab (only on a skin of every tile), HP markers (one per
 * Sztab or Obiekt, in the skin's folder) and mechanic pictures (each replacing a default picture, same file name).
 */
function checkSkinExtras(ctx: Context, file: string, skin: Skin, army: Army, folder: string): void {
	const tiles = army.tiles ?? [];
	if (skin.own_hq === true && !tiles.every((tile) => tile.id in skin.tiles)) {
		ctx.report('E_SKIN_OWN_HQ', file, 'own_hq', `own_hq needs a skin of every tile of ${army.id}`);
	}
	const holders = new Set(
		tiles.filter((tile) => tile.category === 'hq' || tile.category === 'object').map((t) => t.id),
	);
	(skin.hp_markers ?? []).forEach((marker, index) => {
		const path = `hp_markers[${String(index)}]`;
		if (marker.tile_id !== undefined && !holders.has(marker.tile_id)) {
			ctx.report(
				'E_HP_MARKER_TILE',
				file,
				`${path}.tile_id`,
				`"${marker.tile_id}" is not a Sztab or Obiekt of ${army.id}`,
			);
		}
		if (
			!/^hp_marker(?:_[a-z0-9_]+)?\.png$/.test(marker.image.slice(folder.length + 1)) ||
			!marker.image.startsWith(`${folder}/`)
		) {
			ctx.report(
				'E_SKIN_IMAGE_PATH',
				file,
				`${path}.image`,
				`expected "${folder}/hp_marker.png", got "${marker.image}"`,
			);
		}
	});
	const pictures = new Set(
		[...ctx.mechanics.values()].flatMap((mechanic) => (mechanic.images ?? []).map((p) => p.image)),
	);
	for (const [original, image] of Object.entries(skin.mechanic_images ?? {})) {
		const path = `mechanic_images.${original}`;
		if (!pictures.has(original)) {
			ctx.report('E_SKIN_MECHANIC_IMAGE', file, path, `"${original}" is no mechanic picture`);
		}
		const expected = `${folder}/mechanics/${original.split('/').at(-1) ?? ''}`;
		if (image !== expected) {
			ctx.report('E_SKIN_IMAGE_PATH', file, path, `expected "${expected}", got "${image}"`);
		}
	}
}

/** a slot turned k x 60 degrees clockwise (two positions per step on the ring of twelve) */
function turnSlot(slot: Slot, turn: number): Slot {
	const index = SLOT_RING.indexOf(slot);
	return SLOT_RING[(index + 2 * turn) % SLOT_RING.length] ?? slot;
}

/**
 * The skin's own drawing of the front face: listed badges at their spots, the others where the data has them, turned
 * with the image. Badges must not share or neighbour a spot, like on the data's face.
 */
function checkSkinLayout(ctx: Context, file: string, path: string, tile: Tile, images: SkinTile): void {
	if (images.turn === undefined && images.badges === undefined) {
		return;
	}
	if (images.front === undefined) {
		ctx.report('E_SKIN_NO_FRONT', file, path, `${tile.id}: turn or badges need the skin's own front image`);
		return;
	}
	const features = tile.faces.find((face) => face.side === 'front')?.features ?? [];
	const spots = new Map<number, Slot>();
	features.forEach((feature, index) => {
		const at = feature.at;
		if (at && 'slot' in at && at.slot !== null) {
			spots.set(index, turnSlot(at.slot, images.turn ?? 0));
		}
	});
	const listed = new Set<number>();
	(images.badges ?? []).forEach((badge, i) => {
		const where = `${path}.badges[${String(i)}]`;
		if (!spots.has(badge.feature) || listed.has(badge.feature)) {
			ctx.report(
				'E_SKIN_BADGE',
				file,
				where,
				`${tile.id}: feature ${String(badge.feature)} is no badge, or listed twice`,
			);
			return;
		}
		listed.add(badge.feature);
		spots.set(badge.feature, badge.slot);
		if (badge.pos !== undefined && !insideHex(badge.pos.x, badge.pos.y)) {
			ctx.report('E_POS_OUTSIDE', file, `${where}.pos`, `${tile.id}: position outside the hex`);
		}
	});
	const taken = [...spots.values()];
	if (new Set(taken).size !== taken.length) {
		ctx.report('E_SLOT_DUP', file, path, `${tile.id}: two badges on one spot in this skin`);
	}
	SLOT_RING.forEach((slot, index) => {
		const next = SLOT_RING[(index + 1) % SLOT_RING.length] ?? slot;
		if (taken.includes(slot) && taken.includes(next)) {
			ctx.report('E_SLOT_OVERLAP', file, path, `${tile.id}: badges on ${slot} and ${next} overlap in this skin`);
		}
	});
}

/* * Board skins */

export function checkBoardSkins(ctx: Context, boardSkins: readonly DataFile<BoardSkin>[]): void {
	const seen = new Set<string>();
	for (const { file, data: boardSkin } of boardSkins) {
		if (seen.has(boardSkin.id)) {
			ctx.report('E_BOARD_SKIN_DUP', file, 'id', `board skin "${boardSkin.id}" is defined twice`);
		}
		seen.add(boardSkin.id);
		if (file !== `board_skins/${boardSkin.id}.json`) {
			ctx.report('E_FILE_NAME', file, 'id', `board skin id "${boardSkin.id}" must match its file name`);
		}
		const image = `board_skins/${boardSkin.id}.png`;
		if (boardSkin.image !== image) {
			ctx.report('E_IMAGE_PATH', file, 'image', `expected "${image}", got "${boardSkin.image}"`);
		}
	}
	const defaults = boardSkins.filter(({ data }) => data.default === true);
	if (defaults.length > 1 || (defaults.length === 0 && (boardSkins.length > 0 || ctx.options.release))) {
		const message =
			boardSkins.length === 0
				? 'a release needs at least one board skin'
				: `${String(defaults.length)} default board skins (need exactly 1)`;
		ctx.report('E_BOARD_SKIN_DEFAULT', 'board_skins/', '', message);
	}
}
