<script lang="ts">
	// Bars and number-cells renderer. It ONLY draws the state it is given.
	//
	// Every role carries a second cue besides colour: a letter badge on the bar/cell and a
	// distinct border style, so the view is readable without colour perception.
	import type { CellTag } from '#lib/core/types.js';
	import type { VisualState } from '#lib/core/state.js';

	interface Props {
		viewState: VisualState;
		view: 'bars' | 'cells';
		/** Pointer cursors to label, e.g. lo / mid / hi for searching. */
		pointerKeys?: string[];
	}
	const { viewState, view, pointerKeys = [] }: Props = $props();

	const values = $derived(viewState.array);
	const maxAbs = $derived(Math.max(1, ...values.map((v) => Math.abs(v))));
	const hasNegative = $derived(values.some((v) => v < 0));

	/** Letter cue per role. Shown next to the colour, never instead of it. */
	const CUE: Record<CellTag, string> = {
		none: '',
		compare: 'C',
		swap: 'S',
		write: 'W',
		pivot: 'P',
		sorted: 'F',
		range: 'R',
		found: 'T',
		lo: 'L',
		mid: 'M',
		hi: 'H'
	};

	const ROLE_TEXT: Record<CellTag, string> = {
		none: '',
		compare: 'comparing',
		swap: 'swapping',
		write: 'writing',
		pivot: 'pivot',
		sorted: 'in its final place',
		range: 'in the current range',
		found: 'target found',
		lo: 'low pointer',
		mid: 'middle pointer',
		hi: 'high pointer'
	};

	function tagOf(i: number): CellTag {
		return viewState.tags[i] ?? 'none';
	}

	function inRange(i: number): boolean {
		const { lo, hi } = viewState.range;
		return lo !== null && hi !== null && i >= lo && i <= hi;
	}

	function pointersAt(i: number): string[] {
		return pointerKeys.filter((k) => viewState.cursors[k] === i);
	}

	/** Height as a percentage of the plot area. Negatives grow downwards from the baseline. */
	function barPct(v: number): number {
		return (Math.abs(v) / maxAbs) * 100;
	}
</script>

