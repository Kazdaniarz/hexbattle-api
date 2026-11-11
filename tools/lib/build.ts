/*
 * The build: validated source data → every published file of /v1/ (path → JSON value). Writing is done by the caller.
 */
import type { AssetsInfo, BoardSkinsIndex, Index, Lang, ReleaseArmy, SkinsIndex } from '@hexbattle/schema';
import { type AssetManifest, checkManifest, collectAssetRefs, WEBP, webpSizes } from './assets.ts';
import { standardBoard } from './board.ts';
import type { SourceData } from './data-files.ts';
import { completeness, deriveArmy, deriveTile, skinCoverage } from './derive.ts';
import { isError, type Issue } from './issues.ts';
import { RELEASE_SCHEMAS, toJsonSchema } from './json-schema.ts';
import { validate, type ValidateOptions } from './validate/index.ts';
import { countMissing } from './validate/languages.ts';

/* * Types */

export interface BuildOptions extends ValidateOptions {
	/** Semver of this data release. */
	datasetVersion: string;
	/** Version of @hexbattle/schema used for the build (written into the index). */
	schemaVersion?: string;
	/** Build instant (UTC); passed in so builds and tests stay deterministic. */
	generatedAt: Date;
	/** Image manifest; every image the data references must be listed. */
	manifest: AssetManifest;
}

export interface BuildResult {
	/** Published path under /v1/ → JSON value; empty when there are errors. */
	files: Map<string, unknown>;
	issues: Issue[];
}

/** Languages a release can be complete in; Polish is always complete (the schema requires it). */
const LANGS: readonly Lang[] = ['pl', 'en'];

/* * Build */

export function build(source: SourceData, options: BuildOptions): BuildResult {
	const issues = [
		...source.issues,
		...validate(source, options),
		...checkManifest(collectAssetRefs(source), options.manifest, options.release),
	];
	const files = new Map<string, unknown>();
	if (issues.some(isError) || !source.mechanics || !source.markers) {
		return { files, issues };
	}

	const armies = [...source.armies].sort((a, b) => a.data.id.localeCompare(b.data.id));
	for (const { data: army } of armies) {
		const { tiles, ...rest } = army;
		const release: ReleaseArmy = {
			...rest,
			...(tiles && { tiles: tiles.map((tile) => ({ ...tile, derived: deriveTile(tile) })) }),
			derived: deriveArmy(army),
		};
		files.set(`armies/${army.id}.json`, release);
	}

	const armyById = new Map(armies.map(({ data }) => [data.id, data]));
	const skins = [...source.skins].sort((a, b) => a.data.id.localeCompare(b.data.id));
	const skinsIndex: SkinsIndex = {
		skins: skins.map(({ data: skin }) => ({
			id: skin.id,
			army: skin.army,
			name: skin.name,
			official: skin.official,
			href: `skins/${skin.id}.json`,
			coverage: skinCoverage(skin, armyById.get(skin.army)),
		})),
	};
	for (const { data: skin } of skins) {
		files.set(`skins/${skin.id}.json`, skin);
	}

	const boardSkins = [...source.boardSkins].sort((a, b) => a.data.id.localeCompare(b.data.id));
	const defaultBoardSkin = boardSkins.find(({ data }) => data.default === true)?.data.id;
	const boardSkinsIndex: BoardSkinsIndex = {
		...(defaultBoardSkin && { default: defaultBoardSkin }),
		board_skins: boardSkins.map(({ data }) => ({
			id: data.id,
			name: data.name,
			official: data.official,
			href: `board_skins/${data.id}.json`,
		})),
	};
	for (const { data } of boardSkins) {
		files.set(`board_skins/${data.id}.json`, data);
	}

	const index: Index = {
		meta: {
			dataset_version: options.datasetVersion,
			...(options.schemaVersion === undefined ? {} : { schema_version: options.schemaVersion }),
			languages: completeLanguages(source),
			generated_at: options.generatedAt.toISOString(),
			build: options.release ? 'release' : 'dev',
		},
		armies: armies.map(({ data: army }) => ({
			id: army.id,
			name: army.name,
			official: army.official,
			origin: army.origin,
			href: `armies/${army.id}.json`,
			completeness: completeness(army),
		})),
		files: {
			mechanics: 'mechanics.json',
			markers: 'markers.json',
			boards: 'boards.json',
			skins: 'skins/index.json',
			board_skins: 'board_skins/index.json',
			schemas: 'schema/',
		},
		assets: assetsInfo(options.manifest),
	};

	files.set('index.json', index);
	files.set('mechanics.json', source.mechanics.data);
	files.set('markers.json', source.markers.data);
	files.set('boards.json', { boards: [standardBoard()] });
	files.set('skins/index.json', skinsIndex);
	files.set('board_skins/index.json', boardSkinsIndex);
	for (const [kind, schema] of Object.entries(RELEASE_SCHEMAS)) {
		files.set(`schema/${kind}.schema.json`, toJsonSchema(schema));
	}
	return { files, issues };
}

/* * Helpers */

/** The index's description of the published images, taken from the manifest. */
function assetsInfo(manifest: AssetManifest): AssetsInfo {
	const files: AssetsInfo['files'] = {};
	for (const [ref, entry] of Object.entries(manifest.assets).sort(([a], [b]) => a.localeCompare(b))) {
		files[ref] = {
			sha256: entry.sha256,
			...(entry.width !== undefined && { width: entry.width }),
			...(entry.height !== undefined && { height: entry.height }),
			webp: webpSizes(ref, entry),
		};
	}
	return {
		base: 'assets/',
		webp: { quality: WEBP.quality, sizes: [...WEBP.sizes], sizes_by_prefix: WEBP.sizesByPrefix, name: WEBP.name },
		files,
	};
}

/** A language is complete when every player-facing text in every published source file has it. */
function completeLanguages(source: SourceData): Lang[] {
	const data = [source.mechanics, source.markers, ...source.armies, ...source.skins, ...source.boardSkins].map(
		(file) => file?.data,
	);
	return LANGS.filter((lang) => countMissing(data, lang) === 0);
}
