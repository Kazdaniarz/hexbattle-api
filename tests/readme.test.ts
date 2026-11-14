/*
 * The README stays true: every JSON example marked with a schema parses with it, and every query URL in it is accepted.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schemas from '@hexbattle/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseQuery } from '../tools/lib/query.ts';

const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');

/* * JSON examples */

const EXAMPLES = [...README.matchAll(/```json\n([\s\S]*?)```\s*<!-- schema: (\w+) -->/g)].map((match) => ({
	json: match[1] ?? '',
	schema: match[2] ?? '',
}));

describe('README JSON examples', () => {
	it('has examples to check', () => {
		expect(EXAMPLES.length).toBeGreaterThanOrEqual(10);
	});
	it('marks every plain json block with its schema', () => {
		expect(README.match(/```json\n/g)?.length).toBe(EXAMPLES.length);
	});
	it.each(EXAMPLES)('$schema example parses', ({ json, schema }) => {
		const zodSchema = (schemas as Record<string, unknown>)[schema];
		expect(zodSchema, `no schema ${schema}`).toBeInstanceOf(z.ZodType);
		const result = (zodSchema as z.ZodType).safeParse(JSON.parse(json));
		expect(result.error?.issues ?? []).toEqual([]);
	});
});

/* * Examples that show real records must match the data (shortened only by leaving whole fields out) */

const DATA = new URL('../data/', import.meta.url);
const readData = (path: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(path, DATA)), 'utf8'));
const listOf = (path: string, key: string): { id: string }[] =>
	(readData(path) as Record<string, { id: string }[]>)[key] ?? [];
const SCHEMA_VERSION = (
	JSON.parse(readFileSync(fileURLToPath(new URL('../packages/schema/package.json', import.meta.url)), 'utf8')) as {
		version: string;
	}
).version;

/** Fields an example may leave out to stay short; any other field of the record must be shown, so new fields reach the README. */
const SHORTENED: Record<string, string[]> = { ReleaseArmy: ['tiles'] };

/** The data record an example shows, without its shortened fields; undefined = not a real record. */
function realRecord(schema: string, example: Record<string, unknown>): unknown {
	const id = String(example.id);
	const army = id.split('.')[0] ?? '';
	const records: Record<string, () => unknown> = {
		ReleaseArmy: () => readData(`armies/${id}.json`),
		ReleaseTile: () =>
			(readData(`armies/${army}.json`) as { tiles: { id: string }[] }).tiles.find((t) => t.id === id),
		Mechanic: () => listOf('mechanics.json', 'mechanics').find((m) => m.id === id),
		MarkerType: () => listOf('markers.json', 'markers').find((m) => m.id === id),
		BoardSkin: () => readData(`board_skins/${id}.json`),
	};
	const record = records[schema]?.() as Record<string, unknown> | undefined;
	if (record === undefined) return undefined;
	const left = SHORTENED[schema] ?? [];
	return Object.fromEntries(Object.entries(record).filter(([key]) => !left.includes(key)));
}

const RECORD_EXAMPLES = EXAMPLES.filter(({ schema }) =>
	['ReleaseArmy', 'ReleaseTile', 'Mechanic', 'MarkerType', 'BoardSkin'].includes(schema),
);

describe('README examples match the data', () => {
	it('index example names the current schema version', () => {
		const index = EXAMPLES.find(({ schema }) => schema === 'Index');
		const meta = (JSON.parse(index?.json ?? '{}') as { meta?: { schema_version?: string } }).meta;
		expect(meta?.schema_version).toBe(SCHEMA_VERSION);
	});
	it.each(RECORD_EXAMPLES)('$schema example equals its record in data/', ({ json, schema }) => {
		const example = JSON.parse(json) as Record<string, unknown>;
		// ? `derived` is computed by the build, so it is not in the source data
		const shown = Object.fromEntries(Object.entries(example).filter(([key]) => key !== 'derived'));
		const record = realRecord(schema, example);
		expect(record, `${String(example.id)} is not in data/`).toBeDefined();
		expect(shown).toEqual(record);
	});
});

/* * Query URLs */

const ROUTES: Record<string, z.ZodType> = {
	tiles: schemas.TileQuery,
	armies: schemas.ArmyQuery,
	mechanics: schemas.MechanicQuery,
	markers: schemas.MarkerQuery,
	skins: schemas.SkinQuery,
	board_skins: schemas.BoardSkinQuery,
};

/** The deliberate error example. */
const BAD_EXAMPLE = 'tiles?colour=red';

const URLS = [
	...new Set(
		[...README.matchAll(/\/v1\/query\/(\w+)\?([^"\s`]+)/g)].map((match) => `${match[1] ?? ''}?${match[2] ?? ''}`),
	),
];

describe('README query URLs', () => {
	it('has URLs to check', () => {
		expect(URLS.length).toBeGreaterThanOrEqual(15);
	});
	it.each(URLS.filter((url) => url !== BAD_EXAMPLE))('%s is accepted', (url) => {
		const [route = '', params = ''] = url.split('?');
		const schema = ROUTES[route];
		expect(schema, `no route ${route}`).toBeDefined();
		if (schema) expect(parseQuery(schema, new URLSearchParams(params))).not.toHaveProperty('error');
	});
	it('rejects the error example', () => {
		const [, params = ''] = BAD_EXAMPLE.split('?');
		expect(parseQuery(schemas.TileQuery, new URLSearchParams(params))).toHaveProperty('error');
	});
});
