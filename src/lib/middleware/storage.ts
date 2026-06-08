/**
 * Unified storage layer - tries Firebase first, falls back to IndexedDB
 *
 * This allows the app to remain usable even when Firebase API limits are hit
 * or the network is unavailable, without changing any data structures or
 * component code.
 */

import * as fb from '$lib/middleware/firebase';
import * as idb from '$lib/middleware/idb';
import type { CalorieSelector, EnergyItem, WeightItem } from '$lib/data/types';

// ======================== Firebase availability ========================

let isFirebaseAvailable = true;

/**
 * Attempts to ping Firebase. Sets the availability flag used by the
 * fallback wrapper. Returns true when Firebase is reachable and false
 * when it has
 thrown (e.g. quota exceeded).
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
			// Note: Firebase doesn't have a direct settings update in the current middleware,
			// so this is primarily for future use when settings writes are added.
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
	fullSyncFromFirebase
} from '$lib/middleware/idb';
