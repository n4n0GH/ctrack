/**
 * IndexedDB storage module - mirrors the Firebase API surface
 * Used as a fallback when Firebase is unavailable (API limits, network issues, etc.)
 */

import { browser } from '$app/environment';
import type {
	EnergyItem,
	WeightItem,
	ActivityHistoryItem,
	UserSettings,
	OutboxOperation,
	OutboxEntry
} from '$lib/data/types';

const DB_NAME = 'ctrack-db';
// v2: outbox store for deferred Firebase writes.
// v3: data stores re-keyed onto Firebase document ids (shared id space).
const DB_VERSION = 3;

// Collection names matching Firebase
const STORES = {
	settings: 'userSettings',
	weight: 'weightHistory',
	intake: 'calorieIntake',
	burn: 'calorieBurn',
	activity: 'activityHistory'
} as const;

// Holds Firebase writes that failed and must be retried later. Kept out of
// STORES so the sync/clear helpers never wipe pending writes.
const OUTBOX_STORE = 'outbox';

type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * Opens (or creates) the IndexedDB database with all required object stores
 */
const openDb = (): Promise<IDBDatabase> => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			const oldVersion = event.oldVersion;

			// v3 migration: earlier versions keyed records on auto-incremented
			// numbers, disjoint from Firebase document ids. Drop the data stores so
			// they re-sync from Firebase under the shared id space. The outbox is
			// deliberately left untouched so queued writes survive the upgrade.
			if (oldVersion > 0 && oldVersion < 3) {
				for (const storeName of Object.values(STORES)) {
					if (db.objectStoreNames.contains(storeName)) {
						db.deleteObjectStore(storeName);
					}
				}
			}

			// Create object stores if they don't exist
			for (const storeName of Object.values(STORES)) {
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
				}
			}
			// Outbox for deferred Firebase writes.
			if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
				db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
			}
		};

		request.onsuccess = (event) => {
			resolve((event.target as IDBOpenDBRequest).result);
		};

		request.onerror = (event) => {
			reject(new Error(`IndexedDB open failed: ${(event.target as IDBOpenDBRequest).error}`));
		};
	});
};

/**
 * Generic helper to get all records from an object store
 */
const getAll = async <T>(storeName: StoreName): Promise<T[]> => {
	const db = await openDb();
	const tx = db.transaction(storeName, 'readonly');
	const store = tx.objectStore(storeName);
	const request = store.getAll();

	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as unknown as T[]);
		request.onerror = () => reject(request.error);
	});
};

/**
 * Generic helper to add a record to an object store
 * Returns a string id to match Firebase's behavior
 */
const addRecord = async <T extends Record<string, unknown>>(
	storeName: StoreName,
	data: T
): Promise<{ id: string; data: T }> => {
	const db = await openDb();
	const tx = db.transaction(storeName, 'readwrite');
	const store = tx.objectStore(storeName);
	const request = store.add(data);

	return new Promise((resolve, reject) => {
		request.onsuccess = () => {
			// Convert numeric auto-increment id to string to match Firebase
			resolve({ id: String(request.result), data });
		};
		request.onerror = () => reject(request.error);
	});
};

/**
 * Generic helper to update a record in an object store
 */
const updateRecord = async <T extends Record<string, unknown>>(
	storeName: StoreName,
	id: string,
	data: Partial<T>
): Promise<T> => {
	const db = await openDb();
	const tx = db.transaction(storeName, 'readwrite');
	const store = tx.objectStore(storeName);

	// Merge existing record with updates, preserving the id. Ids are shared with
	// Firebase (string document ids), so the key is used as-is.
	const getRequest = store.get(id);

	return new Promise((resolve, reject) => {
		getRequest.onsuccess = () => {
			const existing = getRequest.result as T | undefined;
			if (existing) {
				const updated = { ...existing, ...data } as T;
				const putRequest = store.put(updated);

				putRequest.onsuccess = () => resolve(updated);
				putRequest.onerror = () => reject(putRequest.error);
			} else {
				reject(new Error(`Record with id ${id} not found in ${storeName}`));
			}
		};
		getRequest.onerror = () => reject(getRequest.error);
	});
};

/**
 * Generic helper to get the count of records in an object store
 */
const getCount = async (storeName: StoreName): Promise<number> => {
	const db = await openDb();
	const tx = db.transaction(storeName, 'readonly');
	const store = tx.objectStore(storeName);
	const request = store.count();

	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
};

