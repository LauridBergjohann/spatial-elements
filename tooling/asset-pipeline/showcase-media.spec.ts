import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import sharp from 'sharp';
import assets from '../../apps/website/src/lib/showcase/photo-assets.json';
import manifest from './showcase-media.json';
import products from '../../apps/website/src/lib/showcase/products.json';

const staticDirectory = new URL('../../apps/website/static/', import.meta.url);

it('ships each authored product photograph as a bounded WebP with valid responsive dimensions', async () => {
	expect(assets.flatMap((product) => product.images)).toHaveLength(
		manifest.products.reduce((count, product) => count + product.images.length, 0)
	);
	for (const product of assets) {
		expect(products.some((item) => item.id === product.productId)).toBe(true);
		for (const image of product.images) {
			expect(image.alt.trim().length).toBeGreaterThan(10);
			for (const [variant, limit] of [
				[image, 1600],
				[image.small, 640]
			] as const) {
				expect(variant.src).toMatch(
					new RegExp(
						`^/assets/showcase/${product.productId}/${product.productId}-image-\\d{2}(?:-small)?\\.webp$`
					)
				);
				const buffer = readFileSync(new URL(variant.src.slice(1), staticDirectory));
				const metadata = await sharp(buffer).metadata();
				expect(metadata.format).toBe('webp');
				expect([metadata.width, metadata.height]).toEqual([variant.width, variant.height]);
				expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(limit);
				expect(buffer.byteLength).toBe(variant.bytes);
			}
			expect(image.small.width).toBeLessThanOrEqual(image.width);
			expect(image.small.height).toBeLessThanOrEqual(image.height);
		}
	}
});

it('preserves all supplied video IDs and limits media to the matching product', () => {
	const videos = Object.fromEntries(
		products.filter((product) => product.video).map((product) => [product.id, product.video!.id])
	);
	expect(videos).toEqual({
		'logitech-brio-500': 'bku8De9oTJQ',
		'logitech-ergo-k860': 'q-ZUIAgEda4',
		'logitech-z407': 'YkiZbeBUJCQ',
		winkelschluessel: 'ODDS07HlGqc',
		'zyklop-speed': 'zVjRUIlklmA'
	});
	expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
	for (const product of assets) {
		expect(new Set(product.images.map((image) => image.id)).size).toBe(product.images.length);
	}
});
