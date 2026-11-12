import sharp from 'sharp';

const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const clamp = (v) => Math.max(0, Math.min(1, v));
const channels = ['baseColor', 'metallicRoughness', 'normal'];
const propertyName = (channel) => channel[0].toUpperCase() + channel.slice(1);
const powerOfTwo = (value) => 2 ** Math.ceil(Math.log2(Math.max(1, value)));

/**
 * Repack existing PBR textures, including authored normal-map lettering. No
 * geometric detail is invented or baked. Unsupported PBR properties are skipped.
 * Channels have independent compact atlases and UV sets: solid colors cost only
 * an 8px tile instead of wasting a full-resolution normal/roughness/color tile.
 */
export async function atlasMaterials(document, { tileSize }) {
	const root = document.getRoot();
	const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
	const groups = new Map();
	const pixels = new Map();
	for (const material of root.listMaterials()) {
		const parts = primitives.filter((primitive) => primitive.getMaterial() === material);
		if (
			!parts.length ||
			material.listExtensions().length ||
			material.getEmissiveTexture() ||
			material.getEmissiveFactor().some((v) => v !== 0) ||
			material.getOcclusionTexture()
		)
			continue;
		const infos = channels
			.map((channel) => material[`get${propertyName(channel)}TextureInfo`]())
			.filter(Boolean);
		if (infos.some((info) => info.getTexCoord() !== 0 || info.listExtensions().length)) continue;
		if (parts.some((primitive) => primitive.getAttribute('COLOR_0'))) continue;
		const key = `${material.getAlphaMode()}:${material.getAlphaCutoff()}:${material.getDoubleSided()}`;
		const group = groups.get(key) ?? [];
		group.push({ material, parts });
		groups.set(key, group);
	}
	let materialCount = 0;
	for (const entries of groups.values()) {
		if (entries.length < 2) continue;
		const reference = entries[0].material;
		const atlas = document
			.createMaterial('showcase-atlas')
			.setBaseColorFactor([1, 1, 1, 1])
			.setMetallicFactor(1)
			.setRoughnessFactor(1)
			.setAlphaMode(reference.getAlphaMode())
			.setAlphaCutoff(reference.getAlphaCutoff())
			.setDoubleSided(reference.getDoubleSided());
		for (const entry of entries) {
			entry.uvs = new Map(
				entry.parts.map((primitive) => [primitive, primitive.getAttribute('TEXCOORD_0')])
			);
			const min = [Infinity, Infinity],
				max = [-Infinity, -Infinity];
			for (const uv of entry.uvs.values()) {
				if (!uv) continue;
				for (let i = 0; i < uv.getCount(); i++) {
					const point = uv.getElement(i, []);
					for (let axis = 0; axis < 2; axis++) {
						min[axis] = Math.min(min[axis], point[axis]);
						max[axis] = Math.max(max[axis], point[axis]);
					}
				}
			}
			if (!Number.isFinite(min[0])) {
				min.fill(0);
				max.fill(1);
			}
			entry.min = min;
			entry.span = max.map((value, axis) => Math.max(value - min[axis], 0.000001));
		}
		for (const [texCoord, channel] of channels.entries()) {
			const property = propertyName(channel);
			const tiles = [];
			for (const entry of entries) {
				const texture = entry.material[`get${property}Texture`]();
				let source;
				if (texture) {
					if (!pixels.has(texture)) {
						const decoded = await sharp(texture.getImage())
							.ensureAlpha()
							.raw()
							.toBuffer({ resolveWithObject: true });
						const stats = await sharp(texture.getImage()).stats();
						pixels.set(texture, {
							data: decoded.data,
							pixelInfo: decoded.info,
							constant: stats.channels.every((channel) => channel.max === channel.min)
						});
					}
					source = { ...pixels.get(texture), info: entry.material[`get${property}TextureInfo`]() };
				}
				const constant = !source || source.constant;
				const requested = constant
					? [8, 8]
					: [source.pixelInfo.width * entry.span[0], source.pixelInfo.height * entry.span[1]];
				const scale = Math.min(1, tileSize / Math.max(...requested));
				const width = constant
					? 8
					: Math.min(tileSize, Math.max(16, powerOfTwo(requested[0] * scale)));
				const height = constant
					? 8
					: Math.min(tileSize, Math.max(16, powerOfTwo(requested[1] * scale)));
				// Prefilter repeated textures to the atlas sampling footprint. Sampling a
				// 1024px fabric normal map repeated 20 times into 128px aliases badly.
				if (source && !constant) {
					const sampled = await sharp(source.data, { raw: source.pixelInfo })
						.resize(
							Math.min(source.pixelInfo.width, Math.max(1, Math.ceil(width / entry.span[0]))),
							Math.min(source.pixelInfo.height, Math.max(1, Math.ceil(height / entry.span[1]))),
							{ fit: 'fill', kernel: 'lanczos3' }
						)
						.raw()
						.toBuffer({ resolveWithObject: true });
					source = { ...source, data: sampled.data, pixelInfo: sampled.info };
				}
				tiles.push({ entry, source, constant, width, height });
			}
			const { width, height } = pack(tiles);
			const image = Buffer.alloc(width * height * 4);
			for (const tile of tiles) {
				const {
					entry,
					source,
					constant,
					left,
					top,
					width: tileWidth,
					height: tileHeight,
					gutter
				} = tile;
				for (let y = -gutter; y < tileHeight + gutter; y++) {
					for (let x = -gutter; x < tileWidth + gutter; x++) {
						const u = entry.min[0] + clamp((x + 0.5) / tileWidth) * entry.span[0];
						const v = entry.min[1] + clamp((y + 0.5) / tileHeight) * entry.span[1];
						const value = sample(
							source,
							u,
							v,
							channel === 'normal' ? [0.5, 0.5, 1, 1] : [1, 1, 1, 1]
						);
						const color = bakeValue(entry.material, channel, value);
						const target = ((top + y) * width + left + x) * 4;
						for (let c = 0; c < 4; c++) image[target + c] = Math.round(clamp(color[c]) * 255);
					}
				}
				for (const primitive of entry.parts) {
					const previous = entry.uvs.get(primitive);
					if (source && !previous)
						throw new Error(`Textured primitive without TEXCOORD_0: ${entry.material.getName()}`);
					const count = primitive.getAttribute('POSITION').getCount();
					const uv = new Float32Array(count * 2);
					for (let i = 0; i < count; i++) {
						const point = constant ? [0.5, 0.5] : previous.getElement(i, []);
						uv[i * 2] =
							(left +
								(constant ? 0.5 : clamp((point[0] - entry.min[0]) / entry.span[0])) * tileWidth) /
							width;
						uv[i * 2 + 1] =
							(top +
								(constant ? 0.5 : clamp((point[1] - entry.min[1]) / entry.span[1])) * tileHeight) /
							height;
					}
					primitive.setAttribute(
						`TEXCOORD_${texCoord}`,
						document.createAccessor().setType('VEC2').setArray(uv).setBuffer(root.listBuffers()[0])
					);
				}
			}
			const encoded = await sharp(image, { raw: { width, height, channels: 4 } })
				.png()
				.toBuffer();
			const texture = document
				.createTexture(`showcase-${channel}-atlas`)
				.setMimeType('image/png')
				.setImage(encoded);
			atlas[`set${property}Texture`](texture);
			atlas[`get${property}TextureInfo`]().setTexCoord(texCoord).setWrapS(33071).setWrapT(33071);
		}
		for (const { parts } of entries) for (const primitive of parts) primitive.setMaterial(atlas);
		materialCount += entries.length;
	}
	return materialCount;
}

