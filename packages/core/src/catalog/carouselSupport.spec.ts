import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { carouselSupport } from './carouselSupport.js';

it('finds the real support of separated parts without inventing bounding-box corners', () => {
	const model = new THREE.Group();
	for (const x of [-2, 2]) {
		const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		part.position.set(x, Math.abs(x), x);
		model.add(part);
	}
	const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.3, 0));
	const points = carouselSupport(model, orientation);
	const vertices: THREE.Vector3[] = [];
	model.traverse(object => {
		if (!(object instanceof THREE.Mesh)) return;
		for (let i = 0; i < object.geometry.attributes.position.count; i++)
			vertices.push(object.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(object.matrixWorld));
	});
	for (const point of points) expect(vertices.some(vertex => vertex.distanceTo(point) < 0.00001)).toBe(true);
	expect(Math.min(...points.map(p => p.clone().applyQuaternion(orientation).y)))
		.toBeCloseTo(Math.min(...vertices.map(p => p.clone().applyQuaternion(orientation).y)));
});
