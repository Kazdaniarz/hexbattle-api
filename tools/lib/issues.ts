/*
 * Build issues: errors (E_*) and warnings (W_*) with stable codes, reported per file.
 */

/* * Codes */

/** Every issue code and what it means. Codes are stable: never renamed, never reused for another meaning. */
export const ISSUE_CODES = {
	// ? files
	E_SCHEMA: 'invalid JSON or a value the schema rejects',
	E_FILE_NAME: 'a skin or board skin file is not named after its id',
	// ? registry
	E_MECH_DUP: 'mechanic id defined twice',
	E_MARKER_DUP: 'marker id defined twice',
	E_MECH_SCOPE: 'army-specific mechanic used by another army, or scoped to an unknown army',
	E_MECH_TILE: 'mechanic on a tile type its tile_categories leave out',
	E_PARAM_LABELS: 'param labels do not match its values exactly',
	E_TEMPLATE: 'malformed placeholder, unknown param, or number-only syntax on a non-number',
	E_TEMPLATE_LABEL: 'placeholder of a non-numeric param without labels, or a label without the template language',
	// ? params (features, army rules, spec defaults)
	E_PARAM_REQUIRED: 'required param missing',
	E_PARAM_TYPE: 'param value of the wrong type',
	E_PARAM_VALUE: 'param value not among the allowed values, or excluded',
	E_PARAM_RANGE: 'param value outside min/max, or min greater than max',
	E_PARAM_UNKNOWN: 'param the mechanic does not define',
	E_PARAM_REF: 'id param pointing at an unknown mechanic or marker',
	// ? army
	E_ARMY_ID: 'army file not named after its id',
	E_ARMY_INCOMPLETE: 'release: army without display, deck or tiles',
	W_ARMY_INCOMPLETE: 'army without display, deck or tiles',
	W_NOT_OFFICIAL: 'army is not official',
	E_MANUAL_LANG_DUP: 'two manuals in one language',
	E_RULE_UNKNOWN: 'army rule pointing at an unknown mechanic',
	E_RULE_KIND: 'army rule pointing at a mechanic that is not an army_rule',
	E_RULE_DUP: 'army rule listed twice',
	E_DECK_SIZE: 'more tiles than the deck size, or fewer in a release',
	W_DECK_INCOMPLETE: 'fewer tiles than the deck size',
	E_HQ_COUNT: 'not exactly one starting Sztab (none when the army starts with Obiekty)',
	E_HP_MARKER_TILE: 'HP marker for a tile that is not a Sztab or Obiekt of the army',
	// ? tiles
	E_TILE_DUP: 'tile id defined twice',
	E_TILE_PREFIX: 'tile id does not start with its army id',
	E_DRAFT: 'release: tile still a draft',
	E_HQ_HP: 'Sztab without hp 20 or Obiekt without hp 10',
	E_HP_ON_UNIT: 'hp stored on a tile that is not a Sztab or Obiekt',
	E_MODULE_EMPTY: 'Moduł without a centre effect',
	E_FACE_DUP: 'two faces with the same side',
	E_FACE_PLAYABLE: 'tile without a playable face',
	E_IMAGE_PATH: 'image path does not follow the naming convention',
	// ? features
	E_MECH_UNKNOWN: 'feature pointing at an unknown mechanic',
	E_AT_MISSING: 'feature on a face without an anchor',
	E_PLACEMENT: 'anchor kind the mechanic does not allow, or an anchor on a nested feature',
	E_SLOT_UNREAD: 'badge position not read on a verified tile or in a release',
	W_SLOT_UNREAD: 'badge position not read yet on a draft tile',
	E_SLOT_DUP: 'two badges on one position',
	E_SLOT_OVERLAP: 'badges on neighbouring positions overlap',
	E_POS_PLACEMENT: 'an exact position (pos) on a feature that is not a badge',
	E_POS_OUTSIDE: 'an exact position (pos) outside the hex',
	E_CATEGORY: 'badge category the mechanic does not allow',
	E_CATEGORY_MISSING: 'badge category missing where the mechanic requires one',
	E_BADGE_GROUP: 'one badge group shared by different mechanics',
	E_BADGE_COUNT: 'badge group with a different number of badges than the mechanic prints',
	E_EFFECT_SIDE: 'side on a non-effect, or no side where the description needs one',
	E_CONTAINER: 'nested features on a non-container, or a container without exactly one of effects/options',
	E_EDGE_DUP_ATTACK: 'the same attack twice on one edge',
	E_MODULE_FEATURE_EDGE: 'Moduł feature on an edge with an attack, Sieć or trap',
	// ? skins
	E_SKIN_DUP: 'skin id defined twice',
	E_SKIN_PREFIX: 'skin id does not start with its army id',
	E_SKIN_ARMY: 'skin for an unknown army',
	E_SKIN_TILE: 'skin image for a tile the army does not have',
	E_SKIN_FACE: 'skin image for a face the tile does not have',
	E_SKIN_ART_ONLY: 'art-only flag without an image',
	E_SKIN_IMAGE_PATH: 'skin image path does not follow the naming convention',
	E_BOARD_SKIN_DUP: 'board skin id defined twice',
	E_BOARD_SKIN_DEFAULT: 'not exactly one default board skin, or none in a release',
	// ? images
	E_ASSET_MISSING: 'release: referenced image not in the manifest, or its master not found',
	W_ASSET_MISSING: 'referenced image not in the manifest, or its master not found',
	W_ASSET_UNUSED: 'manifest image not referenced by any data',
	E_ASSET_HASH: 'master file differs from the hash in the manifest',
	// ? languages
	W_LANG_MISSING: 'texts without a language (count per file)',
	E_LANG_MISSING: 'texts without a required language (count per file)',
} as const;

export type IssueCode = keyof typeof ISSUE_CODES;

/* * Types */

export interface Issue {
	code: IssueCode;
	/** Data file relative to the data folder, e.g. `armies/moloch.json`. */
	file: string;
	/** Location inside the file, e.g. `tiles[3].faces[0].features[1].at`. */
	path?: string;
	message: string;
}

/* * Helpers */

export function isError(issue: Issue): boolean {
	return issue.code.startsWith('E_');
}

/** Formats a path from Zod issue segments: `tiles[3].faces[0]`. */
export function formatPath(segments: readonly PropertyKey[]): string {
	return segments
		.map((segment, index) =>
			typeof segment === 'number' ? `[${String(segment)}]` : `${index === 0 ? '' : '.'}${String(segment)}`,
		)
		.join('');
}
