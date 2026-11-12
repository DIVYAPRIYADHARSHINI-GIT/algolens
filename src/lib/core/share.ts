// Share links. The entire setup is encoded into the URL HASH, so a link can be shared with
// no server, no database and no stored state. The data is INSIDE the link - the UI says so.
//
// Robustness is a hard requirement: a truncated, oversized, mistyped or deliberately hostile
// hash must produce a clear error, never a crash and never a wrong-but-plausible setup.

import { MAX_COLS, MAX_ROWS, makeGrid, type Grid, type Heuristic } from '../algorithms/grid.js';
import type { Graph } from '../algorithms/graph.js';
import type { PivotRule, SortName } from '../algorithms/sorting.js';
import type { SearchName } from '../algorithms/searching.js';
import type { PathName } from '../algorithms/pathfinding.js';
import type { GraphName } from '../algorithms/graph.js';
import { validateSavedGraph } from './schema.js';
import type { Mode } from './schema.js';

export const SHARE_VERSION = 1;
/** Hard cap so an enormous hash can never be decoded into an enormous structure. */
export const MAX_HASH_LENGTH = 8000;

export interface ShareSetup {
	v: number;
	mode: Mode;
	sorting?: { algorithm: SortName; values: number[]; pivot: PivotRule; seed: number; view: 'bars' | 'cells' };
	searching?: { algorithm: SearchName; values: number[]; target: number };
	pathfinding?: { algorithm: PathName; heuristic: Heuristic; grid: EncodedGrid };
	graphs?: { algorithm: GraphName; graph: Graph; start: string; end: string };
	compare?: { left: SortName; right: SortName; values: number[] };
}

export interface EncodedGrid {
	cols: number;
	rows: number;
	diagonal: boolean;
	start: number;
	end: number;
	/** Run-length encoded walls, alternating run lengths starting with OPEN cells. */
	walls: number[];
	/** Sparse [index, weight] pairs for weights above 1. */
	weights: number[][];
}

export function encodeGrid(grid: Grid): EncodedGrid {
	const walls: number[] = [];
	let run = 0;
	let current = false; // start counting OPEN cells
	for (const w of grid.walls) {
		if (w === current) run++;
		else {
			walls.push(run);
			current = w;
			run = 1;
		}
	}
	walls.push(run);
	const weights: number[][] = [];
	grid.weights.forEach((w, i) => {
		if (w > 1) weights.push([i, w]);
	});
	return { cols: grid.cols, rows: grid.rows, diagonal: grid.diagonal, start: grid.start, end: grid.end, walls, weights };
}

export function decodeGrid(enc: EncodedGrid): Grid {
	const base = makeGrid(enc.cols, enc.rows, enc.diagonal);
	const cells = enc.cols * enc.rows;
	const walls = new Array<boolean>(cells).fill(false);
	let i = 0;
	let value = false;
	for (const run of enc.walls) {
		for (let k = 0; k < run && i < cells; k++) walls[i++] = value;
		value = !value;
	}
	const weights = new Array<number>(cells).fill(1);
	for (const [index, w] of enc.weights) {
		if (index >= 0 && index < cells) weights[index] = w;
	}
	return { ...base, walls, weights, start: enc.start, end: enc.end, diagonal: enc.diagonal };
}

