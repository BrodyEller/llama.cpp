<script lang="ts">
	import { ActionIconCopyToClipboard, BadgesModality } from '$lib/components/app';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import { modelsStore } from '$lib/stores';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		// when set, show info for this model
		modelId?: string | null;
	}

	let { modelId = null, onOpenChange, open = $bindable() }: Props = $props();

	let modelName = $derived(modelId ?? modelsStore.selectedModelName ?? modelsStore.singleModelName);
	let models = $derived(modelsStore.models);
	let isLoadingModels = $derived(modelsStore.loading);

	// find the model option matching modelId, or the selected model
	let firstModel = $derived.by(() => {
		if (modelId) {
			return models.find((m) => m.model === modelId || m.id === modelId) ?? null;
		}

		return models.find((m) => m.model === modelsStore.selectedModelName) ?? models[0] ?? null;
	});

	// Get modalities from modelStore using the model ID from the first model
	let modalities = $derived.by(() => {
		if (!firstModel?.id) return [];

		return modelsStore.props.getModelModalitiesArray(firstModel.id);
	});

	// Ensure models are fetched when dialog opens
	$effect(() => {
		if (open && models.length === 0) {
			modelsStore.fetch();
		}
	});
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content
		class="z-9999 max-md:h-[100dvh]! max-md:w-screen! max-md:max-w-none! md:w-[calc(100vw-4rem)]! md:max-w-[60rem]! md:max-h-[80dvh]!"
	>
		<!-- sticky header holds only the close button; the title scrolls with the body -->
		<Dialog.Header />

		<div class="min-w-0 space-y-6 md:py-4 -mt-4! md:mt-0 pb-4">
			<div class="min-w-0 space-y-2">
				<Dialog.Title>Model Information</Dialog.Title>

				<Dialog.Description>Current model details and capabilities</Dialog.Description>
			</div>

			{#if isLoadingModels}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">Loading model information...</div>
				</div>
			{:else if firstModel}
				{@const modelMeta = firstModel.meta}

				<!-- Desktop: fixed-layout table, long values scroll inside their cell -->
				<Table.Root class="hidden table-fixed md:table">
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-[10rem]">Model</Table.Head>

							<Table.Head>
								<div class="flex min-w-0 items-center gap-2">
									<span class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
										{modelName}
									</span>

									<ActionIconCopyToClipboard
										ariaLabel="Copy model name to clipboard"
										canCopy={!!modelName}
										text={modelName || ''}
									/>
								</div>
							</Table.Head>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						<!-- Model ID -->
						<Table.Row>
							<Table.Cell class="h-10 align-middle font-medium">Model ID</Table.Cell>

							<Table.Cell class="h-10 align-middle font-mono text-xs">
								<div class="flex min-w-0 items-center gap-2">
									<span class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
										{firstModel.id}
									</span>

									<ActionIconCopyToClipboard
										ariaLabel="Copy model id to clipboard"
										text={firstModel.id}
									/>
								</div>
							</Table.Cell>
						</Table.Row>

						<!-- Description -->
						{#if firstModel.description}
							<Table.Row>
								<Table.Cell class="h-10 align-middle font-medium">Description</Table.Cell>

								<Table.Cell class="h-10 align-middle">{firstModel.description}</Table.Cell>
							</Table.Row>
						{/if}

						<!-- Capabilities -->
						{#if firstModel.capabilities?.length}
							<Table.Row>
								<Table.Cell class="h-10 align-middle font-medium">Capabilities</Table.Cell>

								<Table.Cell class="h-10 align-middle">
									<div class="flex flex-wrap gap-1">
										{#each firstModel.capabilities as cap}
											<span class="rounded bg-muted px-2 py-0.5 text-xs">{cap}</span>
										{/each}
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}

						<!-- Modalities -->
						{#if modalities.length > 0}
							<Table.Row>
								<Table.Cell class="align-middle font-medium">Modalities</Table.Cell>

								<Table.Cell>
									<div class="flex flex-wrap gap-1">
										<BadgesModality {modalities} />
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>

					<!-- Mobile: stacked layout; long values wrap instead of scrolling the page -->
					<div class="flex min-w-0 flex-col gap-4 md:hidden">
						<div class="min-w-0 space-y-1">
							<div class="text-xs font-medium text-muted-foreground">Model</div>

							<div class="flex min-w-0 items-start gap-2">
								<span class="min-w-0 flex-1 break-all font-mono text-xs">{modelName}</span>

								<ActionIconCopyToClipboard
									ariaLabel="Copy model name to clipboard"
									canCopy={!!modelName}
									text={modelName || ''}
								/>
							</div>
						</div>

						<div class="min-w-0 space-y-1">
							<div class="text-xs font-medium text-muted-foreground">Model ID</div>

							<div class="flex min-w-0 items-start gap-2">
								<span class="min-w-0 flex-1 break-all font-mono text-xs">{firstModel.id}</span>

								<ActionIconCopyToClipboard
									ariaLabel="Copy model id to clipboard"
									text={firstModel.id}
								/>
							</div>
						</div>

						{#if firstModel.description}
							{@render infoRow('Description', firstModel.description)}
						{/if}

						{#if firstModel.capabilities?.length}
							<div class="min-w-0 space-y-1">
								<div class="text-xs font-medium text-muted-foreground">Capabilities</div>

								<div class="flex flex-wrap gap-1">
									{#each firstModel.capabilities as cap}
										<span class="rounded bg-muted px-2 py-0.5 text-xs">{cap}</span>
									{/each}
								</div>
							</div>
						{/if}

						{#if modalities.length > 0}
							<div class="min-w-0 space-y-1">
								<div class="text-xs font-medium text-muted-foreground">Modalities</div>

								<div class="flex flex-wrap gap-1">
									<BadgesModality {modalities} />
								</div>
							</div>
						{/if}
					</div>
			{:else if !isLoadingModels}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">No model information available</div>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

{#snippet infoRow(label: string, value: string, valueClass: string = '')}
	<div class="flex items-center justify-between gap-3">
		<span class="shrink-0 text-xs font-medium text-muted-foreground {valueClass}">{label}</span>

		<span class="text-sm {valueClass}">{value}</span>
	</div>
{/snippet}
