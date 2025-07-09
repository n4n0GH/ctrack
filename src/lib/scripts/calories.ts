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
 *
 * @param foodData list of historic food intake
 * @returns the amount of calories taken in "today"
 */
export const usedCalories = (foodData: EnergyItem[] | DocumentData[]) => {
	return Math.floor(
		foodData
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
