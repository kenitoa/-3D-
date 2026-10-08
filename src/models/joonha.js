// Generated from src/models/joonha.ts; run npm run build.
(() => {
  window.JoonhaModel = window.JoonhaModel || {};
  function joonhaBox({ name, size, position, material, scene, parent }) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.set(position.x, position.y, position.z);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function addJoonhaWindows(scene, root, materials) {
    [0.92, 1.56, 2.2, 2.84, 3.48].forEach((y, floor) => {
      for (let i = 0; i < 8; i += 1) {
        joonhaBox({
          name: `joonha-office-window-${floor}-${i}`,
          size: { width: 0.22, height: 0.32, depth: 0.055 },
          position: { x: -2.1 + i * 0.55, y, z: -1.66 },
          material: materials.joonhaWindow,
          scene,
          parent: root
        });
      }
    });
  }
  function addJoonhaSideWindows(scene, root, materials) {
    [1.18, 1.82, 2.46, 3.1].forEach((y, row) => {
      for (let i = 0; i < 5; i += 1) {
        joonhaBox({
          name: `joonha-side-conference-window-${row}-${i}`,
          size: { width: 0.06, height: 0.34, depth: 0.22 },
          position: { x: 3.62, y, z: -1 + i * 0.48 },
          material: materials.joonhaWindow,
          scene,
          parent: root
        });
      }
    });
  }
  window.JoonhaModel.createJoonhaModel = function createJoonhaModel(scene, materials) {
    const root = new BABYLON.TransformNode("joonha-root", scene);
    root.position.set(56, 0, -14);
    const main = joonhaBox({
      name: "joonha-unification-main-5f",
      size: { width: 6.15, height: 4.08, depth: 2.92 },
      position: { x: 0, y: 2.04, z: -0.2 },
      material: materials.joonhaWall,
      scene,
      parent: root
    });
    const eastConference = joonhaBox({
      name: "joonha-5f-international-conference-wing",
      size: { width: 1.32, height: 3.35, depth: 2.55 },
      position: { x: 3.22, y: 1.675, z: -0.1 },
      material: materials.joonhaSideWall,
      scene,
      parent: root
    });
    const memorialLobby = joonhaBox({
      name: "joonha-1f-memorial-hall-glass-lobby",
      size: { width: 2.42, height: 0.86, depth: 0.08 },
      position: { x: -1.05, y: 0.62, z: -1.69 },
      material: materials.joonhaGlass,
      scene,
      parent: root
    });
    const memoryRoom = joonhaBox({
      name: "joonha-memory-room-1f-band",
      size: { width: 1.12, height: 0.58, depth: 0.08 },
      position: { x: 1.72, y: 0.72, z: -1.7 },
      material: materials.joonhaMemorial,
      scene,
      parent: root
    });
    const centralGarden = joonhaBox({
      name: "joonha-central-courtyard-green",
      size: { width: 1.38, height: 0.08, depth: 1 },
      position: { x: 0.18, y: 0.18, z: -0.28 },
      material: materials.joonhaGarden,
      scene,
      parent: root
    });
    const dolbegaeStone = joonhaBox({
      name: "joonha-dolbegae-memorial-stone",
      size: { width: 0.62, height: 0.28, depth: 0.38 },
      position: { x: 0.18, y: 0.38, z: -0.28 },
      material: materials.joonhaStone,
      scene,
      parent: root
    });
    const topConferenceBand = joonhaBox({
      name: "joonha-18517-conference-wide-window",
      size: { width: 3.85, height: 0.48, depth: 0.07 },
      position: { x: 0.18, y: 3.72, z: -1.69 },
      material: materials.joonhaGlass,
      scene,
      parent: root
    });
    const roof = joonhaBox({
      name: "joonha-sixtieth-anniversary-flat-roof",
      size: { width: 6.58, height: 0.22, depth: 3.24 },
      position: { x: 0, y: 4.19, z: -0.2 },
      material: materials.joonhaRoof,
      scene,
      parent: root
    });
    const roofCore = joonhaBox({
      name: "joonha-roof-machine-core",
      size: { width: 1.05, height: 0.42, depth: 0.68 },
      position: { x: 2.05, y: 4.52, z: 0.38 },
      material: materials.stone,
      scene,
      parent: root
    });
    const entranceCanopy = joonhaBox({
      name: "joonha-front-entry-canopy",
      size: { width: 3.25, height: 0.16, depth: 0.82 },
      position: { x: -0.62, y: 1.2, z: -1.98 },
      material: materials.joonhaRoof,
      scene,
      parent: root
    });
    const base = joonhaBox({
      name: "joonha-raised-memorial-base",
      size: { width: 6.85, height: 0.24, depth: 3.35 },
      position: { x: 0.05, y: 0.12, z: -0.2 },
      material: materials.joonhaBase,
      scene,
      parent: root
    });
    addJoonhaWindows(scene, root, materials);
    addJoonhaSideWindows(scene, root, materials);
    for (let i = 0; i < 5; i += 1) {
      joonhaBox({
        name: `joonha-front-memorial-step-${i}`,
        size: { width: 3.8 - i * 0.26, height: 0.055, depth: 0.32 },
        position: { x: -0.62, y: 0.04 + i * 0.05, z: -2.35 - i * 0.2 },
        material: materials.stone,
        scene,
        parent: root
      });
    }
    const memorialPlaza = BABYLON.MeshBuilder.CreateGround("joonha-dolbegae-park-plaza", { width: 7.4, height: 4.45 }, scene);
    memorialPlaza.position.set(0, 0.024, -2.82);
    memorialPlaza.material = materials.plaza;
    memorialPlaza.parent = root;
    const joonhaRoad = BABYLON.MeshBuilder.CreateGround("joonha-east-access-road", { width: 8.2, height: 1.05 }, scene);
    joonhaRoad.position.set(0, 0.026, -4.25);
    joonhaRoad.material = materials.road;
    joonhaRoad.parent = root;
    return { root, main, eastConference, memorialLobby, memoryRoom, centralGarden, dolbegaeStone, topConferenceBand, roof, roofCore, entranceCanopy, base, memorialPlaza, joonhaRoad };
  };
})();
