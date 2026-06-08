import { loadInitialData } from '$lib/middleware/storage';
import { findNewestWeight, findLowestWeight, findHighestWeight } from '$lib/scripts/helpers';
import { markDataLoaded } from '$lib/scripts/stateModifier.svelte';
import { Update, Init } from '$lib/scripts/dataInit';
import type { UserGoal, UserSettings } from '$lib/data/types';

// This is a client-side, local-first app: all data lives in IndexedDB (browser
// only) and the Firebase client SDK. Server-rendering the layout would run
// `load` where IndexedDB does not exist, so the local cache could never feed the
// UI and an exhausted/unreachable Firebase would render (and previously crash)
// with empty data. Disabling SSR makes `load` run in the browser, so the
// IndexedDB-first path actually surfaces.
export const ssr = false;

const init = new Init();
const pushTo = new Update();

const defaultSettings: UserSettings = {
	activityFactor: 1.2,
	age: 30,
	currentWeight: 0,
	startingWeight: 0,
	lowestWeight: 0,
	height: 170,
	highestWeight: 0,
	gender: 'male',
	deficit: 500,
	goal: 'loss'
};

/**
 * Normalizes the persisted goal. Records written before the `goal` field
 * existed only carry the legacy boolean `targetIsLoss`, so fall back to that.
 */
const resolveGoal = (raw: UserSettings): UserGoal => {
	const legacy = raw as { goal?: UserGoal; targetIsLoss?: boolean };
	if (legacy.goal) return legacy.goal;
	return legacy.targetIsLoss === false ? 'gain' : 'loss';
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
			goal: resolveGoal(fsettings)
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
