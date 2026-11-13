import { productSegment, productHref } from './segments';
import documents from './products.json' with { type: 'json' };
import photoAssets from './photo-assets.json' with { type: 'json' };

export const manufacturers = {
	wera: { name: 'Wera', href: 'https://www.wera.de/', domain: 'wera.de' },
	watches: { name: 'Rolex', href: 'https://www.rolex.com/', domain: 'rolex.com' },
	logitech: { name: 'Logitech', href: 'https://www.logitech.com/', domain: 'logitech.com' },
	item: { name: 'item', href: 'https://www.item24.com/', domain: 'item24.com' }
} as const;

export const showcaseProducts = documents.map((document) => {
	const manufacturer = manufacturers[document.manufacturer as keyof typeof manufacturers];
	const images = photoAssets.find((asset) => asset.productId === document.id)?.images ?? [];
	const photos = images.filter((image) => image.role === 'gallery');
	return {
		...document,
		segment: productSegment(document.manufacturer),
		href: productHref({ id: document.id, manufacturerId: document.manufacturer }),
		manufacturer,
		manufacturerId: document.manufacturer,
		photos,
		video: document.video
			? {
					...document.video,
					href: `https://www.youtube.com/watch?v=${document.video.id}`,
					poster: images.find((image) => image.role === 'video-poster') ?? photos[0]
				}
			: undefined
	};
});

export type ShowcaseProduct = (typeof showcaseProducts)[number];
