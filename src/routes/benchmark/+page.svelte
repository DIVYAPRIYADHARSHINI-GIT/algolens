<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.js';
	import { referenceCurve, type BenchMessage, type BenchRequest, type BenchSeries } from '#lib/benchmark.js';
	import Icon from '#lib/components/Icon.svelte';

	const ALGORITHMS = [
		{ id: 'bubble', label: 'Bubble' },
		{ id: 'selection', label: 'Selection' },
		{ id: 'insertion', label: 'Insertion' },
		{ id: 'merge', label: 'Merge' },
		{ id: 'quick', label: 'Quick' },
		{ id: 'heap', label: 'Heap' },
		{ id: 'shell', label: 'Shell' },
		{ id: 'counting', label: 'Counting' }
	];

	const SERIES_COLOURS = ['--d-blue', '--d-orange', '--d-green', '--d-purple', '--d-vermilion', '--d-sky', '--d-yellow', '--ink-2'];
	/** Dash patterns give each series a second cue besides its colour. */
	const SERIES_DASH = ['0', '6 3', '2 3', '9 3 2 3', '4 2', '12 4', '1 4', '7 2 1 2'];

	const SIZE_SETS: Record<string, number[]> = {
		small: [10, 25, 50, 100, 200, 400],
		medium: [10, 50, 100, 250, 500, 1000],
		large: [100, 250, 500, 1000, 2500, 5000]
	};

	let selected = $state<string[]>(['bubble', 'insertion', 'merge', 'quick']);
	let sizeSet = $state<keyof typeof SIZE_SETS>('medium');
	let preset = $state<BenchRequest['preset']>('random');
	let metric = $state<'comparisons' | 'writes'>('comparisons');
	let scale = $state<'linear' | 'log'>('linear');
	let showReference = $state(true);
	let running = $state(false);
	let progress = $state(0);
	let total = $state(0);
	let series = $state<BenchSeries[]>([]);
	let errorText = $state<string | null>(null);

	let worker: Worker | null = null;

	onMount(() => {
		app.setMode('benchmark');
		return () => {
			// Always terminate the worker so nothing leaks when leaving the page.
			worker?.terminate();
			worker = null;
		};
	});

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function run() {
		if (running) return;
		if (!selected.length) {
			app.toast('Choose at least one algorithm first.', 'bad');
			return;
		}
		errorText = null;
		series = [];
		progress = 0;
		running = true;
		worker?.terminate();
		worker = new Worker(new URL('../../lib/benchmark.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event: MessageEvent<BenchMessage>) => {
			const message = event.data;
			if (message.type === 'progress') {
				progress = message.done;
				total = message.total;
			} else if (message.type === 'result') {
				series = message.series;
				running = false;
				worker?.terminate();
				worker = null;
			} else {
				errorText = message.message;
				running = false;
				worker?.terminate();
				worker = null;
			}
		};
		worker.onerror = () => {
			errorText = 'The benchmark worker stopped unexpectedly.';
			running = false;
			worker?.terminate();
			worker = null;
		};
		// `selected` is a Svelte state proxy, and structured clone cannot copy a proxy, so
		// the request is flattened into plain values before it crosses to the worker.
		worker.postMessage({
			algorithms: [...selected],
			sizes: [...SIZE_SETS[sizeSet]],
			seed: 12345,
			preset
		} satisfies BenchRequest);
	}

	function cancel() {
		worker?.terminate();
		worker = null;
		running = false;
		app.toast('Benchmark cancelled.', 'info');
	}

	const sizes = $derived(SIZE_SETS[sizeSet]);
	const maxValue = $derived(
		Math.max(1, ...series.flatMap((s) => s.points.map((p) => (metric === 'comparisons' ? p.comparisons : p.writes))))
	);

	const curves = $derived(
		showReference && series.length
			? [
					{ id: 'n', label: 'n', points: referenceCurve('n', sizes, maxValue * 0.25) },
					{ id: 'nlogn', label: 'n log n', points: referenceCurve('nlogn', sizes, maxValue * 0.55) },
					{ id: 'n2', label: 'n squared', points: referenceCurve('n2', sizes, maxValue) }
				]
			: []
	);

	const W = 760;
	const H = 320;
	const PAD = { l: 62, r: 16, t: 12, b: 38 };

	function sx(n: number): number {
		const lo = sizes[0];
		const hi = sizes[sizes.length - 1];
		const t = hi === lo ? 0 : (n - lo) / (hi - lo);
		return PAD.l + t * (W - PAD.l - PAD.r);
	}

	function sy(v: number): number {
		const inner = H - PAD.t - PAD.b;
		if (scale === 'log') {
			const safe = Math.max(1, v);
			const top = Math.max(10, maxValue);
			const t = Math.log10(safe) / Math.log10(top);
			return PAD.t + inner - t * inner;
		}
		return PAD.t + inner - (v / maxValue) * inner;
	}

	function pathFor(points: { n: number; comparisons: number; writes: number }[]): string {
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.n).toFixed(1)} ${sy(metric === 'comparisons' ? p.comparisons : p.writes).toFixed(1)}`)
			.join(' ');
	}

	function fmt(v: number): string {
		if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
		if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
		return String(Math.round(v));
	}

	const yTicks = $derived(
		scale === 'log'
			? [1, 10, 100, 1000, 10_000, 100_000, 1_000_000, 10_000_000].filter((v) => v <= Math.max(10, maxValue))
			: [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue)
	);
</script>

<svelte:head>
	<title>Benchmark - AlgoLens</title>
	<meta name="description" content="Count sorting operations on growing inputs in a Web Worker and chart them on linear or log scales against n, n log n and n squared." />
</svelte:head>

<div class="page">
	<header class="head">
		<div>
			<h1>Benchmark</h1>
			<p class="muted">
				Operation counts on growing inputs, measured in a Web Worker so the page never freezes. These are
				counts, not timings: wall-clock time varies between machines and runs, while comparison counts are
				exactly reproducible.
			</p>
		</div>
	</header>

	<div class="bar panel">
		<fieldset>
			<legend>Algorithms</legend>
			<div class="row-wrap">
				{#each ALGORITHMS as a (a.id)}
					<label class="pill">
						<input type="checkbox" checked={selected.includes(a.id)} onchange={() => toggle(a.id)} />
						<span>{a.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="opts">
			<div class="field inline">
				<label for="b-sizes">Sizes</label>
				<span class="select-wrap">
					<select id="b-sizes" bind:value={sizeSet}>
						<option value="small">10 to 400</option>
						<option value="medium">10 to 1,000</option>
						<option value="large">100 to 5,000</option>
					</select>
				</span>
			</div>
			<div class="field inline">
				<label for="b-preset">Input</label>
				<span class="select-wrap">
					<select id="b-preset" bind:value={preset}>
						<option value="random">Random</option>
						<option value="sorted">Already sorted</option>
						<option value="reversed">Reversed</option>
						<option value="few-unique">Few unique values</option>
					</select>
				</span>
			</div>
			<div class="field inline">
				<label for="b-metric">Measure</label>
				<span class="select-wrap">
					<select id="b-metric" bind:value={metric}>
						<option value="comparisons">Comparisons</option>
						<option value="writes">Writes</option>
					</select>
				</span>
			</div>
			<div class="field inline">
				<label for="b-scale">Scale</label>
				<span class="select-wrap">
					<select id="b-scale" bind:value={scale}>
						<option value="linear">Linear</option>
						<option value="log">Logarithmic</option>
					</select>
				</span>
			</div>
			<span class="row">
				<input id="b-ref" type="checkbox" bind:checked={showReference} />
				<label for="b-ref">Reference curves</label>
			</span>
			{#if running}
				<button class="btn btn-danger" onclick={cancel}>Cancel</button>
			{:else}
				<button class="btn btn-primary" onclick={run} data-testid="run-benchmark">
					<Icon name="chart" size={14} /> Run benchmark
				</button>
			{/if}
		</div>
	</div>

	{#if running}
		<div class="panel progress">
			<p>Running in a Web Worker: {progress} of {total} measurements.</p>
			<div class="track"><div class="fill" style={`width:${total ? (progress / total) * 100 : 0}%`}></div></div>
			<div class="skeleton chartskel"></div>
		</div>
	{:else if errorText}
		<p class="notice notice-bad">{errorText}</p>
	{:else if !series.length}
		<div class="panel empty">
			<Icon name="chart" size={24} />
			<h2>No measurements yet</h2>
			<p class="muted">Choose the algorithms and sizes above, then select Run benchmark. Nothing runs until you ask for it.</p>
		</div>
	{:else}
		<div class="panel chartwrap">
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric} against input size on a ${scale} scale`}>
				<line class="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
				<line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
				{#each yTicks as tick (tick)}
					<line class="gridline" x1={PAD.l} y1={sy(tick)} x2={W - PAD.r} y2={sy(tick)} />
					<text class="tick" x={PAD.l - 6} y={sy(tick) + 3} text-anchor="end">{fmt(tick)}</text>
				{/each}
				{#each sizes as n (n)}
					<text class="tick" x={sx(n)} y={H - PAD.b + 16} text-anchor="middle">{n}</text>
				{/each}
				<text class="axlabel" x={PAD.l} y={H - 6}>input size n</text>

				{#each curves as curve (curve.id)}
					<path class="refcurve" d={pathFor(curve.points)} />
					<text
						class="reflabel"
						x={W - PAD.r - 4}
						y={sy(curve.points[curve.points.length - 1].comparisons) - 4}
						text-anchor="end">{curve.label}</text
					>
				{/each}

				{#each series as s, i (s.algorithm)}
					<path
						class="series"
						d={pathFor(s.points)}
						style={`stroke:var(${SERIES_COLOURS[i % SERIES_COLOURS.length]})`}
						stroke-dasharray={SERIES_DASH[i % SERIES_DASH.length]}
					/>
					{#each s.points as p (p.n)}
						<circle
							cx={sx(p.n)}
							cy={sy(metric === 'comparisons' ? p.comparisons : p.writes)}
							r="3"
							style={`fill:var(${SERIES_COLOURS[i % SERIES_COLOURS.length]})`}
						/>
					{/each}
				{/each}
			</svg>

			<ul class="legend">
				{#each series as s, i (s.algorithm)}
					<li>
						<svg width="22" height="10" aria-hidden="true">
							<line
								x1="1"
								y1="5"
								x2="21"
								y2="5"
								style={`stroke:var(${SERIES_COLOURS[i % SERIES_COLOURS.length]})`}
								stroke-width="2.5"
								stroke-dasharray={SERIES_DASH[i % SERIES_DASH.length]}
							/>
						</svg>
						<span>{ALGORITHMS.find((a) => a.id === s.algorithm)?.label ?? s.algorithm}</span>
					</li>
				{/each}
				{#if curves.length}
					<li><svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" class="refcurve" /></svg><span>reference shapes (scaled)</span></li>
				{/if}
			</ul>
		</div>

		<div class="panel tablewrap">
			<h2>Measurements</h2>
			<table data-testid="bench-table">
				<caption class="sr-only">{metric} for each algorithm at each input size</caption>
				<thead>
					<tr>
						<th scope="col">Algorithm</th>
						{#each sizes as n (n)}<th scope="col" class="num">n = {n}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each series as s (s.algorithm)}
						<tr>
							<th scope="row">{ALGORITHMS.find((a) => a.id === s.algorithm)?.label ?? s.algorithm}</th>
							{#each s.points as p (p.n)}
								<td class="num">{(metric === 'comparisons' ? p.comparisons : p.writes).toLocaleString()}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="muted">
				The reference curves are the shapes of n, n log n and n squared scaled to fit this chart. They show
				the growth rate to compare against, not an absolute prediction.
			</p>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		max-width: 1180px;
		margin: 0 auto;
		width: 100%;
	}

	.head h1 {
		font-size: 20px;
		margin-bottom: 4px;
	}

	.head p {
		max-width: 680px;
		margin: 0;
	}

	.bar {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
	}

	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}

	legend {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-3);
		font-weight: 600;
		margin-bottom: 6px;
		padding: 0;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--panel);
		font-size: 13px;
		color: var(--ink);
		cursor: pointer;
		min-height: 32px;
	}

	.opts {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}

	.field.inline {
		margin: 0;
		min-width: 130px;
	}

	.progress {
		padding: 16px;
	}

	.track {
		height: 6px;
		border-radius: 3px;
		background: var(--panel-2);
		overflow: hidden;
		margin: 8px 0 14px;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 160ms linear;
	}

	.chartskel {
		height: 240px;
	}

	.empty {
		display: grid;
		place-items: center;
		gap: 6px;
		padding: 48px 20px;
		text-align: center;
		color: var(--ink-3);
	}

	.empty h2 {
		font-size: 15px;
		color: var(--ink);
	}

	.empty p {
		max-width: 420px;
	}

	.chartwrap {
		padding: 12px;
	}

	svg {
		width: 100%;
		height: auto;
	}

	.axis {
		stroke: var(--border-strong);
		stroke-width: 1;
	}

	.gridline {
		stroke: var(--border);
		stroke-width: 1;
	}

	.tick,
	.axlabel {
		fill: var(--ink-3);
		font-family: var(--mono);
		font-size: 10px;
	}

	.series {
		fill: none;
		stroke-width: 2.4;
		stroke-linejoin: round;
	}

	.refcurve {
		fill: none;
		stroke: var(--ink-3);
		stroke-width: 1;
		stroke-dasharray: 3 4;
		opacity: 0.8;
	}

	.reflabel {
		fill: var(--ink-3);
		font-family: var(--mono);
		font-size: 10px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--ink-2);
	}

	.tablewrap {
		padding: 12px;
		overflow-x: auto;
	}

	.tablewrap h2 {
		font-size: 15px;
		margin-bottom: 8px;
	}

	.tablewrap p {
		margin-top: 10px;
	}
</style>
