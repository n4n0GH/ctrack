<script lang="ts">
	let { children, title, clickable }: { children: any; title?: any; clickable?: boolean } =
		$props();
</script>

<div class="bg-base-200 my-3 flex w-full flex-wrap rounded-lg shadow">
	{#if title}
		<p class="my-2 w-full pt-2 text-2xl">{title}</p>
	{/if}
	<div class="flex w-full items-center justify-center justify-self-center">
		{#if children}
			{@render children()}
		{:else}
			<p>There's nothing here :)</p>
		{/if}
	</div>
</div>
