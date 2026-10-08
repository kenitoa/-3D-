import type { BuildingFactory, BuildingModel, Materials, SiteScene } from '../types/site-types';
import type { Scene } from 'babylonjs';

export interface ModelPlacement {
  units: 'm' | 'cm' | 'mm';
  upAxis: 'Y' | 'Z';
  origin: [number, number, number];
  anchorMeters: [number, number, number];
  yawRadians: number;
  altitudeDatum: string;
  mode: 'measured' | 'inferred';
}
export interface ModelEntry {
  id: string;
  campusId?: string;
  buildingId?: string;
  legacyId?: string;
  kind: 'legacy' | 'glb';
  source: string;
  global?: string;
  export?: string;
  status: string;
  placement?: ModelPlacement;
  bytes?: number;
  sha256?: string;
  variants?: ModelVariant[];
  provenance?: { sourceId: string; license: string; creator?: string; tool?: string; settings?: string; sourceHash?: string };
}
export interface ModelVariant { id: string; source: string; kind?: 'legacy' | 'glb'; global?: string; export?: string; placement?: ModelPlacement; minScreenCoverage?: number; maxDistanceMeters?: number; bytes?: number; sha256?: string }
export interface VisibilitySample { id: string; distanceMeters: number; screenCoverage: number; visible: boolean; selected?: boolean }
export type LoadPriority = 'selected' | 'visible' | 'background';
export interface ModelManifest { schemaVersion: 1; version: string; campusId?: string; models: ModelEntry[] }
export interface ModelState { status: 'base' | 'queued' | 'loading' | 'ready' | 'error' | 'cancelled'; error?: string; attempts: number; variantId?: string }
export interface LoaderOptions {
  scene: Scene;
  materials: Materials;
  site: SiteScene;
  manifest: ModelManifest;
  legacyFactory: (entry: ModelEntry, signal: AbortSignal) => Promise<BuildingFactory>;
  importGlb: (entry: ModelEntry, signal: AbortSignal) => Promise<BuildingModel>;
  onLoaded?: (entry: ModelEntry, model: BuildingModel) => void;
  onState?: (id: string, state: ModelState) => void;
  maxConcurrent?: number;
  maxResidentModels?: number;
  maxResidentBytes?: number;
  minScreenCoverage?: number;
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const tuple = (value: unknown, count: number): value is number[] => Array.isArray(value) && value.length === count && value.every((n: unknown) => typeof n === 'number' && Number.isFinite(n));
export function validateModelManifest(value: unknown): asserts value is ModelManifest {
  if (!object(value) || value.schemaVersion !== 1 || typeof value.version !== 'string' || !Array.isArray(value.models)) throw new Error('Unsupported model manifest.');
  if (value.campusId !== undefined && (typeof value.campusId !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.campusId))) throw new Error('Invalid manifest campus.');
  const ids = new Set<string>();
  for (const item of value.models as unknown[]) {
    if (!object(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.source !== 'string' || typeof item.status !== 'string') throw new Error('Invalid or duplicate model registration.');
    ids.add(item.id);
    for (const key of ['campusId', 'buildingId', 'legacyId']) if (item[key] !== undefined && (typeof item[key] !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(item[key]))) throw new Error('Invalid model identity.');
    if (item.bytes !== undefined && (!Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || Number(item.bytes) > 128 * 1024 * 1024) || item.sha256 !== undefined && (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error('Invalid asset integrity metadata.');
    if (item.provenance !== undefined && (!object(item.provenance) || typeof item.provenance.sourceId !== 'string' || !item.provenance.sourceId || typeof item.provenance.license !== 'string' || !item.provenance.license.trim())) throw new Error('Invalid source or reuse license.');
    if (item.kind === 'legacy') {
      if (!/^(?:src\/models\/[a-z0-9_-]+\.js|assets\/releases\/[a-f0-9]{64}\.js)$/.test(item.source) || typeof item.global !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.global) || typeof item.export !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.export)) throw new Error('Invalid local factory registration.');
    } else if (item.kind === 'glb') {
      const placement = item.placement;
      if (!/^assets\/(?:models\/[a-zA-Z0-9_/-]+|releases\/[a-f0-9]{64})\.glb$/.test(item.source) || item.source.includes('..') || !object(placement) || !['m', 'cm', 'mm'].includes(String(placement.units)) || !['Y', 'Z'].includes(String(placement.upAxis)) || !tuple(placement.origin, 3) || !tuple(placement.anchorMeters, 3) || typeof placement.yawRadians !== 'number' || !Number.isFinite(placement.yawRadians) || typeof placement.altitudeDatum !== 'string' || !placement.altitudeDatum || !['measured', 'inferred'].includes(String(placement.mode))) throw new Error('GLB requires a local path and explicit geographic placement.');
    } else throw new Error('Unsupported model provider.');
    if (item.variants !== undefined) {
      if (!Array.isArray(item.variants) || item.variants.length > 8) throw new Error('A model supports up to eight detail variants.');
      const variantIds = new Set<string>();
      for (const variant of item.variants) {
        if (!object(variant) || typeof variant.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(variant.id) || variant.id === 'default' || variantIds.has(variant.id) || variant.minScreenCoverage !== undefined && (typeof variant.minScreenCoverage !== 'number' || !Number.isFinite(variant.minScreenCoverage) || variant.minScreenCoverage < 0 || variant.minScreenCoverage > 1) || variant.maxDistanceMeters !== undefined && (typeof variant.maxDistanceMeters !== 'number' || !Number.isFinite(variant.maxDistanceMeters) || variant.maxDistanceMeters <= 0)) throw new Error('Invalid detail variant thresholds.');
        variantIds.add(variant.id);
        validateModelManifest({ schemaVersion: 1, version: value.version, models: [{ ...item, ...variant, id: item.id, variants: undefined }] });
      }
    }
  }
}

/** Higher array positions are more detailed; a 15% deadband prevents threshold flicker. */
export function chooseModelVariant(entry: ModelEntry, sample: VisibilitySample, current = 'default'): string {
  if (!Number.isFinite(sample.distanceMeters) || sample.distanceMeters < 0 || !Number.isFinite(sample.screenCoverage) || sample.screenCoverage < 0 || sample.screenCoverage > 1) throw new Error('Invalid visibility measurement.');
  const variants = entry.variants || [];
  const match = (variant: ModelVariant, factor: number) => (variant.minScreenCoverage === undefined || sample.screenCoverage >= variant.minScreenCoverage * factor) && (variant.maxDistanceMeters === undefined || sample.distanceMeters <= variant.maxDistanceMeters / factor);
  let desired = -1;
  for (let i = 0; i < variants.length; i++) if (match(variants[i], 1)) desired = i;
  const previous = variants.findIndex((variant) => variant.id === current);
  if (desired > previous && !match(variants[desired], 1.15)) return current;
  if (desired < previous && previous >= 0 && match(variants[previous], 0.85)) return current;
  return desired < 0 ? 'default' : variants[desired].id;
}

/** Campus identity prevents an imported campus reusing similarly named factories. */
export function modelsForCampus(manifest: ModelManifest, campusId: string, features: { id: string; legacyKey?: string }[]): ModelEntry[] {
  const candidates = manifest.models.filter((entry) => (entry.campusId || manifest.campusId) === campusId);
  return features.flatMap((feature) => {
    const matches = candidates.filter((entry) => entry.buildingId === feature.id || entry.id === feature.id || Boolean(entry.legacyId && entry.legacyId === feature.legacyKey));
    const chosen = matches.find((entry) => entry.kind === 'glb') || matches[0];
    return chosen ? [chosen] : [];
  });
}

/** Reject remote buffers, codecs and textures before any glTF plugin runs. */
export function validateSelfContainedGlb(buffer: ArrayBuffer, availableDecoders: readonly string[] = []): void {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('Invalid GLB container.');
  const length = view.getUint32(12, true);
  if (20 + length > buffer.byteLength) throw new Error('Invalid GLB JSON chunk.');
  const data: unknown = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
  if (!object(data) || !object(data.asset) || data.asset.version !== '2.0') throw new Error('Invalid glTF JSON.');
  for (const key of ['buffers', 'images']) {
    const assets = data[key];
    const invalidAsset = (asset: unknown) => {
      if (!object(asset)) return true;
      if (asset.uri === undefined) return false;
      return typeof asset.uri !== 'string' || !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\s]*$/.test(asset.uri);
    };
    if (assets !== undefined && (!Array.isArray(assets) || assets.some(invalidAsset))) throw new Error('Only self-contained GLB buffers and images are supported.');
  }
  for (const key of ['extensionsRequired', 'extensionsUsed']) if (Array.isArray(data[key]) && data[key].some((name: unknown) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(String(name)) && !availableDecoders.includes(String(name)))) throw new Error('This GLB requires an unavailable external decoder.');
  const queue: unknown[] = [data];
  while (queue.length) {
    const value = queue.pop();
    if (Array.isArray(value)) queue.push(...value);
    else if (object(value)) for (const [key, item] of Object.entries(value)) {
      if (['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(key) && !availableDecoders.includes(key)) throw new Error('Decoder-dependent GLB extensions are unsupported.');
      if (key === 'uri' && (typeof item !== 'string' || !item.startsWith('data:'))) throw new Error('External GLB extension resources are unsupported.');
      if (typeof item === 'object' && item !== null) queue.push(item);
    }
  }
}

/** Same ID/state contract for old factories and explicitly placed GLB assets. */
export function createModelLoader(options: LoaderOptions) {
  validateModelManifest(options.manifest);
  const entries = new Map(options.manifest.models.map((entry) => [entry.id, entry]));
  const states = new Map<string, ModelState>();
  const models = new Map<string, BuildingModel>();
  interface Request { id: string; variantId: string; entry: ModelEntry; priority: number; sequence: number; started: boolean; aborter: AbortController; attempts: number; promise: Promise<BuildingModel | null>; resolve: (model: BuildingModel | null) => void; detach: () => void }
  const pending = new Map<string, Request>();
  const intents = new Map<string, number>();
  const failedVariants = new Map<string, string>();
  const resident = new Map<string, { variantId: string; bytes: number; lastUsed: number; priority: number }>();
  const queue: Request[] = [];
  const maxConcurrent = options.maxConcurrent ?? 2, maxResidentModels = options.maxResidentModels ?? 32, maxResidentBytes = options.maxResidentBytes ?? 256 * 1024 * 1024;
  const minScreenCoverage = options.minScreenCoverage ?? 0.003;
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 8 || !Number.isInteger(maxResidentModels) || maxResidentModels < 1 || maxResidentModels > 1000 || !Number.isSafeInteger(maxResidentBytes) || maxResidentBytes < 1024) throw new Error('Invalid model resource budgets.');
  if (!Number.isFinite(minScreenCoverage) || minScreenCoverage < 0 || minScreenCoverage > 1) throw new Error('Invalid proxy detail threshold.');
  const priorityValue = (priority: LoadPriority = 'selected') => priority === 'selected' ? 0 : priority === 'visible' ? 1 : 2;
  let sequence = 0, active = 0, evictions = 0, completed = 0, failed = 0;
  let disposed = false;
  const publish = (id: string, state: ModelState) => { states.set(id, state); options.onState?.(id, { ...state }); };
  const destroy = (model: BuildingModel) => { options.site.releaseModel?.(model); if (model.dispose) model.dispose(); else model.root.dispose(false, false); };
  const estimateBytes = (model: BuildingModel) => model.root.getChildMeshes().reduce((total, mesh) => total + mesh.getTotalVertices() * 48 + mesh.getTotalIndices() * 4, 0);
  const residentBytes = () => [...resident.values()].reduce((sum, value) => sum + value.bytes, 0);
  const abort = (id: string, invalidate = true) => { if (invalidate) intents.set(id, (intents.get(id) || 0) + 1); const request = pending.get(id); if (!request) return; request.aborter.abort(); if (!request.started) { const index = queue.indexOf(request); if (index >= 0) queue.splice(index, 1); pending.delete(id); request.detach(); request.resolve(null); publish(id, { status: 'cancelled', attempts: request.attempts, variantId: resident.get(id)?.variantId }); } };
  const release = (id: string) => {
    abort(id);
    const model = models.get(id);
    if (model) { destroy(model); models.delete(id); resident.delete(id); }
    options.site.setBuildingDetailVisible?.(id, false);
    if (!disposed) publish(id, { status: 'base', attempts: states.get(id)?.attempts || 0 });
  };
  const enforceBudget = (protectedId: string) => {
    while (models.size > maxResidentModels || residentBytes() > maxResidentBytes) {
      const candidate = [...resident.entries()].filter(([id]) => id !== protectedId && !pending.has(id)).sort((a, b) => b[1].priority - a[1].priority || a[1].lastUsed - b[1].lastUsed)[0];
      if (!candidate) break;
      release(candidate[0]); evictions++;
    }
  };
  const run = async (request: Request) => {
    const { id, entry, aborter, attempts } = request;
    publish(id, { status: 'loading', attempts, variantId: request.variantId });
      let model: BuildingModel | null = null;
      try {
        if (aborter.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (entry.kind === 'legacy') {
          const factory = await options.legacyFactory(entry, aborter.signal);
          if (aborter.signal.aborted || disposed) throw new DOMException('Cancelled', 'AbortError');
          const existingMeshes = new Set(options.scene.meshes); const existingNodes = new Set(options.scene.transformNodes);
          try { model = factory(options.scene, options.materials); }
          catch (error) { options.scene.meshes.filter((mesh) => !existingMeshes.has(mesh)).forEach((mesh) => mesh.dispose(false, false)); options.scene.transformNodes.filter((node) => !existingNodes.has(node)).forEach((node) => node.dispose(false, false)); throw error; }
        } else model = await options.importGlb(entry, aborter.signal);
        if (disposed || aborter.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (entry.kind === 'legacy') {
          const aligned = options.site.alignModel(model, entry.buildingId || entry.legacyId || id);
          if (aligned === false) throw new Error('Building alignment failed.');
        }
        model.root.metadata = { ...(model.root.metadata || {}), modelEntryId: id, featureId: model.root.metadata?.featureId || entry.legacyId || id, placementStatus: entry.placement?.mode || 'inferred' };
        const bytes = entry.bytes || estimateBytes(model);
        if (bytes > maxResidentBytes) throw new Error('Detail exceeds the configured resident asset budget.');
        const previous = models.get(id);
        if (previous) destroy(previous);
        models.set(id, model); options.site.setBuildingDetailVisible?.(id, true);
        resident.set(id, { variantId: request.variantId, bytes, lastUsed: ++sequence, priority: request.priority });
        enforceBudget(id);
        options.onLoaded?.(entry, model); publish(id, { status: 'ready', attempts, variantId: request.variantId }); completed++;
        request.resolve(model);
      } catch (error) {
        if (model) { destroy(model); if (models.get(id) === model) { models.delete(id); resident.delete(id); } }
        // A failed replacement leaves the previously approved detail visible.
        const previous = models.get(id);
        options.site.setBuildingDetailVisible?.(id, Boolean(previous));
        const cancelled = disposed || aborter.signal.aborted;
        publish(id, { status: cancelled ? 'cancelled' : 'error', error: error instanceof Error ? error.message : 'Model unavailable.', attempts, variantId: resident.get(id)?.variantId });
        if (!cancelled) { failed++; failedVariants.set(id, request.variantId); }
        request.resolve(null);
      } finally {
        request.detach(); pending.delete(id); active--; pump();
      }
  };
  function pump(): void {
    if (disposed) return;
    queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    while (active < maxConcurrent && queue.length) {
      const request = queue.shift(); if (!request) break;
      if (request.aborter.signal.aborted) { abort(request.id); continue; }
      request.started = true; active++; void run(request);
    }
  }
  function load(id: string, loadOptions: { signal?: AbortSignal; priority?: LoadPriority; variantId?: string } = {}, expectedIntent?: number): Promise<BuildingModel | null> {
    if (disposed || loadOptions.signal?.aborted) return Promise.resolve(null);
    const base = entries.get(id);
    if (!base) { publish(id, { status: 'base', attempts: 0 }); return Promise.resolve(null); }
    const variantId = loadOptions.variantId || 'default', variant = base.variants?.find((item) => item.id === variantId);
    if (variantId !== 'default' && !variant) return Promise.reject(new Error('Unknown model detail variant.'));
    const priority = priorityValue(loadOptions.priority);
    if (expectedIntent !== undefined && intents.get(id) !== expectedIntent) return Promise.resolve(null);
    const existing = pending.get(id);
    if (existing && existing.variantId === variantId && !existing.aborter.signal.aborted) { existing.priority = Math.min(existing.priority, priority); return existing.promise; }
    const intent = expectedIntent ?? (intents.get(id) || 0) + 1;
    intents.set(id, intent);
    const cached = resident.get(id);
    if (cached && cached.variantId === variantId) { if (existing) abort(id, false); cached.lastUsed = ++sequence; cached.priority = priority; return Promise.resolve(models.get(id) || null); }
    if (existing) {
      abort(id, false);
      return existing.promise.then(() => load(id, loadOptions, intent));
    }
    failedVariants.delete(id);
    const entry: ModelEntry = variant ? { ...base, ...variant, id, variants: undefined } : { ...base, variants: undefined };
    let resolve!: (model: BuildingModel | null) => void;
    const promise = new Promise<BuildingModel | null>((done) => { resolve = done; });
    const aborter = new AbortController(), cancel = () => abort(id);
    const request: Request = { id, variantId, entry, priority, sequence: ++sequence, started: false, aborter, attempts: (states.get(id)?.attempts || 0) + 1, promise, resolve, detach: () => loadOptions.signal?.removeEventListener('abort', cancel) };
    pending.set(id, request); queue.push(request);
    loadOptions.signal?.addEventListener('abort', cancel, { once: true });
    publish(id, { status: 'queued', attempts: request.attempts, variantId }); pump();
    return promise;
  }
  return {
    load, models,
    async retry(id: string) { const current = pending.get(id); const variantId = current?.variantId || failedVariants.get(id) || resident.get(id)?.variantId || 'default'; release(id); const intent = intents.get(id); await current?.promise; return intent === undefined ? load(id, { variantId }) : load(id, { variantId }, intent); },
    cancel: (id: string) => abort(id),
    getState(id: string): ModelState { return { ...(states.get(id) || { status: 'base', attempts: 0 }) }; },
    getDiagnostics() { return { registered: entries.size, loaded: models.size, pending: pending.size, active, queued: queue.length, residentBytes: residentBytes(), maxConcurrent, maxResidentModels, maxResidentBytes, minScreenCoverage, evictions, completed, failed, variants: Object.fromEntries([...resident].map(([id, item]) => [id, item.variantId])), states: Object.fromEntries(states), disposed }; },
    async prefetch(ids = [...entries.keys()]) { await Promise.all(ids.map((id) => load(id, { priority: 'background' }))); },
    async updateVisibility(samples: VisibilitySample[]) {
      const ids = new Set<string>();
      const ranked: { sample: VisibilitySample; variantId: string; bytes: number }[] = [];
      for (const sample of samples) {
        if (ids.has(sample.id)) throw new Error('Duplicate visibility sample.'); ids.add(sample.id);
        const entry = entries.get(sample.id); if (!entry) continue;
        const variantId = chooseModelVariant(entry, sample, resident.get(sample.id)?.variantId), variant = entry.variants?.find((item) => item.id === variantId);
        if (sample.selected || sample.visible && sample.screenCoverage >= minScreenCoverage) ranked.push({ sample, variantId, bytes: variant?.bytes || entry.bytes || resident.get(sample.id)?.bytes || 0 });
      }
      ranked.sort((a, b) => Number(Boolean(b.sample.selected)) - Number(Boolean(a.sample.selected)) || b.sample.screenCoverage - a.sample.screenCoverage || a.sample.distanceMeters - b.sample.distanceMeters || a.sample.id.localeCompare(b.sample.id));
      const admitted: typeof ranked = []; let admittedBytes = 0;
      for (const candidate of ranked) if (admitted.length < maxResidentModels && admittedBytes + candidate.bytes <= maxResidentBytes) { admitted.push(candidate); admittedBytes += candidate.bytes; }
      const allowed = new Set(admitted.map(({ sample }) => sample.id));
      for (const id of new Set([...pending.keys(), ...resident.keys()])) if (!allowed.has(id)) release(id);
      return Promise.all(admitted.map(({ sample, variantId }) => failedVariants.get(sample.id) === variantId ? Promise.resolve(models.get(sample.id) || null) : load(sample.id, { variantId, priority: sample.selected ? 'selected' : 'visible' })));
    },
    release,
    dispose() { disposed = true; [...pending.keys()].forEach((id) => abort(id)); [...models.keys()].forEach(release); }
  };
}

export interface LocalDecoderRegistry { draco?: { javascript: string; wasm: string; fallback: string }; meshopt?: { javascript: string }; basis?: { javascript: string; wasm: string } }
/** Configuration only accepts packaged decoder paths; no decoder is declared supported before installation. */
export function configureLocalDecoders(B: typeof import('babylonjs'), registry: LocalDecoderRegistry): string[] {
  const paths = Object.values(registry).flatMap((item) => Object.values(item));
  if (paths.some((path) => typeof path !== 'string' || !/^vendor\/decoders\/[a-zA-Z0-9_/-]+\.(?:js|wasm)$/.test(path) || path.includes('..'))) throw new Error('Decoders must be packaged local runtime assets.');
  if (registry.basis) throw new Error('KTX2 requires the complete audited transcoder bundle and remains unsupported.');
  const supported: string[] = [];
  if (registry.draco) { B.DracoCompression.Configuration = { decoder: { wasmUrl: `./${registry.draco.javascript}`, wasmBinaryUrl: `./${registry.draco.wasm}`, fallbackUrl: `./${registry.draco.fallback}` } }; supported.push('KHR_draco_mesh_compression'); }
  if (registry.meshopt) { B.MeshoptCompression.Configuration = { decoder: { url: `./${registry.meshopt.javascript}` } }; supported.push('EXT_meshopt_compression'); }
  // KTX2 requires more than a Basis pair in Babylon (MSC/transcoder variants); reject partial registration.
  return supported;
}

async function verifyAssetBytes(buffer: ArrayBuffer, entry: ModelEntry): Promise<void> {
  if (entry.bytes !== undefined && buffer.byteLength !== entry.bytes) throw new Error('Model byte length differs from its approved manifest.');
  const approvedHash = entry.sha256 || entry.source.match(/^assets\/releases\/([a-f0-9]{64})\.glb$/)?.[1];
  if (approvedHash) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (hash !== approvedHash) throw new Error('Model hash differs from its approved manifest.');
  }
}

/** Project-generated assets explicitly invert Babylon's AUTO left-handed root.
 * Keep that transform consistent when the surrounding scene is right-handed.
 * Ordinary external GLB assets retain the packaged Babylon import contract.
 */
export function normalizeGeneratedGlbRoots(B: typeof import('babylonjs'), container: import('babylonjs').AssetContainer, scene: Scene, buffer: ArrayBuffer): void {
  const view = new DataView(buffer), length = view.getUint32(12, true);
  const document: unknown = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
  if (!object(document) || !object(document.extras) || document.extras.campusCoordinateConvention !== 'babylon-auto-lh-x-reflection-v1') return;
  if (!scene.useRightHandedSystem) return;
  const root = container.rootNodes.find((node) => node.name === '__root__' && node instanceof B.TransformNode);
  if (!(root instanceof B.TransformNode)) throw new Error('The packaged loader root cannot normalize this campus asset.');
  root.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
  root.scaling.set(1, 1, -1);
}

export async function browserGlbModel(B: typeof import('babylonjs'), scene: Scene, site: SiteScene, entry: ModelEntry, signal: AbortSignal, availableDecoders: readonly string[] = []): Promise<BuildingModel> {
  if (!entry.placement) throw new Error('Missing GLB placement metadata.');
  const response = await fetch(`./${entry.source}`, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`GLB unavailable (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 128 * 1024 * 1024) throw new Error('GLB exceeds the supported 128 MiB asset limit.');
  await verifyAssetBytes(buffer, entry);
  validateSelfContainedGlb(buffer, availableDecoders);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (!B.SceneLoader.IsPluginForExtensionAvailable('.glb')) throw new Error('The packaged glTF loader is unavailable.');
  let container: import('babylonjs').AssetContainer | null = null;
  let importedRoot: import('babylonjs').TransformNode | null = null;
  try {
    // Babylon's binary source path parses these already validated bytes without a second URL request.
    container = await B.SceneLoader.LoadAssetContainerAsync('', new Uint8Array(buffer), scene, undefined, '.glb');
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    normalizeGeneratedGlbRoots(B, container, scene, buffer);
    container.addAllToScene();
    const root = new B.TransformNode(`model-${entry.id}`, scene);
    importedRoot = root;
    const placement = entry.placement;
    applyModelPlacement(B, root, placement, (x, z) => site.terrainHeightAt(x, z));
    container.rootNodes.forEach((node) => { node.parent = root; });
    root.metadata = { featureId: entry.id, placementStatus: placement.mode, altitudeDatum: placement.altitudeDatum, units: placement.units, shapePreserved: true, anchorWorld: [placement.anchorMeters[0] / 10, root.position.y + B.Vector3.TransformCoordinates(B.Vector3.FromArray(placement.origin).scale(root.scaling.x), B.Matrix.RotationYawPitchRoll(root.rotation.y, root.rotation.x, 0)).y, -placement.anchorMeters[1] / 10] };
    const main = container.meshes.find((mesh): mesh is import('babylonjs').Mesh => mesh instanceof B.Mesh && mesh.getTotalVertices() > 0);
    if (!main) throw new Error('GLB has no visible geometry.');
    const owned = container;
    return { root, main, dispose() { owned.dispose(); root.dispose(); } };
  } catch (error) { container?.dispose(); importedRoot?.dispose(); throw error; }
}

export function applyModelPlacement(B: typeof import('babylonjs'), root: import('babylonjs').TransformNode, placement: ModelPlacement, terrainHeightAt: (x: number, z: number) => number): void {
  const units = placement.units === 'm' ? 1 : placement.units === 'cm' ? 0.01 : 0.001;
  root.scaling.setAll(units / 10);
  root.rotation.set(placement.upAxis === 'Z' ? -Math.PI / 2 : 0, placement.yawRadians, 0);
  const offset = B.Vector3.TransformCoordinates(B.Vector3.FromArray(placement.origin).scale(units / 10), B.Matrix.RotationYawPitchRoll(root.rotation.y, root.rotation.x, 0));
  const [east, north, altitude] = placement.anchorMeters;
  if (!['local-site-meters', 'terrain-relative'].includes(placement.altitudeDatum)) throw new Error('The supplied altitude datum cannot be converted to this site.');
  const y = placement.altitudeDatum === 'terrain-relative' ? terrainHeightAt(east / 10, -north / 10) + altitude / 10 : altitude / 10;
  root.position.set(east / 10 - offset.x, y - offset.y, -north / 10 - offset.z);
}

const sourceFactories = new Map<string, BuildingFactory>();
export function browserLegacyFactory(entry: ModelEntry, signal: AbortSignal): Promise<BuildingFactory> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const readFactory = () => {
      const namespace: unknown = Reflect.get(window, entry.global || '');
      const factory: unknown = object(namespace) ? namespace[entry.export || ''] : null;
      if (typeof factory !== 'function') throw new Error(`Factory ${entry.id} was not registered.`);
      return factory as BuildingFactory;
    };
    const cached = sourceFactories.get(entry.source);
    if (cached) { resolve(cached); return; }
    // A global export can belong to a different release. Only the exact source cache is reusable.
    const script = document.createElement('script'); script.src = `./${entry.source}`; script.async = true;
    const approvedHash = entry.sha256 || entry.source.match(/^assets\/releases\/([a-f0-9]{64})\.js$/)?.[1];
    if (approvedHash) { script.integrity = `sha256-${btoa(String.fromCharCode(...Uint8Array.from(approvedHash.match(/../g) || [], (pair) => parseInt(pair, 16))))}`; script.crossOrigin = 'anonymous'; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); script.remove(); };
    const cancel = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { finish(); reject(new Error(`Model ${entry.id} timed out.`)); }, 20000);
    script.onload = () => { try { const factory = readFactory(); sourceFactories.set(entry.source, factory); if (sourceFactories.size > 128) sourceFactories.delete(sourceFactories.keys().next().value || ''); finish(); resolve(factory); } catch (error) { finish(); reject(error); } };
    script.onerror = () => { finish(); reject(new Error(`Model ${entry.id} could not be loaded.`)); };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel(); else document.head.append(script);
  });
}
