// Benchmark Web Worker. All the heavy counting happens off the main thread, so the page
// never freezes, and progress is reported after each (algorithm, size) pair.

import { benchOne, type BenchMessage, type BenchRequest, type BenchSeries } from './benchmark.js';

self.onmessage = (event: MessageEvent<BenchRequest>) => {
	const request = event.data;
	try {
		const total = request.algorithms.length * request.sizes.length;
		let done = 0;
		const series: BenchSeries[] = [];
		for (const algorithm of request.algorithms) {
			const points = [];
			for (const n of request.sizes) {
				points.push(benchOne(algorithm, n, request.preset, request.seed));
				done++;
				(self as unknown as Worker).postMessage({ type: 'progress', done, total } satisfies BenchMessage);
			}
			series.push({ algorithm, points });
		}
		(self as unknown as Worker).postMessage({ type: 'result', series } satisfies BenchMessage);
	} catch (error) {
		(self as unknown as Worker).postMessage({
			type: 'error',
			message: error instanceof Error ? error.message : 'The benchmark failed.'
		} satisfies BenchMessage);
	}
};
