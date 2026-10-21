import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let browser: EventTarget & Record<string, unknown>;
let page: EventTarget & { hidden: boolean };
let reduced: EventTarget & { matches: boolean };
let intersect: (entries: { target: HTMLElement; isIntersecting: boolean }[]) => void;
let add: ReturnType<typeof vi.spyOn>;
let remove: ReturnType<typeof vi.spyOn>;
let cleanup: (() => void)[];

it('freezes during scrolling and smoothly resumes after a long pause without losing calibration', async () => {
	let now = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => now);
	const api = await import('./listDeviceOrientation.js');
	const node = {} as HTMLElement;
	cleanup.push(api.retainListDeviceOrientation(node, () => {}));
	intersect([{ target: node, isIntersecting: true }]);
	const emit = (beta: number) => browser.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 0, beta, gamma: 0 }));
	emit(60);
	for (let i = 1; i <= 60; i++) { now += 20; emit(60 + Math.min(i, 20)); }
	const before = api.getListDevicePitch();
	expect(before).toBeGreaterThan(7);
	const notify = vi.fn();
	cleanup.push(api.subscribeListDeviceYaw(notify));
	for (let i = 0; i < 150; i++) {
		now += 20;
		browser.dispatchEvent(new Event('scroll'));
		emit(40);
	}
	expect(api.getListDevicePitch()).toBe(before);
	expect(notify).not.toHaveBeenCalled();
	now += 180;
	emit(40);
	expect(Math.abs(api.getListDevicePitch() - before)).toBeLessThan(1);
	for (let i = 0; i < 70; i++) { now += 20; emit(40); }
	expect(api.getListDevicePitch()).toBeLessThan(-7);
});

