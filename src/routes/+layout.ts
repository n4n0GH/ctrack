import { loadInitialData } from '$lib/middleware/storage';
import { findNewestWeight, findLowestWeight, findHighestWeight } from '$lib/scripts/helpers';
import { markDataLoaded } from '$lib/scripts/stateModifier.svelte';
import { Update, Init } from '$lib/scripts/dataInit';

const init = new Init();
const pushTo = new Update();

const defaultSettings = {
	activityFactor: 1.2,
	age: 30,
	currentWeight: 0,
	startingWeight: 0,
	lowestWeight: 0,
	height: 170,
	highestWeight: 0,
	gender: 'male' as const,
	deficit: 500,
	targetIsLoss: true
};

export const load = async () => {
	try {
		// loadInitialData is local-first and never throws: it reads IndexedDB,
		// then folds in any newer Firebase content when the backend is reachable.
		// If Firebase is exhausted/unreachable the locally cached data is used.
		const data = await loadInitialData();

		const fweights = data.weights;
		const fsettings = data.settings ?? defaultSettings;

		const currentWeight = findNewestWeight(fweights);
		const athWeight = findHighestWeight(fweights);
		const atlWeight = findLowestWeight(fweights);

		const newSettings = {
			activityFactor: fsettings.activityFactor,
			age: fsettings.age,
			currentWeight: currentWeight.weight,
			startingWeight: fsettings.startingWeight,
			lowestWeight: atlWeight.weight,
			height: fsettings.height,
			highestWeight: athWeight.weight,
			gender: fsettings.gender,
			deficit: fsettings.deficit,
			targetIsLoss: fsettings.targetIsLoss
		};

		pushTo.settings(newSettings);
		init.calories({ intake: data.intake, burned: data.burned });
		init.weights(fweights);
		init.activities({ history: data.activity });
	} catch (e) {
		// Last-resort guard: whatever goes wrong, the app must still boot with a
		// usable UI rather than crashing on startup.
		console.error('App data initialization failed; starting with default settings:', e);
		pushTo.settings(defaultSettings);
	} finally {
		// Always signal that the boot sequence is complete so the UI renders.
		markDataLoaded();
	}
};
