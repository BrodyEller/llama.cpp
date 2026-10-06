import { CONFIG_LOCALSTORAGE_KEY } from '$lib/constants';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import { beforeEach, describe, expect, it } from 'vitest';

describe('server ui_settings application semantics', () => {
	beforeEach(() => {
		localStorage.removeItem(CONFIG_LOCALSTORAGE_KEY);
	});

	it('does not apply server defaults on an OpenAI-compatible server', () => {
		settingsStore.initialize();

		settingsStore.syncWithServerDefaults();

		expect(settingsStore.config.theme).not.toBe('dark');
	});

	it('never reapplies on later loads: the user config diverges freely', () => {
		settingsStore.initialize();
		settingsStore.updateConfig('theme', 'light');
		settingsStore.updateConfig('apiKey', 'sk-user-key');

		// simulated F5: config now exists in localStorage
		settingsStore.initialize();

		settingsStore.syncWithServerDefaults();
		settingsStore.syncWithServerDefaults();

		expect(settingsStore.config.theme).toBe('light');
		expect(settingsStore.config.apiKey).toBe('sk-user-key');
		const stored = JSON.parse(localStorage.getItem(CONFIG_LOCALSTORAGE_KEY) ?? '{}');

		expect(stored.apiKey).toBe('sk-user-key');
	});

	it('keeps a value the user sets before the baseline is reachable', () => {
		settingsStore.initialize();
		settingsStore.updateConfig('apiKey', 'sk-user-key');

		settingsStore.syncWithServerDefaults();

		expect(settingsStore.config.apiKey).toBe('sk-user-key');
	});

	it('Reset to Default reapplies the factory defaults', () => {
		settingsStore.initialize();
		settingsStore.updateConfig('theme', 'light');
		settingsStore.updateConfig('apiKey', 'sk-user-key');

		settingsStore.forceSyncWithServerDefaults();

		expect(settingsStore.config.theme).toBe('system');
		expect(settingsStore.config.apiKey).toBe('');
	});
});
