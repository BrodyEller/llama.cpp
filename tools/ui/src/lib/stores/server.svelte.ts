/**
 * serverStore - Server connection state
 *
 * Owns the connection state for an OpenAI-compatible server. The server is
 * always treated as multi-model (OpenAI /v1/models), so the legacy MODEL vs
 * ROUTER distinction is collapsed: isRouterMode is always true and
 * isModelMode is always false. Connection health is probed via /v1/models.
 */

import { API_MODELS } from '$lib/constants';
import { ApiError } from '$lib/utils';

const LOADING_RETRY_INTERVAL_MS = 1000;

class ServerStore {
	error = $state<string | null>(null);
	loading = $state(false);
	status = $state<number | null>(null);
	private fetchPromise: Promise<void> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;

	/** OpenAI-compatible servers are always multi-model. */
	get isModelMode(): boolean {
		return false;
	}

	/** OpenAI-compatible servers are always multi-model. */
	get isRouterMode(): boolean {
		return true;
	}

	clear(): void {
		this.clearRetryTimer();
		this.error = null;
		this.status = null;
		this.loading = false;
		this.fetchPromise = null;
	}

	/**
	 * Probe the OpenAI-compatible /v1/models endpoint to confirm the server is
	 * reachable. Sets error/status on failure.
	 *
	 * @param background - Set by the automatic "still loading" poll. Skips the
	 * `loading` flag flip so the UI doesn't bounce between the full loading
	 * splash and the chat screen every retry tick.
	 */
	async fetch({ background = false }: { background?: boolean } = {}): Promise<void> {
		if (this.fetchPromise) return this.fetchPromise;

		this.clearRetryTimer();

		if (!background) {
			this.loading = true;
		}

		// Don't clear an existing "still loading" error before a retry -
		// doing so would unmount/remount the error banner every second.
		if (this.status !== 503) {
			this.error = null;
		}

		const fetchPromise = (async () => {
			try {
				const res = await fetch(API_MODELS.LIST, { headers: { Accept: 'application/json' } });

				if (!res.ok) {
					throw new ApiError(`Server returned HTTP ${res.status}`, res.status);
				}

				this.error = null;
				this.status = null;
			} catch (error: unknown) {
				this.error = error instanceof Error ? error.message : String(error);
				this.status = error instanceof ApiError ? error.status : null;
				console.error('Error connecting to server:', error);

				if (this.status === 503) {
					this.scheduleRetry();
				}
			} finally {
				if (!background) {
					this.loading = false;
				}

				this.fetchPromise = null;
			}
		})();

		this.fetchPromise = fetchPromise;
		await fetchPromise;
	}

	private clearRetryTimer(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
	}

	private scheduleRetry(): void {
		if (this.retryTimer) return;

		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			this.fetch({ background: true });
		}, LOADING_RETRY_INTERVAL_MS);
	}
}

export const serverStore = new ServerStore();
