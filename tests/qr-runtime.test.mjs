import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import decodeQR from 'qr/decode.js';
import { TextEncoder } from 'node:util';

const compiled = await build({ entryPoints: ['scripts/qr-runtime.mjs'], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020' });
const context = vm.createContext({ window: {}, URL, TextEncoder, btoa: (value) => Buffer.from(value, 'binary').toString('base64') });
vm.runInContext(compiled.outputFiles[0].text, context, { filename: 'qr-runtime.bundle.js' });
const qr = context.window.CampusQr;
const links = [
  'http://127.0.0.1:8765/?version=1&campusId=hanshin-gg&entityId=hanshin-gg%3Abuilding%3Ajanggong&view=top&layers=boundary%2Cbuildings%2Ctrees',
  'https://campus.example.test/app/?version=1&campusId=hanshin-gg&entityId=hanshin-gg%3Abuilding%3Apilheon&floorId=hanshin-gg%3Abuilding%3Apilheon%3Afloor%3A2f&view=2d&layers=boundary&time=2026-10-07T08%3A00%3A00Z',
  'https://campus.example.test/?q=한신대학교 경기캠퍼스&label=<script>alert(1)</script>',
];

function pixels(width, height) { const data = new Uint8ClampedArray(width * height * 4); data.fill(255); return { width, height, data }; }
function dark(image, x, y) { assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < image.width && y < image.height); const offset = (y * image.width + x) * 4; image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 0; }

// Test-only rasterization of the encoder's closed, axis-aligned unit squares.
// The QR reader below consumes the resulting artifact pixels, not a raw encoder matrix.
function svgPixels(source) {
  const dom = new JSDOM(source, { contentType: 'image/svg+xml' });
  try {
    const document = dom.window.document; const root = document.documentElement;
    assert.equal(root.localName, 'svg'); assert.equal(root.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(document.querySelector('parsererror,script,image,foreignObject,use,a'), null);
    const box = root.getAttribute('viewBox').split(/\s+/).map(Number); assert.deepEqual(box.slice(0, 2), [0, 0]); assert.equal(box[2], box[3]); assert.ok(Number.isInteger(box[2]) && box[2] > 32);
    const image = pixels(box[2], box[3]);
    for (const path of document.querySelectorAll('path')) {
      const data = path.getAttribute('d'); assert.ok(/^[MmHhVvZz\d.\s-]+$/.test(data)); const tokens = data.match(/[MmHhVvZz]|-?\d+(?:\.\d+)?/g);
      let x = 0; let y = 0; let start = null; let points = []; let index = 0;
      while (index < tokens.length) {
        const command = tokens[index++];
        if (command === 'M' || command === 'm') { const a = Number(tokens[index++]); const b = Number(tokens[index++]); x = command === 'M' ? a : x + a; y = command === 'M' ? b : y + b; start = [x, y]; points = [[x, y]]; }
        else if (command === 'h' || command === 'H') { const value = Number(tokens[index++]); x = command === 'h' ? x + value : value; points.push([x, y]); }
        else if (command === 'v' || command === 'V') { const value = Number(tokens[index++]); y = command === 'v' ? y + value : value; points.push([x, y]); }
        else if (command === 'Z' || command === 'z') { assert.ok(start); const minX = Math.min(...points.map((point) => point[0])); const minY = Math.min(...points.map((point) => point[1])); assert.equal(Math.max(...points.map((point) => point[0])) - minX, 1); assert.equal(Math.max(...points.map((point) => point[1])) - minY, 1); dark(image, minX, minY); [x, y] = start; }
        else assert.fail(`Unexpected SVG command ${command}`);
      }
    }
    assert.ok(image.data.some((value) => value === 0)); return image;
  } finally { dom.window.close(); }
}

// Small standard GIF/LZW reader for the actual generated image bytes. No image dependency.
function gifPixels(dataUrl) {
  assert.match(dataUrl, /^data:image\/gif;base64,[A-Za-z0-9+/]+=*$/);
  const data = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'); assert.match(data.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/);
  const width = data.readUInt16LE(6); const height = data.readUInt16LE(8); assert.equal(width, height); assert.ok(width > 32 && width <= 4096);
  const image = pixels(width, height); const packed = data[10]; assert.ok(packed & 128); const colorCount = 1 << ((packed & 7) + 1); const palette = data.subarray(13, 13 + colorCount * 3); let at = 13 + colorCount * 3;
  while (data[at] === 0x21) { at += 2; while (data[at]) at += 1 + data[at]; at++; }
  assert.equal(data[at++], 0x2c); assert.equal(data.readUInt16LE(at), 0); assert.equal(data.readUInt16LE(at + 2), 0); assert.equal(data.readUInt16LE(at + 4), width); assert.equal(data.readUInt16LE(at + 6), height); at += 8;
  const imageFlags = data[at++]; assert.equal(imageFlags & 0xc0, 0, 'generated image has no local palette or interlacing'); const minimum = data[at++]; assert.ok(minimum >= 2 && minimum <= 8);
  const blocks = []; while (data[at]) { const length = data[at++]; blocks.push(data.subarray(at, at + length)); at += length; } at++; assert.equal(data[at], 0x3b); assert.equal(at, data.length - 1);
  const stream = Buffer.concat(blocks); const clear = 1 << minimum; const end = clear + 1; let size = minimum + 1; let next = end + 1; let bit = 0; let previous = null; let ended = false; let table = []; const output = [];
  function reset() { table = Array.from({ length: clear }, (_, index) => [index]); size = minimum + 1; next = end + 1; previous = null; }
  function code() { assert.ok(bit + size <= stream.length * 8); let value = 0; for (let i = 0; i < size; i++, bit++) value |= ((stream[bit >> 3] >> (bit & 7)) & 1) << i; return value; }
  reset();
  while (bit + size <= stream.length * 8) {
    const value = code(); if (value === clear) { reset(); continue; } if (value === end) { ended = true; break; }
    const entry = table[value] || (value === next && previous ? [...previous, previous[0]] : null); assert.ok(entry, 'valid LZW code'); output.push(...entry);
    if (previous) { table[next++] = [...previous, entry[0]]; if (next === 1 << size && size < 12) size++; }
    previous = entry;
  }
  assert.equal(ended, true); assert.equal(output.length, width * height);
  for (let pixel = 0; pixel < output.length; pixel++) { const color = output[pixel]; assert.ok(color < colorCount); for (let channel = 0; channel < 3; channel++) image.data[pixel * 4 + channel] = palette[color * 3 + channel]; }
  return image;
}

function quietZone(image) {
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (x < 16 || y < 16 || x >= image.width - 16 || y >= image.height - 16) assert.equal(image.data[(y * image.width + x) * 4], 255, 'four modules of white quiet zone at scale four');
}

test('production GIF data URLs decode to the exact canonical campus sharing URLs', async () => {
  assert.equal(Object.isFrozen(qr), true);
  for (const link of links) { const image = gifPixels(await qr.toDataURL(link)); quietZone(image); assert.equal(decodeQR(image, { effort: 2, timeLimit: 1000 }), new URL(link).href); }
});

test('production SVG path pixels decode correctly and contain no URL markup or external resources', () => {
  for (const link of links) { const svg = qr.encodeSVG(link); const image = svgPixels(svg); quietZone(image); assert.equal(decodeQR(image, { effort: 2, timeLimit: 1000 }), new URL(link).href); assert.ok(!svg.includes('<script') && !svg.includes('href=')); }
});

test('GIF and SVG render the same QR symbol for the same complete stable state', async () => {
  const link = links[1]; const gif = gifPixels(await qr.toDataURL(link)); const svg = svgPixels(qr.encodeSVG(link));
  assert.equal(gif.width, svg.width); assert.deepEqual(gif.data, svg.data);
});

test('QR runtime rejects malformed, non-HTTP, credential-bearing and excessive URLs', async () => {
  for (const link of ['not a URL', 'javascript:alert(1)', 'data:text/html,private', 'file:///C:/private', 'ftp://example.test/', 'https://user:secret@example.test/', `https://example.test/?q=${'x'.repeat(2501)}`]) { assert.throws(() => qr.encodeSVG(link)); await assert.rejects(qr.toDataURL(link)); }
});
