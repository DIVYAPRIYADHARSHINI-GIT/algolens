// Seeded input generators for the sorting and searching modes. Pure, so a given
// (preset, size, seed) always rebuilds the same array - that is what makes a shared link
// reproduce an identical run.

import { mulberry32, randomInt } from '../core/rng.js';
import type { SortPreset } from './samples.js';

export const MIN_SIZE = 5;
export const MAX_SIZE = 100;

export function generateInput(preset: SortPreset, size: number, seed: number): number[] {
	const n = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.floor(size)));
	const rand = mulberry32(seed);
	switch (preset) {
		case 'sorted':
			return Array.from({ length: n }, (_, i) => Math.round(((i + 1) / n) * 99) || 1);
		case 'reversed':
			return Array.from({ length: n }, (_, i) => Math.round(((n - i) / n) * 99) || 1);
		case 'nearly-sorted': {
			const arr = Array.from({ length: n }, (_, i) => Math.round(((i + 1) / n) * 99) || 1);
			// Disturb about a tenth of the array with adjacent swaps.
			const swaps = Math.max(1, Math.floor(n / 10));
			for (let s = 0; s < swaps; s++) {
				const i = randomInt(rand, 0, n - 2);
				[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
			}
			return arr;
		}
		case 'few-unique': {
			const values = [12, 37, 58, 81];
			return Array.from({ length: n }, () => values[randomInt(rand, 0, values.length - 1)]);
		}
		case 'random':
		default:
			return Array.from({ length: n }, () => randomInt(rand, 1, 99));
	}
}

/** Parse a user's comma-separated list. Accepts negatives, spaces and duplicates. */
export function parseCustomInput(text: string): { values: number[]; error: string | null } {
	const trimmed = text.trim();
	if (!trimmed) return { values: [], error: 'Enter at least one number.' };
	const parts = trimmed.split(/[,\s]+/).filter(Boolean);
	const values: number[] = [];
	for (const part of parts) {
		const v = Number(part);
		if (!Number.isFinite(v)) return { values: [], error: `"${part}" is not a number.` };
		if (!Number.isInteger(v)) return { values: [], error: 'Only whole numbers are supported.' };
		if (Math.abs(v) > 9999) return { values: [], error: 'Values must be between -9999 and 9999.' };
		values.push(v);
	}
	if (values.length < 1) return { values: [], error: 'Enter at least one number.' };
	if (values.length > MAX_SIZE) return { values: [], error: `At most ${MAX_SIZE} values are supported.` };
	return { values, error: null };
}

/**
 * Rough upper bound on recorded steps, used to warn BEFORE a huge run is recorded.
 * Quadratic sorts emit a handful of steps per comparison.
 */
export function estimateSteps(algorithm: string, n: number): number {
	switch (algorithm) {
		case 'bubble':
		case 'selection':
		case 'insertion':
			return Math.round(n * n * 1.6);
		case 'shell':
			return Math.round(n * Math.log2(Math.max(2, n)) * 4);
		case 'merge':
		case 'quick':
		case 'heap':
			return Math.round(n * Math.log2(Math.max(2, n)) * 5);
		default:
			return n * 4;
	}
}
