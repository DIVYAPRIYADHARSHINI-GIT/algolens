<script lang="ts">
	// Node-link graph renderer and editor. Draws the state it is given; edits are reported up.
	// Interaction: click empty space to add a node, drag a node to move it, drag from one node
	// to another to add an edge, click a node or edge to select it.
	import type { EdgeTag, NodeTag } from '#lib/core/types.js';
	import type { VisualState } from '#lib/core/state.js';
	import type { Graph } from '#lib/algorithms/graph.js';

	export type GraphTool = 'select' | 'node' | 'edge' | 'delete';

	interface Props {
		graph: Graph;
		viewState: VisualState;
		tool: GraphTool;
		start: string;
		end: string;
		onaddnode: (x: number, y: number) => void;
		onmovenode: (id: string, x: number, y: number) => void;
		onaddedge: (from: string, to: string) => void;
		ondeletenode: (id: string) => void;
		ondeleteedge: (id: string) => void;
		onselectedge: (id: string) => void;
	}
	const {
		graph,
		viewState,
		tool,
		start,
		end,
		onaddnode,
		onmovenode,
		onaddedge,
		ondeletenode,
		ondeleteedge,
		onselectedge
	}: Props = $props();

	const W = 720;
	const H = 380;
	const R = 18;

	let svgEl: SVGSVGElement | null = $state(null);
	let dragId = $state<string | null>(null);
	let linkFrom = $state<string | null>(null);
	let pointer = $state<{ x: number; y: number } | null>(null);

	const NODE_CUE: Record<NodeTag, string> = {
		none: '',
		wall: '',
		start: '',
		end: '',
		frontier: 'F',
		visited: 'V',
		current: 'C',
		path: 'P',
		tree: 'T'
	};

	const ROLE_TEXT: Record<NodeTag, string> = {
		none: 'not reached',
		wall: '',
		start: 'start',
		end: 'target',
		frontier: 'in the queue',
		visited: 'visited',
		current: 'current',
		path: 'on the shortest path',
		tree: 'in the tree'
	};

	function toLocal(event: PointerEvent): { x: number; y: number } {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: Math.round(((event.clientX - rect.left) / rect.width) * W),
			y: Math.round(((event.clientY - rect.top) / rect.height) * H)
		};
	}

	function onSurfaceDown(event: PointerEvent) {
		if ((event.target as Element).closest('[data-node], [data-edge]')) return;
		if (tool !== 'node') return;
		const p = toLocal(event);
		onaddnode(Math.max(R + 4, Math.min(W - R - 4, p.x)), Math.max(R + 4, Math.min(H - R - 4, p.y)));
	}

	function onNodeDown(event: PointerEvent, id: string) {
		event.stopPropagation();
		if (tool === 'delete') {
			ondeletenode(id);
			return;
		}
		if (tool === 'edge') {
			linkFrom = id;
			pointer = toLocal(event);
			return;
		}
		dragId = id;
	}

	function onMove(event: PointerEvent) {
		if (linkFrom) {
			pointer = toLocal(event);
			return;
		}
		if (!dragId) return;
		const p = toLocal(event);
		onmovenode(dragId, Math.max(R + 4, Math.min(W - R - 4, p.x)), Math.max(R + 4, Math.min(H - R - 4, p.y)));
	}

	function onUp(event: PointerEvent) {
		if (linkFrom) {
			const el = document.elementFromPoint(event.clientX, event.clientY) as Element | null;
			const targetId = el?.closest('[data-node]')?.getAttribute('data-node');
			if (targetId && targetId !== linkFrom) onaddedge(linkFrom, targetId);
			linkFrom = null;
			pointer = null;
		}
		dragId = null;
	}

	function nodeTag(id: string): NodeTag {
		if (viewState.pathNodes.includes(id)) return 'path';
		return viewState.nodes[id] ?? 'none';
	}

	function edgeTag(id: string): EdgeTag {
		return viewState.edges[id] ?? 'none';
	}

	function nodeAt(id: string) {
		return graph.nodes.find((n) => n.id === id);
	}

	function distOf(id: string): string {
		const v = viewState.dist[id];
		return v === undefined || !Number.isFinite(v) ? '∞' : String(v);
	}

	/** Offset the label away from the line so it never sits on top of the stroke. */
	function labelPos(from: { x: number; y: number }, to: { x: number; y: number }) {
		const mx = (from.x + to.x) / 2;
		const my = (from.y + to.y) / 2;
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.hypot(dx, dy) || 1;
		return { x: mx + (-dy / len) * 12, y: my + (dx / len) * 12 };
	}
