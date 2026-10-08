export type PointMeters = [number, number] | [number, number, number];
export type MeasurementKind = 'planar-distance' | 'path-distance' | 'height-difference' | 'area';
export interface MeasurementOptions { confirmation?: 'verified' | 'mapped' | 'estimated' | 'unverified'; accuracyMeters?: number; version?: string }
export interface MeasurementResult { value: number; unit: 'm' | 'm2'; approximate: boolean; uncertainty: number | null; version: string | null; points: number }
export interface RegistrationPlacement { units: 'm' | 'cm' | 'mm'; upAxis: 'Y' | 'Z'; origin: [number, number, number]; anchorMeters: [number, number, number]; yawRadians: number; altitudeDatum: string; mode: 'measured' | 'inferred' }
export interface RegistrationLandmark { id: string; role: 'control' | 'holdout'; model: [number, number, number]; siteMeters: [number, number, number] }
export interface RegistrationInput { placement: RegistrationPlacement; landmarks: RegistrationLandmark[]; toleranceMeters: { horizontal: number; vertical: number } }
export interface RegistrationResidual { id: string; role: 'control' | 'holdout'; horizontalMeters: number; verticalMeters: number; distanceMeters: number; predictedMeters: number[]; passed: boolean }
export interface RegistrationReport { residuals: RegistrationResidual[]; holdoutSummary: { count: number; horizontalRmsMeters: number | null; verticalRmsMeters: number | null; horizontalMaxMeters: number | null; verticalMaxMeters: number | null }; passed: boolean; verification: 'independent-check' | 'insufficient-holdout'; confirmationUnchanged: true }
export interface PublicMedia { kind: 'image' | 'audio' | 'video'; path: string; sourceId: string; license: string; public: true; caption?: string }
export interface GlbStatistics { bytes: number; meshes: number; primitives: number; triangles: number; materials: number; textures: number; images: number; vertices: number; bounds: { min: number[]; max: number[] } | null; extensions: string[]; decoderRequired: boolean }
export interface ReleaseAsset { path: string; bytes: number; sha256: string; spaceIds: string[] }
export interface ReleaseBundle { schemaVersion: 1; version: string; catalogVersion: string; modelManifestVersion: string; coordinateReference: string; assets: ReleaseAsset[]; approval: { status: 'draft' | 'approved'; reviewedBy: string | null; reviewedAt: string | null } }
export interface RefinementApi {
  measureGeometry(points: PointMeters[], kind: MeasurementKind, options?: MeasurementOptions): MeasurementResult;
  registrationReport(input: RegistrationInput): RegistrationReport;
  inspectGlb(buffer: ArrayBuffer): GlbStatistics;
  validateMedia(value: unknown): PublicMedia;
  compareRelease(previous: { entities: Record<string, unknown>[] }, next: { entities: Record<string, unknown>[] }): { added: string[]; removed: string[]; changed: string[]; unchanged: string[] };
  validateReleaseBundle(value: unknown): ReleaseBundle;
}
