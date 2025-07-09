<script lang="ts">
	import CalorieInput from '$lib/components/CalorieInput.svelte';
	import { getUserCalories } from '$lib/state/calories.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';

	let calories = getUserCalories();

	let intake = calories.intake.sort((a, b) => b.date.seconds - a.date.seconds);
</script>

<CalorieInput></CalorieInput>

{#each intake as calorie}
	<div class="card card-border bg-base-100 mb-3 w-96">
		<div class="card-body">
			<div class="stats">
				<div class="stat">
					<div class="stat-title">{calorie.name}</div>
					<div class="stat-value text-primary">{calorie.energyValue} kcal</div>
					<div class="stat-desc">{toHumanDate(calorie.date.seconds)}</div>
				</div>
			</div>
		</div>
	</div>
{/each}
