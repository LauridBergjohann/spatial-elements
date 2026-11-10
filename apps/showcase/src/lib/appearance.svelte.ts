import { tick } from 'svelte';
export type ColorScheme = 'light' | 'dark';
const storageKey = 'spatial-showcase-appearance';

/** Two explicit choices; until a choice is made, follow the operating system. */
export function createAppearance() {
	let colorScheme = $state<ColorScheme>('light');
	let ready = $state(false);
	let explicit = false;
	function apply(scheme: ColorScheme) {
		colorScheme = scheme;
		document.documentElement.dataset.theme = scheme;
		document.documentElement.style.colorScheme = scheme;
	}
	return {
		get colorScheme() {
			return colorScheme;
		},
		get ready() {
			return ready;
		},
		select(scheme: ColorScheme) {
			explicit = true;
			try {
				sessionStorage.setItem(storageKey, scheme);
			} catch {
				/* Storage is optional. */
			}
			apply(scheme);
		},
		start() {
			const media = matchMedia('(prefers-color-scheme: dark)');
			let initial: ColorScheme = media.matches ? 'dark' : 'light';
			try {
				const stored = sessionStorage.getItem(storageKey);
				if (stored === 'light' || stored === 'dark') {
					initial = stored;
					explicit = true;
				}
			} catch {
				/* Follow the operating system when storage is unavailable. */
			}
			apply(initial);
			ready = true;
			const changed = () => {
				if (!explicit) apply(media.matches ? 'dark' : 'light');
			};
			media.addEventListener('change', changed);
			void tick().then(() => {
				delete document.documentElement.dataset.themePending;
			});
			return () => media.removeEventListener('change', changed);
		}
	};
}
export type Appearance = ReturnType<typeof createAppearance>;
