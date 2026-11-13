<script lang="ts">
	import { CodeBlock, type HighlightedCode } from '@page-sections/svelte';
	let {
		code,
		language = 'svelte',
		filename = 'Example.svelte'
	}: { code: string; language?: string; filename?: string } = $props();
	let highlighted = $state<HighlightedCode>();
	$effect(() => {
		const source = code,
			lang = language;
		let active = true;
		import('./clientHighlight')
			.then((module) => module.highlight(source, lang))
			.then((result) => {
				if (active) highlighted = result;
			})
			.catch(() => {
				/* Plain source remains readable when the optional enhancement cannot load. */
			});
		return () => {
			active = false;
		};
	});
</script>

<CodeBlock {code} {language} {filename} {highlighted} />
