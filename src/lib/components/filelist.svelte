<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';

	export let selectedFiles: { id: string; name: string }[] = [];
	export let audioDurationMap: Record<string, number> = {};
	export let removeFile: (name: string) => void;
	export let handleReorder: (event: CustomEvent) => void;
</script>

{#if selectedFiles.length > 0}
	<div class="mt-6">
		<h3
			class="animate-fade-in bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-lg font-bold text-transparent"
		>
			Selected Files
		</h3>

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
							src="/icons/draggingarrowvertical.svg"
							alt="Drag Icon"
							class="h-4 w-4 opacity-60 transition group-hover:opacity-100"
						/>
						<p class="truncate text-sm font-medium text-gray-800">{file.name}</p>
					</div>

					<div class="flex flex-shrink-0 items-center gap-2">
						<span class="text-xs tabular-nums text-gray-500">
							{audioDurationMap[file.name]?.toFixed(2) ?? '--'}s
						</span>
						<button
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
