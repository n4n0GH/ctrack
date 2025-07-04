import type { LayoutServerData } from './$types';
import { getUserSettings, getUserWeight, getCalories } from '$lib/middleware/firebase';
import { findNewestWeight, findLowestWeight, findHighestWeight } from '$lib/scripts/helpers';
import { initUserWeight } from '$lib/state/weight.svelte';
import { updateSettings } from '$lib/state/settings.svelte';
import { initCalories, getUserCalories } from '$lib/state/calories.svelte';

const fetchData = async () => {
	const settings = await getUserSettings();
	const weights = await getUserWeight();
	const caloriesIn = await getCalories('calorieIntake');
	const caloriesOut = await getCalories('calorieBurn');
	return {
		settings: settings,
		weights: weights,
		calories: { intake: caloriesIn, burned: caloriesOut }
	};
};

export const load = async () => {
	await fetchData().then((data) => {
		const weights = data.weights;
		const calories = data.calories;
		const settings = data.settings;

		const currentWeight = findNewestWeight(weights);
		const athWeight = findHighestWeight(weights);
		const atlWeight = findLowestWeight(weights);

		const newSettings = {
			activityFactor: settings.activityFactor,
			age: settings.age,
			currentWeight: currentWeight.weight,
			startingWeight: settings.startingWeight,
			lowestWeight: atlWeight.weight,
			height: settings.height,
			highestWeight: athWeight.weight,
			gender: settings.gender,
			deficit: settings.deficit
		};
		const calorieData = {
			intake: calories.intake,
			burned: calories.burned
		};

		updateSettings(newSettings);
		initCalories(calorieData);
		initUserWeight(weights);
	});
};
