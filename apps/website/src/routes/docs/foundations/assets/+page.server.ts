import { examples } from './+page.svelte';
import { highlightCode } from '@page-sections/svelte/highlight';
export async function load() {
	return {
		highlights: await Promise.all(
			examples.map((example) => highlightCode(example.code, example.language))
		)
	};
}
