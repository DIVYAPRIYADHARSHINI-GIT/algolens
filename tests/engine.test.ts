import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PlaybackEngine, SPEEDS, BASE_STEP_MS } from '../src/lib/core/engine.js';
import { replayTo, snapshot } from '../src/lib/core/state.js';
import { SORTERS } from '../src/lib/algorithms/sorting.js';
import { bfs, dijkstra } from '../src/lib/algorithms/pathfinding.js';
import { makeGrid, randomWalls } from '../src/lib/algorithms/grid.js';
import { kruskal } from '../src/lib/algorithms/graph.js';
import { sampleGraph } from '../src/lib/data/samples.js';

const traceFor = (arr: number[]) => SORTERS.quick(arr, { pivot: 'median3', seed: 3 });

describe('playback engine - reversibility', () => {
	it('forward then back returns exactly the starting state (every algorithm family)', () => {
		const grid = randomWalls(makeGrid(12, 10), 11);
		const traces = [
			SORTERS.bubble([5, 2, 9, 1, 7, 3]),
			SORTERS.merge([8, 3, 5, 1, 9, 2, 7]),
			SORTERS.heap([4, 10, 3, 5, 1]),
			bfs(grid),
			dijkstra(grid),
			kruskal(sampleGraph())
		];
		for (const trace of traces) {
			const engine = new PlaybackEngine(trace);
			const start = snapshot(engine.visualState);
			for (let i = 0; i < trace.steps.length; i++) engine.forward();
			for (let i = 0; i < trace.steps.length; i++) engine.back();
			expect(snapshot(engine.visualState), trace.algorithm).toBe(start);
		}
	});

	it('property: step forward k then back k equals replayTo(0)', () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: -30, max: 30 }), { minLength: 2, maxLength: 16 }),
				fc.nat({ max: 200 }),
				(arr, k) => {
					const trace = traceFor(arr);
					const engine = new PlaybackEngine(trace);
					const base = snapshot(engine.visualState);
					const n = Math.min(k, trace.steps.length);
					for (let i = 0; i < n; i++) engine.forward();
					for (let i = 0; i < n; i++) engine.back();
					return snapshot(engine.visualState) === base;
				}
			),
			{ numRuns: 60 }
		);
	});

	it('property: seek(k) equals replaying from scratch to k', () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: -30, max: 30 }), { minLength: 2, maxLength: 16 }),
				fc.array(fc.nat({ max: 400 }), { minLength: 1, maxLength: 12 }),
				(arr, seeks) => {
					const trace = traceFor(arr);
					const engine = new PlaybackEngine(trace);
					for (const raw of seeks) {
						const k = Math.min(raw, trace.steps.length);
						engine.seek(k);
						const expected = snapshot(replayTo(trace, k));
						if (snapshot(engine.visualState) !== expected) return false;
					}
					return true;
				}
			),
			{ numRuns: 50 }
		);
	});

	it('seeking backwards and forwards repeatedly never drifts', () => {
		const trace = SORTERS.insertion([9, 4, 7, 1, 8, 2, 6, 3]);
		const engine = new PlaybackEngine(trace);
		const order = [5, 0, trace.steps.length, 3, trace.steps.length - 1, 1, 0, 7];
		for (const k of order) {
			const target = Math.max(0, Math.min(trace.steps.length, k));
			engine.seek(target);
			expect(snapshot(engine.visualState)).toBe(snapshot(replayTo(trace, target)));
		}
	});

	it('jump to start and jump to end land exactly on the boundaries', () => {
		const trace = SORTERS.shell([6, 2, 8, 4, 1, 9, 3]);
		const engine = new PlaybackEngine(trace);
		engine.toEnd();
		expect(engine.index).toBe(trace.steps.length);
		expect(engine.atEnd).toBe(true);
		expect(engine.visualState.array).toEqual(trace.result.array);
		engine.toStart();
		expect(engine.index).toBe(0);
		expect(engine.atStart).toBe(true);
		expect(engine.visualState.array).toEqual(trace.initial.array);
	});

	it('stepping past either end is a no-op, not a crash', () => {
		const engine = new PlaybackEngine(SORTERS.bubble([2, 1]));
		expect(engine.back()).toBe(false);
		engine.toEnd();
		expect(engine.forward()).toBe(false);
	});
});

