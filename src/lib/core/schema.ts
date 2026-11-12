// Persisted schema + validation + migrations.
//
// STORAGE POLICY (fixed by the project brief): the ONLY storage is this browser's
// localStorage. There is no server, no database, no cloud storage, no account. Nothing a
// user saves ever leaves the device. The schema is versioned and migrated forward in order.

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'algolens.settings.v1';

export type Theme = 'light' | 'dark' | 'system';
export type Mode = 'sorting' | 'searching' | 'pathfinding' | 'graphs' | 'compare' | 'benchmark' | 'practice' | 'learn';

export interface SavedGrid {
	id: string;
	name: string;
	createdAt: number;
	cols: number;
	rows: number;
	diagonal: boolean;
	start: number;
	end: number;
	/** Run-length encoded walls: alternating counts starting with "open". */
	walls: number[];
	/** Sparse weights: [index, weight] pairs for anything above 1. */
	weights: number[][];
}

export interface SavedGraph {
	id: string;
	name: string;
	createdAt: number;
	directed: boolean;
	nodes: { id: string; label: string; x: number; y: number }[];
	edges: { id: string; from: string; to: string; weight: number }[];
}

export interface PracticeScore {
	answered: number;
	correct: number;
	bestStreak: number;
}

export interface SettingsData {
	version: number;
	theme: Theme;
	soundEnabled: boolean;
	volume: number;
	reduceMotion: 'auto' | 'on' | 'off';
	lastMode: Mode;
	savedGrids: SavedGrid[];
	savedGraphs: SavedGraph[];
	practice: PracticeScore;
	examplesLoaded: boolean;
}

export function defaultSettings(): SettingsData {
	return {
		version: SCHEMA_VERSION,
		theme: 'system',
		soundEnabled: false,
		volume: 0.3,
		reduceMotion: 'auto',
		lastMode: 'sorting',
		savedGrids: [],
		savedGraphs: [],
		practice: { answered: 0, correct: 0, bestStreak: 0 },
		examplesLoaded: false
	};
}

/** Ordered migrations. Each entry upgrades FROM its index version TO the next. */
export const MIGRATIONS: ((data: Record<string, unknown>) => Record<string, unknown>)[] = [
	// v0 -> v1: the first released schema. Older unversioned blobs get the defaults filled in.
	(data) => ({ ...defaultSettings(), ...data, version: 1 })
];

export function migrate(raw: unknown): { data: SettingsData; migratedFrom: number | null; repaired: boolean } {
	if (!isRecord(raw)) return { data: defaultSettings(), migratedFrom: null, repaired: true };
	let working: Record<string, unknown> = { ...raw };
	const from = typeof working.version === 'number' ? working.version : 0;
	for (let v = from; v < SCHEMA_VERSION; v++) {
		const step = MIGRATIONS[v];
		if (!step) break;
		working = step(working);
	}
	const validated = validateSettings(working);
	return { data: validated.data, migratedFrom: from === SCHEMA_VERSION ? null : from, repaired: validated.repaired };
}

/**
 * Validate and REPAIR persisted settings. Anything unrecognised falls back to the default
 * rather than throwing, so a corrupted blob degrades to a working app with a clear notice.
 */
export function validateSettings(raw: unknown): { data: SettingsData; repaired: boolean } {
	const base = defaultSettings();
	if (!isRecord(raw)) return { data: base, repaired: true };
	let repaired = false;
	const pick = <T>(value: unknown, ok: (v: unknown) => boolean, fallback: T): T => {
		if (ok(value)) return value as T;
		repaired = true;
		return fallback;
	};

	const data: SettingsData = {
		version: SCHEMA_VERSION,
		theme: pick<Theme>(raw.theme, (v) => v === 'light' || v === 'dark' || v === 'system', base.theme),
		soundEnabled: pick(raw.soundEnabled, (v) => typeof v === 'boolean', base.soundEnabled),
		volume: pick(raw.volume, (v) => typeof v === 'number' && v >= 0 && v <= 1, base.volume),
		reduceMotion: pick(raw.reduceMotion, (v) => v === 'auto' || v === 'on' || v === 'off', base.reduceMotion),
		lastMode: pick<Mode>(raw.lastMode, (v) => MODES.includes(v as Mode), base.lastMode),
		savedGrids: [],
		savedGraphs: [],
		practice: base.practice,
		examplesLoaded: pick(raw.examplesLoaded, (v) => typeof v === 'boolean', base.examplesLoaded)
	};

	if (Array.isArray(raw.savedGrids)) {
		for (const item of raw.savedGrids.slice(0, 100)) {
			const grid = validateSavedGrid(item);
			if (grid) data.savedGrids.push(grid);
			else repaired = true;
		}
	} else if (raw.savedGrids !== undefined) repaired = true;

	if (Array.isArray(raw.savedGraphs)) {
		for (const item of raw.savedGraphs.slice(0, 100)) {
			const graph = validateSavedGraph(item);
			if (graph) data.savedGraphs.push(graph);
			else repaired = true;
		}
	} else if (raw.savedGraphs !== undefined) repaired = true;

	if (isRecord(raw.practice)) {
		const p = raw.practice;
		data.practice = {
			answered: nonNegInt(p.answered),
			correct: nonNegInt(p.correct),
			bestStreak: nonNegInt(p.bestStreak)
		};
		if (data.practice.correct > data.practice.answered) {
			data.practice.correct = data.practice.answered;
			repaired = true;
		}
	} else if (raw.practice !== undefined) repaired = true;

	return { data, repaired };
}

