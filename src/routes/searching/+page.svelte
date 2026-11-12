<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.js';
	import { Player } from '#lib/player.svelte.js';
	import { SEARCHERS, isSorted, type SearchName } from '#lib/algorithms/searching.js';
	import { entryFor } from '#lib/data/catalog.js';
	import { verifySearch, type Verification } from '#lib/core/verify.js';
	import { generateInput, MAX_SIZE, MIN_SIZE, parseCustomInput } from '#lib/data/presets.js';
	import { decodeShare, encodeShare } from '#lib/core/share.js';
	import Workspace from '#lib/components/Workspace.svelte';
	import ArrayView from '#lib/components/ArrayView.svelte';
	import SidePanel from '#lib/components/SidePanel.svelte';
	import Transport from '#lib/components/Transport.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyText } from '#lib/browser-utils.js';

	const ALGORITHMS: { id: SearchName; label: string; needsSorted: boolean }[] = [
		{ id: 'linear', label: 'Linear search', needsSorted: false },
		{ id: 'binary', label: 'Binary search', needsSorted: true },
		{ id: 'interpolation', label: 'Interpolation search', needsSorted: true }
	];

	let algorithm = $state<SearchName>('binary');
	let size = $state(20);
	let seed = $state(7);
	let values = $state<number[]>(sortedSample(20, 7));
	let target = $state(0);
	let custom = $state('');
	let customError = $state<string | null>(null);
	let view = $state<'bars' | 'cells'>('cells');
	let verification = $state<Verification | null>(null);

	function sortedSample(n: number, s: number): number[] {
		return [...generateInput('random', n, s)].sort((a, b) => a - b);
	}

	const entry = $derived(entryFor('searching', algorithm)!);
	const needsSorted = $derived(ALGORITHMS.find((a) => a.id === algorithm)!.needsSorted);
	const sorted = $derived(isSorted(values));
	const warnUnsorted = $derived(needsSorted && !sorted);
	const trace = $derived(SEARCHERS[algorithm](values, target));

	// The player is created once from the initial trace; $effect below reloads it whenever
	// the derived trace changes.
	// Starts on an empty placeholder trace; the $effect below loads the real one
	// immediately, which keeps the derived trace out of component initialisation.
	const player = new Player(SEARCHERS.linear([], 0));

	$effect(() => {
		const t = trace;
		player.load(t);
		// Local first: reading the rune we just wrote would re-trigger this effect.
		// A wrong answer caused by unsorted input is reported as a precondition problem,
		// not as an AlgoLens defect, and is not logged as an error.
		const result = verifySearch(values, target, t, warnUnsorted);
		verification = result;
		if (!result.ok && result.label === 'Verification failed') {
			console.error('AlgoLens verification failed', { algorithm, target, details: result.details });
			app.toast('The search result failed automatic verification. See the Explanation tab.', 'bad');
		}
	});

	$effect(() => {
		player.soundEnabled = app.settings.soundEnabled;
		player.volume = app.settings.volume;
	});

	onMount(() => {
		app.setMode('searching');
		target = values[Math.floor(values.length / 3)] ?? 0;
		const hash = page.url.hash;
		if (hash && hash.length > 2) {
			const result = decodeShare(hash);
			if (result.ok && result.setup.searching) {
				algorithm = result.setup.searching.algorithm;
				values = result.setup.searching.values;
				target = result.setup.searching.target;
				size = values.length;
				app.toast('Shared setup loaded from the link.', 'ok');
			} else if (!result.ok) {
				app.toast(`That shared link could not be opened. ${result.error}`, 'bad');
			}
			replaceState(page.url.pathname, {});
		}
		return () => player.destroy();
	});

	function regenerate() {
		values = needsSorted ? sortedSample(size, seed) : generateInput('random', size, seed);
		target = values[Math.floor(values.length / 3)] ?? 0;
		custom = '';
		customError = null;
	}

	function shuffleInput() {
		values = generateInput('random', size, seed + 1);
		seed = seed + 1;
	}

	function sortNow() {
		values = [...values].sort((a, b) => a - b);
		app.toast('The input is now sorted, so binary search can run correctly.', 'ok');
	}

	function applyCustom() {
		const parsed = parseCustomInput(custom);
		customError = parsed.error;
		if (!parsed.error) {
			values = parsed.values;
			size = parsed.values.length;
		}
	}

	function pickMissingTarget() {
		let candidate = (Math.max(...values) || 0) + 1;
		while (values.includes(candidate)) candidate++;
		target = candidate;
	}

	async function share() {
		const hash = encodeShare({ v: 1, mode: 'searching', searching: { algorithm, values, target } });
		const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
		const ok = await copyText(url);
		app.toast(ok ? 'Link copied. The input travels inside the link itself.' : 'Could not copy; the link is in the address bar.', ok ? 'ok' : 'bad');
		if (!ok) window.location.hash = `s=${hash}`;
	}

	const LEGEND = [
		{ tag: 'none', cue: '', label: 'Not checked' },
		{ tag: 'compare', cue: 'C', label: 'Checking' },
		{ tag: 'mid', cue: 'M', label: 'Middle' },
		{ tag: 'sorted', cue: 'F', label: 'Found' }
	];

	const resultText = $derived(
		trace.result.foundIndex === null
			? `${target} is not in this list.`
			: `${target} was found at position ${trace.result.foundIndex}.`
	);
