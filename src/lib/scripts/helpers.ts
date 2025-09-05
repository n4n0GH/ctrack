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
 * turn firebase seconds timestamp into a readable format
 * @param timestamp the firebase seconds
 * @returns a readable time string
 */
export const toHumanDate = (timestamp: number) => {
	return new Date(timestamp * 1000).toDateString();
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

/**
 * checks if a number has two digits and if not, pads it with a leading 0
 * @param time the number to add padding to
 * @returns the padded time string
 */
export const timePadding = (time: number) => {
	return String(time).padStart(2, '0');
};

/**
 *
 * @returns a new date as ISO string
 */
export const getIsoDate = () => {
	return new Date().toISOString();
};

/**
 *
 * @param date the date string
 * @param time the time string
 * @returns a timestamp data
 */
export const getStampedDate = (date: string, time: string) => {
	return new Date(date + 'T' + time).getTime();
};
