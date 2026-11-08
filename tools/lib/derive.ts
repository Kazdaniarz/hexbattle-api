/*
 * Values computed from the source data by the build, never stored in it: tile HP, Inicjatywa, Moduł reach,
 * army completeness and mechanics used, skin coverage.
 */
import type {
	Army,
	ArmyDerived,
	Completeness,
	Feature,
	ModuleReach,
	Skin,
	SkinCoverage,
	Tile,
	TileDerived,
} from '@hexbattle/schema';

/* * Constants */

const TOUGHNESS = 'wytrzymalosc';
const INITIATIVE = 'initiative';
const MODULE_LINK = 'module_link';

/** Tile categories that stand on the board as units and therefore have HP. */
const HAS_HP = new Set<Tile['category']>(['hq', 'object', 'warrior', 'module']);

/** Tile setups that count towards the deck. */
const DECK_ROLES = new Set<Tile['setup_role']>(['draw_pile', 'starting_hq', 'starting_object']);

/* * Tile */

export function deriveTile(tile: Tile): TileDerived {
	const features = tile.faces.flatMap((face) => face.features);
	const toughness = features.filter((f) => f.mechanic === TOUGHNESS && f.category === 'unit').length;
	const derived: TileDerived = {
		...(HAS_HP.has(tile.category) && { hp: tile.hp ?? 1 + toughness }),
		initiative: features.filter((f) => f.mechanic === INITIATIVE).map((f) => Number(f.params?.value ?? 0)),
	};
	if (tile.category === 'module') {
		derived.module_reach = moduleReach(features);
	}
	return derived;
}

/** Linked edges (sorted) with the longest link range; no links = the Moduł reaches the whole board. */
function moduleReach(features: readonly Feature[]): ModuleReach {
	const links = features.filter((f) => f.mechanic === MODULE_LINK && f.at && 'edge' in f.at);
	if (links.length === 0) {
		return { type: 'global' };
	}
	const edges = [...new Set(links.map((f) => (f.at && 'edge' in f.at ? f.at.edge : 0)))].sort((a, b) => a - b);
	const range = Math.max(...links.map((f) => Number(f.params?.range ?? 1)));
	return { type: 'linked', edges, range };
}

/* * Army */

export function deriveArmy(army: Army): ArmyDerived {
	return {
		mechanics_used: [...new Set((army.tiles ?? []).flatMap(mechanicsOf))].sort(),
		// ? filled once an army needs marker pools or extra board zones; no recorded army does yet
		required_pools: [],
		board_roles: [],
		completeness: completeness(army),
	};
}

function mechanicsOf(tile: Tile): string[] {
	const walk = (feature: Feature): string[] => [
		feature.mechanic,
		...(feature.effects ?? []).flatMap(walk),
		...(feature.options ?? []).flat().flatMap(walk),
	];
	return tile.faces.flatMap((face) => face.features.flatMap(walk));
}

export function completeness(army: Army): Completeness {
	const tiles = army.tiles ?? [];
	const deckSize = army.deck?.size ?? 0;
	const copies = tiles.filter((t) => DECK_ROLES.has(t.setup_role)).reduce((sum, t) => sum + t.copies, 0);
	const drafts = tiles.filter((t) => t.status === 'draft').length;
	const isComplete = army.display !== undefined && deckSize > 0 && copies === deckSize && drafts === 0;
	return {
		tiles_recorded: tiles.length,
		copies_recorded: copies,
		deck_size: deckSize,
		draft_tiles: drafts,
		status: isComplete ? 'complete' : tiles.length === 0 ? 'skeleton' : 'in_progress',
	};
}

/* * Skin */

export function skinCoverage(skin: Skin, army: Army | undefined): SkinCoverage {
	const covered = Object.keys(skin.tiles);
	const tiles = army?.tiles ?? [];
	return {
		tiles: covered.length,
		all_tiles: tiles.length > 0 && tiles.every((t) => covered.includes(t.id)),
		includes_hq: tiles.some((t) => (t.category === 'hq' || t.category === 'object') && covered.includes(t.id)),
		back: skin.back !== undefined,
	};
}
