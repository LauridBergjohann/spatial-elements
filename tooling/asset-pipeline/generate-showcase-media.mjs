import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const sourceArgument = process.argv.indexOf('--source');
const source = path.resolve(
	sourceArgument >= 0
		? process.argv[sourceArgument + 1]
		: path.join(repository, '../assets/products')
);
const manifest = JSON.parse(
	await fs.readFile(new URL('./showcase-media.json', import.meta.url), 'utf8')
);
const publicDirectory = path.join(repository, 'apps/website/static/assets/showcase');
const assets = [];
const report = [];

function within(parent, child) {
	const relative = path.relative(parent, child);
	if (relative.startsWith('..') || path.isAbsolute(relative))
		throw new Error(`Path outside ${parent}: ${child}`);
	return child;
}

for (const product of manifest.products) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.id))
		throw new Error(`Invalid product ID: ${product.id}`);
	const directory = within(publicDirectory, path.join(publicDirectory, product.id));
	await fs.mkdir(directory, { recursive: true });
	const images = [];
	for (const [index, image] of product.images.entries()) {
		const inputPath = within(source, path.resolve(source, product.directory, image.source));
		const input = await fs.readFile(inputPath);
		const basename = `${product.id}-image-${String(index + 1).padStart(2, '0')}`;
		const variants = {};
		for (const [variant, size, quality, suffix] of [
			['full', 1600, 82, ''],
			['small', 640, 78, '-small']
		]) {
			const filename = `${basename}${suffix}.webp`;
			if (variant === 'small' && Math.max(variants.full.width, variants.full.height) <= size) {
				variants.small = variants.full;
				// Remove only the obsolete generated variant of this exact manifest entry.
				await fs.rm(within(directory, path.join(directory, filename)), { force: true });
				continue;
			}
			const output = await sharp(input)
				.rotate()
				.resize({
					width: size,
					height: size,
					fit: 'inside',
					withoutEnlargement: true
				})
				.webp({ quality, alphaQuality: 95, effort: 6 })
				.toBuffer({ resolveWithObject: true });
			await fs.writeFile(path.join(directory, filename), output.data);
			variants[variant] = {
				src: `/assets/showcase/${product.id}/${filename}`,
				width: output.info.width,
				height: output.info.height,
				bytes: output.info.size
			};
		}
		images.push({
			id: basename,
			alt: image.alt,
			label: image.label,
			role: image.role ?? 'gallery',
			...variants.full,
			small: variants.small
		});
		report.push({
			productId: product.id,
			source: `${product.directory}/${image.source}`,
			sourceSha256: createHash('sha256').update(input).digest('hex'),
			sourceBytes: input.length,
			...variants
		});
	}
	assets.push({ productId: product.id, images });
}
await fs.writeFile(
	path.join(repository, 'apps/website/src/lib/showcase/photo-assets.json'),
	JSON.stringify(assets, null, 2) + '\n'
);
await fs.writeFile(
	new URL('./showcase-media-report.json', import.meta.url),
	JSON.stringify(
		{
			schemaVersion: 1,
			recipe: 'webp-1600-640-v1',
			sharp: sharp.versions.sharp,
			images: report
		},
		null,
		2
	) + '\n'
);
const total = (key) =>
	report.reduce(
		(sum, image) =>
			sum +
			(key === 'sourceBytes'
				? image[key]
				: key === 'small' && image.small.src === image.full.src
					? 0
					: image[key].bytes),
		0
	);
console.log(
	`Prepared ${report.length} images: ${total('sourceBytes')} source bytes → ${total('full')} full-size WebP bytes + ${total('small')} responsive WebP bytes.`
);
