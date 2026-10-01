import fs from 'node:fs';
import { BoxGeometry, SphereGeometry, TorusGeometry, TorusKnotGeometry, CylinderGeometry } from 'three';
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
 ['ring', [0.2, 0.65, 0.45], high => new TorusGeometry(0.65, 0.23, high ? 32 : 8, high ? 80 : 20)],
 ['cube', [0.55, 0.3, 0.8], () => new BoxGeometry(1.25, 1.25, 1.25).rotateX(0.25).rotateY(0.4)],
 ['torus-knot', [0.9, 0.55, 0.12], high => new TorusKnotGeometry(0.53, 0.18, high ? 192 : 64, high ? 24 : 8)]
];
for (const [id, color, geometry] of shapes) {
 for (const quality of ['low', 'high']) fs.writeFileSync(new URL(id + '-' + quality + '.glb', directory), glb(geometry(quality === 'high'), color));
 const fill = '#' + color.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
 const knotPath = Array.from({ length: 193 }, (_, i) => {
  const u = i / 192 * Math.PI * 4;
  const radius = 57 * (2 + Math.cos(1.5 * u)) / 2;
  return `${i ? 'L' : 'M'}${(160 + radius * Math.cos(u)).toFixed(2)} ${(140 + radius * Math.sin(u)).toFixed(2)}`;
 }).join(' ') + ' Z';
 const shape = id === 'orb' ? '<circle cx="160" cy="140" r="90" />'
  : id === 'ring' ? '<circle cx="160" cy="140" r="80" fill="none" stroke="' + fill + '" stroke-width="35" />'
  : id === 'cube' ? '<path d="M160 42 L244 88 L160 134 L76 88 Z" /><path d="M76 88 L160 134 L160 238 L76 192 Z" opacity="0.85" /><path d="M160 134 L244 88 L244 192 L160 238 Z" opacity="0.65" />'
  : id === 'torus-knot' ? `<path d="${knotPath}" fill="none" stroke="${fill}" stroke-width="27" stroke-linejoin="round" />`
  : '<path d="M100 60 Q160 35 220 60 L235 220 Q160 250 85 220 Z" />';
 fs.writeFileSync(new URL(id + '.svg', directory), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="280" viewBox="0 0 320 280"><g fill="' + fill + '">' + shape + '</g></svg>');
}
// PMREM derives its cube size from width / 4 and needs at least 16 pixels
// per face. The old 4 x 2 placeholder produced invalid lighting mip levels.
const width = 256, height = 128;
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) {
 for (let x = 0; x < width; x++) {
  const light = 0.7 + 0.3 * Math.cos(y / (height - 1) * Math.PI)
   + 0.45 * Math.exp(-((x / width - 0.3) ** 2 + (y / height - 0.3) ** 2) / 0.025);
  const offset = (y * width + x) * 4;
  pixels.set([Math.round(128 * light), Math.round(140 * light), Math.round(160 * light), 129], offset);
 }
}
fs.writeFileSync(new URL('studio.hdr', directory), Buffer.concat([Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`), pixels]));
console.log('Generated original neutral GLBs, SVG posters and studio environment');
