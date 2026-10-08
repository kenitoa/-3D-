// Generated from server/platform.ts; run npm run build.
// server/platform.ts
import { DatabaseSync, backup } from "node:sqlite";
import { randomBytes, randomUUID, createHash as createHash2, createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { readFileSync as readFileSync3, mkdirSync, existsSync as existsSync2, realpathSync as realpathSync2, lstatSync as lstatSync2 } from "node:fs";
import { resolve as resolve2, dirname, relative as relative2, isAbsolute as isAbsolute2 } from "node:path";
import vm from "node:vm";
import { isIP as isIP2 } from "node:net";

// server/providers.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import { readFileSync } from "node:fs";
var runtimeNetwork = { lookup, request: https.request };
var record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function validateProvider(item) {
  if (!record(item)) throw new Error("Invalid provider configuration.");
  const entry = item;
  if (typeof entry.id !== "string" || !/^[a-z0-9_-]{1,64}$/.test(entry.id) || typeof entry.url !== "string" || typeof entry.sourceId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(entry.sourceId) || typeof entry.campusId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(entry.campusId) || !["catalog", "operations", "assistant"].includes(String(entry.kind)) || typeof entry.enabled !== "boolean") throw new Error("Invalid provider contract.");
  const url = new URL(entry.url);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443" || ["localhost", ".local", ".internal"].some((value) => url.hostname === value || url.hostname.endsWith(value)) || isIP(url.hostname.replace(/^\[|\]$/g, "")) && !publicNetworkAddress(url.hostname.replace(/^\[|\]$/g, ""))) throw new Error("Providers need an explicitly approved public HTTPS endpoint.");
  if (entry.secretEnv !== void 0 && entry.secretEnv !== null && (typeof entry.secretEnv !== "string" || !/^CAMPUS_PROVIDER_[A-Z0-9_]{1,64}$/.test(entry.secretEnv))) throw new Error("Provider secret keys must use CAMPUS_PROVIDER_ prefix.");
  return { id: entry.id, url: url.href, sourceId: entry.sourceId, campusId: entry.campusId, kind: entry.kind, enabled: entry.enabled, secretEnv: typeof entry.secretEnv === "string" ? entry.secretEnv : null };
}
function publicNetworkAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0);
  }
  if (isIP(address) === 6) {
    let value;
    try {
      value = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
    } catch {
      return false;
    }
    const prefix = parseInt(value.split(":")[0], 16);
    return prefix >= 8192 && prefix <= 16383 && !value.startsWith("2002:") && !value.startsWith("2001:0:") && !value.startsWith("2001::") && !value.startsWith("2001:db8:") && !/^2001:(?:2|1[0-9a-f]|2[0-9a-f]):/.test(value);
  }
  return false;
}
function loadProviders(filename) {
  if (!filename) return [];
  const text2 = readFileSync(filename, "utf8");
  if (Buffer.byteLength(text2) > 32768) throw new Error("Provider configuration is too large.");
  const value = JSON.parse(text2);
  if (!Array.isArray(value) || value.length > 20) throw new Error("Provider configuration must be an array of at most 20 providers.");
  const ids = /* @__PURE__ */ new Set();
  return value.map((item) => {
    const entry = validateProvider(item);
    if (ids.has(entry.id)) throw new Error("Invalid provider contract.");
    ids.add(entry.id);
    return entry;
  });
}
async function fetchProvider(input, payload, network = runtimeNetwork) {
  const provider = validateProvider(input);
  if (!provider.enabled) throw new Error("PROVIDER_DISABLED");
  if (provider.kind === "assistant" && payload === void 0) throw new Error("PROVIDER_PAYLOAD_REQUIRED");
  let body;
  if (payload !== void 0) {
    if (!record(payload)) throw new Error("PROVIDER_PAYLOAD_REJECTED");
    body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > 32768) throw new Error("PROVIDER_PAYLOAD_TOO_LARGE");
  }
  const timeoutMs = network.timeoutMs ?? 8e3;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8e3) throw new Error("Invalid provider deadline.");
  const deadline = Date.now() + timeoutMs;
  const url = new URL(provider.url);
  let dnsTimer;
  const addresses = await Promise.race([network.lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true }), new Promise((_accept, reject) => {
    dnsTimer = setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), timeoutMs);
  })]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((item) => !publicNetworkAddress(item.address))) throw new Error("PROVIDER_NETWORK_REJECTED");
  const selected = addresses[0];
  const token = provider.secretEnv ? process.env[provider.secretEnv] : null;
  if (provider.secretEnv && (!token || token.length > 4096 || /[\r\n]/.test(token))) throw new Error("PROVIDER_SECRET_MISSING");
  const attempt = () => new Promise((accept, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new Error("PROVIDER_TIMEOUT"));
      return;
    }
    let settled = false;
    let timer;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (Date.now() >= deadline) reject(new Error("PROVIDER_TIMEOUT"));
      else accept(result);
    };
    const request = network.request(url, { method: body === void 0 ? "GET" : "POST", timeout: remaining, family: selected.family, lookup: (_host, _options, callback) => callback(null, selected.address, selected.family), headers: { Accept: "application/json", ...body === void 0 ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, ...token ? { Authorization: `Bearer ${token}` } : {} } }, (response) => {
      if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
        response.destroy();
        finish(new Error((response.statusCode || 500) >= 500 ? "PROVIDER_TEMPORARY_FAILURE" : "PROVIDER_RESPONSE_REJECTED"));
        return;
      }
      if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(String(response.headers["content-type"] || ""))) {
        response.destroy();
        finish(new Error("PROVIDER_FORMAT_REJECTED"));
        return;
      }
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) {
          request.destroy(new Error("PROVIDER_RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", (error) => finish(error));
      response.once("end", () => {
        try {
          finish(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          finish(new Error("PROVIDER_INVALID_JSON"));
        }
      });
    });
    timer = setTimeout(() => request.destroy(new Error("PROVIDER_TIMEOUT")), remaining);
    request.once("timeout", () => request.destroy(new Error("PROVIDER_TIMEOUT")));
    request.once("error", (error) => finish(error));
    request.end(body);
  });
  try {
    return await attempt();
  } catch (error) {
    if (body === void 0 && Date.now() < deadline && error instanceof Error && (["PROVIDER_TEMPORARY_FAILURE", "PROVIDER_TIMEOUT", "ECONNRESET"].includes(error.message) || "code" in error && error.code === "ECONNRESET")) return attempt();
    throw error;
  }
}

// server/asset-bundles.ts
import { readFileSync as readFileSync2, realpathSync, lstatSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute, extname } from "node:path";
import { createHash } from "node:crypto";

