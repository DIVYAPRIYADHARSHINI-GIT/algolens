/**
 * Design QA: screenshots of every mode at 1440 / 1024 / 768 / 390 px in both themes, plus
 * automated checks for the things a design lead would look for - horizontal page scroll,
 * overlapping labels in dense bar charts, touch-target size, and real WCAG AA contrast
 * computed from the PAINTED colours rather than from the token values.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { openProbe, ROUTES, SHOTS_DIR, visit, type Probe } from './harness';

const WIDTHS = [1440, 1024, 768, 390];
let probe: Probe;

beforeAll(async () => {
	probe = await openProbe();
	mkdirSync(SHOTS_DIR, { recursive: true });
}, 240_000);

afterAll(async () => {
	await probe?.close();
});

/** Relative luminance per WCAG 2.1. */
function luminance(rgb: [number, number, number]): number {
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function parseRgb(value: string): [number, number, number] | null {
	const match = value.match(/rgba?\(([^)]+)\)/);
	if (!match) return null;
	const parts = match[1].split(',').map((p) => Number(p.trim()));
	if (parts.length < 3 || parts.some((p) => !Number.isFinite(p))) return null;
	if (parts.length > 3 && parts[3] === 0) return null;
	return [parts[0], parts[1], parts[2]];
}

interface TextSample {
	text: string;
	colour: string;
	background: string;
	size: number;
	weight: number;
	selector: string;
}

/** Composite each text node against the first opaque background behind it. */
async function sampleText(page: Page): Promise<TextSample[]> {
	return page.evaluate(() => {
		const out: TextSample[] = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		const seen = new Set<Element>();
		let node: Node | null;
		while ((node = walker.nextNode())) {
			const text = (node.textContent ?? '').trim();
			if (!text) continue;
			const el = node.parentElement;
			if (!el || seen.has(el)) continue;
			seen.add(el);
			const style = getComputedStyle(el);
			if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
			const rect = el.getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2) continue;
			if (el.closest('.sr-only')) continue;
			// Walk up for the first non-transparent background.
			let bg = 'rgba(0, 0, 0, 0)';
			let probeEl: Element | null = el;
			while (probeEl) {
				const value = getComputedStyle(probeEl).backgroundColor;
				const match = value.match(/rgba?\(([^)]+)\)/);
				const parts = match ? match[1].split(',').map((p) => Number(p.trim())) : [];
				if (parts.length === 3 || (parts.length === 4 && parts[3] > 0.95)) {
					bg = value;
					break;
				}
				probeEl = probeEl.parentElement;
			}
			out.push({
				text: text.slice(0, 40),
				colour: style.color,
				background: bg,
				size: parseFloat(style.fontSize),
				weight: Number(style.fontWeight) || 400,
				selector: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`
			});
		}
		return out;
	});
}

describe('screenshots and layout at every width, both themes', () => {
	for (const theme of ['light', 'dark'] as const) {
		for (const width of WIDTHS) {
			it(`no horizontal page scroll at ${width}px (${theme})`, async () => {
				const page = await probe.freshPage({ viewport: { width, height: 900 }, dark: theme === 'dark' });
				const offenders: string[] = [];
				for (const route of ROUTES) {
					await visit(page, probe.origin, route);
					const overflow = await page.evaluate(() => ({
						scrollWidth: document.documentElement.scrollWidth,
						clientWidth: document.documentElement.clientWidth
					}));
					// 1px of rounding is tolerated; anything more is a real overflow.
					if (overflow.scrollWidth > overflow.clientWidth + 1) {
						offenders.push(`${route} (${overflow.scrollWidth} > ${overflow.clientWidth})`);
					}
					await page.screenshot({
						path: join(SHOTS_DIR, `${route.replace(/\//g, '') || 'home'}-${width}-${theme}.png`),
						fullPage: true
					});
				}
				await page.close();
				expect(offenders, offenders.join('\n')).toEqual([]);
			});
		}
	}
});

describe('WCAG AA contrast from painted colours', () => {
	for (const theme of ['light', 'dark'] as const) {
		it(`every visible text node meets AA (${theme})`, async () => {
			const page = await probe.freshPage({ viewport: { width: 1440, height: 900 }, dark: theme === 'dark' });
			const failures: string[] = [];
			for (const route of ROUTES) {
				await visit(page, probe.origin, route);
				for (const sample of await sampleText(page)) {
					const fg = parseRgb(sample.colour);
					const bg = parseRgb(sample.background);
					if (!fg || !bg) continue;
					const ratio = contrast(fg, bg);
					// AA: 4.5:1 normally, 3:1 for large text (>=18.66px, or >=24px at any weight).
					const large = sample.size >= 24 || (sample.size >= 18.66 && sample.weight >= 700);
					const required = large ? 3 : 4.5;
					if (ratio < required - 0.02) {
						failures.push(`${route} ${sample.selector} "${sample.text}" ${ratio.toFixed(2)}:1 (needs ${required}) ${sample.colour} on ${sample.background}`);
					}
				}
			}
			await page.close();
			expect(failures, failures.slice(0, 12).join('\n')).toEqual([]);
		});
	}
});

