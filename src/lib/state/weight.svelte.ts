import type { WeightItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

let userWeights = $state<WeightItem[] | DocumentData[]>([]);

export const getUserWeights = () => {
	return userWeights;
};

export const addUserWeight = (newWeight: WeightItem) => {
	userWeights.push(newWeight);
};

export const initUserWeight = (dataset: WeightItem[] | DocumentData[]) => {
	userWeights = dataset;
};
