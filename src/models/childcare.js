// Generated from src/models/childcare.ts; run npm run build.
(() => {
  window.ChildcareModel = window.ChildcareModel || {};
  function childcareBox({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function addChildcareRoomWindows(scene, root, materials) {
    [0.78, 1.38, 1.98].forEach((y, floor) => {
      for (let i = 0; i < 6; i += 1) {
        childcareBox({
          name: `childcare-classroom-window-${floor}-${i}`,
          size: { width: 0.28, height: 0.34, depth: 0.055 },
          position: { x: -1.42 + i * 0.55, y, z: -1.33 },
          material: materials.childcareWindow,
          scene,
          parent: root
        });
      }
    });
  }
  function addPlaygroundPieces(scene, root, materials) {
    childcareBox({
      name: "childcare-play-slide-platform",
      size: { width: 0.72, height: 0.46, depth: 0.54 },
      position: { x: -1.35, y: 0.23, z: -3.18 },
      material: materials.childcarePlay,
      scene,
      parent: root
    });
    childcareBox({
      name: "childcare-play-slide-ramp",
      size: { width: 0.45, height: 0.12, depth: 1 },
      position: { x: -0.82, y: 0.12, z: -3.45 },
      material: materials.childcareSlide,
      scene,
      parent: root
    });
    for (let i = 0; i < 4; i += 1) {
      childcareBox({
        name: `childcare-play-fence-${i}`,
        size: { width: i < 2 ? 3.6 : 0.1, height: 0.34, depth: i < 2 ? 0.08 : 2.3 },
        position: {
          x: i < 2 ? 0 : i === 2 ? -1.85 : 1.85,
          y: 0.17,
          z: i < 2 ? i === 0 ? -2.55 : -4.85 : -3.7
        },
        material: materials.childcareFence,
        scene,
        parent: root
      });
    }
  }
  window.ChildcareModel.createChildcareModel = function createChildcareModel(scene, materials) {
    const root = new BABYLON.TransformNode("childcare-root", scene);
    root.position.set(62, 0, -8.4);
    const main = childcareBox({
      name: "childcare-3f-main-nursery",
      size: { width: 4.2, height: 2.38, depth: 2.35 },
      position: { x: 0, y: 1.19, z: -0.18 },
      material: materials.childcareWall,
      scene,
      parent: root
    });
    const hallWing = childcareBox({
      name: "childcare-small-auditorium-wing",
      size: { width: 1.55, height: 1.42, depth: 1.62 },
      position: { x: 2.42, y: 0.71, z: 0.08 },
      material: materials.childcareSideWall,
      scene,
      parent: root
    });
    const therapyRoom = childcareBox({
      name: "childcare-play-therapy-room",
      size: { width: 1.02, height: 0.72, depth: 0.08 },
      position: { x: -1.2, y: 0.52, z: -1.36 },
      material: materials.childcareAccent,
      scene,
      parent: root
    });
    const entryGlass = childcareBox({
      name: "childcare-front-glass-entry",
      size: { width: 0.92, height: 0.68, depth: 0.08 },
      position: { x: 0.95, y: 0.48, z: -1.37 },
      material: materials.childcareGlass,
      scene,
      parent: root
    });
    const roof = childcareBox({
      name: "childcare-warm-low-roof",
      size: { width: 4.55, height: 0.2, depth: 2.7 },
      position: { x: 0, y: 2.5, z: -0.18 },
      material: materials.childcareRoof,
      scene,
      parent: root
    });
    const hallRoof = childcareBox({
      name: "childcare-auditorium-wing-roof",
      size: { width: 1.78, height: 0.17, depth: 1.82 },
      position: { x: 2.42, y: 1.52, z: 0.08 },
      material: materials.childcareRoof,
      scene,
      parent: root
    });
    const canopy = childcareBox({
      name: "childcare-safe-entry-canopy",
      size: { width: 2, height: 0.13, depth: 0.68 },
      position: { x: 0.55, y: 1.03, z: -1.68 },
      material: materials.childcareRoof,
      scene,
      parent: root
    });
    const base = childcareBox({
      name: "childcare-raised-nursery-base",
      size: { width: 4.9, height: 0.2, depth: 2.85 },
      position: { x: 0.12, y: 0.1, z: -0.18 },
      material: materials.childcareBase,
      scene,
      parent: root
    });
    addChildcareRoomWindows(scene, root, materials);
    addPlaygroundPieces(scene, root, materials);
    const sandPlayground = BABYLON.MeshBuilder.CreateGround("childcare-sand-playground", { width: 3.95, height: 2.65 }, scene);
    sandPlayground.position.set(0, 0.023, -3.72);
    sandPlayground.material = materials.childcareSand;
    sandPlayground.parent = root;
    const natureYard = BABYLON.MeshBuilder.CreateGround("childcare-nature-learning-yard", { width: 2, height: 1.15 }, scene);
    natureYard.position.set(2.7, 0.025, -3.3);
    natureYard.material = materials.childcareGarden;
    natureYard.parent = root;
    const entryPlaza = BABYLON.MeshBuilder.CreateGround("childcare-front-safe-plaza", { width: 4.8, height: 1.6 }, scene);
    entryPlaza.position.set(0.35, 0.024, -2.02);
    entryPlaza.material = materials.plaza;
    entryPlaza.parent = root;
    return { root, main, hallWing, therapyRoom, entryGlass, roof, hallRoof, canopy, base, sandPlayground, natureYard, entryPlaza };
  };
})();
