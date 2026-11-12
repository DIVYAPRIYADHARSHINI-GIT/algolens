// Sorting algorithms as pure step recorders.
//
// Each function walks a LOCAL copy of the array and records a reversible Step for every
// observable event. The patches describe exactly what the renderer should change, and each
// `inverse` is built from the values read BEFORE the mutation, so stepping back is exact.
//
// Tag discipline: a step that highlights cells also records the tag it replaced, so undoing
// restores the previous highlight instead of clearing it.

import { Recorder, type CellTag, type Patch, type Step, type Trace } from '../core/types.js';
import { mulberry32 } from '../core/rng.js';

export type SortName = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick' | 'heap' | 'shell' | 'counting';

export type PivotRule = 'first' | 'last' | 'median3' | 'random';

export interface SortOptions {
	pivot?: PivotRule;
	seed?: number;
	budget?: number;
}

/** Small helper that owns the working array + tag mirror and emits reversible steps. */
class SortCtx {
	readonly a: number[];
	readonly tags: CellTag[];
	readonly rec: Recorder;
	/** Mirror of every cursor so an inverse patch restores the REAL previous value. */
	private readonly cursors = new Map<string, number | null>();
	private rangeLo: number | null = null;
	private rangeHi: number | null = null;

	constructor(input: number[], budget?: number) {
		this.a = [...input];
		this.tags = input.map(() => 'none' as CellTag);
		this.rec = new Recorder(budget);
	}

	/** Build a reversible cursor patch pair from the tracked previous value. */
	cursorPatch(entries: [string, number | null][]): { patch: Patch[]; inverse: Patch[] } {
		const patch: Patch[] = [];
		const inverse: Patch[] = [];
		for (const [k, v] of entries) {
			inverse.push({ t: 'cursor', k, v: this.cursors.get(k) ?? null });
			patch.push({ t: 'cursor', k, v });
			this.cursors.set(k, v);
		}
		return { patch, inverse };
	}

	/** Build a reversible range patch pair from the tracked previous range. */
	rangePatch(lo: number | null, hi: number | null): { patch: Patch[]; inverse: Patch[] } {
		const inverse: Patch[] = [{ t: 'range', lo: this.rangeLo, hi: this.rangeHi }];
		const patch: Patch[] = [{ t: 'range', lo, hi }];
		this.rangeLo = lo;
		this.rangeHi = hi;
		return { patch, inverse };
	}

	/** Set tags on cells, returning the forward+inverse patch pair. */
	tagPatch(entries: [number, CellTag][]): { patch: Patch[]; inverse: Patch[] } {
		const patch: Patch[] = [];
		const inverse: Patch[] = [];
		for (const [i, v] of entries) {
			if (i < 0 || i >= this.a.length) continue;
			inverse.push({ t: 'tag', i, v: this.tags[i] });
			patch.push({ t: 'tag', i, v });
			this.tags[i] = v;
		}
		return { patch, inverse };
	}

	emit(step: Step): void {
		this.rec.push(step);
	}

	/** compare a[i] vs a[j] and record it. */
	compare(i: number, j: number, line: number, explain?: string): void {
		const { patch, inverse } = this.tagPatch([
			[i, 'compare'],
			[j, 'compare']
		]);
		this.emit({
			kind: 'compare',
			line,
			explain: explain ?? describeCompare(this.a[i], this.a[j]),
			patch,
			inverse,
			counters: { comparisons: 1, accesses: 2 }
		});
	}

	swap(i: number, j: number, line: number): void {
		const vi = this.a[i];
		const vj = this.a[j];
		const tag = this.tagPatch([
			[i, 'swap'],
			[j, 'swap']
		]);
		const patch: Patch[] = [
			...tag.patch,
			{ t: 'arr', i, v: vj },
			{ t: 'arr', i: j, v: vi }
		];
		const inverse: Patch[] = [
			...tag.inverse,
			{ t: 'arr', i, v: vi },
			{ t: 'arr', i: j, v: vj }
		];
		this.a[i] = vj;
		this.a[j] = vi;
		this.emit({
			kind: 'swap',
			line,
			explain: `Swapping ${vi} and ${vj} so the larger value moves right.`,
			patch,
			inverse,
			counters: { swaps: 1, writes: 2, accesses: 2 }
		});
	}

