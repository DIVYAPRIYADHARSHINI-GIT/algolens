// Grid pathfinding as pure step recorders.
//
// SHORTEST-PATH GUARANTEES (shown in the UI, not just here):
//   BFS      - shortest in NUMBER OF MOVES only. Correct cost only when all weights are 1.
//   Dijkstra - always cheapest by cost.
//   A*       - cheapest by cost when the heuristic is admissible (see grid.isAdmissible).
//   DFS      - no guarantee at all; it returns the first path it stumbles into.
//   Greedy   - no guarantee; it follows the heuristic and can detour badly.

import { Recorder, type NodeTag, type Patch, type QueueEntry, type Step, type Trace } from '../core/types.js';
import { MinHeap } from '../core/heap.js';
import { heuristic, isAdmissible, moveCost, neighbours, type Grid, type Heuristic } from './grid.js';

export type PathName = 'bfs' | 'dfs' | 'dijkstra' | 'astar' | 'greedy';

export interface PathOptions {
	heuristic?: Heuristic;
	budget?: number;
}

export const GUARANTEES_SHORTEST: Record<PathName, 'always' | 'moves-only' | 'if-admissible' | 'never'> = {
	bfs: 'moves-only',
	dijkstra: 'always',
	astar: 'if-admissible',
	dfs: 'never',
	greedy: 'never'
};

class GridCtx {
	readonly rec: Recorder;
	readonly tags: NodeTag[];

	constructor(readonly grid: Grid, budget?: number) {
		this.rec = new Recorder(budget);
		this.tags = grid.walls.map((w) => (w ? 'wall' : 'none'));
		this.tags[grid.start] = 'start';
		this.tags[grid.end] = 'end';
	}

	/** Set a cell tag unless it is a protected start/end marker. */
	setTag(i: number, v: NodeTag): { patch: Patch[]; inverse: Patch[] } {
		if (i === this.grid.start || i === this.grid.end) return { patch: [], inverse: [] };
		const prev = this.tags[i];
		this.tags[i] = v;
		return { patch: [{ t: 'cell', i, v }], inverse: [{ t: 'cell', i, v: prev }] };
	}

	emit(step: Step): void {
		this.rec.push(step);
	}
}

function queuePatch(prev: QueueEntry[], next: QueueEntry[]): { patch: Patch[]; inverse: Patch[] } {
	return { patch: [{ t: 'queue', v: next }], inverse: [{ t: 'queue', v: prev }] };
}

function cellName(grid: Grid, i: number): string {
	return `(${i % grid.cols}, ${Math.floor(i / grid.cols)})`;
}

function finalise(
	ctx: GridCtx,
	algorithm: PathName,
	prev: (number | null)[],
	cost: number[],
	visitedCount: number,
	reached: boolean,
	line: number
): Trace {
	const grid = ctx.grid;
	let path: number[] = [];
	if (reached) {
		let cur: number | null = grid.end;
		while (cur !== null && cur !== undefined) {
			path.push(cur);
			if (cur === grid.start) break;
			cur = prev[cur] ?? null;
		}
		path.reverse();
		if (path[0] !== grid.start) path = [];
	}

	if (path.length) {
		let running: number[] = [];
		for (const cell of path) {
			running = [...running, cell];
			const t = ctx.setTag(cell, 'path');
			ctx.emit({
				kind: 'path',
				line,
				explain: `Tracing the path back from the target: ${cellName(grid, cell)} is on the final route.`,
				patch: [...t.patch, { t: 'pathCells', v: running }],
				inverse: [{ t: 'pathCells', v: running.slice(0, -1) }, ...t.inverse]
			});
		}
		ctx.emit({
			kind: 'done',
			line,
			explain: `Reached the target. The path uses ${path.length - 1} move(s) and costs ${cost[grid.end]}.`,
			patch: [],
			inverse: []
		});
	} else {
		ctx.emit({
			kind: 'not-found',
			line,
			explain:
				grid.start === grid.end
					? 'The start and the target are the same cell, so the path is empty and costs nothing.'
					: 'Every reachable cell has been explored and the target was never reached, so no path exists.',
			patch: [],
			inverse: []
		});
	}

	return {
		algorithm,
		family: 'pathfinding',
		initial: {
			cells: ctx.grid.walls.map((w, i) => (w ? 'wall' : i === grid.start ? 'start' : i === grid.end ? 'end' : 'none')),
			queue: []
		},
		steps: ctx.rec.steps,
		result: {
			kind: 'path',
			pathCells: path,
			cost: path.length ? cost[grid.end] : undefined,
			visitedCount,
			guaranteesShortest: GUARANTEES_SHORTEST[algorithm] === 'always'
		},
		truncated: ctx.rec.truncated
	};
}

