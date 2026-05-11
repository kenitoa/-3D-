// Compiled JavaScript from manwoo.ts. Keep edits in the TypeScript source first.
window.ManwooModel = window.ManwooModel || {};

function manwooBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addManwooWindowRow(scene, parent, material, y, z, count, span) {
  const gap = span / count;
  for (let i = 0; i < count; i += 1) {
    manwooBox({
      name: `manwoo-window-${y}-${i}`,
      size: { width: 0.18, height: 0.28, depth: 0.04 },
      position: { x: -span / 2 + i * gap + gap / 2, y, z },
      material,
      scene,
      parent
    });
  }
}

function addManwooExteriorCorridors(scene, root, materials) {
  [0.9, 1.55, 2.2, 2.85].forEach((y, index) => {
    manwooBox({
      name: `manwoo-exterior-corridor-${index + 1}f`,
      size: { width: 7.55, height: 0.055, depth: 0.18 },
      position: { x: -16.2, y, z: -11.86 },
      material: materials.trim,
      scene,
      parent: root
    });
  });
}

function addManwooStairTower(scene, root, materials, x, z, suffix) {
  const tower = manwooBox({
    name: `manwoo-exterior-stair-${suffix}`,
    size: { width: 0.62, height: 3.65, depth: 0.75 },
    position: { x, y: 1.825, z },
    material: materials.manwooStair,
    scene,
    parent: root
  });
  for (let i = 0; i < 6; i += 1) {
    manwooBox({
      name: `manwoo-stair-landing-${suffix}-${i}`,
      size: { width: 0.86, height: 0.06, depth: 0.52 },
      position: { x, y: 0.35 + i * 0.58, z: z - 0.45 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  return tower;
}

window.ManwooModel.createManwooModel = function createManwooModel(scene, materials) {
  const root = new BABYLON.TransformNode("manwoo-root", scene);
  root.position.set(8.7, 0, -1.2);
  const main = manwooBox({
    name: "manwoo-main-long-classroom-body",
    size: { width: 8.8, height: 3.75, depth: 2.05 },
    position: { x: -16.2, y: 1.875, z: -10.75 },
    material: materials.manwooWall,
    scene,
    parent: root
  });
  const westWing = manwooBox({
    name: "manwoo-west-old-wing",
    size: { width: 2.15, height: 2.7, depth: 2.45 },
    position: { x: -21.55, y: 1.35, z: -10.45 },
    material: materials.manwooSideWall,
    scene,
    parent: root
  });
  const southWing = manwooBox({
    name: "manwoo-south-offset-wing",
    size: { width: 3.0, height: 2.25, depth: 1.65 },
    position: { x: -18.0, y: 1.125, z: -13.35 },
    material: materials.manwooSideWall,
    scene,
    parent: root
  });
  const roof = manwooBox({
    name: "manwoo-aged-flat-roof",
    size: { width: 9.2, height: 0.18, depth: 2.36 },
    position: { x: -16.2, y: 3.86, z: -10.75 },
    material: materials.manwooRoof,
    scene,
    parent: root
  });
  addManwooExteriorCorridors(scene, root, materials);
  addManwooWindowRow(scene, main, materials.window, -1.18, -1.05, 15, 8.0);
  addManwooWindowRow(scene, main, materials.window, -0.52, -1.05, 15, 8.0);
  addManwooWindowRow(scene, main, materials.window, 0.14, -1.05, 12, 6.4);
  addManwooWindowRow(scene, main, materials.window, 0.8, -1.05, 12, 6.4);
  addManwooWindowRow(scene, westWing, materials.window, -0.45, -1.25, 4, 1.55);
  const westStair = addManwooStairTower(scene, root, materials, -21.95, -12.25, "west");
  const eastStair = addManwooStairTower(scene, root, materials, -11.95, -12.25, "east");
  const plaza = BABYLON.MeshBuilder.CreateGround("manwoo-front-paved-yard", { width: 8.9, height: 2.62 }, scene);
  plaza.position.set(-16.2, 0.021, -13.22);
  plaza.material = materials.plaza;
  plaza.parent = root;
  return {
    root,
    main,
    westWing,
    southWing,
    roof,
    westStair,
    eastStair,
    plaza
  };
};
