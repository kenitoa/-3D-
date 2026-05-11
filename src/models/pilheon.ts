declare const BABYLON: any;

type MeshMap = Record<string, any>;
type BoxOptions = {
  name: string;
  size: { width: number; height: number; depth: number };
  position: { x: number; y: number; z: number };
  material: any;
  scene: any;
  parent?: any;
};

function box({ name, size, position, material, scene, parent }: BoxOptions): any {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.set(position.x, position.y, position.z);
  mesh.material = material;
  if (parent) mesh.parent = parent;
  return mesh;
}

function addWindows(scene: any, parent: any, material: any, y: number, z: number, count: number, span: number): void {
  const gap = span / count;
  for (let i = 0; i < count; i += 1) {
    box({
      name: `pilheon-window-${y}-${i}`,
      size: { width: 0.2, height: 0.3, depth: 0.035 },
      position: { x: -span / 2 + i * gap + gap / 2, y, z },
      material,
      scene,
      parent
    });
  }
}

window.PilheonModel = window.PilheonModel || {};
window.PilheonModel.createPilheonModel = function createPilheonModel(scene: any, materials: MeshMap): MeshMap {
  const root = new BABYLON.TransformNode("pilheon-root", scene);
  root.position.set(9.7, 0, -1.0);

  const main = box({
    name: "pilheon-main-body",
    size: { width: 4.9, height: 1.9, depth: 1.75 },
    position: { x: 1.7, y: 0.95, z: -3.2 },
    material: materials.pilheonWall,
    scene,
    parent: root
  });

  const stairCore = box({
    name: "pilheon-central-stair-core",
    size: { width: 0.72, height: 2.25, depth: 1.95 },
    position: { x: 1.7, y: 1.125, z: -3.1 },
    material: materials.pilheonCore,
    scene,
    parent: root
  });

  const roof = box({
    name: "pilheon-flat-roof",
    size: { width: 5.2, height: 0.18, depth: 2.02 },
    position: { x: 1.7, y: 1.98, z: -3.2 },
    material: materials.pilheonRoof,
    scene,
    parent: root
  });

  const entrance = box({
    name: "pilheon-1f-grad-school-office-entry",
    size: { width: 1.22, height: 0.52, depth: 0.2 },
    position: { x: 1.7, y: 0.42, z: -4.2 },
    material: materials.glass,
    scene,
    parent: root
  });

  [-0.02, 0.74].forEach((y, index) => {
    addWindows(scene, main, materials.window, y, -0.91, 8, 4.2);
    box({
      name: `pilheon-floor-line-${index}`,
      size: { width: 5.05, height: 0.04, depth: 0.07 },
      position: { x: 1.7, y: index ? 1.02 : 0.12, z: -4.125 },
      material: materials.trim,
      scene,
      parent: root
    });
  });

  const plaza = BABYLON.MeshBuilder.CreateGround("pilheon-front-plaza", { width: 5.6, height: 2.2 }, scene);
  plaza.position.set(1.7, 0.022, -5.25);
  plaza.material = materials.plaza;
  plaza.parent = root;

  return { root, main, stairCore, roof, entrance, plaza };
};
