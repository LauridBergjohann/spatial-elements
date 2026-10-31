import { describe, expect, it } from 'vitest';
import { resolveDetailGestureOwner, resolveSpatialElementMedia, spatialYoutubeEmbedUrl } from './spatialElementMedia.js';

describe('detail media and free-space input', () => {
	it('provides one first model view without changing the authored media or colliding with image ids', () => {
		const image = { id: 'model', kind: 'image' as const, src: '/example.png', label: 'Image', alt: 'Example' };
		const input = [image];
		expect(resolveSpatialElementMedia(input)).toEqual([{ id: '_model', kind: 'minimap', label: '3D view' }, image]);
		expect(input).toEqual([image]);
		const model = { id: 'front', kind: 'minimap' as const, label: 'Front' };
		expect(resolveSpatialElementMedia([image, model, { ...model, id: 'extra' }])).toEqual([model, image]);
		expect(resolveSpatialElementMedia([])[0].kind).toBe('minimap');
	});
	it('limits embeds to a video id on the privacy-enhanced player origin', () => {
		expect(spatialYoutubeEmbedUrl('aB1_2-3cdEf')).toBe('https://www.youtube-nocookie.com/embed/aB1_2-3cdEf?autoplay=0&rel=0');
		for (const id of ['https://example.org', 'bad/id', 'aB1_2-3cdEf?autoplay=1', '', '<iframe>']) {
			expect(spatialYoutubeEmbedUrl(id)).toBeUndefined();
		}
	});
	it('gives controls priority and scrolls every free non-model media area', () => {
		const base = { media: 'minimap' as const, split: true, paneHidden: false,
			clientX: 100, paneLeft: 1208, uiTarget: false, modelHit: false };
		expect(resolveDetailGestureOwner(base)).toBe('model');
		expect(resolveDetailGestureOwner({ ...base, clientX: 1500 })).toBe('document');
		expect(resolveDetailGestureOwner({ ...base, clientX: 1500, paneHidden: true })).toBe('model');
		expect(resolveDetailGestureOwner({ ...base, paneHidden: true, uiTarget: true })).toBe('ui');
		for (const media of ['image', 'video', 'youtube', 'drawing'] as const) {
			expect(resolveDetailGestureOwner({ ...base, media, paneHidden: true })).toBe('document');
		}
		expect(resolveDetailGestureOwner({ ...base, split: false })).toBe('document');
		expect(resolveDetailGestureOwner({ ...base, split: false, modelHit: true })).toBe('model');
	});
});
