import type { EnergyItem } from '$lib/data/types';
import type { DocumentData } from 'firebase/firestore';
import { isToday } from '$lib/scripts/helpers';

/**
 * @param age user's age
 * @param ageModifier the gender based age modifier
 * @param weight user's weight
 * @param height user's height
 * @param activityFactor the physical activity level
 * @param deficit user defined calorie deficit
 * @returns daily calorie goal using the Mifflin-St Jeor equation
 */
export const calorieGoal = (
	age: number,
	ageModifier: number,
	weight: number,
	height: number,
	activityFactor: number,
	deficit: number
) => {
	const a = ageModifier * age;
	const w = 10 * weight;
	const h = 6.25 * height;
	const bmr = w + h - a;
	return bmr * activityFactor - deficit;
};

/**
 * parses through a list of items to calculate a value for today's calories
 * @param calorieData list of historic food intake
 * @returns the amount of calories for "today"
 */
export const usedCalories = (calorieData: (EnergyItem | DocumentData)[]) => {
	return Math.floor(
		calorieData
			.map((item) => {
				const sameDay = isToday(item.date.seconds);
				return sameDay ? item.energyValue : 0;
			})
			.reduce((a, b) => a + b, 0)
	);
};

/**
 *
 * @param totalCalories
 * @param usedCalories
 * @param deficit
 * @returns amount to reduce the daily calorie deficit by
 */
export const deficitReduction = (totalCalories: number, usedCalories: number, deficit: number) => {
	return totalCalories < usedCalories ? usedCalories - totalCalories : 0;
};

/**
 * Calculates an estimate of burned calories for a specific cardio exercise using MET and time
 * @param weight user's current weight
 * @param time value in minutes
 * @param met metabolic equivalent value of exercise
 * @returns the amount of burned calories
 */
export const calculateCardioCalories = (weight: number, time: number, met: number) => {
	return met * weight * (time / 60) * 1.036;
};

/**
 *
 * @param v average speed in kph
 * @param d total driven distance in km
 * @param w user weight in kg
 * @returns the estimated amount of burned calories
 */
export const calculateCyclingCalories = (v: number, d: number, w: number) => {
	return ((v * d) / 3.5) * w * 0.0034;
};
