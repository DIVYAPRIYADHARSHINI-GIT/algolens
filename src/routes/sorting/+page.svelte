<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import { Player } from '#lib/player.svelte.js';
	import { SORTERS, type PivotRule, type SortName } from '#lib/algorithms/sorting.js';
	import { entryFor } from '#lib/data/catalog.js';
	import { verifySorting, type Verification } from '#lib/core/verify.js';
	import { estimateSteps, generateInput, MAX_SIZE, MIN_SIZE, parseCustomInput } from '#lib/data/presets.js';
	import { PRESET_LABELS, SORT_PRESETS, sampleArray, type SortPreset } from '#lib/data/samples.js';
	import { decodeShare, encodeShare } from '#lib/core/share.js';
	import { MAX_STEPS } from '#lib/core/types.js';
	import Workspace from '#lib/components/Workspace.svelte';
	import ArrayView from '#lib/components/ArrayView.svelte';
	import SidePanel from '#lib/components/SidePanel.svelte';
	import Transport from '#lib/components/Transport.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyBlobToClipboard, copyText, downloadBlob, elementToPngBlob } from '#lib/browser-utils.js';

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

	const PIVOTS: { id: PivotRule; label: string }[] = [
		{ id: 'first', label: 'First element' },
		{ id: 'last', label: 'Last element' },
		{ id: 'median3', label: 'Median of three' },
		{ id: 'random', label: 'Seeded random' }
	];

	let algorithm = $state<SortName>('bubble');
	let preset = $state<SortPreset>('random');
	let size = $state(15);
	let seed = $state(20240617);
	let pivot = $state<PivotRule>('last');
	let view = $state<'bars' | 'cells'>('bars');
	let custom = $state('');
	let customError = $state<string | null>(null);
	let values = $state<number[]>(sampleArray());
	let verification = $state<Verification | null>(null);
	let shareNote = $state(false);
	let canvasEl: HTMLDivElement | null = $state(null);

	const entry = $derived(entryFor('sorting', algorithm)!);
	const trace = $derived(SORTERS[algorithm](values, { pivot, seed, budget: MAX_STEPS }));
	const estimate = $derived(estimateSteps(algorithm, values.length));
	const tooBig = $derived(estimate > MAX_STEPS);

	// The player is created once from the initial trace; $effect below reloads it whenever
	// the derived trace changes.
	// Starts on an empty placeholder trace; the $effect below loads the real one
	// immediately, which keeps the derived trace out of component initialisation.
	const player = new Player(SORTERS.bubble([]));

	// Reload the player whenever the recorded trace changes, and re-verify the result.
	$effect(() => {
		const t = trace;
		player.load(t);
		// Assign to a LOCAL first: reading the `verification` rune inside the same effect
		// that writes it would make the effect depend on its own write and loop forever.
		const result = verifySorting(values, t);
		verification = result;
		if (!result.ok) {
			// A verification failure is a real defect: surface it loudly, never hide it.
			console.error('AlgoLens verification failed', { algorithm, values, details: result.details });
			app.toast('The result failed automatic verification. Details are on the Explanation tab.', 'bad');
		}
	});

	$effect(() => {
		player.soundEnabled = app.settings.soundEnabled;
		player.volume = app.settings.volume;
	});

	onMount(() => {
		app.setMode('sorting');
		// Restore a shared setup if the link carries one.
		const hash = page.url.hash;
		if (hash && hash.length > 2) {
			const result = decodeShare(hash);
			if (result.ok && result.setup.sorting) {
				const s = result.setup.sorting;
				algorithm = s.algorithm;
				values = s.values;
				pivot = s.pivot;
				seed = s.seed;
				view = s.view;
				size = s.values.length;
				app.toast('Shared setup loaded from the link.', 'ok');
			} else if (!result.ok) {
				app.toast(`That shared link could not be opened. ${result.error}`, 'bad');
			}
			replaceState(page.url.pathname, {});
		}
		// Start in step-by-step mode when reduced motion is requested.
		if (!app.reducedMotion) player.setSpeed(1);
		return () => player.destroy();
	});

	function regenerate() {
		values = generateInput(preset, size, seed);
		custom = '';
		customError = null;
	}

	function newSeed() {
		seed = Math.floor(Math.random() * 1_000_000);
		regenerate();
	}

	function applyCustom() {
		const parsed = parseCustomInput(custom);
		customError = parsed.error;
		if (!parsed.error) {
			values = parsed.values;
			size = parsed.values.length;
		}
	}

	async function share() {
		const hash = encodeShare({
			v: 1,
			mode: 'sorting',
			sorting: { algorithm, values, pivot, seed, view }
		});
		const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
		const ok = await copyText(url);
		shareNote = true;
		app.toast(ok ? 'Link copied. The whole setup travels inside the link itself.' : 'Could not copy automatically; the link is in the address bar.', ok ? 'ok' : 'bad');
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
		downloadBlob(`algolens-${algorithm}-sort.png`, blob);
		app.toast(copied ? 'PNG saved and copied to the clipboard.' : 'PNG saved. This browser does not support copying images.', 'ok');
	}

	const LEGEND = [
		{ tag: 'none', cue: '', label: 'Untouched' },
		{ tag: 'compare', cue: 'C', label: 'Comparing' },
		{ tag: 'swap', cue: 'S', label: 'Swapping' },
		{ tag: 'write', cue: 'W', label: 'Writing' },
		{ tag: 'pivot', cue: 'P', label: 'Pivot' },
		{ tag: 'sorted', cue: 'F', label: 'Final place' }
	];
