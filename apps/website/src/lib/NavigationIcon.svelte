<script lang="ts">
	import Layers from 'lucide-svelte/icons/layers';
	import Panels from 'lucide-svelte/icons/panels-top-left';
	import Blocks from 'lucide-svelte/icons/blocks';
	import Settings from 'lucide-svelte/icons/settings';
	import Book from 'lucide-svelte/icons/book-open';
	import Briefcase from 'lucide-svelte/icons/briefcase';
	import File from 'lucide-svelte/icons/file-text';
	import Palette from 'lucide-svelte/icons/palette';
	import Code from 'lucide-svelte/icons/code';
	import Download from 'lucide-svelte/icons/download';
	let { name }: { name?: string } = $props();
	const icons = {
		layers: Layers,
		panels: Panels,
		blocks: Blocks,
		settings: Settings,
		book: Book,
		briefcase: Briefcase,
		file: File,
		palette: Palette,
		code: Code,
		download: Download
	};
	const Icon = $derived(icons[name as keyof typeof icons] ?? File);
</script>

<Icon size={20} aria-hidden="true" />
