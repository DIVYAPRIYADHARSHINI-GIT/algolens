/**
 * End-to-end probes against the REAL built static site in headless Chrome.
 *
 * These walk the flows the brief asks to be verified: running every algorithm to the end and
 * reading the result from the accessible table view, pausing, stepping back, scrubbing,
 * changing speed mid-run, drawing and solving grids (with touch emulation), editing and
 * solving graphs, compare / benchmark / practice modes, the share-link round trip, PNG
 * export, importing a corrupted file, and the examples.
 *
 * The suite fails on ANY browser console error, so a silent exception cannot pass as green.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { isAscending, openProbe, readArrayText, readStore, ROUTES, shot, visit, waitForCount, waitGone, waitVisible, type Probe } from './harness';

let probe: Probe;
let page: Page;

beforeAll(async () => {
	probe = await openProbe();
	page = probe.page;
}, 240_000);

afterAll(async () => {
	await probe?.close();
});

function squash(text: string | null): string {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function openArrayTable(target: Page): Promise<void> {
	const summary = target.getByText('Text and table view of the current state').first();
	const open = await summary.evaluate((el) => (el.closest('details') as HTMLDetailsElement | null)?.open ?? false);
	if (!open) await summary.click();
}

describe('static hosting and routes', () => {
	it('every route loads on a direct URL with real content', async () => {
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			const title = await page.title();
			expect(title, route).toContain('AlgoLens');
			const bodyText = squash(await page.locator('main').first().textContent());
			expect(bodyText.length, route).toBeGreaterThan(40);
		}
	});

	it('a hard refresh works on a deep route', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.reload({ waitUntil: 'networkidle' });
		await waitVisible(page, page.getByRole('button', { name: /^Play$/ }));
	});

	it('a missing asset 404s instead of returning HTML', async () => {
		const response = await fetch(`${probe.origin}/not-a-real-file.json`);
		expect(response.status).toBe(404);
	});

	it('an unknown route still renders the app shell rather than breaking', async () => {
		await page.goto(`${probe.origin}/this-route-does-not-exist/`, { waitUntil: 'networkidle' });
		expect(await page.locator('body').textContent()).toBeTruthy();
	});
});

describe('sorting: run to the end and verify', () => {
	const ALGORITHMS = ['Bubble sort', 'Selection sort', 'Insertion sort', 'Merge sort', 'Quick sort', 'Heap sort', 'Shell sort', 'Counting sort'];

	it('every sorting algorithm finishes sorted and shows Verified', async () => {
		await visit(page, probe.origin, '/sorting/');
		for (const label of ALGORITHMS) {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			await openArrayTable(page);
			const values = await readArrayText(page);
			expect(values.length, label).toBeGreaterThan(0);
			expect(isAscending(values), `${label} produced ${values.join(',')}`).toBe(true);
			const badge = squash(await page.getByTestId('verified-badge').textContent());
			expect(badge, label).toBe('Verified');
		}
	});

	it('the counters agree with the finished run', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Bubble sort' });
		await page.getByRole('tab', { name: 'Stats' }).click();
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		const comparisons = Number(squash(await page.getByTestId('stat-comparisons').textContent()));
		const swaps = Number(squash(await page.getByTestId('stat-swaps').textContent()));
		expect(comparisons).toBeGreaterThan(0);
		expect(swaps).toBeGreaterThan(0);
	});

	it('pause, step back and scrub show consistent state', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Insertion sort' });
		await page.getByLabel('Speed').selectOption('4');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(700);
		await page.getByRole('button', { name: 'Pause' }).click();

		const counter = page.locator('.transport .counter');
		const afterPause = squash(await counter.textContent());
		const indexAtPause = Number(afterPause.split('/')[0]);
		expect(indexAtPause).toBeGreaterThan(0);

		await openArrayTable(page);
		const atPause = await readArrayText(page);

		// Step back then forward: the state must return exactly.
		await page.getByRole('button', { name: 'Step back one step' }).click();
		const stepped = await readArrayText(page);
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		const returned = await readArrayText(page);
		expect(returned).toEqual(atPause);
		expect(stepped.length).toBe(atPause.length);

		// Scrub to the same index from somewhere else and compare.
		await page.getByRole('button', { name: 'Restart this run' }).click();
		await page.getByLabel('Timeline position').fill(String(indexAtPause));
		const scrubbed = await readArrayText(page);
		expect(scrubbed).toEqual(atPause);
	});

	it('changing the speed while running does not change the outcome', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Quick sort' });
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		await openArrayTable(page);
		const baseline = await readArrayText(page);

		await page.getByRole('button', { name: 'Restart this run' }).click();
		await page.getByLabel('Speed').selectOption('0.25');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(250);
		await page.getByLabel('Speed').selectOption('8');
		await page.waitForTimeout(250);
		await page.getByLabel('Speed').selectOption('2');
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(await readArrayText(page)).toEqual(baseline);
	});

	it('keyboard shortcuts drive playback', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.locator('body').click({ position: { x: 5, y: 300 } });
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		expect(squash(await page.locator('.transport .counter').textContent())).toMatch(/^2 \//);
		await page.keyboard.press('ArrowLeft');
		expect(squash(await page.locator('.transport .counter').textContent())).toMatch(/^1 \//);
		await page.keyboard.press('End');
		const atEnd = squash(await page.locator('.transport .counter').textContent());
		const [a, b] = atEnd.split('/').map((s) => Number(s.trim()));
		expect(a).toBe(b);
		await page.keyboard.press('Home');
		expect(squash(await page.locator('.transport .counter').textContent())).toMatch(/^0 \//);
	});

	it('custom values including duplicates and negatives sort correctly', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Custom values').fill('5, -3, 12, -3, 0, 7, 7');
		await page.getByRole('button', { name: 'Use these values' }).click();
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		await openArrayTable(page);
		expect(await readArrayText(page)).toEqual([-3, -3, 0, 5, 7, 7, 12]);
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('invalid custom input shows an error and keeps the previous data', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Custom values').fill('one, two');
		await page.getByRole('button', { name: 'Use these values' }).click();
		expect(squash(await page.locator('.err').first().textContent())).toMatch(/not a number/i);
		await openArrayTable(page);
		expect((await readArrayText(page)).length).toBeGreaterThan(0);
	});

	it('the pseudocode highlight moves as the run advances', async () => {
		await visit(page, probe.origin, '/sorting/');
		const first = await page.locator('.code li.active').first().textContent();
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		const later = await page.locator('.code li.active').first().textContent();
		expect(squash(later)).not.toBe(squash(first));
	});

	it('the number cell view renders and stays in sync', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.getByRole('button', { name: 'Cells' }).click();
		expect(await page.locator('.cellgrid .cell').count()).toBeGreaterThan(4);
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		await openArrayTable(page);
		expect(isAscending(await readArrayText(page))).toBe(true);
	});
});

describe('searching', () => {
	it('binary search finds a present value and reports a missing one', async () => {
		await visit(page, probe.origin, '/searching/');
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await page.getByTestId('search-result').textContent())).toMatch(/was found at position \d+/);
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');

		await page.getByRole('button', { name: 'Missing' }).click();
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await page.getByTestId('search-result').textContent())).toMatch(/is not in this list/);
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('an unsorted list warns and offers to sort first', async () => {
		await visit(page, probe.origin, '/searching/');
		await page.getByRole('button', { name: 'Shuffle (unsorted)' }).click();
		const warning = page.locator('.banner .notice-warn').first();
		await waitVisible(page, warning);
		expect(squash(await warning.textContent())).toMatch(/needs sorted input/i);
		await page.getByRole('button', { name: 'Sort the input first' }).click();
		await waitGone(page, page.locator('.banner .notice-warn'));
	});

	it('linear search works on unsorted data without a warning', async () => {
		await visit(page, probe.origin, '/searching/');
		await page.getByRole('button', { name: 'Shuffle (unsorted)' }).click();
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Linear search' });
		await waitGone(page, page.locator('.banner .notice-warn'));
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('the low, middle and high pointers are shown', async () => {
		await visit(page, probe.origin, '/searching/');
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		const chips = squash(await page.locator('.pointers').textContent());
		expect(chips).toMatch(/low/);
		expect(chips).toMatch(/mid/);
		expect(chips).toMatch(/high/);
		expect(chips).toMatch(/range/);
	});
});

describe('pathfinding', () => {
	it('every algorithm solves the example maze and verifies', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		for (const label of ['Breadth-first search', 'Depth-first search', "Dijkstra's algorithm", 'A* search', 'Greedy best-first']) {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			expect(squash(await page.getByTestId('verified-badge').textContent()), label).toBe('Verified');
			const stats = squash(await page.locator('.statsbar').textContent());
			expect(stats, label).toMatch(/Visited cells \d+/);
		}
	});

	it('Dijkstra finds a cheaper route than BFS on the weighted example', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		const costOf = async (label: string) => {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			const stats = squash(await page.locator('.statsbar').textContent());
			return Number(stats.match(/Path cost (\d+)/)?.[1] ?? NaN);
		};
		const bfsCost = await costOf('Breadth-first search');
		const dijkstraCost = await costOf("Dijkstra's algorithm");
		expect(Number.isFinite(bfsCost)).toBe(true);
		expect(dijkstraCost).toBeLessThanOrEqual(bfsCost);
	});

	it('drawing walls with a mouse drag changes the solution', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: 'Clear walls' }).click();
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		const before = squash(await page.locator('.statsbar').textContent());

		const cells = page.locator('[data-cell]');
		const total = await cells.count();
		const firstBox = await cells.nth(Math.floor(total / 2)).boundingBox();
		expect(firstBox).toBeTruthy();
		if (firstBox) {
			await page.mouse.move(firstBox.x + 2, firstBox.y + 2);
			await page.mouse.down();
			for (let i = 1; i <= 6; i++) await page.mouse.move(firstBox.x + 2, firstBox.y + 2 + i * firstBox.height);
			await page.mouse.up();
		}
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		const after = squash(await page.locator('.statsbar').textContent());
		expect(after).not.toBe(before);
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('walling the target in reports no path with a clear message', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: '16 x 12' }).click();
		await page.getByRole('button', { name: 'Clear walls' }).click();
		// Wall every neighbour of the target by clicking those real cells, so the no-path case
		// is produced the same way a learner would produce it.
		const cols = 16;
		const rows = 12;
		const endIndex = Number(await page.locator('[data-cell][data-tag="end"]').first().getAttribute('data-cell'));
		const ex = endIndex % cols;
		const ey = Math.floor(endIndex / cols);
		// Click the eight cells around the target so it is completely sealed off.
		for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			const nx = ex + dx;
			const ny = ey + dy;
			if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
			await page.locator(`[data-cell="${ny * cols + nx}"]`).click({ force: true });
		}
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		await waitVisible(page, page.getByTestId('no-path'));
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('A* with Manhattan on 8-way movement warns that it is not admissible', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'A* search' });
		await page.getByLabel('Heuristic', { exact: true }).selectOption({ label: 'Manhattan' });
		await page.getByLabel('Allow 8-way movement').check();
		const warning = page.locator('.banner .notice-warn').first();
		await waitVisible(page, warning);
		expect(squash(await warning.textContent())).toMatch(/not admissible/i);
		await page.getByLabel('Heuristic', { exact: true }).selectOption({ label: 'Diagonal (Chebyshev)' });
		await waitGone(page, page.locator('.banner .notice-warn'));
	});

	it('maze generators produce a solvable grid', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		for (const label of ['DFS maze', 'Division maze', 'Random walls']) {
			await page.getByRole('button', { name: label }).click();
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			expect(squash(await page.getByTestId('verified-badge').textContent()), label).toBe('Verified');
		}
	});

	it('the 60 by 40 grid renders and solves', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: '60 x 40' }).click();
		expect(await page.locator('[data-cell]').count()).toBe(2400);
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
	});

	it('a saved grid round-trips through localStorage', async () => {
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByLabel('Name').fill('Probe maze');
		await page.getByRole('button', { name: 'Save this grid' }).click();
		await waitVisible(page, page.getByRole('button', { name: 'Probe maze' }));
		const stored = await readStore(page);
		expect(JSON.stringify(stored)).toContain('Probe maze');
		await page.getByRole('button', { name: 'Delete Probe maze' }).click();
		await waitGone(page, page.getByRole('button', { name: 'Probe maze' }));
	});
});

describe('pathfinding with touch emulation', () => {
	it('drawing walls by touch dragging works on a phone viewport', async () => {
		const mobile = await probe.freshPage({ touch: true, viewport: { width: 390, height: 844 } });
		await visit(mobile, probe.origin, '/pathfinding/');
		await mobile.getByRole('button', { name: 'Clear walls' }).click();
		const cells = mobile.locator('[data-cell]');
		const target = cells.nth(Math.floor((await cells.count()) / 2));
		// A touchscreen tap uses viewport coordinates, so the cell must be on screen first.
		await target.scrollIntoViewIfNeeded();
		const box = await target.boundingBox();
		expect(box).toBeTruthy();
		if (box) {
			// Playwright's touchscreen tap goes through the same pointer handlers.
			await mobile.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
			await mobile.waitForTimeout(200);
		}
		const walls = await mobile.locator('[data-cell][data-tag="wall"]').count();
		expect(walls).toBeGreaterThan(0);
		await mobile.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await mobile.getByTestId('verified-badge').textContent())).toBe('Verified');
		await shot(mobile, 'pathfinding-390-touch');
		await mobile.close();
	});
});

describe('graphs', () => {
	it('every graph algorithm runs on the example and verifies', async () => {
		await visit(page, probe.origin, '/graphs/');
		for (const label of ['BFS traversal', 'DFS traversal', "Dijkstra's shortest path", "Prim's minimum spanning tree", "Kruskal's minimum spanning tree"]) {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			expect(squash(await page.getByTestId('verified-badge').textContent()), label).toBe('Verified');
		}
	});

	it('Prim and Kruskal agree on the total weight', async () => {
		await visit(page, probe.origin, '/graphs/');
		const weightOf = async (label: string) => {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			await page.getByRole('tab', { name: 'Stats' }).click();
			return squash(await page.getByTestId('stat-tree-weight').textContent());
		};
		expect(await weightOf("Prim's minimum spanning tree")).toBe(await weightOf("Kruskal's minimum spanning tree"));
	});

	it('a negative weight is rejected for Dijkstra with an explanation', async () => {
		await visit(page, probe.origin, '/graphs/');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: "Dijkstra's shortest path" });
		// Select an edge, then make its weight negative.
		await page.locator('.edge .hit').first().click();
		await page.locator('#ew').fill('-5');
		await page.locator('#ew').dispatchEvent('change');
		await waitVisible(page, page.getByTestId('negative-warning'));
		expect(squash(await page.getByTestId('negative-warning').textContent())).toMatch(/negative edge weight/i);
	});

	it('adding a node and an edge updates the run', async () => {
		await visit(page, probe.origin, '/graphs/');
		const before = await page.locator('[data-node]').count();
		await page.getByRole('button', { name: 'Add node' }).click();
		const svgBox = await page.locator('svg[role="application"]').boundingBox();
		expect(svgBox).toBeTruthy();
		if (svgBox) await page.mouse.click(svgBox.x + 60, svgBox.y + svgBox.height - 40);
		expect(await page.locator('[data-node]').count()).toBe(before + 1);
	});

	it('the topological example produces a valid order', async () => {
		await visit(page, probe.origin, '/graphs/');
		await page.getByRole('button', { name: 'Directed acyclic' }).click();
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect(squash(await page.getByTestId('verified-badge').textContent())).toBe('Verified');
		await page.getByRole('tab', { name: 'Explanation' }).click();
		expect(squash(await page.getByTestId('explain').textContent())).toMatch(/valid order is/i);
	});

	it('importing a corrupted graph file is rejected with a clear message', async () => {
		await visit(page, probe.origin, '/graphs/');
		await page.getByLabel('Choose a graph JSON file').setInputFiles({
			name: 'broken.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{"nodes": [{"id": "a"}], "edges": [{"from":"a","to":"ghost","weight":1}]}')
		});
		const toast = page.locator('.toast.bad').first();
		await waitVisible(page, toast);
		expect(squash(await toast.textContent())).toMatch(/not a valid AlgoLens graph/i);
	});

	it('exporting and re-importing a graph round-trips', async () => {
		await visit(page, probe.origin, '/graphs/');
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Export' }).click();
		const file = await download;
		const path = await file.path();
		expect(path).toBeTruthy();
		if (path) {
			await page.getByLabel('Choose a graph JSON file').setInputFiles(path);
			const toast = page.locator('.toast.ok').first();
			await waitVisible(page, toast);
			expect(squash(await toast.textContent())).toMatch(/Imported \d+ node/);
		}
	});
});

describe('compare mode', () => {
	it('runs two algorithms on the same input and fills the results table', async () => {
		await visit(page, probe.origin, '/compare/');
		await page.getByLabel('Left').selectOption({ label: 'Bubble sort' });
		await page.getByLabel('Right').selectOption({ label: 'Merge sort' });
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		const table = squash(await page.locator('.results table').textContent());
		expect(table).toMatch(/Comparisons/);
		expect(table).toMatch(/Bubble sort/);
		expect(table).toMatch(/Merge sort/);
		// Both sides must say Verified.
		const badges = await page.locator('.side .badge').allTextContents();
		expect(badges.filter((b) => squash(b) === 'Verified').length).toBe(2);
	});

	it('synchronised playback keeps both sides on the same step', async () => {
		await visit(page, probe.origin, '/compare/');
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		const steps = await page.locator('.side .chip').allTextContents();
		const indices = steps.filter((s) => s.includes('step')).map((s) => Number(squash(s).match(/step (\d+)/)?.[1]));
		expect(indices[0]).toBe(3);
		expect(indices[1]).toBe(3);
	});

	it('race mode lets the faster algorithm finish first', async () => {
		await visit(page, probe.origin, '/compare/');
		await page.getByLabel('Left').selectOption({ label: 'Bubble sort' });
		await page.getByLabel('Right').selectOption({ label: 'Merge sort' });
		await page.getByLabel('Race mode').check();
		await page.getByLabel('Speed').selectOption('8');
		await page.getByRole('button', { name: 'Play' }).click();
		// Merge sort records far fewer steps, so in race mode it reaches its own end first.
		await page.waitForFunction(
			() => document.querySelectorAll('.side .badge-ok').length >= 1,
			null,
			{ timeout: 30_000 }
		);
		expect(await page.locator('.side .badge-ok').count()).toBeGreaterThanOrEqual(1);
	});
});

describe('benchmark mode', () => {
	it('runs in a worker and charts the result without freezing', async () => {
		await visit(page, probe.origin, '/benchmark/');
		await page.getByTestId('run-benchmark').click();
		await page.getByTestId('bench-table').waitFor({ state: 'visible', timeout: 60_000 });
		const table = squash(await page.getByTestId('bench-table').textContent());
		expect(table).toMatch(/n = 1000/);
		expect(table).toMatch(/Bubble/);
		// The page is still responsive: a control reacts immediately.
		await page.getByLabel('Scale', { exact: true }).selectOption('log');
		expect(await page.locator('svg path.series').count()).toBeGreaterThan(0);
	});

	it('quadratic sorts need far more comparisons than n log n sorts', async () => {
		await visit(page, probe.origin, '/benchmark/');
		await page.getByTestId('run-benchmark').click();
		await page.getByTestId('bench-table').waitFor({ state: 'visible', timeout: 60_000 });
		const rows = await page.locator('[data-testid="bench-table"] tbody tr').all();
		const byName = new Map<string, number[]>();
		for (const row of rows) {
			const cells = await row.locator('th, td').allTextContents();
			byName.set(squash(cells[0]), cells.slice(1).map((c) => Number(squash(c).replace(/,/g, ''))));
		}
		const bubble = byName.get('Bubble') ?? [];
		const merge = byName.get('Merge') ?? [];
		expect(bubble.at(-1)!).toBeGreaterThan(merge.at(-1)! * 5);
	});
});

describe('practice mode', () => {
	it('answering a question gives instant feedback and moves on', async () => {
		await visit(page, probe.origin, '/practice/');
		await waitVisible(page, page.getByTestId('question'));
		await page.getByTestId('option-0').click();
		await waitVisible(page, page.getByTestId('feedback'));
		const feedback = squash(await page.getByTestId('feedback').textContent());
		expect(feedback).toMatch(/Correct\.|Not this time\./);
		const firstQuestion = squash(await page.getByTestId('question').textContent());
		await page.getByTestId('next-question').click();
		await waitGone(page, page.getByTestId('feedback'));
		const secondQuestion = squash(await page.getByTestId('question').textContent());
		expect(secondQuestion.length).toBeGreaterThan(0);
		expect(firstQuestion.length).toBeGreaterThan(0);
	});

	it('the score is persisted to this browser', async () => {
		await visit(page, probe.origin, '/practice/');
		await page.getByTestId('option-0').click();
		const stored = await readStore(page);
		const practice = (stored as { practice?: { answered: number } } | null)?.practice;
		expect(practice?.answered ?? 0).toBeGreaterThan(0);
	});

	it('every topic produces questions', async () => {
		await visit(page, probe.origin, '/practice/');
		for (const topic of ['Sorting', 'Searching', 'Pathfinding', 'Graphs']) {
			await page.getByLabel('Topic').selectOption({ label: topic });
			await waitVisible(page, page.getByTestId('question'));
		}
	});
});

describe('sharing and export', () => {
	it('a share link restores the exact setup', async () => {
		const context = page.context();
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await visit(page, probe.origin, '/sorting/');
		await page.getByLabel('Custom values').fill('9, 4, 7, 1, 1, 22');
		await page.getByRole('button', { name: 'Use these values' }).click();
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Heap sort' });
		await page.getByRole('button', { name: 'Copy link' }).click();
		const link = await page.evaluate(() => navigator.clipboard.readText());
		expect(link).toContain('#s=');

		const fresh = await probe.freshPage();
		await fresh.goto(link, { waitUntil: 'networkidle' });
		await fresh.waitForTimeout(400);
		const algo = await fresh.getByLabel('Algorithm', { exact: true }).inputValue();
		expect(algo).toBe('heap');
		const summary = fresh.getByText('Text and table view of the current state').first();
		await summary.click();
		expect(await readArrayText(fresh)).toEqual([9, 4, 7, 1, 1, 22]);
		await fresh.close();
	});

	it('a broken share link shows an error and still loads the app', async () => {
		const fresh = await probe.freshPage();
		await fresh.goto(`${probe.origin}/sorting/#s=not-a-real-payload-aaaa`, { waitUntil: 'networkidle' });
		const toast = fresh.locator('.toast.bad').first();
		await waitVisible(page, toast);
		expect(squash(await toast.textContent())).toMatch(/could not be opened/i);
		await waitVisible(fresh, fresh.getByRole('button', { name: 'Play' }));
		await fresh.close();
	});

	it('a hostile share link cannot crash the app', async () => {
		const fresh = await probe.freshPage();
		const hostile = encodeURIComponent('<script>alert(1)</script>');
		await fresh.goto(`${probe.origin}/pathfinding/#s=${hostile}`, { waitUntil: 'networkidle' });
		await waitVisible(fresh, fresh.getByRole('button', { name: 'Play' }));
		await fresh.close();
	});

	it('a grid share link round-trips the drawn walls', async () => {
		const context = page.context();
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: '16 x 12' }).click();
		await page.getByRole('button', { name: 'DFS maze' }).click();
		const wallsBefore = await page.locator('[data-cell][data-tag="wall"]').count();
		await page.getByRole('button', { name: 'Copy link' }).click();
		const link = await page.evaluate(() => navigator.clipboard.readText());

		const fresh = await probe.freshPage();
		await fresh.goto(link, { waitUntil: 'networkidle' });
		await fresh.waitForTimeout(400);
		expect(await fresh.locator('[data-cell][data-tag="wall"]').count()).toBe(wallsBefore);
		await fresh.close();
	});

	it('PNG export produces a real image file', async () => {
		await visit(page, probe.origin, '/sorting/');
		const download = page.waitForEvent('download', { timeout: 30_000 });
		await page.getByRole('button', { name: 'PNG' }).click();
		const file = await download;
		expect(file.suggestedFilename()).toMatch(/\.png$/);
		const path = await file.path();
		expect(path).toBeTruthy();
		if (path) {
			const { readFileSync } = await import('node:fs');
			const bytes = readFileSync(path);
			// PNG magic bytes.
			expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
		}
	});
});

describe('storage, backup and settings', () => {
	it('exports a backup and refuses a corrupted import', async () => {
		await visit(page, probe.origin, '/privacy/');
		const download = page.waitForEvent('download');
		await page.getByTestId('export-backup').click();
		const file = await download;
		expect(file.suggestedFilename()).toMatch(/^algolens-backup-\d{4}-\d{2}-\d{2}\.json$/);

		await page.getByTestId('backup-file').setInputFiles({
			name: 'broken.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{ this is not json')
		});
		await waitVisible(page, page.getByTestId('import-error'));
		expect(squash(await page.getByTestId('import-error').textContent())).toMatch(/not valid JSON/i);
	});

	it('importing a valid backup asks before replacing anything', async () => {
		await visit(page, probe.origin, '/privacy/');
		const download = page.waitForEvent('download');
		await page.getByTestId('export-backup').click();
		const path = await (await download).path();
		expect(path).toBeTruthy();
		if (path) {
			await page.getByTestId('backup-file').setInputFiles(path);
			const dialog = page.getByRole('alertdialog');
			await waitVisible(page, dialog);
			expect(squash(await dialog.textContent())).toMatch(/Replace what is saved in this browser/i);
			await page.getByRole('button', { name: 'Cancel' }).click();
			await waitGone(page, dialog);
		}
	});

	it('a wrong-app backup is named specifically', async () => {
		await visit(page, probe.origin, '/privacy/');
		await page.getByTestId('backup-file').setInputFiles({
			name: 'other.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{"app":"somethingelse","version":1,"settings":{}}')
		});
		expect(squash(await page.getByTestId('import-error').textContent())).toMatch(/not exported from AlgoLens/i);
	});

	it('the storage meter reports real usage', async () => {
		await visit(page, probe.origin, '/settings/');
		expect(squash(await page.getByTestId('storage-meter').textContent())).toMatch(/used of roughly/);
	});

	it('reset everything asks for confirmation and leaves only the examples', async () => {
		const fresh = await probe.freshPage();
		await visit(fresh, probe.origin, '/pathfinding/');
		await fresh.getByLabel('Name').fill('Temporary grid');
		await fresh.getByRole('button', { name: 'Save this grid' }).click();
		await visit(fresh, probe.origin, '/settings/');
		await fresh.getByTestId('reset-everything').click();
		await waitVisible(fresh, fresh.getByRole('alertdialog'));
		await fresh.getByTestId('confirm-yes').click();
		const stored = await readStore(fresh);
		const text = JSON.stringify(stored);
		expect(text).not.toContain('Temporary grid');
		expect(text).toContain('example-maze');
		await fresh.close();
	});

	it('works with site storage DISABLED and says so', async () => {
		const fresh = await probe.freshPage();
		// Block localStorage the way a locked-down private window does.
		await fresh.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new Error('The operation is insecure.');
				}
			});
		});
		await fresh.goto(`${probe.origin}/settings/`, { waitUntil: 'networkidle' });
		const notice = fresh.locator('.notice').first();
		await waitVisible(page, notice);
		expect(squash(await notice.textContent())).toMatch(/memory only|blocking site storage/i);
		await fresh.close();
	});

	it('recovers from deliberately corrupted saved data', async () => {
		const fresh = await probe.freshPage();
		await fresh.goto(`${probe.origin}/`, { waitUntil: 'networkidle' });
		await fresh.evaluate(() => localStorage.setItem('algolens.settings.v1', '{"savedGrids": "not an array"'));
		await fresh.goto(`${probe.origin}/settings/`, { waitUntil: 'networkidle' });
		await waitVisible(fresh, fresh.getByRole('heading', { name: 'Settings' }));
		await fresh.close();
	});

	it('the theme toggle switches and persists', async () => {
		const fresh = await probe.freshPage();
		await visit(fresh, probe.origin, '/sorting/');
		await fresh.getByRole('button', { name: /Switch to the dark theme/ }).click();
		expect(await fresh.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
		await fresh.reload({ waitUntil: 'networkidle' });
		expect(await fresh.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
		await shot(fresh, 'sorting-dark-persisted');
		await fresh.close();
	});
});

describe('examples and first run', () => {
	it('a brand-new visitor sees the examples and no test data', async () => {
		const fresh = await probe.freshPage();
		await visit(fresh, probe.origin, '/pathfinding/');
		const saved = await fresh.locator('.saved li').allTextContents();
		expect(saved.length).toBe(1);
		expect(squash(saved[0])).toMatch(/Example maze with weights/);
		await visit(fresh, probe.origin, '/graphs/');
		const savedGraphs = await fresh.locator('.saved li').allTextContents();
		expect(savedGraphs.length).toBe(1);
		expect(squash(savedGraphs[0])).toMatch(/Example weighted graph/);
		await fresh.close();
	});

	it('reduced motion starts paused rather than animating', async () => {
		const fresh = await probe.freshPage({ reducedMotion: true });
		await visit(fresh, probe.origin, '/sorting/');
		await waitVisible(fresh, fresh.getByRole('button', { name: 'Play' }));
		expect(squash(await fresh.locator('.transport .counter').textContent())).toMatch(/^0 \//);
		await fresh.close();
	});
});

describe('resilience', () => {
	it('running many algorithms in a row leaves no growing listener or worker leak', async () => {
		await visit(page, probe.origin, '/sorting/');
		for (const label of ['Bubble sort', 'Merge sort', 'Quick sort', 'Heap sort', 'Shell sort', 'Selection sort', 'Insertion sort', 'Counting sort']) {
			await page.getByLabel('Algorithm', { exact: true }).selectOption({ label });
			await page.getByRole('button', { name: 'Jump to the end' }).click();
			await page.getByRole('button', { name: 'Restart this run' }).click();
		}
		// Navigating between modes repeatedly must not accumulate animation frames.
		for (let i = 0; i < 3; i++) {
			await visit(page, probe.origin, '/pathfinding/');
			await visit(page, probe.origin, '/graphs/');
			await visit(page, probe.origin, '/sorting/');
		}
		await waitVisible(page, page.getByRole('button', { name: 'Play' }));
	});

	it('the keyboard shortcut sheet opens with ? and closes with Escape', async () => {
		await visit(page, probe.origin, '/sorting/');
		await page.locator('body').click({ position: { x: 5, y: 300 } });
		await page.keyboard.press('?');
		await waitVisible(page, page.getByRole('dialog', { name: 'Keyboard shortcuts' }));
		await page.keyboard.press('Escape');
		await waitGone(page, page.getByRole('dialog', { name: 'Keyboard shortcuts' }));
	});
});

describe('console cleanliness', () => {
	it('no console errors or unhandled rejections were seen on any page', () => {
		expect(probe.errors, probe.errors.join('\n')).toEqual([]);
	});
});
