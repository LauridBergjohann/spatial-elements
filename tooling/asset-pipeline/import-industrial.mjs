/** Import reviewed Wurm LODs from the brand examples; rerunnable without replacing other assets.
 * Run from the repository: node tooling/asset-pipeline/import-industrial.mjs
 * Then: npm run assets:showcase:render -- --only=wurm-asv101,...
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createIO, readAsset } from './showcase-io.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const examples = path.resolve(process.env.BRAND_EXAMPLES_ROOT ?? path.join(root, '../spatial-elements-brand-examples'));
const brands = path.resolve(process.env.BRAND_ASSETS_ROOT ?? path.join(root, '../assets/brands'));
const staticRoot = path.join(root, 'apps/website/static');
const content = path.join(root, 'apps/website/src/lib/showcase');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
const reportFile = path.join(root, 'tooling/asset-pipeline/showcase-geometry-report.json');
const reports = await read(reportFile);
const runtime = await read(path.join(content, 'geometry-assets.json'));
const poses = await read(path.join(content, 'presentation.json'));
const io = await createIO();
const upsert = (items, entry) => {
	const index = items.findIndex(item => item.spatialElementId === entry.spatialElementId);
	if (index < 0) items.push(entry); else items[index] = entry;
};
for (const name of ['asv101', 'hks-g4', 'atv230', 'dsp-lcd', 'dsp002', 'fkl003', 'fkp003', 'multigate3']) {
	const id = 'wurm-' + name;
	const source = await read(path.join(examples, 'src/lib/catalog/assets/generated/optimized', id + '.json'));
	const pair = structuredClone(source.pair);
	const directory = path.join(staticRoot, 'assets/showcase', id);
	await fs.mkdir(directory, { recursive: true });
	const representations = {};
	for (const lod of ['low', 'high']) {
		const url = `/assets/showcase/${id}/${id}-${lod}.glb`;
		await fs.copyFile(path.join(examples, 'static', pair[lod].url), path.join(staticRoot, url));
		pair[lod].url = url;
		const { document, costs } = await readAsset(io, path.join(staticRoot, url));
		if (costs.sha256 !== pair[lod].revision) throw new Error(`Changed reviewed model: ${url}`);
		if (document.getRoot().listCameras().length || costs.extensions.includes('KHR_lights_punctual')) throw new Error(`Unexpected scene equipment: ${url}`);
		representations[lod] = { resource: pair[lod], costs };
	}
	pair.sourceUrl = pair.high.url;
	const poster = { src: `/assets/showcase/${id}/${id}-poster.webp`, alt: name.toUpperCase(), width: 1024, height: 1024 };
	// Seed an offline fallback; render-showcase replaces this with the exact website pose and lighting.
	try { await fs.access(path.join(staticRoot, poster.src)); } catch {
		await sharp(path.join(examples, 'static', source.poster.src)).resize(1024, 1024, { fit: 'contain', background: '#00000000' }).webp({ quality: 90 }).toFile(path.join(staticRoot, poster.src));
	}
	const entry = {
		...source, brandId: 'wurm', spatialElementId: id, pair, poster,
		source: { origin: 'website-static', file: pair.high.url.slice(1), sha256: pair.high.revision, costs: representations.high.costs },
		provenance: { repository: 'spatial-elements-brand-examples', manifest: `src/lib/catalog/assets/generated/optimized/${id}.json`, source: source.source },
		representations
	};
	upsert(reports, entry);
	upsert(runtime, { brandId: 'wurm', spatialElementId: id, pair, poster });
	poses[id] = { camera: { azimuth: -20, elevation: 0, fitScale: 1.1 }, minimap: { hoverModelScale: 1.4, expandedHoverModelScale: 1.1, dockedView: { scale: 1.4, azimuth: -20, elevation: 10 } } };
}
await write(reportFile, reports);
await write(path.join(content, 'geometry-assets.json'), runtime);
await write(path.join(content, 'presentation.json'), poses);
const destination = path.join(staticRoot, 'assets/brands');
await fs.mkdir(destination, { recursive: true });
for (const name of ['item', 'wurm']) {
	await sharp(path.join(brands, `${name}-picture.jpg`)).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(destination, `${name}-picture.webp`));
}
await fs.copyFile(path.join(brands, 'item-logo.svg'), path.join(destination, 'item-logo.svg'));
await sharp(path.join(brands, 'wurm-logo.png')).webp({ lossless: true }).toFile(path.join(destination, 'wurm-logo.webp'));
console.log('Imported eight reviewed Wurm LOD pairs and Industrial brand images.');
