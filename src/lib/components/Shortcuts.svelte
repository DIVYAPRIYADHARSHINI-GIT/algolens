<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onclose: () => void;
	}
	const { onclose }: Props = $props();

	const GROUPS = [
		{
			title: 'Playback',
			rows: [
				['Space', 'Play or pause'],
				['Left arrow', 'Step back one step'],
				['Right arrow', 'Step forward one step'],
				['Home', 'Jump to the start'],
				['End', 'Jump to the end'],
				['Plus', 'Increase the speed'],
				['Minus', 'Decrease the speed'],
				['R', 'Restart the current run']
			]
		},
		{
			title: 'Everywhere',
			rows: [
				['?', 'Open or close this cheat sheet'],
				['Escape', 'Close a dialog'],
				['Tab', 'Move to the next control'],
				['T', 'Switch between light and dark']
			]
		},
		{
			title: 'Grid editor',
			rows: [
				['Click or drag', 'Draw walls'],
				['Shift and drag', 'Erase walls'],
				['Drag the start or target', 'Move it to another cell'],
				['W then click', 'Set the weight of a cell']
			]
		}
	];

	let dialog: HTMLDivElement | null = $state(null);

	$effect(() => {
		dialog?.focus();
	});
</script>

<div
	class="scrim"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
>
	<div
		class="sheet panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="shortcuts-title"
		tabindex="-1"
		bind:this={dialog}
	>
		<div class="head">
			<h2 id="shortcuts-title">Keyboard shortcuts</h2>
			<button class="btn btn-icon" onclick={onclose} aria-label="Close the keyboard shortcuts">
				<Icon name="close" size={15} />
			</button>
		</div>
		<div class="groups">
			{#each GROUPS as group (group.title)}
				<section>
					<h4>{group.title}</h4>
					<table>
						<tbody>
							{#each group.rows as [key, what] (key)}
								<tr>
									<td class="key"><kbd>{key}</kbd></td>
									<td>{what}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(20, 22, 27, 0.45);
	}

	.sheet {
		width: min(680px, 100%);
		max-height: min(80dvh, 620px);
		overflow: auto;
		box-shadow: var(--shadow);
	}

	.head {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background: var(--panel);
		border-bottom: 1px solid var(--border);
	}

	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 20px;
		padding: 16px;
	}

	h4 {
		margin-bottom: 6px;
	}

	.key {
		width: 46%;
	}

	kbd {
		display: inline-block;
		padding: 1px 6px;
		border: 1px solid var(--border-strong);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--panel-2);
		font-size: 12px;
	}
</style>
