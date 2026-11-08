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
