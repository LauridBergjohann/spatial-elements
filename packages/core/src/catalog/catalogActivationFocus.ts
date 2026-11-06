interface ActivationFocus {
	anchor: HTMLAnchorElement;
	previous: Element | null;
}

// The scope exists only while our own synchronous focus() dispatches its events.
// It neither classifies trusted input nor claims that a router accepted the click.
let activationFocus: ActivationFocus | undefined;

function ordinaryLinkActivation(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
		event.shiftKey || event.altKey || anchor.getAttribute('role') === 'button' ||
		anchor.hasAttribute('download') || anchor.target || anchor.relList.contains('external') ||
		anchor.closest('[data-sveltekit-keepfocus], [data-sveltekit-noscroll], [data-sveltekit-replacestate], [data-sveltekit-reload]')) return false;
	try {
		const current = new URL(anchor.ownerDocument.URL);
		const destination = new URL(anchor.href, anchor.ownerDocument.baseURI);
		return destination.origin === current.origin && destination.pathname !== current.pathname &&
			(destination.protocol === 'http:' || destination.protocol === 'https:');
	} catch {
		return false;
	}
}

/** Keep native focus immediate while identifying only its activation-owned GPU work. */
export function focusCatalogLink(anchor: HTMLAnchorElement, event: MouseEvent): void {
	const preceding = activationFocus;
	activationFocus = ordinaryLinkActivation(anchor, event)
		? { anchor, previous: anchor.ownerDocument.activeElement } : undefined;
	try { anchor.focus({ preventScroll: true }); }
	finally { activationFocus = preceding; }
}

/** Unrelated or reentrant focus changes retain their ordinary immediate invalidation. */
export function isCatalogActivationFocus(event: FocusEvent): boolean {
	const scope = activationFocus;
	return Boolean(scope && (event.type === 'focusin'
		? event.target === scope.anchor
		: event.type === 'focusout' && event.target === scope.previous && event.relatedTarget === scope.anchor));
}
