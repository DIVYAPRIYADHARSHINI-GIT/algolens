// Node-link graph model and graph algorithms as pure step recorders.

import { Recorder, type EdgeTag, type NodeTag, type Patch, type QueueEntry, type Step, type Trace } from '../core/types.js';
import { MinHeap } from '../core/heap.js';

export interface GraphNode {
	id: string;
	label: string;
	x: number;
	y: number;
}

export interface GraphEdge {
	id: string;
	from: string;
	to: string;
	weight: number;
}

export interface Graph {
	nodes: GraphNode[];
	edges: GraphEdge[];
	directed: boolean;
}

export type GraphName = 'bfs' | 'dfs' | 'dijkstra' | 'prim' | 'kruskal' | 'topological';

export interface GraphOptions {
	start?: string;
	end?: string;
	budget?: number;
}

export function emptyGraph(directed = false): Graph {
	return { nodes: [], edges: [], directed };
}

export function edgeId(from: string, to: string): string {
	return `${from}->${to}`;
}

/** Adjacency with a deterministic order: by neighbour id, then edge id. */
export function adjacency(graph: Graph): Map<string, { to: string; weight: number; edge: string }[]> {
	const map = new Map<string, { to: string; weight: number; edge: string }[]>();
	for (const n of graph.nodes) map.set(n.id, []);
	for (const e of graph.edges) {
		map.get(e.from)?.push({ to: e.to, weight: e.weight, edge: e.id });
		if (!graph.directed) map.get(e.to)?.push({ to: e.from, weight: e.weight, edge: e.id });
	}
	for (const [, list] of map) list.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : a.edge < b.edge ? -1 : 1));
	return map;
}

export function hasNegativeWeight(graph: Graph): boolean {
	return graph.edges.some((e) => e.weight < 0);
}

class GraphCtx {
	readonly rec: Recorder;
	readonly nodeTags = new Map<string, NodeTag>();
	readonly edgeTags = new Map<string, EdgeTag>();

	constructor(readonly graph: Graph, budget?: number) {
		this.rec = new Recorder(budget);
		for (const n of graph.nodes) this.nodeTags.set(n.id, 'none');
		for (const e of graph.edges) this.edgeTags.set(e.id, 'none');
	}

	setNode(id: string, v: NodeTag): { patch: Patch[]; inverse: Patch[] } {
		const prev = this.nodeTags.get(id) ?? 'none';
		this.nodeTags.set(id, v);
		return { patch: [{ t: 'node', id, v }], inverse: [{ t: 'node', id, v: prev }] };
	}

	setEdge(id: string, v: EdgeTag): { patch: Patch[]; inverse: Patch[] } {
		const prev = this.edgeTags.get(id) ?? 'none';
		this.edgeTags.set(id, v);
		return { patch: [{ t: 'edge', id, v }], inverse: [{ t: 'edge', id, v: prev }] };
	}

	emit(step: Step): void {
		this.rec.push(step);
	}
}

function labelOf(graph: Graph, id: string): string {
	return graph.nodes.find((n) => n.id === id)?.label ?? id;
}

function baseInitial(graph: Graph) {
	const nodes: Record<string, NodeTag> = {};
	for (const n of graph.nodes) nodes[n.id] = 'none';
	const edges: Record<string, EdgeTag> = {};
	for (const e of graph.edges) edges[e.id] = 'none';
	return {
		nodes,
		edges,
		queue: [] as QueueEntry[],
		dist: {} as Record<string, number>,
		prev: {} as Record<string, string | null>,
		sets: [] as string[][]
	};
}

// ----------------------------------------------------------- BFS / DFS traversal

