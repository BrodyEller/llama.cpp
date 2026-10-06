import { ModelModality } from '$lib/enums';
import type { ModelOption } from '$lib/types/models';
import { SvelteMap } from 'svelte/reactivity';

export interface ModelItem {
	option: ModelOption;
	flatIndex: number;
}

export interface OrgGroup {
	orgName: string | null;
	items: ModelItem[];
}

export interface GroupedModelOptions {
	favorites: ModelItem[];
	available: OrgGroup[];
}

function matchesModality(option: ModelOption, term: string): boolean {
	const modalities = option.modalities;

	if (!modalities) return false;

	switch (term) {
		case ModelModality.VISION.toLowerCase():
			return modalities.vision;
		case ModelModality.AUDIO.toLowerCase():
			return modalities.audio;
		case ModelModality.VIDEO.toLowerCase():
			return modalities.video;
		default:
			return false;
	}
}

export function filterModelOptions(options: ModelOption[], searchTerm: string): ModelOption[] {
	const term = searchTerm.trim().toLowerCase();

	if (!term) return options;

	return options.filter(
		(option) =>
			option.model.toLowerCase().includes(term) ||
			option.name?.toLowerCase().includes(term) ||
			option.aliases?.some((alias: string) => alias.toLowerCase().includes(term)) ||
			option.tags?.some((tag: string) => tag.toLowerCase().includes(term)) ||
			matchesModality(option, term)
	);
}

export function groupModelOptions(
	filteredOptions: ModelOption[],
	favoriteIds: Set<string>
): GroupedModelOptions {
	// Favorites
	const favorites: ModelItem[] = [];

	for (let i = 0; i < filteredOptions.length; i++) {
		if (favoriteIds.has(filteredOptions[i].model)) {
			favorites.push({ flatIndex: i, option: filteredOptions[i] });
		}
	}

	// Available models grouped by org (excluding favorites)
	const available: OrgGroup[] = [];
	const orgGroups = new SvelteMap<string, ModelItem[]>();

	for (let i = 0; i < filteredOptions.length; i++) {
		const option = filteredOptions[i];

		if (favoriteIds.has(option.model)) continue;

		// Derive the org from the model id (e.g. "org/model" -> "org").
		const key = option.model.includes('/') ? option.model.split('/')[0] : '';

		if (!orgGroups.has(key)) orgGroups.set(key, []);

		orgGroups.get(key)!.push({ flatIndex: i, option });
	}

	for (const [orgName, items] of orgGroups) {
		available.push({ items, orgName: orgName || null });
	}

	return { available, favorites };
}
