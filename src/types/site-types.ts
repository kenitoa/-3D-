import type { Scene, Engine, AbstractMesh, Mesh, TransformNode, Camera, StandardMaterial } from 'babylonjs';

export type ViewMode = 'overview' | 'top' | 'free';
export type PlatformView = ViewMode | 'text' | '2d';
export type QualityMode = 'auto' | 'low' | 'high';
export interface CameraSnapshot { view: string; alpha: number; beta: number; radius: number; target: number[]; freePosition: number[]; freeRotation: number[] }
export interface ApplicationState { schemaVersion: 1; campusId: string; datasetVersion: string; view: PlatformView; selectedId: string | null; layers: Record<string, boolean>; floor: string | null; floorId: string | null; quality: QualityMode; exaggeration: number; camera: CameraSnapshot | null; contentVersion?: string; assetsVersion?: string; releaseId?: string | null; sharedVersion?: string | null; sharedStatus?: string; refinement?: Record<string, unknown>; diagnostics?: Record<string, unknown> }
export type { PlatformEntity, PlatformCampus, CampusCatalog as PlatformCatalog, PlatformApi } from './platform-types';
export interface PlatformControls { update(state: Record<string, unknown>): void; destroy(): void }
export type Layer = 'boundary' | 'trees' | 'labels' | 'contours';
export type Point2 = [number, number];
export interface SiteFeature {
  id: string;
  name: string;
  legacyKey?: string;
  number?: number;
  aliases?: string[];
  kind: string;
  confidence: string;
  sourceId: string;
  status?: string;
  pointsMeters: Point2[];
  tags?: Record<string, string>;
  anchor?: { meters: Point2; legacy: Point2 };
  [key: string]: unknown;
}
export interface SitePlan {
  metadata: Record<string, unknown>;
  sources: unknown[];
  boundaries: { campusMapped: { pointsMeters: Point2[]; [key: string]: unknown }; [key: string]: unknown };
  features: { buildings: SiteFeature[]; entrances: SiteFeature[]; [key: string]: SiteFeature[] };
  [key: string]: unknown;
}
export interface BuildingModel {
  root: TransformNode;
  main?: Mesh;
  hall?: Mesh;
  newDorm?: Mesh;
  mediaHall?: Mesh;
  dispose?: () => void;
}
export type Materials = Record<string, StandardMaterial>;
export type BuildingFactory = (scene: Scene, materials: Materials) => BuildingModel;
export interface CameraController {
  setView(mode: ViewMode): void;
  zoom(direction: number): void;
  rotate(direction: number): void;
  reset(): void;
  resize(): void;
  fit(): void;
  focusBuilding(id: string, options?: {durationMs?: number; reducedMotion?: boolean; entranceId?: string}): boolean;
  setSafeArea?(insets: {left: number;right: number;top: number;bottom: number}, settings?: {preserveView?: boolean}): void;
  cancelTransition?(): void;
  getTransitionState?(): Record<string, unknown>;
  move?(east: number, north: number): boolean;
  pan?(horizontal: number, vertical: number): void;
  getObservationInfo?(): Record<string, unknown>;
  setObservationSettings?(settings: {eyeHeightMeters: number}): void;
  returnFromObservation?(): void;
  capture(): CameraSnapshot;
  restore(snapshot: unknown): void;
  getScaleBar(): { visible: boolean; meters?: number; pixels?: number; approximate?: boolean; mode?: string; text?: string };
  getNorthRotation(): number;
  [key: string]: unknown;
}
export interface SiteScene {
  cameraController: CameraController;
  layers: Record<string, unknown>;
  alignModel(model: BuildingModel, id: string): boolean;
  getBuildingProxy?(id: string): BuildingModel | null;
  getBoundaryLegend?(): Record<string, unknown>[];
  getTerrainAssessment?(east: number, north: number): Record<string, unknown>;
  getGroundingReport?(): Record<string, unknown>[];
  featureBounds?(id: string): {id: string;minimum: number[];maximum: number[];center: number[];dimensionsMeters: number[]} | null;
  projectFeature?(id: string, options?: {occlusion?: boolean}): {x: number;y: number;depth: number;occluded: boolean;inViewport: boolean;visible: boolean;worldPoint: number[];occludingFeatureId?: string | null} | null;
  setInteractionState?(state: {hovered?: string | null;selected?: string | null;searchIds?: string[];routeIds?: string[]}): void;
  setBuildingDetailVisible?(id: string, visible: boolean): void;
  setFeatureVisible?(id: string, visible: boolean): void;
  showUserLocation?(east: number, north: number, accuracyMeters: number): boolean;
  clearUserLocation?(): void;
  releaseModel?(model: BuildingModel): void;
  registerExternalModel?(model: BuildingModel, id: string): void;
  setLayerVisible(layer: string, enabled: boolean): void;
  setVerticalExaggeration?(factor: number): void;
  terrainHeightAt(x: number, z: number): number;
  getDiagnostics(): Record<string, unknown>;
  dispose(): void;
  [key: string]: unknown;
}
export interface Controls {
  update(state: Record<string, unknown>): void;
  selectBuilding(id: string): void;
  setStatus(status: 'loading' | 'ready' | 'error', message?: string): void;
  announce(message: string): void;
  destroy(): void;
}
export interface Hud {
  dispose?(): void;
  labelForMesh(mesh: Mesh, label: string): { isVisible: boolean };
  registerInterior(mesh: Mesh, interior: Record<string, unknown>, focus: () => void, key?: string): void;
  openInterior(id: string): void;
  hideInterior(): void;
  setInteriorLifecycle?(hooks: { capture: () => unknown; restore: (snapshot: unknown) => void; onOpen?: (id: string) => void }): void;
  setPickingEnabled?(enabled: boolean): void;
}
export interface CampusApplication {
  scene: Scene | null;
  engine: Engine | null;
  site: SiteScene | null;
  controls: Controls;
  ready: boolean;
  selectedId: string | null;
  models: Map<string, BuildingModel>;
  selectBuilding(id: string): void;
  exportView(view: string): Promise<void>;
  diagnostics(): Record<string, unknown>;
  getState(): ApplicationState;
  applyState(value: unknown): boolean;
  retryModel(id: string): Promise<BuildingModel | null>;
  setQuality(quality: QualityMode): void;
  getLocationSnapshot(): LocationSnapshot | null;
}
export interface LocationSnapshot { campusId: string; east: number; north: number; accuracyMeters: number; timestamp: number; inside: boolean }
export interface ControlsApi {
  initialize(options: { onAction: (action: string, payload?: Record<string, unknown>) => void; buildings: Record<string, unknown>[]; evidence: unknown }): Controls;
}
export interface SiteSceneApi {
  create(scene: Scene, materials: Materials, sitePlan: SitePlan, options?: Record<string, unknown>): SiteScene;
}
export type CanvasCamera = Camera;
export type SceneMesh = AbstractMesh;
