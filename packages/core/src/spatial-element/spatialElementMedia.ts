import type { SpatialElementMediaItem } from './types.js';

/** First selectable view is always the model. Keep supplied data immutable. */
export function resolveSpatialElementMedia(items: readonly SpatialElementMediaItem[] = []): SpatialElementMediaItem[] {
	const minimap = items.find(item => item.kind === 'minimap');
	const ids = new Set(items.map(item => item.id));
	let modelId = 'model';
	while (!minimap && ids.has(modelId)) modelId = `_${modelId}`;
	return [minimap ?? { id: modelId, kind: 'minimap', label: '3D view' },
		...items.filter(item => item.kind !== 'minimap')];
}

/** A fixed origin and validated ID prevent a player entry from becoming arbitrary iframe HTML. */
export function spatialYoutubeEmbedUrl(videoId: string) {
	return /^[A-Za-z0-9_-]{11}$/.test(videoId)
		? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`
		: undefined;
}

/** Controls and player frames own their input before any free-space gesture policy. */
export function resolveDetailGestureOwner(options: {
	media: SpatialElementMediaItem['kind'];
	split: boolean;
	paneHidden: boolean;
	clientX: number;
	paneLeft: number;
	uiTarget: boolean;
	modelHit: boolean;
}): 'ui' | 'model' | 'document' {
	if (options.uiTarget) return 'ui';
	if (options.media !== 'minimap') return 'document';
	if (options.paneHidden) return 'model';
	if (options.split) return options.clientX < options.paneLeft ? 'model' : 'document';
	return options.modelHit ? 'model' : 'document';
}
