/** Suppress page magnification without disabling keyboard/browser-menu zoom.
 * Detail gestures are handled separately by the lazily loaded 3D runtime.
 */
export function preventBrowserPinch(root: HTMLElement) {
	const belongs = (event: Event) => event.target instanceof Node && root.contains(event.target);
	const wheel = (event: WheelEvent) => {
		if (event.ctrlKey && belongs(event)) event.preventDefault();
	};
	const touch = (event: TouchEvent) => {
		if (event.touches.length > 1 && belongs(event)) event.preventDefault();
	};
	const gesture = (event: Event) => { if (belongs(event)) event.preventDefault(); };
	window.addEventListener('wheel', wheel, { capture: true, passive: false });
	window.addEventListener('touchstart', touch, { capture: true, passive: false });
	window.addEventListener('touchmove', touch, { capture: true, passive: false });
	window.addEventListener('gesturestart', gesture, { capture: true, passive: false });
	window.addEventListener('gesturechange', gesture, { capture: true, passive: false });
	return () => {
		window.removeEventListener('wheel', wheel, true);
		window.removeEventListener('touchstart', touch, true);
		window.removeEventListener('touchmove', touch, true);
		window.removeEventListener('gesturestart', gesture, true);
		window.removeEventListener('gesturechange', gesture, true);
	};
}
