export type StageScrollInputSource =
	'direct' | 'keyboard' | 'navigation' | 'programmatic' | 'touch' | 'precision-wheel' | 'wheel';

export interface StageScrollFrame {
	time: number;
	/** Shared visual position consumed by DOM, CSS3D, docking, and WebGPU. */
	scrollX: number;
	scrollY: number;
	/** Native browser position represented by the scrollbar and scroll proxy. */
	targetScrollX: number;
	targetScrollY: number;
	previousScrollX: number;
	previousScrollY: number;
	deltaX: number;
	deltaY: number;
	directionY: -1 | 0 | 1;
	inputSource: StageScrollInputSource;
	settled: boolean;
}

export type StageScrollFrameCallback = (frame: StageScrollFrame) => void;

/** Ensures DOM docking is committed before the stage measures its anchors. */
export const STAGE_SCROLL_PRIORITY = {
	/** Moves the visible DOM before any viewport-dependent consumers run. */
	virtualDocument: -100,
	dock: 0,
	stage: 100
} as const;

const SMOOTHING_RATE = {
	wheel: 32,
	keyboard: 28,
	programmatic: 22
} as const;
const SNAP_EPSILON = 0.1;
const MIN_MAX_LAG = 80;
const MAX_MAX_LAG = 120;
const MAX_FRAME_DELTA_SECONDS = 0.1;
const INPUT_MARK_LIFETIME = 220;
const PRECISION_WHEEL_DELTA = 48;
const PRECISION_WHEEL_INTERVAL = 40;
const DOM_DELTA_PIXEL = 0;
const KEYBOARD_SCROLL_KEYS = new Set([
	'ArrowDown',
	'ArrowUp',
	'End',
	'Home',
	'PageDown',
	'PageUp',
	' '
]);

interface ScrollFrameSubscription {
	id: number;
	priority: number;
	callback: StageScrollFrameCallback;
}

const subscriptions = new Map<number, ScrollFrameSubscription>();
let nextSubscriptionId = 1;
let animationFrame = 0;
let listening = false;
let visualScrollX = 0;
let visualScrollY = 0;
let previousScrollX = 0;
let previousScrollY = 0;
let lastFrameTime = 0;
let markedInputSource: StageScrollInputSource = 'direct';
let markedInputUntil = 0;
let markedInputPending = false;
let activeInputSource: StageScrollInputSource = 'direct';
let lastWheelTime = -Infinity;
let reducedMotionQuery: MediaQueryList | undefined;

/** Marks application-initiated scrolling for the shared visual transition. */
export function markStageScrollInput(source: StageScrollInputSource) {
	markedInputSource = source;
	markedInputUntil = now() + INPUT_MARK_LIFETIME;
	markedInputPending = true;
}

/** Returns the last visual position, or the native position before initialization. */
export function getStageVisualScrollPosition() {
	return listening
		? { scrollX: visualScrollX, scrollY: visualScrollY }
		: { scrollX: window.scrollX, scrollY: window.scrollY };
}

/** Rebase every consumer after restoration, including when no native scroll event fires. */
export function syncStageScrollToNative() {
	if (animationFrame) cancelAnimationFrame(animationFrame);
	animationFrame = 0;
	visualScrollX = previousScrollX = window.scrollX;
	visualScrollY = previousScrollY = window.scrollY;
	lastFrameTime = 0;
	activeInputSource = 'navigation';
	markedInputSource = 'direct';
	markedInputUntil = 0;
	markedInputPending = false;
	if (subscriptions.size) flushScrollFrame(now());
	return { scrollX: visualScrollX, scrollY: visualScrollY };
}

/**
 * Shares one visual scroll timeline across DOM and WebGPU owners. Discrete
 * inputs are time-smoothed; precision, touch, and scrollbar movement stay exact.
 */
export function subscribeStageScrollFrame(
	callback: StageScrollFrameCallback,
	priority: number = STAGE_SCROLL_PRIORITY.stage
) {
	const id = nextSubscriptionId;
	nextSubscriptionId += 1;
	subscriptions.set(id, { id, priority, callback });

	if (!listening) startListening();

	return () => {
		subscriptions.delete(id);
		if (subscriptions.size) return;
		stopListening();
	};
}

function startListening() {
	visualScrollX = window.scrollX;
	visualScrollY = window.scrollY;
	previousScrollX = visualScrollX;
	previousScrollY = visualScrollY;
	lastFrameTime = 0;
	activeInputSource = 'direct';
	markedInputSource = 'direct';
	markedInputUntil = 0;
	markedInputPending = false;
	lastWheelTime = -Infinity;
	reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	window.addEventListener('scroll', handleNativeScroll, { passive: true });
	// Classify wheel input before OrbitControls or another target listener can
	// stop propagation. Native scroll is dispatched after this capture phase, so
	// the shared visual frame always receives the correct smoothing source.
	window.addEventListener('wheel', handleWheelInput, { capture: true, passive: true });
	window.addEventListener('keydown', handleKeyboardInput);
	window.addEventListener('touchstart', handleTouchInput, { passive: true });
	window.addEventListener('pointerdown', handlePointerInput, { passive: true });
	listening = true;
}

