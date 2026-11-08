/*
 * Reads the source data folder and parses every file with its Zod schema; parse failures become E_SCHEMA issues.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Army, BoardSkin, MarkersFile, MechanicsFile, Skin } from '@hexbattle/schema';
import type { z } from 'zod';
import { formatPath, type Issue } from './issues.ts';

/* * Types */

/** A parsed data file together with its path relative to the data folder. */
export interface DataFile<T> {
	file: string;
	data: T;
}

export interface SourceData {
	mechanics?: DataFile<MechanicsFile>;
	markers?: DataFile<MarkersFile>;
	armies: DataFile<Army>[];
	skins: DataFile<Skin>[];
	boardSkins: DataFile<BoardSkin>[];
	issues: Issue[];
}

/* * Loading */

/**
 * Loads and parses the whole data folder: `mechanics.json`, `markers.json` and one file per record in
 * `armies/`, `skins/` and `board_skins/`. Missing record folders count as empty.
 */
export async function loadSourceData(dataDir: string): Promise<SourceData> {
	const issues: Issue[] = [];
	const read = async <S extends z.ZodType>(file: string, schema: S): Promise<DataFile<z.infer<S>> | undefined> => {
		const parsed = parseFile(file, await readFile(path.join(dataDir, file), 'utf8'), schema);
		issues.push(...parsed.issues);
		return parsed.data === undefined ? undefined : { file, data: parsed.data };
	};
	const readFolder = async <S extends z.ZodType>(folder: string, schema: S): Promise<DataFile<z.infer<S>>[]> => {
		const names = await listJson(path.join(dataDir, folder));
		const files = await Promise.all(names.map((name) => read(`${folder}/${name}`, schema)));
		return files.filter((file) => file !== undefined);
	};

	const [mechanics, markers, armies, skins, boardSkins] = await Promise.all([
		read('mechanics.json', MechanicsFile),
		read('markers.json', MarkersFile),
		readFolder('armies', Army),
		readFolder('skins', Skin),
		readFolder('board_skins', BoardSkin),
	]);
	return {
		...(mechanics && { mechanics }),
		...(markers && { markers }),
		armies,
		skins,
		boardSkins,
		issues,
	};
}

/** Parses one file's text; invalid JSON or schema mismatches become E_SCHEMA issues. */
export function parseFile<S extends z.ZodType>(
	file: string,
	text: string,
	schema: S,
): { data?: z.infer<S>; issues: Issue[] } {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch (error) {
		return { issues: [{ code: 'E_SCHEMA', file, message: `invalid JSON: ${(error as Error).message}` }] };
	}
	const result = schema.safeParse(json);
	if (result.success) {
		return { data: result.data, issues: [] };
	}
	return {
		issues: result.error.issues.map((issue) => ({
			code: 'E_SCHEMA',
			file,
			path: formatPath(issue.path),
			message: issue.message,
		})),
	};
}

/* * Helpers */

async function listJson(folder: string): Promise<string[]> {
	try {
		const names = await readdir(folder);
		return names.filter((name) => name.endsWith('.json')).sort();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}
