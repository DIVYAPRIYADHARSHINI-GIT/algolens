<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import { Player } from '#lib/player.svelte.js';
	import { GUARANTEES_SHORTEST, PATHFINDERS, type PathName } from '#lib/algorithms/pathfinding.js';
	import {
		clearWalls,
		clearWeights,
		dfsMaze,
		divisionMaze,
		isAdmissible,
		makeGrid,
		randomWalls,
		randomWeights,
		type Grid,
		type Heuristic
	} from '#lib/algorithms/grid.js';
	import { entryFor } from '#lib/data/catalog.js';
	import { verifyPath, type Verification } from '#lib/core/verify.js';
	import { decodeGrid, decodeShare, encodeGrid, encodeShare } from '#lib/core/share.js';
	import { cryptoId, validateSavedGrid } from '#lib/core/schema.js';
	import { sampleGrid } from '#lib/data/samples.js';
	import { MAX_STEPS } from '#lib/core/types.js';
	import Workspace from '#lib/components/Workspace.svelte';
	import GridView, { type Tool } from '#lib/components/GridView.svelte';
	import SidePanel from '#lib/components/SidePanel.svelte';
	import Transport from '#lib/components/Transport.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyBlobToClipboard, copyText, downloadBlob, elementToPngBlob } from '#lib/browser-utils.js';

	const ALGORITHMS: { id: PathName; label: string }[] = [
		{ id: 'bfs', label: 'Breadth-first search' },
		{ id: 'dfs', label: 'Depth-first search' },
		{ id: 'dijkstra', label: "Dijkstra's algorithm" },
		{ id: 'astar', label: 'A* search' },
		{ id: 'greedy', label: 'Greedy best-first' }
	];

	const HEURISTICS: { id: Heuristic; label: string }[] = [
		{ id: 'manhattan', label: 'Manhattan' },
		{ id: 'euclidean', label: 'Euclidean' },
		{ id: 'diagonal', label: 'Diagonal (Chebyshev)' }
	];

	const GUARANTEE_TEXT: Record<string, string> = {
		always: 'Always finds a cheapest path.',
		'moves-only': 'Finds the fewest moves, but not the cheapest path when cells have different costs.',
		'if-admissible': 'Finds a cheapest path only while the heuristic never overestimates.',
		never: 'Does not guarantee a shortest or cheapest path.'
	};

	let algorithm = $state<PathName>('astar');
	let heuristic = $state<Heuristic>('manhattan');
	let grid = $state<Grid>(sampleGrid());
	let tool = $state<Tool>('wall');
	let weight = $state(5);
	let verification = $state<Verification | null>(null);
	let saveName = $state('');
	let canvasEl: HTMLDivElement | null = $state(null);

	const entry = $derived(entryFor('pathfinding', algorithm)!);
	const trace = $derived(PATHFINDERS[algorithm](grid, { heuristic, budget: MAX_STEPS }));
	const admissible = $derived(isAdmissible(heuristic, grid.diagonal));
	const guarantee = $derived(GUARANTEES_SHORTEST[algorithm]);

	// The player is created once from the initial trace; $effect below reloads it whenever
	// the derived trace changes.
	// Starts on an empty placeholder trace; the $effect below loads the real one
	// immediately, which keeps the derived trace out of component initialisation.
	const player = new Player(PATHFINDERS.bfs(makeGrid(2, 2)));

	$effect(() => {
		const t = trace;
		player.load(t);
		// Local first: reading the rune we just wrote would re-trigger this effect.
		const result = verifyPath(grid, algorithm, heuristic, t);
		verification = result;
		if (!result.ok) {
			console.error('AlgoLens verification failed', { algorithm, details: result.details });
			app.toast('The path failed automatic verification. See the Explanation tab.', 'bad');
		}
	});

	$effect(() => {
		player.soundEnabled = false; // tones are a sorting feature only
	});

	onMount(() => {
		app.setMode('pathfinding');
		const hash = page.url.hash;
		if (hash && hash.length > 2) {
			const result = decodeShare(hash);
			if (result.ok && result.setup.pathfinding) {
				algorithm = result.setup.pathfinding.algorithm;
				heuristic = result.setup.pathfinding.heuristic;
				grid = decodeGrid(result.setup.pathfinding.grid);
				app.toast('Shared grid loaded from the link.', 'ok');
			} else if (!result.ok) {
				app.toast(`That shared link could not be opened. ${result.error}`, 'bad');
			}
			replaceState(page.url.pathname, {});
		}
		return () => player.destroy();
	});

	function onEdit(change: { index: number; action: Tool }) {
		const { index, action } = change;
		if (action === 'start') {
			if (!grid.walls[index] && index !== grid.end) grid = { ...grid, start: index };
			return;
		}
		if (action === 'end') {
			if (!grid.walls[index] && index !== grid.start) grid = { ...grid, end: index };
			return;
		}
		if (action === 'weight') {
			if (grid.walls[index]) return;
			const weights = [...grid.weights];
			weights[index] = weight;
			grid = { ...grid, weights };
			return;
		}
		const walls = [...grid.walls];
		walls[index] = action === 'wall';
		grid = { ...grid, walls };
	}

	function resize(cols: number, rows: number) {
		const next = makeGrid(cols, rows, grid.diagonal);
		grid = next;
	}

	function newSeed(): number {
		return Math.floor(Math.random() * 1_000_000);
	}

	function saveGrid() {
		const name = saveName.trim() || `Grid ${new Date().toLocaleString()}`;
		const record = validateSavedGrid({ ...encodeGrid(grid), id: cryptoId(), name, createdAt: Date.now() });
		if (!record) {
			app.toast('This grid could not be saved because it failed validation.', 'bad');
			return;
		}
		app.update((d) => ({ ...d, savedGrids: [record, ...d.savedGrids].slice(0, 100) }));
		saveName = '';
		app.toast(`Saved "${name}" in this browser.`, 'ok');
	}

	function loadSaved(id: string) {
		const saved = app.settings.savedGrids.find((g) => g.id === id);
		if (!saved) return;
		grid = decodeGrid(saved);
		app.toast(`Loaded "${saved.name}".`, 'ok');
	}

	function deleteSaved(id: string) {
		app.update((d) => ({ ...d, savedGrids: d.savedGrids.filter((g) => g.id !== id) }));
		app.toast('Saved grid deleted.', 'ok');
	}

	async function share() {
		const hash = encodeShare({ v: 1, mode: 'pathfinding', pathfinding: { algorithm, heuristic, grid: encodeGrid(grid) } });
		const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
		const ok = await copyText(url);
		app.toast(ok ? 'Link copied. The whole grid is compressed inside the link.' : 'Could not copy; the link is in the address bar.', ok ? 'ok' : 'bad');
		if (!ok) window.location.hash = `s=${hash}`;
	}

	async function exportPng() {
		if (!canvasEl) return;
		const blob = await elementToPngBlob(canvasEl, app.isDark ? '#1A1D24' : '#FFFFFF');
		if (!blob) {
			app.toast('This browser could not render the picture.', 'bad');
			return;
		}
		const copied = await copyBlobToClipboard(blob);
		downloadBlob(`algolens-${algorithm}-grid.png`, blob);
		app.toast(copied ? 'PNG saved and copied to the clipboard.' : 'PNG saved.', 'ok');
	}

	const LEGEND = [
		{ tag: 'start', cue: 'S', label: 'Start' },
		{ tag: 'end', cue: 'T', label: 'Target' },
		{ tag: 'wall', cue: '', label: 'Wall' },
		{ tag: 'frontier', cue: 'F', label: 'Frontier' },
		{ tag: 'visited', cue: 'V', label: 'Visited' },
		{ tag: 'current', cue: 'C', label: 'Current' },
		{ tag: 'path', cue: 'P', label: 'Final path' }
	];

	const stats = $derived([
		{ label: 'Visited cells', value: player.state.counters.visited },
		{ label: 'Path length (moves)', value: Math.max(0, (trace.result.pathCells?.length ?? 0) - 1) },
		{ label: 'Path cost', value: trace.result.cost ?? 'no path' },
		{ label: 'Edges relaxed', value: player.state.counters.edgesRelaxed }
	]);
