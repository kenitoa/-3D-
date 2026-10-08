// Generated from src/models/neutbom.ts; run npm run build.
(() => {
  window.NeutbomModel = window.NeutbomModel || {};
  function neutbomBox({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function addNeutbomWindows(scene, root, materials) {
    [0.92, 1.58, 2.24, 2.9, 3.56].forEach((y, floor) => {
      for (let i = 0; i < 10; i += 1) {
        neutbomBox({
          name: `neutbom-modern-class-window-${floor}-${i}`,
          size: { width: 0.22, height: 0.32, depth: 0.055 },
          position: { x: -2.72 + i * 0.56, y, z: -1.48 },
          material: materials.neutbomWindow,
          scene,
          parent: root
        });
      }
    });
  }
  function addNeutbomSideWindows(scene, root, materials) {
    [1.18, 1.84, 2.5, 3.16].forEach((y, row) => {
      for (let i = 0; i < 4; i += 1) {
        neutbomBox({
          name: `neutbom-side-lab-window-${row}-${i}`,
          size: { width: 0.06, height: 0.32, depth: 0.22 },
          position: { x: 3.45, y, z: -0.86 + i * 0.5 },
          material: materials.neutbomWindow,
          scene,
          parent: root
        });
      }
    });
  }
  window.NeutbomModel.createNeutbomModel = function createNeutbomModel(scene, materials) {
    const root = new BABYLON.TransformNode("neutbom-root", scene);
    root.position.set(-8, 0, -21.4);
    const main = neutbomBox({
      name: "neutbom-modern-lecture-main-b1-5f",
      size: { width: 6.45, height: 4.05, depth: 2.65 },
      position: { x: 0, y: 2.025, z: -0.16 },
      material: materials.neutbomWall,
      scene,
      parent: root
    });
    const eastCore = neutbomBox({
      name: "neutbom-elevator-stair-core",
      size: { width: 1.04, height: 4.35, depth: 2.88 },
      position: { x: 3.15, y: 2.175, z: -0.16 },
      material: materials.neutbomCore,
      scene,
      parent: root
    });
    const lowerBasement = neutbomBox({
      name: "neutbom-visible-b1-slope-base",
      size: { width: 6.72, height: 0.62, depth: 2.92 },
      position: { x: -0.06, y: 0.31, z: -0.16 },
      material: materials.neutbomBase,
      scene,
      parent: root
    });
    const studioGlass = neutbomBox({
      name: "neutbom-1f-studio-glass-front",
      size: { width: 1.84, height: 0.78, depth: 0.08 },
      position: { x: -1.68, y: 0.72, z: -1.53 },
      material: materials.neutbomStudioGlass,
      scene,
      parent: root
    });
    const studioPanel = neutbomBox({
      name: "neutbom-studio-media-panel",
      size: { width: 1.22, height: 0.48, depth: 0.07 },
      position: { x: 0.82, y: 0.92, z: -1.54 },
      material: materials.neutbomAccent,
      scene,
      parent: root
    });
    const upperLounge = neutbomBox({
      name: "neutbom-upper-flipped-learning-lounge",
      size: { width: 3.4, height: 0.46, depth: 0.07 },
      position: { x: -0.15, y: 3.45, z: -1.53 },
      material: materials.neutbomGlass,
      scene,
      parent: root
    });
    const roof = neutbomBox({
      name: "neutbom-clean-flat-roof",
      size: { width: 6.92, height: 0.22, depth: 3.02 },
      position: { x: 0, y: 4.18, z: -0.16 },
      material: materials.neutbomRoof,
      scene,
      parent: root
    });
    const roofMachine = neutbomBox({
      name: "neutbom-roof-equipment-room",
      size: { width: 1.02, height: 0.42, depth: 0.62 },
      position: { x: 2.05, y: 4.5, z: 0.42 },
      material: materials.stone,
      scene,
      parent: root
    });
    const canopy = neutbomBox({
      name: "neutbom-front-entry-canopy",
      size: { width: 2.8, height: 0.15, depth: 0.76 },
      position: { x: -1.05, y: 1.2, z: -1.84 },
      material: materials.neutbomRoof,
      scene,
      parent: root
    });
    addNeutbomWindows(scene, root, materials);
    addNeutbomSideWindows(scene, root, materials);
    for (let i = 0; i < 5; i += 1) {
      neutbomBox({
        name: `neutbom-steep-entry-step-${i}`,
        size: { width: 3.05 - i * 0.24, height: 0.055, depth: 0.32 },
        position: { x: -1.05, y: 0.04 + i * 0.05, z: -2.18 - i * 0.2 },
        material: materials.stone,
        scene,
        parent: root
      });
    }
    const frontPlaza = BABYLON.MeshBuilder.CreateGround("neutbom-front-learning-plaza", { width: 7, height: 3.2 }, scene);
    frontPlaza.position.set(-0.1, 0.023, -2.45);
    frontPlaza.material = materials.plaza;
    frontPlaza.parent = root;
    const hillWalk = BABYLON.MeshBuilder.CreateGround("neutbom-south-hill-walkway", { width: 7.8, height: 0.95 }, scene);
    hillWalk.position.set(-0.1, 0.025, -3.75);
    hillWalk.material = materials.road;
    hillWalk.parent = root;
    return { root, main, eastCore, lowerBasement, studioGlass, studioPanel, upperLounge, roof, roofMachine, canopy, frontPlaza, hillWalk };
  };
})();
