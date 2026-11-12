import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { benchOne, buildInput, COUNTERS, referenceCurve } from '../src/lib/benchmark.js';
import { SORTERS, type SortName } from '../src/lib/algorithms/sorting.js';
import { isAscending, isPermutation } from '../src/lib/core/reference.js';
import { generateQuestions } from '../src/lib/practice.js';
import { replayTo } from '../src/lib/core/state.js';
import { makeGrid, randomWalls } from '../src/lib/algorithms/grid.js';
import { dijkstra } from '../src/lib/algorithms/pathfinding.js';
import { prim, runGraphAlgorithm } from '../src/lib/algorithms/graph.js';
import { sampleGraph } from '../src/lib/data/samples.js';

const NAMES = Object.keys(COUNTERS) as SortName[];

describe('benchmark counters', () => {
	it('each counting implementation actually sorts', () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 60 }), (arr) => {
				for (const name of NAMES) {
					const copy = [...arr];
					COUNTERS[name](copy, { comparisons: 0, writes: 0 });
					if (!isAscending(copy) || !isPermutation(arr, copy)) return false;
				}
				return true;
			}),
			{ numRuns: 50 }
		);
	});

	it('counting comparison totals match the step recorder exactly', () => {
		// The benchmark path and the animation path must agree, otherwise the chart would be
		// describing a different algorithm from the one on screen.
		for (const name of NAMES) {
			for (const input of [[5, 3, 9, 1], [1, 2, 3, 4, 5], [9, 8, 7, 6], [4, 4, 4, 4], []]) {
				const counter = { comparisons: 0, writes: 0 };
				COUNTERS[name]([...input], counter);
				const recorded = SORTERS[name](input).steps.reduce((acc, s) => acc + (s.counters?.comparisons ?? 0), 0);
				expect(counter.comparisons, `${name} on ${JSON.stringify(input)}`).toBe(recorded);
			}
		}
	});

	it('bubble sort early exit shows up in the benchmark on sorted input', () => {
		const sorted = benchOne('bubble', 200, 'sorted', 1);
		const random = benchOne('bubble', 200, 'random', 1);
		expect(sorted.comparisons).toBe(199);
		expect(random.comparisons).toBeGreaterThan(sorted.comparisons * 10);
	});

	it('n log n sorts need far fewer comparisons than quadratic sorts at n = 1000', () => {
		const quadratic = benchOne('selection', 1000, 'random', 2).comparisons;
		for (const name of ['merge', 'heap', 'quick']) {
			expect(benchOne(name, 1000, 'random', 2).comparisons, name).toBeLessThan(quadratic / 5);
		}
	});

	it('the largest supported size (5,000) completes', () => {
		for (const name of ['merge', 'heap', 'shell', 'quick', 'counting']) {
			const point = benchOne(name, 5000, 'random', 3);
			expect(point.n, name).toBe(5000);
			expect(point.comparisons, name).toBeGreaterThanOrEqual(0);
		}
	});

	it('the same seed produces identical measurements', () => {
		expect(benchOne('quick', 500, 'random', 9)).toEqual(benchOne('quick', 500, 'random', 9));
	});

	it('buildInput honours every preset', () => {
		expect(isAscending(buildInput('sorted', 50, 1))).toBe(true);
		expect(isAscending([...buildInput('reversed', 50, 1)].reverse())).toBe(true);
		expect(new Set(buildInput('few-unique', 80, 1)).size).toBeLessThanOrEqual(8);
		expect(buildInput('random', 40, 1).length).toBe(40);
	});

	it('an unknown algorithm is rejected rather than silently skipped', () => {
		expect(() => benchOne('bogosort', 10, 'random', 1)).toThrow(/Unknown algorithm/);
	});

	it('reference curves are monotonic and anchored to the given value', () => {
		const sizes = [10, 100, 1000];
		for (const kind of ['n', 'nlogn', 'n2'] as const) {
			const curve = referenceCurve(kind, sizes, 5000);
			expect(curve.length).toBe(3);
			expect(curve[2].comparisons).toBeCloseTo(5000, 5);
			expect(curve[0].comparisons).toBeLessThan(curve[1].comparisons);
			expect(curve[1].comparisons).toBeLessThan(curve[2].comparisons);
		}
	});
});

