import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import report from './showcase-geometry-report.json';
import products from './showcase-products.json';
import runtime from '../../apps/website/src/lib/showcase/geometry-assets.json';

it('ships one reviewed LOD pair for every showcase product without the offline audit in the client bundle', () => {
	const ids = ['chronograph', ...products.products.map((product) => product.id)].sort();
	expect(report.map((entry) => entry.spatialElementId).sort()).toEqual(ids);
	expect(runtime.map((entry) => entry.spatialElementId).sort()).toEqual(ids);
	for (const entry of runtime) {
		expect(Object.keys(entry).sort()).toEqual(['brandId', 'pair', 'poster', 'spatialElementId']);
		const audit = report.find((item) => item.spatialElementId === entry.spatialElementId)!;
		expect(entry.pair).toEqual(audit.pair);
		expect(entry.poster).toEqual(audit.poster);
	}
});

for (const entry of report) {
	it(`keeps the ${entry.spatialElementId} model files, performance audit and shared frame synchronized`, () => {
		expect(entry.pair.assetToFrame).toHaveLength(16);
		expect(entry.pair.assetToFrame.every(Number.isFinite)).toBe(true);
		const product = products.products.find((product) => product.id === entry.spatialElementId);
		if (product?.normalizeFrame) {
			expect(
				Math.max(...entry.pair.bounds.max.map((value, axis) => value - entry.pair.bounds.min[axis]))
			).toBeCloseTo(1, 10);
		}
		expect(entry.representations.low.costs.triangleCount).toBeLessThanOrEqual(
			entry.representations.high.costs.triangleCount
		);
		expect(entry.representations.high.costs.triangleCount).toBeLessThanOrEqual(
			entry.source.costs.triangleCount
		);
		// The watch retains its original geometry. Product category models have a
		// tighter budget so a grid does not accidentally receive detailed sources.
		expect(entry.representations.low.costs.triangleCount).toBeLessThanOrEqual(
			entry.spatialElementId === 'chronograph'
				? 54000
				: (product?.reviewedLowTriangleLimit ?? 30000)
		);
		expect(entry.representations.low.costs.drawCalls).toBeLessThanOrEqual(9);
		expect(entry.representations.low.costs.estimatedTextureBytes).toBeLessThanOrEqual(
			13 * 1024 * 1024
		);
		for (const lod of ['low', 'high'] as const) {
			const resource = entry.pair[lod];
			const costs = entry.representations[lod].costs;
			expect(resource.url).toBe(
				`/assets/showcase/${entry.spatialElementId}/${entry.spatialElementId}-${lod}.glb`
			);
			const bytes = readFileSync(
				new URL(`../../apps/website/static${resource.url}`, import.meta.url)
			);
			expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
			expect(bytes.readUInt32LE(4)).toBe(2);
			expect(bytes.readUInt32LE(8)).toBe(bytes.length);
			expect(bytes.length).toBe(costs.transferBytes);
			const revision = createHash('sha256').update(bytes).digest('hex');
			expect(revision).toBe(resource.revision);
			expect(revision).toBe(costs.sha256);
			const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
			// An imported light changes the shared catalog lighting when its card
			// enters the viewport, recompiling every visible product's shader.
			expect(gltf.extensionsUsed ?? []).not.toContain('KHR_lights_punctual');
			expect(gltf.cameras ?? []).toHaveLength(0);
			for (const node of gltf.nodes) {
				expect(node.camera).toBeUndefined();
				expect(node.extensions?.KHR_lights_punctual).toBeUndefined();
			}
			let triangles = 0;
			let draws = 0;
			for (const node of gltf.nodes) {
				for (const primitive of gltf.meshes?.[node.mesh]?.primitives ?? []) {
					triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
					draws++;
				}
			}
			expect(triangles).toBe(costs.triangleCount);
			expect(draws).toBe(costs.drawCalls);
			expect(gltf.materials.length).toBe(costs.materialCount);
			expect(gltf.extensionsUsed.sort()).toEqual([...resource.requirements.extensions].sort());
		}
	});
}

it('keeps the complete expanded category within the reviewed geometry and draw-call budgets', () => {
	expect(
		report.reduce((sum, entry) => sum + entry.representations.low.costs.triangleCount, 0)
	).toBeLessThan(500000);
	expect(
		report.reduce((sum, entry) => sum + entry.representations.low.costs.drawCalls, 0)
	).toBeLessThanOrEqual(45);
});
