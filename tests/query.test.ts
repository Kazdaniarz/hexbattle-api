/*
 * Query service: parameters, lookups by id and name, every query, and the /v1/query/ routes, on the test fixture.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	ArmyQuery,
	BoardSkinQuery,
	MarkerQuery,
	MechanicQuery,
	MechanicQueryResult,
	QueryError,
	SkinQuery,
	TileQuery,
	TileQueryResult,
	type BoardSkin,
	type MarkersFile,
	type MechanicsFile,
	type ReleaseArmy,
	type Skin,
} from '@hexbattle/schema';
import type { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from '../tools/lib/build.ts';
import {
	type Catalogue,
	fold,
	loadCatalogue,
	parseQuery,
	queryArmies,
	queryBoardSkins,
	queryMarkers,
	queryMechanics,
	querySkins,
	queryTiles,
} from '../tools/lib/query.ts';
import { createApiServer } from '../tools/lib/server.ts';
import { manifestFor, source } from './fixtures/source.ts';

/* * Setup */

const { files } = build(source(), {
	release: true,
	requireLangs: [],
	datasetVersion: '1.0.0',
	generatedAt: new Date(0),
	manifest: manifestFor(source()),
});
const catalogue: Catalogue = {
	armies: [files.get('armies/testowa.json') as ReleaseArmy],
	mechanics: (files.get('mechanics.json') as MechanicsFile).mechanics,
	markers: (files.get('markers.json') as MarkersFile).markers,
	skins: [files.get('skins/testowa.wariant.json') as Skin],
	boardSkins: [files.get('board_skins/plansza.json') as BoardSkin],
};

/** Ids of the results of one query, from its URL parameters. */
function ids<S extends z.ZodType>(
	schema: S,
	run: (c: Catalogue, query: z.infer<S>) => { results: { id?: string | undefined }[] },
	params: string,
): string[] {
	const parsed = parseQuery(schema, new URLSearchParams(params));
	if ('error' in parsed) throw new Error(JSON.stringify(parsed.error));
	return run(catalogue, parsed.query).results.map((item) => item.id ?? '');
}

const tiles = (params: string) => ids(TileQuery, queryTiles, params);
const mechanics = (params: string) => ids(MechanicQuery, queryMechanics, params);

function rejected(params: string): QueryError['details'] {
	const parsed = parseQuery(TileQuery, new URLSearchParams(params));
	return 'error' in parsed ? parsed.error.details : [];
}

const T = (slug: string) => `testowa.${slug}`;

/* * Tiles */

describe('queryTiles', () => {
	it.each([
		['', ['sztab', 'wojownik', 'oficer', 'odepchniecie']],
		['army=testowa,inna', ['sztab', 'wojownik', 'oficer', 'odepchniecie']],
		['army=inna', []],
		['category=warrior,module', ['wojownik', 'oficer']],
		['name=WOJOWN', ['wojownik']],
		['mechanic=push', ['wojownik', 'odepchniecie']],
		['mechanic=melee&min_strength=2', ['wojownik']],
		['mechanic=modify_stat&side=allied', ['oficer']],
		['mechanic=modify_stat&side=enemy', []],
		['hp=2', ['wojownik']],
		['min_hp=2', ['sztab', 'wojownik']],
		['max_hp=1', ['oficer']],
		['initiative=0', ['sztab']],
		['min_initiative=1', ['wojownik']],
		['copies=2', ['oficer', 'odepchniecie']],
		['min_copies=30', ['wojownik']],
		['category=module&mechanic=grant_ability', ['oficer']],
		['id=testowa.oficer,testowa.sztab', ['sztab', 'oficer']],
		['id=testowa.nikt', []],
		['name=oficer&exact=true', ['oficer']],
		['name=ofic&exact=true', []],
		['name=OFICER&exact=1', ['oficer']],
	])('%s', (params, expected) => {
		expect(tiles(params)).toEqual(expected.map(T));
	});
	it('pages the results and reports the total', () => {
		const parsed = parseQuery(TileQuery, new URLSearchParams('limit=1&offset=1'));
		if ('error' in parsed) throw new Error('rejected');
		const result = queryTiles(catalogue, parsed.query);
		expect([result.total, result.results.map((tile) => tile.id)]).toEqual([4, [T('wojownik')]]);
	});
	it('returns the full tile with its army, or only the picked fields', () => {
		const parsed = parseQuery(TileQuery, new URLSearchParams('name=sztab'));
		if ('error' in parsed) throw new Error('rejected');
		const [full] = queryTiles(catalogue, parsed.query).results;
		expect(full).toMatchObject({ army: 'testowa', id: T('sztab'), derived: { hp: 20 } });
		const picked = parseQuery(TileQuery, new URLSearchParams('name=sztab&fields=id,army,copies'));
		if ('error' in picked) throw new Error('rejected');
		expect(queryTiles(catalogue, picked.query).results).toEqual([{ army: 'testowa', id: T('sztab'), copies: 1 }]);
	});
	it('ignores case and Polish letters in names', () => {
		expect(fold('Łowca Żółć')).toBe('lowca zolc');
	});
});