export function graphTraversal(kind: 'bfs' | 'dfs', graph: Graph, opts: GraphOptions = {}): Trace {
	const ctx = new GraphCtx(graph, opts.budget);
	const adj = adjacency(graph);
	const start = opts.start ?? graph.nodes[0]?.id;
	const order: string[] = [];
	if (!start) {
		return {
			algorithm: kind,
			family: 'graph',
			initial: baseInitial(graph),
			steps: [],
			result: { kind: 'traversal', order: [] }
		};
	}
	const seen = new Set<string>([start]);
	let frontier: string[] = [start];
	let queueView: QueueEntry[] = [{ id: start }];
	ctx.emit({
		kind: kind === 'bfs' ? 'enqueue' : 'push',
		line: 1,
		explain: `Starting the traversal at node ${labelOf(graph, start)}.`,
		patch: [{ t: 'queue', v: queueView }, ...ctx.setNode(start, 'frontier').patch],
		inverse: [{ t: 'node', id: start, v: 'none' }, { t: 'queue', v: [] }]
	});

	while (frontier.length && !ctx.rec.full) {
		const current = kind === 'bfs' ? frontier.shift()! : frontier.pop()!;
		const before = queueView;
		queueView = frontier.map((f) => ({ id: f }));
		const ct = ctx.setNode(current, 'current');
		ctx.emit({
			kind: kind === 'bfs' ? 'dequeue' : 'pop',
			line: 3,
			explain:
				kind === 'bfs'
					? `Removing ${labelOf(graph, current)} from the front of the queue and visiting it.`
					: `Popping ${labelOf(graph, current)} off the top of the stack and visiting it.`,
			patch: [{ t: 'queue', v: queueView }, ...ct.patch],
			inverse: [...ct.inverse, { t: 'queue', v: before }],
			counters: { visited: 1 }
		});
		order.push(current);

		for (const nb of adj.get(current) ?? []) {
			if (seen.has(nb.to)) {
				ctx.emit({
					kind: 'no-relax',
					line: 5,
					explain: `${labelOf(graph, nb.to)} has already been seen, so it is skipped.`,
					patch: [],
					inverse: [],
					counters: { accesses: 1 }
				});
				continue;
			}
			seen.add(nb.to);
			frontier.push(nb.to);
			const beforeQ = queueView;
			queueView = frontier.map((f) => ({ id: f }));
			const nt = ctx.setNode(nb.to, 'frontier');
			const et = ctx.setEdge(nb.edge, 'tree');
			ctx.emit({
				kind: kind === 'bfs' ? 'enqueue' : 'push',
				line: 6,
				explain: `${labelOf(graph, nb.to)} is new, so it is added to the ${kind === 'bfs' ? 'queue' : 'stack'}.`,
				patch: [{ t: 'queue', v: queueView }, ...nt.patch, ...et.patch],
				inverse: [...et.inverse, ...nt.inverse, { t: 'queue', v: beforeQ }],
				counters: { accesses: 1 }
			});
			if (ctx.rec.full) break;
		}

		const vt = ctx.setNode(current, 'visited');
		ctx.emit({
			kind: 'visit',
			line: 7,
			explain: `${labelOf(graph, current)} is fully explored.`,
			patch: vt.patch,
			inverse: vt.inverse
		});
	}

	ctx.emit({
		kind: 'done',
		line: 8,
		explain: `Traversal order: ${order.map((id) => labelOf(graph, id)).join(', ')}.`,
		patch: [],
		inverse: []
	});

	return {
		algorithm: kind,
		family: 'graph',
		initial: baseInitial(graph),
		steps: ctx.rec.steps,
		result: { kind: 'traversal', order },
		truncated: ctx.rec.truncated
	};
}

// --------------------------------------------------------------------- Dijkstra

