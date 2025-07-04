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
