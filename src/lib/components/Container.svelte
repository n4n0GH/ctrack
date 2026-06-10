<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let {
		children,
		title,
		clickable,
		sticky = false
	}: { children?: any; title?: any; clickable?: any; sticky?: boolean } = $props();

	let containerElement: HTMLElement | null = null;
	let placeholderElement: HTMLElement | null = null;
	let isFixed = $state(false);
	let containerTopOffset = 0;
	let resizeObserver: ResizeObserver | null = null;

	function applyFixed() {
		if (!containerElement || !placeholderElement || isFixed) return;

		const rect = containerElement.getBoundingClientRect();
		const style = containerElement.style;

		// Set placeholder to preserve layout space
		placeholderElement.style.height = rect.height + 'px';
		placeholderElement.style.marginTop = getComputedStyle(containerElement).marginTop;
		placeholderElement.style.marginBottom = getComputedStyle(containerElement).marginBottom;

		// Fix container to top of viewport
		style.position = 'fixed';
		style.top = '0px';
		style.left = rect.left + 'px';
		style.width = rect.width + 'px';
		style.zIndex = '50';
		isFixed = true;
	}

	function removeFixed() {
		if (!containerElement || !placeholderElement || !isFixed) return;

		const style = containerElement.style;
		style.position = '';
		style.top = '';
		style.left = '';
		style.width = '';
		style.zIndex = '';

		// Reset placeholder dimensions
		placeholderElement.style.height = '';
		placeholderElement.style.marginTop = '';
		placeholderElement.style.marginBottom = '';

		isFixed = false;
	}

	function onScroll() {
		if (!containerElement) return;

		if (!isFixed && window.scrollY >= containerTopOffset) {
			applyFixed();
		} else if (isFixed && window.scrollY < containerTopOffset) {
			removeFixed();
		}
	}

	function onResize() {
		if (!containerElement || !isFixed) return;

		// Recalculate the fixed position on resize
		const rect = containerElement.getBoundingClientRect();
		containerElement.style.left = rect.left + 'px';
		containerElement.style.width = rect.width + 'px';
	}

	onMount(() => {
		if (!sticky || !containerElement) return;

		// Create placeholder element before the container
		placeholderElement = document.createElement('div');
		containerElement.parentNode?.insertBefore(placeholderElement, containerElement);

		// Calculate the container's top offset from the document
		const rect = containerElement.getBoundingClientRect();
		containerTopOffset = rect.top + window.scrollY;

		// Keep the placeholder in sync with the container's height while fixed. The
		// container's content can change size on its own (e.g. a chart that shrinks
		// on scroll); without this the placeholder would over-reserve space and leave
		// a gap below the fixed header.
		resizeObserver = new ResizeObserver(() => {
			if (isFixed && containerElement && placeholderElement) {
				placeholderElement.style.height = containerElement.getBoundingClientRect().height + 'px';
			}
		});
		resizeObserver.observe(containerElement);

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
	});

	onDestroy(() => {
		if (browser) {
			resizeObserver?.disconnect();
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			// Clean up placeholder if it exists
			if (placeholderElement && placeholderElement.parentNode) {
				placeholderElement.parentNode.removeChild(placeholderElement);
			}
		}
	});
</script>

<div bind:this={containerElement} class="bg-base-200 mb-3 w-full rounded-lg shadow">
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
