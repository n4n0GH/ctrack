export type EnergyItem = {
	name: string;
	energyValue: number;
	date: {
		seconds: number;
		nanoseconds: number;
	};
	id?: string | undefined;
};

export type WeightItem = {
	weight: number;
	date: {
		seconds: number;
		nanoseconds: number;
	};
	fat?: number | undefined;
	muscle?: number | undefined;
	visceral?: number | undefined;
	id?: string | undefined;
};

export type ActivityHistoryItem = {
	activityLevel: number;
	date: number; // @dev this is going to be a unix timestamp
};

export type SortedWeights = {
	current: number;
	ath: number;
	atl: number;
};

export type UserGoal = 'loss' | 'gain' | 'maintain';

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
	goal: UserGoal;
};

export type CalorieSelector = 'calorieBurn' | 'calorieIntake';

/**
 * A Firebase write that failed (quota exceeded / unreachable) and has been
 * deferred to the IndexedDB outbox for retry on a later page load.
 */
export type OutboxOperation =
	| { type: 'addCalories'; path: CalorieSelector; item: EnergyItem }
	| { type: 'updateCalories'; path: CalorieSelector; docId: string; item: EnergyItem }
	| { type: 'addWeight'; item: WeightItem }
	| { type: 'updateWeight'; docId: string; item: WeightItem };

/** An outbox operation as stored, with its auto-incremented key. */
export type OutboxEntry = OutboxOperation & { id: number };

export type ModalSelector =
	| 'calorieAddModal'
	| 'calorieBurnModal'
	| 'weightUpdateModal'
	| 'calorieEditModal';

export type BmiItem = {
	label:
		| 'Underweight'
		| 'Normal Weight'
		| 'Overweight'
		| 'Obesity Type I'
		| 'Obesity Type II'
		| 'Obesity Type III';
	limit: number;
};
