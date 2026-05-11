// Compiled JavaScript from immanuel.ts. Keep edits in the TypeScript source first.
window.ImmanuelModel = window.ImmanuelModel || {};

function immanuelBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addImmanuelClubWindows(scene, root, materials, y, z, suffix) {
  for (let i = 0; i < 8; i += 1) {
    immanuelBox({
      name: `immanuel-club-window-${suffix}-${i}`,
      size: { width: 0.22, height: 0.38, depth: 0.055 },
      position: { x: -5.3 + i * 0.47, y, z },
      material: materials.immanuelClubGlass,
      scene,
      parent: root
    });
  }
}

function addImmanuelRoofUnits(scene, root, materials) {
  immanuelBox({
    name: "immanuel-rooftop-mechanical-room",
    size: { width: 1.05, height: 0.34, depth: 0.74 },
    position: { x: -2.08, y: 2.92, z: -9.36 },
    material: materials.immanuelBase,
    scene,
    parent: root
  });
  immanuelBox({
    name: "immanuel-rooftop-water-tank",
    size: { width: 0.58, height: 0.24, depth: 0.44 },
    position: { x: -5.82, y: 2.86, z: -9.8 },
    material: materials.stone,
    scene,
    parent: root
  });
}

window.ImmanuelModel.createImmanuelModel = function createImmanuelModel(scene, materials) {
  const root = new BABYLON.TransformNode("immanuel-root", scene);
  root.position.set(16.4, 0, -2.55);
  const basement = immanuelBox({
    name: "immanuel-b1-clinic-career-plinth",
    size: { width: 6.4, height: 0.42, depth: 2.62 },
    position: { x: -4.0, y: 0.21, z: -9.45 },
    material: materials.immanuelBase,
    scene,
    parent: root
  });
  const main = immanuelBox({
    name: "immanuel-student-union-main",
    size: { width: 5.76, height: 2.18, depth: 2.22 },
    position: { x: -4.0, y: 1.49, z: -9.45 },
    material: materials.immanuelWall,
    scene,
    parent: root
  });
  const roof = immanuelBox({
    name: "immanuel-flat-roof",
    size: { width: 6.08, height: 0.22, depth: 2.46 },
    position: { x: -4.0, y: 2.69, z: -9.45 },
    material: materials.immanuelRoof,
    scene,
    parent: root
  });
  const cafeteria = immanuelBox({
    name: "immanuel-1f-cafeteria-hall-glass",
    size: { width: 3.35, height: 0.58, depth: 0.08 },
    position: { x: -4.95, y: 0.82, z: -10.58 },
    material: materials.immanuelFoodGlass,
    scene,
    parent: root
  });
  const kitchenBand = immanuelBox({
    name: "immanuel-1f-cafeteria-kitchen-band",
    size: { width: 1.12, height: 0.46, depth: 0.09 },
    position: { x: -6.42, y: 0.82, z: -10.6 },
    material: materials.immanuelKitchen,
    scene,
    parent: root
  });
  const convenienceStore = immanuelBox({
    name: "immanuel-1f-emart24-storefront",
    size: { width: 1.18, height: 0.62, depth: 0.1 },
    position: { x: -2.05, y: 0.84, z: -10.6 },
    material: materials.immanuelStore,
    scene,
    parent: root
  });
  const entrance = immanuelBox({
    name: "immanuel-student-union-entry-canopy",
    size: { width: 2.05, height: 0.14, depth: 0.72 },
    position: { x: -4.0, y: 1.13, z: -10.9 },
    material: materials.immanuelCanopy,
    scene,
    parent: root
  });
  addImmanuelClubWindows(scene, root, materials, 1.52, -10.6, "second-floor");
  addImmanuelClubWindows(scene, root, materials, 2.2, -10.6, "third-floor");
  for (let i = 0; i < 5; i += 1) {
    immanuelBox({
      name: `immanuel-front-step-${i}`,
      size: { width: 2.6 + i * 0.22, height: 0.055, depth: 0.32 },
      position: { x: -4.0, y: 0.04 + i * 0.045, z: -11.25 - i * 0.23 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  immanuelBox({
    name: "immanuel-student-center-sign-band",
    size: { width: 5.96, height: 0.09, depth: 0.08 },
    position: { x: -4.0, y: 1.15, z: -10.61 },
    material: materials.trim,
    scene,
    parent: root
  });
  addImmanuelRoofUnits(scene, root, materials);
  const plaza = BABYLON.MeshBuilder.CreateGround("immanuel-front-student-plaza", { width: 6.9, height: 3.05 }, scene);
  plaza.position.set(-4.0, 0.025, -11.45);
  plaza.material = materials.plaza;
  plaza.parent = root;
  return { root, basement, main, roof, cafeteria, kitchenBand, convenienceStore, entrance, plaza };
};
