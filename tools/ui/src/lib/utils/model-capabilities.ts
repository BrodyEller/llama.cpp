/**
 * Model capability detection from model names.
 *
 * OpenAI-compatible servers (vLLM, Ollama, LM Studio, etc.) do not advertise
 * vision/audio/video capabilities in /v1/models. The only signal available is
 * the model name itself, so we infer modalities from common naming patterns.
 *
 * A configurable per-model capability map (settings) can override these
 * heuristics; see settingsStore for the override source.
 */

const VISION_PATTERNS = [
	/\bvision\b/i,
	/\bvl\b/i,
	/\bvlm\b/i,
	/\bllava\b/i,
	/\bqwen[0-9.]*-vl\b/i,
	/\bphi-?3-?vision\b/i,
	/\bpixtral\b/i,
	/\bidefics\b/i,
	/\bmoondream\b/i,
	/\bminicpm-?v\b/i,
	/\bgemma[0-9.]*-?vision\b/i,
	/\binternvl\b/i,
	/\bdeepseek-?vl\b/i
];

const AUDIO_PATTERNS = [
	/\baudio\b/i,
	/\bwhisper\b/i,
	/\bqwen[0-9.]*-?audio\b/i,
	/\bultravox\b/i,
	/\bomni\b/i,
	/\bspeech\b/i,
	/\btranscri\b/i
];

const VIDEO_PATTERNS = [
	/\bvideo\b/i,
	/\bvl\b/i,
	/\bvlm\b/i,
	/\bqwen[0-9.]*-vl\b/i,
	/\bllava\b/i,
	/\bomni\b/i
];

const THINKING_PATTERNS = [
	/\bthinking\b/i,
	/\breason\b/i,
	/\br1\b/i,
	/\bqwq\b/i,
	/\bdeepseek-?r1\b/i,
	/\bkimi-?k2-?thinking\b/i,
	/\bnemotron\b/i
];

function matchesAny(name: string, patterns: RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(name));
}

/** Per-model capability override, from the modelModalityOverrides setting. */
export interface ModelModalityOverride {
	audio?: boolean;
	thinking?: boolean;
	video?: boolean;
	vision?: boolean;
}

/**
 * Parse the modelModalityOverrides setting (a JSON map of model name patterns
 * to capability flags). Returns {} on missing or invalid input.
 */
export function parseModalityOverrides(raw?: string): Record<string, ModelModalityOverride> {
	if (!raw || !raw.trim()) return {};

	try {
		const parsed = JSON.parse(raw);

		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, ModelModalityOverride>;
		}

		console.warn('[model-capabilities] model modality overrides must be a JSON object');
	} catch {
		console.warn('[model-capabilities] invalid model modality overrides JSON');
	}

	return {};
}

/**
 * Find the override entry whose key is a case-insensitive substring of the
 * model id. First match wins.
 */
export function findModalityOverride(
	modelName: string,
	overrides: Record<string, ModelModalityOverride>
): ModelModalityOverride | null {
	const lower = modelName.toLowerCase();

	for (const [pattern, value] of Object.entries(overrides)) {
		if (!value || typeof value !== 'object') continue;

		if (pattern && lower.includes(pattern.toLowerCase())) return value;
	}

	return null;
}

/**
 * Infer whether a model supports vision from its name.
 */
export function modelNameSupportsVision(modelName: string): boolean {
	return matchesAny(modelName, VISION_PATTERNS);
}

/**
 * Infer whether a model supports audio from its name.
 */
export function modelNameSupportsAudio(modelName: string): boolean {
	return matchesAny(modelName, AUDIO_PATTERNS);
}

/**
 * Infer whether a model supports video from its name.
 */
export function modelNameSupportsVideo(modelName: string): boolean {
	return matchesAny(modelName, VIDEO_PATTERNS);
}

/**
 * Infer whether a model supports thinking/reasoning from its name.
 */
export function modelNameSupportsThinking(modelName: string): boolean {
	return matchesAny(modelName, THINKING_PATTERNS);
}
