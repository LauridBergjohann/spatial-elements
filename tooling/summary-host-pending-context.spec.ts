import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, test, vi } from 'vitest';
import { PresentationLease } from '../packages/core/src/catalog/PresentationLease.js';
import { releasePresentationResources } from '../packages/sveltekit/src/catalog/presentationCleanup.js';
import type { SpatialSummaryHostController } from '../packages/sveltekit/src/spatial-element/spatialSummaryHost.svelte.js';
import type { SpatialCardContext, SpatialPresentationModel, SpatialSummaryContext } from '../packages/sveltekit/src/spatial-element/spatialSummary.js';

// Execute the actual host class with deterministic mount/microtask ports. Svelte
// DOM identity and bindings are covered by the real-browser round-trip proof.
const source = ts.createSourceFile('spatialSummaryHost.svelte.ts', readFileSync(new URL(
	'../packages/sveltekit/src/spatial-element/spatialSummaryHost.svelte.ts', import.meta.url), 'utf8'), ts.ScriptTarget.ESNext, true);
const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'SpatialSummaryHostController');
if (!declaration) throw new Error('Missing production summary host');
const createHost = new Function('ports', ts.transpileModule(`
	const { mount, hydrate, unmount, queueMicrotask, document, PresentationLease, releasePresentationResources } = ports;
	const $state = value => value, untrack = callback => callback(), SpatialSummaryRoot = {};
	const freezePresentationBox = root => ({ css: root.style.cssText, inert: root.inert, width: 100, height: 60, box: {} });
	${declaration.getText(source).replace(/^export\s+/, '')}
	return new SpatialSummaryHostController(() => {}, new Map());
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText);

interface FakeNode {
	children: FakeNode[];
	dataset: Record<string, string>;
	className: string;
	inert: boolean;
	isConnected: boolean;
	style: { cssText: string; setProperty(key: string, value: string): unknown; getPropertyValue(key: string): string | undefined };
	parentElement: FakeNode | null;
	append(child: FakeNode): void;
	remove(): void;
	querySelector(selector: string): FakeNode | null;
	closest(): null;
}
function node(): FakeNode {
	const children: FakeNode[] = [];
	const values = new Map<string, string>();
	const value: FakeNode = {
		children, dataset: {} as Record<string, string>, className: '', inert: false, isConnected: true,
		style: { cssText: '', setProperty: (key: string, value: string) => values.set(key, value),
			getPropertyValue: (key: string) => values.get(key) },
		parentElement: null,
		append(child: FakeNode) {
			child.remove(); children.push(child); child.parentElement = value;
		},
		remove() {
			const siblings = value.parentElement?.children;
			if (siblings) siblings.splice(siblings.indexOf(value), 1);
			value.parentElement = null;
		},
		querySelector(selector: string) { return selector === '[data-spatial-presentation-root]' ? children[0] ?? null : null; },
		closest: () => null
	};
	return value;
}
function fixture() {
	const tasks: (() => void)[] = [];
	const mount = vi.fn((_component: unknown, _options: { props: { model: SpatialPresentationModel } }) => ({}));
	const hydrate = vi.fn(), unmount = vi.fn();
	const host = createHost({ mount, hydrate, unmount, queueMicrotask: (task: () => void) => tasks.push(task),
		document: { createElement: node }, PresentationLease, releasePresentationResources }) as SpatialSummaryHostController;
	return { host, mount, hydrate, unmount, flush() { while (tasks.length) tasks.shift()!(); } };
}
function context(compact: boolean, inset = 16): SpatialSummaryContext {
	return { spatialElement: { brandId: 'demo', id: 'column', title: 'Column', eyebrow: 'Demo', features: [] },
		mode: 'carousel', heading: 'h3', contentInset: inset, address: () => undefined,
		carousel: { item: {} as never, occurrence: 'featured-column', compact } };
}
const element = (value = node()) => value as unknown as HTMLElement;

test('viewport correction before deferred mount replaces the SSR carousel context', () => {
	const f = fixture(), slot = element();
	f.host.attach(slot, 'carousel', context(false));
	const mobile = context(true, 12);
	f.host.update('carousel', mobile);
	f.flush();
	expect(f.mount).toHaveBeenCalledOnce();
	expect(f.mount.mock.calls[0][1].props.model.current).toBe(mobile);
	const record = f.host.retain('carousel')!.record;
	expect(record.model.current).toBe(mobile);
	expect(record.root.style.getPropertyValue('--spatial-summary-content-inset')).toBe('12px');
	f.host.destroy();
});

test('pending card placement also keeps the latest responsive context', () => {
	const f = fixture();
	const initial: SpatialCardContext = { spatialElement: {} as never, occurrence: 'featured-column', order: 0, textAlign: 'start', cardSize: 'l' };
	const compact: SpatialCardContext = { ...initial, cardSize: 's' };
	f.host.attachCard(element(), 'card', initial);
	f.host.updateCard('card', compact);
	f.flush();
	expect(f.mount.mock.calls[0][1].props.model.current).toBe(compact);
	f.host.destroy();
});

test('a cancelled attach cannot discard a newer placement update for the same occurrence', () => {
	const f = fixture(), cleanup = f.host.attach(element(), 'carousel', context(false));
	cleanup();
	f.host.attach(element(), 'carousel', context(false));
	const mobile = context(true);
	f.host.update('carousel', mobile);
	f.flush();
	expect(f.mount).toHaveBeenCalledOnce();
	expect(f.mount.mock.calls[0][1].props.model.current).toBe(mobile);
	f.host.destroy();
});

test('incoming compact context wins over an older held record with the same occurrence key', () => {
	const f = fixture();
	f.host.attach(element(), 'carousel', context(false)); f.flush();
	const retained = f.host.retain('carousel')!;
	retained.hold(element());
	const destination = element(), mobile = context(true);
	f.host.attach(destination, 'carousel', context(false));
	f.host.update('carousel', mobile);
	expect(retained.record.frozen?.pending).toBeUndefined();
	f.flush();
	expect(f.mount.mock.calls[1][1].props.model.current).toBe(mobile);
	expect(retained.adopt(destination)).toBe(true);
	retained.unfreeze();
	expect(retained.record.model.current).toBe(mobile);
	expect(retained.record.model.active).toBe(true);
	f.host.destroy();
});

test('destroying the host before deferred attachment never creates a component', () => {
	const f = fixture(), cleanup = f.host.attach(element(), 'carousel', context(false));
	f.host.destroy(); f.host.update('carousel', context(true)); f.flush(); cleanup();
	expect(f.mount).not.toHaveBeenCalled();
	expect(f.unmount).not.toHaveBeenCalled();
});

test('context updates during component mounting still reach its reactive model', () => {
	const f = fixture(), mobile = context(true);
	f.mount.mockImplementation(() => { f.host.update('carousel', mobile); return {}; });
	f.host.attach(element(), 'carousel', context(false)); f.flush();
	expect(f.host.retain('carousel')!.record.model.current).toBe(mobile);
	f.host.destroy();
});
