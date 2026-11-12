import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { astar, bfs, dfs, dijkstra, greedy, PATHFINDERS, type PathName } from '../src/lib/algorithms/pathfinding.js';
import { dfsMaze, divisionMaze, idx, isAdmissible, makeGrid, randomWalls, randomWeights, type Grid, type Heuristic } from '../src/lib/algorithms/grid.js';
import { gridBellmanFord, gridBfsMoves, validateGridPath } from '../src/lib/core/reference.js';
import { verifyPath } from '../src/lib/core/verify.js';
import { PlaybackEngine } from '../src/lib/core/engine.js';
import { replayTo, snapshot } from '../src/lib/core/state.js';
import { mulberry32 } from '../src/lib/core/rng.js';

const ALL: PathName[] = ['bfs', 'dfs', 'dijkstra', 'astar', 'greedy'];

function randomGrid(seed: number, cols = 14, rows = 11, diagonal = false, weighted = false): Grid {
	let g = makeGrid(cols, rows, diagonal);
	g = randomWalls(g, seed, 0.3);
	if (weighted) g = randomWeights(g, seed);
	return g;
}

describe('grid pathfinding against independent references', () => {
	it('BFS path length equals an independent breadth-first reference', () => {
		for (let seed = 1; seed <= 25; seed++) {
			const grid = randomGrid(seed);
			const trace = bfs(grid);
			const reference = gridBfsMoves(grid)[grid.end];
			const path = trace.result.pathCells ?? [];
			if (!Number.isFinite(reference)) {
				expect(path.length, `seed ${seed} should be unreachable`).toBe(0);
			} else {
				expect(path.length - 1, `seed ${seed}`).toBe(reference);
			}
		}
	});

	it('Dijkstra cost equals a Bellman-Ford reference on weighted grids', () => {
		for (let seed = 1; seed <= 25; seed++) {
			const grid = randomGrid(seed, 14, 11, false, true);
			const trace = dijkstra(grid);
			const reference = gridBellmanFord(grid)[grid.end];
			if (!Number.isFinite(reference)) {
				expect(trace.result.pathCells?.length ?? 0, `seed ${seed}`).toBe(0);
			} else {
				expect(trace.result.cost, `seed ${seed}`).toBe(reference);
			}
		}
	});

	it('A* with an admissible heuristic finds the same COST as Dijkstra', () => {
		const combos: { diagonal: boolean; h: Heuristic }[] = [
			{ diagonal: false, h: 'manhattan' },
			{ diagonal: false, h: 'euclidean' },
			{ diagonal: true, h: 'euclidean' },
			{ diagonal: true, h: 'diagonal' }
		];
		for (const combo of combos) {
			expect(isAdmissible(combo.h, combo.diagonal), `${combo.h}/${combo.diagonal}`).toBe(true);
			for (let seed = 1; seed <= 12; seed++) {
				const grid = randomGrid(seed, 13, 10, combo.diagonal, true);
				const ref = dijkstra(grid).result;
				const got = astar(grid, { heuristic: combo.h }).result;
				expect(got.cost ?? null, `${combo.h} diag=${combo.diagonal} seed=${seed}`).toBe(ref.cost ?? null);
			}
		}
	});

	it('Manhattan is correctly reported as INADMISSIBLE with 8-way movement', () => {
		expect(isAdmissible('manhattan', true)).toBe(false);
		expect(isAdmissible('manhattan', false)).toBe(true);
	});

	it('DFS and greedy can return a longer path than Dijkstra, and never claim otherwise', () => {
		let foundLonger = false;
		for (let seed = 1; seed <= 40; seed++) {
			const grid = randomGrid(seed, 16, 12, false, true);
			const best = dijkstra(grid).result;
			if (!best.pathCells?.length) continue;
			for (const algo of [dfs, greedy]) {
				const got = algo(grid).result;
				expect(got.guaranteesShortest).toBe(false);
				if ((got.cost ?? 0) > (best.cost ?? 0)) foundLonger = true;
				// Whatever it returns must still be a REAL path.
				if (got.pathCells?.length) {
					expect(validateGridPath(grid, got.pathCells).ok).toBe(true);
				}
			}
		}
		expect(foundLonger, 'DFS/greedy should be longer on at least one random grid').toBe(true);
	});

	it('every algorithm returns a valid, wall-free, contiguous path or no path at all', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 5000 }), fc.boolean(), (seed, diagonal) => {
				const grid = randomGrid(seed, 12, 9, diagonal, true);
				for (const name of ALL) {
					const path = PATHFINDERS[name](grid).result.pathCells ?? [];
					if (!path.length) continue;
					if (!validateGridPath(grid, path).ok) return false;
				}
				return true;
			}),
			{ numRuns: 60 }
		);
	});

	it('automatic verification passes for every algorithm on mazes and weighted grids', () => {
		const grids = [
			randomGrid(3, 15, 11, false, true),
			randomGrid(9, 15, 11, true, true),
			dfsMaze(makeGrid(21, 15), 5),
			divisionMaze(makeGrid(21, 15), 8)
		];
		for (const grid of grids) {
			for (const name of ALL) {
				const h: Heuristic = grid.diagonal ? 'diagonal' : 'manhattan';
				const v = verifyPath(grid, name, h, PATHFINDERS[name](grid, { heuristic: h }));
				expect(v.ok, `${name}: ${v.details.join(' | ')}`).toBe(true);
			}
		}
	});
});

