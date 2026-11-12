// INDEPENDENT reference solvers.
//
// These are deliberately written in a different style from the recorders (no steps, no
// priority queue reuse where a simpler algorithm will do) so a shared bug is unlikely to
// cancel out. They are the ground truth for the "Verified" badge and for the tests:
//   * Bellman-Ford verifies Dijkstra and A* costs on grids and graphs.
//   * A plain BFS over an unweighted grid verifies BFS move counts.
//   * A brute-force MST (sorted-edge union-find written separately) verifies Prim/Kruskal
//     weight, since MST weight is unique even when the edge set is not.

import { moveCost, neighbours, type Grid } from '../algorithms/grid.js';
import { adjacency, type Graph } from '../algorithms/graph.js';

/** Bellman-Ford over the grid. Returns cost to every cell (Infinity when unreachable). */
export function gridBellmanFord(grid: Grid): number[] {
	const n = grid.cols * grid.rows;
	const dist = new Array<number>(n).fill(Infinity);
	dist[grid.start] = 0;
	// Relax |V|-1 times. Early exit once a pass changes nothing.
	for (let pass = 0; pass < n - 1; pass++) {
		let changed = false;
		for (let i = 0; i < n; i++) {
			if (dist[i] === Infinity || grid.walls[i]) continue;
			for (const nb of neighbours(grid, i)) {
				const cand = dist[i] + moveCost(grid, i, nb);
				if (cand < dist[nb]) {
					dist[nb] = cand;
					changed = true;
				}
			}
		}
		if (!changed) break;
	}
	return dist;
}

/** Plain BFS over the grid ignoring weights. Returns the number of MOVES to each cell. */
export function gridBfsMoves(grid: Grid): number[] {
	const n = grid.cols * grid.rows;
	const moves = new Array<number>(n).fill(Infinity);
	if (grid.walls[grid.start]) return moves;
	moves[grid.start] = 0;
	const queue: number[] = [grid.start];
	let head = 0;
	while (head < queue.length) {
		const cur = queue[head++];
		for (const nb of neighbours(grid, cur)) {
			if (moves[nb] !== Infinity) continue;
			moves[nb] = moves[cur] + 1;
			queue.push(nb);
		}
	}
	return moves;
}

/** Validate a concrete grid path: contiguous, wall-free, starts/ends correctly. */
export function validateGridPath(grid: Grid, path: number[]): { ok: boolean; cost: number; reason?: string } {
	if (!path.length) return { ok: false, cost: 0, reason: 'The path is empty.' };
	if (path[0] !== grid.start) return { ok: false, cost: 0, reason: 'The path does not begin at the start cell.' };
	if (path[path.length - 1] !== grid.end) return { ok: false, cost: 0, reason: 'The path does not end at the target cell.' };
	let cost = 0;
	for (let i = 1; i < path.length; i++) {
		const from = path[i - 1];
		const to = path[i];
		if (grid.walls[to]) return { ok: false, cost, reason: `The path goes through a wall at cell ${to}.` };
		if (!neighbours(grid, from).includes(to)) {
			return { ok: false, cost, reason: `Cells ${from} and ${to} are not legal neighbours.` };
		}
		cost += moveCost(grid, from, to);
	}
	return { ok: true, cost };
}

/** Bellman-Ford over a node-link graph. */
export function graphBellmanFord(graph: Graph, start: string): Record<string, number> {
	const dist: Record<string, number> = {};
	for (const n of graph.nodes) dist[n.id] = Infinity;
	if (!(start in dist)) return dist;
	dist[start] = 0;
	const expanded: { from: string; to: string; weight: number }[] = [];
	for (const e of graph.edges) {
		expanded.push({ from: e.from, to: e.to, weight: e.weight });
		if (!graph.directed) expanded.push({ from: e.to, to: e.from, weight: e.weight });
	}
	for (let i = 0; i < graph.nodes.length - 1; i++) {
		let changed = false;
		for (const e of expanded) {
			if (dist[e.from] === Infinity) continue;
			const cand = dist[e.from] + e.weight;
			if (cand < dist[e.to]) {
				dist[e.to] = cand;
				changed = true;
			}
		}
		if (!changed) break;
	}
	return dist;
}

/** Reference MST weight per connected component (Kruskal written plainly). */
export function referenceMstWeight(graph: Graph): { weight: number; components: number; edges: number } {
	const parent = new Map<string, string>();
	for (const n of graph.nodes) parent.set(n.id, n.id);
	const find = (x: string): string => {
		while (parent.get(x) !== x) {
			parent.set(x, parent.get(parent.get(x)!)!);
			x = parent.get(x)!;
		}
		return x;
	};
	const sorted = [...graph.edges].sort((a, b) => a.weight - b.weight || (a.id < b.id ? -1 : 1));
	let weight = 0;
	let used = 0;
	for (const e of sorted) {
		const ra = find(e.from);
		const rb = find(e.to);
		if (ra === rb) continue;
		parent.set(ra, rb);
		weight += e.weight;
		used++;
	}
	const roots = new Set(graph.nodes.map((n) => find(n.id)));
	return { weight, components: roots.size, edges: used };
}

/** Reference MST weight restricted to the component containing `start` (for Prim). */
export function referenceMstWeightFrom(graph: Graph, start: string): number {
	const adj = adjacency(graph);
	const seen = new Set<string>([start]);
	const stack = [start];
	while (stack.length) {
		const cur = stack.pop()!;
		for (const nb of adj.get(cur) ?? []) {
			if (!seen.has(nb.to)) {
				seen.add(nb.to);
				stack.push(nb.to);
			}
		}
	}
	const sub: Graph = {
		directed: graph.directed,
		nodes: graph.nodes.filter((n) => seen.has(n.id)),
		edges: graph.edges.filter((e) => seen.has(e.from) && seen.has(e.to))
	};
	return referenceMstWeight(sub).weight;
}

/** Is `out` a permutation of `inp`? Used by the sorting verifier. */
export function isPermutation(inp: number[], out: number[]): boolean {
	if (inp.length !== out.length) return false;
	const counts = new Map<number, number>();
	for (const v of inp) counts.set(v, (counts.get(v) ?? 0) + 1);
	for (const v of out) {
		const c = counts.get(v);
		if (!c) return false;
		if (c === 1) counts.delete(v);
		else counts.set(v, c - 1);
	}
	return counts.size === 0;
}

export function isAscending(a: number[]): boolean {
	for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
	return true;
}
