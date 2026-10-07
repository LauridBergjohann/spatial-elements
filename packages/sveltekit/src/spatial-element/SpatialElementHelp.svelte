<script lang="ts">
	import { getContext, onMount, tick } from 'svelte';
	import { CircleHelp, X } from 'lucide-svelte';
	import InteractionGesture from './InteractionGesture.svelte';
	import { getCssPanelBoxShadow } from '@spatial-elements/core/stage/panelShadow';
	import { getInteractionGuidance, MODEL_INPUT_EVENT, type ModelInputState, type InteractionGuidance } from '@spatial-elements/core/stage/interactionGuidance';
	import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_CONTEXT_KEY, STAGE_PANEL_LAYOUT_EVENT, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import SpatialElementViewToggle from './SpatialElementViewToggle.svelte';
	import Panel from '../stage/Panel.svelte';
	import SpatialIconButton from './SpatialIconButton.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import { useSpatialMessages } from './messagesContext.js';

	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const stageContext = getContext<StageContext>(STAGE_CONTEXT_KEY);
	const fullscreen = $derived(stageContext.isFullscreen?.() ?? false);
	const readMessages = useSpatialMessages();
	const messages = $derived(readMessages());
	const help = $derived(messages.interactionHelp);
	const id = $props.id();
	let root: HTMLDivElement;
	let focusAnchor = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>(null!);
	let popover: HTMLDivElement;
	let closeButton: HTMLButtonElement;
	let open = $state(false);
	let enhanced = $state(false);
	let visible = false;
	let interacted = $state(false);
	let touchInput = $state(false);
	let guidance: InteractionGuidance | undefined;
	let delay: ReturnType<typeof setTimeout> | undefined;
	let hideDelay: ReturnType<typeof setTimeout> | undefined;
	let manual = false;
	let helpHovered = false;
	let buttonHovered = false;
	let modelInput: ModelInputState = { hovered: false, active: false };
	const surfaceStyle = $derived([
		`--help-tint: ${typeof theme.panelTheme.tint === 'number' ? '#' + theme.panelTheme.tint.toString(16).padStart(6, '0') : theme.panelTheme.tint ?? '#ffffff'}`,
		`--help-tint-opacity: ${(theme.panelTheme.tintOpacity ?? 0.65) * 100}%`,
		`--help-blur: ${Math.min(100, Math.max(0, theme.panelTheme.backdropBlur ?? 8))}px`,
		`--help-shadow: ${getCssPanelBoxShadow(theme.panelTheme.shadowIntensity ?? 0.2)}`,
		`--help-radius: ${theme.panelShape.radius}px`
	].join(';'));

	function clearDelay() { clearTimeout(delay); delay = undefined; }
	function clearHideDelay() { clearTimeout(hideDelay); hideDelay = undefined; }
	function close(returnFocus = false) {
		clearDelay(); clearHideDelay();
		if (!open) return;
		const restoreFocus = returnFocus && popover.contains(document.activeElement);
		popover.hidePopover();
		open = false;
		manual = false;
		helpHovered = false;
		if (restoreFocus) button.focus({ preventScroll: true });
	}
	function position() {
		if (!open) return;
		const rect = button.getBoundingClientRect();
		const viewport = window.visualViewport;
		const leftEdge = (viewport?.offsetLeft ?? 0) + 16;
		const topEdge = (viewport?.offsetTop ?? 0) + 16;
		const width = Math.min(viewport?.width ?? window.innerWidth, document.documentElement.clientWidth);
		const height = Math.min(viewport?.height ?? window.innerHeight, document.documentElement.clientHeight);
		popover.style.maxWidth = `${Math.max(0, width - 32)}px`;
		popover.style.maxHeight = `${Math.max(0, height - 32)}px`;
		popover.style.setProperty('--help-max-height', `${Math.max(0, height - 32)}px`);
		const box = popover.getBoundingClientRect();
		const left = Math.max(leftEdge, Math.min(rect.right - box.width, leftEdge + width - 32 - box.width));
		const below = rect.bottom + 12;
		const top = below + box.height <= topEdge + height - 32 ? below : Math.max(topEdge, rect.top - box.height - 12);
		const nextLeft = `${left}px`, nextTop = `${top}px`;
		if (popover.style.left !== nextLeft || popover.style.top !== nextTop) {
			popover.style.left = nextLeft;
			popover.style.top = nextTop;
		}
	}
	function requestPosition() {
		if (open) window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
	}
	async function show(keyboard = false) {
		if (!enhanced || (!visible && !fullscreen)) return;
		clearDelay(); clearHideDelay();
		popover.showPopover();
		open = true;
		await tick();
		requestPosition();
		if (keyboard) closeButton.focus({ preventScroll: true });
	}
	function toggleHelp(event: MouseEvent) {
		if (open) close();
		else {
			manual = true;
			void show(event.detail === 0);
		}
	}
	function schedule() {
		clearDelay(); clearHideDelay();
		if (manual || !enhanced || !visible || modelInput.active || touchInput || guidance?.snapshot.interacted) return;
		if (modelInput.hovered) {
			if (!open) delay = setTimeout(() => { void show(); }, 600);
		} else if (open && !helpHovered && !buttonHovered && !popover.contains(document.activeElement)) {
			hideDelay = setTimeout(() => close(), 350);
		}
	}

	onMount(() => {
		guidance = getInteractionGuidance();
		touchInput = window.matchMedia('(pointer: coarse)').matches;
		const stopGuidance = guidance.subscribe((state) => {
			interacted = state.interacted;
			if (state.interacted) close();
		});
		const stage = root.closest<HTMLElement>('.stage')!;
		focusAnchor = root.closest('.spatial-element-hero')?.querySelector<HTMLElement>('.spatial-element-panel') ?? undefined;
		// Keep the non-modal help accessible when close-up hides the ordinary DOM layer.
		stage.appendChild(popover);
		// Measure the nearest wide panel above the hero, without relying on a host CSS class.
		const top = root.getBoundingClientRect().top;
		const header = Array.from(stage.querySelectorAll<HTMLElement>('[data-stage-panel-fallback]'))
			.filter((node) => { const rect = node.getBoundingClientRect(); return rect.width > innerWidth * 0.4 && rect.bottom <= top && rect.height > 0; })
			.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
		const measureSpacing = () => {
			if (header && !fullscreen) {
				const gap = Math.max(16, root.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 12);
				root.style.setProperty('--model-tools-gap', `${gap}px`);
			}
			requestPosition();
		};
		measureSpacing();
		const headerSize = new ResizeObserver(measureSpacing);
		if (header) headerSize.observe(header);
		const stageChanged = () => {
			enhanced = stage.dataset.stageState === 'enhanced' && !stage.hasAttribute('data-catalog-transition');
			if (!enhanced) close();
		};
		stageChanged();
		const mutation = new MutationObserver(stageChanged);
		mutation.observe(stage, { attributes: true, attributeFilter: ['data-stage-state', 'data-catalog-transition'] });
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (!visible) close();
		});
		observer.observe(root);
		const size = new ResizeObserver(requestPosition);
		size.observe(popover);
		const modelChanged = (event: Event) => {
			modelInput = (event as CustomEvent<ModelInputState>).detail;
			if (modelInput.active) close();
			schedule();
		};
		const inputChanged = (event: PointerEvent) => {
			if (!event.isTrusted) return;
			const next = event.pointerType !== 'mouse';
			if (next !== touchInput) { touchInput = next; if (next) { clearDelay(); clearHideDelay(); if (!manual) close(); } }
		};
		const buttonEnter = (event: PointerEvent) => { buttonHovered = event.pointerType === 'mouse'; schedule(); };
		const buttonLeave = () => { buttonHovered = false; schedule(); };
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && open) { event.preventDefault(); close(true); }
		};
		const stopScroll = subscribeStageScrollFrame(() => {
			if (!open) return;
			const rect = button.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > innerHeight) close();
			else requestPosition();
		}, STAGE_SCROLL_PRIORITY.stage + 1);
		stage.addEventListener(MODEL_INPUT_EVENT, modelChanged);
		button.addEventListener('pointerenter', buttonEnter);
		button.addEventListener('pointerleave', buttonLeave);
		window.addEventListener('pointerdown', inputChanged, { capture: true, passive: true });
		window.addEventListener('pointermove', inputChanged, { capture: true, passive: true });
		window.addEventListener('keydown', keydown);
		window.addEventListener('resize', measureSpacing, { passive: true });
		window.visualViewport?.addEventListener('resize', requestPosition, { passive: true });
		window.visualViewport?.addEventListener('scroll', requestPosition, { passive: true });
		return () => {
			// A queued focusout microtask must not restart the hover timer after teardown.
			enhanced = false; visible = false;
			close(); stopGuidance(); stopScroll(); mutation.disconnect(); observer.disconnect(); size.disconnect(); headerSize.disconnect();
			root.appendChild(popover);
			stage.removeEventListener(MODEL_INPUT_EVENT, modelChanged);
			button.removeEventListener('pointerenter', buttonEnter);
			button.removeEventListener('pointerleave', buttonLeave);
			window.removeEventListener('pointerdown', inputChanged, true);
			window.removeEventListener('pointermove', inputChanged, true);
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('resize', measureSpacing);
			window.visualViewport?.removeEventListener('resize', requestPosition);
			window.visualViewport?.removeEventListener('scroll', requestPosition);
		};
	});