	write(i: number, v: number, line: number, explain?: string): void {
		const old = this.a[i];
		const tag = this.tagPatch([[i, 'write']]);
		this.a[i] = v;
		this.emit({
			kind: 'write',
			line,
			explain: explain ?? `Writing ${v} into position ${i}.`,
			patch: [...tag.patch, { t: 'arr', i, v }],
			inverse: [...tag.inverse, { t: 'arr', i, v: old }],
			counters: { writes: 1, accesses: 1 }
		});
	}

	markSorted(i: number, line: number, explain?: string): void {
		const { patch, inverse } = this.tagPatch([[i, 'sorted']]);
		this.emit({
			kind: 'mark-sorted',
			line,
			explain: explain ?? `Position ${i} now holds ${this.a[i]}, which is in its final place.`,
			patch,
			inverse
		});
	}

	clearTags(indices: number[], line: number, explain: string, kind: Step['kind'] = 'read'): void {
		const entries = indices.filter((i) => this.tags[i] !== 'sorted').map((i) => [i, 'none'] as [number, CellTag]);
		const { patch, inverse } = this.tagPatch(entries);
		if (patch.length === 0) return;
		this.emit({ kind, line, explain, patch, inverse });
	}

	setRange(lo: number | null, hi: number | null, line: number, explain: string): void {
		const { patch, inverse } = this.rangePatch(lo, hi);
		this.emit({ kind: 'set-range', line, explain, patch, inverse });
	}

	finish(line: number, explain = 'The array is fully sorted.'): void {
		this.emit({ kind: 'done', line, explain, patch: [], inverse: [] });
	}
}

function describeCompare(x: number, y: number): string {
	if (x > y) return `Comparing ${x} and ${y}. ${x} is greater, so they are out of order.`;
	if (x < y) return `Comparing ${x} and ${y}. ${x} is smaller, so they are already in order.`;
	return `Comparing ${x} and ${y}. They are equal, so nothing needs to move.`;
}

function build(ctx: SortCtx, input: number[], algorithm: string): Trace {
	return {
		algorithm,
		family: 'sorting',
		initial: { array: [...input], tags: input.map(() => 'none' as CellTag), range: { lo: null, hi: null } },
		steps: ctx.rec.steps,
		result: { kind: 'sorted', array: [...ctx.a] },
		truncated: ctx.rec.truncated
	};
}

// ---------------------------------------------------------------- bubble sort

export function bubbleSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;
	for (let i = 0; i < n - 1; i++) {
		let swapped = false;
		for (let j = 0; j < n - 1 - i; j++) {
			c.compare(j, j + 1, 4);
			if (c.a[j] > c.a[j + 1]) {
				c.swap(j, j + 1, 5);
				swapped = true;
			}
			c.clearTags([j, j + 1], 4, 'Moving the comparison window one position to the right.');
		}
		c.markSorted(n - 1 - i, 7);
		if (!swapped) {
			// Early exit: the pass found nothing to swap, so everything left is already sorted.
			for (let k = 0; k <= n - 2 - i; k++) c.markSorted(k, 8, `No swaps happened in that pass, so position ${k} is already final.`);
			c.emit({
				kind: 'done',
				line: 8,
				explain: 'A full pass made no swaps, so the array is already sorted and bubble sort stops early.',
				patch: [],
				inverse: []
			});
			return build(c, input, 'bubble');
		}
	}
	if (n > 0) c.markSorted(0, 7);
	c.finish(9);
	return build(c, input, 'bubble');
}

// ------------------------------------------------------------- selection sort

export function selectionSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;
	for (let i = 0; i < n - 1; i++) {
		let min = i;
		const rp = c.rangePatch(i, n - 1);
		const mp = c.cursorPatch([['min', min]]);
		c.emit({
			kind: 'set-range',
			line: 3,
			explain: `Looking for the smallest value in positions ${i} to ${n - 1}.`,
			patch: [...rp.patch, ...mp.patch],
			inverse: [...mp.inverse, ...rp.inverse]
		});
		for (let j = i + 1; j < n; j++) {
			c.compare(j, min, 4, `Comparing ${c.a[j]} with the smallest so far, ${c.a[min]}.`);
			if (c.a[j] < c.a[min]) {
				min = j;
				const mv = c.cursorPatch([['min', j]]);
				c.emit({
					kind: 'write',
					line: 5,
					explain: `${c.a[j]} is smaller, so position ${j} is the new minimum.`,
					patch: mv.patch,
					inverse: mv.inverse
				});
			}
			c.clearTags([j, min], 4, 'Continuing the scan for a smaller value.');
		}
		if (min !== i) c.swap(i, min, 6);
		c.markSorted(i, 7);
	}
	if (n > 0) c.markSorted(n - 1, 7);
	c.finish(8);
	return build(c, input, 'selection');
}

