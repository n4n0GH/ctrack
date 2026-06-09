import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	type Firestore,
	collection,
	doc,
	getDocs,
	addDoc,
	setDoc,
	updateDoc,
	Timestamp
} from 'firebase/firestore/lite';
import { getFirebaseConfig } from '$lib/middleware/idb';

import type {
	CalorieSelector,
	EnergyItem,
	WeightItem,
	ActivityHistoryItem,
	UserSettings
} from '$lib/data/types';

// The Firebase client is initialised lazily from the user-supplied config stored
// in IndexedDB (entered on the settings page), so each device points at its own
// project. Until a valid config is present the app runs entirely on IndexedDB.
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let configured = false;

/**
 * Whether a Firebase config has been loaded and the client initialised. This is
 * a synchronous snapshot for guards/UI; it only becomes true after
 * `initFirebase()` has run successfully (which happens during app bootstrap).
 */
export const isFirebaseConfigured = (): boolean => configured;

/**
 * Loads the user-supplied Firebase config from IndexedDB and initialises the
 * client on first use. Idempotent — later calls reuse the existing instance.
 * Returns the Firestore handle, or null when no config has been entered yet.
 */
export const initFirebase = async (): Promise<Firestore | null> => {
	if (db) return db;
	const config = await getFirebaseConfig();
	if (!config?.apiKey) {
		configured = false;
		return null;
	}
	app = initializeApp(config);
	db = getFirestore(app);
	configured = true;
	return db;
};

/**
 * Returns the live Firestore handle, throwing if Firebase has not been
 * initialised. Every helper below is only reached after the storage layer has
 * confirmed availability via `initFirebase()`, so this never throws in practice.
 */
const requireDb = (): Firestore => {
	if (!db) throw new Error('Firebase has not been initialised');
	return db;
};

/**
 * Returns the document count for a given collection in Firebase.
 * Note: firestore/lite does not support count aggregation, so we use getDocs.
 * This is called once per collection during sync to decide whether a full fetch is needed.
 * @param collectionName the name of the Firebase collection
 * @returns the number of documents in the collection
 */
export const getCollectionCount = async (collectionName: string): Promise<number> => {
	const colRef = collection(requireDb(), collectionName);
	const snapshot = await getDocs(colRef);
	return snapshot.docs.length;
};

/**
 * Exposes Firebase timestamping util to the application
 * @param stamp UNIX millisecond timestamp
 * @returns Timestamp object with seconds and nanoseconds
 */
export const getFbTime = (stamp: number) => {
	return Timestamp.fromMillis(stamp);
};

/**
 * fetches the user settings from firebase
 * @returns the user settings object
 */
export const getUserSettings = async () => {
	const settingsCol = collection(requireDb(), 'userSettings');
	const settings = await getDocs(settingsCol);
	return settings.docs.map((doc) => doc.data())[0];
};

/**
 * Persists the user settings to Firebase. Updates the existing settings
 * document when one is present, otherwise creates it. Only the user-editable
 * fields are written — derived weight figures are recomputed on load.
 * @param settings the settings object to persist
 * @returns an object with the success status and data
 */
export const updateUserSettings = async (settings: UserSettings) => {
	let updateSuccess = false;
	const payload = {
		activityFactor: settings.activityFactor,
		age: settings.age,
		gender: settings.gender,
		height: settings.height,
		deficit: settings.deficit,
		startingWeight: settings.startingWeight,
		goal: settings.goal
	};
	try {
		const settingsCol = collection(requireDb(), 'userSettings');
		const snapshot = await getDocs(settingsCol);
		if (snapshot.docs.length > 0) {
			const docRef = doc(requireDb(), 'userSettings', snapshot.docs[0].id);
			await updateDoc(docRef, payload);
		} else {
			await addDoc(settingsCol, payload);
		}
		updateSuccess = true;
	} catch (e) {
		console.error(e);
		updateSuccess = false;
	}
	return { success: updateSuccess, data: settings };
};

