import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { LiquidGlassPanel } from './LiquidGlassPanel.js';
import { PANEL_SHADOW_RECIPE, resolvePanelShadowStrength } from './panelShadow.js';

function getBackdropGeometry(panel: LiquidGlassPanel) {
	const backdrop = panel.group.children.find(
		(child): child is THREE.Mesh =>
			child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicNodeMaterial
	);
	if (!backdrop) throw new Error('Liquid-glass backdrop mesh is missing');
	return backdrop.geometry;
}

describe('LiquidGlassPanel backdrop projection', () => {
	it('keeps backdrop buffers when rounded corner topology changes and restores the original mesh', () => {
		const texture = new THREE.Texture();
		const panel = new LiquidGlassPanel(texture, { width: 120, height: 120, radius: 12 });
		const geometry = getBackdropGeometry(panel);
		const position = geometry.getAttribute('position');
		const normal = geometry.getAttribute('normal');
		const index = geometry.index!;
		const originalPositions = position.array.slice();
		const originalIndices = index.array.slice();
		const counts = new Set([geometry.drawRange.count]);
		let disposals = 0;
		geometry.addEventListener('dispose', () => disposals++);
		for (const size of [140, 180, 230, 120]) {
			panel.setVisualSize(size, size, 12);
			expect(geometry.getAttribute('position')).toBe(position);
			expect(geometry.getAttribute('normal')).toBe(normal);
			expect(geometry.index).toBe(index);
			counts.add(geometry.drawRange.count);
			expect(geometry.drawRange.count).toBeLessThanOrEqual(index.count);
			expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(size);
		}
		expect(counts.size).toBeGreaterThan(1);
		expect(disposals).toBe(0);
		expect(position.array).toEqual(originalPositions);
		expect(index.array).toEqual(originalIndices);
		panel.dispose();
		expect(disposals).toBe(1);
		texture.dispose();
	});
	it('retains animated shadow buffers and updates their bounds', () => {
		const texture = new THREE.Texture();
		const panel = new LiquidGlassPanel(texture, { width: 120, height: 120, radius: 12 });
		const shadows = panel.group.children.slice(0, PANEL_SHADOW_RECIPE.length) as THREE.Mesh[];
		const positions = shadows.map((mesh) => mesh.geometry.getAttribute('position'));
		const indices = shadows.map((mesh) => mesh.geometry.index);
		for (const size of [140, 180, 230, 120]) {
			panel.setVisualSize(size, size, 12);
			shadows.forEach((mesh, index) => {
				expect(mesh.geometry.getAttribute('position')).toBe(positions[index]);
				expect(mesh.geometry.index).toBe(indices[index]);
				expect(mesh.geometry.boundingBox!.max.x - mesh.geometry.boundingBox!.min.x).toBeGreaterThan(
					size
				);
			});
		}
		panel.dispose();
		texture.dispose();
	});
	it('maps the shared two-layer shadow recipe to the WebGPU surface', () => {
		const texture = new THREE.Texture();
		const shadowIntensity = 0.65;
		const shadowStrength = resolvePanelShadowStrength(shadowIntensity);
		const panel = new LiquidGlassPanel(texture, { shadowIntensity });
		const shadows = panel.group.children.slice(0, PANEL_SHADOW_RECIPE.length) as THREE.Mesh[];

		expect(shadows).toHaveLength(2);
		shadows.forEach((shadow, index) => {
			const recipe = PANEL_SHADOW_RECIPE[index];
			const material = shadow.material as THREE.MeshBasicMaterial;
			expect(shadow.position.y).toBe(-recipe.offsetY);
			expect(material.color.getHex()).toBe(0x000000);
			expect(material.opacity).toBeCloseTo(shadowStrength * recipe.alphaScale * 0.5);
		});

		panel.dispose();
		texture.dispose();
	});

	it('keeps projection on the GPU without allocating or uploading a UV attribute', () => {
		const texture = new THREE.Texture();
		const panel = new LiquidGlassPanel(texture, {
			width: 360,
			height: 230,
			radius: 42,
			refraction: 12
		});

		expect(getBackdropGeometry(panel).getAttribute('uv')).toBeUndefined();
		panel.setVisualSize(420, 180, 36);
		expect(getBackdropGeometry(panel).getAttribute('uv')).toBeUndefined();

		panel.dispose();
		texture.dispose();
	});
});
