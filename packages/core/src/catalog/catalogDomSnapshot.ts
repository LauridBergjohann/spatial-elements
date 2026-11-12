type SnapshotElement = HTMLElement | SVGElement;

/** Freeze the displayed image, not an authored relative URL or responsive
 * candidate which would be resolved again after the destination changes URL.
 */
function freezeImageSource(source: SnapshotElement, copy: SnapshotElement) {
	if (source.tagName === 'IMG') {
		const image = source as HTMLImageElement;
		const selected = image.currentSrc || image.src;
		if (selected) copy.setAttribute('src', selected);
		copy.removeAttribute('srcset');
		copy.removeAttribute('sizes');
	} else if (source.tagName === 'SOURCE' && source.parentElement?.tagName === 'PICTURE') {
		// A picture source would otherwise override the frozen img currentSrc.
		copy.removeAttribute('srcset');
		copy.removeAttribute('sizes');
	}
}

export interface CatalogDomSnapshotElement {
	source: SnapshotElement;
	copy: SnapshotElement;
	style: CSSStyleDeclaration;
}

/** Capture decorative DOM while it still belongs to the outgoing page.
 * Read only rendered subtrees. Large navigation trees commonly contain several
 * hidden versions; reading every computed property of those invisible nodes
 * makes Chrome resolve their otherwise-lazy styles and can block navigation.
 * A display:none placeholder preserves the original lack of a layout box.
 */
export function snapshotCatalogDom(source: HTMLElement) {
	const copy = source.cloneNode(true) as HTMLElement;
	const elements: CatalogDomSnapshotElement[] = [];
	const visit = (original: SnapshotElement, cloned: SnapshotElement) => {
		const style = getComputedStyle(original);
		elements.push({ source: original, copy: cloned, style });
		freezeImageSource(original, cloned);
		if (style.display === 'none') {
			cloned.replaceChildren();
			cloned.style.cssText = 'display:none!important;';
			return;
		}
		// Retain every computed property, including authored custom properties and
		// SVG presentation. One parse on a detached clone avoids CSSOM write loops.
		let css = '';
		for (const property of style) css += property + ':' + style.getPropertyValue(property) + ';';
		cloned.style.cssText = css;
		const children = original.children;
		const copies = cloned.children;
		for (let index = 0; index < children.length; index++)
			visit(children[index] as SnapshotElement, copies[index] as SnapshotElement);
	};
	visit(source, copy);
	return { copy, elements };
}
