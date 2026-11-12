import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	adjacency,
	graphDijkstra,
	graphTraversal,
	hasNegativeWeight,
	kruskal,
	prim,
	topologicalSort,
	type Graph
} from '../src/lib/algorithms/graph.js';
import { graphBellmanFord, referenceMstWeight, referenceMstWeightFrom } from '../src/lib/core/reference.js';
import { verifyGraph } from '../src/lib/core/verify.js';
import { PlaybackEngine } from '../src/lib/core/engine.js';
import { replayTo, snapshot } from '../src/lib/core/state.js';
import { mulberry32, randomInt } from '../src/lib/core/rng.js';
import { sampleDag, sampleGraph } from '../src/lib/data/samples.js';

function randomGraph(seed: number, n = 7, directed = false, allowDisconnected = true): Graph {
	const rand = mulberry32(seed);
	const nodes = Array.from({ length: n }, (_, i) => ({
		id: `n${i + 1}`,
		label: String.fromCharCode(65 + i),
		x: 60 + (i % 4) * 140,
		y: 60 + Math.floor(i / 4) * 140
	}));
	const edges: Graph['edges'] = [];
	for (let i = 0; i < n; i++) {
		for (let j = directed ? 0 : i + 1; j < n; j++) {
			if (i === j) continue;
			if (rand() < (allowDisconnected ? 0.35 : 0.55)) {
				edges.push({ id: `n${i + 1}->n${j + 1}`, from: `n${i + 1}`, to: `n${j + 1}`, weight: randomInt(rand, 1, 20) });
			}
		}
	}
	return { nodes, edges, directed };
}

describe('graph traversal', () => {
	it('BFS and DFS visit every reachable node exactly once', () => {
		for (let seed = 1; seed <= 25; seed++) {
			const graph = randomGraph(seed);
			const adj = adjacency(graph);
			const reachable = new Set<string>(['n1']);
			const stack = ['n1'];
			while (stack.length) {
				const cur = stack.pop()!;
				for (const nb of adj.get(cur) ?? []) if (!reachable.has(nb.to)) { reachable.add(nb.to); stack.push(nb.to); }
			}
			for (const kind of ['bfs', 'dfs'] as const) {
				const order = graphTraversal(kind, graph, { start: 'n1' }).result.order ?? [];
				expect(new Set(order).size, `${kind} seed ${seed}`).toBe(order.length);
				expect(order.length).toBe(reachable.size);
				expect(order.every((id) => reachable.has(id))).toBe(true);
			}
		}
	});

	it('BFS visits nodes in non-decreasing hop distance', () => {
		const graph = sampleGraph();
		const order = graphTraversal('bfs', graph, { start: 'n1' }).result.order ?? [];
		const adj = adjacency(graph);
		const hops = new Map<string, number>([['n1', 0]]);
		const queue = ['n1'];
		let head = 0;
		while (head < queue.length) {
			const cur = queue[head++];
			for (const nb of adj.get(cur) ?? []) if (!hops.has(nb.to)) { hops.set(nb.to, hops.get(cur)! + 1); queue.push(nb.to); }
		}
		const seq = order.map((id) => hops.get(id)!);
		expect(seq.every((v, i) => i === 0 || v >= seq[i - 1])).toBe(true);
	});

	it('traversal of an empty graph is safe', () => {
		const empty: Graph = { nodes: [], edges: [], directed: false };
		expect(graphTraversal('bfs', empty).result.order).toEqual([]);
		expect(graphTraversal('dfs', empty).result.order).toEqual([]);
	});
});

