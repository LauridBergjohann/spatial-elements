import { tick } from 'svelte';

export type AppearancePreference = 'light' | 'dark' | 'system';
export function createAppearance(storageKey: string) {
	let preference = $state<AppearancePreference>('system');
	let systemDark = $state(false);
	const scheme = () => (preference === 'system' ? (systemDark ? 'dark' : 'light') : preference);
	function apply() {
		document.documentElement.dataset.theme = scheme();
		document.documentElement.style.colorScheme = scheme();
	}
	return {
		get preference() {
			return preference;
		},
		get colorScheme() {
			return scheme();
		},
		select(value: string) {
			if (value !== 'light' && value !== 'dark' && value !== 'system') return;
			preference = value;
			try {
				if (value === 'system') sessionStorage.removeItem(storageKey);
				else sessionStorage.setItem(storageKey, value);
			} catch {
				/* A blocked store must not prevent theme changes. */
			}
			apply();
		},
		start() {
			const media = window.matchMedia('(prefers-color-scheme: dark)');
			systemDark = media.matches;
			try {
				const stored = sessionStorage.getItem(storageKey);
				if (stored === 'light' || stored === 'dark') preference = stored;
			} catch {
				/* Fall back to system preference. */
			}
			const changed = () => {
				systemDark = media.matches;
				apply();
			};
			media.addEventListener('change', changed);
			apply();
			void tick().then(() => {
				delete document.documentElement.dataset.themePending;
			});
			return () => media.removeEventListener('change', changed);
		}
	};
}
export type Appearance = ReturnType<typeof createAppearance>;
