/**
 * Frame-rate and responsiveness measurements, as the brief asks for explicit numbers:
 * animating 100 bars, and animating a 60 by 40 grid. Frames are counted with
 * requestAnimationFrame inside the real page while playback runs at high speed.
 *
 * These assert a floor (the page must stay interactive), and print the measured numbers so
 * they can be quoted in the README and the final summary.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';
import { openProbe, visit, type Probe } from './harness';

let probe: Probe;

beforeAll(async () => {
	probe = await openProbe();
}, 240_000);

afterAll(async () => {
	await probe?.close();
});

/** Count real animation frames over `ms` while the page is doing whatever it is doing. */
async function measureFps(page: Page, ms: number): Promise<number> {
	return page.evaluate(async (duration) => {
		return new Promise<number>((resolve) => {
			let frames = 0;
			const started = performance.now();
			const tick = () => {
				frames++;
				if (performance.now() - started < duration) requestAnimationFrame(tick);
				else resolve(Math.round((frames / (performance.now() - started)) * 1000));
			};
			requestAnimationFrame(tick);
		});
	}, ms);
}

describe('frame rate while animating', () => {
	it('100 bars at 8x playback', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/sorting/');
		const size = page.locator('#size');
		await size.fill('100');
		await size.dispatchEvent('input');
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: 'Bubble sort' });
		await page.getByLabel('Speed').selectOption('8');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(300);
		const fps = await measureFps(page, 2000);
		// eslint-disable-next-line no-console
		console.log(`[perf] 100 bars, bubble sort at 8x: ${fps} fps`);
		expect(fps).toBeGreaterThan(30);
		await page.close();
	});

	it('100 bars at 1x playback', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/sorting/');
		const size = page.locator('#size');
		await size.fill('100');
		await size.dispatchEvent('input');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(300);
		const fps = await measureFps(page, 2000);
		// eslint-disable-next-line no-console
		console.log(`[perf] 100 bars at 1x: ${fps} fps`);
		expect(fps).toBeGreaterThan(30);
		await page.close();
	});

	it('60 by 40 grid during a Dijkstra run at 8x', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: '60 x 40' }).click();
		await page.getByRole('button', { name: 'Division maze' }).click();
		await page.getByLabel('Algorithm', { exact: true }).selectOption({ label: "Dijkstra's algorithm" });
		await page.getByLabel('Speed').selectOption('8');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(300);
		const fps = await measureFps(page, 2000);
		// eslint-disable-next-line no-console
		console.log(`[perf] 60x40 grid, Dijkstra at 8x: ${fps} fps`);
		expect(fps).toBeGreaterThan(24);
		await page.close();
	});

	it('the graph editor stays smooth while Dijkstra runs', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/graphs/');
		await page.getByLabel('Speed').selectOption('4');
		await page.getByRole('button', { name: 'Play' }).click();
		await page.waitForTimeout(200);
		const fps = await measureFps(page, 1500);
		// eslint-disable-next-line no-console
		console.log(`[perf] graph editor, Dijkstra at 4x: ${fps} fps`);
		expect(fps).toBeGreaterThan(30);
		await page.close();
	});
});

describe('the page never blocks', () => {
	it('the main thread stays responsive while the benchmark worker runs', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/benchmark/');
		await page.getByLabel('Sizes').selectOption('large');
		await page.getByTestId('run-benchmark').click();
		await page.waitForTimeout(400);
		// While the worker crunches 5,000-element sorts, the main thread must still paint.
		const fps = await measureFps(page, 1500);
		// eslint-disable-next-line no-console
		console.log(`[perf] main thread during a 100-5000 benchmark: ${fps} fps`);
		expect(fps).toBeGreaterThan(24);
		// And a control must still respond immediately.
		const started = Date.now();
		await page.getByLabel('Measure').selectOption('writes');
		expect(Date.now() - started).toBeLessThan(2000);
		await page.getByTestId('bench-table').waitFor({ state: 'visible', timeout: 70_000 });
		await page.close();
	});

	it('seeking through a long trace is fast', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/sorting/');
		const size = page.locator('#size');
		await size.fill('100');
		await size.dispatchEvent('input');
		await page.waitForTimeout(200);
		const total = Number(((await page.locator('.transport .counter').textContent()) ?? '0/0').split('/')[1]);
		expect(total).toBeGreaterThan(1000);
		const scrubber = page.getByLabel('Timeline position');
		const started = Date.now();
		for (const fraction of [0.9, 0.1, 0.75, 0.25, 1, 0]) {
			await scrubber.fill(String(Math.floor(total * fraction)));
		}
		const elapsed = Date.now() - started;
		// eslint-disable-next-line no-console
		console.log(`[perf] six seeks across a ${total}-step trace: ${elapsed} ms`);
		expect(elapsed).toBeLessThan(5000);
		await page.close();
	});
});
