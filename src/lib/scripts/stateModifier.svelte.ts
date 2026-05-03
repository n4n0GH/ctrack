import { settings } from '$lib/state/settings.svelte';
import { userWeights } from '$lib/state/weight.svelte';
import { calories } from '$lib/state/calories.svelte';
import { activity } from '$lib/state/activityHistory.svelte';
import type { UserSettings, WeightItem, EnergyItem, ActivityHistoryItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

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
	settings.targetIsLoss = newSettings.targetIsLoss;
};

/* == Weight Related == */

export const addUserWeight = (newWeight: WeightItem) => {
	userWeights.push(newWeight);
};

export const initUserWeight = (dataset: (WeightItem | DocumentData)[]) => {
	userWeights.push(...dataset);
};

/* == Calorie Related == */

export const updateIntake = (newCalories: EnergyItem) => {
	calories.intake.push(newCalories);
};

export const updateBurn = (newCalories: EnergyItem) => {
	calories.burned.push(newCalories);
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
