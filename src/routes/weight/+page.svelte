<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Container from '$lib/components/Container.svelte';
	import WeightEdit from '$lib/components/WeightEdit.svelte';
	import { LineChart, ScaleTypes } from '@carbon/charts-svelte';
	import '@carbon/charts-svelte/styles.css';
	import { userWeights } from '$lib/state/weight.svelte';
	import { weightSettings } from '$lib/state/weightSettings.svelte';
	import { toHumanDate } from '$lib/scripts/helpers';
	import { settings } from '$lib/state/settings.svelte';
	import { getBmiLabel, getFatLevel } from '$lib/scripts/helpers';
	import type { WeightItem } from '$lib/data/types';

	// Lazy loading config
	let visibleCount = $state(28);
	const batchSize = 14;

	// === Chart height (mobile) ===
	// On small screens the chart eats a lot of vertical space, so we render it at
	// half height for mobile views.
	let isMobile = $state(false);
	let mobileQuery: MediaQueryList | null = null;
	let onMobileChange: ((e: MediaQueryListEvent) => void) | null = null;

	let chartHeight = $derived(isMobile ? '160px' : '320px');

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

		// Track viewport size so the chart only halves on mobile (< md breakpoint).
		mobileQuery = window.matchMedia('(max-width: 767px)');
		isMobile = mobileQuery.matches;
		onMobileChange = (e) => (isMobile = e.matches);
		mobileQuery.addEventListener('change', onMobileChange);

		return () => {
			observer.disconnect();
		};
	});

	onDestroy(() => {
		if (mobileQuery && onMobileChange) {
			mobileQuery.removeEventListener('change', onMobileChange);
		}
	});

	let selectedWeightEntry = $state<(WeightItem & { id: string }) | null>(null);
	let reInitModal = $state(Math.random());

	const openEditModal = (item: WeightItem & { id: string }) => {
		selectedWeightEntry = item;
		reInitModal = Math.random();
		(document.getElementById('weightEditModal') as HTMLDialogElement)?.showModal();
	};
	let chartData = $derived.by(() => {
		const series = visibleWeights.map((weight) => {
			return {
				group: 'Weight',
				date: new Date(weight.date.seconds * 1000).toISOString(),
				value: weight.weight
			};
		});
		// Append the predictive curve as a second series anchored to the latest
		// weight, so it visually continues the line into the future.
		if (projection) {
			series.push(
				{
					group: 'Projection',
					date: new Date(projection.startSeconds * 1000).toISOString(),
					value: projection.startWeight
				},
				{
					group: 'Projection',
					date: new Date(projection.endSeconds * 1000).toISOString(),
					value: projection.endWeight
				}
			);
		}
		return series;
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

	// Standard WHO BMI category boundaries (kg/m²), with a colour ramp from lean
	// (sky) to severe (dark red). BMI categories depend only on height, so each
	// boundary's *weight* is derived from settings.height; which three are shown
	// is chosen per user below.
	const BMI_GUIDES = [
		{ bmi: 18.5, color: '#0ea5e9' },
		{ bmi: 25, color: '#fd9a00' },
		{ bmi: 30, color: '#ff6900' },
		{ bmi: 35, color: '#fb2c36' },
		{ bmi: 40, color: '#c10007' }
	];

	/**
	 * Returns the three BMI category boundaries surrounding the user's current BMI
	 * so the guide lines stay relevant (and on-screen on the log axis) whether the
	 * user is lean or heavy, instead of a fixed 25/30/35. The line's weight value
	 * is still derived from height.
	 */
	const bmiGuideLines = (currentWeight: number, height: number) => {
		const bmi = getBmi(currentWeight, height);
		// First boundary at or above the current BMI; none means above the top band.
		let upper = BMI_GUIDES.findIndex((guide) => guide.bmi >= bmi);
		if (upper === -1) upper = BMI_GUIDES.length;
		// Window the boundary just below the user through the next two, clamped so
		// the slice always yields three entries.
		const start = Math.min(Math.max(upper - 1, 0), BMI_GUIDES.length - 3);
		return BMI_GUIDES.slice(start, start + 3).map((guide) => ({
			value: getBmiThreshold(guide.bmi, height),
			label: 'BMI ' + guide.bmi + ' - ' + getBmiLabel(guide.bmi),
			fillColor: guide.color
		}));
	};

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

	// === Predictive weight curve ===
	const PROJECTION_DAYS = 30; // how far ahead to project
	const DAY = 86400; // seconds in a day

	/**
	 * Least-squares slope (kg per day) for the given time/weight points, or null
	 * when a line can't be fit (fewer than two points, or no spread in time).
	 */
	const weightTrendPerDay = (points: { seconds: number; weight: number }[]): number | null => {
		const n = points.length;
		if (n < 2) return null;
		// Express time in days relative to the first point to keep the sums small.
		const t0 = points[0].seconds;
		let sumX = 0;
		let sumY = 0;
		let sumXX = 0;
		let sumXY = 0;
		for (const p of points) {
			const x = (p.seconds - t0) / DAY;
			const y = p.weight;
			sumX += x;
			sumY += y;
			sumXX += x * x;
			sumXY += x * y;
		}
		const denominator = n * sumXX - sumX * sumX;
		if (denominator === 0) return null; // all entries share one timestamp
		return (n * sumXY - sumX * sumY) / denominator;
	};

	/**
	 * A straight projection from the latest weight, extending the user's recent
	 * trend PROJECTION_DAYS into the future. Uses the last 30 days of entries (or
	 * the most recent handful when sparse) so it tracks current momentum rather
	 * than ancient history. Null when there isn't enough data or the trend would
	 * project to a non-positive weight (which the log axis can't plot).
	 */
	let projection = $derived.by(() => {
		// Off when the user has disabled the prediction (default on for older records).
		if (settings.showPrediction === false) return null;
		if (weights.length < 2) return null;
		const latest = weights[0]; // `weights` is sorted newest-first
		const cutoff = latest.date.seconds - PROJECTION_DAYS * DAY;
		let recent = weights.filter((w) => w.date.seconds >= cutoff);
		if (recent.length < 2) recent = weights.slice(0, Math.min(weights.length, 10));

		const points = recent
			.map((w) => ({ seconds: w.date.seconds, weight: w.weight }))
			.sort((a, b) => a.seconds - b.seconds);
		const slope = weightTrendPerDay(points);
		if (slope === null) return null;

		const endWeight = Math.round((latest.weight + slope * PROJECTION_DAYS) * 10) / 10;
		if (endWeight <= 0) return null;

		return {
			startSeconds: latest.date.seconds,
			endSeconds: latest.date.seconds + PROJECTION_DAYS * DAY,
			startWeight: latest.weight,
			endWeight
		};
	});

	// Derived so the chart re-renders at the reduced height once `chartHeight` changes.
	let chartOptions = $derived({
		axes: {
			left: {
				mapsTo: 'value',
				includeZero: false,
				scaleType: ScaleTypes.LOG,
				thresholds: [
					// BMI category boundaries surrounding the user's current BMI, derived
					// from their weight + height (recomputed reactively as settings change).
					...bmiGuideLines(settings.currentWeight, settings.height),
					// User-defined reference lines, managed on the settings page.
					...weightSettings.map((line) => ({
						value: line.value,
						label: line.label,
						fillColor: line.color
					}))
				]
			},
			bottom: {
				scaleType: ScaleTypes.TIME,
				mapsTo: 'date'
			}
		},
		color: {
			scale: {
				Weight: '#00bc7d',
				// Muted slate for the projection so it reads as an estimate, not data.
				Projection: '#94a3b8'
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
		height: chartHeight
	});
</script>

<svelte:head>
	<title>CTrack - Weight</title>
</svelte:head>

<Container title="Chart" sticky={true}>
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

				{#if projection}
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
									d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
								/>
							</svg>
						</div>
						<div class="stat-title">Projected</div>
						<div class="stat-value">{projection.endWeight} KG</div>
						<div class="stat-desc">In {PROJECTION_DAYS} Days</div>
					</div>
				{/if}
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
