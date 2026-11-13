import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import {
	dedup,
	prune,
	weld,
	flatten,
	join,
	dequantize,
	compactPrimitive,
	draco,
	textureCompress,
	getBounds
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { createIO, readAsset, hash, stripSceneEquipment } from './showcase-io.mjs';
import { atlasMaterials } from './showcase-atlas.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const argument = (name) =>
	process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const sourceRoot = path.resolve(argument('source') ?? path.join(repo, '../assets/products'));
const selection = argument('product');
const check = process.argv.includes('--check');
const framesOnly = process.argv.includes('--frames-only');
const manifestFile = path.join(repo, 'tooling/asset-pipeline/showcase-geometry-report.json');
const runtimeFile = path.join(repo, 'apps/website/src/lib/showcase/geometry-assets.json');
const staticRoot = path.join(repo, 'apps/website/static');
const config = JSON.parse(
	await readFile(new URL('./showcase-products.json', import.meta.url), 'utf8')
);
assert.ok(
	!selection ||
		selection === 'chronograph' ||
		config.products.some((product) => product.id === selection),
	`Unknown product: ${selection}`
);
assert.ok(
	!(framesOnly && check),
	'Use --frames-only to update frames or --check to validate the current build.'
);
const manifests = new Map();
try {
	for (const entry of JSON.parse(await readFile(manifestFile, 'utf8')))
		manifests.set(entry.spatialElementId, entry);
} catch (error) {
	if (error.code !== 'ENOENT') throw error;
}
const io = await createIO();
await MeshoptSimplifier.ready;

for (const product of config.products) {
	if (selection && selection !== product.id) continue;
	const sourcePath = path.resolve(sourceRoot, product.source);
	assert.ok(
		sourcePath.startsWith(sourceRoot + path.sep),
		'Sources must remain inside the selected source directory.'
	);
	const original = await readAsset(io, sourcePath);
	const equipment = stripSceneEquipment(original.document);
	removeHelpers(original.document, product.excludeNodes);
	const bounds = getBounds(original.document.getRoot().listScenes()[0]);
	const center = bounds.min.map((v, axis) => (v + bounds.max[axis]) / 2);
	const frameScale = product.normalizeFrame
		? 1 / Math.max(...bounds.max.map((value, axis) => value - bounds.min[axis]))
		: 1;
	const frame = {
		assetToFrame: [
			frameScale,
			0,
			0,
			0,
			0,
			frameScale,
			0,
			0,
			0,
			0,
			frameScale,
			0,
			...center.map((value) => -value * frameScale),
			1
		],
		bounds: {
			min: bounds.min.map((value, axis) => (value - center[axis]) * frameScale),
			max: bounds.max.map((value, axis) => (value - center[axis]) * frameScale)
		}
	};
	if (framesOnly) {
		const entry = manifests.get(product.id);
		assert.ok(
			entry && entry.source.sha256 === original.costs.sha256,
			'Frames-only updates require the current audited source.'
		);
		assert.deepEqual(
			entry.source.excludedNodes ?? [],
			product.excludeNodes ?? [],
			'Rebuild geometry after changing excluded helper nodes.'
		);
		Object.assign(entry.pair, frame);
		entry.pair.revision = `${product.id}-${product.normalizeFrame ? 'normalized-' : ''}source-frame-2`;
		await saveManifest();
		continue;
	}
	const representations = {};
	const decisions = product.preservationReason ? [product.preservationReason] : [];
	for (const lod of ['low', 'high']) {
		const sourceFile = lod === 'low' && product.lowSource ? product.lowSource : product.source;
		const asset = await readAsset(io, path.resolve(sourceRoot, sourceFile));
		const document = asset.document;
		stripSceneEquipment(document);
		removeHelpers(document, product.excludeNodes);
		await document.transform(dequantize(), prune(), dedup(), flatten(), join(), weld());
		const target = product[`${lod}Triangles`];
		const errorLimit = lod === 'low' ? (product.lowError ?? 0.012) : 0.003;
		const simplification = simplifyWithAttributes(
			document,
			target,
			errorLimit,
			lod === 'low',
			product
		);
		let atlasedMaterials = 0;
		if (product.atlas) {
			atlasedMaterials = await atlasMaterials(document, { tileSize: lod === 'low' ? 128 : 512 });
			await document.transform(prune(), dedup(), flatten(), join(), weld());
		}
		// Preserve the original normal/roughness maps. WebP cuts transfer cost; their
		// resolution caps also reduce GPU memory (compressed transfer alone cannot).
		const textureEdge = lod === 'low' ? 512 : (product.highTextureEdge ?? 1536);
		await document.transform(
			textureCompress({
				encoder: sharp,
				targetFormat: 'webp',
				resize: product.atlas ? undefined : [textureEdge, textureEdge],
				slots: /baseColorTexture|emissiveTexture/,
				quality: lod === 'low' ? 88 : 95,
				effort: 75
			})
		);
		await document.transform(
			textureCompress({
				encoder: sharp,
				targetFormat: 'webp',
				slots: /normalTexture|metallicRoughnessTexture|occlusionTexture/,
				resize: product.atlas ? undefined : lod === 'low' ? [512, 512] : [1024, 1024],
				quality: lod === 'low' ? 88 : 95,
				effort: 75
			})
		);
		await document.transform(
			prune(),
			draco({
				encodeSpeed: 5,
				decodeSpeed: 5,
				quantizePosition: 18,
				quantizeNormal: 14,
				quantizeTexcoord: 16
			})
		);
		const bytes = await io.writeBinary(document);
		const url = `/assets/showcase/${product.id}/${product.id}-${lod}.glb`;
		const file = path.join(staticRoot, url);
		if (check)
			assert.deepEqual(
				new Uint8Array(await readFile(file)),
				bytes,
				`Changed geometry: ${product.id}/${lod}`
			);
		else {
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, bytes);
		}
		const inspected = await readAsset(io, file);
		const costs = inspected.costs;
		const dimension = Math.max(...bounds.max.map((v, axis) => v - bounds.min[axis]));
		const boundsError =
			Math.max(
				...costs.bounds.min.map((v, axis) => Math.abs(v - bounds.min[axis])),
				...costs.bounds.max.map((v, axis) => Math.abs(v - bounds.max[axis]))
			) / dimension;
		assert.ok(
			boundsError < 0.025,
			`Unexpected silhouette extent change for ${product.id}/${lod}: ${boundsError}`
		);
		if (costs.triangleCount > target * 1.15)
			decisions.push(
				`${lod}: ${costs.triangleCount} triangles exceed target ${target}; preserving appearance takes precedence over forcing the budget.`
			);
		representations[lod] = {
			resource: {
				url,
				format: 'glb',
				revision: hash(bytes),
				requirements: { decoders: ['draco'], extensions: costs.extensions }
			},
			costs,
			processing: {
				sourceFile,
				targetTriangles: target,
				errorLimit,
				maximumMeasuredError: simplification.maximumError,
				atlasedMaterials,
				preservedMaterials: product.preserveMaterials ?? [],
				boundsRelativeDeviation: boundsError
			}
		};
		console.log(
			`${product.id} ${lod}: ${original.costs.triangleCount} -> ${costs.triangleCount} triangles; ${original.costs.drawCalls} -> ${costs.drawCalls} draws; ${original.costs.transferBytes} -> ${costs.transferBytes} bytes`
		);
	}
	manifests.set(product.id, {
		schemaVersion: 1,
		brandId: product.brand,
		spatialElementId: product.id,
		source: {
			origin: 'products',
			file: product.source,
			sha256: original.costs.sha256,
			costs: original.costs,
			excludedNodes: product.excludeNodes ?? [],
			...(equipment.excludedLightNodes.length
				? { excludedLightNodes: equipment.excludedLightNodes }
				: {}),
			...(equipment.excludedCameraNodes.length
				? { excludedCameraNodes: equipment.excludedCameraNodes }
				: {})
		},
		tools: {
			gltfTransform: '4.5.0',
			meshoptimizer: '1.2.0',
			sharp: sharp.versions.sharp,
			recipe: 'showcase-2'
		},
		pair: {
			status: 'provisional-shared-frame',
			revision: `${product.id}-${product.normalizeFrame ? 'normalized-' : ''}source-frame-2`,
			sourceUrl: representations.high.resource.url,
			low: representations.low.resource,
			high: representations.high.resource,
			...frame
		},
		poster: {
			src: `/assets/showcase/${product.id}/${product.id}-poster.webp`,
			alt: `${product.brand} ${product.id} in the interactive detail view`,
			width: 1024,
			height: 1024
		},
		representations,
		decisions
	});
	if (!check) await saveManifest();
}

