// Guards the @-mention picker's file_glob_search gate: on an OpenAI-compatible
// server there is no server-side file_glob_search tool, so the picker opens but
// explains why instead of firing searches that would only fail.

import ChatFormPickerMention from '$lib/components/app/chat/ChatForm/ChatFormPickers/ChatFormPickerMention.svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

function renderPicker() {
	return render(ChatFormPickerMention, {
		isOpen: true,
		onClose: () => {},
		onSelect: () => {},
		query: 'main'
	});
}

describe('ChatFormPickerMention file_glob_search gate', () => {
	it('explains that file search is unavailable on an OpenAI-compatible server', async () => {
		renderPicker();
		await tick();

		expect(document.body.textContent).toContain(
			'File search is unavailable on this server'
		);
	});
});
