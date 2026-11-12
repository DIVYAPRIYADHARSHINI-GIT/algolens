<script lang="ts">
	// Role legend. Each row shows the colour swatch AND the letter cue AND the word, so the
	// meaning never depends on colour perception alone.
	interface Item {
		tag: string;
		cue: string;
		label: string;
	}
	interface Props {
		items: Item[];
		verified?: { ok: boolean; label: string } | null;
		truncated?: boolean;
	}
	const { items, verified = null, truncated = false }: Props = $props();
</script>

<div class="legend">
	<ul>
		{#each items as item (item.tag)}
			<li>
				<span class="sw" data-tag={item.tag}>{item.cue}</span>
				<span>{item.label}</span>
			</li>
		{/each}
	</ul>
	<div class="right">
		{#if truncated}
			<span class="badge badge-warn" title="The recorded animation stopped at the step limit">Animation truncated</span>
		{/if}
		{#if verified}
			<span
				class="badge"
				class:badge-ok={verified.ok}
				class:badge-bad={!verified.ok}
				data-testid="verified-badge">{verified.label}</span
			>
		{/if}
	</div>
</div>

<style>
	.legend {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--panel);
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-2);
	}

	.sw {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		border-radius: 4px;
		border: 1px solid transparent;
		font-family: var(--mono);
		font-size: 9px;
		font-weight: 700;
		flex: none;
	}

	.right {
		display: flex;
		gap: 6px;
		flex: none;
	}

	[data-tag='none'] {
		background: var(--d-blue);
		color: var(--on-blue);
	}
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
	[data-tag='mid'] {
		background: var(--d-sky);
		color: var(--on-sky);
	}
	[data-tag='frontier'] {
		background: var(--d-sky);
		color: var(--on-sky);
	}
	[data-tag='visited'] {
		background: var(--d-purple);
		color: var(--on-purple);
	}
	[data-tag='current'] {
		background: var(--d-orange);
		color: var(--on-orange);
	}
	[data-tag='path'] {
		background: var(--d-green);
		color: var(--on-green);
	}
	[data-tag='wall'] {
		background: var(--ink-2);
		color: var(--panel);
	}
	[data-tag='start'] {
		background: var(--d-blue);
		color: var(--on-blue);
	}
	[data-tag='end'] {
		background: var(--d-vermilion);
		color: var(--on-vermilion);
	}
	[data-tag='tree'] {
		background: var(--d-green);
		color: var(--on-green);
	}
	[data-tag='rejected'] {
		background: var(--panel-2);
		color: var(--ink-3);
		border-color: var(--border-strong);
	}
</style>