// src/scene/model-loader.ts
var object = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var tuple = (value, count) => Array.isArray(value) && value.length === count && value.every((n) => typeof n === "number" && Number.isFinite(n));
function validateModelManifest(value) {
  if (!object(value) || value.schemaVersion !== 1 || typeof value.version !== "string" || !Array.isArray(value.models)) throw new Error("Unsupported model manifest.");
  if (value.campusId !== void 0 && (typeof value.campusId !== "string" || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.campusId))) throw new Error("Invalid manifest campus.");
  const ids = /* @__PURE__ */ new Set();
  for (const item of value.models) {
    if (!object(item) || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.source !== "string" || typeof item.status !== "string") throw new Error("Invalid or duplicate model registration.");
    ids.add(item.id);
    for (const key of ["campusId", "buildingId", "legacyId"]) if (item[key] !== void 0 && (typeof item[key] !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(item[key]))) throw new Error("Invalid model identity.");
    if (item.bytes !== void 0 && (!Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || Number(item.bytes) > 128 * 1024 * 1024) || item.sha256 !== void 0 && (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("Invalid asset integrity metadata.");
    if (item.provenance !== void 0 && (!object(item.provenance) || typeof item.provenance.sourceId !== "string" || !item.provenance.sourceId || typeof item.provenance.license !== "string" || !item.provenance.license.trim())) throw new Error("Invalid source or reuse license.");
    if (item.kind === "legacy") {
      if (!/^(?:src\/models\/[a-z0-9_-]+\.js|assets\/releases\/[a-f0-9]{64}\.js)$/.test(item.source) || typeof item.global !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.global) || typeof item.export !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.export)) throw new Error("Invalid local factory registration.");
    } else if (item.kind === "glb") {
      const placement = item.placement;
      if (!/^assets\/(?:models\/[a-zA-Z0-9_/-]+|releases\/[a-f0-9]{64})\.glb$/.test(item.source) || item.source.includes("..") || !object(placement) || !["m", "cm", "mm"].includes(String(placement.units)) || !["Y", "Z"].includes(String(placement.upAxis)) || !tuple(placement.origin, 3) || !tuple(placement.anchorMeters, 3) || typeof placement.yawRadians !== "number" || !Number.isFinite(placement.yawRadians) || typeof placement.altitudeDatum !== "string" || !placement.altitudeDatum || !["measured", "inferred"].includes(String(placement.mode))) throw new Error("GLB requires a local path and explicit geographic placement.");
    } else throw new Error("Unsupported model provider.");
    if (item.variants !== void 0) {
      if (!Array.isArray(item.variants) || item.variants.length > 8) throw new Error("A model supports up to eight detail variants.");
      const variantIds = /* @__PURE__ */ new Set();
      for (const variant of item.variants) {
        if (!object(variant) || typeof variant.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(variant.id) || variant.id === "default" || variantIds.has(variant.id) || variant.minScreenCoverage !== void 0 && (typeof variant.minScreenCoverage !== "number" || !Number.isFinite(variant.minScreenCoverage) || variant.minScreenCoverage < 0 || variant.minScreenCoverage > 1) || variant.maxDistanceMeters !== void 0 && (typeof variant.maxDistanceMeters !== "number" || !Number.isFinite(variant.maxDistanceMeters) || variant.maxDistanceMeters <= 0)) throw new Error("Invalid detail variant thresholds.");
        variantIds.add(variant.id);
        validateModelManifest({ schemaVersion: 1, version: value.version, models: [{ ...item, ...variant, id: item.id, variants: void 0 }] });
      }
    }
  }
}
function validateSelfContainedGlb(buffer, availableDecoders = []) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 1179937895 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 1313821514) throw new Error("Invalid GLB container.");
  const length = view.getUint32(12, true);
  if (20 + length > buffer.byteLength) throw new Error("Invalid GLB JSON chunk.");
  const data = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
  if (!object(data) || !object(data.asset) || data.asset.version !== "2.0") throw new Error("Invalid glTF JSON.");
  for (const key of ["buffers", "images"]) {
    const assets = data[key];
    const invalidAsset = (asset) => {
      if (!object(asset)) return true;
      if (asset.uri === void 0) return false;
      return typeof asset.uri !== "string" || !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\s]*$/.test(asset.uri);
    };
    if (assets !== void 0 && (!Array.isArray(assets) || assets.some(invalidAsset))) throw new Error("Only self-contained GLB buffers and images are supported.");
  }
  for (const key of ["extensionsRequired", "extensionsUsed"]) if (Array.isArray(data[key]) && data[key].some((name) => ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(String(name)) && !availableDecoders.includes(String(name)))) throw new Error("This GLB requires an unavailable external decoder.");
  const queue = [data];
  while (queue.length) {
    const value = queue.pop();
    if (Array.isArray(value)) queue.push(...value);
    else if (object(value)) for (const [key, item] of Object.entries(value)) {
      if (["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(key) && !availableDecoders.includes(key)) throw new Error("Decoder-dependent GLB extensions are unsupported.");
      if (key === "uri" && (typeof item !== "string" || !item.startsWith("data:"))) throw new Error("External GLB extension resources are unsupported.");
      if (typeof item === "object" && item !== null) queue.push(item);
    }
  }
}

// server/asset-bundles.ts
var object2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var digest = (value) => createHash("sha256").update(value).digest("hex");
var pick = (value, keys) => Object.fromEntries(keys.filter((key) => Reflect.get(value, key) !== void 0).map((key) => [key, Reflect.get(value, key)]));
var publicPlacement = (value) => pick(value, ["units", "upAxis", "origin", "anchorMeters", "yawRadians", "altitudeDatum", "mode"]);
function publicModel(model) {
  return { ...pick(model, ["id", "campusId", "buildingId", "legacyId", "kind", "source", "global", "export", "status", "bytes", "sha256"]), ...model.placement ? { placement: publicPlacement(model.placement) } : {}, ...model.provenance ? { provenance: pick(model.provenance, ["sourceId", "license", "creator", "tool", "settings", "sourceHash"]) } : {}, ...model.variants ? { variants: model.variants.map((value) => ({ ...pick(value, ["id", "source", "kind", "global", "export", "minScreenCoverage", "maxDistanceMeters", "bytes", "sha256"]), ...value.placement ? { placement: publicPlacement(value.placement) } : {} })) } : {} };
}
var extensions = { ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ktx2": "image/ktx2", ".webmanifest": "application/manifest+json", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
function safeRead(root, path) {
  if (!/^(?:index\.html|manifest\.webmanifest|service-worker\.js|src\/[a-zA-Z0-9_/-]+\.(?:js|json)|styles\/[a-zA-Z0-9_/-]+\.css|vendor\/[a-zA-Z0-9_.-]+\.(?:js|md|txt)|assets\/(?:media|ar)\/manifest\.json|assets\/[a-zA-Z0-9_/-]+\.(?:svg|glb|png|jpg|jpeg|webp|ktx2|mp4|webm|mp3|ogg|wav))$/.test(path) || path.includes("admin") || path.split("/").some((part) => part.startsWith(".")) || path === "src/ui/refinement-scene-preview.js") throw new Error("Only explicitly public runtime assets may enter a release bundle.");
  const actualRoot = realpathSync(root), file = resolve(actualRoot, path);
  if (lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile()) throw new Error("Public assets cannot be links or directories.");
  const actual = realpathSync(file), local = relative(actualRoot, actual);
  if (isAbsolute(local) || local.startsWith("..") || local.split("\\").join("/") !== path) throw new Error("Public asset escapes its registered directory.");
  const size = lstatSync(actual).size;
  if (size < 1 || size > 128 * 1024 * 1024) throw new Error("Public asset exceeds the registered file limit.");
  return readFileSync2(actual);
}
function referencesPublicBuilding(model, manifest, catalog) {
  return Array.isArray(catalog.entities) && catalog.entities.some((item) => object2(item) && item.kind === "building" && item.visibility === "public" && !item.sensitive && item.campusId === (model.campusId || manifest.campusId) && [item.id, item.legacyId, item.legacyKey].some((key) => typeof key === "string" && [model.id, model.buildingId, model.legacyId].includes(key)));
}
function prepareReleaseBundle(root, releaseId, catalog, createdAt, db) {
  const input = catalog.assetManifest || JSON.parse(readFileSync2(resolve(root, "src/data/model-manifest.json"), "utf8"));
  validateModelManifest(input);
  const sourceIds = new Set((Array.isArray(catalog.sources) ? catalog.sources : []).filter((item) => object2(item) && item.visibility === "public").map((item) => item.id));
  const manifest = { schemaVersion: 1, version: input.version, ...input.campusId && Array.isArray(catalog.campuses) && catalog.campuses.some((item) => object2(item) && item.id === input.campusId) ? { campusId: input.campusId } : {}, models: input.models.filter((model) => referencesPublicBuilding(model, input, catalog) && (!model.provenance || sourceIds.has(model.provenance.sourceId))).map(publicModel) };
  const paths = /* @__PURE__ */ new Map();
  const baselinePath = resolve(root, "offline-manifest.json");
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync2(baselinePath, "utf8"));
    if (!object2(baseline) || baseline.schemaVersion !== 1 || !Array.isArray(baseline.assets) || baseline.assets.length > 1e3) throw new Error("Invalid offline base asset manifest.");
    for (const item of baseline.assets) {
      if (!object2(item) || typeof item.path !== "string" || typeof item.sha256 !== "string" || !Number.isSafeInteger(item.bytes)) throw new Error("Invalid public base integrity metadata.");
      if (!item.detail) paths.set(item.path, { bytes: Number(item.bytes), sha256: item.sha256, detail: false });
    }
  }
  const registered = (entry) => {
    paths.set(entry.source, { bytes: entry.bytes, sha256: entry.sha256, detail: true });
    for (const variant of entry.variants || []) paths.set(variant.source, { bytes: variant.bytes, sha256: variant.sha256, detail: true });
  };
  manifest.models.forEach(registered);
  const mediaValue = JSON.parse(safeRead(root, "assets/media/manifest.json").toString("utf8"));
  if (!object2(mediaValue) || mediaValue.schemaVersion !== 1 || !Array.isArray(mediaValue.records) || mediaValue.records.length > 200) throw new Error("Invalid public media registry.");
  const publicEntityIds = new Set((Array.isArray(catalog.entities) ? catalog.entities : []).filter(object2).map((item) => item.id)), publicSourceIds = new Set((Array.isArray(catalog.sources) ? catalog.sources : []).filter(object2).map((item) => item.id));
  const mediaRecords = mediaValue.records.map((value) => {
    if (!object2(value) || value.public !== true || typeof value.path !== "string" || !/^assets\/media\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp|mp4|webm|mp3|ogg|wav)$/.test(value.path) || !publicEntityIds.has(value.entityId) || !publicSourceIds.has(value.sourceId) || typeof value.license !== "string" || !value.license.trim() || !["image", "audio", "video"].includes(String(value.kind))) throw new Error("Media needs a public space, public source and explicit reuse permission.");
    paths.set(value.path, { detail: true });
    return { entityId: value.entityId, path: value.path, kind: value.kind, sourceId: value.sourceId, license: value.license, public: true, ...typeof value.caption === "string" ? { caption: value.caption.slice(0, 500) } : {} };
  });
  const assets = [];
  let total = 0;
  for (const [path, expected] of paths) {
    const previous = path.match(/^assets\/releases\/([a-f0-9]{64})\.([a-z0-9]+)$/), stored = previous ? db.prepare("SELECT body,extension FROM public_asset_blobs WHERE sha256=? AND extension=?").get(previous[1], "." + previous[2]) : null;
    const body = stored ? Buffer.from(stored.body) : safeRead(root, path), sha256 = digest(body), extension = extname(path), mime = extensions[extension];
    if (!mime || expected.bytes !== void 0 && expected.bytes !== body.length || expected.sha256 !== void 0 && expected.sha256 !== sha256) throw new Error("Published asset bytes or SHA do not match their manifest.");
    if (extension === ".glb") {
      validateSelfContainedGlb(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
      const json = JSON.parse(body.subarray(20, 20 + body.readUInt32LE(12)).toString("utf8"));
      const entities = new Set((Array.isArray(catalog.entities) ? catalog.entities : []).filter((item) => object2(item) && item.visibility === "public" && !item.sensitive).map((item) => item.id));
      const inspect = (value) => {
        if (!value || typeof value !== "object") return;
        if (object2(value)) {
          if (value.visibility !== void 0 && value.visibility !== "public" || value.sensitive === true) throw new Error("Private geometry cannot enter a public GLB.");
          for (const key of ["entityId", "spaceId", "floorId"]) if (value[key] !== void 0 && !entities.has(value[key])) throw new Error("GLB semantics reference a private or unknown space.");
        }
        for (const child of Object.values(value)) inspect(child);
      };
      inspect(json);
    }
    total += body.length;
    if (total > 200 * 1024 * 1024) throw new Error("A public release bundle exceeds the 200 MiB limit.");
    assets.push({ snapshot: { path: `assets/releases/${sha256}${extension}`, originalPath: path, bytes: body.length, sha256, detail: expected.detail }, body, extension, mime });
  }
  const renamed = new Map(assets.map((asset) => [asset.snapshot.originalPath, asset.snapshot]));
  const models = manifest.models.map((model) => ({ ...model, source: renamed.get(model.source).path, bytes: renamed.get(model.source).bytes, sha256: renamed.get(model.source).sha256, ...model.variants ? { variants: model.variants.map((variant) => ({ ...variant, source: renamed.get(variant.source).path, bytes: renamed.get(variant.source).bytes, sha256: renamed.get(variant.source).sha256 })) } : {} }));
  const publicManifest = { ...manifest, models }, publicCatalog = { ...catalog, assetsVersion: manifest.version, assetManifest: publicManifest };
  const bundle = { schemaVersion: 1, releaseId, contentVersion: String(catalog.contentVersion), assetsVersion: manifest.version, catalogHash: digest(JSON.stringify(publicCatalog)), catalog: publicCatalog, manifest: publicManifest, assets: assets.map((asset) => asset.snapshot), mediaRecords: mediaRecords.map((record4) => ({ ...record4, path: renamed.get(record4.path).path })), createdAt };
  return { bundle, assets };
}
function storeReleaseBundle(db, prepared) {
  const { bundle, assets } = prepared;
  db.prepare("INSERT INTO release_bundles VALUES(?,?,?)").run(bundle.releaseId, JSON.stringify(bundle), bundle.createdAt);
  for (const asset of assets) {
    db.prepare("INSERT OR IGNORE INTO public_asset_blobs VALUES(?,?,?,?,?)").run(asset.snapshot.sha256, asset.extension, asset.mime, asset.body.length, asset.body);
    db.prepare("INSERT INTO release_asset_links VALUES(?,?,?,?)").run(bundle.releaseId, asset.snapshot.sha256, asset.extension, asset.snapshot.originalPath);
  }
}
function readReleaseBundle(db, id) {
  const row = db.prepare("SELECT payload FROM release_bundles WHERE release_id=?").get(id);
  return row ? JSON.parse(String(row.payload)) : null;
}

