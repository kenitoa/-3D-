type SongamMeshMap = Record<string, any>;

declare const BABYLON: any;
declare global {
  interface Window {
    SongamModel: any;
  }
}

window.SongamModel = window.SongamModel || {};

function songamBox({ name, size, position, material, scene, parent }: any): any {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addSongamClassroomWindows(scene: any, root: any, materials: SongamMeshMap): void {
  [1.22, 1.86].forEach((y, floor) => {
    for (let i = 0; i < 8; i += 1) {
      songamBox({
        name: `songam-classroom-window-${floor}-${i}`,
        size: { width: 0.22, height: 0.34, depth: 0.055 },
        position: { x: 16.35 + i * 0.46, y, z: -3.02 },
        material: materials.songamWindow,
        scene,
        parent: root
      });
    }
  });
}

function addSongamSideWindows(scene: any, root: any, materials: SongamMeshMap): void {
  [0.94, 1.58, 2.22].forEach((y, row) => {
    for (let i = 0; i < 4; i += 1) {
      songamBox({
        name: `songam-side-lab-window-${row}-${i}`,
        size: { width: 0.055, height: 0.32, depth: 0.22 },
        position: { x: 21.05, y, z: -2.15 + i * 0.42 },
        material: materials.songamWindow,
        scene,
        parent: root
      });
    }
  });
}

window.SongamModel.createSongamModel = function createSongamModel(scene: any, materials: SongamMeshMap): SongamMeshMap {
  const root = new BABYLON.TransformNode("songam-root", scene);
  root.position.set(17.5, 0, -2.48);

  const hall = songamBox({
    name: "songam-1f-yusa-hall-main-volume",
    size: { width: 5.7, height: 2.35, depth: 2.55 },
    position: { x: 18.2, y: 1.175, z: -1.72 },
    material: materials.songamWall,
    scene,
    parent: root
  });

  const stage = songamBox({
    name: "songam-yusa-hall-stage-back-box",
    size: { width: 2.55, height: 1.85, depth: 0.92 },
    position: { x: 18.2, y: 0.925, z: -0.05 },
    material: materials.songamStageWall,
    scene,
    parent: root
  });

  const labWing = songamBox({
    name: "songam-7108-lab-wing",
    size: { width: 1.45, height: 2.05, depth: 2.28 },
    position: { x: 21.02, y: 1.025, z: -1.55 },
    material: materials.songamSideWall,
    scene,
    parent: root
  });

  const roof = songamBox({
    name: "songam-flat-roof",
    size: { width: 6.15, height: 0.2, depth: 2.88 },
    position: { x: 18.2, y: 2.46, z: -1.72 },
    material: materials.songamRoof,
    scene,
    parent: root
  });

  const stageRoof = songamBox({
    name: "songam-stage-roof-cap",
    size: { width: 2.8, height: 0.16, depth: 1.05 },
    position: { x: 18.2, y: 1.92, z: -0.05 },
    material: materials.songamRoof,
    scene,
    parent: root
  });

  const entryGlass = songamBox({
    name: "songam-yusa-hall-front-glass",
    size: { width: 1.68, height: 0.82, depth: 0.08 },
    position: { x: 18.2, y: 0.64, z: -3.05 },
    material: materials.songamGlass,
    scene,
    parent: root
  });

  const hallBand = songamBox({
    name: "songam-yusa-hall-wide-upper-window",
    size: { width: 3.72, height: 0.44, depth: 0.07 },
    position: { x: 18.2, y: 1.86, z: -3.04 },
    material: materials.songamGlass,
    scene,
    parent: root
  });

  const trimTop = songamBox({
    name: "songam-front-upper-trim",
    size: { width: 5.85, height: 0.06, depth: 0.08 },
    position: { x: 18.2, y: 1.13, z: -3.03 },
    material: materials.songamTrim,
    scene,
    parent: root
  });

  const trimBottom = songamBox({
    name: "songam-front-lower-trim",
    size: { width: 5.85, height: 0.06, depth: 0.08 },
    position: { x: 18.2, y: 0.34, z: -3.03 },
    material: materials.songamTrim,
    scene,
    parent: root
  });

  addSongamClassroomWindows(scene, root, materials);
  addSongamSideWindows(scene, root, materials);

  for (let i = 0; i < 4; i += 1) {
    songamBox({
      name: `songam-front-step-${i}`,
      size: { width: 3.2 - i * 0.28, height: 0.055, depth: 0.32 },
      position: { x: 18.2, y: 0.04 + i * 0.048, z: -3.35 - i * 0.22 },
      material: materials.stone,
      scene,
      parent: root
    });
  }

  const busStop = songamBox({
    name: "songam-front-bus-stop-shelter",
    size: { width: 1.15, height: 0.12, depth: 0.32 },
    position: { x: 20.8, y: 0.32, z: -4.15 },
    material: materials.songamGlass,
    scene,
    parent: root
  });

  const plaza = BABYLON.MeshBuilder.CreateGround("songam-front-plaza", { width: 6.55, height: 2.55 }, scene);
  plaza.position.set(18.2, 0.023, -4.12);
  plaza.material = materials.plaza;
  plaza.parent = root;

  return { root, hall, stage, labWing, roof, stageRoof, entryGlass, hallBand, trimTop, trimBottom, busStop, plaza };
};

export {};
