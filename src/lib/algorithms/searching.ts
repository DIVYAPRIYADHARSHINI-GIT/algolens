// Searching algorithms as pure step recorders.
// Binary and interpolation search REQUIRE sorted input; `isSorted` lets the UI warn and
// offer to sort first instead of silently animating a wrong run.

import { Recorder, type CellTag, type Step, type Trace } from '../core/types.js';

export type SearchName = 'linear' | 'binary' | 'interpolation';

export function isSorted(a: number[]): boolean {
	for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
	return true;
}

function emptyTags(n: number): CellTag[] {
	return new Array<CellTag>(n).fill('none');
}

function wrap(algorithm: string, input: number[], rec: Recorder, foundIndex: number | null): Trace {
	return {
		algorithm,
		family: 'searching',
		initial: {
			array: [...input],
			tags: emptyTags(input.length),
			cursors: { lo: null, mid: null, hi: null, i: null },
			range: { lo: null, hi: null }
		},
		steps: rec.steps,
		result: { kind: 'search', foundIndex, array: [...input] },
		truncated: rec.truncated
	};
}

export function linearSearch(input: number[], target: number, budget?: number): Trace {
	const rec = new Recorder(budget);
	const tags = emptyTags(input.length);
	let found: number | null = null;
	for (let i = 0; i < input.length; i++) {
		const prevTag = tags[i];
		rec.push({
			kind: 'compare',
			line: 2,
			explain:
				input[i] === target
					? `Checking position ${i}: ${input[i]} equals the target ${target}.`
					: `Checking position ${i}: ${input[i]} is not ${target}, so move on.`,
			patch: [
				{ t: 'tag', i, v: 'compare' },
				{ t: 'cursor', k: 'i', v: i }
			],
			inverse: [
				{ t: 'tag', i, v: prevTag },
				{ t: 'cursor', k: 'i', v: i === 0 ? null : i - 1 }
			],
			counters: { comparisons: 1, accesses: 1 }
		});
		tags[i] = 'compare';
		if (input[i] === target) {
			rec.push({
				kind: 'found',
				line: 3,
				explain: `Found ${target} at position ${i}.`,
				patch: [{ t: 'tag', i, v: 'found' }],
				inverse: [{ t: 'tag', i, v: 'compare' }]
			});
			found = i;
			return wrap('linear', input, rec, found);
		}
		rec.push({
			kind: 'read',
			line: 2,
			explain: 'Clearing the checked cell and stepping forward.',
			patch: [{ t: 'tag', i, v: 'none' }],
			inverse: [{ t: 'tag', i, v: 'compare' }]
		});
		tags[i] = 'none';
	}
	rec.push({
		kind: 'not-found',
		line: 4,
		explain: `Every position was checked and ${target} is not in the list.`,
		patch: [],
		inverse: []
	});
	return wrap('linear', input, rec, null);
}

/** Shared pointer-driven search body for binary and interpolation search. */
function pointerSearch(
	algorithm: 'binary' | 'interpolation',
	input: number[],
	target: number,
	budget?: number
): Trace {
	const rec = new Recorder(budget);
	let lo = 0;
	let hi = input.length - 1;
	let prevLo: number | null = null;
	let prevHi: number | null = null;
	let prevMid: number | null = null;
	const tagged = new Map<number, CellTag>();

	const setPointers = (nlo: number, nhi: number, mid: number | null, line: number, explain: string, kind: Step['kind'] = 'read') => {
		const patch: Step['patch'] = [
			{ t: 'cursor', k: 'lo', v: nlo },
			{ t: 'cursor', k: 'hi', v: nhi },
			{ t: 'cursor', k: 'mid', v: mid },
			{ t: 'range', lo: nlo, hi: nhi }
		];
		const inverse: Step['inverse'] = [
			{ t: 'cursor', k: 'lo', v: prevLo },
			{ t: 'cursor', k: 'hi', v: prevHi },
			{ t: 'cursor', k: 'mid', v: prevMid },
			{ t: 'range', lo: prevLo, hi: prevHi }
		];
		rec.push({ kind, line, explain, patch, inverse });
		prevLo = nlo;
		prevHi = nhi;
		prevMid = mid;
	};

	setPointers(lo, hi, null, 1, `The search range starts as positions ${lo} to ${hi}.`);

	while (lo <= hi && !rec.full) {
		let mid: number;
		if (algorithm === 'binary') {
			mid = lo + ((hi - lo) >> 1);
		} else {
			const span = input[hi] - input[lo];
			mid = span === 0 ? lo : lo + Math.max(0, Math.min(hi - lo, Math.floor(((target - input[lo]) * (hi - lo)) / span)));
		}
		setPointers(
			lo,
			hi,
			mid,
			2,
			algorithm === 'binary'
				? `The middle of positions ${lo} to ${hi} is position ${mid}, which holds ${input[mid]}.`
				: `Interpolating inside positions ${lo} to ${hi} estimates position ${mid}, which holds ${input[mid]}.`
		);

		const prev = tagged.get(mid) ?? 'none';
		rec.push({
			kind: 'compare',
			line: 3,
			explain:
				input[mid] === target
					? `${input[mid]} equals the target ${target}.`
					: input[mid] < target
						? `${input[mid]} is smaller than ${target}, so the answer must be to the right.`
						: `${input[mid]} is larger than ${target}, so the answer must be to the left.`,
			patch: [{ t: 'tag', i: mid, v: 'mid' }],
			inverse: [{ t: 'tag', i: mid, v: prev }],
			counters: { comparisons: 1, accesses: 1 }
		});
		tagged.set(mid, 'mid');

		if (input[mid] === target) {
			rec.push({
				kind: 'found',
				line: 4,
				explain: `Found ${target} at position ${mid}.`,
				patch: [{ t: 'tag', i: mid, v: 'found' }],
				inverse: [{ t: 'tag', i: mid, v: 'mid' }]
			});
			return wrap(algorithm, input, rec, mid);
		}
		if (input[mid] < target) {
			lo = mid + 1;
			setPointers(lo, hi, mid, 5, `Discarding positions up to ${mid}; the range is now ${lo} to ${hi}.`, 'set-range');
		} else {
			hi = mid - 1;
			setPointers(lo, hi, mid, 6, `Discarding positions from ${mid} up; the range is now ${lo} to ${hi}.`, 'set-range');
		}
	}
	rec.push({
		kind: 'not-found',
		line: 7,
		explain: `The range became empty, so ${target} is not in the list.`,
		patch: [],
		inverse: []
	});
	return wrap(algorithm, input, rec, null);
}

export function binarySearch(input: number[], target: number, budget?: number): Trace {
	return pointerSearch('binary', input, target, budget);
}

export function interpolationSearch(input: number[], target: number, budget?: number): Trace {
	return pointerSearch('interpolation', input, target, budget);
}

export const SEARCHERS: Record<SearchName, (input: number[], target: number, budget?: number) => Trace> = {
	linear: linearSearch,
	binary: binarySearch,
	interpolation: interpolationSearch
};
