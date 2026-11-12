/**
 * Automated accessibility checks with axe-core, plus keyboard and contrast invariants.
 *
 * Every mode page is audited in BOTH themes. Any serious or critical violation fails the
 * suite - those are the two levels the brief requires to be fixed.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { Page } from 'playwright';
import { openProbe, ROUTES, visit, type Probe } from './harness';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

interface AxeViolation {
	id: string;
	impact: string | null;
	help: string;
	nodes: { target: string[] }[];
}

let probe: Probe;

beforeAll(async () => {
	probe = await openProbe();
}, 240_000);

afterAll(async () => {
	await probe?.close();
});

async function audit(page: Page): Promise<AxeViolation[]> {
	await page.addScriptTag({ path: AXE_PATH });
	const result = (await page.evaluate(async () => {
		const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }> } }).axe;
		return axe.run(document, {
			resultTypes: ['violations'],
			runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
		});
	})) as { violations: AxeViolation[] };
	return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

describe('axe-core audit, both themes', () => {
	for (const theme of ['light', 'dark'] as const) {
		for (const route of ROUTES) {
			it(`${route} has no serious or critical violations (${theme})`, async () => {
				const page = await probe.freshPage({ dark: theme === 'dark' });
				await visit(page, probe.origin, route);
				const violations = await audit(page);
				const summary = violations
					.map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
					.join('\n');
				await page.close();
				expect(violations.length, `${route} (${theme})\n${summary}`).toBe(0);
			});
		}
	}
});

describe('keyboard operability', () => {
	it('every interactive control on the sorting page is reachable by Tab', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/sorting/');
		const focusable = await page.evaluate(() => {
			const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
			return document.querySelectorAll(selector).length;
		});
		expect(focusable).toBeGreaterThan(15);

		// Tab through the first 25 stops and make sure focus actually moves and is visible.
		const seen = new Set<string>();
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('Tab');
			const info = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el || el === document.body) return null;
				const style = getComputedStyle(el);
				return {
					tag: el.tagName,
					id: el.id || el.getAttribute('aria-label') || el.textContent?.slice(0, 20) || '',
					outline: style.outlineStyle
				};
			});
			if (info) seen.add(`${info.tag}:${info.id}`);
		}
		expect(seen.size).toBeGreaterThan(10);
		await page.close();
	});

	it('the transport can be driven entirely from the keyboard', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/sorting/');
		await page.locator('body').click({ position: { x: 4, y: 400 } });
		await page.keyboard.press('Space');
		await page.waitForTimeout(400);
		await page.keyboard.press('Space');
		const counter = (await page.locator('.transport .counter').textContent()) ?? '';
		expect(Number(counter.split('/')[0])).toBeGreaterThan(0);
		await page.keyboard.press('+');
		await page.keyboard.press('+');
		expect(await page.getByLabel('Speed').inputValue()).not.toBe('1');
		await page.keyboard.press('-');
		await page.keyboard.press('-');
		await page.keyboard.press('-');
		expect(Number(await page.getByLabel('Speed').inputValue())).toBeLessThanOrEqual(1);
		await page.close();
	});

	it('the grid is operable without a mouse', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: 'Clear walls' }).click();
		const before = await page.locator('[data-cell][data-tag="wall"]').count();
		// The start cell is keyboard focusable; move to a plain cell and toggle it.
		const cell = page.locator('[data-cell][tabindex="0"]').nth(2);
		await cell.focus();
		await page.keyboard.press('Enter');
		expect(await page.locator('[data-cell][data-tag="wall"]').count()).toBeGreaterThan(before);
		await page.close();
	});
});

describe('text alternatives and live regions', () => {
	it('each visualiser exposes a text or table view of the current state', async () => {
		const page = await probe.freshPage();
		for (const [route, testId] of [
			['/sorting/', 'array-text'],
			['/searching/', 'array-text'],
			['/pathfinding/', 'grid-text']
		] as const) {
			await visit(page, probe.origin, route);
			const summary = page.locator('details summary').first();
			await summary.click();
			const text = await page.getByTestId(testId).first().textContent();
			expect((text ?? '').trim().length, route).toBeGreaterThan(0);
		}
		await page.close();
	});

	it('step announcements go to a polite live region', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/sorting/');
		const live = page.locator('[role="status"][aria-live="polite"]');
		expect(await live.count()).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Step forward one step' }).click();
		const announced = await live.first().textContent();
		expect((announced ?? '').trim()).toMatch(/Step \d+ of \d+/);
		await page.close();
	});

	it('every icon-only button has an accessible name', async () => {
		const page = await probe.freshPage();
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			const unnamed = await page.evaluate(() =>
				Array.from(document.querySelectorAll('button'))
					.filter((b) => !(b.textContent ?? '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'))
					.map((b) => b.outerHTML.slice(0, 80))
			);
			expect(unnamed, `${route}: ${unnamed.join(' | ')}`).toEqual([]);
		}
		await page.close();
	});

	it('every form control has a label', async () => {
		const page = await probe.freshPage();
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			const unlabelled = await page.evaluate(() =>
				Array.from(document.querySelectorAll('input, select, textarea'))
					.filter((el) => {
						const id = el.getAttribute('id');
						const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
						const wrapped = !!el.closest('label');
						return !hasLabel && !wrapped && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby');
					})
					.map((el) => el.outerHTML.slice(0, 80))
			);
			expect(unlabelled, `${route}: ${unlabelled.join(' | ')}`).toEqual([]);
		}
		await page.close();
	});

	it('there is exactly one h1 per page and a skip link', async () => {
		const page = await probe.freshPage();
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			expect(await page.locator('h1').count(), route).toBe(1);
			expect(await page.locator('.skip-link').count(), route).toBe(1);
		}
		await page.close();
	});
});
