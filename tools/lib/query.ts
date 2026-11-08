/*
 * Query service logic: the built catalogue in memory and pure filter functions over it.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
	BoardSkin,
	BoardSkinsIndex,
	Index,
	MarkersFile,
	MechanicsFile,
	ReleaseArmy,
	Skin,
	SkinsIndex,
	type ArmyQuery,
	type ArmyQueryResult,
	type ArmyResult,
	type BoardSkinQuery,
	type BoardSkinQueryResult,
	type Feature,
	type MarkerQuery,
	type MarkerQueryResult,
	type MarkerType,
	type Mechanic,
	type MechanicQuery,
	type MechanicQueryResult,
	type QueryError,
	type ReleaseTile,
	type SkinQuery,
	type SkinQueryResult,
	type Text,
	type TileQuery,
	type TileQueryResult,
	type TileResult,
} from '@hexbattle/schema';
import type { z } from 'zod';

/* * Catalogue */

export interface Catalogue {
	armies: ReleaseArmy[];
	mechanics: Mechanic[];
	markers: MarkerType[];
	skins: Skin[];
	boardSkins: BoardSkin[];
}

/** Reads and validates a built release (`<dist>/v1/`): the index and every file it links to. */
export async function loadCatalogue(v1Dir: string): Promise<Catalogue> {
	const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(path.join(v1Dir, file), 'utf8'));
	const index = Index.parse(await read('index.json'));
	const skinsIndex = SkinsIndex.parse(await read(index.files.skins));
	const boardSkinsIndex = BoardSkinsIndex.parse(await read(index.files.board_skins));
	const [armies, skins, boardSkins] = await Promise.all([
		Promise.all(index.armies.map(async (entry) => ReleaseArmy.parse(await read(entry.href)))),
		Promise.all(skinsIndex.skins.map(async (entry) => Skin.parse(await read(entry.href)))),
		Promise.all(boardSkinsIndex.board_skins.map(async (entry) => BoardSkin.parse(await read(entry.href)))),
	]);
	const { mechanics } = MechanicsFile.parse(await read(index.files.mechanics));
	const { markers } = MarkersFile.parse(await read(index.files.markers));
	return { armies, mechanics, markers, skins, boardSkins };
}

/* * Parameters */

/** URL parameters → a validated query, or the reasons it was rejected. A parameter may appear only once. */
export function parseQuery<S extends z.ZodType>(
	schema: S,
	params: URLSearchParams,
): { query: z.infer<S> } | { error: QueryError } {
	const raw: Record<string, string> = {};
	const details: NonNullable<QueryError['details']> = [];
	for (const [key, value] of params) {
		if (key in raw) {
			details.push({ param: key, message: 'given more than once (use a comma-separated list)' });
		}
		raw[key] = value;
	}
	const parsed = schema.safeParse(raw);
	if (parsed.success && details.length === 0) {
		return { query: parsed.data };
	}
	for (const issue of parsed.error?.issues ?? []) {
		const keys = issue.code === 'unrecognized_keys' ? issue.keys : [issue.path[0]];
		for (const key of keys) {
			const message = issue.code === 'unrecognized_keys' ? 'unknown parameter' : issue.message;
			details.push({ param: String(key ?? ''), message });
		}
	}
	return { error: { error: 'bad_query', details } };
}

/* * Lookup */

interface Lookup {
	id?: string[] | undefined;
	name?: string | undefined;
	exact?: boolean | undefined;
}

/** Id in the list, and name matching in any language (part of it, or the whole name with `exact`). */
function matchesLookup(item: { id: string; name: Text }, { id, name, exact }: Lookup): boolean {
	if (id !== undefined && !id.includes(item.id)) {
		return false;
	}
	if (name === undefined) {
		return true;
	}
	const wanted = fold(name);
	return Object.values(item.name).some(
		(text) => text !== undefined && (exact ? fold(text) === wanted : fold(text).includes(wanted)),
	);
}

/* * Tiles */

