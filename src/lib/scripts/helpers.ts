import type { WeightItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';

/**
 * @param timestamp UNIX timestamp to compare
 * @returns boolean if timestamp matches "today"
 */
export const isToday = (timestamp: number) => {
	const now = Math.floor(Date.now() / 1000);
	const tStart = new Date(now - (now % 86400));
	return timestamp >= tStart.getTime() && timestamp < tStart.getTime() + 86400;
};

/**
 * determine the user's age factor
 * @param userGender male or female
 * @returns the age factor number
 */
export const getAgeFactor = (userGender: 'male' | 'female') => {
	return userGender == 'male' ? 5 : 4.7;
};

/**
 * finds the latest weight item in an array
 * @param weights an array of weights to compare
 * @returns the newest weight item
 */
export const findNewestWeight = (weights: WeightItem[] | DocumentData[]) => {
	return weights.reduce((a, b) => (a.date.seconds > b.date.seconds ? a : b));
};

/**
 * finds the lowest weight item in an array
 * @param weights an array of weights to compare
 * @returns the item with the lowest weight
 */
export const findLowestWeight = (weights: WeightItem[] | DocumentData[]) => {
	return weights.reduce((a, b) => (a.weight < b.weight ? a : b));
};

/**
 * finds the highest weight item in an array
 * @param weights an array of weights to compare
 * @returns the item with the highest weight
 */
export const findHighestWeight = (weights: WeightItem[] | DocumentData[]) => {
	return weights.reduce((a, b) => (a.weight > b.weight ? a : b));
};
