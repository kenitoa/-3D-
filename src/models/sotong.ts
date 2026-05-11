type SotongMeshMap = Record<string, any>;

declare const BABYLON: any;
declare global {
  interface Window {
    SotongModel: any;
  }
}

window.SotongModel = window.SotongModel || {};

function sotongBox({ name, size, position, material, scene, parent }: any): any {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addSotongOfficeWindows(scene: any, root: any, materials: SotongMeshMap): void {
  [0.82, 1.46, 2.1, 2.74].forEach((y, floor) => {
    for (let i = 0; i < 9; i += 1) {
      sotongBox({
        name: `sotong-professor-office-window-${floor}-${i}`,
        size: { width: 0.2, height: 0.32, depth: 0.052 },
        position: { x: 13.48 + i * 0.42, y, z: 1.78 },
        material: materials.sotongWindow,
        scene,
        parent: root
      });
    }
  });
}

function addSotongSideWindows(scene: any, root: any, materials: SotongMeshMap): void {
  [1.08, 1.74, 2.4].forEach((y, row) => {
    for (let i = 0; i < 4; i += 1) {
      sotongBox({
        name: `sotong-side-office-window-${row}-${i}`,
        size: { width: 0.052, height: 0.32, depth: 0.22 },
        position: { x: 18.08, y, z: 2.28 + i * 0.42 },
        material: materials.sotongWindow,
        scene,
        parent: root
      });
    }
  });
}

window.SotongModel.createSotongModel = function createSotongModel(scene: any, materials: SotongMeshMap): SotongMeshMap {
  const root = new BABYLON.TransformNode("sotong-root", scene);
  root.position.set(14.5, 0, 1.9);

  const main = sotongBox({
    name: "sotong-professor-research-main",
    size: { width: 5.15, height: 3.02, depth: 2.25 },
    position: { x: 15.7, y: 1.51, z: 2.9 },
    material: materials.sotongWall,
    scene,
    parent: root
  });

  const westCore = sotongBox({
    name: "sotong-stair-elevator-core",
    size: { width: 0.88, height: 3.35, depth: 2.42 },
    position: { x: 12.88, y: 1.675, z: 2.9 },
    material: materials.sotongCore,
    scene,
    parent: root
  });

  const museumWing = sotongBox({
    name: "sotong-1f-museum-storage-wing",
    size: { width: 1.72, height: 0.92, depth: 1.35 },
    position: { x: 15.0, y: 0.46, z: 1.35 },
    material: materials.sotongMuseum,
    scene,
    parent: root
  });

  const roof = sotongBox({
    name: "sotong-flat-roof",
    size: { width: 5.55, height: 0.2, depth: 2.55 },
    position: { x: 15.7, y: 3.12, z: 2.9 },
    material: materials.sotongRoof,
    scene,
    parent: root
  });

  const roofMachine = sotongBox({
    name: "sotong-roof-machine-room",
    size: { width: 0.94, height: 0.34, depth: 0.62 },
    position: { x: 17.05, y: 3.39, z: 2.78 },
    material: materials.stone,
    scene,
    parent: root
  });

  const entrance = sotongBox({
    name: "sotong-8101-8110-entry-glass",
    size: { width: 1.42, height: 0.68, depth: 0.08 },
    position: { x: 15.7, y: 0.58, z: 1.76 },
    material: materials.sotongGlass,
    scene,
    parent: root
  });

  const admin8105 = sotongBox({
    name: "sotong-media-admin-office-8105",
    size: { width: 0.9, height: 0.42, depth: 0.07 },
    position: { x: 13.92, y: 0.92, z: 1.74 },
    material: materials.sotongAccent,
    scene,
    parent: root
  });

  const researchBand = sotongBox({
    name: "sotong-upper-research-office-band",
    size: { width: 2.35, height: 0.42, depth: 0.07 },
    position: { x: 16.35, y: 2.72, z: 1.74 },
    material: materials.sotongGlass,
    scene,
    parent: root
  });

  [1.05, 1.72, 2.39].forEach((y, index) => {
    sotongBox({
      name: `sotong-horizontal-floor-line-${index}`,
      size: { width: 5.35, height: 0.055, depth: 0.08 },
      position: { x: 15.7, y, z: 1.75 },
      material: materials.sotongTrim,
      scene,
      parent: root
    });
  });

  addSotongOfficeWindows(scene, root, materials);
  addSotongSideWindows(scene, root, materials);

  for (let i = 0; i < 3; i += 1) {
    sotongBox({
      name: `sotong-front-step-${i}`,
      size: { width: 2.42 - i * 0.26, height: 0.055, depth: 0.3 },
      position: { x: 15.7, y: 0.04 + i * 0.048, z: 1.42 - i * 0.2 },
      material: materials.stone,
      scene,
      parent: root
    });
  }

  const serviceRoad = BABYLON.MeshBuilder.CreateGround("sotong-front-service-road-patch", { width: 5.9, height: 1.2 }, scene);
  serviceRoad.position.set(15.7, 0.024, 0.95);
  serviceRoad.material = materials.road;
  serviceRoad.parent = root;

  const plaza = BABYLON.MeshBuilder.CreateGround("sotong-front-plaza", { width: 5.6, height: 2.05 }, scene);
  plaza.position.set(15.7, 0.026, 1.04);
  plaza.material = materials.plaza;
  plaza.parent = root;

  return { root, main, westCore, museumWing, roof, roofMachine, entrance, admin8105, researchBand, serviceRoad, plaza };
};

export {};
