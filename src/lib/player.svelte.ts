// Svelte-facing wrapper around the pure PlaybackEngine.
//
// Responsibilities kept HERE (not in the engine): the requestAnimationFrame loop, the
// rate-limited screen-reader announcement, the optional comparison tone, and teardown of
// every timer, frame and audio node. The engine itself stays pure and testable.

import { browser } from '$app/env';
import { PlaybackEngine, SPEEDS, type Speed } from './core/engine.js';
import type { Trace } from './core/types.js';
import { cloneVisualState, emptyVisualState, type VisualState } from './core/state.js';

/** Announce at most this often, so a fast run does not flood a screen reader. */
const ANNOUNCE_MS = 900;
/* A step cadence faster than this is applied in batches per frame, which keeps the visible
 * change rate at the frame rate (about 60 Hz of smooth motion) rather than flashing. The
 * three-flashes-per-second guideline is about discrete flashes; bars moving continuously at
 * frame rate are not flashes, and nothing in the UI blinks on a timer. */

export class Player {
	private engine: PlaybackEngine;
	private frame: number | null = null;
	private audio: AudioContext | null = null;
	private lastAnnounce = 0;
	private lastTone = 0;

	index = $state(0);
	total = $state(0);
	playing = $state(false);
	speed = $state<Speed>(1);
	line = $state(1);
	explain = $state('Press play, or step forward, to start the run.');
	announcement = $state('');
	/**
	 * The published view of the engine state.
	 *
	 * The engine mutates ONE VisualState in place, which is what makes stepping cheap, but
	 * Svelte cannot observe a mutation of a plain object. So every sync publishes a fresh
	 * shallow copy; templates then see a new reference and re-render. The copy is small
	 * (at most a 100-element array, or a 2,400-cell grid) and happens once per frame, not
	 * once per step, because fast playback applies steps in batches.
	 */
	view = $state<VisualState>(emptyVisualState());

	soundEnabled = false;
	volume = 0.3;

	constructor(trace: Trace) {
		this.engine = new PlaybackEngine(trace);
		this.sync();
	}

	get state(): VisualState {
		return this.view;
	}

	get atStart(): boolean {
		return this.index === 0;
	}

	get atEnd(): boolean {
		return this.total > 0 && this.index >= this.total;
	}

	load(trace: Trace, autoplay = false): void {
		this.stopLoop();
		this.engine.load(trace);
		this.engine.setSpeed(this.speed);
		this.sync();
		if (autoplay) this.play();
	}

	private sync(): void {
		this.index = this.engine.index;
		this.total = this.engine.total;
		this.playing = this.engine.isPlaying;
		this.speed = this.engine.speed;
		this.line = this.engine.line;
		this.explain = this.engine.explain;
		this.view = cloneVisualState(this.engine.visualState);
	}

	private announce(force = false): void {
		if (!browser) return;
		const now = performance.now();
		if (force || now - this.lastAnnounce > ANNOUNCE_MS) {
			this.lastAnnounce = now;
			this.announcement = `Step ${this.index} of ${this.total}. ${this.explain}`;
		}
	}

	private playTone(): void {
		if (!browser || !this.soundEnabled || this.volume <= 0) return;
		const now = performance.now();
		// Never more than ~14 tones a second, and never during a batched fast-forward.
		if (now - this.lastTone < 70) return;
		this.lastTone = now;
		try {
			// Created lazily, only after a user gesture has already started playback.
			if (!this.audio) {
				const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (!Ctor) return;
				this.audio = new Ctor();
			}
			if (this.audio.state === 'suspended') void this.audio.resume();
			const ctx = this.audio;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const value = this.state.array[this.state.cursors.i ?? 0] ?? 40;
			osc.type = 'sine';
			osc.frequency.value = 220 + Math.min(900, Math.abs(value) * 8);
			gain.gain.value = 0.0001;
			osc.connect(gain);
			gain.connect(ctx.destination);
			const t = ctx.currentTime;
			gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume * 0.15), t + 0.008);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
			osc.start(t);
			osc.stop(t + 0.08);
			osc.onended = () => {
				osc.disconnect();
				gain.disconnect();
			};
		} catch {
			// Audio is strictly optional; a failure must never break playback.
			this.soundEnabled = false;
		}
	}

	play(): void {
		if (!this.total) return;
		this.engine.play();
		this.sync();
		this.startLoop();
	}

	pause(): void {
		this.engine.pause();
		this.stopLoop();
		this.sync();
		this.announce(true);
	}

	toggle(): void {
		if (this.playing) this.pause();
		else this.play();
	}

	forward(): void {
		this.pause();
		if (this.engine.forward()) {
			this.sync();
			this.announce(true);
			this.playTone();
		}
	}

	back(): void {
		this.pause();
		if (this.engine.back()) {
			this.sync();
			this.announce(true);
		}
	}

	seek(index: number): void {
		this.engine.seek(index);
		this.sync();
		this.announce(true);
	}

	toStart(): void {
		this.stopLoop();
		this.engine.toStart();
		this.sync();
		this.announce(true);
	}

	toEnd(): void {
		this.stopLoop();
		this.engine.toEnd();
		this.sync();
		this.announce(true);
	}

	setSpeed(speed: Speed): void {
		this.engine.setSpeed(speed);
		this.speed = speed;
	}

	nudgeSpeed(direction: 1 | -1): void {
		this.speed = this.engine.nudgeSpeed(direction);
	}

	private startLoop(): void {
		if (!browser || this.frame !== null) return;
		const step = (now: number) => {
			const applied = this.engine.tick(now);
			if (applied > 0) {
				this.sync();
				this.announce();
				if (applied === 1) this.playTone();
			}
			if (!this.engine.isPlaying) {
				this.stopLoop();
				this.sync();
				this.announce(true);
				return;
			}
			this.frame = requestAnimationFrame(step);
		};
		this.frame = requestAnimationFrame(step);
	}

	private stopLoop(): void {
		if (this.frame !== null && browser) cancelAnimationFrame(this.frame);
		this.frame = null;
	}

	/** Release the frame loop and the audio context. Called from onMount teardown. */
	destroy(): void {
		this.stopLoop();
		this.engine.pause();
		if (this.audio) {
			void this.audio.close().catch(() => {});
			this.audio = null;
		}
	}
}

export { SPEEDS };
export type { Speed };
