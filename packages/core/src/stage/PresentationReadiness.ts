import type { SpatialElementPreparation } from '../catalog/CatalogPreparation.js';
import {
	ASYNC_REVEAL_DURATION,
	clampProgress,
	easeInOutSine,
	type TransitionMode
} from '../catalog/transitionTiming.js';

/** Independent background and High readiness, frozen once the transition clock starts. */
export class PresentationReadiness {
	private preparation?: SpatialElementPreparation;
	private motionMode?: TransitionMode;
	private deferredDetail = false;
	private pending = false;
	private prepared = false;
	private started?: number;
	private applied = false;

	get entry() {
		return this.preparation;
	}
	get mode() {
		return this.motionMode;
	}
	get deferred() {
		return this.deferredDetail;
	}
	get backgroundPending() {
		return this.pending;
	}
	get backgroundPrepared() {
		return this.prepared;
	}
	get backgroundApplied() {
		return this.applied;
	}
	get animating() {
		return this.pending && this.started !== undefined;
	}

	reset(deferred: boolean) {
		this.preparation = undefined;
		this.motionMode = undefined;
		this.deferredDetail = deferred;
		this.pending = this.prepared = this.applied = false;
		this.started = undefined;
	}
	attach(entry: SpatialElementPreparation | undefined) {
		this.preparation = entry;
	}
	resume(entry: SpatialElementPreparation) {
		this.deferredDetail = false;
		this.motionMode = undefined;
		this.preparation = entry;
	}
	markApplied() {
		this.applied = true;
	}
	useSynchronousMotion() {
		this.motionMode = 'synchronous';
	}
	completeMotion() {
		if (this.motionMode === 'synchronous') this.pending = false;
	}

	freeze(dock: boolean, adoptedForward: boolean): TransitionMode {
		if (dock) {
			this.useSynchronousMotion();
			return 'synchronous';
		}
		const entry = this.preparation;
		const ready =
			!adoptedForward &&
			entry?.backgroundState === 'ready' &&
			(entry.highState === 'ready' || entry.highState === 'unavailable');
		this.motionMode = ready ? 'synchronous' : 'asynchronous';
		this.prepared = entry?.backgroundState === 'ready';
		this.pending = !this.prepared;
		this.started = undefined;
		return this.motionMode;
	}

	/** A late High must not reset a background already revealed by the motion clock. */
	acceptsClockOpacity() {
		return this.motionMode !== 'asynchronous' || !this.pending;
	}
	advance(now: number, reducedMotion: boolean): number | undefined {
		if (!this.pending && this.motionMode) return;
		if (!this.preparation || this.preparation.backgroundState === 'loading') return;
		if (this.motionMode === 'asynchronous' && this.pending) {
			this.started ??= now;
			const opacity = reducedMotion
				? 1
				: easeInOutSine(clampProgress((now - this.started) / ASYNC_REVEAL_DURATION));
			if (opacity === 1) this.pending = false;
			return opacity;
		}
		if (!this.motionMode) return 1;
	}
}