function pack(tiles) {
	const gutter = 4;
	const area = tiles.reduce(
		(sum, tile) => sum + (tile.width + gutter * 2) * (tile.height + gutter * 2),
		0
	);
	// WebGPU supports non-power-of-two textures. Rounding a 512px tile + its
	// gutter up to 1024px in both axes would quadruple GPU memory needlessly.
	const width =
		Math.ceil(Math.max(Math.sqrt(area), ...tiles.map((tile) => tile.width + gutter * 2)) / 16) * 16;
	const ordered = [...tiles].sort((a, b) => b.height - a.height || b.width - a.width);
	let x = 0,
		y = 0,
		rowHeight = 0;
	for (const tile of ordered) {
		if (x + tile.width + gutter * 2 > width) {
			x = 0;
			y += rowHeight;
			rowHeight = 0;
		}
		tile.left = x + gutter;
		tile.top = y + gutter;
		tile.gutter = gutter;
		x += tile.width + gutter * 2;
		rowHeight = Math.max(rowHeight, tile.height + gutter * 2);
	}
	return { width, height: Math.ceil((y + rowHeight) / 16) * 16 };
}

function bakeValue(material, channel, value) {
	if (channel === 'baseColor') {
		const factor = material.getBaseColorFactor();
		return [
			...value.slice(0, 3).map((v, c) => linearToSrgb(srgbToLinear(v) * factor[c])),
			value[3] * factor[3]
		];
	}
	if (channel === 'metallicRoughness')
		return [
			1,
			value[1] * material.getRoughnessFactor(),
			value[2] * material.getMetallicFactor(),
			1
		];
	const direction = [
		(value[0] * 2 - 1) * material.getNormalScale(),
		(value[1] * 2 - 1) * material.getNormalScale(),
		value[2] * 2 - 1
	];
	const length = Math.hypot(...direction) || 1;
	return [...direction.map((v) => (v / length) * 0.5 + 0.5), 1];
}

function sample(source, u, v, fallback) {
	if (!source) return fallback;
	const {
		data,
		info,
		pixelInfo: { width, height, channels: count }
	} = source;
	if (source.constant) return [data[0], data[1], data[2], data[3]].map((v) => v / 255);
	const wrap = (coordinate, mode) =>
		mode === 33071
			? clamp(coordinate)
			: mode === 33648
				? 1 - Math.abs((((coordinate % 2) + 2) % 2) - 1)
				: ((coordinate % 1) + 1) % 1;
	const x = Math.max(0, Math.min(width - 1, wrap(u, info.getWrapS()) * width - 0.5));
	const y = Math.max(0, Math.min(height - 1, wrap(v, info.getWrapT()) * height - 0.5));
	const x0 = Math.floor(x),
		y0 = Math.floor(y),
		x1 = Math.min(width - 1, x0 + 1),
		y1 = Math.min(height - 1, y0 + 1);
	const result = [];
	for (let c = 0; c < 4; c++) {
		const a = data[(y0 * width + x0) * count + c],
			b = data[(y0 * width + x1) * count + c];
		const d = data[(y1 * width + x0) * count + c],
			e = data[(y1 * width + x1) * count + c];
		result.push(
			((a * (1 - (x - x0)) + b * (x - x0)) * (1 - (y - y0)) +
				(d * (1 - (x - x0)) + e * (x - x0)) * (y - y0)) /
				255
		);
	}
	return result;
}
