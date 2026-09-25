import type { RenderTarget } from 'three/webgpu';

/** Three r185 diagnostic adapter only; never used for rendering or ownership. */
export function gaussianTargets(effect: unknown): RenderTarget[] {
	const node = effect as { _horizontalRT?: RenderTarget; _verticalRT?: RenderTarget } | undefined;
	return [node?._horizontalRT, node?._verticalRT].filter((target): target is RenderTarget =>
		Boolean(target)
	);
}

export function describeRenderTargets(groups: Readonly<Record<string, readonly RenderTarget[]>>) {
	const seen = new Set<RenderTarget>();
	const targets = Object.entries(groups).flatMap(([owner, values]) =>
		values.flatMap((target) => {
			if (seen.has(target)) return [];
			seen.add(target);
			return [
				{
					owner,
					id: target.texture.uuid,
					width: target.width,
					height: target.height,
					samples: target.samples,
					depth: target.depthBuffer,
					colorAttachments: target.textures.length,
					colorType: target.texture.type
				}
			];
		})
	);
	return { liveTargets: targets.length, targets };
}
