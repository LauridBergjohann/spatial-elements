import { expect, test, vi } from 'vitest';
import { focusCatalogLink, isCatalogActivationFocus } from './catalogActivationFocus.js';

function fixture() {
	const previous = {} as Element;
	const flags = { role: '', download: false, policy: false, external: false };
	const anchor = {
		href: 'https://example.test/demo/elements/column', target: '',
		ownerDocument: { URL: 'https://example.test/demo/categories/carousel', baseURI: 'https://example.test/', activeElement: previous },
		getAttribute: (name: string) => name === 'role' ? flags.role : null,
		hasAttribute: (name: string) => name === 'download' && flags.download,
		closest: () => flags.policy ? {} : null,
		relList: { contains: () => flags.external },
		focus: vi.fn()
	} as unknown as HTMLAnchorElement;
	const event = { button: 0, defaultPrevented: false } as MouseEvent;
	const focusEvent = (type = 'focusin', target: EventTarget = anchor, relatedTarget: EventTarget | null = null) =>
		({ type, target, relatedTarget } as FocusEvent);
	return { anchor, flags, event, previous, focusEvent };
}

test('DOM focus is synchronous and only the exact focus pair is marked during the call', () => {
	const f = fixture();
	vi.mocked(f.anchor.focus).mockImplementation(options => {
		expect(options).toEqual({ preventScroll: true });
		expect(isCatalogActivationFocus(f.focusEvent())).toBe(true);
		expect(isCatalogActivationFocus(f.focusEvent('focusout', f.previous, f.anchor))).toBe(true);
		expect(isCatalogActivationFocus(f.focusEvent('focusin', {} as EventTarget))).toBe(false);
		expect(isCatalogActivationFocus(f.focusEvent('focusout', f.previous, null))).toBe(false);
	});
	focusCatalogLink(f.anchor, f.event);
	expect(f.anchor.focus).toHaveBeenCalledOnce();
	expect(isCatalogActivationFocus(f.focusEvent())).toBe(false);
});

test.each(['defaultPrevented', 'metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)('%s retains immediate unmarked focus', property => {
	const f = fixture();
	Object.assign(f.event, { [property]: true });
	vi.mocked(f.anchor.focus).mockImplementation(() => expect(isCatalogActivationFocus(f.focusEvent())).toBe(false));
	focusCatalogLink(f.anchor, f.event);
	expect(f.anchor.focus).toHaveBeenCalledOnce();
});

test.each(['button', 'role', 'download', 'target', 'policy', 'external', 'same-path', 'origin'] as const)('%s is not a batched link activation', variant => {
	const f = fixture();
	if (variant === 'button') Object.assign(f.event, { button: 1 });
	if (variant === 'role') f.flags.role = 'button';
	if (variant === 'download' || variant === 'policy' || variant === 'external') f.flags[variant] = true;
	if (variant === 'target') f.anchor.target = '_blank';
	if (variant === 'same-path') f.anchor.href = f.anchor.ownerDocument.URL + '#section';
	if (variant === 'origin') f.anchor.href = 'https://elsewhere.test/element';
	vi.mocked(f.anchor.focus).mockImplementation(() => expect(isCatalogActivationFocus(f.focusEvent())).toBe(false));
	focusCatalogLink(f.anchor, f.event);
});

test.each([true, false])('input trust does not change activation focus (%s)', isTrusted => {
	const f = fixture();
	Object.assign(f.event, { isTrusted });
	vi.mocked(f.anchor.focus).mockImplementation(() => expect(isCatalogActivationFocus(f.focusEvent())).toBe(true));
	focusCatalogLink(f.anchor, f.event);
});

test('nested focus scopes and thrown focus handlers cannot leak an activation marker', () => {
	const outer = fixture(), inner = fixture();
	vi.mocked(inner.anchor.focus).mockImplementation(() => {
		expect(isCatalogActivationFocus(inner.focusEvent())).toBe(true);
		expect(isCatalogActivationFocus(outer.focusEvent())).toBe(false);
		throw new Error('focus failed');
	});
	vi.mocked(outer.anchor.focus).mockImplementation(() => {
		expect(() => focusCatalogLink(inner.anchor, inner.event)).toThrow('focus failed');
		expect(isCatalogActivationFocus(outer.focusEvent())).toBe(true);
	});
	focusCatalogLink(outer.anchor, outer.event);
	expect(isCatalogActivationFocus(outer.focusEvent())).toBe(false);
});
