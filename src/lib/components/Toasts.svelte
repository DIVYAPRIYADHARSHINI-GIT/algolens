<script lang="ts">
	import { app } from '#lib/app.svelte.js';
	import Icon from './Icon.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
	{#each app.toasts as toast (toast.id)}
		<div class="toast" class:ok={toast.tone === 'ok'} class:bad={toast.tone === 'bad'}>
			<Icon name={toast.tone === 'ok' ? 'check' : toast.tone === 'bad' ? 'warn' : 'info'} size={15} />
			<span>{toast.text}</span>
			<button class="x" onclick={() => app.dismissToast(toast.id)} aria-label="Dismiss this message">
				<Icon name="close" size={13} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		right: 12px;
		bottom: calc(var(--transport-h) + 16px);
		z-index: 60;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: min(380px, calc(100vw - 24px));
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 10px 10px 12px;
		background: var(--panel);
		border: 1px solid var(--border-strong);
		border-left: 3px solid var(--ink-3);
		border-radius: var(--r-sm);
		box-shadow: var(--shadow);
		font-size: 13px;
		pointer-events: auto;
	}

	.toast.ok {
		border-left-color: var(--ok);
		color: var(--ink);
	}

	.toast.bad {
		border-left-color: var(--danger);
	}

	.toast span {
		flex: 1;
	}

	.x {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		color: var(--ink-3);
		flex: none;
	}

	.x:hover {
		background: var(--panel-2);
		color: var(--ink);
	}

	@media (max-width: 700px) {
		.toasts {
			left: 12px;
			right: 12px;
			max-width: none;
			bottom: calc(var(--transport-h) + 12px);
		}
	}
</style>
