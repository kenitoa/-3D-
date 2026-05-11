// Compiled JavaScript from practice.ts. Keep edits in the TypeScript source first.
window.PracticeModel = window.PracticeModel || {};

function practiceBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addPracticeWindows(scene, root, materials) {
  [0.86, 1.48].forEach((y, row) => {
    for (let i = 0; i < 6; i += 1) {
      practiceBox({
        name: `practice-front-lab-window-${row}-${i}`,
        size: { width: 0.26, height: 0.36, depth: 0.055 },
        position: { x: -1.28 + i * 0.52, y, z: -1.53 },
        material: materials.practiceWindow,
        scene,
        parent: root
      });
    }
  });
  [0.82, 1.42].forEach((y, row) => {
    for (let i = 0; i < 3; i += 1) {
      practiceBox({
        name: `practice-east-startup-window-${row}-${i}`,
        size: { width: 0.055, height: 0.34, depth: 0.24 },
        position: { x: 2.36, y, z: -0.58 + i * 0.46 },
        material: materials.practiceWindow,
        scene,
        parent: root
      });
    }
  });
}

window.PracticeModel.createPracticeModel = function createPracticeModel(scene, materials) {
  const root = new BABYLON.TransformNode("practice-root", scene);
  root.position.set(49.2, 0, -8.7);
  const main = practiceBox({
    name: "practice-building-workshop-main",
    size: { width: 4.2, height: 1.85, depth: 2.45 },
    position: { x: 0, y: 0.925, z: -0.28 },
    material: materials.practiceWall,
    scene,
    parent: root
  });
  const startupWing = practiceBox({
    name: "practice-startup-support-wing",
    size: { width: 1.28, height: 1.48, depth: 1.68 },
    position: { x: 2.08, y: 0.74, z: 0.18 },
    material: materials.practiceSideWall,
    scene,
    parent: root
  });
  const serviceBay = practiceBox({
    name: "practice-equipment-loading-bay",
    size: { width: 1.18, height: 0.78, depth: 0.08 },
    position: { x: -1.32, y: 0.48, z: -1.54 },
    material: materials.practiceDoor,
    scene,
    parent: root
  });
  const entryGlass = practiceBox({
    name: "practice-startup-office-glass-entry",
    size: { width: 0.82, height: 0.62, depth: 0.08 },
    position: { x: 0.72, y: 0.47, z: -1.55 },
    material: materials.practiceGlass,
    scene,
    parent: root
  });
  const roof = practiceBox({
    name: "practice-low-flat-roof",
    size: { width: 4.58, height: 0.18, depth: 2.72 },
    position: { x: 0, y: 1.94, z: -0.28 },
    material: materials.practiceRoof,
    scene,
    parent: root
  });
  const startupRoof = practiceBox({
    name: "practice-startup-wing-roof",
    size: { width: 1.48, height: 0.16, depth: 1.88 },
    position: { x: 2.08, y: 1.56, z: 0.18 },
    material: materials.practiceRoof,
    scene,
    parent: root
  });
  const roofVent = practiceBox({
    name: "practice-roof-vent-machine",
    size: { width: 0.62, height: 0.28, depth: 0.52 },
    position: { x: -0.78, y: 2.17, z: 0.48 },
    material: materials.stone,
    scene,
    parent: root
  });
  const exhaust = practiceBox({
    name: "practice-lab-exhaust-stack",
    size: { width: 0.18, height: 0.72, depth: 0.18 },
    position: { x: -1.62, y: 2.34, z: 0.52 },
    material: materials.practiceTrim,
    scene,
    parent: root
  });
  const frontTrim = practiceBox({
    name: "practice-front-horizontal-trim",
    size: { width: 4.36, height: 0.07, depth: 0.08 },
    position: { x: 0, y: 1.18, z: -1.52 },
    material: materials.practiceTrim,
    scene,
    parent: root
  });
  const base = practiceBox({
    name: "practice-raised-concrete-base",
    size: { width: 4.82, height: 0.22, depth: 2.98 },
    position: { x: 0.12, y: 0.11, z: -0.3 },
    material: materials.practiceBase,
    scene,
    parent: root
  });
  addPracticeWindows(scene, root, materials);
  for (let i = 0; i < 3; i += 1) {
    practiceBox({
      name: `practice-entry-step-${i}`,
      size: { width: 1.58 - i * 0.18, height: 0.05, depth: 0.28 },
      position: { x: 0.72, y: 0.035 + i * 0.045, z: -1.82 - i * 0.19 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  const serviceYard = BABYLON.MeshBuilder.CreateGround("practice-service-yard", { width: 5.35, height: 3.05 }, scene);
  serviceYard.position.set(0.04, 0.022, -1.72);
  serviceYard.material = materials.plaza;
  serviceYard.parent = root;
  const accessRoad = BABYLON.MeshBuilder.CreateGround("practice-east-access-road", { width: 6.2, height: 1.08 }, scene);
  accessRoad.position.set(0.4, 0.024, -2.72);
  accessRoad.material = materials.road;
  accessRoad.parent = root;
  return { root, main, startupWing, serviceBay, entryGlass, roof, startupRoof, roofVent, exhaust, frontTrim, base, serviceYard, accessRoad };
};
