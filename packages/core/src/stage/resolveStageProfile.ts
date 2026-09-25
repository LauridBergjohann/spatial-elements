import { resolveProductLodPair } from '../catalog/productLodPair.js';
import { DEFAULT_BACKGROUND, DEFAULT_GLB, DEFAULT_HDR } from './stageConstants.js';
import type { StageExperienceOptions } from './stageTypes.js';

/** Resolve view configuration once, independently of replaceable DOM hosts. */
export function resolveStageProfile(
	options: StageExperienceOptions,
	previous: { glb: string; hdr: string } = { glb: DEFAULT_GLB, hdr: DEFAULT_HDR }
) {
	const glb = options.glb ?? previous.glb;
	const lodPair = resolveProductLodPair(glb, options.lodPair);
	const model = Object.freeze({
		...options.model,
		...(options.model?.rotation && { rotation: Object.freeze({ ...options.model.rotation }) }),
		...(options.model?.excludeMeshes && {
			excludeMeshes: Object.freeze([...options.model.excludeMeshes])
		}),
		...(options.model?.materialOverrides && {
			materialOverrides: Object.freeze(
				Object.fromEntries(
					Object.entries(options.model.materialOverrides).map(([name, value]) => [
						name,
						Object.freeze({ ...value })
					])
				)
			)
		})
	});
	return Object.freeze({
		glb,
		hdr: options.hdr ?? previous.hdr,
		lodPair,
		model,
		camera: Object.freeze({ ...options.camera }),
		background: Object.freeze({ ...DEFAULT_BACKGROUND, ...options.background }),
		modelKey: JSON.stringify(lodPair ? [glb, model, lodPair] : [glb, model])
	});
}