// ------------------------------------------------------------- insertion sort

export function insertionSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;
	if (n > 0) c.markSorted(0, 2, 'The first element on its own is trivially sorted.');
	for (let i = 1; i < n; i++) {
		const key = c.a[i];
		const kp = c.cursorPatch([['key', i]]);
		const kt = c.tagPatch([[i, 'write']]);
		c.emit({
			kind: 'read',
			line: 3,
			explain: `Taking ${key} out of the array to insert it into the sorted left part.`,
			patch: [...kp.patch, ...kt.patch],
			inverse: [...kt.inverse, ...kp.inverse],
			counters: { accesses: 1 }
		});
		let j = i - 1;
		while (j >= 0) {
			c.compare(j, i, 5, `Comparing ${c.a[j]} with the held value ${key}.`);
			if (c.a[j] <= key) {
				c.clearTags([j], 5, `${c.a[j]} is not greater than ${key}, so the insertion point is found.`);
				break;
			}
			c.write(j + 1, c.a[j], 6, `${c.a[j]} is greater than ${key}, so it shifts one place right.`);
			c.clearTags([j], 6, 'Looking one position further left.');
			j--;
		}
		c.write(j + 1, key, 8, `Placing ${key} at position ${j + 1}.`);
		for (let k = 0; k <= i; k++) c.markSorted(k, 8, `Positions 0 to ${i} are sorted among themselves.`);
	}
	c.finish(9);
	return build(c, input, 'insertion');
}

// ----------------------------------------------------------------- merge sort

export function mergeSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const aux = [...c.a];

	const pushFrame = (label: string, lo: number, hi: number, depth: number) => {
		const rp = c.rangePatch(lo, hi);
		c.emit({
			kind: 'recurse-push',
			line: 1,
			explain: `${label} on positions ${lo} to ${hi} (depth ${depth}).`,
			patch: [{ t: 'stack', op: 'push', frame: { label, lo, hi, depth } }, ...rp.patch],
			inverse: [...rp.inverse, { t: 'stack', op: 'pop' }],
			counters: { depth: 1 }
		});
	};
	const popFrame = (label: string, lo: number, hi: number, depth: number) => {
		const rp = c.rangePatch(null, null);
		c.emit({
			kind: 'recurse-pop',
			line: 9,
			explain: `Finished ${label} on positions ${lo} to ${hi}; that run is now sorted.`,
			patch: [{ t: 'stack', op: 'pop' }, ...rp.patch],
			inverse: [...rp.inverse, { t: 'stack', op: 'push', frame: { label, lo, hi, depth } }],
			counters: { depth: -1 }
		});
	};

	const sort = (lo: number, hi: number, depth: number): void => {
		if (lo >= hi || c.rec.full) return;
		pushFrame('mergeSort', lo, hi, depth);
		const mid = (lo + hi) >> 1;
		sort(lo, mid, depth + 1);
		sort(mid + 1, hi, depth + 1);
		merge(lo, mid, hi);
		popFrame('mergeSort', lo, hi, depth);
	};

	const merge = (lo: number, mid: number, hi: number): void => {
		for (let k = lo; k <= hi; k++) aux[k] = c.a[k];
		const mr = c.rangePatch(lo, hi);
		c.emit({
			kind: 'read',
			line: 5,
			explain: `Merging the sorted runs ${lo}-${mid} and ${mid + 1}-${hi}.`,
			patch: mr.patch,
			inverse: mr.inverse,
			counters: { accesses: hi - lo + 1 }
		});
		let i = lo;
		let j = mid + 1;
		for (let k = lo; k <= hi; k++) {
			if (i > mid) {
				c.write(k, aux[j], 7, `The left run is used up, so ${aux[j]} comes from the right run.`);
				j++;
			} else if (j > hi) {
				c.write(k, aux[i], 7, `The right run is used up, so ${aux[i]} comes from the left run.`);
				i++;
			} else {
				// <= keeps merge sort STABLE: equal elements take the left (earlier) one first.
				const cp = c.cursorPatch([
					['i', i],
					['j', j]
				]);
				c.emit({
					kind: 'compare',
					line: 6,
					explain: describeCompare(aux[i], aux[j]),
					patch: cp.patch,
					inverse: cp.inverse,
					counters: { comparisons: 1, accesses: 2 }
				});
				if (aux[i] <= aux[j]) {
					c.write(k, aux[i], 7, `${aux[i]} is not greater than ${aux[j]}, so it is written first (this keeps merge sort stable).`);
					i++;
				} else {
					c.write(k, aux[j], 7, `${aux[j]} is smaller, so it is written first.`);
					j++;
				}
			}
			if (c.rec.full) return;
		}
	};

	sort(0, c.a.length - 1, 0);
	for (let k = 0; k < c.a.length; k++) c.markSorted(k, 9);
	c.finish(10);
	return build(c, input, 'merge');
}

