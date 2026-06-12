<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

	let {
		onScan,
		onError
	}: {
		onScan: (barcode: string) => void;
		onError?: (message: string) => void;
	} = $props();

	let videoEl: HTMLVideoElement | null = $state(null);
	let controls: IScannerControls | null = null;
	let stopped = false;
	let status = $state('Requesting camera…');

	// MultiFormat covers product barcodes (EAN-13/8, UPC-A/E) as well as QR; jsQR
	// — used by the Firebase-config scanner — is QR-only and cannot read these.
	const reader = new BrowserMultiFormatReader();

	const fail = (message: string) => {
		status = message;
		onError?.(message);
	};

	const stop = () => {
		stopped = true;
		controls?.stop();
		controls = null;
	};

	onMount(async () => {
		// getUserMedia requires a secure context (https or localhost).
		if (!navigator.mediaDevices?.getUserMedia) {
			fail('Camera unavailable. A secure (https) connection is required.');
			return;
		}
		try {
			const scannerControls = await reader.decodeFromConstraints(
				{ video: { facingMode: 'environment' }, audio: false },
				videoEl ?? undefined,
				(result) => {
					if (result) {
						stop();
						onScan(result.getText());
					}
				}
			);
			if (stopped) {
				// Component was torn down while the permission prompt was open.
				scannerControls.stop();
				return;
			}
			controls = scannerControls;
			status = 'Point the camera at a barcode.';
		} catch (e) {
			console.error('Camera access failed:', e);
			fail('Camera access denied or no camera found.');
		}
	});

	onDestroy(stop);
</script>

<div class="flex w-full flex-col items-center gap-2">
	<div class="bg-base-300 relative aspect-square w-full max-w-xs overflow-hidden rounded-lg">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={videoEl} class="h-full w-full object-cover" playsinline muted></video>
		<div class="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70"></div>
	</div>
	<p class="text-center text-sm opacity-70">{status}</p>
</div>
