// Playback engine. Pure logic: it owns the cursor and the VisualState and exposes
// play/pause/step/seek. It does NOT own a timer - the caller drives `tick(nowMs)` from a
// requestAnimationFrame loop (or from a test, with a fake clock), which is what keeps the
// engine unit-testable and free of browser globals.
//
// Correctness guarantee under test: `seek(k)` always equals `replayTo(k)`, because seeking
// either walks the inverse patches backwards or the forward patches forwards from the
// current cursor; both paths are exact.

import { initialState, replayTo, stepBack, stepForward, type VisualState } from './state.js';
import type { Trace } from './types.js';

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

/** Base delay for 1x playback, in milliseconds per step. */
export const BASE_STEP_MS = 220;

export interface EngineSnapshot {
	index: number;
	total: number;
	playing: boolean;
	speed: Speed;
	atStart: boolean;
	atEnd: boolean;
	state: VisualState;
	line: number;
	explain: string;
}

export class PlaybackEngine {
	private trace: Trace;
	private state: VisualState;
	/** Number of steps APPLIED. 0 = the initial state, trace.steps.length = finished. */
	private cursor = 0;
	private playing = false;
	private speedValue: Speed = 1;
	private lastTick: number | null = null;
	private accumulator = 0;

	constructor(trace: Trace) {
		this.trace = trace;
		this.state = initialState(trace.initial);
	}

	/** Replace the trace and rewind. Used when the input or algorithm changes. */
	load(trace: Trace): void {
		this.trace = trace;
		this.state = initialState(trace.initial);
		this.cursor = 0;
		this.playing = false;
		this.lastTick = null;
		this.accumulator = 0;
	}

	get total(): number {
		return this.trace.steps.length;
	}

	get index(): number {
		return this.cursor;
	}

	get isPlaying(): boolean {
		return this.playing;
	}

	get speed(): Speed {
		return this.speedValue;
	}

	get atStart(): boolean {
		return this.cursor === 0;
	}

	get atEnd(): boolean {
		return this.cursor >= this.total;
	}

	get currentStep() {
		return this.cursor > 0 ? this.trace.steps[this.cursor - 1] : undefined;
	}

	get line(): number {
		return this.currentStep?.line ?? 1;
	}

	get explain(): string {
		return this.currentStep?.explain ?? 'Press play, or step forward, to start the run.';
	}

	get visualState(): VisualState {
		return this.state;
	}

	play(): void {
		if (this.atEnd) this.seek(0);
		this.playing = true;
		this.lastTick = null;
		this.accumulator = 0;
	}

	pause(): void {
		this.playing = false;
		this.lastTick = null;
	}

	toggle(): void {
		if (this.playing) this.pause();
		else this.play();
	}

	setSpeed(speed: Speed): void {
		// Changing speed only changes the delay between steps, never the sequence of states.
		this.speedValue = speed;
		this.accumulator = 0;
	}

	nudgeSpeed(direction: 1 | -1): Speed {
		const i = SPEEDS.indexOf(this.speedValue);
		const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + direction))];
		this.setSpeed(next);
		return next;
	}

	forward(): boolean {
		if (this.atEnd) return false;
		stepForward(this.state, this.trace, this.cursor);
		this.cursor++;
		return true;
	}

	back(): boolean {
		if (this.atStart) return false;
		this.cursor--;
		stepBack(this.state, this.trace, this.cursor);
		return true;
	}

	/** Jump to exactly `index` applied steps. Clamped; always exact. */
	seek(index: number): void {
		const target = Math.max(0, Math.min(this.total, Math.floor(index)));
		if (target === this.cursor) return;
		// Walking is O(delta); a full replay is O(target). Pick the cheaper direction.
		const walkCost = Math.abs(target - this.cursor);
		if (walkCost > target) {
			this.state = replayTo(this.trace, target);
			this.cursor = target;
			return;
		}
		while (this.cursor < target) this.forward();
		while (this.cursor > target) this.back();
	}

	toStart(): void {
		this.pause();
		this.seek(0);
	}

	toEnd(): void {
		this.pause();
		this.seek(this.total);
	}

	/**
	 * Advance playback using a wall clock. Returns the number of steps applied.
	 * At high speeds several steps are applied per frame, which is why the renderer
	 * rate-limits its live announcements instead of speaking every step.
	 */
	tick(now: number, maxStepsPerTick = 64): number {
		if (!this.playing) return 0;
		if (this.lastTick === null) {
			this.lastTick = now;
			return 0;
		}
		const delta = Math.max(0, Math.min(250, now - this.lastTick));
		this.lastTick = now;
		this.accumulator += delta;
		const perStep = BASE_STEP_MS / this.speedValue;
		let applied = 0;
		while (this.accumulator >= perStep && applied < maxStepsPerTick) {
			this.accumulator -= perStep;
			if (!this.forward()) {
				this.playing = false;
				this.accumulator = 0;
				break;
			}
			applied++;
		}
		if (this.atEnd) this.playing = false;
		return applied;
	}

	snapshot(): EngineSnapshot {
		return {
			index: this.cursor,
			total: this.total,
			playing: this.playing,
			speed: this.speedValue,
			atStart: this.atStart,
			atEnd: this.atEnd,
			state: this.state,
			line: this.line,
			explain: this.explain
		};
	}
}