</script>

<div bind:this={root} class="model-tools" class:enhanced style={surfaceStyle} data-spatial-element-tools>
	<div class="model-tools-buttons">
		<SpatialIconButton bind:element={button} {focusAnchor} label={messages.controls.help} onclick={toggleHelp} expanded={open} controls={id} enabled={enhanced}>
			<CircleHelp size={21} strokeWidth={1.8} aria-hidden="true" />
		</SpatialIconButton>
		<SpatialElementViewToggle enabled={enhanced} {focusAnchor} onchange={() => close()} />
	</div>
	{#if enhanced && touchInput && !interacted && !open && !fullscreen}
		<p class="touch-hint" data-spatial-element-touch-hint>{help.touchHint}</p>
	{/if}
	<div bind:this={popover} {id} popover="auto" role="dialog" tabindex="-1" aria-modal="false" aria-labelledby={`${id}-title`}
		style={surfaceStyle}
		class="interaction-help" data-spatial-element-help data-surface={theme.panelTheme.surface ?? 'glass'}
		onpointerenter={(event) => { helpHovered = event.pointerType === 'mouse'; schedule(); }}
		onpointerleave={() => { helpHovered = false; schedule(); }}
		onfocusin={clearHideDelay} onfocusout={() => { queueMicrotask(schedule); }}
		ontoggle={(event) => { open = event.newState === 'open'; if (!open) { manual = false; clearHideDelay(); } }}>
		<Panel class="interaction-help-panel" data-stage-fullscreen-visible nativeContent nativeLayout={position} visible={open} pointerReactive={false} focusReactive={false}
			shape={{ ...theme.panelShape, contentInset: 0 }} theme={theme.panelTheme}>
			<div class="help-copy">
				<div class="help-heading">
					<h2 id={`${id}-title`}>{help.title}</h2>
					<button bind:this={closeButton} type="button" class="close-help" onclick={() => close(true)}
						aria-label={messages.controls.closeHelp} title={messages.controls.closeHelp}>
						<X size={19} aria-hidden="true" />
					</button>
				</div>
				<dl>
					<div><InteractionGesture action="rotate" touch={touchInput} /><dt>{help.rotate}</dt><dd>{touchInput ? help.touchRotate : help.mouseRotate}</dd></div>
					<div><InteractionGesture action="zoom" touch={touchInput} /><dt>{help.zoom}</dt><dd>{touchInput ? help.touchZoom : help.mouseZoom}</dd></div>
					<div><InteractionGesture action="pan" touch={touchInput} /><dt>{help.pan}</dt><dd>{touchInput ? help.touchPan : help.mousePan}</dd></div>
				</dl>
				<p class="navigation-hint">
					{#if touchInput}
						{#if !fullscreen}{help.touchScrollHint}{/if}
					{:else}
						{#each help.mouseNavigationHint.split('{spacemouse}') as part, index}{#if index > 0}<a href="https://3dconnexion.com/" target="_blank" rel="noopener noreferrer">SpaceMouse</a>{/if}{part}{/each}
					{/if}
				</p>
			</div>
		</Panel>
	</div>
</div>

<style>
	.model-tools {
		grid-column: 1; grid-row: 1; align-self: start; justify-self: end; position: relative;
		margin-top: 6px; margin-inline-end: calc(var(--model-tools-gap, 32px) - var(--spatial-element-hero-column-gap));
		width: 128px; height: 40px; z-index: 6; visibility: hidden; pointer-events: none;
	}
	.model-tools.enhanced { visibility: visible; pointer-events: auto; }
	.model-tools-buttons { display: flex; gap: 8px; justify-content: flex-end; }
	.touch-hint {
		position: absolute; right: 0; top: 48px; width: max-content; max-width: min(260px, calc(100vw - 48px));
		margin: 0; padding: 8px 12px; border-radius: 10px; font-size: 12px; line-height: 1.45;
		color: var(--spatial-element-ink); pointer-events: none;
		background: color-mix(in srgb, var(--help-tint) var(--help-tint-opacity), transparent);
		backdrop-filter: blur(var(--help-blur)); box-shadow: var(--help-shadow);
	}
	.interaction-help {
		position: fixed; inset: auto; box-sizing: border-box; width: 248px;
		margin: 0; padding: 0; overflow: visible;
		border: 0; border-radius: var(--help-radius); color: var(--spatial-element-ink);
		background: transparent;
		font: inherit; font-size: 14px; line-height: 1.45; touch-action: manipulation;
	}
	.help-copy { box-sizing: border-box; padding: 12px 16px 16px; max-height: var(--help-max-height); overflow: auto; border-radius: var(--help-radius); }
	.interaction-help::backdrop { background: transparent; pointer-events: none; }
	.help-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	h2 { margin: 0; font-size: 15px; font-weight: 650; }
	.close-help {
		width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center;
		padding: 0; border: 0; border-radius: 8px; color: inherit; background: transparent; cursor: pointer;
	}
	.close-help:focus-visible { outline: 2px solid var(--spatial-element-accent); }
	dl { display: grid; gap: 8px; margin: 8px 0 0; }
	dl > div { display: grid; grid-template-columns: 48px 1fr; column-gap: 14px; align-items: center; }
	dt { font-weight: 650; }
	/* Keep complete host-localized instructions available to assistive technology. */
	dd { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.navigation-hint { margin: 16px 0 0; padding-top: 12px; border-top: 1px solid currentColor; font-size: 12px; }
	.navigation-hint a { color: var(--spatial-element-accent); text-decoration: underline; text-underline-offset: 2px; }
	.navigation-hint a:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: 3px; border-radius: 2px; }
	@media (max-width: 1100px) { .model-tools { margin-inline-end: 0; } }
</style>