/**
 * fetches the user weight collection from firebase
 * @returns the list of weight history objects
 */
export const getUserWeight = async () => {
	const weightCol = collection(requireDb(), 'weightHistory');
	const weights = await getDocs(weightCol);
	return weights.docs.map((doc) => {
		return {
			id: doc.id,
			...doc.data()
		};
	});
};

/**
 * fetches the activity level history collection from firebase
 * @returns the list of activity history objects
 */
export const getActivityHistory = async () => {
	const activityCol = collection(requireDb(), 'activityHistory');
	const activities = await getDocs(activityCol);
	return activities.docs.map((doc) => doc.data());
};

/**
 * fetches a calories collection from firebase
 * @param path name of the calorie collection
 * @returns the list of calorie history objects
 */
export const getCalories = async (path: CalorieSelector) => {
	const caloriesCol = collection(requireDb(), path);
	const calories = await getDocs(caloriesCol);
	return calories.docs.map((doc) => {
		return {
			id: doc.id,
			...doc.data()
		};
	});
};

/**
 * updates an existing document inside calorie collection
 * @param path name of the calorie collection
 * @param updateItem object with updated fields
 */
export const updateCalories = async (
	path: CalorieSelector,
	docId: string,
	updateItem: EnergyItem
) => {
	let updateSuccess = false;
	const docRef = doc(requireDb(), path, docId);
	await updateDoc(docRef, { name: updateItem.name, energyValue: updateItem.energyValue })
		.then(() => {
			updateSuccess = true;
		})
		.catch((e) => {
			console.error(e);
			updateSuccess = false;
		});
	return {
		success: updateSuccess,
		data: updateItem
	};
};

/**
 * adds a new document to a calorie collection
 * @param path name of the calorie collection
 * @param calorieItem object to add to the collection
 */
export const addCalories = async (path: CalorieSelector, calorieItem: EnergyItem) => {
	let updateSuccess = false;
	// Use the client-generated id as the document id (via setDoc) so the same
	// add can be replayed from the outbox idempotently — no duplicate documents.
	const { id, ...payload } = calorieItem;
	try {
		if (id) {
			await setDoc(doc(requireDb(), path, id), payload);
		} else {
			await addDoc(collection(requireDb(), path), payload);
		}
		updateSuccess = true;
	} catch (e) {
		console.error(e);
		updateSuccess = false;
	}
	return {
		success: updateSuccess,
		data: calorieItem
	};
};

/**
 * updates an existing document inside weightHistory collection
 * @param docId the firebase document id
 * @param updateItem object with updated fields
 */
export const updateWeight = async (docId: string, updateItem: WeightItem) => {
	let updateSuccess = false;
	const docRef = doc(requireDb(), 'weightHistory', docId);
	await updateDoc(docRef, {
		weight: updateItem.weight,
		date: Timestamp.fromMillis(updateItem.date.seconds * 1000),
		fat: updateItem.fat,
		muscle: updateItem.muscle,
		visceral: updateItem.visceral
	})
		.then(() => {
			updateSuccess = true;
		})
		.catch((e) => {
			console.error(e);
			updateSuccess = false;
		});
	return {
		success: updateSuccess,
		data: { id: docId, ...updateItem }
	};
};

/**
 * adds a new document to the weightHistory collection
 * @param newWeight object of type WeightItem to add to the collection
 * @returns an object with the success status and data
 */
export const addWeight = async (newWeight: WeightItem) => {
	let updateSuccess = false;
	// Use the client-generated id as the document id (via setDoc) so the same
	// add can be replayed from the outbox idempotently — no duplicate documents.
	const { id, ...payload } = newWeight;
	try {
		if (id) {
			await setDoc(doc(requireDb(), 'weightHistory', id), payload);
		} else {
			await addDoc(collection(requireDb(), 'weightHistory'), payload);
		}
		updateSuccess = true;
	} catch (e) {
		console.error(e);
		updateSuccess = false;
	}
	return { success: updateSuccess, data: newWeight };
};
