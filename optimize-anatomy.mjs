// Offline-only simplification; no decoder or WebAssembly runs in the app.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;
const modelPath = new URL('./assets/anatomy/body.glb', import.meta.url);
const creditsPath = new URL('./assets/anatomy/credits.json', import.meta.url);
const file = await readFile(modelPath);
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
const source = file.subarray(28 + jsonLength);
const credits = JSON.parse(await readFile(creditsPath, 'utf8'));
if (credits.optimization) throw new Error('Regenerate the source GLB before optimizing again.');
const oldAccessors = gltf.accessors, oldViews = gltf.bufferViews;
gltf.accessors = []; gltf.bufferViews = [];
const chunks = [];
let length = 0, triangles = 0, largestError = 0;
function values(index, ArrayType, width) {
    const accessor = oldAccessors[index], view = oldViews[accessor.bufferView];
    return new ArrayType(source.buffer, source.byteOffset + view.byteOffset + (accessor.byteOffset || 0), accessor.count * width);
}
function add(values, componentType, width, target) {
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    const view = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target });
    chunks.push(bytes); length += bytes.length;
    const accessor = { bufferView: view, componentType, count: values.length / width, type: width === 3 ? 'VEC3' : 'SCALAR' };
    if (width === 3) {
        accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < values.length; i++) {
            accessor.min[i % 3] = Math.min(accessor.min[i % 3], values[i]);
            accessor.max[i % 3] = Math.max(accessor.max[i % 3], values[i]);
        }
    }
    gltf.accessors.push(accessor);
    return gltf.accessors.length - 1;
}
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const positions = values(primitive.attributes.POSITION, Float32Array, 3);
    const normals = values(primitive.attributes.NORMAL, Float32Array, 3);
    const original = values(primitive.indices, Uint32Array, 1);
    const [indices, error] = MeshoptSimplifier.simplify(original, positions, 3, Math.floor(original.length * .30 / 3) * 3, .00035, ['LockBorder', 'ErrorAbsolute']);
    largestError = Math.max(largestError, error);
    const remap = new Int32Array(positions.length / 3).fill(-1);
    const compactPositions = [], compactNormals = [];
    let count = 0;
    for (let i = 0; i < indices.length; i++) {
        const old = indices[i];
        if (remap[old] < 0) {
            remap[old] = count++;
            for (let axis = 0; axis < 3; axis++) {
                compactPositions.push(positions[old * 3 + axis]);
                compactNormals.push(normals[old * 3 + axis]);
            }
        }
        indices[i] = remap[old];
    }
    const compactIndices = count <= 65535 ? new Uint16Array(indices) : indices;
    primitive.attributes.POSITION = add(new Float32Array(compactPositions), 5126, 3, 34962);
    primitive.attributes.NORMAL = add(new Float32Array(compactNormals), 5126, 3, 34962);
    primitive.indices = add(compactIndices, count <= 65535 ? 5123 : 5125, 1, 34963);
    triangles += indices.length / 3;
}
gltf.buffers = [{ byteLength: length }];
const json = Buffer.from(JSON.stringify(gltf));
const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 32);
const binaryPadding = Buffer.alloc((4 - length % 4) % 4);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + jsonPadding.length + length + binaryPadding.length, 8);
header.writeUInt32LE(json.length + jsonPadding.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(length + binaryPadding.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, json, jsonPadding, binHeader, ...chunks, binaryPadding]);
credits.originalTriangles = credits.triangles;
credits.triangles = triangles;
credits.optimization = { tool: 'meshoptimizer', targetTriangleRatio: .30, algorithmErrorLimitDisplayUnits: .00035, achievedAlgorithmError: largestError, note: 'Simplifier error is a rendering metric, not a clinical accuracy or measurement guarantee. Source boundaries are locked; retained vertex normals are preserved.' };
credits.modifications.push('Offline error-bounded topology simplification and vertex compaction for browser performance. No synthetic body geometry substituted.');
credits.outputSha256 = createHash('sha256').update(output).digest('hex');
await writeFile(modelPath, output);
await writeFile(creditsPath, JSON.stringify(credits, null, 2) + '\n');
console.log(JSON.stringify({ originalTriangles: credits.originalTriangles, triangles, bytes: output.length, largestError }));
