import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// The app is a client-rendered SPA (see `ssr = false` in +layout.ts), so we
		// ship a single static fallback page that the service worker can cache and
		// serve for every route — this is what lets the app boot offline.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
