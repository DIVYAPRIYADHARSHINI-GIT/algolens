import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	defaultSettings,
	makeBackup,
	migrate,
	parseBackup,
	SCHEMA_VERSION,
	STORAGE_KEY,
	validateSavedGraph,
	validateSavedGrid,
	validateSettings
} from '../src/lib/core/schema.js';
import { createSettingsStore, type StorageLike } from '../src/lib/core/store.js';
import { decodeGrid, decodeShare, encodeGrid, encodeShare, validateShare, type ShareSetup } from '../src/lib/core/share.js';
import { divisionMaze, makeGrid, randomWalls, randomWeights } from '../src/lib/algorithms/grid.js';
import { sampleGraph, sampleGrid } from '../src/lib/data/samples.js';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k)
	};
}

describe('SettingsStore (localStorage implementation)', () => {
	it('starts from the defaults when storage is empty', () => {
		const store = createSettingsStore(memoryStorage());
		const s = store.read();
		expect(s.status).toBe('ok');
		expect(s.data).toEqual(defaultSettings());
	});

	it('round-trips a write through storage', () => {
		const storage = memoryStorage();
		const a = createSettingsStore(storage);
		a.update((d) => ({ ...d, theme: 'dark', soundEnabled: true, volume: 0.8 }));
		const b = createSettingsStore(storage);
		expect(b.read().data.theme).toBe('dark');
		expect(b.read().data.soundEnabled).toBe(true);
		expect(b.read().data.volume).toBe(0.8);
	});

	it('works with storage DISABLED (private browsing) and says so', () => {
		const store = createSettingsStore(null);
		const s = store.read();
		expect(s.status).toBe('unavailable');
		expect(s.message).toMatch(/memory only/i);
		// It still functions for the session.
		const after = store.update((d) => ({ ...d, theme: 'dark' }));
		expect(after.data.theme).toBe('dark');
	});

	it('survives a throwing getItem', () => {
		const throwing: StorageLike = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {},
			removeItem: () => {}
		};
		const s = createSettingsStore(throwing).read();
		expect(s.status).toBe('unavailable');
		expect(s.data).toEqual(defaultSettings());
	});

	it('reports FULL storage instead of losing the change silently', () => {
		const storage = memoryStorage();
		const full: StorageLike = {
			getItem: storage.getItem,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: storage.removeItem
		};
		const store = createSettingsStore(full);
		const s = store.update((d) => ({ ...d, theme: 'dark' }));
		expect(s.status).toBe('full');
		expect(s.message).toMatch(/storage is full/i);
		// The in-memory value is still correct, so nothing the user did is lost mid-session.
		expect(s.data.theme).toBe('dark');
	});

	it('recovers from deliberately corrupted saved data', () => {
		for (const bad of ['{', 'null', '[]', '"text"', '{"version":"x"}', '{"savedGrids":"no"}', 'undefined']) {
			const storage = memoryStorage();
			storage.map.set(STORAGE_KEY, bad);
			const s = createSettingsStore(storage).read();
			expect(['ok', 'repaired']).toContain(s.status);
			expect(s.data.version).toBe(SCHEMA_VERSION);
			expect(Array.isArray(s.data.savedGrids)).toBe(true);
		}
	});

	it('saves, renames and deletes grids and graphs', () => {
		const store = createSettingsStore(memoryStorage());
		const grid = validateSavedGrid({ ...encodeGrid(sampleGrid()), id: 'g1', name: 'Maze A', createdAt: 1 })!;
		expect(grid).toBeTruthy();
		store.saveGrid(grid);
		expect(store.read().data.savedGrids.length).toBe(1);
		store.renameGrid('g1', '  Renamed maze  ');
		expect(store.read().data.savedGrids[0].name).toBe('Renamed maze');
		store.deleteGrid('g1');
		expect(store.read().data.savedGrids.length).toBe(0);

		const graph = validateSavedGraph({ ...sampleGraph(), id: 'x1', name: 'Graph A', createdAt: 1 })!;
		store.saveGraph(graph);
		expect(store.read().data.savedGraphs.length).toBe(1);
		store.renameGraph('x1', 'Renamed graph');
		expect(store.read().data.savedGraphs[0].name).toBe('Renamed graph');
		store.deleteGraph('x1');
		expect(store.read().data.savedGraphs.length).toBe(0);
	});

	it('saving the same id twice replaces rather than duplicates', () => {
		const store = createSettingsStore(memoryStorage());
		const base = validateSavedGrid({ ...encodeGrid(makeGrid(8, 8)), id: 'same', name: 'First', createdAt: 1 })!;
		store.saveGrid(base);
		store.saveGrid({ ...base, name: 'Second' });
		expect(store.read().data.savedGrids.length).toBe(1);
		expect(store.read().data.savedGrids[0].name).toBe('Second');
	});

	it('clear() resets to defaults and empties the key', () => {
		const storage = memoryStorage();
		const store = createSettingsStore(storage);
		store.update((d) => ({ ...d, theme: 'dark' }));
		store.clear();
		expect(store.read().data).toEqual(defaultSettings());
		expect(storage.map.has(STORAGE_KEY)).toBe(false);
	});

	it('reports bytes used for the storage meter', () => {
		const store = createSettingsStore(memoryStorage());
		expect(store.read().bytesUsed).toBeGreaterThan(0);
		expect(store.read().bytesBudget).toBeGreaterThan(store.read().bytesUsed);
	});
});

