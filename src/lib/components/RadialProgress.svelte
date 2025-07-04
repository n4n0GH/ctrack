<script lang="ts">
	let { color = 0, percentage = 0 } = $props();

	const ringColor = ['text-emerald-500', 'text-amber-500', 'text-rose-500'];
	const sanitizedPercentage = Math.floor(percentage);
</script>

<div
	class="radial-progress hidden md:grid {ringColor[color]}"
	style="--value:{sanitizedPercentage}; --size:12rem; --thickness:1.2rem"
	aria-valuenow={sanitizedPercentage}
	role="progressbar"
>
	{sanitizedPercentage}%
</div>

<div
	class="radial-progress sm:grid md:hidden {ringColor[color]}"
	style="--value:{sanitizedPercentage}; --size:7rem; --thickness:0.8rem"
	aria-valuenow={sanitizedPercentage}
	role="progressbar"
>
	{sanitizedPercentage}%
</div>
