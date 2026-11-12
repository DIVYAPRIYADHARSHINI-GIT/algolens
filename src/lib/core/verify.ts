// Automatic result verification. Every finished run is checked against an independent
// reference before the UI shows the "Verified" badge. A failure is surfaced as an error
// state and logged through `onVerificationFailure` - it is never hidden.

import type { Grid } from '../algorithms/grid.js';
import { isAdmissible } from '../algorithms/grid.js';
import type { Graph } from '../algorithms/graph.js';
import type { PathName } from '../algorithms/pathfinding.js';
import { GUARANTEES_SHORTEST } from '../algorithms/pathfinding.js';
import {
	gridBellmanFord,
	gridBfsMoves,
	graphBellmanFord,
	isAscending,
	isPermutation,
	referenceMstWeight,
	referenceMstWeightFrom,
	validateGridPath
} from './reference.js';
import type { Trace } from './types.js';

export interface Verification {
	ok: boolean;
	label: string;
	details: string[];
}

export function verifySorting(input: number[], trace: Trace): Verification {
	const out = trace.result.array ?? [];
	const details: string[] = [];
	const sorted = isAscending(out);
	const perm = isPermutation(input, out);
	details.push(sorted ? 'Output is in non-decreasing order.' : 'FAILED: output is not in non-decreasing order.');
	details.push(perm ? 'Output is a permutation of the input (no value was lost or invented).' : 'FAILED: output is not a permutation of the input.');
	if (trace.truncated) details.push('Note: the recorded animation was truncated by the step budget, but the result above is the complete run.');
	return { ok: sorted && perm, label: sorted && perm ? 'Verified' : 'Verification failed', details };
}

/**
 * Verify a search result.
 *
 * `preconditionBroken` is true when the algorithm REQUIRES sorted input and the input is not
 * sorted. In that case a wrong answer is the documented consequence of misusing the
 * algorithm, not a defect in AlgoLens, so it is reported as a precondition warning instead
 * of a verification failure. The UI already warns about the unsorted input separately.
 */
export function verifySearch(
	input: number[],
	target: number,
	trace: Trace,
	preconditionBroken = false
): Verification {
	const idx = trace.result.foundIndex ?? null;
	const details: string[] = [];
	const exists = input.includes(target);
	let ok: boolean;
	if (idx === null) {
		ok = !exists;
		details.push(ok ? `A linear scan confirms ${target} is not present.` : `${target} is present at index ${input.indexOf(target)} but the search reported not found.`);
	} else {
		ok = input[idx] === target;
		details.push(ok ? `Index ${idx} really holds ${target}.` : `Index ${idx} holds ${input[idx]}, not ${target}.`);
	}
	if (!ok && preconditionBroken) {
		details.push('This algorithm requires sorted input and the input is not sorted, so a wrong answer is the expected consequence. Sort the input first to get a correct run.');
		return { ok: false, label: 'Precondition not met', details };
	}
	if (!ok) details[0] = `FAILED: ${details[0]}`;
	return { ok, label: ok ? 'Verified' : 'Verification failed', details };
}

