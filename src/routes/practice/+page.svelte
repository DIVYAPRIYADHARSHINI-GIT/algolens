<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.js';
	import { generateQuestions, type Question } from '#lib/practice.js';
	import { SORTERS, type SortName } from '#lib/algorithms/sorting.js';
	import { SEARCHERS } from '#lib/algorithms/searching.js';
	import { PATHFINDERS } from '#lib/algorithms/pathfinding.js';
	import { runGraphAlgorithm } from '#lib/algorithms/graph.js';
	import { makeGrid, randomWalls, randomWeights, type Grid } from '#lib/algorithms/grid.js';
	import { sampleGraph } from '#lib/data/samples.js';
	import { generateInput } from '#lib/data/presets.js';
	import { replayTo } from '#lib/core/state.js';
	import type { Trace } from '#lib/core/types.js';
	import ArrayView from '#lib/components/ArrayView.svelte';
	import GridView from '#lib/components/GridView.svelte';
	import Icon from '#lib/components/Icon.svelte';

	type Topic = 'sorting' | 'searching' | 'pathfinding' | 'graphs';

	let topic = $state<Topic>('sorting');
	let sortAlgo = $state<SortName>('bubble');
	let seed = $state(1000 + Math.floor(Math.random() * 9000));
	let questions = $state<Question[]>([]);
	let current = $state(0);
	let chosen = $state<number | null>(null);
	let streak = $state(0);
	let roundCorrect = $state(0);
	let roundAnswered = $state(0);

	const graph = sampleGraph();
	let grid = $state<Grid>(randomWeights(randomWalls(makeGrid(14, 10), 5), 5));
	let sortValues = $state<number[]>(generateInput('random', 10, 1000));

	const trace = $derived.by<Trace>(() => {
		if (topic === 'sorting') return SORTERS[sortAlgo](sortValues, { seed });
		if (topic === 'searching') {
			const sorted = [...sortValues].sort((a, b) => a - b);
			return SEARCHERS.binary(sorted, sorted[Math.floor(sorted.length / 2)]);
		}
		if (topic === 'pathfinding') return PATHFINDERS.dijkstra(grid);
		return runGraphAlgorithm('dijkstra', graph, { start: 'n1', end: 'n6' });
	});

	function labelFor(id: string): string {
		if (topic === 'graphs') {
			const node = graph.nodes.find((n) => n.id === id);
			if (node) return `Node ${node.label}`;
			const edge = graph.edges.find((e) => e.id === id);
			if (edge) {
				const a = graph.nodes.find((n) => n.id === edge.from)?.label ?? edge.from;
				const b = graph.nodes.find((n) => n.id === edge.to)?.label ?? edge.to;
				return `${a} to ${b} (weight ${edge.weight})`;
			}
			return id;
		}
		const i = Number(id);
		if (!Number.isFinite(i)) return id;
		return `Cell (${i % grid.cols}, ${Math.floor(i / grid.cols)})`;
	}

	function newRound() {
		if (topic === 'sorting' || topic === 'searching') sortValues = generateInput('random', 10, seed);
		if (topic === 'pathfinding') grid = randomWeights(randomWalls(makeGrid(14, 10), seed), seed);
		questions = generateQuestions(trace, labelFor, 8, seed);
		current = 0;
		chosen = null;
		roundCorrect = 0;
		roundAnswered = 0;
	}

	onMount(() => {
		app.setMode('practice');
		newRound();
	});

	// Rebuild the quiz whenever the topic or algorithm changes.
	$effect(() => {
		void topic;
		void sortAlgo;
		questions = generateQuestions(trace, labelFor, 8, seed);
		current = 0;
		chosen = null;
	});

	const question = $derived(questions[current] ?? null);
	const stateAt = $derived(question ? replayTo(trace, question.atStep) : replayTo(trace, 0));

	function answer(index: number) {
		if (chosen !== null || !question) return;
		chosen = index;
		roundAnswered++;
		const right = index === question.correctIndex;
		if (right) {
			roundCorrect++;
			streak++;
		} else {
			streak = 0;
		}
		app.update((d) => ({
			...d,
			practice: {
				answered: d.practice.answered + 1,
				correct: d.practice.correct + (right ? 1 : 0),
				bestStreak: Math.max(d.practice.bestStreak, right ? streak : 0)
			}
		}));
	}

	function next() {
		chosen = null;
		if (current + 1 < questions.length) {
			current++;
		} else {
			seed = seed + 1;
			newRound();
		}
	}

	const accuracy = $derived(
		app.settings.practice.answered
			? Math.round((app.settings.practice.correct / app.settings.practice.answered) * 100)
			: 0
	);
