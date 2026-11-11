/*
 * Response headers of the public data API, one source for the local server and the production proxy config.
 * The API is read-only and public: any origin may read it, nothing is ever executed from it.
 */

/* * Content types */

const CONTENT_TYPES: Record<string, string> = {
	'.json': 'application/json; charset=utf-8',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
};

/** Content type by file extension, or undefined for files the API never serves. */
export function contentType(file: string): string | undefined {
	const dot = file.lastIndexOf('.');
	return dot === -1 ? undefined : CONTENT_TYPES[file.slice(dot).toLowerCase()];
}

/* * Caching */

/** Seconds a client or edge cache may keep a file before revalidating with its ETag. */
export const MAX_AGE = {
	/** `index.json` changes with every release; clients poll it to detect new data. */
	index: 60,
	/** Other JSON files change only with a release. */
	json: 300,
	/** Images are replaced rarely; `index.json` lists each image's hash to detect a replacement. */
	assets: 86_400,
	/** An image asked for with its hash (`?v=<sha256>`): a new image gets a new address, so it may be kept a year. */
	versioned: 31_536_000,
} as const;

/** An image address with its hash never changes its content, so caches may keep it without asking again. */
export const VERSIONED_CACHE = `public, max-age=${String(MAX_AGE.versioned)}, immutable`;

export function cacheControl(publishedPath: string): string {
	const maxAge =
		publishedPath === 'index.json'
			? MAX_AGE.index
			: publishedPath.startsWith('assets/')
				? MAX_AGE.assets
				: MAX_AGE.json;
	return `public, max-age=${String(maxAge)}`;
}

/* * Shared headers */

/** Headers on every response, errors included. */
export const COMMON_HEADERS: Readonly<Record<string, string>> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
	'Access-Control-Allow-Headers': 'If-None-Match',
	'Access-Control-Expose-Headers': 'ETag',
	'Access-Control-Max-Age': '86400',
	'X-Content-Type-Options': 'nosniff',
	// ? no scripts, styles or frames, even inside a served SVG opened directly
	'Content-Security-Policy': "default-src 'none'; sandbox",
	'Cross-Origin-Resource-Policy': 'cross-origin',
	'Referrer-Policy': 'no-referrer',
};
