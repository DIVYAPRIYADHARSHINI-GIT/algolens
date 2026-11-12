// The single app-level runes store. Everything browser-only (localStorage, matchMedia,
// AudioContext) is touched lazily from `init()`, which only ever runs in the browser,
// so server rendering can never reach a browser global.

import { browser } from '$app/env';
import { untrack } from 'svelte';
import { browserSettingsStore, createSettingsStore, type SettingsStore, type StoreState } from './core/store.js';
import { defaultSettings, type Mode, type SettingsData, type Theme } from './core/schema.js';
import { sampleArray, sampleGraph, sampleGrid } from './data/samples.js';
import { encodeGrid } from './core/share.js';
import { validateSavedGraph, validateSavedGrid } from './core/schema.js';

export interface Toast {
	id: number;
	text: string;
	tone: 'ok' | 'bad' | 'info';
}

class AppState {
	store: SettingsStore = createSettingsStore(null);
	settings = $state<SettingsData>(defaultSettings());
	storage = $state<Pick<StoreState, 'status' | 'message' | 'bytesUsed' | 'bytesBudget'>>({
		status: 'ok',
		message: null,
		bytesUsed: 0,
		bytesBudget: 5 * 1024 * 1024
	});
	toasts = $state<Toast[]>([]);
	systemDark = $state(false);
	systemReducedMotion = $state(false);
	ready = $state(false);
	private toastId = 0;
	private mediaCleanup: (() => void)[] = [];

	/** Browser-only start-up. Safe to call more than once. */
	init(): void {
		if (!browser || this.ready) return;
		this.store = browserSettingsStore();
		this.apply(this.store.read());
		const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.systemDark = darkQuery.matches;
		this.systemReducedMotion = motionQuery.matches;
		const onDark = (e: MediaQueryListEvent) => {
			this.systemDark = e.matches;
			this.paintTheme();
		};
		const onMotion = (e: MediaQueryListEvent) => void (this.systemReducedMotion = e.matches);
		darkQuery.addEventListener('change', onDark);
		motionQuery.addEventListener('change', onMotion);
		this.mediaCleanup.push(() => darkQuery.removeEventListener('change', onDark));
		this.mediaCleanup.push(() => motionQuery.removeEventListener('change', onMotion));
		// First visit: load the examples so every mode shows real content immediately.
		if (!this.settings.examplesLoaded) this.loadExamples(false);
		this.paintTheme();
		this.ready = true;
	}

	/** Remove the media listeners. Called when the root layout is destroyed. */
	destroy(): void {
		for (const fn of this.mediaCleanup) fn();
		this.mediaCleanup = [];
		this.ready = false;
	}

	private apply(state: StoreState): void {
		this.settings = state.data;
		this.storage = {
			status: state.status,
			message: state.message,
			bytesUsed: state.bytesUsed,
			bytesBudget: state.bytesBudget
		};
	}

	update(fn: (data: SettingsData) => SettingsData): void {
		untrack(() => this.apply(this.store.update(fn)));
	}

	get isDark(): boolean {
		const t = this.settings.theme;
		return t === 'dark' || (t === 'system' && this.systemDark);
	}

	get reducedMotion(): boolean {
		if (this.settings.reduceMotion === 'on') return true;
		if (this.settings.reduceMotion === 'off') return false;
		return this.systemReducedMotion;
	}

	setTheme(theme: Theme): void {
		this.update((d) => ({ ...d, theme }));
		this.paintTheme();
	}

	cycleTheme(): void {
		this.setTheme(this.isDark ? 'light' : 'dark');
	}

	private paintTheme(): void {
		if (!browser) return;
		document.documentElement.dataset.theme = this.isDark ? 'dark' : 'light';
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', this.isDark ? '#12141A' : '#FAFAF8');
	}

	setMode(mode: Mode): void {
		this.update((d) => ({ ...d, lastMode: mode }));
	}

	/**
	 * Show a transient message.
	 *
	 * `untrack` matters: appending READS the `toasts` rune, and a toast is usually raised
	 * from inside an $effect. Without untrack that effect would depend on its own write and
	 * re-run forever (Svelte reports effect_update_depth_exceeded). The same rule applies to
	 * every method below that appends to reactive state.
	 */
	toast(text: string, tone: Toast['tone'] = 'info'): void {
		const id = ++this.toastId;
		this.toasts = [...untrack(() => this.toasts), { id, text, tone }];
		if (browser) {
			window.setTimeout(() => {
				this.toasts = untrack(() => this.toasts).filter((t) => t.id !== id);
			}, 4200);
		}
	}

	dismissToast(id: number): void {
		this.toasts = untrack(() => this.toasts).filter((t) => t.id !== id);
	}

	/** Load the bundled examples. These are the ONLY items a fresh install contains. */
	loadExamples(announce = true): void {
		const grid = validateSavedGrid({
			...encodeGrid(sampleGrid()),
			id: 'example-maze',
			name: 'Example maze with weights',
			createdAt: Date.now()
		});
		const graph = validateSavedGraph({
			...sampleGraph(),
			id: 'example-graph',
			name: 'Example weighted graph',
			createdAt: Date.now()
		});
		this.update((d) => ({
			...d,
			examplesLoaded: true,
			savedGrids: [...(grid ? [grid] : []), ...d.savedGrids.filter((g) => g.id !== 'example-maze')],
			savedGraphs: [...(graph ? [graph] : []), ...d.savedGraphs.filter((g) => g.id !== 'example-graph')]
		}));
		if (announce) this.toast('Examples loaded: one maze grid and one weighted graph.', 'ok');
	}

	resetEverything(): void {
		this.apply(this.store.clear());
		this.loadExamples(false);
		this.paintTheme();
		this.toast('Everything was reset. Only the bundled examples remain.', 'ok');
	}

	importSettings(data: SettingsData): void {
		this.apply(this.store.write({ ...data, version: defaultSettings().version }));
		this.paintTheme();
	}
}

export const app = new AppState();

/** The starting sorting input, used by the sorting and compare modes on first open. */
export const firstSortInput = sampleArray;
