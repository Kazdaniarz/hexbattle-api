/*
 * Checks of one army file: army sections, tiles, faces and every placed feature.
 */
import type { Anchor, Army, Face, Feature, Mechanic, Slot, Tile } from '@hexbattle/schema';
import type { DataFile } from '../data-files.ts';
import type { Context } from './context.ts';
import { checkParams } from './params.ts';
import { usesSide } from './registry.ts';

/* * Constants */

/** Tile setups that count towards the deck size. */
const DECK_ROLES = new Set<Tile['setup_role']>(['draw_pile', 'starting_hq', 'starting_object']);

/** Base HP by tile category; other categories never store HP. */
const BASE_HP: Partial<Record<Tile['category'], number>> = { hq: 20, object: 10 };

/** The 12 badge positions in clockwise order; neighbours in this ring overlap. */
const SLOT_RING: readonly Slot[] = ['e0', 'c0', 'e1', 'c1', 'e2', 'c2', 'e3', 'c3', 'e4', 'c4', 'e5', 'c5'];

/** Edge features that leave no room for a Moduł feature on the same edge. */
const BLOCKS_MODULE_FEATURE = new Set<Mechanic['kind']>(['attack', 'net']);
const MODULE_FEATURE = 'module_feature';
const TRAP_EDGE = 'trap_edge';

/* * Army */

export function checkArmy(ctx: Context, { file, data: army }: DataFile<Army>, seenTileIds: Set<string>): void {
	const { release } = ctx.options;
	if (file !== `armies/${army.id}.json`) {
		ctx.report('E_ARMY_ID', file, 'id', `army id "${army.id}" must match its file name`);
	}
	if (!army.official) {
		ctx.report('W_NOT_OFFICIAL', file, 'official', `${army.id} is not an official army`);
	}
	const missing = (['display', 'deck', 'tiles'] as const).filter((key) => army[key] === undefined);
	if (missing.length > 0) {
		const code = release ? 'E_ARMY_INCOMPLETE' : 'W_ARMY_INCOMPLETE';
		ctx.report(code, file, '', `${army.id} has no ${missing.join(', ')}`);
	}
	checkManuals(ctx, file, army);
	checkRules(ctx, file, army);
	(army.tiles ?? []).forEach((tile, index) => {
		checkTile(ctx, file, `tiles[${String(index)}]`, army, tile, seenTileIds);
	});
	checkHqCount(ctx, file, army);
	checkDeck(ctx, file, army);
	checkHpMarkers(ctx, file, army);
}

function checkManuals(ctx: Context, file: string, army: Army): void {
	const seen = new Set<string>();
	(army.display?.manual ?? []).forEach((manual, index) => {
		if (seen.has(manual.language)) {
			ctx.report(
				'E_MANUAL_LANG_DUP',
				file,
				`display.manual[${String(index)}]`,
				`second manual in "${manual.language}"`,
			);
		}
		seen.add(manual.language);
	});
}

function checkRules(ctx: Context, file: string, army: Army): void {
	const seen = new Set<string>();
	(army.rules ?? []).forEach((pointer, index) => {
		const path = `rules[${String(index)}]`;
		const mechanic = ctx.mechanics.get(pointer.rule);
		if (seen.has(pointer.rule)) {
			ctx.report('E_RULE_DUP', file, path, `rule "${pointer.rule}" is listed twice`);
		}
		seen.add(pointer.rule);
		if (!mechanic) {
			ctx.report('E_RULE_UNKNOWN', file, path, `unknown army rule "${pointer.rule}"`);
			return;
		}
		if (mechanic.kind !== 'army_rule') {
			ctx.report('E_RULE_KIND', file, path, `"${pointer.rule}" is a ${mechanic.kind}, not an army_rule`);
			return;
		}
		checkMechanicScope(ctx, file, path, mechanic, army);
		checkParams(ctx, file, `${path}.params`, pointer.params, mechanic.params, pointer.rule);
	});
}

/** Sum of copies against the deck size: short is incomplete (an error in a release), over is always an error. */
function checkDeck(ctx: Context, file: string, army: Army): void {
	if (!army.deck || !army.tiles) {
		return;
	}
	const copies = army.tiles
		.filter((tile) => DECK_ROLES.has(tile.setup_role))
		.reduce((sum, tile) => sum + tile.copies, 0);
	const message = `${String(copies)} tiles recorded for a deck of ${String(army.deck.size)}`;
	if (copies > army.deck.size || (copies < army.deck.size && ctx.options.release)) {
		ctx.report('E_DECK_SIZE', file, 'deck.size', message);
	} else if (copies < army.deck.size) {
		ctx.report('W_DECK_INCOMPLETE', file, 'deck.size', message);
	}
}

