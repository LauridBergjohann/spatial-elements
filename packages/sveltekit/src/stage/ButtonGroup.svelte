<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { StagePanelShape, StagePanelTheme } from '@spatial-elements/core/stage/panelContext';
	import type { CatalogTransitionGroup } from '@spatial-elements/core/catalog/catalogPresentation';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import Panel from './Panel.svelte';
	import type { ButtonGroupItem } from './buttonGroup.js';
	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onchange'> & {
		items: readonly ButtonGroupItem[];
		/** Controlled selection. Omit when no button is selected. */
		value?: string;
		onchange?: (value: string) => void;
		label: string;
		content?: Snippet<[ButtonGroupItem]>;
		iconOnly?: boolean;
		disabled?: boolean;
		visible?: boolean;
		shape: StagePanelShape;
		theme?: StagePanelTheme;
		focusReactive?: boolean | 'top-right';
		focusAnchor?: HTMLElement;
		transitionGroup?: CatalogTransitionGroup;
	};
	let {
		items,
		value,
		onchange,
		label,
		content,
		iconOnly = false,
		disabled = false,
		visible = true,
		shape,
		theme,
		focusReactive = false,
		focusAnchor,
		transitionGroup,
		class: className = '',
		...rest
	}: Props = $props();
	let group: HTMLDivElement;
	let measuredWidth = $state<number>();
	const radius = $derived(Math.min(12, Math.max(0, shape.radius)));
	const width = $derived(
		iconOnly ? `${items.length * 40}px` : measuredWidth ? `${measuredWidth}px` : 'max-content'
	);
	onMount(() => {
		const observer = new ResizeObserver(() => {
			measuredWidth = group.offsetWidth;
		});
		observer.observe(group);
		return () => observer.disconnect();
	});
</script>

<div class="button-group-frame" style:width>
	<Panel
		class="button-group-panel"
		shape={{ ...shape, radius, contentInset: 0 }}
		{theme}
		pointerReactive={false}
		{focusReactive}
		{focusAnchor}
		{transitionGroup}
	>
		<div
			{...rest}
			bind:this={group}
			role="group"
			aria-label={label}
			class={['button-group', className]}
			use:mouseHover
			style:--control-radius={`${radius}px`}
			style:visibility={visible ? 'visible' : 'hidden'}
		>
			{#each items as item (item.value)}
				<button
					type="button"
					class:icon-only={iconOnly}
					disabled={disabled || item.disabled}
					aria-label={item.label}
					title={item.tooltip ?? item.label}
					aria-pressed={item.value === value}
					style:--selection={`${Math.min(1, Math.max(0, item.selection ?? (item.value === value ? 1 : 0))) * 8}%`}
					onclick={() => onchange?.(item.value)}
				>
					{#if content}{@render content(item)}{:else}{item.label}{/if}
				</button>
			{/each}
		</div>
	</Panel>
</div>

<style>
	.button-group-frame {
		height: 40px;
		flex: none;
	}
	.button-group-frame :global(.button-group-panel) {
		width: 100%;
		height: 40px;
	}
	.button-group {
		display: flex;
		width: max-content;
		height: 40px;
		border-radius: var(--control-radius);
	}
	button {
		box-sizing: border-box;
		display: grid;
		place-items: center;
		min-width: 40px;
		height: 40px;
		padding: 0 12px;
		border: 0;
		font: inherit;
		white-space: nowrap;
		background: color-mix(
			in srgb,
			var(--spatial-element-body, currentColor) var(--selection),
			transparent
		);
		color: var(--spatial-element-ink, inherit);
		cursor: pointer;
		touch-action: manipulation;
		transition: background-color 180ms ease;
	}
	button.icon-only {
		width: 40px;
		padding: 0;
	}
	button:first-child {
		border-radius: var(--control-radius) 0 0 var(--control-radius);
	}
	button:last-child {
		border-radius: 0 var(--control-radius) var(--control-radius) 0;
	}
	button:only-child {
		border-radius: var(--control-radius);
	}
	button + button {
		border-left: 1px solid
			color-mix(in srgb, var(--spatial-element-body, currentColor) 12%, transparent);
	}
	.button-group:global([data-mouse-hover]) button:enabled:hover {
		background: color-mix(in srgb, var(--spatial-element-body, currentColor) 8%, transparent);
	}
	button:focus-visible {
		outline: 2px solid var(--spatial-element-accent, currentColor);
		outline-offset: -2px;
	}
	button:disabled {
		cursor: default;
		opacity: 0.45;
	}
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
