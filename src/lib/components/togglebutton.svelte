<!--
  @component
  Description: Show/hide toggle button used to reveal optional UI details.

  @author Grace Steinmetz <gesparkles@gmail.com>
  @contributors
  @created 2025-05-30
  @version 1.0.1
  @license MIT
-->
<script lang="ts">
	export let label = 'Details';
	export let show = false;
	export let onToggle: () => void;
</script>

<button
	class="rounded-md border border-purple-300 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-50"
	on:click={onToggle}
>
	{#if show}
		Hide {label}
	{:else}
		Show {label}
	{/if}
</button>