function checkHpMarkers(ctx: Context, file: string, army: Army): void {
	const holders = new Set(
		(army.tiles ?? []).filter((tile) => BASE_HP[tile.category] !== undefined).map((tile) => tile.id),
	);
	(army.display?.hp_markers ?? []).forEach((marker, index) => {
		if (marker.tile_id !== undefined && !holders.has(marker.tile_id)) {
			const path = `display.hp_markers[${String(index)}].tile_id`;
			ctx.report('E_HP_MARKER_TILE', file, path, `"${marker.tile_id}" is not a Sztab or Obiekt of ${army.id}`);
		}
	});
}

/* * Tile */

function checkTile(ctx: Context, file: string, path: string, army: Army, tile: Tile, seenTileIds: Set<string>): void {
	if (seenTileIds.has(tile.id)) {
		ctx.report('E_TILE_DUP', file, `${path}.id`, `tile "${tile.id}" is defined twice`);
	}
	seenTileIds.add(tile.id);
	const [prefix, slug = ''] = tile.id.split('.');
	if (prefix !== army.id) {
		ctx.report('E_TILE_PREFIX', file, `${path}.id`, `tile "${tile.id}" must start with "${army.id}."`);
	}
	if (tile.status === 'draft' && ctx.options.release) {
		ctx.report('E_DRAFT', file, `${path}.status`, `${tile.id} is still a draft`);
	}
	const baseHp = BASE_HP[tile.category];
	if (baseHp !== undefined && tile.hp !== baseHp) {
		ctx.report('E_HQ_HP', file, `${path}.hp`, `${tile.id} (${tile.category}) needs hp ${String(baseHp)}`);
	}
	if (baseHp === undefined && tile.hp !== undefined) {
		ctx.report('E_HP_ON_UNIT', file, `${path}.hp`, `${tile.id}: only a Sztab or Obiekt stores hp`);
	}
	checkFaces(ctx, file, path, army, tile, slug);
	if (tile.category === 'module' && !tile.faces.some((face) => face.features.some((f) => isCentreEffect(ctx, f)))) {
		ctx.report('E_MODULE_EMPTY', file, path, `${tile.id} is a Moduł without a centre effect`);
	}
}

/** Exactly one starting Sztab (one copy) unless the army starts with Obiekty instead. */
function checkHqCount(ctx: Context, file: string, army: Army): void {
	const tiles = army.tiles;
	if (!tiles) {
		return;
	}
	const hqCopies = tiles.filter((t) => t.setup_role === 'starting_hq').reduce((sum, t) => sum + t.copies, 0);
	const hasObjects = tiles.some((t) => t.setup_role === 'starting_object');
	const misplaced = tiles.find((t) => t.setup_role === 'starting_hq' && t.category !== 'hq');
	if ((hasObjects ? hqCopies !== 0 : hqCopies !== 1) || misplaced) {
		const message = misplaced
			? `${misplaced.id} starts as a Sztab but is a ${misplaced.category}`
			: `${army.id} needs exactly one starting Sztab (found ${String(hqCopies)})`;
		ctx.report('E_HQ_COUNT', file, 'tiles', message);
	}
}

/* * Faces */

function checkFaces(ctx: Context, file: string, path: string, army: Army, tile: Tile, slug: string): void {
	if (!tile.faces.some((face) => face.playable)) {
		ctx.report('E_FACE_PLAYABLE', file, `${path}.faces`, `${tile.id} has no playable face`);
	}
	const sides = new Set<string>();
	tile.faces.forEach((face, index) => {
		const facePath = `${path}.faces[${String(index)}]`;
		if (sides.has(face.side)) {
			ctx.report('E_FACE_DUP', file, `${facePath}.side`, `${tile.id} has two "${face.side}" faces`);
		}
		sides.add(face.side);
		const image = `${army.id}/${slug}_${face.side}.png`;
		if (face.image !== image) {
			ctx.report('E_IMAGE_PATH', file, `${facePath}.image`, `expected "${image}", got "${face.image}"`);
		}
		face.features.forEach((feature, featureIndex) => {
			checkFeature(ctx, file, `${facePath}.features[${String(featureIndex)}]`, army, tile, feature, false);
		});
		checkFaceLayout(ctx, file, facePath, tile, face);
	});
}