// ==================== PUBLIC API (mirrors firebase.ts) ====================

/**
 * Fetches the user settings from IndexedDB
 */
export const getUserSettings = async (): Promise<UserSettings | undefined> => {
	if (!browser) return undefined;
	const settings = await getAll<UserSettings>(STORES.settings);
	return settings[0];
};

/**
 * Fetches the user weight collection from IndexedDB
 */
export const getUserWeight = async (): Promise<WeightItem[]> => {
	if (!browser) return [];
	return getAll<WeightItem>(STORES.weight);
};

/**
 * Fetches the activity level history collection from IndexedDB
 */
export const getActivityHistory = async (): Promise<ActivityHistoryItem[]> => {
	if (!browser) return [];
	return getAll<ActivityHistoryItem>(STORES.activity);
};

/**
 * Fetches a calories collection from IndexedDB
 */
export const getCalories = async (path: 'calorieIntake' | 'calorieBurn'): Promise<EnergyItem[]> => {
	if (!browser) return [];
	const storeName = path === 'calorieIntake' ? STORES.intake : STORES.burn;
	return getAll<EnergyItem>(storeName);
};

/**
 * Updates an existing document inside calorie collection
 */
export const updateCalories = async (
	path: 'calorieIntake' | 'calorieBurn',
	docId: string,
	updateItem: EnergyItem
): Promise<{ success: boolean; data: EnergyItem }> => {
	if (!browser) return { success: false, data: updateItem };
	const storeName = path === 'calorieIntake' ? STORES.intake : STORES.burn;
	try {
		const updated = await updateRecord(storeName, docId, {
			name: updateItem.name,
			energyValue: updateItem.energyValue
		});
		return { success: true, data: updated as EnergyItem };
	} catch (e) {
		console.error('IndexedDB updateCalories error:', e);
		return { success: false, data: updateItem as unknown as EnergyItem };
	}
};

/**
 * Adds a new document to a calorie collection
 */
export const addCalories = async (
	path: 'calorieIntake' | 'calorieBurn',
	calorieItem: EnergyItem
): Promise<{ success: boolean; data: EnergyItem }> => {
	if (!browser) return { success: false, data: calorieItem };
	const storeName = path === 'calorieIntake' ? STORES.intake : STORES.burn;
	try {
		const result = await addRecord(storeName, calorieItem as Record<string, unknown>);
		return { success: true, data: { id: result.id, ...calorieItem } as EnergyItem };
	} catch (e) {
		console.error('IndexedDB addCalories error:', e);
		return { success: false, data: calorieItem };
	}
};

/**
 * Updates an existing document inside weightHistory collection
 */
export const updateWeight = async (
	docId: string,
	updateItem: WeightItem
): Promise<{ success: boolean; data: WeightItem }> => {
	if (!browser) return { success: false, data: updateItem };
	try {
		const updated = await updateRecord(STORES.weight, docId, {
			weight: updateItem.weight,
			date: updateItem.date,
			fat: updateItem.fat,
			muscle: updateItem.muscle,
			visceral: updateItem.visceral
		});
		return { success: true, data: { id: docId, ...updateItem } as WeightItem };
	} catch (e) {
		console.error('IndexedDB updateWeight error:', e);
		return { success: false, data: updateItem };
	}
};

/**
 * Adds a new document to the weightHistory collection
 */
export const addWeight = async (
	newWeight: WeightItem
): Promise<{ success: boolean; data: WeightItem }> => {
	if (!browser) return { success: false, data: newWeight };
	try {
		const result = await addRecord(STORES.weight, newWeight as Record<string, unknown>);
		return { success: true, data: { id: result.id, ...newWeight } as WeightItem };
	} catch (e) {
		console.error('IndexedDB addWeight error:', e);
		return { success: false, data: newWeight };
	}
};

/**
 * Adds or updates the user settings in IndexedDB
 */