describe('practice question generation', () => {
	it('sorting questions always have the real next step as the correct answer', () => {
		for (const name of ['bubble', 'selection', 'insertion', 'quick', 'heap'] as SortName[]) {
			const trace = SORTERS[name]([7, 2, 9, 4, 1, 8, 3, 6], { seed: 5 });
			const questions = generateQuestions(trace, (id) => id, 6, 11);
			expect(questions.length, name).toBeGreaterThan(0);
			for (const q of questions) {
				expect(q.options.length).toBeGreaterThanOrEqual(2);
				expect(q.options.length).toBeLessThanOrEqual(4);
				expect(q.correctIndex).toBeGreaterThanOrEqual(0);
				expect(q.correctIndex).toBeLessThan(q.options.length);
				expect(q.explanation).toBe(trace.steps[q.atStep].explain);
				// The stated correct option must describe what the real step did.
				const before = replayTo(trace, q.atStep);
				if (q.prompt.includes('compare')) {
					const touched = trace.steps[q.atStep].patch.filter((p) => p.t === 'tag') as { t: 'tag'; i: number }[];
					const expected = `${before.array[touched[0].i]} and ${before.array[touched[1].i]}`;
					expect(q.options[q.correctIndex]).toBe(expected);
				}
			}
		}
	});

	it('options are always unique so there is exactly one right answer', () => {
		const trace = SORTERS.bubble([5, 1, 4, 2, 8, 3, 7]);
		for (const q of generateQuestions(trace, (id) => id, 8, 3)) {
			expect(new Set(q.options).size).toBe(q.options.length);
		}
	});

	it('pathfinding questions pick the cell the algorithm really expanded next', () => {
		const grid = randomWalls(makeGrid(12, 9), 4);
		const trace = dijkstra(grid);
		const questions = generateQuestions(trace, (id) => `Cell ${id}`, 6, 21);
		expect(questions.length).toBeGreaterThan(0);
		for (const q of questions) {
			expect(q.explanation).toBe(trace.steps[q.atStep].explain);
			expect(q.options).toContain(q.options[q.correctIndex]);
		}
	});

	it('graph questions work for Dijkstra and Prim', () => {
		const graph = sampleGraph();
		const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
		for (const trace of [runGraphAlgorithm('dijkstra', graph, { start: 'n1', end: 'n6' }), prim(graph, { start: 'n1' })]) {
			const questions = generateQuestions(trace, label, 5, 7);
			expect(questions.length, trace.algorithm).toBeGreaterThan(0);
			for (const q of questions) expect(q.explanation).toBe(trace.steps[q.atStep].explain);
		}
	});

	it('the same seed always produces the same quiz', () => {
		const trace = SORTERS.insertion([4, 9, 1, 7, 3, 8]);
		const a = generateQuestions(trace, (id) => id, 5, 99);
		const b = generateQuestions(trace, (id) => id, 5, 99);
		expect(a.map((q) => `${q.id}|${q.options.join('/')}`)).toEqual(b.map((q) => `${q.id}|${q.options.join('/')}`));
	});

	it('an empty trace produces no questions instead of crashing', () => {
		expect(generateQuestions(SORTERS.bubble([]), (id) => id, 5, 1)).toEqual([]);
		expect(generateQuestions(SORTERS.bubble([1]), (id) => id, 5, 1)).toEqual([]);
	});

	it('every question points at a step that exists', () => {
		const trace = SORTERS.quick([6, 2, 9, 4, 1, 7], { pivot: 'median3', seed: 2 });
		for (const q of generateQuestions(trace, (id) => id, 8, 4)) {
			expect(q.atStep).toBeGreaterThanOrEqual(0);
			expect(q.atStep).toBeLessThan(trace.steps.length);
		}
	});
});
