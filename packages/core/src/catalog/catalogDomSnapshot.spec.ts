import { afterEach, expect, it, vi } from 'vitest';
import { snapshotCatalogDom } from './catalogDomSnapshot.js';

afterEach(() => vi.unstubAllGlobals());

interface TestElement {
	tagName: string;
	children: TestElement[];
	style: { cssText: string };
	display: string;
	parentElement?: TestElement;
	currentSrc: string;
	src: string;
	attributes: Map<string, string>;
	setAttribute(key: string, value: string): void;
	removeAttribute(key: string): void;
	replaceChildren(): void;
	cloneNode(): TestElement;
}

function node(tagName: string, children: TestElement[] = []): TestElement {
	const attributes = new Map<string, string>();
	const element: TestElement = {
		tagName, children, style: { cssText: '' }, display: 'block', parentElement: undefined,
		currentSrc: '', src: '', attributes,
		setAttribute: (key: string, value: string) => attributes.set(key, value),
		removeAttribute: (key: string) => attributes.delete(key),
		replaceChildren() { element.children = []; },
		cloneNode() {
			const copy = node(tagName, element.children.map((child) => child.cloneNode()));
			for (const [key, value] of attributes) copy.setAttribute(key, value);
			return copy;
		}
	};
	for (const child of children) child.parentElement = element;
	return element;
}

const snapshot = (source: TestElement) => {
	const result = snapshotCatalogDom(source as unknown as HTMLElement);
	return { ...result, copy: result.copy as unknown as TestElement };
};

function styles() {
	const reads = vi.fn((element: TestElement) => Object.assign(
		['display', 'width', 'fill', '--authored-token'], {
			display: element.display,
			getPropertyValue: (key: string) => ({ display: element.display, width: '100px', fill: 'rgb(12, 34, 56)', '--authored-token': 'custom-value' } as Record<string, string>)[key]
		}
	));
	vi.stubGlobal('getComputedStyle', reads);
	return reads;
}

it('does not resolve styles or keep descendants of hidden navigation subtrees', () => {
	const hiddenLeaf = node('A');
	const hiddenMenu = node('NAV', [hiddenLeaf]);
	hiddenMenu.display = 'none';
	const icon = node('svg', [node('path')]);
	const source = node('HEADER', [hiddenMenu, node('A'), icon]);
	const reads = styles();
	const { copy, elements } = snapshot(source);
	expect(reads.mock.calls.map(([element]) => element)).not.toContain(hiddenLeaf);
	expect(elements).toHaveLength(5);
	expect(copy.children[0].children).toHaveLength(0);
	expect(copy.children[0].style.cssText).toBe('display:none!important;');
	expect(copy.children[2].children[0].style.cssText).toContain('fill:rgb(12, 34, 56);');
	expect(copy.children[1].style.cssText).toContain('--authored-token:custom-value;');
	expect(hiddenMenu.children).toEqual([hiddenLeaf]);
});

it('pins responsive pictures to the already displayed absolute image URL', () => {
	styles();
	const candidate = node('SOURCE');
	candidate.display = 'none';
	candidate.setAttribute('srcset', 'small.webp 1x, large.webp 2x');
	const image = node('IMG');
	image.currentSrc = 'https://example.com/source/large.webp';
	image.src = 'https://example.com/source/fallback.webp';
	image.setAttribute('src', 'fallback.webp');
	image.setAttribute('srcset', 'small.webp 1x, large.webp 2x');
	image.setAttribute('sizes', '50vw');
	const source = node('PICTURE', [candidate, image]);
	const { copy } = snapshot(source);
	expect(copy.children[0].attributes.has('srcset')).toBe(false);
	expect(copy.children[1].attributes.get('src')).toBe(image.currentSrc);
	expect(copy.children[1].attributes.has('srcset')).toBe(false);
	expect(copy.children[1].attributes.has('sizes')).toBe(false);
	expect(image.attributes.get('src')).toBe('fallback.webp');
});

it('resolves a plain relative image before the outgoing route is unmounted', () => {
	styles();
	const image = node('IMG');
	image.src = 'https://example.com/source/logo.svg';
	image.setAttribute('src', 'logo.svg');
	const { copy } = snapshot(image);
	expect(copy.attributes.get('src')).toBe(image.src);
});
