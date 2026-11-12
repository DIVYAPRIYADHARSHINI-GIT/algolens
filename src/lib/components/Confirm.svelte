<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		body: string;
		confirmLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}
	const { title, body, confirmLabel = 'Confirm', danger = false, onconfirm, oncancel }: Props = $props();

	let dialog: HTMLDivElement | null = $state(null);
	$effect(() => {
		dialog?.focus();
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') oncancel();
	}}
/>

<div
	class="scrim"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) oncancel();
	}}
>
	<div class="box panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" tabindex="-1" bind:this={dialog}>
		<div class="top">
			<span class="ico" class:danger><Icon name={danger ? 'warn' : 'info'} size={16} /></span>
			<h2 id="confirm-title">{title}</h2>
		</div>
		<p>{body}</p>
		<div class="actions">
			<button class="btn" onclick={oncancel}>Cancel</button>
			<button class="btn" class:btn-danger={danger} class:btn-primary={!danger} onclick={onconfirm} data-testid="confirm-yes">
				{confirmLabel}
			</button>
		</div>
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(20, 22, 27, 0.45);
	}

	.box {
		width: min(440px, 100%);
		padding: 18px;
		box-shadow: var(--shadow);
	}

	.top {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--r-sm);
		background: var(--panel-2);
		color: var(--ink-2);
		flex: none;
	}

	.ico.danger {
		background: var(--danger-bg);
		color: var(--danger);
	}

	h2 {
		font-size: 16px;
	}

	p {
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.6;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
</style>