export function graphDijkstra(graph: Graph, opts: GraphOptions = {}): Trace {
	const ctx = new GraphCtx(graph, opts.budget);
	const adj = adjacency(graph);
	const start = opts.start ?? graph.nodes[0]?.id;
	const dist: Record<string, number> = {};
	const prev: Record<string, string | null> = {};
	for (const n of graph.nodes) {
		dist[n.id] = Infinity;
		prev[n.id] = null;
	}
	const initial = baseInitial(graph);
	initial.dist = { ...dist };
	initial.prev = { ...prev };

	if (!start) {
		return { algorithm: 'dijkstra', family: 'graph', initial, steps: [], result: { kind: 'distances', dist: {} } };
	}
	if (hasNegativeWeight(graph)) {
		// Guarded in the UI too; this keeps the module honest if called directly.
		throw new Error('Dijkstra cannot run on a graph with negative edge weights.');
	}

	dist[start] = 0;
	const heap = new MinHeap<string>();
	heap.push(0, start);
	const closed = new Set<string>();
	let queueView: QueueEntry[] = [{ id: start, key: 0 }];

	ctx.emit({
		kind: 'enqueue',
		line: 1,
		explain: `Distance to ${labelOf(graph, start)} is 0; every other node starts at infinity.`,
		patch: [{ t: 'queue', v: queueView }, { t: 'dist', id: start, v: 0 }],
		inverse: [{ t: 'dist', id: start, v: Infinity }, { t: 'queue', v: [] }]
	});

	while (heap.size && !ctx.rec.full) {
		const top = heap.pop()!;
		const current = top.value;
		if (closed.has(current)) continue;
		closed.add(current);
		const before = queueView;
		queueView = heap.toSortedArray().map((e) => ({ id: e.value, key: e.key }));
		const ct = ctx.setNode(current, 'current');
		ctx.emit({
			kind: 'dequeue',
			line: 3,
			explain: `${labelOf(graph, current)} has the smallest tentative distance (${dist[current]}), so it is now final.`,
			patch: [{ t: 'queue', v: queueView }, ...ct.patch],
			inverse: [...ct.inverse, { t: 'queue', v: before }],
			counters: { visited: 1 }
		});

		for (const nb of adj.get(current) ?? []) {
			if (closed.has(nb.to)) continue;
			const candidate = dist[current] + nb.weight;
			const et = ctx.setEdge(nb.edge, 'considered');
			if (candidate < dist[nb.to]) {
				const oldDist = dist[nb.to];
				const oldPrev = prev[nb.to];
				dist[nb.to] = candidate;
				prev[nb.to] = current;
				heap.push(candidate, nb.to);
				const beforeQ = queueView;
				queueView = heap.toSortedArray().map((e) => ({ id: e.value, key: e.key }));
				const nt = ctx.setNode(nb.to, 'frontier');
				ctx.emit({
					kind: 'relax',
					line: 5,
					explain: `Going to ${labelOf(graph, nb.to)} via ${labelOf(graph, current)} costs ${candidate}, better than ${oldDist === Infinity ? 'infinity' : oldDist}, so the distance is updated.`,
					patch: [
						...et.patch,
						...nt.patch,
						{ t: 'dist', id: nb.to, v: candidate },
						{ t: 'prev', id: nb.to, v: current },
						{ t: 'queue', v: queueView }
					],
					inverse: [
						{ t: 'queue', v: beforeQ },
						{ t: 'prev', id: nb.to, v: oldPrev },
						{ t: 'dist', id: nb.to, v: oldDist },
						...nt.inverse,
						...et.inverse
					],
					counters: { edgesRelaxed: 1, accesses: 1 }
				});
			} else {
				ctx.emit({
					kind: 'no-relax',
					line: 5,
					explain: `Going to ${labelOf(graph, nb.to)} via ${labelOf(graph, current)} costs ${candidate}, which does not beat the known ${dist[nb.to]}.`,
					patch: et.patch,
					inverse: et.inverse,
					counters: { accesses: 1 }
				});
			}
			if (ctx.rec.full) break;
		}

		const vt = ctx.setNode(current, 'visited');
		ctx.emit({
			kind: 'visit',
			line: 6,
			explain: `${labelOf(graph, current)} is finished with a final distance of ${dist[current]}.`,
			patch: vt.patch,
			inverse: vt.inverse
		});
	}

	// Highlight the shortest path to the chosen target, if there is one.
	let path: string[] = [];
	if (opts.end && Number.isFinite(dist[opts.end])) {
		let cur: string | null = opts.end;
		while (cur) {
			path.push(cur);
			if (cur === start) break;
			cur = prev[cur];
		}
		path.reverse();
		if (path[0] !== start) path = [];
		let running: string[] = [];
		for (const id of path) {
			running = [...running, id];
			const pt = ctx.setNode(id, 'path');
			ctx.emit({
				kind: 'path',
				line: 7,
				explain: `${labelOf(graph, id)} is on the shortest path to ${labelOf(graph, opts.end)}.`,
				patch: [...pt.patch, { t: 'pathNodes', v: running }],
				inverse: [{ t: 'pathNodes', v: running.slice(0, -1) }, ...pt.inverse]
			});
		}
	}

	ctx.emit({
		kind: 'done',
		line: 7,
		explain: opts.end
			? Number.isFinite(dist[opts.end])
				? `Shortest distance from ${labelOf(graph, start)} to ${labelOf(graph, opts.end)} is ${dist[opts.end]}.`
				: `${labelOf(graph, opts.end)} cannot be reached from ${labelOf(graph, start)}.`
			: 'All reachable distances are final.',
		patch: [],
		inverse: []
	});

	return {
		algorithm: 'dijkstra',
		family: 'graph',
		initial,
		steps: ctx.rec.steps,
		result: { kind: 'distances', dist, path, cost: opts.end ? dist[opts.end] : undefined },
		truncated: ctx.rec.truncated
	};
}

