<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import RadialProgress from '$lib/components/RadialProgress.svelte';
	import CalorieInput from '$lib/components/CalorieInput.svelte';
	import WeightInput from '$lib/components/WeightInput.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { getAgeFactor } from '$lib/scripts/helpers';
	import { calorieGoal, usedCalories, deficitReduction } from '$lib/scripts/calories';
	import type { ModalSelector } from '$lib/data/types';

	const ageFactor = getAgeFactor(settings.gender);

	const goal = calorieGoal(
		settings.age,
		ageFactor,
		settings.currentWeight,
		settings.height,
		settings.activityFactor,
		settings.deficit
	);
	let used = usedCalories(calories.intake);
	let burned = usedCalories(calories.burned) * 0.75;
	let delta = used - burned;
	let usedCaloriesPercentage = (delta / goal) * 100;
	let dailyDeficit = settings.deficit - deficitReduction(goal, delta, settings.deficit);
	let deficitPercentage = (dailyDeficit / settings.deficit) * 100;

	let calorieColor =
		usedCaloriesPercentage >= 120
			? 2
			: usedCaloriesPercentage >= 101
				? 1
				: usedCaloriesPercentage >= 90
					? 0
					: usedCaloriesPercentage >= 50
						? 1
						: 2;
	let deficitColor = deficitPercentage >= 75 ? 0 : deficitPercentage >= 45 ? 1 : 2;

	let reInitModal = $state(Math.random());

	/**
	 * opens a specified modal
	 * @param name the Id of the modal element
	 */
	const openModal = (name: ModalSelector) => {
		reInitModal = Math.random();
		return (document.getElementById(name) as HTMLDialogElement).showModal();
	};
</script>

<div class="flex flex-wrap">
	<Container title="Calories">
		<div role="none" class="stats bg-base-100 mb-4 w-full items-center shadow md:mx-4">
			<div class="stat w-full justify-items-center">
				<p class="mb-4 text-center">Target</p>
				<RadialProgress color={calorieColor} percentage={usedCaloriesPercentage} />
				<p class="my-4 text-center">{delta}/{goal} kcal</p>
				<button
					class="btn btn-soft btn-success w-full grow shadow"
					onclick={() => openModal('calorieAddModal')}>Add</button
				>
			</div>
			<div class="stat w-full justify-items-center">
				<p class="mb-4 text-center">Deficit</p>
				<RadialProgress color={deficitColor} percentage={deficitPercentage} />
				<p class="my-4 text-center">{dailyDeficit}/{settings.deficit} kcal</p>
				<button
					class="btn btn-soft btn-success w-full grow shadow"
					onclick={() => openModal('calorieBurnModal')}>Burn</button
				>
			</div>
		</div>
	</Container>

	<dialog id="calorieAddModal" class="modal modal-bottom sm:modal-middle">
		<div class="modal-box">
			{#key reInitModal}
				<CalorieInput mode="add" />
			{/key}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<dialog id="calorieBurnModal" class="modal modal-bottom sm:modal-middle">
		<div class="modal-box">
			{#key reInitModal}
				<CalorieInput mode="burn" />
			{/key}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<Container title="Weight">
		<div class="card bg-base-100 mb-4 w-full items-center px-4 pb-4 shadow md:mx-4">
			<div class="stats items-center justify-center" role="none">
				<div class="stat items-end font-mono">
					<div class="stat-desc text-right">ATH: {settings.highestWeight}</div>
					<div class="stat-desc text-right">ATL: {settings.lowestWeight}</div>
					<div class="stat-desc text-right">MODE: {settings.targetIsLoss ? 'LOSS' : 'GAIN'}</div>
				</div>
				<div class="stat">
					<div class="stat-value">
						<span class="text-6xl md:text-8xl">{settings.currentWeight}</span>
						<span class="text-2xl md:text-4xl">KG</span>
					</div>
				</div>
			</div>
			<button
				class="btn btn-soft btn-success w-full grow shadow"
				onclick={() => openModal('weightUpdateModal')}>Update</button
			>
		</div>
	</Container>

	<dialog id="weightUpdateModal" class="modal modal-bottom sm:modal-middle">
		<div class="modal-box">
			{#key reInitModal}
				<WeightInput></WeightInput>
			{/key}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
</div>