export const MODES: Mode[] = ['sorting', 'searching', 'pathfinding', 'graphs', 'compare', 'benchmark', 'practice', 'learn'];

export function validateSavedGrid(raw: unknown): SavedGrid | null {
	if (!isRecord(raw)) return null;
	const cols = Number(raw.cols);
	const rows = Number(raw.rows);
	if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols > 60 || rows > 40) return null;
	const cells = cols * rows;
	const start = Number(raw.start);
	const end = Number(raw.end);
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start >= cells || end >= cells) return null;
	if (!Array.isArray(raw.walls) || raw.walls.some((v) => !Number.isInteger(v) || (v as number) < 0)) return null;
	const wallTotal = (raw.walls as number[]).reduce((a, b) => a + b, 0);
	if (wallTotal > cells) return null;
	const weights: number[][] = [];
	if (Array.isArray(raw.weights)) {
		for (const pair of raw.weights) {
			if (!Array.isArray(pair) || pair.length !== 2) return null;
			const [i, w] = pair as number[];
			if (!Number.isInteger(i) || i < 0 || i >= cells) return null;
			if (!Number.isInteger(w) || w < 1 || w > 9) return null;
			weights.push([i, w]);
		}
	}
	return {
		id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : cryptoId(),
		name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Untitled grid',
		createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0,
		cols,
		rows,
		diagonal: raw.diagonal === true,
		start,
		end,
		walls: raw.walls as number[],
		weights
	};
}

export function validateSavedGraph(raw: unknown): SavedGraph | null {
	if (!isRecord(raw)) return null;
	if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
	if (raw.nodes.length > 200 || raw.edges.length > 600) return null;
	const nodes: SavedGraph['nodes'] = [];
	const ids = new Set<string>();
	for (const n of raw.nodes) {
		if (!isRecord(n)) return null;
		const id = typeof n.id === 'string' ? n.id.slice(0, 32) : '';
		if (!id || ids.has(id)) return null;
		ids.add(id);
		const x = Number(n.x);
		const y = Number(n.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		nodes.push({
			id,
			label: typeof n.label === 'string' && n.label ? n.label.slice(0, 4) : id.slice(0, 4),
			x: clamp(x, -5000, 5000),
			y: clamp(y, -5000, 5000)
		});
	}
	const edges: SavedGraph['edges'] = [];
	for (const e of raw.edges) {
		if (!isRecord(e)) return null;
		const from = typeof e.from === 'string' ? e.from : '';
		const to = typeof e.to === 'string' ? e.to : '';
		if (!ids.has(from) || !ids.has(to)) return null;
		const weight = Number(e.weight);
		if (!Number.isFinite(weight) || weight < -999 || weight > 999) return null;
		edges.push({
			id: typeof e.id === 'string' && e.id ? e.id.slice(0, 80) : `${from}->${to}`,
			from,
			to,
			weight: Math.round(weight)
		});
	}
	return {
		id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : cryptoId(),
		name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Untitled graph',
		createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0,
		directed: raw.directed === true,
		nodes,
		edges
	};
}

// ------------------------------------------------------------------- backup

export interface BackupFile {
	app: 'algolens';
	version: number;
	exportedAt: string;
	settings: SettingsData;
}

export function makeBackup(settings: SettingsData): BackupFile {
	return { app: 'algolens', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings };
}

export type BackupParse =
	| { ok: true; settings: SettingsData; repaired: boolean; migratedFrom: number | null }
	| { ok: false; error: string };

/** Parse an uploaded backup. Every failure returns a specific, user-readable reason. */
export function parseBackup(text: string): BackupParse {
	if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
	if (text.length > 4_000_000) return { ok: false, error: 'The file is larger than 4 MB, which is far bigger than any AlgoLens backup.' };
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: 'The file is not valid JSON. Pick the .json file exported from the Privacy and Backup page.' };
	}
	if (!isRecord(parsed)) return { ok: false, error: 'The file does not contain a JSON object.' };
	if (parsed.app !== 'algolens') return { ok: false, error: 'This file was not exported from AlgoLens (the "app" field does not say algolens).' };
	if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version) || parsed.version < 1) {
		return { ok: false, error: 'The backup is missing a valid version number.' };
	}
	if (parsed.version > SCHEMA_VERSION) {
		return { ok: false, error: `The backup was made by a newer version of AlgoLens (schema ${parsed.version}, this app understands ${SCHEMA_VERSION}).` };
	}
	if (!isRecord(parsed.settings)) return { ok: false, error: 'The backup has no "settings" object.' };
	const result = migrate({ ...parsed.settings, version: parsed.version });
	return { ok: true, settings: result.data, repaired: result.repaired, migratedFrom: result.migratedFrom };
}

// ------------------------------------------------------------------ helpers

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonNegInt(v: unknown): number {
	const n = Number(v);
	return Number.isInteger(n) && n >= 0 && n < 1e9 ? n : 0;
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

/** Short unique id. Uses crypto when available and falls back to a counter+time. */
let counter = 0;
export function cryptoId(): string {
	const g = globalThis as { crypto?: { randomUUID?: () => string } };
	if (g.crypto?.randomUUID) return g.crypto.randomUUID().slice(0, 12);
	counter += 1;
	return `id${Date.now().toString(36)}${counter.toString(36)}`;
}
