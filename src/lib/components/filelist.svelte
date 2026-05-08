<!--
  @component
  Description: Sortable list of selected audio files with drag-and-drop reordering.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors K. Seow <kseow@wisc.edu>
  @created 2025-05-30
  @version 0.2.0
  @license MIT
-->
<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import { asset } from '$app/paths';
	import { isLongDuration } from '$lib/utils/wavHeader';

	/** Ordered list of selected files. `id` is the dnd key; `name` is the filename. */
	export let selectedFiles: { id: string; name: string }[] = [];
	/** Lookup of `filename → duration in seconds`, used for the row's length display. */
	export let audioDurationMap: Record<string, number> = {};
	/** Called when the user clicks Remove on a row. */
	export let removeFile: (name: string) => void;
	/** Called when the user clicks "Remove all" in the header. */
	export let removeAllFiles: () => void;
	/** Handles `consider` and `finalize` from svelte-dnd-action; reordered items in `event.detail.items`. */
	export let handleReorder: (event: CustomEvent) => void;
</script>

{#if selectedFiles.length > 0}
	<div class="mt-6">
		<div class="mb-2 flex items-center justify-between">
			<h3
				class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
			>
				Selected File{selectedFiles.length === 1 ? '' : 's'}
			</h3>
			<button
				type="button"
				aria-label="Remove all selected files"
				class="rounded-md border border-red-500 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
				on:click={removeAllFiles}
			>
				Remove all
			</button>
		</div>

		<ul
			use:dndzone={{
				items: selectedFiles,
				flipDurationMs: 200
			}}
			on:consider={handleReorder}
			on:finalize={handleReorder}
			class="space-y-3"
		>
			{#each selectedFiles as file (file.id)}
				<li
					class="flex cursor-move items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition hover:shadow-md"
				>
					<div class="flex items-center gap-2 overflow-hidden">
						<img
							src={asset('/icons/draggingarrowvertical.svg')}
							alt=""
							aria-hidden="true"
							class="h-4 w-4 opacity-60 transition group-hover:opacity-100"
						/>
						<p class="truncate text-sm font-medium text-gray-800">{file.name}</p>
					</div>

					<div class="flex flex-shrink-0 items-center gap-2">
						{#if isLongDuration(audioDurationMap[file.name])}
							<span
								class="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
								title="Files longer than 1 hour take noticeably longer to process."
							>
								Long file
							</span>
						{/if}
						<span class="text-xs tabular-nums text-gray-500">
							{audioDurationMap[file.name]?.toFixed(2) ?? '--'}s
						</span>
						<button
							type="button"
							aria-label={`Remove ${file.name}`}
							class="ml-2 text-xs font-medium text-red-500 transition hover:text-red-800"
							on:click={() => removeFile(file.name)}
						>
							Remove
						</button>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/if}
