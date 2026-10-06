/**
 * ModelStatusManager - No-op load/unload status
 *
 * On an OpenAI-compatible server there is no model load/unload lifecycle and
 * no /models/sse status feed. This manager keeps the same public surface as
 * the llama.cpp version so UI components that reference it continue to work,
 * but every operation is a no-op and there is never any load progress.
 */

import type { ModelPropsManager } from '$lib/stores/models/props.svelte';

/**
 * The slice of modelsStore the manager drives. Kept narrow on purpose so it
 * cannot reach around the host's full surface; modelsStore implements this
 * structurally.
 */
export interface ModelStatusHost {
	error: string | null;
	readonly props: ModelPropsManager;
	isModelLoaded(modelId: string): boolean;
	toDisplayName(id: string): string;
}

export class ModelStatusManager {
	constructor(private host: ModelStatusHost) {}

	/**
	 * Cancel a download / remove a cached model. No-op on an OpenAI-compatible
	 * server, which has no download pipeline.
	 */
	async cancelDownload(_repoWithTag: string): Promise<boolean> {
		return false;
	}

	async ensureLoaded(modelId: string): Promise<void> {
		// No-op: all models are always available on an OpenAI-compatible server.
	}

	/**
	 * Current load progress for a model, or null when not loading.
	 */
	getLoadProgress(modelId: string): ModelLoadProgress | null {
		return null;
	}

	isOperationInProgress(modelId: string): boolean {
		return false;
	}

	async load(modelId: string): Promise<void> {
		// No-op: models are not loaded/unloaded on an OpenAI-compatible server.
	}

	/**
	 * Open the /models/sse feed. No-op on an OpenAI-compatible server.
	 */
	subscribe(): void {
		// No-op.
	}

	async unload(modelId: string): Promise<void> {
		// No-op: models are not loaded/unloaded on an OpenAI-compatible server.
	}

	/**
	 * Close the /models/sse feed. No-op on an OpenAI-compatible server.
	 */
	unsubscribe(): void {
		// No-op.
	}
}
