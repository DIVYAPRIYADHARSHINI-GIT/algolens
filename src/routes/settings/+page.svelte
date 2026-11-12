<script lang="ts">
	import { app } from '#lib/app.svelte.js';
	import { formatBytes } from '#lib/browser-utils.js';
	import Confirm from '#lib/components/Confirm.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { Theme } from '#lib/core/schema.js';

	let confirming = $state<'examples' | 'reset' | null>(null);

	const meterPct = $derived(Math.min(100, (app.storage.bytesUsed / app.storage.bytesBudget) * 100));
</script>

<svelte:head>
	<title>Settings - AlgoLens</title>
	<meta name="description" content="Theme, sound, motion and storage settings for AlgoLens. Load the bundled examples or reset everything stored in this browser." />
</svelte:head>

<div class="page">
	<h1>Settings</h1>
	<p class="muted intro">
		Your saved items stay in this browser. AlgoLens has no account, no server and no database -
		everything below is written to this browser's localStorage only.
	</p>

	{#if app.storage.message}
		<p class="notice" class:notice-warn={app.storage.status !== 'ok'}>{app.storage.message}</p>
	{/if}

	<section class="panel">
		<h2>Appearance</h2>
		<div class="field">
			<label for="theme">Theme</label>
			<span class="select-wrap">
				<select id="theme" value={app.settings.theme} onchange={(e) => app.setTheme((e.currentTarget as HTMLSelectElement).value as Theme)}>
					<option value="system">Match the system</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</span>
		</div>
		<div class="field">
			<label for="motion">Motion</label>
			<span class="select-wrap">
				<select
					id="motion"
					value={app.settings.reduceMotion}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value as 'auto' | 'on' | 'off';
						app.update((d) => ({ ...d, reduceMotion: v }));
					}}
				>
					<option value="auto">Match the system</option>
					<option value="on">Reduce motion</option>
					<option value="off">Allow animation</option>
				</select>
			</span>
			<span class="muted">
				With reduced motion on, playback starts paused so you can step through at your own pace, and
				transitions are removed.
			</span>
		</div>
	</section>

	<section class="panel">
		<h2>Sound</h2>
		<p class="muted">
			A short tone can play for each comparison in the sorting visualiser. It is off by default and the
			audio context is created only after you press play, never on page load.
		</p>
		<div class="field">
			<span class="row">
				<input
					id="sound"
					type="checkbox"
					checked={app.settings.soundEnabled}
					onchange={(e) => {
						const on = (e.currentTarget as HTMLInputElement).checked;
						app.update((d) => ({ ...d, soundEnabled: on }));
					}}
				/>
				<label for="sound">Play a tone for each comparison</label>
				<Icon name={app.settings.soundEnabled ? 'sound' : 'mute'} size={15} />
			</span>
		</div>
		<div class="field">
			<label for="vol">Volume: <span class="num">{Math.round(app.settings.volume * 100)}%</span></label>
			<input
				id="vol"
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={app.settings.volume}
				oninput={(e) => {
					const v = Number((e.currentTarget as HTMLInputElement).value);
					app.update((d) => ({ ...d, volume: v }));
				}}
			/>
		</div>
	</section>

	<section class="panel">
		<h2>Storage in this browser</h2>
		<div class="meter" role="img" aria-label={`Using ${formatBytes(app.storage.bytesUsed)} of about ${formatBytes(app.storage.bytesBudget)}`}>
			<div class="fill" style={`width:${Math.max(0.6, meterPct)}%`}></div>
		</div>
		<p class="muted" data-testid="storage-meter">
			{formatBytes(app.storage.bytesUsed)} used of roughly {formatBytes(app.storage.bytesBudget)} typically
			available. Saved grids: {app.settings.savedGrids.length}. Saved graphs: {app.settings.savedGraphs.length}.
		</p>
		<p class="muted">
			Full backup, import and the complete privacy explanation are on the
			<a href="/privacy/">Privacy and Backup</a> page.
		</p>
	</section>

	<section class="panel">
		<h2>Examples and reset</h2>
		<p class="muted">
			AlgoLens ships with one example maze grid and one example weighted graph so every mode has real
			content on first open. Nothing else is pre-loaded.
		</p>
		<div class="row-wrap">
			<button class="btn" onclick={() => (confirming = 'examples')}>
				<Icon name="download" size={14} /> Load examples
			</button>
			<button class="btn btn-danger" onclick={() => (confirming = 'reset')} data-testid="reset-everything">
				<Icon name="trash" size={14} /> Reset everything
			</button>
		</div>
	</section>

	<section class="panel">
		<h2>Practice score</h2>
		<table>
			<caption class="sr-only">Your practice score so far</caption>
			<tbody>
				<tr><th scope="row">Questions answered</th><td class="num">{app.settings.practice.answered}</td></tr>
				<tr><th scope="row">Answered correctly</th><td class="num">{app.settings.practice.correct}</td></tr>
				<tr><th scope="row">Best streak</th><td class="num">{app.settings.practice.bestStreak}</td></tr>
			</tbody>
		</table>
	</section>

	<section class="panel">
		<h2>About</h2>
		<p class="muted">
			AlgoLens runs entirely in your browser. It uses no API keys, no accounts and no paid services.
			The hosting plan it is published on (Vercel's free Hobby plan) is for non-commercial use.
		</p>
	</section>
</div>

{#if confirming === 'examples'}
	<Confirm
		title="Load the bundled examples?"
		body="This adds the example maze grid and the example weighted graph back to your saved items. Any grid or graph you saved yourself is kept."
		confirmLabel="Load examples"
		onconfirm={() => {
			app.loadExamples();
			confirming = null;
		}}
		oncancel={() => (confirming = null)}
	/>
{:else if confirming === 'reset'}
	<Confirm
		title="Reset everything?"
		body="This deletes every setting, saved grid, saved graph and practice score stored in this browser, then restores just the bundled examples. It cannot be undone. Export a backup first from the Privacy and Backup page if you want to keep anything."
		confirmLabel="Reset everything"
		danger={true}
		onconfirm={() => {
			app.resetEverything();
			confirming = null;
		}}
		oncancel={() => (confirming = null)}
	/>
{/if}

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	h1 {
		font-size: 24px;
	}

	.intro {
		max-width: 60ch;
		margin: 0;
	}

	section {
		padding: 16px;
	}

	h2 {
		font-size: 15px;
		margin-bottom: 10px;
	}

	section p.muted {
		max-width: 62ch;
	}

	.meter {
		height: 8px;
		border-radius: 4px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		overflow: hidden;
		margin-bottom: 8px;
	}

	.fill {
		height: 100%;
		background: var(--accent);
	}

	table {
		max-width: 360px;
	}
</style>