</script>

<svelte:head>
	<title>Searching - AlgoLens</title>
	<meta name="description" content="Step through linear, binary and interpolation search with visible low, middle and high pointers and a shrinking search range." />
</svelte:head>

<Workspace title="Searching visualiser">
	{#snippet banner()}
		{#if warnUnsorted}
			<div class="notice notice-warn spread">
				<span>
					<strong>{entry.name} needs sorted input.</strong> This list is not sorted, so the run below will
					search the wrong half and can report a value as missing when it is present.
				</span>
				<button class="btn" onclick={sortNow}>Sort the input first</button>
			</div>
		{/if}
	{/snippet}

	{#snippet controls()}
		<div class="field">
			<label for="search-algo">Algorithm</label>
			<span class="select-wrap">
				<select id="search-algo" bind:value={algorithm}>
					{#each ALGORITHMS as a (a.id)}
						<option value={a.id}>{a.label}</option>
					{/each}
				</select>
			</span>
		</div>

		<div class="field">
			<label for="target">Target value</label>
			<div class="row">
				<input id="target" type="number" bind:value={target} step="1" />
				<button class="btn" onclick={pickMissingTarget} title="Pick a value that is not in the list">Missing</button>
			</div>
		</div>

		<div class="field">
			<label for="view-mode-s">View</label>
			<div class="row">
				<button class="btn" class:btn-primary={view === 'cells'} onclick={() => (view = 'cells')} id="view-mode-s">
					<Icon name="cells" size={14} /> Cells
				</button>
				<button class="btn" class:btn-primary={view === 'bars'} onclick={() => (view = 'bars')}>
					<Icon name="bars" size={14} /> Bars
				</button>
			</div>
		</div>

		<h4>Input</h4>
		<div class="field">
			<label for="size-s">Size: <span class="num">{size}</span></label>
			<input id="size-s" type="range" min={MIN_SIZE} max={MAX_SIZE} bind:value={size} oninput={regenerate} />
		</div>

		<div class="field">
			<label for="seed-s">Seed</label>
			<input id="seed-s" type="number" bind:value={seed} onchange={regenerate} min="0" step="1" />
		</div>

		<div class="row-wrap">
			<button class="btn" onclick={regenerate}>New sorted list</button>
			<button class="btn" onclick={shuffleInput}>Shuffle (unsorted)</button>
		</div>

		<div class="field" style="margin-top:12px">
			<label for="custom-s">Custom values</label>
			<textarea id="custom-s" bind:value={custom} placeholder="1, 3, 3, 7, 11" rows="2"></textarea>
			<button class="btn" onclick={applyCustom}>Use these values</button>
			{#if customError}<span class="err">{customError}</span>{/if}
		</div>

		<h4>Share</h4>
		<button class="btn" onclick={share}><Icon name="link" size={14} /> Copy link</button>
	{/snippet}

	{#snippet canvas()}
		<Legend
			items={LEGEND}
			verified={verification ? { ok: verification.ok, label: verification.label } : null}
			truncated={trace.truncated === true}
		/>
		<div class="pointers">
			<span class="chip">low <strong class="num">{player.state.cursors.lo ?? '-'}</strong></span>
			<span class="chip">mid <strong class="num">{player.state.cursors.mid ?? '-'}</strong></span>
			<span class="chip">high <strong class="num">{player.state.cursors.hi ?? '-'}</strong></span>
			<span class="chip wide">
				range
				<strong class="num">
					{player.state.range.lo === null ? '-' : `${player.state.range.lo} to ${player.state.range.hi}`}
				</strong>
			</span>
			<span class="chip wide" data-testid="search-result">{resultText}</span>
		</div>
		<div class="canvas-inner">
			<ArrayView viewState={player.state} {view} pointerKeys={['lo', 'mid', 'hi', 'i']} />
		</div>
		<p class="sr-only" role="status" aria-live="polite">{player.announcement}</p>
	{/snippet}

	{#snippet side()}
		<SidePanel {entry} line={player.line} explain={player.explain} counters={player.state.counters} {verification} />
	{/snippet}

	{#snippet transport()}
		<Transport {player} onrestart={() => player.toStart()} />
	{/snippet}
</Workspace>

<style>
	.pointers {
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

	.chip.wide {
		color: var(--ink);
	}

	.canvas-inner {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
	}

	.err {
		font-size: 12px;
		color: var(--danger);
	}

	h4 {
		margin: 16px 0 8px;
	}
</style>
