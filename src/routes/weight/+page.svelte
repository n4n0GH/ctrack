<script lang="ts">
	import { onMount } from 'svelte';
	import Container from '$lib/components/Container.svelte';
	import WeightEdit from '$lib/components/WeightEdit.svelte';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';
	import { userWeights } from '$lib/state/weight.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';
	import { settings } from '$lib/state/settings.svelte';
	import { getBmiLabel, getFatLevel } from '$lib/scripts/helpers';
	import type { WeightItem } from '$lib/data/types';

	// Lazy loading config
	let visibleCount = $state(28);
	const batchSize = 14;

	const loadMore = () => {
		visibleCount += batchSize;
	};

	// Full sorted weights array (used for non-reactive stats card)
	let weights = $derived(userWeights.slice().sort((a, b) => b.date.seconds - a.date.seconds));

	// Visible subset for list view and reactive chart
	let visibleWeights = $derived(weights.slice(0, visibleCount));

	let comparedWeights = $derived.by(() => {
		let compareWeight = 0;
		return visibleWeights
			.slice()
			.sort((a, b) => a.date.seconds - b.date.seconds)
			.map((weight) => {
				const change =
					weight.weight > compareWeight ? 'up' : weight.weight < compareWeight ? 'down' : 'no';
				const newDiff =
					compareWeight === 0 ? 0 : (Math.round((compareWeight - weight.weight) * 10) / 10) * -1;
				compareWeight = weight.weight;
				return {
					weight: weight.weight,
					change: change,
					diff: newDiff,
					date: toHumanDate(weight.date.seconds),
					timestamp: weight.date.seconds,
					details: !!weight.fat || !!weight.muscle || !!weight.visceral,
					fat: weight.fat || undefined,
					muscle: weight.muscle || undefined,
					visceral: weight.visceral || undefined,
					id: (weight as WeightItem & { id: string }).id
				};
			})
			.sort((a, b) => b.timestamp - a.timestamp);
	});

	// IntersectionObserver for lazy loading
	let sentinelElement: HTMLElement;
	let observer: IntersectionObserver;

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && visibleCount < weights.length) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);
		if (sentinelElement) {
			observer.observe(sentinelElement);
		}
		return () => {
			observer.disconnect();
		};
	});

	let selectedWeightEntry = $state<(WeightItem & { id: string }) | null>(null);
	let reInitModal = $state(Math.random());

	const openEditModal = (item: WeightItem & { id: string }) => {
		selectedWeightEntry = item;
		reInitModal = Math.random();
		(document.getElementById('weightEditModal') as HTMLDialogElement)?.showModal();
	};
	let chartData = $derived.by(() => {
		return visibleWeights.map((weight) => {
			return {
				group: 'Weight',
				date: new Date(weight.date.seconds * 1000).toISOString(),
				value: weight.weight
			};
		});
	});
	let weightDiff = {
		value: Math.round((settings.highestWeight - settings.currentWeight) * 10) / 10,
		loss: settings.highestWeight > settings.currentWeight
	};
	const getDuration = () => {
		const newest = weights.at(0);
		const oldest = weights.at(-1);
		const days = Math.round((newest?.date.seconds - oldest?.date.seconds) / 60 / 60 / 24);
		return days < 0 ? days * -1 : days;
	};
	const getAverage = () => {
		return Math.round(((weightDiff.value * 10) / getDuration()) * 30) / 10;
	};

	const getBmi = (weight: number, height: number) => {
		return Math.round((weight / (height / 100) ** 2) * 10) / 10;
	};
	const getBmiThreshold = (bmi: number, height: number) => {
		return Math.round(bmi * (height / 100) ** 2 * 10) / 10;
	};

	const currentBmi = getBmi(settings.currentWeight, settings.height);

	const getFatColor = (fat: number) => {
		const label = getFatLevel(fat, settings.age, settings.gender);
		return label === 'Obese'
			? 'text-red-500'
			: label === 'Overfat'
				? 'text-amber-500'
				: label === 'Healthy'
					? 'text-emerald-500'
					: 'text-sky-500';
	};

	const toKg = (percentage: number, totalWeight: number) => {
		return Math.round((totalWeight / 100) * percentage * 10) / 10;
	};

	// TODO generate second weight curve with an averaged predictive curve 1 month into the future

	const chartOptions = {
		axes: {
			left: {
				mapsTo: 'value',
				includeZero: false,
				scaleType: ScaleTypes.LOG,
				thresholds: [
					{
						value: getBmiThreshold(35, settings.height),
						label: 'BMI 35 - ' + getBmiLabel(35),
						fillColor: '#fb2c36'
					},
					{
						value: getBmiThreshold(30, settings.height),
						label: 'BMI 30 - ' + getBmiLabel(30),
						fillColor: '#ff6900'
					},
					{
						value: getBmiThreshold(25, settings.height),
						label: 'BMI 25 - ' + getBmiLabel(25),
						fillColor: '#fd9a00'
					},
					{
						value: 85.8,
						label: 'Average German Man',
						fillColor: '#00bc7d'
					}
				]
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

<svelte:head>
	<title>CTrack - Weight</title>
</svelte:head>
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
					<div class="stat-desc">In {getDuration()} Days</div>
				</div>
				<div class="md:stat hidden">
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
								d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
							/>
						</svg>
					</div>
					<div class="stat-title">BMI</div>
					<div class="stat-value">{currentBmi}</div>
					<div class="stat-desc">{getBmiLabel(currentBmi)}</div>
				</div>
			</div>
		</div>
	</div>
</Container>
<Container title="Details">
	<div class="mx-4 my-2 w-full flex-row items-center justify-center">
		{#each comparedWeights as weight}
			<div class="card card-border bg-base-100 group mb-3 shadow">
				<div class="card-body">
					<div class="inline-flex border-b border-dashed">
						<div class="flex items-center gap-2">
							<p class="text-xl">{weight.date}</p>
							<button
								class="btn btn-xs btn-ghost opacity-0 transition-opacity group-hover:opacity-100"
								aria-label="Edit weight entry"
								onclick={() =>
									openEditModal(
										weights.find(
											(w) => (w as WeightItem & { id: string }).id === weight.id
										)! as WeightItem & { id: string }
									)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="size-4"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
									/>
								</svg>
							</button>
						</div>
						<p class="text-right text-xl">
							{weight.weight} KG
						</p>
					</div>
					<div class="inline-flex text-current/75">
						<p class="text-left">Change</p>
						<p
							class="text-right {weight.change === 'up'
								? 'text-red-500'
								: weight.change === 'down'
									? 'text-emerald-500'
									: 'text-amber-500'}"
						>
							{weight.diff} KG
						</p>
					</div>
					{#if weight.details}
						{#if !!weight.muscle}
							<div class="inline-flex text-current/75">
								<p class="text-left">Muscle Mass</p>
								<p class="text-right">{weight.muscle}% ({toKg(weight.muscle, weight.weight)}KG)</p>
							</div>
						{/if}
						{#if !!weight.fat}
							<div class="inline-flex text-current/75">
								<p class="text-left">Body Fat</p>
								<p class="text-right {getFatColor(weight.fat)}">
									{weight.fat}% ({toKg(weight.fat, weight.weight)}KG)
								</p>
							</div>
						{/if}
						{#if !!weight.visceral}
							<div class="inline-flex text-current/75">
								<p class="text-left">Visceral Fat</p>
								<p
									class="text-right {weight.visceral >= 14
										? 'text-red-500'
										: weight.visceral >= 10
											? 'text-amber-500'
											: 'text-emerald-500'}"
								>
									{weight.visceral}
								</p>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
		{#if visibleCount < weights.length}
			<p class="mt-2 text-center text-current/50">Loading more...</p>
		{:else}
			<p class="mt-2 text-center text-current/50">End of history</p>
		{/if}
		<div bind:this={sentinelElement} class="h-1"></div>
	</div>
</Container>

<dialog id="weightEditModal" class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		{#key reInitModal}
			{#if selectedWeightEntry}
				<WeightEdit entry={selectedWeightEntry} />
			{/if}
		{/key}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