describe('schema validation and migrations', () => {
	it('migrate fills defaults for an unversioned blob', () => {
		const r = migrate({ theme: 'dark' });
		expect(r.data.version).toBe(SCHEMA_VERSION);
		expect(r.data.theme).toBe('dark');
		expect(r.migratedFrom).toBe(0);
	});

	it('migrate leaves a current-version blob alone', () => {
		const current = { ...defaultSettings(), theme: 'light' as const };
		const r = migrate(current);
		expect(r.migratedFrom).toBeNull();
		expect(r.data.theme).toBe('light');
	});

	it('validateSettings repairs out-of-range values', () => {
		const r = validateSettings({
			version: 1,
			theme: 'purple',
			volume: 5,
			soundEnabled: 'yes',
			reduceMotion: 'maybe',
			lastMode: 'nonsense',
			practice: { answered: 3, correct: 99, bestStreak: -4 }
		});
		expect(r.repaired).toBe(true);
		expect(r.data.theme).toBe('system');
		expect(r.data.volume).toBe(0.3);
		expect(r.data.soundEnabled).toBe(false);
		expect(r.data.lastMode).toBe('sorting');
		expect(r.data.practice.correct).toBeLessThanOrEqual(r.data.practice.answered);
		expect(r.data.practice.bestStreak).toBe(0);
	});

	it('rejects oversized and malformed saved grids', () => {
		expect(validateSavedGrid({ cols: 500, rows: 500, start: 0, end: 1, walls: [1] })).toBeNull();
		expect(validateSavedGrid({ cols: 10, rows: 10, start: -1, end: 5, walls: [100] })).toBeNull();
		expect(validateSavedGrid({ cols: 10, rows: 10, start: 0, end: 5, walls: [50, 60] })).toBeNull();
		expect(validateSavedGrid({ cols: 10, rows: 10, start: 0, end: 5, walls: [100], weights: [[5, 99]] })).toBeNull();
		expect(validateSavedGrid('not an object')).toBeNull();
	});

	it('rejects malformed saved graphs', () => {
		expect(validateSavedGraph({ nodes: 'x', edges: [] })).toBeNull();
		expect(validateSavedGraph({ nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 1, y: 1 }], edges: [] })).toBeNull();
		expect(validateSavedGraph({ nodes: [{ id: 'a', x: 0, y: 0 }], edges: [{ from: 'a', to: 'ghost', weight: 1 }] })).toBeNull();
		expect(validateSavedGraph({ nodes: [{ id: 'a', x: NaN, y: 0 }], edges: [] })).toBeNull();
	});
});

