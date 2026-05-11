// Compiled JavaScript from shalom.ts. Keep edits in the TypeScript source first.
window.ShalomModel = window.ShalomModel || {};

function shalomBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addShalomVerticalWindows(scene, root, materials, xStart, count) {
  for (let i = 0; i < count; i += 1) {
    shalomBox({
      name: `shalom-tall-nave-window-${i}`,
      size: { width: 0.22, height: 1.12, depth: 0.06 },
      position: { x: xStart + i * 0.56, y: 1.52, z: -5.76 },
      material: materials.shalomGlass,
      scene,
      parent: root
    });
  }
}

function addShalomPitchedRoof(scene, root, materials) {
  const roof = new BABYLON.TransformNode("shalom-pitched-roof", scene);
  roof.parent = root;
  const left = shalomBox({
    name: "shalom-roof-left-slope",
    size: { width: 5.72, height: 0.18, depth: 1.68 },
    position: { x: -22.5, y: 3.04, z: -4.85 },
    material: materials.shalomRoof,
    scene,
    parent: roof
  });
  left.rotation.x = -0.18;
  const right = shalomBox({
    name: "shalom-roof-right-slope",
    size: { width: 5.72, height: 0.18, depth: 1.68 },
    position: { x: -22.5, y: 3.04, z: -3.55 },
    material: materials.shalomRoof,
    scene,
    parent: roof
  });
  right.rotation.x = 0.18;
  shalomBox({
    name: "shalom-roof-ridge",
    size: { width: 5.86, height: 0.14, depth: 0.16 },
    position: { x: -22.5, y: 3.29, z: -4.2 },
    material: materials.shalomRidge,
    scene,
    parent: roof
  });
  return roof;
}

window.ShalomModel.createShalomModel = function createShalomModel(scene, materials) {
  const root = new BABYLON.TransformNode("shalom-root", scene);
  root.position.set(-1.0, 0, 9.0);
  const base = shalomBox({
    name: "shalom-basement-catacomb-plinth",
    size: { width: 6.4, height: 0.42, depth: 3.55 },
    position: { x: -22.5, y: 0.21, z: -4.2 },
    material: materials.shalomPlinth,
    scene,
    parent: root
  });
  const hall = shalomBox({
    name: "shalom-grand-worship-hall",
    size: { width: 5.55, height: 2.15, depth: 2.85 },
    position: { x: -22.5, y: 1.48, z: -4.2 },
    material: materials.shalomWall,
    scene,
    parent: root
  });
  const porch = shalomBox({
    name: "shalom-front-porch",
    size: { width: 2.5, height: 0.92, depth: 0.72 },
    position: { x: -22.5, y: 0.92, z: -6.05 },
    material: materials.shalomPorch,
    scene,
    parent: root
  });
  const office4106 = shalomBox({
    name: "shalom-1f-chaplain-office-4106",
    size: { width: 1.2, height: 0.86, depth: 1.08 },
    position: { x: -19.48, y: 0.86, z: -4.15 },
    material: materials.shalomOffice,
    scene,
    parent: root
  });
  const entranceGlass = shalomBox({
    name: "shalom-main-entry-glass",
    size: { width: 1.42, height: 0.72, depth: 0.08 },
    position: { x: -22.5, y: 0.82, z: -6.45 },
    material: materials.glass,
    scene,
    parent: root
  });
  const stainedGlass = shalomBox({
    name: "shalom-front-stained-glass",
    size: { width: 0.82, height: 1.34, depth: 0.08 },
    position: { x: -22.5, y: 1.88, z: -5.66 },
    material: materials.shalomGlass,
    scene,
    parent: root
  });
  const cross = shalomBox({
    name: "shalom-front-cross-vertical",
    size: { width: 0.12, height: 0.82, depth: 0.08 },
    position: { x: -22.5, y: 2.75, z: -5.72 },
    material: materials.shalomCross,
    scene,
    parent: root
  });
  shalomBox({
    name: "shalom-front-cross-horizontal",
    size: { width: 0.52, height: 0.1, depth: 0.08 },
    position: { x: -22.5, y: 2.88, z: -5.73 },
    material: materials.shalomCross,
    scene,
    parent: root
  });
  addShalomPitchedRoof(scene, root, materials);
  addShalomVerticalWindows(scene, root, materials, -24.15, 7);
  for (let i = 0; i < 4; i += 1) {
    shalomBox({
      name: `shalom-front-step-${i}`,
      size: { width: 2.9 - i * 0.28, height: 0.055, depth: 0.28 },
      position: { x: -22.5, y: 0.04 + i * 0.048, z: -6.62 - i * 0.2 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  const plaza = BABYLON.MeshBuilder.CreateGround("shalom-front-plaza", { width: 6.1, height: 2.62 }, scene);
  plaza.position.set(-22.5, 0.023, -7.02);
  plaza.material = materials.plaza;
  plaza.parent = root;
  return { root, base, hall, porch, office4106, entranceGlass, stainedGlass, cross, plaza };
};
