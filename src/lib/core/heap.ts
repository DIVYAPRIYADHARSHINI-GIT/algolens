// Deterministic binary min-heap. Ties break on insertion order so every run of the same
// input produces the same animation (and the same recorded steps) on every machine.

export interface HeapItem<T> {
	key: number;
	value: T;
}

export class MinHeap<T> {
	private items: { key: number; seq: number; value: T }[] = [];
	private seq = 0;

	get size(): number {
		return this.items.length;
	}

	push(key: number, value: T): void {
		this.items.push({ key, seq: this.seq++, value });
		this.up(this.items.length - 1);
	}

	pop(): HeapItem<T> | undefined {
		if (!this.items.length) return undefined;
		const top = this.items[0];
		const last = this.items.pop()!;
		if (this.items.length) {
			this.items[0] = last;
			this.down(0);
		}
		return { key: top.key, value: top.value };
	}

	/** Snapshot sorted the way a user would read a priority queue. */
	toSortedArray(): HeapItem<T>[] {
		return [...this.items].sort((a, b) => a.key - b.key || a.seq - b.seq).map((i) => ({ key: i.key, value: i.value }));
	}

	private less(a: number, b: number): boolean {
		const x = this.items[a];
		const y = this.items[b];
		return x.key < y.key || (x.key === y.key && x.seq < y.seq);
	}

	private up(i: number): void {
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (!this.less(i, p)) break;
			[this.items[i], this.items[p]] = [this.items[p], this.items[i]];
			i = p;
		}
	}

	private down(i: number): void {
		const n = this.items.length;
		while (true) {
			const l = 2 * i + 1;
			const r = l + 1;
			let m = i;
			if (l < n && this.less(l, m)) m = l;
			if (r < n && this.less(r, m)) m = r;
			if (m === i) break;
			[this.items[i], this.items[m]] = [this.items[m], this.items[i]];
			i = m;
		}
	}
}
