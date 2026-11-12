// AlgoLens core step-recorder contract.
//
// Design intent (from the project brief):
//  - Algorithms are PURE TypeScript. They never import a component, never touch the DOM and
//    never know how anything is drawn. They take an input and return a Trace.
//  - Every step carries (a) the patch needed to move state forward, (b) the inverse patch so
//    stepping BACK is exact, (c) a pseudocode line number, (d) a plain-language explanation
//    and (e) a counter delta. Reversibility is what makes "step back == replay forward" true.
//  - The playback engine and the renderers consume Trace only.

/** Every event kind recorded by any algorithm family. */
export type StepKind =
	| 'compare'
	| 'swap'
	| 'write'
	| 'read'
	| 'mark-sorted'
	| 'set-pivot'
	| 'set-range'
	| 'recurse-push'
	| 'recurse-pop'
	| 'visit'
	| 'enqueue'
	| 'dequeue'
	| 'push'
	| 'pop'
	| 'relax'
	| 'no-relax'
	| 'path'
	| 'found'
	| 'not-found'
	| 'select-edge'
	| 'reject-edge'
	| 'union'
	| 'done';

/** A single reversible mutation of the visual state. */
export type Patch =
	| { t: 'arr'; i: number; v: number }
	| { t: 'tag'; i: number; v: CellTag }
	| { t: 'cursor'; k: string; v: number | null }
	| { t: 'range'; lo: number | null; hi: number | null }
	| { t: 'stack'; op: 'push' | 'pop'; frame?: StackFrame }
	| { t: 'node'; id: string; v: NodeTag }
	| { t: 'cell'; i: number; v: NodeTag }
	| { t: 'dist'; id: string; v: number }
	| { t: 'prev'; id: string; v: string | null }
	| { t: 'queue'; v: QueueEntry[] }
	| { t: 'edge'; id: string; v: EdgeTag }
	| { t: 'sets'; v: string[][] }
	| { t: 'pathNodes'; v: string[] }
	| { t: 'pathCells'; v: number[] };

/** Role of an array cell. Each role is paired with a label/shape cue in the renderer. */
export type CellTag = 'none' | 'compare' | 'swap' | 'write' | 'pivot' | 'sorted' | 'range' | 'found' | 'lo' | 'mid' | 'hi';

/** Role of a graph node or grid cell. */
export type NodeTag =
	| 'none'
	| 'wall'
	| 'start'
	| 'end'
	| 'frontier'
	| 'visited'
	| 'current'
	| 'path'
	| 'tree';

export type EdgeTag = 'none' | 'considered' | 'relaxed' | 'tree' | 'rejected' | 'path';

export interface StackFrame {
	label: string;
	lo: number;
	hi: number;
	depth: number;
}

export interface QueueEntry {
	id: string;
	key?: number;
}

/** Counter deltas applied by a step. All optional; absent means zero. */
export interface CounterDelta {
	comparisons?: number;
	swaps?: number;
	writes?: number;
	accesses?: number;
	depth?: number;
	edgesRelaxed?: number;
	visited?: number;
}

export interface Step {
	kind: StepKind;
	/** 1-based pseudocode line to highlight. */
	line: number;
	/** Plain-language sentence announced to screen readers. */
	explain: string;
	/** Forward mutations. */
	patch: Patch[];
	/** Exact inverse of `patch`, applied in reverse order when stepping back. */
	inverse: Patch[];
	counters?: CounterDelta;
}

/** Immutable starting state that step 0 shows. */
export interface TraceInitial {
	array?: number[];
	tags?: CellTag[];
	cursors?: Record<string, number | null>;
	range?: { lo: number | null; hi: number | null };
	cells?: NodeTag[];
	nodes?: Record<string, NodeTag>;
	dist?: Record<string, number>;
	prev?: Record<string, string | null>;
	queue?: QueueEntry[];
	edges?: Record<string, EdgeTag>;
	sets?: string[][];
}

export interface Trace {
	algorithm: string;
	family: 'sorting' | 'searching' | 'pathfinding' | 'graph';
	initial: TraceInitial;
	steps: Step[];
	/** Final answer surfaced by the UI and checked by the verifier. */
	result: TraceResult;
	/** True when the recorder stopped early because of the step budget. */
	truncated?: boolean;
}

export interface TraceResult {
	kind: 'sorted' | 'search' | 'path' | 'traversal' | 'mst' | 'distances';
	array?: number[];
	foundIndex?: number | null;
	path?: string[];
	pathCells?: number[];
	cost?: number;
	visitedCount?: number;
	order?: string[];
	mstEdges?: string[];
	mstWeight?: number;
	dist?: Record<string, number>;
	guaranteesShortest?: boolean;
}

/** Hard cap so a huge input can never exhaust memory or freeze the tab. */
export const MAX_STEPS = 60_000;

/** Recorder used by every algorithm: collects steps and enforces the budget. */
export class Recorder {
	readonly steps: Step[] = [];
	truncated = false;

	constructor(private readonly budget: number = MAX_STEPS) {}

	get full(): boolean {
		return this.steps.length >= this.budget;
	}

	push(step: Step): void {
		if (this.full) {
			this.truncated = true;
			return;
		}
		this.steps.push(step);
	}
}
