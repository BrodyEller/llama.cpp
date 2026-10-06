import { describe, expect, it } from 'vitest';

import { GlobSearchType } from '$lib/enums';
import { runGlobSearchWithChildren } from '$lib/utils';

describe('runGlobSearchWithChildren', () => {
	it('returns empty results on an OpenAI-compatible server (no server tools)', async () => {
		const res = await runGlobSearchWithChildren(
			'note',
			'/Users/rootA',
			3,
			50,
			new AbortController().signal
		);

		expect(res.error).toBeUndefined();
		expect(res.entries).toEqual([]);
		expect(res.exactDir).toBeUndefined();
	});

	it('does not descend without a trailing separator in mention mode', async () => {
		const res = await runGlobSearchWithChildren(
			'/Users/rootC/src',
			'/Users/rootC',
			3,
			50,
			new AbortController().signal,
			{ descendOnTrailingSeparator: true, type: GlobSearchType.ALL }
		);

		expect(res.exactDir).toBeUndefined();
		expect(res.entries).toEqual([]);
	});

	it('descends on an exact directory match in WD mode', async () => {
		const res = await runGlobSearchWithChildren(
			'/Users/rootD/src',
			'/Users/rootD',
			3,
			50,
			new AbortController().signal,
			{ type: GlobSearchType.DIR }
		);

		expect(res.exactDir).toBeUndefined();
		expect(res.entries).toEqual([]);
	});
});
