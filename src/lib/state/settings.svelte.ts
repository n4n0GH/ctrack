import type { UserSettings } from '$lib/data/types';

export let settings = $state<UserSettings>({
	activityFactor: 0,
	age: 0,
	currentWeight: 0,
	startingWeight: 0,
	lowestWeight: 0,
	height: 0,
	highestWeight: 0,
	gender: 'male',
	deficit: 0,
	goal: 'maintain'
});