function stopListening() {
	window.removeEventListener('scroll', handleNativeScroll);
	window.removeEventListener('wheel', handleWheelInput, { capture: true });
	window.removeEventListener('keydown', handleKeyboardInput);
	window.removeEventListener('touchstart', handleTouchInput);
	window.removeEventListener('pointerdown', handlePointerInput);
	if (animationFrame) cancelAnimationFrame(animationFrame);
	animationFrame = 0;
	lastFrameTime = 0;
	reducedMotionQuery = undefined;
	listening = false;
}

function handleNativeScroll() {
	activeInputSource =
		markedInputPending || now() <= markedInputUntil ? markedInputSource : 'direct';
	markedInputPending = false;
	scheduleScrollFrame();
}

function handleWheelInput(event: WheelEvent) {
	const currentTime = now();
	const interval = currentTime - lastWheelTime;
	lastWheelTime = currentTime;
	const delta = Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY));
	const precisionInput =
		event.deltaMode === DOM_DELTA_PIXEL &&
		(delta <= PRECISION_WHEEL_DELTA ||
			(interval <= PRECISION_WHEEL_INTERVAL && delta < PRECISION_WHEEL_DELTA * 2));
	markStageScrollInput(precisionInput ? 'precision-wheel' : 'wheel');
}

function handleKeyboardInput(event: KeyboardEvent) {
	if (KEYBOARD_SCROLL_KEYS.has(event.key)) markStageScrollInput('keyboard');
}

function handleTouchInput() {
	markStageScrollInput('touch');
}

function handlePointerInput(event: PointerEvent) {
	markStageScrollInput(event.pointerType === 'touch' ? 'touch' : 'direct');
}

function scheduleScrollFrame() {
	if (animationFrame || !subscriptions.size) return;
	animationFrame = requestAnimationFrame(flushScrollFrame);
}

function flushScrollFrame(time: number) {
	animationFrame = 0;
	const targetScrollX = window.scrollX;
	const targetScrollY = window.scrollY;
	const deltaSeconds = lastFrameTime
		? Math.min(Math.max((time - lastFrameTime) / 1000, 0), MAX_FRAME_DELTA_SECONDS)
		: 1 / 60;
	lastFrameTime = time;

	const smoothingRate = getSmoothingRate(activeInputSource);
	if (smoothingRate === undefined || reducedMotionQuery?.matches) {
		visualScrollX = targetScrollX;
		visualScrollY = targetScrollY;
	} else {
		const maxLag = Math.min(
			Math.max((window.innerHeight || MAX_MAX_LAG) * 0.12, MIN_MAX_LAG),
			MAX_MAX_LAG
		);
		visualScrollX = dampScrollValue(
			visualScrollX,
			targetScrollX,
			smoothingRate,
			deltaSeconds,
			maxLag
		);
		visualScrollY = dampScrollValue(
			visualScrollY,
			targetScrollY,
			smoothingRate,
			deltaSeconds,
			maxLag
		);
	}

	const settled =
		Math.abs(targetScrollX - visualScrollX) <= SNAP_EPSILON &&
		Math.abs(targetScrollY - visualScrollY) <= SNAP_EPSILON;
	if (settled) {
		visualScrollX = targetScrollX;
		visualScrollY = targetScrollY;
	}

	const deltaX = visualScrollX - previousScrollX;
	const deltaY = visualScrollY - previousScrollY;
	const frame = Object.freeze({
		time,
		scrollX: visualScrollX,
		scrollY: visualScrollY,
		targetScrollX,
		targetScrollY,
		previousScrollX,
		previousScrollY,
		deltaX,
		deltaY,
		directionY: Math.sign(deltaY) as -1 | 0 | 1,
		inputSource: activeInputSource,
		settled
	});
	previousScrollX = visualScrollX;
	previousScrollY = visualScrollY;
	const orderedSubscriptions = Array.from(subscriptions.values()).sort(
		(left, right) => left.priority - right.priority || left.id - right.id
	);

	for (const subscription of orderedSubscriptions) {
		if (subscriptions.has(subscription.id)) subscription.callback(frame);
	}

	if (!settled && subscriptions.size) scheduleScrollFrame();
	else {
		activeInputSource = 'direct';
		lastFrameTime = 0;
	}
}

function getSmoothingRate(source: StageScrollInputSource) {
	switch (source) {
		case 'wheel':
			return SMOOTHING_RATE.wheel;
		case 'keyboard':
			return SMOOTHING_RATE.keyboard;
		case 'programmatic':
			return SMOOTHING_RATE.programmatic;
		default:
			return undefined;
	}
}

function dampScrollValue(
	current: number,
	target: number,
	rate: number,
	deltaSeconds: number,
	maxLag: number
) {
	const distance = target - current;
	const clampedCurrent =
		Math.abs(distance) > maxLag ? target - Math.sign(distance) * maxLag : current;
	const alpha = 1 - Math.exp(-rate * deltaSeconds);
	const next = clampedCurrent + (target - clampedCurrent) * alpha;
	return Math.abs(target - next) <= SNAP_EPSILON ? target : next;
}

function now() {
	return typeof performance === 'undefined' ? Date.now() : performance.now();
}
