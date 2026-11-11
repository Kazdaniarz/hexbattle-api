/*
 * Read-only server for the built API: serves <dist>/v1/ at /v1/ and the query service at /v1/query/, with the
 * production headers. GET and HEAD only, ETag revalidation, no directory listings, nothing outside the v1 folder.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { ArmyQuery, BoardSkinQuery, MarkerQuery, MechanicQuery, SkinQuery, TileQuery } from '@hexbattle/schema';
import type { z } from 'zod';
import { cacheControl, COMMON_HEADERS, contentType } from './http-headers.ts';
import {
	type Catalogue,
	parseQuery,
	queryArmies,
	queryBoardSkins,
	queryMarkers,
	queryMechanics,
	querySkins,
	queryTiles,
} from './query.ts';

const PREFIX = '/v1/';
const JSON_TYPE = 'application/json; charset=utf-8';

/** Query routes: path → parameter schema and the function answering it. */
const QUERIES: Record<string, { schema: z.ZodType; run: (catalogue: Catalogue, query: never) => unknown }> = {
	'/v1/query/tiles': { schema: TileQuery, run: queryTiles },
	'/v1/query/armies': { schema: ArmyQuery, run: queryArmies },
	'/v1/query/mechanics': { schema: MechanicQuery, run: queryMechanics },
	'/v1/query/markers': { schema: MarkerQuery, run: queryMarkers },
	'/v1/query/skins': { schema: SkinQuery, run: querySkins },
	'/v1/query/board_skins': { schema: BoardSkinQuery, run: queryBoardSkins },
};

/* * Server */

/**
 * A server for `<distDir>/v1/`; without a catalogue the query routes answer 503. Call `listen` on it. The
 * catalogue may also be a function, so a new build's data can be swapped in without a restart.
 */
export function createApiServer(distDir: string, catalogue?: Catalogue | (() => Catalogue | undefined)): Server {
	const root = path.resolve(distDir, 'v1');
	const current = typeof catalogue === 'function' ? catalogue : () => catalogue;
	return createServer((request, response) => {
		handle(root, current(), request, response).catch((error: unknown) => {
			if (!response.headersSent) {
				send(response, 500, { error: 'internal_error' });
			}
			response.destroy(error instanceof Error ? error : new Error(String(error)));
		});
	});
}

async function handle(
	root: string,
	catalogue: Catalogue | undefined,
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> {
	if (request.method === 'OPTIONS') {
		response.writeHead(204, COMMON_HEADERS);
		response.end();
		return;
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		send(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD, OPTIONS' });
		return;
	}
	const url = parseUrl(request.url ?? '/');
	const route = url && QUERIES[url.pathname];
	if (url && route) {
		if (!catalogue) {
			send(response, 503, { error: 'no_data' });
			return;
		}
		const parsed = parseQuery(route.schema, url.searchParams);
		if ('error' in parsed) {
			send(response, 400, parsed.error);
			return;
		}
		const body = Buffer.from(JSON.stringify(route.run(catalogue, parsed.query as never)));
		respond(request, response, body, JSON_TYPE, cacheControl('query'));
		return;
	}
	const published = publishedPath(request.url ?? '/');
	const type = published === undefined ? undefined : contentType(published);
	const file = published === undefined ? undefined : path.resolve(root, published);
	if (published === undefined || type === undefined || file === undefined || !file.startsWith(root + path.sep)) {
		send(response, 404, { error: 'not_found' });
		return;
	}
	const body = await readIfFile(file);
	if (body === undefined) {
		send(response, 404, { error: 'not_found' });
		return;
	}
	respond(request, response, body, type, cacheControl(published));
}

/** 200 with an ETag, or 304 when the client already has this body. */
function respond(request: IncomingMessage, response: ServerResponse, body: Buffer, type: string, cache: string): void {
	const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;
	const headers = { ...COMMON_HEADERS, 'Cache-Control': cache, ETag: etag };
	if (request.headers['if-none-match'] === etag) {
		response.writeHead(304, headers);
		response.end();
		return;
	}
	response.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': String(body.length) });
	response.end(request.method === 'HEAD' ? undefined : body);
}

/* * Helpers */

/** The request URL, or undefined when it cannot be parsed. */
function parseUrl(url: string): URL | undefined {
	try {
		return new URL(url, 'http://localhost');
	} catch {
		return undefined;
	}
}

/** The path below /v1/ (`/v1/` alone = `index.json`), or undefined for anything else. */
function publishedPath(url: string): string | undefined {
	let pathname: string;
	try {
		pathname = decodeURIComponent(parseUrl(url)?.pathname ?? '');
	} catch {
		return undefined;
	}
	if (!pathname.startsWith(PREFIX) || pathname.includes('\\') || pathname.includes('\0')) {
		return undefined;
	}
	const rest = pathname.slice(PREFIX.length);
	if (rest.split('/').some((segment) => segment === '..' || segment === '.')) {
		return undefined;
	}
	return rest === '' ? 'index.json' : rest;
}

async function readIfFile(file: string): Promise<Buffer | undefined> {
	try {
		return (await stat(file)).isFile() ? await readFile(file) : undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') {
			return undefined;
		}
		throw error;
	}
}

function send(response: ServerResponse, status: number, body: object, extra: Record<string, string> = {}): void {
	const text = JSON.stringify(body);
	response.writeHead(status, {
		...COMMON_HEADERS,
		...extra,
		'Content-Type': JSON_TYPE,
		'Content-Length': String(Buffer.byteLength(text)),
		'Cache-Control': 'no-store',
	});
	response.end(text);
}
