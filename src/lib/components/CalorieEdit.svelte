<script lang="ts">
	import { getFbTime } from '$lib/middleware/storage';
	import { timePadding, getStampedDate } from '$lib/scripts/helpers';
	import { Update } from '$lib/scripts/dataInit';
	import type { EnergyItem, CalorieSelector } from '$lib/data/types';

	let { entry, path }: { entry: EnergyItem; path: CalorieSelector } = $props();

	let calorieName = $state(entry.name);
	let calorieValue = $state(entry.energyValue);

	const dateObj = new Date(entry.date.seconds * 1000);
	let date = $state(dateObj.toISOString().split('T')[0]);
	let time = $state(timePadding(dateObj.getHours()) + ':' + timePadding(dateObj.getMinutes()));

	let submitError = $state('');

	const pushTo = new Update();

	const createUpdatedItem = (): EnergyItem => {
		return {
			id: entry.id,
			name: calorieName,
			energyValue: calorieValue,
			date: {
				seconds: getFbTime(getStampedDate(date, time)).seconds,
				nanoseconds: getFbTime(getStampedDate(date, time)).nanoseconds
			}
		};
	};

	const saveChanges = async () => {
		submitError = '';
		const result = await pushTo.updateCalorie(path, entry.id!, createUpdatedItem());
		if (result.success) {
			(document.getElementById('calorieEditModal') as HTMLDialogElement)?.close();
		} else {
			submitError = 'Failed to update calorie entry. Please try again.';
		}
	};
</script>

<div class="border-base-300 bg-base-100 flex flex-col gap-3">
	<label class="input w-full">
		Name
		<input type="text" class="grow" placeholder="Burger" bind:value={calorieName} />
	</label>
	<label class="input w-full">
		Calories
		<input type="number" class="grow" placeholder="9001" bind:value={calorieValue} />
		<span class="badge badge-neutral badge-xs">kcal</span>
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