// ----------------------------------------------------------------- quick sort

export function quickSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const rule: PivotRule = opts.pivot ?? 'last';
	const rand = mulberry32(opts.seed ?? 1);

	const choosePivot = (lo: number, hi: number): number => {
		if (rule === 'first') return lo;
		if (rule === 'last') return hi;
		if (rule === 'random') return lo + Math.floor(rand() * (hi - lo + 1));
		// median-of-three: order lo, mid, hi and use the middle value.
		const mid = (lo + hi) >> 1;
		const trio: [number, number][] = [
			[c.a[lo], lo],
			[c.a[mid], mid],
			[c.a[hi], hi]
		];
		trio.sort((x, y) => x[0] - y[0]);
		return trio[1][1];
	};

	const sort = (lo: number, hi: number, depth: number): void => {
		if (lo > hi || c.rec.full) return;
		if (lo === hi) {
			c.markSorted(lo, 10, `A single element at position ${lo} is already in place.`);
			return;
		}
		const qr = c.rangePatch(lo, hi);
		c.emit({
			kind: 'recurse-push',
			line: 1,
			explain: `quickSort on positions ${lo} to ${hi} (depth ${depth}).`,
			patch: [{ t: 'stack', op: 'push', frame: { label: 'quickSort', lo, hi, depth } }, ...qr.patch],
			inverse: [...qr.inverse, { t: 'stack', op: 'pop' }],
			counters: { depth: 1 }
		});

		const pivotIndex = choosePivot(lo, hi);
		if (pivotIndex !== hi) c.swap(pivotIndex, hi, 2);
		const pivotValue = c.a[hi];
		const pt = c.tagPatch([[hi, 'pivot']]);
		const pc = c.cursorPatch([['pivot', hi]]);
		c.emit({
			kind: 'set-pivot',
			line: 2,
			explain: `Pivot is ${pivotValue} (${rule} rule). Everything smaller goes left, everything larger goes right.`,
			patch: [...pt.patch, ...pc.patch],
			inverse: [...pc.inverse, ...pt.inverse]
		});

		let store = lo;
		for (let j = lo; j < hi; j++) {
			c.compare(j, hi, 4, `Comparing ${c.a[j]} with the pivot ${pivotValue}.`);
			if (c.a[j] < pivotValue) {
				if (store !== j) c.swap(store, j, 5);
				store++;
			}
			c.clearTags([j, store - 1 >= lo ? store - 1 : lo], 4, 'Advancing the partition scan.');
			if (c.rec.full) return;
		}
		if (store !== hi) c.swap(store, hi, 7);
		c.markSorted(store, 8, `The pivot ${pivotValue} is now at position ${store}, its final place.`);

		sort(lo, store - 1, depth + 1);
		sort(store + 1, hi, depth + 1);

		const qp = c.rangePatch(null, null);
		c.emit({
			kind: 'recurse-pop',
			line: 10,
			explain: `Finished quickSort on positions ${lo} to ${hi}.`,
			patch: [{ t: 'stack', op: 'pop' }, ...qp.patch],
			inverse: [...qp.inverse, { t: 'stack', op: 'push', frame: { label: 'quickSort', lo, hi, depth } }],
			counters: { depth: -1 }
		});
	};

	sort(0, c.a.length - 1, 0);
	for (let k = 0; k < c.a.length; k++) c.markSorted(k, 10);
	c.finish(11);
	return build(c, input, 'quick');
}

// ------------------------------------------------------------------ heap sort

