/**
 * ModelPropsManager - Per-model modality and thinking detection
 *
 * OpenAI-compatible servers do not advertise vision/audio/video capabilities
 * in /v1/models, so modalities are inferred from the model name via
 * model-capabilities heuristics. A configurable per-model capability map in
 * settings can override these heuristics. Created and owned by modelsStore.
 */

import { SETTINGS_KEYS } from '$lib/constants';
import { ModelModality } from '$lib/enums';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import {
	findModalityOverride,
	type ModelModalityOverride,
	modelNameSupportsAudio,
	modelNameSupportsThinking,
	modelNameSupportsVideo,
	modelNameSupportsVision,
	parseModalityOverrides
} from '$lib/utils/model-capabilities';

/**
 * The slice of modelsStore the manager reads. Kept narrow on purpose so it
 * cannot reach around the host's full surface; modelsStore implements this
 * structurally.
 */
export interface ModelPropsHost {
	/** Model rows the manager mirrors inferred modalities onto. */
	models: ModelOption[];
	readonly selectedModelName: string | null;
}

export class ModelPropsManager {
	/** Version counter - bumped on writes so $derived consumers recompute. */
	cacheVersion = $state(0);
	// Plain Set on purpose: fetchModelProps is synchronous inference, and this
	// is only a re-entrancy guard. A reactive set would let calling effects
	// subscribe to it, then the sync add/delete would re-trigger them forever.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- see above
	private fetching = new Set<string>();

	/**
	 * Whether the selected model supports thinking/reasoning.
	 * Override setting first, then the model name heuristic.
	 */
	get supportsThinking(): boolean {
		const modelId = this.host.selectedModelName;

		if (!modelId) return false;

		return this.checkModelSupportsThinking(modelId);
	}

	/**
	 * Check if a specific model supports thinking.
	 * Override setting first, then the model name heuristic.
	 */
	checkModelSupportsThinking(modelId: string): boolean {
		if (!modelId) return false;

		const override = this.getOverride(modelId);

		if (override?.thinking !== undefined) return override.thinking;

		return modelNameSupportsThinking(modelId);
	}

	constructor(private host: ModelPropsHost) { }

	/**
	 * Infer modalities for a model from its name and mirror it onto the model
	 * row. No-op if the model already has explicit modalities.
	 */
	async fetchModelProps(modelId: string): Promise<null> {
		if (!modelId) return null;

		if (this.fetching.has(modelId)) return null;

		this.fetching.add(modelId);

		try {
			let changed = false;

			const next = this.host.models.map((model) => {
				if (model.model !== modelId && model.id !== modelId) return model;

				if (model.modalities) return model;

				changed = true;

				return {
					...model,
					modalities: this.buildModalitiesFromName(model.model)
				};
			});

			// Only reassign when a model actually changed. Reassigning to a new
			// array identity every call would recompute activeModelId and
			// re-trigger the caller's effect, creating an infinite loop.
			if (changed) {
				this.host.models = next;
				this.cacheVersion++;
			}
		} finally {
			this.fetching.delete(modelId);
		}

		return null;
	}

	getModelContextSize(_modelId: string): number | null {
		// OpenAI-compatible servers do not expose context size in /v1/models.
		return null;
	}

	getModelModalities(modelId: string): ModelModalities | null {
		const model = this.host.models.find((m) => m.model === modelId || m.id === modelId);
		const base = model?.modalities ?? this.buildModalitiesFromName(modelId);

		// Apply the settings override on top so editing it updates gating live,
		// even when modalities were cached from the name heuristic earlier.
		return this.applyOverride(base, modelId);
	}

	getModelModalitiesArray(modelId: string): ModelModality[] {
		const modalities = this.getModelModalities(modelId);

		if (!modalities) return [];

		const result: ModelModality[] = [];

		if (modalities.vision) result.push(ModelModality.VISION);

		if (modalities.audio) result.push(ModelModality.AUDIO);

		if (modalities.video) result.push(ModelModality.VIDEO);

		return result;
	}

	getModelProps(_modelId: string): null {
		// No /props cache on OpenAI-compatible servers.
		return null;
	}

	isModelPropsFetching(modelId: string): boolean {
		return this.fetching.has(modelId);
	}

	modelSupportsAudio(modelId: string): boolean {
		return this.getModelModalities(modelId)?.audio ?? false;
	}

	modelSupportsVideo(modelId: string): boolean {
		return this.getModelModalities(modelId)?.video ?? false;
	}

	modelSupportsVision(modelId: string): boolean {
		return this.getModelModalities(modelId)?.vision ?? false;
	}

	/**
	 * Update modalities for a specific model from its name.
	 */
	async updateModelModalities(modelId: string): Promise<void> {
		await this.fetchModelProps(modelId);
	}

	/**
	 * Merge override flags over a base modality set. Only flags the override
	 * explicitly sets are applied.
	 */
	private applyOverride(base: ModelModalities, modelId: string): ModelModalities {
		const override = this.getOverride(modelId);

		if (!override) return base;

		return {
			audio: override.audio ?? base.audio,
			video: override.video ?? base.video,
			vision: override.vision ?? base.vision
		};
	}

	private buildModalitiesFromName(modelName: string): ModelModalities {
		return {
			audio: modelNameSupportsAudio(modelName),
			video: modelNameSupportsVideo(modelName),
			vision: modelNameSupportsVision(modelName)
		};
	}

	/**
	 * Read the per-model override from the modelModalityOverrides setting.
	 * Reads settingsStore.config reactively so callers recompute when it changes.
	 */
	private getOverride(modelId: string): ModelModalityOverride | null {
		if (!modelId) return null;

		const raw = settingsStore.config[SETTINGS_KEYS.MODEL_MODALITY_OVERRIDES] as string | undefined;

		return findModalityOverride(modelId, parseModalityOverrides(raw));
	}
}
