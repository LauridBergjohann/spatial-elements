<script lang="ts">
	let { action, touch = false }: { action: 'rotate' | 'zoom' | 'pan'; touch?: boolean } = $props();
</script>

<!-- Decorative diagrams; the adjacent definition list supplies localized instructions. -->
<svg width="48" height="44" viewBox="0 0 48 44" fill="none" stroke="currentColor" stroke-width="1.6"
	stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-gesture={action} data-input={touch ? 'touch' : 'mouse'}>
	{#if !touch}
		{#if action === 'rotate'}
			<path class="input-highlight" d="M24 5 C17.4 5 13 9.8 13 16 V19 H24 Z" />
		{:else if action === 'pan'}
			<path class="input-highlight" d="M24 5 C30.6 5 35 9.8 35 16 V19 H24 Z" />
		{/if}
		<rect x="13" y="5" width="22" height="34" rx="11" />
		<path d="M13 19 H35 M24 5 V10 M24 16 V19" />
		<rect x="22" y="10" width="4" height="7" rx="2" class:input-highlight={action === 'zoom'} />
		{#if action === 'zoom'}
			<path class="motion" d="M41 10 V32 M38 13 L41 10 L44 13 M38 29 L41 32 L44 29" />
		{/if}
	{:else if action === 'zoom'}
		<!-- Two fingertips moving apart/together. -->
		<path d="M6 34 L14 26 Q17 23 20 26 Q23 29 20 32 L13 39 M28 13 L35 6 Q38 3 41 6 Q44 9 41 12 L33 20" />
		<path class="motion" d="M17 22 L7 22 L7 12 M7 22 L17 12 M28 24 L39 24 L39 35 M39 24 L29 34" />
	{:else}
		<!-- A raised index finger, or two raised fingers for panning. -->
		{#if action === 'pan'}
			<path d="M13 28 V15 A3 3 0 0 1 19 15 V24 V12 A3 3 0 0 1 25 12 V24 L28 22 Q30 21 32 23 L36 27 V32 Q36 36 32 40 H19 L10 30 Q8 27 10 25 Q12 23 15 26 L19 30" />
		{:else}
			<path d="M19 30 V14 A3 3 0 0 1 25 14 V24 L28 22 Q30 21 32 23 L36 27 V32 Q36 36 32 40 H19 L10 30 Q8 27 10 25 Q12 23 15 26 Z" />
		{/if}
		<path class="motion" d="M10 6 H35 M14 2 L10 6 L14 10 M31 2 L35 6 L31 10" />
	{/if}
</svg>

<style>
	svg { display: block; flex: none; }
	.input-highlight { fill: var(--spatial-element-accent); stroke: var(--spatial-element-accent); }
	.motion { stroke: var(--spatial-element-accent); }
</style>
