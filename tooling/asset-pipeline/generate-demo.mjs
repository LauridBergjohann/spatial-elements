import fs from 'node:fs';
import { BoxGeometry, SphereGeometry, TorusGeometry, CylinderGeometry } from 'three';
const directory = new URL('../../fixtures/demo-assets/', import.meta.url);
fs.mkdirSync(directory, { recursive: true });
function glb(geometry, color) {
 const chunks = [], views = [], accessors = [];
 let offset = 0;
 const add = (array, type, componentType, min, max) => {
  const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4); data.copy(padded);
  views.push({ buffer: 0, byteOffset: offset, byteLength: data.length }); chunks.push(padded); offset += padded.length;
  accessors.push({ bufferView: views.length - 1, componentType, count: array.length / (type === 'VEC3' ? 3 : 1), type, ...(min && { min, max }) }); return accessors.length - 1;
 };
 geometry.computeBoundingBox();
 const position = add(geometry.attributes.position.array, 'VEC3', 5126, geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray());
 const normal = add(geometry.attributes.normal.array, 'VEC3', 5126);
 const indices = add(new Uint32Array(geometry.index.array), 'SCALAR', 5125);
 const json = { asset: { version: '2.0', generator: 'Spatial Elements procedural demo' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: position, NORMAL: normal }, indices, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0.25, roughnessFactor: 0.35 } }], buffers: [{ byteLength: offset }], bufferViews: views, accessors };
 const bytes = Buffer.from(JSON.stringify(json)); const jsonChunk = Buffer.alloc(Math.ceil(bytes.length / 4) * 4, 32); bytes.copy(jsonChunk);
 const bin = Buffer.concat(chunks), output = Buffer.alloc(28 + jsonChunk.length + bin.length);
 output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
 output.writeUInt32LE(jsonChunk.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(output, 20);
 output.writeUInt32LE(bin.length, 20 + jsonChunk.length); output.writeUInt32LE(0x004e4942, 24 + jsonChunk.length); bin.copy(output, 28 + jsonChunk.length);
 geometry.dispose(); return output;
}
const shapes = [
 ['column', [0.15, 0.4, 0.65], high => new CylinderGeometry(0.55, 0.7, 1.6, high ? 64 : 12)],
 ['orb', [0.8, 0.32, 0.13], high => new SphereGeometry(0.85, high ? 64 : 16, high ? 40 : 10)],
 ['ring', [0.2, 0.65, 0.45], high => new TorusGeometry(0.65, 0.23, high ? 32 : 8, high ? 80 : 20)]
];
for (const [id, color, geometry] of shapes) {
 for (const quality of ['low', 'high']) fs.writeFileSync(new URL(id + '-' + quality + '.glb', directory), glb(geometry(quality === 'high'), color));
 const fill = '#' + color.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
 const shape = id === 'orb' ? '<circle cx="160" cy="140" r="90" />' : id === 'ring' ? '<circle cx="160" cy="140" r="80" fill="none" stroke="' + fill + '" stroke-width="35" />' : '<path d="M100 60 Q160 35 220 60 L235 220 Q160 250 85 220 Z" />';
 fs.writeFileSync(new URL(id + '.svg', directory), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="280" viewBox="0 0 320 280"><g fill="' + fill + '">' + shape + '</g></svg>');
}
fs.writeFileSync(new URL('studio.hdr', directory), Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 4\n'), Buffer.from(Array.from({ length: 8 }, () => [128, 140, 160, 129]).flat())]));
console.log('Generated original neutral GLBs, SVG posters and studio environment');
