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

/**
 * A user-defined reference line drawn on the weight chart (e.g. a target weight
 * or a population average). Managed on the settings page and persisted to the
 * `weightSettings` collection. `color` is a hex string with a leading '#'.
 */
export type WeightSettingItem = {
	label: string;
	value: number;
	color: string;
	id?: string | undefined;
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
 * A food product looked up from Open Food Facts by barcode, normalised to just
 * the fields the calorie logger needs. Energy is per 100 g (OFF's canonical
 * unit); the optional serving fields are used to pre-fill a sensible portion.
 * Cached in IndexedDB keyed by barcode to respect OFF's rate limits and to work
 * offline.
 */
export type FoodProduct = {
	barcode: string;
	name: string;
	kcal100: number;
	servingGrams?: number;
	kcalServing?: number;
};

/**
 * The user-supplied Firebase web app configuration. These are public project
 * identifiers (not secrets), entered on the settings page and stored locally in
 * IndexedDB so each device can point at the user's own Firebase project.
 */
export type FirebaseConfig = {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
};

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
