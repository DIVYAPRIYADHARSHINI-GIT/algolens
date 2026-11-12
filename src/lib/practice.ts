// Practice question generator.
//
// Questions are generated FROM the real recorded trace, so the correct answer is by
// construction whatever the algorithm actually did next. There is no separate answer key
// that could disagree with the animation.

import { mulberry32 } from './core/rng.js';
import type { Step, Trace } from './core/types.js';
import { replayTo } from './core/state.js';

export interface Question {
	id: string;
	prompt: string;
	/** State shown to the learner: the trace replayed to `atStep` steps. */
	atStep: number;
	options: string[];
	correctIndex: number;
	explanation: string;
	context: string;
}

/** Which step kinds make a good "what happens next" question, per family. */
const INTERESTING: Record<string, Step['kind'][]> = {
	sorting: ['compare', 'swap', 'set-pivot'],
	searching: ['compare'],
	pathfinding: ['dequeue', 'pop', 'relax'],
	graph: ['dequeue', 'pop', 'select-edge', 'relax']
};

export function generateQuestions(trace: Trace, labelFor: (id: string) => string, count: number, seed: number): Question[] {
	const rand = mulberry32(seed);
	const kinds = INTERESTING[trace.family] ?? ['compare'];
	const candidates: number[] = [];
	for (let i = 0; i < trace.steps.length; i++) {
		if (kinds.includes(trace.steps[i].kind)) candidates.push(i);
	}
	if (!candidates.length) return [];

	const questions: Question[] = [];
	const used = new Set<number>();
	let guard = 0;
	while (questions.length < count && guard < count * 40) {
		guard++;
		const pick = candidates[Math.floor(rand() * candidates.length)];
		if (used.has(pick)) continue;
		used.add(pick);
		const question = buildQuestion(trace, pick, labelFor, rand);
		if (question) questions.push(question);
	}
	return questions;
}

