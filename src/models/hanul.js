// Compiled JavaScript from hanul.ts. Keep edits in the TypeScript source first.
window.HanulModel = window.HanulModel || {};

function hanulBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addHanulHighWindows(scene, root, materials) {
  [-2.8, -1.85, -0.9, 0.9, 1.85, 2.8].forEach((x, i) => {
    hanulBox({
      name: `hanul-upper-gym-window-${i}`,
      size: { width: 0.38, height: 0.72, depth: 0.07 },
      position: { x, y: 2.45, z: -2.63 },
      material: materials.hanulWindow,
      scene,
      parent: root
    });
  });
  [0.92, 1.62, 2.32].forEach((y, row) => {
    for (let i = 0; i < 4; i += 1) {
      hanulBox({
        name: `hanul-east-service-window-${row}-${i}`,
        size: { width: 0.07, height: 0.34, depth: 0.28 },
        position: { x: 4.34, y, z: -1.05 + i * 0.62 },
        material: materials.hanulWindow,
        scene,
        parent: root
      });
    }
  });
}

function addHanulBleacherSteps(scene, root, materials) {
  for (let i = 0; i < 5; i += 1) {
    hanulBox({
      name: `hanul-front-broad-step-${i}`,
      size: { width: 6.45 - i * 0.42, height: 0.055, depth: 0.34 },
      position: { x: -0.35, y: 0.04 + i * 0.05, z: -3.05 - i * 0.24 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
}

window.HanulModel.createHanulModel = function createHanulModel(scene, materials) {
  const root = new BABYLON.TransformNode("hanul-root", scene);
  root.position.set(-34.2, 0, 2.4);
  const hall = hanulBox({
    name: "hanul-gymnasium-main-hall",
    size: { width: 7.55, height: 3.28, depth: 4.75 },
    position: { x: 0, y: 1.64, z: -0.2 },
    material: materials.hanulWall,
    scene,
    parent: root
  });
  const westLocker = hanulBox({
    name: "hanul-locker-office-west-wing",
    size: { width: 1.48, height: 2.18, depth: 3.65 },
    position: { x: -4.08, y: 1.09, z: -0.1 },
    material: materials.hanulSideWall,
    scene,
    parent: root
  });
  const eastService = hanulBox({
    name: "hanul-equipment-service-east-wing",
    size: { width: 1.22, height: 2.52, depth: 3.2 },
    position: { x: 4.15, y: 1.26, z: -0.02 },
    material: materials.hanulSideWall,
    scene,
    parent: root
  });
  const frontLobby = hanulBox({
    name: "hanul-front-entry-lobby",
    size: { width: 3.35, height: 1.22, depth: 0.78 },
    position: { x: -0.35, y: 0.61, z: -2.82 },
    material: materials.hanulGlass,
    scene,
    parent: root
  });
  const canopy = hanulBox({
    name: "hanul-entry-canopy",
    size: { width: 4.15, height: 0.16, depth: 1.0 },
    position: { x: -0.35, y: 1.3, z: -3.02 },
    material: materials.hanulRoof,
    scene,
    parent: root
  });
  const roof = hanulBox({
    name: "hanul-broad-light-roof",
    size: { width: 8.25, height: 0.24, depth: 5.2 },
    position: { x: 0, y: 3.4, z: -0.2 },
    material: materials.hanulRoof,
    scene,
    parent: root
  });
  const roofCrown = hanulBox({
    name: "hanul-center-raised-roof-crown",
    size: { width: 5.6, height: 0.34, depth: 1.1 },
    position: { x: 0, y: 3.65, z: -0.2 },
    material: materials.hanulRoofRidge,
    scene,
    parent: root
  });
  const skylight = hanulBox({
    name: "hanul-long-skylight-band",
    size: { width: 4.85, height: 0.08, depth: 0.42 },
    position: { x: 0, y: 3.85, z: -0.2 },
    material: materials.hanulGlass,
    scene,
    parent: root
  });
  const base = hanulBox({
    name: "hanul-raised-athletic-base",
    size: { width: 8.75, height: 0.24, depth: 5.45 },
    position: { x: 0, y: 0.12, z: -0.2 },
    material: materials.hanulBase,
    scene,
    parent: root
  });
  const frontTrim = hanulBox({
    name: "hanul-front-horizontal-band",
    size: { width: 7.72, height: 0.08, depth: 0.09 },
    position: { x: 0, y: 1.95, z: -2.62 },
    material: materials.hanulTrim,
    scene,
    parent: root
  });
  addHanulHighWindows(scene, root, materials);
  addHanulBleacherSteps(scene, root, materials);
  const eventPlaza = BABYLON.MeshBuilder.CreateGround("hanul-stadium-side-event-plaza", { width: 9.4, height: 4.35 }, scene);
  eventPlaza.position.set(-0.25, 0.024, -3.78);
  eventPlaza.material = materials.plaza;
  eventPlaza.parent = root;
  const stadiumWalk = BABYLON.MeshBuilder.CreateGround("hanul-stadium-walkway", { width: 10.2, height: 1.16 }, scene);
  stadiumWalk.position.set(-0.2, 0.026, 2.68);
  stadiumWalk.material = materials.road;
  stadiumWalk.parent = root;
  return { root, hall, westLocker, eastService, frontLobby, canopy, roof, roofCrown, skylight, base, frontTrim, eventPlaza, stadiumWalk };
};
