<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import './layout.generated.css';

	type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		/** Explicit ContentBlock children; the enclosing Section owns the grid's outer padding. */
		children?: Snippet;
	};
	let { children, class: className = '', ...rest }: Props = $props();
</script>

<div {...rest} class={['spatial-content-grid', 'spatial-grid-scope', className].filter(Boolean).join(' ')}>
	{@render children?.()}
</div>

<style>
	.spatial-content-grid {
		display: grid;
		grid-template-columns: repeat(var(--spatial-grid-columns), minmax(0, 1fr));
		grid-auto-flow: row;
		gap: var(--spatial-grid-gap);
		min-width: 0;
		align-items: start;
		font-size: var(--spatial-grid-body-size);
		line-height: var(--spatial-grid-body-line-height);
	}
</style>
