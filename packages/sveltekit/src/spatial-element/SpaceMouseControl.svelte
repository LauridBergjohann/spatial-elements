<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import SpatialIconButton from './SpatialIconButton.svelte';
	import SpaceMouseIcon from './SpaceMouseIcon.svelte';
	import { useSpatialMessages } from './messagesContext.js';

	let { focusAnchor, enabled = true }: { focusAnchor?: HTMLElement; enabled?: boolean } = $props();
	const stage = getContext<StageContext>(STAGE_CONTEXT_KEY);
	const readMessages = useSpatialMessages();
	const copy = $derived(readMessages().interactionHelp);
	const connectionState = $derived(stage.getSpaceMouseState?.() ?? 'idle');
	const connected = $derived(connectionState === 'connected');
	const connecting = $derived(connectionState === 'connecting');
	const label = $derived(
		connected
			? copy.spaceMouseConnected
			: connecting
				? copy.spaceMouseConnecting
				: copy.spaceMouseTitle
	);
	const id = $props.id();
	let dialog: HTMLDialogElement;
	let toast: HTMLDivElement;
	let failure = $state<'permission-required' | 'unavailable'>('unavailable');
	let requested = $state(false);
	let toastMessage = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function showToast(message: string) {
		toastMessage = message;
		toast.showPopover();
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.hidePopover(), 3500);
	}

	function connect() {
		dialog.close();
		toast.hidePopover();
		clearTimeout(toastTimer);
		requested = true;
		stage.setSpaceMouseEnabled?.(true);
	}
	function toggle() {
		if (connected || connecting) {
			const cancelled = connecting;
			requested = false;
			toast.hidePopover();
			stage.setSpaceMouseEnabled?.(false);
			if (cancelled) showToast(copy.spaceMouseCancelled);
		} else connect();
	}
	$effect(() => {
		if (!requested) return;
		if (connectionState === 'connected') {
			requested = false;
			showToast(copy.spaceMouseReady);
		} else if (connectionState === 'permission-required' || connectionState === 'unavailable') {
			requested = false;
			failure = connectionState;
			dialog.showModal();
		}
	});
	$effect(() => {
		if (!enabled) {
			requested = false;
			dialog?.close();
			toast?.hidePopover();
		}
	});
	onMount(() => () => {
		clearTimeout(toastTimer);
		dialog.close();
		toast.hidePopover();
	});
</script>

<SpatialIconButton
	{label}
	{focusAnchor}
	{enabled}
	pressed={connected}
	busy={connecting}
	onclick={toggle}
>
	<SpaceMouseIcon />
</SpatialIconButton>
<dialog bind:this={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
	<h2 id={`${id}-title`}>
		{failure === 'permission-required'
			? copy.spaceMousePermissionTitle
			: copy.spaceMouseUnavailableTitle}
	</h2>
	<p id={`${id}-description`}>
		{failure === 'permission-required' ? copy.spaceMousePermission : copy.spaceMouseUnavailable}
	</p>
	{#if failure === 'permission-required'}
		<p>{copy.spaceMouseDenied}</p>
	{:else}
		<p>
			<a href="https://3dconnexion.com/" target="_blank" rel="noopener noreferrer"
				>{copy.spaceMouseDiscover}</a
			>
		</p>
	{/if}
	<div class="actions">
		<button type="button" onclick={() => dialog.close()}>{copy.spaceMouseClose}</button>
		{#if failure === 'permission-required'}<button type="button" onclick={connect}
				>{copy.spaceMouseConfirm}</button
			>{/if}
	</div>
</dialog>
<div bind:this={toast} popover="manual" role="status" class="connection-toast">
	{toastMessage}
</div>

<style>
	dialog,
	.connection-toast {
		box-sizing: border-box;
		padding: 24px;
		border: 1px solid color-mix(in srgb, var(--spatial-element-ink) 15%, transparent);
		border-radius: var(--spatial-element-panel-radius, 12px);
		color: var(--spatial-element-ink);
		background: var(--ps-section-standard, var(--ps-background, #fff));
		font: inherit;
		box-shadow: 0 8px 32px #0003;
		max-width: min(440px, calc(100vw - 32px));
	}
	dialog::backdrop {
		background: #0006;
	}
	h2 {
		margin: 0 0 12px;
		font-size: 20px;
	}
	p {
		line-height: 1.5;
	}
	a {
		color: var(--spatial-element-accent);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}
	button {
		padding: 10px 16px;
		border: 1px solid currentColor;
		border-radius: var(--spatial-element-control-radius);
		background: transparent;
		color: var(--spatial-element-accent);
		font: inherit;
		cursor: pointer;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: 3px;
	}
	.connection-toast {
		position: fixed;
		inset: auto 16px 24px auto;
		margin: 0;
		padding: 12px 20px;
		pointer-events: none;
	}
</style>