/** Base64url of the UTF-8 JSON. Works in the browser and in Node without a polyfill. */
export function encodeShare(setup: ShareSetup): string {
	const json = JSON.stringify(setup);
	const bytes = new TextEncoder().encode(json);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	const b64 = base64Encode(binary);
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type ShareParse = { ok: true; setup: ShareSetup } | { ok: false; error: string };

export function decodeShare(hash: string): ShareParse {
	const raw = (hash ?? '').replace(/^#/, '').replace(/^s=/, '');
	if (!raw) return { ok: false, error: 'The link does not contain any shared setup.' };
	if (raw.length > MAX_HASH_LENGTH) return { ok: false, error: 'The shared link is too long to be a valid AlgoLens setup.' };
	if (!/^[A-Za-z0-9_-]+$/.test(raw)) return { ok: false, error: 'The shared link contains characters that are not part of an AlgoLens setup.' };
	let json: string;
	try {
		const b64 = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4);
		const binary = base64Decode(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		json = new TextDecoder().decode(bytes);
	} catch {
		return { ok: false, error: 'The shared link could not be decoded. It may have been cut short when it was copied.' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, error: 'The shared link does not contain a valid AlgoLens setup.' };
	}
	return validateShare(parsed);
}

const SORT_NAMES: SortName[] = ['bubble', 'selection', 'insertion', 'merge', 'quick', 'heap', 'shell', 'counting'];
const SEARCH_NAMES: SearchName[] = ['linear', 'binary', 'interpolation'];
const PATH_NAMES: PathName[] = ['bfs', 'dfs', 'dijkstra', 'astar', 'greedy'];
const GRAPH_NAMES: GraphName[] = ['bfs', 'dfs', 'dijkstra', 'prim', 'kruskal', 'topological'];
const PIVOTS: PivotRule[] = ['first', 'last', 'median3', 'random'];
const HEURISTICS: Heuristic[] = ['manhattan', 'euclidean', 'diagonal'];
const MODES: Mode[] = ['sorting', 'searching', 'pathfinding', 'graphs', 'compare', 'benchmark', 'practice', 'learn'];

/** Strict validation: anything out of range makes the whole link invalid with a reason. */
export function validateShare(raw: unknown): ShareParse {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { ok: false, error: 'The shared setup is not an object.' };
	}
	const o = raw as Record<string, unknown>;
	if (o.v !== SHARE_VERSION) return { ok: false, error: `This link uses share format ${String(o.v)}, which this version of AlgoLens does not understand.` };
	if (!MODES.includes(o.mode as Mode)) return { ok: false, error: 'The shared link names a mode that does not exist.' };

	const setup: ShareSetup = { v: SHARE_VERSION, mode: o.mode as Mode };

	if (o.sorting !== undefined) {
		const s = o.sorting as Record<string, unknown>;
		if (typeof s !== 'object' || s === null) return { ok: false, error: 'The shared sorting setup is malformed.' };
		if (!SORT_NAMES.includes(s.algorithm as SortName)) return { ok: false, error: 'The shared link names a sorting algorithm that does not exist.' };
		const values = numberArray(s.values, 100, -9999, 9999);
		if (!values) return { ok: false, error: 'The shared sorting input is not a valid list of up to 100 whole numbers.' };
		setup.sorting = {
			algorithm: s.algorithm as SortName,
			values,
			pivot: PIVOTS.includes(s.pivot as PivotRule) ? (s.pivot as PivotRule) : 'last',
			seed: Number.isInteger(s.seed) && (s.seed as number) >= 0 && (s.seed as number) < 1e9 ? (s.seed as number) : 1,
			view: s.view === 'cells' ? 'cells' : 'bars'
		};
	}

	if (o.searching !== undefined) {
		const s = o.searching as Record<string, unknown>;
		if (typeof s !== 'object' || s === null) return { ok: false, error: 'The shared searching setup is malformed.' };
		if (!SEARCH_NAMES.includes(s.algorithm as SearchName)) return { ok: false, error: 'The shared link names a searching algorithm that does not exist.' };
		const values = numberArray(s.values, 100, -9999, 9999);
		if (!values) return { ok: false, error: 'The shared searching input is not a valid list of numbers.' };
		if (!Number.isInteger(s.target) || Math.abs(s.target as number) > 9999) return { ok: false, error: 'The shared search target is not a whole number.' };
		setup.searching = { algorithm: s.algorithm as SearchName, values, target: s.target as number };
	}

	if (o.pathfinding !== undefined) {
		const p = o.pathfinding as Record<string, unknown>;
		if (typeof p !== 'object' || p === null) return { ok: false, error: 'The shared pathfinding setup is malformed.' };
		if (!PATH_NAMES.includes(p.algorithm as PathName)) return { ok: false, error: 'The shared link names a pathfinding algorithm that does not exist.' };
		const grid = validateEncodedGrid(p.grid);
		if (!grid) return { ok: false, error: 'The shared grid is not valid. It may be too large or damaged.' };
		setup.pathfinding = {
			algorithm: p.algorithm as PathName,
			heuristic: HEURISTICS.includes(p.heuristic as Heuristic) ? (p.heuristic as Heuristic) : 'manhattan',
			grid
		};
	}

	if (o.graphs !== undefined) {
		const g = o.graphs as Record<string, unknown>;
		if (typeof g !== 'object' || g === null) return { ok: false, error: 'The shared graph setup is malformed.' };
		if (!GRAPH_NAMES.includes(g.algorithm as GraphName)) return { ok: false, error: 'The shared link names a graph algorithm that does not exist.' };
		const validated = validateSavedGraph({ ...(g.graph as Record<string, unknown>), id: 'shared', name: 'Shared graph', createdAt: 0 });
		if (!validated) return { ok: false, error: 'The shared graph is not valid.' };
		const ids = new Set(validated.nodes.map((n) => n.id));
		const start = typeof g.start === 'string' && ids.has(g.start) ? g.start : (validated.nodes[0]?.id ?? '');
		const end = typeof g.end === 'string' && ids.has(g.end) ? g.end : (validated.nodes.at(-1)?.id ?? '');
		setup.graphs = {
			algorithm: g.algorithm as GraphName,
			graph: { directed: validated.directed, nodes: validated.nodes, edges: validated.edges },
			start,
			end
		};
	}

	if (o.compare !== undefined) {
		const c = o.compare as Record<string, unknown>;
		if (typeof c !== 'object' || c === null) return { ok: false, error: 'The shared compare setup is malformed.' };
		if (!SORT_NAMES.includes(c.left as SortName) || !SORT_NAMES.includes(c.right as SortName)) {
			return { ok: false, error: 'The shared compare setup names an algorithm that does not exist.' };
		}
		const values = numberArray(c.values, 100, -9999, 9999);
		if (!values) return { ok: false, error: 'The shared compare input is not a valid list of numbers.' };
		setup.compare = { left: c.left as SortName, right: c.right as SortName, values };
	}

	return { ok: true, setup };
}

export function validateEncodedGrid(raw: unknown): EncodedGrid | null {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
	const g = raw as Record<string, unknown>;
	const cols = Number(g.cols);
	const rows = Number(g.rows);
	if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
	if (cols < 2 || rows < 2 || cols > MAX_COLS || rows > MAX_ROWS) return null;
	const cells = cols * rows;
	const start = Number(g.start);
	const end = Number(g.end);
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start >= cells || end >= cells) return null;
	if (!Array.isArray(g.walls)) return null;
	if (g.walls.length > cells + 1) return null;
	let total = 0;
	for (const run of g.walls) {
		if (!Number.isInteger(run) || (run as number) < 0) return null;
		total += run as number;
		if (total > cells) return null;
	}
	const weights: number[][] = [];
	if (g.weights !== undefined) {
		if (!Array.isArray(g.weights) || g.weights.length > cells) return null;
		for (const pair of g.weights) {
			if (!Array.isArray(pair) || pair.length !== 2) return null;
			const [i, w] = pair as unknown[];
			if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= cells) return null;
			if (!Number.isInteger(w) || (w as number) < 1 || (w as number) > 9) return null;
			weights.push([i as number, w as number]);
		}
	}
	return { cols, rows, diagonal: g.diagonal === true, start, end, walls: g.walls as number[], weights };
}

function numberArray(raw: unknown, maxLength: number, min: number, max: number): number[] | null {
	if (!Array.isArray(raw)) return null;
	if (raw.length === 0 || raw.length > maxLength) return null;
	const out: number[] = [];
	for (const v of raw) {
		if (!Number.isInteger(v)) return null;
		const n = v as number;
		if (n < min || n > max) return null;
		out.push(n);
	}
	return out;
}

// base64 helpers that work in both the browser (btoa/atob) and Node (Buffer).
function base64Encode(binary: string): string {
	const g = globalThis as { btoa?: (s: string) => string; Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
	if (typeof g.btoa === 'function') return g.btoa(binary);
	if (g.Buffer) return g.Buffer.from(binary, 'binary').toString('base64');
	throw new Error('No base64 encoder available.');
}

function base64Decode(b64: string): string {
	const g = globalThis as { atob?: (s: string) => string; Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
	if (typeof g.atob === 'function') return g.atob(b64);
	if (g.Buffer) return g.Buffer.from(b64, 'base64').toString('binary');
	throw new Error('No base64 decoder available.');
}
