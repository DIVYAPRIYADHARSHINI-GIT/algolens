<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { MODE_TABS } from '#lib/components/nav.js';

	const DESCRIPTIONS: Record<string, string> = {
		'/sorting/': 'Eight sorting algorithms on bars or number cells, with pivot rules and seeded inputs.',
		'/searching/': 'Linear, binary and interpolation search with the low, middle and high pointers.',
		'/pathfinding/': 'Draw a maze, set weights, then run BFS, DFS, Dijkstra, A* or greedy best-first.',
		'/graphs/': 'Build a weighted graph and run traversal, shortest path or a minimum spanning tree.',
		'/compare/': 'Two algorithms side by side on identical input, with a race mode.',
		'/benchmark/': 'Operation counts on growing inputs, measured in a Web Worker so nothing freezes.',
		'/practice/': 'Predict the next step, generated from the real recorded run so it is always correct.',
		'/learn/': 'A written page for every algorithm: how it works, when to use it, and common mistakes.'
	};
</script>

<svelte:head>
	<title>AlgoLens - See how algorithms think</title>
	<meta
		name="description"
		content="AlgoLens is a free in-browser algorithm visualiser. Step through sorting, searching, pathfinding and graph algorithms with highlighted pseudocode, live counters and verified results."
	/>
</svelte:head>

<div class="hero">
	<div class="inner">
		<span class="eyebrow">Free. No account. Nothing leaves your browser.</span>
		<h1>See how algorithms think.</h1>
		<p class="lede">
			Pick an algorithm, load or draw the input, and watch it run one step at a time. Every animation is
			generated from the real algorithm, every result is checked against an independent reference, and
			you can step backwards through any run to see exactly what changed.
		</p>
		<div class="cta">
			<a class="btn btn-primary btn-lg" href="/sorting/">Start with sorting</a>
			<a class="btn btn-lg" href="/learn/">Read the Learn pages</a>
		</div>
	</div>
</div>

<section class="modes" aria-label="Modes">
	{#each MODE_TABS as tab (tab.href)}
		<a class="card panel" href={tab.href}>
			<span class="ico"><Icon name={tab.icon} size={18} /></span>
			<h3>{tab.label}</h3>
			<p>{DESCRIPTIONS[tab.href]}</p>
		</a>
	{/each}
</section>

<section class="facts" aria-label="How AlgoLens works">
	<div class="fact panel">
		<h3>Recorded, not animated by hand</h3>
		<p>
			Each algorithm is pure TypeScript that returns a list of recorded steps - compare, swap, write,
			visit, relax and so on. The renderers only draw the state they are handed, so what you see is
			what the algorithm really did.
		</p>
	</div>
	<div class="fact panel">
		<h3>Exact step-back</h3>
		<p>
			Every step stores the inverse of its own change, so stepping back or dragging the timeline shows
			exactly the same state as playing forward to that point. That property is checked by
			property-based tests on random inputs.
		</p>
	</div>
	<div class="fact panel">
		<h3>Results are verified</h3>
		<p>
			A finished sort is checked for being ordered and a true permutation of the input. A path is
			walked for legality and compared with a Bellman-Ford reference. Graph results are compared with
			independent solvers. If a check ever fails, AlgoLens says so.
		</p>
	</div>
	<div class="fact panel">
		<h3>Your data stays here</h3>
		<p>
			Saved grids, graphs and settings live in this browser's localStorage and are never uploaded.
			Shared links carry the whole setup inside the link itself, so sharing needs no server either.
		</p>
	</div>
</section>

<footer class="foot">
	<p class="muted">
		Your saved items stay in this browser. <a href="/privacy/">Privacy and Backup</a> ·
		<a href="/settings/">Settings</a>
	</p>
</footer>

<style>
	.hero {
		padding: 56px 20px 40px;
		border-bottom: 1px solid var(--border);
		background: var(--panel);
	}

	.inner {
		max-width: 720px;
		margin: 0 auto;
		text-align: center;
	}

	.eyebrow {
		display: inline-block;
		margin-bottom: 14px;
		padding: 3px 10px;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		font-size: 12px;
		color: var(--ink-2);
	}

	h1 {
		margin-bottom: 14px;
	}

	.lede {
		font-size: 16px;
		line-height: 1.6;
		color: var(--ink-2);
		margin-bottom: 24px;
	}

	.cta {
		display: flex;
		gap: 10px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.cta .btn {
		text-decoration: none;
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 12px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px 20px 8px;
	}

	.card {
		padding: 14px;
		text-decoration: none;
		color: inherit;
		transition: border-color 120ms ease;
	}

	.card:hover {
		border-color: var(--ink-3);
	}

	.ico {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		margin-bottom: 8px;
		border-radius: var(--r-sm);
		background: var(--panel-2);
		color: var(--ink);
	}

	.card h3 {
		font-size: 14px;
		margin-bottom: 4px;
	}

	.card p {
		font-size: 12.5px;
		color: var(--ink-3);
		line-height: 1.5;
		margin: 0;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 12px 20px 24px;
	}

	.fact {
		padding: 14px;
	}

	.fact h3 {
		font-size: 14px;
		margin-bottom: 6px;
	}

	.fact p {
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.6;
		margin: 0;
	}

	.foot {
		padding: 0 20px 36px;
		text-align: center;
	}

	@media (max-width: 560px) {
		.hero {
			padding: 32px 16px 28px;
		}
		h1 {
			font-size: 26px;
		}
		.lede {
			font-size: 14px;
		}
		.modes,
		.facts {
			padding-left: 16px;
			padding-right: 16px;
		}
	}
</style>
