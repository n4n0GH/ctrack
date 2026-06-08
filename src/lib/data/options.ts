import type { UserGoal } from '$lib/data/types';

/**
 * Selectable physical activity levels and their corresponding PAL multipliers
 * used in the BMR → TDEE calculation. These are the canonical Mifflin-St Jeor
 * activity factors, kept well within the "at most 10 levels" budget so the
 * dropdown stays meaningful rather than overwhelming.
 */
export const activityLevels: { label: string; value: number }[] = [
	{ label: 'Sedentary (little or no exercise)', value: 1.2 },
	{ label: 'Lightly active (light exercise 1–3 days/week)', value: 1.375 },
	{ label: 'Moderately active (moderate exercise 3–5 days/week)', value: 1.55 },
	{ label: 'Very active (hard exercise 6–7 days/week)', value: 1.725 },
	{ label: 'Extra active (very hard exercise or physical job)', value: 1.9 }
];

/**
 * Selectable user goals. `loss` and `gain` apply the configured deficit/surplus,
 * while `maintain` represents holding the current weight.
 */
export const goalOptions: { label: string; value: UserGoal }[] = [
	{ label: 'Weight Loss', value: 'loss' },
	{ label: 'Weight Gain', value: 'gain' },
	{ label: 'Maintain', value: 'maintain' }
];

/**
 * Maps a stored goal value to its human-readable label.
 */
export const goalLabel = (goal: UserGoal): string =>
	goalOptions.find((option) => option.value === goal)?.label ?? 'Maintain';
