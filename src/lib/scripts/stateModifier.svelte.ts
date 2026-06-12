import { settings } from '$lib/state/settings.svelte';
import { userWeights } from '$lib/state/weight.svelte';
import { calories } from '$lib/state/calories.svelte';
import { activity } from '$lib/state/activityHistory.svelte';
import { findNewestWeight, findHighestWeight, findLowestWeight } from '$lib/scripts/helpers';
import type { UserSettings, WeightItem, EnergyItem, ActivityHistoryItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

/* == Data loaded tracking == */

let dataLoadedState = $state(false);

export const markDataLoaded = () => {
	dataLoadedState = true;
};

export const dataLoaded = () => {
	return dataLoadedState;
};
/* == App Settings == */

export const updateSettings = (newSettings: UserSettings) => {
	settings.activityFactor = newSettings.activityFactor;
	settings.age = newSettings.age;
	settings.currentWeight = newSettings.currentWeight;
	settings.deficit = newSettings.deficit;
	settings.gender = newSettings.gender;
	settings.height = newSettings.height;
	settings.highestWeight = newSettings.highestWeight;
	settings.lowestWeight = newSettings.lowestWeight;
	settings.startingWeight = newSettings.startingWeight;
	settings.goal = newSettings.goal;
};

/* == Weight Related == */

// The home page reads the current/highest/lowest weight off `settings`, which is
// seeded from the weight history at boot (see +layout.ts). Re-derive those tiers
// whenever the history changes so the displayed values stay reactive.
const syncWeightTiers = () => {
	settings.currentWeight = findNewestWeight(userWeights).weight;
	settings.highestWeight = findHighestWeight(userWeights).weight;
	settings.lowestWeight = findLowestWeight(userWeights).weight;
};

export const addUserWeight = (newWeight: WeightItem) => {
	userWeights.push(newWeight);
	syncWeightTiers();
};

export const initUserWeight = (dataset: (WeightItem | DocumentData)[]) => {
	userWeights.push(...dataset);
};

/* == Weight Related (Update) == */

export const updateWeightItem = (updatedItem: WeightItem) => {
	const index = userWeights.findIndex(
		(item) => (item as WeightItem).date.seconds === updatedItem.date.seconds
	);
	if (index !== -1) {
		userWeights[index] = { ...userWeights[index], ...updatedItem };
		syncWeightTiers();
	}
};

/* == Calorie Related == */

export const updateIntake = (newCalories: EnergyItem) => {
	calories.intake.push(newCalories);
};

export const updateBurn = (newCalories: EnergyItem) => {
	calories.burned.push(newCalories);
};

export const updateCalorieItem = (
	path: 'calorieIntake' | 'calorieBurn',
	updatedItem: EnergyItem
) => {
	const targetArray = path === 'calorieIntake' ? calories.intake : calories.burned;
	const index = targetArray.findIndex((item) => (item as EnergyItem).id === updatedItem.id);
	if (index !== -1) {
		targetArray[index] = { ...targetArray[index], ...updatedItem };
	}
};

export const initCalories = (dataset: {
	intake: (EnergyItem | DocumentData)[];
	burned: (EnergyItem | DocumentData)[];
}) => {
	calories.intake = dataset.intake;
	calories.burned = dataset.burned;
};

export const initActivityHistory = (dataset: {
	history: (ActivityHistoryItem | DocumentData)[];
}) => {
	activity.history = dataset.history;
};
