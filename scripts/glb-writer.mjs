// Small, reproducible uncompressed glTF 2.0 writer for audited triangle geometry.
export function writeTriangleGlb(groups, options = {}) {
  if (!Array.isArray(groups) || !groups.length) throw new Error('No public geometry selected.');
  const chunks = [], bufferViews = [], accessors = [], materials = [], meshes = [], nodes = [];
  let byteLength = 0;
  const append = (values, Type, target) => {
    const array = new Type(values), bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength), aligned = Math.ceil(bytes.length / 4) * 4;
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target });
    chunks.push(bytes, Buffer.alloc(aligned - bytes.length)); byteLength += aligned;
    return index;
  };
  const accessor = (values, Type, target, type, components, componentType, bounds = false) => {
    const count = values.length / components;
    if (!Number.isInteger(count) || !values.every(Number.isFinite)) throw new Error('Malformed public geometry.');
    const data = { bufferView: append(values, Type, target), componentType, count, type };
    if (bounds) {
      data.min = Array(components).fill(Infinity); data.max = Array(components).fill(-Infinity);
      for (let i = 0; i < values.length; i++) { const axis = i % components; data.min[axis] = Math.min(data.min[axis], Math.fround(values[i])); data.max[axis] = Math.max(data.max[axis], Math.fround(values[i])); }
    }
    accessors.push(data); return accessors.length - 1;
  };
  for (const group of groups) {
    if (!Array.isArray(group.positions) || !Array.isArray(group.indices) || group.indices.length % 3 || !group.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < group.positions.length / 3)) throw new Error('Only valid indexed triangles can be exported.');
    const attributes = { POSITION: accessor(group.positions, Float32Array, 34962, 'VEC3', 3, 5126, true) };
    let normals = group.normals;
    if (!normals) {
      normals = Array(group.positions.length).fill(0);
      for (let i = 0; i < group.indices.length; i += 3) {
        const [a, b, c] = group.indices.slice(i, i + 3).map((vertex) => vertex * 3), p = group.positions;
        const ab = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], ac = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]], n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        for (const vertex of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[vertex + axis] += n[axis];
      }
      for (let i = 0; i < normals.length; i += 3) { const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]); if (length > 1e-12) { normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length; } }
    }
    if (normals.length !== group.positions.length) throw new Error('Normal count differs from vertex count.'); attributes.NORMAL = accessor(normals, Float32Array, 34962, 'VEC3', 3, 5126);
    if (group.uvs) { if (group.uvs.length !== group.positions.length / 3 * 2) throw new Error('UV count differs from vertex count.'); attributes.TEXCOORD_0 = accessor(group.uvs, Float32Array, 34962, 'VEC2', 2, 5126); }
    const color = group.color || [0.78, 0.75, 0.66, 1];
    if (color.length !== 4 || !color.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('Invalid public material color.');
    const material = { pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: group.roughness ?? 0.9 }, doubleSided: group.doubleSided === true, ...(color[3] < 1 ? { alphaMode: 'BLEND' } : {}) };
    materials.push(material);
    meshes.push({ primitives: [{ attributes, indices: accessor(group.indices, Uint32Array, 34963, 'SCALAR', 1, 5125), material: materials.length - 1, mode: 4 }] });
    nodes.push({ mesh: meshes.length - 1, ...(group.spaceId ? { extras: { spaceId: group.spaceId } } : {}) });
  }
  const document = { asset: { version: '2.0', generator: 'Campus audited triangle writer 1' }, scene: 0, scenes: [{ nodes: nodes.map((_, index) => index) }], nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength }], ...(options.extras ? { extras: options.extras } : {}) };
  const json = Buffer.from(JSON.stringify(document)), jsonLength = Math.ceil(json.length / 4) * 4, binary = Buffer.concat(chunks), output = Buffer.alloc(12 + 8 + jsonLength + 8 + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8); output.writeUInt32LE(jsonLength, 12); output.writeUInt32LE(0x4e4f534a, 16); output.fill(32, 20, 20 + jsonLength); json.copy(output, 20); output.writeUInt32LE(binary.length, 20 + jsonLength); output.writeUInt32LE(0x004e4942, 24 + jsonLength); binary.copy(output, 28 + jsonLength);
  return output;
}
