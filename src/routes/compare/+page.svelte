<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import { Player } from '#lib/player.svelte.js';
	import { SORTERS, type SortName } from '#lib/algorithms/sorting.js';
	import { entryFor } from '#lib/data/catalog.js';
	import { verifySorting } from '#lib/core/verify.js';
	import { generateInput, MAX_SIZE, MIN_SIZE, parseCustomInput } from '#lib/data/presets.js';
	import { PRESET_LABELS, SORT_PRESETS, type SortPreset } from '#lib/data/samples.js';
	import { decodeShare, encodeShare } from '#lib/core/share.js';
	import { MAX_STEPS } from '#lib/core/types.js';
	import ArrayView from '#lib/components/ArrayView.svelte';
	import Transport from '#lib/components/Transport.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyText } from '#lib/browser-utils.js';

	const ALGORITHMS: { id: SortName; label: string }[] = [
		{ id: 'bubble', label: 'Bubble sort' },
		{ id: 'selection', label: 'Selection sort' },
		{ id: 'insertion', label: 'Insertion sort' },
		{ id: 'merge', label: 'Merge sort' },
		{ id: 'quick', label: 'Quick sort' },
		{ id: 'heap', label: 'Heap sort' },
		{ id: 'shell', label: 'Shell sort' },
		{ id: 'counting', label: 'Counting sort' }
	];

	let left = $state<SortName>('bubble');
	let right = $state<SortName>('merge');
	let preset = $state<SortPreset>('random');
	let size = $state(20);
	let seed = $state(31);
	let values = $state<number[]>(generateInput('random', 20, 31));
	let custom = $state('');
	let customError = $state<string | null>(null);
	let race = $state(false);

	const leftTrace = $derived(SORTERS[left](values, { seed, budget: MAX_STEPS }));
	const rightTrace = $derived(SORTERS[right](values, { seed, budget: MAX_STEPS }));

	// Starts on placeholder traces; the $effect below loads the real ones immediately.
	const leftPlayer = new Player(SORTERS.bubble([]));
	const rightPlayer = new Player(SORTERS.bubble([]));

	$effect(() => {
		leftPlayer.load(leftTrace);
		rightPlayer.load(rightTrace);
	});

	// Synchronised playback: the left player drives, and unless Race mode is on the right
	// player is kept at the same step index so both show the same point in their run.
	$effect(() => {
		const i = leftPlayer.index;
		if (race) return;
		const target = Math.min(i, rightPlayer.total);
		if (rightPlayer.index !== target) rightPlayer.seek(target);
	});

	$effect(() => {
		// In race mode both players run on their own clocks, so the faster algorithm
		// visibly finishes first.
		if (race && leftPlayer.playing && !rightPlayer.playing && !rightPlayer.atEnd) rightPlayer.play();
		if (race && !leftPlayer.playing && rightPlayer.playing) rightPlayer.pause();
	});

	$effect(() => {
		rightPlayer.setSpeed(leftPlayer.speed);
	});

	onMount(() => {
		app.setMode('compare');
		const hash = page.url.hash;
		if (hash && hash.length > 2) {
			const result = decodeShare(hash);
			if (result.ok && result.setup.compare) {
				left = result.setup.compare.left;
				right = result.setup.compare.right;
				values = result.setup.compare.values;
				size = values.length;
				app.toast('Shared comparison loaded from the link.', 'ok');
			} else if (!result.ok) {
				app.toast(`That shared link could not be opened. ${result.error}`, 'bad');
			}
			replaceState(page.url.pathname, {});
		}
		return () => {
			leftPlayer.destroy();
			rightPlayer.destroy();
		};
	});

	function regenerate() {
		values = generateInput(preset, size, seed);
		custom = '';
		customError = null;
	}

	function applyCustom() {
		const parsed = parseCustomInput(custom);
		customError = parsed.error;
		if (!parsed.error) {
			values = parsed.values;
			size = parsed.values.length;
		}
	}

	function totals(trace: typeof leftTrace) {
		let comparisons = 0;
		let swaps = 0;
		let writes = 0;
		let accesses = 0;
		for (const s of trace.steps) {
			comparisons += s.counters?.comparisons ?? 0;
			swaps += s.counters?.swaps ?? 0;
			writes += s.counters?.writes ?? 0;
			accesses += s.counters?.accesses ?? 0;
		}
		return { comparisons, swaps, writes, accesses, steps: trace.steps.length };
	}

	const leftTotals = $derived(totals(leftTrace));
	const rightTotals = $derived(totals(rightTrace));
	const leftVerified = $derived(verifySorting(values, leftTrace));
	const rightVerified = $derived(verifySorting(values, rightTrace));

	function winner(a: number, b: number): 'left' | 'right' | 'tie' {
		if (a < b) return 'left';
		if (b < a) return 'right';
		return 'tie';
	}

	async function share() {
		const hash = encodeShare({ v: 1, mode: 'compare', compare: { left, right, values } });
		const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
		const ok = await copyText(url);
		app.toast(ok ? 'Link copied. The input travels inside the link.' : 'Could not copy; the link is in the address bar.', ok ? 'ok' : 'bad');
		if (!ok) window.location.hash = `s=${hash}`;
	}

	function restart() {
		leftPlayer.toStart();
		rightPlayer.toStart();
	}

	const ROWS = $derived([
		{ label: 'Comparisons', a: leftTotals.comparisons, b: rightTotals.comparisons },
		{ label: 'Swaps', a: leftTotals.swaps, b: rightTotals.swaps },
		{ label: 'Writes', a: leftTotals.writes, b: rightTotals.writes },
		{ label: 'Array accesses', a: leftTotals.accesses, b: rightTotals.accesses },
		{ label: 'Recorded steps', a: leftTotals.steps, b: rightTotals.steps }
	]);
