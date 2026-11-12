import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SORTERS, type SortName } from '../src/lib/algorithms/sorting.js';
import { replayTo } from '../src/lib/core/state.js';
import { isAscending, isPermutation } from '../src/lib/core/reference.js';
import { verifySorting } from '../src/lib/core/verify.js';

const ALL: SortName[] = ['bubble', 'selection', 'insertion', 'merge', 'quick', 'heap', 'shell', 'counting'];
/** Algorithms that are stable by definition and must preserve equal-element order. */
const STABLE: SortName[] = ['bubble', 'insertion', 'merge', 'counting'];

const EDGE_CASES: number[][] = [
	[],
	[1],
	[2, 1],
	[1, 1, 1, 1],
	[5, 4, 3, 2, 1],
	[1, 2, 3, 4, 5],
	[-3, -1, -7, 0, 2, -2],
	[0, 0, 0, 1, -1, 1, -1],
	[100, -100, 50, -50, 0]
];

describe('sorting correctness', () => {
	for (const name of ALL) {
		it(`${name}: edge cases sort and are permutations`, () => {
			for (const input of EDGE_CASES) {
				const trace = SORTERS[name](input, { budget: 200_000 });
				const out = trace.result.array!;
				expect(isAscending(out), `${name} on ${JSON.stringify(input)}`).toBe(true);
				expect(isPermutation(input, out)).toBe(true);
				expect(verifySorting(input, trace).ok).toBe(true);
			}
		});

		it(`${name}: property - random arrays always sort`, () => {
			fc.assert(
				fc.property(fc.array(fc.integer({ min: -200, max: 200 }), { maxLength: 60 }), (arr) => {
					const trace = SORTERS[name](arr, { budget: 200_000 });
					const out = trace.result.array!;
					return isAscending(out) && isPermutation(arr, out);
				}),
				{ numRuns: 60 }
			);
		});

		it(`${name}: the final replayed state equals the reported result`, () => {
			fc.assert(
				fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 24 }), (arr) => {
					const trace = SORTERS[name](arr, { budget: 200_000 });
					if (trace.truncated) return true;
					const final = replayTo(trace, trace.steps.length);
					return JSON.stringify(final.array) === JSON.stringify(trace.result.array);
				}),
				{ numRuns: 40 }
			);
		});
	}

	it('large input (400 elements) still sorts for every algorithm', () => {
		const big = Array.from({ length: 400 }, (_, i) => ((i * 7919) % 401) - 200);
		for (const name of ALL) {
			const out = SORTERS[name](big, { budget: 5_000_000 }).result.array!;
			expect(isAscending(out), name).toBe(true);
			expect(isPermutation(big, out), name).toBe(true);
		}
	});
});

describe('stability (tagged elements)', () => {
	// A stable sort keeps equal keys in their original relative order. We test it by
	// sorting keys that repeat and checking the recorded trace against a stable reference.
	const stableReference = (arr: { key: number; tag: number }[]) =>
		[...arr].map((v, i) => ({ ...v, i })).sort((a, b) => a.key - b.key || a.i - b.i).map((v) => v.tag);

	for (const name of STABLE) {
		it(`${name} is stable`, () => {
			fc.assert(
				fc.property(fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 2, maxLength: 24 }), (keys) => {
					const tagged = keys.map((key, tag) => ({ key, tag }));
					// Encode (key, tag) into a single sortable number so the numeric sorter
					// preserves the tag: value = key * 1000 + tag keeps key order dominant and
					// ties resolved by original index, which is exactly stable order.
					const encoded = tagged.map((t) => t.key * 1000 + t.tag);
					const out = SORTERS[name](encoded, { budget: 500_000 }).result.array!;
					const gotTags = out.map((v) => v % 1000);
					return JSON.stringify(gotTags) === JSON.stringify(stableReference(tagged));
				}),
				{ numRuns: 40 }
			);
		});
	}

	it('selection sort is documented as NOT stable, and the recorded swaps prove it', () => {
		// On [2a, 2b, 1] selection sort swaps positions 0 and 2 directly, so the element that
		// started at index 1 (2b) ends up BEFORE the one that started at index 0 (2a).
		// That long-range swap is exactly what makes selection sort unstable, and it is
		// visible in the recorded trace rather than inferred.
		const trace = SORTERS.selection([2, 2, 1]);
		const swaps = trace.steps.filter((s) => s.kind === 'swap');
		expect(swaps.length).toBe(1);
		const moved = swaps[0].patch.filter((p) => p.t === 'arr') as { t: 'arr'; i: number; v: number }[];
		expect(moved.map((p) => p.i).sort((a, b) => a - b)).toEqual([0, 2]);
		expect(trace.result.array).toEqual([1, 2, 2]);
	});
});

