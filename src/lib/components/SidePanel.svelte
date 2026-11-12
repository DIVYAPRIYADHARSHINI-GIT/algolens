<script lang="ts">
	// The right-hand explanation panel: Pseudocode, Code, Explanation, Stats, Complexity.
	// On phones it becomes an accordion (see the media query at the bottom).
	import Icon from './Icon.svelte';
	import type { AlgoEntry } from '#lib/data/catalog.js';
	import type { Counters } from '#lib/core/state.js';
	import type { Verification } from '#lib/core/verify.js';

	interface StatRow {
		label: string;
		value: string | number;
	}

	interface Props {
		entry: AlgoEntry;
		line: number;
		explain: string;
		counters: Counters;
		extraStats?: StatRow[];
		verification?: Verification | null;
		stack?: { label: string; lo: number; hi: number; depth: number }[];
	}
	const { entry, line, explain, counters, extraStats = [], verification = null, stack = [] }: Props = $props();

	type Tab = 'pseudocode' | 'code' | 'explanation' | 'stats' | 'complexity';
	let tab = $state<Tab>('pseudocode');
	let codeLang = $state<'js' | 'py'>('js');

	const TABS: { id: Tab; label: string }[] = [
		{ id: 'pseudocode', label: 'Pseudocode' },
		{ id: 'code', label: 'Code' },
		{ id: 'explanation', label: 'Explanation' },
		{ id: 'stats', label: 'Stats' },
		{ id: 'complexity', label: 'Complexity' }
	];

	const stats = $derived<StatRow[]>([
		{ label: 'Steps', value: counters.steps },
		{ label: 'Comparisons', value: counters.comparisons },
		{ label: 'Swaps', value: counters.swaps },
		{ label: 'Writes', value: counters.writes },
		{ label: 'Array accesses', value: counters.accesses },
		{ label: 'Recursion depth', value: `${counters.depth} (max ${counters.maxDepth})` },
		...extraStats
	]);

	let activeLine: HTMLLIElement | null = $state(null);
	$effect(() => {
		void line;
		activeLine?.scrollIntoView({ block: 'nearest' });
	});
</script>

