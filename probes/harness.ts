/**
 * Shared harness for the headless-browser probes.
 *
 * Builds the static site once, serves `build/` over a plain Node static server exactly the
 * way Vercel serves it (real files as files, unknown asset extensions 404, extensionless
 * paths fall back to 200.html), and hands out a Playwright page.
 *
 * Console errors and page exceptions are collected so a probe can assert the app ran CLEAN,
 * not just that the DOM looked right.
 */

import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit, devices, type Browser, type BrowserContext, type ConsoleMessage, type Page } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const BUILD_DIR = join(ROOT, 'build');
export const SHOTS_DIR = join(ROOT, 'probes', 'screenshots');

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf'
};

export const ROUTES = [
	'/',
	'/sorting/',
	'/searching/',
	'/pathfinding/',
	'/graphs/',
	'/compare/',
	'/benchmark/',
	'/practice/',
	'/learn/',
	'/settings/',
	'/privacy/'
];

export function buildSite(force = false): void {
	if (force || !existsSync(join(BUILD_DIR, 'index.html'))) {
		execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe' });
	}
}

export async function startServer(): Promise<{ origin: string; close: () => Promise<void> }> {
	const server: Server = createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		let path = decodeURIComponent(url.pathname);
		if (path.endsWith('/')) path += 'index.html';

		let filePath = join(BUILD_DIR, normalize(path).replace(/^(\.\.[/\\])+/, ''));
		if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
			const htmlPath = `${filePath}.html`;
			if (existsSync(htmlPath)) {
				filePath = htmlPath;
			} else {
				const ext = extname(filePath);
				if (ext && ext !== '.html') {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not found');
					return;
				}
				filePath = join(BUILD_DIR, '200.html');
			}
		}

		res.writeHead(200, {
			'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
			'Cache-Control': 'no-store'
		});
		createReadStream(filePath).pipe(res);
	});

	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;

	return {
		origin: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((done) => server.close(() => done()))
	};
}

export interface Probe {
	page: Page;
	origin: string;
	browser: Browser;
	errors: string[];
	freshPage: (options?: { viewport?: { width: number; height: number }; touch?: boolean; dark?: boolean; reducedMotion?: boolean }) => Promise<Page>;
	close: () => Promise<void>;
}

export async function openProbe(options: { viewport?: { width: number; height: number } } = {}): Promise<Probe> {
	buildSite();
	mkdirSync(SHOTS_DIR, { recursive: true });
	const { origin, close: closeServer } = await startServer();

	const browser: Browser = await chromium.launch();
	const viewport = options.viewport ?? { width: 1440, height: 900 };
	const context = await browser.newContext({ viewport });
	const page = await context.newPage();

	const errors: string[] = [];
	const contexts: BrowserContext[] = [context];
	const watch = (target: Page) => {
		target.on('console', (msg: ConsoleMessage) => {
			if (msg.type() === 'error') errors.push(`${target.url()} :: ${msg.text()}`);
		});
		target.on('pageerror', (err) => errors.push(`pageerror @ ${target.url()} :: ${err.message}`));
	};
	watch(page);

	return {
		page,
		origin,
		browser,
		errors,
		freshPage: async (opts = {}) => {
			const fresh = await browser.newContext({
				viewport: opts.viewport ?? viewport,
				...(opts.touch ? { ...devices['Pixel 7'], viewport: opts.viewport ?? { width: 390, height: 844 } } : {}),
				...(opts.dark ? { colorScheme: 'dark' as const } : {}),
				...(opts.reducedMotion ? { reducedMotion: 'reduce' as const } : {})
			});
			contexts.push(fresh);
			const freshPage = await fresh.newPage();
			watch(freshPage);
			return freshPage;
		},
		close: async () => {
			await browser.close();
			await closeServer();
		}
	};
}

/** Open a probe on another engine, reusing the already-built site and a new server. */
export async function openEngine(name: 'firefox' | 'webkit'): Promise<Probe | null> {
	buildSite();
	const launcher = name === 'firefox' ? firefox : webkit;
	let browser: Browser;
	try {
		browser = await launcher.launch();
	} catch {
		// The engine is not installed on this machine; the caller skips rather than fails.
		return null;
	}
	const { origin, close: closeServer } = await startServer();
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
	return {
		page,
		origin,
		browser,
		errors,
		freshPage: async () => page,
		close: async () => {
			await browser.close();
			await closeServer();
		}
	};
}

/** Navigate and wait until the app has hydrated. */
export async function visit(page: Page, origin: string, path: string): Promise<void> {
	await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
	// The transport bar (or the landing hero) only exists once Svelte has mounted.
	await page.waitForFunction(() => document.querySelector('main')?.children.length ?? 0 > 0, null, { timeout: 15_000 });
}

export async function shot(page: Page, name: string): Promise<void> {
	await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: true });
}

export async function readStore(page: Page): Promise<Record<string, unknown> | null> {
	return page.evaluate(() => {
		const raw = localStorage.getItem('algolens.settings.v1');
		return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
	});
}

/** Read the accessible table view of the array, which is the source of truth for results. */
export async function readArrayText(page: Page): Promise<number[]> {
	const text = await page.getByTestId('array-text').first().textContent();
	return (text ?? '')
		.split(',')
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isFinite(n));
}

export function isAscending(values: number[]): boolean {
	for (let i = 1; i < values.length; i++) if (values[i - 1] > values[i]) return false;
	return true;
}

/**
 * Playwright's own `expect` matchers are not available under plain vitest, so these small
 * polling helpers give the same "wait until true" behaviour with short timeouts: a hung
 * expectation fails fast instead of stalling the whole run.
 */
export async function waitVisible(page: Page, selector: string | ReturnType<Page['locator']>, timeout = 10_000): Promise<void> {
	const locator = typeof selector === 'string' ? page.locator(selector) : selector;
	await locator.first().waitFor({ state: 'visible', timeout });
}

export async function waitGone(page: Page, selector: string | ReturnType<Page['locator']>, timeout = 10_000): Promise<void> {
	const locator = typeof selector === 'string' ? page.locator(selector) : selector;
	const started = Date.now();
	while (Date.now() - started < timeout) {
		if ((await locator.count()) === 0) return;
		await page.waitForTimeout(80);
	}
	throw new Error('Element was still present after the timeout.');
}

export async function waitForCount(
	locator: ReturnType<Page['locator']>,
	expected: number,
	page: Page,
	timeout = 10_000
): Promise<void> {
	const started = Date.now();
	let last = -1;
	while (Date.now() - started < timeout) {
		last = await locator.count();
		if (last === expected) return;
		await page.waitForTimeout(80);
	}
	throw new Error(`Expected ${expected} element(s) but found ${last}.`);
}

/** Open a details element by its summary text so its contents are readable. */
export async function openDetails(page: Page, summaryText: string | RegExp): Promise<void> {
	const summary = page.getByText(summaryText).first();
	const expanded = await summary.evaluate((el) => (el.closest('details') as HTMLDetailsElement | null)?.open ?? false);
	if (!expanded) await summary.click();
}
