import { getUserSettings, getUserWeight, getCalories } from '$lib/middleware/storage';
import { findNewestWeight, findLowestWeight, findHighestWeight } from '$lib/scripts/helpers';
import {
	updateSettings,
	initUserWeight,
	initCalories,
	markDataLoaded
} from '$lib/scripts/stateModifier.svelte';
import { Update, Fetch, Init } from '$lib/scripts/dataInit';

const init = new Init();
const pull = new Fetch();
const pushTo = new Update();

const fetchData = async () => {
	const dbSettings = await pull.settings();
	const weights = await pull.weights();
	const caloriesIn = await pull.calories('calorieIntake');
	const caloriesOut = await pull.calories('calorieBurn');
	const activityHistory = await pull.activities();
	return {
		settings: dbSettings,
		weights: weights,
		calories: { intake: caloriesIn, burned: caloriesOut },
		activityHistory: activityHistory
	};
};

const defaultSettings = {
	activityFactor: 1.2,
	age: 30,
	currentWeight: 0,
	startingWeight: 0,
	lowestWeight: 0,
	height: 170,
	highestWeight: 0,
	gender: 'male' as const,
	deficit: 500,
	targetIsLoss: true
};

export const load = async () => {
	await fetchData().then((data) => {
		const fweights = data.weights;
		const fcalories = data.calories;
		const fsettings = data.settings ?? defaultSettings;
		const factivity = data.activityHistory;

		const currentWeight = findNewestWeight(fweights);
		const athWeight = findHighestWeight(fweights);
		const atlWeight = findLowestWeight(fweights);

		const newSettings = {
			activityFactor: fsettings.activityFactor,
			age: fsettings.age,
			currentWeight: currentWeight.weight,
			startingWeight: fsettings.startingWeight,
			lowestWeight: atlWeight.weight,
			height: fsettings.height,
			highestWeight: athWeight.weight,
			gender: fsettings.gender,
			deficit: fsettings.deficit,
			targetIsLoss: fsettings.targetIsLoss
		};
		const calorieData = {
			intake: fcalories.intake,
			burned: fcalories.burned
		};
		const activityData = {
			history: factivity
		};

		pushTo.settings(newSettings);
		init.calories(calorieData);
		init.weights(fweights);
		init.activities(activityData);
		markDataLoaded();
	});
};
