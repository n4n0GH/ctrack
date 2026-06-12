<script lang="ts">
	import { getFbTime, lookupFood } from '$lib/middleware/storage';
	import { timePadding, getIsoDate, getStampedDate } from '$lib/scripts/helpers';
	import { Update } from '$lib/scripts/dataInit';
	import { calories } from '$lib/state/calories.svelte';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';

	let { mode }: { mode?: 'add' | 'burn' } = $props();

	let calorieName = $state('');
	let calorieValue = $state(0);
	let date = $state(getIsoDate().split('T')[0]);
	let time = $state(
		timePadding(new Date().getHours()) + ':' + timePadding(new Date().getMinutes())
	);

	let showSuggestions = $state(false);

	// === Barcode lookup (Open Food Facts) ===
	// Set once a product is scanned; while non-null the calorie value tracks the
	// portion (grams), since OFF reports energy per 100 g.
	let scannedKcal100 = $state<number | null>(null);
	let grams = $state(100);
	let scanOpen = $state(false);
	let scanError = $state('');
	let lookupPending = $state(false);

	const onBarcode = async (barcode: string) => {
		scanOpen = false;
		scanError = '';
		lookupPending = true;
		try {
			const food = await lookupFood(barcode);
			if (!food) {
				scanError = `No product found for ${barcode}.`;
				return;
			}
			calorieName = food.name;
			scannedKcal100 = food.kcal100;
			grams = food.servingGrams ?? 100;
		} finally {
			lookupPending = false;
		}
	};

	// Derive the calorie value from the portion for a scanned product. Only runs in
	// "scanned" mode, so manual entry (where scannedKcal100 stays null) is untouched.
	$effect(() => {
		if (scannedKcal100 !== null) {
			calorieValue = Math.round((scannedKcal100 * grams) / 100);
		}
	});

	const pushTo = new Update();

	/**
	 * The history relevant to the current mode: previously burned activities when
	 * burning, previously consumed items when adding.
	 */
	const source = $derived(mode === 'burn' ? calories.burned : calories.intake);

	/**
	 * One suggestion per unique name, keeping the most recently used calorie value
	 * so the autofill reflects the latest entry for that name.
	 */
	const suggestions = $derived.by(() => {
		const latest = new Map<string, { energyValue: number; seconds: number }>();
		for (const item of source) {
			const name = item.name?.trim();
			if (!name) continue;
			const existing = latest.get(name);
			if (!existing || item.date.seconds > existing.seconds) {
				latest.set(name, { energyValue: item.energyValue, seconds: item.date.seconds });
			}
		}
		return Array.from(latest, ([name, v]) => ({ name, energyValue: v.energyValue }));
	});

	/** Suggestions matching the current input, excluding an exact match. */
	const filtered = $derived.by(() => {
		const query = calorieName.trim().toLowerCase();
		if (!query) return [];
		return suggestions
			.filter((s) => {
				const name = s.name.toLowerCase();
				return name.includes(query) && name !== query;
			})
			.slice(0, 8);
	});

	const selectSuggestion = (suggestion: { name: string; energyValue: number }) => {
		calorieName = suggestion.name;
		// Autofill the calorie value; the user still confirms via the save button
		// in case the actual value differs for this entry.
		calorieValue = suggestion.energyValue;
		showSuggestions = false;
	};

	const createCalorieItem = () => {
		return {
			name: calorieName,
			energyValue: calorieValue,
			date: {
				seconds: getFbTime(getStampedDate(date, time)).seconds,
				nanoseconds: getFbTime(getStampedDate(date, time)).nanoseconds
			}
		};
	};

	const clearInput = () => {
		calorieName = '';
		calorieValue = 0;
		date = getIsoDate().split('T')[0];
		time = timePadding(new Date().getHours()) + ':' + timePadding(new Date().getMinutes());
		showSuggestions = false;
		scannedKcal100 = null;
		grams = 100;
		scanOpen = false;
		scanError = '';
	};

	const addConsumedCalories = async () => {
		await pushTo.calories('calorieIntake', createCalorieItem()).then(() => {
			clearInput();
		});
	};

	const addBurnedCalories = async () => {
		await pushTo.calories('calorieBurn', createCalorieItem()).then(() => {
			clearInput();
		});
	};