beforeEach(() => {
	vi.resetModules();
	cleanup = [];
	reduced = Object.assign(new EventTarget(), { matches: false });
	const coarse = Object.assign(new EventTarget(), { matches: true });
	browser = Object.assign(new EventTarget(), {
		isSecureContext: true,
		DeviceOrientationEvent: {},
		matchMedia: (query: string) => query.includes('reduced-motion') ? reduced : coarse,
		screen: { orientation: { angle: 0 } }
	});
	page = Object.assign(new EventTarget(), { hidden: false });
	vi.stubGlobal('window', browser);
	vi.stubGlobal('document', page);
	vi.stubGlobal('IntersectionObserver', class {
		constructor(callback: typeof intersect) { intersect = callback; }
		observe() {}
		unobserve() {}
		disconnect() {}
	});
	add = vi.spyOn(browser, 'addEventListener');
	remove = vi.spyOn(browser, 'removeEventListener');
});
afterEach(() => { cleanup.forEach(fn => fn()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('shares one listener, suspends in the background, and tears down after the last section', async () => {
	const { retainListDeviceOrientation } = await import('./listDeviceOrientation.js');
	const first = {} as HTMLElement, second = {} as HTMLElement;
	const releaseFirst = retainListDeviceOrientation(first, () => {});
	const releaseSecond = retainListDeviceOrientation(second, () => {});
	intersect([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
	expect(add.mock.calls.filter(call => call[0] === 'deviceorientation')).toHaveLength(1);
	page.hidden = true;
	page.dispatchEvent(new Event('visibilitychange'));
	expect(remove).toHaveBeenCalledWith('deviceorientation', expect.any(Function));
	page.hidden = false;
	page.dispatchEvent(new Event('visibilitychange'));
	releaseFirst();
	expect(remove.mock.calls.filter(call => call[0] === 'deviceorientation')).toHaveLength(1);
	releaseSecond();
	expect(remove.mock.calls.filter(call => call[0] === 'deviceorientation')).toHaveLength(2);
});

it('falls back from a silent probe to user activation and shares the result', async () => {
	const requestPermission = vi.fn().mockRejectedValueOnce(new DOMException('Needs activation', 'NotAllowedError')).mockResolvedValue('granted');
	browser.DeviceOrientationEvent = { requestPermission };
	const api = await import('./listDeviceOrientation.js');
	const status = vi.fn();
	const node = {} as HTMLElement;
	cleanup.push(api.retainListDeviceOrientation(node, status));
	intersect([{ target: node, isIntersecting: true }]);
	expect(status).toHaveBeenLastCalledWith('permission');
	await api.requestListDeviceOrientation(false); // wait for the shared silent probe
	expect(requestPermission).toHaveBeenCalledTimes(1);
	expect(add).not.toHaveBeenCalledWith('deviceorientation', expect.anything(), expect.anything());
	await api.requestListDeviceOrientation();
	expect(status).toHaveBeenLastCalledWith('active');
	expect(add).toHaveBeenCalledWith('deviceorientation', expect.any(Function), { passive: true });
});

it('handles permission denial without subscribing', async () => {
	const requestPermission = vi.fn().mockResolvedValue('denied');
	browser.DeviceOrientationEvent = { requestPermission };
	const api = await import('./listDeviceOrientation.js');
	const status = vi.fn();
	const node = {} as HTMLElement;
	cleanup.push(api.retainListDeviceOrientation(node, status));
	intersect([{ target: node, isIntersecting: true }]);
	await api.requestListDeviceOrientation();
	expect(status).toHaveBeenLastCalledWith('denied');
	await api.requestListDeviceOrientation();
	expect(requestPermission).toHaveBeenCalledTimes(1);
	expect(add).not.toHaveBeenCalledWith('deviceorientation', expect.anything(), expect.anything());
});

it('automatically reuses existing consent', async () => {
	browser.DeviceOrientationEvent = { requestPermission: vi.fn().mockResolvedValue('granted') };
	const api = await import('./listDeviceOrientation.js');
	const node = {} as HTMLElement;
	const status = vi.fn();
	cleanup.push(api.retainListDeviceOrientation(node, status));
	intersect([{ target: node, isIntersecting: true }]);
	await api.requestListDeviceOrientation(false);
	expect(status).toHaveBeenLastCalledWith('active');
});

it('requests from internal navigation before any list mounts, excludes unrelated clicks and tears down', async () => {
	const requestPermission = vi.fn().mockRejectedValueOnce(new DOMException('Needs activation', 'NotAllowedError')).mockResolvedValue('granted');
	browser.DeviceOrientationEvent = { requestPermission };
	browser.location = { href: 'https://example.com/detail', origin: 'https://example.com' };
	class Anchor {
		href = 'https://example.com/list'; target = '';
		hasAttribute(name: string) { return name === 'href'; }
	}
	vi.stubGlobal('HTMLAnchorElement', Anchor);
	const listen = vi.spyOn(page, 'addEventListener');
	const unlisten = vi.spyOn(page, 'removeEventListener');
	const api = await import('./listDeviceOrientation.js');
	const release = api.retainDeviceOrientationPermission();
	await api.requestListDeviceOrientation(false);
	const click = listen.mock.calls.find(call => call[0] === 'click')![1] as (event: unknown) => void;
	const anchor = new Anchor();
	const event = { isTrusted: true, button: 0, composedPath: () => [anchor] };
	click({ ...event, ctrlKey: true });
	anchor.href = 'https://elsewhere.example/'; click(event);
	anchor.href = 'https://example.com/list'; anchor.target = '_blank'; click(event);
	expect(requestPermission).toHaveBeenCalledTimes(1);
	anchor.target = ''; click(event);
	expect(requestPermission).toHaveBeenCalledTimes(2); // called synchronously within click
	await api.requestListDeviceOrientation();
	click(event);
	expect(requestPermission).toHaveBeenCalledTimes(2);
	release();
	expect(unlisten).toHaveBeenCalledWith('click', click, true);
});

it('does not subscribe offscreen or with reduced motion enabled', async () => {
	const api = await import('./listDeviceOrientation.js');
	const node = {} as HTMLElement;
	cleanup.push(api.retainListDeviceOrientation(node, () => {}));
	expect(add).not.toHaveBeenCalledWith('deviceorientation', expect.anything(), expect.anything());
	reduced.matches = true;
	intersect([{ target: node, isIntersecting: true }]);
	expect(add).not.toHaveBeenCalledWith('deviceorientation', expect.anything(), expect.anything());
	reduced.matches = false;
	reduced.dispatchEvent(new Event('change'));
	expect(add).toHaveBeenCalledWith('deviceorientation', expect.any(Function), { passive: true });
	intersect([{ target: node, isIntersecting: false }]);
	expect(remove).toHaveBeenCalledWith('deviceorientation', expect.any(Function));
});

it('accepts sensor input on fine-pointer devices and keeps tilt working without alpha', async () => {
	browser.matchMedia = () => reduced; // matches=false: no coarse pointer advertised
	const api = await import('./listDeviceOrientation.js');
	const node = {} as HTMLElement;
	cleanup.push(api.retainListDeviceOrientation(node, () => {}));
	intersect([{ target: node, isIntersecting: true }]);
	expect(add).toHaveBeenCalledWith('deviceorientation', expect.any(Function), { passive: true });
	let now = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => now);
	const emit = (beta: number) => browser.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: null, beta, gamma: 0 }));
	emit(60);
	for (let i = 1; i <= 30; i++) { now = i * 20; emit(60 + i / 2); }
	expect(api.getListDevicePitch()).toBeGreaterThan(4);
	expect(api.getListDeviceYaw()).toBe(0);
	const notify = vi.fn();
	cleanup.push(api.subscribeListDeviceYaw(notify));
	// Settle, then ensure unchanged sensor events cause no further rendering notifications.
	for (let i = 31; i < 100; i++) { now = i * 20; emit(75); }
	notify.mockClear();
	for (let i = 100; i < 200; i++) { now = i * 20; emit(75); }
	expect(notify).not.toHaveBeenCalled();
});

it.each(['change', 'orientationchange', 'sample'])('recalibrates every axis on screen rotation via %s', source => {
	return (async () => {
		const orientation = Object.assign(new EventTarget(), { angle: 0 });
		browser.screen = { orientation };
		const api = await import('./listDeviceOrientation.js');
		const node = {} as HTMLElement;
		cleanup.push(api.retainListDeviceOrientation(node, () => {}));
		intersect([{ target: node, isIntersecting: true }]);
		let now = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		const emit = (alpha: number, beta: number, gamma: number) => browser.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha, beta, gamma }));
		emit(0, 60, 0);
		for (let i = 1; i <= 30; i++) { now = i * 40; emit(i / 2, 60 + i / 3, i / 4); }
		expect(Math.abs(api.getListDeviceYaw())).toBeGreaterThan(1);
		orientation.angle = 90;
		if (source === 'change') orientation.dispatchEvent(new Event('change'));
		else if (source === 'orientationchange') browser.dispatchEvent(new Event('orientationchange'));
		else { now += 40; emit(15, 0, -60); }
		expect([api.getListDeviceYaw(), api.getListDevicePitch(), api.getListDeviceRoll()]).toEqual([0, 0, 0]);
		now += 100; emit(15, 10, -50); // intermediate posture must not become neutral
		now += 300; emit(15, 0, -60);
		now += 40; emit(15, 0, -60);
		expect([api.getListDeviceYaw(), api.getListDevicePitch(), api.getListDeviceRoll()]).toEqual([0, 0, 0]);
		for (let i = 1; i <= 30; i++) { now += 40; emit(15, 0, -60 - Math.min(i / 2, 12)); }
		expect(api.getListDevicePitch()).toBeGreaterThan(4);
	})();
});
