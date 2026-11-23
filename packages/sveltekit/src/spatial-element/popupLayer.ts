/** Native top-layer enhancement. The semantic DOM and component state remain the owners. */
const key = Symbol.for('page-sections.popup-layer.v1');
const panelsSelector =
	'.ps-submenu:not([hidden]), details[open] > .settings-panel, details[open] > .mobile-panel, details[open] > .popup, [data-ps-popup], [data-spatial-navigation-popup]';
type Controller = { retain(root: HTMLElement): () => void };

function createController(): Controller {
	const roots = new Map<HTMLElement, { count: number; observer: MutationObserver }>();
	const originals = new Map<HTMLElement, string | null>();
	let backdrop: HTMLDivElement | undefined;
	let queued = false;
	function restore(panel: HTMLElement) {
		if (!originals.has(panel)) return;
		if (panel.matches(':popover-open')) panel.hidePopover();
		panel.removeAttribute('popover');
		const original = originals.get(panel);
		if (original === null) panel.removeAttribute('style');
		else panel.setAttribute('style', original!);
		originals.delete(panel);
	}
	function sync() {
		queued = false;
		const panels = new Set<HTMLElement>();
		for (const root of roots.keys()) {
			for (const panel of root.querySelectorAll<HTMLElement>(panelsSelector)) {
				const details = panel.parentElement;
				if (
					details instanceof HTMLDetailsElement &&
					details.open &&
					details.getClientRects().length &&
					!panel.getClientRects().length &&
					getComputedStyle(panel).display !== 'none'
				) {
					// Chromium can retain a detached layout box after a top-layer child is
					// closed by its details ancestor. Rebuild that box on reopening only;
					// never replace the node, its event handlers or the disclosure state.
					const display = panel.style.getPropertyValue('display');
					const priority = panel.style.getPropertyPriority('display');
					panel.style.setProperty('display', 'none', 'important');
					void panel.offsetHeight;
					if (display) panel.style.setProperty('display', display, priority);
					else panel.style.removeProperty('display');
				}
				if (!panel.isConnected || !panel.getClientRects().length) continue;
				if (!originals.has(panel) && getComputedStyle(panel).position !== 'absolute') continue;
				// Mobile search owns its input and results as one panel.
				if (panel.parentElement?.closest(panelsSelector)) continue;
				panels.add(panel);
			}
		}
		for (const panel of originals.keys()) if (!panels.has(panel)) restore(panel);
		if (!panels.size) {
			backdrop?.remove();
			backdrop = undefined;
			return;
		}
		if (!backdrop) {
			backdrop = document.createElement('div');
			backdrop.popover = 'manual';
			backdrop.dataset.psPopupBackdrop = '';
			backdrop.setAttribute('aria-hidden', 'true');
			// A single compositor surface, allocated only while a popup is open.
			// No filter animation, permanent will-change, canvas copy or per-frame JS.
			Object.assign(backdrop.style, {
				position: 'fixed',
				inset: '0',
				margin: '0',
				padding: '0',
				border: '0',
				width: '100vw',
				height: '100dvh',
				maxWidth: 'none',
				maxHeight: 'none',
				background: 'transparent',
				pointerEvents: 'none',
				backdropFilter: 'blur(3px)'
			});
			document.body.append(backdrop);
			backdrop.showPopover();
		}
		// Keep navigation and disclosure triggers sharp and usable below the top layer.
		const clear = new Set(
			document.querySelectorAll<HTMLElement>('.ps-navigation .header, .ps-navigation .satellite')
		);
		for (const panel of panels) {
			const summary = panel.parentElement?.querySelector<HTMLElement>(':scope > summary');
			if (summary && ![...clear].some((node) => node.contains(summary))) clear.add(summary);
		}
		const holes = [...clear]
			.filter((node) => node.getClientRects().length)
			.map((node) => {
				const r = node.getBoundingClientRect();
				return `M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`;
			})
			.join(' ');
		backdrop.style.clipPath = `path(evenodd, "M0 0H${innerWidth}V${innerHeight}H0Z ${holes}")`;
		for (const panel of panels) {
			if (!originals.has(panel)) {
				const rect = panel.getBoundingClientRect();
				const padding = getComputedStyle(panel).padding;
				const header = panel.closest<HTMLElement>('.ps-navigation .header');
				const headerRect = header?.getBoundingClientRect();
				const trigger = panel.parentElement?.querySelector<HTMLElement>(':scope > summary');
				const top = Math.max(
					12,
					headerRect
						? headerRect.bottom + 8
						: trigger
							? trigger.getBoundingClientRect().bottom + 8
							: rect.top
				);
				const mobileMenu = panel.classList.contains('mobile-panel') && headerRect;
				const width = Math.min(mobileMenu ? headerRect.width - 24 : rect.width, innerWidth - 24);
				const left = mobileMenu ? headerRect.left + 12 : rect.left;
				originals.set(panel, panel.getAttribute('style'));
				panel.popover = 'manual';
				Object.assign(panel.style, {
					position: 'fixed',
					inset: 'auto',
					margin: '0',
					transform: 'none',
					left: Math.max(12, Math.min(left, innerWidth - width - 12)) + 'px',
					top: top + 'px',
					width: width + 'px',
					padding,
					boxSizing: 'border-box',
					border: '1px solid var(--ps-panel-border)',
					borderRadius: 'var(--ps-radius)',
					boxShadow: 'var(--ps-navigation-shadow)',
					background: 'var(--ps-section-standard)',
					color: 'var(--ps-ink)',
					maxHeight: Math.max(0, innerHeight - top - 12) + 'px',
					overflowY: 'auto'
				});
			}
			// Closing a details ancestor can hide its native popover before the observer runs.
			// Always reconcile the actual browser state, including a rapid close/reopen.
			if (!panel.matches(':popover-open')) panel.showPopover();
		}
	}
	function schedule() {
		if (queued) return;
		queued = true;
		queueMicrotask(sync);
	}
	function closeOnViewportChange() {
		if (!originals.size) return;
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		for (const panel of originals.keys()) {
			const details = panel.parentElement;
			if (details instanceof HTMLDetailsElement) details.open = false;
		}
	}
	return {
		retain(root) {
			if (!roots.size) {
				window.addEventListener('scroll', closeOnViewportChange, { passive: true });
				window.addEventListener('resize', closeOnViewportChange, { passive: true });
			}
			const existing = roots.get(root);
			if (existing) existing.count++;
			else {
				root.dataset.psPopupsEnhanced = '';
				const observer = new MutationObserver(schedule);
				observer.observe(root, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ['hidden', 'open', 'data-ps-popup', 'data-spatial-navigation-popup']
				});
				roots.set(root, { count: 1, observer });
			}
			schedule();
			return () => {
				const entry = roots.get(root);
				if (entry && --entry.count === 0) {
					entry.observer.disconnect();
					roots.delete(root);
					delete root.dataset.psPopupsEnhanced;
				}
				if (!roots.size) {
					window.removeEventListener('scroll', closeOnViewportChange);
					window.removeEventListener('resize', closeOnViewportChange);
				}
				schedule();
			};
		}
	};
}

export function enhancePopups(root: HTMLElement): () => void {
	if (!('showPopover' in HTMLElement.prototype)) return () => {};
	// Share ownership across shells and independently bundled compatible adapters.
	const owner = document as unknown as Record<symbol, Controller>;
	const controller = (owner[key] ??= createController());
	return controller.retain(root);
}

export function popupLayer(root: HTMLElement) {
	return { destroy: enhancePopups(root) };
}