</script>

<div class="graphwrap">
	<svg
		bind:this={svgEl}
		viewBox={`0 0 ${W} ${H}`}
		role="application"
		aria-label="Graph editor. Use the tool buttons to add nodes and edges, and drag nodes to move them."
		onpointerdown={onSurfaceDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointerleave={onUp}
	>
		<defs>
			<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
				<path d="M0 0 10 5 0 10z" fill="var(--ink-3)" />
			</marker>
		</defs>

		{#each graph.edges as edge (edge.id)}
			{@const a = nodeAt(edge.from)}
			{@const b = nodeAt(edge.to)}
			{#if a && b}
				{@const lp = labelPos(a, b)}
				<g data-edge={edge.id} class="edge" data-tag={edgeTag(edge.id)}>
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						marker-end={graph.directed ? 'url(#arrow)' : undefined}
					/>
					<line
						class="hit"
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						onpointerdown={(e) => {
							e.stopPropagation();
							if (tool === 'delete') ondeleteedge(edge.id);
							else onselectedge(edge.id);
						}}
						role="presentation"
					/>
					<rect x={lp.x - 11} y={lp.y - 9} width="22" height="16" rx="4" class="wbg" />
					<text x={lp.x} y={lp.y + 3} class="wtext">{edge.weight}</text>
				</g>
			{/if}
		{/each}

		{#if linkFrom && pointer}
			{@const a = nodeAt(linkFrom)}
			{#if a}
				<line class="ghost" x1={a.x} y1={a.y} x2={pointer.x} y2={pointer.y} />
			{/if}
		{/if}

		{#each graph.nodes as node (node.id)}
			<g
				data-node={node.id}
				class="node"
				data-tag={nodeTag(node.id)}
				class:is-start={node.id === start}
				class:is-end={node.id === end}
				onpointerdown={(e) => onNodeDown(e, node.id)}
				role="presentation"
			>
				<circle cx={node.x} cy={node.y} r={R} />
				<text x={node.x} y={node.y + 4} class="nlabel">{node.label}</text>
				{#if NODE_CUE[nodeTag(node.id)]}
					<text x={node.x + R - 2} y={node.y - R + 8} class="ncue">{NODE_CUE[nodeTag(node.id)]}</text>
				{/if}
				{#if node.id === start}<text x={node.x} y={node.y + R + 12} class="marker">start</text>{/if}
				{#if node.id === end}<text x={node.x} y={node.y + R + 12} class="marker">target</text>{/if}
				{#if Object.keys(viewState.dist).length || viewState.nodes[node.id] !== 'none'}
					<text x={node.x} y={node.y - R - 6} class="dist">{distOf(node.id)}</text>
				{/if}
			</g>
		{/each}
	</svg>
</div>

<details class="table-view">
	<summary>Text and table view of the current graph state</summary>
	<table>
		<caption class="sr-only">Node state and distance</caption>
		<thead><tr><th scope="col">Node</th><th scope="col">Role</th><th scope="col" class="num">Distance</th></tr></thead>
		<tbody>
			{#each graph.nodes as node (node.id)}
				<tr>
					<td>{node.label}</td>
					<td>{ROLE_TEXT[nodeTag(node.id)]}</td>
					<td class="num">{distOf(node.id)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="muted" data-testid="graph-queue">
		Queue: {viewState.queue.length
			? viewState.queue.map((q) => `${nodeAt(q.id)?.label ?? q.id}${q.key === undefined ? '' : ` (${q.key})`}`).join(', ')
			: 'empty'}
	</p>
	{#if viewState.sets.length}
		<p class="muted" data-testid="graph-sets">
			Sets: {viewState.sets.map((s) => `{${s.map((id) => nodeAt(id)?.label ?? id).join(', ')}}`).join(' ')}
		</p>
	{/if}
</details>

<style>
	.graphwrap {
		flex: 1 1 auto;
		display: flex;
		min-height: 0;
		padding: 12px;
	}

	svg {
		width: 100%;
		height: auto;
		max-height: 100%;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		touch-action: none;
	}

	.edge line {
		stroke: var(--border-strong);
		stroke-width: 2;
	}

	.edge line.hit {
		stroke: transparent;
		stroke-width: 14;
		cursor: pointer;
	}

	.edge[data-tag='considered'] line:not(.hit) {
		stroke: var(--d-orange);
		stroke-width: 3;
	}
	.edge[data-tag='relaxed'] line:not(.hit) {
		stroke: var(--d-blue);
		stroke-width: 3;
	}
	.edge[data-tag='tree'] line:not(.hit) {
		stroke: var(--d-green);
		stroke-width: 3.5;
	}
	/* Rejected edges use a dashed stroke as well as a colour change. */
	.edge[data-tag='rejected'] line:not(.hit) {
		stroke: var(--ink-3);
		stroke-dasharray: 4 4;
	}
	.edge[data-tag='path'] line:not(.hit) {
		stroke: var(--d-green);
		stroke-width: 4;
	}

	.ghost {
		stroke: var(--ink-3);
		stroke-width: 2;
		stroke-dasharray: 5 4;
	}

	.wbg {
		fill: var(--panel);
		stroke: var(--border);
	}

	.wtext {
		fill: var(--ink-2);
		font-family: var(--mono);
		font-size: 11px;
		text-anchor: middle;
	}

	.node circle {
		fill: var(--panel);
		stroke: var(--border-strong);
		stroke-width: 2;
		cursor: grab;
	}

	.node[data-tag='frontier'] circle {
		fill: var(--d-sky);
		stroke: var(--on-sky);
	}
	.node[data-tag='visited'] circle {
		fill: var(--d-purple);
		stroke: var(--on-purple);
	}
	.node[data-tag='current'] circle {
		fill: var(--d-orange);
		stroke: var(--on-orange);
	}
	.node[data-tag='path'] circle,
	.node[data-tag='tree'] circle {
		fill: var(--d-green);
		stroke: var(--on-green);
	}

	/* Start and target get a thicker ring as a shape cue, not only a colour. */
	.node.is-start circle {
		stroke: var(--d-blue);
		stroke-width: 4;
	}
	.node.is-end circle {
		stroke: var(--d-vermilion);
		stroke-width: 4;
		stroke-dasharray: 6 3;
	}

	.nlabel {
		fill: var(--ink);
		font-family: var(--sans);
		font-size: 13px;
		font-weight: 600;
		text-anchor: middle;
		pointer-events: none;
	}

	.node[data-tag='visited'] .nlabel,
	.node[data-tag='path'] .nlabel,
	.node[data-tag='tree'] .nlabel {
		fill: var(--on-green);
	}

	.ncue {
		fill: var(--ink);
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		text-anchor: middle;
		pointer-events: none;
	}

	.marker,
	.dist {
		fill: var(--ink-3);
		font-family: var(--mono);
		font-size: 10px;
		text-anchor: middle;
		pointer-events: none;
	}

	.dist {
		fill: var(--ink);
		font-weight: 700;
	}

	.table-view {
		margin: 0 12px 12px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--panel-2);
		font-size: 12px;
	}

	.table-view summary {
		cursor: pointer;
		color: var(--ink-2);
	}

	.table-view table {
		max-height: 180px;
		display: block;
		overflow: auto;
		margin-bottom: 6px;
	}
</style>
