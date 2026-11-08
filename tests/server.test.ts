/*
 * Requests and responses of the local API server: headers, caching, methods and path safety.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_AGE } from '../tools/lib/http-headers.ts';
import { createApiServer } from '../tools/lib/server.ts';

/* * Setup */

let root = '';
let server: Server;
let base = '';

beforeAll(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'hexbattle-serve-'));
	const v1 = path.join(root, 'v1');
	await mkdir(path.join(v1, 'armies'), { recursive: true });
	await mkdir(path.join(v1, 'assets', 'testowa'), { recursive: true });
	await writeFile(path.join(v1, 'index.json'), '{"meta":{}}');
	await writeFile(path.join(v1, 'armies', 'testowa.json'), '{"id":"testowa"}');
	await writeFile(path.join(v1, 'assets', 'testowa', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
	await writeFile(path.join(v1, 'assets', 'testowa', 'a_front@128.webp'), Buffer.from([1, 2, 3]));
	await writeFile(path.join(v1, 'notes.txt'), 'not served');
	await writeFile(path.join(root, 'secret.json'), '{"secret":true}');
	server = createApiServer(root);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
	await new Promise<void>((resolve) =>
		server.close(() => {
			resolve();
		}),
	);
	await rm(root, { recursive: true, force: true });
});

/* * Files */

describe('GET', () => {
	it('serves JSON with public CORS, security headers and an ETag', async () => {
		const response = await fetch(`${base}/v1/armies/testowa.json`);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: 'testowa' });
		expect(Object.fromEntries(response.headers)).toMatchObject({
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'x-content-type-options': 'nosniff',
			'cross-origin-resource-policy': 'cross-origin',
			'cache-control': `public, max-age=${String(MAX_AGE.json)}`,
		});
		expect(response.headers.get('etag')).toMatch(/^"[\w-]+"$/);
	});
	it('serves the index at /v1/ and /v1/index.json with the short cache', async () => {
		for (const url of ['/v1/', '/v1/index.json']) {
			const response = await fetch(`${base}${url}`);
			expect(response.status).toBe(200);
			expect(response.headers.get('cache-control')).toBe(`public, max-age=${String(MAX_AGE.index)}`);
		}
	});
	it('serves images with their types, the long cache and a sandboxing CSP', async () => {
		const svg = await fetch(`${base}/v1/assets/testowa/logo.svg`);
		expect(svg.headers.get('content-type')).toBe('image/svg+xml');
		expect(svg.headers.get('content-security-policy')).toContain("default-src 'none'");
		expect(svg.headers.get('cache-control')).toBe(`public, max-age=${String(MAX_AGE.assets)}`);
		const webp = await fetch(`${base}/v1/assets/testowa/a_front@128.webp`);
		expect(webp.headers.get('content-type')).toBe('image/webp');
		expect(new Uint8Array(await webp.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
	});
	it('answers 304 when the ETag still matches', async () => {
		const first = await fetch(`${base}/v1/armies/testowa.json`);
		const etag = first.headers.get('etag') ?? '';
		const second = await fetch(`${base}/v1/armies/testowa.json`, { headers: { 'If-None-Match': etag } });
		expect(second.status).toBe(304);
		expect(second.headers.get('access-control-allow-origin')).toBe('*');
	});
});

/* * Methods */

describe('methods', () => {
	it('answers HEAD with headers only', async () => {
		const response = await fetch(`${base}/v1/armies/testowa.json`, { method: 'HEAD' });
		expect(response.status).toBe(200);
		expect(response.headers.get('content-length')).toBe('16');
		expect(await response.text()).toBe('');
	});
	it('answers a CORS preflight', async () => {
		const response = await fetch(`${base}/v1/index.json`, { method: 'OPTIONS' });
		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
	});
	it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('rejects %s with 405', async (method) => {
		const response = await fetch(`${base}/v1/index.json`, { method });
		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
		expect(await response.json()).toEqual({ error: 'method_not_allowed' });
	});
});

/* * Path safety */

describe('not found', () => {
	it.each([
		'/v1/armies/nikt.json',
		'/v1/armies',
		'/v1/notes.txt',
		'/v1/../secret.json',
		'/v1/%2e%2e/secret.json',
		'/v1/armies%2f..%2f..%2fsecret.json',
		'/v1/..%5csecret.json',
		'/v1/%00.json',
		'/v1/%E0%A4%A.json',
		'/secret.json',
		'/',
	])('%s → 404 JSON, never cached', async (url) => {
		const response = await fetch(`${base}${url}`);
		expect(response.status).toBe(404);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ error: 'not_found' });
	});
});