<aside class="side panel" aria-label="Explanation panel">
	<div class="tabs" role="tablist" aria-label="Explanation sections">
		{#each TABS as t (t.id)}
			<button
				class="tab"
				class:active={tab === t.id}
				role="tab"
				id={`tab-${t.id}`}
				aria-selected={tab === t.id}
				aria-controls={`panel-${t.id}`}
				onclick={() => (tab = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>

	<div class="body">
		{#if tab === 'pseudocode'}
			<div role="tabpanel" id="panel-pseudocode" aria-labelledby="tab-pseudocode">
				<ol class="code" aria-label={`Pseudocode for ${entry.name}`}>
					{#each entry.pseudocode as text, i (i)}
						{#if i + 1 === line}
							<li class="active" bind:this={activeLine} aria-current="step">
								<span class="ln num">{i + 1}</span><code>{text}</code>
							</li>
						{:else}
							<li><span class="ln num">{i + 1}</span><code>{text}</code></li>
						{/if}
					{/each}
				</ol>
				<p class="muted">The highlighted line is the one the current step is executing.</p>
			</div>
		{:else if tab === 'code'}
			<div role="tabpanel" id="panel-code" aria-labelledby="tab-code">
				<div class="row lang">
					<button class="btn" class:btn-primary={codeLang === 'js'} onclick={() => (codeLang = 'js')}>JavaScript</button>
					<button class="btn" class:btn-primary={codeLang === 'py'} onclick={() => (codeLang = 'py')}>Python</button>
				</div>
				<pre class="plain"><code>{codeLang === 'js' ? entry.js : entry.py}</code></pre>
				<p class="muted">Written for AlgoLens. The JavaScript above is executed by the test suite and checked for correctness.</p>
			</div>
		{:else if tab === 'explanation'}
			<div role="tabpanel" id="panel-explanation" aria-labelledby="tab-explanation">
				<p class="explain" data-testid="explain">{explain}</p>
				{#if stack.length}
					<h4>Call stack</h4>
					<ol class="stack">
						{#each stack as frame, i (i)}
							<li>
								<span class="num">{frame.label}({frame.lo}, {frame.hi})</span>
								<span class="muted">depth {frame.depth}</span>
							</li>
						{/each}
					</ol>
				{/if}
				{#if verification}
					<h4>Verification</h4>
					<p>
						<span class="badge" class:badge-ok={verification.ok} class:badge-bad={!verification.ok}>
							<Icon name={verification.ok ? 'check' : 'warn'} size={12} />
							{verification.label}
						</span>
					</p>
					<ul class="checks">
						{#each verification.details as detail, i (i)}
							<li>{detail}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else if tab === 'stats'}
			<div role="tabpanel" id="panel-stats" aria-labelledby="tab-stats">
				<table>
					<caption class="sr-only">Live counters for this run</caption>
					<tbody>
						{#each stats as row (row.label)}
							<tr>
								<th scope="row">{row.label}</th>
								<td class="num" data-testid={`stat-${row.label.toLowerCase().replace(/\s+/g, '-')}`}>{row.value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div role="tabpanel" id="panel-complexity" aria-labelledby="tab-complexity">
				<table>
					<caption class="sr-only">Complexity of {entry.name}</caption>
					<tbody>
						<tr><th scope="row">Best time</th><td class="num">{entry.complexity.best}</td></tr>
						<tr><th scope="row">Average time</th><td class="num">{entry.complexity.average}</td></tr>
						<tr><th scope="row">Worst time</th><td class="num">{entry.complexity.worst}</td></tr>
						<tr><th scope="row">Space</th><td class="num">{entry.complexity.space}</td></tr>
						{#if entry.complexity.stable !== null}
							<tr><th scope="row">Stable</th><td>{entry.complexity.stable ? 'Yes' : 'No'}</td></tr>
						{/if}
						{#if entry.complexity.inPlace !== null}
							<tr><th scope="row">In place</th><td>{entry.complexity.inPlace ? 'Yes' : 'No'}</td></tr>
						{/if}
					</tbody>
				</table>
				<p class="note">{entry.complexity.notes}</p>
				<p class="muted">Sources checked for these values are listed in the project README.</p>
			</div>
		{/if}
	</div>
</aside>

<style>
	.side {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.tabs {
		display: flex;
		gap: 2px;
		padding: 6px;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
		flex: none;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.tab {
		padding: 5px 9px;
		border-radius: var(--r-sm);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-3);
		white-space: nowrap;
	}

	.tab:hover {
		background: var(--panel-2);
		color: var(--ink);
	}

	.tab.active {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.body {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 12px;
	}

	.code {
		list-style: none;
		margin: 0 0 10px;
		padding: 0;
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.65;
	}

	.code li {
		display: flex;
		gap: 8px;
		padding: 1px 6px;
		border-left: 2px solid transparent;
		border-radius: 3px;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.code li.active {
		background: var(--panel-2);
		border-left-color: var(--d-orange);
		color: var(--ink);
		font-weight: 600;
	}

	.ln {
		flex: none;
		width: 16px;
		text-align: right;
		color: var(--ink-3);
		font-size: 11px;
	}

	pre.plain {
		margin: 10px 0;
		padding: 10px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: 12px;
		line-height: 1.55;
		overflow-x: auto;
		white-space: pre;
	}

	.lang {
		margin-bottom: 4px;
	}

	.explain {
		padding: 10px;
		background: var(--panel-2);
		border-left: 3px solid var(--d-blue);
		border-radius: 0 var(--r-sm) var(--r-sm) 0;
		font-size: 13px;
		line-height: 1.55;
	}

	.stack {
		margin: 0 0 12px;
		padding-left: 18px;
		font-size: 12px;
	}

	.stack li {
		display: flex;
		gap: 8px;
		justify-content: space-between;
	}

	.checks {
		margin: 0;
		padding-left: 18px;
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.55;
	}

	.note {
		margin-top: 10px;
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.55;
	}

	h4 {
		margin: 14px 0 6px;
	}

	@media (max-width: 1000px) {
		.body {
			max-height: 42vh;
		}
	}
</style>
