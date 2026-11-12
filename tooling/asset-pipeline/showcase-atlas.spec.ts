import { Document } from '@gltf-transform/core';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { atlasMaterials } from './showcase-atlas.mjs';

it('prefilters repeated normal detail instead of aliasing it into large low-resolution bumps', async () => {
	const document = new Document();
	const buffer = document.createBuffer();
	const pixels = Buffer.alloc(64 * 64 * 4);
	for (let y = 0; y < 64; y++) {
		for (let x = 0; x < 64; x++) {
			pixels.set([(x + y) % 2 ? 230 : 26, 128, 220, 255], (y * 64 + x) * 4);
		}
	}
	const texture = document
		.createTexture()
		.setMimeType('image/png')
		.setImage(
			await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } })
				.png()
				.toBuffer()
		);
	const scene = document.createScene();
	for (const color of [
		[1, 0, 0, 1],
		[0, 0, 1, 1]
	] as const) {
		const material = document
			.createMaterial()
			.setBaseColorFactor([...color])
			.setNormalTexture(texture);
		const position = document
			.createAccessor()
			.setType('VEC3')
			.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
			.setBuffer(buffer);
		const uv = document
			.createAccessor()
			.setType('VEC2')
			.setArray(new Float32Array([0, 0, 32, 0, 0, 32]))
			.setBuffer(buffer);
		const primitive = document
			.createPrimitive()
			.setAttribute('POSITION', position)
			.setAttribute('TEXCOORD_0', uv)
			.setMaterial(material);
		scene.addChild(document.createNode().setMesh(document.createMesh().addPrimitive(primitive)));
	}
	expect(await atlasMaterials(document, { tileSize: 16 })).toBe(2);
	const material = document.getRoot().listMeshes()[0].listPrimitives()[0].getMaterial()!;
	expect(material.getNormalTextureInfo()!.getTexCoord()).toBe(2);
	const normal = await sharp(material.getNormalTexture()!.getImage()!)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (const mesh of document.getRoot().listMeshes()) {
		const primitive = mesh.listPrimitives()[0];
		expect(primitive.getMaterial()).toBe(material);
		const uv = primitive.getAttribute('TEXCOORD_2')!;
		for (let i = 0; i < uv.getCount(); i++) {
			const [u, v] = uv.getElement(i, []);
			const pixel =
				(Math.floor(v * normal.info.height) * normal.info.width +
					Math.floor(u * normal.info.width)) *
				4;
			expect(Math.abs(normal.data[pixel] - 128)).toBeLessThanOrEqual(3);
			expect(Math.abs(normal.data[pixel + 1] - 128)).toBeLessThanOrEqual(3);
			expect(normal.data[pixel + 2]).toBeGreaterThanOrEqual(253);
		}
	}
	// Constant metallic/roughness values remain tiny, even when normal detail has
	// a much larger tile; GPU allocations are based on actual channel content.
	const roughness = await sharp(material.getMetallicRoughnessTexture()!.getImage()!).metadata();
	expect(roughness.width! * roughness.height!).toBeLessThanOrEqual(1024);
});
