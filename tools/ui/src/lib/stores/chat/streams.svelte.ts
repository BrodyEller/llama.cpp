/**
 * ChatStreamManager - No-op stream session manager
 *
 * On an OpenAI-compatible server there is no server-side resumable stream
 * feature (no /v1/stream, no /v1/streams/lookup). This manager keeps the same
 * public surface as the llama.cpp version so chatStore continues to work, but
 * every operation is a no-op.
 */

import type { ChatActivityStore } from '$lib/stores/chat/activity.svelte';
import type { ChatProcessingStore } from '$lib/stores/chat/processing.svelte';
import type { StreamConnectionState } from '$lib/enums';
import { SvelteMap } from 'svelte/reactivity';

/**
 * The slice of chatStore the manager drives. Kept narrow on purpose so the
 * manager cannot reach around the host's full surface; chatStore implements
 * this structurally.
 */
export interface ChatStreamHost {
	activity: ChatActivityStore;
	processing: ChatProcessingStore;
	chatStreamingStates: SvelteMap<
		string,
		{ response: string; messageId: string; model?: string | null }
	>;
	streamConnectionState: StreamConnectionState;
	getOrCreateAbortController(convId: string): AbortController;
	setChatLoading(convId: string, loading: boolean): void;
	setChatStreaming(
		convId: string,
		response: string,
		messageId: string,
		model?: string | null
	): void;
	clearChatStreaming(convId: string, messageId?: string): void;
}

export class ChatStreamManager {
	/** Kill a pending resume retry. No-op on an OpenAI-compatible server. */
	cancelResumeRetry(convId: string): void {
		// No-op.
	}

	constructor(private host: ChatStreamHost) {}

	async discoverActiveStream(convId: string): Promise<void> {
		// No-op: no server-side resumable streams on an OpenAI-compatible server.
	}

	/**
	 * Model frozen at send time for a stream awaiting resume. No-op.
	 */
	getResumeModel(convId: string): string | null {
		return null;
	}

	/**
	 * Resync the activity ledger's remote set. No-op.
	 */
	async syncRemoteRunningStreams(): Promise<void> {
		// No-op.
	}
}