export function queryTiles(catalogue: Catalogue, query: TileQuery): TileQueryResult {
	const matches = catalogue.armies
		.filter((army) => query.army === undefined || query.army.includes(army.id))
		.flatMap((army) => (army.tiles ?? []).map((tile) => ({ army: army.id, tile })))
		.filter(({ tile }) => {
			const hp = tile.derived.hp;
			const initiative = tile.derived.initiative;
			return (
				matchesLookup(tile, query) &&
				(query.category === undefined || query.category.includes(tile.category)) &&
				(query.mechanic === undefined || hasMechanic(tile, query)) &&
				(query.hp === undefined || hp === query.hp) &&
				(query.min_hp === undefined || (hp !== undefined && hp >= query.min_hp)) &&
				(query.max_hp === undefined || (hp !== undefined && hp <= query.max_hp)) &&
				(query.initiative === undefined || initiative.includes(query.initiative)) &&
				(query.min_initiative === undefined ||
					initiative.some((value) => value >= (query.min_initiative ?? 0))) &&
				(query.copies === undefined || tile.copies === query.copies) &&
				(query.min_copies === undefined || tile.copies >= query.min_copies)
			);
		});
	return {
		query,
		total: matches.length,
		results: page(matches, query).map(({ army, tile }) => pick<TileResult>({ army, ...tile }, query.fields)),
	};
}

/** The tile has the mechanic anywhere (also inside Moduł features and choices), matching strength and side. */
function hasMechanic(tile: ReleaseTile, query: TileQuery): boolean {
	const matches = (feature: Feature): boolean =>
		(feature.mechanic === query.mechanic &&
			(query.min_strength === undefined || Number(feature.params?.strength ?? 0) >= query.min_strength) &&
			(query.side === undefined || feature.side === query.side)) ||
		(feature.effects ?? []).some(matches) ||
		(feature.options ?? []).flat().some(matches);
	return tile.faces.some((face) => face.features.some(matches));
}

/* * Armies */

export function queryArmies(catalogue: Catalogue, query: ArmyQuery): ArmyQueryResult {
	const matches = catalogue.armies.filter(
		(army) =>
			matchesLookup(army, query) &&
			(query.origin === undefined || query.origin.includes(army.origin)) &&
			(query.official === undefined || army.official === query.official),
	);
	return {
		query,
		total: matches.length,
		results: page(matches, query).map((army) => pick<ArmyResult>(army, query.fields)),
	};
}

/* * Mechanics */

export function queryMechanics(catalogue: Catalogue, query: MechanicQuery): MechanicQueryResult {
	const usedBy =
		query.used_by === undefined
			? undefined
			: new Set(catalogue.armies.find((army) => army.id === query.used_by)?.derived.mechanics_used ?? []);
	const matches = catalogue.mechanics.filter(
		(mechanic) =>
			matchesLookup(mechanic, query) &&
			(query.kind === undefined || query.kind.includes(mechanic.kind)) &&
			(query.placement === undefined || mechanic.placement.some((place) => query.placement?.includes(place))) &&
			(usedBy === undefined || usedBy.has(mechanic.id)),
	);
	return { query, total: matches.length, results: page(matches, query) };
}

/* * Markers and skins */

export function queryMarkers(catalogue: Catalogue, query: MarkerQuery): MarkerQueryResult {
	const matches = catalogue.markers.filter(
		(marker) =>
			matchesLookup(marker, query) &&
			(query.placement === undefined || query.placement.includes(marker.placement)),
	);
	return { query, total: matches.length, results: page(matches, query) };
}

export function querySkins(catalogue: Catalogue, query: SkinQuery): SkinQueryResult {
	const matches = catalogue.skins.filter(
		(skin) => matchesLookup(skin, query) && (query.army === undefined || query.army.includes(skin.army)),
	);
	return { query, total: matches.length, results: page(matches, query) };
}

export function queryBoardSkins(catalogue: Catalogue, query: BoardSkinQuery): BoardSkinQueryResult {
	const matches = catalogue.boardSkins.filter(
		(boardSkin) =>
			matchesLookup(boardSkin, query) &&
			(query.default === undefined || (boardSkin.default === true) === query.default),
	);
	return { query, total: matches.length, results: page(matches, query) };
}

/* * Helpers */

/** Lowercase without Polish diacritics, so "lowca" finds "Łowca". */
export function fold(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/gi, 'l').toLowerCase();
}

function page<T>(items: readonly T[], { limit, offset }: { limit: number; offset: number }): T[] {
	return items.slice(offset, offset + limit);
}

/** Only the picked top-level fields, or the whole object without `fields`. */
function pick<T extends object>(item: T, fields: readonly string[] | undefined): T {
	if (!fields) {
		return item;
	}
	return Object.fromEntries(Object.entries(item).filter(([key]) => fields.includes(key))) as T;
}
