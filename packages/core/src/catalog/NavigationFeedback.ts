/** Persistent, non-blocking acknowledgement while the router and renderer prepare a page. */
export class NavigationFeedback {
	private element?: HTMLElement;
	private frame = 0;
	private resolvePaint?: () => void;
	painted: Promise<void> = Promise.resolve();
	constructor(private root: HTMLElement) {}
	begin() {
		this.end();
		const element = document.createElement('div');
		element.className = 'stage-navigation-feedback';
		element.setAttribute('data-navigation-feedback', '');
		element.setAttribute('aria-hidden', 'true');
		this.root.appendChild(element);
		this.element = element;
		this.painted = new Promise(resolve => {
			this.resolvePaint = resolve;
			// Let the acknowledgement paint before synchronous DOM/GPU preparation.
			this.frame = requestAnimationFrame(() => {
				this.frame = requestAnimationFrame(() => {
					this.frame = 0;
					this.resolvePaint = undefined;
					resolve();
				});
			});
		});
	}
	end() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.resolvePaint?.();
		this.resolvePaint = undefined;
		this.element?.remove();
		this.element = undefined;
	}
}
