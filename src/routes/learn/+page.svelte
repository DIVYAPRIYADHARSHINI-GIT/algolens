<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.js';
	import { CATALOG, type AlgoEntry } from '#lib/data/catalog.js';
	import Icon from '#lib/components/Icon.svelte';

	const GROUPS: { family: AlgoEntry['family']; title: string; icon: string; href: string }[] = [
		{ family: 'sorting', title: 'Sorting', icon: 'bars', href: '/sorting/' },
		{ family: 'searching', title: 'Searching', icon: 'search', href: '/searching/' },
		{ family: 'pathfinding', title: 'Pathfinding', icon: 'grid', href: '/pathfinding/' },
		{ family: 'graph', title: 'Graphs', icon: 'graph', href: '/graphs/' }
	];

	let selectedId = $state('bubble');
	const entry = $derived(CATALOG[selectedId]);
	const group = $derived(GROUPS.find((g) => g.family === entry.family)!);

	onMount(() => app.setMode('learn'));

	function entriesFor(family: AlgoEntry['family']): AlgoEntry[] {
		return Object.values(CATALOG).filter((e) => e.family === family);
	}
</script>

<svelte:head>
	<title>Learn - AlgoLens</title>
	<meta name="description" content="A written page for every algorithm in AlgoLens: how it works, a worked example, when to use it, strengths, weaknesses and common mistakes." />
</svelte:head>

<div class="page">
	<nav class="index panel" aria-label="Algorithms">
		<h1>Learn</h1>
		{#each GROUPS as g (g.family)}
			<h4>{g.title}</h4>
			<ul>
				{#each entriesFor(g.family) as e (e.id)}
					<li>
						<button class="item" class:active={selectedId === e.id} onclick={() => (selectedId = e.id)}>
							{e.name}
						</button>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>

	<article class="content panel">
		<header>
			<span class="family"><Icon name={group.icon} size={14} /> {group.title}</span>
			<h2>{entry.name}</h2>
			<p class="tagline">{entry.tagline}</p>
			<a class="btn btn-primary" href={group.href}>Open it in the visualiser</a>
		</header>

		<section>
			<h3>How it works</h3>
			<p>{entry.learn.how}</p>
		</section>

		<section>
			<h3>A small worked example</h3>
			<p>{entry.learn.worked}</p>
		</section>

		<section>
			<h3>When to use it</h3>
			<p>{entry.learn.when}</p>
		</section>

		<div class="two">
			<section>
				<h3>Strengths</h3>
				<ul class="bullets">
					{#each entry.learn.strengths as item, i (i)}<li>{item}</li>{/each}
				</ul>
			</section>
			<section>
				<h3>Weaknesses</h3>
				<ul class="bullets">
					{#each entry.learn.weaknesses as item, i (i)}<li>{item}</li>{/each}
				</ul>
			</section>
		</div>

		<section>
			<h3>Common mistakes</h3>
			<ul class="bullets">
				{#each entry.learn.mistakes as item, i (i)}<li>{item}</li>{/each}
			</ul>
		</section>

		<section>
			<h3>Complexity</h3>
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
		</section>

		<section>
			<h3>Pseudocode</h3>
			<ol class="code">
				{#each entry.pseudocode as text, i (i)}
					<li><span class="ln num">{i + 1}</span><code>{text}</code></li>
				{/each}
			</ol>
		</section>

		<div class="two">
			<section>
				<h3>JavaScript</h3>
				<pre class="plain"><code>{entry.js}</code></pre>
			</section>
			<section>
				<h3>Python</h3>
				<pre class="plain"><code>{entry.py}</code></pre>
			</section>
		</div>
	</article>
</div>

<style>
	.page {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		gap: 12px;
		padding: 16px;
		max-width: 1180px;
		margin: 0 auto;
		width: 100%;
		align-items: start;
	}

	.index {
		padding: 14px;
		position: sticky;
		top: calc(var(--topbar-h) + 16px);
		max-height: calc(100dvh - var(--topbar-h) - 32px);
		overflow: auto;
	}

	.index h1 {
		font-size: 20px;
		margin-bottom: 10px;
	}

	.index h4 {
		margin: 14px 0 4px;
	}

	.index ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.item {
		display: block;
		width: 100%;
		padding: 5px 8px;
		border-radius: var(--r-sm);
		text-align: left;
		font-size: 13px;
		color: var(--ink-2);
		min-height: 30px;
	}

	.item:hover {
		background: var(--panel-2);
		color: var(--ink);
	}

	.item.active {
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 500;
	}

	.content {
		padding: 20px 22px 24px;
		min-width: 0;
	}

	.content header {
		padding-bottom: 16px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.family {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	.content h2 {
		font-size: 24px;
		margin: 6px 0 4px;
	}

	.tagline {
		font-size: 15px;
		color: var(--ink-2);
		margin-bottom: 12px;
	}

	header .btn {
		text-decoration: none;
	}

	section {
		margin-top: 20px;
		min-width: 0;
	}

	h3 {
		font-size: 14px;
		margin-bottom: 6px;
	}

	section p {
		font-size: 14px;
		line-height: 1.7;
		color: var(--ink-2);
		max-width: 70ch;
	}

	.bullets {
		margin: 0;
		padding-left: 20px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--ink-2);
		max-width: 70ch;
	}

	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}

	.note {
		margin-top: 8px;
		font-size: 13px;
		color: var(--ink-2);
	}

	.code {
		list-style: none;
		margin: 0;
		padding: 10px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-family: var(--mono);
		font-size: 12.5px;
		line-height: 1.7;
	}

	.code li {
		display: flex;
		gap: 10px;
		white-space: pre-wrap;
	}

	.ln {
		flex: none;
		width: 18px;
		text-align: right;
		color: var(--ink-3);
		font-size: 11px;
	}

	pre.plain {
		margin: 0;
		padding: 10px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: 12px;
		line-height: 1.55;
		overflow-x: auto;
	}

	table {
		max-width: 420px;
	}

	@media (max-width: 900px) {
		.page {
			grid-template-columns: minmax(0, 1fr);
		}
		.index {
			position: static;
			max-height: none;
		}
		.two {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
	}
</style>
