// Generated from src/models/seongbin.ts; run npm run build.
(() => {
  window.SeongbinModel = window.SeongbinModel || {};
  function seongbinBox({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function addDormWindows(scene, root, materials, prefix, startX, count, z, floors) {
    floors.forEach((y, floor) => {
      for (let i = 0; i < count; i += 1) {
        seongbinBox({
          name: `${prefix}-room-window-${floor}-${i}`,
          size: { width: 0.2, height: 0.3, depth: 0.055 },
          position: { x: startX + i * 0.42, y, z },
          material: materials.seongbinWindow,
          scene,
          parent: root
        });
      }
    });
  }
  function addSideDormWindows(scene, root, materials, prefix, x, startZ, count, floors) {
    floors.forEach((y, floor) => {
      for (let i = 0; i < count; i += 1) {
        seongbinBox({
          name: `${prefix}-side-room-window-${floor}-${i}`,
          size: { width: 0.055, height: 0.3, depth: 0.2 },
          position: { x, y, z: startZ + i * 0.4 },
          material: materials.seongbinWindow,
          scene,
          parent: root
        });
      }
    });
  }
  window.SeongbinModel.createSeongbinModel = function createSeongbinModel(scene, materials) {
    const root = new BABYLON.TransformNode("seongbin-root", scene);
    root.position.set(-47, 0, 11);
    const newDorm = seongbinBox({
      name: "seongbin-new-dormitory-left-building",
      size: { width: 3, height: 3.45, depth: 2.35 },
      position: { x: -3.25, y: 1.725, z: 0.05 },
      material: materials.seongbinWall,
      scene,
      parent: root
    });
    const oldCenter = seongbinBox({
      name: "seongbin-old-dormitory-center-building",
      size: { width: 2.65, height: 2.95, depth: 2.15 },
      position: { x: 0.05, y: 1.475, z: -0.08 },
      material: materials.seongbinOldWall,
      scene,
      parent: root
    });
    const oldRight = seongbinBox({
      name: "seongbin-old-dormitory-right-building",
      size: { width: 2.55, height: 2.95, depth: 2.1 },
      position: { x: 2.85, y: 1.475, z: 0 },
      material: materials.seongbinOldWall,
      scene,
      parent: root
    });
    const diningCore = seongbinBox({
      name: "seongbin-dining-and-common-core",
      size: { width: 1.52, height: 1.18, depth: 1.34 },
      position: { x: -0.92, y: 0.59, z: -1.55 },
      material: materials.seongbinCore,
      scene,
      parent: root
    });
    const connector = seongbinBox({
      name: "seongbin-covered-connector",
      size: { width: 2.05, height: 0.72, depth: 0.62 },
      position: { x: 1.43, y: 0.48, z: -1.38 },
      material: materials.seongbinGlass,
      scene,
      parent: root
    });
    const newRoof = seongbinBox({
      name: "seongbin-new-dorm-low-roof",
      size: { width: 3.28, height: 0.18, depth: 2.62 },
      position: { x: -3.25, y: 3.54, z: 0.05 },
      material: materials.seongbinRoof,
      scene,
      parent: root
    });
    const centerRoof = seongbinBox({
      name: "seongbin-center-old-roof",
      size: { width: 2.9, height: 0.18, depth: 2.42 },
      position: { x: 0.05, y: 3.05, z: -0.08 },
      material: materials.seongbinRoof,
      scene,
      parent: root
    });
    const rightRoof = seongbinBox({
      name: "seongbin-right-old-roof",
      size: { width: 2.8, height: 0.18, depth: 2.36 },
      position: { x: 2.85, y: 3.05, z: 0 },
      material: materials.seongbinRoof,
      scene,
      parent: root
    });
    const newEntry = seongbinBox({
      name: "seongbin-new-dorm-entry-glass",
      size: { width: 0.86, height: 0.72, depth: 0.08 },
      position: { x: -3.25, y: 0.55, z: -1.16 },
      material: materials.seongbinGlass,
      scene,
      parent: root
    });
    const centerEntry = seongbinBox({
      name: "seongbin-common-entry-canopy",
      size: { width: 1.46, height: 0.14, depth: 0.72 },
      position: { x: -0.92, y: 1.25, z: -2.05 },
      material: materials.seongbinRoof,
      scene,
      parent: root
    });
    const base = seongbinBox({
      name: "seongbin-dormitory-raised-base",
      size: { width: 7.42, height: 0.22, depth: 3.2 },
      position: { x: -0.15, y: 0.11, z: -0.18 },
      material: materials.seongbinBase,
      scene,
      parent: root
    });
    addDormWindows(scene, root, materials, "seongbin-new-front", -4.32, 6, -1.16, [0.9, 1.52, 2.14, 2.76, 3.14]);
    addDormWindows(scene, root, materials, "seongbin-center-front", -0.88, 5, -1.17, [0.92, 1.52, 2.12, 2.62]);
    addDormWindows(scene, root, materials, "seongbin-right-front", 1.98, 5, -1.13, [0.92, 1.52, 2.12, 2.62]);
    addSideDormWindows(scene, root, materials, "seongbin-new-west", -4.78, -0.68, 4, [1, 1.62, 2.24, 2.86]);
    addSideDormWindows(scene, root, materials, "seongbin-right-east", 4.15, -0.68, 4, [1, 1.62, 2.24]);
    for (let i = 0; i < 4; i += 1) {
      seongbinBox({
        name: `seongbin-common-front-step-${i}`,
        size: { width: 2.2 - i * 0.22, height: 0.05, depth: 0.3 },
        position: { x: -0.92, y: 0.035 + i * 0.045, z: -2.32 - i * 0.18 },
        material: materials.stone,
        scene,
        parent: root
      });
    }
    const courtyard = BABYLON.MeshBuilder.CreateGround("seongbin-dormitory-courtyard", { width: 8.25, height: 3.6 }, scene);
    courtyard.position.set(-0.15, 0.023, -2.15);
    courtyard.material = materials.plaza;
    courtyard.parent = root;
    const dormRoad = BABYLON.MeshBuilder.CreateGround("seongbin-dormitory-access-road", { width: 9.4, height: 1.18 }, scene);
    dormRoad.position.set(-0.2, 0.024, -3.45);
    dormRoad.material = materials.road;
    dormRoad.parent = root;
    return { root, newDorm, oldCenter, oldRight, diningCore, connector, newRoof, centerRoof, rightRoof, newEntry, centerEntry, base, courtyard, dormRoad };
  };
})();
