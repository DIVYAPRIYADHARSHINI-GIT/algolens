// Grid model shared by the pathfinding recorders, the reference solvers and the editor.
//
// COST MODEL (stated once so the visualiser, verifier and tests agree):
//   * Entering a cell costs that cell's weight (1..9). Leaving the start costs nothing.
//   * A diagonal move costs the same as a straight move (the weight of the entered cell).
//     This keeps the model simple; the consequence is recorded in `isAdmissible` below.
//   * Diagonal moves may NOT cut the corner of a wall: moving from (r,c) to (r+dr,c+dc)
//     requires BOTH (r+dr,c) and (r,c+dc) to be open.

import { mulberry32, randomInt } from '../core/rng.js';

export interface Grid {
	cols: number;
	rows: number;
	/** true = wall. Length cols*rows, row-major. */
	walls: boolean[];
	/** Cost of entering each cell, 1..9. */
	weights: number[];
	start: number;
	end: number;
	diagonal: boolean;
}

export const MAX_COLS = 60;
export const MAX_ROWS = 40;

export function makeGrid(cols: number, rows: number, diagonal = false): Grid {
	const n = cols * rows;
	const start = idx(cols, 1, Math.floor(rows / 2));
	const end = idx(cols, cols - 2, Math.floor(rows / 2));
	return {
		cols,
		rows,
		walls: new Array<boolean>(n).fill(false),
		weights: new Array<number>(n).fill(1),
		start,
		end: end === start ? Math.min(n - 1, start + 1) : end,
		diagonal
	};
}

export function idx(cols: number, x: number, y: number): number {
	return y * cols + x;
}

export function xy(grid: Grid, i: number): { x: number; y: number } {
	return { x: i % grid.cols, y: Math.floor(i / grid.cols) };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
	return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

const STRAIGHT: [number, number][] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0]
];
const DIAGONALS: [number, number][] = [
	[1, -1],
	[1, 1],
	[-1, 1],
	[-1, -1]
];

/** Deterministic neighbour order: N, E, S, W then the diagonals. */
export function neighbours(grid: Grid, i: number): number[] {
	const { x, y } = xy(grid, i);
	const out: number[] = [];
	for (const [dx, dy] of STRAIGHT) {
		const nx = x + dx;
		const ny = y + dy;
		if (!inBounds(grid, nx, ny)) continue;
		const ni = idx(grid.cols, nx, ny);
		if (grid.walls[ni]) continue;
		out.push(ni);
	}
	if (grid.diagonal) {
		for (const [dx, dy] of DIAGONALS) {
			const nx = x + dx;
			const ny = y + dy;
			if (!inBounds(grid, nx, ny)) continue;
			const ni = idx(grid.cols, nx, ny);
			if (grid.walls[ni]) continue;
			// No corner cutting: both orthogonal neighbours shared with this diagonal must be open.
			if (grid.walls[idx(grid.cols, nx, y)] || grid.walls[idx(grid.cols, x, ny)]) continue;
			out.push(ni);
		}
	}
	return out;
}

/** Cost of moving from `from` into `to`. */
export function moveCost(grid: Grid, _from: number, to: number): number {
	return grid.weights[to];
}

export type Heuristic = 'manhattan' | 'euclidean' | 'diagonal';

export function heuristic(grid: Grid, a: number, b: number, kind: Heuristic): number {
	const pa = xy(grid, a);
	const pb = xy(grid, b);
	const dx = Math.abs(pa.x - pb.x);
	const dy = Math.abs(pa.y - pb.y);
	if (kind === 'manhattan') return dx + dy;
	if (kind === 'euclidean') return Math.sqrt(dx * dx + dy * dy);
	return Math.max(dx, dy); // Chebyshev / diagonal distance
}

/**
 * Admissibility of a heuristic under this cost model, assuming the minimum cell weight is 1.
 * With 8-way movement the cheapest route needs only Chebyshev moves, so Manhattan can
 * overestimate and is NOT admissible. The UI shows this, and the A*-equals-Dijkstra tests
 * only use admissible combinations.
 */
export function isAdmissible(kind: Heuristic, diagonal: boolean): boolean {
	if (!diagonal) return true;
	return kind !== 'manhattan';
}

// ------------------------------------------------------------ generators

export function clearWalls(grid: Grid): Grid {
	return { ...grid, walls: grid.walls.map(() => false) };
}