/** Rules across the features of one face: badge positions, edges, badge groups. */
function checkFaceLayout(ctx: Context, file: string, path: string, tile: Tile, face: Face): void {
	const slots = new Map<Slot, number>();
	const edges = new Map<number, Feature[]>();
	const groups = new Map<string, Feature[]>();
	face.features.forEach((feature, index) => {
		const at: Anchor | undefined = feature.at;
		if (at && 'slot' in at && at.slot !== null) {
			if (slots.has(at.slot)) {
				ctx.report(
					'E_SLOT_DUP',
					file,
					`${path}.features[${String(index)}].at`,
					`${tile.id}: two badges on ${at.slot}`,
				);
			}
			slots.set(at.slot, index);
		}
		if (at && 'edge' in at) {
			edges.set(at.edge, [...(edges.get(at.edge) ?? []), feature]);
		}
		const mechanic = ctx.mechanics.get(feature.mechanic);
		if (mechanic?.badge_count !== undefined && mechanic.badge_count > 1) {
			const group = String(feature.params?.group ?? '');
			groups.set(group, [...(groups.get(group) ?? []), feature]);
		}
	});
	SLOT_RING.forEach((slot, index) => {
		const next = SLOT_RING[(index + 1) % SLOT_RING.length] ?? slot;
		if (slots.has(slot) && slots.has(next)) {
			ctx.report('E_SLOT_OVERLAP', file, path, `${tile.id}: badges on ${slot} and ${next} overlap`);
		}
	});
	for (const [edge, features] of edges) {
		checkEdge(ctx, file, path, tile, edge, features);
	}
	for (const [group, features] of groups) {
		const mechanicIds = new Set(features.map((feature) => feature.mechanic));
		const [first] = features;
		const count = (first && ctx.mechanics.get(first.mechanic)?.badge_count) ?? 0;
		if (mechanicIds.size > 1) {
			ctx.report(
				'E_BADGE_GROUP',
				file,
				path,
				`${tile.id}: group "${group}" mixes ${[...mechanicIds].join(', ')}`,
			);
		} else if (features.length !== count) {
			const message = `${tile.id}: group "${group}" has ${String(features.length)} of ${String(count)} badges`;
			ctx.report('E_BADGE_COUNT', file, path, message);
		}
	}
}

function checkEdge(ctx: Context, file: string, path: string, tile: Tile, edge: number, features: Feature[]): void {
	const kinds = features.map((feature) => ctx.mechanics.get(feature.mechanic)?.kind);
	const attacks = features.filter((_, index) => kinds[index] === 'attack').map((feature) => feature.mechanic);
	const repeated = attacks.find((id, index) => attacks.indexOf(id) !== index);
	if (repeated) {
		const message = `${tile.id}: "${repeated}" twice on edge ${String(edge)} (use strength)`;
		ctx.report('E_EDGE_DUP_ATTACK', file, path, message);
	}
	const hasModuleFeature = features.some((feature) => feature.mechanic === MODULE_FEATURE);
	const isBlocked = features.some(
		(feature, index) => feature.mechanic === TRAP_EDGE || BLOCKS_MODULE_FEATURE.has(kinds[index] ?? 'status'),
	);
	if (hasModuleFeature && isBlocked) {
		const message = `${tile.id}: a Moduł feature cannot share edge ${String(edge)} with an attack, Sieć or trap`;
		ctx.report('E_MODULE_FEATURE_EDGE', file, path, message);
	}
}

/* * Feature */

function checkFeature(
	ctx: Context,
	file: string,
	path: string,
	army: Army,
	tile: Tile,
	feature: Feature,
	isNested: boolean,
): void {
	const mechanic = ctx.mechanics.get(feature.mechanic);
	if (!mechanic) {
		ctx.report('E_MECH_UNKNOWN', file, `${path}.mechanic`, `${tile.id}: unknown mechanic "${feature.mechanic}"`);
		return;
	}
	checkMechanicScope(ctx, file, path, mechanic, army);
	checkAnchor(ctx, file, path, tile, feature, mechanic, isNested);
	checkCategory(ctx, file, path, tile, feature, mechanic);
	if (feature.side !== undefined && mechanic.kind !== 'effect') {
		ctx.report('E_EFFECT_SIDE', file, `${path}.side`, `${tile.id}: only effects have a side (${mechanic.id})`);
	}
	if (feature.side === undefined && usesSide(mechanic)) {
		ctx.report('E_EFFECT_SIDE', file, path, `${tile.id}: ${mechanic.id} needs a side for its description`);
	}
	checkParams(ctx, file, `${path}.params`, feature.params, mechanic.params, mechanic.id);
	checkContainer(ctx, file, path, army, tile, feature, mechanic);
}

