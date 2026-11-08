/*
 * Shared state of one validation run: options, lookups and the issue list.
 */
import type { Army, Lang, MarkerType, Mechanic, Terms } from '@hexbattle/schema';
import type { Issue } from '../issues.ts';

/* * Types */

export interface ValidateOptions {
	/** Release build: incomplete armies, drafts, unread badges and short decks are errors. */
	release: boolean;
	/** Languages that must be complete; a missing text is then an error instead of a warning. */
	requireLangs: readonly Lang[];
}

export interface Context {
	options: ValidateOptions;
	mechanics: ReadonlyMap<string, Mechanic>;
	markers: ReadonlyMap<string, MarkerType>;
	armies: ReadonlyMap<string, Army>;
	terms: Terms | undefined;
	report: (code: Issue['code'], file: string, path: string, message: string) => void;
}

/* * Factory */

export function createContext(
	options: ValidateOptions,
	lookups: Pick<Context, 'mechanics' | 'markers' | 'armies' | 'terms'>,
	issues: Issue[],
): Context {
	return {
		options,
		...lookups,
		report: (code, file, path, message) => {
			issues.push({ code, file, ...(path && { path }), message });
		},
	};
}

/* * Helpers */

/** First-come map by id; later duplicates are passed to `onDuplicate`. */
export function indexById<T extends { id: string }>(
	items: readonly T[],
	onDuplicate: (item: T, index: number) => void,
): Map<string, T> {
	const map = new Map<string, T>();
	items.forEach((item, index) => {
		if (map.has(item.id)) {
			onDuplicate(item, index);
		} else {
			map.set(item.id, item);
		}
	});
	return map;
}
