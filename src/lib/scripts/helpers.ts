import type { WeightItem, BmiItem } from '$lib/data/types';
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

// Fallback for an empty weight history so the reducers below never throw
// "Reduce of empty array" — callers read `.weight`, which must stay defined.
const EMPTY_WEIGHT: WeightItem = { weight: 0, date: { seconds: 0, nanoseconds: 0 } };

/**
 * finds the latest weight item in an array
 * @param weights an array of weights to compare
 * @returns the newest weight item (a zero placeholder when the list is empty)
 */
export const findNewestWeight = (weights: WeightItem[] | DocumentData[]) => {
	if (weights.length === 0) return EMPTY_WEIGHT;
	return weights.reduce((a, b) => (a.date.seconds > b.date.seconds ? a : b));
};

/**
 * finds the lowest weight item in an array
 * @param weights an array of weights to compare
 * @returns the item with the lowest weight (a zero placeholder when empty)
 */
export const findLowestWeight = (weights: WeightItem[] | DocumentData[]) => {
	if (weights.length === 0) return EMPTY_WEIGHT;
	return weights.reduce((a, b) => (a.weight < b.weight ? a : b));
};

/**
 * finds the highest weight item in an array
 * @param weights an array of weights to compare
 * @returns the item with the highest weight (a zero placeholder when empty)
 */
export const findHighestWeight = (weights: WeightItem[] | DocumentData[]) => {
	if (weights.length === 0) return EMPTY_WEIGHT;
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

/**
 *
 * @param bmi the lookup value
 * @returns the bmi label
 */
export const getBmiLabel = (bmi: number) => {
	const dict: BmiItem[] = [
		{ label: 'Underweight', limit: 18.5 },
		{ label: 'Normal Weight', limit: 25 },
		{ label: 'Overweight', limit: 30 },
		{ label: 'Obesity Type I', limit: 35 },
		{ label: 'Obesity Type II', limit: 40 },
		{ label: 'Obesity Type III', limit: 999 }
	];

	const lookup = dict.find((entry) => entry.limit > bmi);
	if (lookup) {
		return lookup.label;
	} else {
		return 'Your weight and my phonenumber are not too far apart...';
	}
};

/**
 * finds out if the user is underfat, healthy, overfat or obese
 * @param fat the bodyfat percentage
 * @param age the user's age
 * @param gender the user's gender
 * @returns the bodyfat level as string
 */
export const getFatLevel = (fat: number, age: number, gender: 'male' | 'female') => {
	const dict = [
		{
			gender: 'female',
			limits: [
				{
					age: 39,
					levels: [
						{ label: 'Underfat', value: 21 },
						{ label: 'Healthy', value: 33 },
						{ label: 'Overfat', value: 39.5 }
					]
				},
				{
					age: 59,
					levels: [
						{ label: 'Underfat', value: 23 },
						{ label: 'Healthy', value: 34 },
						{ label: 'Overfat', value: 40 }
					]
				},
				{
					age: 79,
					levels: [
						{ label: 'Underfat', value: 24 },
						{ label: 'Healthy', value: 36.1 },
						{ label: 'Overfat', value: 41.5 }
					]
				}
			]
		},
		{
			gender: 'male',
			limits: [
				{
					age: 39,
					levels: [
						{ label: 'Underfat', value: 7 },
						{ label: 'Healthy', value: 20 },
						{ label: 'Overfat', value: 25 }
					]
				},
				{
					age: 59,
					levels: [
						{ label: 'Underfat', value: 10 },
						{ label: 'Healthy', value: 22 },
						{ label: 'Overfat', value: 28.4 }
					]
				},
				{
					age: 79,
					levels: [
						{ label: 'Underfat', value: 12 },
						{ label: 'Healthy', value: 25 },
						{ label: 'Overfat', value: 30 }
					]
				}
			]
		}
	];
	const lookup = dict
		.find((item) => item.gender === gender)
		?.limits.find((item) => item.age <= age)
		?.levels.find((item) => item.value <= fat);
	if (lookup) {
		return lookup.label;
	} else {
		return 'Obese';
	}
};
