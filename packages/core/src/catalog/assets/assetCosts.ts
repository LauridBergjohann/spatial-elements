import type { BufferGeometry, Material, Object3D, Texture } from 'three';

/** Conservative accounting model, not a GPU memory query. Shared buffers/textures count once. */
export function estimateAssetBytes(...scenes: Object3D[]) {
	const buffers = new Set<ArrayBufferLike>();
	const textures = new Set<Texture>();
	for (const scene of new Set(scenes))
		scene.traverse((object) => {
			const mesh = object as Object3D & {
				geometry?: BufferGeometry;
				material?: Material | Material[];
			};
			if (mesh.geometry) {
				for (const attribute of [...Object.values(mesh.geometry.attributes), mesh.geometry.index]) {
					if (!attribute) continue;
					const array =
						'isInterleavedBufferAttribute' in attribute ? attribute.data.array : attribute.array;
					buffers.add(array.buffer);
				}
			}
			for (const material of !mesh.material
				? []
				: Array.isArray(mesh.material)
					? mesh.material
					: [mesh.material]) {
				for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
			}
		});
	let bytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
	for (const texture of textures) {
		const image = texture.source?.data as { width?: number; height?: number } | undefined;
		bytes += Math.ceil(
			(image?.width ?? 0) * (image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
		);
	}
	return bytes;
}