</script>

<svelte:head>
	<title>Compare - AlgoLens</title>
	<meta name="description" content="Run two sorting algorithms side by side on identical input with synchronised playback, a race mode and a results table." />
</svelte:head>

<div class="page">
	<h1 class="sr-only">Compare two sorting algorithms</h1>

	<div class="bar panel">
		<div class="field inline">
			<label for="cmp-left">Left</label>
			<span class="select-wrap">
				<select id="cmp-left" bind:value={left}>
					{#each ALGORITHMS as a (a.id)}<option value={a.id}>{a.label}</option>{/each}
				</select>
			</span>
		</div>
		<div class="field inline">
			<label for="cmp-right">Right</label>
			<span class="select-wrap">
				<select id="cmp-right" bind:value={right}>
					{#each ALGORITHMS as a (a.id)}<option value={a.id}>{a.label}</option>{/each}
				</select>
			</span>
		</div>
		<div class="field inline">
			<label for="cmp-preset">Input</label>
			<span class="select-wrap">
				<select id="cmp-preset" bind:value={preset} onchange={regenerate}>
					{#each SORT_PRESETS as p (p)}<option value={p}>{PRESET_LABELS[p]}</option>{/each}
				</select>
			</span>
		</div>
		<div class="field inline">
			<label for="cmp-size">Size <span class="num">{size}</span></label>
			<input id="cmp-size" type="range" min={MIN_SIZE} max={MAX_SIZE} bind:value={size} oninput={regenerate} />
		</div>
		<div class="field inline">
			<label for="cmp-seed">Seed</label>
			<input id="cmp-seed" type="number" bind:value={seed} onchange={regenerate} min="0" step="1" />
		</div>
		<div class="right">
			<span class="row">
				<input id="race" type="checkbox" bind:checked={race} onchange={restart} />
				<label for="race">Race mode</label>
			</span>
			<button class="btn" onclick={share}><Icon name="link" size={14} /> Copy link</button>
		</div>
	</div>

	<div class="custom panel">
		<label for="cmp-custom">Custom values</label>
		<div class="row">
			<input id="cmp-custom" type="text" bind:value={custom} placeholder="5, 3, 9, 1, 9" />
			<button class="btn" onclick={applyCustom}>Use these values</button>
		</div>
		{#if customError}<span class="err">{customError}</span>{/if}
		<p class="muted">
			{#if race}
				Race mode runs both algorithms on their own clock, so the one that needs fewer steps finishes first.
			{:else}
				Synchronised playback keeps both runs on the same step number, so you can compare what each has
				achieved after the same amount of work.
			{/if}
		</p>
	</div>

	<div class="pair">
		{#each [{ name: left, player: leftPlayer, trace: leftTrace, verified: leftVerified, totals: leftTotals }, { name: right, player: rightPlayer, trace: rightTrace, verified: rightVerified, totals: rightTotals }] as side (side.name + (side.player === leftPlayer ? 'L' : 'R'))}
			<section class="side panel">
				<header>
					<h2>{entryFor('sorting', side.name)!.name}</h2>
					<span class="badge" class:badge-ok={side.verified.ok} class:badge-bad={!side.verified.ok}>{side.verified.label}</span>
				</header>
				<div class="meta">
					<span class="chip">step <strong class="num">{side.player.index}/{side.player.total}</strong></span>
					<span class="chip">comparisons <strong class="num">{side.player.state.counters.comparisons}</strong></span>
					<span class="chip">swaps <strong class="num">{side.player.state.counters.swaps}</strong></span>
					<span class="chip">writes <strong class="num">{side.player.state.counters.writes}</strong></span>
					{#if side.player.atEnd}<span class="badge badge-ok">Finished</span>{/if}
				</div>
				<div class="view">
					<ArrayView viewState={side.player.state} view="bars" pointerKeys={['min', 'key', 'i', 'j', 'gap', 'pivot']} />
				</div>
				<p class="line">{side.player.explain}</p>
			</section>
		{/each}
	</div>

	<section class="results panel">
		<h2>Results on this input</h2>
		<table>
			<caption class="sr-only">Operation counts for the complete run of each algorithm</caption>
			<thead>
				<tr>
					<th scope="col">Measure</th>
					<th scope="col" class="num">{entryFor('sorting', left)!.name}</th>
					<th scope="col" class="num">{entryFor('sorting', right)!.name}</th>
					<th scope="col">Fewer</th>
				</tr>
			</thead>
			<tbody>
				{#each ROWS as row (row.label)}
					<tr>
						<th scope="row">{row.label}</th>
						<td class="num">{row.a.toLocaleString()}</td>
						<td class="num">{row.b.toLocaleString()}</td>
						<td>
							{#if winner(row.a, row.b) === 'tie'}
								Equal
							{:else}
								{winner(row.a, row.b) === 'left' ? entryFor('sorting', left)!.name : entryFor('sorting', right)!.name}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="muted">
			These are counts from the complete recorded run on the identical input above, not timings.
			Operation counts are reproducible; wall-clock time on one machine is not.
		</p>
	</section>

	<Transport player={leftPlayer} onrestart={restart} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		min-height: calc(100dvh - var(--topbar-h));
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
		padding: 12px;
	}

	.field.inline {
		margin: 0;
		min-width: 130px;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
	}

	.custom {
		padding: 12px;
	}

	.custom .row {
		margin-top: 4px;
		max-width: 520px;
	}

	.custom p {
		margin-top: 8px;
		margin-bottom: 0;
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		flex: 1 1 auto;
		min-height: 0;
	}

	.side {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 300px;
		overflow: hidden;
	}

	.side header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
	}

	.side h2 {
		font-size: 15px;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		padding: 8px 12px 0;
	}

	.chip {
		display: inline-flex;
		gap: 5px;
		padding: 2px 7px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--panel-2);
		font-size: 11.5px;
		color: var(--ink-3);
	}

	.chip strong {
		color: var(--ink);
	}

	.view {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: auto;
	}

	.line {
		margin: 0;
		padding: 8px 12px 12px;
		font-size: 12.5px;
		color: var(--ink-2);
		border-top: 1px solid var(--border);
		min-height: 48px;
	}

	.results {
		padding: 12px;
	}

	.results h2 {
		font-size: 15px;
		margin-bottom: 8px;
	}

	.results p {
		margin-top: 10px;
	}

	.err {
		font-size: 12px;
		color: var(--danger);
	}

	@media (max-width: 900px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
		.right {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