export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
	if (!browser) return;
	const db = await openDb();
	const tx = db.transaction(STORES.settings, 'readwrite');
	const store = tx.objectStore(STORES.settings);

	const existing = await getAll<UserSettings>(STORES.settings);

	if (existing.length > 0) {
		// Update existing settings

		const updated = { ...existing[0], ...settings };
		const request = store.put(updated as unknown as IDBValidKey);
		await new Promise<void>((resolve, reject) => {
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} else {
		// Add new settings
		const request = store.add({ id: 'settings', ...settings } as unknown as IDBValidKey);
		await new Promise<void>((resolve, reject) => {
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
};

/**
 * Clears all data from IndexedDB (useful for debugging or full resync)
 */
export const clearAllStores = async (): Promise<void> => {
	if (!browser) return;
	const db = await openDb();
	const storeNames = Object.values(STORES) as StoreName[];
	const tx = db.transaction(storeNames, 'readwrite');
	for (const storeName of storeNames) {
		tx.objectStore(storeName).clear();
	}
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

// ==================== OUTBOX (deferred Firebase writes) ====================

/**
 * Appends a failed Firebase write to the outbox so it can be retried later.
 */
export const enqueueOutbox = async (op: OutboxOperation): Promise<void> => {
	if (!browser) return;
	const db = await openDb();
	const tx = db.transaction(OUTBOX_STORE, 'readwrite');
	// The autoIncrement keyPath assigns the `id`, so the op is stored as-is.
	tx.objectStore(OUTBOX_STORE).add(op as unknown as Record<string, unknown>);
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

/**
 * Returns all queued Firebase writes awaiting retry, oldest first.
 */
export const getOutbox = async (): Promise<OutboxEntry[]> => {
	if (!browser) return [];
	const db = await openDb();
	const tx = db.transaction(OUTBOX_STORE, 'readonly');
	const request = tx.objectStore(OUTBOX_STORE).getAll();
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result as OutboxEntry[]);
		request.onerror = () => reject(request.error);
	});
};

/**
 * Removes a queued write once it has been successfully flushed to Firebase.
 */
export const removeOutbox = async (id: number): Promise<void> => {
	if (!browser) return;
	const db = await openDb();
	const tx = db.transaction(OUTBOX_STORE, 'readwrite');
	tx.objectStore(OUTBOX_STORE).delete(id);
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

// ==================== BACKUP / RESTORE ====================

/**
 * A full snapshot of the IndexedDB contents, suitable for serialising to a
 * single backup file. `stores` maps each object-store name to all of its
 * records (keys are kept inline via each store's keyPath).
 */
export interface BackupFile {
	app: 'ctrack';
	version: number;
	exportedAt: string;
	stores: Record<string, unknown[]>;
}

/**
 * Exports every object store into a single, self-describing snapshot. Iterating
 * the live store list keeps the backup complete and future-proof as stores are
 * added.
 */
export const exportDatabase = async (): Promise<BackupFile> => {
	const base: BackupFile = {
		app: 'ctrack',
		version: DB_VERSION,
		exportedAt: new Date().toISOString(),
		stores: {}
	};
	if (!browser) return base;

	const db = await openDb();
	for (const name of Array.from(db.objectStoreNames)) {
		base.stores[name] = await new Promise<unknown[]>((resolve, reject) => {
			const tx = db.transaction(name, 'readonly');
			const request = tx.objectStore(name).getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}
	return base;
};

/**
 * Restores the database from a backup snapshot. Each store present in both the
 * backup and the live database is cleared and repopulated from the file; stores
 * the current schema doesn't have are skipped. Records are written with put()
 * so their original keys are preserved.
 *
 * @returns the number of records restored per store
 */
export const importDatabase = async (
	backup: BackupFile
): Promise<{ imported: Record<string, number> }> => {
	const imported: Record<string, number> = {};
	if (!browser) return { imported };

	const db = await openDb();
	const existing = new Set(Array.from(db.objectStoreNames));

	for (const [name, records] of Object.entries(backup.stores)) {
		if (!existing.has(name) || !Array.isArray(records)) continue;
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(name, 'readwrite');
			const store = tx.objectStore(name);
			store.clear();
			for (const record of records as Record<string, unknown>[]) {
				store.put(record);
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		imported[name] = records.length;
	}
	return { imported };
};

/**
 * Checks if IndexedDB has any data (for sync decisions)
 */
export const hasLocalData = async (): Promise<boolean> => {
	if (!browser) return false;
	const weights = await getUserWeight();
	const settings = await getUserSettings();
	const intake = await getCalories('calorieIntake');
	return !!(weights?.length > 0 || settings || intake?.length > 0);
};

/**
 * Exposes count helper for external sync logic
 */
export const getIdbCount = async (storeName: StoreName): Promise<number> => {
	if (!browser) return 0;
	return getCount(storeName);
};

/**
 * Compares the state of IndexedDB to Firebase storage and syncs
 * any collections where Firebase has more items than the local mirror.
 * Uses count queries to minimize unnecessary Firebase document fetches.
 * @returns Object indicating how many records were synced per collection
 */
export const syncFromFirebase = async (): Promise<{
	settings: number;
	weights: number;
	intake: number;
	burn: number;
	activity: number;
	synced: boolean;
}> => {
	if (!browser) {
		return { settings: 0, weights: 0, intake: 0, burn: 0, activity: 0, synced: false };
	}
	// Lazy import to avoid circular dependency issues at module load time
	const fb = await import('$lib/middleware/firebase');

	const results = {
		settings: 0,
		weights: 0,
		intake: 0,
		burn: 0,
		activity: 0,
		synced: false
	};

	// Helper to clear a store entirely
	const clearStore = async (storeName: StoreName): Promise<void> => {
		const db = await openDb();
		const tx = db.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).clear();
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	};

	// Helper to bulk-add records to a store
	const bulkAdd = async (
		storeName: StoreName,
		records: Record<string, unknown>[]
	): Promise<number> => {
		const db = await openDb();
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		for (const record of records) {
			// Preserve the `id` so IndexedDB and Firebase share one key space
			// (records without an id — e.g. settings/activity — fall back to the
			// store's autoIncrement generator). put() is idempotent, so a re-sync
			// can't throw a ConstraintError on an already-present key.
			store.put(record);
		}
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve(records.length);
			tx.onerror = () => reject(tx.error);
		});
	};

	// Sync helper: fetch from Firebase once, compare length with local count,
	// then replace local store only if Firebase has more records.
	// This avoids double-fetching since firestore/lite has no count aggregation API.
	const syncCollection = async (
		storeName: StoreName,
		fbFetch: () => Promise<Record<string, unknown>[]>,
		fieldKey: 'settings' | 'weights' | 'intake' | 'burn' | 'activity'
	): Promise<void> => {
		try {
			// Fetch Firebase data once - reuse for both comparison and sync
			const fbData = await fbFetch();
			const idbCount = await getCount(storeName);

			if (fbData.length > idbCount) {
				await clearStore(storeName);
				results[fieldKey] = await bulkAdd(storeName, fbData);
				results.synced = true;
			}
		} catch (err) {
			console.warn(`Failed to sync ${fieldKey} from Firebase:`, err);
		}
	};

	// Sync settings (single document collection)
	await syncCollection(
		STORES.settings,
		async () => {
			const settings = await fb.getUserSettings();
			return settings ? [settings] : [];
		},
		'settings'
	);

	// Sync weight history
	await syncCollection(STORES.weight, async () => await fb.getUserWeight(), 'weights');

	// Sync calorie intake
	await syncCollection(STORES.intake, async () => await fb.getCalories('calorieIntake'), 'intake');

	// Sync calorie burn
	await syncCollection(STORES.burn, async () => await fb.getCalories('calorieBurn'), 'burn');

	// Sync activity history
	await syncCollection(STORES.activity, async () => await fb.getActivityHistory(), 'activity');

	return results;
};

/**
 * Full overwrite sync: clears all IndexedDB stores and repopulates them
 * with fresh data from Firebase. Unlike syncFromFirebase, this does not
 * compare counts — it always overwrites everything.
 *
 * @returns Object indicating how many records were synced per collection
 */
export const fullSyncFromFirebase = async (): Promise<{
	settings: number;
	weights: number;
	intake: number;
	burn: number;
	activity: number;
	failedCollections: string[];
}> => {
	if (!browser) {
		return { settings: 0, weights: 0, intake: 0, burn: 0, activity: 0, failedCollections: [] };
	}
	// Lazy import to avoid circular dependency issues at module load time
	const fb = await import('$lib/middleware/firebase');

	// Wipe all local data before pulling fresh data from Firebase
	await clearAllStores();

	const results = {
		settings: 0,
		weights: 0,
		intake: 0,
		burn: 0,
		activity: 0,
		failedCollections: [] as string[]
	};

	// Helper to bulk-add records to a store
	const bulkAdd = async (
		storeName: StoreName,
		records: Record<string, unknown>[]
	): Promise<number> => {
		const db = await openDb();
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		for (const record of records) {
			// Preserve the `id` so IndexedDB and Firebase share one key space
			// (records without an id — e.g. settings/activity — fall back to the
			// store's autoIncrement generator). put() is idempotent, so a re-sync
			// can't throw a ConstraintError on an already-present key.
			store.put(record);
		}
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve(records.length);
			tx.onerror = () => reject(tx.error);
		});
	};

	// Sync helper: fetch from Firebase and bulk-write, tracking failures
	const syncCollection = async (
		storeName: StoreName,
		fbFetch: () => Promise<Record<string, unknown>[]>,
		fieldKey: 'settings' | 'weights' | 'intake' | 'burn' | 'activity'
	): Promise<void> => {
		try {
			const fbData = await fbFetch();
			results[fieldKey] = await bulkAdd(storeName, fbData);
		} catch (err) {
			// Record the failure but keep going — one collection failing must not
			// abort the remaining collections. The caller inspects failedCollections
			// to report partial success, so we resolve rather than reject here.
			console.warn(`Failed to sync ${fieldKey} from Firebase:`, err);
			results.failedCollections.push(fieldKey);
		}
	};

	// Sync settings (single document collection)
	await syncCollection(
		STORES.settings,
		async () => {
			const settings = await fb.getUserSettings();
			return settings ? [settings] : [];
		},
		'settings'
	);

	// Sync weight history
	await syncCollection(STORES.weight, async () => await fb.getUserWeight(), 'weights');

	// Sync calorie intake
	await syncCollection(STORES.intake, async () => await fb.getCalories('calorieIntake'), 'intake');

	// Sync calorie burn
	await syncCollection(STORES.burn, async () => await fb.getCalories('calorieBurn'), 'burn');

	// Sync activity history
	await syncCollection(STORES.activity, async () => await fb.getActivityHistory(), 'activity');

	return results;
};

/**
 * Persists the currently loaded in-memory data to IndexedDB.
 * Unlike fullSyncFromFirebase, this does NOT fetch from Firebase.
 * It takes the data that is already in memory (Svelte stores) and
 * writes it to IndexedDB, overwriting all existing entries.
 *
 * @returns Object indicating how many records were persisted per collection
 */
export const persistInMemoryToIndexedDB = async (data: {
	settings: UserSettings;
	weights: Record<string, unknown>[];
	intake: Record<string, unknown>[];
	burned: Record<string, unknown>[];
	activity: Record<string, unknown>[];
}): Promise<{
	settings: number;
	weights: number;
	intake: number;
	burn: number;
	activity: number;
}> => {
	if (!browser) {
		return { settings: 0, weights: 0, intake: 0, burn: 0, activity: 0 };
	}

	// Wipe all local data first
	await clearAllStores();

	const results = {
		settings: 0,
		weights: 0,
		intake: 0,
		burn: 0,
		activity: 0
	};

	// Helper to bulk-add records to a store
	const bulkAdd = async (
		storeName: StoreName,
		records: Record<string, unknown>[]
	): Promise<number> => {
		const db = await openDb();
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		for (const record of records) {
			// Preserve the `id` so IndexedDB and Firebase share one key space
			// (records without an id — e.g. settings/activity — fall back to the
			// store's autoIncrement generator). put() is idempotent, so a re-sync
			// can't throw a ConstraintError on an already-present key.
			store.put(record);
		}
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve(records.length);
			tx.onerror = () => reject(tx.error);
		});
	};

	// Persist settings
	if (data.settings) {
		try {
			results.settings = await bulkAdd(STORES.settings, [data.settings]);
		} catch (err) {
			console.warn('Failed to persist settings:', err);
		}
	}

	// Persist weights
	if (data.weights.length > 0) {
		try {
			results.weights = await bulkAdd(STORES.weight, data.weights);
		} catch (err) {
			console.warn('Failed to persist weights:', err);
		}
	}

	// Persist intake
	if (data.intake.length > 0) {
		try {
			results.intake = await bulkAdd(STORES.intake, data.intake);
		} catch (err) {
			console.warn('Failed to persist intake:', err);
		}
	}

	// Persist burned calories
	if (data.burned.length > 0) {
		try {
			results.burn = await bulkAdd(STORES.burn, data.burned);
		} catch (err) {
			console.warn('Failed to persist burned calories:', err);
		}
	}

	// Persist activity history
	if (data.activity.length > 0) {
		try {
			results.activity = await bulkAdd(STORES.activity, data.activity);
		} catch (err) {
			console.warn('Failed to persist activity:', err);
		}
	}

	return results;
};
