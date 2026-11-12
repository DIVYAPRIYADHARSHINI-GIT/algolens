// Benchmark core: counts OPERATIONS, never wall-clock time (which is noisy and machine
// dependent). The counting versions below are deliberately separate from the step
// recorders: recording 5,000-element runs would allocate millions of Step objects, while
// these just increment integers.

export interface BenchPoint {
	n: number;
	comparisons: number;
	writes: number;
}

export interface BenchSeries {
	algorithm: string;
	points: BenchPoint[];
}

export interface BenchRequest {
	algorithms: string[];
	sizes: number[];
	seed: number;
	preset: 'random' | 'sorted' | 'reversed' | 'few-unique';
}

export type BenchMessage =
	| { type: 'progress'; done: number; total: number }
	| { type: 'result'; series: BenchSeries[] }
	| { type: 'error'; message: string };

function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function buildInput(preset: BenchRequest['preset'], n: number, seed: number): number[] {
	const rand = rng(seed + n);
	switch (preset) {
		case 'sorted':
			return Array.from({ length: n }, (_, i) => i);
		case 'reversed':
			return Array.from({ length: n }, (_, i) => n - i);
		case 'few-unique':
			return Array.from({ length: n }, () => Math.floor(rand() * 8));
		default:
			return Array.from({ length: n }, () => Math.floor(rand() * n * 2));
	}
}

interface Counter {
	comparisons: number;
	writes: number;
}

/** Counting-only implementations. Each matches its recorder's comparison discipline. */
export const COUNTERS: Record<string, (a: number[], c: Counter) => void> = {
	bubble(a, c) {
		for (let i = 0; i < a.length - 1; i++) {
			let swapped = false;
			for (let j = 0; j < a.length - 1 - i; j++) {
				c.comparisons++;
				if (a[j] > a[j + 1]) {
					[a[j], a[j + 1]] = [a[j + 1], a[j]];
					c.writes += 2;
					swapped = true;
				}
			}
			if (!swapped) break;
		}
	},
	selection(a, c) {
		for (let i = 0; i < a.length - 1; i++) {
			let min = i;
			for (let j = i + 1; j < a.length; j++) {
				c.comparisons++;
				if (a[j] < a[min]) min = j;
			}
			if (min !== i) {
				[a[i], a[min]] = [a[min], a[i]];
				c.writes += 2;
			}
		}
	},
	insertion(a, c) {
		for (let i = 1; i < a.length; i++) {
			const key = a[i];
			let j = i - 1;
			while (j >= 0) {
				c.comparisons++;
				if (a[j] <= key) break;
				a[j + 1] = a[j];
				c.writes++;
				j--;
			}
			a[j + 1] = key;
			c.writes++;
		}
	},
	merge(a, c) {
		const aux = new Array<number>(a.length);
		const sort = (lo: number, hi: number): void => {
			if (lo >= hi) return;
			const mid = (lo + hi) >> 1;
			sort(lo, mid);
			sort(mid + 1, hi);
			for (let k = lo; k <= hi; k++) aux[k] = a[k];
			let i = lo;
			let j = mid + 1;
			for (let k = lo; k <= hi; k++) {
				if (i > mid) a[k] = aux[j++];
				else if (j > hi) a[k] = aux[i++];
				else {
					c.comparisons++;
					a[k] = aux[i] <= aux[j] ? aux[i++] : aux[j++];
				}
				c.writes++;
			}
		};
		sort(0, a.length - 1);
	},
	quick(a, c) {
		const sort = (lo: number, hi: number): void => {
			if (lo >= hi) return;
			const pivot = a[hi];
			let store = lo;
			for (let j = lo; j < hi; j++) {
				c.comparisons++;
				if (a[j] < pivot) {
					if (store !== j) {
						[a[store], a[j]] = [a[j], a[store]];
						c.writes += 2;
					}
					store++;
				}
			}
			if (store !== hi) {
				[a[store], a[hi]] = [a[hi], a[store]];
				c.writes += 2;
			}
			sort(lo, store - 1);
			sort(store + 1, hi);
		};
		sort(0, a.length - 1);
	},
	heap(a, c) {
		const sift = (root: number, last: number): void => {
			while (true) {
				const left = 2 * root + 1;
				if (left > last) return;
				let largest = root;
				c.comparisons++;
				if (a[largest] < a[left]) largest = left;
				const right = left + 1;
				if (right <= last) {
					c.comparisons++;
					if (a[largest] < a[right]) largest = right;
				}
				if (largest === root) return;
				[a[root], a[largest]] = [a[largest], a[root]];
				c.writes += 2;
				root = largest;
			}
		};
		for (let i = (a.length >> 1) - 1; i >= 0; i--) sift(i, a.length - 1);
		for (let end = a.length - 1; end > 0; end--) {
			[a[0], a[end]] = [a[end], a[0]];
			c.writes += 2;
			sift(0, end - 1);
		}
	},
	shell(a, c) {
		for (let gap = a.length >> 1; gap > 0; gap >>= 1) {
			for (let i = gap; i < a.length; i++) {
				const key = a[i];
				let j = i;
				while (j >= gap) {
					c.comparisons++;
					if (a[j - gap] <= key) break;
					a[j] = a[j - gap];
					c.writes++;
					j -= gap;
				}
				if (j !== i) {
					a[j] = key;
					c.writes++;
				}
			}
		}
	},
	counting(a, c) {
		if (!a.length) return;
		let min = a[0];
		let max = a[0];
		for (const v of a) {
			if (v < min) min = v;
			if (v > max) max = v;
		}
		const counts = new Array<number>(max - min + 1).fill(0);
		for (const v of a) counts[v - min]++;
		let out = 0;
		for (let v = 0; v < counts.length; v++) {
			for (let k = 0; k < counts[v]; k++) {
				a[out++] = v + min;
				c.writes++;
			}
		}
	}
};

/** Run one algorithm at one size and return its operation counts. */
export function benchOne(algorithm: string, n: number, preset: BenchRequest['preset'], seed: number): BenchPoint {
	const fn = COUNTERS[algorithm];
	if (!fn) throw new Error(`Unknown algorithm: ${algorithm}`);
	const input = buildInput(preset, n, seed);
	const counter: Counter = { comparisons: 0, writes: 0 };
	fn(input, counter);
	return { n, comparisons: counter.comparisons, writes: counter.writes };
}

/** Reference curves drawn behind the measured series. */
export function referenceCurve(kind: 'n' | 'nlogn' | 'n2', sizes: number[], anchor: number): BenchPoint[] {
	const f = (n: number) => (kind === 'n' ? n : kind === 'nlogn' ? n * Math.log2(Math.max(2, n)) : n * n);
	const biggest = sizes[sizes.length - 1] ?? 1;
	const scale = anchor > 0 ? anchor / f(biggest) : 1;
	return sizes.map((n) => ({ n, comparisons: f(n) * scale, writes: 0 }));
}
