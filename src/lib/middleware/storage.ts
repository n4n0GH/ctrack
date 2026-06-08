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
	UserSettings,
	OutboxOperation
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

/**
 * Generates a client-side unique id used as the shared key for both IndexedDB
 * and the Firebase document. This lets an offline-created item keep one stable
 * id across stores, so later edits and outbox retries always target it.
 */
const newId = (): string =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Queues a deferred Firebase write and flips the availability flag so the rest
 * of the session goes straight to the local-first path instead of re-hitting an
 * exhausted/unreachable backend.
 */
const enqueueAndMarkDown = async (op: OutboxOperation): Promise<void> => {
	isFirebaseAvailable = false;
	try {
		await idb.enqueueOutbox(op);
	} catch (e) {
		console.warn('Failed to queue Firebase write for retry:', e);
	}
};

/**
 * Attempts a Firebase write. On any failure — a thrown error, an unreachable
 * backend, or a rejected write (e.g. quota exceeded, which the Firebase layer
 * surfaces as `success: false` rather than throwing) — the operation is queued
 * in the IndexedDB outbox to be retried on a later page load.
 *
 * Never throws; returns true only when Firebase accepted the write.
 */
const tryFirebaseWrite = async (
	write: () => Promise<{ success: boolean }>,
	op: OutboxOperation
): Promise<boolean> => {
	if (!isFirebaseAvailable) {
		await enqueueAndMarkDown(op);
		return false;
	}
	try {
		const result = await write();
		if (result.success) return true;
		await enqueueAndMarkDown(op);
		return false;
	} catch {
		await enqueueAndMarkDown(op);
		return false;
	}
};

export const addCalories = async (path: CalorieSelector, calorieItem: EnergyItem) => {
	// Stamp a shared id up front so IndexedDB, Firebase, and any queued retry all
	// reference the same record.
	const item: EnergyItem = { ...calorieItem, id: calorieItem.id ?? newId() };
	// Local-first: persist to IndexedDB so the write is never lost, then push to
	// Firebase (queuing for retry if it is down). The local result is returned so
	// the UI updates regardless of Firebase availability.
	const local = await idb.addCalories(path, item);
	await tryFirebaseWrite(() => fb.addCalories(path, item), {
		type: 'addCalories',
		path,
		item
	});
	return local;
};

export const updateCalories = async (
	path: CalorieSelector,
	docId: string,
	updateItem: EnergyItem
) => {
	const local = await idb.updateCalories(path, docId, updateItem);
	await tryFirebaseWrite(() => fb.updateCalories(path, docId, updateItem), {
		type: 'updateCalories',
		path,
		docId,
		item: updateItem
	});
	return local;
};

export const addWeight = async (newWeight: WeightItem) => {
	const item: WeightItem = { ...newWeight, id: newWeight.id ?? newId() };
	const local = await idb.addWeight(item);
	await tryFirebaseWrite(() => fb.addWeight(item), {
		type: 'addWeight',
		item
	});
	return local;
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
	const local = await idb.updateWeight(docId, updateItem);
	await tryFirebaseWrite(() => fb.updateWeight(docId, updateItem), {
		type: 'updateWeight',
		docId,
		item: updateItem
	});
	return local;
};

/**
 * Retries all queued Firebase writes (the outbox). Intended to run in the
 * background on each page load: if Firebase is reachable again, every deferred
 * calorie/weight write is replayed in order and removed once accepted. If a
 * write still fails (e.g. quota not yet reset) the flush stops and the remaining
 * entries are left for the next page load.
 *
 * Never throws.
 */
export const flushOutbox = async (): Promise<{ flushed: number; remaining: number }> => {
	if (!browser) return { flushed: 0, remaining: 0 };

	let entries;
	try {
		entries = await idb.getOutbox();
	} catch (e) {
		console.warn('Failed to read outbox:', e);
		return { flushed: 0, remaining: 0 };
	}
	if (entries.length === 0) return { flushed: 0, remaining: 0 };

	// Only attempt the queued writes once Firebase is confirmed reachable.
	const online = await checkFirebase();
	if (!online) return { flushed: 0, remaining: entries.length };

	let flushed = 0;
	for (const entry of entries) {
		try {
			let ok = false;
			switch (entry.type) {
				case 'addCalories':
					ok = (await fb.addCalories(entry.path, entry.item)).success;
					break;
				case 'updateCalories':
					ok = (await fb.updateCalories(entry.path, entry.docId, entry.item)).success;
					break;
				case 'addWeight':
					ok = (await fb.addWeight(entry.item)).success;
					break;
				case 'updateWeight':
					ok = (await fb.updateWeight(entry.docId, entry.item)).success;
					break;
			}

			if (ok) {
				await idb.removeOutbox(entry.id);
				flushed++;
			} else {
				// Backend still rejecting writes — stop and retry on the next load.
				isFirebaseAvailable = false;
				break;
			}
		} catch {
			isFirebaseAvailable = false;
			break;
		}
	}

	return { flushed, remaining: entries.length - flushed };
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
	persistInMemoryToIndexedDB,
	exportDatabase,
	importDatabase
} from '$lib/middleware/idb';

export type { BackupFile } from '$lib/middleware/idb';
