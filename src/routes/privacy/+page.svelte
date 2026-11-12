<script lang="ts">
	import { app } from '#lib/app.svelte.js';
	import { downloadText, formatBytes } from '#lib/browser-utils.js';
	import { makeBackup, parseBackup, type SettingsData } from '#lib/core/schema.js';
	import Confirm from '#lib/components/Confirm.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let fileInput: HTMLInputElement | null = $state(null);
	let importError = $state<string | null>(null);
	let pending = $state<{ settings: SettingsData; summary: string } | null>(null);

	const meterPct = $derived(Math.min(100, (app.storage.bytesUsed / app.storage.bytesBudget) * 100));

	function exportBackup() {
		const stamp = new Date().toISOString().slice(0, 10);
		downloadText(`algolens-backup-${stamp}.json`, JSON.stringify(makeBackup(app.settings), null, 2));
		app.toast('Backup saved to your downloads folder.', 'ok');
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		importError = null;
		if (!file) return;
		if (file.size > 4_000_000) {
			importError = 'That file is larger than 4 MB, which is far bigger than any AlgoLens backup.';
			return;
		}
		let text: string;
		try {
			text = await file.text();
		} catch {
			importError = 'That file could not be read from disk.';
			return;
		}
		const result = parseBackup(text);
		if (!result.ok) {
			importError = result.error;
			return;
		}
		// Never silently overwrite: show what the file contains and ask first.
		const parts = [
			`theme "${result.settings.theme}"`,
			`${result.settings.savedGrids.length} saved grid(s)`,
			`${result.settings.savedGraphs.length} saved graph(s)`,
			`${result.settings.practice.answered} practice answer(s)`
		];
		if (result.migratedFrom !== null) parts.push(`upgraded from schema version ${result.migratedFrom}`);
		if (result.repaired) parts.push('some entries were invalid and have been dropped');
		pending = { settings: result.settings, summary: parts.join(', ') };
	}
</script>

<svelte:head>
	<title>Privacy and Backup - AlgoLens</title>
	<meta name="description" content="Where AlgoLens stores your data, what it never does, and how to export or import a JSON backup of everything saved in this browser." />
</svelte:head>

<div class="page">
	<h1>Privacy and Backup</h1>
	<p class="lede">Your saved items stay in this browser. Nothing you do in AlgoLens is uploaded anywhere.</p>

	<section class="panel">
		<h2>Where your data lives</h2>
		<ul class="bullets">
			<li>
				Settings, saved grids, saved graphs and your practice score are written to this browser's
				<strong>localStorage</strong>, under a single key. They never leave the device.
			</li>
			<li>
				There is <strong>no server, no database, no cloud storage and no account</strong>. AlgoLens is
				published as static files; there is not even a server route to send data to.
			</li>
			<li>
				A share link carries the whole setup <strong>inside the link text itself</strong>, after the
				<code>#</code>. A URL fragment is never sent to a web server by the browser, but anyone you give
				the link to can read the input it contains, so treat it as public.
			</li>
			<li>No analytics, no trackers, no cookies, no fonts or scripts fetched from anyone else's server.</li>
			<li>
				In private-browsing windows that block site storage, AlgoLens still works but keeps everything in
				memory for the session only, and says so.
			</li>
		</ul>
	</section>

	<section class="panel">
		<h2>Storage meter</h2>
		<div class="meter" role="img" aria-label={`Using ${formatBytes(app.storage.bytesUsed)} of about ${formatBytes(app.storage.bytesBudget)}`}>
			<div class="fill" style={`width:${Math.max(0.6, meterPct)}%`}></div>
		</div>
		<p class="muted">
			{formatBytes(app.storage.bytesUsed)} used of roughly {formatBytes(app.storage.bytesBudget)} typically
			available per site. Status: {app.storage.status === 'ok' ? 'storage is working normally' : app.storage.status}.
		</p>
		{#if app.storage.message}
			<p class="notice notice-warn">{app.storage.message}</p>
		{/if}
	</section>

	<section class="panel">
		<h2>Backup</h2>
		<p class="muted">
			Export writes a single JSON file containing your settings, saved grids, saved graphs and practice
			score. Import validates the file before changing anything and will always ask before replacing what
			you already have.
		</p>
		<div class="row-wrap">
			<button class="btn btn-primary" onclick={exportBackup} data-testid="export-backup">
				<Icon name="download" size={14} /> Export backup
			</button>
			<button class="btn" onclick={() => fileInput?.click()} data-testid="import-backup">
				<Icon name="upload" size={14} /> Import backup
			</button>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			class="sr-only"
			onchange={onFile}
			aria-label="Choose an AlgoLens backup file"
			data-testid="backup-file"
		/>
		{#if importError}
			<p class="notice notice-bad" role="alert" data-testid="import-error">{importError}</p>
		{/if}
	</section>

	<section class="panel">
		<h2>What AlgoLens never does</h2>
		<ul class="bullets">
			<li>It never sends your input, grids, graphs or settings over the network.</li>
			<li>It never asks for an account, an email address or a payment method.</li>
			<li>It never loads a third-party script, font or image at runtime.</li>
			<li>It never silently discards your saved data - a corrupted blob is reported, repaired and explained.</li>
		</ul>
	</section>
</div>

{#if pending}
	<Confirm
		title="Replace what is saved in this browser?"
		body={`This backup contains ${pending.summary}. Importing it replaces your current settings, saved grids, saved graphs and practice score. Export your current data first if you want to keep it.`}
		confirmLabel="Replace my data"
		danger={true}
		onconfirm={() => {
			if (pending) {
				app.importSettings(pending.settings);
				app.toast('Backup imported.', 'ok');
			}
			pending = null;
		}}
		oncancel={() => {
			pending = null;
			app.toast('Import cancelled. Nothing was changed.', 'info');
		}}
	/>
{/if}

<style>
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 24px 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	h1 {
		font-size: 24px;
	}

	.lede {
		font-size: 15px;
		color: var(--ink-2);
		margin: 0;
	}

	section {
		padding: 16px;
	}

	h2 {
		font-size: 15px;
		margin-bottom: 10px;
	}

	.bullets {
		margin: 0;
		padding-left: 20px;
		font-size: 13.5px;
		line-height: 1.75;
		color: var(--ink-2);
		max-width: 68ch;
	}

	.bullets strong {
		color: var(--ink);
	}

	code {
		padding: 1px 4px;
		background: var(--panel-2);
		border-radius: 3px;
		font-size: 12px;
	}

	section p.muted {
		max-width: 66ch;
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

	.notice {
		margin-top: 10px;
	}
</style>