// ------------------------------------------------------------------------- Prim

export function prim(graph: Graph, opts: GraphOptions = {}): Trace {
	const ctx = new GraphCtx(graph, opts.budget);
	const adj = adjacency(graph);
	const start = opts.start ?? graph.nodes[0]?.id;
	const initial = baseInitial(graph);
	if (!start) {
		return { algorithm: 'prim', family: 'graph', initial, steps: [], result: { kind: 'mst', mstEdges: [], mstWeight: 0 } };
	}

	const inTree = new Set<string>([start]);
	const heap = new MinHeap<{ to: string; edge: string; weight: number }>();
	const mstEdges: string[] = [];
	let weight = 0;

	const pushFrom = (node: string) => {
		for (const nb of adj.get(node) ?? []) {
			if (!inTree.has(nb.to)) heap.push(nb.weight, { to: nb.to, edge: nb.edge, weight: nb.weight });
		}
	};

	let queueView: QueueEntry[] = [];
	const refresh = (): QueueEntry[] => heap.toSortedArray().map((e) => ({ id: e.value.edge, key: e.key }));

	const st = ctx.setNode(start, 'tree');
	pushFrom(start);
	const after = refresh();
	ctx.emit({
		kind: 'enqueue',
		line: 1,
		explain: `Starting the tree at ${labelOf(graph, start)} and offering all of its edges.`,
		patch: [...st.patch, { t: 'queue', v: after }],
		inverse: [{ t: 'queue', v: queueView }, ...st.inverse]
	});
	queueView = after;

	while (heap.size && inTree.size < graph.nodes.length && !ctx.rec.full) {
		const top = heap.pop()!;
		const beforeQ = queueView;
		queueView = refresh();
		if (inTree.has(top.value.to)) {
			const rt = ctx.setEdge(top.value.edge, 'rejected');
			ctx.emit({
				kind: 'reject-edge',
				line: 3,
				explain: `The cheapest offered edge reaches ${labelOf(graph, top.value.to)}, which is already in the tree, so it would make a cycle and is discarded.`,
				patch: [...rt.patch, { t: 'queue', v: queueView }],
				inverse: [{ t: 'queue', v: beforeQ }, ...rt.inverse],
				counters: { comparisons: 1 }
			});
			continue;
		}
		inTree.add(top.value.to);
		mstEdges.push(top.value.edge);
		weight += top.value.weight;
		const et = ctx.setEdge(top.value.edge, 'tree');
		const nt = ctx.setNode(top.value.to, 'tree');
		ctx.emit({
			kind: 'select-edge',
			line: 4,
			explain: `The cheapest edge out of the tree costs ${top.value.weight} and brings in ${labelOf(graph, top.value.to)}. Running total: ${weight}.`,
			patch: [...et.patch, ...nt.patch, { t: 'queue', v: queueView }],
			inverse: [{ t: 'queue', v: beforeQ }, ...nt.inverse, ...et.inverse],
			counters: { edgesRelaxed: 1 }
		});
		pushFrom(top.value.to);
		const afterPush = refresh();
		ctx.emit({
			kind: 'enqueue',
			line: 5,
			explain: `Offering the edges of ${labelOf(graph, top.value.to)} to the tree.`,
			patch: [{ t: 'queue', v: afterPush }],
			inverse: [{ t: 'queue', v: queueView }]
		});
		queueView = afterPush;
	}

	const connected = inTree.size === graph.nodes.length;
	ctx.emit({
		kind: 'done',
		line: 6,
		explain: connected
			? `The minimum spanning tree uses ${mstEdges.length} edge(s) with a total weight of ${weight}.`
			: `The graph is disconnected, so only a spanning tree of the component containing ${labelOf(graph, start)} exists (weight ${weight}).`,
		patch: [],
		inverse: []
	});

	return {
		algorithm: 'prim',
		family: 'graph',
		initial,
		steps: ctx.rec.steps,
		result: { kind: 'mst', mstEdges, mstWeight: weight },
		truncated: ctx.rec.truncated
	};
}