/** BFS and DFS share a frontier container; only the removal end differs. */
function uninformed(algorithm: 'bfs' | 'dfs', grid: Grid, opts: PathOptions = {}): Trace {
	const ctx = new GridCtx(grid, opts.budget);
	const prev: (number | null)[] = new Array(grid.cols * grid.rows).fill(null);
	const cost: number[] = new Array(grid.cols * grid.rows).fill(Infinity);
	const seen = new Array<boolean>(grid.cols * grid.rows).fill(false);
	let frontier: number[] = [grid.start];
	let queueView: QueueEntry[] = [{ id: String(grid.start) }];
	seen[grid.start] = true;
	cost[grid.start] = 0;
	let visitedCount = 0;

	ctx.emit({
		kind: 'enqueue',
		line: 1,
		explain: `Starting at ${cellName(grid, grid.start)}.`,
		...queuePatch([], queueView)
	});

	if (grid.start === grid.end) {
		return finalise(ctx, algorithm, prev, cost, 0, true, 8);
	}

	while (frontier.length && !ctx.rec.full) {
		const current = algorithm === 'bfs' ? frontier.shift()! : frontier.pop()!;
		const before = queueView;
		queueView = frontier.map((f) => ({ id: String(f) }));
		const ct = ctx.setTag(current, 'current');
		ctx.emit({
			kind: algorithm === 'bfs' ? 'dequeue' : 'pop',
			line: 3,
			explain:
				algorithm === 'bfs'
					? `Taking ${cellName(grid, current)} from the FRONT of the queue; BFS explores in order of distance.`
					: `Taking ${cellName(grid, current)} from the TOP of the stack; DFS dives as deep as it can.`,
			patch: [...ct.patch, ...queuePatch(before, queueView).patch],
			inverse: [...queuePatch(before, queueView).inverse, ...ct.inverse]
		});
		visitedCount++;

		if (current === grid.end) {
			return finalise(ctx, algorithm, prev, cost, visitedCount, true, 4);
		}

		for (const n of neighbours(grid, current)) {
			if (seen[n]) continue;
			seen[n] = true;
			prev[n] = current;
			cost[n] = cost[current] + moveCost(grid, current, n);
			frontier.push(n);
			const beforeQ = queueView;
			queueView = frontier.map((f) => ({ id: String(f) }));
			const nt = ctx.setTag(n, 'frontier');
			ctx.emit({
				kind: algorithm === 'bfs' ? 'enqueue' : 'push',
				line: 6,
				explain: `${cellName(grid, n)} has not been seen yet, so it joins the ${algorithm === 'bfs' ? 'queue' : 'stack'}.`,
				patch: [...nt.patch, ...queuePatch(beforeQ, queueView).patch],
				inverse: [...queuePatch(beforeQ, queueView).inverse, ...nt.inverse],
				counters: { accesses: 1 }
			});
			if (ctx.rec.full) break;
		}

		const vt = ctx.setTag(current, 'visited');
		ctx.emit({
			kind: 'visit',
			line: 7,
			explain: `${cellName(grid, current)} is fully expanded and moves into the visited set.`,
			patch: vt.patch,
			inverse: vt.inverse,
			counters: { visited: 1 }
		});
	}

	return finalise(ctx, algorithm, prev, cost, visitedCount, false, 8);
}

export function bfs(grid: Grid, opts: PathOptions = {}): Trace {
	return uninformed('bfs', grid, opts);
}

export function dfs(grid: Grid, opts: PathOptions = {}): Trace {
	return uninformed('dfs', grid, opts);
}