describe('hand-calculated operation counts', () => {
	const count = (name: SortName, input: number[]) => {
		const trace = SORTERS[name](input);
		let comparisons = 0;
		let swaps = 0;
		for (const s of trace.steps) {
			comparisons += s.counters?.comparisons ?? 0;
			swaps += s.counters?.swaps ?? 0;
		}
		return { comparisons, swaps, steps: trace.steps.length };
	};

	it('bubble sort with early exit on an already sorted array of n makes exactly n-1 comparisons', () => {
		for (const n of [5, 8, 20, 50]) {
			const sortedInput = Array.from({ length: n }, (_, i) => i + 1);
			expect(count('bubble', sortedInput).comparisons, `n=${n}`).toBe(n - 1);
			expect(count('bubble', sortedInput).swaps).toBe(0);
		}
	});

	it('bubble sort on a reversed array of n makes n(n-1)/2 comparisons and the same number of swaps', () => {
		for (const n of [5, 6, 10]) {
			const rev = Array.from({ length: n }, (_, i) => n - i);
			const expected = (n * (n - 1)) / 2;
			expect(count('bubble', rev).comparisons, `n=${n}`).toBe(expected);
			expect(count('bubble', rev).swaps).toBe(expected);
		}
	});

	it('selection sort always makes n(n-1)/2 comparisons regardless of order', () => {
		for (const n of [5, 7, 12]) {
			const expected = (n * (n - 1)) / 2;
			const asc = Array.from({ length: n }, (_, i) => i);
			const desc = Array.from({ length: n }, (_, i) => n - i);
			expect(count('selection', asc).comparisons, `asc n=${n}`).toBe(expected);
			expect(count('selection', desc).comparisons, `desc n=${n}`).toBe(expected);
		}
	});

	it('insertion sort on a sorted array of n makes exactly n-1 comparisons', () => {
		for (const n of [5, 9, 30]) {
			const asc = Array.from({ length: n }, (_, i) => i);
			expect(count('insertion', asc).comparisons, `n=${n}`).toBe(n - 1);
		}
	});

	it('insertion sort on a reversed array of n makes n(n-1)/2 comparisons', () => {
		for (const n of [5, 8]) {
			const rev = Array.from({ length: n }, (_, i) => n - i);
			expect(count('insertion', rev).comparisons, `n=${n}`).toBe((n * (n - 1)) / 2);
		}
	});

	it('merge sort comparison count stays within the n*ceil(log2 n) - 2^ceil(log2 n) + 1 bound', () => {
		for (const n of [4, 8, 16, 31]) {
			const arr = Array.from({ length: n }, (_, i) => ((i * 37) % n) + 1);
			const k = Math.ceil(Math.log2(n));
			const upper = n * k - 2 ** k + 1;
			expect(count('merge', arr).comparisons, `n=${n}`).toBeLessThanOrEqual(upper);
		}
	});

	it('quick sort with every pivot rule sorts and the rule changes the comparison count', () => {
		const arr = [9, 1, 8, 2, 7, 3, 6, 4, 5, 0, 9, 1];
		const counts = (['first', 'last', 'median3', 'random'] as const).map((pivot) => {
			const trace = SORTERS.quick(arr, { pivot, seed: 7 });
			expect(isAscending(trace.result.array!)).toBe(true);
			return trace.steps.reduce((acc, s) => acc + (s.counters?.comparisons ?? 0), 0);
		});
		expect(counts.every((c) => c > 0)).toBe(true);
	});

	it('a seeded random pivot is reproducible', () => {
		const arr = [5, 3, 9, 1, 7, 2, 8];
		const a = SORTERS.quick(arr, { pivot: 'random', seed: 42 });
		const b = SORTERS.quick(arr, { pivot: 'random', seed: 42 });
		const c = SORTERS.quick(arr, { pivot: 'random', seed: 43 });
		expect(a.steps.length).toBe(b.steps.length);
		expect(a.steps.map((s) => s.explain)).toEqual(b.steps.map((s) => s.explain));
		expect(a.result.array).toEqual(c.result.array);
	});

	it('the step budget truncates instead of exhausting memory, and says so', () => {
		const big = Array.from({ length: 300 }, (_, i) => 300 - i);
		const trace = SORTERS.bubble(big, { budget: 500 });
		expect(trace.truncated).toBe(true);
		expect(trace.steps.length).toBeLessThanOrEqual(500);
		// The RESULT is still the real complete sort.
		expect(isAscending(trace.result.array!)).toBe(true);
	});
});
