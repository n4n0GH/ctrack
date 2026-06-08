<script lang="ts">
	import { getFbTime } from '$lib/middleware/storage';
	import { timePadding, getIsoDate, getStampedDate } from '$lib/scripts/helpers';
	import { settings } from '$lib/state/settings.svelte';
	import { userWeights } from '$lib/state/weight.svelte';
	import { Update } from '$lib/scripts/dataInit';

	let weightValue = $derived(settings.currentWeight);
	let submitError = $state('');
	// slice() so we don't mutate the shared reactive array; the list may be empty
	// (no weight history yet, or Firebase unreachable), so guard every read.
	let latestWeight = $derived(
		userWeights.slice().sort((a, b) => b.date.seconds - a.date.seconds)[0]
	);
	let visceralValue = $derived(latestWeight?.visceral ?? 0);
	let bodyfatValue = $derived(latestWeight?.fat ?? 0);
	let muscleValue = $derived(latestWeight?.muscle ?? 0);
	let date = $state(getIsoDate().split('T')[0]);
	let time = $state(
		timePadding(new Date().getHours()) + ':' + timePadding(new Date().getMinutes())
	);

	const pushTo = new Update();

	const createWeightItem = () => {
		return {
			weight: weightValue,
			date: {
				seconds: getFbTime(getStampedDate(date, time)).seconds,
				nanoseconds: getFbTime(getStampedDate(date, time)).nanoseconds
			},
			fat: bodyfatValue,
			visceral: visceralValue,
			muscle: muscleValue
		};
	};

	const addWeightData = async () => {
		const result = await pushTo.weight(createWeightItem());
		if (result.success) {
			(document.getElementById('weightUpdateModal') as HTMLDialogElement)?.close();
		} else {
			submitError = 'Failed to submit weight data. Please try again.';
		}
	};
</script>

<div class="border-base-300 bg-base-100 flex flex-col gap-3">
	<label class="input w-full"
		>Weight
		<input type="number" class="grow" placeholder="0" bind:value={weightValue} />
		<span class="badge badge-neutral badge-xs">KG</span>
	</label>
	<label class="input w-full"
		>Muscle Mass
		<input type="number" class="grow" placeholder="0" bind:value={muscleValue} />
		<span class="badge badge-neutral badge-xs">%</span>
	</label>
	<label class="input w-full"
		>Body Fat
		<input type="number" class="grow" placeholder="0" bind:value={bodyfatValue} />
		<span class="badge badge-neutral badge-xs">%</span>
	</label>
	<label class="input w-full"
		>Visceral Fat
		<input type="number" class="grow" placeholder="0" bind:value={visceralValue} />
		<span class="badge badge-neutral badge-xs">U</span>
	</label>
	<label class="input w-full">
		Date
		<input type="date" class="input" bind:value={date} />
	</label>
	<label class="input w-full">
		Time
		<input type="time" class="input" bind:value={time} />
	</label>

	{#if submitError}
		<p class="text-error text-sm">{submitError}</p>
	{/if}

	<button class="btn btn-success w-full" onclick={() => addWeightData()}>Update Weight</button>
</div>
