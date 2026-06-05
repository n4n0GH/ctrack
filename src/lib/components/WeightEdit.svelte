<script lang="ts">
	import { getFbTime } from '$lib/middleware/firebase';
	import { timePadding, getStampedDate } from '$lib/scripts/helpers';
	import { Update } from '$lib/scripts/dataInit';
	import type { WeightItem } from '$lib/data/types';

	let { entry }: { entry: WeightItem & { id: string } } = $props();

	let weightValue = $state(entry.weight);
	let muscleValue = $state(entry.muscle || 0);
	let bodyfatValue = $state(entry.fat || 0);
	let visceralValue = $state(entry.visceral || 0);

	const dateObj = new Date(entry.date.seconds * 1000);
	let date = $state(dateObj.toISOString().split('T')[0]);
	let time = $state(timePadding(dateObj.getHours()) + ':' + timePadding(dateObj.getMinutes()));

	let submitError = $state('');

	const pushTo = new Update();

	const createUpdatedItem = (): WeightItem => {
		return {
			weight: weightValue,
			date: {
				seconds: getFbTime(getStampedDate(date, time)).seconds,
				nanoseconds: getFbTime(getStampedDate(date, time)).nanoseconds
			},
			fat: bodyfatValue,
			muscle: muscleValue,
			visceral: visceralValue
		};
	};

	const saveChanges = async () => {
		submitError = '';
		const result = await pushTo.updateWeight(entry.id, createUpdatedItem());
		if (result.success) {
			(document.getElementById('weightEditModal') as HTMLDialogElement)?.close();
		} else {
			submitError = 'Failed to update weight entry. Please try again.';
		}
	};
</script>

<div class="border-base-300 bg-base-100 flex flex-col gap-3">
	<label class="input w-full">
		Weight
		<input type="number" class="grow" placeholder="0" bind:value={weightValue} />
		<span class="badge badge-neutral badge-xs">KG</span>
	</label>
	<label class="input w-full">
		Muscle Mass
		<input type="number" class="grow" placeholder="0" bind:value={muscleValue} />
		<span class="badge badge-neutral badge-xs">%</span>
	</label>
	<label class="input w-full">
		Body Fat
		<input type="number" class="grow" placeholder="0" bind:value={bodyfatValue} />
		<span class="badge badge-neutral badge-xs">%</span>
	</label>
	<label class="input w-full">
		Visceral Fat
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

	<button class="btn btn-success w-full" onclick={saveChanges}>Save Changes</button>
</div>
