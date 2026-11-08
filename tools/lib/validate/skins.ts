/*
 * Checks of army skins and board skins.
 */
import type { BoardSkin, Skin } from '@hexbattle/schema';
import type { DataFile } from '../data-files.ts';
import type { Context } from './context.ts';

/* * Army skins */

export function checkSkins(ctx: Context, skins: readonly DataFile<Skin>[]): void {
	const seen = new Set<string>();
	for (const { file, data: skin } of skins) {
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
				if (!tile.faces.some((face) => face.side === side)) {
					ctx.report('E_SKIN_FACE', file, `${path}.${side}`, `${tileId} has no ${side} face`);
				}
				const expected = `${folder}/${tileSlug}_${side}.png`;
				if (image !== expected) {
					ctx.report('E_SKIN_IMAGE_PATH', file, `${path}.${side}`, `expected "${expected}", got "${image}"`);
				}
			}
		}
	}
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
