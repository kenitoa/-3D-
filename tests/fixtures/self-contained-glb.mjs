/** Synthetic 20m by 10m triangle, with embedded binary geometry and no external resources. */
export function triangleGlb() {
  const document = {
    asset: { version: '2.0', generator: 'campus-loader-regression-fixture' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'fixture-triangle' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 44 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }, { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [20, 0, 10] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }]
  };
  const json = Buffer.from(JSON.stringify(document)), jsonLength = Math.ceil(json.length / 4) * 4;
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + 44);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonLength, 12); output.writeUInt32LE(0x4e4f534a, 16);
  output.fill(32, 20, 20 + jsonLength); json.copy(output, 20);
  const binaryHeader = 20 + jsonLength, binary = binaryHeader + 8;
  output.writeUInt32LE(44, binaryHeader); output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  [0, 0, 0, 20, 0, 0, 0, 0, 10].forEach((value, index) => output.writeFloatLE(value, binary + index * 4));
  [0, 1, 2].forEach((value, index) => output.writeUInt16LE(value, binary + 36 + index * 2));
  return output;
}
