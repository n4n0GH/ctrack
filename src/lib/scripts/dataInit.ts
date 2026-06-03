import {
	getUserSettings,
	getUserWeight,
	getCalories,
	getActivityHistory,
	addCalories,
	addWeight,
	updateCalories
} from '$lib/middleware/firebase';
import { findNewestWeight, findHighestWeight, findLowestWeight } from '$lib/scripts/helpers';
import {
	updateSettings,
	addUserWeight,
	initUserWeight,
	updateIntake,
	updateBurn,
	initCalories,
	initActivityHistory,
	updateCalorieItem
} from '$lib/scripts/stateModifier.svelte';
import { calories } from '$lib/state/calories.svelte';
import type {
	SortedWeights,
	UserSettings,
	WeightItem,
	CalorieSelector,
	EnergyItem,
	ActivityHistoryItem
} from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

export class Fetch {
	async settings() {
		const settings = await getUserSettings();
		return settings;
	}
	async weights() {
		const weights = await getUserWeight();
		return weights;
	}
	async calories(selector: CalorieSelector) {
		const calories = await getCalories(selector);
		return calories;
	}
	async activities() {
		const activities = await getActivityHistory();
		return activities;
	}
}

export class Init {
	calories(dataset: {
		intake: (EnergyItem | DocumentData)[];
		burned: (EnergyItem | DocumentData)[];
	}) {
		initCalories({ intake: dataset.intake, burned: dataset.burned });
	}
	weights(dataset: (WeightItem | DocumentData)[]) {
		initUserWeight(dataset);
	}
	activities(dataset: { history: (ActivityHistoryItem | DocumentData)[] }) {
		initActivityHistory(dataset);
	}
}

export class Update {
	settings(setting: UserSettings) {
		updateSettings(setting);
	}
	async calories(path: CalorieSelector, calorieItem: EnergyItem) {
		await addCalories(path, calorieItem).then((item) => {
			if (item.success) {
				switch (path) {
					case 'calorieIntake':
						updateIntake(item.data);
						break;
					case 'calorieBurn':
						updateBurn(item.data);
						break;
				}
			}
		});
	}
	async weight(weightItem: WeightItem) {
		const result = await addWeight(weightItem);
		if (result.success) addUserWeight(result.data);
		return result;
	}
	async updateCalorie(path: CalorieSelector, docId: string, updateItem: EnergyItem) {
		const result = await updateCalories(path, docId, updateItem);
		if (result.success) {
			updateCalorieItem(path, result.data);
		}
		return result;
	}
}

const weightTiers = (weights: WeightItem[] | DocumentData[]) => {
	const currentWeight = findNewestWeight(weights);
	const athWeight = findHighestWeight(weights);
	const atlWeight = findLowestWeight(weights);
	return {
		current: currentWeight,
		ath: athWeight,
		atl: atlWeight
	};
};

const initSettings = (
	settings: UserSettings | DocumentData,
	weights: SortedWeights | DocumentData
) => {
	return {
		activityFactor: settings.activityFactor,
		age: settings.age,
		currentWeight: weights.current,
		startingWeight: settings.startingWeight,
		lowestWeight: weights.atl,
		height: settings.height,
		highestWeight: weights.ath,
		gender: settings.gender,
		deficit: settings.deficit,
		targetIsLoss: settings.targetIsLoss
	};
};