describe('JSON backup export and import', () => {
	it('round-trips a full backup', () => {
		const store = createSettingsStore(memoryStorage());
		store.update((d) => ({ ...d, theme: 'dark', practice: { answered: 10, correct: 7, bestStreak: 4 } }));
		store.saveGraph(validateSavedGraph({ ...sampleGraph(), id: 'g', name: 'Sample', createdAt: 5 })!);
		const text = JSON.stringify(makeBackup(store.read().data));
		const parsed = parseBackup(text);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.settings.theme).toBe('dark');
			expect(parsed.settings.practice.correct).toBe(7);
			expect(parsed.settings.savedGraphs.length).toBe(1);
		}
	});

	it('gives a specific error for every kind of broken file', () => {
		const cases: [string, RegExp][] = [
			['', /empty/i],
			['   ', /empty/i],
			['{not json', /not valid JSON/i],
			['[]', /JSON object/i],
			['"text"', /JSON object/i],
			['{"app":"other","version":1,"settings":{}}', /not exported from AlgoLens/i],
			['{"app":"algolens","settings":{}}', /version number/i],
			['{"app":"algolens","version":0,"settings":{}}', /version number/i],
			['{"app":"algolens","version":99,"settings":{}}', /newer version/i],
			['{"app":"algolens","version":1}', /no "settings"/i],
			['{"app":"algolens","version":1,"settings":[]}', /no "settings"/i]
		];
		for (const [text, pattern] of cases) {
			const r = parseBackup(text);
			expect(r.ok, text).toBe(false);
			if (!r.ok) expect(r.error, text).toMatch(pattern);
		}
	});

	it('rejects an absurdly large file instead of parsing it', () => {
		const huge = '{"app":"algolens","version":1,"settings":{}}' + ' '.repeat(4_000_001);
		const r = parseBackup(huge);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/larger than 4 MB/i);
	});

	it('never throws on arbitrary strings (fuzz)', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 300 }), (text) => {
				const r = parseBackup(text);
				return typeof r.ok === 'boolean';
			}),
			{ numRuns: 200 }
		);
	});

	it('imports a backup containing invalid entries by repairing, never by crashing', () => {
		const text = JSON.stringify({
			app: 'algolens',
			version: 1,
			settings: { theme: 'dark', savedGrids: [{ cols: 999, rows: 999 }], savedGraphs: ['nope'] }
		});
		const r = parseBackup(text);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.repaired).toBe(true);
			expect(r.settings.savedGrids).toEqual([]);
			expect(r.settings.savedGraphs).toEqual([]);
			expect(r.settings.theme).toBe('dark');
		}
	});
});

describe('grid run-length encoding', () => {
	it('round-trips walls and weights exactly', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const grid = randomWeights(randomWalls(makeGrid(20, 15, seed % 2 === 0), seed), seed);
			const back = decodeGrid(encodeGrid(grid));
			expect(back.walls, `seed ${seed}`).toEqual(grid.walls);
			expect(back.weights).toEqual(grid.weights);
			expect(back.start).toBe(grid.start);
			expect(back.end).toBe(grid.end);
			expect(back.diagonal).toBe(grid.diagonal);
		}
	});

	it('round-trips the largest supported grid', () => {
		const grid = divisionMaze(makeGrid(60, 40), 3);
		expect(decodeGrid(encodeGrid(grid)).walls).toEqual(grid.walls);
	});

	it('round-trips an all-open and an all-walled grid', () => {
		const open = makeGrid(10, 10);
		expect(decodeGrid(encodeGrid(open)).walls).toEqual(open.walls);
		const closed = { ...open, walls: open.walls.map(() => true) };
		expect(decodeGrid(encodeGrid(closed)).walls).toEqual(closed.walls);
	});
});

