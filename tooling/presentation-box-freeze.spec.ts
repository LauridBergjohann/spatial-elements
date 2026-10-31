import { afterEach, expect, test, vi } from 'vitest';
import { freezePresentationBox } from '../packages/sveltekit/src/spatial-element/presentationBoxFreeze.js';

afterEach(() => vi.unstubAllGlobals());

test.each(['border-box', 'content-box'])('snapshot live inherited styles before any write (%s)', boxSizing => {
	let dirty = false;
	const readsAfterWrite: string[] = [];
	const read = (name: string, value: unknown) => {
		if (dirty) readsAfterWrite.push(name);
		return value;
	};
	const values: Record<string, string> = {
		'font-family': 'Source font', 'font-size': '16px', 'font-weight': '500', 'line-height': '24px',
		'letter-spacing': '.2px', color: 'rgb(1, 2, 3)', '--spatial-source': 'source-value',
		'padding-left': '1.25px', 'padding-right': '2.5px', 'padding-top': '3px', 'padding-bottom': '4px',
		'border-left-width': '.5px', 'border-right-width': '.5px', 'border-top-width': '1px', 'border-bottom-width': '1px'
	};
	const computed = new Proxy({ width: '300.25px', height: '120.5px', boxSizing, length: 2,
		0: '--spatial-source', 1: '--unrelated-property',
		getPropertyValue: (name: string) => read(name, dirty ? 'changed-after-write' : values[name] ?? '')
	}, { get: (object, key) => read(String(key), Reflect.get(object, key)) });
	vi.stubGlobal('getComputedStyle', () => computed);
	const assigned: Record<string, string> = {};
	const style = new Proxy({ cssText: 'color: red;', setProperty: (name: string, value: string) => {
		dirty = true; assigned[name] = value;
	} }, { set: (object, key, value) => { dirty = true; return Reflect.set(object, key, value); } });
	const box = { width: 380, height: 190 } as DOMRect;
	const root = { style, inert: false, getBoundingClientRect: () => box,
		get offsetWidth() { throw new Error('Do not round a valid fractional CSS width'); },
		get offsetHeight() { throw new Error('Do not round a valid fractional CSS height'); }
	} as unknown as HTMLElement;
	const snapshot = freezePresentationBox(root);
	expect(readsAfterWrite).toEqual([]);
	expect(snapshot).toEqual({ css: 'color: red;', box, inert: false,
		width: boxSizing === 'border-box' ? 300.25 : 305,
		height: boxSizing === 'border-box' ? 120.5 : 129.5 });
	expect(assigned['--spatial-source']).toBe('source-value');
	expect(assigned['--unrelated-property']).toBeUndefined();
	expect(assigned.color).toBe('rgb(1, 2, 3)');
	expect(root.style.width).toBe(`${snapshot.width}px`);
	expect(root.style.height).toBe(`${snapshot.height}px`);
});
