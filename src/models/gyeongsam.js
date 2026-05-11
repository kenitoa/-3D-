// Compiled JavaScript from gyeongsam.ts. Keep edits in the TypeScript source first.
window.GyeongsamModel = window.GyeongsamModel || {};

function gyeongsamBox({ name, size, position, material, scene, parent }) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addGyeongsamWindowRow(scene, root, materials, y, z, count, span, suffix) {
  const gap = span / count;
  for (let i = 0; i < count; i += 1) {
    gyeongsamBox({
      name: `gyeongsam-library-window-${suffix}-${i}`,
      size: { width: 0.22, height: 0.34, depth: 0.055 },
      position: { x: 8.4 - span / 2 + gap * i + gap / 2, y, z },
      material: materials.gyeongsamWindow,
      scene,
      parent: root
    });
  }
}

function addGyeongsamFloorLines(scene, root, materials) {
  [0.92, 1.58, 2.24, 2.9].forEach((y, index) => {
    gyeongsamBox({
      name: `gyeongsam-horizontal-slab-line-${index}`,
      size: { width: 6.55, height: 0.055, depth: 0.08 },
      position: { x: 8.4, y, z: -2.42 },
      material: materials.gyeongsamTrim,
      scene,
      parent: root
    });
  });
}

window.GyeongsamModel.createGyeongsamModel = function createGyeongsamModel(scene, materials) {
  const root = new BABYLON.TransformNode("gyeongsam-root", scene);
  root.position.set(9.8, 0, 1.35);
  const main = gyeongsamBox({
    name: "gyeongsam-central-library-main",
    size: { width: 6.25, height: 3.05, depth: 2.85 },
    position: { x: 8.4, y: 1.525, z: -0.95 },
    material: materials.gyeongsamWall,
    scene,
    parent: root
  });
  const eastLobby = gyeongsamBox({
    name: "gyeongsam-east-wing-first-floor-lobby",
    size: { width: 1.35, height: 1.15, depth: 2.35 },
    position: { x: 12.08, y: 0.575, z: -1.0 },
    material: materials.gyeongsamLobbyWall,
    scene,
    parent: root
  });
  const rearStack = gyeongsamBox({
    name: "gyeongsam-rear-book-stack-volume",
    size: { width: 4.15, height: 2.32, depth: 1.12 },
    position: { x: 7.65, y: 1.16, z: 1.05 },
    material: materials.gyeongsamSideWall,
    scene,
    parent: root
  });
  const roof = gyeongsamBox({
    name: "gyeongsam-wide-flat-roof",
    size: { width: 6.7, height: 0.2, depth: 3.18 },
    position: { x: 8.4, y: 3.16, z: -0.95 },
    material: materials.gyeongsamRoof,
    scene,
    parent: root
  });
  const atriumGlass = gyeongsamBox({
    name: "gyeongsam-front-central-glass-atrium",
    size: { width: 1.52, height: 1.92, depth: 0.08 },
    position: { x: 8.4, y: 1.33, z: -2.43 },
    material: materials.gyeongsamGlass,
    scene,
    parent: root
  });
  const cultureLounge = gyeongsamBox({
    name: "gyeongsam-1f-culture-lounge",
    size: { width: 1.25, height: 0.48, depth: 0.075 },
    position: { x: 6.18, y: 0.62, z: -2.45 },
    material: materials.gyeongsamLounge,
    scene,
    parent: root
  });
  const studentCenter = gyeongsamBox({
    name: "gyeongsam-2f-student-counseling-rights-center",
    size: { width: 1.18, height: 0.44, depth: 0.075 },
    position: { x: 10.78, y: 1.36, z: -2.45 },
    material: materials.gyeongsamLounge,
    scene,
    parent: root
  });
  const makerspace = gyeongsamBox({
    name: "gyeongsam-4f-makerspace-gallery-band",
    size: { width: 2.05, height: 0.44, depth: 0.075 },
    position: { x: 8.4, y: 2.65, z: -2.45 },
    material: materials.gyeongsamTopGlass,
    scene,
    parent: root
  });
  const eastLobbyGlass = gyeongsamBox({
    name: "gyeongsam-east-wing-lobby-glass",
    size: { width: 0.08, height: 0.78, depth: 1.25 },
    position: { x: 12.78, y: 0.78, z: -1.0 },
    material: materials.gyeongsamGlass,
    scene,
    parent: root
  });
  addGyeongsamFloorLines(scene, root, materials);
  addGyeongsamWindowRow(scene, root, materials, 1.3, -2.46, 8, 5.4, "second-floor");
  addGyeongsamWindowRow(scene, root, materials, 1.96, -2.46, 8, 5.4, "third-floor");
  addGyeongsamWindowRow(scene, root, materials, 2.62, -2.46, 6, 4.2, "fourth-floor");
  for (let i = 0; i < 3; i += 1) {
    gyeongsamBox({
      name: `gyeongsam-front-step-${i}`,
      size: { width: 2.9 - i * 0.3, height: 0.06, depth: 0.32 },
      position: { x: 8.4, y: 0.04 + i * 0.05, z: -2.9 - i * 0.22 },
      material: materials.stone,
      scene,
      parent: root
    });
  }
  const busStop = gyeongsamBox({
    name: "gyeongsam-front-bus-stop-shelter",
    size: { width: 1.25, height: 0.12, depth: 0.34 },
    position: { x: 11.25, y: 0.34, z: -3.52 },
    material: materials.gyeongsamTopGlass,
    scene,
    parent: root
  });
  gyeongsamBox({
    name: "gyeongsam-bus-stop-post",
    size: { width: 0.08, height: 0.62, depth: 0.08 },
    position: { x: 10.74, y: 0.31, z: -3.5 },
    material: materials.column,
    scene,
    parent: root
  });
  const plaza = BABYLON.MeshBuilder.CreateGround("gyeongsam-library-front-plaza", { width: 7.2, height: 2.65 }, scene);
  plaza.position.set(8.4, 0.023, -3.42);
  plaza.material = materials.plaza;
  plaza.parent = root;
  return { root, main, eastLobby, rearStack, roof, atriumGlass, cultureLounge, studentCenter, makerspace, eastLobbyGlass, busStop, plaza };
};
