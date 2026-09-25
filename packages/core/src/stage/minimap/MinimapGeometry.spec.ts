import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	createMinimapPanelGeometry,
	createMinimapViewportRingGeometry,
	getMinimapViewportCornerRadii,
	replaceMeshGeometry,
	updateMinimapPanelGeometry,
	updateMinimapViewportRingGeometry
} from './MinimapGeometry.js';

describe('minimap geometry', () => {
	it('retains panel buffers and winding while dimensions and corner radius change', () => {
		const geometry = createMinimapPanelGeometry(120, 120, 0);
		const position = geometry.getAttribute('position');
		const uv = geometry.getAttribute('uv');
		const indices = geometry.getIndex()!;
		for (let frame = 0; frame <= 120; frame++) {
			const width = 120 + frame;
			const height = 120 + frame * 2;
			updateMinimapPanelGeometry(geometry, width, height, frame / 2);
			expect(geometry.getAttribute('position')).toBe(position);
			expect(geometry.getAttribute('uv')).toBe(uv);
			expect(geometry.getIndex()).toBe(indices);
			expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(width);
			expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(height);
			for (let i = 0; i < indices.count; i += 3) {
				const b = indices.getX(i + 1),
					c = indices.getX(i + 2);
				expect(
					position.getX(b) * position.getY(c) - position.getY(b) * position.getX(c)
				).toBeGreaterThanOrEqual(-0.001);
			}
		}
		geometry.dispose();
	});
	it('creates finite normalized UVs for the panel composite', () => {
		const geometry = createMinimapPanelGeometry(240, 180, 24);
		const uv = geometry.getAttribute('uv');
		const position = geometry.getAttribute('position');
		const values = Array.from(uv.array);
		geometry.computeBoundingBox();
		const size = geometry.boundingBox?.getSize(new THREE.Vector3());
		let topIndex = 0;
		let bottomIndex = 0;
		for (let index = 1; index < position.count; index += 1) {
			if (position.getY(index) > position.getY(topIndex)) topIndex = index;
			if (position.getY(index) < position.getY(bottomIndex)) bottomIndex = index;
		}

		expect(uv.count).toBeGreaterThan(4);
		expect(values.every(Number.isFinite)).toBe(true);
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...values)).toBeLessThanOrEqual(1);
		expect(size?.x).toBeCloseTo(240);
		expect(size?.y).toBeCloseTo(180);
		expect(uv.getY(topIndex)).toBeCloseTo(0);
		expect(uv.getY(bottomIndex)).toBeCloseTo(1);
	});

	it('uses the panel radius when the viewport reaches a panel corner', () => {
		const radii = getMinimapViewportCornerRadii(240, 180, 0, 0, 120, 90, 3, 24);

		expect(radii.topLeft).toBeCloseTo(24);
		expect(radii.topRight).toBeLessThan(radii.topLeft);
		expect(radii.bottomLeft).toBeLessThan(radii.topLeft);
	});

	it('builds one finite ring geometry around the viewport cutout', () => {
		const radii = getMinimapViewportCornerRadii(240, 180, 35, 45, 140, 80, 3, 24);
		const geometry = createMinimapViewportRingGeometry(240, 180, 35, 45, 140, 80, radii, 2);
		const position = geometry.getAttribute('position');
		geometry.computeBoundingBox();

		expect(position.count).toBeGreaterThan(8);
		expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
		expect(geometry.boundingBox?.min.x).toBeCloseTo(-85);
		expect(geometry.boundingBox?.max.x).toBeCloseTo(55);
		expect(geometry.boundingBox?.min.y).toBeCloseTo(-35);
		expect(geometry.boundingBox?.max.y).toBeCloseTo(45);
		expectTriangleCentresOutsideRingHole(geometry);
	});

	it('updates animated viewport rings without changing topology or crossing the hole', () => {
		const geometry = createMinimapViewportRingGeometry(
			120,
			120,
			0,
			0,
			120,
			120,
			{ topLeft: 18, topRight: 18, bottomRight: 18, bottomLeft: 18 },
			3
		);
		const position = geometry.getAttribute('position');
		const index = geometry.getIndex();

		for (let frame = 0; frame <= 120; frame += 1) {
			const progress = frame / 120;
			const panelSize = THREE.MathUtils.lerp(120, 230, progress);
			const viewportWidth = THREE.MathUtils.lerp(panelSize, 126, progress);
			const viewportHeight = THREE.MathUtils.lerp(panelSize, 62, progress);
			const left = THREE.MathUtils.lerp(0, 38, progress);
			const top = THREE.MathUtils.lerp(0, 54, progress);
			const radius = THREE.MathUtils.lerp(18, 2, progress);
			const radii = getMinimapViewportCornerRadii(
				panelSize,
				panelSize,
				left,
				top,
				viewportWidth,
				viewportHeight,
				radius,
				18
			);

			updateMinimapViewportRingGeometry(
				geometry,
				panelSize,
				panelSize,
				left,
				top,
				viewportWidth,
				viewportHeight,
				radii,
				3
			);

			expect(geometry.getAttribute('position')).toBe(position);
			expect(geometry.getIndex()).toBe(index);
			expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
			expectTriangleCentresOutsideRingHole(geometry);
		}
	});

	it('disposes replaced geometry exactly once', () => {
		const previous = new THREE.PlaneGeometry();
		const next = new THREE.PlaneGeometry(2, 2);
		const mesh = new THREE.Mesh(previous, new THREE.MeshBasicMaterial());
		const dispose = vi.spyOn(previous, 'dispose');

		replaceMeshGeometry(mesh, next);

		expect(dispose).toHaveBeenCalledOnce();
		expect(mesh.geometry).toBe(next);
	});
});

function expectTriangleCentresOutsideRingHole(geometry: THREE.BufferGeometry) {
	const position = geometry.getAttribute('position');
	const index = geometry.getIndex();
	if (!index) throw new Error('Viewport ring geometry must be indexed');

	const innerContour: THREE.Vector2[] = [];
	for (let vertex = 1; vertex < position.count; vertex += 2) {
		innerContour.push(new THREE.Vector2(position.getX(vertex), position.getY(vertex)));
	}

	for (let offset = 0; offset < index.count; offset += 3) {
		const a = index.getX(offset);
		const b = index.getX(offset + 1);
		const c = index.getX(offset + 2);
		const centre = new THREE.Vector2(
			(position.getX(a) + position.getX(b) + position.getX(c)) / 3,
			(position.getY(a) + position.getY(b) + position.getY(c)) / 3
		);

		expect(isPointInsidePolygon(centre, innerContour)).toBe(false);
	}
}

function isPointInsidePolygon(point: THREE.Vector2, polygon: THREE.Vector2[]) {
	let inside = false;
	for (
		let current = 0, previous = polygon.length - 1;
		current < polygon.length;
		previous = current++
	) {
		const a = polygon[current];
		const b = polygon[previous];
		const crosses =
			a.y > point.y !== b.y > point.y &&
			point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
		if (crosses) inside = !inside;
	}
	return inside;
}