describe('playback engine - speed', () => {
	it('property: speed changes never change the sequence of states', () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 2, maxLength: 12 }),
				fc.array(fc.nat({ max: SPEEDS.length - 1 }), { minLength: 1, maxLength: 8 }),
				(arr, speedPicks) => {
					const trace = traceFor(arr);
					const plain = new PlaybackEngine(trace);
					const varied = new PlaybackEngine(trace);
					for (let i = 0; i < trace.steps.length; i++) {
						plain.forward();
						varied.setSpeed(SPEEDS[speedPicks[i % speedPicks.length]]);
						varied.forward();
						if (snapshot(plain.visualState) !== snapshot(varied.visualState)) return false;
					}
					return true;
				}
			),
			{ numRuns: 40 }
		);
	});

	it('tick applies more steps at a higher speed but reaches the same end state', () => {
		const trace = SORTERS.selection([7, 3, 9, 1, 5, 2]);
		const slow = new PlaybackEngine(trace);
		const fast = new PlaybackEngine(trace);
		slow.setSpeed(1);
		fast.setSpeed(8);
		slow.play();
		fast.play();
		// Prime: the first tick only records the clock.
		slow.tick(0);
		fast.tick(0);
		const oneSecond = BASE_STEP_MS * 4;
		let t = 0;
		for (let i = 0; i < 4; i++) {
			t += oneSecond / 4;
			slow.tick(t);
			fast.tick(t);
		}
		expect(fast.index).toBeGreaterThan(slow.index);
		slow.toEnd();
		fast.toEnd();
		expect(snapshot(slow.visualState)).toBe(snapshot(fast.visualState));
	});

	it('playback stops automatically at the end', () => {
		const trace = SORTERS.bubble([3, 1, 2]);
		const engine = new PlaybackEngine(trace);
		engine.setSpeed(8);
		engine.play();
		engine.tick(0);
		for (let t = 100; t <= 10_000; t += 100) engine.tick(t);
		expect(engine.atEnd).toBe(true);
		expect(engine.isPlaying).toBe(false);
	});

	it('pressing play at the end restarts from the beginning', () => {
		const trace = SORTERS.bubble([3, 1, 2]);
		const engine = new PlaybackEngine(trace);
		engine.toEnd();
		engine.play();
		expect(engine.index).toBe(0);
		expect(engine.isPlaying).toBe(true);
	});

	it('nudgeSpeed clamps at both ends of the speed list', () => {
		const engine = new PlaybackEngine(SORTERS.bubble([2, 1]));
		for (let i = 0; i < 10; i++) engine.nudgeSpeed(-1);
		expect(engine.speed).toBe(SPEEDS[0]);
		for (let i = 0; i < 10; i++) engine.nudgeSpeed(1);
		expect(engine.speed).toBe(SPEEDS[SPEEDS.length - 1]);
	});

	it('loading a new trace rewinds and clears playback', () => {
		const engine = new PlaybackEngine(SORTERS.bubble([3, 2, 1]));
		engine.toEnd();
		engine.play();
		engine.load(SORTERS.heap([5, 1, 4]));
		expect(engine.index).toBe(0);
		expect(engine.isPlaying).toBe(false);
	});

	it('counters at the end of a run match the sum of every step delta', () => {
		const trace = SORTERS.quick([9, 2, 7, 4, 1, 8, 3], { pivot: 'last' });
		const engine = new PlaybackEngine(trace);
		engine.toEnd();
		const expected = trace.steps.reduce(
			(acc, s) => ({
				comparisons: acc.comparisons + (s.counters?.comparisons ?? 0),
				swaps: acc.swaps + (s.counters?.swaps ?? 0),
				writes: acc.writes + (s.counters?.writes ?? 0)
			}),
			{ comparisons: 0, swaps: 0, writes: 0 }
		);
		expect(engine.visualState.counters.comparisons).toBe(expected.comparisons);
		expect(engine.visualState.counters.swaps).toBe(expected.swaps);
		expect(engine.visualState.counters.writes).toBe(expected.writes);
	});

	it('counters return to zero after stepping all the way back', () => {
		const trace = SORTERS.merge([5, 3, 8, 1, 9, 2]);
		const engine = new PlaybackEngine(trace);
		engine.toEnd();
		engine.toStart();
		const c = engine.visualState.counters;
		expect([c.comparisons, c.swaps, c.writes, c.accesses, c.depth, c.steps]).toEqual([0, 0, 0, 0, 0, 0]);
	});
});
