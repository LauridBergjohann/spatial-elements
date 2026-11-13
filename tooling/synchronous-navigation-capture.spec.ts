import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import ts from 'typescript';

// Execute the actual Svelte-script functions with their existing ports. This
// checks the commit boundary without reproducing either implementation or Kit.
function script(path: string) {
	const source = readFileSync(new URL(path, import.meta.url), 'utf8');
	const body = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
	if (!body) throw new Error(`Missing script: ${path}`);
	return ts.createSourceFile(path, body, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
}
const stage = script('../packages/sveltekit/src/stage/Stage.svelte');
const capture = stage.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'captureNavigation');
const bridge = script('../packages/sveltekit/src/catalog/ScrollNavigationBridge.svelte');
const registration = bridge.statements.find(node => ts.isExpressionStatement(node) &&
	ts.isCallExpression(node.expression) && node.expression.expression.getText(bridge) === 'onNavigate');
if (!capture || !registration || !ts.isExpressionStatement(registration) || !ts.isCallExpression(registration.expression))
	throw new Error('Missing production navigation hooks');
const navigateCallback = registration.expression.arguments[0].getText(bridge);
function compile(body: string) {
	return new Function('ports', ts.transpileModule(body, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
	}).outputText);
}
const captureFactory = compile(`
 const { fullscreenController, navigationFeedback, transition, experience, pageSignature,
   setZoomFocusState, restingZoomFocus, earlyTransition, destroyed = false,
   presentationHost, catalogEndpoints, recordNavigationPage = () => {}, prepareCatalogSummaryTransfer = () => undefined } = ports;
 let navigationTimings, navigationGeneration = 0, reuseCatalogPage = false, retainedPageSignature, isPageReady = true,
   summaryTransfer = ports.summaryTransfer;
 ${capture.getText(stage)}
 return { captureNavigation, state: () => ({ navigationTimings, reuseCatalogPage, retainedPageSignature, isPageReady }) };
`);
const bridgeFactory = compile(`
 const { controller, onCapture, interruptVisuals, onRestored, disableScrollHandling,
   sections, endpoints, focusDestination, rememberPosition } = ports;
 const handlesNavigation = () => true, readCatalogViewContext = () => ({}),
   tick = () => Promise.resolve(), entryState = () => ({ id: 'actual-entry', focus: 'actual-focus' }),
   ensureEntry = () => {}, syncStageScrollToNative = () => {};
 const entryPositions = new Map();
 let generation = 0, active, pendingNavigation = true, focusRevision = 0;
 const hook = ${navigateCallback};
 return { hook, state: () => active, supersede() { ++generation; active = undefined; } };
`);
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => { resolve = yes; });
	return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function navigation(type: 'link' | 'goto' | 'popstate' = 'link') {
	const complete = deferred();
	return { complete, value: { type, complete: complete.promise,
		from: { url: new URL('https://example.test/demo/categories/carousel') },
		to: { url: new URL('https://example.test/demo/elements/column'), scroll: { x: 0, y: 112 } } } };
}
function sourceFixture() {
	const feedback = deferred();
	const readPainted = vi.fn(() => feedback.promise);
	const order: string[] = [];
	let sourceMounted = true, owned = false;
	const snapshot = vi.fn(() => { expect(sourceMounted).toBe(true); owned = true; order.push('capture'); return false; });
	const releasePage = vi.fn(() => { expect(owned).toBe(true); order.push('release'); });
	const ports = {
		fullscreenController: { setFullscreen: vi.fn(() => { order.push('leave'); }) },
		navigationFeedback: { get painted() { return readPainted(); } },
		transition: { capture: snapshot }, experience: { releasePage },
		pageSignature: () => 'source-signature', setZoomFocusState: vi.fn(), restingZoomFocus: {}
	};
	return { ports, readPainted, feedback, snapshot, releasePage, order,
		commitDom() { sourceMounted = false; expect(owned).toBe(true); } };
}
function routerFixture(onCapture: (navigation: unknown) => undefined) {
	const restoring = deferred();
	const controller = { active: true, beginNavigation: vi.fn(), endNavigation: vi.fn(),
		measureExtentNow: vi.fn(), restoreTarget: vi.fn(() => true) };
	const ports = { controller, onCapture, interruptVisuals: vi.fn(),
		onRestored: vi.fn(() => restoring.promise), disableScrollHandling: vi.fn(),
		sections: { restore: vi.fn(), selectForView: vi.fn(), getOrigin: () => undefined },
		endpoints: { restoreFocus: vi.fn(), restoreOrigin: vi.fn() },
		focusDestination: vi.fn(), rememberPosition: vi.fn() };
	return { ports, restoring, ...bridgeFactory(ports) };
}

