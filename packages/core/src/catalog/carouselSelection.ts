export function carouselKey(item: { id: string; itemKey?: string }) {
	return item.itemKey ?? item.id;
}

export function resolveCarouselSelection(keys: readonly string[], requested?: string) {
	if (new Set(keys).size !== keys.length) throw new Error('Carousel item keys must be unique');
	return requested !== undefined && keys.includes(requested) ? requested : keys[0];
}

export function stepCarouselSelection(
	keys: readonly string[],
	current: string | undefined,
	step: number
) {
	if (!keys.length) return undefined;
	const index = Math.max(0, keys.indexOf(current ?? ''));
	return keys[Math.max(0, Math.min(keys.length - 1, index + step))];
}
