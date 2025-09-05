<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';
	import { userWeights } from '$lib/state/weight.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';

	let weights = userWeights.sort((a, b) => b.date.seconds - a.date.seconds);
	let chartData = weights.map((weight) => {
		return {
			group: 'Weight',
			date: new Date(weight.date.seconds * 1000).toISOString(),
			value: weight.weight
		};
	});
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
		color: {
			scale: {
				Weight: '#00bc7d'
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
</script>

<Container title="Chart">
	<div class="mx-2 my-4 mr-8 w-full items-center justify-center">
		<LineChart options={chartOptions} data={chartData}></LineChart>
	</div>
</Container>
<Container title="Datapoints">
	<ul class="timeline timeline-vertical w-full items-center justify-center">
		{#each weights as weight}
			<li class="mb-2">
				<div class="timeline-start">{toHumanDate(weight.date.seconds)}</div>
				<div class="timeline-middle mx-6">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="h-5 w-5"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="timeline-end timeline-box text-primary text-2xl font-bold">
					{weight.weight} KG
				</div>
			</li>
		{/each}
	</ul>
</Container>
