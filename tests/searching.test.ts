import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SEARCHERS, binarySearch, interpolationSearch, isSorted, linearSearch } from '../src/lib/algorithms/searching.js';
import { verifySearch } from '../src/lib/core/verify.js';
import { PlaybackEngine } from '../src/lib/core/engine.js';
import { replayTo, snapshot } from '../src/lib/core/state.js';

describe('linear search', () => {
	it('finds the first, middle and last element', () => {
		const arr = [7, 3, 9, 4, 1];
		expect(linearSearch(arr, 7).result.foundIndex).toBe(0);
		expect(linearSearch(arr, 9).result.foundIndex).toBe(2);
		expect(linearSearch(arr, 1).result.foundIndex).toBe(4);
	});

	it('returns null when the value is absent, and on empty input', () => {
		expect(linearSearch([5, 1, 3], 42).result.foundIndex).toBeNull();
		expect(linearSearch([], 1).result.foundIndex).toBeNull();
		expect(linearSearch([], 1).steps.at(-1)?.kind).toBe('not-found');
	});

	it('returns the FIRST match when duplicates are present', () => {
		expect(linearSearch([4, 2, 4, 2, 4], 4).result.foundIndex).toBe(0);
		expect(linearSearch([4, 2, 4, 2, 4], 2).result.foundIndex).toBe(1);
	});

	it('property: agrees with Array.indexOf on random input', () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 40 }), fc.integer({ min: -20, max: 20 }), (arr, target) => {
				const got = linearSearch(arr, target).result.foundIndex;
				const want = arr.indexOf(target);
				return got === (want === -1 ? null : want);
			}),
			{ numRuns: 120 }
		);
	});
});

describe('binary and interpolation search', () => {
	const sorted = (n: number) => Array.from({ length: n }, (_, i) => i * 3);

	for (const name of ['binary', 'interpolation'] as const) {
		it(`${name}: finds every element of a sorted array`, () => {
			const arr = sorted(25);
			for (let i = 0; i < arr.length; i++) {
				const idx = SEARCHERS[name](arr, arr[i]).result.foundIndex;
				expect(idx, `${name} target ${arr[i]}`).not.toBeNull();
				expect(arr[idx!]).toBe(arr[i]);
			}
		});

		it(`${name}: reports not found for absent values, including below and above the range`, () => {
			const arr = sorted(20);
			for (const target of [-5, -1, 1, 2, 100, 1000]) {
				expect(SEARCHERS[name](arr, target).result.foundIndex, `${name} ${target}`).toBeNull();
			}
		});

		it(`${name}: handles empty and single-element input`, () => {
			expect(SEARCHERS[name]([], 1).result.foundIndex).toBeNull();
			expect(SEARCHERS[name]([5], 5).result.foundIndex).toBe(0);
			expect(SEARCHERS[name]([5], 4).result.foundIndex).toBeNull();
		});

		it(`${name}: duplicates return an index that really holds the target`, () => {
			const arr = [1, 1, 1, 2, 2, 3, 3, 3, 3];
			for (const target of [1, 2, 3]) {
				const idx = SEARCHERS[name](arr, target).result.foundIndex;
				expect(idx).not.toBeNull();
				expect(arr[idx!]).toBe(target);
			}
		});

		it(`${name}: property - result agrees with includes() on random sorted input`, () => {
			fc.assert(
				fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 40 }), fc.integer({ min: -50, max: 50 }), (raw, target) => {
					const arr = [...raw].sort((a, b) => a - b);
					const trace = SEARCHERS[name](arr, target);
					const idx = trace.result.foundIndex;
					if (idx === null || idx === undefined) return !arr.includes(target);
					return arr[idx] === target;
				}),
				{ numRuns: 120 }
			);
		});

		it(`${name}: every run passes automatic verification`, () => {
			const arr = sorted(15);
			for (const target of [0, 21, 42, 43, -1]) {
				expect(verifySearch(arr, target, SEARCHERS[name](arr, target)).ok).toBe(true);
			}
		});
	}

	it('binary search on sorted data never needs more than ceil(log2(n+1)) comparisons', () => {
		for (const n of [1, 7, 16, 63, 100]) {
			const arr = Array.from({ length: n }, (_, i) => i);
			for (const target of [0, Math.floor(n / 2), n - 1, n + 10]) {
				const trace = binarySearch(arr, target);
				const comparisons = trace.steps.reduce((acc, s) => acc + (s.counters?.comparisons ?? 0), 0);
				expect(comparisons, `n=${n} target=${target}`).toBeLessThanOrEqual(Math.ceil(Math.log2(n + 1)));
			}
		}
	});

	it('interpolation search beats binary search on uniformly spaced data', () => {
		const arr = Array.from({ length: 100 }, (_, i) => i * 2);
		const cmp = (t: ReturnType<typeof binarySearch>) => t.steps.reduce((a, s) => a + (s.counters?.comparisons ?? 0), 0);
		const totalBinary = arr.reduce((acc, v) => acc + cmp(binarySearch(arr, v)), 0);
		const totalInterp = arr.reduce((acc, v) => acc + cmp(interpolationSearch(arr, v)), 0);
		expect(totalInterp).toBeLessThan(totalBinary);
	});

	it('isSorted correctly flags unsorted input so the UI can warn', () => {
		expect(isSorted([])).toBe(true);
		expect(isSorted([1])).toBe(true);
		expect(isSorted([1, 1, 2])).toBe(true);
		expect(isSorted([2, 1])).toBe(false);
		expect(isSorted([1, 3, 2])).toBe(false);
	});

	it('search playback is reversible like every other family', () => {
		const arr = Array.from({ length: 31 }, (_, i) => i);
		for (const trace of [linearSearch(arr, 19), binarySearch(arr, 19), binarySearch(arr, 100)]) {
			const engine = new PlaybackEngine(trace);
			for (let k = 0; k <= trace.steps.length; k++) {
				engine.seek(k);
				expect(snapshot(engine.visualState)).toBe(snapshot(replayTo(trace, k)));
			}
		}
	});
});
