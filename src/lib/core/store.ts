// SettingsStore: the single data-access interface, with ONE implementation backed by
// localStorage. There is deliberately no server implementation - the brief forbids any
// database, cloud storage or Vercel resource beyond the hosting project itself.
//
// Every localStorage call is wrapped: private-browsing throws, quota-exceeded throws and
// corrupted blobs all degrade to a working in-memory session with a clear status, never a
// crash and never silent data loss.

import {
	defaultSettings,
	migrate,
	STORAGE_KEY,
	type SavedGraph,
	type SavedGrid,
	type SettingsData
} from './schema.js';

export type StorageStatus = 'ok' | 'unavailable' | 'repaired' | 'full';

export interface StoreState {
	data: SettingsData;
	status: StorageStatus;
	message: string | null;
	/** Approximate bytes used by the AlgoLens key, for the storage meter. */
	bytesUsed: number;
	/** Conventional per-origin budget used to draw the meter (5 MB is the usual limit). */
	bytesBudget: number;
}

export interface SettingsStore {
	read(): StoreState;
	write(data: SettingsData): StoreState;
	update(fn: (data: SettingsData) => SettingsData): StoreState;
	clear(): StoreState;
	saveGrid(grid: SavedGrid): StoreState;
	renameGrid(id: string, name: string): StoreState;
	deleteGrid(id: string): StoreState;
	saveGraph(graph: SavedGraph): StoreState;
	renameGraph(id: string, name: string): StoreState;
	deleteGraph(id: string): StoreState;
}

const BUDGET_BYTES = 5 * 1024 * 1024;

/** Minimal storage surface, so tests can inject a fake (including a throwing one). */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

function byteLength(text: string): number {
	// TextEncoder is available in browsers and Node; fall back to the UTF-16 length.
	try {
		return new TextEncoder().encode(text).length;
	} catch {
		return text.length;
	}
}

export function createSettingsStore(storage: StorageLike | null): SettingsStore {
	let cache: SettingsData = defaultSettings();
	let status: StorageStatus = storage ? 'ok' : 'unavailable';
	let message: string | null = storage
		? null
		: 'This browser is blocking site storage, so AlgoLens is running in memory only. Your settings and saved items will disappear when you close the tab.';
	let loaded = false;

	const state = (): StoreState => ({
		data: cache,
		status,
		message,
		bytesUsed: byteLength(JSON.stringify(cache)),
		bytesBudget: BUDGET_BYTES
	});

	const load = (): void => {
		loaded = true;
		if (!storage) return;
		let raw: string | null = null;
		try {
			raw = storage.getItem(STORAGE_KEY);
		} catch {
			status = 'unavailable';
			message = 'This browser is blocking site storage, so AlgoLens is running in memory only.';
			return;
		}
		if (raw === null) {
			cache = defaultSettings();
			return;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			cache = defaultSettings();
			status = 'repaired';
			message = 'Your saved AlgoLens data could not be read, so it has been reset to the defaults. Nothing else on this device was touched.';
			return;
		}
		const result = migrate(parsed);
		cache = result.data;
		if (result.repaired) {
			status = 'repaired';
			message = 'Some saved AlgoLens data was invalid and has been repaired. Anything unreadable was replaced with a default.';
		}
	};

	const persist = (): void => {
		if (!storage) return;
		try {
			storage.setItem(STORAGE_KEY, JSON.stringify(cache));
			if (status === 'full') {
				status = 'ok';
				message = null;
			}
		} catch {
			status = 'full';
			message = 'This browser could not save your change because its storage is full. Delete a saved grid or graph, or export a backup and reset.';
		}
	};

	const ensure = (): void => {
		if (!loaded) load();
	};

	const store: SettingsStore = {
		read() {
			ensure();
			return state();
		},
		write(data) {
			ensure();
			cache = data;
			persist();
			return state();
		},
		update(fn) {
			ensure();
			cache = fn(cache);
			persist();
			return state();
		},
		clear() {
			ensure();
			cache = defaultSettings();
			if (storage) {
				try {
					storage.removeItem(STORAGE_KEY);
					status = 'ok';
					message = null;
				} catch {
					status = 'unavailable';
					message = 'Storage could not be cleared in this browser.';
				}
			}
			return state();
		},
		saveGrid(grid) {
			return store.update((d) => ({
				...d,
				savedGrids: [grid, ...d.savedGrids.filter((g) => g.id !== grid.id)].slice(0, 100)
			}));
		},
		renameGrid(id, name) {
			const trimmed = name.trim().slice(0, 60) || 'Untitled grid';
			return store.update((d) => ({ ...d, savedGrids: d.savedGrids.map((g) => (g.id === id ? { ...g, name: trimmed } : g)) }));
		},
		deleteGrid(id) {
			return store.update((d) => ({ ...d, savedGrids: d.savedGrids.filter((g) => g.id !== id) }));
		},
		saveGraph(graph) {
			return store.update((d) => ({
				...d,
				savedGraphs: [graph, ...d.savedGraphs.filter((g) => g.id !== graph.id)].slice(0, 100)
			}));
		},
		renameGraph(id, name) {
			const trimmed = name.trim().slice(0, 60) || 'Untitled graph';
			return store.update((d) => ({ ...d, savedGraphs: d.savedGraphs.map((g) => (g.id === id ? { ...g, name: trimmed } : g)) }));
		},
		deleteGraph(id) {
			return store.update((d) => ({ ...d, savedGraphs: d.savedGraphs.filter((g) => g.id !== id) }));
		}
	};

	return store;
}

/** Browser factory. Returns a memory-only store when localStorage is blocked. */
export function browserSettingsStore(): SettingsStore {
	let storage: StorageLike | null = null;
	try {
		const probe = '__algolens_probe__';
		window.localStorage.setItem(probe, '1');
		window.localStorage.removeItem(probe);
		storage = window.localStorage;
	} catch {
		storage = null;
	}
	return createSettingsStore(storage);
}
