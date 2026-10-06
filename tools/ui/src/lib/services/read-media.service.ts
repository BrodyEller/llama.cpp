/**
 * ReadMediaService - Reads local media files for the read_media tool
 *
 * On an OpenAI-compatible server there is no server-side read_file tool, so
 * this service cannot read arbitrary server files. It returns an error
 * gracefully. No reactive state; consumed by toolsStore.
 */

import {
	FILE_EXTENSION_SEPARATOR,
	FILE_PATH_SEPARATOR_REGEX,
	NEWLINE,
	PREFIX_FILE,
	PREFIX_MIME,
	PREFIX_SIZE,
	READ_MEDIA_AUDIO_MIME,
	READ_MEDIA_IMAGE_MIME
} from '$lib/constants';
import type { ToolExecutionResult } from '$lib/types';

/** Modalities of the model the tool call runs for. */
export interface ReadMediaCapabilities {
	audio: boolean;
	vision: boolean;
}

/** Lowercase extension of a path, without the dot. Empty when the file name has none. */
function fileExtension(path: string): string {
	const name = path.split(FILE_PATH_SEPARATOR_REGEX).pop() ?? '';
	const dot = name.lastIndexOf(FILE_EXTENSION_SEPARATOR);

	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * **ReadMediaService** - browser executor for the `read_media` tool
 *
 * The tool is synthetic: no such tool exists on the server. On an
 * OpenAI-compatible server there is no server-side read_file tool, so this
 * returns an error. The agentic store lifts the result into an image or audio
 * attachment on the tool result message.
 *
 * @see buildReadMediaToolDefinition in constants/read-media.ts - tool schema sent to the LLM
 * @see agenticStore in stores/agentic/index.svelte.ts - tool dispatch and attachment extraction
 */
export class ReadMediaService {
	static async executeTool(
		params: Record<string, unknown>,
		capabilities: ReadMediaCapabilities,
		signal?: AbortSignal,
		cwd?: string
	): Promise<ToolExecutionResult> {
		const path = typeof params.path === 'string' ? params.path : '';

		if (!path) {
			return { content: 'Error: missing "path" argument.', isError: true };
		}

		const extension = fileExtension(path);
		const imageMime = READ_MEDIA_IMAGE_MIME[extension];
		const audioMime = READ_MEDIA_AUDIO_MIME[extension];

		let resolvedMime: string | undefined;

		if (imageMime && capabilities.vision) resolvedMime = imageMime;
		else if (audioMime && capabilities.audio) resolvedMime = audioMime;

		if (!resolvedMime) {
			const supported = [
				...(capabilities.vision ? Object.keys(READ_MEDIA_IMAGE_MIME) : []),
				...(capabilities.audio ? Object.keys(READ_MEDIA_AUDIO_MIME) : [])
			];
			// an unreadable-by-this-model file is a dead end, so say why instead of failing silently
			const reason =
				imageMime || audioMime
					? `the current model cannot perceive ".${extension}" files`
					: `".${extension}" is not a supported media type`;

			return {
				content: `Error: ${reason}. Supported: ${supported.join(', ')}.`,
				isError: true
			};
		}

		// No server-side read_file tool on an OpenAI-compatible server.
		return {
			content: `Error: cannot read "${path}" - server-side file access is not available on this server.`,
			isError: true
		};
	}
}