/* * Mechanics */

describe('queryMechanics', () => {
	it.each([
		['kind=effect', ['modify_stat', 'grant_ability', 'push']],
		['kind=effect&used_by=testowa', ['modify_stat', 'grant_ability', 'push']],
		['placement=corner', []],
		['kind=army_rule', ['test_rule']],
		['used_by=testowa&kind=attack,defense', ['melee', 'armor']],
		['name=AURA', ['aura_pair']],
		['id=melee,push', ['melee', 'push']],
		['name=melee&exact=true', ['melee']],
	])('%s', (params, expected) => {
		expect(mechanics(params)).toEqual(expected);
	});
});

/* * Armies, markers, skins */

describe('queryArmies', () => {
	it.each([
		['', ['testowa']],
		['id=testowa', ['testowa']],
		['name=testowa&exact=true', ['testowa']],
		['origin=expansion', []],
		['official=false', []],
		['official=true&origin=base_game', ['testowa']],
	])('%s', (params, expected) => {
		expect(ids(ArmyQuery, queryArmies, params)).toEqual(expected);
	});
	it('returns the whole army, or only the picked fields', () => {
		const parsed = parseQuery(ArmyQuery, new URLSearchParams('id=testowa&fields=id,deck'));
		if ('error' in parsed) throw new Error('rejected');
		expect(queryArmies(catalogue, parsed.query).results).toEqual([{ id: 'testowa', deck: { size: 35 } }]);
	});
});

describe('queryMarkers, querySkins, queryBoardSkins', () => {
	it.each([
		['id=wound', ['wound']],
		['name=RANA', ['wound']],
		['placement=hp_track', []],
	])('markers %s', (params, expected) => {
		expect(ids(MarkerQuery, queryMarkers, params)).toEqual(expected);
	});
	it.each([
		['army=testowa', ['testowa.wariant']],
		['army=inna', []],
		['id=testowa.wariant&name=wariant', ['testowa.wariant']],
	])('skins %s', (params, expected) => {
		expect(ids(SkinQuery, querySkins, params)).toEqual(expected);
	});
	it.each([
		['default=true', ['plansza']],
		['default=false', []],
		['name=plansza&exact=true', ['plansza']],
	])('board skins %s', (params, expected) => {
		expect(ids(BoardSkinQuery, queryBoardSkins, params)).toEqual(expected);
	});
});

/* * Parameters */

