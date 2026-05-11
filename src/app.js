// Compiled JavaScript from app.ts. Browser entry point.
function material(scene, name, color, roughness = 0.9, alpha = 1) {
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = BABYLON.Color3.FromHexString(color);
  mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
  mat.roughness = roughness;
  mat.alpha = alpha;
  if (alpha < 1) {
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    mat.needDepthPrePass = true;
  }
  return mat;
}

function createMaterials(scene) {
  return {
    grass: material(scene, "transparent-terrain-slope", "#8bcf6c", 0.9, 0.56),
    water: material(scene, "water", "#7eb9c0", 0.35),
    retaining: material(scene, "campus-retaining-wall", "#8d8271"),
    road: material(scene, "road", "#6f695d", 0.9, 0.82),
    pedestrian: material(scene, "pedestrian-path", "#e5d7a2", 0.9, 0.62),
    entranceWalk: material(scene, "entrance-direction-walk", "#d8c99d", 0.9, 0.45),
    entranceArrow: material(scene, "entrance-direction-arrow", "#2c6144"),
    plaza: material(scene, "plaza", "#d9cd9f"),
    parking: material(scene, "parking", "#cfc69e"),
    parkingLine: material(scene, "parking-line", "#f8f1d2"),
    scale: material(scene, "scale-ruler", "#173625"),
    scaleTick: material(scene, "scale-ruler-tick", "#f8f1d2"),
    wall: material(scene, "janggong-wall", "#d8d1c2"),
    sideWall: material(scene, "janggong-side-wall", "#c7b899"),
    pilheonWall: material(scene, "pilheon-wall", "#d6d2bf"),
    pilheonCore: material(scene, "pilheon-stair-core", "#b8b29c"),
    pilheonRoof: material(scene, "pilheon-roof", "#d9c28f"),
    manwooWall: material(scene, "manwoo-wall", "#b8b09d"),
    manwooSideWall: material(scene, "manwoo-side-wall", "#a79c83"),
    manwooRoof: material(scene, "manwoo-aged-roof", "#ded2a5"),
    manwooCorridor: material(scene, "manwoo-exterior-corridor", "#e5d6b4"),
    manwooStair: material(scene, "manwoo-exterior-stair", "#918a77"),
    manwooLounge: material(scene, "manwoo-lounge-glass", "#6ca3a8", 0.35),
    manwooHighlightWindow: material(scene, "manwoo-highlight-window", "#315e69", 0.35),
    shalomWall: material(scene, "shalom-wall", "#d9d0bd"),
    shalomPlinth: material(scene, "shalom-catacomb-plinth", "#8d8777"),
    shalomPorch: material(scene, "shalom-front-porch", "#c7b99c"),
    shalomOffice: material(scene, "shalom-office-4106", "#c8d2be"),
    shalomRoof: material(scene, "shalom-pitched-roof", "#7f5645"),
    shalomRidge: material(scene, "shalom-roof-ridge", "#5f4138"),
    shalomGlass: material(scene, "shalom-stained-glass", "#5c8fa4", 0.25),
    shalomCross: material(scene, "shalom-cross", "#e7ddbe"),
    immanuelWall: material(scene, "immanuel-student-union-wall", "#d3c8af"),
    immanuelBase: material(scene, "immanuel-basement-base", "#8f8876"),
    immanuelRoof: material(scene, "immanuel-flat-warm-roof", "#b99a72"),
    immanuelFoodGlass: material(scene, "immanuel-cafeteria-glass", "#85b6b4", 0.28),
    immanuelStore: material(scene, "immanuel-emart24-storefront", "#345a4b"),
    immanuelKitchen: material(scene, "immanuel-kitchen-service-band", "#a77f5e"),
    immanuelCanopy: material(scene, "immanuel-entry-canopy", "#e2d7b2"),
    immanuelClubGlass: material(scene, "immanuel-club-room-glass", "#315f67", 0.32),
    immanuelStudioGlass: material(scene, "immanuel-hbs-studio-glass", "#5d99a9", 0.24),
    immanuelNotice: material(scene, "immanuel-student-org-room", "#a7bf8c"),
    gyeongsamWall: material(scene, "gyeongsam-library-wall", "#c9c1ad"),
    gyeongsamSideWall: material(scene, "gyeongsam-book-stack-wall", "#b7ad97"),
    gyeongsamLobbyWall: material(scene, "gyeongsam-east-lobby-wall", "#d7d0bb"),
    gyeongsamRoof: material(scene, "gyeongsam-flat-roof", "#e3ddbf"),
    gyeongsamTrim: material(scene, "gyeongsam-horizontal-trim", "#8e8065"),
    gyeongsamGlass: material(scene, "gyeongsam-atrium-glass", "#7eaeb6", 0.25),
    gyeongsamTopGlass: material(scene, "gyeongsam-makerspace-glass", "#5f97a4", 0.26),
    gyeongsamLounge: material(scene, "gyeongsam-lounge-glass", "#91b08c", 0.3),
    gyeongsamWindow: material(scene, "gyeongsam-library-window", "#2f5863", 0.3),
    songamWall: material(scene, "songam-yusa-hall-wall", "#c9bfa8"),
    songamSideWall: material(scene, "songam-lab-wing-wall", "#b8ad94"),
    songamStageWall: material(scene, "songam-stage-back-wall", "#9d927b"),
    songamRoof: material(scene, "songam-flat-roof", "#eee6c5"),
    songamGlass: material(scene, "songam-hall-glass", "#79aab2", 0.26),
    songamWindow: material(scene, "songam-classroom-window", "#2f5863", 0.3),
    songamTrim: material(scene, "songam-front-trim", "#8d7d62"),
    sotongWall: material(scene, "sotong-professor-wall", "#c6bca5"),
    sotongCore: material(scene, "sotong-stair-core", "#938873"),
    sotongMuseum: material(scene, "sotong-museum-wing", "#b5c09d"),
    sotongRoof: material(scene, "sotong-flat-roof", "#e6dfc0"),
    sotongGlass: material(scene, "sotong-entry-glass", "#78a9b0", 0.26),
    sotongAccent: material(scene, "sotong-admin-accent", "#9ebc8f", 0.32),
    sotongWindow: material(scene, "sotong-office-window", "#315a64", 0.3),
    sotongTrim: material(scene, "sotong-horizontal-trim", "#8b7d63"),
    practiceWall: material(scene, "practice-workshop-wall", "#c9c0aa"),
    practiceSideWall: material(scene, "practice-startup-wing-wall", "#b8ae96"),
    practiceBase: material(scene, "practice-concrete-base", "#837c6b"),
    practiceRoof: material(scene, "practice-low-flat-roof", "#e6ddbd"),
    practiceGlass: material(scene, "practice-startup-glass", "#75a7ae", 0.26),
    practiceWindow: material(scene, "practice-lab-window", "#2f5964", 0.3),
    practiceDoor: material(scene, "practice-loading-door", "#496a65"),
    practiceTrim: material(scene, "practice-industrial-trim", "#81745d"),
    hanulWall: material(scene, "hanul-gymnasium-wall", "#d0c7b4"),
    hanulSideWall: material(scene, "hanul-side-wing-wall", "#b7ad98"),
    hanulBase: material(scene, "hanul-athletic-base", "#8b8575"),
    hanulRoof: material(scene, "hanul-wide-roof", "#e9e0bd"),
    hanulRoofRidge: material(scene, "hanul-raised-roof-ridge", "#c0a782"),
    hanulGlass: material(scene, "hanul-entry-glass", "#78a9b0", 0.26),
    hanulWindow: material(scene, "hanul-high-window", "#315a64", 0.3),
    hanulTrim: material(scene, "hanul-horizontal-trim", "#81745d"),
    seongbinWall: material(scene, "seongbin-new-dorm-wall", "#c6bb9f"),
    seongbinOldWall: material(scene, "seongbin-old-dorm-wall", "#b7aa91"),
    seongbinCore: material(scene, "seongbin-common-core", "#d3c7aa"),
    seongbinBase: material(scene, "seongbin-raised-base", "#837a69"),
    seongbinRoof: material(scene, "seongbin-red-brown-roof", "#9b6756"),
    seongbinGlass: material(scene, "seongbin-entry-glass", "#78a9b0", 0.26),
    seongbinWindow: material(scene, "seongbin-dorm-room-window", "#2f5964", 0.3),
    saeromWall: material(scene, "saerom-media-hall-wall", "#c8bea7"),
    saeromCafeWall: material(scene, "saerom-cafe-wall", "#d9c9a4"),
    saeromBase: material(scene, "saerom-park-base", "#867d6b"),
    saeromRoof: material(scene, "saerom-low-flat-roof", "#e8dfbd"),
    saeromTerrace: material(scene, "saerom-cafe-terrace", "#bca27b"),
    saeromGlass: material(scene, "saerom-cafe-glass", "#78a9b0", 0.26),
    saeromWindow: material(scene, "saerom-media-window", "#2f5964", 0.3),
    saeromAccent: material(scene, "saerom-cafe-sign-band", "#6a8f74"),
    haeoreumWall: material(scene, "haeoreum-third-lecture-wall", "#cbbfa7"),
    haeoreumSideWall: material(scene, "haeoreum-lab-wing-wall", "#b8ad96"),
    haeoreumCore: material(scene, "haeoreum-stair-core", "#938873"),
    haeoreumBase: material(scene, "haeoreum-raised-base", "#857c6b"),
    haeoreumRoof: material(scene, "haeoreum-flat-roof", "#e6ddbd"),
    haeoreumGlass: material(scene, "haeoreum-lounge-glass", "#78a9b0", 0.26),
    haeoreumWindow: material(scene, "haeoreum-class-window", "#315a64", 0.3),
    haeoreumService: material(scene, "haeoreum-post-health-band", "#93ae86"),
    joonhaWall: material(scene, "joonha-unification-wall", "#c9bea5"),
    joonhaSideWall: material(scene, "joonha-conference-wing-wall", "#b8ad96"),
    joonhaBase: material(scene, "joonha-memorial-base", "#837a68"),
    joonhaRoof: material(scene, "joonha-flat-roof", "#e6ddbd"),
    joonhaGlass: material(scene, "joonha-memorial-glass", "#78a9b0", 0.26),
    joonhaWindow: material(scene, "joonha-office-window", "#315a64", 0.3),
    joonhaMemorial: material(scene, "joonha-memory-room-panel", "#9f8160"),
    joonhaGarden: material(scene, "joonha-central-garden", "#6f9a63"),
    joonhaStone: material(scene, "joonha-dolbegae-stone", "#5f5b53"),
    neutbomWall: material(scene, "neutbom-modern-wall", "#d0c6b2"),
    neutbomCore: material(scene, "neutbom-elevator-core", "#a89f8c"),
    neutbomBase: material(scene, "neutbom-visible-b1-base", "#827969"),
    neutbomRoof: material(scene, "neutbom-clean-roof", "#e8dfbd"),
    neutbomGlass: material(scene, "neutbom-learning-glass", "#78a9b0", 0.26),
    neutbomStudioGlass: material(scene, "neutbom-studio-glass", "#5d99a9", 0.24),
    neutbomWindow: material(scene, "neutbom-class-window", "#315a64", 0.3),
    neutbomAccent: material(scene, "neutbom-media-accent", "#668f75"),
    neutbomBridge: material(scene, "neutbom-manwoo-bridge", "#c8bea7"),
    childcareWall: material(scene, "childcare-main-wall", "#d8ccb5"),
    childcareSideWall: material(scene, "childcare-auditorium-wall", "#c2b296"),
    childcareBase: material(scene, "childcare-safe-base", "#867c69"),
    childcareRoof: material(scene, "childcare-warm-roof", "#c78064"),
    childcareGlass: material(scene, "childcare-entry-glass", "#78a9b0", 0.26),
    childcareWindow: material(scene, "childcare-room-window", "#315a64", 0.3),
    childcareAccent: material(scene, "childcare-therapy-room-panel", "#a8bd8c"),
    childcareSand: material(scene, "childcare-sand-yard", "#dbc690"),
    childcareGarden: material(scene, "childcare-nature-yard", "#7fa568"),
    childcarePlay: material(scene, "childcare-play-equipment", "#d89b5f"),
    childcareSlide: material(scene, "childcare-slide", "#7eb9c0"),
    childcareFence: material(scene, "childcare-play-fence", "#f2e5bd"),
    roof: material(scene, "janggong-roof", "#b99673"),
    trim: material(scene, "janggong-floor-trim", "#8f8066"),
    column: material(scene, "janggong-entry-column", "#d7d0bf"),
    stone: material(scene, "janggong-stone", "#c9c2b2"),
    relief: material(scene, "janggong-relief-panel", "#7e6a4d"),
    bronze: material(scene, "janggong-bronze", "#9b7045"),
    glass: material(scene, "janggong-glass", "#8bb7bf", 0.25),
    window: material(scene, "janggong-window", "#375d68", 0.28),
    floorSlab: material(scene, "janggong-floor-plan-slab", "#e9dec2", 0.9, 0.72),
    corridor: material(scene, "janggong-plan-corridor", "#d8cda6"),
    roomLobby: material(scene, "janggong-room-lobby", "#79b6bd"),
    roomOffice: material(scene, "janggong-room-office", "#b7c98e"),
    roomRestroom: material(scene, "janggong-room-restroom", "#aebbd0"),
    roomMeeting: material(scene, "janggong-room-meeting", "#d19a71"),
    roomLecture: material(scene, "room-lecture", "#9fc7a3"),
    redRoof: material(scene, "red-roof", "#c6765f"),
    creamWall: material(scene, "cream-wall", "#e9e1cf")
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function interpolatedElevationMeters(terrain, x, z) {
  const xs = terrain.xs;
  const zs = terrain.zs;
  const sampleX = clamp(x, xs[0], xs[xs.length - 1]);
  const sampleZ = clamp(z, zs[0], zs[zs.length - 1]);
  let xi = 0;
  let zi = 0;
  while (xi < xs.length - 2 && sampleX > xs[xi + 1]) xi += 1;
  while (zi < zs.length - 2 && sampleZ > zs[zi + 1]) zi += 1;
  const tx = (sampleX - xs[xi]) / (xs[xi + 1] - xs[xi]);
  const tz = (sampleZ - zs[zi]) / (zs[zi + 1] - zs[zi]);
  const h00 = terrain.elevations[zi][xi];
  const h10 = terrain.elevations[zi][xi + 1];
  const h01 = terrain.elevations[zi + 1][xi];
  const h11 = terrain.elevations[zi + 1][xi + 1];
  const h0 = h00 + (h10 - h00) * tx;
  const h1 = h01 + (h11 - h01) * tx;
  return h0 + (h1 - h0) * tz;
}

function terrainModifierMeters(terrain, x, z) {
  let meters = 0;
  (terrain.ridgeModifiers || []).forEach((ridge) => {
    const dx = (x - ridge.x) / ridge.radiusX;
    const dz = (z - ridge.z) / ridge.radiusZ;
    meters += ridge.height * Math.exp(-(dx * dx + dz * dz));
  });
  (terrain.valleyModifiers || []).forEach((valley) => {
    const dx = (x - valley.x) / valley.radiusX;
    const dz = (z - valley.z) / valley.radiusZ;
    meters -= valley.depth * Math.exp(-(dx * dx + dz * dz));
  });
  return meters;
}

function terrainHeightMetersWithoutPads(terrain, x, z) {
  return interpolatedElevationMeters(terrain, x, z) + terrainModifierMeters(terrain, x, z);
}

function terrainHeightMeters(terrain, x, z) {
  let meters = terrainHeightMetersWithoutPads(terrain, x, z);
  (terrain.buildingPads || []).forEach((pad) => {
    const dx = Math.abs(x - pad.x);
    const dz = Math.abs(z - pad.z);
    const blend = pad.blend || 1.2;
    if (dx > pad.halfX + blend || dz > pad.halfZ + blend) return;
    const padMeters = typeof pad.heightMeters === "number"
      ? pad.heightMeters
      : terrainHeightMetersWithoutPads(terrain, pad.x, pad.z) + (pad.liftMeters || 0);
    const edge = Math.max((dx - pad.halfX) / blend, (dz - pad.halfZ) / blend, 0);
    const weight = 1 - clamp(edge, 0, 1);
    meters = meters * (1 - weight) + padMeters * weight;
  });
  return meters;
}

function terrainHeightAt(terrain, x, z) {
  if (!terrain) return 0;
  return (terrainHeightMeters(terrain, x, z) - terrain.baseElevationMeters) * terrain.unitPerMeter;
}

function createTerrainGround(scene, materials, terrain) {
  const width = 264;
  const depth = 96;
  const xSegments = 96;
  const zSegments = 44;
  const positions = [];
  const indices = [];
  const uvs = [];
  for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
    const z = -depth / 2 + (depth * zIndex) / zSegments;
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const x = -width / 2 + (width * xIndex) / xSegments;
      positions.push(x, terrainHeightAt(terrain, x, z), z);
      uvs.push(xIndex / xSegments, zIndex / zSegments);
    }
  }
  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const a = zIndex * (xSegments + 1) + xIndex;
      const b = a + 1;
      const c = a + xSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const terrainMesh = new BABYLON.Mesh("campus-terrain-srtm90m", scene);
  const vertexData = new BABYLON.VertexData();
  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(terrainMesh);
  terrainMesh.material = materials.grass;
  terrainMesh.material.backFaceCulling = false;
}