// server/assistant.ts
var record2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var normalize = (text2) => text2.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]+/gu, "");
var stopwords = /* @__PURE__ */ new Set(["where", "is", "are", "the", "a", "an", "please", "find", "show", "what", "which", "can", "you", "me", "to", "how", "go", "get", "location", "that", "\uC5B4\uB514", "\uC5B4\uB514\uC57C", "\uC5B4\uB528\uC5B4", "\uC5B4\uB514\uC5D0", "\uC5B4\uB514\uC788\uC5B4", "\uC5B4\uB514\uC788\uB098\uC694", "\uCC3E\uC544", "\uCC3E\uAE30", "\uCC3E\uC544\uC918", "\uC54C\uB824", "\uC54C\uB824\uC918", "\uC54C\uB824\uC8FC\uC138\uC694", "\uBCF4\uC5EC", "\uBCF4\uC5EC\uC918", "\uC548\uB0B4"]);
async function answerApprovedQuestion(request, providers, transport = fetchProvider) {
  if (!record2(request) || !record2(request.catalog) || typeof request.question !== "string" || !request.question.trim() || request.question.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(request.question) || typeof request.campusId !== "string" || typeof request.contentVersion !== "string" || request.catalog.contentVersion !== request.contentVersion || !Array.isArray(request.catalog.campuses) || !request.catalog.campuses.some((campus) => campus.id === request.campusId) || !Array.isArray(request.catalog.entities) || !Array.isArray(request.catalog.sources) || request.purpose !== void 0 && (typeof request.purpose !== "string" || request.purpose.length > 120)) throw new Error("ASSISTANT_REQUEST_REJECTED");
  const catalog = request.catalog;
  const sources = new Map(catalog.sources.filter((source) => source.visibility === "public").map((source) => [source.id, source]));
  const entities = new Map(catalog.entities.map((entity) => [entity.id, entity]));
  const isPublic = (entity) => {
    if (entity.campusId !== request.campusId || entity.visibility !== "public" || entity.sensitive || entity.status !== "current") return false;
    const seen = /* @__PURE__ */ new Set();
    let parent = entity.parentId;
    while (parent) {
      if (seen.has(parent)) return false;
      seen.add(parent);
      const owner = entities.get(parent);
      if (!owner || owner.visibility !== "public" || owner.sensitive || owner.campusId !== request.campusId || owner.status !== "current") return false;
      parent = owner.parentId;
    }
    return true;
  };
  const terms = request.question.split(/[\s\p{P}\p{S}]+/u).map(normalize).map((term) => term.replace(/(?:은|는|이|가|을|를|에|에서|으로|의)?(?:어디(?:에|야|인가요|있어|있나요)?|알려(?:줘|주세요)?|찾아(?:줘|주세요)?|보여(?:줘|주세요)?)$/u, "")).filter((term) => term.length >= 2 && !stopwords.has(term));
  const publicEntities = catalog.entities.filter(isPublic), question = terms.length ? terms.join("") : stopwords.has(normalize(request.question)) ? "" : normalize(request.question), purpose = normalize(request.purpose || "");
  const score = (entity) => {
    const names = [entity.name, entity.displayTitle, ...entity.aliases].map(normalize), description = normalize(`${entity.purpose} ${entity.category} ${entity.floorLabel || ""}`);
    let value = question && names.some((name) => name === question || name.length >= 2 && question.length >= 2 && (question.includes(name) || name.includes(question))) ? 100 : 0;
    for (const term of terms) {
      if (names.some((name) => name.includes(term) || term.includes(name) && name.length >= 2)) value += 10;
      else if (description.includes(term)) value += 3;
    }
    if (purpose && description.includes(purpose)) value += 2;
    return value;
  };
  const candidates = publicEntities.map((entity) => ({ entity, score: score(entity) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.entity.id.localeCompare(b.entity.id)).slice(0, 20).map((item) => item.entity);
  const sourceIdsFor = (entity) => [...new Set(Object.values(entity.claims).flatMap((claim) => claim.sourceIds).filter((id) => sources.has(id)))].sort();
  const authored = (entity) => ({ id: entity.id, name: entity.name, kind: entity.kind, purpose: entity.purpose, category: entity.category, floorLabel: entity.floorLabel, confirmation: entity.confidence, nameConfirmation: entity.claims.name.confidence, sourceIds: sourceIdsFor(entity) });
  const answer = (selected, mode) => {
    const result = selected.map(authored);
    return { contentVersion: catalog.contentVersion, entities: result, sourceIds: [...new Set(result.flatMap((entity) => entity.sourceIds))].sort(), mode };
  };
  const fallback = () => answer(candidates, "catalog");
  const verifiedSources = new Set([...sources].filter(([, source]) => source.confidence === "verified").map(([id]) => id));
  const eligible = providers.find((provider) => provider.enabled && provider.kind === "assistant" && provider.campusId === request.campusId && verifiedSources.has(provider.sourceId));
  const verifiedCandidates = candidates.filter((entity) => entity.claims.name.confidence === "verified" && entity.claims.name.sourceIds.some((id) => verifiedSources.has(id)));
  if (!eligible || !verifiedCandidates.length) return fallback();
  const allowedIds = new Map(verifiedCandidates.map((entity) => [entity.id, entity]));
  const allowedSources = new Set(verifiedCandidates.flatMap((entity) => entity.claims.name.sourceIds).filter((id) => verifiedSources.has(id)));
  const payload = { campusId: request.campusId, contentVersion: request.contentVersion, question: request.question, purpose: request.purpose || "", candidates: verifiedCandidates.map((entity) => ({ id: entity.id, name: entity.name, kind: entity.kind, purpose: entity.purpose, category: entity.category, sourceIds: entity.claims.name.sourceIds.filter((id) => allowedSources.has(id)) })), sources: [...allowedSources].sort().map((id) => ({ id, title: sources.get(id)?.title || "" })) };
  if (Buffer.byteLength(JSON.stringify(payload)) > 32768) return fallback();
  try {
    const response = await transport(eligible, payload);
    if (!record2(response) || response.contentVersion !== request.contentVersion || !Array.isArray(response.entityIds) || response.entityIds.length > 20 || !response.entityIds.every((id) => typeof id === "string" && allowedIds.has(id)) || new Set(response.entityIds).size !== response.entityIds.length || !Array.isArray(response.sourceIds) || response.sourceIds.length > 100 || !response.sourceIds.every((id) => typeof id === "string" && allowedSources.has(id)) || new Set(response.sourceIds).size !== response.sourceIds.length) return fallback();
    const selected = response.entityIds.flatMap((id) => {
      const entity = allowedIds.get(id);
      return entity ? [entity] : [];
    });
    const returnedSourceIds = response.sourceIds;
    const selectedSourceIds = new Set(selected.flatMap((entity) => entity.claims.name.sourceIds).filter((id) => allowedSources.has(id)));
    if (!selected.length || !returnedSourceIds.length || returnedSourceIds.some((id) => !selectedSourceIds.has(id)) || selected.some((entity) => !entity.claims.name.sourceIds.some((id) => returnedSourceIds.includes(id)))) return fallback();
    return answer(selected, "provider");
  } catch {
    return fallback();
  }
}

// server/platform.ts
var ApiError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
function fail(status, code, message) {
  throw new ApiError(status, code, message);
}
var hash = (value) => createHash2("sha256").update(value).digest("hex");
var record3 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function object3(v) {
  return record3(v) ? v : fail(422, "INVALID_INPUT", "\uC785\uB825 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
}
function text(v, max, name, required = true) {
  if (typeof v !== "string" || v.length > max || required && !v.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) return fail(422, "INVALID_INPUT", `${name}\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.`);
  return v.trim();
}
function arrayRecords(value) {
  return Array.isArray(value) ? value.filter(record3) : [];
}
function passwordHash(password) {
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain between 12 and 256 characters.");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
}
function verifyPassword(password, encoded) {
  const [algorithm, cost, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || cost !== "32768" || !salt || !expected || password.length > 256) return false;
  const actual = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const bytes = Buffer.from(expected, "hex");
  return bytes.length === actual.length && timingSafeEqual(bytes, actual);
}
function loadDomain(root) {
  const context = vm.createContext({ window: {}, URL, console: { log() {
  }, warn() {
  }, error() {
  } } });
  for (const file of ["src/data/campus-data.js", "src/data/interior-data.js", "src/domain/site-geometry.js", "src/data/site-plan.js", "src/domain/campus-platform.js"]) vm.runInContext(readFileSync3(resolve2(root, file), "utf8"), context, { filename: file, timeout: 5e3 });
  const exposed = Reflect.get(context.window, "CampusPlatform");
  if (!record3(exposed) || !["createCatalog", "validateCatalog", "publicCatalog", "resolve"].every((key) => typeof exposed[key] === "function")) throw new Error("Campus domain contract is unavailable.");
  const domain = exposed;
  const baseline = domain.createCatalog(Reflect.get(context, "SitePlanData"), Reflect.get(context.window, "CampusData"));
  if (!domain.validateCatalog(baseline).valid) throw new Error("Baseline campus catalog did not pass validation.");
  return { domain, baseline };
}
function checkedDatabasePath(root, supplied) {
  const path = resolve2(supplied || resolve2(root, "var/campus.sqlite"));
  if (path === resolve2(root) || !/\.sqlite$/.test(path)) throw new Error("CAMPUS_DB_PATH must name a .sqlite file.");
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  const parent = realpathSync2(dirname(path));
  for (const forbidden of ["dist", "src", "styles", "vendor", "evidence", "docs", "server"]) {
    const directory = resolve2(root, forbidden);
    const actual = existsSync2(directory) ? realpathSync2(directory) : directory;
    const local = relative2(actual, parent);
    if (!local || !local.startsWith("..") && !isAbsolute2(local)) throw new Error("Database cannot be placed in a public or source directory.");
  }
  if (existsSync2(path) && (lstatSync2(path).isSymbolicLink() || !lstatSync2(path).isFile())) throw new Error("Database file cannot be a link or directory.");
  return resolve2(parent, path.slice(path.lastIndexOf("\\") + 1).split("/").pop());
}
var CampusRepository = class {
  constructor(root, databasePath) {
    this.root = root;
    this.databasePath = checkedDatabasePath(root, databasePath);
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec("CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
    const version = this.db.prepare("SELECT MAX(version) AS version FROM migrations").get()?.version;
    const migrations = ["0001-platform.sql", "0002-provider-runs.sql", "0003-asset-bundles.sql"];
    if (version !== null && version !== void 0 && Number(version) > migrations.length) throw new Error("Database schema is newer than this application.");
    for (let index = Number(version || 0); index < migrations.length; index++) this.transaction(() => {
      this.db.exec(readFileSync3(resolve2(root, "server/migrations", migrations[index]), "utf8"));
      this.db.prepare("INSERT INTO migrations VALUES(?,?)").run(index + 1, (/* @__PURE__ */ new Date()).toISOString());
    });
  }
  transaction(run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  setting(key) {
    const row = this.db.prepare("SELECT value FROM settings WHERE key=?").get(key);
    return row ? String(row.value) : null;
  }
  setSetting(key, value) {
    this.db.prepare("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
  }
  current() {
    const id = this.setting("currentRelease");
    const row = this.db.prepare("SELECT catalog FROM releases WHERE id=?").get(id || "");
    if (!row) throw new Error("Current release is missing.");
    return object3(JSON.parse(String(row.catalog)));
  }
  revision() {
    return Number(this.setting("revision") || 1);
  }
  audit(actor, operation, resource, at) {
    this.db.prepare("INSERT INTO audit(actor_id,operation,resource_id,created_at) VALUES(?,?,?,?)").run(actor, operation, resource, at);
  }
  createUser(username, password, role, campusIds) {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username) || !["admin", "editor", "reviewer"].includes(role) || !Array.isArray(campusIds) || campusIds.some((id) => typeof id !== "string" || !id)) throw new Error("Invalid username, role or campus scope.");
    if (role !== "admin" && !campusIds.length) throw new Error("Editors/reviewers need explicit campus scope.");
    const user = { id: randomUUID(), username, role, campusIds };
    this.db.prepare("INSERT INTO users(id,username,password_hash,role,campus_ids,created_at) VALUES(?,?,?,?,?,?)").run(user.id, username, passwordHash(password), role, JSON.stringify(campusIds), (/* @__PURE__ */ new Date()).toISOString());
    this.audit(user.id, "user.created", user.id, (/* @__PURE__ */ new Date()).toISOString());
    return user;
  }
  async backup(destination) {
    const path = checkedDatabasePath(this.root, destination);
    if (existsSync2(path) || path === this.databasePath || !/\.sqlite$/.test(path)) throw new Error("Backup destination must be a new .sqlite file.");
    await backup(this.db, path);
  }
  close() {
    this.db.close();
  }
};
function createPlatform(options) {
  const loaded = options.domain && options.baseline ? { domain: options.domain, baseline: options.baseline } : loadDomain(options.root);
  const domain = loaded.domain;
  const providers = options.providers || loadProviders(options.providersFile);
  const providerTransport = options.providerTransport || fetchProvider;
  const providerBusy = /* @__PURE__ */ new Set();
  const repository = new CampusRepository(options.root, options.databasePath);
  const clock = options.now || (() => /* @__PURE__ */ new Date());
  const origins = new Set(options.origins.map((v) => {
    const u = new URL(v);
    if (!["http:", "https:"].includes(u.protocol) || u.origin !== v || u.username || u.password) throw new Error("Invalid public origin.");
    return u.origin;
  }));
  if (!origins.size) throw new Error("An explicit public origin is required.");
  const dummyPassword = passwordHash(randomBytes(24).toString("hex"));
  const limits = /* @__PURE__ */ new Map();
  const normalizeIP = (value) => value.startsWith("::ffff:") && isIP2(value.slice(7)) === 4 ? value.slice(7) : value;
  const trustedProxies = new Set((options.trustedProxyIPs || []).map((value) => {
    if (!isIP2(value)) throw new Error("Trusted proxy entries must be explicit IP addresses.");
    return normalizeIP(value);
  }));
  function clientAddress(request) {
    const address = normalizeIP(request.socket.remoteAddress || "local");
    const forwarded = request.headers["x-forwarded-for"];
    if (!trustedProxies.has(address) || forwarded === void 0) return address;
    if (typeof forwarded !== "string" || !isIP2(forwarded)) fail(400, "INVALID_PROXY_HEADER", "\uC694\uCCAD \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    return normalizeIP(forwarded);
  }
  const metrics = { requests: 0, errors: 0, conflicts: 0, reportsReceived: 0, releasesPublished: 0 };
  const startedAt = clock().toISOString();
  function rememberIds(catalog, restoring = false) {
    const rows = arrayRecords(catalog.entities);
    for (const item of rows) {
      const old = repository.db.prepare("SELECT * FROM identities WHERE id=?").get(String(item.id));
      if (old && (old.kind !== item.kind || old.campus_id !== item.campusId || Number(old.retired) && !restoring && item.status !== "retired")) fail(422, "IDENTITY_REUSED", "\uAE30\uC874 \uACF5\uAC04 ID\uB97C \uB2E4\uB978 \uACF5\uAC04\uC5D0 \uC7AC\uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    repository.db.exec("UPDATE identities SET retired=1;");
    for (const item of rows) repository.db.prepare("INSERT INTO identities(id,campus_id,kind,retired) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET retired=excluded.retired").run(String(item.id), String(item.campusId), String(item.kind), item.status === "retired" ? 1 : 0);
  }
  if (!repository.setting("currentRelease")) repository.transaction(() => {
    const id = randomUUID();
    repository.db.prepare("INSERT INTO releases(id,catalog,summary,created_at) VALUES(?,?,?,?)").run(id, JSON.stringify(loaded.baseline), "\uAE30\uC874 \uACF5\uAC1C \uC790\uB8CC\uB97C \uBCC0\uD658\uD55C \uCD5C\uCD08 \uACF5\uAC1C\uD310", clock().toISOString());
    repository.setSetting("currentRelease", id);
    repository.setSetting("revision", "1");
    rememberIds(loaded.baseline);
  });
  if (!repository.setting("receiptSecret")) repository.setSetting("receiptSecret", randomBytes(32).toString("hex"));
  const receiptToken = (id) => createHmac("sha256", repository.setting("receiptSecret")).update(id).digest("hex");
  function rate(key, count, period) {
    const now = clock().getTime();
    for (const [id, bucket2] of limits) if (bucket2.expires <= now) limits.delete(id);
    if (limits.size > 4096) return fail(429, "RATE_LIMITED", "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    const bucket = limits.get(key) || { expires: now + period, count: 0 };
    bucket.count++;
    limits.set(key, bucket);
    if (bucket.count > count) fail(429, "RATE_LIMITED", "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
  }
  function originAllowed(request, mutation) {
    const host = request.headers.host || "";
    if (![...origins].some((origin) => new URL(origin).host === host)) fail(403, "ORIGIN_REJECTED", "\uD5C8\uC6A9\uB41C \uC11C\uBE44\uC2A4 \uC8FC\uC18C\uC5D0\uC11C \uC694\uCCAD\uD574 \uC8FC\uC138\uC694.");
    if ((mutation || request.headers.origin) && (!request.headers.origin || !origins.has(request.headers.origin))) fail(403, "ORIGIN_REJECTED", "\uD5C8\uC6A9\uB41C \uC11C\uBE44\uC2A4 \uC8FC\uC18C\uC5D0\uC11C \uC694\uCCAD\uD574 \uC8FC\uC138\uC694.");
  }
  function session(request) {
    const cookies = (request.headers.cookie || "").split(";").map((v) => v.trim());
    const token = cookies.find((v) => v.startsWith("campus_session="))?.slice(15);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const row = repository.db.prepare("SELECT s.*,u.username,u.role,u.campus_ids FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>? AND u.disabled=0").get(hash(token), clock().toISOString());
    if (!row) return null;
    return { user: { id: String(row.user_id), username: String(row.username), role: row.role, campusIds: JSON.parse(String(row.campus_ids)) }, csrf: String(row.csrf), tokenHash: hash(token) };
  }
  function authorize(request, roles, mutation = false) {
    const active = session(request);
    if (!active) return fail(401, "AUTHENTICATION_REQUIRED", "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    if (!roles.includes(active.user.role)) return fail(403, "FORBIDDEN", "\uC774 \uC791\uC5C5\uC744 \uC218\uD589\uD560 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    if (mutation) {
      const token = request.headers["x-csrf-token"];
      if (typeof token !== "string" || hash(token) !== hash(active.csrf)) fail(403, "CSRF_REJECTED", "\uC138\uC158\uC744 \uC0C8\uB85C \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    }
    return active.user;
  }
  function assertEntityScope(user, catalog, id) {
    const entity = domain.resolve(catalog, id);
    if (!entity) fail(404, "RESOURCE_NOT_FOUND", "\uACF5\uAC04\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    if (user.role !== "admin" && !user.campusIds.includes(String(entity.campusId))) fail(403, "FORBIDDEN", "\uB2F4\uB2F9 \uCEA0\uD37C\uC2A4\uC758 \uC790\uB8CC\uB9CC \uAD00\uB9AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  }
  function assertCatalogScope(user, next) {
    assertCatalogReadable(user, repository.current());
    assertCatalogReadable(user, next);
  }
  function canReadCatalog(user, catalog) {
    return user.role === "admin" || arrayRecords(catalog.campuses).every((campus) => user.campusIds.includes(String(campus.id)));
  }
  function assertCatalogReadable(user, catalog) {
    if (!canReadCatalog(user, catalog)) fail(403, "FORBIDDEN", "\uC804\uCCB4 \uAD00\uB9AC \uC790\uB8CC\uB294 \uD3EC\uD568\uB41C \uBAA8\uB4E0 \uCEA0\uD37C\uC2A4\uC758 \uB2F4\uB2F9 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  }
  function catalogScopeSql(user, alias) {
    if (user.role === "admin") return { sql: "1=1", parameters: [] };
    return { sql: `NOT EXISTS (SELECT 1 FROM json_each(${alias}.catalog,'$.campuses') campus WHERE json_extract(campus.value,'$.id') NOT IN (SELECT value FROM json_each(?)))`, parameters: [JSON.stringify(user.campusIds)] };
  }
  function identityScopeSql(user) {
    return user.role === "admin" ? { sql: "1=1", parameters: [] } : { sql: "identity.campus_id IN (SELECT value FROM json_each(?))", parameters: [JSON.stringify(user.campusIds)] };
  }
  function assertIdentityScope(user, id) {
    if (user.role === "admin") return;
    const identity = repository.db.prepare("SELECT campus_id FROM identities WHERE id=?").get(id);
    if (!identity || !user.campusIds.includes(String(identity.campus_id))) fail(403, "FORBIDDEN", "\uD574\uB2F9 \uCEA0\uD37C\uC2A4\uC758 \uAE30\uB85D\uB9CC \uAD00\uB9AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  }
  function pagination(url, maximum = 100) {
    const integer = (key, minimum, maximumValue, fallback) => {
      const values = url.searchParams.getAll(key);
      if (!values.length) return fallback;
      if (values.length !== 1 || !/^(0|[1-9]\d*)$/.test(values[0])) fail(422, "INVALID_PAGINATION", "\uBAA9\uB85D\uC758 limit\uACFC offset\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const value = Number(values[0]);
      if (!Number.isSafeInteger(value) || value < minimum || value > maximumValue) fail(422, "INVALID_PAGINATION", "\uBAA9\uB85D\uC758 limit\uACFC offset\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      return value;
    };
    return { limit: integer("limit", 1, maximum, maximum), offset: integer("offset", 0, 1e5, 0) };
  }
  function checkedCatalog(input, user) {
    const catalog = object3(input);
    const validation = user ? domain.validateImport(catalog, repository.current()) : domain.validateCatalog(catalog);
    if (catalog.assetManifest !== void 0) {
      try {
        validateModelManifest(catalog.assetManifest);
      } catch {
        fail(422, "INVALID_ASSETS", "?? ????????????? ??? ??? ???.");
      }
    }
    if (!validation.valid) fail(422, "INVALID_CATALOG", `\uACF5\uAC04 \uC790\uB8CC\uB97C \uAC80\uC99D\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. ${validation.errors.slice(0, 6).map((v) => typeof v === "string" ? v : JSON.stringify(v)).join(" / ")}`);
    if (JSON.stringify(catalog).length > 4e6) fail(413, "PAYLOAD_TOO_LARGE", "\uACF5\uAC04 \uC790\uB8CC\uB294 4MB \uC774\uD558\uB85C \uB4F1\uB85D\uD574 \uC8FC\uC138\uC694.");
    const normalized = "catalog" in validation && record3(validation.catalog) ? validation.catalog : catalog;
    if (user) assertCatalogScope(user, normalized);
    return normalized;
  }
  function revision(body, expected) {
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== expected) {
      metrics.conflicts++;
      fail(409, "REVISION_CONFLICT", "\uB2E4\uB978 \uBCC0\uACBD\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uCD5C\uC2E0 \uC790\uB8CC\uB97C \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    }
  }
  async function readBody(request) {
    if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) fail(415, "UNSUPPORTED_MEDIA_TYPE", "JSON \uC694\uCCAD\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4.");
    const chunks = [];
    let bytes = 0;
    for await (const value of request) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      bytes += chunk.length;
      if (bytes > 6e6) fail(413, "PAYLOAD_TOO_LARGE", "\uC694\uCCAD \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
      chunks.push(chunk);
    }
    try {
      return object3(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return fail(400, "INVALID_JSON", "JSON \uC785\uB825\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    }
  }
  function safePhoto(value) {
    if (value === void 0 || value === null) return null;
    const input = object3(value);
    const mime = text(input.mimeType, 32, "\uC0AC\uC9C4 \uD615\uC2DD");
    const encoded = text(input.dataBase64, 28e5, "\uC0AC\uC9C4");
    if (!["image/png", "image/jpeg"].includes(mime) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(422, "INVALID_PHOTO", "PNG \uB610\uB294 JPEG \uC0AC\uC9C4\uB9CC \uB4F1\uB85D\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString("base64") !== encoded) fail(422, "INVALID_PHOTO", "\uC0AC\uC9C4\uC740 2MB \uC774\uD558\uB85C \uB4F1\uB85D\uD574 \uC8FC\uC138\uC694.");
    if (mime === "image/png") {
      if (bytes.length < 45 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString() !== "IHDR") fail(422, "INVALID_PHOTO", "PNG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      if (!width || !height || width > 4096 || height > 4096 || width * height > 12e6) fail(422, "INVALID_PHOTO", "\uC0AC\uC9C4 \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      const channelCount = channels[bytes[25]];
      if (bytes[24] !== 8 || !channelCount || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) fail(422, "INVALID_PHOTO", "\uC0AC\uC9C4\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD574 \uD45C\uC900 PNG\uB85C \uBCC0\uD658\uD574 \uC8FC\uC138\uC694.");
      const kept2 = [bytes.subarray(0, 8)], compressed = [];
      let offset2 = 8, ended = false;
      while (offset2 + 12 <= bytes.length) {
        const size = bytes.readUInt32BE(offset2);
        if (size > bytes.length - offset2 - 12) fail(422, "INVALID_PHOTO", "PNG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const kind = bytes.subarray(offset2 + 4, offset2 + 8).toString("ascii");
        let crc = 4294967295;
        for (const byte of bytes.subarray(offset2 + 4, offset2 + 8 + size)) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
        }
        if ((crc ^ 4294967295) >>> 0 !== bytes.readUInt32BE(offset2 + size + 8)) fail(422, "INVALID_PHOTO", "PNG \uD30C\uC77C\uC774 \uC190\uC0C1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        if (["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(kind)) kept2.push(bytes.subarray(offset2, offset2 + size + 12));
        if (kind === "IDAT") compressed.push(bytes.subarray(offset2 + 8, offset2 + size + 8));
        offset2 += size + 12;
        if (kind === "IEND") {
          ended = true;
          break;
        }
      }
      if (!ended || !kept2.some((chunk) => chunk.subarray(4, 8).toString() === "IDAT")) fail(422, "INVALID_PHOTO", "PNG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      try {
        const rowBytes = width * channelCount + 1, decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: rowBytes * height });
        if (decoded.length !== rowBytes * height) fail(422, "INVALID_PHOTO", "PNG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        for (let row = 0; row < height; row++) if (decoded[row * rowBytes] > 4) fail(422, "INVALID_PHOTO", "PNG \uD544\uD130\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      } catch {
        fail(422, "INVALID_PHOTO", "PNG \uC774\uBBF8\uC9C0\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      }
      return { data: Buffer.concat(kept2), mime };
    }
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) fail(422, "INVALID_PHOTO", "JPEG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    const kept = [bytes.subarray(0, 2)];
    let offset = 2, scanned = false, dimensions = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) fail(422, "INVALID_PHOTO", "JPEG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const marker = bytes[offset + 1];
      const size = bytes.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > bytes.length) fail(422, "INVALID_PHOTO", "JPEG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      if ([192, 193, 194].includes(marker)) {
        if (size < 8) fail(422, "INVALID_PHOTO", "JPEG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const height = bytes.readUInt16BE(offset + 5), width = bytes.readUInt16BE(offset + 7);
        if (!width || !height || width > 4096 || height > 4096 || width * height > 12e6) fail(422, "INVALID_PHOTO", "\uC0AC\uC9C4 \uD06C\uAE30\uAC00 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
        dimensions = true;
      }
      if (marker === 218) {
        kept.push(bytes.subarray(offset));
        scanned = true;
        break;
      }
      if (!(marker >= 224 && marker <= 239) && marker !== 254) kept.push(bytes.subarray(offset, offset + size + 2));
      offset += size + 2;
    }
    if (!scanned || !dimensions) fail(422, "INVALID_PHOTO", "JPEG \uD30C\uC77C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    return { data: Buffer.concat(kept), mime };
  }
  function safeDraft(row, user) {
    const catalog = object3(JSON.parse(String(row.catalog)));
    assertCatalogReadable(user, catalog);
    return { id: row.id, catalog, summary: row.summary, status: row.status, authorId: row.author_id, reviewerId: row.reviewer_id, revision: Number(row.revision), baseRevision: Number(row.base_revision), createdAt: row.created_at, updatedAt: row.updated_at };
  }
  function safeReport(row) {
    return { id: row.id, spaceId: row.space_id, type: row.type, description: row.description, status: row.status, hasPhoto: !!row.photo, responseNote: row.response_note, createdAt: row.created_at, updatedAt: row.updated_at };
  }
  function publicOperations(page) {
    const full = repository.current();
    const visible = domain.publicCatalog(full);
    const sql = "SELECT payload FROM operations WHERE json_extract(payload,'$.visibility')='public' AND json_extract(payload,'$.status') IS NOT 'cancelled' AND entity_id IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM json_each(payload,'$.sourceIds') source WHERE source.value NOT IN (SELECT value FROM json_each(?))) ORDER BY updated_at DESC,id DESC";
    const parameters = [JSON.stringify(arrayRecords(visible.entities).map((entity) => entity.id)), JSON.stringify(arrayRecords(visible.sources).map((source) => source.id))];
    const rows = page ? repository.db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...parameters, page.limit + 1, page.offset) : repository.db.prepare(sql).all(...parameters);
    full.operations = rows.map((row) => object3(JSON.parse(String(row.payload))));
    return arrayRecords(domain.publicCatalog(full).operations);
  }
  function makeOperation(body, user, now) {
    const suppliedId = text(body.entityId, 180, "\uACF5\uAC04"), current = repository.current();
    assertEntityScope(user, current, suppliedId);
    const entityId = String(domain.resolve(current, suppliedId).id);
    const title = text(body.title || body.label, 200, "\uC81C\uBAA9"), owner = text(body.owner, 100, "\uAD00\uB9AC \uBD80\uC11C"), statusValue = text(body.status || body.state, 30, "\uC6B4\uC601 \uC0C1\uD0DC");
    if (!["open", "closed", "restricted", "unknown", "construction", "cancelled"].includes(statusValue)) fail(422, "INVALID_STATUS", "\uC6B4\uC601 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    const suppliedStart = text(body.startsAt || body.validFrom, 40, "\uC2DC\uC791\uC77C"), suppliedEnd = text(body.endsAt || body.validUntil, 40, "\uC885\uB8CC\uC77C");
    const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/;
    const validTime = (value) => {
      const parts = timestamp.exec(value);
      if (!parts) return false;
      const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHour, offsetMinute] = parts;
      const year = Number(yearText), month = Number(monthText), day = Number(dayText), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1] && Number(hourText) <= 23 && Number(minuteText) <= 59 && Number(secondText) <= 59 && Number(offsetHour || 0) <= 23 && Number(offsetMinute || 0) <= 59 && Number.isFinite(Date.parse(value));
    };
    if (!validTime(suppliedStart) || !validTime(suppliedEnd)) fail(422, "INVALID_PERIOD", "\uB2EC\uB825\uACFC \uC2DC\uAC04\uB300\uAC00 \uC720\uD6A8\uD55C ISO \uC6B4\uC601\uAE30\uAC04\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    const startsAt = new Date(suppliedStart).toISOString(), endsAt = new Date(suppliedEnd).toISOString();
    if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt) || new Date(endsAt).getTime() - new Date(startsAt).getTime() > 366 * 24 * 60 * 6e4) fail(422, "INVALID_PERIOD", "1\uB144 \uC774\uB0B4\uC758 \uC720\uD6A8\uD55C \uC6B4\uC601\uAE30\uAC04\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    if (body.visibility !== void 0 && !["restricted", "public"].includes(String(body.visibility))) fail(422, "INVALID_INPUT", "\uACF5\uAC1C \uBC94\uC704\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    const visibility = body.visibility === "restricted" ? "restricted" : "public";
    const sourceId = text(body.sourceId || (Array.isArray(body.sourceIds) ? body.sourceIds[0] : null), 180, "\uCD9C\uCC98");
    if (!arrayRecords(repository.current().sources).some((source) => source.id === sourceId)) fail(422, "INVALID_SOURCE", "\uB4F1\uB85D\uB41C \uCD9C\uCC98\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
    return { id: body.id ? text(body.id, 100, "\uC6B4\uC601 \uC815\uBCF4 ID") : randomUUID(), entityId, title, label: `${title} \xB7 ${owner}`, owner, status: statusValue, state: statusValue === "open" ? "open" : "closed", startsAt, endsAt, validFrom: startsAt, validUntil: statusValue === "cancelled" ? now : endsAt, observedAt: now, visibility, sourceId, sourceIds: [sourceId], verification: statusValue === "unknown" ? "unverified" : "verified", reviewedAt: now, reviewerId: user.id, updatedAt: now };
  }
  function ensureBundle(id, full, at) {
    const known = readReleaseBundle(repository.db, id);
    if (known) return known;
    const prepared = checkedPublicBundle(id, full, at);
    repository.transaction(() => storeReleaseBundle(repository.db, prepared));
    return prepared.bundle;
  }
  function checkedPublicBundle(id, full, at) {
    try {
      return prepareReleaseBundle(options.assetRoot || options.root, id, domain.publicCatalog(full), at, repository.db);
    } catch {
      fail(422, "INVALID_PUBLIC_ASSETS", "\uACF5\uAC1C \uC790\uC0B0\uC758 \uACBD\uB85C\xB7SHA\xB7\uD615\uC0C1\xB7\uACF5\uAC1C\uC131 \uAC80\uC99D\uC744 \uD1B5\uACFC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D \uD30C\uC77C\uACFC \uC81C\uC791 \uBCF4\uACE0\uC11C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    }
  }
  async function handle(request, response) {
    if (!request.url?.startsWith("/api/") && !request.url?.startsWith("/assets/releases/")) return false;
    const requestId = randomUUID(), started = performance.now();
    metrics.requests++;
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Request-Id": requestId, "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };
    let status = 200;
    const send = (data, code = 200, extra = {}, meta = {}) => {
      status = code;
      response.writeHead(code, { ...headers, ...extra });
      response.end(JSON.stringify({ data, error: null, meta: { requestId, revision: repository.revision(), ...meta } }));
    };
    const sendPage = (rows, page, transform = (row) => row) => {
      const hasMore = rows.length > page.limit;
      send(rows.slice(0, page.limit).map(transform), 200, {}, { pagination: { ...page, hasMore, nextOffset: hasMore && page.offset + page.limit <= 1e5 ? page.offset + page.limit : null } });
    };
    try {
      const method = request.method || "GET";
      const mutation = !["GET", "HEAD"].includes(method);
      originAllowed(request, mutation);
      if (!["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(method)) fail(405, "METHOD_NOT_ALLOWED", "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4.");
      const url = new URL(request.url, [...origins][0]);
      const path = url.pathname;
      const now = clock().toISOString();
      const client = hash(clientAddress(request));
      rate(`api:${client}`, 300, 6e4);
      if (path === "/api/v1/health" && method === "GET") {
        send({ status: "ok", schemaVersion: 3, catalogSchemaVersion: 1, revision: repository.revision(), startedAt });
        return true;
      }
      if (path === "/api/v1/session" && method === "GET") {
        const active = session(request);
        send({ user: active?.user || null, csrfToken: active?.csrf, adminConfigured: Number(repository.db.prepare("SELECT COUNT(*) count FROM users WHERE disabled=0").get()?.count) > 0 });
        return true;
      }
      if (path === "/api/v1/session" && method === "POST") {
        rate(`login:${client}`, 8, 15 * 6e4);
        const body = await readBody(request);
        const username = text(body.username, 64, "\uACC4\uC815");
        const password = typeof body.password === "string" ? body.password : "";
        const user2 = repository.db.prepare("SELECT * FROM users WHERE username=? AND disabled=0").get(username);
        const valid = verifyPassword(password, user2 ? String(user2.password_hash) : dummyPassword);
        if (!user2 || !valid) fail(401, "INVALID_CREDENTIALS", "\uACC4\uC815\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const token = randomBytes(32).toString("hex"), csrf = randomBytes(32).toString("hex"), expires = new Date(clock().getTime() + 8 * 60 * 6e4).toISOString();
        repository.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
        repository.db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(hash(token), String(user2.id), csrf, expires);
        repository.audit(String(user2.id), "session.created", null, now);
        send({ user: { id: user2.id, username: user2.username, role: user2.role, campusIds: JSON.parse(String(user2.campus_ids)) }, csrfToken: csrf }, 200, { "Set-Cookie": `campus_session=${token}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=28800${options.secureCookies ? "; Secure" : ""}` });
        return true;
      }
      if (path === "/api/v1/session" && method === "DELETE") {
        const user2 = authorize(request, ["admin", "editor", "reviewer"], true);
        const active = session(request);
        repository.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(active.tokenHash);
        repository.audit(user2.id, "session.deleted", null, now);
        send({ loggedOut: true }, 200, { "Set-Cookie": `campus_session=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0${options.secureCookies ? "; Secure" : ""}` });
        return true;
      }
      const snapshotMatch = path.match(/^\/assets\/releases\/([a-f0-9]{64})(\.[a-z0-9]+)$/);
      if (snapshotMatch && ["GET", "HEAD"].includes(method)) {
        const row = repository.db.prepare("SELECT body,mime_type,bytes FROM public_asset_blobs WHERE sha256=? AND extension=? AND EXISTS(SELECT 1 FROM release_asset_links WHERE sha256=public_asset_blobs.sha256 AND extension=public_asset_blobs.extension)").get(snapshotMatch[1], snapshotMatch[2]);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uACF5\uAC1C \uC790\uC0B0\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        response.writeHead(200, { ...headers, "Content-Type": String(row.mime_type), "Content-Length": String(row.bytes), "Cache-Control": "public,max-age=31536000,immutable" });
        response.end(method === "HEAD" ? void 0 : Buffer.from(row.body));
        return true;
      }
      if (path === "/api/v1/bundle" && method === "GET") {
        const id = url.searchParams.get("release") || repository.setting("currentRelease");
        if (!/^[a-f0-9-]{36}$/.test(id)) fail(422, "INVALID_RELEASE", "\uACF5\uAC1C\uD310 ID\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const row = repository.db.prepare("SELECT catalog,created_at FROM releases WHERE id=?").get(id);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uC2B9\uC778\uB41C \uACF5\uAC1C\uD310\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const bundle = ensureBundle(id, object3(JSON.parse(String(row.catalog))), String(row.created_at));
        send(bundle);
        return true;
      }
      if (path === "/api/v1/catalog" && method === "GET") {
        const releaseId = url.searchParams.get("release");
        const row = releaseId ? repository.db.prepare("SELECT catalog FROM releases WHERE id=?").get(releaseId) : null;
        if (releaseId && !row) fail(404, "RESOURCE_NOT_FOUND", "\uACF5\uAC1C\uD310\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const full = row ? object3(JSON.parse(String(row.catalog))) : repository.current();
        const catalog = domain.publicCatalog(full);
        if (!releaseId) catalog.operations = [...arrayRecords(catalog.operations), ...publicOperations()];
        const id = releaseId || repository.setting("currentRelease");
        const bundle = ensureBundle(id, full, now);
        catalog.assetManifest = bundle.manifest;
        catalog.assetsVersion = bundle.assetsVersion;
        send(catalog, 200, {}, { releaseId: id, bundleHash: bundle.catalogHash, mediaRecords: bundle.mediaRecords });
        return true;
      }
      if (path === "/api/v1/assistant/status" && method === "GET") {
        const current = domain.publicCatalog(repository.current());
        const sources = new Set(arrayRecords(current.sources).filter((source) => source.visibility === "public" && source.confidence === "verified").map((source) => source.id));
        send({ providers: providers.filter((provider) => provider.enabled && provider.kind === "assistant" && sources.has(provider.sourceId)).map((provider) => ({ id: provider.id, campusId: provider.campusId, sourceId: provider.sourceId })), mode: "approved-catalog-only" });
        return true;
      }
      if (path === "/api/v1/assistant" && method === "POST") {
        rate(`assistant:${client}`, 15, 6e4);
        const body = await readBody(request), current = domain.publicCatalog(repository.current());
        const question = text(body.question, 500, "\uC9C8\uBB38"), campusId = text(body.campusId, 160, "\uCEA0\uD37C\uC2A4"), contentVersion = text(body.contentVersion, 160, "\uC790\uB8CC\uD310");
        if (contentVersion !== current.contentVersion) fail(409, "CATALOG_CHANGED", "\uC790\uB8CC\uD310\uC774 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68\uD55C \uB4A4 \uB2E4\uC2DC \uC9C8\uBB38\uD574 \uC8FC\uC138\uC694.");
        if (!arrayRecords(current.campuses).some((campus) => campus.id === campusId)) fail(422, "INVALID_CAMPUS", "\uB4F1\uB85D\uB41C \uCEA0\uD37C\uC2A4\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        const result = await answerApprovedQuestion({ catalog: current, question, campusId, contentVersion, purpose: typeof body.purpose === "string" ? body.purpose : void 0 }, providers, providerTransport);
        send(result);
        return true;
      }
      if (path === "/api/v1/releases" && method === "GET") {
        const page = pagination(url);
        sendPage(repository.db.prepare("SELECT id,created_at AS createdAt,json_extract(catalog,'$.contentVersion') AS contentVersion FROM releases ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").all(page.limit + 1, page.offset), page);
        return true;
      }
      if (path === "/api/v1/operations" && method === "GET") {
        const page = pagination(url);
        sendPage(publicOperations(page), page);
        return true;
      }
      if (path.startsWith("/api/v1/spaces/") && method === "GET") {
        const id = decodeURIComponent(path.slice("/api/v1/spaces/".length));
        const current = domain.publicCatalog(repository.current());
        const entity = domain.resolve(current, id);
        if (entity) send(entity);
        else if (repository.db.prepare("SELECT id FROM identities WHERE id=? AND retired=1").get(id)) fail(410, "SPACE_RETIRED", "\uC774 \uACF5\uAC04\uC740 \uD604\uC7AC \uACF5\uAC1C\uD310\uC5D0\uC11C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC804\uCCB4 \uBCF4\uAE30\uC5D0\uC11C \uBAA9\uC801\uC9C0\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        else fail(404, "RESOURCE_NOT_FOUND", "\uACF5\uAC04\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return true;
      }
      if (path === "/api/v1/reports" && method === "POST") {
        rate(`report:${client}`, 6, 60 * 6e4);
        const body = await readBody(request);
        const spaceId = text(body.spaceId, 180, "\uACF5\uAC04");
        const entity = domain.resolve(domain.publicCatalog(repository.current()), spaceId);
        if (!entity) fail(422, "INVALID_SPACE", "\uACF5\uAC1C\uB41C \uACF5\uAC04\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        const type = text(body.type, 30, "\uBB38\uC81C \uC720\uD615");
        if (!["location", "name", "access", "facility", "other", "map", "information", "closure"].includes(type)) fail(422, "INVALID_REPORT_TYPE", "\uBB38\uC81C \uC720\uD615\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const description = text(body.description, 3e3, "\uB0B4\uC6A9");
        const key = text(body.idempotencyKey, 100, "\uC811\uC218 \uD0A4");
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) fail(422, "INVALID_INPUT", "\uC811\uC218 \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const photo = safePhoto(body.photo);
        const requestHash = hash(JSON.stringify({ spaceId: entity.id, type, description, photo: photo ? hash(photo.data) : null }));
        const existing = repository.db.prepare("SELECT * FROM reports WHERE idempotency_key=?").get(key);
        if (existing) {
          if (existing.request_hash !== requestHash) fail(409, "IDEMPOTENCY_CONFLICT", "\uC811\uC218 \uD0A4\uAC00 \uB2E4\uB978 \uB0B4\uC6A9\uC5D0 \uC0AC\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
          send({ id: existing.id, status: existing.status, createdAt: existing.created_at, receiptToken: receiptToken(String(existing.id)) }, 200);
          return true;
        }
        const id = randomUUID();
        repository.db.prepare("INSERT INTO reports(id,space_id,type,description,status,photo,photo_mime,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id, String(entity.id), type, description, "received", photo?.data || null, photo?.mime || null, key, requestHash, now, now);
        repository.audit(null, "report.received", id, now);
        metrics.reportsReceived++;
        send({ id, status: "received", createdAt: now, receiptToken: receiptToken(id) }, 201);
        return true;
      }
      const receiptMatch = path.match(/^\/api\/v1\/reports\/([a-f0-9-]+)$/);
      if (receiptMatch && method === "GET") {
        const token = request.headers["x-report-receipt"];
        if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(receiptToken(receiptMatch[1]), "hex"))) fail(404, "RESOURCE_NOT_FOUND", "\uC811\uC218\uBC88\uD638\uC640 \uC870\uD68C \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const row = repository.db.prepare("SELECT id,status,response_note,created_at,updated_at FROM reports WHERE id=?").get(receiptMatch[1]);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uC811\uC218\uBC88\uD638\uC640 \uC870\uD68C \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        send({ id: row.id, status: row.status, responseNote: row.response_note, createdAt: row.created_at, updatedAt: row.updated_at });
        return true;
      }
      if (!path.startsWith("/api/v1/admin/")) fail(404, "RESOURCE_NOT_FOUND", "\uC694\uCCAD\uD55C \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      const user = authorize(request, ["admin", "editor", "reviewer"], mutation);
      if (path === "/api/v1/admin/providers" && method === "GET") {
        send(providers.filter((p) => user.role === "admin" || user.campusIds.includes(p.campusId)).map((provider) => {
          const row = repository.db.prepare("SELECT * FROM provider_runs WHERE provider_id=?").get(provider.id), draft = row?.draft_id ? repository.db.prepare("SELECT catalog FROM drafts WHERE id=?").get(String(row.draft_id)) : null;
          return { id: provider.id, kind: provider.kind, campusId: provider.campusId, sourceId: provider.sourceId, enabled: provider.enabled, state: row?.state || "unconfigured", lastAttemptAt: row?.last_attempt_at || null, lastSuccessAt: row?.last_success_at || null, draftId: draft && canReadCatalog(user, object3(JSON.parse(String(draft.catalog)))) ? row?.draft_id : null, errorCode: row?.error_code || null };
        }));
        return true;
      }
      const providerMatch = path.match(/^\/api\/v1\/admin\/providers\/([a-z0-9_-]+)\/sync$/);
      if (providerMatch && method === "POST") {
        const body = await readBody(request);
        revision(body, repository.revision());
        const provider = providers.find((p) => p.id === providerMatch[1]);
        if (!provider) fail(404, "RESOURCE_NOT_FOUND", "\uB4F1\uB85D\uB41C \uC5F0\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
        if (!provider.enabled) fail(409, "PROVIDER_DISABLED", "\uC5F0\uB3D9\uC774 \uC544\uC9C1 \uD65C\uC131\uD654\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
        if (user.role !== "admin" && !user.campusIds.includes(provider.campusId)) fail(403, "FORBIDDEN", "\uB2F4\uB2F9 \uCEA0\uD37C\uC2A4\uC758 \uC5F0\uB3D9\uB9CC \uC2E4\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        assertCatalogReadable(user, repository.current());
        if (providerBusy.has(provider.id)) fail(409, "PROVIDER_BUSY", "\uC774\uBBF8 \uC790\uB8CC\uB97C \uAC00\uC838\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
        providerBusy.add(provider.id);
        const prior = repository.db.prepare("SELECT * FROM provider_runs WHERE provider_id=?").get(provider.id);
        try {
          const incoming = await providerTransport(provider);
          let catalog;
          if (provider.kind === "catalog") catalog = object3(incoming);
          else {
            if (!Array.isArray(incoming) || incoming.length > 1e3) fail(422, "INVALID_PROVIDER_DATA", "\uC6B4\uC601 \uC815\uBCF4 \uBAA9\uB85D \uD615\uC2DD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
            catalog = repository.current();
            catalog.operations = incoming.map((entry) => ({ ...object3(entry), sourceIds: [provider.sourceId], verification: "unverified" }));
            catalog.contentVersion = `${String(catalog.contentVersion)}-import-${hash(JSON.stringify(incoming)).slice(0, 12)}`;
            catalog.datasetVersion = catalog.contentVersion;
          }
          catalog = checkedCatalog(catalog, user);
          revision(body, repository.revision());
          if (!arrayRecords(catalog.campuses).some((c) => c.id === provider.campusId) || !arrayRecords(catalog.sources).some((s) => s.id === provider.sourceId)) fail(422, "INVALID_PROVIDER_DATA", "\uC5F0\uB3D9\uC758 \uCEA0\uD37C\uC2A4\uC640 \uCD9C\uCC98\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
          const summary = `\uC678\uBD80 \uC790\uB8CC ${provider.id}: \uAC80\uD1A0 \uD6C4 \uACF5\uAC1C`, serialized = JSON.stringify(catalog);
          const duplicate = repository.db.prepare("SELECT id FROM drafts WHERE catalog=? AND summary=? AND status IN('draft','submitted','approved') ORDER BY created_at DESC LIMIT 1").get(serialized, summary);
          const id = duplicate ? String(duplicate.id) : randomUUID(), completed = clock().toISOString();
          repository.transaction(() => {
            if (!duplicate) repository.db.prepare("INSERT INTO drafts(id,catalog,summary,status,author_id,revision,base_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id, serialized, summary, "draft", user.id, 1, repository.revision(), completed, completed);
            repository.db.prepare("INSERT INTO provider_runs VALUES(?,?,?,?,?,?) ON CONFLICT(provider_id) DO UPDATE SET state=excluded.state,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,draft_id=excluded.draft_id,error_code=NULL").run(provider.id, "success", now, completed, id, null);
            repository.audit(user.id, "provider.imported", provider.id, completed);
          });
          send({ providerId: provider.id, draftId: id, state: "success", lastSuccessAt: completed, requiresReview: true, duplicate: !!duplicate }, duplicate ? 200 : 201);
        } catch (error) {
          const code = error instanceof ApiError ? error.code : error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : "PROVIDER_UNAVAILABLE";
          repository.db.prepare("INSERT INTO provider_runs VALUES(?,?,?,?,?,?) ON CONFLICT(provider_id) DO UPDATE SET state=excluded.state,last_attempt_at=excluded.last_attempt_at,error_code=excluded.error_code").run(provider.id, "failed", now, prior?.last_success_at || null, prior?.draft_id || null, code);
          repository.audit(user.id, "provider.failed", provider.id, now);
          fail(503, "PROVIDER_UNAVAILABLE", "\uC790\uB8CC\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uACF5\uAC1C\uD310\uACFC \uB9C8\uC9C0\uB9C9 \uC131\uACF5 \uC2DC\uAC01\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.");
        } finally {
          providerBusy.delete(provider.id);
        }
        return true;
      }
      if (path === "/api/v1/admin/status" && method === "GET") {
        const current = repository.current(), allCampuses = canReadCatalog(user, current), draftScope = catalogScopeSql(user, "drafts"), reportScope = identityScopeSql(user);
        send({ catalogRevision: repository.revision(), currentRelease: repository.setting("currentRelease"), startedAt, metrics: allCampuses ? metrics : {}, drafts: repository.db.prepare(`SELECT id,status,revision,summary FROM drafts WHERE ${draftScope.sql} ORDER BY updated_at DESC,id DESC LIMIT 100`).all(...draftScope.parameters), reportCount: Number(repository.db.prepare(`SELECT COUNT(*) count FROM reports LEFT JOIN identities identity ON identity.id=reports.space_id WHERE ${reportScope.sql}`).get(...reportScope.parameters)?.count), sources: allCampuses ? arrayRecords(current.sources).map((s) => ({ id: s.id, dates: s.dates, owner: s.owner || null })) : [], integrations: allCampuses ? arrayRecords(current.services).map((s) => ({ id: s.id, status: s.status || "unconfigured", lastSuccessAt: s.lastSuccessAt || null })) : [], catalogReadable: allCampuses, user });
        return true;
      }
      if (path === "/api/v1/admin/catalog" && method === "GET") {
        const catalog = repository.current();
        assertCatalogReadable(user, catalog);
        send(catalog);
        return true;
      }
      if (path === "/api/v1/admin/drafts" && method === "GET") {
        const page = pagination(url), scope = catalogScopeSql(user, "drafts");
        sendPage(repository.db.prepare(`SELECT * FROM drafts WHERE ${scope.sql} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`).all(...scope.parameters, page.limit + 1, page.offset), page, (row) => safeDraft(row, user));
        return true;
      }
      if (path === "/api/v1/admin/drafts" && method === "POST") {
        const body = await readBody(request);
        revision(body, repository.revision());
        const catalog = checkedCatalog(body.catalog, user), summary = text(body.summary, 500, "\uBCC0\uACBD \uC694\uC57D");
        const id = randomUUID();
        repository.db.prepare("INSERT INTO drafts(id,catalog,summary,status,author_id,revision,base_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id, JSON.stringify(catalog), summary, "draft", user.id, 1, repository.revision(), now, now);
        repository.audit(user.id, "draft.created", id, now);
        send(safeDraft(repository.db.prepare("SELECT * FROM drafts WHERE id=?").get(id), user), 201);
        return true;
      }
      const draftMatch = path.match(/^\/api\/v1\/admin\/drafts\/([a-f0-9-]+)$/);
      if (draftMatch && method === "PATCH") {
        const body = await readBody(request);
        const row = repository.db.prepare("SELECT * FROM drafts WHERE id=?").get(draftMatch[1]);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uCD08\uC548\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        revision(body, Number(row.revision));
        assertCatalogScope(user, object3(JSON.parse(String(row.catalog))));
        let catalog = object3(JSON.parse(String(row.catalog))), summary = String(row.summary), nextStatus = String(row.status), reviewer = row.reviewer_id ? String(row.reviewer_id) : null;
        if (body.catalog !== void 0 || body.summary !== void 0) {
          if (!["draft", "rejected"].includes(nextStatus) || user.role !== "admin" && row.author_id !== user.id) fail(403, "FORBIDDEN", "\uBCF8\uC778\uC758 \uD3B8\uC9D1 \uAC00\uB2A5\uD55C \uCD08\uC548\uB9CC \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
          if (body.catalog !== void 0) catalog = checkedCatalog(body.catalog, user);
          if (body.summary !== void 0) summary = text(body.summary, 500, "\uBCC0\uACBD \uC694\uC57D");
          nextStatus = "draft";
          reviewer = null;
        }
        if (body.action === "submit") {
          if (!["draft", "rejected"].includes(nextStatus) || user.role !== "admin" && row.author_id !== user.id) fail(409, "INVALID_TRANSITION", "\uC81C\uCD9C\uD560 \uC218 \uC788\uB294 \uCD08\uC548\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
          nextStatus = "submitted";
        } else if (body.action === "approve" || body.action === "reject") {
          if (!["reviewer", "admin"].includes(user.role)) fail(403, "FORBIDDEN", "\uAC80\uD1A0 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
          if (nextStatus !== "submitted") fail(409, "INVALID_TRANSITION", "\uC81C\uCD9C\uB41C \uCD08\uC548\uB9CC \uAC80\uD1A0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
          if (user.role !== "admin" && row.author_id === user.id) fail(403, "SELF_APPROVAL_REJECTED", "\uB2E4\uB978 \uAC80\uD1A0\uC790\uAC00 \uC2B9\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.");
          nextStatus = body.action === "approve" ? "approved" : "rejected";
          reviewer = user.id;
        } else if (body.action !== void 0) fail(422, "INVALID_ACTION", "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uCD08\uC548 \uC791\uC5C5\uC785\uB2C8\uB2E4.");
        repository.db.prepare("UPDATE drafts SET catalog=?,summary=?,status=?,reviewer_id=?,revision=revision+1,updated_at=? WHERE id=?").run(JSON.stringify(catalog), summary, nextStatus, reviewer, now, String(row.id));
        repository.audit(user.id, `draft.${String(body.action || "updated")}`, String(row.id), now);
        send(safeDraft(repository.db.prepare("SELECT * FROM drafts WHERE id=?").get(String(row.id)), user));
        return true;
      }
      if (path === "/api/v1/admin/releases" && method === "GET") {
        const page = pagination(url), scope = catalogScopeSql(user, "releases");
        sendPage(repository.db.prepare(`SELECT id,summary,draft_id AS draftId,created_at AS createdAt FROM releases WHERE ${scope.sql} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...scope.parameters, page.limit + 1, page.offset), page);
        return true;
      }
      if (path === "/api/v1/admin/releases" && method === "POST") {
        if (!["admin", "reviewer"].includes(user.role)) fail(403, "FORBIDDEN", "\uACF5\uAC1C \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
        const body = await readBody(request);
        revision(body, repository.revision());
        const row = repository.db.prepare("SELECT * FROM drafts WHERE id=?").get(text(body.draftId, 100, "\uCD08\uC548"));
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uCD08\uC548\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        if (row.status !== "approved") fail(409, "APPROVAL_REQUIRED", "\uC2B9\uC778\uB41C \uCD08\uC548\uB9CC \uACF5\uAC1C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        if (Number(row.base_revision) !== repository.revision()) fail(409, "BASE_RELEASE_CHANGED", "\uACF5\uAC1C \uC790\uB8CC\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uCD5C\uC2E0 \uACF5\uAC1C\uD310\uC744 \uAE30\uC900\uC73C\uB85C \uC0C8 \uCD08\uC548\uC744 \uAC80\uD1A0\uD574 \uC8FC\uC138\uC694.");
        const catalog = checkedCatalog(JSON.parse(String(row.catalog)), user);
        const id = randomUUID();
        const prepared = checkedPublicBundle(id, catalog, now);
        repository.transaction(() => {
          rememberIds(catalog);
          repository.db.prepare("INSERT INTO releases VALUES(?,?,?,?,?,?)").run(id, JSON.stringify(catalog), String(row.summary), String(row.id), user.id, now);
          storeReleaseBundle(repository.db, prepared);
          repository.setSetting("currentRelease", id);
          repository.setSetting("revision", String(repository.revision() + 1));
          repository.db.prepare("UPDATE drafts SET status='published',revision=revision+1,updated_at=? WHERE id=?").run(now, String(row.id));
          repository.audit(user.id, "release.published", id, now);
        });
        metrics.releasesPublished++;
        send({ id, revision: repository.revision(), createdAt: now }, 201);
        return true;
      }
      const restoreMatch = path.match(/^\/api\/v1\/admin\/releases\/([a-f0-9-]+)\/restore$/);
      if (restoreMatch && method === "POST") {
        if (user.role !== "admin") fail(403, "FORBIDDEN", "\uBCF5\uAD6C\uB294 \uAD00\uB9AC\uC790\uB9CC \uC218\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        const body = await readBody(request);
        revision(body, repository.revision());
        const row = repository.db.prepare("SELECT catalog FROM releases WHERE id=?").get(restoreMatch[1]);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uACF5\uAC1C\uD310\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const catalog = checkedCatalog(JSON.parse(String(row.catalog)));
        ensureBundle(restoreMatch[1], catalog, now);
        repository.transaction(() => {
          rememberIds(catalog, true);
          repository.setSetting("currentRelease", restoreMatch[1]);
          repository.setSetting("revision", String(repository.revision() + 1));
          repository.audit(user.id, "release.restored", restoreMatch[1], now);
        });
        send({ id: restoreMatch[1], revision: repository.revision() });
        return true;
      }
      if (path === "/api/v1/admin/reports" && method === "GET") {
        const page = pagination(url), scope = identityScopeSql(user);
        sendPage(repository.db.prepare(`SELECT reports.* FROM reports LEFT JOIN identities identity ON identity.id=reports.space_id WHERE ${scope.sql} ORDER BY reports.created_at DESC,reports.id DESC LIMIT ? OFFSET ?`).all(...scope.parameters, page.limit + 1, page.offset), page, safeReport);
        return true;
      }
      const reportMatch = path.match(/^\/api\/v1\/admin\/reports\/([a-f0-9-]+)(\/photo)?$/);
      if (reportMatch) {
        const row = repository.db.prepare("SELECT * FROM reports WHERE id=?").get(reportMatch[1]);
        if (!row) fail(404, "RESOURCE_NOT_FOUND", "\uC811\uC218\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        assertIdentityScope(user, String(row.space_id));
        if (method === "GET" && reportMatch[2]) {
          if (!row.photo) fail(404, "RESOURCE_NOT_FOUND", "\uC0AC\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
          response.writeHead(200, { ...headers, "Content-Type": String(row.photo_mime), "Content-Disposition": 'attachment; filename="report-photo"' });
          response.end(row.photo);
          return true;
        }
        if (method === "GET") {
          send(safeReport(row));
          return true;
        }
        if (method === "PATCH" && !reportMatch[2]) {
          const body = await readBody(request);
          const state = text(body.status, 20, "\uCC98\uB9AC \uC0C1\uD0DC");
          if (!["received", "reviewing", "resolved", "rejected"].includes(state)) fail(422, "INVALID_STATUS", "\uCC98\uB9AC \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
          const note = text(body.responseNote || "", 1e3, "\uCC98\uB9AC \uB0B4\uC6A9", false);
          repository.db.prepare("UPDATE reports SET status=?,response_note=?,updated_at=? WHERE id=?").run(state, note, now, String(row.id));
          repository.audit(user.id, "report.updated", String(row.id), now);
          send(safeReport(repository.db.prepare("SELECT * FROM reports WHERE id=?").get(String(row.id))));
          return true;
        }
      }
      if (path === "/api/v1/admin/operations" && method === "GET") {
        const page = pagination(url), scope = identityScopeSql(user);
        sendPage(repository.db.prepare(`SELECT operations.payload FROM operations LEFT JOIN identities identity ON identity.id=operations.entity_id WHERE ${scope.sql} ORDER BY operations.updated_at DESC,operations.id DESC LIMIT ? OFFSET ?`).all(...scope.parameters, page.limit + 1, page.offset), page, (row) => object3(JSON.parse(String(row.payload))));
        return true;
      }
      if (path === "/api/v1/admin/operations" && method === "POST") {
        if (!["admin", "reviewer"].includes(user.role)) fail(403, "FORBIDDEN", "\uC6B4\uC601 \uC815\uBCF4 \uACF5\uAC1C\uB294 \uAC80\uD1A0 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
        const body = await readBody(request), payload = makeOperation(body, user, now), id = String(payload.id), entityId = String(payload.entityId);
        const old = repository.db.prepare("SELECT entity_id,payload FROM operations WHERE id=?").get(id);
        if (old) {
          assertIdentityScope(user, String(old.entity_id));
          revision(body, Number(object3(JSON.parse(String(old.payload))).revision || 1));
        }
        payload.revision = old ? Number(object3(JSON.parse(String(old.payload))).revision || 1) + 1 : 1;
        repository.db.prepare("INSERT INTO operations VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET entity_id=excluded.entity_id,payload=excluded.payload,actor_id=excluded.actor_id,updated_at=excluded.updated_at").run(id, entityId, JSON.stringify(payload), user.id, now, now);
        repository.audit(user.id, "operation.published", id, now);
        send(payload, old ? 200 : 201);
        return true;
      }
      if (path === "/api/v1/admin/audit" && method === "GET") {
        if (user.role !== "admin") fail(403, "FORBIDDEN", "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
        const page = pagination(url, 200);
        sendPage(repository.db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?").all(page.limit + 1, page.offset), page);
        return true;
      }
      fail(404, "RESOURCE_NOT_FOUND", "\uC694\uCCAD\uD55C \uB9AC\uC18C\uC2A4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      const known = error instanceof ApiError;
      status = known ? error.status : error instanceof URIError ? 400 : 500;
      metrics.errors++;
      if (!response.headersSent) {
        response.writeHead(status, headers);
        response.end(JSON.stringify({ data: null, error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." }, meta: { requestId, revision: repository.revision() } }));
      } else response.end();
    } finally {
      options.log?.({ timestamp: clock().toISOString(), level: status >= 500 ? "error" : "info", service: "campus-api", requestId, operation: (request.url || "").split("?")[0], durationMs: Math.round(performance.now() - started), status });
    }
    return true;
  }
  return { handle, repository, metrics, close: () => repository.close() };
}
export {
  CampusRepository,
  createPlatform,
  fetchProvider,
  loadDomain,
  loadProviders,
  passwordHash,
  publicNetworkAddress
};
