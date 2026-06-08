/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// `self` in a service worker is the ServiceWorkerGlobalScope, not a Window. The
// double cast tells the type-checker that, so skipWaiting/clients/FetchEvent etc.
// resolve correctly (the build-time worker lib already provides them).
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// A versioned cache so each deploy replaces the previous snapshot cleanly.
const CACHE = `ctrack-cache-${version}`;

// Everything needed to boot the app offline: the built JS/CSS (`build`), static
// assets like icons and the manifest (`files`), and the SPA fallback shell ('/')
// which the static adapter serves for every route.
const PRECACHE = [...build, ...files, '/'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			// Activate this worker immediately instead of waiting for old tabs to close.
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches from previous versions.
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// Only handle our own origin; let cross-origin (e.g. Firebase) hit the network.
	if (url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Navigations: always satisfy with the cached SPA shell so any route
			// (/, /calories, /settings, …) loads offline.
			if (request.mode === 'navigate') {
				const shell = (await cache.match('/')) || (await cache.match(request));
				if (shell) return shell;
			}

			// Precached/built assets: serve from cache first.
			const cached = await cache.match(request);
			if (cached) return cached;

			// Anything else: go to the network, caching successful same-origin GETs
			// so they're available next time offline.
			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic') {
					cache.put(request, response.clone());
				}
				return response;
			} catch (err) {
				// Offline and uncached — fall back to the shell for navigations.
				if (request.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}
				throw err;
			}
		})()
	);
});