describe('graph Dijkstra', () => {
	it('matches a Bellman-Ford reference on random graphs, including disconnected ones', () => {
		for (let seed = 1; seed <= 30; seed++) {
			const graph = randomGraph(seed);
			const got = graphDijkstra(graph, { start: 'n1' }).result.dist ?? {};
			const want = graphBellmanFord(graph, 'n1');
			for (const node of graph.nodes) {
				const a = Number.isFinite(got[node.id]) ? got[node.id] : Infinity;
				expect(a, `seed ${seed} node ${node.id}`).toBe(want[node.id]);
			}
		}
	});

	it('matches Bellman-Ford on DIRECTED graphs too', () => {
		for (let seed = 50; seed <= 70; seed++) {
			const graph = randomGraph(seed, 6, true);
			const got = graphDijkstra(graph, { start: 'n1' }).result.dist ?? {};
			const want = graphBellmanFord(graph, 'n1');
			for (const node of graph.nodes) {
				const a = Number.isFinite(got[node.id]) ? got[node.id] : Infinity;
				expect(a, `seed ${seed} node ${node.id}`).toBe(want[node.id]);
			}
		}
	});

	it('property: every reported distance matches the reference', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 9999 }), fc.boolean(), (seed, directed) => {
				const graph = randomGraph(seed, 6, directed);
				const got = graphDijkstra(graph, { start: 'n1' }).result.dist ?? {};
				const want = graphBellmanFord(graph, 'n1');
				return graph.nodes.every((n) => (Number.isFinite(got[n.id]) ? got[n.id] : Infinity) === want[n.id]);
			}),
			{ numRuns: 80 }
		);
	});

	it('REJECTS negative weights instead of returning a wrong answer', () => {
		const graph: Graph = {
			directed: false,
			nodes: [
				{ id: 'n1', label: 'A', x: 0, y: 0 },
				{ id: 'n2', label: 'B', x: 100, y: 0 }
			],
			edges: [{ id: 'n1->n2', from: 'n1', to: 'n2', weight: -5 }]
		};
		expect(hasNegativeWeight(graph)).toBe(true);
		expect(() => graphDijkstra(graph, { start: 'n1' })).toThrow(/negative/i);
	});

	it('an unreachable target is reported, not silently zero', () => {
		const graph: Graph = {
			directed: false,
			nodes: [
				{ id: 'n1', label: 'A', x: 0, y: 0 },
				{ id: 'n2', label: 'B', x: 100, y: 0 }
			],
			edges: []
		};
		const trace = graphDijkstra(graph, { start: 'n1', end: 'n2' });
		expect(trace.steps.at(-1)?.explain).toContain('cannot be reached');
		expect(verifyGraph(graph, 'dijkstra', 'n1', trace).ok).toBe(true);
	});

	it('the highlighted path really sums to the reported distance', () => {
		const graph = sampleGraph();
		const trace = graphDijkstra(graph, { start: 'n1', end: 'n6' });
		const path = trace.result.path ?? [];
		expect(path[0]).toBe('n1');
		expect(path.at(-1)).toBe('n6');
		let total = 0;
		for (let i = 1; i < path.length; i++) {
			const edge = graph.edges.find(
				(e) => (e.from === path[i - 1] && e.to === path[i]) || (!graph.directed && e.to === path[i - 1] && e.from === path[i])
			);
			expect(edge, `edge ${path[i - 1]}-${path[i]}`).toBeDefined();
			total += edge!.weight;
		}
		expect(total).toBe(trace.result.dist!['n6']);
	});
});

