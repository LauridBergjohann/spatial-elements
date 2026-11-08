<script lang="ts">
 import { ContentGrid as Shared } from '@page-sections/svelte';
 import type { Snippet } from 'svelte';
 import type { HTMLAttributes } from 'svelte/elements';
 let { children, class: className = '', ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet;  } = $props();
</script>
<Shared {...rest} class={['spatial-content-grid spatial-grid-scope ps-grid-scope', className].join(' ')}>{@render children?.()}</Shared>
