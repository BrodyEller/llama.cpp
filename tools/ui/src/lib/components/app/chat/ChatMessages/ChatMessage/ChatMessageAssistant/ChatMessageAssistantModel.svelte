<script lang="ts">
	import { ModelBadge, ModelsSelectorDropdown } from '$lib/components/app';
	import { modelsStore } from '$lib/stores';
	import { copyToClipboard } from '$lib/utils';

	interface Props {
		displayedModel: string | null;
		isRouter: boolean;
		isLoading: boolean;
		onRegenerate: (modelOverride?: string) => void;
	}

	let { displayedModel, isLoading, isRouter, onRegenerate }: Props = $props();

	function handleCopyModel() {
		void copyToClipboard(displayedModel ?? '');
	}
</script>

{#if isRouter}
	<ModelsSelectorDropdown
		currentModel={displayedModel}
		disabled={isLoading}
		onModelChange={async (modelId: string, modelName: string) => {
			onRegenerate(modelName);

			return true;
		}}
	/>
{:else}
	<ModelBadge model={displayedModel || undefined} onclick={handleCopyModel} />
{/if}
