<script lang="ts">
	let {
		children,
		title,
		clickable,
		isSticky
	}: { children?: any; title?: any; clickable?: any; isSticky?: boolean } = $props();
</script>

<div class="bg-base-200 my-3 w-full rounded-lg shadow {isSticky ? 'fixed' : ''}">
	<div class="flex flex-wrap">
		{#if title}
			<p class="my-2 w-full pt-2 text-center text-2xl">{title}</p>
		{/if}
		<div class="flex w-full justify-self-center">
			{#if children}
				{@render children()}
			{:else}
				<p>There's nothing here :)</p>
			{/if}
		</div>
	</div>
	{#if clickable}
		<div class="flex w-full flex-row gap-4 p-2">
			{@render clickable()}
		</div>
	{/if}
</div>
