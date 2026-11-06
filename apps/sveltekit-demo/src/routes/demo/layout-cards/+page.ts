import { overview } from '$lib/catalog';

export function load() {
	return { items: Array.from({ length: 6 }, (_, index) => {
		const item = overview[index % overview.length];
		return {
			...item,
			itemKey: `card-${index}`,
			eyebrow: index % 2 ? '' : 'FORM STUDIES WITH A LONG DESCRIPTIVE EYEBROW',
			title: index === 0 ? 'A sculptural column with a deliberately long title to demonstrate controlled text overflow' : item.title
		};
	}) };
}
