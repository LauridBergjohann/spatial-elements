import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FloatType } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Mesh, MeshStandardMaterial } from 'three';

const directory = new URL('../../fixtures/demo-assets/', import.meta.url);
const bytes = (name: string) => Uint8Array.from(readFileSync(new URL(name, directory))).buffer;

it('provides a finite, non-black HDR with enough resolution for PMREM lighting', () => {
 const hdr = new HDRLoader().setDataType(FloatType).parse(bytes('studio.hdr'));
 // PMREM uses width / 4 as the cube face size; its minimum mip is 16.
 expect(hdr.width).toBeGreaterThanOrEqual(64);
 expect(hdr.width).toBe(hdr.height * 2);
 expect(hdr.data.length).toBe(hdr.width * hdr.height * 4);
 expect(Array.from(hdr.data).every(value => Number.isFinite(value) && value > 0)).toBe(true);
});

for (const id of ['column', 'orb', 'ring', 'cube', 'torus-knot']) {
 it(`loads both colored ${id} models inside the declared shared bounds`, async () => {
  for (const quality of ['low', 'high']) {
   const gltf = await new GLTFLoader().parseAsync(bytes(`${id}-${quality}.glb`), '');
   const mesh = gltf.scene.children[0] as Mesh;
   const material = mesh.material as MeshStandardMaterial;
   expect(Math.max(...material.color.toArray())).toBeGreaterThan(0.1);
   expect(new Set(material.color.toArray()).size).toBeGreaterThan(1);
   mesh.geometry.computeBoundingBox();
   expect(mesh.geometry.boundingBox!.min.toArray().every(value => value >= -1)).toBe(true);
   expect(mesh.geometry.boundingBox!.max.toArray().every(value => value <= 1)).toBe(true);
   mesh.geometry.dispose();
   material.dispose();
  }
  expect(readFileSync(new URL(`${id}.svg`, directory), 'utf8')).toContain('<svg');
 });
}
