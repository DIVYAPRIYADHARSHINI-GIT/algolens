<script lang="ts">
	// Three-column workspace: controls, canvas, side panel, with the transport underneath.
	// Below 1000px it stacks and the panels become collapsible sections.
	interface Props {
		title: string;
		controls: import('svelte').Snippet;
		canvas: import('svelte').Snippet;
		side: import('svelte').Snippet;
		transport?: import('svelte').Snippet;
		banner?: import('svelte').Snippet;
	}
	const { title, controls, canvas, side, transport, banner }: Props = $props();
	let controlsOpen = $state(true);
</script>

<div class="workspace">
	<h1 class="sr-only">{title}</h1>
	{#if banner}
		<div class="banner">{@render banner()}</div>
	{/if}

	<div class="cols">
		<div class="col-controls">
			<button class="accordion" onclick={() => (controlsOpen = !controlsOpen)} aria-expanded={controlsOpen}>
				Input and options
			</button>
			<div class="controls panel" class:collapsed={!controlsOpen}>
				{@render controls()}
			</div>
		</div>

		<div class="col-canvas panel">
			{@render canvas()}
		</div>

		<div class="col-side">
			{@render side()}
		</div>
	</div>

	{#if transport}
		{@render transport()}
	{/if}
</div>

<style>
	.workspace {
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--topbar-h));
	}

	.banner {
		padding: 8px 12px 0;
	}

	.cols {
		flex: 1 1 auto;
		display: grid;
		grid-template-columns: 268px minmax(0, 1fr) 340px;
		gap: 12px;
		padding: 12px;
		min-height: 0;
		align-items: stretch;
	}

	.col-controls,
	.col-side {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.controls {
		flex: 1 1 auto;
		padding: 12px;
		overflow: auto;
		min-height: 0;
	}

	.col-canvas {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 320px;
		overflow: hidden;
	}

	.accordion {
		display: none;
	}

	@media (max-width: 1200px) {
		.cols {
			grid-template-columns: 240px minmax(0, 1fr) 300px;
		}
	}

	@media (max-width: 1000px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
			padding-bottom: 12px;
		}
		.accordion {
			display: block;
			width: 100%;
			min-height: 44px;
			padding: 0 12px;
			margin-bottom: 8px;
			text-align: left;
			font-size: 13px;
			font-weight: 600;
			border: 1px solid var(--border);
			border-radius: var(--r-sm);
			background: var(--panel);
		}
		.controls.collapsed {
			display: none;
		}
		.col-canvas {
			min-height: 50vh;
		}
	}
</style>