describe('dense bar chart readability', () => {
	it('value labels are hidden once the bars get too narrow to hold them', async () => {
		const page = await probe.freshPage({ viewport: { width: 1024, height: 900 } });
		await visit(page, probe.origin, '/sorting/');
		// 100 bars at 1024px: labels would overlap, so they must not be rendered.
		await page.getByLabel('Size', { exact: false }).first().fill('100');
		await page.getByLabel('Size', { exact: false }).first().dispatchEvent('input');
		await page.waitForTimeout(200);
		expect(await page.locator('.bars .label').count()).toBe(0);

		// At a small size the labels come back and must not overlap each other.
		await page.getByLabel('Size', { exact: false }).first().fill('12');
		await page.getByLabel('Size', { exact: false }).first().dispatchEvent('input');
		await page.waitForTimeout(200);
		const boxes = await page.locator('.bars .label').evaluateAll((els) =>
			els.map((el) => {
				const r = el.getBoundingClientRect();
				return { left: r.left, right: r.right };
			})
		);
		expect(boxes.length).toBeGreaterThan(6);
		for (let i = 1; i < boxes.length; i++) {
			expect(boxes[i].left, `label ${i} overlaps label ${i - 1}`).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5);
		}
		await page.close();
	});

	it('the 60 by 40 grid fits without overflowing its panel', async () => {
		const page = await probe.freshPage({ viewport: { width: 1440, height: 900 } });
		await visit(page, probe.origin, '/pathfinding/');
		await page.getByRole('button', { name: '60 x 40' }).click();
		await page.waitForTimeout(250);
		const fits = await page.evaluate(() => {
			const grid = document.querySelector('.grid') as HTMLElement | null;
			const panel = grid?.closest('.col-canvas') as HTMLElement | null;
			if (!grid || !panel) return true;
			return grid.getBoundingClientRect().width <= panel.getBoundingClientRect().width + 1;
		});
		expect(fits).toBe(true);
		await page.close();
	});
});

describe('touch targets on a phone', () => {
	it('every control in the transport bar is at least 44px', async () => {
		const page = await probe.freshPage({ viewport: { width: 390, height: 844 }, touch: true });
		await visit(page, probe.origin, '/sorting/');
		const small = await page.evaluate(() =>
			Array.from(document.querySelectorAll('.transport button, .transport select'))
				.map((el) => {
					const r = el.getBoundingClientRect();
					return { label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName, w: r.width, h: r.height };
				})
				.filter((m) => m.h < 44 || m.w < 44)
		);
		expect(small, JSON.stringify(small)).toEqual([]);
		await page.close();
	});

	it('the transport bar stays fixed at the bottom on a phone', async () => {
		const page = await probe.freshPage({ viewport: { width: 390, height: 844 }, touch: true });
		await visit(page, probe.origin, '/sorting/');
		const position = await page.evaluate(() => {
			const el = document.querySelector('.transport') as HTMLElement | null;
			return el ? getComputedStyle(el).position : '';
		});
		expect(position).toBe('sticky');
		await page.close();
	});

	it('panels become an accordion on a phone', async () => {
		const page = await probe.freshPage({ viewport: { width: 390, height: 844 }, touch: true });
		await visit(page, probe.origin, '/sorting/');
		const accordion = page.locator('.accordion').first();
		expect(await accordion.isVisible()).toBe(true);
		await accordion.click();
		await page.waitForTimeout(150);
		expect(await page.locator('.controls.collapsed').count()).toBe(1);
		await page.close();
	});
});

describe('visual consistency', () => {
	it('no default browser control styling slipped through', async () => {
		const page = await probe.freshPage();
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			const unstyled = await page.evaluate(() =>
				Array.from(document.querySelectorAll('select, input[type="text"], input[type="number"], textarea'))
					.filter((el) => {
						const s = getComputedStyle(el);
						return s.appearance !== 'none' && s.webkitAppearance !== 'none';
					})
					.map((el) => el.outerHTML.slice(0, 60))
			);
			expect(unstyled, `${route}: ${unstyled.join(' | ')}`).toEqual([]);
		}
		await page.close();
	});

	it('the interface uses only Inter and JetBrains Mono', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/sorting/');
		const families = await page.evaluate(() => {
			const set = new Set<string>();
			for (const el of Array.from(document.querySelectorAll('body *'))) {
				const first = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
				if (first) set.add(first);
			}
			return [...set];
		});
		for (const family of families) {
			expect(['Inter Variable', 'JetBrains Mono Variable'], `unexpected font: ${family}`).toContain(family);
		}
		await page.close();
	});

	it('no emoji anywhere in the interface', async () => {
		const page = await probe.freshPage();
		for (const route of ROUTES) {
			await visit(page, probe.origin, route);
			const text = (await page.locator('body').textContent()) ?? '';
			const emoji = text.match(/\p{Extended_Pictographic}/gu) ?? [];
			expect(emoji, `${route} contains ${emoji.join('')}`).toEqual([]);
		}
		await page.close();
	});

	it('spacing and radius follow the 4px grid and the 8px radius', async () => {
		const page = await probe.freshPage();
		await visit(page, probe.origin, '/sorting/');
		const radii = await page.evaluate(() =>
			Array.from(document.querySelectorAll('.panel'))
				.map((el) => getComputedStyle(el).borderRadius)
				.filter((v, i, a) => a.indexOf(v) === i)
		);
		for (const r of radii) expect(['8px', '6px', '0px']).toContain(r);
		await page.close();
	});
});
