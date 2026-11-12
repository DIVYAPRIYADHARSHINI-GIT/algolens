<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import { Player } from '#lib/player.svelte.js';
	import {
		edgeId,
		emptyGraph,
		graphTraversal,
		hasNegativeWeight,
		runGraphAlgorithm,
		type Graph,
		type GraphName
	} from '#lib/algorithms/graph.js';
	import { entryFor } from '#lib/data/catalog.js';
	import { verifyGraph, type Verification } from '#lib/core/verify.js';
	import { decodeShare, encodeShare } from '#lib/core/share.js';
	import { cryptoId, validateSavedGraph } from '#lib/core/schema.js';
	import { sampleDag, sampleGraph } from '#lib/data/samples.js';
	import { MAX_STEPS } from '#lib/core/types.js';
	import Workspace from '#lib/components/Workspace.svelte';
	import GraphView, { type GraphTool } from '#lib/components/GraphView.svelte';
	import SidePanel from '#lib/components/SidePanel.svelte';
	import Transport from '#lib/components/Transport.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyText, downloadText } from '#lib/browser-utils.js';

	const ALGORITHMS: { id: GraphName; label: string }[] = [
		{ id: 'bfs', label: 'BFS traversal' },
		{ id: 'dfs', label: 'DFS traversal' },
		{ id: 'dijkstra', label: "Dijkstra's shortest path" },
		{ id: 'prim', label: "Prim's minimum spanning tree" },
		{ id: 'kruskal', label: "Kruskal's minimum spanning tree" },
		{ id: 'topological', label: 'Topological sort' }
	];

	let algorithm = $state<GraphName>('dijkstra');
	let graph = $state<Graph>(sampleGraph());
	let tool = $state<GraphTool>('select');
	let startNode = $state('n1');
	let endNode = $state('n6');
	let selectedEdge = $state<string | null>(null);
	let edgeWeight = $state(1);
	let verification = $state<Verification | null>(null);
	let saveName = $state('');
	let fileInput: HTMLInputElement | null = $state(null);

	const entry = $derived(entryFor('graph', algorithm)!);
	const negative = $derived(hasNegativeWeight(graph));
	const blockedByNegative = $derived(algorithm === 'dijkstra' && negative);
	const needsDirected = $derived(algorithm === 'topological');

	// Starts on an empty placeholder trace; the $effect below loads the real one
	// immediately, which keeps the derived trace out of component initialisation.
	const player = new Player(graphTraversal('bfs', emptyGraph()));

	const trace = $derived.by(() => {
		if (blockedByNegative) return graphTraversal('bfs', emptyGraph());
		const target: Graph = needsDirected ? { ...graph, directed: true } : graph;
		try {
			return runGraphAlgorithm(algorithm, target, { start: startNode, end: endNode, budget: MAX_STEPS });
		} catch {
			return graphTraversal('bfs', emptyGraph());
		}
	});

	$effect(() => {
		const t = trace;
		player.load(t);
		if (blockedByNegative || !graph.nodes.length) {
			verification = null;
			return;
		}
		// Local first: reading the rune we just wrote would re-trigger this effect.
		const result = verifyGraph(needsDirected ? { ...graph, directed: true } : graph, algorithm, startNode, t);
		verification = result;
		if (!result.ok) {
			console.error('AlgoLens verification failed', { algorithm, details: result.details });
			app.toast('The graph result failed automatic verification. See the Explanation tab.', 'bad');
		}
	});

	onMount(() => {
		app.setMode('graphs');
		const hash = page.url.hash;
		if (hash && hash.length > 2) {
			const result = decodeShare(hash);
			if (result.ok && result.setup.graphs) {
				algorithm = result.setup.graphs.algorithm;
				graph = result.setup.graphs.graph;
				startNode = result.setup.graphs.start;
				endNode = result.setup.graphs.end;
				app.toast('Shared graph loaded from the link.', 'ok');
			} else if (!result.ok) {
				app.toast(`That shared link could not be opened. ${result.error}`, 'bad');
			}
			replaceState(page.url.pathname, {});
		}
		return () => player.destroy();
	});

	function nextNodeId(): string {
		let i = graph.nodes.length + 1;
		while (graph.nodes.some((n) => n.id === `n${i}`)) i++;
		return `n${i}`;
	}

	function addNode(x: number, y: number) {
		if (graph.nodes.length >= 26) {
			app.toast('This editor supports up to 26 nodes so the labels stay readable.', 'bad');
			return;
		}
		const id = nextNodeId();
		const used = new Set(graph.nodes.map((n) => n.label));
		let label = 'A';
		for (let c = 0; c < 26; c++) {
			const candidate = String.fromCharCode(65 + c);
			if (!used.has(candidate)) {
				label = candidate;
				break;
			}
		}
		graph = { ...graph, nodes: [...graph.nodes, { id, label, x, y }] };
		if (!startNode) startNode = id;
	}

	function moveNode(id: string, x: number, y: number) {
		graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) };
	}

	function addEdge(from: string, to: string) {
		const id = edgeId(from, to);
		const exists = graph.edges.some(
			(e) => e.id === id || (!graph.directed && e.from === to && e.to === from)
		);
		if (exists) {
			app.toast('These two nodes are already connected.', 'bad');
			return;
		}
		graph = { ...graph, edges: [...graph.edges, { id, from, to, weight: Math.max(1, edgeWeight) }] };
		selectedEdge = id;
	}

	function deleteNode(id: string) {
		graph = {
			...graph,
			nodes: graph.nodes.filter((n) => n.id !== id),
			edges: graph.edges.filter((e) => e.from !== id && e.to !== id)
		};
		if (startNode === id) startNode = graph.nodes[0]?.id ?? '';
		if (endNode === id) endNode = graph.nodes.at(-1)?.id ?? '';
	}

	function deleteEdge(id: string) {
		graph = { ...graph, edges: graph.edges.filter((e) => e.id !== id) };
		if (selectedEdge === id) selectedEdge = null;
	}

	function setSelectedWeight(value: number) {
		if (!selectedEdge) return;
		graph = {
			...graph,
			edges: graph.edges.map((e) => (e.id === selectedEdge ? { ...e, weight: Math.round(value) } : e))
		};
	}

	function saveGraph() {
		const name = saveName.trim() || `Graph ${new Date().toLocaleString()}`;
		const record = validateSavedGraph({ ...graph, id: cryptoId(), name, createdAt: Date.now() });
		if (!record) {
			app.toast('This graph could not be saved because it failed validation.', 'bad');
			return;
		}
		app.update((d) => ({ ...d, savedGraphs: [record, ...d.savedGraphs].slice(0, 100) }));
		saveName = '';
		app.toast(`Saved "${name}" in this browser.`, 'ok');
	}

	function loadSaved(id: string) {
		const saved = app.settings.savedGraphs.find((g) => g.id === id);
		if (!saved) return;
		graph = { directed: saved.directed, nodes: saved.nodes, edges: saved.edges };
		startNode = saved.nodes[0]?.id ?? '';
		endNode = saved.nodes.at(-1)?.id ?? '';
		app.toast(`Loaded "${saved.name}".`, 'ok');
	}

	function deleteSaved(id: string) {
		app.update((d) => ({ ...d, savedGraphs: d.savedGraphs.filter((g) => g.id !== id) }));
		app.toast('Saved graph deleted.', 'ok');
	}

	function exportGraph() {
		downloadText('algolens-graph.json', JSON.stringify({ app: 'algolens', kind: 'graph', graph }, null, 2));
	}

	async function importGraph(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (file.size > 1_000_000) {
			app.toast('That file is far larger than any AlgoLens graph.', 'bad');
			return;
		}
		try {
			const text = await file.text();
			const parsed: unknown = JSON.parse(text);
			const candidate =
				typeof parsed === 'object' && parsed !== null && 'graph' in parsed
					? (parsed as { graph: unknown }).graph
					: parsed;
			const validated = validateSavedGraph({
				...(candidate as Record<string, unknown>),
				id: cryptoId(),
				name: file.name,
				createdAt: Date.now()
			});
			if (!validated) {
				app.toast('That file is not a valid AlgoLens graph. Every node needs a unique id and a numeric position, and every edge must join two existing nodes.', 'bad');
				return;
			}
			graph = { directed: validated.directed, nodes: validated.nodes, edges: validated.edges };
			startNode = validated.nodes[0]?.id ?? '';
			endNode = validated.nodes.at(-1)?.id ?? '';
			app.toast(`Imported ${validated.nodes.length} node(s) and ${validated.edges.length} edge(s).`, 'ok');
		} catch {
			app.toast('That file could not be read as JSON.', 'bad');
		}
	}

	async function share() {
		const hash = encodeShare({
			v: 1,
			mode: 'graphs',
			graphs: { algorithm, graph, start: startNode, end: endNode }
		});
		const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
		const ok = await copyText(url);
		app.toast(ok ? 'Link copied. The whole graph is inside the link.' : 'Could not copy; the link is in the address bar.', ok ? 'ok' : 'bad');
		if (!ok) window.location.hash = `s=${hash}`;
	}

	const LEGEND = [
		{ tag: 'frontier', cue: 'F', label: 'In the queue' },
		{ tag: 'current', cue: 'C', label: 'Current' },
		{ tag: 'visited', cue: 'V', label: 'Visited' },
		{ tag: 'tree', cue: 'T', label: 'In the tree' },
		{ tag: 'path', cue: 'P', label: 'Shortest path' },
		{ tag: 'rejected', cue: '', label: 'Rejected (would make a cycle)' }
	];

	const extraStats = $derived([
		{ label: 'Edges relaxed', value: player.state.counters.edgesRelaxed },
		{ label: 'Nodes visited', value: player.state.counters.visited },
		...(trace.result.mstWeight !== undefined ? [{ label: 'Tree weight', value: trace.result.mstWeight }] : []),
		...(trace.result.order?.length ? [{ label: 'Visit order length', value: trace.result.order.length }] : [])
	]);

	const selected = $derived(graph.edges.find((e) => e.id === selectedEdge) ?? null);
