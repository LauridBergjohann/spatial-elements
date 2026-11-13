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
	const calculate = () => Fn(() => {
		const texel = controls.texel;
		const glowTexel = controls.glowTexel;
		const sampleMaskRing = (sampleTexel: typeof texel, scale = 1, samples = 8) => {
			const centerUv = uv();
			const taps = Array.from({ length: samples }, (_, i) => {
				const angle = i * Math.PI * 2 / samples;
				return mask.sample(centerUv.add(sampleTexel.mul(vec2(Math.cos(angle) * scale, Math.sin(angle) * scale)))).r;
			});
			return { average: taps.reduce((sum, tap) => sum.add(tap)).div(samples),
				max: taps.reduce((value, tap) => tslMax(value, tap)) };
		};
		// More directions smooth curved silhouettes without a blurred halo.
		const edgeNeighbor = sampleMaskRing(texel, 1, 16);
		const center = mask.sample(uv()).r;
		// Cover the partially covered inner edge instead of subtracting its MSAA
		// coverage twice (once in the model and once here), which leaves a pale seam.
		const edgeGradient = edgeNeighbor.max.mul(center.smoothstep(0.8, 1).oneMinus());
		const opacity = edgeGradient.mul(controls.strength).toVar();
		// The default crisp outline needs only sixteen neighbour samples. Explicit
		// glow themes retain their halo without paying its 24 extra taps otherwise.
		If(controls.glow.greaterThan(0), () => {
			const near = sampleMaskRing(glowTexel, 0.45).average.mul(0.6);
			const mid = sampleMaskRing(glowTexel, 0.7).average.mul(0.3);
			const far = sampleMaskRing(glowTexel).average.mul(0.1);
			opacity.addAssign(near.add(mid).add(far).mul(center.oneMinus()).mul(controls.glow));
		});
		return tslMin(opacity, 1).mul(controls.opacityScale);
	})();
	if (unconditional) return calculate();
	return Fn(() => {
		const opacity = float(0).toVar();
		// Fully covered pixels do not need any outer-edge samples.
		If(mask.sample(uv()).r.lessThan(1), () => {
			opacity.assign(calculate());
		});
		return opacity;
	})();
}
