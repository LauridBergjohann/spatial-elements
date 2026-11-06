import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createStagedDomReveal, STAGED_REVEAL_OPACITY } from '../packages/sveltekit/src/catalog/stagedDomReveal.js';

class ElementFixture {
	parentElement?: ElementFixture;
	children: ElementFixture[] = [];
	attributes = new Map<string, string>();
	values = new Map<string, { value: string; priority: string }>();
	style = {
		getPropertyValue: (key: string) => this.values.get(key)?.value ?? '',
		getPropertyPriority: (key: string) => this.values.get(key)?.priority ?? '',
		setProperty: vi.fn((key: string, value: string, priority = '') => { this.values.set(key, { value, priority }); }),
		removeProperty: vi.fn((key: string) => { this.values.delete(key); })
	};
	constructor(attributes: Record<string, string> = {}) { for (const [key, value] of Object.entries(attributes)) this.attributes.set(key, value); }
	hasAttribute(key: string) { return this.attributes.has(key); }
	getAttribute(key: string) { return this.attributes.get(key) ?? null; }
	closest(selector: string): ElementFixture | null {
		const attribute = selector.slice(1, -1);
		for (let node: ElementFixture | undefined = this; node; node = node.parentElement) if (node.hasAttribute(attribute)) return node;
		return null;
	}
	append(child: ElementFixture) { child.parentElement = this; this.children.push(child); return child; }
	remove(child: ElementFixture) { this.children = this.children.filter(entry => entry !== child); child.parentElement = undefined; }
	querySelectorAll(): ElementFixture[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
	asElement() { return this as unknown as HTMLElement; }
}

let notify: () => void;
let disconnected: ReturnType<typeof vi.fn>;
beforeEach(() => {
	disconnected = vi.fn();
	vi.stubGlobal('MutationObserver', class {
		constructor(callback: () => void) { notify = callback; }
		observe() {}
		disconnect() { disconnected(); }
	});
});
afterEach(() => { vi.unstubAllGlobals(); });

function fixture() {
	const root = new ElementFixture();
	const section = root.append(new ElementFixture({ 'data-catalog-transition-dom': 'enter' }));
	const frame = section.append(new ElementFixture({ 'data-catalog-transition-group': 'shared' }));
	const surface = frame.append(new ElementFixture({ 'data-stage-panel-css-surface': '', 'data-catalog-transition-group': 'shared' }));
	const content = surface.append(new ElementFixture({ 'data-stage-panel-content': '', 'data-catalog-transition-group': 'shared' }));
	const text = content.append(new ElementFixture());
	return { root, section, frame, surface, content, text };
}
const opacity = (element: ElementFixture) => element.style.getPropertyValue(STAGED_REVEAL_OPACITY);

test('updates actual nested paint owners without changing wrappers, inherited aliases or theme/focus factors', () => {
	const f = fixture();
	f.root.style.setProperty('--catalog-shared-opacity', '0');
	f.content.style.setProperty('--stage-panel-opacity', '.7');
	f.content.style.setProperty('--stage-panel-content-opacity', '.4');
	const reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.25);
	for (const target of [f.section, f.surface, f.content]) expect(opacity(target)).toBe('0.25');
	for (const target of [f.root, f.frame, f.text]) expect(opacity(target)).toBe('');
	expect(f.root.style.getPropertyValue('--catalog-shared-opacity')).toBe('0');
	expect(f.content.style.getPropertyValue('--stage-panel-opacity')).toBe('.7');
	expect(f.content.style.getPropertyValue('--stage-panel-content-opacity')).toBe('.4');
	expect(f.content.style.getPropertyValue('--stage-transition-opacity')).toBe('');
	reveal.restore();
});

test('a late receiver and an unmarked nested panel receive the current factor before paint', () => {
	const f = fixture(), reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.6);
	const nested = f.content.append(new ElementFixture({ 'data-stage-panel-content': '' }));
	const late = f.root.append(new ElementFixture({ 'data-catalog-transition-dom': 'enter' }));
	notify();
	expect(opacity(nested)).toBe('0.6');
	expect(opacity(late)).toBe('0.6');
	// Existing nested scopes each keep their original multiplicative role.
	expect(opacity(f.content)).toBe('0.6');
	expect(opacity(f.section)).toBe('0.6');
	reveal.restore();
});

test('continuous shell branches stay untouched and marker changes release or acquire the local factor', () => {
	const f = fixture();
	const shell = f.root.append(new ElementFixture({ 'data-catalog-shell-continuous': '' }));
	const menu = shell.append(new ElementFixture({ 'data-stage-panel-content': '', 'data-catalog-transition-group': 'enter' }));
	const reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.3);
	expect(opacity(menu)).toBe('');
	shell.attributes.delete('data-catalog-shell-continuous'); notify();
	expect(opacity(menu)).toBe('0.3');
	shell.attributes.set('data-catalog-shell-continuous', ''); notify();
	expect(opacity(menu)).toBe('');
	f.section.attributes.delete('data-catalog-transition-dom'); notify();
	expect(opacity(f.section)).toBe('');
	reveal.restore();
});

test.each(['finish', 'cancel'])('%s restores original inline values/priorities once and stops late observer callbacks', () => {
	const f = fixture();
	f.content.style.setProperty(STAGED_REVEAL_OPACITY, '.8', 'important');
	const reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.45);
	expect(opacity(f.content)).toBe('0.45');
	reveal.restore();
	const writes = f.content.style.setProperty.mock.calls.length;
	reveal.restore(); reveal.setProgress(.7); notify();
	expect(opacity(f.content)).toBe('.8');
	expect(f.content.style.getPropertyPriority(STAGED_REVEAL_OPACITY)).toBe('important');
	expect(f.content.style.setProperty).toHaveBeenCalledTimes(writes);
	expect(opacity(f.section)).toBe('');
	expect(opacity(f.surface)).toBe('');
	expect(disconnected).toHaveBeenCalledOnce();
});

test('a detached or reparented receiver is restored instead of retaining a stale reveal owner', () => {
	const f = fixture();
	f.content.style.setProperty(STAGED_REVEAL_OPACITY, '.9');
	const reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.2);
	f.surface.remove(f.content); notify();
	expect(opacity(f.content)).toBe('.9');
	f.surface.append(f.content); notify();
	expect(opacity(f.content)).toBe('0.2');
	reveal.restore(); expect(opacity(f.content)).toBe('.9');
});

test('unchanged progress does not repeat writes and invalid progress stays finite', () => {
	const f = fixture(), reveal = createStagedDomReveal(f.root.asElement());
	reveal.setProgress(.5);
	const writes = f.content.style.setProperty.mock.calls.length;
	reveal.setProgress(.5); notify();
	expect(f.content.style.setProperty).toHaveBeenCalledTimes(writes);
	reveal.setProgress(NaN); expect(opacity(f.content)).toBe('0');
	reveal.setProgress(2); expect(opacity(f.content)).toBe('1');
	reveal.restore();
});
