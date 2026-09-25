/** Retain a composite's actual CSS transforms while giving its successor a new motion origin. */
export function rebasePresentation(layers: HTMLElement[], from: DOMRect, role: string) {
	const host = document.createElement('div');
	host.dataset.catalogActorRole = role;
	Object.assign(host.style, {
		position: 'fixed',
		left: `${from.left}px`,
		top: `${from.top}px`,
		width: `${from.width}px`,
		height: `${from.height}px`,
		transformOrigin: 'top left',
		pointerEvents: 'none',
		zIndex: role === 'summary-surface' ? '20' : '22',
		willChange: 'transform, opacity'
	});
	for (const layer of layers) {
		layer.style.left = `${Number.parseFloat(layer.style.left) - from.left}px`;
		layer.style.top = `${Number.parseFloat(layer.style.top) - from.top}px`;
		layer.style.position = 'absolute';
		delete layer.dataset.catalogActorRole;
		delete layer.dataset.catalogActorVariant;
		host.appendChild(layer);
	}
	return host;
}
