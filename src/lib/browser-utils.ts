// Small browser-only helpers used by several pages. Every one is guarded so it can be
// imported from a module that is also pulled in by the (node) test run.

import { browser } from '$app/env';

export async function copyText(text: string): Promise<boolean> {
	if (!browser) return false;
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Falls through to the textarea approach, which works without permission.
	}
	try {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.setAttribute('readonly', '');
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
	if (!browser) return;
	const blob = new Blob([text], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// Release the object URL on the next turn so Safari has finished with it.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Render a DOM element to a PNG by drawing it into an SVG foreignObject. Everything stays
 * local to the tab; nothing is uploaded. Returns null when the browser refuses (for example
 * because the element contains a cross-origin image, which AlgoLens never does).
 */
export async function elementToPngBlob(el: HTMLElement, background: string): Promise<Blob | null> {
	if (!browser) return null;
	try {
		const rect = el.getBoundingClientRect();
		const width = Math.max(1, Math.ceil(rect.width));
		const height = Math.max(1, Math.ceil(rect.height));
		const styles = collectStyles();
		const clone = el.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('details').forEach((d) => d.removeAttribute('open'));
		const html = new XMLSerializer().serializeToString(clone);
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
			`<foreignObject width="100%" height="100%">` +
			`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${background}">` +
			`<style>${styles}</style>${html}</div></foreignObject></svg>`;
		const img = new Image();
		const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('The picture could not be rendered.'));
			img.src = svgUrl;
		});
		const scale = Math.min(2, window.devicePixelRatio || 1);
		const canvas = document.createElement('canvas');
		canvas.width = width * scale;
		canvas.height = height * scale;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.scale(scale, scale);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, width, height);
		ctx.drawImage(img, 0, 0, width, height);
		return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	} catch {
		return null;
	}
}

/**
 * Inline the app's own stylesheet rules so the exported PNG is styled.
 *
 * At-rules are NOT copied verbatim. A `<style>` block inside an SVG foreignObject refuses
 * to decode when it contains `@font-face` or `@media` (measured in Chromium: the image
 * errors instead of loading), which previously made the PNG export fail silently. So:
 *   - plain style rules are copied as they are,
 *   - `@media` blocks are FLATTENED: the rules inside a query that currently matches are
 *     emitted without the wrapper, preserving the layout actually on screen,
 *   - `@font-face`, `@import` and anything else is skipped. Text falls back to a generic
 *     family, which is acceptable for an exported picture of the data.
 */
function collectStyles(): string {
	const parts: string[] = [];
	const collect = (rules: CSSRuleList): void => {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSMediaRule) {
				if (window.matchMedia(rule.conditionText).matches) collect(rule.cssRules);
				continue;
			}
			if (rule instanceof CSSStyleRule) parts.push(rule.cssText);
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			collect(sheet.cssRules);
		} catch {
			// A cross-origin sheet cannot be read; AlgoLens self-hosts everything, so this
			// only happens for browser-injected sheets, which are not needed.
		}
	}
	return parts.join('');
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
	if (!browser) return false;
	try {
		const g = window as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem };
		if (!g.ClipboardItem || !navigator.clipboard?.write) return false;
		await navigator.clipboard.write([new g.ClipboardItem({ [blob.type]: blob })]);
		return true;
	} catch {
		return false;
	}
}

export function downloadBlob(filename: string, blob: Blob): void {
	if (!browser) return;
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