function createRetainingWalls(scene, materials, terrain) {
  (terrain.retainingWalls || []).forEach((wall, index) => {
    const positions = [];
    const indices = [];
    wall.points.forEach(([x, z]) => {
      const top = terrainHeightAt(terrain, x, z) + 0.04;
      const bottom = top - (wall.dropMeters || 2.4) * terrain.unitPerMeter;
      positions.push(x, top, z, x, bottom, z);
    });
    for (let i = 0; i < wall.points.length - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const mesh = new BABYLON.Mesh(`terrain-retaining-wall-${wall.name || index + 1}`, scene);
    const vertexData = new BABYLON.VertexData();
    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.applyToMesh(mesh);
    mesh.material = materials.retaining;
  });
}

function createCampusContext(scene, materials) {
  createTerrainGround(scene, materials, CampusData.terrain);
  createRetainingWalls(scene, materials, CampusData.terrain);
  const water = BABYLON.MeshBuilder.CreateGround("campus-water", { width: 264, height: 12 }, scene);
  water.position.z = 50.5;
  water.position.y = -0.04;
  water.material = materials.water;
}

function createWorldScaleRuler(scene, materials, scale) {
  const barUnits = scale.scaleBarMeters / scale.babylonUnitMeters;
  const originX = -126;
  const originZ = 44.2;
  const bar = BABYLON.MeshBuilder.CreateBox("world-scale-100m", { width: barUnits, height: 0.08, depth: 0.18 }, scene);
  bar.position.set(originX + barUnits / 2, terrainHeightAt(CampusData.terrain, originX + barUnits / 2, originZ) + 0.08, originZ);
  bar.material = materials.scale;
  for (let i = 0; i <= barUnits; i += 1) {
    const tick = BABYLON.MeshBuilder.CreateBox(`world-scale-tick-${i}`, { width: 0.08, height: 0.1, depth: i % 5 === 0 ? 0.72 : 0.42 }, scene);
    tick.position.set(originX + i, terrainHeightAt(CampusData.terrain, originX + i, originZ) + 0.1, originZ);
    tick.material = i % 5 === 0 ? materials.scale : materials.scaleTick;
  }
}

const ROAD_EXCLUSION_ZONES = [
  { name: "janggong", x: 0.0, z: -1.4, halfX: 6.2, halfZ: 2.05 },
  { name: "pilheon", x: 11.4, z: -4.2, halfX: 3.1, halfZ: 1.45 },
  { name: "manwoo", x: -8.0, z: -12.2, halfX: 6.4, halfZ: 2.85 },
  { name: "neutbom", x: -8.0, z: -21.4, halfX: 4.0, halfZ: 1.85 },
  { name: "shalom", x: -23.5, z: 4.8, halfX: 3.5, halfZ: 2.35 },
  { name: "hanul", x: -34.2, z: 2.4, halfX: 5.0, halfZ: 3.0 },
  { name: "seongbin", x: -47.0, z: 11.0, halfX: 4.5, halfZ: 2.25 },
  { name: "immanuel", x: 12.4, z: -12.0, halfX: 3.5, halfZ: 1.65 },
  { name: "saerom", x: 18.3, z: -12.0, halfX: 2.45, halfZ: 1.7 },
  { name: "haeoreum", x: 26.4, z: -12.2, halfX: 3.55, halfZ: 1.85 },
  { name: "gyeongsam", x: 18.2, z: 0.4, halfX: 4.25, halfZ: 2.1 },
  { name: "sotong", x: 30.2, z: 4.8, halfX: 3.45, halfZ: 2.05 },
  { name: "songam", x: 35.7, z: -4.2, halfX: 4.05, halfZ: 2.1 },
  { name: "practice", x: 49.2, z: -8.7, halfX: 3.1, halfZ: 1.9 },
  { name: "joonha", x: 56.0, z: -14.0, halfX: 4.05, halfZ: 2.25 },
  { name: "childcare", x: 62.0, z: -8.4, halfX: 3.1, halfZ: 1.9 }
];

function pointInsideRoadExclusion(point) {
  const [x, z] = point;
  return ROAD_EXCLUSION_ZONES.some((zone) => (
    Math.abs(x - zone.x) <= zone.halfX && Math.abs(z - zone.z) <= zone.halfZ
  ));
}

function clipPathAroundBuildings(points) {
  const clipped = [];
  let current = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const distance = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(distance / 0.6));
    for (let step = 0; step <= steps; step += 1) {
      if (i > 0 && step === 0) continue;
      const t = step / steps;
      const point = [
        +(ax + (bx - ax) * t).toFixed(2),
        +(az + (bz - az) * t).toFixed(2)
      ];
      if (pointInsideRoadExclusion(point)) {
        if (current.length >= 2) clipped.push(current);
        current = [];
      } else if (!current.length || current[current.length - 1][0] !== point[0] || current[current.length - 1][1] !== point[1]) {
        current.push(point);
      }
    }
  }
  if (current.length >= 2) clipped.push(current);
  return clipped;
}

