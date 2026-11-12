<script lang="ts">
	// Grid renderer + editor. Draws ONLY the state it is given, and reports edits upward.
	// Pointer events cover mouse, pen and touch with one code path.
	import type { NodeTag } from '#lib/core/types.js';
	import type { VisualState } from '#lib/core/state.js';
	import type { Grid } from '#lib/algorithms/grid.js';

	export type Tool = 'wall' | 'erase' | 'weight' | 'start' | 'end';

	interface Props {
		grid: Grid;
		viewState: VisualState;
		tool: Tool;
		weight: number;
		onedit: (change: { index: number; action: Tool }) => void;
		disabled?: boolean;
	}
	const { grid, viewState, tool, weight, onedit, disabled = false }: Props = $props();

	let drawing = $state(false);
	/** When a drag starts on the start/end cell, that marker is being moved instead. */
	let dragging = $state<'start' | 'end' | null>(null);
	let hovered = $state<number | null>(null);

	const CUE: Record<NodeTag, string> = {
		none: '',
		wall: '',
		start: 'S',
		end: 'T',
		frontier: 'F',
		visited: 'V',
		current: 'C',
		path: 'P',
		tree: 'T'
	};

	const ROLE_TEXT: Record<NodeTag, string> = {
		none: 'unvisited',
		wall: 'wall',
		start: 'start',
		end: 'target',
		frontier: 'in the frontier',
		visited: 'visited',
		current: 'current',
		path: 'on the final path',
		tree: 'in the tree'
	};

	function tagOf(i: number): NodeTag {
		if (viewState.pathCells.includes(i) && i !== grid.start && i !== grid.end) return 'path';
		return viewState.cells[i] ?? (grid.walls[i] ? 'wall' : 'none');
	}

	function cellFromEvent(event: PointerEvent): number | null {
		const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
		const raw = el?.closest('[data-cell]')?.getAttribute('data-cell');
		return raw === null || raw === undefined ? null : Number(raw);
	}

	function begin(event: PointerEvent, index: number) {
		if (disabled) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
		if (index === grid.start) {
			dragging = 'start';
			return;
		}
		if (index === grid.end) {
			dragging = 'end';
			return;
		}
		drawing = true;
		apply(index, event.shiftKey ? 'erase' : tool);
	}

	function move(event: PointerEvent) {
		if (disabled) return;
		const index = cellFromEvent(event);
		if (index === null) return;
		hovered = index;
		if (dragging) {
			if (index !== grid.start && index !== grid.end) onedit({ index, action: dragging });
			return;
		}
		if (!drawing) return;
		apply(index, event.shiftKey ? 'erase' : tool);
	}

	function end() {
		drawing = false;
		dragging = null;
	}

	function apply(index: number, action: Tool) {
		if (index === grid.start || index === grid.end) return;
		onedit({ index, action });
	}

	/** Keyboard alternative: Enter or Space toggles a wall on the focused cell. */
	function onCellKey(event: KeyboardEvent, index: number) {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			apply(index, tool === 'weight' ? 'weight' : grid.walls[index] ? 'erase' : 'wall');
		}
	}

	const visitedCount = $derived(viewState.cells.filter((c) => c === 'visited' || c === 'current').length);
</script>

<div
	class="gridwrap"
	role="application"
	aria-label="Grid editor. Click or drag to draw walls. Shift and drag to erase. Drag the start or target cell to move it."
	onpointermove={move}
	onpointerup={end}
	onpointerleave={() => {
		end();
		hovered = null;
	}}
	onpointercancel={end}
>
	<div class="grid" style={`--cols:${grid.cols};--rows:${grid.rows}`}>
		{#each grid.walls as _, i (i)}
			<button
				type="button"
				class="cell"
				data-cell={i}
				data-tag={tagOf(i)}
				data-weight={grid.weights[i] > 1 ? grid.weights[i] : undefined}
				tabindex={i === grid.start || i === grid.end || i % 37 === 0 ? 0 : -1}
				aria-label={`Cell column ${i % grid.cols}, row ${Math.floor(i / grid.cols)}: ${ROLE_TEXT[tagOf(i)]}${grid.weights[i] > 1 ? `, cost ${grid.weights[i]}` : ''}`}
				onpointerdown={(e) => begin(e, i)}
				onkeydown={(e) => onCellKey(e, i)}
			>
				{#if CUE[tagOf(i)]}<span class="cue">{CUE[tagOf(i)]}</span>{/if}
				{#if grid.weights[i] > 1 && tagOf(i) !== 'wall'}<span class="w num">{grid.weights[i]}</span>{/if}
			</button>
		{/each}
	</div>

	{#if hovered !== null}
		<p class="hoverinfo muted">
			Cell ({hovered % grid.cols}, {Math.floor(hovered / grid.cols)}) · cost {grid.weights[hovered]} ·
			{ROLE_TEXT[tagOf(hovered)]}{Number.isFinite(viewState.dist[String(hovered)]) ? ` · reached at cost ${viewState.dist[String(hovered)]}` : ''}
		</p>
	{/if}
</div>

<details class="table-view">
	<summary>Text view of the current grid state</summary>
	<p class="muted" data-testid="grid-text">
		Visited {visitedCount}. Frontier {viewState.cells.filter((c) => c === 'frontier').length}. Path cells
		{viewState.pathCells.length}. Walls {grid.walls.filter(Boolean).length}.
	</p>
	<p class="muted" data-testid="grid-path">
		{viewState.pathCells.length
			? `Path: ${viewState.pathCells.map((i) => `(${i % grid.cols}, ${Math.floor(i / grid.cols)})`).join(' to ')}`
			: 'No path has been drawn yet.'}
	</p>
</details>

<style>
	.gridwrap {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		min-height: 0;
		touch-action: none;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		/* Rows must be sized explicitly. With implicit auto rows the cell CONTENT sets the row
		   height, which overrides `aspect-ratio` and makes the cells non-square on a narrow
		   viewport (measured: 13 x 21 px at 390 px wide before this fix). */
		grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
		gap: 1px;
		width: 100%;
		aspect-ratio: var(--cols) / var(--rows);
		background: var(--border);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		overflow: hidden;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		padding: 0;
		background: var(--panel);
		border: none;
		border-radius: 0;
		cursor: pointer;
		font-family: var(--mono);
		font-size: 8px;
		line-height: 1;
	}

	.cue {
		font-weight: 700;
		font-size: 9px;
	}

	.w {
		position: absolute;
		right: 1px;
		bottom: 0;
		font-size: 7px;
		opacity: 0.8;
	}

	.cell[data-tag='wall'] {
		background: var(--ink-2);
	}
	.cell[data-tag='start'] {
		background: var(--d-blue);
		color: var(--on-blue);
	}
	.cell[data-tag='end'] {
		background: var(--d-vermilion);
		color: var(--on-vermilion);
	}
	.cell[data-tag='frontier'] {
		background: var(--d-sky);
		color: var(--on-sky);
	}
	.cell[data-tag='visited'] {
		background: var(--d-purple);
		color: var(--on-purple);
	}
	.cell[data-tag='current'] {
		background: var(--d-orange);
		color: var(--on-orange);
	}
	.cell[data-tag='path'] {
		background: var(--d-green);
		color: var(--on-green);
	}
	/* Weighted cells get a visible hatch as well as the number, so the extra cost is not
	   signalled by a number alone on a dense grid. */
	.cell[data-weight] {
		background-image: repeating-linear-gradient(
			45deg,
			rgba(20, 22, 27, 0.18) 0 2px,
			transparent 2px 5px
		);
	}

	.hoverinfo {
		min-height: 18px;
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
</style>
