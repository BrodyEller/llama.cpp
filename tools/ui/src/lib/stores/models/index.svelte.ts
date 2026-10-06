/**
 * modelsStore - Model management for OpenAI-compatible servers
 *
 * Owns the model list, selection and favorites. Modalities and thinking
 * detection are inferred from model names via {@link ModelPropsManager}.
 * No load/unload or /models/sse status feed (llama.cpp-specific).
 */

import { FAVORITE_MODELS_LOCALSTORAGE_KEY } from '$lib/constants';
import { ModelsService } from '$lib/services/models.service';
// direct imports between stores, not via the barrel, to avoid circular deps
import { conversationsStore } from '$lib/stores/conversations/index.svelte';
import { type ModelPropsHost, ModelPropsManager } from '$lib/stores/models/props.svelte';
import { type ModelStatusHost, ModelStatusManager } from '$lib/stores/models/status.svelte';
import { serverStore } from '$lib/stores/server.svelte';
import { getConversationModel } from '$lib/utils/conversation-utils';
import { SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

class ModelsStore implements ModelPropsHost, ModelStatusHost {
	error = $state<string | null>(null);
	favoriteModelIds = $state<Set<string>>(this.loadFavoritesFromStorage());
	loading = $state(false);
	models = $state<ModelOption[]>([]);
	selectedModelId = $state<string | null>(null);
	selectedModelName = $state<string | null>(null);

	updating = $state(false);

	/** Per-model modality and thinking detection, composed here. */
	private _props = new ModelPropsManager(this);

	/** No-op load/unload status manager, kept for UI compatibility. */
	private _status = new ModelStatusManager(this);

	// Dedup concurrent fetch() callers — all awaiters share the same inflight promise.
	// Without this, ?model=<name> URL handler races an in-progress fetch and sees an empty list.
	private inflightFetch: Promise<void> | null = null;

	/**
	 * Model the active conversation view resolves to. The user's selection
	 * first, then the conversation's own model.
	 */
	get activeModelId(): string | null {
		if (this.selectedModelId) {
			const selected = this.models.find((m) => m.id === this.selectedModelId);

			if (selected) return selected.model;
		}

		const conversationModel = getConversationModel(conversationsStore.activeMessages);

		if (conversationModel) {
			const model = this.models.find((m) => m.model === conversationModel);

			if (model) return model.model;
		}

		return null;
	}

	get props() {
		return this._props;
	}

	get status() {
		return this._status;
	}

	get selectedModel(): ModelOption | null {
		if (!this.selectedModelId) return null;

		return this.models.find((m) => m.id === this.selectedModelId) ?? null;
	}

	get selectedModelContextSize(): number | null {
		if (!this.selectedModelName) return null;

		return this.props.getModelContextSize(this.selectedModelName);
	}

	/**
	 * Single model name is not meaningful on a multi-model OpenAI server.
	 */
	get singleModelName(): string | null {
		return null;
	}

	clearSelection(): void {
		this.selectedModelId = null;
		this.selectedModelName = null;
	}

	/**
	 * Auto-selects the first available model if none is selected.
	 * Prioritizes the model from the active conversation's last assistant
	 * response, then a favorite, then the first available model.
	 */
	async ensureFirstModelSelected(): Promise<void> {
		if (this.selectedModelName) return;

		const availableModels = this.getVisibleModels();

		if (availableModels.length === 0) return;

		// Try to select model from last assistant response first
		const lastModel = this.getModelFromLastAssistantResponse();

		if (lastModel) {
			const lastModelOption = availableModels.find((m) => m.model === lastModel);

			if (lastModelOption) {
				await this.selectModelById(lastModelOption.id);
				await this.props.fetchModelProps(lastModel);

				return;
			}
		}

		// Try a favorite model
		const favorite = this.favoriteModelIds.values().next()?.value;

		if (favorite) {
			await this.selectModelById(favorite);

			return;
		}

		// Fall back to the first available model
		await this.selectModelById(availableModels[0].id);
	}

	/**
	 * Fetch list of models from the OpenAI-compatible /v1/models endpoint.
	 */
	async fetch(force = false): Promise<void> {
		if (this.inflightFetch) return this.inflightFetch;

		if (this.models.length > 0 && !force) return;

		this.inflightFetch = this.runFetch();
		try {
			await this.inflightFetch;
		} finally {
			this.inflightFetch = null;
		}
	}

	findModelById(modelId: string): ModelOption | null {
		return this.models.find((model) => model.id === modelId) ?? null;
	}

	findModelByName(modelName: string): ModelOption | null {
		return (
			this.models.find(
				(model) =>
					model.model === modelName || model.id === modelName || model.aliases?.includes(modelName)
			) ?? null
		);
	}

	/**
	 * Gets the model name from the last assistant message in the active conversation.
	 * Used by both the chat page and settings page to maintain model consistency.
	 */
	getModelFromLastAssistantResponse(): string | null {
		const messages = conversationsStore.activeMessages;

		if (!messages || messages.length === 0) return null;

		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].model) {
				return messages[i].model;
			}
		}

		return null;
	}

	hasModel(modelName: string): boolean {
		return this.models.some((model) => model.model === modelName);
	}

	isFavorite(modelId: string): boolean {
		return this.favoriteModelIds.has(modelId);
	}

	/**
	 * On an OpenAI-compatible server all listed models are available, so a
	 * model is always considered loaded.
	 */
	isModelLoaded(modelId: string): boolean {
		return this.models.some((m) => m.model === modelId || m.id === modelId);
	}

	async selectModelById(modelId: string): Promise<void> {
		if (!modelId || this.updating) return;

		if (this.selectedModelId === modelId) return;

		const option = this.models.find((model) => model.id === modelId);

		if (!option) throw new Error('Selected model is not available');

		this.updating = true;
		this.error = null;

		try {
			this.selectedModelId = option.id;
			this.selectedModelName = option.model;
		} finally {
			this.updating = false;
		}
	}

	/**
	 * Select a model by its model name (used for syncing with conversation model).
	 */
	selectModelByName(modelName: string): void {
		const option = this.models.find((model) => model.model === modelName);

		if (option) {
			this.selectedModelId = option.id;
			this.selectedModelName = option.model;
		}
	}

	/**
	 * Auto-selects the model from the last assistant response if available.
	 * Returns true if a model was selected, false otherwise.
	 */
	async selectModelFromLastAssistantResponse(): Promise<boolean> {
		const lastModel = this.getModelFromLastAssistantResponse();

		if (!lastModel || this.selectedModelName === lastModel) return false;

		const matchingModel = this.models.find((option) => option.model === lastModel);

		if (!matchingModel) return false;

		try {
			await this.selectModelById(matchingModel.id);
			console.log(`[modelsStore] Automatically selected model: ${lastModel} from last message`);

			return true;
		} catch (error) {
			console.warn('[modelsStore] Failed to automatically select model from last message:', error);

			return false;
		}
	}

	toDisplayName(id: string): string {
		const segments = id.split(/\\|\//);
		const candidate = segments.pop();

		return candidate && candidate.trim().length > 0 ? candidate : id;
	}

	toggleFavorite(modelId: string): void {
		const next = new SvelteSet(this.favoriteModelIds);

		if (next.has(modelId)) {
			next.delete(modelId);
		} else {
			next.add(modelId);
		}

		this.favoriteModelIds = next;

		try {
			localStorage.setItem(FAVORITE_MODELS_LOCALSTORAGE_KEY, JSON.stringify([...next]));
		} catch {
			toast.error('Failed to save favorite models to local storage');
		}
	}

	/**
	 * Build ModelOption[] from an OpenAI-compatible /v1/models response.
	 */
	private buildModelOptions(response: ApiModelsListResponse): ModelOption[] {
		return response.data.map((item: ApiModelDataEntry) => {
			const displayNameSource = item.name && item.name.trim().length > 0 ? item.name : item.id;
			const modelId = item.id;

			return {
				aliases: item.aliases ?? [],
				capabilities: item.capabilities ?? [],
				description: item.description,
				details: item.details,
				id: item.id,
				meta: item.meta ?? null,
				modalities: this.props.getModelModalities(modelId),
				model: modelId,
				name: this.toDisplayName(displayNameSource),
				tags: item.tags ?? []
			};
		});
	}

	/**
	 * Filter to models visible in the UI. On an OpenAI-compatible server all
	 * models are visible.
	 */
	private getVisibleModels(): ModelOption[] {
		return this.models;
	}

	private loadFavoritesFromStorage(): Set<string> {
		try {
			const raw = localStorage.getItem(FAVORITE_MODELS_LOCALSTORAGE_KEY);

			return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
		} catch {
			toast.error('Failed to load favorite models from local storage');

			return new Set();
		}
	}

	private async runFetch(): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			await serverStore.fetch();

			const response = await ModelsService.list();

			this.models = this.buildModelOptions(response);

			// Infer modalities for each model from its name.
			for (const model of this.models) {
				await this.props.fetchModelProps(model.model);
			}

			const visible = this.getVisibleModels();

			if (visible.length === 1) {
				this.selectModelById(visible[0].id);
			}
		} catch (error) {
			this.models = [];
			this.error = error instanceof Error ? error.message : 'Failed to load models';

			throw error;
		} finally {
			this.loading = false;
		}
	}
}

export const modelsStore = new ModelsStore();