<div class="wrap" class:cells={view === 'cells'}>
	{#if values.length === 0}
		<p class="empty">There is nothing to show yet. Choose an input on the left and press play.</p>
	{:else if view === 'bars'}
		<div class="bars" class:split={hasNegative} style={`--count:${values.length}`}>
			{#each values as v, i (i)}
				<div class="slot" class:in-range={inRange(i)}>
					<div class="half top">
						{#if v >= 0}
							<div class="bar" data-tag={tagOf(i)} style={`height:${barPct(v)}%`}>
								{#if CUE[tagOf(i)]}<span class="cue">{CUE[tagOf(i)]}</span>{/if}
							</div>
						{/if}
					</div>
					{#if hasNegative}
						<div class="half bottom">
							{#if v < 0}
								<div class="bar down" data-tag={tagOf(i)} style={`height:${barPct(v)}%`}>
									{#if CUE[tagOf(i)]}<span class="cue">{CUE[tagOf(i)]}</span>{/if}
								</div>
							{/if}
						</div>
					{/if}
					{#if values.length <= 40}
						<span class="label num">{v}</span>
					{/if}
					{#if pointersAt(i).length}
						<span class="ptr num">{pointersAt(i).join(' ')}</span>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="cellgrid">
			{#each values as v, i (i)}
				<div class="cell" data-tag={tagOf(i)} class:in-range={inRange(i)}>
					<span class="idx num">{i}</span>
					<span class="val num">{v}</span>
					{#if CUE[tagOf(i)]}<span class="cue">{CUE[tagOf(i)]}</span>{/if}
					{#if pointersAt(i).length}<span class="ptr num">{pointersAt(i).join(' ')}</span>{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Accessible text equivalent of the picture above. Browser tests read their final
     result from this table, and screen-reader users get the same information. -->
<details class="table-view">
	<summary>Text and table view of the current state</summary>
	<p class="muted" data-testid="array-text">{values.join(', ')}</p>
	<table>
		<caption class="sr-only">Current value and role of every position</caption>
		<thead>
			<tr><th scope="col">Position</th><th scope="col" class="num">Value</th><th scope="col">Role</th></tr>
		</thead>
		<tbody>
			{#each values as v, i (i)}
				<tr>
					<td class="num">{i}</td>
					<td class="num">{v}</td>
					<td>{ROLE_TEXT[tagOf(i)] || (inRange(i) ? 'in the current range' : 'untouched')}{pointersAt(i).length ? ` (${pointersAt(i).join(', ')})` : ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</details>

<style>
	.wrap {
		display: flex;
		align-items: stretch;
		min-height: 180px;
		height: 100%;
		padding: 12px 12px 0;
	}

	.empty {
		margin: auto;
		color: var(--ink-3);
		font-size: 13px;
		text-align: center;
		max-width: 320px;
	}

	.bars {
		display: grid;
		grid-template-columns: repeat(var(--count), minmax(0, 1fr));
		gap: clamp(1px, 0.4vw, 4px);
		align-items: stretch;
		width: 100%;
	}

	.slot {
		position: relative;
		display: grid;
		grid-template-rows: 1fr;
		min-width: 0;
		padding-bottom: 20px;
	}

	.bars.split .slot {
		grid-template-rows: 1fr 1fr;
	}

	.half {
		display: flex;
		min-height: 0;
	}

	.half.top {
		align-items: flex-end;
	}

	.half.bottom {
		align-items: flex-start;
		border-top: 1px dashed var(--border-strong);
	}

	.bar {
		position: relative;
		width: 100%;
		min-height: 2px;
		border-radius: 3px 3px 0 0;
		background: var(--d-blue);
		border: 1px solid transparent;
		transition: height 90ms linear, background 90ms linear;
	}

	.bar.down {
		border-radius: 0 0 3px 3px;
	}

	.slot.in-range .bar {
		box-shadow: inset 0 0 0 1px var(--panel);
	}

	.cue {
		position: absolute;
		top: 2px;
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	.bar.down .cue {
		top: auto;
		bottom: 2px;
	}

	.label {
		position: absolute;
		bottom: 4px;
		left: 0;
		right: 0;
		text-align: center;
		font-size: 10px;
		color: var(--ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ptr {
		position: absolute;
		bottom: -2px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 9px;
		font-weight: 700;
		color: var(--ink);
		text-transform: uppercase;
	}

	/* ---- role colours, each paired with the letter cue above ---- */
	[data-tag='compare'] {
		background: var(--d-orange);
		color: var(--on-orange);
	}
	[data-tag='swap'] {
		background: var(--d-vermilion);
		color: var(--on-vermilion);
	}
	[data-tag='write'] {
		background: var(--d-purple);
		color: var(--on-purple);
	}
	[data-tag='pivot'] {
		background: var(--d-yellow);
		color: var(--on-yellow);
		border-color: var(--ink-3);
	}
	[data-tag='sorted'] {
		background: var(--d-green);
		color: var(--on-green);
	}
	[data-tag='found'] {
		background: var(--d-green);
		color: var(--on-green);
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	[data-tag='mid'] {
		background: var(--d-sky);
		color: var(--on-sky);
	}
	[data-tag='none'] {
		background: var(--d-blue);
		color: var(--on-blue);
	}

	/* ---- number cells ---- */
	.cellgrid {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 6px;
		width: 100%;
		padding-bottom: 12px;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 46px;
		min-height: 46px;
		padding: 14px 6px 6px;
		border-radius: var(--r-sm);
		border: 1.5px solid var(--border-strong);
		background: var(--panel-2);
		color: var(--ink);
	}

	.cell .idx {
		position: absolute;
		top: 2px;
		left: 5px;
		font-size: 9px;
		color: var(--ink-3);
	}

	.cell .val {
		font-size: 14px;
		font-weight: 600;
	}

	.cell .cue {
		position: absolute;
		top: 2px;
		right: 5px;
		transform: none;
		font-size: 9px;
	}

	.cell .ptr {
		bottom: 1px;
	}

	.cell.in-range {
		border-style: dashed;
		border-color: var(--ink-3);
	}

	.table-view {
		margin: 12px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--panel-2);
		font-size: 12px;
	}

	.table-view summary {
		cursor: pointer;
		color: var(--ink-2);
		font-size: 12px;
	}

	.table-view table {
		margin-top: 8px;
		max-height: 220px;
		display: block;
		overflow: auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
