<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { CircleHelp, X, Rotate3d, ZoomIn, Move } from 'lucide-svelte';
	import { getCssPanelBoxShadow } from '@spatial-elements/core/stage/panelShadow';
	import { getInteractionGuidance, MODEL_INPUT_EVENT, type ModelInputState, type InteractionGuidance } from '@spatial-elements/core/stage/interactionGuidance';
	import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import SpatialIconButton from './SpatialIconButton.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import { useSpatialMessages } from './messagesContext.js';

	const theme = useSpatialTheme();
	const readMessages = useSpatialMessages();
	const messages = $derived(readMessages());
	const help = $derived(messages.interactionHelp);
	const id = $props.id();
	let root: HTMLDivElement;
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
	let modelInput: ModelInputState = { hovered: false, active: false };
	const surfaceStyle = $derived([
		`--help-tint: ${typeof theme.panelTheme.tint === 'number' ? '#' + theme.panelTheme.tint.toString(16).padStart(6, '0') : theme.panelTheme.tint ?? '#ffffff'}`,
		`--help-tint-opacity: ${(theme.panelTheme.tintOpacity ?? 0.65) * 100}%`,
		`--help-blur: ${Math.min(100, Math.max(0, theme.panelTheme.backdropBlur ?? 8))}px`,
		`--help-shadow: ${getCssPanelBoxShadow(theme.panelTheme.shadowIntensity ?? 0.2)}`,
		`--help-radius: ${theme.panelShape.radius}px`
	].join(';'));

	function clearDelay() { clearTimeout(delay); delay = undefined; }
	function close(returnFocus = false) {
		clearDelay();
		if (!open) return;
		const restoreFocus = returnFocus && popover.contains(document.activeElement);
		popover.hidePopover();
		open = false;
		if (restoreFocus) button.focus({ preventScroll: true });
	}
	function position() {
		if (!open) return;
		const rect = button.getBoundingClientRect();
		const viewport = window.visualViewport;
		const leftEdge = (viewport?.offsetLeft ?? 0) + 16;
		const topEdge = (viewport?.offsetTop ?? 0) + 16;
		const width = viewport?.width ?? window.innerWidth;
		const height = viewport?.height ?? window.innerHeight;
		popover.style.maxWidth = `${Math.max(0, width - 32)}px`;
		popover.style.maxHeight = `${Math.max(0, height - 32)}px`;
		const box = popover.getBoundingClientRect();
		const left = Math.max(leftEdge, Math.min(rect.right - box.width, leftEdge + width - 32 - box.width));
		const below = rect.bottom + 12;
		const top = below + box.height <= topEdge + height - 32 ? below : Math.max(topEdge, rect.top - box.height - 12);
		popover.style.left = `${left}px`;
		popover.style.top = `${top}px`;
	}
	async function show(keyboard = false) {
		if (!enhanced || !visible) return;
		clearDelay();
		popover.showPopover();
		open = true;
		await tick();
		position();
		if (keyboard) closeButton.focus({ preventScroll: true });
	}
	function toggleHelp(event: MouseEvent) {
		if (open) close();
		else {
			guidance?.claimPrompt();
			void show(event.detail === 0);
		}
	}
	function schedule() {
		clearDelay();
		if (!enhanced || !visible || !modelInput.hovered || modelInput.active || touchInput ||
			guidance?.snapshot.prompted || guidance?.snapshot.interacted) return;
		delay = setTimeout(() => {
			if (modelInput.hovered && !modelInput.active && enhanced && visible && guidance?.claimPrompt()) void show();
		}, 600);
	}

	onMount(() => {
		guidance = getInteractionGuidance();
		touchInput = window.matchMedia('(pointer: coarse)').matches;
		const stopGuidance = guidance.subscribe((state) => {
			interacted = state.interacted;
			if (state.interacted) close();
		});
		const stage = root.closest<HTMLElement>('.stage')!;
		// Keep the non-modal help accessible when close-up hides the ordinary DOM layer.
		stage.appendChild(popover);
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
		const size = new ResizeObserver(position);
		size.observe(popover);
		const modelChanged = (event: Event) => {
			modelInput = (event as CustomEvent<ModelInputState>).detail;
			if (modelInput.active) close();
			schedule();
		};
		const inputChanged = (event: PointerEvent) => {
			if (!event.isTrusted) return;
			const next = event.pointerType !== 'mouse';
			if (next !== touchInput) { touchInput = next; if (next) clearDelay(); }
		};
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && open) { event.preventDefault(); close(true); }
		};
		const stopScroll = subscribeStageScrollFrame(() => {
			if (!open) return;
			const rect = button.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > innerHeight) close();
			else position();
		}, STAGE_SCROLL_PRIORITY.stage + 1);
		stage.addEventListener(MODEL_INPUT_EVENT, modelChanged);
		window.addEventListener('pointerdown', inputChanged, { capture: true, passive: true });
		window.addEventListener('pointermove', inputChanged, { capture: true, passive: true });
		window.addEventListener('keydown', keydown);
		window.addEventListener('resize', position, { passive: true });
		window.visualViewport?.addEventListener('resize', position, { passive: true });
		window.visualViewport?.addEventListener('scroll', position, { passive: true });
		return () => {
			close(); stopGuidance(); stopScroll(); mutation.disconnect(); observer.disconnect(); size.disconnect();
			root.appendChild(popover);
			stage.removeEventListener(MODEL_INPUT_EVENT, modelChanged);
			window.removeEventListener('pointerdown', inputChanged, true);
			window.removeEventListener('pointermove', inputChanged, true);
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('resize', position);
			window.visualViewport?.removeEventListener('resize', position);
			window.visualViewport?.removeEventListener('scroll', position);
		};
	});
