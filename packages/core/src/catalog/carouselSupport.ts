import * as THREE from 'three/webgpu';
import { isMesh } from '../stage/stageSceneUtils.js';

/** Cache a small support envelope from actual vertices, rather than empty box corners. */
export function carouselSupport(model: THREE.Object3D, orientation: THREE.Quaternion) {
	const directions = [new THREE.Vector3(0, 1, 0), ...Array.from({ length: 16 }, (_, i) =>
		new THREE.Vector3(Math.cos(i * Math.PI / 8) * 0.14, 1, Math.sin(i * Math.PI / 8) * 0.14))];
	const scores = directions.map(() => Infinity);
	const points = directions.map(() => new THREE.Vector3());
	const vertex = new THREE.Vector3(), rotated = new THREE.Vector3();
	model.updateMatrixWorld(true);
	model.traverseVisible(object => {
		if (!isMesh(object)) return;
		const positions = object.geometry.getAttribute('position');
		if (!positions) return;
		for (let i = 0; i < positions.count; i++) {
			object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
			rotated.copy(vertex).applyQuaternion(orientation);
			for (let j = 0; j < directions.length; j++) {
				const score = rotated.dot(directions[j]);
				if (score < scores[j]) { scores[j] = score; points[j].copy(vertex); }
			}
		}
	});
	return points;
}