</script>

<svelte:head>
	<title>Graphs - AlgoLens</title>
	<meta name="description" content="Build a weighted graph then run BFS, DFS, Dijkstra, Prim or Kruskal, watching the queue, distance table and union-find sets change." />
</svelte:head>

<Workspace title="Graph visualiser">
	{#snippet banner()}
		{#if blockedByNegative}
			<div class="notice notice-bad" data-testid="negative-warning">
				<strong>Dijkstra cannot run on a graph with a negative edge weight.</strong> Its correctness
				depends on never needing to revisit a node once it has been finalised, and a negative edge
				breaks that argument: a longer route could later become cheaper. Remove the negative weight, or
				use a Bellman-Ford style algorithm instead.
			</div>
		{:else if needsDirected && !graph.directed}
			<div class="notice">
				<strong>Topological sort only applies to directed graphs.</strong> The edges below are being read
				as directed from the first node to the second for this run.
			</div>
		{/if}
	{/snippet}

	{#snippet controls()}
		<div class="field">
			<label for="graph-algo">Algorithm</label>
			<span class="select-wrap">
				<select id="graph-algo" bind:value={algorithm}>
					{#each ALGORITHMS as a (a.id)}
						<option value={a.id}>{a.label}</option>
					{/each}
				</select>
			</span>
		</div>

		<div class="field">
			<label for="startn">Start node</label>
			<span class="select-wrap">
				<select id="startn" bind:value={startNode}>
					{#each graph.nodes as n (n.id)}
						<option value={n.id}>{n.label}</option>
					{/each}
				</select>
			</span>
		</div>

		{#if algorithm === 'dijkstra'}
			<div class="field">
				<label for="endn">Target node</label>
				<span class="select-wrap">
					<select id="endn" bind:value={endNode}>
						{#each graph.nodes as n (n.id)}
							<option value={n.id}>{n.label}</option>
						{/each}
					</select>
				</span>
			</div>
		{/if}

		<div class="field">
			<span class="row">
				<input
					id="dir"
					type="checkbox"
					checked={graph.directed}
					onchange={(e) => (graph = { ...graph, directed: (e.currentTarget as HTMLInputElement).checked })}
				/>
				<label for="dir">Directed edges</label>
			</span>
		</div>

		<h4>Edit</h4>
		<div class="row-wrap">
			<button class="btn" class:btn-primary={tool === 'select'} onclick={() => (tool = 'select')}>
				<Icon name="pencil" size={14} /> Move
			</button>
			<button class="btn" class:btn-primary={tool === 'node'} onclick={() => (tool = 'node')}>Add node</button>
			<button class="btn" class:btn-primary={tool === 'edge'} onclick={() => (tool = 'edge')}>Add edge</button>
			<button class="btn" class:btn-primary={tool === 'delete'} onclick={() => (tool = 'delete')}>
				<Icon name="trash" size={14} /> Delete
			</button>
		</div>
		<p class="muted">
			{#if tool === 'node'}Click an empty area to add a node.
			{:else if tool === 'edge'}Drag from one node to another to connect them.
			{:else if tool === 'delete'}Click a node or an edge to remove it.
			{:else}Drag a node to move it. Click an edge to change its weight.{/if}
		</p>

		{#if selected}
			<div class="field">
				<label for="ew">
					Weight of {graph.nodes.find((n) => n.id === selected.from)?.label} to
					{graph.nodes.find((n) => n.id === selected.to)?.label}
				</label>
				<input
					id="ew"
					type="number"
					value={selected.weight}
					step="1"
					onchange={(e) => setSelectedWeight(Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</div>
		{/if}

		<div class="field">
			<label for="new-weight">Weight for new edges</label>
			<input id="new-weight" type="number" bind:value={edgeWeight} min="1" step="1" />
		</div>

		<h4>Examples</h4>
		<div class="row-wrap">
			<button
				class="btn"
				onclick={() => {
					graph = sampleGraph();
					startNode = 'n1';
					endNode = 'n6';
				}}>Weighted graph</button
			>
			<button
				class="btn"
				onclick={() => {
					graph = sampleDag();
					algorithm = 'topological';
					startNode = 'n1';
					endNode = 'n5';
				}}>Directed acyclic</button
			>
			<button
				class="btn"
				onclick={() => {
					graph = emptyGraph(graph.directed);
					startNode = '';
					endNode = '';
					tool = 'node';
				}}>Empty</button
			>
		</div>

		<h4>Save, import and export</h4>
		<div class="field">
			<div class="row">
				<input type="text" bind:value={saveName} placeholder="My graph" maxlength="60" aria-label="Name for the saved graph" />
				<button class="btn btn-icon" onclick={saveGraph} aria-label="Save this graph" title="Save"><Icon name="save" size={15} /></button>
			</div>
		</div>
		<div class="row-wrap">
			<button class="btn" onclick={exportGraph}><Icon name="download" size={14} /> Export</button>
			<button class="btn" onclick={() => fileInput?.click()}><Icon name="upload" size={14} /> Import</button>
			<button class="btn" onclick={share}><Icon name="link" size={14} /> Copy link</button>
		</div>
		<input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" onchange={importGraph} aria-label="Choose a graph JSON file" />

		{#if app.settings.savedGraphs.length}
			<ul class="saved">
				{#each app.settings.savedGraphs as saved (saved.id)}
					<li>
						<button class="link" onclick={() => loadSaved(saved.id)}>{saved.name}</button>
						<span class="muted num">{saved.nodes.length}n</span>
						<button class="btn btn-icon" onclick={() => deleteSaved(saved.id)} aria-label={`Delete ${saved.name}`}>
							<Icon name="trash" size={13} />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">No saved graphs yet.</p>
		{/if}
	{/snippet}

	{#snippet canvas()}
		<Legend
			items={LEGEND}
			verified={verification ? { ok: verification.ok, label: verification.label } : null}
			truncated={trace.truncated === true}
		/>
		{#if !graph.nodes.length}
			<p class="notice inline">This graph is empty. Choose "Add node" and click the area below, or load one of the examples.</p>
		{/if}
		<div class="queuebar">
			<span class="chip">
				{algorithm === 'dijkstra' || algorithm === 'prim' ? 'Priority queue' : algorithm === 'dfs' ? 'Stack' : 'Queue'}
				<strong class="num">
					{player.state.queue.length
						? player.state.queue
								.map((q) => {
									const node = graph.nodes.find((n) => n.id === q.id);
									const edge = graph.edges.find((e) => e.id === q.id);
									const name = node?.label ?? (edge ? `${graph.nodes.find((n) => n.id === edge.from)?.label}-${graph.nodes.find((n) => n.id === edge.to)?.label}` : q.id);
									return q.key === undefined ? name : `${name}:${q.key}`;
								})
								.join('  ')
						: 'empty'}
				</strong>
			</span>
			{#if player.state.sets.length}
				<span class="chip">
					Sets
					<strong class="num">
						{player.state.sets.map((s) => `{${s.map((id) => graph.nodes.find((n) => n.id === id)?.label ?? id).join(',')}}`).join(' ')}
					</strong>
				</span>
			{/if}
		</div>
		<GraphView
			{graph}
			viewState={player.state}
			{tool}
			start={startNode}
			end={endNode}
			onaddnode={addNode}
			onmovenode={moveNode}
			onaddedge={addEdge}
			ondeletenode={deleteNode}
			ondeleteedge={deleteEdge}
			onselectedge={(id) => (selectedEdge = id)}
		/>
		<p class="sr-only" role="status" aria-live="polite">{player.announcement}</p>
	{/snippet}

	{#snippet side()}
		<SidePanel {entry} line={player.line} explain={player.explain} counters={player.state.counters} {extraStats} {verification} />
	{/snippet}

	{#snippet transport()}
		<Transport {player} onrestart={() => player.toStart()} />
	{/snippet}
</Workspace>

<style>
	.queuebar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 12px 0;
	}

	.chip {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--panel-2);
		font-size: 12px;
		color: var(--ink-3);
		max-width: 100%;
		overflow-x: auto;
	}

	.chip strong {
		color: var(--ink);
		white-space: nowrap;
	}

	.inline {
		margin: 8px 12px 0;
	}

	.saved {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.saved li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.link {
		flex: 1;
		text-align: left;
		color: var(--focus);
		text-decoration: underline;
		text-underline-offset: 2px;
		min-height: 28px;
	}

	h4 {
		margin: 16px 0 8px;
	}
</style>
