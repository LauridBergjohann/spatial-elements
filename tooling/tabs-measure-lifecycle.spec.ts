import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import ts from 'typescript';

// Run the production onMount body and its actual scheduled callbacks. The ports
// model browser scheduling and bind:this invalidation, not a second measurement
// implementation or a replacement Svelte runtime.
const source = readFileSync(new URL(
	'../packages/sveltekit/src/spatial-element/SpatialElementTabs.svelte', import.meta.url
), 'utf8');
const script = ts.createSourceFile('SpatialElementTabs.svelte',
	source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1], ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
const registration = script.statements.find(node => ts.isExpressionStatement(node) &&
	ts.isCallExpression(node.expression) && node.expression.expression.getText(script) === 'onMount');
if (!registration || !ts.isExpressionStatement(registration) || !ts.isCallExpression(registration.expression))
	throw new Error('Missing production tabs onMount callback');
const factory = new Function('ports', ts.transpileModule(`
 const { tick, window, document, ResizeObserver, MutationObserver,
   requestAnimationFrame, cancelAnimationFrame, getComputedStyle } = ports;
 const STAGE_PANEL_LAYOUT_EVENT = 'panel-layout';
 let anchorElement = ports.anchor;
 let tabList = ports.tabList;
 const mount = ${registration.expression.arguments[0].getText(script)};
 return { mount, bind(value) { anchorElement = value; tabList = value ? ports.tabList : undefined; } };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText);

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => { resolve = yes; });
	return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

function fixture() {
	const initialTick = deferred(), fonts = deferred();
	const frames = new Map<number, () => void>();
	const listeners = new Map<string, () => void>();
	let nextFrame = 0;
	const observers: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
	class Observer {
		observe = vi.fn();
		disconnect = vi.fn();
		constructor(readonly callback: () => void) { observers.push(this); }
	}
	const links = { scrollWidth: 240 };
	const tabList = { querySelector: vi.fn(() => links) };
	const frame = {};
	const anchor = {
		isConnected: true,
		// The list has already been portaled out of this anchor by the renderer.
		querySelector: vi.fn(selector => selector === '[data-stage-panel-fallback]' ? frame : null),
		style: { setProperty: vi.fn() },
		toggleAttribute: vi.fn()
	};
	const ports = {
		anchor, tabList, tick: () => initialTick.promise,
		window: {
			ResizeObserver: Observer, MutationObserver: Observer,
			addEventListener: vi.fn((event, callback) => listeners.set(event, callback)),
			removeEventListener: vi.fn((event, callback) => {
				if (listeners.get(event) === callback) listeners.delete(event);
			}),
			dispatchEvent: vi.fn()
		},
		document: { fonts: { ready: fonts.promise } },
		ResizeObserver: Observer, MutationObserver: Observer,
		requestAnimationFrame: vi.fn((callback: () => void) => {
			const id = ++nextFrame; frames.set(id, callback); return id;
		}),
		cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
		getComputedStyle: vi.fn(() => ({ display: 'block' }))
	};
	const component = factory(ports);
	const cleanup = component.mount();
	return { component, cleanup, ports, anchor, links, observers, frames, initialTick, fonts,
		resize() { listeners.get('resize')?.(); },
		frame() {
			const [id, callback] = frames.entries().next().value!;
			frames.delete(id); callback();
		},
		async start() { initialTick.resolve(); await flush(); }
	};
}

test('the actual initial tick ignores a cleared binding before mount cleanup', async () => {
	const f = fixture();
	f.component.bind(null);
	await f.start();
	expect(f.anchor.querySelector).not.toHaveBeenCalled();
	expect(f.observers).toHaveLength(0);
	expect(f.ports.window.dispatchEvent).not.toHaveBeenCalled();
	f.cleanup();
});

test('the actual queued RAF ignores a cleared binding before cleanup runs', async () => {
	const f = fixture(); await f.start();
	f.anchor.querySelector.mockClear();
	f.anchor.style.setProperty.mockClear();
	f.resize();
	expect(f.frames.size).toBe(1);
	f.component.bind(null);
	expect(() => f.frame()).not.toThrow();
	expect(f.anchor.querySelector).not.toHaveBeenCalled();
	expect(f.anchor.style.setProperty).not.toHaveBeenCalled();
	f.cleanup();
});

test('detached anchors are not measured; a connected later resize can still publish width', async () => {
	const f = fixture(); await f.start();
	f.anchor.style.setProperty.mockClear();
	f.anchor.isConnected = false; f.links.scrollWidth = 300;
	f.resize(); f.frame();
	expect(f.anchor.style.setProperty).not.toHaveBeenCalled();
	f.anchor.isConnected = true;
	f.resize(); f.frame();
	expect(f.anchor.style.setProperty).toHaveBeenCalledExactlyOnceWith('--spatial-element-tabs-natural-width', '300px');
	f.cleanup();
});

test('cleanup cancels the pending RAF and observers; even a stale delivered callback is inert', async () => {
	const f = fixture(); await f.start();
	f.resize();
	const [id, callback] = f.frames.entries().next().value!;
	f.anchor.querySelector.mockClear();
	f.cleanup();
	expect(f.ports.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(id);
	expect(f.frames.size).toBe(0);
	for (const observer of f.observers) expect(observer.disconnect).toHaveBeenCalledOnce();
	// Keep the old node non-null to check the disposed guard independently.
	callback();
	expect(f.anchor.querySelector).not.toHaveBeenCalled();
	f.fonts.resolve(); await flush(); f.resize();
	expect(f.frames.size).toBe(0);
});

test('cleanup before the initial tick prevents measurement and late observer registration', async () => {
	const f = fixture();
	f.cleanup(); f.component.bind(null); await f.start();
	expect(f.anchor.querySelector).not.toHaveBeenCalled();
	expect(f.observers).toHaveLength(0);
});

test('initial tick does not lose ownership of a RAF already scheduled by font readiness', async () => {
	const f = fixture();
	f.fonts.resolve(); await flush();
	const [id, callback] = f.frames.entries().next().value!;
	await f.start();
	// The direct initial measurement used to zero measureFrame even though
	// this earlier font-triggered RAF was still queued in the browser.
	f.resize();
	expect(f.frames.size).toBe(1);
	f.cleanup(); f.component.bind(null);
	expect(f.ports.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(id);
	expect(f.frames.size).toBe(0);
	expect(() => callback()).not.toThrow();
});

test('portaled menus retain measurement, deduplication and resize behavior through their bound reference', async () => {
	const f = fixture(); await f.start();
	expect(f.observers).toHaveLength(2);
	expect(f.anchor.style.setProperty).toHaveBeenCalledExactlyOnceWith('--spatial-element-tabs-natural-width', '240px');
	expect(f.anchor.toggleAttribute).toHaveBeenCalledExactlyOnceWith('data-spatial-element-tabs-measured', true);
	f.resize(); f.resize();
	expect(f.frames.size).toBe(1); f.frame();
	expect(f.ports.window.dispatchEvent).toHaveBeenCalledOnce();
	f.links.scrollWidth = 280; f.resize(); f.frame();
	expect(f.ports.window.dispatchEvent).toHaveBeenCalledTimes(2);
	f.cleanup();
});
