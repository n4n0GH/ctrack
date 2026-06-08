<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { flushOutbox } from '$lib/middleware/storage';

	import '../app.css';
	let { children } = $props();

	// On each fresh page load, retry any calorie/weight writes that previously
	// failed to reach Firebase (quota exceeded / offline). Runs in the background
	// so it never blocks rendering, and never throws.
	onMount(() => {
		flushOutbox().catch(() => {});
	});

	const routes = ['/', '/calories', '/weight', '/settings'];
	let direction = $state(1);

	let navigating = $state(false);

	const navigate = (path: string) => {
		if (navigating) return;

		const currentIndex = routes.indexOf(page.url.pathname);
		const targetIndex = routes.indexOf(path);

		if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
			direction = targetIndex > currentIndex ? 1 : -1;
		}

		navigating = true;
		goto(path).finally(() => {
			navigating = false;
		});
	};

	const isPath = (path: string) => {
		const cwp = page.url.pathname;
		return path == cwp;
	};
</script>

<div class="transition-container">
	{#key page.url.pathname}
		<div
			class="transition-content"
			in:fly={{ duration: 250, x: direction * 100 }}
			out:fly={{ duration: 250, x: direction * -100 }}
		>
			{@render children()}
		</div>
	{/key}
</div>
<div class="dock dock-lg">
	<button onclick={() => navigate('/')} class:dock-active={isPath('/')}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="size-6"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
			/>
		</svg>

		<span class="dock-label">Overview</span>
	</button>

	<button onclick={() => navigate('/calories')} class:dock-active={isPath('/calories')}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="size-6"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
			/>
		</svg>

		<span class="dock-label">Calories</span>
	</button>
	<button onclick={() => navigate('/weight')} class:dock-active={isPath('/weight')}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="size-6"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
			/>
		</svg>

		<span class="dock-label">Weight</span>
	</button>
	<button onclick={() => navigate('/settings')} class:dock-active={isPath('/settings')}>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="size-6"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
			/>
		</svg>

		<span class="dock-label">Settings</span>
	</button>
</div>

<style>
	.transition-container {
		position: relative;
		min-height: calc(100vh - 180px);
	}

	.transition-content {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
	}
</style>
