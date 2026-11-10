import { overview } from '$lib/catalog';
import type { PageLoad } from './$types';
export const load: PageLoad = ({ url }) => {
	const count = Math.min(20, Math.max(1, Number(url.searchParams.get('count')) || 5));
	return {
		list: Array.from({ length: count }, (_, index) => ({
			...overview[index % overview.length],
			itemKey: `seat-${index}`,
			title: `${overview[index % overview.length].title} ${index + 1}`,
			eyebrow:
				index === 0 && url.searchParams.has('no-eyebrow')
					? ''
					: overview[index % overview.length].eyebrow
		})),
		background: url.searchParams.has('background')
			? {
					color: 'standard' as const,
					size:
						url.searchParams.get('background') === 'full'
							? ('full' as const)
							: ('standard' as const)
				}
			: undefined,
		headline: !url.searchParams.has('no-headline'),
		carouselCustom: url.searchParams.has('custom'),
		carouselLong: url.searchParams.has('long')
	};
};