export function verifyPath(grid: Grid, algorithm: PathName, heuristicKind: 'manhattan' | 'euclidean' | 'diagonal', trace: Trace): Verification {
	const details: string[] = [];
	const path = trace.result.pathCells ?? [];
	const reference = gridBellmanFord(grid);
	const optimal = reference[grid.end];

	if (grid.start === grid.end) {
		return { ok: true, label: 'Verified', details: ['The start and target are the same cell, so the empty path of cost 0 is correct.'] };
	}

	if (!path.length) {
		const ok = !Number.isFinite(optimal);
		details.push(ok ? 'An independent Bellman-Ford pass agrees that the target is unreachable.' : `FAILED: Bellman-Ford finds a route of cost ${optimal}, so "no path" is wrong.`);
		return { ok, label: ok ? 'Verified' : 'Verification failed', details };
	}

	const check = validateGridPath(grid, path);
	if (!check.ok) {
		details.push(`FAILED: ${check.reason}`);
		return { ok: false, label: 'Verification failed', details };
	}
	details.push(`The path is contiguous, avoids walls and costs ${check.cost}.`);
	details.push(`Reported cost ${trace.result.cost} matches the walked cost ${check.cost}.`);
	let ok = check.cost === trace.result.cost;
	if (!ok) details.push('FAILED: the reported cost does not match the walked cost.');

	const guarantee = GUARANTEES_SHORTEST[algorithm];
	if (guarantee === 'always' || (guarantee === 'if-admissible' && isAdmissible(heuristicKind, grid.diagonal))) {
		const optimalOk = check.cost === optimal;
		details.push(
			optimalOk
				? `Cost ${check.cost} equals the Bellman-Ford optimum, so this really is a cheapest path.`
				: `FAILED: Bellman-Ford optimum is ${optimal} but this path costs ${check.cost}.`
		);
		ok = ok && optimalOk;
	} else if (algorithm === 'bfs') {
		const moves = gridBfsMoves(grid)[grid.end];
		const movesOk = path.length - 1 === moves;
		details.push(
			movesOk
				? `BFS used ${moves} move(s), matching an independent breadth-first reference. BFS optimises moves, not cost, so cost ${check.cost} may exceed the cheapest ${optimal}.`
				: `FAILED: BFS reference expects ${moves} move(s) but the path has ${path.length - 1}.`
		);
		ok = ok && movesOk;
	} else {
		details.push(
			`${algorithm.toUpperCase()} does not guarantee a shortest path. This route costs ${check.cost}; the cheapest possible is ${optimal}${check.cost > optimal ? ' (so this one is longer, as expected)' : ''}.`
		);
	}

	return { ok, label: ok ? 'Verified' : 'Verification failed', details };
}

export function verifyGraph(graph: Graph, algorithm: string, start: string, trace: Trace): Verification {
	const details: string[] = [];
	if (algorithm === 'dijkstra') {
		const ref = graphBellmanFord(graph, start);
		const got = trace.result.dist ?? {};
		const bad = Object.keys(ref).filter((id) => normalise(ref[id]) !== normalise(got[id]));
		const ok = bad.length === 0;
		details.push(ok ? 'Every distance matches an independent Bellman-Ford reference.' : `FAILED: distances differ at ${bad.join(', ')}.`);
		return { ok, label: ok ? 'Verified' : 'Verification failed', details };
	}
	if (algorithm === 'kruskal' || algorithm === 'prim') {
		const expected = algorithm === 'prim' ? referenceMstWeightFrom(graph, start) : referenceMstWeight(graph).weight;
		const got = trace.result.mstWeight ?? 0;
		const ok = got === expected;
		details.push(
			ok
				? `Total weight ${got} matches an independently computed minimum spanning ${algorithm === 'prim' ? 'tree' : 'forest'}.`
				: `FAILED: expected weight ${expected} but got ${got}.`
		);
		return { ok, label: ok ? 'Verified' : 'Verification failed', details };
	}
	if (algorithm === 'bfs' || algorithm === 'dfs') {
		const order = trace.result.order ?? [];
		const unique = new Set(order).size === order.length;
		const ok = unique;
		details.push(ok ? `Visited ${order.length} node(s), each exactly once.` : 'FAILED: a node was visited more than once.');
		return { ok, label: ok ? 'Verified' : 'Verification failed', details };
	}
	if (algorithm === 'topological') {
		const order = trace.result.order ?? [];
		if (!order.length) {
			return { ok: true, label: 'Verified', details: ['No order was produced, which is correct for a graph containing a cycle.'] };
		}
		const pos = new Map(order.map((id, i) => [id, i]));
		const broken = graph.edges.filter((e) => (pos.get(e.from) ?? -1) > (pos.get(e.to) ?? -1));
		const ok = broken.length === 0 && order.length === graph.nodes.length;
		details.push(ok ? 'Every directed edge points forwards in the produced order.' : `FAILED: ${broken.length} edge(s) point backwards.`);
		return { ok, label: ok ? 'Verified' : 'Verification failed', details };
	}
	return { ok: true, label: 'Verified', details: ['No independent reference applies to this run.'] };
}

function normalise(v: number | undefined): string {
	if (v === undefined) return 'missing';
	return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : 'inf';
}