// ---------------------------------------------------------------------- Kruskal

export function kruskal(graph: Graph, opts: GraphOptions = {}): Trace {
	const ctx = new GraphCtx(graph, opts.budget);
	const initial = baseInitial(graph);
	initial.sets = graph.nodes.map((n) => [n.id]);

	const parent = new Map<string, string>();
	const rank = new Map<string, number>();
	for (const n of graph.nodes) {
		parent.set(n.id, n.id);
		rank.set(n.id, 0);
	}
	const find = (x: string): string => {
		let r = x;
		while (parent.get(r) !== r) r = parent.get(r)!;
		while (parent.get(x) !== r) {
			const next = parent.get(x)!;
			parent.set(x, r);
			x = next;
		}
		return r;
	};
	const setsView = (): string[][] => {
		const groups = new Map<string, string[]>();
		for (const n of graph.nodes) {
			const r = find(n.id);
			if (!groups.has(r)) groups.set(r, []);
			groups.get(r)!.push(n.id);
		}
		return [...groups.values()].map((g) => [...g].sort()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
	};

	const sorted = [...graph.edges].sort((a, b) => a.weight - b.weight || (a.id < b.id ? -1 : 1));
	const mstEdges: string[] = [];
	let weight = 0;
	let currentSets = setsView();

	ctx.emit({
		kind: 'read',
		line: 1,
		explain: `Sorting all ${sorted.length} edge(s) by weight; every node begins in its own set.`,
		patch: [{ t: 'sets', v: currentSets }],
		inverse: [{ t: 'sets', v: currentSets }]
	});

	for (const e of sorted) {
		if (ctx.rec.full) break;
		const ra = find(e.from);
		const rb = find(e.to);
		const ct = ctx.setEdge(e.id, 'considered');
		ctx.emit({
			kind: 'compare',
			line: 3,
			explain: `Looking at edge ${labelOf(graph, e.from)}-${labelOf(graph, e.to)} with weight ${e.weight}.`,
			patch: ct.patch,
			inverse: ct.inverse,
			counters: { comparisons: 1 }
		});
		if (ra === rb) {
			const rt = ctx.setEdge(e.id, 'rejected');
			ctx.emit({
				kind: 'reject-edge',
				line: 4,
				explain: `${labelOf(graph, e.from)} and ${labelOf(graph, e.to)} are already in the same set, so adding this edge would create a cycle.`,
				patch: rt.patch,
				inverse: rt.inverse
			});
			continue;
		}
		if (rank.get(ra)! < rank.get(rb)!) parent.set(ra, rb);
		else if (rank.get(ra)! > rank.get(rb)!) parent.set(rb, ra);
		else {
			parent.set(rb, ra);
			rank.set(ra, rank.get(ra)! + 1);
		}
		mstEdges.push(e.id);
		weight += e.weight;
		const nextSets = setsView();
		const et = ctx.setEdge(e.id, 'tree');
		const na = ctx.setNode(e.from, 'tree');
		const nb = ctx.setNode(e.to, 'tree');
		ctx.emit({
			kind: 'union',
			line: 5,
			explain: `The two sets are different, so the edge joins the tree and the sets are merged. Running total: ${weight}.`,
			patch: [...et.patch, ...na.patch, ...nb.patch, { t: 'sets', v: nextSets }],
			inverse: [{ t: 'sets', v: currentSets }, ...nb.inverse, ...na.inverse, ...et.inverse],
			counters: { edgesRelaxed: 1 }
		});
		currentSets = nextSets;
	}

	const connected = currentSets.length <= 1;
	ctx.emit({
		kind: 'done',
		line: 6,
		explain: connected
			? `The minimum spanning tree uses ${mstEdges.length} edge(s) with a total weight of ${weight}.`
			: `The graph has ${currentSets.length} components, so the result is a minimum spanning FOREST of weight ${weight}.`,
		patch: [],
		inverse: []
	});

	return {
		algorithm: 'kruskal',
		family: 'graph',
		initial,
		steps: ctx.rec.steps,
		result: { kind: 'mst', mstEdges, mstWeight: weight },
		truncated: ctx.rec.truncated
	};
}

// ------------------------------------------------------------- Topological sort

export function topologicalSort(graph: Graph, opts: GraphOptions = {}): Trace {
	const ctx = new GraphCtx(graph, opts.budget);
	const initial = baseInitial(graph);
	const adj = adjacency({ ...graph, directed: true });
	const indeg = new Map<string, number>();
	for (const n of graph.nodes) indeg.set(n.id, 0);
	for (const e of graph.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

	let ready = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id).sort();
	let queueView: QueueEntry[] = ready.map((id) => ({ id }));
	const order: string[] = [];

	ctx.emit({
		kind: 'enqueue',
		line: 1,
		explain: ready.length
			? `Nodes with no incoming edges can go first: ${ready.map((id) => labelOf(graph, id)).join(', ')}.`
			: 'Every node has an incoming edge, so this directed graph contains a cycle and cannot be ordered.',
		patch: [{ t: 'queue', v: queueView }],
		inverse: [{ t: 'queue', v: [] }]
	});

	while (ready.length && !ctx.rec.full) {
		const current = ready.shift()!;
		const before = queueView;
		queueView = ready.map((id) => ({ id }));
		const ct = ctx.setNode(current, 'visited');
		order.push(current);
		ctx.emit({
			kind: 'dequeue',
			line: 3,
			explain: `${labelOf(graph, current)} has no remaining prerequisites, so it takes position ${order.length} in the order.`,
			patch: [...ct.patch, { t: 'queue', v: queueView }],
			inverse: [{ t: 'queue', v: before }, ...ct.inverse],
			counters: { visited: 1 }
		});
		for (const nb of adj.get(current) ?? []) {
			indeg.set(nb.to, (indeg.get(nb.to) ?? 0) - 1);
			const et = ctx.setEdge(nb.edge, 'tree');
			if ((indeg.get(nb.to) ?? 0) === 0) {
				ready.push(nb.to);
				ready.sort();
				const beforeQ = queueView;
				queueView = ready.map((id) => ({ id }));
				ctx.emit({
					kind: 'enqueue',
					line: 5,
					explain: `${labelOf(graph, nb.to)} now has no remaining prerequisites, so it becomes available.`,
					patch: [...et.patch, { t: 'queue', v: queueView }],
					inverse: [{ t: 'queue', v: beforeQ }, ...et.inverse]
				});
			} else {
				ctx.emit({
					kind: 'no-relax',
					line: 5,
					explain: `${labelOf(graph, nb.to)} still has ${indeg.get(nb.to)} prerequisite(s) left.`,
					patch: et.patch,
					inverse: et.inverse
				});
			}
		}
	}

	const complete = order.length === graph.nodes.length;
	ctx.emit({
		kind: complete ? 'done' : 'not-found',
		line: 6,
		explain: complete
			? `A valid order is ${order.map((id) => labelOf(graph, id)).join(' -> ')}.`
			: 'Some nodes were never freed, which means the graph contains a cycle and no topological order exists.',
		patch: [],
		inverse: []
	});

	return {
		algorithm: 'topological',
		family: 'graph',
		initial,
		steps: ctx.rec.steps,
		result: { kind: 'traversal', order: complete ? order : [] },
		truncated: ctx.rec.truncated
	};
}

export function runGraphAlgorithm(name: GraphName, graph: Graph, opts: GraphOptions = {}): Trace {
	switch (name) {
		case 'bfs':
			return graphTraversal('bfs', graph, opts);
		case 'dfs':
			return graphTraversal('dfs', graph, opts);
		case 'dijkstra':
			return graphDijkstra(graph, opts);
		case 'prim':
			return prim(graph, opts);
		case 'kruskal':
			return kruskal(graph, opts);
		case 'topological':
			return topologicalSort(graph, opts);
	}
}
