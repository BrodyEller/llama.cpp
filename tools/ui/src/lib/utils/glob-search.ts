/**
 * Shared `file_glob_search` runners with a short-lived result cache, so a
 * repeated query for the same (type, path, glob, depth) reuses the last
 * result instead of re-walking the tree.
 */

import { lastPathSegment } from './path-display';
import { buildGlobSearchArgs, joinPath, rankEntries } from './working-directory';
import { GLOB, PATH_SEPARATOR, SEARCH } from '$lib/constants';
import { GlobSearchType } from '$lib/enums';
import type {
	GlobEntry,
	GlobEntryResult,
	GlobSearchArgs,
	GlobSearchChildOptions,
	GlobSearchChildResult,
	GlobSearchResult
} from '$lib/types/glob';

const SEARCH_CACHE_TTL_MS = 2000;

interface CacheEntry {
	results: GlobEntry[];
	base: string;
	at: number;
}

const searchCache = new Map<string, CacheEntry>();

export async function runGlobSearch(
	args: GlobSearchArgs,
	type: GlobSearchType,
	limit: number,
	signal: AbortSignal
): Promise<GlobSearchResult> {
	// No server-side file_glob_search tool on an OpenAI-compatible server.
	return { base: '', entries: [] };
}

function toEntryResult(e: GlobEntry, base: string): GlobEntryResult {
	return { name: lastPathSegment(e.path), path: joinPath(base, e.path), type: e.type };
}

/**
 * One ranked glob search that may also list the matched directory's
 * children, shared by the WD picker (descend on exact match) and the
 * mention picker (descend on a trailing `/` or `\`).
 */
export async function runGlobSearchWithChildren(
	query: string,
	scopePath: string,
	searchDepth: number,
	limit: number,
	signal: AbortSignal,
	options: GlobSearchChildOptions = {}
): Promise<GlobSearchChildResult> {
	const {
		childMaxDepth = SEARCH.PATH_NAV_MAX_DEPTH,
		descendOnTrailingSeparator = false,
		type = GlobSearchType.ALL
	} = options;
	const args = buildGlobSearchArgs(query, scopePath, searchDepth);
	const res = await runGlobSearch(args, type, limit, signal);

	if (res.error) return { args, base: res.base, entries: [], error: res.error };

	const ranked = rankEntries(res.entries, args.rankQuery);
	const entries = ranked.map((e) => toEntryResult(e, res.base));
	const last = args.last;

	if (last) {
		const wantsDescend = descendOnTrailingSeparator
			? query.endsWith(PATH_SEPARATOR) || query.endsWith(GLOB.WINDOWS_SEPARATOR)
			: true;
		const exact = ranked.find(
			(e) => e.type === 'dir' && lastPathSegment(e.path).toLowerCase() === last.toLowerCase()
		);

		if (wantsDescend && exact) {
			const exactDir = joinPath(res.base, exact.path);
			const childRes = await runGlobSearch(
				{ include: GLOB.WILDCARD, maxDepth: childMaxDepth, path: exactDir, rankQuery: '' },
				type,
				limit,
				signal
			);

			if (!childRes.error) {
				const children = childRes.entries
					.map((e) => toEntryResult(e, childRes.base))
					.sort((a, b) => a.path.localeCompare(b.path));

				return { args, base: res.base, entries: [...entries, ...children], exactDir };
			}
		}
	}

	return { args, base: res.base, entries };
}