function buildQuestion(
	trace: Trace,
	index: number,
	labelFor: (id: string) => string,
	rand: () => number
): Question | null {
	const step = trace.steps[index];
	const before = replayTo(trace, index);

	if (trace.family === 'sorting' && step.kind === 'compare') {
		// Which two values are compared next?
		const touched = step.patch.filter((p) => p.t === 'tag') as { t: 'tag'; i: number }[];
		if (touched.length < 2) return null;
		const [a, b] = [touched[0].i, touched[1].i];
		const correct = `${before.array[a]} and ${before.array[b]}`;
		const options = new Set<string>([correct]);
		let tries = 0;
		while (options.size < 4 && tries < 60) {
			tries++;
			const x = Math.floor(rand() * before.array.length);
			const y = Math.floor(rand() * before.array.length);
			if (x === y) continue;
			options.add(`${before.array[x]} and ${before.array[y]}`);
		}
		return finish({
			id: `sort-cmp-${index}`,
			prompt: 'Which two values does the algorithm compare next?',
			atStep: index,
			correct,
			options: [...options],
			explanation: step.explain,
			context: `Array: ${before.array.join(', ')}`,
			rand
		});
	}

	if (trace.family === 'sorting' && step.kind === 'swap') {
		const writes = step.patch.filter((p) => p.t === 'arr') as { t: 'arr'; i: number; v: number }[];
		if (writes.length < 2) return null;
		const correct = 'They are swapped';
		return finish({
			id: `sort-swap-${index}`,
			prompt: `Positions ${writes[0].i} and ${writes[1].i} hold ${before.array[writes[0].i]} and ${before.array[writes[1].i]}. What happens next?`,
			atStep: index,
			correct,
			options: ['They are swapped', 'They are left as they are', 'The left value is overwritten', 'The pivot moves between them'],
			explanation: step.explain,
			context: `Array: ${before.array.join(', ')}`,
			rand
		});
	}

	if (trace.family === 'searching' && step.kind === 'compare') {
		const mid = step.patch.find((p) => p.t === 'tag') as { t: 'tag'; i: number } | undefined;
		if (!mid) return null;
		const correct = `Position ${mid.i}`;
		const options = new Set<string>([correct]);
		let tries = 0;
		while (options.size < 4 && tries < 60) {
			tries++;
			const i = Math.floor(rand() * before.array.length);
			options.add(`Position ${i}`);
		}
		return finish({
			id: `search-${index}`,
			prompt: 'Which position does the search examine next?',
			atStep: index,
			correct,
			options: [...options],
			explanation: step.explain,
			context:
				before.range.lo === null
					? `Array: ${before.array.join(', ')}`
					: `Search range: positions ${before.range.lo} to ${before.range.hi}`,
			rand
		});
	}

	if ((trace.family === 'pathfinding' || trace.family === 'graph') && (step.kind === 'dequeue' || step.kind === 'pop')) {
		const taken = step.patch.find((p) => p.t === 'cell' || p.t === 'node') as
			| { t: 'cell'; i: number }
			| { t: 'node'; id: string }
			| undefined;
		if (!taken) return null;
		const correctId = taken.t === 'cell' ? String(taken.i) : taken.id;
		const correct = labelFor(correctId);
		const options = new Set<string>([correct]);
		for (const entry of before.queue) {
			if (options.size >= 4) break;
			options.add(labelFor(entry.id));
		}
		if (options.size < 2) return null;
		return finish({
			id: `nav-${index}`,
			prompt: 'Which one does the algorithm take from its frontier next?',
			atStep: index,
			correct,
			options: [...options],
			explanation: step.explain,
			context: `Frontier: ${before.queue.map((q) => `${labelFor(q.id)}${q.key === undefined ? '' : ` (${q.key})`}`).join(', ') || 'empty'}`,
			rand
		});
	}

	if (step.kind === 'select-edge') {
		const chosen = step.patch.find((p) => p.t === 'edge') as { t: 'edge'; id: string } | undefined;
		if (!chosen) return null;
		const correct = labelFor(chosen.id);
		const options = new Set<string>([correct]);
		for (const entry of before.queue) {
			if (options.size >= 4) break;
			options.add(labelFor(entry.id));
		}
		if (options.size < 2) return null;
		return finish({
			id: `edge-${index}`,
			prompt: 'Which edge joins the tree next?',
			atStep: index,
			correct,
			options: [...options],
			explanation: step.explain,
			context: `Offered edges: ${before.queue.map((q) => `${labelFor(q.id)}${q.key === undefined ? '' : ` (${q.key})`}`).join(', ') || 'none'}`,
			rand
		});
	}

	if (step.kind === 'relax') {
		const dist = step.patch.find((p) => p.t === 'dist') as { t: 'dist'; id: string; v: number } | undefined;
		if (!dist) return null;
		const correct = String(dist.v);
		const options = new Set<string>([correct]);
		const deltas = [1, -1, 2, -2, 3];
		for (const d of deltas) {
			if (options.size >= 4) break;
			const alt = dist.v + d;
			if (alt >= 0) options.add(String(alt));
		}
		return finish({
			id: `relax-${index}`,
			prompt: `What does the distance to ${labelFor(dist.id)} become after this relaxation?`,
			atStep: index,
			correct,
			options: [...options],
			explanation: step.explain,
			context: `Its current distance is ${Number.isFinite(before.dist[dist.id]) ? before.dist[dist.id] : 'infinity'}.`,
			rand
		});
	}

	return null;
}

function finish(input: {
	id: string;
	prompt: string;
	atStep: number;
	correct: string;
	options: string[];
	explanation: string;
	context: string;
	rand: () => number;
}): Question | null {
	const unique = [...new Set(input.options)].slice(0, 4);
	if (unique.length < 2) return null;
	// Shuffle deterministically so a given seed always produces the same quiz.
	const shuffled = [...unique];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(input.rand() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	const correctIndex = shuffled.indexOf(input.correct);
	if (correctIndex < 0) return null;
	return {
		id: input.id,
		prompt: input.prompt,
		atStep: input.atStep,
		options: shuffled,
		correctIndex,
		explanation: input.explanation,
		context: input.context
	};
}
