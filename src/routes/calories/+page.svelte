<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import CalorieEdit from '$lib/components/CalorieEdit.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { getAgeFactor, toHumanDate } from '$lib/scripts/helpers';
	import { calorieGoal } from '$lib/scripts/calories';
	import { settings } from '$lib/state/settings.svelte';
	import { userWeights } from '$lib/state/weight.svelte';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';
	import { activity } from '$lib/state/activityHistory.svelte';
	import type { EnergyItem, CalorieSelector } from '$lib/data/types';

	function groupCalories<K, V>(list: Array<V>, keyGetter: (input: V) => K): Map<K, Array<V>> {
		const map = new Map();
		list.forEach((item) => {
			const key = keyGetter(item);
			const collection = map.get(key);
			if (!collection) {
				map.set(key, [item]);
			} else {
				collection.push(item);
			}
		});
		return map;
	}

	const ageFactor = getAgeFactor(settings.gender);

	let sortedWeights = userWeights.sort((a, b) => b.date.seconds - a.date.seconds);
	let chartDataWeights = sortedWeights.map((weight) => {
		const caloricGoal = calorieGoal(
			settings.age,
			ageFactor,
			weight.weight,
			settings.height,
			settings.activityFactor,
			settings.deficit
		);
		return {
			group: 'Calorie Target',
			date: new Date(weight.date.seconds * 1000).toISOString(),
			value: caloricGoal
		};
	});
	let chartDataTdee = chartDataWeights.map((item) => {
		return {
			group: 'TDEE',
			date: item.date,
			value: item.value + settings.deficit
		};
	});

	let caloriesIn = $derived(
		calories.intake.map((item) => {
			return {
				id: item.id,
				name: item.name,
				energyValue: item.energyValue,
				date: item.date,
				type: 'intake'
			};
		})
	);

	let caloriesOut = $derived(
		calories.burned.map((item) => {
			return {
				id: item.id,
				name: item.name,
				energyValue: item.energyValue,
				date: item.date,
				type: 'output'
			};
		})
	);

	let union = $derived(
		caloriesIn.concat(caloriesOut).sort((a, b) => b.date.seconds - a.date.seconds)
	);

	let sorted = $derived(groupCalories(union, (calorie) => toHumanDate(calorie.date.seconds)));

	let chartSorted = $derived(
		Array.from(sorted).map((item) => {
			const totalValue = item[1].reduce((a: number, b: any) => {
				if (b.type === 'intake') {
					return a + b.energyValue;
				} else {
					return a - b.energyValue;
				}
			}, 0);
			/* @dev we need to sanitize the output as the chart can't
		    display 0 values with LOG scaling and with enough burned
			calories (i.e. exercise before eating anything)
			it may cause negative values to appear and crash
			the chart entirely
		*/
			return {
				group: 'Daily Intake',
				date: item[0],
				value: totalValue >= 0 ? totalValue : 0.0001
			};
		})
	);

	let tdeeAverage = () => {
		const totalTdee = chartDataTdee.reduce((a: any, b: any) => {
			return a + b.value;
		}, 0);
		const averages = totalTdee / chartDataTdee.length;
		return averages;
	};

	let calorieAverage = () => {
		const totalCalories = chartSorted.reduce((a: any, b: any) => {
			return a + b.value;
		}, 0);
		const averages = totalCalories / chartSorted.length;
		return averages;
	};

	/*
	 * @dev We want to remove "today" calories from the chart display
	 */
	let allData = $derived(chartSorted.slice(1).concat(chartDataWeights, chartDataTdee));

	let selectedEntry = $state<EnergyItem | null>(null);
	let selectedPath = $state<CalorieSelector | null>(null);
	let reInitModal = $state(Math.random());

	const openEditModal = (item: EnergyItem, itemType: string) => {
		selectedEntry = item;
		selectedPath = itemType === 'intake' ? 'calorieIntake' : 'calorieBurn';
		reInitModal = Math.random();
		(document.getElementById('calorieEditModal') as HTMLDialogElement)?.showModal();
	};

	let chartOptions = {
		axes: {
			left: {
				mapsTo: 'value',
				includeZero: false,
				scaleType: ScaleTypes.LOG
			},
			bottom: {
				scaleType: ScaleTypes.TIME,
				mapsTo: 'date'
			}
		},
		legend: {
			clickable: true,
			position: 'bottom',
			alignment: 'center'
		},
		toolbar: {
			enabled: false
		},
		curve: 'curveMonotoneX',
		height: '320px'
	};
</script>

<svelte:head>
	<title>CTrack - Calories</title>
</svelte:head>
<Container title="Chart">
	<div class="flex w-full flex-col gap-4 px-4 pb-4">
		<div class="card card-border bg-base-100 w-full items-center justify-center p-4 shadow">
			<LineChart options={chartOptions} data={allData}></LineChart>
		</div>
		<div class="w-full items-center">
			<div class="stats bg-base-100 flex self-center shadow">
				<div class="stat">
					<div class="stat-figure text-secondary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
							/>
						</svg>
					</div>
					<div class="stat-title">Average Intake</div>
					<div class="stat-value">{Math.round(calorieAverage())}</div>
					<div class="stat-desc">Calories</div>
				</div>

				<div class="stat">
					<div class="stat-figure text-secondary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
							/>
						</svg>
					</div>
					<div class="stat-title">Average TDEE</div>
					<div class="stat-value">{Math.round(tdeeAverage())}</div>
					<div class="stat-desc">Calories</div>
				</div>

				<div class="stat">
					<div class="stat-figure text-secondary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="size-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
							/>
						</svg>
					</div>
					<div class="stat-title">Tracking</div>
					<div class="stat-value">{chartSorted.length}</div>
					<div class="stat-desc">Days</div>
				</div>
			</div>
		</div>
	</div>
</Container>

<dialog id="calorieEditModal" class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		{#key reInitModal}
			{#if selectedEntry && selectedPath}
				<CalorieEdit entry={selectedEntry} path={selectedPath} />
			{/if}
		{/key}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
<Container title="Details">
	<div class="mx-4 my-2 w-full flex-row items-center justify-center">
		{#each sorted as calorie}
			<div class="card card-border bg-base-100 mb-3 shadow">
				<div class="card-body gap-0">
					<div class="mx-4 mb-2 inline-flex border-b border-dashed pb-2">
						<p class="text-xl">{calorie[0]}</p>
						<p class="text-right text-xl">
							{Math.round(
								calorie[1].reduce((a, b) => {
									if (b.type === 'intake') {
										return a + b.energyValue;
									} else {
										return a - b.energyValue;
									}
								}, 0)
							)} kcal
						</p>
					</div>
					{#each calorie[1] as item}
						<button
							class="hover:bg-base-300 inline-flex rounded border-l-amber-500 px-4 py-1 text-current/75 hover:cursor-pointer hover:border-l-8"
							onclick={() => openEditModal(item, item.type)}
						>
							<p class="text-left">{item.name} ({item.id})</p>
							<p
								class="text-right {item.type === 'intake' ? 'text-amber-500' : 'text-emerald-500'}"
							>
								{item.type === 'intake' ? '+' : '-'}{item.energyValue} kcal
							</p>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</Container>
