// A real data request lets the production fixture exercise slow, failed and
// cancelled navigation without replacing SvelteKit's routing implementation.
export function load() {
	return { serverDataReady: true };
}
