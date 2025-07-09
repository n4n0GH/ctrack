<script lang="ts">
	import { getFbTime, addCalories } from '$lib/middleware/firebase';
	import { updateIntake, updateBurn } from '$lib/state/calories.svelte';
	let getIsoDate = new Date().toISOString();
	let calorieName = $state('');
	let calorieValue = $state(0);
	let date = $state(getIsoDate.split('T')[0]);
	let time = $state(new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0'));

	const getStampedDate = () => {
		return new Date(date + 'T' + time).getTime();
	};

	const createCalorieItem = () => {
		return {
			name: calorieName,
			energyValue: calorieValue,
			date: {
				seconds: getFbTime(getStampedDate()).seconds,
				nanoseconds: getFbTime(getStampedDate()).nanoseconds
			}
		};
	};

	const addConsumedCalories = async () => {
		await addCalories('calorieIntake', createCalorieItem()).then((item) => {
			if (item.success) updateIntake(item.data);
		});
	};

	const addBurnedCalories = async () => {
		await addCalories('calorieBurn', createCalorieItem()).then((item) => {
			if (item.success) updateBurn(item.data);
		});
	};
</script>

<div class="tabs tabs-border">
	<input
		type="radio"
		name="calorie_tabs"
		class="tab border-base-300 bg-base-100"
		aria-label="Consumed"
		checked
	/>
	<div class="tab-content border-base-300 bg-base-100 p-10">
		<label class="input">
			Name
			<input type="text" class="grow" placeholder="Borgir" bind:value={calorieName} />
		</label>
		<label class="input">
			Calories
			<input type="number" class="grow" placeholder="9001" bind:value={calorieValue} />
			<span class="badge badge-neutral badge-xs">kcal</span>
		</label>
		<label class="input">
			Date
			<input type="date" class="input" bind:value={date} />
		</label>
		<label class="input">
			Time
			<input type="time" class="input" bind:value={time} />
		</label>

		<button class="btn btn-success w-full" onclick={() => addConsumedCalories()}
			>Add Calories</button
		>
	</div>

	<input
		type="radio"
		name="calorie_tabs"
		class="tab border-base-300 bg-base-100"
		aria-label="Burned"
	/>
	<div class="tab-content border-base-300 bg-base-100 p-10">Burned calories input</div>
</div>
