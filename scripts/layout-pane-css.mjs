/** The 3XL split is a paint window on document flow, never a nested page scroller. */
export function paneRules(tokens) {
	const pane = tokens.pane;
	const hero = tokens.hero['3xl'];
	const root = '.stage [data-spatial-element-root]:not([data-spatial-detail-flow])';
	const bodyTop = pane.top + pane.headerHeight;
	const bottom = pane.bottom + pane.submenuHeight / 2;
	return `@media (min-width: ${tokens.layoutMinWidths['3xl']}px) and (min-height: ${pane.minUsableHeight}px) {
	${root} {
		--spatial-pane-left: calc(50% + ${pane.centerGap}px);
		--spatial-pane-width: min(${tokens.contentMax}px, max(0px, calc(50% - ${pane.centerGap + pane.rightInset}px - env(safe-area-inset-right, 0px))));
		--spatial-pane-top: calc(${pane.top}px + env(safe-area-inset-top, 0px));
		--spatial-pane-body-top: calc(${bodyTop}px + env(safe-area-inset-top, 0px));
		--spatial-pane-bottom: calc(${bottom}px + env(safe-area-inset-bottom, 0px));
		--spatial-pane-height: calc(100svh - var(--spatial-pane-top) - var(--spatial-pane-bottom));
		--spatial-detail-media-size: ${hero.railSize}px;
		--spatial-detail-media-left: calc(${hero.railInset}px + env(safe-area-inset-left, 0px));
		--spatial-detail-media-gap: ${hero.railGap}px;
		--spatial-detail-media-stage-gap: ${hero.railStageGap}px;
		--spatial-detail-fit-left: calc(var(--spatial-detail-media-left) + ${hero.railSize + hero.railStageGap}px);
		--spatial-detail-fit-right: calc(50% + ${pane.centerGap}px);
		--spatial-detail-fit-height: calc(100svh - ${hero.heightOffset}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
		--spatial-detail-summary-width: 100%;
		--spatial-detail-summary-max-height: none;
		--spatial-detail-submenu-height: ${pane.submenuHeight}px;
		--spatial-element-section-scroll-offset: var(--spatial-pane-body-top);
		margin-top: 0;
	}
	.stage:has([data-spatial-element-root]:not([data-spatial-detail-flow])) .spatial-shell-track { height: 0; margin-bottom: 0; }
	html:has(${root}) { scroll-padding-top: calc(${bodyTop}px + env(safe-area-inset-top, 0px)); scroll-padding-bottom: calc(${bottom + pane.submenuHeight / 2}px + env(safe-area-inset-bottom, 0px)); }
	${root} .spatial-element-hero {
		position: fixed; left: 0; top: var(--spatial-pane-top); width: 100%; height: var(--spatial-detail-fit-height);
		transform: translateY(var(--spatial-pane-fixed-compensation, 0px));
	}
	${root} .spatial-element-pane-body {
		position: relative; z-index: 1; box-sizing: border-box;
		width: var(--spatial-pane-width); margin-left: var(--spatial-pane-left);
		padding-top: var(--spatial-pane-body-top); padding-bottom: calc(var(--spatial-pane-bottom) + ${pane.submenuHeight / 2}px);
		scroll-padding-top: var(--spatial-pane-body-top); scroll-padding-bottom: calc(var(--spatial-pane-bottom) + ${pane.submenuHeight / 2}px);
		pointer-events: auto;
	}
	${root} .spatial-element-pane-body [data-spatial-summary-aside] {
		position: relative; top: auto; right: auto; width: 100%; margin: 0;
	}
	${root} .spatial-element-pane-body .spatial-element-panel { max-height: none; }
	${root} .spatial-element-pane-body .spatial-summary-query { max-height: none; overflow: visible; overscroll-behavior: auto; }
	${root} .spatial-element-pane-body .spatial-element-panel .stage-panel-surface::before,
	${root} .spatial-element-pane-body .spatial-element-panel .stage-panel-surface::after { display: none; }
	${root} .spatial-element-pane-body .panel-copy {
		position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%);
	}
	${root} .spatial-element-pane-body .spatial-element-content { padding-top: 0; }
	${root} .spatial-element-section-list { width: 100%; margin: 0; }
	${root} .spatial-section-surface { border-radius: 0; }
	${root} .spatial-element-pane-body [data-spatial-element-tab-target] { scroll-margin-top: 0; }
	${root} .spatial-element-pane-surface {
		display: block; position: fixed; z-index: 0; top: var(--spatial-pane-top); left: var(--spatial-pane-left);
		width: var(--spatial-pane-width); height: var(--spatial-pane-height);
		border-radius: var(--spatial-element-panel-radius); pointer-events: none;
		background: color-mix(in srgb, var(--spatial-pane-tint) var(--spatial-pane-tint-opacity), transparent);
		backdrop-filter: blur(var(--spatial-pane-blur)); box-shadow: var(--spatial-element-docked-panel-box-shadow);
		transform: translateY(var(--spatial-pane-fixed-compensation, 0px));
	}
	${root} .spatial-element-pane-heading {
		display: block; box-sizing: border-box; position: fixed; z-index: 3;
		top: var(--spatial-pane-top); left: var(--spatial-pane-left); width: var(--spatial-pane-width); height: ${pane.headerHeight}px;
		border-radius: var(--spatial-element-panel-radius) var(--spatial-element-panel-radius) 0 0;
		background: color-mix(in srgb, var(--spatial-pane-tint) var(--spatial-pane-tint-opacity), transparent);
		backdrop-filter: blur(var(--spatial-pane-blur)); pointer-events: auto;
		border-bottom: 1px solid color-mix(in srgb, var(--spatial-element-ink) 14%, transparent);
		box-shadow: 0 4px 10px rgb(0 0 0 / 0.08);
		transform: translateY(var(--spatial-pane-fixed-compensation, 0px));
	}
	${root} .spatial-element-pane-title-row { display: flex; align-items: center; gap: 16px; height: ${pane.headerHeight - tokens.breadcrumb['3xl'].height}px; padding-inline: 16px; }
	${root} .spatial-element-pane-heading .breadcrumbs { width: 100%; }
	${root} .spatial-element-pane-title { min-width: 0; flex: 1; margin: 0; font-size: 24px; line-height: 32px; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	${root} .spatial-element-pane-eyebrow { margin: 0; font-size: 14px; line-height: 20px; white-space: nowrap; }
	${root} .spatial-element-pane-action { visibility: hidden; display: grid; place-items: center; flex: none; width: 40px; height: 40px; padding: 0; border: 0; border-radius: var(--spatial-element-control-radius); color: var(--spatial-element-on-accent); background: var(--spatial-element-accent); cursor: pointer; }
	${root}[data-spatial-detail-pane-action] .spatial-element-pane-action { visibility: visible; }
	${root} .spatial-element-pane-cover { display: block; position: fixed; z-index: 2; left: var(--spatial-pane-left); width: var(--spatial-pane-width); background: var(--stage-page-background, var(--spatial-element-background)); pointer-events: none; transform: translateY(var(--spatial-pane-fixed-compensation, 0px)); }
	${root} .spatial-element-pane-cover-top { top: 0; height: var(--spatial-pane-body-top); }
	${root} .spatial-element-pane-cover-bottom { top: calc(100svh - var(--spatial-pane-bottom)); height: var(--spatial-pane-bottom); }
	${root}[data-spatial-detail-pane-clipped] .spatial-element-pane-cover { display: none; }
	${root} .spatial-element-pane-submenu-shell { display: flex; justify-content: center; position: fixed; z-index: 4; left: var(--spatial-pane-left); top: calc(100svh - var(--spatial-pane-bottom) - ${pane.submenuHeight / 2}px); width: var(--spatial-pane-width); height: ${pane.submenuHeight}px; pointer-events: none; transform: translateY(var(--spatial-pane-fixed-compensation, 0px)); }
	${root} .spatial-element-pane-submenu { display: none; box-sizing: border-box; width: min(var(--spatial-detail-submenu-natural-width, 100%), 100%); height: 100%; border-radius: var(--spatial-element-control-radius); background: color-mix(in srgb, var(--spatial-pane-tint) var(--spatial-pane-tint-opacity), transparent); backdrop-filter: blur(var(--spatial-pane-blur)); box-shadow: var(--spatial-element-docked-panel-box-shadow); overflow: hidden; pointer-events: auto; }
	${root} .spatial-element-pane-submenu[data-active] { display: block; }
	${root}[data-spatial-detail-pane-clipped] .spatial-element-pane-body,
	${root}[data-spatial-detail-pane-clipped] .spatial-element-pane-surface,
	${root}[data-spatial-detail-pane-clipped] .spatial-element-pane-heading,
	${root}[data-spatial-detail-pane-clipped] .spatial-element-pane-submenu-shell {
		opacity: var(--spatial-pane-focus-opacity, 1);
		transform-origin: 50% var(--spatial-pane-focus-origin-y, 50%);
	}
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-body,
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-surface,
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-heading,
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-submenu-shell {
		filter: blur(var(--spatial-pane-focus-blur, 0px));
	}
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-body {
		transform: translate(var(--spatial-pane-focus-x, 0px), var(--spatial-pane-focus-y, 0px)) scale(var(--spatial-pane-focus-scale, 1));
	}
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-surface,
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-heading,
	${root}[data-spatial-detail-pane-zooming] .spatial-element-pane-submenu-shell {
		transform: translate(var(--spatial-pane-focus-x, 0px), calc(var(--spatial-pane-fixed-compensation, 0px) + var(--spatial-pane-focus-y, 0px))) scale(var(--spatial-pane-focus-scale, 1));
	}
	${root} .spatial-element-content .spatial-element-tabs-anchor { position: fixed; top: calc(100svh - var(--spatial-pane-bottom) - ${pane.submenuHeight / 2}px); left: calc(var(--spatial-pane-left) + var(--spatial-pane-width) / 2); width: max-content; max-width: var(--spatial-pane-width); height: ${pane.submenuHeight}px; margin: 0; transform: translate(-50%, var(--spatial-pane-fixed-compensation, 0px)); }
	${root}[data-spatial-detail-pane-tabs] .spatial-element-tabs-anchor { visibility: hidden; pointer-events: none; }
	${root}[data-spatial-detail-pane-hidden] .spatial-element-pane-body,
	${root}[data-spatial-detail-pane-hidden] .spatial-element-pane-surface,
	${root}[data-spatial-detail-pane-hidden] .spatial-element-pane-heading,
	${root}[data-spatial-detail-pane-hidden] .spatial-element-pane-submenu-shell { pointer-events: none; }
}
@media (prefers-reduced-motion: reduce) {
	${root} .spatial-element-pane-body,
	${root} .spatial-element-pane-surface,
	${root} .spatial-element-pane-heading,
	${root} .spatial-element-pane-submenu-shell { transition: none; }
}`;
}
