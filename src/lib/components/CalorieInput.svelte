<script lang="ts">
	import { getFbTime } from '$lib/middleware/storage';
	import { timePadding, getIsoDate, getStampedDate } from '$lib/scripts/helpers';
	import { Update } from '$lib/scripts/dataInit';

	let { mode }: { mode?: 'add' | 'burn' } = $props();

	let calorieName = $state('');
	let calorieValue = $state(0);
	let date = $state(getIsoDate().split('T')[0]);
	let time = $state(
		timePadding(new Date().getHours()) + ':' + timePadding(new Date().getMinutes())
	);

	const pushTo = new Update();

	// const getDialogId = () => {
	// 	switch (mode) {
	// 		case 'add':
	// 			return 'calorieAddModal';
	// 		case 'burn':
	// 			return 'calorieBurnModal';
	// 		default:
	// 			return 'calorieAddModal';
	// 	}
	// };
	// const dialog = (<HTMLElement>document.getElementById(getDialogId())) as HTMLDialogElement;

	const createCalorieItem = () => {
		return {
			name: calorieName,
			energyValue: calorieValue,
			date: {
				seconds: getFbTime(getStampedDate(date, time)).seconds,
				nanoseconds: getFbTime(getStampedDate(date, time)).nanoseconds
			}
		};
	};

	const clearInput = () => {
		calorieName = '';
		calorieValue = 0;
		date = getIsoDate().split('T')[0];
		time = timePadding(new Date().getHours()) + ':' + timePadding(new Date().getMinutes());
		// dialog.close();
	};

	const addConsumedCalories = async () => {
		await pushTo.calories('calorieIntake', createCalorieItem()).then(() => {
			clearInput();
		});
	};

	const addBurnedCalories = async () => {
		await pushTo.calories('calorieBurn', createCalorieItem()).then(() => {
			clearInput();
		});
	};
</script>

{#if mode == 'add'}
	<div class="border-base-300 bg-base-100 flex flex-col gap-3">
		<label class="input w-full">
			Name
			<input type="text" class="grow" placeholder="Borgir" bind:value={calorieName} />
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

		<button class="btn btn-success w-full" onclick={() => addConsumedCalories()}
			>Add Calories</button
		>
	</div>
{:else if mode == 'burn'}
	<div class="border-base-300 bg-base-100 flex flex-col gap-3">
		<label class="input w-full">
			Activity
			<input type="text" class="grow" placeholder="Cycling" bind:value={calorieName} />
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

		<button class="btn btn-success w-full" onclick={() => addBurnedCalories()}>Burn Calories</button
		>
	</div>
{/if}
