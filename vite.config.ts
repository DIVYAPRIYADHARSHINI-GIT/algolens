import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// AlgoLens is a pure static site: NO server routes, NO env vars, NO database, NO API keys.
// Everything the user saves (settings, named grids and graphs, practice scores) lives in
// localStorage behind the SettingsStore interface. Shared setups travel inside the URL hash,
// never through a server.
//
// adapter-static with a `200.html` SPA fallback means every route resolves on a direct URL
// and a hard refresh, on Vercel Hobby static hosting with no serverless function at all.
// The fallback is 200.html rather than index.html so the prerendered landing page keeps its
// real markup instead of being overwritten by a bare JS shell.
export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({ fallback: '200.html', precompress: false, strict: false })
		})
	],
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
