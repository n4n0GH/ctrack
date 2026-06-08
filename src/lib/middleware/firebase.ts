import { initializeApp } from 'firebase/app';
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
// Read via the dynamic public env so a build with no Firebase credentials does
// not fail (a missing `$env/static/public` member is a hard build error). When
// PUBLIC_API_KEY is absent the app runs entirely on IndexedDB.
import { env } from '$env/dynamic/public';

import type {
	CalorieSelector,
	EnergyItem,
	WeightItem,
	ActivityHistoryItem,
	UserSettings
} from '$lib/data/types';

/**
 * Whether Firebase is configured for this build. Derived from the presence of a
 * public API key; when false the data layer never initialises or calls Firestore
 * and operates as an IndexedDB-only store.
 */
export const firebaseEnabled = Boolean(env.PUBLIC_API_KEY);

/**
 * Returns the document count for a given collection in Firebase.
 * Note: firestore/lite does not support count aggregation, so we use getDocs.
 * This is called once per collection during sync to decide whether a full fetch is needed.
 * @param collectionName the name of the Firebase collection
 * @returns the number of documents in the collection
 */
export const getCollectionCount = async (collectionName: string): Promise<number> => {
	const colRef = collection(db, collectionName);
	const snapshot = await getDocs(colRef);
	return snapshot.docs.length;
};

const firebaseConfig = {
	apiKey: env.PUBLIC_API_KEY,
	authDomain: env.PUBLIC_AUTH_DOMAIN,
	projectId: env.PUBLIC_PROJECT_ID,
	storageBucket: env.PUBLIC_STORAGE_BUCKET,
	messagingSenderId: env.PUBLIC_MESSAGE_SENDER_ID,
	appId: env.PUBLIC_APP_ID
};

// Only initialise Firebase when it is configured. The cast keeps the helpers
// below simply typed — they are only ever reached when `firebaseEnabled` is
// true, since the storage layer guards every Firestore call.
const db = (firebaseEnabled ? getFirestore(initializeApp(firebaseConfig)) : null) as Firestore;

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
	const settingsCol = collection(db, 'userSettings');
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
		const settingsCol = collection(db, 'userSettings');
		const snapshot = await getDocs(settingsCol);
		if (snapshot.docs.length > 0) {
			const docRef = doc(db, 'userSettings', snapshot.docs[0].id);
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
	const weightCol = collection(db, 'weightHistory');
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
	const activityCol = collection(db, 'activityHistory');
	const activities = await getDocs(activityCol);
	return activities.docs.map((doc) => doc.data());
};

/**
 * fetches a calories collection from firebase
 * @param path name of the calorie collection
 * @returns the list of calorie history objects
 */
export const getCalories = async (path: CalorieSelector) => {
	const caloriesCol = collection(db, path);
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
	const docRef = doc(db, path, docId);
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
			await setDoc(doc(db, path, id), payload);
		} else {
			await addDoc(collection(db, path), payload);
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
	const docRef = doc(db, 'weightHistory', docId);
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
			await setDoc(doc(db, 'weightHistory', id), payload);
		} else {
			await addDoc(collection(db, 'weightHistory'), payload);
		}
		updateSuccess = true;
	} catch (e) {
		console.error(e);
		updateSuccess = false;
	}
	return { success: updateSuccess, data: newWeight };
};
