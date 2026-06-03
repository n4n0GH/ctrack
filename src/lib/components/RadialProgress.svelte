<script lang="ts">
	let { color = 0, percentage = 0 } = $props();

	const ringColor = ['text-emerald-500', 'text-amber-500', 'text-rose-500'];
	const sanitizedPercentage = $derived(Math.floor(percentage));
</script>

<div
	class="radial-progress bg-base-200 hidden border-t-1 border-l-1 border-black/15 md:grid {ringColor[
		color
	]}"
	style="--value:{sanitizedPercentage}; --size:12rem; --thickness:1.2rem"
	aria-valuenow={sanitizedPercentage}
	role="progressbar"
>
	<div
		class="bg-base-100 radial-progress text-base-100 hidden border-t-1 border-l-1 border-white/15 md:grid"
		style="--value:100; --size:9.6rem; --thickness:1rem"
		aria-valuenow="100"
		role="progressbar"
	>
		<span class={ringColor[color]}>{sanitizedPercentage}%</span>
	</div>
</div>

<div
	class="radial-progress bg-base-200 border-t-1 border-l-1 border-black/15 sm:grid md:hidden {ringColor[
		color
	]}"
	style="--value:{sanitizedPercentage}; --size:7rem; --thickness:0.8rem"
	aria-valuenow={sanitizedPercentage}
	role="progressbar"
>
	<div
		class="bg-base-100 radial-progress text-base-100 border-t-1 border-l-1 border-white/15 sm:grid md:hidden"
		style="--value:100; --size:5.3rem; --thickness:1rem"
		aria-valuenow="100"
		role="progressbar"
	>
		<span class={ringColor[color]}>{sanitizedPercentage}%</span>
	</div>
</div>
