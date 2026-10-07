import { afterEach, expect, test, vi } from 'vitest';
import { StageFullscreenController } from './StageFullscreenController.js';

afterEach(() => { vi.unstubAllGlobals(); });

function fixture(request?: () => Promise<void>) {
	const style = () => {
		const values = new Map<string, [string, string]>();
		return {
			getPropertyValue: (key: string) => values.get(key)?.[0] ?? '',
			getPropertyPriority: (key: string) => values.get(key)?.[1] ?? '',
			setProperty: (key: string, value: string, priority = '') => values.set(key, [value, priority]),
			removeProperty: (key: string) => values.delete(key)
		};
	};
	class Element extends EventTarget {
		style = style();
		attributes = new Set<string>();
		isConnected = true;
		focus = vi.fn();
		requestFullscreen = request;
		setAttribute(key: string) { this.attributes.add(key); }
		removeAttribute(key: string) { this.attributes.delete(key); }
	}
	const element = new Element();
	const focus = new Element();
	const document = Object.assign(new EventTarget(), {
		documentElement: new Element(), body: new Element(), activeElement: focus,
		fullscreenEnabled: true, fullscreenElement: null as Element | null,
		exitFullscreen: vi.fn(async () => { document.fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); })
	});
	const window = Object.assign(new EventTarget(), { scrollX: 0, scrollY: 175, scrollTo: vi.fn() });
	vi.stubGlobal('HTMLElement', Element);
	vi.stubGlobal('document', document);
	vi.stubGlobal('window', window);
	const changed = vi.fn();
	const owner = new StageFullscreenController(element as unknown as HTMLElement, changed);
	return { owner, element, document, window, changed, focus };
}

test('missing API keeps fallback active; Escape restores styles, focus and scroll', () => {
	const { owner, element, document, window, changed, focus } = fixture();
	document.body.style.setProperty('overflow', 'auto', 'important');
	owner.setFullscreen(true);
	expect(element.attributes.has('data-stage-fullscreen')).toBe(true);
	expect(document.documentElement.style.getPropertyValue('overflow')).toBe('hidden');
	window.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
	expect(element.attributes.has('data-stage-fullscreen')).toBe(false);
	expect(document.documentElement.style.getPropertyValue('overflow')).toBe('');
	expect(document.body.style.getPropertyValue('overflow')).toBe('auto');
	expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
	expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 175, behavior: 'instant' });
	expect(focus.focus).toHaveBeenCalledWith({ preventScroll: true });
	expect(changed.mock.calls).toEqual([[true], [false]]);
	owner.dispose();
});

test('denied native request retains the fallback and teardown restores the document', async () => {
	const { owner, changed, document } = fixture(() => Promise.reject(new Error('Denied')));
	owner.setFullscreen(true);
	await Promise.resolve(); await Promise.resolve();
	expect(changed.mock.calls).toEqual([[true]]);
	owner.dispose();
	expect(changed.mock.calls).toEqual([[true], [false]]);
	expect(document.body.style.getPropertyValue('overflow')).toBe('');
});

test('browser native exit synchronizes the selected view', async () => {
	const { owner, element, document, changed } = fixture(async () => {});
	owner.setFullscreen(true);
	document.fullscreenElement = element;
	document.dispatchEvent(new Event('fullscreenchange'));
	await Promise.resolve();
	document.fullscreenElement = null;
	document.dispatchEvent(new Event('fullscreenchange'));
	expect(changed.mock.calls).toEqual([[true], [false]]);
	owner.dispose();
});

test('a native request finishing after teardown exits fullscreen without reactivating the view', async () => {
	let finish!: () => void;
	const { owner, element, document, changed } = fixture(() => new Promise<void>((resolve) => { finish = resolve; }));
	owner.setFullscreen(true);
	owner.dispose();
	document.fullscreenElement = element;
	finish();
	await Promise.resolve();
	expect(document.exitFullscreen).toHaveBeenCalledOnce();
	expect(changed.mock.calls).toEqual([[true], [false]]);
});