</script>

<div bind:this={root} class="model-tools" class:enhanced style={surfaceStyle} data-spatial-element-tools>
	<div class="model-tools-buttons">
		<SpatialIconButton bind:element={button} label={messages.controls.help} onclick={toggleHelp} expanded={open} controls={id} enabled={enhanced}>
			<CircleHelp size={21} strokeWidth={1.8} aria-hidden="true" />
		</SpatialIconButton>
	</div>
	{#if enhanced && touchInput && !interacted && !open}
		<p class="touch-hint" data-spatial-element-touch-hint>{help.touchHint}</p>
	{/if}
	<div bind:this={popover} {id} popover="auto" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}
		style={surfaceStyle}
		class="interaction-help" data-spatial-element-help data-surface={theme.panelTheme.surface ?? 'glass'}
		ontoggle={(event) => { open = event.newState === 'open'; }}>
		<div class="help-heading">
			<h2 id={`${id}-title`}>{help.title}</h2>
			<button bind:this={closeButton} type="button" class="close-help" onclick={() => close(true)}
				aria-label={messages.controls.closeHelp} title={messages.controls.closeHelp}>
				<X size={19} aria-hidden="true" />
			</button>
		</div>
		<dl>
			<div><Rotate3d size={20} aria-hidden="true" /><dt>{help.rotate}</dt><dd>{touchInput ? help.touchRotate : help.mouseRotate}</dd></div>
			<div><ZoomIn size={20} aria-hidden="true" /><dt>{help.zoom}</dt><dd>{touchInput ? help.touchZoom : help.mouseZoom}</dd></div>
			<div><Move size={20} aria-hidden="true" /><dt>{help.pan}</dt><dd>{touchInput ? help.touchPan : help.mousePan}</dd></div>
		</dl>
		{#if touchInput}<p class="scroll-hint">{help.touchScrollHint}</p>{/if}
	</div>
</div>

<style>
	.model-tools {
		grid-column: 1; grid-row: 1; align-self: start; justify-self: end; position: relative;
		margin-top: 6px; margin-inline-end: calc(16px - var(--spatial-element-hero-column-gap));
		width: 40px; height: 40px; z-index: 6; visibility: hidden; pointer-events: none;
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
		position: fixed; inset: auto; box-sizing: border-box; width: 300px;
		margin: 0; padding: 12px 16px 16px; overflow: auto;
		border: 0; border-radius: var(--help-radius); color: var(--spatial-element-ink);
		background: color-mix(in srgb, var(--help-tint) var(--help-tint-opacity), transparent);
		box-shadow: var(--help-shadow); backdrop-filter: blur(var(--help-blur));
		font: inherit; font-size: 14px; line-height: 1.45; touch-action: manipulation;
	}
	.interaction-help[data-surface='solid'] { backdrop-filter: none; }
	.interaction-help[data-surface='glass'] {
		background-image: linear-gradient(145deg, rgb(255 255 255 / 0.08), transparent 42%);
	}
	.interaction-help::backdrop { background: transparent; pointer-events: none; }
	.help-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	h2 { margin: 0; font-size: 15px; font-weight: 650; }
	.close-help {
		width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center;
		padding: 0; border: 0; border-radius: 8px; color: inherit; background: transparent; cursor: pointer;
	}
	.close-help:focus-visible { outline: 2px solid var(--spatial-element-accent); }
	dl { display: grid; gap: 14px; margin: 10px 0 0; }
	dl > div { display: grid; grid-template-columns: 24px 1fr; column-gap: 10px; }
	dl :global(svg) { grid-row: span 2; margin-top: 2px; }
	dt { font-weight: 650; }
	dd { grid-column: 2; margin: 2px 0 0; color: var(--spatial-element-body); font-size: 13px; }
	.scroll-hint { margin: 16px 0 0; padding-top: 12px; border-top: 1px solid currentColor; font-size: 12px; }
	@media (max-width: 1100px) { .model-tools { margin-inline-end: 0; } }
</style>
