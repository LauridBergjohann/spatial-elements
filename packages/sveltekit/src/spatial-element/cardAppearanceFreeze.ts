const FROZEN = 'data-spatial-card-appearance-frozen';
const AFTER_OPACITY = '--spatial-card-frozen-after-opacity';
const TRANSITION = 'transition-property';
const TRANSITION_LONGHANDS = ['transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior'];

/** Freeze the displayed (possibly interpolated) appearance, not the hover state.
 * Read all known paint owners before any write. Motion may subsequently own an
 * actor's transform; restore its motion first, then this appearance snapshot.
 */
export function freezeCardAppearance(card: HTMLElement): () => void {
	const surface = card.querySelector<HTMLElement>('.spatial-element-card-surface');
	const targets: { element: HTMLElement; properties: readonly string[] }[] = [
		{ element: card, properties: ['outline-color', 'outline-style', 'outline-width', 'outline-offset'] }
	];
	for (const element of card.querySelectorAll<HTMLElement>('[data-shared-role="title"], [data-shared-role="eyebrow"]')) {
		targets.push({ element, properties: ['transform', 'text-shadow'] });
	}
	if (surface) targets.push({ element: surface,
		properties: ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'] });
	const poster = card.querySelector<HTMLElement>('[data-catalog-poster]');
	if (poster) targets.push({ element: poster, properties: ['transform', 'opacity'] });
	const writes: { element: HTMLElement; name: string; frozen?: string; original: string; priority: string }[] = [];
	const snapshot = (element: HTMLElement, name: string, frozen?: string) => writes.push({ element, name, frozen,
		original: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) });
	for (const { element, properties } of targets) {
		const computed = getComputedStyle(element);
		for (const name of properties) snapshot(element, name, computed.getPropertyValue(name));
		// Suppressing the transition alone would jump to its final cascade value.
		// Pin its current value first, and leave unrelated authored longhands alone.
		if (element !== card) {
			snapshot(element, TRANSITION, 'none');
			// Motion saves/restores the shorthand on Dock actors. Retain these
			// authored longhands too, even if that shorthand cannot serialize.
			for (const name of TRANSITION_LONGHANDS) snapshot(element, name);
		}
	}
	const previousMarker = surface?.getAttribute(FROZEN);
	if (surface) snapshot(surface, AFTER_OPACITY, getComputedStyle(surface, '::after').opacity);
	let restored = false;
	const restore = () => {
		if (restored) return;
		restored = true;
		for (const { element, name, original, priority } of writes) {
			if (original) element.style.setProperty(name, original, priority);
			else element.style.removeProperty(name);
		}
		if (surface) {
			if (previousMarker === null) surface.removeAttribute(FROZEN);
			else if (previousMarker !== undefined) surface.setAttribute(FROZEN, previousMarker);
		}
	};
	try {
		for (const { element, name, frozen } of writes) if (frozen !== undefined) element.style.setProperty(name, frozen, 'important');
		surface?.setAttribute(FROZEN, '');
	} catch (error) { restore(); throw error; }
	return restore;
}