/** Dijkstra, A* and greedy best-first share a priority queue; only the key differs. */
function informed(algorithm: 'dijkstra' | 'astar' | 'greedy', grid: Grid, opts: PathOptions = {}): Trace {
	const ctx = new GridCtx(grid, opts.budget);
	const h: Heuristic = opts.heuristic ?? 'manhattan';
	const n = grid.cols * grid.rows;
	const dist = new Array<number>(n).fill(Infinity);
	const prev: (number | null)[] = new Array(n).fill(null);
	const closed = new Array<boolean>(n).fill(false);
	const heap = new MinHeap<number>();
	let visitedCount = 0;

	const keyOf = (cell: number): number => {
		if (algorithm === 'dijkstra') return dist[cell];
		if (algorithm === 'greedy') return heuristic(grid, cell, grid.end, h);
		return dist[cell] + heuristic(grid, cell, grid.end, h);
	};

	dist[grid.start] = 0;
	heap.push(keyOf(grid.start), grid.start);
	let queueView: QueueEntry[] = heap.toSortedArray().map((e) => ({ id: String(e.value), key: round2(e.key) }));
	ctx.emit({
		kind: 'enqueue',
		line: 1,
		explain:
			algorithm === 'greedy'
				? `Starting at ${cellName(grid, grid.start)}. Greedy best-first only looks at the estimate to the target, never at the cost so far.`
				: `Starting at ${cellName(grid, grid.start)} with a cost of 0.`,
		...queuePatch([], queueView)
	});

	if (grid.start === grid.end) {
		return finalise(ctx, algorithm, prev, dist, 0, true, 9);
	}

	while (heap.size && !ctx.rec.full) {
		const top = heap.pop()!;
		const current = top.value;
		if (closed[current]) continue;
		closed[current] = true;
		visitedCount++;
		const before = queueView;
		queueView = heap.toSortedArray().map((e) => ({ id: String(e.value), key: round2(e.key) }));
		const ct = ctx.setTag(current, 'current');
		ctx.emit({
			kind: 'dequeue',
			line: 3,
			explain:
				algorithm === 'dijkstra'
					? `Taking the cheapest open cell ${cellName(grid, current)} at cost ${round2(dist[current])}.`
					: algorithm === 'astar'
						? `Taking ${cellName(grid, current)} with f = g ${round2(dist[current])} + h ${round2(heuristic(grid, current, grid.end, h))} = ${round2(top.key)}.`
						: `Taking ${cellName(grid, current)} because its estimate to the target (${round2(top.key)}) is the smallest.`,
			patch: [...ct.patch, ...queuePatch(before, queueView).patch],
			inverse: [...queuePatch(before, queueView).inverse, ...ct.inverse]
		});

		if (current === grid.end) {
			return finalise(ctx, algorithm, prev, dist, visitedCount, true, 4);
		}

		for (const nb of neighbours(grid, current)) {
			if (closed[nb]) continue;
			const candidate = dist[current] + moveCost(grid, current, nb);
			if (candidate < dist[nb]) {
				const oldDist = dist[nb];
				const oldPrev = prev[nb];
				dist[nb] = candidate;
				prev[nb] = current;
				heap.push(keyOf(nb), nb);
				const beforeQ = queueView;
				queueView = heap.toSortedArray().map((e) => ({ id: String(e.value), key: round2(e.key) }));
				const nt = ctx.setTag(nb, 'frontier');
				ctx.emit({
					kind: 'relax',
					line: 6,
					explain: `Reaching ${cellName(grid, nb)} through ${cellName(grid, current)} costs ${round2(candidate)}, better than ${oldDist === Infinity ? 'infinity' : round2(oldDist)}, so the route is updated.`,
					patch: [
						...nt.patch,
						{ t: 'dist', id: String(nb), v: candidate },
						{ t: 'prev', id: String(nb), v: String(current) },
						...queuePatch(beforeQ, queueView).patch
					],
					inverse: [
						...queuePatch(beforeQ, queueView).inverse,
						{ t: 'prev', id: String(nb), v: oldPrev === null ? null : String(oldPrev) },
						{ t: 'dist', id: String(nb), v: oldDist },
						...nt.inverse
					],
					counters: { edgesRelaxed: 1, accesses: 1 }
				});
			} else {
				ctx.emit({
					kind: 'no-relax',
					line: 6,
					explain: `Reaching ${cellName(grid, nb)} this way costs ${round2(candidate)}, which is not better than the known ${round2(dist[nb])}, so nothing changes.`,
					patch: [],
					inverse: [],
					counters: { accesses: 1 }
				});
			}
			if (ctx.rec.full) break;
		}

		const vt = ctx.setTag(current, 'visited');
		ctx.emit({
			kind: 'visit',
			line: 8,
			explain: `${cellName(grid, current)} is finished and joins the closed set.`,
			patch: vt.patch,
			inverse: vt.inverse,
			counters: { visited: 1 }
		});
	}

	return finalise(ctx, algorithm, prev, dist, visitedCount, false, 9);
}

export function dijkstra(grid: Grid, opts: PathOptions = {}): Trace {
	return informed('dijkstra', grid, opts);
}

export function astar(grid: Grid, opts: PathOptions = {}): Trace {
	return informed('astar', grid, opts);
}

export function greedy(grid: Grid, opts: PathOptions = {}): Trace {
	return informed('greedy', grid, opts);
}

function round2(v: number): number {
	if (!Number.isFinite(v)) return v;
	return Math.round(v * 100) / 100;
}

export const PATHFINDERS: Record<PathName, (grid: Grid, opts?: PathOptions) => Trace> = {
	bfs,
	dfs,
	dijkstra,
	astar,
	greedy
};

export { isAdmissible };
