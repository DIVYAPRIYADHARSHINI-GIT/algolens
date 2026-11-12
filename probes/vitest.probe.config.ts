// Separate config for live-browser probes so they never run in the unit suite.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			'#lib': fileURLToPath(new URL('../src/lib', import.meta.url))
		}
	},
	test: {
		include: ['probes/**/*.probe.ts'],
		environment: 'node',
		// Short timeouts: a hung browser test fails fast instead of stalling the run.
		testTimeout: 90_000,
		hookTimeout: 240_000,
		fileParallelism: false
	}
});