function checkMechanicScope(ctx: Context, file: string, path: string, mechanic: Mechanic, army: Army): void {
	if (mechanic.scope && mechanic.scope.army !== army.id) {
		ctx.report('E_MECH_SCOPE', file, path, `"${mechanic.id}" belongs to ${mechanic.scope.army}, not ${army.id}`);
	}
}

function checkAnchor(
	ctx: Context,
	file: string,
	path: string,
	tile: Tile,
	feature: Feature,
	mechanic: Mechanic,
	isNested: boolean,
): void {
	const { at } = feature;
	if (isNested) {
		if (at) {
			ctx.report(
				'E_PLACEMENT',
				file,
				`${path}.at`,
				`${tile.id}: a nested feature takes its place from the container`,
			);
		}
		return;
	}
	if (!at) {
		ctx.report('E_AT_MISSING', file, path, `${tile.id}: ${mechanic.id} has no anchor`);
		return;
	}
	const placement = 'edge' in at ? 'edge' : 'corner' in at ? 'corner' : 'slot' in at ? 'slot' : 'center';
	if (!mechanic.placement.includes(placement)) {
		const message = `${tile.id}: ${mechanic.id} cannot be placed on a ${placement} (allowed: ${mechanic.placement.join(', ')})`;
		ctx.report('E_PLACEMENT', file, `${path}.at`, message);
	}
	if ('slot' in at && at.slot === null) {
		const code = tile.status === 'verified' || ctx.options.release ? 'E_SLOT_UNREAD' : 'W_SLOT_UNREAD';
		ctx.report(code, file, `${path}.at`, `${tile.id}: badge position of ${mechanic.id} not read yet`);
	}
}

function checkCategory(
	ctx: Context,
	file: string,
	path: string,
	tile: Tile,
	feature: Feature,
	mechanic: Mechanic,
): void {
	const allowed = mechanic.allowed_categories;
	if (feature.category === undefined) {
		if (allowed) {
			ctx.report(
				'E_CATEGORY_MISSING',
				file,
				path,
				`${tile.id}: ${mechanic.id} needs a badge category (${allowed.join(', ')})`,
			);
		}
		return;
	}
	if (!allowed?.includes(feature.category)) {
		const message = `${tile.id}: ${mechanic.id} cannot have category "${feature.category}"`;
		ctx.report('E_CATEGORY', file, `${path}.category`, message);
	}
}

/** Only container mechanics hold nested features, and a container holds either effects or options. */
function checkContainer(
	ctx: Context,
	file: string,
	path: string,
	army: Army,
	tile: Tile,
	feature: Feature,
	mechanic: Mechanic,
): void {
	const hasEffects = feature.effects !== undefined;
	const hasOptions = feature.options !== undefined;
	if (mechanic.kind !== 'container' && (hasEffects || hasOptions)) {
		ctx.report('E_CONTAINER', file, path, `${tile.id}: ${mechanic.id} is not a container`);
	}
	if (mechanic.kind === 'container' && hasEffects === hasOptions) {
		ctx.report('E_CONTAINER', file, path, `${tile.id}: ${mechanic.id} needs either effects or options`);
	}
	feature.effects?.forEach((effect, index) => {
		checkFeature(ctx, file, `${path}.effects[${String(index)}]`, army, tile, effect, true);
	});
	feature.options?.forEach((option, optionIndex) => {
		option.forEach((effect, index) => {
			checkFeature(
				ctx,
				file,
				`${path}.options[${String(optionIndex)}][${String(index)}]`,
				army,
				tile,
				effect,
				true,
			);
		});
	});
}

/* * Helpers */

function isCentreEffect(ctx: Context, feature: Feature): boolean {
	return feature.at !== undefined && 'center' in feature.at && ctx.mechanics.get(feature.mechanic)?.kind === 'effect';
}
