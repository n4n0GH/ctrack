<script lang="ts">
	import { settings } from '$lib/state/settings.svelte';
	import { userWeights } from '$lib/state/weight.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { activity } from '$lib/state/activityHistory.svelte';
	import { dataLoaded } from '$lib/scripts/stateModifier.svelte';
	import Container from '$lib/components/Container.svelte';
	import { fullSyncFromFirebase, persistInMemoryToIndexedDB } from '$lib/middleware/storage';

	let syncing = $state(false);
	let syncSuccess = $state(false);
	let syncError = $state(false);
	let syncResult = $state<{
		settings: number;
		weights: number;
		intake: number;
		burn: number;
		activity: number;
		failedCollections: string[];
	} | null>(null);

	let persisting = $state(false);
	let persistSuccess = $state(false);
	let persistError = $state(false);
	let persistResult = $state<{
		settings: number;
		weights: number;
		intake: number;
		burn: number;
		activity: number;
	} | null>(null);

	async function handleSync() {
		syncing = true;
		syncSuccess = false;
		syncError = false;
		syncResult = null;

		try {
			syncResult = await fullSyncFromFirebase();
			if (syncResult.failedCollections.length > 0) {
				// Partial sync - some collections failed
				syncError = true;
			} else {
				syncSuccess = true;
			}
		} catch {
			syncError = true;
		} finally {
			syncing = false;
		}
	}

	async function handlePersist() {
		persisting = true;
		persistSuccess = false;
		persistError = false;
		persistResult = null;

		try {
			// Svelte 5 $state values are reactive proxies, which the IndexedDB
			// structured-clone algorithm cannot serialize. Snapshot them into
			// plain objects/arrays before handing them off for persistence.
			persistResult = await persistInMemoryToIndexedDB({
				settings: $state.snapshot(settings),
				weights: $state.snapshot(userWeights),
				intake: $state.snapshot(calories.intake),
				burned: $state.snapshot(calories.burned),
				activity: $state.snapshot(activity.history)
			});
			persistSuccess = true;
		} catch {
			persistError = true;
		} finally {
			persisting = false;
		}
	}
</script>

<svelte:head>
	<title>CTrack - Settings</title>
</svelte:head>
<div class="flex flex-wrap">
	<Container title="User Settings">
		<div role="none" class="stats stats-vertical grow">
			<div class="stat">
				<div class="stat-title">Age</div>
				<div class="stat-value">{settings.age} years</div>
			</div>
			<div class="stat">
				<div class="stat-title">Height</div>
				<div class="stat-value">{settings.height} cm</div>
			</div>
			<div class="stat">
				<div class="stat-title">Gender</div>
				<div class="stat-value">{settings.gender}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Deficit</div>
				<div class="stat-value">{settings.deficit} kcal</div>
			</div>
			<div class="stat">
				<div class="stat-title">Starting Weight</div>
				<div class="stat-value">{settings.startingWeight} kg</div>
			</div>
			<div class="stat">
				<div class="stat-title">Activity Factor</div>
				<div class="stat-value">{settings.activityFactor}</div>
			</div>
			<div class="stat">
				<div class="stat-title">User Goal</div>
				<div class="stat-value">{settings.targetIsLoss ? 'Weight Loss' : 'Weight Gain'}</div>
			</div>
		</div>
		{#snippet clickable()}
			<button class="btn btn-soft btn-success grow">Update</button>
		{/snippet}
	</Container>
	<Container title="Data Handling">
		<div role="alert" class="alert alert-warning mx-auto">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span
				>Warning: Syncing will overwrite all existing IndexedDB entries with whatever is located
				inside the Firebase DB!</span
			>
		</div>
		{#if syncSuccess && syncResult}
			<div role="alert" class="alert alert-success mx-auto mt-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span
					>Synced: {syncResult.settings} settings, {syncResult.weights} weights,
					{syncResult.intake} intake, {syncResult.burn} burn, {syncResult.activity} activity</span
				>
			</div>
		{/if}
		{#if syncError}
			<div role="alert" class="alert alert-error mx-auto mt-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span
					>Sync failed for: {syncResult?.failedCollections?.join(', ') || 'all collections'}.</span
				>
			</div>
		{/if}
		{#if persistSuccess && persistResult}
			<div role="alert" class="alert alert-success mx-auto mt-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span
					>Persisted: {persistResult.settings} settings, {persistResult.weights} weights,
					{persistResult.intake} intake, {persistResult.burn} burn, {persistResult.activity} activity</span
				>
			</div>
		{/if}
		{#if persistError}
			<div role="alert" class="alert alert-error mx-auto mt-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 shrink-0 stroke-current"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>Persist to IndexedDB failed.</span>
			</div>
		{/if}
		{#snippet clickable()}
			<button class="btn btn-soft btn-success grow" onclick={handleSync} disabled={syncing}>
				{#if syncing}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 animate-spin"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
					Syncing...
				{:else}
					Sync to IndexedDB
				{/if}
			</button>
			<button
				class="btn btn-soft btn-success grow"
				onclick={handlePersist}
				disabled={persisting || !dataLoaded()}
			>
				{#if persisting}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 animate-spin"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
					Persisting...
				{:else}
					Persist to IndexedDB
				{/if}
			</button>
		{/snippet}
	</Container>
</div>
