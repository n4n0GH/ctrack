<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import RadialProgress from '$lib/components/RadialProgress.svelte';
	import { getSettings } from '$lib/state/settings.svelte';
	import { getUserCalories } from '$lib/state/calories.svelte';
	import { getAgeFactor } from '$lib/scripts/helpers';
	import { calorieGoal, usedCalories, deficitReduction } from '$lib/scripts/calories';

	let settings = getSettings();
	let calories = getUserCalories();

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
	let burned = usedCalories(calories.burned);
	let delta = used - burned;
	let usedCaloriesPercentage = (delta / goal) * 100;
	let dailyDeficit = settings.deficit - deficitReduction(goal, delta, settings.deficit);
	let deficitPercentage = (dailyDeficit / settings.deficit) * 100;

	let calorieColor =
		usedCaloriesPercentage >= 101
			? 1
			: usedCaloriesPercentage >= 90
				? 0
				: usedCaloriesPercentage >= 50
					? 1
					: 2;
	let deficitColor = deficitPercentage >= 75 ? 0 : deficitPercentage >= 45 ? 1 : 2;
</script>

<div class="flex flex-wrap">
	<Container>
		<div role="none" class="stats">
			<div class="stat">
				<p class="mb-4 text-center">Target</p>
				<RadialProgress color={calorieColor} percentage={usedCaloriesPercentage} />
				<p class="mt-4 text-center">{delta}/{goal} kcal</p>
			</div>
			<div class="stat">
				<p class="mb-4 text-center">Deficit</p>
				<RadialProgress color={deficitColor} percentage={deficitPercentage} />
				<p class="mt-4 text-center">{dailyDeficit}/{settings.deficit} kcal</p>
			</div>
		</div>
	</Container>
	<Container>
		<div class="stats" role="none">
			<div class="stat items-end font-mono">
				<div class="stat-desc text-right">ATH: {settings.highestWeight}</div>
				<div class="stat-desc text-right">ATL: {settings.lowestWeight}</div>
				<div class="stat-desc text-right">TREND: DOWN</div>
			</div>
			<div class="stat">
				<div class="stat-value">
					<span class="text-6xl md:text-8xl">{settings.currentWeight}</span>
					<span class="text-2xl md:text-4xl">KG</span>
				</div>
			</div>
		</div>
	</Container>
	<Container></Container>
</div>