</script>

<svelte:head>
	<title>Sorting - AlgoLens</title>
	<meta name="description" content="Watch bubble, selection, insertion, merge, quick, heap and shell sort run step by step with pseudocode, counters and verified results." />
</svelte:head>

<Workspace title="Sorting visualiser">
	{#snippet controls()}
		<div class="field">
			<label for="sort-algo">Algorithm</label>
			<span class="select-wrap">
				<select id="sort-algo" bind:value={algorithm}>
					{#each ALGORITHMS as a (a.id)}
						<option value={a.id}>{a.label}</option>
					{/each}
				</select>
			</span>
		</div>

		{#if algorithm === 'quick'}
			<div class="field">
				<label for="pivot-rule">Pivot rule</label>
				<span class="select-wrap">
					<select id="pivot-rule" bind:value={pivot}>
						{#each PIVOTS as p (p.id)}
							<option value={p.id}>{p.label}</option>
						{/each}
					</select>
				</span>
			</div>
		{/if}

		<div class="field">
			<label for="view-mode">View</label>
			<div class="row">
				<button class="btn" class:btn-primary={view === 'bars'} onclick={() => (view = 'bars')} id="view-mode">
					<Icon name="bars" size={14} /> Bars
				</button>
				<button class="btn" class:btn-primary={view === 'cells'} onclick={() => (view = 'cells')}>
					<Icon name="cells" size={14} /> Cells
				</button>
			</div>
		</div>

		<h4>Input</h4>
		<div class="field">
			<label for="preset">Preset</label>
			<span class="select-wrap">
				<select id="preset" bind:value={preset} onchange={regenerate}>
					{#each SORT_PRESETS as p (p)}
						<option value={p}>{PRESET_LABELS[p]}</option>
					{/each}
				</select>
			</span>
		</div>

		<div class="field">
			<label for="size">Size: <span class="num">{size}</span></label>
			<input
				id="size"
				type="range"
				min={MIN_SIZE}
				max={MAX_SIZE}
				bind:value={size}
				oninput={regenerate}
			/>
		</div>

		<div class="field">
			<label for="seed">Seed</label>
			<div class="row">
				<input id="seed" type="number" bind:value={seed} onchange={regenerate} min="0" step="1" />
				<button class="btn btn-icon" onclick={newSeed} aria-label="Use a new random seed" title="New seed">
					<Icon name="shuffle" size={15} />
				</button>
			</div>
			<span class="muted">The same seed always rebuilds the same input.</span>
		</div>

		<div class="field">
			<label for="custom">Custom values</label>
			<textarea id="custom" bind:value={custom} placeholder="5, -2, 9, 9, 0" rows="2"></textarea>
			<button class="btn" onclick={applyCustom}>Use these values</button>
			{#if customError}
				<span class="err">{customError}</span>
			{/if}
		</div>

		<h4>Share and export</h4>
		<div class="row-wrap">
			<button class="btn" onclick={share}><Icon name="link" size={14} /> Copy link</button>
			<button class="btn" onclick={exportPng}><Icon name="image" size={14} /> PNG</button>
		</div>
		{#if shareNote}
			<p class="muted">The setup is stored inside the link, not on a server. Anyone with the link can see the input.</p>
		{/if}
	{/snippet}

	{#snippet canvas()}
		<Legend
			items={LEGEND}
			verified={verification ? { ok: verification.ok, label: verification.label } : null}
			truncated={trace.truncated === true}
		/>
		{#if tooBig}
			<p class="notice notice-warn inline">
				An input of {values.length} items with {entry.name.toLowerCase()} records roughly {estimate.toLocaleString()} steps,
				which is above the {MAX_STEPS.toLocaleString()} step limit. The animation will stop early, but the result and the
				counters below are still from the complete run.
			</p>
		{/if}
		<div class="canvas-inner" bind:this={canvasEl}>
			<ArrayView viewState={player.state} {view} pointerKeys={['min', 'key', 'i', 'j', 'gap', 'pivot']} />
		</div>
		<p class="sr-only" role="status" aria-live="polite">{player.announcement}</p>
	{/snippet}

	{#snippet side()}
		<SidePanel
			{entry}
			line={player.line}
			explain={player.explain}
			counters={player.state.counters}
			stack={player.state.stack}
			{verification}
		/>
	{/snippet}

	{#snippet transport()}
		<Transport {player} onrestart={() => player.toStart()} />
	{/snippet}
</Workspace>

<style>
	.err {
		font-size: 12px;
		color: var(--danger);
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

	h4 {
		margin: 16px 0 8px;
	}
</style>