if (!framesOnly && (!selection || selection === 'chronograph')) {
	// The watch has a name-bound glass material override. Join the other compatible
	// meshes without decimation or texture changes; preserve that node explicitly.
	const watch = JSON.parse(
		await readFile(new URL('./showcase-watch.json', import.meta.url), 'utf8')
	);
	const representations = {};
	for (const lod of ['low', 'high']) {
		const input = path.join(repo, lod === 'low' ? watch.sourceLow : watch.sourceHigh);
		const asset = await readAsset(io, input);
		stripSceneEquipment(asset.document);
		const glassBefore = asset.document
			.getRoot()
			.listNodes()
			.find((node) => node.getName() === 'glass');
		assert.ok(glassBefore?.getMesh(), 'The watch glass override must remain addressable.');
		const glassMatrix = [...glassBefore.getWorldMatrix()];
		await asset.document.transform(
			dedup(),
			flatten(),
			join({ filter: (node) => node.getName() !== 'glass' }),
			prune(),
			draco({
				encodeSpeed: 5,
				decodeSpeed: 5,
				quantizePosition: 18,
				quantizeNormal: 14,
				quantizeTexcoord: 16
			})
		);
		const glassAfter = asset.document
			.getRoot()
			.listNodes()
			.find((node) => node.getName() === 'glass');
		assert.deepEqual(glassAfter?.getWorldMatrix(), glassMatrix, 'The watch glass pose changed.');
		const bytes = await io.writeBinary(asset.document);
		const url = `/assets/showcase/chronograph/chronograph-${lod}.glb`;
		const file = path.join(staticRoot, url);
		if (check)
			assert.deepEqual(
				new Uint8Array(await readFile(file)),
				bytes,
				`Changed geometry: chronograph/${lod}`
			);
		else {
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, bytes);
		}
		const inspected = await readAsset(io, file);
		assert.equal(inspected.costs.triangleCount, asset.costs.triangleCount);
		representations[lod] = {
			resource: {
				url,
				format: 'glb',
				revision: hash(bytes),
				requirements: { decoders: ['draco'], extensions: inspected.costs.extensions }
			},
			costs: inspected.costs
		};
		console.log(
			`chronograph ${lod}: ${asset.costs.triangleCount} triangles preserved; ${asset.costs.drawCalls} -> ${inspected.costs.drawCalls} draws`
		);
	}
	const source = await readAsset(io, path.join(repo, watch.sourceHigh));
	manifests.set('chronograph', {
		schemaVersion: 1,
		brandId: watch.brandId,
		spatialElementId: watch.spatialElementId,
		source: {
			origin: 'repository',
			file: watch.sourceHigh,
			sha256: source.costs.sha256,
			costs: source.costs
		},
		tools: {
			gltfTransform: '4.5.0',
			meshoptimizer: '1.2.0',
			sharp: sharp.versions.sharp,
			recipe: 'showcase-2-watch-joined'
		},
		pair: {
			...watch.frame,
			sourceUrl: representations.high.resource.url,
			low: representations.low.resource,
			high: representations.high.resource
		},
		poster: {
			src: '/assets/showcase/chronograph/chronograph-poster.webp',
			alt: 'Rolex chronograph in the interactive detail view',
			width: 1024,
			height: 1024
		},
		representations,
		decisions: [
			'Compatible watch meshes joined from the reviewed source LOD pair. No geometric simplification or texture changes; named glass node and its world transform are preserved.'
		]
	});
	if (!check) await saveManifest();
}

