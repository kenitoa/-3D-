// Framework-free measurement, independent registration checks and public asset contracts.
(() => {
  const record = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
  const finitePoint = (value, dimensions = null) => Array.isArray(value) && (dimensions ? value.length === dimensions : [2, 3].includes(value.length)) && value.every((item) => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) < 1e9);
  const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(value);
  const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const distance = (a, b, planar = false) => Math.hypot(...a.map((value, index) => planar && index === 2 ? 0 : value - (b[index] || 0)));
  function measureGeometry(points, kind, options = {}) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 10000 || !points.every((point) => finitePoint(point)) || !points.every((point) => point.length === points[0].length)) throw new TypeError('Measurement requires finite meter coordinates of one dimension.');
    if (!['planar-distance', 'path-distance', 'height-difference', 'area'].includes(kind)) throw new TypeError('Unknown measurement kind.');
    if (!record(options) || options.confirmation !== undefined && !['verified', 'mapped', 'estimated', 'unverified'].includes(options.confirmation) || options.accuracyMeters !== undefined && (!Number.isFinite(options.accuracyMeters) || options.accuracyMeters < 0) || options.version !== undefined && (typeof options.version !== 'string' || options.version.length > 160)) throw new TypeError('Invalid measurement evidence.');
    let value = 0;
    let perimeter = 0;
    if (kind === 'area') {
      if (points.length < 4 || distance(points[0], points[points.length - 1], true) > 1e-8) throw new TypeError('Area requires a closed polygon with at least three corners.');
      const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const between = (a, b, c) => Math.min(a, b) <= c && c <= Math.max(a, b);
      const crosses = (a, b, c, d) => {
        const p = turn(a, b, c), q = turn(a, b, d), r = turn(c, d, a), s = turn(c, d, b);
        return p * q < 0 && r * s < 0 || p === 0 && between(a[0], b[0], c[0]) && between(a[1], b[1], c[1]) || q === 0 && between(a[0], b[0], d[0]) && between(a[1], b[1], d[1]) || r === 0 && between(c[0], d[0], a[0]) && between(c[1], d[1], a[1]) || s === 0 && between(c[0], d[0], b[0]) && between(c[1], d[1], b[1]);
      };
      for (let i = 0; i < points.length - 1; i++) {
        if (distance(points[i], points[i + 1], true) < 1e-8) throw new TypeError('A polygon edge cannot have zero length.');
        for (let j = i + 2; j < points.length - 1; j++) if (!(i === 0 && j === points.length - 2) && crosses(points[i], points[i + 1], points[j], points[j + 1])) throw new TypeError('A measured polygon cannot intersect itself.');
        value += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
        perimeter += distance(points[i], points[i + 1], true);
      }
      value = Math.abs(value) / 2;
      if (value < 1e-8) throw new TypeError('The measured polygon has no area.');
    } else if (kind === 'height-difference') {
      if (points.length !== 2 || points[0].length !== 3) throw new TypeError('Height difference requires exactly two three-dimensional points.');
      value = Math.abs(points[1][2] - points[0][2]);
    } else if (kind === 'planar-distance') {
      if (points.length !== 2) throw new TypeError('Planar distance requires two endpoints.');
      value = distance(points[0], points[1], true);
    } else for (let i = 1; i < points.length; i++) value += distance(points[i - 1], points[i]);
    const accuracy = options.accuracyMeters;
    return { value, unit: kind === 'area' ? 'm2' : 'm', approximate: options.confirmation !== 'verified', uncertainty: accuracy === undefined ? null : kind === 'area' ? perimeter * accuracy + Math.PI * accuracy ** 2 : kind === 'path-distance' ? 2 * accuracy * (points.length - 1) : 2 * accuracy, version: options.version || null, points: points.length };
  }
  function registrationReport(input) {
    const p = input?.placement, tolerance = input?.toleranceMeters;
    if (!record(p) || !['m', 'cm', 'mm'].includes(p.units) || !['Y', 'Z'].includes(p.upAxis) || !finitePoint(p.origin, 3) || !finitePoint(p.anchorMeters, 3) || !Number.isFinite(p.yawRadians) || p.altitudeDatum !== 'local-site-meters' || !['measured', 'inferred'].includes(p.mode) || !record(tolerance) || !positive(tolerance.horizontal) || !positive(tolerance.vertical) || !Array.isArray(input.landmarks) || input.landmarks.length > 10000) throw new TypeError('Registration requires an absolute local meter datum and agreed tolerances.');
    const ids = new Set();
    const scale = p.units === 'm' ? 1 : p.units === 'cm' ? 0.01 : 0.001;
    const orient = (point) => {
      const a = point.map((value, index) => (value - p.origin[index]) * scale);
      // Babylon Y-up placement: campus east=x, north=-z, altitude=y.
      const x = a[0], y = p.upAxis === 'Z' ? a[2] : a[1], z = p.upAxis === 'Z' ? -a[1] : a[2];
      const c = Math.cos(p.yawRadians), s = Math.sin(p.yawRadians);
      return [p.anchorMeters[0] + c * x + s * z, p.anchorMeters[1] - (-s * x + c * z), p.anchorMeters[2] + y];
    };
    const residuals = input.landmarks.map((item) => {
      if (!record(item) || !identifier(item.id) || ids.has(item.id) || !['control', 'holdout'].includes(item.role) || !finitePoint(item.model, 3) || !finitePoint(item.siteMeters, 3)) throw new TypeError('Invalid or duplicate registration landmark.');
      ids.add(item.id);
      const predictedMeters = orient(item.model), horizontalMeters = Math.hypot(predictedMeters[0] - item.siteMeters[0], predictedMeters[1] - item.siteMeters[1]), verticalMeters = Math.abs(predictedMeters[2] - item.siteMeters[2]);
      return { id: item.id, role: item.role, horizontalMeters, verticalMeters, distanceMeters: Math.hypot(horizontalMeters, verticalMeters), predictedMeters, passed: horizontalMeters <= tolerance.horizontal && verticalMeters <= tolerance.vertical };
    });
    const holdouts = residuals.filter((item) => item.role === 'holdout');
    const checks = input.landmarks.filter((item) => item.role === 'holdout'), controls = input.landmarks.filter((item) => item.role === 'control');
    const separated = checks.every((item, index) => checks.slice(index + 1).every((other) => distance(item.siteMeters, other.siteMeters) > 1e-6 && distance(item.model, other.model) * scale > 1e-6) && controls.every((control) => distance(item.siteMeters, control.siteMeters) > 1e-6 && distance(item.model, control.model) * scale > 1e-6));
    const noncollinear = (points) => {
      if (points.length < 3) return false;
      const a = points[0], b = points.find((point) => Math.hypot(point[0] - a[0], point[1] - a[1]) > 1e-6);
      return Boolean(b && points.some((c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > Math.max(1e-6, tolerance.horizontal ** 2)));
    };
    const independent = holdouts.length >= 3 && separated && noncollinear(checks.map((item) => item.siteMeters)) && noncollinear(checks.map((item) => [item.model[0] * scale, item.model[p.upAxis === 'Z' ? 1 : 2] * scale]));
    const horizontalRmsMeters = holdouts.length ? Math.sqrt(holdouts.reduce((sum, item) => sum + item.horizontalMeters ** 2, 0) / holdouts.length) : null;
    const verticalRmsMeters = holdouts.length ? Math.sqrt(holdouts.reduce((sum, item) => sum + item.verticalMeters ** 2, 0) / holdouts.length) : null;
    return { residuals, holdoutSummary: { count: holdouts.length, horizontalRmsMeters, verticalRmsMeters, horizontalMaxMeters: holdouts.length ? Math.max(...holdouts.map((item) => item.horizontalMeters)) : null, verticalMaxMeters: holdouts.length ? Math.max(...holdouts.map((item) => item.verticalMeters)) : null }, passed: independent && residuals.every((item) => item.passed), verification: independent ? 'independent-check' : 'insufficient-holdout', confirmationUnchanged: true };
  }
  function inspectGlb(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > 128 * 1024 * 1024) throw new TypeError('Invalid or oversized GLB bytes.');
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new TypeError('Invalid GLB container.');
    const length = view.getUint32(12, true);
    if (length % 4 || length > buffer.byteLength - 20) throw new TypeError('Invalid GLB JSON chunk.');
    const data = JSON.parse(new globalThis.TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
    if (!record(data) || !record(data.asset) || data.asset.version !== '2.0') throw new TypeError('Invalid glTF asset.');
    const queue = [data];
    while (queue.length) {
      const current = queue.pop();
      if (Array.isArray(current)) queue.push(...current);
      else if (record(current)) for (const [key, item] of Object.entries(current)) {
        if (key === 'uri' && (typeof item !== 'string' || !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\s]*$/.test(item))) throw new TypeError('Public GLB preview cannot fetch external resources.');
        if (['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(key)) throw new TypeError('Public GLB preview requires an uncompressed audited asset.');
        if (typeof item === 'object' && item !== null) queue.push(item);
      }
    }
    const accessors = data.accessors || [], meshes = data.meshes || [], bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    let triangles = 0, vertices = 0, primitives = 0, bounded = false;
    if (!Array.isArray(accessors) || !Array.isArray(meshes)) throw new TypeError('Invalid glTF geometry lists.');
    for (const mesh of meshes) {
      if (!record(mesh) || !Array.isArray(mesh.primitives)) throw new TypeError('Invalid glTF primitives.');
      for (const primitive of mesh.primitives) {
        if (!record(primitive) || !record(primitive.attributes)) throw new TypeError('Invalid glTF primitive.');
        const accessor = accessors[primitive.attributes.POSITION];
        if (!record(accessor) || !Number.isSafeInteger(accessor.count) || accessor.count < 1) throw new TypeError('Missing position count.');
        const indexed = primitive.indices === undefined ? accessor : accessors[primitive.indices];
        if (!record(indexed) || !Number.isSafeInteger(indexed.count) || indexed.count < 1) throw new TypeError('Missing index count.');
        const mode = primitive.mode ?? 4;
        if (![0, 1, 2, 3, 4, 5, 6].includes(mode)) throw new TypeError('Unsupported glTF topology.');
        if (mode === 4 && indexed.count % 3) throw new TypeError('Triangle index count is not divisible by three.');
        triangles += mode === 4 ? indexed.count / 3 : [5, 6].includes(mode) ? Math.max(0, indexed.count - 2) : 0;
        vertices += accessor.count; primitives++;
        if (finitePoint(accessor.min, 3) && finitePoint(accessor.max, 3)) { bounded = true; for (let axis = 0; axis < 3; axis++) { bounds.min[axis] = Math.min(bounds.min[axis], accessor.min[axis]); bounds.max[axis] = Math.max(bounds.max[axis], accessor.max[axis]); } }
      }
    }
    const extensions = [...new Set([...(data.extensionsRequired || []), ...(data.extensionsUsed || [])])].sort();
    if (!extensions.every((item) => typeof item === 'string')) throw new TypeError('Invalid glTF extension declaration.');
    if (extensions.some((item) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(item))) throw new TypeError('Public GLB preview requires an uncompressed audited asset.');
    return { bytes: buffer.byteLength, meshes: meshes.length, primitives, triangles, materials: Array.isArray(data.materials) ? data.materials.length : 0, textures: Array.isArray(data.textures) ? data.textures.length : 0, images: Array.isArray(data.images) ? data.images.length : 0, vertices, bounds: bounded ? bounds : null, extensions, decoderRequired: extensions.some((item) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(item)) };
  }
  function validateMedia(value) {
    const extension = { image: '(?:png|jpg|jpeg|webp)', audio: '(?:mp3|ogg|wav)', video: '(?:mp4|webm)' };
    if (!record(value) || !Object.hasOwn(extension, value.kind) || typeof value.path !== 'string' || !new RegExp(`^assets/media/[a-zA-Z0-9_/-]+\\.${extension[value.kind]}$`).test(value.path) || value.path.split('/').some((part) => part.startsWith('.')) || !identifier(value.sourceId) || typeof value.license !== 'string' || value.license.trim().length < 1 || value.license.length > 300 || value.public !== true || value.caption !== undefined && (typeof value.caption !== 'string' || value.caption.length > 1000)) throw new TypeError('Media requires a public local asset, source and reuse license.');
    return { kind: value.kind, path: value.path, sourceId: value.sourceId, license: value.license, public: true, ...(value.caption ? { caption: value.caption } : {}) };
  }
  function compareRelease(previous, next) {
    if (!Array.isArray(previous?.entities) || !Array.isArray(next?.entities)) throw new TypeError('Release comparison requires entity lists.');
    const canonical = (value) => Array.isArray(value) ? value.map(canonical) : record(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
    const makeMap = (entities) => { const result = new Map(); for (const entity of entities) { if (!record(entity) || !identifier(entity.id) || result.has(entity.id)) throw new TypeError('Invalid release identity.'); result.set(entity.id, JSON.stringify(canonical(entity))); } return result; };
    const a = makeMap(previous.entities), b = makeMap(next.entities);
    return { added: [...b.keys()].filter((id) => !a.has(id)).sort(), removed: [...a.keys()].filter((id) => !b.has(id)).sort(), changed: [...b.keys()].filter((id) => a.has(id) && a.get(id) !== b.get(id)).sort(), unchanged: [...b.keys()].filter((id) => a.get(id) === b.get(id)).sort() };
  }
  function validateReleaseBundle(value) {
    if (!record(value) || value.schemaVersion !== 1 || !identifier(value.version) || !identifier(value.catalogVersion) || !identifier(value.modelManifestVersion) || typeof value.coordinateReference !== 'string' || !value.coordinateReference || value.coordinateReference.length > 300 || !Array.isArray(value.assets) || value.assets.length > 10000 || !record(value.approval) || !['draft', 'approved'].includes(value.approval.status)) throw new TypeError('Invalid public release bundle.');
    const paths = new Set();
    for (const asset of value.assets) {
      if (!record(asset) || typeof asset.path !== 'string' || !/^(?:assets\/releases\/[a-f0-9]{64}\.js|assets\/[a-zA-Z0-9_/-]+\.(?:glb|png|jpg|jpeg|webp|mp3|ogg|wav|mp4|webm)|src\/models\/[a-z0-9_-]+\.js|src\/data\/[a-z0-9_-]+\.json)$/.test(asset.path) || asset.path.split('/').some((part) => part.startsWith('.')) || paths.has(asset.path) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(asset.sha256) || !Array.isArray(asset.spaceIds) || !asset.spaceIds.every(identifier) || new Set(asset.spaceIds).size !== asset.spaceIds.length) throw new TypeError('Invalid public release asset.');
      paths.add(asset.path);
    }
    if (value.approval.status === 'approved' && (!identifier(value.approval.reviewedBy) || typeof value.approval.reviewedAt !== 'string' || !Number.isFinite(Date.parse(value.approval.reviewedAt)))) throw new TypeError('An approved bundle requires a reviewer and review time.');
    return { schemaVersion: 1, version: value.version, catalogVersion: value.catalogVersion, modelManifestVersion: value.modelManifestVersion, coordinateReference: value.coordinateReference, assets: value.assets.map((asset) => ({ path: asset.path, bytes: asset.bytes, sha256: asset.sha256, spaceIds: [...asset.spaceIds] })), approval: { status: value.approval.status, reviewedBy: value.approval.reviewedBy ?? null, reviewedAt: value.approval.reviewedAt ?? null } };
  }
  const api = { measureGeometry, registrationReport, inspectGlb, validateMedia, compareRelease, validateReleaseBundle };
  Object.assign(globalThis, { CampusRefinement: api });
  if (typeof window !== 'undefined') Object.assign(window, { CampusRefinement: api });
})();