describe('share links', () => {
	const setup = (): ShareSetup => ({
		v: 1,
		mode: 'pathfinding',
		sorting: { algorithm: 'quick', values: [5, 3, 9, 1], pivot: 'median3', seed: 42, view: 'bars' },
		searching: { algorithm: 'binary', values: [1, 2, 3, 4, 5], target: 4 },
		pathfinding: { algorithm: 'astar', heuristic: 'manhattan', grid: encodeGrid(sampleGrid()) },
		graphs: { algorithm: 'dijkstra', graph: sampleGraph(), start: 'n1', end: 'n6' },
		compare: { left: 'bubble', right: 'merge', values: [4, 2, 7] }
	});

	it('round-trips a complete setup', () => {
		const encoded = encodeShare(setup());
		const decoded = decodeShare(encoded);
		expect(decoded.ok).toBe(true);
		if (decoded.ok) {
			expect(decoded.setup.mode).toBe('pathfinding');
			expect(decoded.setup.sorting?.algorithm).toBe('quick');
			expect(decoded.setup.sorting?.values).toEqual([5, 3, 9, 1]);
			expect(decoded.setup.pathfinding?.grid.cols).toBe(24);
			expect(decoded.setup.graphs?.graph.nodes.length).toBe(6);
			expect(decoded.setup.compare?.right).toBe('merge');
		}
	});

	it('accepts a hash with the leading # and s= prefix', () => {
		const encoded = encodeShare(setup());
		expect(decodeShare(`#s=${encoded}`).ok).toBe(true);
		expect(decodeShare(`#${encoded}`).ok).toBe(true);
	});

	it('rejects broken, oversized and hostile links with clear errors', () => {
		const good = encodeShare(setup());
		const cases: [string, RegExp][] = [
			['', /does not contain any shared setup/i],
			['#', /does not contain any shared setup/i],
			['!!!!', /characters that are not part/i],
			['<script>alert(1)</script>', /characters that are not part/i],
			['A'.repeat(9000), /too long/i],
			[good.slice(0, Math.floor(good.length / 2)), /(could not be decoded|does not contain a valid)/i],
			[encodeShare({ ...setup(), v: 99 }), /share format/i]
		];
		for (const [hash, pattern] of cases) {
			const r = decodeShare(hash);
			expect(r.ok, hash.slice(0, 30)).toBe(false);
			if (!r.ok) expect(r.error, hash.slice(0, 30)).toMatch(pattern);
		}
	});

	it('rejects a setup with an unknown algorithm name', () => {
		const bad = encodeShare({ ...setup(), sorting: { ...setup().sorting!, algorithm: 'bogosort' as never } });
		const r = decodeShare(bad);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/sorting algorithm that does not exist/i);
	});

	it('rejects an oversized grid inside an otherwise valid link', () => {
		const bad = encodeShare({
			...setup(),
			pathfinding: { algorithm: 'bfs', heuristic: 'manhattan', grid: { ...encodeGrid(makeGrid(10, 10)), cols: 500, rows: 500 } }
		});
		const r = decodeShare(bad);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/grid is not valid/i);
	});

	it('rejects prototype-pollution style payloads', () => {
		const r = validateShare(JSON.parse('{"v":1,"mode":"sorting","__proto__":{"polluted":true}}'));
		expect(r.ok).toBe(true);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('never throws on arbitrary hash input (fuzz)', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 200 }), (s) => {
				const r = decodeShare(s);
				return typeof r.ok === 'boolean';
			}),
			{ numRuns: 250 }
		);
	});

	it('property: any valid sorting setup survives the round trip', () => {
		fc.assert(
			fc.property(
				fc.array(fc.integer({ min: -9999, max: 9999 }), { minLength: 1, maxLength: 100 }),
				fc.constantFrom('bubble', 'selection', 'insertion', 'merge', 'quick', 'heap', 'shell'),
				(values, algorithm) => {
					const s: ShareSetup = { v: 1, mode: 'sorting', sorting: { algorithm: algorithm as never, values, pivot: 'last', seed: 1, view: 'bars' } };
					const d = decodeShare(encodeShare(s));
					return d.ok && JSON.stringify(d.setup.sorting?.values) === JSON.stringify(values);
				}
			),
			{ numRuns: 60 }
		);
	});
});