async function saveManifest() {
	const order = ['chronograph', ...config.products.map((product) => product.id)];
	const entries = [...manifests.values()].sort(
		(a, b) => order.indexOf(a.spatialElementId) - order.indexOf(b.spatialElementId)
	);
	await writeFile(manifestFile, JSON.stringify(entries, null, 2) + '\n');
	await writeFile(
		runtimeFile,
		JSON.stringify(
			entries.map(({ brandId, spatialElementId, pair, poster }) => ({
				brandId,
				spatialElementId,
				pair,
				poster
			})),
			null,
			2
		) + '\n'
	);
}

function removeHelpers(document, names = []) {
	for (const name of names) {
		const nodes = document
			.getRoot()
			.listNodes()
			.filter((node) => node.getName() === name);
		assert.ok(nodes.length, `Missing reviewed helper node: ${name}`);
		for (const node of nodes) node.setMesh(null);
	}
}

function simplifyWithAttributes(document, targetTriangles, errorLimit, permissive, product) {
	const primitives = document
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives());
	const triangleCount = primitives.reduce(
		(sum, primitive) => sum + primitive.getIndices().getCount() / 3,
		0
	);
	const ratio = Math.min(1, targetTriangles / triangleCount);
	let maximumError = 0;
	if (ratio === 1) return { maximumError };
	for (const primitive of primitives) {
		if (product.preserveMaterials?.includes(primitive.getMaterial()?.getName())) continue;
		const position = primitive.getAttribute('POSITION');
		const indices = primitive.getIndices();
		const attributes = ['NORMAL', 'TEXCOORD_0', 'COLOR_0']
			.map((semantic) => ({ semantic, accessor: primitive.getAttribute(semantic) }))
			.filter((entry) => entry.accessor);
		const stride = attributes.reduce((sum, entry) => sum + entry.accessor.getElementSize(), 0);
		const values = new Float32Array(position.getCount() * stride);
		const weights = [];
		let offset = 0;
		for (const { semantic, accessor } of attributes) {
			for (let i = 0; i < accessor.getElementSize(); i++)
				weights.push(
					semantic === 'NORMAL' ? (permissive ? (product.lowNormalWeight ?? 0.15) : 0.15) : 0.05
				);
			for (let i = 0; i < position.getCount(); i++)
				values.set(accessor.getElement(i, []), i * stride + offset);
			offset += accessor.getElementSize();
		}
		const [result, error] = MeshoptSimplifier.simplifyWithAttributes(
			new Uint32Array(indices.getArray()),
			new Float32Array(position.getArray()),
			3,
			values,
			stride,
			weights,
			null,
			Math.max(3, Math.floor((indices.getCount() * ratio) / 3) * 3),
			errorLimit,
			product.lockBorderMaterials?.includes(primitive.getMaterial()?.getName())
				? ['LockBorder']
				: permissive
					? ['Permissive']
					: []
		);
		maximumError = Math.max(maximumError, error);
		primitive.setIndices(
			document.createAccessor().setType('SCALAR').setArray(result).setBuffer(indices.getBuffer())
		);
		compactPrimitive(primitive);
	}
	return { maximumError };
}
