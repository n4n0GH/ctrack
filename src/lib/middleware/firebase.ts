import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore/lite';
import {
	PUBLIC_API_KEY,
	PUBLIC_AUTH_DOMAIN,
	PUBLIC_PROJECT_ID,
	PUBLIC_STORAGE_BUCKET,
	PUBLIC_MESSAGE_SENDER_ID,
	PUBLIC_APP_ID
} from '$env/static/public';

import type { CalorieSelector } from '$lib/data/types';

const firebaseConfig = {
	apiKey: PUBLIC_API_KEY,
	authDomain: PUBLIC_AUTH_DOMAIN,
	projectId: PUBLIC_PROJECT_ID,
	storageBucker: PUBLIC_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_MESSAGE_SENDER_ID,
	appId: PUBLIC_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
 * fetches the user weight collection from firebase
 * @returns the list of weight history objects
 */
export const getUserWeight = async () => {
	const weightCol = collection(db, 'weightHistory');
	const weights = await getDocs(weightCol);
	return weights.docs.map((doc) => doc.data());
};

/**
 * fetches a calories collection from firebase
 * @param path name of the calorie collection
 * @returns the list of calorie history objects
 */
export const getCalories = async (path: CalorieSelector) => {
	const caloriesCol = collection(db, path);
	const calories = await getDocs(caloriesCol);
	return calories.docs.map((doc) => doc.data());
};
