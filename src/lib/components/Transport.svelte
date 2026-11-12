<script lang="ts">
	import Icon from './Icon.svelte';
	import { SPEEDS, type Player, type Speed } from '#lib/player.svelte.js';

	interface Props {
		player: Player;
		onrestart?: () => void;
	}
	const { player, onrestart }: Props = $props();

	function onKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
		if (typing && target?.getAttribute('type') !== 'range') return;
		switch (event.key) {
			case ' ':
				event.preventDefault();
				player.toggle();
				break;
			case 'ArrowLeft':
				event.preventDefault();
				player.back();
				break;
			case 'ArrowRight':
				event.preventDefault();
				player.forward();
				break;
			case 'Home':
				event.preventDefault();
				player.toStart();
				break;
			case 'End':
				event.preventDefault();
				player.toEnd();
				break;
			case '+':
			case '=':
				event.preventDefault();
				player.nudgeSpeed(1);
				break;
			case '-':
			case '_':
				event.preventDefault();
				player.nudgeSpeed(-1);
				break;
			case 'r':
			case 'R':
				if (!event.metaKey && !event.ctrlKey) {
					event.preventDefault();
					if (onrestart) onrestart();
					else player.toStart();
				}
				break;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="transport" role="group" aria-label="Playback controls">
	<div class="buttons">
		<button
			class="btn btn-icon"
			onclick={() => (onrestart ? onrestart() : player.toStart())}
			aria-label="Restart this run"
			title="Restart (R)"
		>
			<Icon name="restart" size={16} />
		</button>
		<button class="btn btn-icon" onclick={() => player.back()} disabled={player.atStart} aria-label="Step back one step" title="Step back (left arrow)">
			<Icon name="step-back" size={16} />
		</button>
		<button
			class="btn btn-primary play"
			onclick={() => player.toggle()}
			disabled={player.total === 0}
			aria-label={player.playing ? 'Pause' : 'Play'}
			title={player.playing ? 'Pause (space)' : 'Play (space)'}
		>
			<Icon name={player.playing ? 'pause' : 'play'} size={17} />
			<span class="play-label">{player.playing ? 'Pause' : 'Play'}</span>
		</button>
		<button
			class="btn btn-icon"
			onclick={() => player.forward()}
			disabled={player.atEnd}
			aria-label="Step forward one step"
			title="Step forward (right arrow)"
		>
			<Icon name="step-forward" size={16} />
		</button>
		<button class="btn btn-icon" onclick={() => player.toEnd()} disabled={player.atEnd} aria-label="Jump to the end" title="Jump to the end (End)">
			<Icon name="to-end" size={16} />
		</button>
	</div>

	<div class="scrub">
		<input
			type="range"
			min="0"
			max={Math.max(player.total, 1)}
			step="1"
			value={player.index}
			disabled={player.total === 0}
			oninput={(e) => player.seek(Number((e.currentTarget as HTMLInputElement).value))}
			aria-label="Timeline position"
			aria-valuetext={`Step ${player.index} of ${player.total}`}
		/>
		<span class="counter num">{player.index} / {player.total}</span>
	</div>

	<div class="speed">
		<label for="speed-select">Speed</label>
		<span class="select-wrap">
			<select
				id="speed-select"
				value={String(player.speed)}
				onchange={(e) => player.setSpeed(Number((e.currentTarget as HTMLSelectElement).value) as Speed)}
			>
				{#each SPEEDS as s (s)}
					<option value={String(s)}>{s}x</option>
				{/each}
			</select>
		</span>
	</div>
</div>

<style>
	.transport {
		position: sticky;
		bottom: 0;
		z-index: 25;
		display: flex;
		align-items: center;
		gap: 16px;
		height: var(--transport-h);
		padding: 0 12px;
		background: var(--panel);
		border-top: 1px solid var(--border);
	}

	.buttons {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.play {
		min-width: 86px;
		min-height: 36px;
	}

	.scrub {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1 1 auto;
		min-width: 0;
	}

	.scrub input {
		flex: 1 1 auto;
		min-width: 60px;
	}

	.counter {
		font-size: 12px;
		color: var(--ink-2);
		white-space: nowrap;
		flex: none;
	}

	.speed {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}

	.speed label {
		font-size: 12px;
	}

	.speed select {
		width: 74px;
	}

	@media (max-width: 760px) {
		.transport {
			flex-wrap: wrap;
			height: auto;
			min-height: var(--transport-h);
			padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
			gap: 8px;
		}
		.buttons {
			order: 2;
			flex: 1 1 auto;
			justify-content: space-between;
		}
		.buttons :global(.btn) {
			min-height: 44px;
			min-width: 44px;
		}
		/* The speed select is a transport control too, so it needs the same 44px target. */
		.speed select {
			min-height: 44px;
			min-width: 74px;
		}
		.scrub {
			order: 1;
			width: 100%;
			flex: 1 1 100%;
		}
		.speed {
			order: 3;
		}
		.play-label {
			display: none;
		}
		.play {
			min-width: 56px;
		}
	}
</style>