test.each(['link', 'goto', 'popstate'] as const)(
	'%s secures the source synchronously while feedback paint is unresolved, without holding the router', async type => {
		const source = sourceFixture(), capture = captureFactory(source.ports), nav = navigation(type);
		const router = routerFixture(capture.captureNavigation);
		expect(router.hook(nav.value)).toBeUndefined();
		expect(source.snapshot).toHaveBeenCalledExactlyOnceWith(nav.value.from.url, nav.value.to.url, type);
		expect(source.readPainted).not.toHaveBeenCalled();
		expect(source.releasePage).toHaveBeenCalledOnce();
		expect(capture.state().isPageReady).toBe(false);
		expect(source.order).toEqual(['capture', 'release', 'leave']);
		expect(source.ports.fullscreenController.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
		expect(router.ports.disableScrollHandling).toHaveBeenCalledOnce();
		expect(router.ports.onRestored).not.toHaveBeenCalled();
		source.commitDom();
		nav.complete.resolve(); await flush();
		expect(router.ports.onRestored).toHaveBeenCalledExactlyOnceWith(nav.value);
		expect(router.ports.controller.endNavigation).not.toHaveBeenCalled();
		router.restoring.resolve(); await flush();
		expect(router.ports.controller.endNavigation).toHaveBeenCalledOnce();
		expect(router.ports.focusDestination).toHaveBeenCalledExactlyOnceWith(nav.value);
		expect(router.state()).toBeUndefined();
	});

test('synchronous capture preserves the same-page reuse owner instead of releasing its scene', () => {
	const source = sourceFixture(); source.snapshot.mockReturnValue(true);
	const capture = captureFactory(source.ports);
	expect(capture.captureNavigation(navigation().value)).toBeUndefined();
	expect(capture.state().isPageReady).toBe(true);
	expect(capture.state()).toMatchObject({ reuseCatalogPage: true, retainedPageSignature: 'source-signature' });
	expect(source.releasePage).not.toHaveBeenCalled();
	expect(source.ports.fullscreenController.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
});

test('history capture records the mounted source under the router source URL, not the already changed browser URL', () => {
	const source = sourceFixture(), nav = navigation('popstate');
	const recordNavigationPage = vi.fn();
	captureFactory({ ...source.ports, recordNavigationPage }).captureNavigation(nav.value);
	expect(recordNavigationPage).toHaveBeenCalledExactlyOnceWith(nav.value.from.url);
	expect(recordNavigationPage.mock.invocationCallOrder[0]).toBeLessThan(source.snapshot.mock.invocationCallOrder[0]);
});

test('the real summary is retained before snapshotting and held only after its decorative source has been captured', () => {
	const source = sourceFixture(), nav = navigation();
	const transfer = { hold: vi.fn(() => source.order.push('hold summary')), cancel: vi.fn() };
	const prepare = vi.fn(() => { source.order.push('retain summary'); return transfer; });
	const host = {}, endpoints = {};
	const capture = captureFactory({ ...source.ports, presentationHost: host, catalogEndpoints: endpoints,
		prepareCatalogSummaryTransfer: prepare });
	expect(capture.captureNavigation(nav.value)).toBeUndefined();
	expect(prepare).toHaveBeenCalledExactlyOnceWith({ from: nav.value.from.url, to: nav.value.to.url,
		type: 'link', endpoints, host });
	expect(source.order).toEqual(['retain summary', 'capture', 'hold summary', 'release', 'leave']);
	expect(transfer.cancel).not.toHaveBeenCalled();
});

test('same-page scene reuse releases the speculative summary claim without reparenting its source', () => {
	const source = sourceFixture(); source.snapshot.mockReturnValue(true);
	const transfer = { hold: vi.fn(), cancel: vi.fn() };
	const capture = captureFactory({ ...source.ports, presentationHost: {}, catalogEndpoints: {},
		prepareCatalogSummaryTransfer: () => transfer });
	expect(capture.captureNavigation(navigation().value)).toBeUndefined();
	expect(transfer.cancel).toHaveBeenCalledOnce();
	expect(transfer.hold).not.toHaveBeenCalled();
	expect(source.releasePage).not.toHaveBeenCalled();
});

test('an already held staged presentation commits synchronously without a second classic capture', () => {
	const source = sourceFixture(), nav = navigation();
	const commit = vi.fn(() => { source.order.push('commit'); }),
		releasePage = vi.fn(() => { source.order.push('release'); });
	const capture = captureFactory({ ...source.ports, experience: { releasePage },
		earlyTransition: { phase: 'held', destination: nav.value.to.url.href, commit } });
	expect(capture.captureNavigation(nav.value)).toBeUndefined();
	expect(commit).toHaveBeenCalledOnce(); expect(releasePage).toHaveBeenCalledOnce();
	expect(source.snapshot).not.toHaveBeenCalled(); expect(source.readPainted).not.toHaveBeenCalled();
	expect(source.order).toEqual(['commit', 'release', 'leave']);
});

test('the retained fullscreen pose is secured before leaving can refit the source camera or DOM', () => {
	const source = sourceFixture();
	let liveProjection = 'visible-fullscreen-pose', retainedProjection: string | undefined;
	source.snapshot.mockImplementation(() => {
		retainedProjection = liveProjection;
		source.order.push('capture');
		return false;
	});
	source.releasePage.mockImplementation(() => { source.order.push('release'); });
	source.ports.fullscreenController.setFullscreen.mockImplementation(() => {
		expect(source.order).toEqual(['capture', 'release']);
		liveProjection = 'refitted-inline-pose';
	});
	expect(captureFactory(source.ports).captureNavigation(navigation('popstate').value)).toBeUndefined();
	expect(retainedProjection).toBe('visible-fullscreen-pose');
	expect(liveProjection).toBe('refitted-inline-pose');
});

test.each(['capture', 'release', 'held commit'] as const)(
	'fullscreen exits and the original %s error reaches the bridge fallback', async failure => {
		const source = sourceFixture(), nav = navigation('popstate'), error = new Error(`${failure} failed`);
		const fail = () => { throw error; };
		if (failure === 'capture') source.snapshot.mockImplementation(fail);
		if (failure === 'release') source.releasePage.mockImplementation(fail);
		const capture = captureFactory({ ...source.ports, ...(failure === 'held commit' ? {
			earlyTransition: { phase: 'held', destination: nav.value.to.url.href, commit: fail }
		} : {}) });
		let caught: unknown;
		const router = routerFixture(nav => {
			try { return capture.captureNavigation(nav); }
			catch (error) { caught = error; throw error; }
		});
		expect(router.hook(nav.value)).toBeUndefined();
		expect(caught).toBe(error);
		expect(source.ports.fullscreenController.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
		expect(router.ports.interruptVisuals).toHaveBeenCalledOnce();
		nav.complete.resolve(); await flush();
		expect(router.ports.onRestored).toHaveBeenCalledExactlyOnceWith(nav.value);
		router.restoring.resolve(); await flush();
		expect(router.ports.controller.endNavigation).toHaveBeenCalledOnce();
	});

test('an already destroyed Stage still leaves fullscreen without capturing or releasing another page', () => {
	const source = sourceFixture();
	expect(captureFactory({ ...source.ports, destroyed: true }).captureNavigation(navigation().value)).toBeUndefined();
	expect(source.snapshot).not.toHaveBeenCalled();
	expect(source.releasePage).not.toHaveBeenCalled();
	expect(source.ports.fullscreenController.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
});

test('a failed synchronous capture releases visuals and still restores the real committed destination', async () => {
	const nav = navigation();
	const router = routerFixture(() => { throw new Error('capture failed'); });
	expect(router.hook(nav.value)).toBeUndefined();
	expect(router.ports.interruptVisuals).toHaveBeenCalledOnce();
	nav.complete.resolve(); await flush();
	expect(router.ports.onRestored).toHaveBeenCalledExactlyOnceWith(nav.value);
	router.restoring.resolve(); await flush();
	expect(router.ports.controller.endNavigation).toHaveBeenCalledOnce();
});

test('a superseded completion cannot restore stale route scroll or focus', async () => {
	const nav = navigation('popstate'), router = routerFixture(() => undefined);
	expect(router.hook(nav.value)).toBeUndefined(); router.supersede();
	nav.complete.resolve(); await flush();
	expect(router.ports.sections.restore).not.toHaveBeenCalled();
	expect(router.ports.controller.restoreTarget).not.toHaveBeenCalled();
	expect(router.ports.onRestored).not.toHaveBeenCalled();
	expect(router.ports.focusDestination).not.toHaveBeenCalled();
	expect(router.ports.controller.endNavigation).toHaveBeenCalledOnce();
});
