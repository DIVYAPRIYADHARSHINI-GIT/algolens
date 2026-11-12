/**
 * Checks against the DEPLOYED public site, plus cross-engine checks on the local build.
 *
 * The live checks prove the production domain opens without a login (a fresh context has no
 * Vercel SSO cookie), serves every route on a direct URL, ships only the bundled examples,
 * and runs a real algorithm end to end with a clean console.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { isAscending, openEngine, ROUTES, visit } from './harness';

const SITE = process.env.ALGOLENS_SITE ?? 'https://algolens-omega.vercel.app';

let browser: Browser;
let page: Page;
const errors: string[] = [];

beforeAll(async () => {
	browser = await chromium.launch();
	// A brand-new context carries no cookies, which is the incognito equivalent: if
	// Deployment Protection were on, these requests would be redirected to a login.
	const context = await browser.newContext();
	page = await context.newPage();
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`${page.url()} :: ${msg.text()}`);
	});
	page.on('pageerror', (err) => errors.push(`pageerror @ ${page.url()} :: ${err.message}`));
}, 120_000);

afterAll(async () => {
	await browser?.close();
});

describe('the live site is public', () => {
	it('every route returns 200 and real content without a login', async () => {
		for (const route of ROUTES) {
			const response = await page.goto(`${SITE}${route}`, { waitUntil: 'networkidle', timeout: 45_000 });
			expect(response?.status(), route).toBe(200);
			// A protection redirect would land on vercel.com, not on our own origin.
			expect(page.url(), route).toContain('algolens');
			const heading = (await page.locator('h1').first().textContent()) ?? '';
			expect(heading.trim().length, route).toBeGreaterThan(3);
		}
	});

	it('a hard refresh on a deep route works', async () => {
		await page.goto(`${SITE}/pathfinding/`, { waitUntil: 'networkidle' });
		await page.reload({ waitUntil: 'networkidle' });
		await page.locator('.transport').first().waitFor({ state: 'visible', timeout: 15_000 });
	});

	it('ships only the bundled examples, with no test data', async () => {
		await page.goto(`${SITE}/pathfinding/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400);
		const grids = await page.locator('.saved li').allTextContents();
		expect(grids.length).toBe(1);
		expect(grids[0]).toContain('Example maze with weights');

		await page.goto(`${SITE}/graphs/`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400);
		const graphs = await page.locator('.saved li').allTextContents();
		expect(graphs.length).toBe(1);
		expect(graphs[0]).toContain('Example weighted graph');

		const stored = await page.evaluate(() => localStorage.getItem('algolens.settings.v1'));
		expect(stored).toBeTruthy();
		const blob = (stored ?? '').toLowerCase();
		for (const marker of ['probe', 'temporary', 'todo', 'lorem', 'placeholder', 'debug']) {
			expect(blob.includes(marker), `stored state contains "${marker}"`).toBe(false);
		}
		const parsed = JSON.parse(stored ?? '{}') as { practice: { answered: number } };
		expect(parsed.practice.answered).toBe(0);
	});

	it('only the AlgoLens key is used for storage', async () => {
		await page.goto(`${SITE}/sorting/`, { waitUntil: 'networkidle' });
		const keys = await page.evaluate(() => Object.keys(localStorage));
		expect(keys).toEqual(['algolens.settings.v1']);
	});

	it('runs a real sort to the end and verifies it', async () => {
		await page.goto(`${SITE}/sorting/`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		await page.getByText('Text and table view of the current state').first().click();
		const text = (await page.getByTestId('array-text').textContent()) ?? '';
		const values = text.split(',').map((s) => Number(s.trim()));
		expect(values.length).toBeGreaterThan(5);
		expect(isAscending(values)).toBe(true);
		expect((await page.getByTestId('verified-badge').textContent())?.trim()).toBe('Verified');
	});

	it('solves the grid and the graph on the live site', async () => {
		await page.goto(`${SITE}/pathfinding/`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect((await page.getByTestId('verified-badge').textContent())?.trim()).toBe('Verified');

		await page.goto(`${SITE}/graphs/`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Jump to the end' }).click();
		expect((await page.getByTestId('verified-badge').textContent())?.trim()).toBe('Verified');
	});

	it('the benchmark worker runs on the live site', async () => {
		await page.goto(`${SITE}/benchmark/`, { waitUntil: 'networkidle' });
		await page.getByTestId('run-benchmark').click();
		await page.getByTestId('bench-table').waitFor({ state: 'visible', timeout: 70_000 });
		const table = ((await page.getByTestId('bench-table').textContent()) ?? '').replace(/\s+/g, ' ');
		expect(table).toMatch(/n = 1000/);
	});

	it('a share link works end to end on the live site', async () => {
		const context = page.context();
		await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
		await page.goto(`${SITE}/sorting/`, { waitUntil: 'networkidle' });
		await page.getByLabel('Custom values').fill('8, 2, 5, 1');
		await page.getByRole('button', { name: 'Use these values' }).click();
		await page.getByRole('button', { name: 'Copy link' }).click();
		const link = await page.evaluate(() => navigator.clipboard.readText());
		expect(link).toContain('#s=');

		const fresh = await browser.newContext();
		const freshPage = await fresh.newPage();
		await freshPage.goto(link, { waitUntil: 'networkidle' });
		await freshPage.waitForTimeout(500);
		await freshPage.getByText('Text and table view of the current state').first().click();
		const text = (await freshPage.getByTestId('array-text').textContent()) ?? '';
		expect(text.split(',').map((s) => Number(s.trim()))).toEqual([8, 2, 5, 1]);
		await fresh.close();
	});

	it('serves assets same-origin only, with no third-party requests', async () => {
		const external: string[] = [];
		const watcher = (url: string) => {
			if (!url.startsWith(SITE) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
		};
		page.on('request', (req) => watcher(req.url()));
		await page.goto(`${SITE}/sorting/`, { waitUntil: 'networkidle' });
		await page.goto(`${SITE}/learn/`, { waitUntil: 'networkidle' });
		expect(external, external.join('\n')).toEqual([]);
	});

	it('the live console was clean on every page', () => {
		expect(errors, errors.join('\n')).toEqual([]);
	});
});

describe('other browser engines on the local build', () => {
	for (const engine of ['firefox', 'webkit'] as const) {
		it(`${engine}: loads every route and runs a sort`, async () => {
			const probe = await openEngine(engine);
			if (!probe) {
				// The engine is not installed on this machine; report rather than fail.
				// eslint-disable-next-line no-console
				console.log(`[engines] ${engine} is not installed, skipped`);
				return;
			}
			try {
				for (const route of ROUTES) {
					await visit(probe.page, probe.origin, route);
					const heading = (await probe.page.locator('h1').first().textContent()) ?? '';
					expect(heading.trim().length, `${engine} ${route}`).toBeGreaterThan(3);
				}
				await visit(probe.page, probe.origin, '/sorting/');
				await probe.page.getByRole('button', { name: 'Jump to the end' }).click();
				await probe.page.getByText('Text and table view of the current state').first().click();
				const text = (await probe.page.getByTestId('array-text').textContent()) ?? '';
				const values = text.split(',').map((s) => Number(s.trim()));
				expect(isAscending(values), `${engine} sort`).toBe(true);
				expect(probe.errors, `${engine}: ${probe.errors.join('\n')}`).toEqual([]);
			} finally {
				await probe.close();
			}
		});
	}
});
