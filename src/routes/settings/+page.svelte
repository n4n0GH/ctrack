<script lang="ts">
	import { settings } from '$lib/state/settings.svelte';
	import { userWeights } from '$lib/state/weight.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { activity } from '$lib/state/activityHistory.svelte';
	import { dataLoaded, updateSettings } from '$lib/scripts/stateModifier.svelte';
	import Container from '$lib/components/Container.svelte';
	import {
		fullSyncFromFirebase,
		persistInMemoryToIndexedDB,
		updateUserSettings,
		flushOutbox,
		exportDatabase,
		importDatabase
	} from '$lib/middleware/storage';
	import type { BackupFile } from '$lib/middleware/storage';
	import { activityLevels, goalOptions } from '$lib/data/options';
	import type { UserGoal, UserSettings } from '$lib/data/types';

	// Local, editable copy of the user-configurable settings. Derived fields
	// (current/highest/lowest weight) are intentionally omitted — they are
	// computed from weight history, not edited here.
	let form = $state<{
		age: number;
		height: number;
		startingWeight: number;
		gender: 'male' | 'female';
		activityFactor: number;
		deficit: number;
		goal: UserGoal;
	}>({
		age: settings.age,
		height: settings.height,
		startingWeight: settings.startingWeight,
		gender: settings.gender,
		activityFactor: settings.activityFactor,
		deficit: settings.deficit,
		goal: settings.goal
	});

	let savingSettings = $state(false);
	let settingsSaved = $state(false);
	let settingsError = $state(false);

	let retrying = $state(false);
	let retryResult = $state<{ flushed: number; remaining: number } | null>(null);
	let retryError = $state(false);

	async function handleRetry() {
		retrying = true;
		retryResult = null;
		retryError = false;

		try {
			retryResult = await flushOutbox();
		} catch {
			retryError = true;
		} finally {
			retrying = false;
		}
	}

	// === Backup / Restore ===
	let exporting = $state(false);
	let exportError = $state(false);
	let restoring = $state(false);
	let restoreError = $state(false);
	let restoreResult = $state<Record<string, number> | null>(null);
	let restoreFileInput = $state<HTMLInputElement | null>(null);

	async function handleExport() {
		exporting = true;
		exportError = false;
		try {
			const backup = await exportDatabase();
			const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ctrack-backup-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Export failed:', e);
			exportError = true;
		} finally {
			exporting = false;
		}
	}

	async function handleRestoreFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Reset the input so selecting the same file again re-triggers change.
		input.value = '';
		if (!file) return;

		restoreError = false;
		restoreResult = null;

		let backup: BackupFile;
		try {
			backup = JSON.parse(await file.text());
		} catch {
			restoreError = true;
			return;
		}
		if (backup?.app !== 'ctrack' || typeof backup.stores !== 'object') {
			restoreError = true;
			return;
		}
		if (!confirm('Restore will overwrite all current local data with the backup. Continue?')) {
			return;
		}

		restoring = true;
		try {
			const result = await importDatabase(backup);
			restoreResult = result.imported;
			// Reload so the app re-reads the restored data into in-memory state.
			setTimeout(() => location.reload(), 900);
		} catch (e) {
			console.error('Restore failed:', e);
			restoreError = true;
		} finally {
			restoring = false;
		}
	}

	async function handleSettingsSave() {
		savingSettings = true;
		settingsSaved = false;
		settingsError = false;

		try {
			// Preserve the derived/computed fields already in state, overriding
			// only the values the user can edit on this form.
			const updated: UserSettings = {
				...$state.snapshot(settings),
				age: Number(form.age),
				height: Number(form.height),
				startingWeight: Number(form.startingWeight),
				gender: form.gender,
				activityFactor: Number(form.activityFactor),
				deficit: Number(form.deficit),
				goal: form.goal
			};

			// Update reactive state first so BMR/TDEE recalculate immediately,
			// then persist local-first with a best-effort push to Firebase.
			updateSettings(updated);
			const result = await updateUserSettings(updated);
			if (result.success) {
				settingsSaved = true;
			} else {
				settingsError = true;
			}
		} catch (e) {
			console.error('Failed to save settings:', e);
			settingsError = true;
		} finally {
			savingSettings = false;
		}
	}

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
		<form
			class="flex w-full flex-col gap-4 px-4 pb-2"
			onsubmit={(e) => {
				e.preventDefault();
				handleSettingsSave();
			}}
		>
			<label class="floating-label">
				<span>Age (years)</span>
				<input
					type="number"
					min="0"
					max="120"
					class="input input-bordered w-full"
					placeholder="Age (years)"
					bind:value={form.age}
				/>
			</label>

			<label class="floating-label">
				<span>Height (cm)</span>
				<input
					type="number"
					min="0"
					max="260"
					class="input input-bordered w-full"
					placeholder="Height (cm)"
					bind:value={form.height}
				/>
			</label>

			<label class="floating-label">
				<span>Starting Weight (kg)</span>
				<input
					type="number"
					min="0"
					max="500"
					step="0.1"
					class="input input-bordered w-full"
					placeholder="Starting Weight (kg)"
					bind:value={form.startingWeight}
				/>
			</label>

			<label class="floating-label">
				<span>Gender</span>
				<select class="select select-bordered w-full" bind:value={form.gender}>
					<option value="male">Male</option>
					<option value="female">Female</option>
				</select>
			</label>

			<label class="floating-label">
				<span>Activity Level</span>
				<select class="select select-bordered w-full" bind:value={form.activityFactor}>
					{#each activityLevels as level (level.value)}
						<option value={level.value}>{level.label}</option>
					{/each}
				</select>
			</label>

			<label class="floating-label">
				<span>User Goal</span>
				<select class="select select-bordered w-full" bind:value={form.goal}>
					{#each goalOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>

			<div class="w-full">
				<div class="mb-1 flex justify-between text-sm">
					<span>Daily Deficit</span>
					<span class="font-mono">{form.deficit} kcal</span>
				</div>
				<input
					type="range"
					min="0"
					max="1000"
					step="10"
					class="range range-success w-full"
					bind:value={form.deficit}
				/>
				<div class="mt-1 flex justify-between text-xs opacity-60">
					<span>0</span>
					<span>1000</span>
				</div>
			</div>

			{#if settingsSaved}
				<div role="alert" class="alert alert-success">
					<span>Settings saved.</span>
				</div>
			{/if}
			{#if settingsError}
				<div role="alert" class="alert alert-error">
					<span>Failed to save settings.</span>
				</div>
			{/if}
		</form>
		{#snippet clickable()}
			<button
				class="btn btn-soft btn-success grow"
				onclick={handleSettingsSave}
				disabled={savingSettings}
			>
				{#if savingSettings}
					Saving...
				{:else}
					Update
				{/if}
			</button>
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
		{#if retryResult}
			<div
				role="alert"
				class="alert mx-auto mt-2 {retryResult.remaining > 0 ? 'alert-warning' : 'alert-success'}"
			>
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
				{#if retryResult.flushed === 0 && retryResult.remaining === 0}
					<span>Nothing to retry — all writes are already synced.</span>
				{:else}
					<span
						>Retried {retryResult.flushed} pending write{retryResult.flushed === 1 ? '' : 's'}.
						{retryResult.remaining} still pending.</span
					>
				{/if}
			</div>
		{/if}
		{#if retryError}
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
				<span>Retry failed. Firebase may still be unavailable.</span>
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
			<button class="btn btn-soft btn-warning grow" onclick={handleRetry} disabled={retrying}>
				{#if retrying}
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
					Retrying...
				{:else}
					Retry Failed Syncs
				{/if}
			</button>
		{/snippet}
	</Container>
	<Container title="Backup & Restore">
		<div class="flex w-full flex-col gap-2 px-1">
			<p class="text-sm opacity-70">
				Export your entire local database to a single file, or restore it from a previous export.
			</p>
			{#if exportError}
				<div role="alert" class="alert alert-error mt-1">
					<span>Export failed.</span>
				</div>
			{/if}
			{#if restoreResult}
				<div role="alert" class="alert alert-success mt-1">
					<span
						>Restored {Object.values(restoreResult).reduce((a, b) => a + b, 0)} records. Reloading…</span
					>
				</div>
			{/if}
			{#if restoreError}
				<div role="alert" class="alert alert-error mt-1">
					<span>Restore failed — the file is not a valid CTrack backup.</span>
				</div>
			{/if}
		</div>
		<input
			type="file"
			accept="application/json"
			class="hidden"
			bind:this={restoreFileInput}
			onchange={handleRestoreFile}
		/>
		{#snippet clickable()}
			<button class="btn btn-soft btn-success grow" onclick={handleExport} disabled={exporting}>
				{exporting ? 'Exporting…' : 'Export Backup'}
			</button>
			<button
				class="btn btn-soft btn-warning grow"
				onclick={() => restoreFileInput?.click()}
				disabled={restoring}
			>
				{restoring ? 'Restoring…' : 'Restore Backup'}
			</button>
		{/snippet}
	</Container>
</div>
