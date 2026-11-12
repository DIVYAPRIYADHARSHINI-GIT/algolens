// Pre-loaded examples so every mode shows real content on first open. These are the ONLY
// data the live app ships with - no test fixtures, no debug rows.

import { divisionMaze, idx, makeGrid, type Grid } from '../algorithms/grid.js';
import type { Graph } from '../algorithms/graph.js';

/** A sorting input that shows comparisons, swaps and a duplicate pair immediately. */
export function sampleArray(): number[] {
	return [42, 17, 93, 8, 61, 29, 75, 4, 56, 38, 17, 84, 23, 67, 11];
}

/** A 24x16 maze with a weighted "slow ground" corridor, so weights are visible at once. */
export function sampleGrid(): Grid {
	const base = makeGrid(24, 16, false);
	const start = idx(base.cols, 1, 8);
	const end = idx(base.cols, 22, 7);
	const maze = divisionMaze({ ...base, start, end }, 20240617);
	const weights = [...maze.weights];
	// A band of costly cells down the middle: Dijkstra routes around it, BFS walks through.
	for (let y = 1; y < base.rows - 1; y++) {
		for (const x of [11, 12]) {
			const i = idx(base.cols, x, y);
			if (!maze.walls[i]) weights[i] = 8;
		}
	}
	return { ...maze, weights, start, end };
}

/** A small connected weighted graph where Dijkstra, Prim and Kruskal all have work to do. */
export function sampleGraph(): Graph {
	const nodes = [
		{ id: 'n1', label: 'A', x: 120, y: 90 },
		{ id: 'n2', label: 'B', x: 300, y: 60 },
		{ id: 'n3', label: 'C', x: 470, y: 110 },
		{ id: 'n4', label: 'D', x: 150, y: 260 },
		{ id: 'n5', label: 'E', x: 330, y: 220 },
		{ id: 'n6', label: 'F', x: 500, y: 290 }
	];
	const raw: [string, string, number][] = [
		['n1', 'n2', 4],
		['n1', 'n4', 3],
		['n2', 'n3', 5],
		['n2', 'n5', 2],
		['n3', 'n6', 6],
		['n4', 'n5', 7],
		['n5', 'n6', 4],
		['n4', 'n6', 11]
	];
	return {
		directed: false,
		nodes,
		edges: raw.map(([from, to, weight]) => ({ id: `${from}->${to}`, from, to, weight }))
	};
}

/** A small directed acyclic graph for topological sort. */
export function sampleDag(): Graph {
	const nodes = [
		{ id: 'n1', label: 'A', x: 110, y: 80 },
		{ id: 'n2', label: 'B', x: 280, y: 60 },
		{ id: 'n3', label: 'C', x: 280, y: 200 },
		{ id: 'n4', label: 'D', x: 450, y: 130 },
		{ id: 'n5', label: 'E', x: 610, y: 130 }
	];
	const raw: [string, string, number][] = [
		['n1', 'n2', 1],
		['n1', 'n3', 1],
		['n2', 'n4', 1],
		['n3', 'n4', 1],
		['n4', 'n5', 1]
	];
	return {
		directed: true,
		nodes,
		edges: raw.map(([from, to, weight]) => ({ id: `${from}->${to}`, from, to, weight }))
	};
}

export const SORT_PRESETS = ['random', 'nearly-sorted', 'reversed', 'few-unique', 'sorted'] as const;
export type SortPreset = (typeof SORT_PRESETS)[number];

export const PRESET_LABELS: Record<SortPreset, string> = {
	random: 'Random',
	'nearly-sorted': 'Nearly sorted',
	reversed: 'Reversed',
	'few-unique': 'Few unique values',
	sorted: 'Already sorted'
};
