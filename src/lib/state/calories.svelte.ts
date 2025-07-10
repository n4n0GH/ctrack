import type { EnergyItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

let calories = $state<{
	intake: EnergyItem[] | DocumentData[];
	burned: EnergyItem[] | DocumentData[];
}>({
	intake: [],
	burned: []
});

export const getUserCalories = () => {
	return calories;
};

export const updateIntake = (newCalories: EnergyItem) => {
	calories.intake.push(newCalories);
};

export const updateBurn = (newCalories: EnergyItem) => {
	calories.burned.push(newCalories);
};

export const initCalories = (dataset: {
	intake: EnergyItem[] | DocumentData[];
	burned: EnergyItem[] | DocumentData[];
}) => {
	calories = dataset;
};