</script>

<svelte:head>
	<title>Pathfinding - AlgoLens</title>
	<meta name="description" content="Draw walls and weights on a grid, then watch BFS, DFS, Dijkstra, A* or greedy best-first search find a route, with verified costs." />
</svelte:head>

<Workspace title="Grid pathfinding visualiser">
	{#snippet banner()}
		{#if algorithm === 'astar' && !admissible}
			<div class="notice notice-warn">
				<strong>Manhattan distance is not admissible with 8-way movement.</strong> A diagonal move costs the
				same as a straight one here, so Manhattan overestimates the remaining cost and A* may return a route
				that is not cheapest. Switch to Diagonal or Euclidean for a guaranteed cheapest path.
			</div>
		{:else if guarantee === 'never'}
			<div class="notice">
				<strong>{entry.name} does not guarantee a shortest path.</strong> {GUARANTEE_TEXT[guarantee]} The
				Explanation tab compares this route's cost with the true cheapest cost.
			</div>
		{:else if guarantee === 'moves-only'}
			<div class="notice">
				<strong>BFS optimises the number of moves, not the cost.</strong> With weighted cells its route can
				cost more than Dijkstra's.
			</div>
		{/if}
	{/snippet}

	{#snippet controls()}
		<div class="field">
			<label for="path-algo">Algorithm</label>
			<span class="select-wrap">
				<select id="path-algo" bind:value={algorithm}>
					{#each ALGORITHMS as a (a.id)}
						<option value={a.id}>{a.label}</option>
					{/each}
				</select>
			</span>
			<span class="muted">{GUARANTEE_TEXT[guarantee]}</span>
		</div>

		{#if algorithm === 'astar' || algorithm === 'greedy'}
			<div class="field">
				<label for="heur">Heuristic</label>
				<span class="select-wrap">
					<select id="heur" bind:value={heuristic}>
						{#each HEURISTICS as h (h.id)}
							<option value={h.id}>{h.label}</option>
						{/each}
					</select>
				</span>
			</div>
		{/if}

		<div class="field">
			<span class="row">
				<input
					id="diag"
					type="checkbox"
					checked={grid.diagonal}
					onchange={(e) => (grid = { ...grid, diagonal: (e.currentTarget as HTMLInputElement).checked })}
				/>
				<label for="diag">Allow 8-way movement</label>
			</span>
			<span class="muted">Diagonal moves cannot cut the corner of a wall: both shared neighbours must be open.</span>
		</div>

		<h4>Draw</h4>
		<div class="row-wrap">
			<button class="btn" class:btn-primary={tool === 'wall'} onclick={() => (tool = 'wall')}>
				<Icon name="wall" size={14} /> Wall
			</button>
			<button class="btn" class:btn-primary={tool === 'erase'} onclick={() => (tool = 'erase')}>
				<Icon name="eraser" size={14} /> Erase
			</button>
			<button class="btn" class:btn-primary={tool === 'weight'} onclick={() => (tool = 'weight')}>
				<Icon name="weight" size={14} /> Weight
			</button>
		</div>
		{#if tool === 'weight'}
			<div class="field" style="margin-top:8px">
				<label for="w">Weight to paint: <span class="num">{weight}</span></label>
				<input id="w" type="range" min="1" max="9" bind:value={weight} />
			</div>
		{/if}
		<p class="muted">Drag to draw. Hold Shift to erase. Drag the start or target cell to move it.</p>

		<h4>Size</h4>
		<div class="row-wrap">
			<button class="btn" onclick={() => resize(16, 12)}>16 x 12</button>
			<button class="btn" onclick={() => resize(24, 16)}>24 x 16</button>
			<button class="btn" onclick={() => resize(40, 24)}>40 x 24</button>
			<button class="btn" onclick={() => resize(60, 40)}>60 x 40</button>
		</div>

		<h4>Generate</h4>
		<div class="row-wrap">
			<button class="btn" onclick={() => (grid = randomWalls(grid, newSeed()))}>Random walls</button>
			<button class="btn" onclick={() => (grid = dfsMaze(grid, newSeed()))}>DFS maze</button>
			<button class="btn" onclick={() => (grid = divisionMaze(grid, newSeed()))}>Division maze</button>
			<button class="btn" onclick={() => (grid = randomWeights(grid, newSeed()))}>Random weights</button>
		</div>
		<div class="row-wrap" style="margin-top:8px">
			<button class="btn" onclick={() => (grid = clearWalls(grid))}>Clear walls</button>
			<button class="btn" onclick={() => (grid = clearWeights(grid))}>Clear weights</button>
			<button class="btn" onclick={() => (grid = makeGrid(grid.cols, grid.rows, grid.diagonal))}>Reset grid</button>
		</div>

		<h4>Save in this browser</h4>
		<div class="field">
			<label for="gname">Name</label>
			<div class="row">
				<input id="gname" type="text" bind:value={saveName} placeholder="My maze" maxlength="60" />
				<button class="btn btn-icon" onclick={saveGrid} aria-label="Save this grid" title="Save"><Icon name="save" size={15} /></button>
			</div>
		</div>
		{#if app.settings.savedGrids.length}
			<ul class="saved">
				{#each app.settings.savedGrids as saved (saved.id)}
					<li>
						<button class="link" onclick={() => loadSaved(saved.id)}>{saved.name}</button>
						<span class="muted num">{saved.cols}x{saved.rows}</span>
						<button class="btn btn-icon" onclick={() => deleteSaved(saved.id)} aria-label={`Delete ${saved.name}`}>
							<Icon name="trash" size={13} />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">No saved grids yet. Save one above and it stays in this browser.</p>
		{/if}

		<h4>Share and export</h4>
		<div class="row-wrap">
			<button class="btn" onclick={share}><Icon name="link" size={14} /> Copy link</button>
			<button class="btn" onclick={exportPng}><Icon name="image" size={14} /> PNG</button>
		</div>
	{/snippet}

	{#snippet canvas()}
		<Legend
			items={LEGEND}
			verified={verification ? { ok: verification.ok, label: verification.label } : null}
			truncated={trace.truncated === true}
		/>
		<div class="statsbar">
			{#each stats as s (s.label)}
				<span class="chip">{s.label} <strong class="num">{s.value}</strong></span>
			{/each}
		</div>
		{#if grid.start === grid.end}
			<p class="notice inline">The start and the target are the same cell, so the path is empty and costs nothing.</p>
		{:else if !trace.result.pathCells?.length}
			<p class="notice notice-warn inline" data-testid="no-path">
				No path exists between the start and the target with the current walls.
			</p>
		{/if}
		<div class="canvas-inner" bind:this={canvasEl}>
			<GridView {grid} viewState={player.state} {tool} {weight} onedit={onEdit} />
		</div>
		<p class="sr-only" role="status" aria-live="polite">{player.announcement}</p>
	{/snippet}

	{#snippet side()}
		<SidePanel
			{entry}
			line={player.line}
			explain={player.explain}
			counters={player.state.counters}
			extraStats={stats}
			{verification}
		/>
	{/snippet}

	{#snippet transport()}
		<Transport {player} onrestart={() => player.toStart()} />
	{/snippet}
</Workspace>

<style>
	.statsbar {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 12px 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--panel-2);
		font-size: 12px;
		color: var(--ink-2);
	}

	.inline {
		margin: 8px 12px 0;
	}

	.canvas-inner {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
	}

	.saved {
		list-style: none;
		margin: 0;
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
