<script lang="ts">
	import { getFbTime, addWeight } from '$lib/middleware/firebase';
	import { timePadding, getIsoDate, getStampedDate } from '$lib/scripts/helpers';
	import { settings } from '$lib/state/settings.svelte';
	import { Update } from '$lib/scripts/dataInit';

	let weightValue = $derived(settings.currentWeight);
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
			}
		};
	};

	const addWeightData = async () => {
		await pushTo.weight(createWeightItem());
	};
</script>

<div class="border-base-300 bg-base-100 flex flex-col gap-3">
	<label class="input w-full"
		>Weight
		<input type="number" class="grow" placeholder="0" bind:value={weightValue} />
		<span class="badge badge-neutral badge-xs">KG</span>
	</label>
	<label class="input w-full">
		Date
		<input type="date" class="input" bind:value={date} />
	</label>
	<label class="input w-full">
		Time
		<input type="time" class="input" bind:value={time} />
	</label>

	<button class="btn btn-success w-full" onclick={() => addWeightData()}>Update Weight</button>
</div>
