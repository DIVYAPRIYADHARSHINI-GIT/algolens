import { describe, expect, it } from 'vitest';
import { CATALOG, entryFor } from '../src/lib/data/catalog.js';
import { SORTERS, type SortName } from '../src/lib/algorithms/sorting.js';
import { SEARCHERS } from '../src/lib/algorithms/searching.js';
import { PATHFINDERS } from '../src/lib/algorithms/pathfinding.js';
import { runGraphAlgorithm, type GraphName } from '../src/lib/algorithms/graph.js';
import { makeGrid, randomWalls } from '../src/lib/algorithms/grid.js';
import { sampleDag, sampleGraph } from '../src/lib/data/samples.js';
import { generateInput, parseCustomInput, estimateSteps, MAX_SIZE } from '../src/lib/data/presets.js';
import { isAscending } from '../src/lib/core/reference.js';

describe('catalogue completeness', () => {
	it('every algorithm the app can run has a catalogue entry', () => {
		for (const name of Object.keys(SORTERS)) expect(entryFor('sorting', name), name).toBeDefined();
		for (const name of Object.keys(SEARCHERS)) expect(entryFor('searching', name), name).toBeDefined();
		for (const name of Object.keys(PATHFINDERS)) expect(entryFor('pathfinding', name), name).toBeDefined();
		for (const name of ['bfs', 'dfs', 'dijkstra', 'prim', 'kruskal', 'topological']) {
			expect(entryFor('graph', name), name).toBeDefined();
		}
	});

	it('every entry has pseudocode, complexity, both code tabs and full Learn text', () => {
		for (const [id, entry] of Object.entries(CATALOG)) {
			expect(entry.pseudocode.length, id).toBeGreaterThan(2);
			expect(entry.name.length, id).toBeGreaterThan(2);
			expect(entry.tagline.length, id).toBeGreaterThan(10);
			for (const field of ['best', 'average', 'worst', 'space'] as const) {
				expect(entry.complexity[field], `${id}.${field}`).toBeTruthy();
			}
			expect(entry.complexity.notes.length, `${id}.notes`).toBeGreaterThan(20);
			expect(entry.js, `${id}.js`).toContain('function');
			expect(entry.py, `${id}.py`).toContain('def ');
			expect(entry.learn.how.length, `${id}.how`).toBeGreaterThan(200);
			expect(entry.learn.worked.length, `${id}.worked`).toBeGreaterThan(100);
			expect(entry.learn.when.length, `${id}.when`).toBeGreaterThan(50);
			expect(entry.learn.strengths.length, `${id}.strengths`).toBeGreaterThanOrEqual(2);
			expect(entry.learn.weaknesses.length, `${id}.weaknesses`).toBeGreaterThanOrEqual(2);
			expect(entry.learn.mistakes.length, `${id}.mistakes`).toBeGreaterThanOrEqual(2);
		}
	});

	it('no entry contains placeholder or test text', () => {
		const banned = /lorem ipsum|TODO|FIXME|placeholder|coming soon|XXX/i;
		for (const [id, entry] of Object.entries(CATALOG)) {
			const blob = JSON.stringify(entry);
			expect(banned.test(blob), `${id} contains placeholder text`).toBe(false);
		}
	});

	it('complexity values use a recognised notation', () => {
		const allowed = /^(O\(|depends on|[A-Z])/;
		for (const [id, entry] of Object.entries(CATALOG)) {
			for (const field of ['best', 'average', 'worst', 'space'] as const) {
				expect(allowed.test(entry.complexity[field]), `${id}.${field} = ${entry.complexity[field]}`).toBe(true);
			}
		}
	});

	it('known complexity facts are recorded correctly', () => {
		// These are the values the brief calls out as serious defects if wrong.
		expect(CATALOG.bubble.complexity.best).toBe('O(n)');
		expect(CATALOG.bubble.complexity.worst).toBe('O(n^2)');
		expect(CATALOG.bubble.complexity.stable).toBe(true);
		expect(CATALOG.selection.complexity.best).toBe('O(n^2)'); // no early exit is possible
		expect(CATALOG.selection.complexity.stable).toBe(false);
		expect(CATALOG.insertion.complexity.best).toBe('O(n)');
		expect(CATALOG.insertion.complexity.stable).toBe(true);
		expect(CATALOG.merge.complexity.worst).toBe('O(n log n)');
		expect(CATALOG.merge.complexity.space).toBe('O(n)');
		expect(CATALOG.merge.complexity.stable).toBe(true);
		expect(CATALOG.merge.complexity.inPlace).toBe(false);
		expect(CATALOG.quick.complexity.worst).toBe('O(n^2)');
		expect(CATALOG.quick.complexity.stable).toBe(false);
		expect(CATALOG.quick.complexity.inPlace).toBe(true);
		expect(CATALOG.heap.complexity.worst).toBe('O(n log n)');
		expect(CATALOG.heap.complexity.space).toBe('O(1)');
		expect(CATALOG.heap.complexity.stable).toBe(false);
		expect(CATALOG.counting.complexity.stable).toBe(true);
		expect(CATALOG.counting.complexity.inPlace).toBe(false);
		expect(CATALOG.binary.complexity.worst).toBe('O(log n)');
		expect(CATALOG.linear.complexity.worst).toBe('O(n)');
		expect(CATALOG.interpolation.complexity.worst).toBe('O(n)');
		expect(CATALOG['path-bfs'].complexity.worst).toBe('O(V + E)');
		expect(CATALOG['graph-kruskal'].complexity.worst).toBe('O(E log E)');
		expect(CATALOG['graph-topological'].complexity.worst).toBe('O(V + E)');
	});

	it('entries that cannot guarantee a shortest path say so in their notes', () => {
		expect(CATALOG['path-dfs'].complexity.notes).toMatch(/NO shortest-path guarantee/i);
		expect(CATALOG['path-greedy'].complexity.notes).toMatch(/NO shortest-path guarantee/i);
		expect(CATALOG['path-bfs'].complexity.notes).toMatch(/moves/i);
		expect(CATALOG['path-astar'].complexity.notes).toMatch(/admissible/i);
		expect(CATALOG['path-dijkstra'].complexity.notes).toMatch(/non-negative/i);
	});
});

describe('pseudocode line numbers match the recorded steps', () => {
	const checkLines = (steps: { line: number }[], lineCount: number, label: string) => {
		for (const step of steps) {
			expect(step.line, `${label} line ${step.line} of ${lineCount}`).toBeGreaterThanOrEqual(1);
			expect(step.line, `${label} line ${step.line} of ${lineCount}`).toBeLessThanOrEqual(lineCount);
		}
	};

	it('sorting', () => {
		for (const name of Object.keys(SORTERS) as SortName[]) {
			const entry = entryFor('sorting', name)!;
			checkLines(SORTERS[name]([5, 2, 8, 1, 9, 3, 7]).steps, entry.pseudocode.length, name);
		}
	});

	it('searching', () => {
		const arr = [1, 2, 3, 4, 5, 6, 7];
		for (const name of Object.keys(SEARCHERS) as ('linear' | 'binary' | 'interpolation')[]) {
			const entry = entryFor('searching', name)!;
			checkLines(SEARCHERS[name](arr, 5).steps, entry.pseudocode.length, name);
			checkLines(SEARCHERS[name](arr, 99).steps, entry.pseudocode.length, `${name} miss`);
		}
	});

	it('pathfinding', () => {
		const grid = randomWalls(makeGrid(12, 9), 4);
		for (const name of Object.keys(PATHFINDERS) as (keyof typeof PATHFINDERS)[]) {
			const entry = entryFor('pathfinding', name)!;
			checkLines(PATHFINDERS[name](grid).steps, entry.pseudocode.length, name);
		}
	});

	it('graphs', () => {
		for (const name of ['bfs', 'dfs', 'dijkstra', 'prim', 'kruskal'] as GraphName[]) {
			const entry = entryFor('graph', name)!;
			checkLines(runGraphAlgorithm(name, sampleGraph(), { start: 'n1', end: 'n6' }).steps, entry.pseudocode.length, name);
		}
		const topo = entryFor('graph', 'topological')!;
		checkLines(runGraphAlgorithm('topological', sampleDag()).steps, topo.pseudocode.length, 'topological');
	});

	it('every step has a non-empty plain-language explanation', () => {
		const traces = [
			SORTERS.quick([4, 1, 9, 2], { pivot: 'median3' }),
			SEARCHERS.binary([1, 2, 3, 4, 5], 2),
			PATHFINDERS.astar(randomWalls(makeGrid(10, 8), 2)),
			runGraphAlgorithm('kruskal', sampleGraph())
		];
		for (const trace of traces) {
			for (const step of trace.steps) {
				expect(step.explain.length, `${trace.algorithm}/${step.kind}`).toBeGreaterThan(5);
				expect(step.explain.trim()).toBe(step.explain);
			}
		}
	});
});

describe('catalogue reference implementations are themselves correct', () => {
	// The Code tab promises a CORRECT implementation, so the shipped JavaScript is executed
	// here and checked against the same property the recorders are checked against.
	const inputs = [[], [1], [3, 1, 2], [5, 5, 5], [-4, 2, -9, 0, 7], [9, 8, 7, 6, 5, 4, 3, 2, 1]];

	it('the JavaScript on the Code tab sorts correctly for every sorting algorithm', () => {
		for (const name of Object.keys(SORTERS)) {
			const entry = entryFor('sorting', name)!;
			const fn = new Function(`${entry.js}; return ${jsName(name)};`)() as (a: number[]) => number[];
			for (const input of inputs) {
				const out = fn([...input]);
				expect(isAscending(out), `${name} on ${JSON.stringify(input)} -> ${JSON.stringify(out)}`).toBe(true);
				expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
			}
		}
	});

	it('the JavaScript on the Code tab searches correctly', () => {
		const arr = [1, 3, 5, 7, 9, 11, 13];
		for (const name of ['linear', 'binary', 'interpolation']) {
			const entry = entryFor('searching', name)!;
			const fn = new Function(`${entry.js}; return ${jsName(name)};`)() as (a: number[], t: number) => number;
			for (const target of arr) expect(arr[fn(arr, target)], `${name} ${target}`).toBe(target);
			for (const target of [0, 2, 100]) expect(fn(arr, target), `${name} ${target}`).toBe(-1);
		}
	});
});

function jsName(id: string): string {
	const map: Record<string, string> = {
		bubble: 'bubbleSort',
		selection: 'selectionSort',
		insertion: 'insertionSort',
		merge: 'mergeSort',
		quick: 'quickSort',
		heap: 'heapSort',
		shell: 'shellSort',
		counting: 'countingSort',
		linear: 'linearSearch',
		binary: 'binarySearch',
		interpolation: 'interpolationSearch'
	};
	return map[id];
}

describe('input presets and parsing', () => {
	it('every preset produces the requested size and is reproducible with the same seed', () => {
		for (const preset of ['random', 'nearly-sorted', 'reversed', 'few-unique', 'sorted'] as const) {
			for (const size of [5, 17, 100]) {
				const a = generateInput(preset, size, 1234);
				const b = generateInput(preset, size, 1234);
				const c = generateInput(preset, size, 9999);
				expect(a.length, `${preset} ${size}`).toBe(size);
				expect(a).toEqual(b);
				if (preset === 'random') expect(a).not.toEqual(c);
			}
		}
	});

	it('the sorted preset really is sorted and the reversed preset really is reversed', () => {
		expect(isAscending(generateInput('sorted', 20, 1))).toBe(true);
		expect(isAscending([...generateInput('reversed', 20, 1)].reverse())).toBe(true);
	});

	it('the few-unique preset has at most four distinct values', () => {
		expect(new Set(generateInput('few-unique', 60, 7)).size).toBeLessThanOrEqual(4);
	});

	it('size is clamped to the supported 5 to 100 range', () => {
		expect(generateInput('random', 1, 1).length).toBe(5);
		expect(generateInput('random', 500, 1).length).toBe(MAX_SIZE);
	});

	it('custom input accepts duplicates, negatives and mixed separators', () => {
		expect(parseCustomInput('5, 3, 5, -2 9').values).toEqual([5, 3, 5, -2, 9]);
		expect(parseCustomInput('  7  ').values).toEqual([7]);
		expect(parseCustomInput('1,2,3').error).toBeNull();
	});

	it('custom input rejects bad values with a clear message', () => {
		expect(parseCustomInput('').error).toMatch(/at least one number/i);
		expect(parseCustomInput('a,b').error).toMatch(/not a number/i);
		expect(parseCustomInput('1.5').error).toMatch(/whole numbers/i);
		expect(parseCustomInput('99999').error).toMatch(/between/i);
		expect(parseCustomInput(Array.from({ length: 101 }, () => '1').join(',')).error).toMatch(/at most/i);
	});

	it('the step estimate grows quadratically for quadratic sorts', () => {
		expect(estimateSteps('bubble', 100)).toBeGreaterThan(estimateSteps('bubble', 50) * 3);
		expect(estimateSteps('merge', 100)).toBeLessThan(estimateSteps('bubble', 100));
	});
});
