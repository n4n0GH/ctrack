/**
 * Unified storage layer - tries Firebase first, falls back to IndexedDB
 *
 * This allows the app to remain usable even when Firebase API limits are hit
 * or the network is unavailable, without changing any data structures or
 * component code.
 */

import { browser } from '$app/environment';
import * as fb from '$lib/middleware/firebase';
import * as idb from '$lib/middleware/idb';
import type {
	CalorieSelector,
	EnergyItem,
	WeightItem,
	ActivityHistoryItem,
	UserSettings
} from '$lib/data/types';

// ======================== Firebase availability ========================

let isFirebaseAvailable = true;

/**
 * Attempts to ping Firebase. Sets the availability flag used by the
 * fallback wrapper. Returns true when Firebase is reachable and false
 * when it has thrown (e.g. quota exceeded).
 */
export const checkFirebase = async (): Promise<boolean> => {
	try {
		await fb.getUserSettings();
		isFirebaseAvailable = true;
		return true;
	} catch {
		isFirebaseAvailable = false;
		return false;
	}
};

export const getFirebaseStatus = (): boolean => isFirebaseAvailable;

// ======================== App bootstrap ========================

/**
 * Shape of the initial data set the app boots with.
 */
export interface InitialData {
	settings: UserSettings | undefined;
	weights: WeightItem[];
	intake: EnergyItem[];
	burned: EnergyItem[];
	activity: ActivityHistoryItem[];
}

const EMPTY_INITIAL_DATA: InitialData = {
	settings: undefined,
	weights: [],
	intake: [],
	burned: [],
	activity: []
};

/**
 * Reads the full data set directly from IndexedDB. Every call is individually
 * guarded so a single failing store can never prevent the others from loading.
 */
const readLocal = async (): Promise<InitialData> => {
	const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
		try {
			return await fn();
		} catch (e) {
			console.warn('Local read failed:', e);
			return fallback;
		}
	};

	return {
		settings: await safe(() => idb.getUserSettings(), undefined),
		weights: await safe(() => idb.getUserWeight(), []),
		intake: await safe(() => idb.getCalories('calorieIntake'), []),
		burned: await safe(() => idb.getCalories('calorieBurn'), []),
		activity: await safe(() => idb.getActivityHistory(), [])
	};
};

/**
 * Best-effort read straight from Firebase. Used during SSR where IndexedDB is
 * unavailable. Returns empty data (never throws) so a quota-exhausted backend
 * still yields a renderable UI.
 */
const readRemote = async (): Promise<InitialData> => {
	try {
		const [settings, weights, intake, burned, activity] = await Promise.all([
			fb.getUserSettings(),
			fb.getUserWeight(),
			fb.getCalories('calorieIntake'),
			fb.getCalories('calorieBurn'),
			fb.getActivityHistory()
		]);
		return {
			settings: settings as UserSettings | undefined,
			weights: weights as WeightItem[],
			intake: intake as EnergyItem[],
			burned: burned as EnergyItem[],
			activity: activity as ActivityHistoryItem[]
		};
	} catch (e) {
		console.warn('Remote read failed (Firebase unavailable):', e);
		return EMPTY_INITIAL_DATA;
	}
};

/**
 * Loads the data set the app boots with, local-first and crash-proof.
 *
 * Order of operations:
 *  1. Read everything from IndexedDB — this always succeeds and gives the UI
 *     immediate data to render.
 *  2. Check the Firebase connection. If it is exhausted/unreachable, the local
 *     data is returned as-is and the app stays fully usable.
 *  3. When Firebase is reachable, pull any *newer* content into IndexedDB and
 *     re-read it, so the local mirror is updated without discarding offline
 *     additions.
 *
 * This function never throws: a "resource-exhausted" Firebase error results in
 * the locally cached data being used rather than the app failing to start.
 */
export const loadInitialData = async (): Promise<InitialData> => {
	// On the server there is no IndexedDB, so fall back to a best-effort
	// Firebase read (which itself swallows quota errors).
	if (!browser) {
		return readRemote();
	}

	// 1. Local first — guaranteed to produce a renderable UI.
	const local = await readLocal();

	// 2. Check the Firebase connection.
	const online = await checkFirebase();
	if (!online) {
		return local;
	}

	// 3. Firebase is reachable: fold any newer remote content into IndexedDB,
	//    then re-read so the UI reflects the refreshed local mirror.
	try {
		await idb.syncFromFirebase();
	} catch (e) {
		console.warn('Firebase sync failed; continuing with local data:', e);
		isFirebaseAvailable = false;
		return local;
	}

	return readLocal();
};

// ======================== Public getters ========================

export const getUserSettings = async () => {
	if (!isFirebaseAvailable) {
		return idb.getUserSettings();
	}
	try {
		return await fb.getUserSettings();
	} catch {
		isFirebaseAvailable = false;
		return idb.getUserSettings();
	}
};

export const getUserWeight = async () => {
	if (!isFirebaseAvailable) {
		return idb.getUserWeight();
	}
	try {
		return await fb.getUserWeight();
	} catch {
		isFirebaseAvailable = false;
		return idb.getUserWeight();
	}
};

