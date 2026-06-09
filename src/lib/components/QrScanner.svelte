<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import jsQR from 'jsqr';
	import { decodeConfig } from '$lib/scripts/qr';
	import type { FirebaseConfig } from '$lib/data/types';

	let {
		onScan,
		onError
	}: {
		onScan: (config: FirebaseConfig) => void;
		onError?: (message: string) => void;
	} = $props();

	let videoEl: HTMLVideoElement | null = $state(null);
	let stream: MediaStream | null = null;
	let rafId = 0;
	let stopped = false;
	let status = $state('Requesting camera…');

	// Offscreen canvas used to pull pixel data from the video for jsQR.
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	const fail = (message: string) => {
		status = message;
		onError?.(message);
	};

	const tick = () => {
		if (stopped) return;
		const video = videoEl;
		if (video && video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const result = jsQR(image.data, image.width, image.height, {
				inversionAttempts: 'dontInvert'
			});
			if (result) {
				const config = decodeConfig(result.data);
				if (config) {
					stop();
					onScan(config);
					return;
				}
				// A QR was read but it isn't a ctrack config — keep scanning.
				status = 'Unrecognised code — point at a CTrack config QR.';
			}
		}
		rafId = requestAnimationFrame(tick);
	};

	const stop = () => {
		stopped = true;
		cancelAnimationFrame(rafId);
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
	};

	onMount(async () => {
		// getUserMedia requires a secure context (https or localhost).
		if (!navigator.mediaDevices?.getUserMedia) {
			fail('Camera unavailable. A secure (https) connection is required.');
			return;
		}
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' },
				audio: false
			});
			if (stopped) {
				// Component was torn down while the permission prompt was open.
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
				status = 'Point the camera at the QR code.';
				rafId = requestAnimationFrame(tick);
			}
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
