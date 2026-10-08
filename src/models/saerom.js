// Generated from src/models/saerom.ts; run npm run build.
(() => {
  window.SaeromModel = window.SaeromModel || {};
  function saeromBox({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function addSaeromWindows(scene, root, materials) {
    for (let i = 0; i < 5; i += 1) {
      saeromBox({
        name: `saerom-media-lab-window-${i}`,
        size: { width: 0.28, height: 0.34, depth: 0.055 },
        position: { x: -1.22 + i * 0.48, y: 0.88, z: -1.28 },
        material: materials.saeromWindow,
        scene,
        parent: root
      });
    }
    for (let i = 0; i < 4; i += 1) {
      saeromBox({
        name: `saerom-cafe-terrace-window-${i}`,
        size: { width: 0.34, height: 0.42, depth: 0.06 },
        position: { x: -0.82 + i * 0.56, y: 1.62, z: -1.29 },
        material: materials.saeromGlass,
        scene,
        parent: root
      });
    }
  }
  window.SaeromModel.createSaeromModel = function createSaeromModel(scene, materials) {
    const root = new BABYLON.TransformNode("saerom-root", scene);
    root.position.set(18.3, 0, -12);
    const mediaHall = saeromBox({
      name: "saerom-1f-media-culture-hall",
      size: { width: 3.55, height: 1.2, depth: 2.35 },
      position: { x: 0, y: 0.6, z: -0.12 },
      material: materials.saeromWall,
      scene,
      parent: root
    });
    const cafeUpper = saeromBox({
      name: "saerom-2f-cafe-volume",
      size: { width: 3.15, height: 0.96, depth: 1.84 },
      position: { x: 0.18, y: 1.68, z: -0.22 },
      material: materials.saeromCafeWall,
      scene,
      parent: root
    });
    const terrace = saeromBox({
      name: "saerom-cafe-outdoor-terrace",
      size: { width: 2.65, height: 0.12, depth: 0.88 },
      position: { x: 0.12, y: 1.23, z: -1.72 },
      material: materials.saeromTerrace,
      scene,
      parent: root
    });
    const entrance = saeromBox({
      name: "saerom-media-hall-glass-entry",
      size: { width: 1.08, height: 0.68, depth: 0.08 },
      position: { x: -1.02, y: 0.48, z: -1.31 },
      material: materials.saeromGlass,
      scene,
      parent: root
    });
    const cafeSignBand = saeromBox({
      name: "saerom-cafe-signage-band",
      size: { width: 2.6, height: 0.28, depth: 0.07 },
      position: { x: 0.32, y: 2.07, z: -1.31 },
      material: materials.saeromAccent,
      scene,
      parent: root
    });
    const roof = saeromBox({
      name: "saerom-low-flat-roof",
      size: { width: 3.78, height: 0.18, depth: 2.58 },
      position: { x: 0, y: 2.22, z: -0.12 },
      material: materials.saeromRoof,
      scene,
      parent: root
    });
    const cafeCanopy = saeromBox({
      name: "saerom-cafe-front-canopy",
      size: { width: 3.12, height: 0.12, depth: 0.72 },
      position: { x: 0.16, y: 1.36, z: -1.64 },
      material: materials.saeromRoof,
      scene,
      parent: root
    });
    const base = saeromBox({
      name: "saerom-raised-park-base",
      size: { width: 4.05, height: 0.2, depth: 2.82 },
      position: { x: 0, y: 0.1, z: -0.12 },
      material: materials.saeromBase,
      scene,
      parent: root
    });
    addSaeromWindows(scene, root, materials);
    for (let i = 0; i < 3; i += 1) {
      saeromBox({
        name: `saerom-entry-step-${i}`,
        size: { width: 1.74 - i * 0.18, height: 0.05, depth: 0.28 },
        position: { x: -1.02, y: 0.035 + i * 0.045, z: -1.58 - i * 0.18 },
        material: materials.stone,
        scene,
        parent: root
      });
    }
    const parkPlaza = BABYLON.MeshBuilder.CreateGround("saerom-hanshin-park-plaza", { width: 4.2, height: 2.55 }, scene);
    parkPlaza.position.set(0, 0.023, -1.45);
    parkPlaza.material = materials.plaza;
    parkPlaza.parent = root;
    const cafePath = BABYLON.MeshBuilder.CreateGround("saerom-cafe-approach-path", { width: 4.25, height: 0.8 }, scene);
    cafePath.position.set(0.12, 0.025, -2.42);
    cafePath.material = materials.road;
    cafePath.parent = root;
    return { root, mediaHall, cafeUpper, terrace, entrance, cafeSignBand, roof, cafeCanopy, base, parkPlaza, cafePath };
  };
})();
