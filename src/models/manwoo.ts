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

function addWindowRow(scene: any, parent: any, material: any, y: number, z: number, count: number, span: number): void {
  const gap = span / count;
  for (let i = 0; i < count; i += 1) {
    box({
      name: `manwoo-window-${y}-${i}`,
      size: { width: 0.18, height: 0.28, depth: 0.04 },
      position: { x: -span / 2 + i * gap + gap / 2, y, z },
      material,
      scene,
      parent
    });
  }
}

function addExteriorCorridors(scene: any, root: any, materials: MeshMap): void {
  [0.9, 1.55, 2.2, 2.85].forEach((y, index) => {
    box({
      name: `manwoo-exterior-corridor-${index + 1}f`,
      size: { width: 7.55, height: 0.055, depth: 0.18 },
      position: { x: -16.2, y, z: -11.86 },
      material: materials.trim,
      scene,
      parent: root
    });
  });
}

function addStairTower(scene: any, root: any, materials: MeshMap, x: number, z: number, suffix: string): any {
  const tower = box({
    name: `manwoo-exterior-stair-${suffix}`,
    size: { width: 0.62, height: 3.65, depth: 0.75 },
    position: { x, y: 1.825, z },
    material: materials.manwooStair,
    scene,
    parent: root
  });

  for (let i = 0; i < 6; i += 1) {
    box({
      name: `manwoo-stair-landing-${suffix}-${i}`,
      size: { width: 0.86, height: 0.06, depth: 0.52 },
      position: { x, y: 0.35 + i * 0.58, z: z - 0.45 },
      material: materials.stone,
      scene,
      parent: root
    });
  }

  return tower;
}

window.ManwooModel = window.ManwooModel || {};
window.ManwooModel.createManwooModel = function createManwooModel(scene: any, materials: MeshMap): MeshMap {
  const root = new BABYLON.TransformNode("manwoo-root", scene);
  root.position.set(8.7, 0, -1.2);

  const main = box({
    name: "manwoo-main-long-classroom-body",
    size: { width: 8.8, height: 3.75, depth: 2.05 },
    position: { x: -16.2, y: 1.875, z: -10.75 },
    material: materials.manwooWall,
    scene,
    parent: root
  });

  const westWing = box({
    name: "manwoo-west-old-wing",
    size: { width: 2.15, height: 2.7, depth: 2.45 },
    position: { x: -21.55, y: 1.35, z: -10.45 },
    material: materials.manwooSideWall,
    scene,
    parent: root
  });

  const southWing = box({
    name: "manwoo-south-offset-wing",
    size: { width: 3.0, height: 2.25, depth: 1.65 },
    position: { x: -18.0, y: 1.125, z: -13.35 },
    material: materials.manwooSideWall,
    scene,
    parent: root
  });

  const roof = box({
    name: "manwoo-aged-flat-roof",
    size: { width: 9.2, height: 0.18, depth: 2.36 },
    position: { x: -16.2, y: 3.86, z: -10.75 },
    material: materials.manwooRoof,
    scene,
    parent: root
  });

  addExteriorCorridors(scene, root, materials);
  addWindowRow(scene, main, materials.window, -1.18, -1.05, 15, 8.0);
  addWindowRow(scene, main, materials.window, -0.52, -1.05, 15, 8.0);
  addWindowRow(scene, main, materials.window, 0.14, -1.05, 12, 6.4);
  addWindowRow(scene, main, materials.window, 0.8, -1.05, 12, 6.4);
  addWindowRow(scene, westWing, materials.window, -0.45, -1.25, 4, 1.55);

  const westStair = addStairTower(scene, root, materials, -21.95, -12.25, "west");
  const eastStair = addStairTower(scene, root, materials, -11.95, -12.25, "east");

  const plaza = BABYLON.MeshBuilder.CreateGround("manwoo-front-paved-yard", { width: 8.9, height: 2.62 }, scene);
  plaza.position.set(-16.2, 0.021, -13.22);
  plaza.material = materials.plaza;
  plaza.parent = root;

  return {
    root,
    main,
    westWing,
    southWing,
    roof,
    westStair,
    eastStair,
    plaza
  };
};
