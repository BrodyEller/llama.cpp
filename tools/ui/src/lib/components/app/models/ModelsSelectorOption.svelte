<script lang="ts">
	import { Heart, HeartOff, Info } from '@lucide/svelte';
	import { ActionIcon, ModelId } from '$lib/components/app';
	import { ICON_CLASS_DEFAULT } from '$lib/constants';
	import { ModelCapability } from '$lib/enums';
	import { modelsStore } from '$lib/stores';
	import type { ModelOption } from '$lib/types/models';

	interface Props {
		option: ModelOption;
		isSelected: boolean;
		isHighlighted: boolean;
		isFav: boolean;
		hideOrgName?: boolean;
		onSelect: (modelId: string) => void;
		onMouseEnter: () => void;
		onKeyDown: (e: KeyboardEvent) => void;
		onInfoClick?: (modelName: string) => void;
	}

	let {
		hideOrgName = false,
		isFav,
		isHighlighted,
		isSelected,
		onInfoClick,
		onKeyDown,
		onMouseEnter,
		onSelect,
		option
	}: Props = $props();

	let modalities = $derived(option.modalities);
	let capabilities = $derived.by(() => ({
		reasoning: modelsStore.props.checkModelSupportsThinking(option.model),
		tools: option.capabilities.includes(ModelCapability.TOOL_USE)
	}));
</script>

<div
	aria-selected={isSelected || isHighlighted}
	class={[
		'group relative flex w-full items-center gap-2 rounded-sm p-2 text-left text-sm transition focus:outline-none',
		'cursor-pointer',
		isSelected && !isHighlighted && 'bg-accent/50',
		isHighlighted && 'bg-accent',
		(isSelected || isHighlighted) && 'text-accent-foreground',
		'hover:bg-accent',
		'focus:bg-accent'
	]}
	onclick={() => onSelect(option.id)}
	onkeydown={onKeyDown}
	onmouseenter={onMouseEnter}
	role="option"
	tabindex="0"
>
	<ModelId
		aliases={option.aliases}
		class="flex-1"
		{hideOrgName}
		{modalities}
		modelId={option.model}
		showRawTooltip
		supportsThinking={capabilities.reasoning}
		supportsToolUse={capabilities.tools}
		tags={option.tags}
	/>

	<div class="flex shrink-0 items-center gap-1">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="pointer-events-none flex items-center justify-center gap-0.75 pl-2 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
			onclick={(e) => e.stopPropagation()}
		>
			{#if isFav}
				<ActionIcon
					class="h-3 w-3 hover:text-foreground"
					icon={HeartOff}
					iconSize="h-2.5 w-2.5"
					onclick={() => modelsStore.toggleFavorite(option.model)}
					tooltip="Remove from favorites"
				/>
			{:else}
				<ActionIcon
					class="h-3 w-3 hover:text-foreground"
					icon={Heart}
					iconSize="h-2.5 w-2.5"
					onclick={() => modelsStore.toggleFavorite(option.model)}
					tooltip="Add to favorites"
				/>
			{/if}

			<!-- info button: only shown when callback is provided -->
			{#if onInfoClick}
				<ActionIcon
					class="h-3 w-3 hover:text-foreground"
					icon={Info}
					iconSize="h-2.5 w-2.5"
					onclick={() => onInfoClick(option.model)}
					tooltip="Model information"
				/>
			{/if}
		</div>

		<div class="flex w-4 items-center justify-center [@media(pointer:coarse)]:w-auto">
			<span
				class="h-2 w-2 rounded-full bg-green-500 group-hover:hidden [@media(pointer:coarse)]:hidden"
			></span>
		</div>
	</div>
</div>
