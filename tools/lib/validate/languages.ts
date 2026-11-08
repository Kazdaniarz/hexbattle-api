/*
 * Language completeness: every player-facing text has Polish (schema); other languages are counted per file.
 */
import type { Lang } from '@hexbattle/schema';
import type { Context } from './context.ts';

/* * Check */

/** Reports texts without the given languages: a warning per file, an error for required languages. */
export function checkLanguages(ctx: Context, file: string, data: unknown, langs: readonly Lang[]): void {
	for (const lang of langs) {
		const missing = countMissing(data, lang);
		if (missing > 0) {
			const isRequired = ctx.options.requireLangs.includes(lang);
			const message = `${String(missing)} text(s) without "${lang}"`;
			ctx.report(isRequired ? 'E_LANG_MISSING' : 'W_LANG_MISSING', file, '', message);
		}
	}
}

/* * Helpers */

/** A player-facing text is an object with a Polish string and nothing but language keys. */
function isText(value: object): value is Record<string, string> {
	const keys = Object.keys(value);
	return keys.includes('pl') && keys.every((key) => key === 'pl' || key === 'en');
}

/** Number of player-facing texts in `value` without the given language. */
export function countMissing(value: unknown, lang: Lang): number {
	if (Array.isArray(value)) {
		return value.reduce((sum: number, item: unknown) => sum + countMissing(item, lang), 0);
	}
	if (value === null || typeof value !== 'object') {
		return 0;
	}
	if (isText(value)) {
		return value[lang] === undefined ? 1 : 0;
	}
	return Object.values(value).reduce((sum: number, item: unknown) => sum + countMissing(item, lang), 0);
}
