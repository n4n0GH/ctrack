import { browser } from '$app/environment';

/**
 * Forces an installed PWA to pull the latest version while preserving all local
 * data.
 *
 * An installed homescreen app serves its shell and built JS/CSS from the service
 * worker's Cache Storage (cache-first), so a new deploy is not picked up until
 * that cache is dropped and the worker is replaced. This helper does exactly
 * that, then hard-reloads so the freshest build is fetched from the network and
 * a new worker re-precaches it.
 *
 * IndexedDB lives in a separate storage area and is never touched here, so the
 * user's calorie/weight history, settings, and Firebase config all survive.
 *
 * @returns true once the update steps have run (the page reload follows). On a
 *          platform without service worker / Cache Storage support, it still
 *          reloads so a normal refresh is attempted.
 */
export const forceUpdate = async (): Promise<boolean> => {
	if (!browser) return false;

	// 1. Drop every Cache Storage entry — these hold the stale HTML shell and the
	//    hashed JS/CSS bundles. IndexedDB is a different store and is left intact.
	if ('caches' in window) {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
	}

	// 2. Update then unregister any service worker so the next load is served
	//    fresh from the network rather than by the old worker. SvelteKit
	//    re-registers a new worker on the following load, which re-precaches the
	//    latest build.
	if ('serviceWorker' in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(
			registrations.map(async (registration) => {
				try {
					// Nudge the browser to fetch the newest worker script first.
					await registration.update();
				} catch {
					// Ignore — we unregister regardless so the stale worker can't serve.
				}
				return registration.unregister();
			})
		);
	}

	// 3. Hard reload to fetch the latest shell/assets from the network.
	location.reload();
	return true;
};
