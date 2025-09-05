<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';

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

	const chartOptions = {
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
			clickable: false,
			position: 'top',
			enabled: false
		},
		toolbar: {
			enabled: false
		},
		curve: 'curveMonotoneX',
		height: '320px'
	};

	let caloriesIn = calories.intake.map((item) => {
		return {
			name: item.name,
			energyValue: item.energyValue,
			date: item.date,
			type: 'intake'
		};
	});
	let caloriesOut = calories.burned.map((item) => {
		return {
			name: item.name,
			energyValue: item.energyValue,
			date: item.date,
			type: 'output'
		};
	});

	let union = caloriesIn.concat(caloriesOut).sort((a, b) => b.date.seconds - a.date.seconds);

	let sorted = groupCalories(union, (calorie) => toHumanDate(calorie.date.seconds));
	let chartSorted = Array.from(sorted).map((item) => {
		const totalValue = item[1].reduce((a: number, b: any) => {
			if (b.type === 'intake') {
				return a + b.energyValue;
			} else {
				return a - b.energyValue;
			}
		}, 0);
		return {
			group: 'Total Calories',
			date: item[0],
			value: totalValue
		};
	});
</script>

<Container title="Chart">
	<div class="mx-2 my-4 mr-8 w-full items-center justify-center">
		<LineChart options={chartOptions} data={chartSorted}></LineChart>
	</div>
</Container>
<Container title="Details">
	<div class="mx-4 my-2 w-full flex-row items-center justify-center">
		{#each sorted as calorie}
			<div class="card card-border bg-base-100 mb-3">
				<div class="card-body">
					<div class="inline-flex border-b border-dashed">
						<p class="text-xl">{calorie[0]}</p>
						<p class="text-right text-xl">
							{calorie[1].reduce((a, b) => {
								if (b.type === 'intake') {
									return a + b.energyValue;
								} else {
									return a - b.energyValue;
								}
							}, 0)} kcal
						</p>
					</div>
					{#each calorie[1] as item}
						<div class="inline-flex text-current/75">
							<p class="text-left">{item.name}</p>
							<p class="text-right">{item.type === 'intake' ? '+' : '-'}{item.energyValue} kcal</p>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</Container>
