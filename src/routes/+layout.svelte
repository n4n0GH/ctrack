<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import '../app.css';
	let { children } = $props();

	const isPath = (path: string) => {
		const cwp = page.url.pathname;
		return path == cwp;
	};
</script>

<div class="mb-20">
	{@render children()}
</div>
<div class="dock dock-lg">
	<button onclick={() => goto('/')} class:dock-active={isPath('/')}>
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

	<button onclick={() => goto('/calories')} class:dock-active={isPath('/calories')}>
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
	<button onclick={() => goto('/weight')} class:dock-active={isPath('/weight')}>
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
	<button onclick={() => goto('/settings')} class:dock-active={isPath('/settings')}>
		<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
			><g fill="currentColor" stroke-linejoin="miter" stroke-linecap="butt"
				><circle
					cx="12"
					cy="12"
					r="3"
					fill="none"
					stroke="currentColor"
					stroke-linecap="square"
					stroke-miterlimit="10"
					stroke-width="2"
				></circle><path
					d="m22,13.25v-2.5l-2.318-.966c-.167-.581-.395-1.135-.682-1.654l.954-2.318-1.768-1.768-2.318.954c-.518-.287-1.073-.515-1.654-.682l-.966-2.318h-2.5l-.966,2.318c-.581.167-1.135.395-1.654.682l-2.318-.954-1.768,1.768.954,2.318c-.287.518-.515,1.073-.682,1.654l-2.318.966v2.5l2.318.966c.167.581.395,1.135.682,1.654l-.954,2.318,1.768,1.768,2.318-.954c.518.287,1.073.515,1.654.682l.966,2.318h2.5l.966-2.318c.581-.167,1.135-.395,1.654-.682l2.318.954,1.768-1.768-.954-2.318c.287-.518.515-1.073.682-1.654l2.318-.966Z"
					fill="none"
					stroke="currentColor"
					stroke-linecap="square"
					stroke-miterlimit="10"
					stroke-width="2"
				></path></g
			></svg
		>
		<span class="dock-label">Settings</span>
	</button>
</div>
