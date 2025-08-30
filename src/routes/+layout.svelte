<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/ui/Toast.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>


{@render children?.()}
{#if typeof window !== 'undefined'}
	<Toast />
{/if}
