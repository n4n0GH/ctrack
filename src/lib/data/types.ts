export type EnergyItem = {
	name: string;
	energyValue: number;
	date: {
		seconds: number;
		nanoseconds: number;
	};
};

export type WeightItem = {
	weight: number;
	date: {
		seconds: number;
		nanoseconds: number;
	};
};

export type SortedWeights = {
	current: number;
	ath: number;
	atl: number;
};

export type UserSettings = {
	activityFactor: number;
	age: number;
	currentWeight: number;
	deficit: number;
	gender: 'male' | 'female';
	height: number;
	highestWeight: number;
	lowestWeight: number;
	startingWeight: number;
};

export type CalorieSelector = 'calorieBurn' | 'calorieIntake';

export type ModalSelector = 'calorieAddModal' | 'calorieBurnModal' | 'weightUpdateModal';