export const getActivityHistory = async () => {
	if (!isFirebaseAvailable) {
		return idb.getActivityHistory();
	}
	try {
		return await fb.getActivityHistory();
	} catch {
		isFirebaseAvailable = false;
		return idb.getActivityHistory();
	}
};

export const getCalories = async (path: CalorieSelector) => {
	if (!isFirebaseAvailable) {
		return idb.getCalories(path);
	}
	try {
		return await fb.getCalories(path);
	} catch {
		isFirebaseAvailable = false;
		return idb.getCalories(path);
	}
};

// ======================== Public writers ========================

export const addCalories = async (path: CalorieSelector, calorieItem: EnergyItem) => {
	if (!isFirebaseAvailable) {
		return idb.addCalories(path, calorieItem);
	}
	try {
		const result = await fb.addCalories(path, calorieItem);
		// Mirror successful writes to IndexedDB so data persists locally
		if (result.success) {
			try {
				await idb.addCalories(path, calorieItem);
			} catch {
				// Silently ignore IndexedDB mirror failures — Firebase
				// already succeeded, so this is just a backup optimization.
			}
		}
		return result;
	} catch {
		isFirebaseAvailable = false;
		return idb.addCalories(path, calorieItem);
	}
};

export const updateCalories = async (
	path: CalorieSelector,
	docId: string,
	updateItem: EnergyItem
) => {
	if (!isFirebaseAvailable) {
		return idb.updateCalories(path, docId, updateItem);
	}
	try {
		const result = await fb.updateCalories(path, docId, updateItem);
		if (result.success) {
			try {
				await idb.updateCalories(path, docId, updateItem);
			} catch {
				// Silently ignore
			}
		}
		return result;
	} catch {
		isFirebaseAvailable = false;
		return idb.updateCalories(path, docId, updateItem);
	}
};

export const addWeight = async (newWeight: WeightItem) => {
	if (!isFirebaseAvailable) {
		return idb.addWeight(newWeight);
	}
	try {
		const result = await fb.addWeight(newWeight);
		if (result.success) {
			try {
				await idb.addWeight(newWeight);
			} catch {
				// Silently ignore
			}
		}
		return result;
	} catch {
		isFirebaseAvailable = false;
		return idb.addWeight(newWeight);
	}
};

/**
 * Persists user settings local-first: writes to IndexedDB so the change always
 * survives a reload, then best-effort pushes to Firebase when it is reachable.
 * Never throws — a failed Firebase write does not block saving locally.
 *
 * @returns success reflects whether the settings were persisted locally.
 */
export const updateUserSettings = async (
	settings: UserSettings
): Promise<{ success: boolean; data: UserSettings }> => {
	let localSaved = false;
	try {
		await idb.saveUserSettings(settings);
		localSaved = true;
	} catch (e) {
		console.warn('Failed to persist settings locally:', e);
	}

	if (isFirebaseAvailable) {
		try {
			await fb.updateUserSettings(settings);
		} catch (e) {
			console.warn('Failed to persist settings to Firebase:', e);
			isFirebaseAvailable = false;
		}
	}

	return { success: localSaved, data: settings };
};

export const updateWeight = async (docId: string, updateItem: WeightItem) => {
	if (!isFirebaseAvailable) {
		return idb.updateWeight(docId, updateItem);
	}
	try {
		const result = await fb.updateWeight(docId, updateItem);
		if (result.success) {
			try {
				await idb.updateWeight(docId, updateItem);
			} catch {
				// Silently ignore
			}
		}
		return result;
	} catch {
		isFirebaseAvailable = false;
		return idb.updateWeight(docId, updateItem);
	}
};

// ======================== Sync utilities ========================

/**
 * Syncs locally-stored data back to Firebase when it becomes available again.
 * This is useful after a period of Firebase unavailability (quota exceeded,
 * network outage, etc.).
 *
 * @returns Object indicating how many records were synced per collection.
 */
export const syncToFirebase = async (): Promise<{
	settings: number;
	weights: number;
	intake: number;
	burn: number;
	activity: number;
}> => {
	const results = {
		settings: 0,
		weights: 0,
		intake: 0,
		burn: 0,
		activity: 0
	};

	const settings = await idb.getUserSettings();
	if (settings) {
		try {
			await fb.updateUserSettings(settings);
			results.settings = 1;
		} catch {
			// Firebase may still be down
		}
	}

	const weights = await idb.getUserWeight();
	for (const w of weights) {
		try {
			await fb.addWeight(w);
			results.weights++;
		} catch {
			break;
		}
	}

	const intake = await idb.getCalories('calorieIntake');
	for (const item of intake) {
		try {
			await fb.addCalories('calorieIntake', item);
			results.intake++;
		} catch {
			break;
		}
	}

	const burned = await idb.getCalories('calorieBurn');
	for (const item of burned) {
		try {
			await fb.addCalories('calorieBurn', item);
			results.burn++;
		} catch {
			break;
		}
	}

	return results;
};

/**
 * Exposes the timestamp helper from Firebase for date creation
 */
export { getFbTime } from '$lib/middleware/firebase';

/**
 * Exposes IndexedDB-specific utilities for local data management
 */
export {
	clearAllStores,
	hasLocalData,
	saveUserSettings,
	syncFromFirebase,
	fullSyncFromFirebase,
	persistInMemoryToIndexedDB
} from '$lib/middleware/idb';
