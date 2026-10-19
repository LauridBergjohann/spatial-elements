import * as THREE from 'three/webgpu';
import { Fn, float, If, max as tslMax, min as tslMin, uniform, uv, vec2 } from 'three/tsl';
import { getMeshMaterials } from './stageSceneUtils.js';
import type { StageInteractionTheme } from './stageTypes.js';

export function isOutlineMesh(mesh: THREE.Mesh, theme: StageInteractionTheme) {
	if (theme.excludeMesh?.(mesh) || mesh.userData.stagePick === false || mesh.userData.stageOutline === false) return false;
	const materials = getMeshMaterials(mesh).map(material => material.name).filter(Boolean).join(' ');
	return !/(shadow|ground|floor|plane|helper|collision|collider|reflection)/i.test(`${mesh.name} ${materials}`);
}

export function createOutlineUniforms() {
	return {
		color: uniform(new THREE.Color()),
		strength: uniform(0), glow: uniform(0), opacityScale: uniform(1),
		texel: uniform(new THREE.Vector2()), glowTexel: uniform(new THREE.Vector2())
	};
}

/** Shared silhouette and outer halo for detail and catalog geometry. */
export function createOutlineOpacity(mask: THREE.TextureNode, controls: ReturnType<typeof createOutlineUniforms>, unconditional = false) {
	const calculate = () => {
		const texel = controls.texel;
		const glowTexel = controls.glowTexel;
		const sampleMaskRing = (sampleTexel: typeof texel, scale = 1) => {
			const centerUv = uv();
			const sampleX = sampleTexel.x.mul(scale);
			const sampleY = sampleTexel.y.mul(scale);
			const left = mask.sample(centerUv.sub(vec2(sampleX, 0))).r;
			const right = mask.sample(centerUv.add(vec2(sampleX, 0))).r;
			const up = mask.sample(centerUv.add(vec2(0, sampleY))).r;
			const down = mask.sample(centerUv.sub(vec2(0, sampleY))).r;
			const upLeft = mask.sample(centerUv.add(vec2(0, sampleY)).sub(vec2(sampleX, 0))).r;
			const upRight = mask.sample(centerUv.add(vec2(sampleX, sampleY))).r;
			const downLeft = mask.sample(centerUv.sub(vec2(sampleX, sampleY))).r;
			const downRight = mask.sample(centerUv.add(vec2(sampleX, 0)).sub(vec2(0, sampleY))).r;

			return {
				average: left
					.add(right)
					.add(up)
					.add(down)
					.add(upLeft)
					.add(upRight)
					.add(downLeft)
					.add(downRight)
					.div(8),
				max: tslMax(
					tslMax(tslMax(left, right), tslMax(up, down)),
					tslMax(tslMax(upLeft, upRight), tslMax(downLeft, downRight))
				),
				min: tslMin(
					tslMin(tslMin(left, right), tslMin(up, down)),
					tslMin(tslMin(upLeft, upRight), tslMin(downLeft, downRight))
				)
			};
		};
		const edgeNeighbor = sampleMaskRing(texel);
		const glowNearNeighbor = sampleMaskRing(glowTexel, 0.45);
		const glowMidNeighbor = sampleMaskRing(glowTexel, 0.7);
		const glowFarNeighbor = sampleMaskRing(glowTexel);
		const center = mask.sample(uv()).r;
		const outside = center.oneMinus();
		const edgeGradient = edgeNeighbor.max.sub(center).max(0);
		const core = edgeGradient.mul(controls.strength);
		// Average neighbouring coverage, rather than dilating a solid band. Keep the
		// halo outside the spatialElement so it cannot be mistaken for painted geometry.
		const glowNear = glowNearNeighbor.average
			.mul(outside)
			.mul(controls.glow.mul(0.6));
		const glowMid = glowMidNeighbor.average
			.mul(outside)
			.mul(controls.glow.mul(0.3));
		const glowFar = glowFarNeighbor.average
			.mul(outside)
			.mul(controls.glow.mul(0.1));
		const opacity = tslMin(core.add(glowNear).add(glowMid).add(glowFar), 1).mul(
			controls.opacityScale
		);

		return opacity;
	};
	if (unconditional) return calculate();
	return Fn(() => {
		const opacity = float(0).toVar();
		// A fully covered pixel has zero outer halo. Skip all 32 neighbour taps there.
		If(mask.sample(uv()).r.lessThan(1), () => {
			opacity.assign(calculate());
		});
		return opacity;
	})();
}
