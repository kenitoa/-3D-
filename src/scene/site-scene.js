// @ts-check
// Meter-based campus presentation. The original building meshes remain reusable.
(function publishCampusSiteScene() {
  "use strict";

  /** @typedef {[number, number]} Point */
  /** @typedef {import("babylonjs").Scene} Scene */
  /** @typedef {import("babylonjs").Mesh} Mesh */
  /** @typedef {import("babylonjs").Material} Material */
  /** @typedef {{id:string,name?:string,kind?:string,geometryType?:string,pointsMeters:Point[],polygonsMeters?:{outer:Point[],holes:Point[][]}[],sourceId?:string,status?:string,confidence?:string,footprintStatus?:string,tags?:Record<string,unknown>,legacyKey?:string,anchorMeters?:Point,angleRadians?:number,heightMeters?:number,widthMeters?:number,levels?:number}} Feature */
  /** @typedef {{id:string,meters:Point,legacy?:Point,rotationRadians?:number,status?:string,rotationStatus?:string,sourceId?:string}} Anchor */
  /** @typedef {{boundaries:{campusMapped:Feature,legal?:Feature|null,planning?:Feature|null,cadastral?:Feature|null},features:Record<string,Feature[]>,anchors?:Anchor[],transforms?:{metersToLegacy:{x:number[],y:number[]}}}} SitePlan */
  /** @typedef {{xs:number[],zs:number[],elevations:number[][],baseElevationMeters:number}} Terrain */
  /** @typedef {{root:import("babylonjs").TransformNode,main?:Mesh,hall?:Mesh,newDorm?:Mesh,mediaHall?:Mesh}} Model */
  /** @typedef {{terrain?:Terrain,canvas?:HTMLCanvasElement|null,metersPerUnit?:number,verticalExaggeration?:number,createCamera?:boolean,fitFootprint?:boolean,batchRepeatedMeshes?:boolean}} Options */
  const B = /** @type {typeof import("babylonjs")} */ (/** @type {unknown} */ (BABYLON));
  const EPSILON = 1e-8;
  const LAYERS = ["terrain", "boundary", "buildings", "roads", "paths", "parking", "sports", "greenery", "trees", "contours", "water", "entrances", "context"];
  const BOUNDARY_STYLES = {
    guide: { name: "안내 영역", pattern: "dash", color: "#285940", widthMeters: 1.4, periodMeters: 14, dashMeters: 8.6, legal: false },
    legal: { name: "소유 경계", pattern: "solid", color: "#623d4f", widthMeters: 1.6, periodMeters: 0, dashMeters: 0, legal: true },
    planning: { name: "계획 경계", pattern: "dash-dot", color: "#8c6926", widthMeters: 1.2, periodMeters: 20, dashMeters: 11, legal: false },
    cadastral: { name: "지적 경계", pattern: "dot", color: "#456779", widthMeters: 1.1, periodMeters: 5, dashMeters: 1.6, legal: false }
  };

  /** @param {Point[]} polygon @returns {number} */
  function signedArea(polygon) {
    return polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2;
  }

  /** @param {Point} point @param {Point[]} polygon @returns {boolean} */
  function contains(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const a = polygon[index];
      const b = polygon[previous];
      const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
      if (Math.abs(cross) < EPSILON && point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON && point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  /** @param {Point[]} input @returns {Point[]} */
  function cleanPolygon(input) {
    const points = input.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const clean = points.filter((point, index) => !index || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > EPSILON);
    if (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < EPSILON) clean.pop();
    return clean;
  }

  /** Ear clipping handles the concave mapped boundary without a new dependency.
   * @param {Point[]} polygon @returns {number[]} */
  function triangulate(polygon) {
    if (polygon.length < 3) return [];
    const remaining = polygon.map((_, index) => index);
    if (signedArea(polygon) < 0) remaining.reverse();
    const triangles = [];
    const cross = (/** @type {Point} */ a, /** @type {Point} */ b, /** @type {Point} */ c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    let guard = polygon.length * polygon.length;
    while (remaining.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let index = 0; index < remaining.length; index += 1) {
        const a = remaining[(index + remaining.length - 1) % remaining.length];
        const b = remaining[index];
        const c = remaining[(index + 1) % remaining.length];
        if (cross(polygon[a], polygon[b], polygon[c]) <= EPSILON) continue;
        const occupied = remaining.some((candidate) => {
          if ([a, b, c].includes(candidate) || [a, b, c].some((corner) => Math.hypot(polygon[corner][0] - polygon[candidate][0], polygon[corner][1] - polygon[candidate][1]) < EPSILON)) return false;
          return cross(polygon[a], polygon[b], polygon[candidate]) >= -EPSILON && cross(polygon[b], polygon[c], polygon[candidate]) >= -EPSILON && cross(polygon[c], polygon[a], polygon[candidate]) >= -EPSILON;
        });
        if (occupied) continue;
        triangles.push(a, c, b); // Upward normal in the Babylon x/z plane.
        remaining.splice(index, 1);
        clipped = true;
        break;
      }
      if (!clipped) throw new Error("부지 폴리곤을 삼각형으로 나눌 수 없습니다. 경계 교차와 중복점을 확인하세요.");
    }
    if (remaining.length === 3) triangles.push(remaining[0], remaining[2], remaining[1]);
    return triangles;
  }

  /** @param {Point[]} polygon @returns {{minX:number,maxX:number,minZ:number,maxZ:number,width:number,depth:number,center:Point}} */
  function boundsOf(polygon) {
    const minX = Math.min(...polygon.map((point) => point[0]));
    const maxX = Math.max(...polygon.map((point) => point[0]));
    const minZ = Math.min(...polygon.map((point) => point[1]));
    const maxZ = Math.max(...polygon.map((point) => point[1]));
    return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ, center: [(minX + maxX) / 2, (minZ + maxZ) / 2] };
  }

  /** Join an outer rectangle and an interior campus ring with a zero-width
   * bridge. Its triangulation excludes the campus instead of overlapping it.
   * @param {Point[]} outer @param {Point[]} hole @returns {Point[]} */
  function polygonWithHole(outer, hole) {
    const exterior = boundsOf(outer);
    const interior = cleanPolygon(hole);
    if (signedArea(interior) > 0) interior.reverse();
    let rightmost = 0;
    interior.forEach((point, index) => { if (point[0] > interior[rightmost][0]) rightmost = index; });
    const origin = interior[rightmost];
    const bridge = /** @type {Point} */ ([exterior.maxX, origin[1]]);
    const ring = [...interior.slice(rightmost), ...interior.slice(0, rightmost)];
    return [[exterior.minX, exterior.minZ], [exterior.maxX, exterior.minZ], bridge, ...ring, origin, bridge, [exterior.maxX, exterior.maxZ], [exterior.minX, exterior.maxZ]];
  }

  /** Bridge disjoint holes into any simple exterior. Parts remain separate;
   * no convex envelope is substituted for detached campus parcels.
   * @param {Point[]} outer @param {Point[][]} holes @returns {Point[]} */
  function polygonWithHoles(outer, holes) {
    let polygon = cleanPolygon(outer);
    if (signedArea(polygon) < 0) polygon.reverse();
    const ordered = holes.map(cleanPolygon).sort((a, b) => boundsOf(b).maxX - boundsOf(a).maxX);
    for (const input of ordered) {
      const hole = [...input]; if (signedArea(hole) > 0) hole.reverse();
      let rightmost = 0; hole.forEach((point, index) => { if (point[0] > hole[rightmost][0]) rightmost = index; });
      const origin = hole[rightmost]; let edge = -1; let closest = Infinity;
      for (let index = 0; index < polygon.length; index += 1) {
        const a = polygon[index]; const b = polygon[(index + 1) % polygon.length];
        if ((a[1] > origin[1]) === (b[1] > origin[1])) continue;
        const x = a[0] + (origin[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
        if (x >= origin[0] - EPSILON && x < closest) { closest = x; edge = index; }
      }
      if (edge < 0) throw new Error('부지의 제외 영역은 외곽 안에 있어야 합니다.');
      const bridge = /** @type {Point} */ ([closest, origin[1]]);
      const ring = [...hole.slice(rightmost), ...hole.slice(0, rightmost)];
      polygon = cleanPolygon([...polygon.slice(0, edge + 1), bridge, ...ring, origin, bridge, ...polygon.slice(edge + 1)]);
    }
    return polygon;
  }

  /** @param {Point} point @param {Point[]} polygon @returns {number} */
  function distanceToPolygon(point, polygon) {
    let distance = Infinity;
    polygon.forEach((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      distance = Math.min(distance, Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t));
    });
    return distance;
  }

  /** @param {Terrain|undefined} terrain @param {number} x @param {number} z @returns {number} */
  function sampleElevation(terrain, x, z) {
    if (!terrain || terrain.xs.length < 2 || terrain.zs.length < 2) return 0;
    const sx = Math.max(terrain.xs[0], Math.min(terrain.xs[terrain.xs.length - 1], x));
    const sz = Math.max(terrain.zs[0], Math.min(terrain.zs[terrain.zs.length - 1], z));
    let xi = 0;
    let zi = 0;
    while (xi < terrain.xs.length - 2 && sx > terrain.xs[xi + 1]) xi += 1;
    while (zi < terrain.zs.length - 2 && sz > terrain.zs[zi + 1]) zi += 1;
    const tx = (sx - terrain.xs[xi]) / (terrain.xs[xi + 1] - terrain.xs[xi]);
    const tz = (sz - terrain.zs[zi]) / (terrain.zs[zi + 1] - terrain.zs[zi]);
    const low = terrain.elevations[zi][xi] * (1 - tx) + terrain.elevations[zi][xi + 1] * tx;
    const high = terrain.elevations[zi + 1][xi] * (1 - tx) + terrain.elevations[zi + 1][xi + 1] * tx;
    return low * (1 - tz) + high * tz - terrain.baseElevationMeters;
  }

  /** Babylon's left-handed normal convention differs from a planar shoelace
   * orientation. Explicitly orient all surface triangles toward the sky.
   * @param {number[]} positions @param {number[]} indices @returns {number[]} */
  function upwardNormals(positions, indices) {
    /** @type {number[]} */ const normals = [];
    B.VertexData.ComputeNormals(positions, indices, normals);
    let vertical = 0;
    for (let index = 1; index < normals.length; index += 3) vertical += normals[index];
    if (vertical < 0) {
      for (let index = 0; index < indices.length; index += 3) {
        const middle = indices[index + 1]; indices[index + 1] = indices[index + 2]; indices[index + 2] = middle;
      }
      B.VertexData.ComputeNormals(positions, indices, normals);
    }
    return normals;
  }

  /** @param {Scene} scene @param {Record<string,Material>} original @param {SitePlan} sitePlan @param {Options} [options] */
  function create(scene, original, sitePlan, options = {}) {
    // East (+X), north (-Z), and up (+Y) form a right-handed geographic frame.
    // A left-handed camera would mirror east and west in an overhead view.
    scene.useRightHandedSystem = true;
    const metersPerUnit = options.metersPerUnit ?? 10;
    if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) throw new Error("metersPerUnit은 양수여야 합니다.");
    /** @param {Point} point @returns {Point} */
    const worldPoint = (point) => [point[0] / metersPerUnit, -point[1] / metersPerUnit];
    const mapped = sitePlan.boundaries.campusMapped;
    const parts = (mapped.polygonsMeters?.length ? mapped.polygonsMeters : [{ outer: mapped.pointsMeters, holes: [] }]).map((part) => ({ outer: cleanPolygon(part.outer).map(worldPoint), holes: (part.holes || []).map((ring) => cleanPolygon(ring).map(worldPoint)) }));
    if (parts.some((part) => part.outer.length < 3 || part.holes.some((ring) => ring.length < 3))) throw new Error('각 부지 외곽과 제외 영역에는 유효한 점 3개 이상이 필요합니다.');
    const boundary = parts.flatMap((part) => part.outer);
    const insideCampus = (/** @type {Point} */ point) => parts.some((part) => contains(point, part.outer) && !part.holes.some((hole) => contains(point, hole)));
    if (boundary.length < 3) throw new Error("전체 캠퍼스 경계에는 최소 3개의 유효한 점이 필요합니다.");
    const bounds = boundsOf(boundary);
    if (bounds.width <= EPSILON || bounds.depth <= EPSILON || parts.some((part) => Math.abs(signedArea(part.outer)) <= EPSILON)) throw new Error("캠퍼스 경계의 면적과 가로·세로 길이는 양수여야 합니다.");
    /** @type {Record<string,Mesh[]>} */
    const layers = Object.fromEntries(LAYERS.map((layer) => [layer, []]));
    /** @type {Mesh[]} */
    const meshes = [];
    /** @type {import('babylonjs').LinesMesh[]} */ const interactionMeshes = [];
    /** @type {{hovered:string|null,selected:string|null,searchIds:string[],routeIds:string[]}} */
    let interactionState = { hovered: null, selected: null, searchIds: [], routeIds: [] };
    /** @type {Mesh[]} */ const locationMeshes = [];
    /** @type {[number,number,number]|null} */ let locationPoint = null;
    /** @type {{feature:Feature,mesh:Mesh}[]} */
    const featureMarkers = [];
    /** @type {import("babylonjs").StandardMaterial[]} */
    const createdMaterials = [];
    /** @type {{mesh:Mesh,offset:number}[]} */
    const draped = [];
    /** @type {{mesh:Mesh,x:number,z:number,offset:number}[]} */
    const grounded = [];
    /** @type {{mesh:Mesh,height:number}[]} */ const proxyVolumes = [];
    /** @type {{model:Model,id:string}[]} */
    const aligned = [];
    /** @type {{model:Model,id:string,baseY:number,anchorY:number}[]} */ const externals = [];
    /** @type {Map<string,Model>} */ const proxies = new Map();
    /** @type {Record<string,boolean>} */ const layerVisibility = {};
    /** @type {Map<string,boolean>} */ const featureVisibility = new Map();
    /** @type {Map<string,boolean>} */ const detailVisibility = new Map();
    /** @type {WeakMap<import('babylonjs').TransformNode,import('babylonjs').AbstractMesh[]>} */ const modelMeshes = new WeakMap();
    /** @type {WeakMap<import("babylonjs").TransformNode,{scaling:import("babylonjs").Vector3,center:import("babylonjs").Vector3,width:number,depth:number,height:number,meshNames:string[]}>} */
    const originals = new WeakMap();
    const batching = { sourceMeshes: 0, mergedMeshes: 0, removedMeshes: 0 };
    /** @type {string[]} */
    const failures = [];
    /** @param {string} id */
    function syncBuilding(id) {
      const feature = (sitePlan.features.buildings || []).find((entry) => entry.id === id || entry.legacyKey === id);
      const featureId = feature?.id || id;
      const showDetail = detailVisibility.get(featureId) !== false;
      const visible = layerVisibility.buildings !== false && featureVisibility.get(featureId) !== false;
      proxies.get(featureId)?.root.setEnabled(visible && !showDetail);
      const instances = [...aligned, ...externals].filter((entry) => entry.id === id || entry.id === feature?.legacyKey || entry.id === featureId);
      if (!instances.length) proxies.get(featureId)?.root.setEnabled(visible);
      instances.forEach(({ model }) => {
        model.root.setEnabled(visible && showDetail);
        (modelMeshes.get(model.root) || []).forEach((mesh) => { if (!mesh.isDisposed() && !mesh.parent) mesh.setEnabled(visible && showDetail); });
      });
    }
    let exaggeration = options.verticalExaggeration ?? 1;
    if (!Number.isFinite(exaggeration) || exaggeration < 1 || exaggeration > 3) throw new Error("지형 강조 배수는 1~3 범위여야 합니다.");
    /** @param {string} name @param {string} hex */
    function makeMaterial(name, hex) {
      const material = new B.StandardMaterial(`site-${name}`, scene);
      material.diffuseColor = B.Color3.FromHexString(hex);
      material.specularColor = new B.Color3(0.04, 0.04, 0.04);
      material.alpha = 1;
      material.backFaceCulling = false;
      createdMaterials.push(material);
      return material;
    }
    const palette = {
      campus: makeMaterial("campus-ground", "#94b981"),
      context: makeMaterial("context-ground", "#d4d9c5"),
      boundary: makeMaterial("mapped-boundary", "#285940"),
      legalBoundary: makeMaterial("legal-boundary", BOUNDARY_STYLES.legal.color),
      planningBoundary: makeMaterial("planning-boundary", BOUNDARY_STYLES.planning.color),
      cadastralBoundary: makeMaterial("cadastral-boundary", BOUNDARY_STYLES.cadastral.color),
      road: makeMaterial("vehicle-road", "#929184"),
      path: makeMaterial("pedestrian-path", "#e0d5b0"),
      parking: makeMaterial("parking", "#c1bea9"),
      line: makeMaterial("marking", "#f4f0db"),
      sports: makeMaterial("sports", "#91ad78"),
      forest: makeMaterial("forest", "#749466"),
      tree: makeMaterial("tree", "#648457"),
      trunk: makeMaterial("trunk", "#87775e"),
      water: makeMaterial("water", "#a9c5bf"),
      building: original.wall || makeMaterial("building", "#d8d1c2"),
      entry: makeMaterial("entrance", "#e5cc8e"),
      location: makeMaterial("user-location", "#236a87")
    };
    /** @param {number} x @param {number} z */
    function rawHeight(x, z) {
      const transform = sitePlan.transforms?.metersToLegacy;
      const e = x * metersPerUnit;
      const n = -z * metersPerUnit;
      const legacyX = transform ? transform.x[0] * e + transform.x[1] * n + transform.x[2] : x;
      const legacyZ = transform ? transform.y[0] * e + transform.y[1] * n + transform.y[2] : z;
      return sampleElevation(options.terrain, legacyX, legacyZ) / metersPerUnit;
    }
    // Pads derive from source footprints; these are a visualization adjustment,
    // explicitly estimated rather than measured platform elevations.
    const pads = ["buildings", "sports", "parking"].flatMap((layer) => (sitePlan.features[layer] || []).filter((feature) => feature.geometryType === "polygon" && feature.pointsMeters.length >= 3).flatMap((feature) => (feature.polygonsMeters?.length ? feature.polygonsMeters : [{ outer: feature.pointsMeters, holes: [] }]).map((part) => {
      const polygon = cleanPolygon(part.outer).map(worldPoint);
      const bounds = boundsOf(polygon);
      const center = bounds.center;
      return { polygon, holes: part.holes.map((ring) => cleanPolygon(ring).map(worldPoint)), bounds, height: rawHeight(center[0], center[1]) };
    })));
    /** @type {Map<string,number>} */ const heightCache = new Map();
    /** @type {Map<string,[number,number,number]>} */ const normalCache = new Map();
    /** @param {number} x @param {number} z */
    function terrainHeightAt(x, z) {
      const key = `${x.toFixed(5)},${z.toFixed(5)}`;
      const cached = heightCache.get(key);
      if (cached !== undefined) return cached;
      let height = rawHeight(x, z);
      pads.forEach((pad) => {
        if (x < pad.bounds.minX - 0.7 || x > pad.bounds.maxX + 0.7 || z < pad.bounds.minZ - 0.7 || z > pad.bounds.maxZ + 0.7) return;
        if (pad.holes.some((ring) => contains([x, z], ring))) return;
        const distance = contains([x, z], pad.polygon) ? 0 : distanceToPolygon([x, z], pad.polygon);
        if (distance < 0.7) {
          const weight = 1 - distance / 0.7;
          height = height * (1 - weight) + pad.height * weight;
        }
      });
      const result = height * exaggeration;
      if (heightCache.size < 180000) heightCache.set(key, result);
      return result;
    }
    /** Vertices at the same geographic point share a smooth terrain normal even
     * when triangulation duplicates them across faces or feature surfaces.
     * @param {number[]} positions @returns {number[]} */
    function terrainNormals(positions) {
      /** @type {number[]} */ const normals = [];
      const step = 0.18;
      for (let index = 0; index < positions.length; index += 3) {
        const x = positions[index]; const z = positions[index + 2];
        const key = `${x.toFixed(4)},${z.toFixed(4)}`;
        let normal = normalCache.get(key);
        if (!normal) {
          const dx = (terrainHeightAt(x + step, z) - terrainHeightAt(x - step, z)) / (2 * step);
          const dz = (terrainHeightAt(x, z + step) - terrainHeightAt(x, z - step)) / (2 * step);
          const length = Math.hypot(dx, 1, dz);
          normal = [-dx / length, 1 / length, -dz / length];
          normalCache.set(key, normal);
        }
        normals.push(...normal);
      }
      return normals;
    }
    /** @param {Mesh} mesh @param {string} layer @param {Feature|undefined} feature */
    function register(mesh, layer, feature) {
      mesh.metadata = { ...(mesh.metadata || {}), siteLayer: layer, featureId: feature?.id, sourceId: feature?.sourceId, status: feature?.status || "estimated", confidence: feature?.confidence || "estimated", legalBoundary: false };
      mesh.isPickable = Boolean(feature?.id && ["buildings", "entrances", "parking", "sports"].includes(layer));
      mesh.checkCollisions = layer === "terrain" || layer === "context" || (layer === "buildings" && /volume|body|building|hall|wing|core/.test(mesh.name));
      mesh.metadata.visualPriority = ["boundary", "buildings", "entrances"].includes(layer) ? "essential" : layer === "context" ? "background" : "supporting";
      mesh.metadata.observationCollision = mesh.checkCollisions;
      layers[layer].push(mesh);
      meshes.push(mesh);
      return mesh;
    }
    /** @param {string} name @param {Point[]} polygon @param {Material} material @param {string} layer @param {Feature|undefined} feature @param {number} [offset] */
    function polygonMesh(name, polygon, material, layer, feature, offset = 0.02) {
      const clean = cleanPolygon(polygon);
      const indices = triangulate(clean);
      /** @type {number[]} */
      const positions = [];
      /** @type {number[]} */
      const refined = [];
      /** @param {Point} a @param {Point} b @param {Point} c @param {number} depth */
      function triangle(a, b, c, depth) {
        const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const bc = Math.hypot(b[0] - c[0], b[1] - c[1]);
        const ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const center = /** @type {Point} */ ([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]);
        const approximation = (terrainHeightAt(...a) + terrainHeightAt(...b) + terrainHeightAt(...c)) / 3;
        const error = Math.abs(terrainHeightAt(...center) - approximation);
        if ((Math.max(ab, bc, ca) > 3 || error > 0.02) && depth < 14) {
          if (ab >= bc && ab >= ca) {
            const middle = /** @type {Point} */ ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
            triangle(a, middle, c, depth + 1); triangle(middle, b, c, depth + 1);
          } else if (bc >= ca) {
            const middle = /** @type {Point} */ ([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]);
            triangle(a, b, middle, depth + 1); triangle(a, middle, c, depth + 1);
          } else {
            const middle = /** @type {Point} */ ([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2]);
            triangle(a, b, middle, depth + 1); triangle(middle, b, c, depth + 1);
          }
          return;
        }
        const start = positions.length / 3;
        [a, b, c].forEach(([x, z]) => positions.push(x, terrainHeightAt(x, z) + offset, z));
        refined.push(start, start + 1, start + 2);
      }
      for (let index = 0; index < indices.length; index += 3) triangle(clean[indices[index]], clean[indices[index + 1]], clean[indices[index + 2]], 0);
      const mesh = new B.Mesh(name, scene);
      const data = new B.VertexData();
      upwardNormals(positions, refined);
      const normals = terrainNormals(positions);
      data.positions = positions; data.indices = refined; data.normals = normals;
      data.applyToMesh(mesh, true);
      mesh.material = material;
      draped.push({ mesh, offset });
      return register(mesh, layer, feature);
    }
    /** @param {string} name @param {Point[]} points @param {number} width @param {Material} material @param {string} layer @param {Feature|undefined} feature @param {number} [offset] */
    function ribbon(name, points, width, material, layer, feature, offset = 0.045) {
      if (points.length < 2) return null;
      /** @type {Point[]} */
      const samples = [points[0]];
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55));
        for (let step = 1; step <= count; step += 1) samples.push([a[0] + (b[0] - a[0]) * step / count, a[1] + (b[1] - a[1]) * step / count]);
      }
      /** @type {number[]} */ const positions = [];
      /** @type {number[]} */ const indices = [];
      samples.forEach(([x, z], index) => {
        const previous = samples[Math.max(0, index - 1)];
        const next = samples[Math.min(samples.length - 1, index + 1)];
        const length = Math.hypot(next[0] - previous[0], next[1] - previous[1]) || 1;
        const nx = -(next[1] - previous[1]) / length * width / 2;
        const nz = (next[0] - previous[0]) / length * width / 2;
        positions.push(x + nx, terrainHeightAt(x + nx, z + nz) + offset, z + nz, x - nx, terrainHeightAt(x - nx, z - nz) + offset, z - nz);
        if (index) { const a = (index - 1) * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const mesh = new B.Mesh(name, scene);
      const data = new B.VertexData();
      upwardNormals(positions, indices);
      const normals = terrainNormals(positions);
      data.positions = positions; data.indices = indices; data.normals = normals;
      data.applyToMesh(mesh, true); mesh.material = material;
      draped.push({ mesh, offset });
      return register(mesh, layer, feature);
    }
    const margin = 18;
    const outer = /** @type {Point[]} */ ([[bounds.minX - margin, bounds.minZ - margin], [bounds.maxX + margin, bounds.minZ - margin], [bounds.maxX + margin, bounds.maxZ + margin], [bounds.minX - margin, bounds.maxZ + margin]]);
    const exteriorParts = parts.filter((part) => !parts.some((other) => other !== part && contains(part.outer[0], other.outer)));
    polygonMesh("site-context-ground", polygonWithHoles(outer, exteriorParts.map((part) => part.outer)), palette.context, "context", undefined, 0);
    parts.forEach((part, index) => {
      polygonMesh(index ? `site-campus-ground-${index}` : "site-campus-ground", polygonWithHoles(part.outer, part.holes), palette.campus, "terrain", mapped, 0.013);
      part.holes.forEach((hole, holeIndex) => {
        const enclosed = parts.filter((other) => other !== part && contains(other.outer[0], hole) && !parts.some((middle) => middle !== other && middle !== part && contains(other.outer[0], middle.outer) && contains(middle.outer[0], hole)));
        polygonMesh(`site-context-island-${index}-${holeIndex}`, polygonWithHoles(hole, enclosed.map((other) => other.outer)), palette.context, "context", undefined, 0);
      });
    });
    /** @type {{type:string,name:string,pattern:string,color:string,available:boolean,sourceId:string|null,status:string,legal:boolean}[]} */
    const boundaryLegend = [];
    /** @param {'guide'|'legal'|'planning'|'cadastral'} type @param {Feature|null|undefined} feature @param {Material} material */
    function drawBoundary(type, feature, material) {
      const style = BOUNDARY_STYLES[type];
      const available = Boolean(feature && (feature.polygonsMeters?.length || (feature.pointsMeters?.length || 0) >= 3));
      boundaryLegend.push({ type, name: style.name, pattern: style.pattern, color: style.color, available, sourceId: feature?.sourceId || null, status: feature?.status || feature?.confidence || "unavailable", legal: style.legal });
      if (!feature || !available) return;
      const boundaryParts = feature.polygonsMeters?.length ? feature.polygonsMeters : [{ outer: feature.pointsMeters, holes: [] }];
      boundaryParts.flatMap((part) => [part.outer, ...(part.holes || [])]).map((ring) => cleanPolygon(ring).map(worldPoint)).filter((ring) => ring.length >= 3).forEach((ring, ringIndex) => ring.forEach((a, index) => {
        const b = ring[(index + 1) % ring.length]; const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length <= EPSILON) return;
        const period = style.periodMeters / metersPerUnit || length;
        for (let distance = 0; distance < length; distance += period) {
          const segments = style.pattern === "solid" ? [[distance, length]] : [[distance, distance + style.dashMeters / metersPerUnit], ...(style.pattern === "dash-dot" ? [[distance + 15 / metersPerUnit, distance + 17 / metersPerUnit]] : [])];
          segments.forEach(([start, finish], segment) => {
            const end = Math.min(length, finish); if (end - start < EPSILON) return;
            const mesh = ribbon(`site-${type === "guide" ? "mapped" : type}-boundary-${ringIndex}-${index}-${distance.toFixed(1)}-${segment}`, [[a[0] + (b[0] - a[0]) * start / length, a[1] + (b[1] - a[1]) * start / length], [a[0] + (b[0] - a[0]) * end / length, a[1] + (b[1] - a[1]) * end / length]], style.widthMeters / metersPerUnit, material, "boundary", feature, 0.075 + Object.keys(BOUNDARY_STYLES).indexOf(type) * 0.008);
            if (mesh) { mesh.metadata.boundaryType = type; mesh.metadata.boundaryPattern = style.pattern; mesh.metadata.legalBoundary = style.legal; mesh.metadata.areaMeaning = type === "guide" ? "estimated-guide-area" : `${type}-source-geometry`; }
          });
        }
      }));
    }
    drawBoundary("guide", mapped, palette.boundary);
    drawBoundary("legal", sitePlan.boundaries.legal, palette.legalBoundary);
    drawBoundary("planning", sitePlan.boundaries.planning, palette.planningBoundary);
    drawBoundary("cadastral", sitePlan.boundaries.cadastral, palette.cadastralBoundary);

    /** @param {Feature} feature @param {number} fallback */
    function widthOf(feature, fallback) {
      const width = feature.widthMeters ?? Number(feature.tags?.width);
      return (Number.isFinite(width) && width > 0 ? Math.min(width, 30) : fallback) / metersPerUnit;
    }
    ["roads", "paths"].forEach((layer) => (sitePlan.features[layer] || []).forEach((feature) => {
      const points = feature.pointsMeters.map(worldPoint);
      const isSteps = feature.tags?.highway === "steps" || feature.kind === "steps";
      const width = widthOf(feature, layer === "roads" ? 5.2 : 2.4);
      ribbon(`site-${layer}-${feature.id}`, points, width, layer === "roads" ? palette.road : palette.path, layer, feature);
      if (isSteps && points.length > 1) {
        const closed = points;
        for (let index = 1; index < closed.length; index += 1) {
          const a = closed[index - 1]; const b = closed[index];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const count = Math.max(1, Math.floor(length / 0.08));
          const nx = -(b[1] - a[1]) / (length || 1) * width / 2;
          const nz = (b[0] - a[0]) / (length || 1) * width / 2;
          for (let step = 1; step <= count; step += 1) {
            const x = a[0] + (b[0] - a[0]) * step / count;
            const z = a[1] + (b[1] - a[1]) * step / count;
            ribbon(`site-step-${feature.id}-${index}-${step}`, [[x + nx, z + nz], [x - nx, z - nz]], 0.016, palette.line, "paths", feature, 0.065);
          }
        }
      }
    }));
    ["parking", "sports", "water", "greenery", "context"].forEach((layer) => (sitePlan.features[layer] || []).forEach((feature) => {
      const polygon = feature.pointsMeters.map(worldPoint);
      const material = layer === "sports" ? palette.sports : layer === "parking" ? palette.parking : layer === "water" ? palette.water : layer === "greenery" ? palette.forest : palette.context;
      if (feature.geometryType === "polygon" && polygon.length >= 3) {
        const featureParts = feature.polygonsMeters?.length ? feature.polygonsMeters.map((part) => ({ outer: cleanPolygon(part.outer).map(worldPoint), holes: part.holes.map((ring) => cleanPolygon(ring).map(worldPoint)) })) : [{ outer: polygon, holes: [] }];
        const surfaces = featureParts.map((part, index) => polygonMesh(`site-${layer}-${feature.id}${index ? `-${index}` : ""}`, polygonWithHoles(part.outer, part.holes), material, layer, feature, layer === "context" ? 0.016 : 0.03));
        const surface = surfaces[0];
        if (layer === "sports" || layer === "parking") featureMarkers.push({ feature, mesh: surface });
        if (layer === "sports" && featureParts.length === 1 && !featureParts[0].holes.length) {
          ribbon(`site-sports-outline-${feature.id}`, [...polygon, polygon[0]], 0.07, palette.line, layer, feature, 0.06);
          const box = boundsOf(polygon);
          // A center divider is explicitly a display marking, not surveyed equipment.
          ribbon(`site-sports-midline-${feature.id}`, [[box.center[0], box.minZ + 0.25], [box.center[0], box.maxZ - 0.25]], 0.055, palette.line, layer, { ...feature, status: "estimated" }, 0.07);
        }
        if (layer === "parking" && featureParts.length === 1 && !featureParts[0].holes.length) {
          const box = boundsOf(polygon);
          for (let x = box.minX + 0.35; x < box.maxX - 0.2; x += 0.27) {
            const z = box.minZ + 0.3;
            if (contains([x, z], polygon) && contains([x, z + 0.48], polygon)) ribbon(`site-parking-bay-${feature.id}-${x.toFixed(2)}`, [[x, z], [x, z + 0.48]], 0.012, palette.line, layer, { ...feature, status: "estimated" }, 0.065);
          }
        }
      } else if (["sports", "parking"].includes(layer) && polygon.length === 1) {
        const [x, z] = polygon[0];
        const marker = B.MeshBuilder.CreateCylinder(`site-location-marker-${feature.id}`, { diameter: 1.15, height: 0.07, tessellation: 16 }, scene);
        marker.position.set(x, terrainHeightAt(x, z) + 0.085, z); marker.material = material;
        const ring = B.MeshBuilder.CreateTorus(`site-location-ring-${feature.id}`, { diameter: 1.25, thickness: 0.055, tessellation: 20 }, scene);
        ring.position.set(x, terrainHeightAt(x, z) + 0.105, z); ring.material = palette.line;
        grounded.push({ mesh: marker, x, z, offset: 0.085 }, { mesh: ring, x, z, offset: 0.105 });
        register(marker, layer, feature); register(ring, layer, feature);
        marker.metadata.extentStatus = "unknown"; ring.metadata.extentStatus = "unknown";
        featureMarkers.push({ feature, mesh: marker });
      } else if (layer === "greenery" && polygon.length) {
        polygon.forEach(([x, z], index) => {
          const trunk = B.MeshBuilder.CreateCylinder(`site-tree-trunk-${feature.id}-${index}`, { diameter: 0.06, height: 0.38, tessellation: 6 }, scene);
          const crown = B.MeshBuilder.CreateSphere(`site-tree-crown-${feature.id}-${index}`, { diameter: 0.65, segments: 5 }, scene);
          trunk.position.set(x, terrainHeightAt(x, z) + 0.19, z); trunk.material = palette.trunk;
          crown.position.set(x, terrainHeightAt(x, z) + 0.62, z); crown.material = palette.tree;
          grounded.push({ mesh: trunk, x, z, offset: 0.19 }, { mesh: crown, x, z, offset: 0.62 });
          register(trunk, "trees", feature); register(crown, "trees", feature);
        });
      } else if (polygon.length > 1) ribbon(`site-${layer}-${feature.id}`, polygon, widthOf(feature, 3), material, layer, feature);
    }));
    // Illustrative forest canopy is deterministic and separately marked as
    // estimated. It is never presented as an inventory of individual real trees.
    (sitePlan.features.greenery || []).filter((feature) => feature.geometryType === "polygon" && (feature.kind === "forest" || feature.tags?.landuse === "forest" || feature.tags?.natural === "wood")).forEach((feature) => {
      const forests = (feature.polygonsMeters?.length ? feature.polygonsMeters : [{ outer: feature.pointsMeters, holes: [] }]).map((part) => ({ outer: part.outer.map(worldPoint), holes: part.holes.map((ring) => ring.map(worldPoint)) }));
      const area = boundsOf(forests.flatMap((part) => part.outer));
      let count = 0;
      for (let x = area.minX + 0.9; x < area.maxX && count < 140; x += 1.9) {
        for (let z = area.minZ + 0.8; z < area.maxZ && count < 140; z += 1.9) {
          const jitter = Math.sin(x * 11.3 + z * 7.1) * 0.35;
          const px = x + jitter; const pz = z - jitter;
          if (!forests.some((part) => contains([px, pz], part.outer) && !part.holes.some((ring) => contains([px, pz], ring))) || pads.some((pad) => distanceToPolygon([px, pz], pad.polygon) < 0.8 || contains([px, pz], pad.polygon))) continue;
          const crown = B.MeshBuilder.CreateSphere(`site-forest-canopy-${feature.id}-${count++}`, { diameter: 0.85, segments: 4 }, scene);
          crown.position.set(px, terrainHeightAt(px, pz) + 0.55, pz); crown.material = palette.tree;
          grounded.push({ mesh: crown, x: px, z: pz, offset: 0.55 });
          register(crown, "trees", { ...feature, status: "estimated", confidence: "estimated" });
        }
      }
    });
    if (options.terrain) {
      const columns = 40; const rows = 30;
      const grid = Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: columns + 1 }, (_, column) => {
        const x = bounds.minX + bounds.width * column / columns;
        const z = bounds.minZ + bounds.depth * row / rows;
        return { x, z, y: terrainHeightAt(x, z) / exaggeration };
      }));
      const heights = grid.flat().map((point) => point.y);
      const interval = 10 / metersPerUnit;
      for (let level = Math.ceil(Math.min(...heights) / interval) * interval; level <= Math.max(...heights); level += interval) {
        /** @type {import("babylonjs").Vector3[][]} */ const lines = [];
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const corners = [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]];
            /** @type {Point[]} */ const crossings = [];
            corners.forEach((a, index) => {
              const b = corners[(index + 1) % corners.length];
              if ((a.y < level && b.y >= level) || (b.y < level && a.y >= level)) {
                const fraction = (level - a.y) / (b.y - a.y);
                crossings.push([a.x + (b.x - a.x) * fraction, a.z + (b.z - a.z) * fraction]);
              }
            });
            for (let index = 0; index + 1 < crossings.length; index += 2) {
              const a = crossings[index]; const b = crossings[index + 1];
              if (!insideCampus([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) continue;
              lines.push([new B.Vector3(a[0], terrainHeightAt(...a) + 0.035, a[1]), new B.Vector3(b[0], terrainHeightAt(...b) + 0.035, b[1])]);
            }
          }
        }
        if (lines.length) {
          const contour = B.MeshBuilder.CreateLineSystem(`site-estimated-contour-${level.toFixed(1)}`, { lines, updatable: true }, scene);
          contour.color = B.Color3.FromHexString("#728c62"); contour.alpha = 0.58;
          register(contour, "contours", { id: `contour-${level}`, pointsMeters: [], status: "estimated", sourceId: "legacy-srtm90m" });
          draped.push({ mesh: contour, offset: 0.035 }); contour.setEnabled(false);
        }
      }
    }
    (sitePlan.features.entrances || []).forEach((feature) => {
      const location = feature.pointsMeters[0];
      if (!location) return;
      const [x, z] = worldPoint(location);
      const mesh = B.MeshBuilder.CreateCylinder(`site-entrance-${feature.id}`, { diameter: 0.52, height: 0.08, tessellation: 12 }, scene);
      mesh.position.set(x, terrainHeightAt(x, z) + 0.1, z); mesh.material = palette.entry;
      grounded.push({ mesh, x, z, offset: 0.1 }); register(mesh, "entrances", feature);
      if (feature.kind === "gate" || /gate/.test(feature.id)) featureMarkers.push({ feature, mesh });
      if (feature.pointsMeters.length > 1) ribbon(`site-entrance-approach-${feature.id}`, feature.pointsMeters.map(worldPoint), 0.12, palette.entry, "entrances", feature, 0.085);
    });
    // Unassigned buildings are represented by their mapped footprint, so the
    // campus overview does not silently omit ancillary structures.
    (sitePlan.features.buildings || []).forEach((feature) => {
      const buildingParts = (feature.polygonsMeters?.length ? feature.polygonsMeters : [{ outer: feature.pointsMeters, holes: [] }]).map((part) => ({ outer: cleanPolygon(part.outer).map(worldPoint), holes: part.holes.map((ring) => cleanPolygon(ring).map(worldPoint)) }));
      if (!buildingParts.length || buildingParts.some((part) => part.outer.length < 3)) return;
      const footprints = buildingParts.map((part, index) => polygonMesh(`site-building-footprint-${feature.id}${index ? `-${index}` : ""}`, polygonWithHoles(part.outer, part.holes), palette.building, "buildings", feature, 0.028));
      {
        const height = Number.isFinite(feature.heightMeters) ? /** @type {number} */ (feature.heightMeters) / metersPerUnit : 0.65;
        /** @type {number[]} */ const wallPositions = [];
        /** @type {number[]} */ const wallIndices = [];
        buildingParts.flatMap((part) => [part.outer, ...part.holes]).forEach((ring) => {
          const offset = wallPositions.length / 3;
          ring.forEach(([x, z]) => wallPositions.push(x, terrainHeightAt(x, z) + 0.03, z, x, terrainHeightAt(x, z) + height, z));
          ring.forEach((_, index) => { const a = offset + index * 2; const b = offset + ((index + 1) % ring.length) * 2; wallIndices.push(a, b, a + 1, a + 1, b, b + 1); });
        });
        const walls = new B.Mesh(`site-building-volume-${feature.id}`, scene);
        const data = new B.VertexData();
        /** @type {number[]} */ const normals = [];
        B.VertexData.ComputeNormals(wallPositions, wallIndices, normals);
        data.positions = wallPositions; data.indices = wallIndices; data.normals = normals; data.applyToMesh(walls, true); walls.material = palette.building;
        register(walls, "buildings", { ...feature, status: "estimated" });
        const proxyRoot = new B.TransformNode(`site-building-proxy-${feature.id}`, scene);
        proxyRoot.metadata = { featureId: feature.id, kind: "base-proxy", status: "estimated" };
        walls.parent = proxyRoot;
        footprints.forEach((footprint, index) => {
          const roof = footprint.clone(`site-building-roof-${feature.id}${index ? `-${index}` : ""}`);
          if (roof) { roof.makeGeometryUnique(); roof.parent = proxyRoot; roof.position.y = height; draped.push({ mesh: roof, offset: 0.028 }); register(roof, "buildings", { ...feature, status: "estimated" }); }
        });
        proxyVolumes.push({ mesh: walls, height });
        proxies.set(feature.id, { root: proxyRoot, main: walls });
      }
    });

    /** Consolidate only opaque repeated facade details. Each merged mesh retains
     * the building parent, source metadata, and pickable world geometry.
     * @param {Model} model @param {string} id @param {Feature|undefined} feature */
    function batchDetails(model, id, feature) {
      if (options.batchRepeatedMeshes === false) return;
      /** @type {Map<Material,Mesh[]>} */ const groups = new Map();
      const primary = model.main || model.hall || model.newDorm || model.mediaHall;
      model.root.getChildMeshes().forEach((child) => {
        if (!(child instanceof B.Mesh) || child === primary || child.metadata?.kind === "batched-detail" || child.actionManager || !/(window|floor-line|trim|floor-slab)/.test(child.name)) return;
        const material = child.material;
        if (!material || material.alpha < 1 || material.needAlphaBlendingForMesh(child) || material.needAlphaTestingForMesh(child) || !child.isEnabled()) return;
        const group = groups.get(material) || [];
        group.push(child); groups.set(material, group);
      });
      groups.forEach((group, material) => {
        if (group.length < 2) return;
        const originalNames = group.map((mesh) => mesh.name);
        const pickable = group.some((mesh) => mesh.isPickable);
        group.forEach((mesh) => mesh.computeWorldMatrix(true));
        const merged = B.Mesh.MergeMeshes(group, true, true, undefined, false, false);
        if (!merged) { failures.push(`건물 ${id}의 반복 외관 메쉬를 합칠 수 없습니다.`); return; }
        merged.name = `site-batched-${id}-window-trim-${material.uniqueId}`;
        // MergeMeshes bakes the original world matrices. The inverse of a
        // rotated, nonuniformly scaled root can contain shear: setParent's TRS
        // decomposition cannot preserve it. Bake the exact inverse into the
        // geometry instead, then attach with an identity local transform.
        model.root.computeWorldMatrix(true);
        merged.bakeTransformIntoVertices(B.Matrix.Invert(model.root.getWorldMatrix()));
        merged.parent = model.root;
        merged.position.set(0, 0, 0); merged.rotation.set(0, 0, 0); merged.scaling.set(1, 1, 1); merged.rotationQuaternion = null;
        merged.computeWorldMatrix(true); merged.refreshBoundingInfo();
        register(merged, "buildings", feature);
        merged.isPickable = pickable;
        merged.metadata.kind = "batched-detail";
        merged.metadata.originalMeshNames = originalNames;
        merged.metadata.originalMeshCount = group.length;
        batching.sourceMeshes += group.length; batching.mergedMeshes += 1; batching.removedMeshes += group.length - 1;
      });
    }

    /** @param {Model} model @param {string} id */
    function alignModel(model, id) {
      const feature = (sitePlan.features.buildings || []).find((candidate) => candidate.legacyKey === id || candidate.id === id);
      const anchor = (sitePlan.anchors || []).find((candidate) => candidate.id === id);
      const point = feature?.anchorMeters || anchor?.meters || (feature?.pointsMeters.length ? boundsOf(feature.pointsMeters).center : undefined);
      const primary = model.main || model.hall || model.newDorm || model.mediaHall;
      if (!primary || !point) { failures.push(`건물 ${id}의 기준점 또는 대표 메쉬가 없습니다.`); return false; }
      let initial = originals.get(model.root);
      if (!initial) {
        model.root.computeWorldMatrix(true); primary.computeWorldMatrix(true);
        const inverse = B.Matrix.Invert(model.root.getWorldMatrix());
        // A building may comprise several old/new blocks. Its footprint is an
        // estimated envelope for the whole compound, not only the returned main
        // mesh. Keep exterior decoration and site furniture out of that fit.
        const excludedDetail = /(?:^|-)(?:window|glass|line|trim|slab|band|canopy|column|step|slide|fence|sign|relief|medallion|tank|vent|exhaust|stone|play|plaza|parking|courtyard|walkway|yard|road|path|shelter|post|cross|terrace|landing|corridor)(?:-|$)/;
        const includedMass = /(?:^|-)(?:main|body|building|dormitory|core|wing|hall|volume|roof|rooftop|base|plinth|porch|connector|lobby|stack|stage|mechanical|machine|stair)(?:-|$)|shalom-1f-chaplain-office-4106/;
        const masses = model.root.getChildMeshes().filter((child) => child === primary || (!excludedDetail.test(child.name) && includedMass.test(child.name)));
        const vectors = masses.flatMap((mesh) => {
          mesh.computeWorldMatrix(true);
          return mesh.getBoundingInfo().boundingBox.vectorsWorld.map((vector) => B.Vector3.TransformCoordinates(vector, inverse));
        });
        const xs = vectors.map((vector) => vector.x); const ys = vectors.map((vector) => vector.y); const zs = vectors.map((vector) => vector.z);
        initial = { scaling: model.root.scaling.clone(), center: new B.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs), height: Math.max(...ys) - Math.min(...ys), meshNames: masses.map((mesh) => mesh.name) };
        originals.set(model.root, initial);
      }
      const yaw = feature?.angleRadians ?? anchor?.rotationRadians ?? 0;
      const [x, z] = worldPoint(point);
      model.root.rotation.y = Number.isFinite(yaw) ? yaw : 0;
      model.root.scaling.copyFrom(initial.scaling);
      if (options.fitFootprint !== false && feature && feature.pointsMeters.length >= 3) {
        const cosine = Math.cos(yaw); const sine = Math.sin(yaw);
        const local = feature.pointsMeters.map(worldPoint).map(([px, pz]) => /** @type {Point} */ ([(px - x) * cosine - (pz - z) * sine, (px - x) * sine + (pz - z) * cosine]));
        const target = boundsOf(local);
        const sx = target.width / (initial.width * Math.abs(initial.scaling.x)); const sz = target.depth / (initial.depth * Math.abs(initial.scaling.z));
        if (Number.isFinite(sx) && Number.isFinite(sz) && sx > 0 && sz > 0) {
          // An unmeasured envelope cannot justify stretching an existing model.
          const scale = Math.min(sx, sz);
          model.root.scaling.x = initial.scaling.x * scale; model.root.scaling.z = initial.scaling.z * scale;
          model.root.scaling.y = Number.isFinite(feature.heightMeters) && /** @type {number} */ (feature.heightMeters) > 0 ? /** @type {number} */ (feature.heightMeters) / metersPerUnit / initial.height : initial.scaling.y * scale;
        }
      }
      const center = B.Vector3.TransformCoordinates(initial.center.multiply(model.root.scaling), B.Matrix.RotationY(model.root.rotation.y));
      model.root.position.set(x - center.x, terrainHeightAt(x, z) + 0.025, z - center.z);
      model.root.metadata = { ...(model.root.metadata || {}), siteLayer: "buildings", featureId: feature?.id || id, sourceId: feature?.sourceId || anchor?.sourceId, status: feature?.status || "estimated", heightStatus: feature?.heightMeters ? "mapped" : "estimated", rotationStatus: anchor?.rotationStatus || "estimated" };
      model.root.computeWorldMatrix(true);
      let lift = 0;
      model.root.getChildMeshes().forEach((child) => {
        if (/(window|glass|roof|trim|line|plaza|parking|courtyard|walkway|yard|road|canopy|step|slide|fence)/.test(child.name)) return;
        child.computeWorldMatrix(true);
        const box = child.getBoundingInfo().boundingBox;
        const base = box.minimumWorld.y;
        const corners = [[box.minimumWorld.x, box.minimumWorld.z], [box.maximumWorld.x, box.minimumWorld.z], [box.maximumWorld.x, box.maximumWorld.z], [box.minimumWorld.x, box.maximumWorld.z]];
        corners.forEach(([px, pz]) => { lift = Math.max(lift, terrainHeightAt(px, pz) + 0.018 - base); });
      });
      model.root.position.y += lift;
      model.root.metadata.groundingAdjustmentMeters = lift * metersPerUnit;
      model.root.metadata.groundingStatus = "estimated-visual-contact";
      model.root.computeWorldMatrix(true);
      model.root.metadata.alignmentCenter = { kind: "estimated-compound-mass-envelope", local: initial.center.asArray(), world: B.Vector3.TransformCoordinates(initial.center, model.root.getWorldMatrix()).asArray(), meshNames: [...initial.meshNames], dimensions: [initial.width, initial.height, initial.depth] };
      model.root.metadata.alignmentScale = { kind: "uniform-envelope-fit", value: model.root.scaling.x / initial.scaling.x, status: "estimated", footprintStatus: feature?.footprintStatus || "estimated", preservesOriginalProportions: !feature?.heightMeters };
      model.root.getChildMeshes().forEach((mesh) => { mesh.metadata = { ...(mesh.metadata || {}), siteLayer: "buildings", featureId: feature?.id || id, visualPriority: "essential" }; mesh.checkCollisions = initial.meshNames.includes(mesh.name); mesh.metadata.observationCollision = mesh.checkCollisions; });
      // Original accessory slabs are draped in world coordinates after alignment;
      // their local outline and visual purpose are preserved.
      if (!aligned.some((entry) => entry.model === model)) {
        const ownedMeshes = model.root.getChildMeshes().slice();
        model.root.getChildMeshes().forEach((child) => {
          const vertices = child.getVerticesData(B.VertexBuffer.PositionKind);
          const indices = child.getIndices();
          if (!(child instanceof B.Mesh) || !vertices || !indices || !/(plaza|courtyard|parking|access-road|service-road|walkway|yard|park-plaza|cafe-approach)/.test(child.name)) return;
          child.computeWorldMatrix(true);
          const matrix = child.getWorldMatrix();
          /** @type {Point[]} */ const corners = [];
          for (let index = 0; index < vertices.length; index += 3) {
            const vector = B.Vector3.TransformCoordinates(new B.Vector3(vertices[index], vertices[index + 1], vertices[index + 2]), matrix);
            if (!corners.some(([px, pz]) => Math.hypot(px - vector.x, pz - vector.z) < EPSILON)) corners.push([vector.x, vector.z]);
          }
          const middle = boundsOf(corners).center;
          corners.sort((a, b) => Math.atan2(a[1] - middle[1], a[0] - middle[0]) - Math.atan2(b[1] - middle[1], b[0] - middle[0]));
          const replacement = polygonMesh(`site-drape-temp-${child.name}`, corners, child.material || palette.path, "buildings", feature, 0.047);
          const data = B.VertexData.ExtractFromMesh(replacement);
          draped.pop(); meshes.pop(); layers.buildings.pop(); replacement.dispose();
          child.parent = null; child.position.set(0, 0, 0); child.rotation.set(0, 0, 0); child.scaling.set(1, 1, 1);
          data.applyToMesh(child, true);
          if (child.material) child.material.alpha = 1;
          draped.push({ mesh: /** @type {Mesh} */ (child), offset: 0.047 });
          register(/** @type {Mesh} */ (child), "buildings", feature);
        });
        batchDetails(model, id, feature);
        ownedMeshes.push(...model.root.getChildMeshes());
        modelMeshes.set(model.root, ownedMeshes);
        aligned.push({ model, id });
        detailVisibility.set(feature?.id || id, true); syncBuilding(id);
      }
      return true;
    }

    /** @param {string} id @returns {Feature|undefined} */
    function findFeature(id) { return Object.values(sitePlan.features).flat().find((feature) => feature.id === id || feature.legacyKey === id); }
    /** @param {string} id @returns {import('babylonjs').Vector3[]} */
    function featurePoints(id) {
      const feature = findFeature(id); if (!feature) return [];
      const owned = [...aligned, ...externals].filter((entry) => entry.model.root.metadata?.featureId === feature.id || entry.id === feature.id || entry.id === feature.legacyKey).flatMap((entry) => entry.model.root.getChildMeshes());
      const visibleMeshes = [...new Set([...meshes, ...owned])].filter((mesh) => mesh.metadata?.featureId === feature.id && mesh.isEnabled() && mesh.isVisible && !mesh.isDisposed() && mesh.getTotalVertices() > 0);
      if (visibleMeshes.length) return visibleMeshes.flatMap((mesh) => { mesh.computeWorldMatrix(true); return mesh.getBoundingInfo().boundingBox.vectorsWorld.map((point) => point.clone()); });
      const rings = feature.polygonsMeters?.length ? feature.polygonsMeters.flatMap((part) => part.outer) : feature.pointsMeters;
      return rings.map((point) => { const [x, z] = worldPoint(point); return new B.Vector3(x, terrainHeightAt(x, z), z); });
    }
    /** @param {string} id */
    function featureBounds(id) {
      const points = featurePoints(id); if (!points.length) return null;
      const minimum = new B.Vector3(Math.min(...points.map((point) => point.x)), Math.min(...points.map((point) => point.y)), Math.min(...points.map((point) => point.z)));
      const maximum = new B.Vector3(Math.max(...points.map((point) => point.x)), Math.max(...points.map((point) => point.y)), Math.max(...points.map((point) => point.z)));
      return { id: findFeature(id)?.id || id, minimum: minimum.asArray(), maximum: maximum.asArray(), center: minimum.add(maximum).scale(0.5).asArray(), dimensionsMeters: maximum.subtract(minimum).scale(metersPerUnit).asArray() };
    }
    /** Projection is tied to a source feature. Ray tests ignore its own meshes,
     * and hidden/missing labels remain available in the text interface.
     * @param {string} id @param {{occlusion?:boolean}} [settings] */
    function projectFeature(id, settings = {}) {
      const camera = scene.activeCamera; const box = featureBounds(id); if (!camera || !box) return null;
      const point = new B.Vector3(box.center[0], box.maximum[1] + 0.1, box.center[2]);
      camera.getViewMatrix(true); camera.getProjectionMatrix(true);
      const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix());
      const viewport = camera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight());
      const screen = B.Vector3.Project(point, B.Matrix.Identity(), transform, viewport);
      const delta = point.subtract(camera.globalPosition); const distance = delta.length();
      const hit = settings.occlusion === false || distance < EPSILON ? null : scene.pickWithRay(new B.Ray(camera.globalPosition.clone(), delta.normalize(), Math.max(0, distance - 0.02)), (mesh) => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && mesh.metadata?.featureId !== box.id && ["buildings", "terrain", "context"].includes(mesh.metadata?.siteLayer));
      const occluded = Boolean(hit?.hit && hit.distance < distance - 0.02);
      const inViewport = screen.z >= 0 && screen.z <= 1 && screen.x >= viewport.x && screen.x <= viewport.x + viewport.width && screen.y >= viewport.y && screen.y <= viewport.y + viewport.height;
      return { id: box.id, x: screen.x, y: screen.y, depth: screen.z, occluded, inViewport, visible: inViewport && !occluded, worldPoint: point.asArray(), occludingFeatureId: occluded ? hit?.pickedMesh?.metadata?.featureId || null : null };
    }
    /** Non-destructive overlays preserve materials, IDs and the essential
     * silhouettes. A route marker is a destination highlight, not a path claim.
     * @param {{hovered?:string|null,selected?:string|null,searchIds?:string[],routeIds?:string[]}} state */
    function setInteractionState(state) {
      const resolve = (/** @type {unknown} */ id) => typeof id === "string" ? findFeature(id)?.id || null : null;
      const list = (/** @type {unknown} */ input) => Array.isArray(input) ? [...new Set(input.slice(0, 100).map(resolve).filter((id) => id !== null))] : [];
      interactionState = { hovered: resolve(state.hovered), selected: resolve(state.selected), searchIds: /** @type {string[]} */ (list(state.searchIds)), routeIds: /** @type {string[]} */ (list(state.routeIds)) };
      redrawInteractions();
    }
    function redrawInteractions() {
      interactionMeshes.splice(0).forEach((mesh) => mesh.dispose());
      const styles = [{ role: "search", ids: interactionState.searchIds, color: "#39718a", pattern: "dot", height: 0.16 }, { role: "route", ids: interactionState.routeIds, color: "#94517c", pattern: "dash-dot", height: 0.20 }, { role: "hover", ids: interactionState.hovered ? [interactionState.hovered] : [], color: "#a57b24", pattern: "dash", height: 0.24 }, { role: "selected", ids: interactionState.selected ? [interactionState.selected] : [], color: "#143f31", pattern: "solid", height: 0.28 }];
      styles.forEach((style) => style.ids.forEach((id) => {
        const feature = findFeature(id); if (!feature || featureVisibility.get(id) === false || layerVisibility.buildings === false && (sitePlan.features.buildings || []).includes(feature)) return;
        const rings = feature.polygonsMeters?.length ? feature.polygonsMeters.flatMap((part) => [part.outer, ...part.holes]) : [feature.pointsMeters];
        /** @type {import('babylonjs').Vector3[][]} */ const lines = [];
        rings.forEach((ring) => {
          if (ring.length === 1) { const [x, z] = worldPoint(ring[0]); const points = Array.from({ length: 25 }, (_, index) => { const angle = index * Math.PI / 12; const px = x + Math.cos(angle) * 0.4; const pz = z + Math.sin(angle) * 0.4; return new B.Vector3(px, terrainHeightAt(px, pz) + style.height, pz); }); lines.push(points); return; }
          const points = ring.map(worldPoint); const edges = feature.geometryType === "line" ? points.slice(0, -1) : points;
          edges.forEach((a, index) => { const b = points[(index + 1) % points.length]; const length = Math.hypot(b[0] - a[0], b[1] - a[1]); const period = style.pattern === "solid" ? length : style.pattern === "dot" ? 0.5 : 1.4;
            for (let start = 0; start < length - EPSILON; start += period || 1) {
              const segments = [[start, Math.min(length, start + (style.pattern === "solid" ? length : style.pattern === "dot" ? 0.13 : 0.9))], ...(style.pattern === "dash-dot" && start + 1.1 < length ? [[start + 1.1, Math.min(length, start + 1.23)]] : [])];
              segments.forEach((segment) => lines.push(segment.map((distance) => { const x = a[0] + (b[0] - a[0]) * distance / length; const z = a[1] + (b[1] - a[1]) * distance / length; return new B.Vector3(x, terrainHeightAt(x, z) + style.height, z); })));
            }
          });
        });
        if (!lines.length) return;
        const mesh = B.MeshBuilder.CreateLineSystem(`site-interaction-${style.role}-${id}`, { lines }, scene); mesh.color = B.Color3.FromHexString(style.color); mesh.isPickable = false;
        mesh.metadata = { featureId: id, interactionRole: style.role, pattern: style.pattern, isRouteGeometry: false, visualPriority: "essential" }; interactionMeshes.push(mesh);
      }));
    }
    /** Raw elevations are not exaggerated and do not include inferred pads.
     * A clamped sample outside the available terrain extent is marked invalid.
     * @param {number} east @param {number} north */
    function getTerrainAssessment(east, north) {
      if (![east, north].every(Number.isFinite)) throw new Error("측정 위치는 유한한 미터 좌표여야 합니다.");
      const [x, z] = worldPoint([east, north]); const transform = sitePlan.transforms?.metersToLegacy;
      const sx = transform ? transform.x[0] * east + transform.x[1] * north + transform.x[2] : x;
      const sz = transform ? transform.y[0] * east + transform.y[1] * north + transform.y[2] : z;
      const terrain = options.terrain;
      const validTerrainExtent = Boolean(terrain && terrain.xs.length >= 2 && terrain.zs.length >= 2 && sx >= terrain.xs[0] && sx <= terrain.xs[terrain.xs.length - 1] && sz >= terrain.zs[0] && sz <= terrain.zs[terrain.zs.length - 1]);
      const rawElevationMeters = rawHeight(x, z) * metersPerUnit;
      const displayElevationMeters = terrainHeightAt(x, z) * metersPerUnit;
      const padAdjusted = Math.abs(displayElevationMeters / exaggeration - rawElevationMeters) > 1e-6;
      return { east, north, insideGuideArea: insideCampus([x, z]), validTerrainExtent, rawElevationMeters: validTerrainExtent ? rawElevationMeters : null, displayElevationMeters, verticalExaggeration: exaggeration, padAdjusted, measured: false, warning: !validTerrainExtent ? "지형 원자료의 유효 범위 밖입니다." : exaggeration !== 1 || padAdjusted ? "화면 높이에는 지형 강조 또는 추정 접지 보정이 적용됐습니다. 측정에는 원자료를 사용하세요." : "지형 높이는 실측 검수가 완료되지 않은 자료입니다." };
    }

    const cameraController = options.createCamera === false ? null : createCameraController(scene, bounds, metersPerUnit, terrainHeightAt, options.canvas || scene.getEngine().getRenderingCanvas(), (id) => {
      const feature = findFeature(id);
      const anchor = (sitePlan.anchors || []).find((candidate) => candidate.id === id);
      const point = feature?.anchorMeters || anchor?.meters || (feature?.pointsMeters?.length ? feature.geometryType === "point" ? feature.pointsMeters[0] : boundsOf(feature.pointsMeters).center : null);
      return point ? worldPoint(point) : null;
    }, () => {
      const points = boundary.map(([x, z]) => new B.Vector3(x, terrainHeightAt(x, z), z));
      proxies.forEach(({ root }) => { if (root.isEnabled()) root.getChildMeshes().forEach((mesh) => { mesh.computeWorldMatrix(true); points.push(...mesh.getBoundingInfo().boundingBox.vectorsWorld.map((vector) => vector.clone())); }); });
      aligned.forEach(({ model }) => {
        const initial = originals.get(model.root);
        if (!initial) return;
        model.root.getChildMeshes().filter((mesh) => initial.meshNames.includes(mesh.name)).forEach((mesh) => {
          mesh.computeWorldMatrix(true);
          points.push(...mesh.getBoundingInfo().boundingBox.vectorsWorld.map((vector) => vector.clone()));
        });
      });
      externals.forEach(({ model }) => model.root.getChildMeshes().forEach((mesh) => { mesh.computeWorldMatrix(true); points.push(...mesh.getBoundingInfo().boundingBox.vectorsWorld.map((vector) => vector.clone())); }));
      return points;
    }, featurePoints);
    return {
      meshes, layers, featureMarkers, cameraController, terrainHeightAt, worldPoint, alignModel, featureBounds, projectFeature, getTerrainAssessment, setInteractionState,
      getBoundaryLegend() { return boundaryLegend.map((entry) => ({ ...entry })); },
      getGroundingReport() { return aligned.map(({ model, id }) => ({ id, adjustmentMeters: Number(model.root.metadata?.groundingAdjustmentMeters || 0), status: "estimated-visual-contact", measured: false })).concat(externals.map(({ id }) => ({ id, adjustmentMeters: 0, status: "explicit-source-placement", measured: false }))); },
      getInteractionState() { return { ...interactionState, searchIds: [...interactionState.searchIds], routeIds: [...interactionState.routeIds] }; },
      /** @param {string} id */
      getBuildingProxy(id) { const feature = (sitePlan.features.buildings || []).find((entry) => entry.id === id || entry.legacyKey === id); return proxies.get(feature?.id || id) || null; },
      /** Explicitly placed assets do not pass through inferred envelope fit.
       * @param {Model} model @param {string} id */
      registerExternalModel(model, id) {
        if (externals.some((entry) => entry.model === model)) return;
        const feature = (sitePlan.features.buildings || []).find((entry) => entry.id === id || entry.legacyKey === id);
        const owned = model.root.getChildMeshes(); modelMeshes.set(model.root, owned);
        owned.forEach((mesh) => { if (mesh instanceof B.Mesh) register(mesh, "buildings", feature); });
        owned.forEach((mesh) => { mesh.checkCollisions = !/(window|glass|trim|line|plaza|parking|walkway|yard|road|path|fence|sign)/.test(mesh.name); mesh.metadata = { ...(mesh.metadata || {}), observationCollision: mesh.checkCollisions }; });
        const point = model.root.metadata?.anchorWorld;
        const anchorY = Array.isArray(point) && typeof point[1] === "number" && Number.isFinite(point[1]) ? point[1] : model.root.position.y;
        externals.push({ model, id, baseY: model.root.position.y, anchorY });
        model.root.position.y += anchorY * (exaggeration - 1);
        detailVisibility.set(feature?.id || id, true); syncBuilding(id);
      },
      /** @param {string} id @param {boolean} visible */
      setBuildingDetailVisible(id, visible) { const feature = (sitePlan.features.buildings || []).find((entry) => entry.id === id || entry.legacyKey === id); detailVisibility.set(feature?.id || id, visible); syncBuilding(id); },
      /** @param {string} id @param {boolean} visible */
      setFeatureVisible(id, visible) {
        featureVisibility.set(id, visible);
        meshes.filter((mesh) => mesh.metadata?.featureId === id).forEach((mesh) => mesh.setEnabled(visible && layerVisibility[mesh.metadata.siteLayer] !== false));
        syncBuilding(id);
        redrawInteractions();
      },
      /** @param {Model} model */
      releaseModel(model) {
        const owned = new Set(modelMeshes.get(model.root) || []);
        owned.forEach((mesh) => {
          if (!mesh.isDisposed() && !mesh.parent) mesh.dispose();
          const index = meshes.indexOf(/** @type {Mesh} */ (mesh)); if (index >= 0) meshes.splice(index, 1);
          Object.values(layers).forEach((items) => { const index = items.indexOf(/** @type {Mesh} */ (mesh)); if (index >= 0) items.splice(index, 1); });
        });
        for (let index = draped.length - 1; index >= 0; index -= 1) if (owned.has(draped[index].mesh)) draped.splice(index, 1);
        const index = aligned.findIndex((entry) => entry.model === model); if (index >= 0) { const [entry] = aligned.splice(index, 1); syncBuilding(entry.id); }
        originals.delete(model.root); modelMeshes.delete(model.root);
        const external = externals.findIndex((entry) => entry.model === model); if (external >= 0) { const [entry] = externals.splice(external, 1); syncBuilding(entry.id); }
      },
      /** @param {string} layer @param {boolean} visible */
      setLayerVisible(layer, visible) { layerVisibility[layer] = visible; (layers[layer] || []).forEach((mesh) => mesh.setEnabled(visible && featureVisibility.get(mesh.metadata?.featureId) !== false)); if (layer === "buildings") proxies.forEach((_, id) => syncBuilding(id)); redrawInteractions(); },
      /** @param {number} factor */
      setVerticalExaggeration(factor) {
        if (!Number.isFinite(factor) || factor < 1 || factor > 3) throw new Error("지형 강조 배수는 1~3 범위여야 합니다.");
        exaggeration = factor;
        heightCache.clear(); normalCache.clear();
        draped.forEach(({ mesh, offset }) => {
          const vertices = mesh.getVerticesData(B.VertexBuffer.PositionKind);
          if (!vertices) return;
          for (let index = 0; index < vertices.length; index += 3) vertices[index + 1] = terrainHeightAt(vertices[index], vertices[index + 2]) + offset;
          mesh.updateVerticesData(B.VertexBuffer.PositionKind, vertices);
          const indices = mesh.getIndices();
          if (indices && mesh.isVerticesDataPresent(B.VertexBuffer.NormalKind)) {
            const normals = terrainNormals(Array.from(vertices));
            mesh.updateVerticesData(B.VertexBuffer.NormalKind, normals);
          }
          mesh.refreshBoundingInfo();
        });
        grounded.forEach(({ mesh, x, z, offset }) => { mesh.position.y = terrainHeightAt(x, z) + offset; });
        proxyVolumes.forEach(({ mesh, height }) => {
          const vertices = mesh.getVerticesData(B.VertexBuffer.PositionKind); if (!vertices) return;
          for (let index = 0; index < vertices.length; index += 3) vertices[index + 1] = terrainHeightAt(vertices[index], vertices[index + 2]) + (index / 3 % 2 ? height : 0.03);
          mesh.updateVerticesData(B.VertexBuffer.PositionKind, vertices); mesh.refreshBoundingInfo();
        });
        aligned.forEach(({ model, id }) => alignModel(model, id));
        externals.forEach(({ model, baseY, anchorY }) => { model.root.position.y = baseY + anchorY * (factor - 1); });
        if (locationPoint && locationMeshes.length === 2) {
          locationMeshes[0].position.y = terrainHeightAt(locationPoint[0], locationPoint[1]) + 0.22;
          const vertices = locationMeshes[1].getVerticesData(B.VertexBuffer.PositionKind);
          if (vertices) { for (let i = 0; i < vertices.length; i += 3) vertices[i + 1] = terrainHeightAt(vertices[i], vertices[i + 2]) + 0.16; locationMeshes[1].updateVerticesData(B.VertexBuffer.PositionKind, vertices); locationMeshes[1].refreshBoundingInfo(); }
        }
        cameraController?.fit();
        redrawInteractions();
      },
      getDiagnostics() { return { errors: [...failures], boundaryAreaMeters2: parts.reduce((sum, part) => sum + (Math.abs(signedArea(part.outer)) - part.holes.reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0)) * metersPerUnit * metersPerUnit, 0), boundaryAreaMeaning: "estimated-guide-area-not-legal-area", campusPartCount: parts.length, metersPerUnit, verticalExaggeration: exaggeration, estimatedTerrain: Boolean(options.terrain), legalBoundaryAvailable: boundaryLegend.some((entry) => entry.type === "legal" && entry.available), boundaryLegend: boundaryLegend.map((entry) => ({ ...entry })), interactionCount: interactionMeshes.length, observationIsVerifiedRoute: false, hierarchy: { campus: "primary", context: "background", essentialLayers: ["boundary", "buildings", "entrances"] }, batching: { ...batching }, sceneMeshCount: scene.meshes.length, layerCounts: Object.fromEntries(Object.entries(layers).map(([layer, items]) => [layer, items.length])) }; },
      /** @param {number} east @param {number} north @param {number} accuracyMeters */
      showUserLocation(east, north, accuracyMeters) {
        locationMeshes.splice(0).forEach((mesh) => mesh.dispose());
        locationPoint = null;
        if (![east, north, accuracyMeters].every(Number.isFinite) || accuracyMeters < 0 || accuracyMeters > 100000) throw new Error("위치 및 정확도 값이 유효하지 않습니다.");
        const [x, z] = worldPoint([east, north]);
        if (!insideCampus([x, z])) return false;
        const marker = B.MeshBuilder.CreateSphere("temporary-user-location", { diameter: 0.3, segments: 8 }, scene);
        marker.position.set(x, terrainHeightAt(x, z) + 0.22, z); marker.material = palette.location; marker.isPickable = false;
        /** @type {import('babylonjs').Vector3[]} */ const points = [];
        const radius = Math.max(accuracyMeters / metersPerUnit, 0.02);
        for (let index = 0; index <= 64; index += 1) { const angle = index / 64 * Math.PI * 2; const px = x + Math.cos(angle) * radius; const pz = z + Math.sin(angle) * radius; points.push(new B.Vector3(px, terrainHeightAt(px, pz) + 0.16, pz)); }
        const circle = B.MeshBuilder.CreateLines("temporary-user-location-accuracy", { points, updatable: true }, scene); circle.color = B.Color3.FromHexString("#236a87"); circle.alpha = 0.8; circle.isPickable = false;
        locationPoint = [x, z, accuracyMeters]; locationMeshes.push(marker, circle); return true;
      },
      clearUserLocation() { locationPoint = null; locationMeshes.splice(0).forEach((mesh) => mesh.dispose()); },
      dispose() { cameraController?.dispose(); interactionMeshes.splice(0).forEach((mesh) => mesh.dispose()); locationMeshes.splice(0).forEach((mesh) => mesh.dispose()); proxies.forEach(({ root }) => root.dispose()); meshes.forEach((mesh) => mesh.dispose()); createdMaterials.forEach((material) => material.dispose()); }
    };
  }

  /** @param {Scene} scene @param {ReturnType<typeof boundsOf>} bounds @param {number} metersPerUnit @param {(x:number,z:number)=>number} height @param {HTMLCanvasElement|null} canvas @param {(id:string)=>Point|null} findBuilding @param {()=>import("babylonjs").Vector3[]} framePoints @param {(id:string)=>import("babylonjs").Vector3[]} featurePoints */
  function createCameraController(scene, bounds, metersPerUnit, height, canvas, findBuilding, framePoints, featurePoints) {
    const target = new B.Vector3(bounds.center[0], height(...bounds.center), bounds.center[1]);
    // Present the campus's long axis diagonally so the complete site is legible
    // within the panel-safe viewport instead of appearing as a horizontal strip.
    const overviewAlpha = 1.15;
    const orbit = new B.ArcRotateCamera("site-overview-camera", overviewAlpha, 0.6, 100, target, scene);
    orbit.minZ = 0.03; orbit.maxZ = 10000; orbit.lowerBetaLimit = 0.01; orbit.upperBetaLimit = Math.PI / 2 - 0.08;
    orbit.panningSensibility = 120; orbit.wheelDeltaPercentage = 0.08; orbit.inertia = 0.65;
    const free = new B.UniversalCamera("site-free-camera", new B.Vector3(target.x, target.y + 0.18, target.z + 4), scene);
    let eyeHeightMeters = 1.7;
    let eyeHeight = eyeHeightMeters / metersPerUnit + EPSILON;
    const movementSpeedMetersPerSecond = 1.4;
    free.minZ = 0.015; free.maxZ = 10000; free.speed = movementSpeedMetersPerSecond / metersPerUnit; free.angularSensibility = 3800; free.inertia = 0;
    // The stock camera speed mixes FPS and time. Explicit delta-time movement
    // keeps a meter-per-second contract across campuses and slow frames.
    free._computeLocalCameraSpeed = () => movementSpeedMetersPerSecond / metersPerUnit * Math.min(100, Math.max(0, scene.getEngine().getDeltaTime())) / 1000;
    scene.collisionsEnabled = true; free.checkCollisions = true; free.applyGravity = false;
    free.ellipsoid = new B.Vector3(0.28 / metersPerUnit, 0.85 / metersPerUnit, 0.28 / metersPerUnit);
    free.keysUp.push(87); free.keysDown.push(83); free.keysLeft.push(65); free.keysRight.push(68);
    let view = "overview";
    let baseSpan = 100;
    let fittedRadius = 100;
    /** @type {{left:number,right:number,top:number,bottom:number}|null} */ let safeArea = null;
    /** @type {{elapsed:number,duration:number,start:{target:import('babylonjs').Vector3,radius:number,alpha:number,beta:number},end:{target:import('babylonjs').Vector3,radius:number,alpha:number,beta:number}}|null} */ let transition = null;
    /** @type {{view:string,alpha:number,beta:number,radius:number,target:number[],freePosition:number[],freeRotation:number[]}|null} */ let observationReturn = null;
    function cancelTransition() { transition = null; }
    function clearInertia() { orbit.inertialAlphaOffset = 0; orbit.inertialBetaOffset = 0; orbit.inertialRadiusOffset = 0; orbit.inertialPanningX = 0; orbit.inertialPanningY = 0; }
    function updateViewport() {
      if (safeArea) {
        const width = scene.getEngine().getRenderWidth(); const height = scene.getEngine().getRenderHeight();
        const usableWidth = Math.max(width * 0.2, width - safeArea.left - safeArea.right); const usableHeight = Math.max(height * 0.2, height - safeArea.top - safeArea.bottom);
        orbit.viewport = new B.Viewport(Math.min(safeArea.left, width * 0.8) / width, Math.min(safeArea.bottom, height * 0.8) / height, usableWidth / width, usableHeight / height); free.viewport = orbit.viewport.clone(); return;
      }
      if (!canvas || typeof document === "undefined") return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const header = document.querySelector(".campus-topbar")?.getBoundingClientRect();
      const controls = document.getElementById("siteControls");
      const tools = controls?.getBoundingClientRect();
      const expanded = controls?.querySelector(".site-panel-toggle")?.getAttribute("aria-expanded") === "true";
      const metrics = document.querySelector(".site-map-metrics")?.getBoundingClientRect();
      const mobile = rect.width < 700;
      const left = 12;
      const top = Math.max(18, (header?.bottom || rect.top + 12) - rect.top + 12, mobile && !expanded && tools ? tools.bottom - rect.top + 12 : 0);
      const right = Math.max(left + rect.width * 0.3, !mobile && tools ? tools.left - rect.left - 14 : rect.width - 12);
      const bottom = Math.max(top + rect.height * 0.35, Math.min(rect.height - 18, (metrics?.top || rect.bottom - 10) - rect.top - 10));
      const viewport = new B.Viewport(left / rect.width, (rect.height - bottom) / rect.height, (right - left) / rect.width, (bottom - top) / rect.height);
      orbit.viewport = viewport; free.viewport = viewport.clone();
    }
    /** @returns {number} */
    const aspect = () => Math.max(0.25, scene.getEngine().getRenderWidth() * orbit.viewport.width / Math.max(1, scene.getEngine().getRenderHeight() * orbit.viewport.height));
    function syncOrtho() {
      if (view !== "top") return;
      const halfHeight = baseSpan * orbit.radius / fittedRadius / 2;
      orbit.orthoTop = halfHeight; orbit.orthoBottom = -halfHeight; orbit.orthoLeft = -halfHeight * aspect(); orbit.orthoRight = halfHeight * aspect();
    }
    function fit() {
      cancelTransition(); clearInertia();
      updateViewport();
      orbit.setTarget(target, false, true, true);
      const diagonal = Math.hypot(bounds.width, bounds.depth);
      // Fit the complete boundary at every aspect ratio with a visible margin.
      baseSpan = Math.max(bounds.depth, bounds.width / aspect()) * 1.28 + 3;
      // Fit the projected boundary and building roofs, rather than an oversized
      // diagonal sphere. A tilted long campus otherwise occupies little of the
      // safe viewport even though its camera angle is already a bird's-eye view.
      const radial = new B.Vector3(Math.cos(orbit.alpha) * Math.sin(orbit.beta), Math.cos(orbit.beta), Math.sin(orbit.alpha) * Math.sin(orbit.beta));
      const right = new B.Vector3(Math.sin(orbit.alpha), 0, -Math.cos(orbit.alpha));
      const up = B.Vector3.Cross(radial, right);
      const verticalTangent = Math.tan(orbit.fov / 2) * 0.82;
      const horizontalTangent = verticalTangent * aspect();
      fittedRadius = Math.max(8, ...framePoints().map((point) => {
        const delta = point.subtract(target);
        const depth = B.Vector3.Dot(delta, radial);
        return depth + Math.max(Math.abs(B.Vector3.Dot(delta, right)) / horizontalTangent, Math.abs(B.Vector3.Dot(delta, up)) / verticalTangent, orbit.minZ * 2);
      }));
      orbit.radius = fittedRadius; orbit.lowerRadiusLimit = Math.max(2, diagonal * 0.025); orbit.upperRadiusLimit = Math.max(fittedRadius * 6, 200);
      syncOrtho();
    }
    /** @param {string} next */
    function setView(next) {
      if (!["overview", "top", "free"].includes(next)) throw new Error("지원하지 않는 캠퍼스 시점입니다.");
      cancelTransition(); clearInertia();
      if (next === "free" && view !== "free") observationReturn = capture();
      scene.activeCamera?.detachControl();
      view = next;
      if (next === "free") {
        free.position.set(orbit.target.x, height(orbit.target.x, orbit.target.z + 4) + eyeHeight, orbit.target.z + 4);
        free.setTarget(new B.Vector3(orbit.target.x, free.position.y, orbit.target.z)); scene.activeCamera = free;
      } else {
        scene.activeCamera = orbit; orbit.mode = next === "top" ? B.Camera.ORTHOGRAPHIC_CAMERA : B.Camera.PERSPECTIVE_CAMERA;
        orbit._panningMouseButton = next === "top" ? 0 : 2;
        orbit.beta = next === "top" ? 0.01 : 0.6; if (next === "top") orbit.alpha = Math.PI / 2; syncOrtho();
      }
      if (canvas) {
        if (next === "free") free.attachControl(canvas, true);
        else orbit.attachControl(true, false, next === "top" ? 0 : 2);
      }
      if (next !== "free") fit();
    }
    const observer = scene.onBeforeRenderObservable.add(() => {
      syncOrtho();
      if (transition) {
        transition.elapsed += Math.max(1, Math.min(100, scene.getEngine().getDeltaTime() || 16));
        const linear = Math.min(1, transition.elapsed / transition.duration); const t = linear * linear * (3 - 2 * linear);
        orbit.setTarget(B.Vector3.Lerp(transition.start.target, transition.end.target, t), false, true, true);
        orbit.radius = transition.start.radius + (transition.end.radius - transition.start.radius) * t;
        orbit.alpha = transition.start.alpha + (transition.end.alpha - transition.start.alpha) * t;
        orbit.beta = transition.start.beta + (transition.end.beta - transition.start.beta) * t;
        if (linear >= 1) transition = null;
      }
      if (view === "free") free.position.y = Math.max(free.position.y, height(free.position.x, free.position.z) + eyeHeight);
    });
    const groundObserver = scene.onBeforeCameraRenderObservable.add((camera) => {
      if (camera === free) free.position.y = Math.max(free.position.y, height(free.position.x, free.position.z) + eyeHeight);
    });
    const pointerObserver = scene.onPointerObservable.add((event) => { if ([B.PointerEventTypes.POINTERDOWN, B.PointerEventTypes.POINTERWHEEL].includes(event.type)) cancelTransition(); });
    const keyboardObserver = scene.onKeyboardObservable.add((event) => { if (event.type === B.KeyboardEventTypes.KEYDOWN) cancelTransition(); });
    function capture() { return { view, alpha: orbit.alpha, beta: orbit.beta, radius: orbit.radius, target: orbit.target.asArray(), freePosition: free.position.asArray(), freeRotation: free.rotation.asArray() }; }
    /** @param {{view:string,alpha:number,beta:number,radius:number,target:number[],freePosition:number[],freeRotation:number[]}} state */
    function restore(state) {
      if (!state || !["overview", "top", "free"].includes(state.view) || ![state.alpha, state.beta, state.radius, ...(state.target || []), ...(state.freePosition || []), ...(state.freeRotation || [])].every(Number.isFinite) || state.radius <= 0 || state.target?.length !== 3 || state.freePosition?.length !== 3 || state.freeRotation?.length !== 3) throw new Error("복원할 카메라 상태가 유효하지 않습니다.");
      setView(state.view); orbit.setTarget(B.Vector3.FromArray(state.target), false, true, true); orbit.alpha = state.alpha; orbit.beta = state.beta; orbit.radius = state.radius; free.position.copyFrom(B.Vector3.FromArray(state.freePosition)); free.rotation.copyFrom(B.Vector3.FromArray(state.freeRotation)); syncOrtho();
    }
    fit(); setView("overview");
    return {
      orbit, free, fit, resize() { fit(); }, reset() { orbit.alpha = overviewAlpha; setView("overview"); fit(); }, setView,
      getView() { return view; },
      /** Insets use engine render pixels, with a 20% viewport minimum.
       * @param {{left?:number,right?:number,top?:number,bottom?:number}|null} insets
       * @param {{preserveView?:boolean}} [settings] */
      setSafeArea(insets, settings = {}) {
        if (insets === null) { if (safeArea === null) return; }
        else {
          const values = { left: insets.left ?? 0, right: insets.right ?? 0, top: insets.top ?? 0, bottom: insets.bottom ?? 0 };
          if (!Object.values(values).every((value) => Number.isFinite(value) && value >= 0) || values.left + values.right > scene.getEngine().getRenderWidth() * 0.8 || values.top + values.bottom > scene.getEngine().getRenderHeight() * 0.8) throw new Error("카메라 안전 여백은 유한한 양수이며 화면의 80% 이하여야 합니다.");
          const currentArea = safeArea;
          if (currentArea && Object.entries(values).every(([key, value]) => currentArea[/** @type {keyof typeof values} */ (key)] === value)) return;
        }
        const previous = settings.preserveView ? capture() : null;
        const previousFit = fittedRadius;
        safeArea = insets === null ? null : { left: insets.left ?? 0, right: insets.right ?? 0, top: insets.top ?? 0, bottom: insets.bottom ?? 0 };
        fit();
        // Preserve the user's focus and zoom relative to the usable viewport.
        if (previous) restore({ ...previous, radius: previous.radius * fittedRadius / previousFit });
      },
      cancelTransition,
      getTransitionState() { return { active: Boolean(transition), elapsedMs: transition?.elapsed || 0, durationMs: transition?.duration || 0 }; },
      getObservationInfo() { return { eyeHeightMeters, movementSpeedMetersPerSecond, collisionEnabled: free.checkCollisions, movementIsVerifiedRoute: false, returnAvailable: Boolean(observationReturn) }; },
      /** This setting controls the virtual observation camera, never a tracked XR head pose.
       * @param {{eyeHeightMeters:number}} settings */
      setObservationSettings(settings) { if (!settings || !Number.isFinite(settings.eyeHeightMeters) || settings.eyeHeightMeters < 0.5 || settings.eyeHeightMeters > 2.3) throw new Error("가상 관찰 눈높이는 0.5m에서 2.3m 사이여야 합니다."); const previousHeight = eyeHeight; eyeHeightMeters = settings.eyeHeightMeters; eyeHeight = eyeHeightMeters / metersPerUnit + EPSILON; free.ellipsoid.y = eyeHeightMeters * 0.5 / metersPerUnit; if (view === "free") free.position.y = Math.max(free.position.y + eyeHeight - previousHeight, height(free.position.x, free.position.z) + eyeHeight); },
      returnFromObservation() { if (!observationReturn) { setView("overview"); return false; } const saved = observationReturn; observationReturn = null; restore(saved); return true; },
      /** @param {number} direction */
      zoom(direction) { cancelTransition(); if (view !== "free") { orbit.radius = Math.max(orbit.lowerRadiusLimit || 2, Math.min(orbit.upperRadiusLimit || 10000, orbit.radius * (direction > 0 ? 0.8 : 1.25))); syncOrtho(); } },
      /** @param {number} direction */
      rotate(direction) { cancelTransition(); if (view === "free") free.rotation.y += direction * Math.PI / 8; else orbit.alpha += direction * Math.PI / 8; },
      /** Target framing uses real visible asset bounds instead of a fixed radius.
       * @param {string} id @param {{durationMs?:number,reducedMotion?:boolean,entranceId?:string}} [settings] */
      focusBuilding(id, settings = {}) {
        const point = findBuilding(id); const points = featurePoints(id); if (!point && !points.length) return false;
        const previous = { target: orbit.target.clone(), radius: orbit.radius, alpha: orbit.alpha, beta: orbit.beta }; const previousView = view;
        setView("overview"); updateViewport();
        if (previousView === "overview") { orbit.setTarget(previous.target, false, true, true); orbit.radius = previous.radius; orbit.alpha = previous.alpha; orbit.beta = previous.beta; }
        const vectors = points.length ? points : [new B.Vector3(/** @type {Point} */ (point)[0], height(.../** @type {Point} */ (point)), /** @type {Point} */ (point)[1])];
        const min = new B.Vector3(Math.min(...vectors.map((value) => value.x)), Math.min(...vectors.map((value) => value.y)), Math.min(...vectors.map((value) => value.z)));
        const max = new B.Vector3(Math.max(...vectors.map((value) => value.x)), Math.max(...vectors.map((value) => value.y)), Math.max(...vectors.map((value) => value.z)));
        const center = min.add(max).scale(0.5); const entrance = settings.entranceId ? findBuilding(settings.entranceId) : null;
        let alpha = entrance ? Math.atan2(entrance[1] - center.z, entrance[0] - center.x) : orbit.alpha;
        alpha = orbit.alpha + Math.atan2(Math.sin(alpha - orbit.alpha), Math.cos(alpha - orbit.alpha));
        const beta = 0.6; const radial = new B.Vector3(Math.cos(alpha) * Math.sin(beta), Math.cos(beta), Math.sin(alpha) * Math.sin(beta)); const right = new B.Vector3(Math.sin(alpha), 0, -Math.cos(alpha)); const up = B.Vector3.Cross(radial, right);
        const tangent = Math.tan(orbit.fov / 2) * 0.78;
        const radius = Math.max(3, ...vectors.map((value) => { const delta = value.subtract(center); return B.Vector3.Dot(delta, radial) + Math.max(Math.abs(B.Vector3.Dot(delta, right)) / (tangent * aspect()), Math.abs(B.Vector3.Dot(delta, up)) / tangent, orbit.minZ * 2); }));
        const duration = settings.reducedMotion ? 0 : Math.max(0, Math.min(600, Number.isFinite(settings.durationMs) ? /** @type {number} */ (settings.durationMs) : 0));
        clearInertia();
        if (duration) transition = { elapsed: 0, duration, start: { target: orbit.target.clone(), radius: orbit.radius, alpha: orbit.alpha, beta: orbit.beta }, end: { target: center, radius, alpha, beta } };
        else { orbit.setTarget(center, false, true, true); orbit.radius = radius; orbit.alpha = alpha; orbit.beta = beta; }
        return true;
      },
      /** Keyboard-accessible movement accompanies drag controls.
       * @param {number} horizontal @param {number} vertical */
      pan(horizontal, vertical) { cancelTransition(); if (![horizontal, vertical].every(Number.isFinite)) return; const camera = view === "free" ? free : orbit; const amount = view === "free" ? 0.5 / metersPerUnit : orbit.radius * 0.05; const right = B.Vector3.TransformNormal(new B.Vector3(1, 0, 0), B.Matrix.Invert(camera.getViewMatrix())).normalize(); const forward = B.Vector3.TransformNormal(new B.Vector3(0, 0, -1), B.Matrix.Invert(camera.getViewMatrix())); forward.y = 0; forward.normalize(); const delta = right.scale(horizontal * amount).add(forward.scale(vertical * amount)); if (view === "free") free._collideWithWorld(delta); else orbit.setTarget(orbit.target.add(delta), false, true, true); },
      capture, restore,
      getNorthRotation() {
        const camera = view === "free" ? free : orbit;
        const north = B.Vector3.TransformNormal(new B.Vector3(0, 0, -1), camera.getViewMatrix());
        return Math.atan2(north.x, north.y);
      },
      getScaleBar() {
        if (view !== "top") return { visible: false, mode: "perspective", text: `${metersPerUnit}m / 모델 단위 · 원근 시점` };
        const worldWidth = /** @type {number} */ (orbit.orthoRight) - /** @type {number} */ (orbit.orthoLeft);
        const metersPerPixel = worldWidth * metersPerUnit / Math.max(1, scene.getEngine().getRenderWidth() * orbit.viewport.width);
        const desired = metersPerPixel * 130;
        const power = Math.pow(10, Math.floor(Math.log10(Math.max(desired, 0.01))));
        const normalized = desired / power;
        const meters = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * power;
        return { visible: true, mode: "orthographic", meters, pixels: meters / metersPerPixel, metersPerPixel, text: `${meters >= 1000 ? `${meters / 1000}km` : `${meters}m`}` };
      },
      dispose() { transition = null; scene.onBeforeRenderObservable.remove(observer); scene.onBeforeCameraRenderObservable.remove(groundObserver); scene.onPointerObservable.remove(pointerObserver); scene.onKeyboardObservable.remove(keyboardObserver); orbit.dispose(); free.dispose(); }
    };
  }

  Object.assign(window, { CampusSiteScene: { create, geometry: { contains, signedArea, triangulate, boundsOf, sampleElevation, polygonWithHole, polygonWithHoles } } });
})();