function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }
  return total;
}

function perpendicularDistance(point, start, end) {
  const [px, pz] = point;
  const [ax, az] = start;
  const [bx, bz] = end;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  if (!lengthSq) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let splitIndex = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifyPath(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyPath(points.slice(splitIndex), tolerance);
  return left.slice(0, -1).concat(right);
}

function cleanPathForRender(points, tolerance, minLength) {
  const simplified = simplifyPath(points, tolerance);
  if (simplified.length < 2 || pathLength(simplified) < minLength) return null;
  return simplified;
}

function createStripPath(scene, material, name, points, width, y = 0.032) {
  const positions = [];
  const indices = [];
  const normals = [];
  points.forEach(([x, z], index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - previous[0];
    const dz = next[1] - previous[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const height = terrainHeightAt(CampusData.terrain, x, z) + y;
    positions.push(x + nx * width / 2, height, z + nz * width / 2);
    positions.push(x - nx * width / 2, height, z - nz * width / 2);
    normals.push(0, 1, 0, 0, 1, 0);
  });
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const road = new BABYLON.Mesh(name, scene);
  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.applyToMesh(road);
  road.material = material;
  road.alwaysSelectAsActiveMesh = true;
  if (road.material) {
    road.material.backFaceCulling = false;
  }
}

function createRoadNetwork(scene, materials, network) {
  network.vehicleRoads.forEach((road) => {
    clipPathAroundBuildings(road.points).forEach((points, index) => {
      const cleanPoints = cleanPathForRender(points, 0.7, 3.6);
      if (cleanPoints) createStripPath(scene, materials.road, `${road.name}-visible-${index + 1}`, cleanPoints, road.width * 1.15, 0.085);
    });
  });
  network.walkways.forEach((walkway) => {
    if (walkway.highway === "steps") return;
    clipPathAroundBuildings(walkway.points).forEach((points, index) => {
      const cleanPoints = cleanPathForRender(points, 0.55, 4.2);
      if (cleanPoints) createStripPath(scene, materials.pedestrian, `${walkway.name}-visible-${index + 1}`, cleanPoints, walkway.width * 0.95, 0.095);
    });
  });
}

function createEntranceDirectionMarkers(scene, materials, entrances) {
  entrances.forEach((entry) => {
    const [ax, az] = entry.approach;
    const [dx, dz] = entry.door;
    const vx = dx - ax;
    const vz = dz - az;
    const length = Math.hypot(vx, vz);
    const angle = Math.atan2(vz, vx);
    const marker = BABYLON.MeshBuilder.CreateBox(`entrance-direction-${entry.name}`, {
      width: Math.max(0.55, length * 0.45),
      height: 0.025,
      depth: entry.width
    }, scene);
    const markerX = ax + vx * 0.42;
    const markerZ = az + vz * 0.42;
    marker.position.set(markerX, terrainHeightAt(CampusData.terrain, markerX, markerZ) + 0.04, markerZ);
    marker.rotation.y = angle;
    marker.material = materials.entranceWalk;
    const tip = BABYLON.MeshBuilder.CreateBox(`entrance-direction-tip-${entry.name}`, {
      width: entry.width * 0.55,
      height: 0.03,
      depth: entry.width * 0.55
    }, scene);
    const tipX = dx - Math.cos(angle) * 0.22;
    const tipZ = dz - Math.sin(angle) * 0.22;
    tip.position.set(tipX, terrainHeightAt(CampusData.terrain, tipX, tipZ) + 0.05, tipZ);
    tip.rotation.y = angle + Math.PI / 4;
    tip.material = materials.entranceArrow;
  });
}

function primaryTerrainMesh(model) {
  return model?.main || model?.hall || model?.newDorm || model?.mediaHall || null;
}

function terrainBaseHeightForModel(model, anchor) {
  const [x, z] = anchor;
  const mesh = primaryTerrainMesh(model);
  if (!mesh) return terrainHeightAt(CampusData.terrain, x, z);
  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const vectors = bounds.vectorsWorld;
  const xs = vectors.map((vector) => vector.x);
  const zs = vectors.map((vector) => vector.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const samples = [
    [x, z],
    [minX, minZ],
    [minX, maxZ],
    [maxX, minZ],
    [maxX, maxZ],
    [(minX + maxX) / 2, minZ],
    [(minX + maxX) / 2, maxZ],
    [minX, (minZ + maxZ) / 2],
    [maxX, (minZ + maxZ) / 2]
  ];
  return Math.max(...samples.map(([sampleX, sampleZ]) => terrainHeightAt(CampusData.terrain, sampleX, sampleZ)));
}

function applyTerrainOffsets(items) {
  items.forEach(([model, anchor]) => {
    if (model?.root?.position) {
      model.root.position.y += terrainBaseHeightForModel(model, anchor);
    }
  });
}

function createScene(engine, canvas) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.62, 0.78, 0.75, 1);
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-11.5, 7.2, -18.5), scene);
  camera.setTarget(new BABYLON.Vector3(-1.5, 1.2, -4.5));
  camera.attachControl(canvas, true);
  camera.speed = 0.55;
  camera.angularSensibility = 4200;
  camera.keysUp.push(87);
  camera.keysDown.push(83);
  camera.keysLeft.push(65);
  camera.keysRight.push(68);
  const hemi = new BABYLON.HemisphericLight("sky-light", new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.82;
  const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -0.85, 0.35), scene);
  sun.position.set(10, 12, -8);
  sun.intensity = 1.1;
  const materials = createMaterials(scene);
  createCampusContext(scene, materials);
  createRoadNetwork(scene, materials, CampusData.roadNetwork);
  createWorldScaleRuler(scene, materials, CampusData.scale);
  const janggong = JanggongModel.createJanggongModel(scene, materials);
  const pilheon = PilheonModel.createPilheonModel(scene, materials);
  const manwoo = ManwooModel.createManwooModel(scene, materials);
  const shalom = ShalomModel.createShalomModel(scene, materials);
  const immanuel = ImmanuelModel.createImmanuelModel(scene, materials);
  const gyeongsam = GyeongsamModel.createGyeongsamModel(scene, materials);
  const songam = SongamModel.createSongamModel(scene, materials);
  const sotong = SotongModel.createSotongModel(scene, materials);
  const practice = PracticeModel.createPracticeModel(scene, materials);
  const hanul = HanulModel.createHanulModel(scene, materials);
  const seongbin = SeongbinModel.createSeongbinModel(scene, materials);
  const saerom = SaeromModel.createSaeromModel(scene, materials);
  const haeoreum = HaeoreumModel.createHaeoreumModel(scene, materials);
  const joonha = JoonhaModel.createJoonhaModel(scene, materials);
  const neutbom = NeutbomModel.createNeutbomModel(scene, materials);
  const childcare = ChildcareModel.createChildcareModel(scene, materials);
  applyTerrainOffsets([
    [janggong, CampusData.campusBoundary.anchors.janggong],
    [pilheon, CampusData.campusBoundary.anchors.pilheon],
    [manwoo, CampusData.campusBoundary.anchors.manwoo],
    [shalom, CampusData.campusBoundary.anchors.shalom],
    [immanuel, CampusData.campusBoundary.anchors.immanuel],
    [gyeongsam, CampusData.campusBoundary.anchors.gyeongsam],
    [songam, CampusData.campusBoundary.anchors.songam],
    [sotong, CampusData.campusBoundary.anchors.sotong],
    [practice, CampusData.campusBoundary.anchors.practice],
    [hanul, CampusData.campusBoundary.anchors.hanul],
    [seongbin, CampusData.campusBoundary.anchors.dormitory],
    [saerom, CampusData.campusBoundary.anchors.saerom],
    [haeoreum, CampusData.campusBoundary.anchors.haeoreum],
    [joonha, CampusData.campusBoundary.anchors.joonha],
    [neutbom, CampusData.campusBoundary.anchors.neutbom],
    [childcare, CampusData.campusBoundary.anchors.childcare]
  ]);
  // Entrance vectors are kept in the data layer, but not drawn by default because
  // they create many short surface lines around dense building clusters.
  const focusJanggong = () => {
    camera.position.set(-11.5, 7.2, -18.5);
    camera.setTarget(new BABYLON.Vector3(-1.5, 1.2, -4.5));
  };
  const focusAt = (anchor) => () => {
    const [x, z] = anchor;
    const groundY = terrainHeightAt(CampusData.terrain, x, z);
    camera.position.set(x - 8.5, groundY + 6.8, z - 11.5);
    camera.setTarget(new BABYLON.Vector3(x, groundY + 1.2, z));
  };
  const hud = CampusHud.createHud(scene, camera, CampusData.campusInfo, CampusData.confirmedBuildings, CampusData.janggongResearch, focusJanggong);
  [
    [janggong.main, "1동 장공관"],
    [pilheon.main, "2동 필헌관"],
    [manwoo.main, "3동 만우관"],
    [shalom.hall, "4동 샬롬채플관"],
    [immanuel.main, "5동 임마누엘관"],
    [gyeongsam.main, "6동 경삼관"],
    [songam.hall, "7동 송암관"],
    [sotong.main, "8동 소통관"],
    [practice.main, "9동 실습동"],
    [hanul.hall, "10동 한울관"],
    [seongbin.newDorm, "11동 성빈학사"],
    [saerom.mediaHall, "14동 새롬터"],
    [haeoreum.main, "17동 해오름관"],
    [joonha.main, "18동 장준하통일관"],
    [neutbom.main, "20동 늦봄관"],
    [childcare.main, "21동 한신어린이집"]
  ].forEach(([mesh, label]) => hud.labelForMesh(mesh, label));
  [
    [janggong.main, CampusData.janggongInterior, focusJanggong],
    [pilheon.main, CampusData.pilheonInterior, focusAt(CampusData.campusBoundary.anchors.pilheon)],
    [manwoo.main, CampusData.manwooInterior, focusAt(CampusData.campusBoundary.anchors.manwoo)],
    [shalom.hall, CampusData.shalomInterior, focusAt(CampusData.campusBoundary.anchors.shalom)],
    [immanuel.main, CampusData.immanuelInterior, focusAt(CampusData.campusBoundary.anchors.immanuel)],
    [gyeongsam.main, CampusData.gyeongsamInterior, focusAt(CampusData.campusBoundary.anchors.gyeongsam)],
    [songam.hall, CampusData.songamInterior, focusAt(CampusData.campusBoundary.anchors.songam)],
    [sotong.main, CampusData.sotongInterior, focusAt(CampusData.campusBoundary.anchors.sotong)],
    [practice.main, CampusData.practiceInterior, focusAt(CampusData.campusBoundary.anchors.practice)],
    [hanul.hall, CampusData.hanulInterior, focusAt(CampusData.campusBoundary.anchors.hanul)],
    [seongbin.newDorm, CampusData.seongbinInterior, focusAt(CampusData.campusBoundary.anchors.dormitory)],
    [saerom.mediaHall, CampusData.saeromInterior, focusAt(CampusData.campusBoundary.anchors.saerom)],
    [haeoreum.main, CampusData.haeoreumInterior, focusAt(CampusData.campusBoundary.anchors.haeoreum)],
    [joonha.main, CampusData.joonhaInterior, focusAt(CampusData.campusBoundary.anchors.joonha)],
    [neutbom.main, CampusData.neutbomInterior, focusAt(CampusData.campusBoundary.anchors.neutbom)],
    [childcare.main, CampusData.childcareInterior, focusAt(CampusData.campusBoundary.anchors.childcare)]
  ].forEach(([mesh, interior, focus]) => {
    if (interior) hud.registerInterior(mesh, interior, focus);
  });
  return scene;
}

const canvas = document.getElementById("renderCanvas");
if (!canvas) {
  throw new Error("renderCanvas를 찾을 수 없습니다.");
}
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = createScene(engine, canvas);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
