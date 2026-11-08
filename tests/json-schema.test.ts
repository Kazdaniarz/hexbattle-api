/*
 * The generated JSON Schemas: one per source and published file kind, draft 2020-12, strict objects.
 */
import { describe, expect, it } from 'vitest';
import { FILE_SCHEMAS, RELEASE_SCHEMAS, toJsonSchema } from '../tools/lib/json-schema.ts';

const ALL = [...Object.entries(FILE_SCHEMAS), ...Object.entries(RELEASE_SCHEMAS)];

describe('toJsonSchema', () => {
	it.each(ALL)('%s: draft 2020-12 with no extra properties allowed', (_kind, schema) => {
		const json = toJsonSchema(schema);
		expect(json.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
		expect(JSON.stringify(json)).not.toContain('"additionalProperties":true');
	});
	it('emits the recursive Feature once under $defs', () => {
		const defs = toJsonSchema(FILE_SCHEMAS.army).$defs as Record<string, unknown>;
		expect(Object.keys(defs)).toEqual(expect.arrayContaining(['Army', 'Tile', 'Feature']));
	});
});
