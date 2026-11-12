// Visual state + patch application. Pure: no DOM, no Svelte.
//
// The engine holds ONE VisualState and moves it forward/backward by applying patches.
// Because every Step carries an exact inverse, `forward` then `back` restores the previous
// state bit-for-bit, which is what the property tests assert.

import type { CellTag, EdgeTag, NodeTag, Patch, QueueEntry, StackFrame, Trace, TraceInitial } from './types.js';

export interface VisualState {
	array: number[];
	tags: CellTag[];
	cursors: Record<string, number | null>;
	range: { lo: number | null; hi: number | null };
	stack: StackFrame[];
	cells: NodeTag[];
	nodes: Record<string, NodeTag>;
	dist: Record<string, number>;
	prev: Record<string, string | null>;
	queue: QueueEntry[];
	edges: Record<string, EdgeTag>;
	sets: string[][];
	pathNodes: string[];
	pathCells: number[];
	counters: Counters;
}

export interface Counters {
	comparisons: number;
	swaps: number;
	writes: number;
	accesses: number;
	depth: number;
	maxDepth: number;
	edgesRelaxed: number;
	visited: number;
	steps: number;
}

export function emptyCounters(): Counters {
	return {
		comparisons: 0,
		swaps: 0,
		writes: 0,
		accesses: 0,
		depth: 0,
		maxDepth: 0,
		edgesRelaxed: 0,
		visited: 0,
		steps: 0
	};
}

export function initialState(init: TraceInitial): VisualState {
	return {
		array: init.array ? [...init.array] : [],
		tags: init.tags ? [...init.tags] : init.array ? init.array.map(() => 'none' as CellTag) : [],
		cursors: stripNull(init.cursors ?? {}),
		range: { ...(init.range ?? { lo: null, hi: null }) },
		stack: [],
		cells: init.cells ? [...init.cells] : [],
		nodes: { ...(init.nodes ?? {}) },
		dist: stripInfinite(init.dist ?? {}),
		prev: stripNull(init.prev ?? {}),
		queue: init.queue ? init.queue.map((q) => ({ ...q })) : [],
		edges: { ...(init.edges ?? {}) },
		sets: init.sets ? init.sets.map((s) => [...s]) : [],
		pathNodes: [],
		pathCells: [],
		counters: emptyCounters()
	};
}

function stripNull<T>(o: Record<string, T | null>): Record<string, T> {
	const out: Record<string, T> = {};
	for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v as T;
	return out;
}

function stripInfinite(o: Record<string, number>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [k, v] of Object.entries(o)) if (Number.isFinite(v)) out[k] = v;
	return out;
}

/** An empty state, used before a real trace is loaded. */
export function emptyVisualState(): VisualState {
	return initialState({});
}

/**
 * Shallow-copy the state so a Svelte template sees a NEW reference after each change.
 * Nested values are copied one level deep, which is all the renderers read.
 */
export function cloneVisualState(s: VisualState): VisualState {
	return {
		array: [...s.array],
		tags: [...s.tags],
		cursors: { ...s.cursors },
		range: { ...s.range },
		stack: s.stack.map((f) => ({ ...f })),
		cells: [...s.cells],
		nodes: { ...s.nodes },
		dist: { ...s.dist },
		prev: { ...s.prev },
		queue: s.queue.map((q) => ({ ...q })),
		edges: { ...s.edges },
		sets: s.sets.map((x) => [...x]),
		pathNodes: [...s.pathNodes],
		pathCells: [...s.pathCells],
		counters: { ...s.counters }
	};
}

