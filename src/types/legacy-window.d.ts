type LegacyFactory = (scene: unknown, materials: Record<string, unknown>) => Record<string, unknown>;
interface Window {
  JanggongModel: { createJanggongModel?: LegacyFactory };
  PilheonModel: { createPilheonModel?: LegacyFactory };
  ManwooModel: { createManwooModel?: LegacyFactory };
  ShalomModel: { createShalomModel?: LegacyFactory };
}
