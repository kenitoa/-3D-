// Compiled JavaScript from haeoreum.ts. Keep edits in the TypeScript source first.
window.HaeoreumModel = window.HaeoreumModel || {};

function haeoreumBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addHaeoreumClassWindows(scene, root, materials) {
  [0.9, 1.55, 2.2].forEach((y, floor) => {
    for (let i = 0; i < 8; i += 1) {
      haeoreumBox({
        name: `haeoreum-classroom-window-${floor}-${i}`,
        size: { width: 0.22, height: 0.32, depth: 0.055 },
        position: { x: -2.05 + i * 0.54, y, z: -1.47 },
        material: materials.haeoreumWindow,
        scene,
        parent: root
      });
    }
  });
}

function addHaeoreumLabSideWindows(scene, root, materials) {
  [1.1, 1.78, 2.46].forEach((y, row) => {
    for (let i = 0; i < 4; i += 1) {
      haeoreumBox({
        name: `haeoreum-psychild-lab-side-window-${row}-${i}`,
        size: { width: 0.055, height: 0.32, depth: 0.22 },
        position: { x: 3.08, y, z: -0.72 + i * 0.46 },
        material: materials.haeoreumWindow,
        scene,
        parent: root
      });
    }
  });
}

window.HaeoreumModel.createHaeoreumModel = function createHaeoreumModel(scene, materials) {
  const root = new BABYLON.TransformNode("haeoreum-root", scene);
  root.position.set(26.4, 0, -12.2);
  const main = haeoreumBox({
    name: "haeoreum-third-lecture-main",
    size: { width: 5.65, height: 2.75, depth: 2.55 },
    position: { x: 0, y: 1.375, z: -0.18 },
    material: materials.haeoreumWall,
    scene,
    parent: root
  });
  const labWing = haeoreumBox({
    name: "haeoreum-psychild-lab-east-wing",
    size: { width: 1.25, height: 2.42, depth: 2.1 },
    position: { x: 2.82, y: 1.21, z: -0.05 },
    material: materials.haeoreumSideWall,
    scene,
    parent: root
  });
  const firstFloorService = haeoreumBox({
    name: "haeoreum-1f-post-health-service-band",
    size: { width: 2.15, height: 0.72, depth: 0.08 },
    position: { x: -1.22, y: 0.55, z: -1.5 },
    material: materials.haeoreumService,
    scene,
    parent: root
  });
  const loungeGlass = haeoreumBox({
    name: "haeoreum-1f-student-lounge-glass",
    size: { width: 1.18, height: 0.62, depth: 0.08 },
    position: { x: 1.42, y: 0.52, z: -1.51 },
    material: materials.haeoreumGlass,
    scene,
    parent: root
  });
  const labBand = haeoreumBox({
    name: "haeoreum-2f-psychild-lab-band",
    size: { width: 2.55, height: 0.42, depth: 0.07 },
    position: { x: 0.42, y: 1.82, z: -1.52 },
    material: materials.haeoreumGlass,
    scene,
    parent: root
  });
  const roof = haeoreumBox({
    name: "haeoreum-flat-lecture-roof",
    size: { width: 6.04, height: 0.2, depth: 2.86 },
    position: { x: 0, y: 2.86, z: -0.18 },
    material: materials.haeoreumRoof,
    scene,
    parent: root
  });
  const stairCore = haeoreumBox({
    name: "haeoreum-west-stair-core",
    size: { width: 0.78, height: 2.98, depth: 2.72 },
    position: { x: -3.18, y: 1.49, z: -0.18 },
    material: materials.haeoreumCore,
    scene,
    parent: root
  });
  const roofMachine = haeoreumBox({
    name: "haeoreum-roof-machine-room",
    size: { width: 0.82, height: 0.34, depth: 0.54 },
    position: { x: -1.72, y: 3.13, z: 0.42 },
    material: materials.stone,
    scene,
    parent: root
  });
  const entranceCanopy = haeoreumBox({
    name: "haeoreum-front-entry-canopy",
    size: { width: 2.0, height: 0.14, depth: 0.72 },
    position: { x: 1.16, y: 1.08, z: -1.8 },
    material: materials.haeoreumRoof,
    scene,
    parent: root
  });
  const base = haeoreumBox({
    name: "haeoreum-raised-lecture-base",
    size: { width: 6.38, height: 0.22, depth: 3.05 },
    position: { x: -0.15, y: 0.11, z: -0.18 },
    material: materials.haeoreumBase,
    scene,
    parent: root
  });
  addHaeoreumClassWindows(scene, root, materials);
  addHaeoreumLabSideWindows(scene, root, materials);
  for (let i = 0; i < 4; i += 1) {
    haeoreumBox({
      name: `haeoreum-entry-step-${i}`,
      size: { width: 2.35 - i * 0.2, height: 0.05, depth: 0.3 },
      position: { x: 1.16, y: 0.035 + i * 0.045, z: -2.08 - i * 0.18 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  const frontPlaza = BABYLON.MeshBuilder.CreateGround("haeoreum-front-plaza", { width: 6.55, height: 2.65 }, scene);
  frontPlaza.position.set(-0.05, 0.023, -2.2);
  frontPlaza.material = materials.plaza;
  frontPlaza.parent = root;
  const serviceWalk = BABYLON.MeshBuilder.CreateGround("haeoreum-service-walkway", { width: 6.1, height: 0.86 }, scene);
  serviceWalk.position.set(-0.05, 0.025, -3.28);
  serviceWalk.material = materials.road;
  serviceWalk.parent = root;
  return { root, main, labWing, firstFloorService, loungeGlass, labBand, roof, stairCore, roofMachine, entranceCanopy, base, frontPlaza, serviceWalk };
};