export function applyPatch(s: VisualState, p: Patch): void {
	switch (p.t) {
		case 'arr':
			s.array[p.i] = p.v;
			break;
		case 'tag':
			s.tags[p.i] = p.v;
			break;
		case 'cursor':
			// Absence and null mean the same thing (the pointer is not shown), so a null
			// patch DELETES the key. Without this, undoing a cursor step would leave an
			// explicit null behind and "step back" would not be bit-for-bit exact.
			if (p.v === null) delete s.cursors[p.k];
			else s.cursors[p.k] = p.v;
			break;
		case 'range':
			s.range = { lo: p.lo, hi: p.hi };
			break;
		case 'stack':
			if (p.op === 'push') {
				if (p.frame) s.stack.push({ ...p.frame });
			} else {
				s.stack.pop();
			}
			break;
		case 'node':
			s.nodes[p.id] = p.v;
			break;
		case 'cell':
			s.cells[p.i] = p.v;
			break;
		case 'dist':
			// An unreachable distance is stored as absence rather than Infinity, for the same
			// exact-undo reason. Renderers show a missing distance as the infinity symbol.
			if (!Number.isFinite(p.v)) delete s.dist[p.id];
			else s.dist[p.id] = p.v;
			break;
		case 'prev':
			if (p.v === null) delete s.prev[p.id];
			else s.prev[p.id] = p.v;
			break;
		case 'queue':
			s.queue = p.v.map((q) => ({ ...q }));
			break;
		case 'edge':
			s.edges[p.id] = p.v;
			break;
		case 'sets':
			s.sets = p.v.map((x) => [...x]);
			break;
		case 'pathNodes':
			s.pathNodes = [...p.v];
			break;
		case 'pathCells':
			s.pathCells = [...p.v];
			break;
	}
}

/** Advance the state by exactly one step. Returns false at the end of the trace. */
export function stepForward(s: VisualState, trace: Trace, index: number): boolean {
	const step = trace.steps[index];
	if (!step) return false;
	for (const p of step.patch) applyPatch(s, p);
	const c = step.counters;
	if (c) {
		s.counters.comparisons += c.comparisons ?? 0;
		s.counters.swaps += c.swaps ?? 0;
		s.counters.writes += c.writes ?? 0;
		s.counters.accesses += c.accesses ?? 0;
		s.counters.depth += c.depth ?? 0;
		s.counters.edgesRelaxed += c.edgesRelaxed ?? 0;
		s.counters.visited += c.visited ?? 0;
		if (s.counters.depth > s.counters.maxDepth) s.counters.maxDepth = s.counters.depth;
	}
	s.counters.steps = index + 1;
	return true;
}

/** Undo exactly one step. `index` is the step that is being undone. */
export function stepBack(s: VisualState, trace: Trace, index: number): boolean {
	const step = trace.steps[index];
	if (!step) return false;
	for (let i = step.inverse.length - 1; i >= 0; i--) applyPatch(s, step.inverse[i]);
	const c = step.counters;
	if (c) {
		s.counters.comparisons -= c.comparisons ?? 0;
		s.counters.swaps -= c.swaps ?? 0;
		s.counters.writes -= c.writes ?? 0;
		s.counters.accesses -= c.accesses ?? 0;
		s.counters.depth -= c.depth ?? 0;
		s.counters.edgesRelaxed -= c.edgesRelaxed ?? 0;
		s.counters.visited -= c.visited ?? 0;
	}
	s.counters.steps = index;
	return true;
}

/** Replay from scratch to `index` steps applied. Used by tests as the reference. */
export function replayTo(trace: Trace, index: number): VisualState {
	const s = initialState(trace.initial);
	for (let i = 0; i < index; i++) stepForward(s, trace, i);
	// maxDepth is a running maximum, so a replay recomputes it naturally.
	return s;
}

/** Stable structural snapshot used for equality assertions in tests. */
export function snapshot(s: VisualState): string {
	return JSON.stringify({
		array: s.array,
		tags: s.tags,
		cursors: sortedEntries(s.cursors),
		range: s.range,
		stack: s.stack,
		cells: s.cells,
		nodes: sortedEntries(s.nodes),
		dist: sortedEntries(s.dist),
		prev: sortedEntries(s.prev),
		queue: s.queue,
		edges: sortedEntries(s.edges),
		sets: s.sets,
		pathNodes: s.pathNodes,
		pathCells: s.pathCells,
		counters: {
			comparisons: s.counters.comparisons,
			swaps: s.counters.swaps,
			writes: s.counters.writes,
			accesses: s.counters.accesses,
			depth: s.counters.depth,
			edgesRelaxed: s.counters.edgesRelaxed,
			visited: s.counters.visited,
			steps: s.counters.steps
		}
	});
}

function sortedEntries(o: Record<string, unknown>): [string, unknown][] {
	return Object.keys(o)
		.sort()
		.map((k) => [k, o[k]] as [string, unknown]);
}