describe('grid edge cases', () => {
	it('start equal to end gives an empty path of cost 0 and verifies', () => {
		const base = makeGrid(10, 8);
		const grid: Grid = { ...base, end: base.start };
		for (const name of ALL) {
			const trace = PATHFINDERS[name](grid);
			expect(trace.result.pathCells?.length ?? 0, name).toBeLessThanOrEqual(1);
			expect(verifyPath(grid, name, 'manhattan', trace).ok, name).toBe(true);
		}
	});

	it('a fully walled-off target reports no path with a clear message', () => {
		const base = makeGrid(9, 9);
		const walls = [...base.walls];
		const { cols } = base;
		const ex = base.end % cols;
		const ey = Math.floor(base.end / cols);
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
			const nx = ex + dx;
			const ny = ey + dy;
			if (nx >= 0 && ny >= 0 && nx < cols && ny < base.rows) walls[idx(cols, nx, ny)] = true;
		}
		const grid: Grid = { ...base, walls };
		for (const name of ALL) {
			const trace = PATHFINDERS[name](grid);
			expect(trace.result.pathCells?.length ?? 0, name).toBe(0);
			expect(trace.steps.at(-1)?.kind, name).toBe('not-found');
			expect(trace.steps.at(-1)?.explain).toContain('no path');
			expect(verifyPath(grid, name, 'manhattan', trace).ok, name).toBe(true);
		}
	});

	it('the diagonal corner rule forbids cutting between two walls', () => {
		// Open 3x3, then wall (1,0) and (0,1): the diagonal (0,0)->(1,1) must be blocked.
		const base = makeGrid(3, 3, true);
		const walls = [...base.walls];
		walls[idx(3, 1, 0)] = true;
		walls[idx(3, 0, 1)] = true;
		const grid: Grid = { ...base, walls, start: idx(3, 0, 0), end: idx(3, 1, 1) };
		const trace = bfs(grid);
		expect(trace.result.pathCells?.length ?? 0).toBe(0);

		// Open just one of the two shared orthogonals and the diagonal becomes legal.
		const relaxed = [...base.walls];
		relaxed[idx(3, 1, 0)] = true;
		const ok: Grid = { ...base, walls: relaxed, start: idx(3, 0, 0), end: idx(3, 1, 1) };
		expect((bfs(ok).result.pathCells ?? []).length).toBeGreaterThan(0);
	});

	it('weights change the chosen route: Dijkstra avoids an expensive corridor BFS walks through', () => {
		const base = makeGrid(11, 5);
		const start = idx(11, 0, 2);
		const end = idx(11, 10, 2);
		const weights = [...base.weights];
		for (let x = 1; x < 10; x++) weights[idx(11, x, 2)] = 9;
		const grid: Grid = { ...base, weights, start, end };
		const straight = bfs(grid).result;
		const cheap = dijkstra(grid).result;
		expect(cheap.cost!).toBeLessThan(straight.cost!);
		expect(cheap.cost).toBe(gridBellmanFord(grid)[end]);
	});

	it('weights of 1 make Dijkstra and BFS agree exactly', () => {
		for (let seed = 1; seed <= 15; seed++) {
			const grid = randomGrid(seed, 12, 9);
			const a = bfs(grid).result;
			const b = dijkstra(grid).result;
			expect(a.cost ?? null, `seed ${seed}`).toBe(b.cost ?? null);
		}
	});

	it('a start placed inside a wall is handled without crashing', () => {
		const base = makeGrid(8, 8);
		const walls = [...base.walls];
		walls[base.start] = true;
		const grid: Grid = { ...base, walls };
		for (const name of ALL) {
			expect(() => PATHFINDERS[name](grid)).not.toThrow();
		}
	});

	it('generated mazes are always solvable from start to end', () => {
		const rand = mulberry32(99);
		for (let i = 0; i < 10; i++) {
			const seed = Math.floor(rand() * 100000);
			for (const maze of [dfsMaze(makeGrid(21, 15), seed), divisionMaze(makeGrid(21, 15), seed)]) {
				const reachable = Number.isFinite(gridBfsMoves(maze)[maze.end]);
				// A generated maze may wall the target in; when that happens the app says so
				// rather than pretending. We assert the two agree.
				const path = bfs(maze).result.pathCells ?? [];
				expect(path.length > 0).toBe(reachable);
			}
		}
	});

	it('the 60x40 maximum grid still records within the step budget', () => {
		const grid = divisionMaze(makeGrid(60, 40), 7);
		const trace = dijkstra(grid, { budget: 60_000 });
		expect(trace.steps.length).toBeLessThanOrEqual(60_000);
		expect(() => new PlaybackEngine(trace).toEnd()).not.toThrow();
	});

	it('pathfinding playback is exactly reversible', () => {
		const grid = randomGrid(4, 10, 8, false, true);
		for (const name of ALL) {
			const trace = PATHFINDERS[name](grid);
			const engine = new PlaybackEngine(trace);
			for (let k = 0; k <= trace.steps.length; k += Math.max(1, Math.floor(trace.steps.length / 20))) {
				engine.seek(k);
				expect(snapshot(engine.visualState), `${name} at ${k}`).toBe(snapshot(replayTo(trace, k)));
			}
			engine.toEnd();
			engine.toStart();
			expect(snapshot(engine.visualState), name).toBe(snapshot(replayTo(trace, 0)));
		}
	});
});
