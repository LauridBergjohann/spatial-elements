import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import sharp from 'sharp';
import geometry from './showcase-geometry-report.json';
import posters from './showcase-poster-report.json';
import presentation from '../../apps/website/src/lib/showcase/presentation.json';

it('keeps rendered fallbacks synchronized with their geometry, frame and authored detail pose', async () => {
	expect(posters.map((poster) => poster.id).sort()).toEqual(
		geometry.map((asset) => asset.spatialElementId).sort()
	);
	for (const asset of geometry) {
		const poster = posters.find((item) => item.id === asset.spatialElementId)!;
		expect(poster.high).toBe(asset.pair.high.revision);
		expect(poster.low).toBe(asset.pair.low.revision);
		expect(poster.frame).toEqual({
			assetToFrame: asset.pair.assetToFrame,
			bounds: asset.pair.bounds
		});
		expect(poster.pose).toEqual(presentation[asset.spatialElementId as keyof typeof presentation]);
		const bytes = readFileSync(
			new URL(`../../apps/website/static${asset.poster.src}`, import.meta.url)
		);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(poster.sha256);
		expect(bytes.length).toBe(poster.posterBytes);
		const metadata = await sharp(bytes).metadata();
		expect(metadata.format).toBe('webp');
		expect([metadata.width, metadata.height]).toEqual([1024, 1024]);
		expect(metadata.hasAlpha).toBe(true);
	}
});