</script>

{#snippet nameField(label: string, placeholder: string)}
	<div class="relative w-full">
		<label class="input w-full">
			{label}
			<input
				type="text"
				class="grow"
				{placeholder}
				autocomplete="off"
				bind:value={calorieName}
				onfocus={() => (showSuggestions = true)}
				oninput={() => (showSuggestions = true)}
				onblur={() => setTimeout(() => (showSuggestions = false), 150)}
			/>
		</label>
		{#if showSuggestions && filtered.length > 0}
			<ul
				class="menu bg-base-200 rounded-box absolute top-full left-0 z-10 mt-1 max-h-60 w-full flex-nowrap overflow-y-auto p-2 shadow"
			>
				{#each filtered as suggestion}
					<li>
						<button
							type="button"
							class="flex justify-between"
							onclick={() => selectSuggestion(suggestion)}
						>
							<span class="truncate">{suggestion.name}</span>
							<span class="badge badge-neutral badge-sm shrink-0"
								>{suggestion.energyValue} kcal</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

{#if mode == 'add'}
	<div class="border-base-300 bg-base-100 flex flex-col gap-3">
		{@render nameField('Name', 'Borgir')}

		{#if scanOpen}
			<BarcodeScanner onScan={onBarcode} onError={(m) => (scanError = m)} />
			<button type="button" class="btn btn-soft btn-sm w-full" onclick={() => (scanOpen = false)}>
				Cancel scan
			</button>
		{:else}
			<button
				type="button"
				class="btn btn-soft btn-info w-full"
				onclick={() => {
					scanError = '';
					scanOpen = true;
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h.375m16.5 0h.375c.621 0 1.125.504 1.125 1.125v.375m0 13.5v.375c0 .621-.504 1.125-1.125 1.125h-.375m-16.5 0h-.375A1.125 1.125 0 0 1 3.75 19.125v-.375M3.75 8.25v7.5m16.5-7.5v7.5M7.5 4.5v15m9-15v15M5.25 4.5h.008M5.25 19.5h.008"
					/>
				</svg>
				Scan barcode
			</button>
		{/if}

		{#if lookupPending}
			<p class="text-center text-sm opacity-70">Looking up product…</p>
		{/if}
		{#if scanError}
			<div role="alert" class="alert alert-warning">
				<span>{scanError}</span>
			</div>
		{/if}

		{#if scannedKcal100 !== null}
			<label class="input w-full">
				Portion
				<input type="number" class="grow" min="0" placeholder="100" bind:value={grams} />
				<span class="badge badge-neutral badge-xs">g</span>
			</label>
		{/if}
		<label class="input w-full">
			Calories
			<input type="number" class="grow" placeholder="9001" bind:value={calorieValue} />
			<span class="badge badge-neutral badge-xs">kcal</span>
		</label>
		<label class="input w-full">
			Date
			<input type="date" class="input" bind:value={date} />
		</label>
		<label class="input w-full">
			Time
			<input type="time" class="input" bind:value={time} />
		</label>

		<button class="btn btn-success w-full" onclick={() => addConsumedCalories()}
			>Add Calories</button
		>
	</div>
{:else if mode == 'burn'}
	<div class="border-base-300 bg-base-100 flex flex-col gap-3">
		{@render nameField('Activity', 'Cycling')}
		<label class="input w-full">
			Calories
			<input type="number" class="grow" placeholder="9001" bind:value={calorieValue} />
			<span class="badge badge-neutral badge-xs">kcal</span>
		</label>
		<label class="input w-full">
			Date
			<input type="date" class="input" bind:value={date} />
		</label>
		<label class="input w-full">
			Time
			<input type="time" class="input" bind:value={time} />
		</label>

		<button class="btn btn-success w-full" onclick={() => addBurnedCalories()}>Burn Calories</button
		>
	</div>
{/if}
