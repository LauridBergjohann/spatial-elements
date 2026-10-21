import { DeviceYawFilter, screenOrientation } from './deviceYaw.js';

type PermissionConstructor = typeof DeviceOrientationEvent & {
	requestPermission?: () => Promise<PermissionState>;
};
export type OrientationStatus = 'unavailable' | 'permission' | 'active' | 'denied';
const listeners = new Set<() => void>();
const owners = new Map<HTMLElement, (status: OrientationStatus) => void>();
const visible = new Set<HTMLElement>();
const filter = new DeviceYawFilter();
let status: OrientationStatus = 'unavailable';
let yaw = 0;
let pitch = 0;
let roll = 0;
let calibratingUntil = 0;
let observer: IntersectionObserver | undefined;
let motion: MediaQueryList | undefined;
let lastSample = -Infinity;
let screenAngle = 0;
let listening = false;
let granted = false;
let denied = false;
let permissionPending: Promise<void> | undefined;
let probedPermission = false;
let permissionOwners = 0;
let hasHeading: boolean | undefined;
let scrollUntil = 0;
let scrollPaused = false;
let recoverUntil = 0;
const touchPointers = new Set<number>();
let touches = 0;
export const isDeviceOrientationPaused = () => touches > 0 || touchPointers.size > 0 || performance.now() < scrollUntil;
function pointerStart(event: PointerEvent) {
	if (event.pointerType !== 'touch') return;
	touchPointers.add(event.pointerId);
	pauseDeviceOrientationForScroll();
}
function pointerEnd(event: PointerEvent) {
	if (touchPointers.delete(event.pointerId)) pauseDeviceOrientationForScroll();
}
function touchChange(event: TouchEvent) {
	touches = event.touches.length;
	pauseDeviceOrientationForScroll();
}
function releaseTouches() {
	touches = 0;
	touchPointers.clear();
}

/** Called by native scrolling and the stage's virtual-scroll frame stream. */
export function pauseDeviceOrientationForScroll() {
	scrollUntil = performance.now() + 160;
	scrollPaused = true;
}

export const getListDeviceYaw = () => yaw;
export const getListDevicePitch = () => pitch;
export const getListDeviceRoll = () => roll;
export function subscribeListDeviceYaw(callback: () => void) {
	listeners.add(callback);
	return () => { listeners.delete(callback); };
}
function publish(value: number, pitchValue = 0, rollValue = 0) {
	if (value === yaw && pitchValue === pitch && rollValue === roll) return;
	yaw = value;
	pitch = pitchValue;
	roll = rollValue;
	for (const callback of listeners) callback();
}
function reset() {
	filter.reset();
	lastSample = -Infinity;
	publish(0);
}
function readScreenAngle() {
	return window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
}
function recalibrateScreen() {
	screenAngle = readScreenAngle();
	calibratingUntil = performance.now() + 300;
	reset();
}
function sample(event: DeviceOrientationEvent) {
	const now = performance.now();
	// Do not parse, filter, allocate quaternions or invalidate GPU rendering during scrolling.
	if (isDeviceOrientationPaused()) return;
	const { alpha, beta, gamma } = event;
	if (![beta, gamma].every(value => typeof value === 'number' && Number.isFinite(value))) {
		reset();
		return;
	}
	if (readScreenAngle() !== screenAngle) recalibrateScreen();
	// Screen rotation and sensor events can arrive in either order. Let the screen settle.
	if (now < calibratingUntil) return;
	if (now - lastSample < 1000 / 60 - 1) return;
	lastSample = now;
	// Some sensor/browser combinations expose tilt without a heading. Keep tilt usable.
	const headingAvailable = typeof alpha === 'number' && Number.isFinite(alpha);
	if (hasHeading !== headingAvailable) { hasHeading = headingAvailable; reset(); }
	const orientation = screenOrientation(headingAvailable ? alpha! : 0, beta!, gamma!, screenAngle);
	if (scrollPaused) {
		scrollPaused = false;
		filter.resume(orientation, now);
		recoverUntil = now + 700;
	}
	publish(filter.update(orientation, now, now < recoverUntil ? 400 : 60), filter.pitch, filter.roll);
}
function sync() {
	// Pointer media queries describe input devices, not sensor availability (e.g. Surface).
	const available = window.isSecureContext && 'DeviceOrientationEvent' in window && !motion?.matches;
	status = !available ? 'unavailable' : granted ? 'active'
		: (window.DeviceOrientationEvent as PermissionConstructor).requestPermission ? (denied ? 'denied' : 'permission') : 'active';
	const active = status === 'active' && visible.size > 0 && !document.hidden;
	if (active !== listening) {
		listening = active;
		if (active) window.addEventListener('deviceorientation', sample, { passive: true });
		else window.removeEventListener('deviceorientation', sample);
		reset();
	}
	for (const callback of owners.values()) callback(status);
}
/** A silent probe can recover existing consent; a prompt requires a navigation click. */
export function requestListDeviceOrientation(fromNavigation = true): Promise<void> {
	if (granted || denied) return Promise.resolve();
	if (permissionPending) return permissionPending;
	const attempt = async () => {
		try {
			const permission = (window.DeviceOrientationEvent as PermissionConstructor).requestPermission;
			granted = !permission || await permission.call(window.DeviceOrientationEvent) === 'granted';
			denied = !granted;
		} catch {
			// NotAllowedError without user activation is not a user denial.
			if (fromNavigation) denied = true;
		}
		if (owners.size) sync();
	};
	permissionPending = attempt().finally(() => { permissionPending = undefined; });
	return permissionPending;
}

