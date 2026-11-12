import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, listTextureSlots } from '@gltf-transform/functions';
import draco from 'draco3dgltf';
import sharp from 'sharp';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function createIO() {
	return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
		'draco3d.decoder': await draco.createDecoderModule(),
		'draco3d.encoder': await draco.createEncoderModule()
	});
}

export async function readAsset(io, path) {
	const bytes = await readFile(path);
	const document = await io.read(path);
	document.setLogger(new Logger(Logger.Verbosity.WARN));
	if (document.getRoot().listAnimations().length || document.getRoot().listSkins().length) {
		throw new Error(`Animated sources require a separate preservation review: ${path}`);
	}
	return { document, bytes, costs: await costs(document, bytes) };
}

/** Products contribute geometry and materials, never lighting or camera settings. */
export function stripSceneEquipment(document) {
	const root = document.getRoot();
	const excludedLightNodes = root
		.listNodes()
		.filter((node) => node.getExtension('KHR_lights_punctual'))
		.map((node) => node.getName());
	const excludedCameraNodes = root
		.listNodes()
		.filter((node) => node.getCamera())
		.map((node) => node.getName());
	// Remove components, not transform nodes: a light/camera node may also own
	// geometry or parent a product mesh whose world transform must be preserved.
	root
		.listExtensionsUsed()
		.find((extension) => extension.extensionName === 'KHR_lights_punctual')
		?.dispose();
	for (const camera of root.listCameras()) camera.dispose();
	return { excludedLightNodes, excludedCameraNodes };
}

export async function costs(document, bytes) {
	const root = document.getRoot();
	let triangleCount = 0,
		vertexCount = 0,
		drawCalls = 0;
	for (const node of root.listNodes()) {
		for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
			if (primitive.getMode() !== 4 || primitive.listTargets().length) {
				throw new Error('The showcase pipeline accepts static triangle meshes only.');
			}
			triangleCount +=
				(primitive.getIndices() ?? primitive.getAttribute('POSITION')).getCount() / 3;
			vertexCount += primitive.getAttribute('POSITION').getCount();
			drawCalls++;
		}
	}
	const textures = await Promise.all(
		root.listTextures().map(async (texture) => {
			const meta = await sharp(texture.getImage()).metadata();
			return {
				width: meta.width,
				height: meta.height,
				bytes: texture.getImage().byteLength,
				mimeType: texture.getMimeType(),
				slots: listTextureSlots(texture),
				estimatedGpuBytes: Math.ceil((meta.width * meta.height * 4 * 4) / 3)
			};
		})
	);
	return {
		sha256: hash(bytes),
		transferBytes: bytes.length,
		triangleCount,
		vertexCount,
		drawCalls,
		materialCount: root.listMaterials().length,
		decodedGeometryBytes: root
			.listAccessors()
			.reduce((n, accessor) => n + accessor.getArray().byteLength, 0),
		estimatedTextureBytes: textures.reduce((n, texture) => n + texture.estimatedGpuBytes, 0),
		textures,
		bounds: getBounds(root.getDefaultScene() ?? root.listScenes()[0]),
		extensions: root.listExtensionsUsed().map((extension) => extension.extensionName),
		method:
			'Scene triangles, vertices and draw calls include instances. Texture GPU bytes estimate RGBA8 plus mipmaps; they are not device measurements.'
	};
}