describe('parseQuery', () => {
	it('fills defaults and splits lists', () => {
		expect(parseQuery(TileQuery, new URLSearchParams('army=a,b'))).toEqual({
			query: { army: ['a', 'b'], limit: 100, offset: 0 },
		});
	});
	it.each([
		['colour=red', 'colour', 'unknown parameter'],
		['army=a&army=b', 'army', 'given more than once (use a comma-separated list)'],
		['army=Moloch', 'army', 'expected a snake_case ASCII id'],
		['category=hero', 'category', ''],
		['side=enemy', 'mechanic', 'min_strength and side need mechanic'],
		['limit=501', 'limit', ''],
		['hp=two', 'hp', ''],
		['fields=id,secret', 'fields', ''],
		['exact=maybe', 'exact', ''],
		['id=klaun', 'id', ''],
	])('rejects %s', (params, param, message) => {
		const details = rejected(params) ?? [];
		expect(details.map((detail) => detail.param)).toContain(param);
		if (message) expect(details.map((detail) => detail.message)).toContain(message);
	});
});

/* * Routes */

describe('/v1/query/ routes', () => {
	let root = '';
	let server: Server;
	let empty: Server;
	let base = '';
	let emptyBase = '';

	beforeAll(async () => {
		root = await mkdtemp(path.join(tmpdir(), 'hexbattle-query-'));
		for (const [file, value] of files) {
			await mkdir(path.dirname(path.join(root, 'v1', file)), { recursive: true });
			await writeFile(path.join(root, 'v1', file), JSON.stringify(value));
		}
		server = createApiServer(root, await loadCatalogue(path.join(root, 'v1')));
		empty = createApiServer(root);
		const listen = async (s: Server): Promise<string> => {
			await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
			return `http://127.0.0.1:${String((s.address() as AddressInfo).port)}`;
		};
		base = await listen(server);
		emptyBase = await listen(empty);
	});
	afterAll(async () => {
		await Promise.all(
			[server, empty].map(
				(s) =>
					new Promise<void>((resolve) =>
						s.close(() => {
							resolve();
						}),
					),
			),
		);
		await rm(root, { recursive: true, force: true });
	});

	it('answers tile queries with CORS, cache and an ETag', async () => {
		const response = await fetch(`${base}/v1/query/tiles?category=warrior`);
		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('cache-control')).toBe('public, max-age=300');
		const body = TileQueryResult.parse(await response.json());
		expect([body.total, body.results[0]?.id]).toEqual([1, T('wojownik')]);
		const again = await fetch(`${base}/v1/query/tiles?category=warrior`, {
			headers: { 'If-None-Match': response.headers.get('etag') ?? '' },
		});
		expect(again.status).toBe(304);
	});
	it('answers mechanic queries', async () => {
		const response = await fetch(`${base}/v1/query/mechanics?kind=connector`);
		expect(MechanicQueryResult.parse(await response.json()).results.map((m) => m.id)).toEqual(['module_link']);
	});
	it.each([
		['armies?id=testowa', 'testowa'],
		['markers?id=wound', 'wound'],
		['skins?army=testowa', 'testowa.wariant'],
		['board_skins?default=true', 'plansza'],
		['tiles?id=testowa.sztab', 'testowa.sztab'],
	])('answers %s', async (query, id) => {
		const body = (await (await fetch(`${base}/v1/query/${query}`)).json()) as { results: { id: string }[] };
		expect(body.results.map((item) => item.id)).toEqual([id]);
	});
	it('rejects bad parameters with 400 and the reasons', async () => {
		const response = await fetch(`${base}/v1/query/tiles?colour=red`);
		expect(response.status).toBe(400);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(QueryError.parse(await response.json())).toEqual({
			error: 'bad_query',
			details: [{ param: 'colour', message: 'unknown parameter' }],
		});
	});
	it('answers 404 for an unknown query and 405 for writes', async () => {
		expect((await fetch(`${base}/v1/query/boards`)).status).toBe(404);
		expect((await fetch(`${base}/v1/query/tiles`, { method: 'POST' })).status).toBe(405);
	});
	it('answers 503 when no built data is loaded', async () => {
		const response = await fetch(`${emptyBase}/v1/query/tiles`);
		expect([response.status, await response.json()]).toEqual([503, { error: 'no_data' }]);
	});
	it('still serves the static files next to the queries', async () => {
		expect((await fetch(`${base}/v1/armies/testowa.json`)).status).toBe(200);
	});
});
