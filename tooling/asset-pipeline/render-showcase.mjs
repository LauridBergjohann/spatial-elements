import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

// Render actual geometry, never an illustrative replacement. The same camera fit,
// pose, environment, light and tone-mapping settings are used by the detail page.
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const staticRoot = path.join(root, 'apps/website/static');
const sourceRoot = path.resolve(
	process.env.SHOWCASE_SOURCE_ROOT ?? path.join(root, '../assets/products')
);
const assets = JSON.parse(
	await readFile(path.join(root, 'tooling/asset-pipeline/showcase-geometry-report.json'), 'utf8')
);
const poses = JSON.parse(
	await readFile(path.join(root, 'apps/website/src/lib/showcase/presentation.json'), 'utf8')
);
const selection = process.argv
	.find((value) => value.startsWith('--only='))
	?.slice(7)
	.split(',');
const compare = process.argv.includes('--compare');
const size = 1024;
const reportDirectory = path.join(root, '.artifacts/showcase');
const posterReportFile = path.join(root, 'tooling/asset-pipeline/showcase-poster-report.json');
const posterReports = new Map();
try {
	for (const report of JSON.parse(await readFile(posterReportFile, 'utf8')))
		posterReports.set(report.id, report);
} catch (error) {
	if (error.code !== 'ENOENT') throw error;
}
await mkdir(reportDirectory, { recursive: true });
const inside = (parent, file) => file.startsWith(parent + path.sep);
const server = createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
		if (pathname === '/') {
			response.setHeader('Content-Type', 'text/html');
			response.end(
				'<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.webgpu.js","three/webgpu":"/node_modules/three/build/three.webgpu.js","three/tsl":"/node_modules/three/build/three.tsl.js"}}</script>'
			);
			return;
		}
		let file;
		if (pathname.startsWith('/__source/')) {
			const asset = assets.find((item) => item.spatialElementId === pathname.slice(10));
			if (!asset) throw Error('Unknown source');
			const parent =
				asset.source.origin === 'website-static'
					? staticRoot
					: asset.source.origin === 'repository'
						? root
						: sourceRoot;
			file = path.resolve(parent, asset.source.file);
			if (!inside(parent, file)) throw Error('Source is outside its asset root');
		} else {
			const parent = pathname.startsWith('/_library/')
				? path.join(root, 'packages/core/dist')
				: pathname.startsWith('/node_modules/')
					? root
					: staticRoot;
			file = path.resolve(parent, pathname.replace(/^\/_library\//, '').replace(/^\//, ''));
			if (!inside(parent, file)) throw Error('Invalid asset path');
		}
		response.setHeader(
			'Content-Type',
			file.endsWith('.js')
				? 'text/javascript'
				: file.endsWith('.wasm')
					? 'application/wasm'
					: 'application/octet-stream'
		);
		const stream = createReadStream(file);
		stream.on('error', () => response.writeHead(404).end());
		stream.pipe(response);
	} catch (error) {
		response.writeHead(404).end(String(error));
	}
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
	browser = await chromium.launch({
		channel: process.env.CI ? undefined : 'chrome',
		headless: true
	});
	for (const asset of assets) {
		const id = asset.spatialElementId;
		if (selection && !selection.includes(id)) continue;
		const page = await browser.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto(`http://127.0.0.1:${server.address().port}`);
		const result = await page.evaluate(
			async ({ asset, pose, compare, size }) => {
				const T = await import('/node_modules/three/build/three.webgpu.js');
				const { GLTFLoader } =
					await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
				const { DRACOLoader } =
					await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
				const { HDRLoader } = await import('/node_modules/three/examples/jsm/loaders/HDRLoader.js');
				const { MeshoptDecoder } =
					await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
				const { detailCameraFit } = await import('/_library/catalog/stagedDetailGeometry.js');
				const { prepareSpatialElementFrame } =
					await import('/_library/stage/spatialElementFrame.js');
				const decoder = new DRACOLoader().setDecoderPath('/assets/draco/gltf/');
				const loader = new GLTFLoader().setDRACOLoader(decoder).setMeshoptDecoder(MeshoptDecoder);
				const renderer = new T.WebGPURenderer({ alpha: true, antialias: true });
				await renderer.init();
				renderer.setPixelRatio(1);
				renderer.setSize(size, size, false);
				renderer.setClearColor(0, 0);
				renderer.toneMapping = T.ACESFilmicToneMapping;
				renderer.toneMappingExposure = 1.15;
				const scene = new T.Scene();
				const hdr = await new HDRLoader().loadAsync('/assets/environments/studio.hdr');
				hdr.mapping = T.EquirectangularReflectionMapping;
				scene.environment = hdr;
				scene.add(new T.HemisphereLight(0xffffff, 0x20242d, 0.8));
				const key = new T.DirectionalLight(0xffffff, 2.6);
				key.position.set(4, 5, 3);
				scene.add(key);
				const urls = compare
					? {
							source: '/__source/' + asset.spatialElementId,
							high: asset.pair.high.url,
							low: asset.pair.low.url
						}
					: { high: asset.pair.high.url };
				const models = {};
				let bounds;
				for (const [lod, url] of Object.entries(urls)) {
					const loaded = await loader.loadAsync(url);
					// Source exports can contain studio equipment. Match the geometry
					// pipeline's removal while preserving any geometry below those nodes.
					const equipment = [];
					loaded.scene.traverse((object) => {
						if (object.isLight || object.isCamera) equipment.push(object);
					});
					for (const object of equipment) {
						const group = new T.Group().copy(object, false);
						object.parent?.add(group);
						for (const child of [...object.children]) group.add(child);
						object.removeFromParent();
					}
					loaded.scene.traverse((object) => {
						if (
							[
								...(pose.model?.excludeMeshes ?? []),
								...(asset.source.excludedNodes ?? [])
							].includes(object.name)
						)
							object.visible = false;
						const override = pose.model?.materialOverrides?.[object.name];
						if (object.isMesh && override) {
							const { type, blending, ...parameters } = override;
							object.material = new T.MeshPhysicalMaterial({
								...parameters,
								blending: blending === 'additive' ? T.AdditiveBlending : T.NormalBlending
							});
						}
					});
					const model = new T.Group();
					bounds = prepareSpatialElementFrame(model, loaded.scene, asset.pair, pose.model ?? {});
					model.updateMatrixWorld(true);
					models[lod] = model;
				}
				const views = [{ name: 'detail-pose', ...pose.camera }];
				if (compare)
					views.push(
						{
							name: 'back',
							azimuth: (pose.camera?.azimuth ?? 0) + 180,
							elevation: pose.camera?.elevation ?? 20
						},
						{ name: 'side', azimuth: 90, elevation: 15 },
						{ name: 'minimap', ...pose.camera, pixels: 96 }
					);
				const sheet = document.createElement('canvas');
				const width = 360,
					rowHeight = 384;
				sheet.width = width * Object.keys(models).length;
				sheet.height = rowHeight * views.length;
				const context = sheet.getContext('2d');
				context.fillStyle = '#dfe4e3';
				context.fillRect(0, 0, sheet.width, sheet.height);
				const comparisons = [];
				let poster;
				for (const [row, view] of views.entries()) {
					const camera = new T.PerspectiveCamera(45, 1, 0.01, 1000);
					// Leave a small image inset, while retaining the authored pose and fit scale.
					const fit = detailCameraFit(
						bounds,
						camera,
						view,
						{ width: size, height: size },
						{ width: size * 0.92, height: size * 0.92 }
					);
					camera.position.copy(fit.center).addScaledVector(fit.direction, fit.distance);
					camera.near = fit.near;
					camera.far = fit.far;
					camera.lookAt(fit.center);
					camera.updateProjectionMatrix();
					camera.updateMatrixWorld();
					renderer.setSize(view.pixels ?? size, view.pixels ?? size, false);
					const pixels = {};
					for (const [column, [lod, model]] of Object.entries(models).entries()) {
						scene.add(model);
						await renderer.compileAsync(scene, camera);
						renderer.render(scene, camera);
						await renderer.backend.device.queue.onSubmittedWorkDone();
						const sample = document.createElement('canvas');
						sample.width = sample.height = size;
						const ctx = sample.getContext('2d');
						ctx.drawImage(renderer.domElement, 0, 0, size, size);
						pixels[lod] = ctx.getImageData(0, 0, size, size).data;
						context.fillStyle = '#172c25';
						context.font = '16px sans-serif';
						context.fillText(
							`${asset.spatialElementId}: ${view.name} / ${lod}`,
							column * width + 8,
							row * rowHeight + 20
						);
						context.drawImage(sample, column * width, row * rowHeight + 24, width, width);
						if (row === 0 && lod === 'high') poster = sample.toDataURL('image/png').split(',')[1];
						scene.remove(model);
					}
					if (compare)
						for (const [from, to] of [
							['source', 'high'],
							['high', 'low']
						]) {
							let union = 0,
								intersection = 0,
								error = 0;
							for (let i = 0; i < pixels[from].length; i += 4) {
								const a = pixels[from][i + 3] > 8,
									b = pixels[to][i + 3] > 8;
								if (a || b) {
									union++;
									for (let c = 0; c < 3; c++)
										error += Math.abs(pixels[from][i + c] - pixels[to][i + c]);
								}
								if (a && b) intersection++;
							}
							comparisons.push({
								view: view.name,
								from,
								to,
								silhouetteIoU: intersection / Math.max(union, 1),
								meanRgbError: error / Math.max(union * 3 * 255, 1)
							});
						}
				}
				for (const model of Object.values(models))
					model.traverse((object) => {
						object.geometry?.dispose();
						for (const material of [object.material].flat().filter(Boolean)) {
							for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
							material.dispose();
						}
					});
				hdr.dispose();
				decoder.dispose();
				renderer.dispose();
				return { poster, sheet: sheet.toDataURL('image/png').split(',')[1], comparisons };
			},
			{ asset, pose: poses[id] ?? {}, compare, size }
		);
		if (errors.length) throw Error(errors.join('\n'));
		const output = path.join(staticRoot, 'assets/showcase', id, `${id}-poster.webp`);
		await mkdir(path.dirname(output), { recursive: true });
		await sharp(Buffer.from(result.poster, 'base64'))
			.webp({ quality: 90, alphaQuality: 100, effort: 6 })
			.toFile(output);
		await sharp(Buffer.from(result.sheet, 'base64'))
			.webp({ quality: 88 })
			.toFile(path.join(reportDirectory, `${id}-comparison.webp`));
		const poster = await readFile(output);
		const report = {
			id,
			browser: browser.version(),
			source: asset.source.sha256,
			low: asset.pair.low.revision,
			high: asset.pair.high.revision,
			frame: { assetToFrame: asset.pair.assetToFrame, bounds: asset.pair.bounds },
			pose: poses[id],
			width: size,
			height: size,
			posterBytes: poster.length,
			sha256: createHash('sha256').update(poster).digest('hex'),
			comparisons: result.comparisons
		};
		await writeFile(
			path.join(reportDirectory, `${id}-render.json`),
			JSON.stringify(report, null, 2) + '\n'
		);
		posterReports.set(id, report);
		await writeFile(
			posterReportFile,
			JSON.stringify(
				[...posterReports.values()].sort((a, b) => a.id.localeCompare(b.id)),
				null,
				2
			) + '\n'
		);
		console.log(
			JSON.stringify({ id, posterBytes: poster.length, comparisons: result.comparisons })
		);
		await page.close();
	}
} finally {
	await browser?.close();
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
}