</script>

<svelte:head>
	<title>Practice - AlgoLens</title>
	<meta name="description" content="Predict what an algorithm does next. Every question is generated from a real recorded run, so the answer is always what the algorithm really did." />
</svelte:head>

<div class="page">
	<header class="head">
		<div>
			<h1>Practice</h1>
			<p class="muted">
				Every question is generated from a real recorded run, so the correct answer is whatever the
				algorithm actually did next - it can never disagree with the animation.
			</p>
		</div>
		<div class="scores">
			<span class="score"><span class="muted">Streak</span><strong class="num" data-testid="streak">{streak}</strong></span>
			<span class="score"><span class="muted">This round</span><strong class="num">{roundCorrect}/{roundAnswered}</strong></span>
			<span class="score"><span class="muted">All time</span><strong class="num">{accuracy}%</strong></span>
			<span class="score"><span class="muted">Best streak</span><strong class="num">{app.settings.practice.bestStreak}</strong></span>
		</div>
	</header>

	<div class="bar panel">
		<div class="field inline">
			<label for="p-topic">Topic</label>
			<span class="select-wrap">
				<select id="p-topic" bind:value={topic}>
					<option value="sorting">Sorting</option>
					<option value="searching">Searching</option>
					<option value="pathfinding">Pathfinding</option>
					<option value="graphs">Graphs</option>
				</select>
			</span>
		</div>
		{#if topic === 'sorting'}
			<div class="field inline">
				<label for="p-algo">Algorithm</label>
				<span class="select-wrap">
					<select id="p-algo" bind:value={sortAlgo}>
						<option value="bubble">Bubble sort</option>
						<option value="selection">Selection sort</option>
						<option value="insertion">Insertion sort</option>
						<option value="quick">Quick sort</option>
						<option value="heap">Heap sort</option>
					</select>
				</span>
			</div>
		{/if}
		<button class="btn" onclick={() => { seed = seed + 1; newRound(); }}>
			<Icon name="shuffle" size={14} /> New questions
		</button>
	</div>

	{#if !question}
		<div class="panel empty">
			<Icon name="practice" size={24} />
			<h2>No questions for this setup</h2>
			<p class="muted">This run was too short to make questions from. Choose New questions or a different topic.</p>
		</div>
	{:else}
		<div class="quiz">
			<section class="panel state">
				<h2>State before this step</h2>
				{#if topic === 'pathfinding'}
					<GridView {grid} viewState={stateAt} tool="wall" weight={1} onedit={() => {}} disabled={true} />
				{:else if topic === 'graphs'}
					<div class="graphstate">
						<table>
							<caption class="sr-only">Distances before this step</caption>
							<thead><tr><th scope="col">Node</th><th scope="col" class="num">Distance</th></tr></thead>
							<tbody>
								{#each graph.nodes as node (node.id)}
									<tr>
										<td>{node.label}</td>
										<td class="num">{Number.isFinite(stateAt.dist[node.id]) ? stateAt.dist[node.id] : '∞'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<ArrayView viewState={stateAt} view="cells" pointerKeys={['lo', 'mid', 'hi', 'min', 'key', 'pivot']} />
				{/if}
				<p class="ctx">{question.context}</p>
			</section>

			<section class="panel ask">
				<p class="count muted">Question {current + 1} of {questions.length}</p>
				<h2 data-testid="question">{question.prompt}</h2>
				<ul class="options">
					{#each question.options as option, i (option)}
						<li>
							<button
								class="option"
								class:correct={chosen !== null && i === question.correctIndex}
								class:wrong={chosen === i && i !== question.correctIndex}
								disabled={chosen !== null}
								onclick={() => answer(i)}
								data-testid={`option-${i}`}
							>
								<span class="key num">{String.fromCharCode(65 + i)}</span>
								<span>{option}</span>
								{#if chosen !== null && i === question.correctIndex}
									<Icon name="check" size={15} />
								{:else if chosen === i}
									<Icon name="close" size={15} />
								{/if}
							</button>
						</li>
					{/each}
				</ul>

				{#if chosen !== null}
					<div
						class="feedback"
						class:ok={chosen === question.correctIndex}
						role="status"
						aria-live="polite"
						data-testid="feedback"
					>
						<strong>{chosen === question.correctIndex ? 'Correct.' : 'Not this time.'}</strong>
						<span>{question.explanation}</span>
					</div>
					<button class="btn btn-primary" onclick={next} data-testid="next-question">
						{current + 1 < questions.length ? 'Next question' : 'New round'}
					</button>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		max-width: 1180px;
		margin: 0 auto;
		width: 100%;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.head h1 {
		font-size: 20px;
		margin-bottom: 4px;
	}

	.head p {
		max-width: 620px;
		margin: 0;
	}

	.scores {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.score {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 72px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--panel);
	}

	.score strong {
		font-size: 16px;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
		padding: 12px;
	}

	.field.inline {
		margin: 0;
		min-width: 150px;
	}

	.quiz {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 12px;
	}

	.state,
	.ask {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.state h2,
	.ask h2 {
		font-size: 15px;
		padding: 12px 12px 0;
		margin: 0;
	}

	.ask {
		padding-bottom: 12px;
	}

	.count {
		padding: 12px 12px 0;
		margin: 0;
	}

	.ctx {
		margin: 0;
		padding: 10px 12px 12px;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink-2);
		border-top: 1px solid var(--border);
		word-break: break-word;
	}

	.graphstate {
		padding: 12px;
	}

	.options {
		list-style: none;
		margin: 12px 0 0;
		padding: 0 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		background: var(--panel);
		text-align: left;
		font-size: 13px;
	}

	.option:hover:not(:disabled) {
		background: var(--panel-2);
		border-color: var(--ink-3);
	}

	.option:disabled {
		cursor: default;
	}

	.option .key {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		background: var(--panel-2);
		font-size: 11px;
		font-weight: 700;
		flex: none;
	}

	.option span:nth-child(2) {
		flex: 1;
	}

	.option.correct {
		border-color: var(--ok);
		background: var(--ok-bg);
		color: var(--ok);
	}

	.option.wrong {
		border-color: var(--danger);
		background: var(--danger-bg);
		color: var(--danger);
	}

	.feedback {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 12px 12px 10px;
		padding: 10px 12px;
		border-left: 3px solid var(--danger);
		border-radius: 0 var(--r-sm) var(--r-sm) 0;
		background: var(--danger-bg);
		font-size: 13px;
		color: var(--ink);
	}

	.feedback.ok {
		border-left-color: var(--ok);
		background: var(--ok-bg);
	}

	.ask :global(.btn-primary) {
		margin: 0 12px;
		align-self: flex-start;
	}

	.empty {
		display: grid;
		place-items: center;
		gap: 6px;
		padding: 48px 20px;
		text-align: center;
		color: var(--ink-3);
	}

	.empty h2 {
		font-size: 15px;
		color: var(--ink);
		padding: 0;
	}

	@media (max-width: 900px) {
		.quiz {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