export function heapSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;

	const siftDown = (root: number, end: number): void => {
		while (true) {
			const left = 2 * root + 1;
			if (left > end || c.rec.full) return;
			let swapIdx = root;
			c.compare(swapIdx, left, 5, `Comparing parent ${c.a[swapIdx]} with left child ${c.a[left]}.`);
			if (c.a[swapIdx] < c.a[left]) swapIdx = left;
			const right = left + 1;
			if (right <= end) {
				c.compare(swapIdx, right, 6, `Comparing ${c.a[swapIdx]} with right child ${c.a[right]}.`);
				if (c.a[swapIdx] < c.a[right]) swapIdx = right;
			}
			c.clearTags([root, left, right], 6, 'Choosing the larger child to restore the heap property.');
			if (swapIdx === root) return;
			c.swap(root, swapIdx, 7);
			c.clearTags([root, swapIdx], 7, 'Continuing to sift the value down the heap.');
			root = swapIdx;
		}
	};

	for (let i = (n >> 1) - 1; i >= 0; i--) {
		c.emit({
			kind: 'read',
			line: 2,
			explain: `Heapifying the subtree rooted at position ${i} to build a max-heap.`,
			...c.cursorPatch([['root', i]])
		});
		siftDown(i, n - 1);
	}
	for (let end = n - 1; end > 0; end--) {
		c.swap(0, end, 3);
		c.markSorted(end, 3, `The largest remaining value ${c.a[end]} moves to position ${end}, its final place.`);
		siftDown(0, end - 1);
		if (c.rec.full) break;
	}
	if (n > 0) c.markSorted(0, 4);
	c.finish(8);
	return build(c, input, 'heap');
}

// ----------------------------------------------------------------- shell sort

export function shellSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;
	// Classic Shell halving sequence (n/2, n/4, ... 1), as in Shell's original 1959 paper.
	for (let gap = n >> 1; gap > 0; gap = gap >> 1) {
		c.emit({
			kind: 'set-range',
			line: 2,
			explain: `Starting a pass with gap ${gap}: elements ${gap} apart are sorted among themselves.`,
			...c.cursorPatch([['gap', gap]])
		});
		for (let i = gap; i < n; i++) {
			const key = c.a[i];
			let j = i;
			while (j >= gap) {
				c.compare(j - gap, i, 5, `Comparing ${c.a[j - gap]} with ${key}, which are ${gap} apart.`);
				if (c.a[j - gap] <= key) {
					c.clearTags([j - gap], 5, `${c.a[j - gap]} is not greater than ${key}, so the gap insertion stops here.`);
					break;
				}
				c.write(j, c.a[j - gap], 6, `${c.a[j - gap]} is greater, so it moves ${gap} places right.`);
				c.clearTags([j - gap], 6, 'Looking one gap further left.');
				j -= gap;
				if (c.rec.full) break;
			}
			if (j !== i) c.write(j, key, 7, `Placing ${key} at position ${j}.`);
			if (c.rec.full) break;
		}
	}
	for (let k = 0; k < n; k++) c.markSorted(k, 8);
	c.finish(9);
	return build(c, input, 'shell');
}

// --------------------------------------------------------------- counting sort

export function countingSort(input: number[], opts: SortOptions = {}): Trace {
	const c = new SortCtx(input, opts.budget);
	const n = c.a.length;
	if (n === 0) {
		c.finish(8);
		return build(c, input, 'counting');
	}
	const min = Math.min(...c.a);
	const max = Math.max(...c.a);
	const counts = new Array<number>(max - min + 1).fill(0);
	for (let i = 0; i < n; i++) {
		counts[c.a[i] - min]++;
		c.emit({
			kind: 'read',
			line: 3,
			explain: `Counting value ${c.a[i]}; it has now been seen ${counts[c.a[i] - min]} time(s).`,
			...c.cursorPatch([['i', i]]),
			counters: { accesses: 1 }
		});
	}
	let out = 0;
	for (let v = 0; v < counts.length; v++) {
		for (let k = 0; k < counts[v]; k++) {
			c.write(out, v + min, 6, `Writing ${v + min} back into position ${out} from the count table.`);
			c.markSorted(out, 6);
			out++;
			if (c.rec.full) break;
		}
	}
	c.finish(8);
	return build(c, input, 'counting');
}

export const SORTERS: Record<SortName, (input: number[], opts?: SortOptions) => Trace> = {
	bubble: bubbleSort,
	selection: selectionSort,
	insertion: insertionSort,
	merge: mergeSort,
	quick: quickSort,
	heap: heapSort,
	shell: shellSort,
	counting: countingSort
};
