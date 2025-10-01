<script lang="ts">
	import Container from '$lib/components/Container.svelte';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';
	import { userWeights } from '$lib/state/weight.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';
	import { settings } from '$lib/state/settings.svelte';

	let compareWeight = 0;
	let weights = userWeights.sort((a, b) => b.date.seconds - a.date.seconds);
	let comparedWeights = weights
		.sort((a, b) => a.date.seconds - b.date.seconds)
		.map((weight) => {
			const change =
				weight.weight > compareWeight ? 'up' : weight.weight < compareWeight ? 'down' : 'no';
			compareWeight = weight.weight;
			return {
				weight: weight.weight,
				change: change,
				date: toHumanDate(weight.date.seconds),
				timestamp: weight.date.seconds
			};
		})
		.sort((a, b) => b.timestamp - a.timestamp);
	let chartData = weights.map((weight) => {
		return {
			group: 'Weight',
			date: new Date(weight.date.seconds * 1000).toISOString(),
			value: weight.weight
		};
	});
	let weightDiff = {
		value: settings.highestWeight - settings.currentWeight,
		loss: settings.highestWeight > settings.currentWeight
	};
	const getDuration = () => {
		const newest = weights.at(0);
		const oldest = weights.at(-1);
		const days = Math.round((newest?.date.seconds - oldest?.date.seconds) / 60 / 60 / 24);
		return days < 0 ? days * -1 : days;
	};
	const getAverage = () => {
		return Math.round((weightDiff.value / getDuration()) * 30);
	};
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
	<div class="flex w-full flex-col gap-4 px-4 pb-4">
		<div class="card card-border bg-base-100 w-full items-center justify-center p-4 shadow">
			<LineChart options={chartOptions} data={chartData}></LineChart>
		</div>
		<div class="w-full items-center">
			<div class="stats bg-base-100 flex self-center shadow">
				<div class="stat">
					<div class="stat-figure text-secondary">
						{#if weightDiff.loss}
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
									d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181"
								/>
							</svg>
						{:else}
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
									d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
								/>
							</svg>
						{/if}
					</div>
					<div class="stat-title">Total {weightDiff.loss ? 'Loss' : 'Gain'}</div>
					<div class="stat-value">{weightDiff.loss ? '-' : '+'}{weightDiff.value} KG</div>
					<div class="stat-desc">Since Start</div>
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
								d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
							/>
						</svg>
					</div>
					<div class="stat-title">Average</div>
					<div class="stat-value">{weightDiff.loss ? '-' : '+'}{getAverage()} KG</div>
					<div class="stat-desc">Per Month</div>
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
					<div class="stat-title">Logging</div>
					<div class="stat-value">{getDuration()}</div>
					<div class="stat-desc">Days</div>
				</div>
			</div>
		</div>
	</div>
</Container>
<Container title="Details">
	<ul class="timeline timeline-vertical w-full items-center justify-center">
		{#each comparedWeights as weight}
			<li class="mb-2">
				<div class="timeline-start">{weight.date}</div>
				<div class="timeline-middle mx-6">
					{#if weight.change === 'up'}
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
								d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"
							/>
						</svg>
					{:else if weight.change === 'down'}<svg
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
								d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
							/>
						</svg>
					{:else}<svg
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
								d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
							/>
						</svg>
					{/if}
				</div>
				<div class="timeline-end timeline-box text-primary text-2xl font-bold">
					{weight.weight} KG
				</div>
			</li>
		{/each}
	</ul>
</Container>
