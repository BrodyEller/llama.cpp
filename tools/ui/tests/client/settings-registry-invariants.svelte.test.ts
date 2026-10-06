import { CONFIG_LOCALSTORAGE_KEY, SETTING_CONFIG_DEFAULT } from '$lib/constants';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import type { SettingsConfigType } from '$lib/types';
import { beforeEach, describe, expect, it } from 'vitest';

type Primitive = string | number | boolean;

const KEYS = Object.keys(SETTING_CONFIG_DEFAULT).filter(
	(k) => ['string', 'number', 'boolean'].includes(typeof SETTING_CONFIG_DEFAULT[k]) && k !== 'theme'
);

function divergent(key: string, base: Primitive): Primitive {
	if (typeof base === 'boolean') return !base;

	if (typeof base === 'number') return base + 7;

	return `user-${key}`;
}

const setUser = (key: string, value: Primitive) =>
	settingsStore.updateConfig(key as keyof SettingsConfigType, value as never);
const current = (key: string) => (settingsStore.config as Record<string, unknown>)[key];

describe('registry-wide invariants', () => {
	beforeEach(() => {
		localStorage.removeItem(CONFIG_LOCALSTORAGE_KEY);
	});

	it('I1: no load ever modifies a stored user value, for any key of any type', () => {
		settingsStore.initialize();
		const userValues: Record<string, Primitive> = {};

		for (const key of KEYS) {
			userValues[key] = divergent(key, SETTING_CONFIG_DEFAULT[key] as Primitive);
			setUser(key, userValues[key]);
		}

		// simulated F5 + sync (no-op on an OpenAI-compatible server)
		settingsStore.initialize();
		settingsStore.syncWithServerDefaults();
		settingsStore.syncWithServerDefaults();

		for (const key of KEYS) {
			expect(current(key), key).toBe(userValues[key]);
		}
	});

	it('I3: Reset returns every key to factory default', () => {
		settingsStore.initialize();
		for (const key of KEYS) setUser(key, divergent(key, SETTING_CONFIG_DEFAULT[key] as Primitive));

		settingsStore.forceSyncWithServerDefaults();

		for (const key of KEYS) {
			expect(current(key), key).toBe(SETTING_CONFIG_DEFAULT[key]);
		}
	});
});
