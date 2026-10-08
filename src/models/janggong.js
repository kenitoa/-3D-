// Generated from src/models/janggong.ts; run npm run build.
(() => {
  function box({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function windowBand(parent, scene, material, y, z, count, span) {
    const gap = span / count;
    for (let i = 0; i < count; i += 1) {
      box({
        name: `janggong-window-${parent.name}-${y}-${i}`,
        size: { width: 0.22, height: 0.34, depth: 0.035 },
        position: { x: -span / 2 + gap * i + gap / 2, y, z },
        material,
        scene,
        parent
      });
    }
  }
  function addFloorLines(scene, materials, parent) {
    [0.96, 1.92, 2.88].forEach((y, index) => {
      box({
        name: `janggong-floor-line-${index + 1}`,
        size: { width: 8.55, height: 0.045, depth: 0.09 },
        position: { x: -7.4, y, z: -3.035 },
        material: materials.trim,
        scene,
        parent
      });
    });
  }
  function addEntrance(scene, materials, root) {
    const entrance = box({
      name: "janggong-entry-glass-lobby",
      size: { width: 2.15, height: 0.92, depth: 0.24 },
      position: { x: -7.4, y: 0.55, z: -3.08 },
      material: materials.glass,
      scene,
      parent: root
    });
    box({
      name: "janggong-entry-canopy",
      size: { width: 2.85, height: 0.13, depth: 0.96 },
      position: { x: -7.4, y: 1.13, z: -3.42 },
      material: materials.roof,
      scene,
      parent: root
    });
    [-8.35, -6.45].forEach((x, index) => {
      box({
        name: `janggong-entry-column-${index}`,
        size: { width: 0.14, height: 1.05, depth: 0.14 },
        position: { x, y: 0.54, z: -3.36 },
        material: materials.column,
        scene,
        parent: root
      });
    });
    [0, 1, 2].forEach((i) => {
      box({
        name: `janggong-entry-step-${i}`,
        size: { width: 3.15 - i * 0.32, height: 0.08, depth: 0.36 },
        position: { x: -7.4, y: 0.04 + i * 0.08, z: -3.72 - i * 0.28 },
        material: materials.stone,
        scene,
        parent: root
      });
    });
    const relief = box({
      name: "janggong-kim-jaejoon-relief-panel",
      size: { width: 0.75, height: 0.86, depth: 0.055 },
      position: { x: -9.05, y: 0.74, z: -3.115 },
      material: materials.relief,
      scene,
      parent: root
    });
    const medallion = BABYLON.MeshBuilder.CreateCylinder("janggong-relief-medallion", { diameter: 0.42, height: 0.06, tessellation: 32 }, scene);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(-9.05, 0.86, -3.16);
    medallion.material = materials.bronze;
    medallion.parent = root;
    return { entrance, relief, medallion };
  }
  window.JanggongModel = window.JanggongModel || {};
  window.JanggongModel.createJanggongModel = function createJanggongModel(scene, materials) {
    const root = new BABYLON.TransformNode("janggong-root", scene);
    root.position.set(7.4, 0, 0.4);
    const main = box({
      name: "janggong-main-body",
      size: { width: 8.25, height: 3.15, depth: 2.32 },
      position: { x: -7.4, y: 1.575, z: -1.82 },
      material: materials.wall,
      scene,
      parent: root
    });
    const leftWing = box({
      name: "janggong-left-wing",
      size: { width: 1.95, height: 2.35, depth: 2.55 },
      position: { x: -12.48, y: 1.175, z: -1.62 },
      material: materials.sideWall,
      scene,
      parent: root
    });
    const rightWing = box({
      name: "janggong-right-wing",
      size: { width: 1.95, height: 2.35, depth: 2.55 },
      position: { x: -2.32, y: 1.175, z: -1.62 },
      material: materials.sideWall,
      scene,
      parent: root
    });
    const roof = box({
      name: "janggong-parapet-flat-roof",
      size: { width: 8.7, height: 0.22, depth: 2.72 },
      position: { x: -7.4, y: 3.26, z: -1.82 },
      material: materials.roof,
      scene,
      parent: root
    });
    box({
      name: "janggong-roof-equipment-box",
      size: { width: 1.1, height: 0.28, depth: 0.65 },
      position: { x: -5.2, y: 3.52, z: -1.64 },
      material: materials.stone,
      scene,
      parent: root
    });
    addFloorLines(scene, materials, root);
    const entranceParts = addEntrance(scene, materials, root);
    windowBand(main, scene, materials.window, -0.84, -1.19, 12, 7.45);
    windowBand(main, scene, materials.window, -0.02, -1.19, 12, 7.45);
    windowBand(main, scene, materials.window, 0.8, -1.19, 8, 4.8);
    windowBand(leftWing, scene, materials.window, 0.06, -1.29, 3, 1.35);
    windowBand(rightWing, scene, materials.window, 0.06, -1.29, 3, 1.35);
    const meetingWindow = box({
      name: "janggong-front-3f-1318-large-window",
      size: { width: 2.9, height: 0.55, depth: 0.06 },
      position: { x: -7.4, y: 2.52, z: -3.025 },
      material: materials.window,
      scene,
      parent: root
    });
    const plaza = BABYLON.MeshBuilder.CreateGround("janggong-front-plaza", { width: 9, height: 3.4 }, scene);
    plaza.position.set(-7.4, 0.018, -4.72);
    plaza.material = materials.plaza;
    plaza.parent = root;
    const parking = BABYLON.MeshBuilder.CreateGround("janggong-guest-parking", { width: 7.3, height: 1.95 }, scene);
    parking.position.set(-7.4, 0.02, -7.18);
    parking.material = materials.parking;
    parking.parent = root;
    for (let i = 0; i < 8; i += 1) {
      box({
        name: `janggong-parking-line-${i}`,
        size: { width: 0.035, height: 0.012, depth: 1.48 },
        position: { x: -10.85 + i * 0.98, y: 0.04, z: -7.18 },
        material: materials.parkingLine,
        scene,
        parent: root
      });
    }
    return {
      root,
      main,
      leftWing,
      rightWing,
      roof,
      entrance: entranceParts.entrance,
      relief: entranceParts.relief,
      meetingWindow,
      plaza,
      parking
    };
  };
})();
