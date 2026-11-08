<script lang="ts">
 import { ContentBlock as Shared } from '@page-sections/svelte';
 import type { Snippet } from 'svelte';
 import type { HTMLAttributes } from 'svelte/elements';
 let { children, class: className = '', ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet; span?: import('@page-sections/core').ContentSpan; } = $props();
</script>
<Shared {...rest} class={['spatial-content-block', className].join(' ')}>{@render children?.()}</Shared>