export function clearWeights(grid: Grid): Grid {
	return { ...grid, weights: grid.weights.map(() => 1) };
}

export function randomWalls(grid: Grid, seed: number, density = 0.28): Grid {
	const rand = mulberry32(seed);
	const walls = grid.walls.map((_, i) => (i === grid.start || i === grid.end ? false : rand() < density));
	return { ...grid, walls };
}

/** Randomised depth-first maze on the odd lattice. */
export function dfsMaze(grid: Grid, seed: number): Grid {
	const rand = mulberry32(seed);
	const walls = new Array<boolean>(grid.cols * grid.rows).fill(true);
	const startX = 1;
	const startY = 1;
	const stack: [number, number][] = [[startX, startY]];
	walls[idx(grid.cols, startX, startY)] = false;
	while (stack.length) {
		const [x, y] = stack[stack.length - 1];
		const options: [number, number][] = [];
		for (const [dx, dy] of STRAIGHT) {
			const nx = x + dx * 2;
			const ny = y + dy * 2;
			if (nx > 0 && ny > 0 && nx < grid.cols - 1 && ny < grid.rows - 1 && walls[idx(grid.cols, nx, ny)]) {
				options.push([nx, ny]);
			}
		}
		if (!options.length) {
			stack.pop();
			continue;
		}
		const [nx, ny] = options[randomInt(rand, 0, options.length - 1)];
		walls[idx(grid.cols, (x + nx) / 2, (y + ny) / 2)] = false;
		walls[idx(grid.cols, nx, ny)] = false;
		stack.push([nx, ny]);
	}
	walls[grid.start] = false;
	walls[grid.end] = false;
	return { ...grid, walls };
}

/** Recursive division maze. */
export function divisionMaze(grid: Grid, seed: number): Grid {
	const rand = mulberry32(seed);
	const walls = new Array<boolean>(grid.cols * grid.rows).fill(false);
	for (let x = 0; x < grid.cols; x++) {
		walls[idx(grid.cols, x, 0)] = true;
		walls[idx(grid.cols, x, grid.rows - 1)] = true;
	}
	for (let y = 0; y < grid.rows; y++) {
		walls[idx(grid.cols, 0, y)] = true;
		walls[idx(grid.cols, grid.cols - 1, y)] = true;
	}

	const divide = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
		const w = x1 - x0 + 1;
		const h = y1 - y0 + 1;
		if (w < 3 || h < 3 || depth > 40) return;
		const horizontal = h > w ? true : w > h ? false : rand() < 0.5;
		if (horizontal) {
			const candidates: number[] = [];
			for (let y = y0 + 1; y <= y1 - 1; y += 2) candidates.push(y);
			if (!candidates.length) return;
			const wy = candidates[randomInt(rand, 0, candidates.length - 1)];
			const holes: number[] = [];
			for (let x = x0; x <= x1; x += 2) holes.push(x);
			const hole = holes[randomInt(rand, 0, holes.length - 1)];
			for (let x = x0; x <= x1; x++) if (x !== hole) walls[idx(grid.cols, x, wy)] = true;
			divide(x0, y0, x1, wy - 1, depth + 1);
			divide(x0, wy + 1, x1, y1, depth + 1);
		} else {
			const candidates: number[] = [];
			for (let x = x0 + 1; x <= x1 - 1; x += 2) candidates.push(x);
			if (!candidates.length) return;
			const wx = candidates[randomInt(rand, 0, candidates.length - 1)];
			const holes: number[] = [];
			for (let y = y0; y <= y1; y += 2) holes.push(y);
			const hole = holes[randomInt(rand, 0, holes.length - 1)];
			for (let y = y0; y <= y1; y++) if (y !== hole) walls[idx(grid.cols, wx, y)] = true;
			divide(x0, y0, wx - 1, y1, depth + 1);
			divide(wx + 1, y0, x1, y1, depth + 1);
		}
	};

	divide(1, 1, grid.cols - 2, grid.rows - 2, 0);
	walls[grid.start] = false;
	walls[grid.end] = false;
	return { ...grid, walls };
}

export function randomWeights(grid: Grid, seed: number, max = 9): Grid {
	const rand = mulberry32(seed ^ 0x9e3779b9);
	const weights = grid.weights.map((_, i) => (i === grid.start || i === grid.end ? 1 : rand() < 0.25 ? randomInt(rand, 2, max) : 1));
	return { ...grid, weights };
}