describe('minimum spanning tree', () => {
	it('Kruskal total weight matches an independent reference, including disconnected graphs', () => {
		for (let seed = 1; seed <= 30; seed++) {
			const graph = randomGraph(seed);
			const got = kruskal(graph).result.mstWeight;
			expect(got, `seed ${seed}`).toBe(referenceMstWeight(graph).weight);
		}
	});

	it('Prim total weight matches the reference for the component it starts in', () => {
		for (let seed = 1; seed <= 30; seed++) {
			const graph = randomGraph(seed);
			const got = prim(graph, { start: 'n1' }).result.mstWeight;
			expect(got, `seed ${seed}`).toBe(referenceMstWeightFrom(graph, 'n1'));
		}
	});

	it('Prim and Kruskal agree whenever the graph is connected', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const graph = randomGraph(seed, 7, false, false);
			if (referenceMstWeight(graph).components !== 1) continue;
			expect(prim(graph, { start: 'n1' }).result.mstWeight, `seed ${seed}`).toBe(kruskal(graph).result.mstWeight);
		}
	});

	it('an MST on n connected nodes uses exactly n-1 edges', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const graph = randomGraph(seed, 6, false, false);
			if (referenceMstWeight(graph).components !== 1) continue;
			expect(kruskal(graph).result.mstEdges!.length).toBe(graph.nodes.length - 1);
			expect(prim(graph, { start: 'n1' }).result.mstEdges!.length).toBe(graph.nodes.length - 1);
		}
	});

	it('Kruskal records the union-find sets merging down to one', () => {
		const graph = sampleGraph();
		const engine = new PlaybackEngine(kruskal(graph));
		// Step 0 already shows every node in its own set, which is Kruskal's starting state.
		expect(engine.visualState.sets.length).toBe(graph.nodes.length);
		engine.seek(1);
		expect(engine.visualState.sets.length).toBe(graph.nodes.length);
		engine.toEnd();
		expect(engine.visualState.sets.length).toBe(1);
		expect(engine.visualState.sets[0].length).toBe(graph.nodes.length);
	});

	it('verification passes for Prim and Kruskal', () => {
		for (const graph of [sampleGraph(), randomGraph(12), randomGraph(33)]) {
			expect(verifyGraph(graph, 'kruskal', 'n1', kruskal(graph)).ok).toBe(true);
			expect(verifyGraph(graph, 'prim', 'n1', prim(graph, { start: 'n1' })).ok).toBe(true);
		}
	});
});

describe('topological sort', () => {
	it('produces a valid order on a DAG', () => {
		const graph = sampleDag();
		const trace = topologicalSort(graph);
		const order = trace.result.order ?? [];
		expect(order.length).toBe(graph.nodes.length);
		const pos = new Map(order.map((id, i) => [id, i]));
		for (const e of graph.edges) expect(pos.get(e.from)!).toBeLessThan(pos.get(e.to)!);
		expect(verifyGraph(graph, 'topological', 'n1', trace).ok).toBe(true);
	});

	it('reports a cycle instead of inventing an order', () => {
		const graph: Graph = {
			directed: true,
			nodes: [
				{ id: 'n1', label: 'A', x: 0, y: 0 },
				{ id: 'n2', label: 'B', x: 100, y: 0 },
				{ id: 'n3', label: 'C', x: 200, y: 0 }
			],
			edges: [
				{ id: 'n1->n2', from: 'n1', to: 'n2', weight: 1 },
				{ id: 'n2->n3', from: 'n2', to: 'n3', weight: 1 },
				{ id: 'n3->n1', from: 'n3', to: 'n1', weight: 1 }
			]
		};
		const trace = topologicalSort(graph);
		expect(trace.result.order).toEqual([]);
		expect(trace.steps.at(-1)?.explain).toContain('cycle');
	});
});

describe('graph playback reversibility', () => {
	it('every graph algorithm steps back exactly', () => {
		const graph = sampleGraph();
		const traces = [
			graphTraversal('bfs', graph, { start: 'n1' }),
			graphTraversal('dfs', graph, { start: 'n1' }),
			graphDijkstra(graph, { start: 'n1', end: 'n6' }),
			prim(graph, { start: 'n1' }),
			kruskal(graph),
			topologicalSort(sampleDag())
		];
		for (const trace of traces) {
			const engine = new PlaybackEngine(trace);
			for (let k = 0; k <= trace.steps.length; k++) {
				engine.seek(k);
				expect(snapshot(engine.visualState), `${trace.algorithm} at ${k}`).toBe(snapshot(replayTo(trace, k)));
			}
		}
	});
});
