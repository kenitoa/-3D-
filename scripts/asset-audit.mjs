import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import { writeTriangleGlb } from './glb-writer.mjs';
import '../src/domain/refinement.js';

const refinement = globalThis.CampusRefinement;
const require = createRequire(import.meta.url), B = require('babylonjs');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ab = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
async function compile(path) { const result = await build({ entryPoints: [resolve(root, path)], bundle: true, format: 'esm', platform: 'node', write: false }); return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`); }
async function safeRead(path) {
  if (typeof path !== 'string' || path.includes('..') || path.startsWith('/') || !/^(?:src\/(?:models|data)\/[a-zA-Z0-9_/-]+\.(?:js|json)|assets\/(?:models|releases)\/[a-zA-Z0-9_/-]+\.glb)$/.test(path)) throw new Error('Audit only accepts registered local public model paths.');
  const actualRoot = await realpath(root), file = await realpath(resolve(root, path)), local = relative(actualRoot, file);
  if (local.startsWith('..') || isAbsolute(local) || local.replaceAll('\\', '/') !== path) throw new Error('Audit cannot follow a link outside the registered path.');
  return readFile(file);
}
export async function auditAssets({ manifestPath = 'src/data/model-manifest.json', generateOverview = false, writeManifest = false } = {}) {
  const { validateModelManifest, validateSelfContainedGlb } = await compile('src/scene/model-loader.ts');
  const manifest = JSON.parse(await safeRead(manifestPath)); validateModelManifest(manifest);
  const report = { schemaVersion: 1, manifestVersion: manifest.version, coordinateReference: 'campus-local-east-north-altitude-meters', confirmation: 'unchanged', models: [], totalBytes: 0, sourceHashes: {}, warnings: [] };
  const context = vm.createContext({ BABYLON: B, window: {}, console: { log() {}, warn() {}, error() {} } });
  let createMaterials, sitePlan, terrain, siteFactory;
  if (generateOverview || manifest.models.some((entry) => entry.kind === 'legacy')) {
    createMaterials = (await compile('src/app.ts')).createMaterials;
    // The existing scene alignment is used, including its explicitly estimated contact adjustment.
    for (const path of ['src/data/site-plan.js', 'src/data/campus-data.js', 'src/scene/site-scene.js']) { const bytes = await readFile(resolve(root, path)); report.sourceHashes[path] = sha256(bytes); vm.runInContext(bytes.toString('utf8'), context, { filename: path, timeout: 10000 }); }
    sitePlan = context.SitePlanData; terrain = context.window.CampusData.terrain; siteFactory = context.window.CampusSiteScene;
    report.sourceHashes['src/app.ts'] = sha256(await readFile(resolve(root, 'src/app.ts')));
  }
  for (const entry of manifest.models) {
    const bytes = await safeRead(entry.source), record = { id: entry.id, source: entry.source, sourceSha256: sha256(bytes), bytes: bytes.length, status: entry.status, warnings: [] };
    report.totalBytes += bytes.length;
    if (!entry.provenance?.license) record.warnings.push('Reuse license and source provenance must be reviewed before redistribution.');
    if (entry.kind === 'glb') { validateSelfContainedGlb(ab(bytes)); record.statistics = refinement.inspectGlb(ab(bytes)); }
    else {
      const engine = new B.NullEngine(), scene = new B.Scene(engine), previousB = globalThis.BABYLON;
      globalThis.BABYLON = B;
      let site;
      try {
        const materials = createMaterials(scene); site = siteFactory.create(scene, materials, sitePlan, { terrain, createCamera: false, batchRepeatedMeshes: false });
        vm.runInContext(bytes.toString('utf8'), context, { filename: entry.source, timeout: 10000 });
        const model = context.window[entry.global][entry.export](scene, materials);
        if (!site.alignModel(model, entry.buildingId || entry.legacyId || entry.id)) throw new Error(`No registered alignment for ${entry.id}.`);
        const meshes = model.root.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0), origin = model.root.getAbsolutePosition(), originMeters = [origin.x * 10, origin.y * 10, origin.z * 10];
        const groups = new Map();
        const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }, worldBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        let triangles = 0, vertices = 0;
        for (const mesh of meshes) {
          const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind), indices = mesh.getIndices(), normals = mesh.getVerticesData(B.VertexBuffer.NormalKind);
          const material = mesh.material;
          if (!positions || !indices || !normals || !(material instanceof B.StandardMaterial) || material.getActiveTextures().length || mesh.getVerticesData(B.VertexBuffer.ColorKind) || mesh.subMeshes.length !== 1) throw new Error(`Unsupported texture, material, topology or attributes in ${mesh.name}; no lossy silent conversion is allowed.`);
          mesh.computeWorldMatrix(true);
          const matrix = mesh.getWorldMatrix(), normalMatrix = B.Matrix.Transpose(matrix.clone().invert()), color = [...material.diffuseColor.asArray(), material.alpha], roughness = material.roughness;
          const key = JSON.stringify([color, roughness, material.backFaceCulling]);
          let group = groups.get(key);
          if (!group) { group = { positions: [], normals: [], indices: [], color, roughness, doubleSided: !material.backFaceCulling, spaceId: `${manifest.campusId}:building:${entry.legacyId || entry.id}` }; groups.set(key, group); }
          const offset = group.positions.length / 3;
          for (let i = 0; i < positions.length; i += 3) {
            const point = B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions, i), matrix).scale(10), normal = B.Vector3.TransformNormal(B.Vector3.FromArray(normals, i), normalMatrix).normalize();
            // Babylon AUTO glTF root is yaw PI plus Z reflection, which equals X reflection.
            // Invert that exact packaged runtime transform instead of assuming a generic Z flip.
            const local = [-point.x + originMeters[0], point.y - originMeters[1], point.z - originMeters[2]];
            group.positions.push(...local); group.normals.push(-normal.x, normal.y, normal.z);
            for (let axis = 0; axis < 3; axis++) { bounds.min[axis] = Math.min(bounds.min[axis], local[axis]); bounds.max[axis] = Math.max(bounds.max[axis], local[axis]); worldBounds.min[axis] = Math.min(worldBounds.min[axis], point.asArray()[axis]); worldBounds.max[axis] = Math.max(worldBounds.max[axis], point.asArray()[axis]); }
          }
          // Babylon-authored primitives are clockwise relative to their outward normals.
          // Reflecting X already makes glTF CCW; preserve the original index order.
          for (let i = 0; i < indices.length; i += 3) group.indices.push(indices[i] + offset, indices[i + 1] + offset, indices[i + 2] + offset);
          triangles += indices.length / 3; vertices += positions.length / 3;
        }
        record.statistics = { meshes: meshes.length, triangles, vertices, materials: groups.size, textures: 0, bounds, worldBoundsMeters: worldBounds };
        record.placement = { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [originMeters[0], -originMeters[2], originMeters[1]], yawRadians: 0, altitudeDatum: 'local-site-meters', mode: 'inferred' };
        if (generateOverview) {
          const output = writeTriangleGlb([...groups.values()], { extras: { confirmation: 'estimated', geometrySource: 'registered-legacy-model', campusCoordinateConvention: 'babylon-auto-lh-x-reflection-v1', spaceId: `${manifest.campusId}:building:${entry.legacyId || entry.id}` } });
          validateSelfContainedGlb(ab(output)); const statistics = refinement.inspectGlb(ab(output));
          if (statistics.triangles !== triangles || statistics.vertices !== vertices) throw new Error('Export changed source geometry count.');
          const maxBoundsErrorMeters = Math.max(...bounds.min.map((value, axis) => Math.abs(value - statistics.bounds.min[axis])), ...bounds.max.map((value, axis) => Math.abs(value - statistics.bounds.max[axis])));
          if (maxBoundsErrorMeters > 0.0001) throw new Error('Export changed source bounds.');
          const source = `assets/models/generated/${entry.id}-overview.glb`; await mkdir(resolve(root, dirname(source)), { recursive: true }); await writeFile(resolve(root, source), output);
          record.overview = { source, bytes: output.length, sha256: sha256(output), statistics, maxBoundsErrorMeters, geometryCountPreserved: true, materialApproximation: 'Standard diffuse/alpha to PBR baseColor/roughness; textures are rejected' };
          entry.variants = [{ id: 'overview', kind: 'glb', source, placement: record.placement, minScreenCoverage: 0, bytes: output.length, sha256: record.overview.sha256 }, { id: 'close', kind: 'legacy', source: entry.source, global: entry.global, export: entry.export, minScreenCoverage: 0.045, maxDistanceMeters: 160 }];
          const feature = sitePlan.features.buildings.find((item) => item.id === entry.id || item.legacyKey === entry.legacyId);
          // Public evidence is a description of the source; this does not claim photo/model reuse rights.
          entry.provenance = { sourceId: feature?.sourceId || 'legacy-spatial-estimate', license: 'Project-authored estimated geometry; external source reuse rights must be checked separately', creator: 'campus-project', tool: 'Babylon NullEngine 9.29.0 + Campus triangle writer 1', settings: 'existing alignment, one primitive per material, no triangles deleted', sourceHash: record.sourceSha256 };
        }
      } finally { site?.dispose(); scene.dispose(); engine.dispose(); if (previousB === undefined) delete globalThis.BABYLON; else globalThis.BABYLON = previousB; }
    }
    report.models.push(record);
  }
  if (generateOverview && writeManifest) { manifest.version = '2026-10-07-refinement-lod-1'; validateModelManifest(manifest); await writeFile(resolve(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n'); report.manifestVersion = manifest.version; }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), output = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  if (output === undefined || args.some((arg) => !['--generate-overview', '--write-manifest', '--output'].includes(arg) && arg !== output)) throw new Error('Usage: node scripts/asset-audit.mjs [--generate-overview --write-manifest] [--output private/report.json]');
  const report = await auditAssets({ generateOverview: args.includes('--generate-overview'), writeManifest: args.includes('--write-manifest') });
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n'); }
  else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
