import { expect, it } from 'vitest';
import * as THREE from 'three';
import { estimateAssetBytes } from './assetCosts.js';

it('counts shared geometry buffers and material textures once across instances', () => {
	const geometry = new THREE.BufferGeometry();
	const buffer = new Float32Array(18);
	geometry.setAttribute('position', new THREE.BufferAttribute(buffer.subarray(0, 9), 3));
	geometry.setAttribute('normal', new THREE.BufferAttribute(buffer.subarray(9), 3));
	const texture = new THREE.DataTexture(new Uint8Array(64), 4, 4);
	texture.generateMipmaps = false;
	const material = new THREE.MeshStandardMaterial({ map: texture, roughnessMap: texture });
	const scene = new THREE.Group();
	scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
	expect(estimateAssetBytes(scene, scene)).toBe(buffer.byteLength + 64);
	geometry.dispose();
	material.dispose();
	texture.dispose();
});
