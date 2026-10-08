export type Visibility = 'public' | 'campus' | 'restricted';
export type EntityKind = 'campus' | 'facility-group' | 'building' | 'floor' | 'space' | 'external-facility' | 'door' | 'connection';
export type Confirmation = 'verified' | 'mapped' | 'estimated' | 'unverified';
export type Lifecycle = 'current' | 'historic' | 'proposed';
export interface EvidenceDates { referenceDate: string | null; issuedAt: string | null; observedAt: string | null; collectedAt: string | null; reviewedAt: string | null; validFrom: string | null; validUntil: string | null }
export interface EvidenceClaim { sourceIds: string[]; confidence: Confirmation; method: string; dates: EvidenceDates; notes: string }
export interface PlatformSource { id: string; title: string; url: string; scope: string; usage: string; visibility: Visibility; dates: EvidenceDates; confidence: Confirmation }
export interface SpatialGeometry { type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon'; coordinates: unknown; coordinateSystem: 'local-meters' | 'WGS84'; unit: 'm' | 'degree'; originId: string; sourceIds: string[]; confidence: Confirmation; boundaryType?: 'guide' | 'legal' | 'planning' | 'cadastral'; isLegalBoundary?: boolean }
export interface Translation { name: string; verified: boolean; sourceId: string | null }
export interface ConceptInterior { title: string; subtitle: string; floor: string; source: string; note: string; status: 'concept'; confidence: 'estimated'; zones: { id: string; label: string; kind: string; x: number; y: number; w: number; h: number }[]; rooms: { name: string; use: string }[] }
export interface PlatformEntity {
  id: string; kind: EntityKind; campusId: string; parentId: string | null; owningBuildingId: string | null;
  legacyId: string | null; legacyKey: string | null; name: string; displayTitle: string; aliases: string[]; purpose: string; category: string;
  translations: Record<string, Translation>; position: { east: number; north: number; up: number | null } | null; geometry: SpatialGeometry | null;
  floorId: string | null; floorLabel: string | null; sortOrder: number | null; roomCode: string | null;
  visibility: Visibility; status: Lifecycle; confidence: Confirmation; sensitive: boolean;
  claims: { name: EvidenceClaim; location: EvidenceClaim; outline: EvidenceClaim; height: EvidenceClaim; operation: EvidenceClaim };
  interior: ConceptInterior | null; feature: Record<string, unknown> | null;
  modelPose: { rotationRadians: number; confidence: Confirmation } | null;
}
export interface PlatformCampus { id: string; name: string; address: string; origin: { lat: number; lon: number }; unit: 'm'; verticalDatum: string; terrain: Record<string, unknown> | null; boundaries: { guide: SpatialGeometry; legal: SpatialGeometry | null; planning: SpatialGeometry | null; cadastral: SpatialGeometry | null }; visualizationPlan: Record<string, unknown> | null }
export interface RouteAccessibility { verification: 'verified' | 'unverified'; assessedProfile: 'wheelchair' | null; widthMeters: number | null; slopePercent: number | null; thresholdMm: number | null; surface: string | null; stepFree: boolean | null; operationalVerified: boolean; validUntil: string | null }
export interface RouteEdge { id: string; from: string; to: string; campusId: string; lengthMeters: number; bidirectional: boolean; kind: 'walk' | 'stairs' | 'ramp' | 'lift' | 'door'; verification: Confirmation; sourceIds: string[]; reviewedAt: string | null; validFrom: string | null; validUntil: string | null; accessibility: RouteAccessibility }
export interface OperationRecord { id: string; entityId: string; state: 'open' | 'closed'; label: string; sourceIds: string[]; visibility: Visibility; verification: Confirmation; observedAt: string; validFrom: string; validUntil: string }
export interface OperationResult { status: 'unknown' | 'open' | 'closed' | 'expired'; label: string; records: OperationRecord[]; expiresAt: string | null }
export interface VirtualTour { id: string; name: string; campusId: string; mode: 'virtual'; stops: { entityId: string; title: string; sourceIds: string[] }[]; note: string }
export interface CatalogActivity { id: string; title: string; entityId: string; sourceIds: string[]; visibility: Visibility; validFrom: string | null; validUntil: string | null; status: Lifecycle; description: string }
export interface CatalogLayer { id: string; name: string; defaultVisible: boolean; status: Confirmation }
export interface CampusCatalog { schemaVersion: 1; contentVersion: string; assetsVersion: string; datasetVersion: string; activeCampusId: string; metadata: Record<string, unknown>; campuses: PlatformCampus[]; entities: PlatformEntity[]; sources: PlatformSource[]; routes: { nodes: string[]; edges: RouteEdge[] }; operations: OperationRecord[]; tours: VirtualTour[]; events: CatalogActivity[]; services: CatalogActivity[]; layers: CatalogLayer[]; assetManifest?: import('../scene/model-loader').ModelManifest }
export type Catalog = CampusCatalog;
export interface ValidationResult { valid: boolean; errors: string[] }
export interface ImportResult extends ValidationResult { catalog: CampusCatalog | null; diff: CatalogDiff | null }
export interface CatalogDiff { added: string[]; removed: string[]; changed: string[]; changes: { id: string; fields: string[] }[]; sections: string[]; fromVersion: string; toVersion: string }
export interface RouteResult { status: 'found' | 'unavailable'; reason: string; nodes: PlatformEntity[]; edges: RouteEdge[]; distanceMeters: number | null; steps: { fromId: string; toId: string; text: string; distanceMeters: number; kind: string }[]; verified: boolean }
export interface SharedState { version: 1; campusId: string; entityId: string | null; view: 'overview' | 'top' | 'free' | '2d' | 'text'; layers: string[]; floorId: string | null; time: string | null; contentVersion?: string; assetsVersion?: string; releaseId?: string }
export interface ParsedState extends ValidationResult { state: SharedState | null }
export interface TimetableEntry { id: string; entityId: string; title: string; day: number; start: string; end: string }
export interface LocalPreferences { schemaVersion: 1; favorites: string[]; recent: string[]; timetable: TimetableEntry[] }
export interface StoreResult { ok: boolean; value: LocalPreferences; error: string | null }
export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface LocalStore { load(): StoreResult; save(value: LocalPreferences): StoreResult; addFavorite(id: string): StoreResult; removeFavorite(id: string): StoreResult; recordRecent(id: string): StoreResult; saveTimetable(entry: TimetableEntry): StoreResult; removeTimetable(id: string): StoreResult; reset(): StoreResult }
export interface PlatformApi {
 createCatalog(plan: unknown, legacyCampusData: unknown): CampusCatalog;
 validateCatalog(input: unknown): ValidationResult;
 search(catalog: CampusCatalog, query: string, options?: { kind?: string; category?: string; campusId?: string; language?: string }): PlatformEntity[];
 resolve(catalog: CampusCatalog, id: string): PlatformEntity | null;
 route(catalog: CampusCatalog, options: { from?: string; to?: string; fromId?: string; toId?: string; accessible?: boolean; at?: string }): RouteResult;
 operationStatus(recordsOrCatalog: OperationRecord[] | CampusCatalog, entityId: string, at?: string): OperationResult;
 diffCatalog(before: CampusCatalog, after: CampusCatalog): CatalogDiff;
 publicCatalog(catalog: CampusCatalog): CampusCatalog;
 validateImport(input: unknown, current?: CampusCatalog): ImportResult;
 serializeState(state: SharedState): string;
 parseState(input: string | unknown, catalog?: CampusCatalog): ParsedState;
 createLocalStore(storage: StorageAdapter | null | undefined, key?: string): LocalStore;
}
declare global { interface Window { CampusPlatform: PlatformApi } var CampusPlatform: PlatformApi; }
