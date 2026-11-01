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
   setZoomFocusState, restingZoomFocus, earlyTransition, destroyed = false } = ports;
 let navigationTimings, navigationGeneration = 0, reuseCatalogPage = false, retainedPageSignature;
 ${capture.getText(stage)}
 return { captureNavigation, state: () => ({ navigationTimings, reuseCatalogPage, retainedPageSignature }) };
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
	let sourceMounted = true, owned = false;
	const snapshot = vi.fn(() => { expect(sourceMounted).toBe(true); owned = true; return false; });
	const releasePage = vi.fn(() => { expect(owned).toBe(true); });
	const ports = {
		fullscreenController: { setFullscreen: vi.fn() },
		navigationFeedback: { get painted() { return readPainted(); } },
		transition: { capture: snapshot }, experience: { releasePage },
		pageSignature: () => 'source-signature', setZoomFocusState: vi.fn(), restingZoomFocus: {}
	};
	return { ports, readPainted, feedback, snapshot, releasePage,
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
	expect(capture.state()).toMatchObject({ reuseCatalogPage: true, retainedPageSignature: 'source-signature' });
	expect(source.releasePage).not.toHaveBeenCalled();
});

test('an already held staged presentation commits synchronously without a second classic capture', () => {
	const source = sourceFixture(), nav = navigation();
	const commit = vi.fn(), releasePage = vi.fn();
	const capture = captureFactory({ ...source.ports, experience: { releasePage },
		earlyTransition: { phase: 'held', destination: nav.value.to.url.href, commit } });
	expect(capture.captureNavigation(nav.value)).toBeUndefined();
	expect(commit).toHaveBeenCalledOnce(); expect(releasePage).toHaveBeenCalledOnce();
	expect(source.snapshot).not.toHaveBeenCalled(); expect(source.readPainted).not.toHaveBeenCalled();
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
