<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/environment';
	import { forceUpdate } from '$lib/scripts/pwa';
	import { encodeConfig, generateQrDataUrl } from '$lib/scripts/qr';
	import QrScanner from '$lib/components/QrScanner.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import { userWeights } from '$lib/state/weight.svelte';
	import { weightSettings } from '$lib/state/weightSettings.svelte';
	import { calories } from '$lib/state/calories.svelte';
	import { activity } from '$lib/state/activityHistory.svelte';
	import { dataLoaded, updateSettings } from '$lib/scripts/stateModifier.svelte';
	import { WeightSettings } from '$lib/scripts/dataInit';
	import Container from '$lib/components/Container.svelte';
	import {
		fullSyncFromFirebase,
		persistInMemoryToIndexedDB,
		updateUserSettings,
		flushOutbox,
		exportDatabase,
		importDatabase,
		isFirebaseConfigured,
		getFirebaseConfig,
		saveFirebaseConfig,
		clearFirebaseConfig
	} from '$lib/middleware/storage';
	import type { BackupFile } from '$lib/middleware/storage';
	import { activityLevels, goalOptions } from '$lib/data/options';
	import type { UserGoal, UserSettings, FirebaseConfig, WeightSettingItem } from '$lib/data/types';

	// Whether a Firebase config is active on this device. Read once on mount; the
	// save/clear handlers reload the page so a fresh config initialises at boot.
	let firebaseEnabled = $state(isFirebaseConfigured());

	// === Firebase config (cloud sync) ===
	let fbForm = $state<FirebaseConfig>({
		apiKey: '',
		authDomain: '',
		projectId: '',
		storageBucket: '',
		messagingSenderId: '',
		appId: ''
	});
	let savingConfig = $state(false);
	let configSaved = $state(false);
	let configError = $state(false);
	let clearingConfig = $state(false);

	onMount(async () => {
		const existing = await getFirebaseConfig();
		if (existing) fbForm = existing;
	});

	async function handleSaveConfig() {
		savingConfig = true;
		configSaved = false;
		configError = false;

		const config = $state.snapshot(fbForm);
		// The apiKey and projectId are the minimum needed to reach a Firestore
		// project; the rest are filled from the same console config block.
		if (!config.apiKey.trim() || !config.projectId.trim()) {
			configError = true;
			savingConfig = false;
			return;
		}

		try {
			await saveFirebaseConfig(config);
			configSaved = true;
			// Reload so the new config is initialised at bootstrap and the local
			// data loader can fold in any existing cloud content.
			setTimeout(() => location.reload(), 900);
		} catch (e) {
			console.error('Failed to save Firebase config:', e);
			configError = true;
			savingConfig = false;
		}
	}

	// === Air-gapped credential transfer (QR) ===
	let qrDataUrl = $state('');
	let qrError = $state(false);
	let scanOpen = $state(false);
	let scanError = $state('');

	// The current form holds enough to share once an API key + project ID exist.
	let canShareConfig = $derived(Boolean(fbForm.apiKey.trim() && fbForm.projectId.trim()));

	async function handleShowQr() {
		qrError = false;
		qrDataUrl = '';
		try {
			qrDataUrl = await generateQrDataUrl(encodeConfig($state.snapshot(fbForm)));
			(document.getElementById('qrShareModal') as HTMLDialogElement)?.showModal();
		} catch (e) {
			console.error('Failed to generate QR:', e);
			qrError = true;
			(document.getElementById('qrShareModal') as HTMLDialogElement)?.showModal();
		}
	}

	function openScanner() {
		scanError = '';
		scanOpen = true;
		(document.getElementById('qrScanModal') as HTMLDialogElement)?.showModal();
	}

	function handleScanned(config: FirebaseConfig) {
		// Populate the form from the scanned credentials; the user reviews and
		// presses Connect to persist + reload (consistent with manual entry).
		fbForm = config;
		scanOpen = false;
		scanError = '';
		(document.getElementById('qrScanModal') as HTMLDialogElement)?.close();
		configSaved = false;
	}

	async function handleClearConfig() {
		if (
			!confirm(
				'Disconnect Firebase? Your local data stays on this device; cloud sync stops until you re-enter the config.'
			)
		) {
			return;
		}
		clearingConfig = true;
		configError = false;
		try {
			await clearFirebaseConfig();
			setTimeout(() => location.reload(), 600);
		} catch (e) {
			console.error('Failed to clear Firebase config:', e);
			configError = true;
			clearingConfig = false;
		}
	}

	// === App update (PWA) ===
	let updating = $state(false);
	let updateError = $state(false);

	async function handleForceUpdate() {
		if (
			!confirm('Force update to the latest version? Your local data is kept; the app will reload.')
		) {
			return;
		}
		updating = true;
		updateError = false;
		try {
			await forceUpdate();
			// forceUpdate triggers a reload; this line is only reached if it didn't.
		} catch (e) {
			console.error('Force update failed:', e);
			updateError = true;
			updating = false;
		}
	}

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

	// === Weight chart reference lines ===
	// Working copy of the weightSettings collection, edited as a list of rows.
	// Seeded from reactive state (loaded at boot); on save the list is persisted
	// wholesale and re-seeded with the canonical ids returned by the writer.
	type WeightLine = { id?: string; label: string; value: number; color: string };

	const toWeightLines = (items: (WeightSettingItem | Record<string, unknown>)[]): WeightLine[] =>
		items.map((l) => ({
			id: (l as WeightSettingItem).id,
			label: (l as WeightSettingItem).label,
			value: (l as WeightSettingItem).value,
			color: (l as WeightSettingItem).color
		}));

	let weightLines = $state<WeightLine[]>(toWeightLines(weightSettings));
	const weightSettingsApi = new WeightSettings();

	let savingWeightLines = $state(false);
	let weightLinesSaved = $state(false);
	let weightLinesError = $state(false);

	const addWeightLine = () => {
		weightLines.push({ label: '', value: 0, color: '#00bc7d' });
	};

	const removeWeightLine = (index: number) => {
		weightLines.splice(index, 1);
	};

	async function handleWeightLinesSave() {
		savingWeightLines = true;
		weightLinesSaved = false;
		weightLinesError = false;

		try {
			const items: WeightSettingItem[] = $state.snapshot(weightLines).map((line) => ({
				id: line.id,
				label: line.label.trim(),
				value: Number(line.value),
				color: line.color
			}));
			const result = await weightSettingsApi.save(items);
			if (result.success) {
				// Re-seed the editor so newly added rows pick up their generated ids.
				weightLines = toWeightLines(result.data);
				weightLinesSaved = true;
			} else {
				weightLinesError = true;
			}
		} catch (e) {
			console.error('Failed to save weight settings:', e);
			weightLinesError = true;
		} finally {
			savingWeightLines = false;
		}
	}

	let syncing = $state(false);
	let syncSuccess = $state(false);
	let syncError = $state(false);
	let syncResult = $state<{
		settings: number;
		weights: number;
		weightSettings: number;
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
		weightSettings: number;
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
				weightSettings: $state.snapshot(weightSettings),
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
	<Container title="Weight Graph Lines">
		<div class="flex w-full flex-col gap-4 px-4 pb-2">
			<p class="text-sm opacity-70">
				Horizontal reference lines drawn across the weight chart — e.g. a goal weight or a
				population average. Add as many as you like.
			</p>

			{#each weightLines as line, i (i)}
				<div class="flex flex-wrap items-end gap-2">
					<label class="floating-label grow">
						<span>Label</span>
						<input
							type="text"
							class="input input-bordered w-full"
							placeholder="Label"
							bind:value={line.label}
						/>
					</label>
					<label class="floating-label">
						<span>Value (kg)</span>
						<input
							type="number"
							step="0.1"
							class="input input-bordered w-28"
							placeholder="Value (kg)"
							bind:value={line.value}
						/>
					</label>
					<label class="floating-label">
						<span>Color</span>
						<input
							type="color"
							class="input input-bordered h-10 w-16 p-1"
							bind:value={line.color}
						/>
					</label>
					<button
						type="button"
						class="btn btn-soft btn-error btn-square"
						aria-label="Remove line"
						onclick={() => removeWeightLine(i)}
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
								d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
							/>
						</svg>
					</button>
				</div>
			{/each}

			<button
				type="button"
				class="btn btn-soft btn-success btn-sm self-start"
				onclick={addWeightLine}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="size-5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Add Line
			</button>

			{#if weightLinesSaved}
				<div role="alert" class="alert alert-success">
					<span>Graph lines saved.</span>
				</div>
			{/if}
			{#if weightLinesError}
				<div role="alert" class="alert alert-error">
					<span>Failed to save graph lines.</span>
				</div>
			{/if}
		</div>
		{#snippet clickable()}
			<button
				class="btn btn-soft btn-success grow"
				onclick={handleWeightLinesSave}
				disabled={savingWeightLines}
			>
				{#if savingWeightLines}
					Saving...
				{:else}
					Update
				{/if}
			</button>
		{/snippet}
	</Container>
	<Container title="Cloud Sync (Firebase)">
		<div class="flex w-full flex-col gap-4 px-4 pb-2">
			<p class="text-sm opacity-70">
				Optional. Paste your own Firebase web-app config to sync this device to your Firestore
				project. These are public project identifiers, stored only in this browser's local database.
				Leave blank to keep all data on-device.
			</p>

			{#if firebaseEnabled}
				<div role="alert" class="alert alert-success">
					<span>Connected — cloud sync is active on this device.</span>
				</div>
			{:else}
				<div role="alert" class="alert alert-info">
					<span>Not connected — data is stored locally on this device only.</span>
				</div>
			{/if}

			<label class="floating-label">
				<span>API Key</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="API Key"
					bind:value={fbForm.apiKey}
				/>
			</label>
			<label class="floating-label">
				<span>Auth Domain</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="project.firebaseapp.com"
					bind:value={fbForm.authDomain}
				/>
			</label>
			<label class="floating-label">
				<span>Project ID</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="Project ID"
					bind:value={fbForm.projectId}
				/>
			</label>
			<label class="floating-label">
				<span>Storage Bucket</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="project.firebasestorage.app"
					bind:value={fbForm.storageBucket}
				/>
			</label>
			<label class="floating-label">
				<span>Messaging Sender ID</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="Messaging Sender ID"
					bind:value={fbForm.messagingSenderId}
				/>
			</label>
			<label class="floating-label">
				<span>App ID</span>
				<input
					type="text"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="input input-bordered w-full"
					placeholder="App ID"
					bind:value={fbForm.appId}
				/>
			</label>

			<div class="divider my-0 text-xs opacity-60">Air-gapped transfer</div>
			<p class="text-sm opacity-70">
				Move credentials between devices without a network: show a QR on the configured device and
				scan it with the camera on the other.
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-soft btn-info grow"
					onclick={handleShowQr}
					disabled={!canShareConfig}
				>
					Show QR
				</button>
				<button type="button" class="btn btn-soft btn-info grow" onclick={openScanner}>
					Scan QR
				</button>
			</div>

			{#if configSaved}
				<div role="alert" class="alert alert-success">
					<span>Config saved. Reloading…</span>
				</div>
			{/if}
			{#if configError}
				<div role="alert" class="alert alert-error">
					<span>Failed to save — an API Key and Project ID are required.</span>
				</div>
			{/if}
		</div>
		{#snippet clickable()}
			<button
				class="btn btn-soft btn-success grow"
				onclick={handleSaveConfig}
				disabled={savingConfig || clearingConfig}
			>
				{savingConfig ? 'Saving…' : firebaseEnabled ? 'Update Config' : 'Connect'}
			</button>
			{#if firebaseEnabled}
				<button
					class="btn btn-soft btn-error grow"
					onclick={handleClearConfig}
					disabled={savingConfig || clearingConfig}
				>
					{clearingConfig ? 'Disconnecting…' : 'Disconnect'}
				</button>
			{/if}
		{/snippet}
	</Container>

	<dialog id="qrShareModal" class="modal modal-bottom sm:modal-middle">
		<div class="modal-box flex flex-col items-center gap-3">
			<h3 class="text-lg font-semibold">Scan on the other device</h3>
			{#if qrError}
				<div role="alert" class="alert alert-error">
					<span>Failed to generate the QR code.</span>
				</div>
			{:else if qrDataUrl}
				<img
					src={qrDataUrl}
					alt="Firebase config QR code"
					class="bg-white p-2"
					width="320"
					height="320"
				/>
				<p class="text-center text-sm opacity-70">
					Open Settings → Cloud Sync → Scan QR on the other device and point it here.
				</p>
			{/if}
			<form method="dialog" class="w-full">
				<button class="btn btn-soft w-full">Done</button>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<dialog
		id="qrScanModal"
		class="modal modal-bottom sm:modal-middle"
		onclose={() => (scanOpen = false)}
	>
		<div class="modal-box flex flex-col items-center gap-3">
			<h3 class="text-lg font-semibold">Scan config QR</h3>
			{#if scanOpen}
				<QrScanner onScan={handleScanned} onError={(m) => (scanError = m)} />
			{/if}
			{#if scanError}
				<div role="alert" class="alert alert-error">
					<span>{scanError}</span>
				</div>
			{/if}
			<form method="dialog" class="w-full">
				<button class="btn btn-soft w-full">Cancel</button>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<Container title="Data Handling">
		{#if firebaseEnabled}
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
		{:else}
			<div role="alert" class="alert alert-info mx-auto">
				<span>Firebase is not configured — all data is stored locally on this device only.</span>
			</div>
		{/if}
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
					{syncResult.weightSettings} lines, {syncResult.intake} intake, {syncResult.burn} burn,
					{syncResult.activity} activity</span
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
					{persistResult.weightSettings} lines, {persistResult.intake} intake, {persistResult.burn}
					burn, {persistResult.activity} activity</span
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
			{#if firebaseEnabled}
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
			{/if}
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
			{#if firebaseEnabled}
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
			{/if}
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
	<Container title="App Updates">
		<div class="flex w-full flex-col gap-2 px-1">
			<p class="text-sm opacity-70">
				Installed to your homescreen, the app caches itself to run offline and may keep serving an
				old version. Force update fetches the latest version from the web. Your local data is kept.
			</p>
			<p class="text-xs opacity-50">Current version: <span class="font-mono">{version}</span></p>
			{#if updateError}
				<div role="alert" class="alert alert-error mt-1">
					<span>Update failed. Check your connection and try again.</span>
				</div>
			{/if}
		</div>
		{#snippet clickable()}
			<button class="btn btn-soft btn-warning grow" onclick={handleForceUpdate} disabled={updating}>
				{#if updating}
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
					Updating…
				{:else}
					Force Update
				{/if}
			</button>
		{/snippet}
	</Container>
</div>
