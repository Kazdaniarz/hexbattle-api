/*
 * Semantic validation of parsed source data: everything the schema alone cannot check, as stable E_* / W_* codes.
 */
import type { Lang } from '@hexbattle/schema';
import type { SourceData } from '../data-files.ts';
import type { Issue } from '../issues.ts';
import { checkArmy } from './army.ts';
import { createContext, indexById, type ValidateOptions } from './context.ts';
import { checkLanguages } from './languages.ts';
import { checkMechanics } from './registry.ts';
import { checkBoardSkins, checkSkins } from './skins.ts';

export type { ValidateOptions } from './context.ts';

/** Languages besides Polish that are counted for completeness. */
const OPTIONAL_LANGS: readonly Lang[] = ['en'];

/* * Validate */

/** Runs every check; parse errors are already in `source.issues` and are not repeated. */
export function validate(source: SourceData, options: ValidateOptions): Issue[] {
	const issues: Issue[] = [];
	const mechanicList = source.mechanics?.data.mechanics ?? [];
	const markerList = source.markers?.data.markers ?? [];
	const lookups = {
		mechanics: indexById(mechanicList, (mechanic, index) => {
			issues.push(duplicate('E_MECH_DUP', 'mechanics.json', `mechanics[${String(index)}]`, mechanic.id));
		}),
		markers: indexById(markerList, (marker, index) => {
			issues.push(duplicate('E_MARKER_DUP', 'markers.json', `markers[${String(index)}]`, marker.id));
		}),
		armies: new Map(source.armies.map(({ data }) => [data.id, data])),
		terms: source.mechanics?.data.terms,
	};
	const ctx = createContext(options, lookups, issues);

	checkMechanics(ctx, mechanicList);
	const seenTileIds = new Set<string>();
	for (const army of source.armies) {
		checkArmy(ctx, army, seenTileIds);
	}
	checkSkins(ctx, source.skins);
	checkBoardSkins(ctx, source.boardSkins);

	const files = [source.mechanics, source.markers, ...source.armies, ...source.skins, ...source.boardSkins];
	for (const dataFile of files) {
		if (dataFile) {
			checkLanguages(ctx, dataFile.file, dataFile.data, OPTIONAL_LANGS);
		}
	}
	return issues;
}

/* * Helpers */

function duplicate(code: Issue['code'], file: string, path: string, id: string): Issue {
	return { code, file, path, message: `"${id}" is defined twice` };
}