function permissionAvailable() {
	return window.isSecureContext && 'DeviceOrientationEvent' in window &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function autoPermission() {
	if (!permissionAvailable() || probedPermission) return;
	probedPermission = true;
	void requestListDeviceOrientation(false);
}
function navigationPermission(event: MouseEvent) {
	if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.metaKey ||
		event.ctrlKey || event.shiftKey || event.altKey || !permissionAvailable()) return;
	const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
	if (!anchor || !anchor.hasAttribute('href') || anchor.hasAttribute('download') ||
		(anchor.target && anchor.target !== '_self')) return;
	const destination = new URL(anchor.href, window.location.href);
	if (destination.origin !== window.location.origin || !['http:', 'https:'].includes(destination.protocol)) return;
	// Invoke synchronously, before the router handles the click; never hold up navigation.
	void requestListDeviceOrientation(true);
}

/** Mount in the application shell so entry via detail/carousel pages also works. */
export function retainDeviceOrientationPermission() {
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
	if (permissionOwners++ === 0) document.addEventListener('click', navigationPermission, true);
	preference.addEventListener('change', autoPermission);
	autoPermission();
	return () => {
		preference.removeEventListener('change', autoPermission);
		if (--permissionOwners === 0) document.removeEventListener('click', navigationPermission, true);
	};
}

/** One shared sensor listener for all visible opted-in sections, with complete teardown. */
export function retainListDeviceOrientation(node: HTMLElement, callback: (status: OrientationStatus) => void) {
	const releasePermission = retainDeviceOrientationPermission();
	owners.set(node, callback);
	if (owners.size === 1) {
		scrollUntil = recoverUntil = 0;
		scrollPaused = false;
		window.addEventListener('scroll', pauseDeviceOrientationForScroll, { passive: true, capture: true });
		window.addEventListener('pointerdown', pointerStart, { passive: true, capture: true });
		window.addEventListener('pointerup', pointerEnd, { passive: true, capture: true });
		window.addEventListener('pointercancel', pointerEnd, { passive: true, capture: true });
		for (const name of ['touchstart', 'touchend', 'touchcancel'] as const)
			window.addEventListener(name, touchChange, { passive: true, capture: true });
		window.addEventListener('blur', releaseTouches);
		screenAngle = readScreenAngle();
		calibratingUntil = 0;
		window.screen.orientation?.addEventListener?.('change', recalibrateScreen);
		window.addEventListener('orientationchange', recalibrateScreen);
		motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		motion.addEventListener('change', sync);
		document.addEventListener('visibilitychange', sync);
		observer = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
				else visible.delete(entry.target as HTMLElement);
			}
			sync();
		});
	}
	observer!.observe(node);
	sync();
	return () => {
		releasePermission();
		observer?.unobserve(node);
		visible.delete(node);
		owners.delete(node);
		if (!owners.size) {
			window.removeEventListener('scroll', pauseDeviceOrientationForScroll, true);
			window.removeEventListener('pointerdown', pointerStart, true);
			window.removeEventListener('pointerup', pointerEnd, true);
			window.removeEventListener('pointercancel', pointerEnd, true);
			for (const name of ['touchstart', 'touchend', 'touchcancel'] as const)
				window.removeEventListener(name, touchChange, true);
			window.removeEventListener('blur', releaseTouches);
			releaseTouches();
			window.screen.orientation?.removeEventListener?.('change', recalibrateScreen);
			window.removeEventListener('orientationchange', recalibrateScreen);
			observer?.disconnect();
			motion?.removeEventListener('change', sync);
			document.removeEventListener('visibilitychange', sync);
		}
		sync();
	};
}
