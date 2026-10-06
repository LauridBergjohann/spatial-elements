/** Keeps native fullscreen, browser Escape and the viewport fallback in sync. */
export class StageFullscreenController {
	private active = false;
	private native = false;
	private disposed = false;
	private restore?: () => void;
	private returnFocus?: HTMLElement;
	constructor(private readonly element: HTMLElement, private readonly changed: (active: boolean) => void) {
		document.addEventListener('fullscreenchange', this.fullscreenChanged);
		window.addEventListener('keydown', this.keydown);
	}
	setFullscreen(active: boolean) {
		if (this.disposed || active === this.active) return;
		if (!active) {
			this.leave();
			return;
		}
		this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		const scroll = { left: window.scrollX, top: window.scrollY, behavior: 'instant' as const };
		const roots = [document.documentElement, document.body];
		const styles = roots.map((root) => [root.style.getPropertyValue('overflow'), root.style.getPropertyPriority('overflow')]);
		roots.forEach((root) => root.style.setProperty('overflow', 'hidden', 'important'));
		this.restore = () => {
			roots.forEach((root, index) => {
				const [value, priority] = styles[index];
				if (value) root.style.setProperty('overflow', value, priority);
				else root.style.removeProperty('overflow');
			});
			window.scrollTo(scroll);
		};
		this.active = true;
		this.element.setAttribute('data-stage-fullscreen', '');
		this.changed(true);
		// Call within the click's user activation. Missing/denied APIs retain the
		// same renderer and controls in the viewport fallback.
		try {
			if (!this.element.requestFullscreen || document.fullscreenEnabled === false) return;
			void this.element.requestFullscreen().then(() => {
				if (this.disposed || !this.active) {
					if (document.fullscreenElement === this.element) void document.exitFullscreen().catch(() => {});
					return;
				}
				this.native = document.fullscreenElement === this.element;
			}).catch(() => { /* Keep the viewport fallback. */ });
		} catch { /* Older implementations may throw synchronously. */ }
	}
	private leave() {
		if (!this.active) return;
		this.active = false;
		this.native = false;
		this.element.removeAttribute('data-stage-fullscreen');
		this.restore?.();
		this.restore = undefined;
		this.changed(false);
		if (document.fullscreenElement === this.element) void document.exitFullscreen().catch(() => {});
		if (!this.disposed && this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
	}
	private readonly fullscreenChanged = () => {
		if (document.fullscreenElement === this.element) this.native = true;
		else if (this.native) this.setFullscreen(false);
	};
	private readonly keydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && !event.defaultPrevented && this.active && !document.fullscreenElement) {
			event.preventDefault();
			this.setFullscreen(false);
		}
	};
	dispose() {
		this.disposed = true;
		this.leave();
		document.removeEventListener('fullscreenchange', this.fullscreenChanged);
		window.removeEventListener('keydown', this.keydown);
	}
}
