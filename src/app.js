// Generated from src/bootstrap.ts and src/app.ts; run npm run build.
"use strict";
(() => {
  // src/app.ts
  function material(scene, name, color, roughness = 0.9, alpha = 1) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString(color);
    mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    mat.roughness = roughness;
    mat.alpha = alpha;
    if (alpha < 1) {
      mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
      mat.needDepthPrePass = true;
    }
    return mat;
  }
  function createMaterials(scene) {
    return {
      grass: material(scene, "transparent-terrain-slope", "#8bcf6c", 0.9, 0.56),
      water: material(scene, "water", "#7eb9c0", 0.35),
      retaining: material(scene, "campus-retaining-wall", "#8d8271"),
      road: material(scene, "road", "#6f695d", 0.9, 0.82),
      pedestrian: material(scene, "pedestrian-path", "#e5d7a2", 0.9, 0.62),
      entranceWalk: material(scene, "entrance-direction-walk", "#d8c99d", 0.9, 0.45),
      entranceArrow: material(scene, "entrance-direction-arrow", "#2c6144"),
      plaza: material(scene, "plaza", "#d9cd9f"),
      parking: material(scene, "parking", "#cfc69e"),
      parkingLine: material(scene, "parking-line", "#f8f1d2"),
      scale: material(scene, "scale-ruler", "#173625"),
      scaleTick: material(scene, "scale-ruler-tick", "#f8f1d2"),
      wall: material(scene, "janggong-wall", "#d8d1c2"),
      sideWall: material(scene, "janggong-side-wall", "#c7b899"),
      pilheonWall: material(scene, "pilheon-wall", "#d6d2bf"),
      pilheonCore: material(scene, "pilheon-stair-core", "#b8b29c"),
      pilheonRoof: material(scene, "pilheon-roof", "#d9c28f"),
      manwooWall: material(scene, "manwoo-wall", "#b8b09d"),
      manwooSideWall: material(scene, "manwoo-side-wall", "#a79c83"),
      manwooRoof: material(scene, "manwoo-aged-roof", "#ded2a5"),
      manwooCorridor: material(scene, "manwoo-exterior-corridor", "#e5d6b4"),
      manwooStair: material(scene, "manwoo-exterior-stair", "#918a77"),
      manwooLounge: material(scene, "manwoo-lounge-glass", "#6ca3a8", 0.35),
      manwooHighlightWindow: material(scene, "manwoo-highlight-window", "#315e69", 0.35),
      shalomWall: material(scene, "shalom-wall", "#d9d0bd"),
      shalomPlinth: material(scene, "shalom-catacomb-plinth", "#8d8777"),
      shalomPorch: material(scene, "shalom-front-porch", "#c7b99c"),
      shalomOffice: material(scene, "shalom-office-4106", "#c8d2be"),
      shalomRoof: material(scene, "shalom-pitched-roof", "#7f5645"),
      shalomRidge: material(scene, "shalom-roof-ridge", "#5f4138"),
      shalomGlass: material(scene, "shalom-stained-glass", "#5c8fa4", 0.25),
      shalomCross: material(scene, "shalom-cross", "#e7ddbe"),
      immanuelWall: material(scene, "immanuel-student-union-wall", "#d3c8af"),
      immanuelBase: material(scene, "immanuel-basement-base", "#8f8876"),
      immanuelRoof: material(scene, "immanuel-flat-warm-roof", "#b99a72"),
      immanuelFoodGlass: material(scene, "immanuel-cafeteria-glass", "#85b6b4", 0.28),
      immanuelStore: material(scene, "immanuel-emart24-storefront", "#345a4b"),
      immanuelKitchen: material(scene, "immanuel-kitchen-service-band", "#a77f5e"),
      immanuelCanopy: material(scene, "immanuel-entry-canopy", "#e2d7b2"),
      immanuelClubGlass: material(scene, "immanuel-club-room-glass", "#315f67", 0.32),
      immanuelStudioGlass: material(scene, "immanuel-hbs-studio-glass", "#5d99a9", 0.24),
      immanuelNotice: material(scene, "immanuel-student-org-room", "#a7bf8c"),
      gyeongsamWall: material(scene, "gyeongsam-library-wall", "#c9c1ad"),
      gyeongsamSideWall: material(scene, "gyeongsam-book-stack-wall", "#b7ad97"),
      gyeongsamLobbyWall: material(scene, "gyeongsam-east-lobby-wall", "#d7d0bb"),
      gyeongsamRoof: material(scene, "gyeongsam-flat-roof", "#e3ddbf"),
      gyeongsamTrim: material(scene, "gyeongsam-horizontal-trim", "#8e8065"),
      gyeongsamGlass: material(scene, "gyeongsam-atrium-glass", "#7eaeb6", 0.25),
      gyeongsamTopGlass: material(scene, "gyeongsam-makerspace-glass", "#5f97a4", 0.26),
      gyeongsamLounge: material(scene, "gyeongsam-lounge-glass", "#91b08c", 0.3),
      gyeongsamWindow: material(scene, "gyeongsam-library-window", "#2f5863", 0.3),
      songamWall: material(scene, "songam-yusa-hall-wall", "#c9bfa8"),
      songamSideWall: material(scene, "songam-lab-wing-wall", "#b8ad94"),
      songamStageWall: material(scene, "songam-stage-back-wall", "#9d927b"),
      songamRoof: material(scene, "songam-flat-roof", "#eee6c5"),
      songamGlass: material(scene, "songam-hall-glass", "#79aab2", 0.26),
      songamWindow: material(scene, "songam-classroom-window", "#2f5863", 0.3),
      songamTrim: material(scene, "songam-front-trim", "#8d7d62"),
      sotongWall: material(scene, "sotong-professor-wall", "#c6bca5"),
      sotongCore: material(scene, "sotong-stair-core", "#938873"),
      sotongMuseum: material(scene, "sotong-museum-wing", "#b5c09d"),
      sotongRoof: material(scene, "sotong-flat-roof", "#e6dfc0"),
      sotongGlass: material(scene, "sotong-entry-glass", "#78a9b0", 0.26),
      sotongAccent: material(scene, "sotong-admin-accent", "#9ebc8f", 0.32),
      sotongWindow: material(scene, "sotong-office-window", "#315a64", 0.3),
      sotongTrim: material(scene, "sotong-horizontal-trim", "#8b7d63"),
      practiceWall: material(scene, "practice-workshop-wall", "#c9c0aa"),
      practiceSideWall: material(scene, "practice-startup-wing-wall", "#b8ae96"),
      practiceBase: material(scene, "practice-concrete-base", "#837c6b"),
      practiceRoof: material(scene, "practice-low-flat-roof", "#e6ddbd"),
      practiceGlass: material(scene, "practice-startup-glass", "#75a7ae", 0.26),
      practiceWindow: material(scene, "practice-lab-window", "#2f5964", 0.3),
      practiceDoor: material(scene, "practice-loading-door", "#496a65"),
      practiceTrim: material(scene, "practice-industrial-trim", "#81745d"),
      hanulWall: material(scene, "hanul-gymnasium-wall", "#d0c7b4"),
      hanulSideWall: material(scene, "hanul-side-wing-wall", "#b7ad98"),
      hanulBase: material(scene, "hanul-athletic-base", "#8b8575"),
      hanulRoof: material(scene, "hanul-wide-roof", "#e9e0bd"),
      hanulRoofRidge: material(scene, "hanul-raised-roof-ridge", "#c0a782"),
      hanulGlass: material(scene, "hanul-entry-glass", "#78a9b0", 0.26),
      hanulWindow: material(scene, "hanul-high-window", "#315a64", 0.3),
      hanulTrim: material(scene, "hanul-horizontal-trim", "#81745d"),
      seongbinWall: material(scene, "seongbin-new-dorm-wall", "#c6bb9f"),
      seongbinOldWall: material(scene, "seongbin-old-dorm-wall", "#b7aa91"),
      seongbinCore: material(scene, "seongbin-common-core", "#d3c7aa"),
      seongbinBase: material(scene, "seongbin-raised-base", "#837a69"),
      seongbinRoof: material(scene, "seongbin-red-brown-roof", "#9b6756"),
      seongbinGlass: material(scene, "seongbin-entry-glass", "#78a9b0", 0.26),
      seongbinWindow: material(scene, "seongbin-dorm-room-window", "#2f5964", 0.3),
      saeromWall: material(scene, "saerom-media-hall-wall", "#c8bea7"),
      saeromCafeWall: material(scene, "saerom-cafe-wall", "#d9c9a4"),
      saeromBase: material(scene, "saerom-park-base", "#867d6b"),
      saeromRoof: material(scene, "saerom-low-flat-roof", "#e8dfbd"),
      saeromTerrace: material(scene, "saerom-cafe-terrace", "#bca27b"),
      saeromGlass: material(scene, "saerom-cafe-glass", "#78a9b0", 0.26),
      saeromWindow: material(scene, "saerom-media-window", "#2f5964", 0.3),
      saeromAccent: material(scene, "saerom-cafe-sign-band", "#6a8f74"),
      haeoreumWall: material(scene, "haeoreum-third-lecture-wall", "#cbbfa7"),
      haeoreumSideWall: material(scene, "haeoreum-lab-wing-wall", "#b8ad96"),
      haeoreumCore: material(scene, "haeoreum-stair-core", "#938873"),
      haeoreumBase: material(scene, "haeoreum-raised-base", "#857c6b"),
      haeoreumRoof: material(scene, "haeoreum-flat-roof", "#e6ddbd"),
      haeoreumGlass: material(scene, "haeoreum-lounge-glass", "#78a9b0", 0.26),
      haeoreumWindow: material(scene, "haeoreum-class-window", "#315a64", 0.3),
      haeoreumService: material(scene, "haeoreum-post-health-band", "#93ae86"),
      joonhaWall: material(scene, "joonha-unification-wall", "#c9bea5"),
      joonhaSideWall: material(scene, "joonha-conference-wing-wall", "#b8ad96"),
      joonhaBase: material(scene, "joonha-memorial-base", "#837a68"),
      joonhaRoof: material(scene, "joonha-flat-roof", "#e6ddbd"),
      joonhaGlass: material(scene, "joonha-memorial-glass", "#78a9b0", 0.26),
      joonhaWindow: material(scene, "joonha-office-window", "#315a64", 0.3),
      joonhaMemorial: material(scene, "joonha-memory-room-panel", "#9f8160"),
      joonhaGarden: material(scene, "joonha-central-garden", "#6f9a63"),
      joonhaStone: material(scene, "joonha-dolbegae-stone", "#5f5b53"),
      neutbomWall: material(scene, "neutbom-modern-wall", "#d0c6b2"),
      neutbomCore: material(scene, "neutbom-elevator-core", "#a89f8c"),
      neutbomBase: material(scene, "neutbom-visible-b1-base", "#827969"),
      neutbomRoof: material(scene, "neutbom-clean-roof", "#e8dfbd"),
      neutbomGlass: material(scene, "neutbom-learning-glass", "#78a9b0", 0.26),
      neutbomStudioGlass: material(scene, "neutbom-studio-glass", "#5d99a9", 0.24),
      neutbomWindow: material(scene, "neutbom-class-window", "#315a64", 0.3),
      neutbomAccent: material(scene, "neutbom-media-accent", "#668f75"),
      neutbomBridge: material(scene, "neutbom-manwoo-bridge", "#c8bea7"),
      childcareWall: material(scene, "childcare-main-wall", "#d8ccb5"),
      childcareSideWall: material(scene, "childcare-auditorium-wall", "#c2b296"),
      childcareBase: material(scene, "childcare-safe-base", "#867c69"),
      childcareRoof: material(scene, "childcare-warm-roof", "#c78064"),
      childcareGlass: material(scene, "childcare-entry-glass", "#78a9b0", 0.26),
      childcareWindow: material(scene, "childcare-room-window", "#315a64", 0.3),
      childcareAccent: material(scene, "childcare-therapy-room-panel", "#a8bd8c"),
      childcareSand: material(scene, "childcare-sand-yard", "#dbc690"),
      childcareGarden: material(scene, "childcare-nature-yard", "#7fa568"),
      childcarePlay: material(scene, "childcare-play-equipment", "#d89b5f"),
      childcareSlide: material(scene, "childcare-slide", "#7eb9c0"),
      childcareFence: material(scene, "childcare-play-fence", "#f2e5bd"),
      roof: material(scene, "janggong-roof", "#b99673"),
      trim: material(scene, "janggong-floor-trim", "#8f8066"),
      column: material(scene, "janggong-entry-column", "#d7d0bf"),
      stone: material(scene, "janggong-stone", "#c9c2b2"),
      relief: material(scene, "janggong-relief-panel", "#7e6a4d"),
      bronze: material(scene, "janggong-bronze", "#9b7045"),
      glass: material(scene, "janggong-glass", "#8bb7bf", 0.25),
      window: material(scene, "janggong-window", "#375d68", 0.28),
      floorSlab: material(scene, "janggong-floor-plan-slab", "#e9dec2", 0.9, 0.72),
      corridor: material(scene, "janggong-plan-corridor", "#d8cda6"),
      roomLobby: material(scene, "janggong-room-lobby", "#79b6bd"),
      roomOffice: material(scene, "janggong-room-office", "#b7c98e"),
      roomRestroom: material(scene, "janggong-room-restroom", "#aebbd0"),
      roomMeeting: material(scene, "janggong-room-meeting", "#d19a71"),
      roomLecture: material(scene, "room-lecture", "#9fc7a3"),
      redRoof: material(scene, "red-roof", "#c6765f"),
      creamWall: material(scene, "cream-wall", "#e9e1cf")
    };
  }

  // src/data/model-manifest.json
  var model_manifest_default = {
    schemaVersion: 1,
    campusId: "hanshin-gg",
    version: "2026-10-07-refinement-lod-1",
    models: [
      {
        id: "janggong",
        legacyId: "janggong",
        kind: "legacy",
        global: "JanggongModel",
        export: "createJanggongModel",
        source: "src/models/janggong.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/janggong-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                33.33624839782715,
                -14.078598022460938,
                39.54559087753296
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 53168,
            sha256: "057523e477b9d6be1b6f1db0563360c9b6fc8754336894e8c9c9e64fa48ce027"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/janggong.js",
            global: "JanggongModel",
            export: "createJanggongModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "3f5b77928cc085da4599ce4b2e4b6c3647763398f6e93b7f5ca2bb84f5ef9647"
        }
      },
      {
        id: "pilheon",
        legacyId: "pilheon",
        kind: "legacy",
        global: "PilheonModel",
        export: "createPilheonModel",
        source: "src/models/pilheon.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/pilheon-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                31.85314416885376,
                -23.918986320495605,
                38.02574157714844
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 21284,
            sha256: "794b00f0c0bbb0640267879fc1e8b2b43d334ce201ec04c93483b0629a86ce09"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/pilheon.js",
            global: "PilheonModel",
            export: "createPilheonModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "bd649f13cbcd9657a57669063529517121187c0241d9de8a0d6fd22c1dd5ce45"
        }
      },
      {
        id: "manwoo",
        legacyId: "manwoo",
        kind: "legacy",
        global: "ManwooModel",
        export: "createManwooModel",
        source: "src/models/manwoo.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/manwoo-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -8.632627725601196,
                -94.59164619445801,
                82.27270126342773
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 63888,
            sha256: "a061579c93cc26932fbedc074bcc764bee039d03137cc2d44819a083920e5967"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/manwoo.js",
            global: "ManwooModel",
            export: "createManwooModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "d12d7ce7923e9bfaa348948dba17bc33d76cd45381d8a824e80f44aac8bfaafa"
        }
      },
      {
        id: "shalom",
        legacyId: "shalom",
        kind: "legacy",
        global: "ShalomModel",
        export: "createShalomModel",
        source: "src/models/shalom.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/shalom-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -101.8575668334961,
                -16.10189437866211,
                57.79510021209717
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 24608,
            sha256: "3c8ff8f10e825404ecd20419dfa3eb3e172f363687ff3ab79fc26687fb231728"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/shalom.js",
            global: "ShalomModel",
            export: "createShalomModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "2a28de597968476feed1faf71a97c4b15cc1ddbd7691cf1008b66ec6115fcd58"
        }
      },
      {
        id: "immanuel",
        legacyId: "immanuel",
        kind: "legacy",
        global: "ImmanuelModel",
        export: "createImmanuelModel",
        source: "src/models/immanuel.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/immanuel-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -104.1875171661377,
                32.519004344940186,
                11.560828685760498
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 31128,
            sha256: "fca90519113ce565fe4a5cbf9859af6bf2dc44349905eeef6d1348eb528449fa"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/immanuel.js",
            global: "ImmanuelModel",
            export: "createImmanuelModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "6457c936e36bb8463c8dfd24a99f6e59a3c36fb70017e021f12233f6655c1145"
        }
      },
      {
        id: "gyeongsam",
        legacyId: "gyeongsam",
        kind: "legacy",
        global: "GyeongsamModel",
        export: "createGyeongsamModel",
        source: "src/models/gyeongsam.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/gyeongsam-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                43.86031627655029,
                66.9117546081543,
                10.483816862106323
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 38476,
            sha256: "9234aa2ad51abd163b7fd5bad515567d91cd0754215a2241b3478a769dcebabe"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/gyeongsam.js",
            global: "GyeongsamModel",
            export: "createGyeongsamModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "fb41511105c936b3954c3fdfbc44d9c7c98f97a9edc580065763330ed6daa116"
        }
      },
      {
        id: "songam",
        legacyId: "songam",
        kind: "legacy",
        global: "SongamModel",
        export: "createSongamModel",
        source: "src/models/songam.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/songam-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                163.6754035949707,
                17.805488109588623,
                17.742464542388916
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 37348,
            sha256: "91f823be5ae3866e9fe8baa0ef8e21a906381f70ed2d222f550fee6b2ea87146"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/songam.js",
            global: "SongamModel",
            export: "createSongamModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "71898210800ff70d88dfe74be6a005d4581c4e382d757b7de4046595621e7bd1"
        }
      },
      {
        id: "sotong",
        legacyId: "sotong",
        kind: "legacy",
        global: "SotongModel",
        export: "createSotongModel",
        source: "src/models/sotong.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/sotong-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                79.73101615905762,
                56.40125274658203,
                15.113754272460938
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 52608,
            sha256: "50f4dcfbbf5b00380930f6c4bbb81c4fcf1da2dc2374340fd291eb2b4c3ccaf8"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/sotong.js",
            global: "SotongModel",
            export: "createSotongModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "2181019402287946bdd2b8cb079db4fe353347416887fb29c141a77fa9bbf2f1"
        }
      },
      {
        id: "practice",
        legacyId: "practice",
        kind: "legacy",
        global: "PracticeModel",
        export: "createPracticeModel",
        source: "src/models/practice.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/practice-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                306.1338233947754,
                -19.902286529541016,
                23.726017475128174
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 30288,
            sha256: "94278e3878dcee86ea06528794be4ed6e954ee15ab7df1323cd42bd88e9eabbb"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/practice.js",
            global: "PracticeModel",
            export: "createPracticeModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "c91e6d34c0cab980ccb6871b035d5d32a0769ccb65baf1fbe2394ebc876a40d3"
        }
      },
      {
        id: "hanul",
        legacyId: "hanul",
        kind: "legacy",
        global: "HanulModel",
        export: "createHanulModel",
        source: "src/models/hanul.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/hanul-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -315.62768936157227,
                77.90571689605713,
                18.222535848617554
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 31708,
            sha256: "a32ecb457f8604cc2b93d06feca103ba8dcdd2fe7c3cc77de7e98e5a458ade7e"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/hanul.js",
            global: "HanulModel",
            export: "createHanulModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "f358e62a668b5e1a1aac1f87ac53d0e8acc98f4f207dc0300d66238abb4814e5"
        }
      },
      {
        id: "seongbin",
        legacyId: "seongbin",
        kind: "legacy",
        global: "SeongbinModel",
        export: "createSeongbinModel",
        source: "src/models/seongbin.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/seongbin-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -438.59779357910156,
                141.4022922515869,
                3.1736326217651367
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 88512,
            sha256: "6e152e710a62525e4cf77befe9a8f27063d157452109a0a19d8f18c14a19df83"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/seongbin.js",
            global: "SeongbinModel",
            export: "createSeongbinModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "f09f1d7d5e38bff389149b6430269641ac90e7d52fe30eb79722e1f3dbc43a43"
        }
      },
      {
        id: "saerom",
        legacyId: "saerom",
        kind: "legacy",
        global: "SaeromModel",
        export: "createSaeromModel",
        source: "src/models/saerom.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/saerom-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                73.32054138183594,
                -31.979854106903076,
                48.30609321594238
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 22344,
            sha256: "e5f037bcfb3b72222ed42a7e7ba98744ca693ec4266d80c06125582aed5afec6"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/saerom.js",
            global: "SaeromModel",
            export: "createSaeromModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "bad31be811112f888180686cfcf51494134f6f583ce0d728aa973c4943e10bbe"
        }
      },
      {
        id: "haeoreum",
        legacyId: "haeoreum",
        kind: "legacy",
        global: "HaeoreumModel",
        export: "createHaeoreumModel",
        source: "src/models/haeoreum.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/haeoreum-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                -70.83884716033936,
                75.49456119537354,
                8.701403141021729
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 43976,
            sha256: "be91595e94c08a06ff9edb0c755511784534157aa5433800006f2f6a67c44dcc"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/haeoreum.js",
            global: "HaeoreumModel",
            export: "createHaeoreumModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "5502a2bf6166580237d69450aef5ebfd19d372f52782325c6cc813f0194e84bd"
        }
      },
      {
        id: "joonha",
        legacyId: "joonha",
        kind: "legacy",
        global: "JoonhaModel",
        export: "createJoonhaModel",
        source: "src/models/joonha.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/joonha-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                345.00858306884766,
                -89.37261581420898,
                52.92836666107178
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 61976,
            sha256: "5e7ab30d38506b19dcc98b40e7cb73a9bd5c7b03b93631ec9f4fc404244af3c6"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/joonha.js",
            global: "JoonhaModel",
            export: "createJoonhaModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "2938bca349791b854d93656334ff1e11b8ca6263f305a2798ae04eb32ff7b24f"
        }
      },
      {
        id: "neutbom",
        legacyId: "neutbom",
        kind: "legacy",
        global: "NeutbomModel",
        export: "createNeutbomModel",
        source: "src/models/neutbom.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/neutbom-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                22.81796932220459,
                -64.2249870300293,
                89.18909072875977
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 65548,
            sha256: "92564da8f841829f9b54c31932f1021dfc80997996803c4cda76e6963489ed5b"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/neutbom.js",
            global: "NeutbomModel",
            export: "createNeutbomModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "20825d1f84752b9e2ac0c9ac9dcefba566b18cf8dbded632f37c356d3550fcc2"
        }
      },
      {
        id: "childcare",
        legacyId: "childcare",
        kind: "legacy",
        global: "ChildcareModel",
        export: "createChildcareModel",
        source: "src/models/childcare.js",
        status: "estimated",
        variants: [
          {
            id: "overview",
            kind: "glb",
            source: "assets/models/generated/childcare-overview.glb",
            placement: {
              units: "m",
              upAxis: "Y",
              origin: [
                0,
                0,
                0
              ],
              anchorMeters: [
                457.8369140625,
                -164.6318817138672,
                44.188528060913086
              ],
              yawRadians: 0,
              altitudeDatum: "local-site-meters",
              mode: "inferred"
            },
            minScreenCoverage: 0,
            bytes: 32828,
            sha256: "e8c4e857f99e3e2b8a84fe91d7fb3e7387fb411756f41d139c3efc3514186c4d"
          },
          {
            id: "close",
            kind: "legacy",
            source: "src/models/childcare.js",
            global: "ChildcareModel",
            export: "createChildcareModel",
            minScreenCoverage: 0.045,
            maxDistanceMeters: 160
          }
        ],
        provenance: {
          sourceId: "legacy-model-envelope",
          license: "Project-authored estimated geometry; external source reuse rights must be checked separately",
          creator: "campus-project",
          tool: "Babylon NullEngine 9.29.0 + Campus triangle writer 1",
          settings: "existing alignment, one primitive per material, no triangles deleted",
          sourceHash: "a10c3e8c52565edcc2d15a1c9ed13426514ab62c4b0abe21ebb08e85f03d2c54"
        }
      }
    ]
  };

  // assets/media/manifest.json
  var manifest_default = {
    schemaVersion: 1,
    version: "hanshin-media-unregistered-1",
    records: []
  };

  // assets/ar/manifest.json
  var manifest_default2 = {
    schemaVersion: 1,
    version: "hanshin-ar-unregistered-1",
    anchors: []
  };

  // src/scene/refinement-runtime.ts
  function measureOutlineGeometry(geometry, measure, version) {
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) || geometry.coordinateSystem !== "local-meters" || geometry.unit !== "m") throw new Error("\uC724\uACFD \uCE21\uC815\uC5D0\uB294 \uBCC0\uD658\uB41C \uBBF8\uD130 \uC88C\uD45C\uC758 Polygon \uB610\uB294 MultiPolygon\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(polygons) || !polygons.length || polygons.length > 64) throw new Error("\uC724\uACFD \uAD6C\uC131\uC694\uC18C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    const rings = [];
    let value = 0, pointCount = 0, holeCount = 0;
    for (const [polygonIndex, polygon] of polygons.entries()) {
      if (!Array.isArray(polygon) || !polygon.length || polygon.length > 64) throw new Error("\uC724\uACFD\uC5D0\uB294 \uC678\uACFD \uB9C1\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      let polygonArea = 0;
      for (const [ringIndex, ring] of polygon.entries()) {
        if (!Array.isArray(ring) || !ring.every((point2) => Array.isArray(point2) && point2.length === 2 && point2.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)))) throw new Error("\uC724\uACFD \uC88C\uD45C\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        pointCount += ring.length;
        if (pointCount > 1e3) throw new Error("\uC7A5\uBA74 \uC724\uACFD \uCE21\uC815\uC740 \uCD5C\uB300 1000\uC810\uAE4C\uC9C0 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.");
        const area = measure(ring, "area", { confirmation: "estimated", version });
        polygonArea += ringIndex === 0 ? area.value : -area.value;
        if (ringIndex > 0) holeCount++;
        rings.push({ polygonIndex, role: ringIndex === 0 ? "outer" : "hole", points: ring.map((point2) => [...point2]), value: area.value });
      }
      if (polygonArea <= 0) throw new Error("\uACF5\uC81C \uC601\uC5ED\uC774 \uC678\uACFD \uBA74\uC801\uC744 \uCD08\uACFC\uD569\uB2C8\uB2E4.");
      value += polygonArea;
    }
    return { value, unit: "m2", approximate: true, uncertainty: null, version, points: pointCount, polygonCount: polygons.length, holeCount, rings };
  }
  var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  var PUBLIC_NOTE = "\uD45C\uC2DD\uC740 \uB4F1\uB85D \uB300\uC0C1\uC758 \uC704\uCE58\uB97C \uC548\uB0B4\uD569\uB2C8\uB2E4. \uC2E4\uC81C \uACF5\uC0AC \uBA74\uC801\xB7\uD1B5\uD589 \uAC00\uB2A5\uC131\xB7\uC2E4\uCE21 \uACBD\uACC4\uB97C \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
  function createRefinementRuntime(B, scene, site, catalogGetter) {
    const globals = globalThis;
    const apis = () => ({ refinement: globals.window?.CampusRefinement || globals.CampusRefinement, platform: globals.window?.CampusPlatform || globals.CampusPlatform });
    const diagnostics = site.getDiagnostics();
    const metersPerUnit = typeof diagnostics.metersPerUnit === "number" && diagnostics.metersPerUnit > 0 ? diagnostics.metersPerUnit : 10;
    const baseClearColor = scene.clearColor.clone();
    const baseAmbient = scene.ambientColor.clone();
    const originalLights = scene.lights.map((light) => ({ light, intensity: light.intensity, diffuse: light.diffuse.clone(), specular: light.specular.clone() }));
    const floorSnapshots = /* @__PURE__ */ new Map();
    const clonedMaterials = /* @__PURE__ */ new Set();
    const themeMeshes = [];
    const measurementMeshes = [];
    let disposed = false;
    let lighting = "guide";
    let floorReport = { applied: true, reason: "\uC678\uAD00\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.", floorId: null, mode: "exterior", meshCount: 0 };
    let themeReport = { theme: "default", at: (/* @__PURE__ */ new Date()).toISOString(), items: [], legend: [], unavailable: 0, note: PUBLIC_NOTE };
    let measurement = null;
    const assertActive = () => {
      if (disposed) throw new Error("\uC885\uB8CC\uB41C \uC7A5\uBA74 \uACE0\uB3C4\uD654 \uAE30\uB2A5\uC785\uB2C8\uB2E4.");
    };
    function publicEntities(catalog) {
      const entities = new Map(catalog.entities.map((entity) => [entity.id, entity]));
      return catalog.entities.filter((entity) => {
        if (entity.visibility !== "public" || entity.sensitive || entity.campusId !== catalog.activeCampusId) return false;
        const seen = /* @__PURE__ */ new Set();
        let parentId = entity.parentId;
        while (parentId) {
          const parent = entities.get(parentId);
          if (!parent || parent.visibility !== "public" || parent.sensitive || seen.has(parent.id)) return false;
          seen.add(parent.id);
          parentId = parent.parentId;
        }
        return true;
      });
    }
    function copyTheme() {
      return { ...themeReport, items: themeReport.items.map((item) => ({ ...item, pointMeters: [...item.pointMeters] })), legend: themeReport.legend.map((item) => ({ ...item })) };
    }
    function disposeLines(list) {
      list.splice(0).forEach((mesh) => mesh.dispose());
    }
    function positionFor(entity, map) {
      let item = entity;
      const seen = /* @__PURE__ */ new Set();
      while (item && !seen.has(item.id)) {
        seen.add(item.id);
        if (item.position && [item.position.east, item.position.north].every(Number.isFinite)) {
          const up = typeof item.position.up === "number" && Number.isFinite(item.position.up) ? item.position.up : 0;
          return { point: [item.position.east, item.position.north, up], indirect: item.id !== entity.id };
        }
        item = map.get(item.owningBuildingId || item.parentId || "");
      }
      return null;
    }
    function drawTheme(items) {
      disposeLines(themeMeshes);
      const groups = /* @__PURE__ */ new Map();
      for (const item of items) {
        const [east, north] = item.pointMeters;
        const x = east / metersPerUnit, z = -north / metersPerUnit;
        const height = site.terrainHeightAt(x, z) + 0.2;
        const radius = 1.8 / metersPerUnit;
        const key = `${item.color}:${item.pattern}`;
        const group = groups.get(key) || { item, lines: [], ids: [] };
        group.ids.push(item.entityId);
        for (let index = 0; index < 24; index++) {
          if (item.pattern === "dot" && index % 3 !== 0 || item.pattern === "dash" && index % 4 === 3 || item.pattern === "cross" && index % 2 !== 0) continue;
          const a = index * Math.PI / 12, b = (index + 1) * Math.PI / 12;
          group.lines.push([new B.Vector3(x + Math.cos(a) * radius, height, z + Math.sin(a) * radius), new B.Vector3(x + Math.cos(b) * radius, height, z + Math.sin(b) * radius)]);
        }
        if (item.pattern === "cross") group.lines.push([new B.Vector3(x - radius, height, z - radius), new B.Vector3(x + radius, height, z + radius)], [new B.Vector3(x - radius, height, z + radius), new B.Vector3(x + radius, height, z - radius)]);
        groups.set(key, group);
      }
      for (const [key, group] of groups) {
        if (!group.lines.length) continue;
        const mesh = B.MeshBuilder.CreateLineSystem(`refinement-theme-${key}`, { lines: group.lines }, scene);
        mesh.color = B.Color3.FromHexString(group.item.color);
        mesh.isPickable = false;
        mesh.metadata = { refinementOverlay: "theme", entityIds: [...group.ids], scope: "point-only", representsActualArea: false, visualPriority: "essential" };
        themeMeshes.push(mesh);
      }
    }
    function setTheme(theme, at = (/* @__PURE__ */ new Date()).toISOString()) {
      assertActive();
      if (!["default", "operations", "source-confidence", "lifecycle", "category", "none", "events", "construction", "access", "hours"].includes(theme) || !Number.isFinite(Date.parse(at))) throw new Error("\uC8FC\uC81C \uB610\uB294 \uC870\uD68C \uC2DC\uAC01\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const catalog = catalogGetter();
      const entities = publicEntities(catalog);
      const map = new Map(entities.map((entity) => [entity.id, entity]));
      const sourceIds = new Set(catalog.sources.filter((source) => source.visibility === "public").map((source) => source.id));
      const items = [];
      const legend = /* @__PURE__ */ new Map();
      let unavailable = 0;
      const add = (entity, key, label, color, pattern, validUntil = null) => {
        const position = positionFor(entity, map);
        if (!position) {
          unavailable++;
          return;
        }
        if (items.length >= 500) {
          unavailable++;
          return;
        }
        items.push({ entityId: entity.id, label: `${label}${position.indirect ? " \xB7 \uC18C\uC18D \uAC74\uBB3C \uC704\uCE58\uC758 \uACF5\uAC04 \uAE30\uB85D" : ""}`, color, pattern, scope: "point-only", pointMeters: position.point, validUntil });
        legend.set(key, { key, label, color, pattern });
      };
      if (["source-confidence", "lifecycle", "category"].includes(theme)) {
        const palette = ["#285940", "#497386", "#8c6926", "#865577", "#62665d"];
        for (const entity of entities.filter((entry) => ["building", "external-facility", "door"].includes(entry.kind))) {
          if (theme === "source-confidence") {
            const confirmation = entity.claims.location.confidence;
            const index = ["verified", "mapped", "estimated", "unverified"].indexOf(confirmation);
            const names = { verified: "\uAC80\uC218 \uD655\uC778", mapped: "\uC9C0\uB3C4 \uAE30\uBC18", estimated: "\uCD94\uC815", unverified: "\uBBF8\uD655\uC778" };
            add(entity, confirmation, `\uC704\uCE58 \uADFC\uAC70 ${names[confirmation]}`, palette[Math.max(0, index)], ["solid", "dash", "dot", "cross"][Math.max(0, index)]);
          } else if (theme === "lifecycle") {
            const index = ["current", "historic", "proposed"].indexOf(entity.status);
            const names = { current: "\uD604\uC7AC", historic: "\uACFC\uAC70", proposed: "\uACC4\uD68D" };
            add(entity, entity.status, `\uC790\uB8CC \uC0C1\uD0DC ${names[entity.status]}`, palette[Math.max(0, index)], ["solid", "dot", "dash"][Math.max(0, index)]);
          } else {
            const key = entity.category || "\uBBF8\uBD84\uB958";
            const index = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
            add(entity, key, key, palette[index], index % 2 ? "dash" : "solid");
          }
        }
      } else if (["operations", "access", "hours"].includes(theme)) {
        const domain = apis().platform;
        if (!domain) unavailable++;
        else for (const entity of entities.filter((entry) => catalog.operations.some((record2) => record2.entityId === entry.id))) {
          const status = domain.operationStatus(catalog, entity.id, at);
          if (theme === "access" && status.status !== "closed" || theme === "hours" && status.status !== "open") continue;
          const style = status.status === "closed" ? { color: "#8a4657", pattern: "cross" } : status.status === "open" ? { color: "#285940", pattern: "solid" } : { color: "#767469", pattern: "dot" };
          add(entity, status.status, status.label, style.color, style.pattern, status.expiresAt);
        }
      } else if (["events", "construction"].includes(theme)) {
        for (const event of catalog.events) {
          const entity = map.get(event.entityId);
          if (!entity || event.visibility !== "public" || !event.sourceIds.length || !event.sourceIds.every((id2) => sourceIds.has(id2)) || event.status !== "current" || event.validFrom && Date.parse(event.validFrom) > Date.parse(at)) continue;
          if (theme === "construction" && !/공사|construction/i.test(event.title)) continue;
          const expired = Boolean(event.validUntil && Date.parse(event.validUntil) <= Date.parse(at));
          add(entity, expired ? "expired" : "event", `${event.title}${expired ? " \xB7 \uAE30\uAC04 \uB9CC\uB8CC" : ""}`, expired ? "#767469" : "#8c6926", expired ? "dot" : "dash", event.validUntil);
        }
      }
      themeReport = { theme, at: new Date(at).toISOString(), items, legend: [...legend.values()], unavailable, note: PUBLIC_NOTE };
      drawTheme(items);
      return copyTheme();
    }
    function setLighting(mode) {
      assertActive();
      if (!["guide", "observe", "evening"].includes(mode)) throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC870\uBA85\uC785\uB2C8\uB2E4.");
      lighting = mode;
      for (const saved of originalLights) {
        if (saved.light.isDisposed()) continue;
        saved.light.intensity = mode === "guide" ? saved.intensity : mode === "observe" ? saved.intensity * 1.15 : saved.intensity * 0.65;
        saved.light.diffuse.copyFrom(mode === "evening" ? B.Color3.FromHexString("#edc69b") : saved.diffuse);
        saved.light.specular.copyFrom(saved.specular);
      }
      scene.clearColor.copyFrom(mode === "evening" ? new B.Color4(0.46, 0.48, 0.45, 1) : baseClearColor);
      scene.ambientColor.copyFrom(baseAmbient);
      return { mode, simulated: mode !== "guide", realSolarAnalysis: false };
    }
    function restoreFloors() {
      for (const [mesh, saved] of floorSnapshots) {
        if (mesh.isDisposed()) continue;
        mesh.setEnabled(saved.enabled);
        mesh.isVisible = saved.visible;
        mesh.visibility = saved.visibility;
        mesh.position.copyFrom(saved.position);
        mesh.material = saved.material;
      }
      floorSnapshots.clear();
      for (const material2 of clonedMaterials) material2.dispose(false, false);
      clonedMaterials.clear();
    }
    function semanticMeshes(entities) {
      const map = new Map(entities.map((entity) => [entity.id, entity]));
      const result = [];
      for (const mesh of scene.meshes) {
        if (mesh.isDisposed() || isRecord(mesh.metadata) && mesh.metadata.refinementOverlay) continue;
        let entityId = null, floorId = null;
        let node = mesh;
        const seen = /* @__PURE__ */ new Set();
        while (node && !seen.has(node.uniqueId)) {
          seen.add(node.uniqueId);
          const metadata = node.metadata;
          if (isRecord(metadata)) {
            const gltf = isRecord(metadata.gltf) ? metadata.gltf : null;
            const groups = [metadata, isRecord(metadata.extras) ? metadata.extras : null, gltf && isRecord(gltf.extras) ? gltf.extras : null];
            for (const group of groups) if (group) {
              if (!entityId && typeof group.entityId === "string") entityId = group.entityId;
              if (!floorId && typeof group.floorId === "string") floorId = group.floorId;
            }
          }
          node = node.parent;
        }
        if (entityId && !map.has(entityId) || floorId && !map.has(floorId)) continue;
        const entity = entityId ? map.get(entityId) || null : null;
        const floor = floorId ? map.get(floorId) || null : entity?.kind === "floor" ? entity : entity?.floorId ? map.get(entity.floorId) || null : null;
        if (floor && floor.kind !== "floor") continue;
        const buildingId = floor?.owningBuildingId || entity?.owningBuildingId || (entity?.kind === "building" ? entity.id : null);
        if (buildingId && map.get(buildingId)?.kind === "building") result.push({ mesh, entity, floor, buildingId });
      }
      return result;
    }
    function reviewed(claim, catalog) {
      const publicSources = new Set(catalog.sources.filter((source) => source.visibility === "public").map((source) => source.id));
      return ["verified", "mapped"].includes(claim.confidence) && claim.sourceIds.length > 0 && claim.sourceIds.every((id2) => publicSources.has(id2)) && Boolean(claim.dates.reviewedAt && Number.isFinite(Date.parse(claim.dates.reviewedAt)) && Date.parse(claim.dates.reviewedAt) <= Date.now());
    }
    function validFloor(floor, catalog) {
      return Boolean(floor?.kind === "floor" && floor.position && typeof floor.position.up === "number" && Number.isFinite(floor.position.up) && reviewed(floor.claims.location, catalog) && reviewed(floor.claims.height, catalog));
    }
    function setFloorView(floorId, mode) {
      assertActive();
      if (!["exterior", "cut", "isolate", "explode"].includes(mode)) throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uCE35 \uBCF4\uAE30\uC785\uB2C8\uB2E4.");
      restoreFloors();
      const unavailable = (reason) => {
        floorReport = { applied: false, reason, floorId: floorId || null, mode, meshCount: 0 };
        return { ...floorReport };
      };
      if (mode === "exterior") {
        floorReport = { applied: true, reason: "\uC6D0\uB798 \uC678\uAD00\uACFC \uC7AC\uC9C8\uC744 \uBCF5\uC6D0\uD588\uC2B5\uB2C8\uB2E4.", floorId: null, mode, meshCount: 0 };
        return { ...floorReport };
      }
      const catalog = catalogGetter();
      const entities = publicEntities(catalog);
      const floor = entities.find((entity) => entity.id === floorId) || null;
      if (!validFloor(floor, catalog)) return unavailable("\uACF5\uAC1C\uB41C \uCE35 \uD45C\uACE0\uC640 \uC704\uCE58\xB7\uB192\uC774 \uAC80\uC218 \uADFC\uAC70\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4. \uAC1C\uB150 \uC2E4\uB0B4\uB3C4\uC5D0\uB294 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const buildingId = floor.owningBuildingId;
      if (!buildingId) return unavailable("\uCE35\uC758 \uC18C\uC18D \uAC74\uBB3C\uC774 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      const targets = semanticMeshes(entities).filter((item) => item.buildingId === buildingId && item.mesh.isEnabled());
      if (targets.length > 2048) return unavailable("\uAC1C\uBCC4 \uCE35 \uBCF4\uAE30 \uC608\uC0B0\uC778 2048\uAC1C \uBA54\uC26C\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC790\uC0B0 \uCD5C\uC801\uD654\uC640 \uBD84\uD560 \uAC80\uC218\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      if (!targets.length || mode !== "cut" && !targets.some((item) => item.floor?.id === floor.id)) return unavailable("\uACF5\uAC1C \uACF5\uAC04 ID\uC640 \uC2E4\uC81C \uBA54\uC26C\uC758 \uCE35 \uB9E4\uD551\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      const floors = entities.filter((entity) => entity.owningBuildingId === buildingId && validFloor(entity, catalog));
      if (mode === "explode" && new Set(targets.map((item) => item.floor?.id).filter((id2) => id2 && floors.some((entry) => entry.id === id2))).size < 2) return unavailable("\uBD84\uB9AC \uBCF4\uAE30\uC5D0\uB294 \uAC80\uC218\uB41C \uB450 \uAC1C \uC774\uC0C1\uC758 \uCE35 \uBA54\uC26C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      let applied = 0;
      for (const item of targets) {
        const mesh = item.mesh;
        floorSnapshots.set(mesh, { enabled: mesh.isEnabled(false), visible: mesh.isVisible, visibility: mesh.visibility, position: mesh.position.clone(), material: mesh.material });
        if (mode === "isolate") {
          mesh.isVisible = item.floor?.id === floor.id;
          applied++;
        } else if (mode === "explode") {
          if (!item.floor || !validFloor(item.floor, catalog)) {
            mesh.isVisible = false;
            continue;
          }
          const minimum = Math.min(...floors.map((entry) => entry.position?.up ?? floor.position.up));
          const shift = (item.floor.position.up - minimum) * 0.6 / metersPerUnit;
          let ancestor = mesh.parent;
          let inheritedShift = false;
          while (ancestor) {
            const parent = targets.find((candidate) => candidate.mesh === ancestor);
            if (parent?.floor?.id === item.floor.id) {
              inheritedShift = true;
              break;
            }
            ancestor = ancestor.parent;
          }
          if (inheritedShift) {
            applied++;
            continue;
          }
          const delta = new B.Vector3(0, shift, 0);
          if (mesh.parent) {
            mesh.parent.computeWorldMatrix(true);
            delta.copyFrom(B.Vector3.TransformNormal(delta, B.Matrix.Invert(mesh.parent.getWorldMatrix())));
          }
          mesh.position.addInPlace(delta);
          applied++;
        } else if (mesh.material && !(mesh.material instanceof B.MultiMaterial)) {
          const material2 = mesh.material.clone(`refinement-floor-${floor.id}-${mesh.uniqueId}`);
          if (!material2) continue;
          material2.unfreeze();
          const building = entities.find((entity) => entity.id === buildingId);
          const exaggeration = Number(site.getDiagnostics().verticalExaggeration) || 1;
          const anchor = typeof building?.position?.up === "number" ? building.position.up : 0;
          const cutHeight = (floor.position.up + anchor * (exaggeration - 1)) / metersPerUnit;
          material2.clipPlane = new B.Plane(0, 1, 0, -cutHeight);
          mesh.material = material2;
          clonedMaterials.add(material2);
          applied++;
        }
      }
      if (!applied) {
        restoreFloors();
        return unavailable("\uC774 \uC790\uC0B0\uC758 \uC7AC\uC9C8 \uB610\uB294 \uCE35 \uB9E4\uD551\uC5D0 \uC801\uC6A9 \uAC00\uB2A5\uD55C \uACF5\uAC1C \uBA54\uC26C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      }
      floorReport = { applied: true, reason: mode === "cut" ? "\uB4F1\uB85D\uB41C \uCE35 \uAE30\uC900 \uD45C\uACE0\uC5D0\uC11C \uC120\uD0DD \uAC74\uBB3C\uC758 \uC0C1\uBD80\uB97C \uC808\uB2E8\uD569\uB2C8\uB2E4." : mode === "explode" ? "\uAC80\uC218\uB41C \uCE35 \uBA54\uC26C\uB97C \uC124\uBA85\uC6A9\uC73C\uB85C \uBD84\uB9AC\uD569\uB2C8\uB2E4. \uC2E4\uC81C \uCE35 \uB192\uC774\uB294 \uBCC0\uACBD\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : "\uB4F1\uB85D\uB41C \uC120\uD0DD \uCE35 \uBA54\uC26C\uB97C \uD45C\uC2DC\uD569\uB2C8\uB2E4.", floorId, mode, meshCount: applied };
      return { ...floorReport };
    }
    function clearMeasurement() {
      disposeLines(measurementMeshes);
      measurement = null;
    }
    function setMeasurement(kind, points) {
      assertActive();
      const domain = apis().refinement;
      if (!domain) throw new Error("\uCE21\uC815 \uADDC\uCE59 \uBAA8\uB4C8\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      if (!Array.isArray(points) || points.length > 1e3) throw new Error("\uC7A5\uBA74 \uCE21\uC815\uC740 \uCD5C\uB300 1000\uC810\uAE4C\uC9C0 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.");
      const result = domain.measureGeometry(points, kind, { confirmation: "estimated", version: catalogGetter().contentVersion });
      const notes = ["\uC2E4\uCE21 \uC624\uCC28\uAC00 \uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uCC38\uACE0 \uCE21\uC815\uC785\uB2C8\uB2E4.", "\uC548\uB0B4 \uC601\uC5ED \uBA74\uC801\uC740 \uBC95\uC801 \uBD80\uC9C0 \uBA74\uC801\uC774 \uC544\uB2D9\uB2C8\uB2E4."];
      const worldPoints = points.map((point2) => {
        const x = point2[0] / metersPerUnit, z = -point2[1] / metersPerUnit;
        return new B.Vector3(x, point2.length === 3 ? point2[2] / metersPerUnit : site.terrainHeightAt(x, z) + 0.1, z);
      });
      if (Number(site.getDiagnostics().verticalExaggeration) !== 1) notes.push("\uD654\uBA74\uC5D0 \uC9C0\uD615 \uAC15\uC870\uAC00 \uC801\uC6A9\uB410\uC2B5\uB2C8\uB2E4. \uCE21\uC815 \uC218\uCE58\uB294 \uC785\uB825 \uC6D0\uC88C\uD45C\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4.");
      const newMesh = B.MeshBuilder.CreateLines("refinement-measurement", { points: worldPoints }, scene);
      newMesh.color = B.Color3.FromHexString("#6c3f70");
      newMesh.isPickable = false;
      newMesh.metadata = { refinementOverlay: "measurement", confirmation: "estimated", measured: false, kind, visualPriority: "essential" };
      const markers = worldPoints.map((point2) => [point2.add(new B.Vector3(-0.08, 0, 0)), point2.add(new B.Vector3(0.08, 0, 0))]);
      const markerMesh = B.MeshBuilder.CreateLineSystem("refinement-measurement-points", { lines: markers }, scene);
      markerMesh.color = newMesh.color;
      markerMesh.isPickable = false;
      markerMesh.metadata = { ...newMesh.metadata };
      clearMeasurement();
      measurementMeshes.push(newMesh, markerMesh);
      measurement = { ...result, kind, worldPoints: worldPoints.map((point2) => point2.asArray()), notes, displayedPointCount: points.length };
      return { ...measurement, worldPoints: measurement.worldPoints.map((point2) => [...point2]), notes: [...measurement.notes] };
    }
    function copyMeasurement(value) {
      return { ...value, worldPoints: value.worldPoints.map((point2) => [...point2]), notes: [...value.notes], ...value.worldRings ? { worldRings: value.worldRings.map((ring) => ({ ...ring, points: ring.points.map((point2) => [...point2]) })) } : {} };
    }
    function setOutlineMeasurement(geometry) {
      assertActive();
      const { refinement, platform } = apis();
      if (!refinement || !platform) throw new Error("\uC724\uACFD \uCE21\uC815 \uAC80\uC99D \uBAA8\uB4C8\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      const catalog = catalogGetter();
      if (geometry?.originId !== catalog.activeCampusId) throw new Error("\uD604\uC7AC \uCEA0\uD37C\uC2A4\uC758 \uC88C\uD45C \uAE30\uC900\uC73C\uB85C \uBCC0\uD658\uB41C \uC724\uACFD\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      const result = measureOutlineGeometry(geometry, refinement.measureGeometry, catalog.contentVersion);
      const candidate = { ...catalog, entities: catalog.entities.map((entity, index) => index === 0 ? { ...entity, geometry } : entity) };
      const validation = platform.validateCatalog(candidate);
      if (!validation.valid) throw new Error(`\uC724\uACFD \uAC80\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. ${validation.errors.join(" ")}`);
      const publicSources = new Set(catalog.sources.filter((source) => source.visibility === "public").map((source) => source.id));
      if (!geometry.sourceIds.every((id2) => publicSources.has(id2))) throw new Error("\uACF5\uAC1C \uCD9C\uCC98\uAC00 \uD655\uC778\uB41C \uC724\uACFD\uB9CC \uCE21\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const worldRings = result.rings.map((ring) => ({ polygonIndex: ring.polygonIndex, role: ring.role, points: ring.points.map((point2) => {
        const x = point2[0] / metersPerUnit, z = -point2[1] / metersPerUnit;
        return new B.Vector3(x, site.terrainHeightAt(x, z) + 0.1, z);
      }) }));
      const newMeshes = [];
      for (const role of ["outer", "hole"]) {
        const lines = worldRings.filter((ring) => ring.role === role).map((ring) => ring.points);
        if (!lines.length) continue;
        const mesh = B.MeshBuilder.CreateLineSystem(`refinement-measurement-${role}`, { lines }, scene);
        mesh.color = B.Color3.FromHexString(role === "outer" ? "#6c3f70" : "#a2602e");
        mesh.isPickable = false;
        mesh.metadata = { refinementOverlay: "measurement", confirmation: "estimated", measured: false, kind: "area", ringRole: role, visualPriority: "essential" };
        newMeshes.push(mesh);
      }
      const notes = ["\uBAA8\uB4E0 \uC678\uACFD \uB9C1\uC758 \uBA74\uC801\uC744 \uD569\uC0B0\uD558\uACE0 \uAC01 \uB0B4\uBD80 \uACF5\uC81C \uB9C1\uC744 \uBE90\uC2B5\uB2C8\uB2E4.", "\uC2E4\uCE21 \uC624\uCC28\uAC00 \uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uCC38\uACE0 \uCE21\uC815\uC785\uB2C8\uB2E4.", "\uC548\uB0B4 \uC601\uC5ED \uBA74\uC801\uC740 \uBC95\uC801 \uBD80\uC9C0 \uBA74\uC801\uC774 \uC544\uB2D9\uB2C8\uB2E4."];
      if (Number(site.getDiagnostics().verticalExaggeration) !== 1) notes.push("\uD654\uBA74\uC5D0 \uC9C0\uD615 \uAC15\uC870\uAC00 \uC801\uC6A9\uB410\uC2B5\uB2C8\uB2E4. \uCE21\uC815 \uC218\uCE58\uB294 \uC785\uB825 \uC6D0\uC88C\uD45C\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4.");
      clearMeasurement();
      measurementMeshes.push(...newMeshes);
      measurement = { value: result.value, unit: result.unit, approximate: result.approximate, uncertainty: result.uncertainty, version: result.version, points: result.points, kind: "area", polygonCount: result.polygonCount, holeCount: result.holeCount, worldPoints: worldRings.flatMap((ring) => ring.points.map((point2) => point2.asArray())), worldRings: worldRings.map((ring) => ({ ...ring, points: ring.points.map((point2) => point2.asArray()) })), notes, displayedPointCount: result.points };
      return copyMeasurement(measurement);
    }
    return {
      setTheme,
      setLighting,
      setFloorView,
      setMeasurement,
      setOutlineMeasurement,
      clearMeasurement,
      getDiagnostics() {
        return { theme: copyTheme(), lighting, lightingIsSolarAnalysis: false, floor: { ...floorReport }, measurement: measurement ? copyMeasurement(measurement) : null, overlayMeshCount: themeMeshes.length + measurementMeshes.length, clonedMaterialCount: clonedMaterials.size, disposed };
      },
      dispose() {
        if (disposed) return;
        restoreFloors();
        disposeLines(themeMeshes);
        clearMeasurement();
        setLighting("guide");
        disposed = true;
      }
    };
  }

  // src/scene/xr-refinement.ts
  var point = (value) => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item) && Math.abs(item) < 1e7);
  var id = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(value);
  function validateXrAnchor(anchor, at = Date.now()) {
    if (!anchor || !id(anchor.id) || !id(anchor.campusId) || !id(anchor.entityId) || !Array.isArray(anchor.sourceIds) || !anchor.sourceIds.length || !anchor.sourceIds.every(id) || new Set(anchor.sourceIds).size !== anchor.sourceIds.length || !Number.isFinite(Date.parse(anchor.reviewedAt)) || Date.parse(anchor.reviewedAt) > at || !Number.isFinite(Date.parse(anchor.validUntil)) || Date.parse(anchor.validUntil) <= at || Date.parse(anchor.validUntil) <= Date.parse(anchor.reviewedAt) || ![anchor.maxHorizontalErrorMeters, anchor.maxVerticalErrorMeters].every((value) => Number.isFinite(value) && value > 0 && value <= 100) || !Array.isArray(anchor.landmarks) || anchor.landmarks.length < 5 || anchor.landmarks.length > 100 || !anchor.landmarks.every((item) => item && id(item.id) && ["control", "holdout"].includes(item.role) && point(item.siteMeters)) || new Set(anchor.landmarks.map((item) => item.id)).size !== anchor.landmarks.length) throw new Error("AR \uAE30\uC900 \uAD6C\uC5ED\uC5D0\uB294 \uC720\uD6A8\uD55C \uAC80\uC218\xB7\uB9CC\uB8CC\uC77C\xB7\uCD9C\uCC98\xB7\uBBF8\uD130 \uAE30\uC900\uC810\xB7\uD5C8\uC6A9 \uC624\uCC28\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
    const controls = anchor.landmarks.filter((item) => item.role === "control"), holdouts = anchor.landmarks.filter((item) => item.role === "holdout");
    if (controls.length < 2 || holdouts.length < 3) throw new Error("AR \uC815\uD569\uC5D0\uB294 \uC11C\uB85C \uB2E4\uB978 \uAE30\uC900\uC810 \uB450 \uAC1C\uC640 \uB3C5\uB9BD \uAC80\uC218\uC810 \uC138 \uAC1C \uC774\uC0C1\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
    for (let index = 0; index < anchor.landmarks.length; index++) for (const other of anchor.landmarks.slice(index + 1)) if (Math.hypot(anchor.landmarks[index].siteMeters[0] - other.siteMeters[0], anchor.landmarks[index].siteMeters[1] - other.siteMeters[1]) < 0.01) throw new Error("\uAE30\uC900\uC810\uACFC \uB3C5\uB9BD \uAC80\uC218\uC810\uC758 \uC218\uD3C9 \uC704\uCE58\uAC00 \uC911\uBCF5\uB429\uB2C8\uB2E4.");
    let independentArea = 0;
    for (let a = 0; a < holdouts.length; a++) for (let b = a + 1; b < holdouts.length; b++) for (let c = b + 1; c < holdouts.length; c++) {
      const one = holdouts[a].siteMeters, two = holdouts[b].siteMeters, three = holdouts[c].siteMeters;
      independentArea = Math.max(independentArea, Math.abs((two[0] - one[0]) * (three[1] - one[1]) - (two[1] - one[1]) * (three[0] - one[0])));
    }
    if (independentArea < 1e-4) throw new Error("\uB3C5\uB9BD \uAC80\uC218\uC810\uC740 \uD55C \uC9C1\uC120\uC5D0 \uBAB0\uB9AC\uC9C0 \uC54A\uB294 \uD604\uC7A5 \uD3C9\uBA74 \uBC94\uC704\uB97C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.");
  }
  function fitXrCalibration(anchor, captured) {
    validateXrAnchor(anchor);
    if (!Array.isArray(captured) || captured.length > anchor.landmarks.length || !captured.every((item) => item && id(item.id) && point(item.xrMeters) && anchor.landmarks.some((landmark) => landmark.id === item.id)) || new Set(captured.map((item) => item.id)).size !== captured.length) throw new Error("\uCEA1\uCC98 \uC88C\uD45C\uC640 \uAE30\uC900\uC810 \uC5F0\uACB0\uC774 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    const unavailable = (reason) => ({ passed: false, reason, yawRadians: null, translationMeters: null, residuals: [], holdoutCount: 0, realDeviceVerified: false });
    const captures = new Map(captured.map((item) => [item.id, item.xrMeters]));
    if (anchor.landmarks.some((landmark) => !captures.has(landmark.id))) return unavailable("\uB4F1\uB85D\uB41C \uAE30\uC900\uC810\uACFC \uB3C5\uB9BD \uAC80\uC218\uC810\uC744 \uBAA8\uB450 \uD604\uC7A5\uC5D0\uC11C \uCEA1\uCC98\uD574 \uC8FC\uC138\uC694.");
    const controls = anchor.landmarks.filter((item) => item.role === "control");
    const sx = controls.reduce((sum, item) => sum + item.siteMeters[0], 0) / controls.length;
    const sz = controls.reduce((sum, item) => sum - item.siteMeters[1], 0) / controls.length;
    const tx = controls.reduce((sum, item) => sum + captures.get(item.id)[0], 0) / controls.length;
    const tz = controls.reduce((sum, item) => sum + captures.get(item.id)[2], 0) / controls.length;
    let dot = 0, cross = 0;
    for (const control of controls) {
      const a = control.siteMeters[0] - sx, b = -control.siteMeters[1] - sz, c = captures.get(control.id)[0] - tx, d = captures.get(control.id)[2] - tz;
      dot += a * c + b * d;
      cross += b * c - a * d;
    }
    if (Math.hypot(dot, cross) < 1e-8) return unavailable("\uC218\uD3C9 \uAE30\uC900\uC810\uC758 \uBC29\uD5A5\uC744 \uACC4\uC0B0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC11C\uB85C \uB2E4\uB978 \uD604\uC7A5 \uAE30\uC900\uC810\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    const yaw = Math.atan2(cross, dot), cosine = Math.cos(yaw), sine = Math.sin(yaw);
    const translation = [tx - cosine * sx - sine * sz, controls.reduce((sum, item) => sum + captures.get(item.id)[1] - item.siteMeters[2], 0) / controls.length, tz + sine * sx - cosine * sz];
    const residuals = anchor.landmarks.map((landmark) => {
      const [east, north, up] = landmark.siteMeters, xr = captures.get(landmark.id);
      const horizontalMeters = Math.hypot(cosine * east - sine * north + translation[0] - xr[0], -sine * east - cosine * north + translation[2] - xr[2]);
      const verticalMeters = Math.abs(up + translation[1] - xr[1]);
      return { id: landmark.id, role: landmark.role, horizontalMeters, verticalMeters, passed: horizontalMeters <= anchor.maxHorizontalErrorMeters && verticalMeters <= anchor.maxVerticalErrorMeters };
    });
    const passed = residuals.every((item) => item.passed);
    return { passed, reason: passed ? "\uAE30\uC900\uC810\uACFC \uB3C5\uB9BD \uAC80\uC218\uC810\uC774 \uB4F1\uB85D\uB41C \uD5C8\uC6A9 \uC624\uCC28\uB97C \uD1B5\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC2E4\uAE30\uAE30\xB7\uD604\uC7A5 \uC778\uC218 \uAC80\uC0AC\uB294 \uBCC4\uB3C4\uB85C \uD544\uC694\uD569\uB2C8\uB2E4." : "\uD5C8\uC6A9 \uC624\uCC28\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uACB9\uCE68 \uC548\uB0B4\uB97C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC900\uC810\uC744 \uB2E4\uC2DC \uCEA1\uCC98\uD574 \uC8FC\uC138\uC694.", yawRadians: yaw, translationMeters: translation, residuals, holdoutCount: residuals.filter((item) => item.role === "holdout").length, realDeviceVerified: false };
  }
  function createXrRefinement(B, scene, site, preferencesGetter, onStatus) {
    const metersPerUnit = Number(site.getDiagnostics().metersPerUnit) || 10;
    let experience = null;
    let mode = null;
    let anchor = null;
    let root = null;
    const roots = /* @__PURE__ */ new Map();
    const captures = /* @__PURE__ */ new Map();
    let lastHit = null, lastHitAt = 0;
    let calibrated = false, disposed = false, generation = 0;
    let report = null;
    let cameraSnapshot = null;
    let state = "idle", message = "XR \uC2E4\uAE30\uAE30\uC640 \uD604\uC7A5 \uC778\uC218 \uAC80\uC0AC\uB294 \uC544\uC9C1 \uD655\uC778\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.";
    const observers = [];
    const status = () => ({ state, message, anchorId: anchor?.id || null, capturedIds: [...captures.keys()], lastHitAvailable: Boolean(lastHit && Date.now() - lastHitAt < 1e3), report: report ? { ...report, translationMeters: report.translationMeters ? [...report.translationMeters] : null, residuals: report.residuals.map((item) => ({ ...item })) } : null, realDeviceVerified: false });
    function announce(next, text) {
      state = next;
      message = text;
      if (!disposed) onStatus(status());
    }
    function sourceBound(candidate) {
      validateXrAnchor(candidate);
      const preferences = preferencesGetter(), catalog = preferences.catalog;
      if (Number(site.getDiagnostics().verticalExaggeration || 1) !== 1) throw new Error("\uD604\uC7A5 AR \uC815\uD569 \uC804\uC5D0\uB294 \uC9C0\uD615 \uAC15\uC870\uB97C 1\uBC30\uB85C \uBCF5\uC6D0\uD574 \uC8FC\uC138\uC694.");
      if (!catalog || candidate.campusId !== (preferences.campusId || catalog.activeCampusId)) throw new Error("\uD604\uC7AC \uACF5\uAC1C \uCEA0\uD37C\uC2A4 \uC790\uB8CC\uC640 \uC5F0\uACB0\uB41C AR \uAD6C\uC5ED\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const map = new Map(catalog.entities.map((entity2) => [entity2.id, entity2]));
      let entity = map.get(candidate.entityId);
      const seen = /* @__PURE__ */ new Set();
      if (!entity || entity.campusId !== candidate.campusId) throw new Error("AR \uAD6C\uC5ED\uC5D0 \uC5F0\uACB0\uB41C \uACF5\uAC1C \uACF5\uAC04\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      while (entity) {
        if (entity.visibility !== "public" || entity.sensitive || seen.has(entity.id)) throw new Error("AR \uAD6C\uC5ED\uC740 \uACF5\uAC1C \uACF5\uAC04\uACFC \uACF5\uAC1C \uC18C\uC18D \uACF5\uAC04\uC5D0 \uC5F0\uACB0\uB418\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
        seen.add(entity.id);
        if (!entity.parentId) break;
        entity = map.get(entity.parentId);
        if (!entity) throw new Error("AR \uC18C\uC18D \uACF5\uAC04\uC758 \uAC80\uC218\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      }
      if (!candidate.sourceIds.every((sourceId) => catalog.sources.some((source) => source.id === sourceId && source.visibility === "public" && source.confidence === "verified"))) throw new Error("AR \uAE30\uC900\uC810\uC758 \uAC80\uC218\uB41C \uACF5\uAC1C \uCD9C\uCC98\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
    }
    function contentRoots() {
      const result = /* @__PURE__ */ new Set();
      for (const mesh of scene.meshes) {
        if (mesh.isDisposed()) continue;
        let node = mesh, owned = false;
        while (node && node !== root) {
          if (node.metadata?.siteLayer || node.metadata?.featureId || node.metadata?.refinementOverlay) owned = true;
          if (!node.parent || node.parent === root) break;
          node = node.parent;
        }
        if (owned && node instanceof B.TransformNode && node !== root) result.add(node);
      }
      return [...result];
    }
    function synchronizeContent() {
      if (mode !== "ar") return;
      for (const node of contentRoots()) {
        if (!roots.has(node)) roots.set(node, { parent: node.parent, position: node.position.clone(), rotation: node.rotation.clone(), quaternion: node.rotationQuaternion?.clone() || null, scaling: node.scaling.clone(), enabled: node.isEnabled(false) });
        if (!calibrated || !root) node.setEnabled(false);
        else {
          node.parent = root;
          node.setEnabled(roots.get(node).enabled);
        }
      }
    }
    function restoreContent() {
      for (const [node, snapshot] of roots) if (!node.isDisposed()) {
        node.parent = snapshot.parent;
        node.position.copyFrom(snapshot.position);
        node.rotation.copyFrom(snapshot.rotation);
        node.rotationQuaternion = snapshot.quaternion?.clone() || null;
        node.scaling.copyFrom(snapshot.scaling);
        node.setEnabled(snapshot.enabled);
      }
      roots.clear();
      root?.dispose();
      root = null;
      calibrated = false;
    }
    function invalidateTracking() {
      lastHit = null;
      lastHitAt = 0;
      captures.clear();
      report = null;
      calibrated = false;
      if (root) root.setEnabled(false);
      synchronizeContent();
      announce("tracking-lost", "\uD604\uC7A5 \uC704\uCE58 \uCD94\uC801\uC774 \uB04A\uACBC\uAC70\uB098 \uAE30\uC900 \uC88C\uD45C\uAC00 \uBCC0\uACBD\uB410\uC2B5\uB2C8\uB2E4. \uACB9\uCE68 \uC548\uB0B4\uB97C \uC228\uACBC\uC2B5\uB2C8\uB2E4. \uAE30\uC900\uC810\uC744 \uB2E4\uC2DC \uCEA1\uCC98\uD558\uAC70\uB098 2D\xB7\uBB38\uC790 \uC548\uB0B4\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.");
    }
    function cleanup() {
      observers.splice(0).forEach((remove) => remove());
      restoreContent();
      captures.clear();
      lastHit = null;
      lastHitAt = 0;
      report = null;
      mode = null;
      anchor = null;
      if (cameraSnapshot && !scene.isDisposed) site.cameraController.restore(cameraSnapshot);
      cameraSnapshot = null;
    }
    async function exit() {
      generation++;
      const current = experience;
      experience = null;
      cleanup();
      if (current) {
        try {
          if (current.baseExperience.state !== B.WebXRState.NOT_IN_XR) await current.baseExperience.exitXRAsync();
        } catch {
          announce("error", "XR \uC138\uC158 \uC885\uB8CC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uAE30\uC758 XR \uC885\uB8CC \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD574 \uC8FC\uC138\uC694.");
        } finally {
          current.dispose();
        }
      }
      if (!disposed) announce("idle", "\uAE30\uC874 \uCEA0\uD37C\uC2A4 \uC2DC\uC810\uC73C\uB85C \uB3CC\uC544\uC654\uC2B5\uB2C8\uB2E4.");
    }
    async function start(next, candidate) {
      if (disposed) throw new Error("\uC885\uB8CC\uB41C XR \uAE30\uB2A5\uC785\uB2C8\uB2E4.");
      if (next === "ar") {
        if (!candidate) throw new Error("\uD604\uC7A5 AR \uAE30\uC900 \uAD6C\uC5ED\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        sourceBound(candidate);
      }
      await exit();
      const epoch = ++generation;
      announce("preparing", `${next.toUpperCase()} \uAE30\uAE30\uC640 \uC138\uC158\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.`);
      let supported = false;
      try {
        supported = await B.WebXRSessionManager.IsSessionSupportedAsync(next === "vr" ? "immersive-vr" : "immersive-ar");
      } catch {
        if (epoch === generation && !disposed) announce("unsupported", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C XR \uAE30\uAE30 \uC9C0\uC6D0\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC870\uAC10\uB3C4\xB72D\xB7\uBB38\uC790 \uC548\uB0B4\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.");
        return false;
      }
      if (epoch !== generation || disposed) return false;
      if (!supported) {
        announce("unsupported", "\uD604\uC7AC \uAE30\uAE30\xB7\uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uD574\uB2F9 XR \uC138\uC158\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC870\uAC10\uB3C4\xB72D\xB7\uBB38\uC790 \uC548\uB0B4\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.");
        return false;
      }
      cameraSnapshot = site.cameraController.capture();
      site.cameraController.cancelTransition?.();
      try {
        const preferences = preferencesGetter();
        const current = await scene.createDefaultXRExperienceAsync({ disableDefaultUI: true, disableTeleportation: next === "ar", disableNearInteraction: true, disableHandTracking: true, ignoreNativeCameraTransformation: next === "ar", inputOptions: { doNotLoadControllerMeshes: true, disableOnlineControllerRepository: true }, floorMeshes: next === "vr" ? scene.meshes.filter((mesh) => mesh.metadata?.siteLayer === "terrain" && mesh.isEnabled()) : [], optionalFeatures: next === "ar" ? ["hit-test"] : [] });
        if (epoch !== generation || disposed) {
          current.dispose();
          return false;
        }
        experience = current;
        mode = next;
        anchor = candidate || null;
        current.baseExperience.sessionManager.worldScalingFactor = 1 / metersPerUnit;
        current.baseExperience.sessionManager.defaultHeightCompensation = Number.isFinite(preferences.eyeHeightMeters) ? Math.max(0.5, Math.min(2.3, preferences.eyeHeightMeters)) : 1.7;
        if (next === "vr") {
          if (current.teleportation) {
            current.teleportation.teleportationEnabled = preferences.vrMovement !== "smooth";
            current.teleportation.backwardsMovementEnabled = preferences.vrMovement !== "smooth";
            current.teleportation.rotationEnabled = preferences.vrTurn !== "smooth";
            current.teleportation.rotationAngle = Math.PI / 6;
          }
          if (preferences.vrMovement === "smooth") {
            const camera = current.baseExperience.camera, originalSpeed = camera._computeLocalCameraSpeed;
            camera._computeLocalCameraSpeed = () => 1.4 / metersPerUnit * Math.min(100, Math.max(0, scene.getEngine().getDeltaTime())) / 1e3;
            observers.push(() => {
              camera._computeLocalCameraSpeed = originalSpeed;
            });
          }
          if (preferences.vrMovement === "smooth" || preferences.vrTurn === "smooth") current.baseExperience.featuresManager.enableFeature(B.WebXRFeatureName.MOVEMENT, "stable", { xrInput: current.input, movementEnabled: preferences.vrMovement === "smooth", movementSpeed: 1, rotationEnabled: preferences.vrTurn === "smooth", rotationSpeed: 0.15, movementOrientationFollowsViewerPose: true, movementOrientationFollowsController: false });
        } else {
          synchronizeContent();
          const hit = current.baseExperience.featuresManager.enableFeature(B.WebXRFeatureName.HIT_TEST, "stable", { testOnPointerDownOnly: false });
          const hitObserver = hit.onHitTestResultObservable.add((results) => {
            if (epoch !== generation || mode !== "ar") return;
            const wasAvailable = Boolean(lastHit);
            const found = results[0];
            lastHit = found ? found.position.clone() : null;
            lastHitAt = found ? Date.now() : 0;
            if (wasAvailable !== Boolean(lastHit) && !disposed) onStatus(status());
          });
          observers.push(() => hit.onHitTestResultObservable.remove(hitObserver));
          const tracking = current.baseExperience.camera.onTrackingStateChanged.add((trackingState) => {
            if (epoch === generation && mode === "ar" && trackingState !== B.WebXRTrackingState.TRACKING) invalidateTracking();
          });
          observers.push(() => current.baseExperience.camera.onTrackingStateChanged.remove(tracking));
          const reference = current.baseExperience.sessionManager.onXRReferenceSpaceChanged.add(() => {
            if (mode === "ar" && calibrated) invalidateTracking();
          });
          observers.push(() => current.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove(reference));
          const frame = current.baseExperience.sessionManager.onXRFrameObservable.add(() => {
            if (epoch === generation) synchronizeContent();
          });
          observers.push(() => current.baseExperience.sessionManager.onXRFrameObservable.remove(frame));
        }
        const ended = current.baseExperience.sessionManager.onXRSessionEnded.add(() => {
          if (experience !== current) return;
          generation++;
          experience = null;
          cleanup();
          current.dispose();
          announce("idle", "XR \uC138\uC158\uC774 \uC885\uB8CC\uB418\uC5B4 \uAE30\uC874 \uCEA0\uD37C\uC2A4 \uC2DC\uC810\uC73C\uB85C \uB3CC\uC544\uC654\uC2B5\uB2C8\uB2E4.");
        });
        observers.push(() => current.baseExperience.sessionManager.onXRSessionEnded.remove(ended));
        await current.baseExperience.enterXRAsync(next === "vr" ? "immersive-vr" : "immersive-ar", next === "vr" ? "local-floor" : "local");
        if (epoch !== generation || disposed) {
          if (current.baseExperience.state !== B.WebXRState.NOT_IN_XR) await current.baseExperience.exitXRAsync();
          current.dispose();
          return false;
        }
        announce(next === "vr" ? "vr" : "calibrating", next === "vr" ? "\uAC00\uC0C1 \uCEA0\uD37C\uC2A4 \uAD00\uCC30\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uD1B5\uD589 \uC548\uB0B4\uAC00 \uC544\uB2D9\uB2C8\uB2E4. \uC2E4\uAE30\uAE30 \uC131\uB2A5\xB7\uBA40\uBBF8 \uAC80\uC218\uB294 \uBCC4\uB3C4\uB85C \uD544\uC694\uD569\uB2C8\uB2E4." : "\uAE30\uC900\uC810\uACFC \uB3C5\uB9BD \uAC80\uC218\uC810\uC744 \uC2E4\uC81C \uD604\uC7A5\uC5D0\uC11C \uD788\uD2B8 \uD14C\uC2A4\uD2B8\uB85C \uCEA1\uCC98\uD574 \uC8FC\uC138\uC694. \uC815\uD569 \uAC80\uD1A0 \uC804\uC5D0\uB294 \uCEA0\uD37C\uC2A4 \uACB9\uCE68 \uC548\uB0B4\uB97C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        return true;
      } catch (error) {
        if (epoch !== generation || disposed) return false;
        const current = experience;
        experience = null;
        cleanup();
        current?.dispose();
        announce("error", `XR\uC744 \uC2DC\uC791\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. ${error instanceof Error ? error.message : "\uAE30\uAE30 \uC9C0\uC6D0\uACFC \uAD8C\uD55C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."}`);
        return false;
      }
    }
    function capture(landmarkId) {
      if (!experience || mode !== "ar" || !anchor || experience.baseExperience.state !== B.WebXRState.IN_XR || experience.baseExperience.camera.trackingState !== B.WebXRTrackingState.TRACKING || !lastHit || Date.now() - lastHitAt >= 1e3) throw new Error("\uC2E4\uC81C AR \uC138\uC158\uC5D0\uC11C \uCD94\uC801\uB41C \uCD5C\uC2E0 \uD788\uD2B8 \uD14C\uC2A4\uD2B8\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      if (!anchor.landmarks.some((landmark) => landmark.id === landmarkId)) throw new Error("\uB4F1\uB85D\uB41C \uD604\uC7A5 \uAE30\uC900\uC810 \uB610\uB294 \uB3C5\uB9BD \uAC80\uC218\uC810\uB9CC \uCEA1\uCC98\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const value = { id: landmarkId, xrMeters: [lastHit.x * metersPerUnit, lastHit.y * metersPerUnit, lastHit.z * metersPerUnit] };
      captures.set(landmarkId, value);
      calibrated = false;
      root?.setEnabled(false);
      synchronizeContent();
      announce("calibrating", `\uD604\uC7A5 \uC810 ${landmarkId}\uC744 \uCEA1\uCC98\uD588\uC2B5\uB2C8\uB2E4. \uB3C5\uB9BD \uAC80\uC218\uAE4C\uC9C0 \uD1B5\uACFC\uD55C \uD6C4 \uACB9\uCE68 \uC548\uB0B4\uB97C \uD45C\uC2DC\uD569\uB2C8\uB2E4.`);
      return { ...value, xrMeters: [...value.xrMeters] };
    }
    function review() {
      if (!anchor || !experience || mode !== "ar") throw new Error("\uAC80\uD1A0\uD560 \uC2E4\uC81C AR \uC138\uC158\uACFC \uB4F1\uB85D\uB41C \uAE30\uC900 \uAD6C\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      if (experience.baseExperience.state !== B.WebXRState.IN_XR || experience.baseExperience.camera.trackingState !== B.WebXRTrackingState.TRACKING) throw new Error("\uC815\uC0C1\uC801\uC73C\uB85C \uCD94\uC801\uB418\uB294 \uC2E4\uC81C AR \uC138\uC158\uC5D0\uC11C \uC815\uD569\uC744 \uAC80\uD1A0\uD574 \uC8FC\uC138\uC694.");
      sourceBound(anchor);
      report = fitXrCalibration(anchor, [...captures.values()]);
      calibrated = report.passed;
      if (report.passed && report.translationMeters && report.yawRadians !== null) {
        if (!root) root = new B.TransformNode("verified-ar-alignment", scene);
        root.position.copyFrom(B.Vector3.FromArray(report.translationMeters).scale(1 / metersPerUnit));
        root.rotation.y = report.yawRadians;
        root.scaling.set(1, 1, 1);
        root.setEnabled(true);
        synchronizeContent();
        announce("ar", report.reason);
      } else {
        root?.setEnabled(false);
        synchronizeContent();
        announce("calibrating", report.reason);
      }
      return { ...report, translationMeters: report.translationMeters ? [...report.translationMeters] : null, residuals: report.residuals.map((item) => ({ ...item })) };
    }
    return {
      startVR: () => start("vr"),
      startAR: (candidate) => start("ar", candidate),
      capture,
      review,
      exit,
      dispose() {
        if (disposed) return;
        disposed = true;
        generation++;
        const current = experience;
        experience = null;
        cleanup();
        if (current) void current.baseExperience.exitXRAsync().catch(() => {
          message = "XR \uC138\uC158 \uC885\uB8CC\uB97C \uAE30\uAE30\uC5D0\uC11C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.";
        }).finally(() => current.dispose());
      },
      diagnostics() {
        return { ...status(), mode, worldScalingFactor: 1 / metersPerUnit, metersPerWorldUnit: metersPerUnit, alignedRootCount: roots.size, calibrated, disposed, controllerAssetsRemote: false, usesGnssForAlignment: false };
      }
    };
  }

  // src/scene/model-loader.ts
  var object = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  var tuple = (value, count) => Array.isArray(value) && value.length === count && value.every((n) => typeof n === "number" && Number.isFinite(n));
  function validateModelManifest(value) {
    if (!object(value) || value.schemaVersion !== 1 || typeof value.version !== "string" || !Array.isArray(value.models)) throw new Error("Unsupported model manifest.");
    if (value.campusId !== void 0 && (typeof value.campusId !== "string" || !/^[a-zA-Z0-9:_-]{1,120}$/.test(value.campusId))) throw new Error("Invalid manifest campus.");
    const ids = /* @__PURE__ */ new Set();
    for (const item of value.models) {
      if (!object(item) || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.source !== "string" || typeof item.status !== "string") throw new Error("Invalid or duplicate model registration.");
      ids.add(item.id);
      for (const key of ["campusId", "buildingId", "legacyId"]) if (item[key] !== void 0 && (typeof item[key] !== "string" || !/^[a-zA-Z0-9:_-]{1,160}$/.test(item[key]))) throw new Error("Invalid model identity.");
      if (item.bytes !== void 0 && (!Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || Number(item.bytes) > 128 * 1024 * 1024) || item.sha256 !== void 0 && (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("Invalid asset integrity metadata.");
      if (item.provenance !== void 0 && (!object(item.provenance) || typeof item.provenance.sourceId !== "string" || !item.provenance.sourceId || typeof item.provenance.license !== "string" || !item.provenance.license.trim())) throw new Error("Invalid source or reuse license.");
      if (item.kind === "legacy") {
        if (!/^(?:src\/models\/[a-z0-9_-]+\.js|assets\/releases\/[a-f0-9]{64}\.js)$/.test(item.source) || typeof item.global !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.global) || typeof item.export !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item.export)) throw new Error("Invalid local factory registration.");
      } else if (item.kind === "glb") {
        const placement = item.placement;
        if (!/^assets\/(?:models\/[a-zA-Z0-9_/-]+|releases\/[a-f0-9]{64})\.glb$/.test(item.source) || item.source.includes("..") || !object(placement) || !["m", "cm", "mm"].includes(String(placement.units)) || !["Y", "Z"].includes(String(placement.upAxis)) || !tuple(placement.origin, 3) || !tuple(placement.anchorMeters, 3) || typeof placement.yawRadians !== "number" || !Number.isFinite(placement.yawRadians) || typeof placement.altitudeDatum !== "string" || !placement.altitudeDatum || !["measured", "inferred"].includes(String(placement.mode))) throw new Error("GLB requires a local path and explicit geographic placement.");
      } else throw new Error("Unsupported model provider.");
      if (item.variants !== void 0) {
        if (!Array.isArray(item.variants) || item.variants.length > 8) throw new Error("A model supports up to eight detail variants.");
        const variantIds = /* @__PURE__ */ new Set();
        for (const variant of item.variants) {
          if (!object(variant) || typeof variant.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(variant.id) || variant.id === "default" || variantIds.has(variant.id) || variant.minScreenCoverage !== void 0 && (typeof variant.minScreenCoverage !== "number" || !Number.isFinite(variant.minScreenCoverage) || variant.minScreenCoverage < 0 || variant.minScreenCoverage > 1) || variant.maxDistanceMeters !== void 0 && (typeof variant.maxDistanceMeters !== "number" || !Number.isFinite(variant.maxDistanceMeters) || variant.maxDistanceMeters <= 0)) throw new Error("Invalid detail variant thresholds.");
          variantIds.add(variant.id);
          validateModelManifest({ schemaVersion: 1, version: value.version, models: [{ ...item, ...variant, id: item.id, variants: void 0 }] });
        }
      }
    }
  }
  function chooseModelVariant(entry, sample, current = "default") {
    if (!Number.isFinite(sample.distanceMeters) || sample.distanceMeters < 0 || !Number.isFinite(sample.screenCoverage) || sample.screenCoverage < 0 || sample.screenCoverage > 1) throw new Error("Invalid visibility measurement.");
    const variants = entry.variants || [];
    const match = (variant, factor) => (variant.minScreenCoverage === void 0 || sample.screenCoverage >= variant.minScreenCoverage * factor) && (variant.maxDistanceMeters === void 0 || sample.distanceMeters <= variant.maxDistanceMeters / factor);
    let desired = -1;
    for (let i = 0; i < variants.length; i++) if (match(variants[i], 1)) desired = i;
    const previous = variants.findIndex((variant) => variant.id === current);
    if (desired > previous && !match(variants[desired], 1.15)) return current;
    if (desired < previous && previous >= 0 && match(variants[previous], 0.85)) return current;
    return desired < 0 ? "default" : variants[desired].id;
  }
  function modelsForCampus(manifest2, campusId, features) {
    const candidates = manifest2.models.filter((entry) => (entry.campusId || manifest2.campusId) === campusId);
    return features.flatMap((feature) => {
      const matches = candidates.filter((entry) => entry.buildingId === feature.id || entry.id === feature.id || Boolean(entry.legacyId && entry.legacyId === feature.legacyKey));
      const chosen = matches.find((entry) => entry.kind === "glb") || matches[0];
      return chosen ? [chosen] : [];
    });
  }
  function validateSelfContainedGlb(buffer, availableDecoders = []) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 20 || view.getUint32(0, true) !== 1179937895 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 1313821514) throw new Error("Invalid GLB container.");
    const length = view.getUint32(12, true);
    if (20 + length > buffer.byteLength) throw new Error("Invalid GLB JSON chunk.");
    const data = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
    if (!object(data) || !object(data.asset) || data.asset.version !== "2.0") throw new Error("Invalid glTF JSON.");
    for (const key of ["buffers", "images"]) {
      const assets = data[key];
      const invalidAsset = (asset) => {
        if (!object(asset)) return true;
        if (asset.uri === void 0) return false;
        return typeof asset.uri !== "string" || !/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-zA-Z0-9+/=\s]*$/.test(asset.uri);
      };
      if (assets !== void 0 && (!Array.isArray(assets) || assets.some(invalidAsset))) throw new Error("Only self-contained GLB buffers and images are supported.");
    }
    for (const key of ["extensionsRequired", "extensionsUsed"]) if (Array.isArray(data[key]) && data[key].some((name) => ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(String(name)) && !availableDecoders.includes(String(name)))) throw new Error("This GLB requires an unavailable external decoder.");
    const queue = [data];
    while (queue.length) {
      const value = queue.pop();
      if (Array.isArray(value)) queue.push(...value);
      else if (object(value)) for (const [key, item] of Object.entries(value)) {
        if (["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(key) && !availableDecoders.includes(key)) throw new Error("Decoder-dependent GLB extensions are unsupported.");
        if (key === "uri" && (typeof item !== "string" || !item.startsWith("data:"))) throw new Error("External GLB extension resources are unsupported.");
        if (typeof item === "object" && item !== null) queue.push(item);
      }
    }
  }
  function createModelLoader(options) {
    validateModelManifest(options.manifest);
    const entries = new Map(options.manifest.models.map((entry) => [entry.id, entry]));
    const states = /* @__PURE__ */ new Map();
    const models = /* @__PURE__ */ new Map();
    const pending = /* @__PURE__ */ new Map();
    const intents = /* @__PURE__ */ new Map();
    const failedVariants = /* @__PURE__ */ new Map();
    const resident = /* @__PURE__ */ new Map();
    const queue = [];
    const maxConcurrent = options.maxConcurrent ?? 2, maxResidentModels = options.maxResidentModels ?? 32, maxResidentBytes = options.maxResidentBytes ?? 256 * 1024 * 1024;
    const minScreenCoverage = options.minScreenCoverage ?? 3e-3;
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 8 || !Number.isInteger(maxResidentModels) || maxResidentModels < 1 || maxResidentModels > 1e3 || !Number.isSafeInteger(maxResidentBytes) || maxResidentBytes < 1024) throw new Error("Invalid model resource budgets.");
    if (!Number.isFinite(minScreenCoverage) || minScreenCoverage < 0 || minScreenCoverage > 1) throw new Error("Invalid proxy detail threshold.");
    const priorityValue = (priority = "selected") => priority === "selected" ? 0 : priority === "visible" ? 1 : 2;
    let sequence = 0, active = 0, evictions = 0, completed = 0, failed = 0;
    let disposed = false;
    const publish = (id2, state) => {
      states.set(id2, state);
      options.onState?.(id2, { ...state });
    };
    const destroy = (model) => {
      options.site.releaseModel?.(model);
      if (model.dispose) model.dispose();
      else model.root.dispose(false, false);
    };
    const estimateBytes = (model) => model.root.getChildMeshes().reduce((total, mesh) => total + mesh.getTotalVertices() * 48 + mesh.getTotalIndices() * 4, 0);
    const residentBytes = () => [...resident.values()].reduce((sum, value) => sum + value.bytes, 0);
    const abort = (id2, invalidate = true) => {
      if (invalidate) intents.set(id2, (intents.get(id2) || 0) + 1);
      const request = pending.get(id2);
      if (!request) return;
      request.aborter.abort();
      if (!request.started) {
        const index = queue.indexOf(request);
        if (index >= 0) queue.splice(index, 1);
        pending.delete(id2);
        request.detach();
        request.resolve(null);
        publish(id2, { status: "cancelled", attempts: request.attempts, variantId: resident.get(id2)?.variantId });
      }
    };
    const release = (id2) => {
      abort(id2);
      const model = models.get(id2);
      if (model) {
        destroy(model);
        models.delete(id2);
        resident.delete(id2);
      }
      options.site.setBuildingDetailVisible?.(id2, false);
      if (!disposed) publish(id2, { status: "base", attempts: states.get(id2)?.attempts || 0 });
    };
    const enforceBudget = (protectedId) => {
      while (models.size > maxResidentModels || residentBytes() > maxResidentBytes) {
        const candidate = [...resident.entries()].filter(([id2]) => id2 !== protectedId && !pending.has(id2)).sort((a, b) => b[1].priority - a[1].priority || a[1].lastUsed - b[1].lastUsed)[0];
        if (!candidate) break;
        release(candidate[0]);
        evictions++;
      }
    };
    const run = async (request) => {
      const { id: id2, entry, aborter, attempts } = request;
      publish(id2, { status: "loading", attempts, variantId: request.variantId });
      let model = null;
      try {
        if (aborter.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (entry.kind === "legacy") {
          const factory = await options.legacyFactory(entry, aborter.signal);
          if (aborter.signal.aborted || disposed) throw new DOMException("Cancelled", "AbortError");
          const existingMeshes = new Set(options.scene.meshes);
          const existingNodes = new Set(options.scene.transformNodes);
          try {
            model = factory(options.scene, options.materials);
          } catch (error) {
            options.scene.meshes.filter((mesh) => !existingMeshes.has(mesh)).forEach((mesh) => mesh.dispose(false, false));
            options.scene.transformNodes.filter((node) => !existingNodes.has(node)).forEach((node) => node.dispose(false, false));
            throw error;
          }
        } else model = await options.importGlb(entry, aborter.signal);
        if (disposed || aborter.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (entry.kind === "legacy") {
          const aligned = options.site.alignModel(model, entry.buildingId || entry.legacyId || id2);
          if (aligned === false) throw new Error("Building alignment failed.");
        }
        model.root.metadata = { ...model.root.metadata || {}, modelEntryId: id2, featureId: model.root.metadata?.featureId || entry.legacyId || id2, placementStatus: entry.placement?.mode || "inferred" };
        const bytes = entry.bytes || estimateBytes(model);
        if (bytes > maxResidentBytes) throw new Error("Detail exceeds the configured resident asset budget.");
        const previous = models.get(id2);
        if (previous) destroy(previous);
        models.set(id2, model);
        options.site.setBuildingDetailVisible?.(id2, true);
        resident.set(id2, { variantId: request.variantId, bytes, lastUsed: ++sequence, priority: request.priority });
        enforceBudget(id2);
        options.onLoaded?.(entry, model);
        publish(id2, { status: "ready", attempts, variantId: request.variantId });
        completed++;
        request.resolve(model);
      } catch (error) {
        if (model) {
          destroy(model);
          if (models.get(id2) === model) {
            models.delete(id2);
            resident.delete(id2);
          }
        }
        const previous = models.get(id2);
        options.site.setBuildingDetailVisible?.(id2, Boolean(previous));
        const cancelled = disposed || aborter.signal.aborted;
        publish(id2, { status: cancelled ? "cancelled" : "error", error: error instanceof Error ? error.message : "Model unavailable.", attempts, variantId: resident.get(id2)?.variantId });
        if (!cancelled) {
          failed++;
          failedVariants.set(id2, request.variantId);
        }
        request.resolve(null);
      } finally {
        request.detach();
        pending.delete(id2);
        active--;
        pump();
      }
    };
    function pump() {
      if (disposed) return;
      queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
      while (active < maxConcurrent && queue.length) {
        const request = queue.shift();
        if (!request) break;
        if (request.aborter.signal.aborted) {
          abort(request.id);
          continue;
        }
        request.started = true;
        active++;
        void run(request);
      }
    }
    function load(id2, loadOptions = {}, expectedIntent) {
      if (disposed || loadOptions.signal?.aborted) return Promise.resolve(null);
      const base = entries.get(id2);
      if (!base) {
        publish(id2, { status: "base", attempts: 0 });
        return Promise.resolve(null);
      }
      const variantId = loadOptions.variantId || "default", variant = base.variants?.find((item) => item.id === variantId);
      if (variantId !== "default" && !variant) return Promise.reject(new Error("Unknown model detail variant."));
      const priority = priorityValue(loadOptions.priority);
      if (expectedIntent !== void 0 && intents.get(id2) !== expectedIntent) return Promise.resolve(null);
      const existing = pending.get(id2);
      if (existing && existing.variantId === variantId && !existing.aborter.signal.aborted) {
        existing.priority = Math.min(existing.priority, priority);
        return existing.promise;
      }
      const intent = expectedIntent ?? (intents.get(id2) || 0) + 1;
      intents.set(id2, intent);
      const cached = resident.get(id2);
      if (cached && cached.variantId === variantId) {
        if (existing) abort(id2, false);
        cached.lastUsed = ++sequence;
        cached.priority = priority;
        return Promise.resolve(models.get(id2) || null);
      }
      if (existing) {
        abort(id2, false);
        return existing.promise.then(() => load(id2, loadOptions, intent));
      }
      failedVariants.delete(id2);
      const entry = variant ? { ...base, ...variant, id: id2, variants: void 0 } : { ...base, variants: void 0 };
      let resolve;
      const promise = new Promise((done) => {
        resolve = done;
      });
      const aborter = new AbortController(), cancel = () => abort(id2);
      const request = { id: id2, variantId, entry, priority, sequence: ++sequence, started: false, aborter, attempts: (states.get(id2)?.attempts || 0) + 1, promise, resolve, detach: () => loadOptions.signal?.removeEventListener("abort", cancel) };
      pending.set(id2, request);
      queue.push(request);
      loadOptions.signal?.addEventListener("abort", cancel, { once: true });
      publish(id2, { status: "queued", attempts: request.attempts, variantId });
      pump();
      return promise;
    }
    return {
      load,
      models,
      async retry(id2) {
        const current = pending.get(id2);
        const variantId = current?.variantId || failedVariants.get(id2) || resident.get(id2)?.variantId || "default";
        release(id2);
        const intent = intents.get(id2);
        await current?.promise;
        return intent === void 0 ? load(id2, { variantId }) : load(id2, { variantId }, intent);
      },
      cancel: (id2) => abort(id2),
      getState(id2) {
        return { ...states.get(id2) || { status: "base", attempts: 0 } };
      },
      getDiagnostics() {
        return { registered: entries.size, loaded: models.size, pending: pending.size, active, queued: queue.length, residentBytes: residentBytes(), maxConcurrent, maxResidentModels, maxResidentBytes, minScreenCoverage, evictions, completed, failed, variants: Object.fromEntries([...resident].map(([id2, item]) => [id2, item.variantId])), states: Object.fromEntries(states), disposed };
      },
      async prefetch(ids = [...entries.keys()]) {
        await Promise.all(ids.map((id2) => load(id2, { priority: "background" })));
      },
      async updateVisibility(samples) {
        const ids = /* @__PURE__ */ new Set();
        const ranked = [];
        for (const sample of samples) {
          if (ids.has(sample.id)) throw new Error("Duplicate visibility sample.");
          ids.add(sample.id);
          const entry = entries.get(sample.id);
          if (!entry) continue;
          const variantId = chooseModelVariant(entry, sample, resident.get(sample.id)?.variantId), variant = entry.variants?.find((item) => item.id === variantId);
          if (sample.selected || sample.visible && sample.screenCoverage >= minScreenCoverage) ranked.push({ sample, variantId, bytes: variant?.bytes || entry.bytes || resident.get(sample.id)?.bytes || 0 });
        }
        ranked.sort((a, b) => Number(Boolean(b.sample.selected)) - Number(Boolean(a.sample.selected)) || b.sample.screenCoverage - a.sample.screenCoverage || a.sample.distanceMeters - b.sample.distanceMeters || a.sample.id.localeCompare(b.sample.id));
        const admitted = [];
        let admittedBytes = 0;
        for (const candidate of ranked) if (admitted.length < maxResidentModels && admittedBytes + candidate.bytes <= maxResidentBytes) {
          admitted.push(candidate);
          admittedBytes += candidate.bytes;
        }
        const allowed = new Set(admitted.map(({ sample }) => sample.id));
        for (const id2 of /* @__PURE__ */ new Set([...pending.keys(), ...resident.keys()])) if (!allowed.has(id2)) release(id2);
        return Promise.all(admitted.map(({ sample, variantId }) => failedVariants.get(sample.id) === variantId ? Promise.resolve(models.get(sample.id) || null) : load(sample.id, { variantId, priority: sample.selected ? "selected" : "visible" })));
      },
      release,
      dispose() {
        disposed = true;
        [...pending.keys()].forEach((id2) => abort(id2));
        [...models.keys()].forEach(release);
      }
    };
  }
  async function verifyAssetBytes(buffer, entry) {
    if (entry.bytes !== void 0 && buffer.byteLength !== entry.bytes) throw new Error("Model byte length differs from its approved manifest.");
    const approvedHash = entry.sha256 || entry.source.match(/^assets\/releases\/([a-f0-9]{64})\.glb$/)?.[1];
    if (approvedHash) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
      if (hash !== approvedHash) throw new Error("Model hash differs from its approved manifest.");
    }
  }
  function normalizeGeneratedGlbRoots(B, container, scene, buffer) {
    const view = new DataView(buffer), length = view.getUint32(12, true);
    const document2 = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)).trim());
    if (!object(document2) || !object(document2.extras) || document2.extras.campusCoordinateConvention !== "babylon-auto-lh-x-reflection-v1") return;
    if (!scene.useRightHandedSystem) return;
    const root = container.rootNodes.find((node) => node.name === "__root__" && node instanceof B.TransformNode);
    if (!(root instanceof B.TransformNode)) throw new Error("The packaged loader root cannot normalize this campus asset.");
    root.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
    root.scaling.set(1, 1, -1);
  }
  async function browserGlbModel(B, scene, site, entry, signal, availableDecoders = []) {
    if (!entry.placement) throw new Error("Missing GLB placement metadata.");
    const response = await fetch(`./${entry.source}`, { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`GLB unavailable (${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 128 * 1024 * 1024) throw new Error("GLB exceeds the supported 128 MiB asset limit.");
    await verifyAssetBytes(buffer, entry);
    validateSelfContainedGlb(buffer, availableDecoders);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!B.SceneLoader.IsPluginForExtensionAvailable(".glb")) throw new Error("The packaged glTF loader is unavailable.");
    let container = null;
    let importedRoot = null;
    try {
      container = await B.SceneLoader.LoadAssetContainerAsync("", new Uint8Array(buffer), scene, void 0, ".glb");
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      normalizeGeneratedGlbRoots(B, container, scene, buffer);
      container.addAllToScene();
      const root = new B.TransformNode(`model-${entry.id}`, scene);
      importedRoot = root;
      const placement = entry.placement;
      applyModelPlacement(B, root, placement, (x, z) => site.terrainHeightAt(x, z));
      container.rootNodes.forEach((node) => {
        node.parent = root;
      });
      root.metadata = { featureId: entry.id, placementStatus: placement.mode, altitudeDatum: placement.altitudeDatum, units: placement.units, shapePreserved: true, anchorWorld: [placement.anchorMeters[0] / 10, root.position.y + B.Vector3.TransformCoordinates(B.Vector3.FromArray(placement.origin).scale(root.scaling.x), B.Matrix.RotationYawPitchRoll(root.rotation.y, root.rotation.x, 0)).y, -placement.anchorMeters[1] / 10] };
      const main = container.meshes.find((mesh) => mesh instanceof B.Mesh && mesh.getTotalVertices() > 0);
      if (!main) throw new Error("GLB has no visible geometry.");
      const owned = container;
      return { root, main, dispose() {
        owned.dispose();
        root.dispose();
      } };
    } catch (error) {
      container?.dispose();
      importedRoot?.dispose();
      throw error;
    }
  }
  function applyModelPlacement(B, root, placement, terrainHeightAt) {
    const units = placement.units === "m" ? 1 : placement.units === "cm" ? 0.01 : 1e-3;
    root.scaling.setAll(units / 10);
    root.rotation.set(placement.upAxis === "Z" ? -Math.PI / 2 : 0, placement.yawRadians, 0);
    const offset = B.Vector3.TransformCoordinates(B.Vector3.FromArray(placement.origin).scale(units / 10), B.Matrix.RotationYawPitchRoll(root.rotation.y, root.rotation.x, 0));
    const [east, north, altitude] = placement.anchorMeters;
    if (!["local-site-meters", "terrain-relative"].includes(placement.altitudeDatum)) throw new Error("The supplied altitude datum cannot be converted to this site.");
    const y = placement.altitudeDatum === "terrain-relative" ? terrainHeightAt(east / 10, -north / 10) + altitude / 10 : altitude / 10;
    root.position.set(east / 10 - offset.x, y - offset.y, -north / 10 - offset.z);
  }
  var sourceFactories = /* @__PURE__ */ new Map();
  function browserLegacyFactory(entry, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      const readFactory = () => {
        const namespace = Reflect.get(window, entry.global || "");
        const factory = object(namespace) ? namespace[entry.export || ""] : null;
        if (typeof factory !== "function") throw new Error(`Factory ${entry.id} was not registered.`);
        return factory;
      };
      const cached = sourceFactories.get(entry.source);
      if (cached) {
        resolve(cached);
        return;
      }
      const script = document.createElement("script");
      script.src = `./${entry.source}`;
      script.async = true;
      const approvedHash = entry.sha256 || entry.source.match(/^assets\/releases\/([a-f0-9]{64})\.js$/)?.[1];
      if (approvedHash) {
        script.integrity = `sha256-${btoa(String.fromCharCode(...Uint8Array.from(approvedHash.match(/../g) || [], (pair) => parseInt(pair, 16))))}`;
        script.crossOrigin = "anonymous";
      }
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        script.remove();
      };
      const cancel = () => {
        finish();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Model ${entry.id} timed out.`));
      }, 2e4);
      script.onload = () => {
        try {
          const factory = readFactory();
          sourceFactories.set(entry.source, factory);
          if (sourceFactories.size > 128) sourceFactories.delete(sourceFactories.keys().next().value || "");
          finish();
          resolve(factory);
        } catch (error) {
          finish();
          reject(error);
        }
      };
      script.onerror = () => {
        finish();
        reject(new Error(`Model ${entry.id} could not be loaded.`));
      };
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
      else document.head.append(script);
    });
  }

  // src/ui/view-safe-area.ts
  function viewSafeArea(options) {
    const { canvas, panel, renderWidth, renderHeight } = options;
    const mobile = canvas.width < 700;
    const scaleX = renderWidth / Math.max(canvas.width, 1);
    const scaleY = renderHeight / Math.max(canvas.height, 1);
    const topEdge = mobile && panel && !options.panelExpanded ? Math.max(options.headerBottom, panel.bottom) : options.headerBottom;
    const sidePanel = !mobile && panel && panel.width < canvas.width * 0.7;
    const insets = {
      left: sidePanel && panel.left < canvas.left + canvas.width / 2 ? Math.max(0, panel.right - canvas.left + 12) * scaleX : 0,
      right: sidePanel && panel.left >= canvas.left + canvas.width / 2 ? Math.max(0, canvas.right - panel.left + 12) * scaleX : 0,
      top: Math.max(0, topEdge - canvas.top + 12) * scaleY,
      bottom: (panel && (mobile ? options.panelExpanded : panel.width >= canvas.width * 0.7) ? Math.max(55, canvas.bottom - panel.top) : 55) * scaleY
    };
    const horizontal = Math.min(1, renderWidth * 0.75 / Math.max(insets.left + insets.right, 1));
    const vertical = Math.min(1, renderHeight * 0.75 / Math.max(insets.top + insets.bottom, 1));
    return { left: insets.left * horizontal, right: insets.right * horizontal, top: insets.top * vertical, bottom: insets.bottom * vertical };
  }

  // src/bootstrap.ts
  function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function validatePlan(value) {
    if (!record(value) || !record(value.features) || !record(value.boundaries) || !record(value.boundaries.campusMapped) || !Array.isArray(value.sources) || !record(value.metadata)) throw new Error("Campus source data is missing.");
    const points = value.boundaries.campusMapped.pointsMeters;
    if (!Array.isArray(points) || points.length < 3 || !points.every((point2) => Array.isArray(point2) && point2.length === 2 && point2.every((n) => typeof n === "number" && Number.isFinite(n)))) throw new Error("Campus boundary is invalid.");
    if (!Array.isArray(value.features.buildings) || !value.features.buildings.every((building) => record(building) && typeof building.id === "string" && typeof building.name === "string" && Array.isArray(building.pointsMeters))) throw new Error("Campus building data is invalid.");
  }
  var modelManifest = model_manifest_default;
  validateModelManifest(modelManifest);
  var manifest = modelManifest;
  var legacyKeys = manifest.models.flatMap((entry) => entry.legacyId ? [entry.legacyId] : []);
  function initializeApplication() {
    const planInput = Reflect.get(window, "SitePlanData");
    let plan;
    try {
      validatePlan(planInput);
      plan = planInput;
    } catch (error) {
      const text = CampusHud.createTextInteriorController();
      const buildings = legacyKeys.flatMap((key) => {
        const interior = CampusData[`${key}Interior`];
        if (!record(interior)) return [];
        text.registerInterior(null, interior, null, key);
        return [{ id: key, name: String(interior.title || key).replace(/ 내부.*$/, ""), confidence: "estimated", hasInterior: true }];
      });
      const safeControls = window.CampusSiteControls.initialize({ buildings, evidence: {}, onAction: (action, payload = {}) => {
        if (action === "retry") window.location.reload();
        if (action === "select" && typeof payload.id === "string") safeControls.selectBuilding(payload.id);
        if (action === "interior" && typeof payload.id === "string") text.openInterior(payload.id);
      } });
      safeControls.setStatus("error", "\uCEA0\uD37C\uC2A4 \uBD80\uC9C0 \uC790\uB8CC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAC74\uBB3C \uBAA9\uB85D\uACFC \uB0B4\uBD80 \uC815\uBCF4\uB294 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      console.error("Campus data validation failed", error instanceof Error ? error.message : "Unknown data error");
      return;
    }
    let catalog = window.CampusPlatform.publicCatalog(window.CampusPlatform.createCatalog(plan, CampusData));
    catalog.assetsVersion = manifest.version;
    let activeManifest = location.protocol === "file:" ? { ...manifest, models: manifest.models.map((entry) => entry.kind === "legacy" ? Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "variants")) : entry) } : manifest;
    let releaseId = null;
    let sharedStatus = "";
    let refinementRuntime = null;
    let xrRuntime = null;
    let xrStatus = null;
    const arAnchors = [];
    for (const candidate of manifest_default2.anchors) {
      try {
        validateXrAnchor(candidate);
        arAnchors.push(candidate);
      } catch {
        console.info("Unregistered or expired AR anchor excluded.");
      }
    }
    let instrumentation = null;
    const refinement = { purpose: "visitor", reducedMotion: typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, vrMovement: "teleport", vrTurn: "snap", eyeHeightMeters: 1.7 };
    let comparisonSnapshot = null;
    let measurementMode = null;
    let measurementPoints = [];
    let lastVisibilityTime = 0;
    let lastFrameTime = 0;
    const frameIntervals = [];
    let frameP95Ms = 0;
    let offlineBundle = null;
    let offlineCatalogPending = false;
    let mediaRecords = manifest_default.records;
    let safeAreaKey = "";
    let approvedRefreshFailed = false;
    let activeCampusId = catalog.activeCampusId;
    const buildingById = new Map(plan.features.buildings.map((building) => [building.id, building]));
    const buildingByLegacy = new Map(plan.features.buildings.filter((building) => building.legacyKey).map((building) => [building.legacyKey, building]));
    const labels = /* @__PURE__ */ new Map();
    const facilityLabels = /* @__PURE__ */ new Map();
    const layers = Object.fromEntries(catalog.layers.map((layer) => [layer.id, layer.defaultVisible]));
    Object.assign(layers, { boundary: true, trees: true, labels: true, contours: false });
    let view = "overview";
    let exaggeration = 1;
    let selectedId = null;
    let hud = null;
    let fallback = null;
    let lastUiTime = 0;
    let cameraSnapshot;
    let app;
    const shared = parseLocationState();
    let controls;
    let platformControls = null;
    let loader = null;
    let quality = "auto";
    let floor = null;
    let publicSelectedId = null;
    let activeTerrain = CampusData.terrain;
    let bootGeneration = 0;
    let routeMesh = null;
    let applyingState = false;
    let tourSnapshot = null;
    let applicationClosed = false;
    let locationSnapshot = null;
    let xrExperience = null;
    let automaticLow = false;
    let frameAverageMs = 16;
    let qualityFrames = 0;
    let qualityChangedAt = 0;
    let lifecycle = "current";
    const detailVisibility = /* @__PURE__ */ new Map();
    function interiorFor(key) {
      const entity = catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.kind === "building" && (entry.legacyKey === key || entry.legacyId === key || entry.feature?.id === key));
      const value = entity?.interior;
      if (!record(value)) return null;
      const feature = buildingByLegacy.get(key);
      return { ...value, title: feature ? `${feature.number ? `${feature.number}\uB3D9 ` : ""}${feature.name} \uB0B4\uBD80` : value.title, note: `${String(value.note || "")} \uC678\uBD80 \uCD9C\uC785 \uC704\uCE58\uC640 \uC2E4\uCE21 \uB0B4\uBD80 \uC6D0\uB3C4\uBA74\uC758 \uC77C\uCE58 \uC5EC\uBD80\uB294 \uBCC4\uB3C4 \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.` };
    }
    function featureKey(feature) {
      return feature.legacyKey || feature.id;
    }
    function controller() {
      return app?.site?.cameraController || null;
    }
    function getLocationSnapshot() {
      return locationSnapshot ? { ...locationSnapshot } : null;
    }
    function showLocation(payload) {
      const latitude = payload.latitude, longitude = payload.longitude, accuracy = payload.accuracy, timestamp = payload.timestamp;
      if (typeof latitude !== "number" || typeof longitude !== "number" || typeof accuracy !== "number" || typeof timestamp !== "number" || ![latitude, longitude, accuracy, timestamp].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || accuracy > 1e5 || timestamp < Date.now() - 3e5 || timestamp > Date.now() + 6e4) {
        controls.announce("\uD604\uC7AC \uC704\uCE58 \uAC12\uC774\uB098 \uD655\uC778 \uC2DC\uAC01\uC744 \uAC80\uC99D\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC704\uCE58\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        return;
      }
      const campus = catalog.campuses.find((entry) => entry.id === activeCampusId);
      if (!campus) return;
      const earthRadius = 6378137, radians = Math.PI / 180, eccentricitySquared = 0.0066943799901413165;
      const originLatitude = campus.origin.lat * radians;
      const weight = Math.sqrt(1 - eccentricitySquared * Math.sin(originLatitude) ** 2);
      const east = (longitude - campus.origin.lon) * radians * earthRadius / weight * Math.cos(originLatitude);
      const north = (latitude - campus.origin.lat) * radians * earthRadius * (1 - eccentricitySquared) / weight ** 3;
      const insideRing = (ring) => {
        if (!Array.isArray(ring) || ring.length < 3) return false;
        let inside2 = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i], b = ring[j];
          if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2 || ![...a, ...b].every((n) => typeof n === "number" && Number.isFinite(n))) return false;
          const [ax, ay] = a;
          const [bx, by] = b;
          if (ay > north !== by > north && east < (bx - ax) * (north - ay) / (by - ay) + ax) inside2 = !inside2;
        }
        return inside2;
      };
      const boundary = plan.boundaries.campusMapped;
      const parts = Array.isArray(boundary.polygonsMeters) ? boundary.polygonsMeters : [{ outer: boundary.pointsMeters, holes: [] }];
      const inside = parts.some((part) => record(part) && insideRing(part.outer) && (!Array.isArray(part.holes) || !part.holes.some(insideRing)));
      locationSnapshot = { campusId: activeCampusId, east, north, accuracyMeters: accuracy, timestamp, inside };
      if (inside) app.site?.showUserLocation?.(east, north, accuracy);
      else app.site?.clearUserLocation?.();
      platformControls?.update({ location: getLocationSnapshot() });
      controls.announce(inside ? `\uD655\uC778\uD55C \uC704\uCE58\uC640 \uC57D ${Math.round(accuracy)}m \uC815\uD655\uB3C4 \uBC94\uC704\uB97C \uC77C\uC2DC \uD45C\uC2DC\uD588\uC2B5\uB2C8\uB2E4. \uAC74\uBB3C\xB7\uC2E4\uB0B4 \uCE35\xB7\uD638\uC2E4\xB7\uD1B5\uD589 \uACBD\uB85C\uB97C \uD655\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.` : "\uD655\uC778\uD55C \uC704\uCE58\uAC00 \uD604\uC7AC \uCEA0\uD37C\uC2A4 \uC548\uB0B4 \uC601\uC5ED \uBC16\uC785\uB2C8\uB2E4. \uD654\uBA74\uC744 \uC774\uB3D9\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    }
    function entityFor(id2) {
      return catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.visibility === "public" && !entry.sensitive && (entry.id === id2 || entry.legacyId === id2 || entry.legacyKey === id2 || entry.feature?.id === id2));
    }
    function cameraState(value) {
      return record(value) && ["overview", "top", "free"].includes(String(value.view)) && ["alpha", "beta", "radius"].every((key) => typeof value[key] === "number" && Number.isFinite(value[key])) && value.beta >= 0.01 && value.beta <= Math.PI / 2 && Math.abs(value.alpha) < Math.PI * 100 && value.radius > 0 && value.radius < 1e4 && ["target", "freePosition", "freeRotation"].every((key) => Array.isArray(value[key]) && value[key].length === 3 && value[key].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e5));
    }
    function getState() {
      const activeFloor = document.getElementById("buildingDetail")?.hidden ? null : document.querySelector(".floor-tab.is-active")?.dataset.floorTarget;
      const selected = publicSelectedId ? entityFor(publicSelectedId) : void 0;
      const currentFloor = activeFloor || floor;
      const floorEntity = catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.kind === "floor" && entry.owningBuildingId === (selected?.owningBuildingId || selected?.id) && entry.floorLabel === currentFloor);
      return { schemaVersion: 1, campusId: activeCampusId, datasetVersion: catalog.datasetVersion || catalog.contentVersion, contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, sharedStatus, refinement: { ...refinement }, diagnostics: runtimeDiagnostics(), view, selectedId: publicSelectedId, layers: { ...layers }, floor: currentFloor, floorId: floorEntity?.id || null, quality, exaggeration, camera: controller()?.capture() || null };
    }
    function runtimeDiagnostics() {
      const scene = app?.scene;
      const diagnostics = loader?.getDiagnostics();
      return { meshCount: scene?.meshes.length || 0, drawCalls: instrumentation?.drawCallsCounter.current || 0, triangles: Math.round((scene?.getActiveIndices() || 0) / 3), fps: app?.engine?.getFps() || 0, measuredRenderMs: frameAverageMs, frameP95Ms, loadedDetails: diagnostics?.loaded || 0, lod: diagnostics?.variants || {}, residentBytes: diagnostics?.residentBytes || 0, resources: { textures: scene?.textures.length || 0, materials: scene?.materials.length || 0 }, measurement: refinementRuntime?.getDiagnostics(), renderer: "WebGL", timing: "browser-frame-interval-and-cpu-render" };
    }
    function updateSafeArea() {
      const canvas = document.getElementById("renderCanvas"), panel = document.getElementById("siteControls") || document.querySelector(".site-controls");
      if (!canvas || !app?.engine) return;
      const rect = canvas.getBoundingClientRect(), bounds = panel?.getBoundingClientRect();
      const top = document.querySelector(".campus-title")?.getBoundingClientRect().bottom || 70;
      const insets = viewSafeArea({ canvas: rect, panel: bounds, headerBottom: top, panelExpanded: panel?.querySelector(".site-panel-toggle")?.getAttribute("aria-expanded") === "true", renderWidth: app.engine.getRenderWidth(), renderHeight: app.engine.getRenderHeight() });
      const key = JSON.stringify(insets);
      if (key === safeAreaKey) return;
      safeAreaKey = key;
      controller()?.setSafeArea?.(insets, { preserveView: true });
    }
    function panCardinal(east, north) {
      const camera = app?.scene?.activeCamera;
      if (!camera) return;
      const inverse = BABYLON.Matrix.Invert(camera.getViewMatrix()), right = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(1, 0, 0), inverse).normalize(), forward = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, 0, -1), inverse);
      forward.y = 0;
      forward.normalize();
      const desired = new BABYLON.Vector3(east, 0, -north);
      controller()?.pan?.(BABYLON.Vector3.Dot(desired, right), BABYLON.Vector3.Dot(desired, forward));
    }
    function updateVisibility() {
      const camera = app?.scene?.activeCamera, site = app?.site, engine = app?.engine;
      if (offlineCatalogPending || !loader || !camera || !site || !engine || view === "text" || view === "2d") return;
      const low = quality === "low" || quality === "auto" && automaticLow;
      const currentLoader = loader;
      const visible = modelsForCampus(activeManifest, activeCampusId, plan.features.buildings).flatMap((entry) => {
        const feature = buildingById.get(entry.buildingId || entry.id) || buildingByLegacy.get(entry.legacyId || entry.id), bounds = feature && site.featureBounds?.(feature.id);
        if (!feature || !bounds) return [];
        const selected = selectedId === feature.id;
        const projected = site.projectFeature?.(feature.id, { occlusion: false });
        const distanceMeters = BABYLON.Vector3.Distance(camera.position, new BABYLON.Vector3(...bounds.center)) * 10;
        const span = Math.max(...bounds.dimensionsMeters) / 10;
        const screenCoverage = Math.min(1, view === "top" ? span / Math.max(controller()?.capture().radius || 100, 1) : span / Math.max(distanceMeters / 10, 1));
        const shown = selected || !!projected?.inViewport;
        if (!shown && currentLoader.models.has(entry.id)) currentLoader.release(entry.id);
        return [{ id: entry.id, distanceMeters, screenCoverage: low ? Math.min(screenCoverage, 0.02) : screenCoverage, visible: shown, selected }];
      });
      void currentLoader.updateVisibility(visible).catch(() => controls.announce("\uC77C\uBD80 \uC0C1\uC138 \uBAA8\uB378\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBD80\uC9C0\uC640 \uAC74\uBB3C \uC678\uACFD \uC548\uB0B4\uB294 \uACC4\uC18D \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."));
    }
    function measurementKind(value) {
      return ["planar-distance", "path-distance", "height-difference", "area"].includes(String(value));
    }
    function measurePoints(kind, points) {
      if (!Array.isArray(points) || points.length > 256 || !points.every((p) => Array.isArray(p) && [2, 3].includes(p.length) && p.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e5))) throw new Error("\uC720\uD6A8\uD55C \uBBF8\uD130 \uC88C\uD45C\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      const result = refinementRuntime?.setMeasurement(kind, points);
      platformControls?.update({ measureResult: result ? { ...result, version: catalog.contentVersion } : null });
    }
    function compareCatalog(payload) {
      const next = payload.clear ? comparisonSnapshot?.catalog : payload.catalog;
      if (!next || !window.CampusPlatform.validateCatalog(next).valid) throw new Error("\uBE44\uAD50 \uC790\uB8CC\uB97C \uAC80\uC99D\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      const snapshot = controller()?.capture(), savedView = view;
      if (!comparisonSnapshot) comparisonSnapshot = { catalog, manifest: activeManifest, releaseId };
      const retained = comparisonSnapshot;
      catalog = window.CampusPlatform.publicCatalog(next);
      activeManifest = payload.clear ? retained.manifest : catalog.assetManifest || manifest;
      validateModelManifest(activeManifest);
      releaseId = payload.clear ? retained.releaseId : null;
      sharedStatus = payload.clear ? "" : "\uAC00\uC838\uC628 \uBE44\uAD50 \uC790\uB8CC\uC785\uB2C8\uB2E4. \uD559\uAD50\uC758 \uC2B9\uC778\uB41C \uACF5\uAC1C\uD310 \uC5EC\uBD80\uB294 \uBCC4\uB3C4\uB85C \uD655\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.";
      switchCampus(catalog.campuses.some((c) => c.id === activeCampusId) ? activeCampusId : catalog.activeCampusId, true);
      setView(savedView);
      if (snapshot) controller()?.restore(snapshot);
      if (payload.clear) comparisonSnapshot = null;
    }
    function useSavedApprovedCatalog() {
      const saved = offlineBundle;
      if (applicationClosed || !saved || !record(saved.catalog) || !window.CampusPlatform.validateCatalog(saved.catalog).valid) return;
      const state = getState();
      catalog = window.CampusPlatform.publicCatalog(saved.catalog);
      const registered = catalog.assetManifest || manifest;
      activeManifest = Array.isArray(saved.availableModelIds) ? { ...registered, models: registered.models.filter((model) => saved.availableModelIds.includes(model.id)) } : registered;
      validateModelManifest(activeManifest);
      releaseId = typeof saved.releaseId === "string" ? saved.releaseId : null;
      if (Array.isArray(saved.mediaRecords)) mediaRecords = saved.mediaRecords;
      sharedStatus = "\uC800\uC7A5\uB41C \uC2B9\uC778 \uACF5\uAC1C\uD310\uC785\uB2C8\uB2E4. \uC6B4\uC601 \uC815\uBCF4\uB294 \uC800\uC7A5 \uB2F9\uC2DC \uAE30\uC900\uC785\uB2C8\uB2E4.";
      switchCampus(catalog.activeCampusId);
      applyState({ ...state, campusId: catalog.activeCampusId, camera: null });
    }
    async function offlineRelease(payload) {
      try {
        const api = Reflect.get(window, "CampusOffline");
        if (!record(api)) throw new Error("\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC624\uD504\uB77C\uC778 \uC800\uC7A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        const endpoint = new URL("/api/v1/bundle", location.href);
        if (releaseId) endpoint.searchParams.set("release", releaseId);
        const response = await fetch(endpoint, { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(1e4) });
        if (!response.ok) throw new Error("\uC2B9\uC778 \uACF5\uAC1C\uD310\uC744 \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC11C\uBC84 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        const value = await response.json(), bundle = record(value) ? value.data : null;
        if (!record(bundle)) throw new Error("\uACF5\uAC1C \uBB36\uC74C \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        const method = payload.command === "inspect" ? "inspect" : "download", handler = api[method];
        if (typeof handler !== "function") throw new Error("\uC624\uD504\uB77C\uC778 \uC800\uC7A5 \uAE30\uB2A5\uC744 \uC900\uBE44\uD55C \uB4A4 \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
        const result = await handler({ bundle, scope: payload.scope, selectedId: publicSelectedId });
        if (record(result)) {
          if (method === "download") offlineBundle = result;
          const warning = typeof result.warning === "string" ? result.warning : result.cleanupPending ? "\uC774\uC804 \uC790\uB8CC \uC815\uB9AC\uAC00 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4." : "";
          platformControls?.update({ offlineBundle, offlineStatus: method === "inspect" ? `\uC800\uC7A5 \uC608\uC0C1 \uC6A9\uB7C9 ${Math.ceil(Number(result.bytes) / 1024)} KB \xB7 ${result.assets}\uAC1C \uD30C\uC77C \xB7 ${result.scope}` : `\uC2B9\uC778 \uACF5\uAC1C\uD310 ${result.version} \uC800\uC7A5 \uC644\uB8CC \xB7 ${result.scope} \uBC94\uC704. \uC6B4\uC601 \uC815\uBCF4\uB294 \uC800\uC7A5 \uB2F9\uC2DC \uAE30\uC900\uC785\uB2C8\uB2E4. ${warning}` });
        }
      } catch (error) {
        platformControls?.update({ offlineStatus: error instanceof Error ? error.message : "\uC624\uD504\uB77C\uC778 \uC800\uC7A5\uC744 \uC644\uB8CC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
      }
    }
    async function requestAssistant(payload) {
      try {
        if (typeof payload.query !== "string" || payload.query.length > 500) throw new Error("500\uC790 \uC774\uD558\uB85C \uC9C8\uBB38\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
        const response = await fetch("/api/v1/assistant", { method: "POST", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: payload.query, campusId: activeCampusId, contentVersion: catalog.contentVersion, purpose: refinement.purpose }), signal: AbortSignal.timeout(1e4) });
        const value = await response.json();
        if (!response.ok || !record(value) || !record(value.data)) throw new Error("\uD604\uC7AC \uB4F1\uB85D\uB41C AI \uC548\uB0B4\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC790\uB8CC \uAC80\uC0C9 \uACB0\uACFC\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.");
        const data = value.data;
        const records = Array.isArray(data.entities) ? data.entities : [];
        platformControls?.update({ assistantStatus: records.map((item) => record(item) ? `${item.name || item.id}: ${item.purpose || item.description || "\uB4F1\uB85D\uB41C \uACF5\uAC04\uC785\uB2C8\uB2E4."}` : "").filter(Boolean).join(" / ") || "\uC9C8\uBB38\uACFC \uC5F0\uACB0\uB418\uB294 \uC2B9\uC778 \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D \uACF5\uAC04 \uAC80\uC0C9\uC744 \uC774\uC6A9\uD574 \uC8FC\uC138\uC694." });
      } catch (error) {
        platformControls?.update({ assistantStatus: error instanceof Error ? error.message : "\uADFC\uAC70 \uC548\uB0B4\uB97C \uC644\uB8CC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D \uAC80\uC0C9 \uACB0\uACFC\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694." });
      }
    }
    function persistState(push = false) {
      if (applyingState) return;
      const state = getState();
      try {
        localStorage.setItem("hanshin-campus-view-v1", JSON.stringify(state));
        if (location.protocol !== "file:") {
          const url = new URL(location.href);
          const selected = state.selectedId ? entityFor(state.selectedId) : void 0;
          const ownerId = selected?.owningBuildingId || selected?.id;
          const sharedFloor = catalog.entities.find((entry) => entry.kind === "floor" && entry.owningBuildingId === ownerId && (entry.floorLabel === state.floor || entry.id === state.floor));
          url.search = window.CampusPlatform.serializeState({ version: 1, campusId: state.campusId, contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, ...releaseId ? { releaseId } : {}, entityId: state.selectedId, view: state.view, layers: Object.keys(state.layers).filter((key) => state.layers[key] && catalog.layers.some((layer) => layer.id === key)), floorId: sharedFloor?.id || null, time: null });
          url.hash = "";
          if (push) history.pushState({ campusView: state }, "", url);
          else history.replaceState({ campusView: state }, "", url);
        }
      } catch (error) {
        console.info("View state storage unavailable", error instanceof Error ? error.message : "Unavailable");
      }
    }
    function setQuality(next) {
      quality = next;
      if (next !== "auto") automaticLow = false;
      applyQuality();
      platformControls?.update({ quality });
      updateUi();
    }
    function applyQuality() {
      const low = quality === "low" || quality === "auto" && automaticLow;
      app.engine?.setHardwareScalingLevel(low ? Math.max(1.5, window.devicePixelRatio || 1) : 1);
      catalog.entities.filter((entity) => entity.campusId === activeCampusId && typeof entity.feature?.id === "string").forEach((entity) => app.site?.setFeatureVisible?.(String(entity.feature?.id), entity.status === lifecycle));
      loader?.models.forEach((model, entryId) => {
        const id2 = model.root.metadata?.featureId;
        const feature = typeof id2 === "string" ? buildingById.get(id2) : void 0;
        if (!feature) return;
        const publicEntity = entityFor(feature.id);
        const visible = !publicEntity || publicEntity.status === lifecycle;
        if (detailVisibility.get(entryId) !== visible) {
          detailVisibility.set(entryId, visible);
          app.site?.setBuildingDetailVisible?.(feature.id, visible);
        }
      });
      app.site?.setLayerVisible("trees", layers.trees && !low);
    }
    function applyState(value) {
      if (record(value) && value.version === 1) {
        const parsed = window.CampusPlatform.parseState(value, catalog);
        if (!parsed.valid || !parsed.state) return false;
        const state = parsed.state;
        return applyState({ ...getState(), campusId: state.campusId, selectedId: state.entityId, view: state.view, layers: Object.fromEntries(Object.keys(layers).map((key) => [key, state.layers.includes(key)])), floor: state.floorId ? catalog.entities.find((entity) => entity.id === state.floorId && entity.campusId === state.campusId)?.floorLabel || null : null, floorId: state.floorId, camera: null });
      }
      if (!record(value) || value.schemaVersion !== 1 || typeof value.campusId !== "string" || !catalog.campuses.some((campus) => campus.id === value.campusId) || !["overview", "top", "free", "text", "2d"].includes(String(value.view))) return false;
      applyingState = true;
      try {
        if (value.campusId !== activeCampusId && !switchCampus(value.campusId)) return false;
        if (record(value.layers)) {
          for (const key of Object.keys(layers)) if (typeof value.layers[key] === "boolean") {
            layers[key] = value.layers[key];
            if (key !== "labels") app.site?.setLayerVisible(key, layers[key]);
          }
        }
        if (typeof value.selectedId === "string" && entityFor(value.selectedId)) selectBuilding(value.selectedId);
        else {
          selectedId = null;
          publicSelectedId = null;
        }
        floor = typeof value.floor === "string" && value.floor.length < 160 ? value.floor : null;
        if (typeof value.exaggeration === "number" && value.exaggeration >= 1 && value.exaggeration <= 2 && Number.isInteger(value.exaggeration * 4) && value.exaggeration !== exaggeration) {
          exaggeration = value.exaggeration;
          app.site?.setVerticalExaggeration?.(exaggeration);
        }
        if (value.quality === "auto" || value.quality === "low" || value.quality === "high") setQuality(value.quality);
        if (record(value.refinement)) {
          const saved = value.refinement;
          if (typeof saved.reducedMotion === "boolean") refinement.reducedMotion = saved.reducedMotion;
          if (["teleport", "smooth"].includes(String(saved.vrMovement))) refinement.vrMovement = saved.vrMovement;
          if (["snap", "smooth"].includes(String(saved.vrTurn))) refinement.vrTurn = saved.vrTurn;
          if (typeof saved.eyeHeightMeters === "number" && saved.eyeHeightMeters >= 0.5 && saved.eyeHeightMeters <= 2.3) refinement.eyeHeightMeters = saved.eyeHeightMeters;
          controller()?.setObservationSettings?.({ eyeHeightMeters: Number(refinement.eyeHeightMeters) });
        }
        setView(value.view);
        if (value.datasetVersion === (catalog.datasetVersion || catalog.contentVersion) && cameraState(value.camera)) controller()?.restore(value.camera);
        updateUi();
        return true;
      } finally {
        applyingState = false;
      }
    }
    function setView(next) {
      view = next;
      const canvas = document.getElementById("renderCanvas");
      if (canvas) canvas.hidden = next === "text" || next === "2d";
      const labelLayer = document.getElementById("mapLabels");
      if (labelLayer) labelLayer.hidden = next === "text" || next === "2d";
      if (next !== "text" && next !== "2d") controller()?.setView(next);
      platformControls?.update({ view: next });
      updateUi();
    }
    function switchCampus(id2, preserveControls = false) {
      const campus = catalog.campuses.find((entry) => entry.id === id2);
      if (!campus?.visualizationPlan) {
        controls.announce("\uC774 \uCEA0\uD37C\uC2A4\uC758 \uAC80\uC99D\uB41C \uD45C\uC2DC \uC790\uB8CC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return false;
      }
      try {
        validatePlan(campus.visualizationPlan);
      } catch {
        controls.announce("\uCEA0\uD37C\uC2A4 \uC790\uB8CC\uB97C \uAC80\uC99D\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
        return false;
      }
      activeCampusId = id2;
      catalog.activeCampusId = id2;
      plan = campus.visualizationPlan;
      activeTerrain = campus.terrain;
      buildingById.clear();
      buildingByLegacy.clear();
      plan.features.buildings.forEach((feature) => {
        buildingById.set(feature.id, feature);
        if (feature.legacyKey) buildingByLegacy.set(feature.legacyKey, feature);
      });
      selectedId = null;
      publicSelectedId = null;
      app.selectedId = null;
      floor = null;
      fallback?.dispose?.();
      fallback?.hide();
      fallback = null;
      const title = document.querySelector(".campus-title strong");
      if (title) title.textContent = campus.name;
      const canvas = document.getElementById("renderCanvas");
      if (canvas) canvas.setAttribute("aria-label", `${campus.name} \uC804\uCCB4 \uBD80\uC9C0 3D \uC870\uAC10\uB3C4`);
      if (!preserveControls) installControls();
      boot();
      platformControls?.update({ catalog, campusId: id2, selectedId: null });
      return true;
    }
    function updateUi() {
      const camera = controller();
      const northRadians = camera?.getNorthRotation() || 0;
      const rawScale = camera?.getScaleBar();
      controls.update({ view, layers, exaggeration, selectedId, northDegrees: northRadians * 180 / Math.PI, scale: rawScale?.visible === false ? { meters: 0, pixels: 0 } : rawScale || { meters: 0, pixels: 0 }, status: app?.ready ? "ready" : "error" });
      platformControls?.update({ catalog, view, layers, selectedId: publicSelectedId, quality, modelStates: loader?.getDiagnostics().states || {}, refinement: { ...refinement }, diagnostics: runtimeDiagnostics(), contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, sharedStatus, boundaryLegend: app?.site?.getBoundaryLegend?.(), mediaRecords, offlineBundle, arAnchors: arAnchors.filter((anchor) => anchor.campusId === activeCampusId), arLandmarks: xrStatus?.capturedIds, arCalibrationReport: xrStatus?.report });
    }
    function selectBuilding(id2) {
      const entity = entityFor(id2);
      const owner = entity?.owningBuildingId ? entityFor(entity.owningBuildingId) : entity;
      const feature = buildingByLegacy.get(owner?.legacyKey || owner?.legacyId || "") || buildingById.get(typeof owner?.feature?.id === "string" ? owner.feature.id : "") || buildingById.get(id2) || buildingByLegacy.get(id2);
      publicSelectedId = entity?.id || catalog.entities.find((entry) => entry.kind === "building" && entry.feature?.id === feature?.id)?.id || null;
      if (entity?.kind === "floor" || entity?.kind === "space") floor = entity.floorLabel || entity.floorId && entityFor(entity.floorId)?.floorLabel || null;
      else floor = null;
      if (!feature) {
        if (entity?.position && app.site) {
          const orbit = controller()?.orbit;
          if (orbit instanceof BABYLON.ArcRotateCamera) {
            const x = entity.position.east / 10;
            const z = -entity.position.north / 10;
            orbit.setTarget(new BABYLON.Vector3(x, app.site.terrainHeightAt(x, z), z), false, true, true);
            orbit.radius = 12;
          }
        }
        updateUi();
        persistState(true);
        return;
      }
      selectedId = feature.id;
      app.selectedId = selectedId;
      if (view !== "text" && view !== "2d" && view !== "overview") setView("overview");
      updateSafeArea();
      controller()?.focusBuilding(featureKey(feature), { durationMs: 280, reducedMotion: refinement.reducedMotion === true });
      app.site?.setInteractionState?.({ selected: feature.id });
      controls.selectBuilding(feature.id);
      updateVisibility();
      applyQuality();
      if (view !== "text" && view !== "2d" && (entity?.kind === "floor" || entity?.kind === "space")) openInterior(entity.id);
      updateUi();
      persistState(true);
    }
    function openInterior(id2) {
      const entity = entityFor(id2);
      const owner = entity?.owningBuildingId ? entityFor(entity.owningBuildingId) : entity;
      const feature = buildingById.get(id2) || buildingByLegacy.get(id2) || buildingByLegacy.get(owner?.legacyKey || owner?.legacyId || "") || buildingById.get(typeof owner?.feature?.id === "string" ? owner.feature.id : "");
      const key = feature ? featureKey(feature) : id2;
      if (!feature || !interiorFor(key)) {
        controls.announce("\uC774 \uC2DC\uC124\uC740 \uD655\uC778\uB41C \uB0B4\uBD80\uB3C4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC678\uBD80 \uC704\uCE58\uC640 \uC790\uB8CC \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const requestedFloor = floor;
      if (hud) hud.openInterior(key);
      else fallback?.openInterior(key);
      if (requestedFloor) window.setTimeout(() => {
        const tab = [...document.querySelectorAll(".floor-tab")].find((entry) => entry.dataset.floorTarget === requestedFloor || entry.textContent?.trim().startsWith(requestedFloor));
        tab?.click();
      }, 0);
    }
    async function exportView(exportMode) {
      if (view === "text" || view === "2d") {
        controls.announce("\uC774\uBBF8\uC9C0\uB294 \uC804\uCCB4 \uC870\uAC10\uB3C4 \uB610\uB294 \uC704\uC5D0\uC11C \uBCF4\uAE30\uC5D0\uC11C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694. 2D \uC548\uB0B4\uB294 \uC778\uC1C4 \uAE30\uB2A5\uC73C\uB85C \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      if (!app.ready || !app.engine || !app.scene) {
        controls.announce("3D \uD654\uBA74\uC774 \uC900\uBE44\uB41C \uB4A4 \uC774\uBBF8\uC9C0\uB97C \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const camera = controller();
      const snapshot = camera?.capture();
      const currentView = view;
      try {
        if (exportMode === "top" || exportMode === "overview") {
          camera?.setView(exportMode);
          view = exportMode;
        }
        app.scene.render();
        const source = document.getElementById("renderCanvas");
        if (!(source instanceof HTMLCanvasElement)) throw new Error("Canvas unavailable");
        const image = document.createElement("canvas");
        const activeCamera = app.scene.activeCamera;
        if (!activeCamera) throw new Error("Camera unavailable");
        const viewport = activeCamera.viewport.toGlobal(source.width, source.height);
        const crop = { x: Math.round(viewport.x), y: Math.round(source.height - viewport.y - viewport.height), width: Math.round(viewport.width), height: Math.round(viewport.height) };
        image.width = crop.width;
        const fontSize = Math.max(12, Math.min(17, image.width / 36));
        const footerLines = [];
        const context = image.getContext("2d");
        if (!context) throw new Error("Image context unavailable");
        context.font = `${fontSize}px Arial, Malgun Gothic, sans-serif`;
        const campusName = catalog.campuses.find((campus) => campus.id === activeCampusId)?.name || String(plan.metadata.title || "\uCEA0\uD37C\uC2A4");
        const hasOsm = plan.sources.some((source2) => record(source2) && /openstreetmap|osm/i.test(`${source2.id || ""} ${source2.url || ""}`));
        const sourceCredit = hasOsm ? "\xA9 OpenStreetMap contributors \xB7 ODbL \xB7 https://www.openstreetmap.org/copyright" : `\uC790\uB8CC \uCD9C\uCC98: ${plan.sources.flatMap((source2) => record(source2) && typeof source2.title === "string" ? [source2.title] : []).slice(0, 3).join(" \xB7 ") || "\uB4F1\uB85D \uCD9C\uCC98 \uC815\uBCF4 \uD655\uC778 \uD544\uC694"}`;
        for (const paragraph of [`${campusName} \xB7 \uCEA0\uD37C\uC2A4 \uC548\uB0B4 \uC601\uC5ED \xB7 \uBC95\uC801 \uC18C\uC720 \uACBD\uACC4 \uC544\uB2D8`, `\uC790\uB8CC ${catalog.contentVersion} \xB7 \uBAA8\uB378 ${catalog.assetsVersion} \xB7 ${releaseId || "\uD328\uD0A4\uC9C0 \uC790\uB8CC"} \xB7 \uAE30\uC900\uC77C ${String(plan.metadata.referenceDate || "\uBBF8\uD655\uC778")}`, `\uC790\uB8CC \uD655\uC778 \uC218\uC900\uC740 \uD56D\uBAA9\uBCC4 \uB4F1\uB85D \uCD9C\uCC98 \uAE30\uC900 \xB7 \uBBF8\uD655\uC778 \uC678\uAD00\xB7\uB192\uC774\xB7\uB0B4\uBD80 \uD3C9\uBA74\uC740 \uAC1C\uB150 \uBAA8\uB378`, sourceCredit]) {
          let line = "";
          for (const character of paragraph) {
            if (line && context.measureText(line + character).width > image.width - 32) {
              footerLines.push(line);
              line = "";
            }
            line += character;
          }
          footerLines.push(line);
        }
        image.height = crop.height + footerLines.length * (fontSize + 8) + 24;
        context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        updateLabels();
        const canvasRect = source.getBoundingClientRect();
        context.font = `bold ${11 * source.width / canvasRect.width}px Arial, Malgun Gothic, sans-serif`;
        for (const label of document.querySelectorAll(".map-label")) {
          if (label.hidden || !layers.labels) continue;
          const bounds = label.getBoundingClientRect();
          const x = (bounds.left - canvasRect.left) * source.width / canvasRect.width - crop.x;
          const y = (bounds.top - canvasRect.top) * source.height / canvasRect.height - crop.y;
          const name = label.textContent || "";
          const style = window.getComputedStyle(label);
          const pixelRatio = source.width / canvasRect.width;
          const labelFontSize = parseFloat(style.fontSize) * pixelRatio;
          context.font = `${style.fontWeight} ${labelFontSize}px ${style.fontFamily}`;
          const width = bounds.width * pixelRatio;
          const height = bounds.height * source.height / canvasRect.height;
          if (x < 0 || y < 0 || x + width > crop.width || y + height > crop.height) continue;
          context.fillStyle = style.backgroundColor;
          context.fillRect(x, y, width, height);
          context.fillStyle = style.color;
          context.fillText(name, x + 7 * pixelRatio, y + 5 * pixelRatio + labelFontSize * 0.95);
        }
        context.save();
        context.translate(30, 35);
        context.fillStyle = "#fff8dc";
        context.fillRect(-22, -26, 44, 64);
        context.fillStyle = "#173625";
        context.font = "bold 13px Arial";
        context.fillText("N", -5, -9);
        context.rotate(camera?.getNorthRotation() || 0);
        context.beginPath();
        context.moveTo(0, -3);
        context.lineTo(-7, 22);
        context.lineTo(0, 17);
        context.lineTo(7, 22);
        context.closePath();
        context.fill();
        context.restore();
        const scale = camera?.getScaleBar();
        if (scale?.visible && typeof scale.pixels === "number" && typeof scale.meters === "number") {
          const bar = Math.min(scale.pixels, crop.width - 40);
          context.fillStyle = "#fff8dc";
          context.fillRect(12, crop.height - 48, bar + 16, 38);
          context.strokeStyle = "#173625";
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(20, crop.height - 23);
          context.lineTo(20 + bar, crop.height - 23);
          context.stroke();
          context.fillStyle = "#173625";
          context.font = "bold 12px Arial";
          context.fillText(`${Math.round(scale.meters * bar / scale.pixels)}m`, 20, crop.height - 30);
        }
        context.fillStyle = "#173625";
        context.fillRect(0, crop.height, image.width, image.height - crop.height);
        context.fillStyle = "#fff8dc";
        context.font = `${fontSize}px Arial, Malgun Gothic, sans-serif`;
        footerLines.forEach((line, index) => context.fillText(line, 16, crop.height + 20 + index * (fontSize + 8)));
        const blob = await new Promise((resolve, reject) => image.toBlob((result) => result ? resolve(result) : reject(new Error("Image generation failed")), "image/png"));
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `hanshin-campus-${exportMode}.png`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
        controls.announce("\uD604\uC7AC \uC870\uAC10\uB3C4 \uC774\uBBF8\uC9C0\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uBBF8\uC9C0 \uD558\uB2E8\uC5D0 \uC790\uB8CC\uC640 \uACBD\uACC4 \uAE30\uC900\uC744 \uD3EC\uD568\uD588\uC2B5\uB2C8\uB2E4.");
        controls.update({ exportStatus: "\uC774\uBBF8\uC9C0\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4. \uC790\uB8CC\xB7\uACBD\uACC4 \uAE30\uC900\uC744 \uC774\uBBF8\uC9C0 \uD558\uB2E8\uC5D0 \uD3EC\uD568\uD588\uC2B5\uB2C8\uB2E4." });
      } catch (error) {
        console.error("Campus export failed", error instanceof Error ? error.message : "Unknown export error");
        controls.announce("\uC774\uBBF8\uC9C0\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
        controls.update({ exportStatus: "\uC774\uBBF8\uC9C0 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." });
      } finally {
        if (snapshot) camera?.restore(snapshot);
        view = currentView;
        updateUi();
      }
    }
    function onAction(action, payload = {}) {
      const camera = controller();
      switch (action) {
        case "refinement-purpose":
          if (["visitor", "student", "facilities"].includes(String(payload.purpose))) {
            refinement.purpose = payload.purpose;
            const enabled = Array.isArray(payload.layers) ? payload.layers : [];
            for (const layer of catalog.layers) {
              layers[layer.id] = enabled.includes(layer.id);
              app.site?.setLayerVisible(layer.id, layers[layer.id]);
            }
            layers.labels = true;
          }
          break;
        case "refinement-camera": {
          camera?.cancelTransition?.();
          const commands = { "rotate-left": () => camera?.rotate(-1), "rotate-right": () => camera?.rotate(1), "zoom-in": () => camera?.zoom(1), "zoom-out": () => camera?.zoom(-1), "move-north": () => panCardinal(0, 1), "move-south": () => panCardinal(0, -1), "move-west": () => panCardinal(-1, 0), "move-east": () => panCardinal(1, 0) };
          commands[String(payload.command)]?.();
          break;
        }
        case "refinement-preferences":
          if (typeof payload.reducedMotion === "boolean") refinement.reducedMotion = payload.reducedMotion;
          if (["teleport", "smooth"].includes(String(payload.vrMovement))) refinement.vrMovement = payload.vrMovement;
          if (["snap", "smooth"].includes(String(payload.vrTurn))) refinement.vrTurn = payload.vrTurn;
          if (typeof payload.eyeHeightMeters === "number" && payload.eyeHeightMeters >= 0.5 && payload.eyeHeightMeters <= 2.3) refinement.eyeHeightMeters = payload.eyeHeightMeters;
          camera?.setObservationSettings?.({ eyeHeightMeters: Number(refinement.eyeHeightMeters) });
          document.documentElement.classList.toggle("reduced-motion", refinement.reducedMotion === true);
          break;
        case "refinement-lighting":
          if (payload.lighting === "guide" || payload.lighting === "evening" || payload.lighting === "day") refinementRuntime?.setLighting(payload.lighting === "day" ? "observe" : payload.lighting);
          break;
        case "refinement-floor":
          if (typeof payload.floorId === "string" && ["exterior", "cut", "isolate", "explode"].includes(String(payload.mode))) {
            const report = refinementRuntime?.setFloorView(payload.floorId, payload.mode);
            platformControls?.update({ floorStatus: report?.reason || "3D \uC7A5\uBA74\uC744 \uC900\uBE44\uD55C \uB4A4 \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694." });
          }
          break;
        case "refinement-theme":
          if (["none", "events", "construction", "access", "hours", "source-confidence", "lifecycle", "category"].includes(String(payload.theme))) {
            const report = refinementRuntime?.setTheme(payload.theme);
            platformControls?.update({ refinementStatus: report ? `${report.items.length}\uAC1C \uB4F1\uB85D \uC704\uCE58 \uD45C\uC2DD \xB7 ${report.unavailable}\uAC1C \uC704\uCE58 \uBBF8\uD655\uC778. ${report.note}` : "\uC7A5\uBA74\uC774 \uC900\uBE44\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." });
          }
          break;
        case "refinement-measure":
          try {
            if (payload.mode === "clear") {
              measurementMode = null;
              measurementPoints = [];
              refinementRuntime?.clearMeasurement();
            } else if (payload.mode === "outline" && typeof payload.entityId === "string") {
              const entity = entityFor(payload.entityId);
              if (entity?.geometry) {
                const result = refinementRuntime?.setOutlineMeasurement(entity.geometry);
                platformControls?.update({ measureResult: result ? { ...result, version: catalog.contentVersion } : null });
              }
            } else if (measurementKind(payload.mode)) {
              if (payload.pick === true) {
                if (exaggeration !== 1 && ["path-distance", "height-difference"].includes(payload.mode)) throw new Error("\uB192\uC774\uAC00 \uD3EC\uD568\uB41C \uC7A5\uBA74 \uCE21\uC815 \uC804\uC5D0\uB294 \uC9C0\uD615 \uAC15\uC870\uB97C 1\uBC30\uB85C \uBCF5\uC6D0\uD574 \uC8FC\uC138\uC694.");
                measurementMode = payload.mode;
                measurementPoints = [];
              } else {
                measurementMode = null;
                measurePoints(payload.mode, payload.points);
              }
            }
          } catch (error) {
            platformControls?.update({ refinementStatus: error instanceof Error ? error.message : "\uCE21\uC815 \uC88C\uD45C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694." });
          }
          hud?.setPickingEnabled?.(!measurementMode);
          break;
        case "refinement-compare":
          try {
            compareCatalog(payload);
          } catch (error) {
            controls.announce(error instanceof Error ? error.message : "\uC790\uB8CC\uD310 \uBE44\uAD50\uB97C \uC644\uB8CC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
          }
          break;
        case "refinement-offline":
          void offlineRelease(payload);
          break;
        case "refinement-assistant":
          void requestAssistant(payload);
          break;
        case "search-highlight":
          if (Array.isArray(payload.entityIds)) {
            const ids = payload.entityIds.flatMap((id2) => {
              if (typeof id2 !== "string") return [];
              const entity = entityFor(id2), owner = entity?.owningBuildingId ? entityFor(entity.owningBuildingId) : entity;
              return typeof owner?.feature?.id === "string" ? [owner.feature.id] : [];
            });
            app?.site?.setInteractionState?.({ searchIds: ids });
          }
          return;
        case "refinement-ar":
          if (payload.command === "exit") void xrRuntime?.exit();
          else if (payload.command === "start") {
            const anchor = arAnchors.find((item) => item.id === payload.anchorId && item.campusId === activeCampusId);
            if (anchor) void xrRuntime?.startAR(anchor).catch((error) => platformControls?.update({ xrStatus: error instanceof Error ? error.message : "AR \uC138\uC158\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." }));
            else platformControls?.update({ xrStatus: "\uAC80\uC218\uB41C \uD604\uC7A5 \uAE30\uC900\uC810 \uC790\uB8CC\uAC00 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." });
          } else if (payload.command === "capture" && typeof payload.landmarkId === "string") {
            try {
              xrRuntime?.capture(payload.landmarkId);
            } catch (error) {
              platformControls?.update({ xrStatus: error instanceof Error ? error.message : "\uD604\uC7A5 \uAE30\uC900\uC810\uC744 \uCEA1\uCC98\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
            }
          } else if (payload.command === "review") {
            try {
              xrRuntime?.review();
            } catch (error) {
              platformControls?.update({ xrStatus: error instanceof Error ? error.message : "\uD604\uC7A5 \uC815\uD569\uC744 \uAC80\uC99D\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
            }
          }
          break;
        case "view":
          if (payload.view === "overview" || payload.view === "top" || payload.view === "free" || payload.view === "text" || payload.view === "2d") setView(payload.view);
          break;
        case "reset":
          setView("overview");
          camera?.reset();
          break;
        case "resize":
          camera?.resize();
          updateSafeArea();
          break;
        case "zoom":
          if (typeof payload.direction === "number") camera?.zoom(payload.direction);
          break;
        case "rotate":
          if (typeof payload.direction === "number") camera?.rotate(payload.direction);
          break;
        case "toggle":
          if (typeof payload.layer === "string" && payload.layer in layers && typeof payload.enabled === "boolean") {
            const layer = payload.layer;
            layers[layer] = payload.enabled;
            app.site?.setLayerVisible(layer, payload.enabled && (layer !== "trees" || !(quality === "low" || quality === "auto" && automaticLow)));
          }
          break;
        case "exaggeration":
          if (typeof payload.factor === "number" && Number.isFinite(payload.factor) && payload.factor >= 1 && payload.factor <= 2 && Number.isInteger(payload.factor * 4)) {
            exaggeration = payload.factor;
            const change = app.site?.setVerticalExaggeration;
            if (typeof change === "function") change(exaggeration);
          }
          break;
        case "select":
          if (typeof payload.id === "string") selectBuilding(payload.id);
          else if (payload.id === null) {
            selectedId = null;
            publicSelectedId = null;
            app.selectedId = null;
            app.site?.setInteractionState?.({ selected: null });
            controls.selectBuilding("");
          }
          break;
        case "interior":
          if (typeof payload.id === "string") openInterior(payload.id);
          break;
        case "retry":
          boot();
          break;
        case "export":
          void exportView(typeof payload.view === "string" ? payload.view : view);
          break;
        case "quality":
          if (payload.quality === "auto" || payload.quality === "low" || payload.quality === "high") setQuality(payload.quality);
          break;
        case "model-retry":
          if (typeof payload.id === "string") {
            const entity = entityFor(payload.id);
            const feature = buildingByLegacy.get(entity?.legacyKey || entity?.legacyId || "") || buildingById.get(typeof entity?.feature?.id === "string" ? entity.feature.id : payload.id);
            const registered = feature && modelsForCampus(activeManifest, activeCampusId, [feature])[0];
            if (registered) void loader?.retry(registered.id);
          }
          break;
        case "tour-capture":
          tourSnapshot = getState();
          break;
        case "tour-focus":
          if (typeof payload.id === "string") selectBuilding(payload.id);
          break;
        case "tour-restore":
          if (tourSnapshot) {
            applyState(tourSnapshot);
            tourSnapshot = null;
          } else if (cameraState(payload.snapshot)) {
            camera?.restore(payload.snapshot);
            view = payload.snapshot.view;
          } else applyState(payload.snapshot);
          break;
        case "campus":
          if (typeof payload.campusId === "string") switchCampus(payload.campusId);
          break;
        case "switchCatalog": {
          const result = window.CampusPlatform.validateCatalog(payload.catalog);
          if (result.valid && record(payload.catalog)) {
            catalog = window.CampusPlatform.publicCatalog(payload.catalog);
            activeManifest = catalog.assetManifest || manifest;
            validateModelManifest(activeManifest);
            releaseId = null;
            switchCampus(catalog.activeCampusId);
          } else controls.announce(`\uC790\uB8CC\uB97C \uC801\uC6A9\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${result.errors.slice(0, 2).join(", ")}`);
          break;
        }
        case "layer":
          if (typeof payload.layer === "string" && typeof payload.enabled === "boolean" && catalog.layers.some((layer) => layer.id === payload.layer)) {
            layers[payload.layer] = payload.enabled;
            app.site?.setLayerVisible(payload.layer, payload.enabled);
            applyQuality();
          }
          break;
        case "history":
          if (payload.status === "current" || payload.status === "historic" || payload.status === "proposed") {
            lifecycle = payload.status;
            applyQuality();
          }
          break;
        case "location":
          showLocation(payload);
          break;
        case "route": {
          routeMesh?.dispose();
          routeMesh = null;
          const result = payload.result;
          if (!app.scene || !app.site || !record(result)) break;
          const points = Array.isArray(result.pointsMeters) ? result.pointsMeters : Array.isArray(result.points) ? result.points : Array.isArray(result.nodes) ? result.nodes.flatMap((node) => record(node) && record(node.position) ? [[node.position.east, node.position.north]] : []) : [];
          const vectors = points.flatMap((point2) => Array.isArray(point2) && point2.length >= 2 && typeof point2[0] === "number" && typeof point2[1] === "number" && Number.isFinite(point2[0]) && Number.isFinite(point2[1]) ? [new BABYLON.Vector3(point2[0] / 10, app.site.terrainHeightAt(point2[0] / 10, -point2[1] / 10) + 0.12, -point2[1] / 10)] : []);
          if (vectors.length >= 2) {
            routeMesh = BABYLON.MeshBuilder.CreateLines("platform-route-preview", { points: vectors }, app.scene);
            routeMesh.color = BABYLON.Color3.FromHexString("#b55e30");
            routeMesh.isPickable = false;
          }
          const routeIds = Array.isArray(result.nodes) ? result.nodes.flatMap((node) => record(node) && typeof node.id === "string" && entityFor(node.id)?.feature?.id ? [String(entityFor(node.id)?.feature?.id)] : []) : [];
          app.site.setInteractionState?.({ routeIds });
          break;
        }
        case "xr": {
          if (xrRuntime) void xrRuntime.startVR().catch((error) => platformControls?.update({ xrStatus: error instanceof Error ? error.message : "VR \uC138\uC158\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." }));
          else controls.announce("3D \uD654\uBA74\uC774 \uC900\uBE44\uB41C \uB4A4 XR\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
          break;
        }
      }
      updateUi();
      persistState(action === "view" || action === "campus");
    }
    function installControls() {
      platformControls?.destroy();
      platformControls = null;
      controls = window.CampusSiteControls.initialize({ onAction, buildings: plan.features.buildings.map((building) => ({ ...building, hasInterior: Boolean(interiorFor(featureKey(building))), description: building.role || "\uC9C0\uB3C4\uC640 \uACF5\uAC1C \uC548\uB0B4 \uC790\uB8CC\uC5D0 \uAE30\uBC18\uD55C \uBC30\uCE58", entrance: "\uCD9C\uC785\uAD6C \uC704\uCE58\xB7\uC774\uC6A9 \uAC00\uB2A5 \uC5EC\uBD80\uB294 \uC790\uB8CC \uAE30\uC900\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." })), evidence: plan.evidence || plan });
      if (app) app.controls = controls;
      platformControls = window.CampusPlatformControls.initialize({ catalog, onAction, getState, apiBase: "/api/v1" });
    }
    installControls();
    app = window.CampusApp = { scene: null, engine: null, site: null, controls, ready: false, selectedId, models: /* @__PURE__ */ new Map(), selectBuilding, exportView, getState, applyState, getLocationSnapshot, retryModel: (id2) => {
      const entity = entityFor(id2);
      const feature = buildingByLegacy.get(entity?.legacyKey || entity?.legacyId || "") || buildingById.get(typeof entity?.feature?.id === "string" ? entity.feature.id : id2);
      const entry = feature && modelsForCampus(activeManifest, activeCampusId, [feature])[0];
      return entry ? loader?.retry(entry.id) || Promise.resolve(null) : Promise.resolve(null);
    }, setQuality, diagnostics: () => ({ ready: app.ready, view, layers: { ...layers }, selectedId, exaggeration, quality, effectiveQuality: quality === "low" || quality === "auto" && automaticLow ? "low" : "high", campusId: activeCampusId, catalogVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, modelLoader: loader?.getDiagnostics(), ...runtimeDiagnostics(), ...app.site?.getDiagnostics() }) };
    const offline = Reflect.get(window, "CampusOffline");
    offlineCatalogPending = !navigator.onLine && record(offline) && typeof offline.initialize === "function";
    if (record(offline) && typeof offline.initialize === "function") void Promise.resolve(offline.initialize()).then(async () => {
      if (applicationClosed) return;
      platformControls?.update({ offlineReady: true });
      if (typeof offline.readCatalog === "function") {
        const saved = await offline.readCatalog();
        if (record(saved) && record(saved.catalog) && window.CampusPlatform.validateCatalog(saved.catalog).valid) {
          offlineBundle = saved;
          if (!navigator.onLine || approvedRefreshFailed) useSavedApprovedCatalog();
        }
      }
    }).catch(() => controls.announce("\uC624\uD504\uB77C\uC778 \uC800\uC7A5\uC744 \uC900\uBE44\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC548\uB0B4\uB294 \uACC4\uC18D \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.")).finally(() => {
      offlineCatalogPending = false;
      if (!applicationClosed) updateVisibility();
    });
    function createLabels() {
      let layer = document.getElementById("mapLabels");
      if (!layer) {
        layer = document.createElement("div");
        layer.id = "mapLabels";
        layer.className = "map-labels";
        layer.setAttribute("aria-hidden", "true");
        document.body.append(layer);
      }
      layer.replaceChildren();
      labels.clear();
      facilityLabels.clear();
      for (const feature of plan.features.buildings) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "map-label";
        button.tabIndex = -1;
        button.textContent = `${feature.number ? `${feature.number} ` : ""}${feature.name}`;
        button.addEventListener("click", () => selectBuilding(feature.id));
        layer.append(button);
        labels.set(feature.id, button);
      }
      const markers = app.site?.featureMarkers;
      if (Array.isArray(markers)) {
        for (const candidate of markers) {
          if (!record(candidate) || !record(candidate.feature) || !(candidate.mesh instanceof BABYLON.AbstractMesh)) continue;
          const feature = candidate.feature;
          if (typeof feature.name !== "string" || typeof feature.id !== "string") continue;
          if (!["sports", "parking", "water", "gate"].includes(String(feature.kind)) && !/정문|동문|서문/.test(feature.name)) continue;
          const element = document.createElement("span");
          element.className = "map-label map-feature-label";
          element.textContent = feature.name;
          element.title = "\uACF5\uAC1C \uCEA0\uD37C\uC2A4 \uC548\uB0B4 \uC0BD\uD654 \uAE30\uBC18 \uCD94\uC815 \uC704\uCE58\xB7\uC678\uACFD";
          layer.append(element);
          facilityLabels.set(feature.id, { element, mesh: candidate.mesh });
        }
      }
    }
    function updateLabels() {
      if (!app.scene || !app.engine) return;
      const camera = app.scene.activeCamera;
      if (!camera) return;
      const width = app.engine.getRenderWidth();
      const height = app.engine.getRenderHeight();
      const viewport = camera.viewport.toGlobal(width, height);
      const occupied = [];
      const sorted = [...labels].sort(([a], [b]) => Number(b === selectedId) - Number(a === selectedId));
      for (const [id2, label] of sorted) {
        const detail = app.models.get(id2);
        const model = detail?.root.isEnabled() ? detail : app.site?.getBuildingProxy?.(id2);
        const mesh = model?.main || model?.hall || model?.newDorm || model?.mediaHall;
        if (!mesh || !model?.root.isEnabled() || !layers.labels) {
          label.hidden = true;
          continue;
        }
        const projected = app.site?.projectFeature?.(id2, { occlusion: true });
        if (!projected) {
          label.hidden = true;
          continue;
        }
        const rect2 = document.getElementById("renderCanvas").getBoundingClientRect();
        const x = id2 === selectedId ? Math.max(40, Math.min(rect2.width - 40, projected.x * rect2.width / width)) : projected.x * rect2.width / width;
        const y = id2 === selectedId ? Math.max(95, Math.min(rect2.height - 65, projected.y * rect2.height / height)) : projected.y * rect2.height / height;
        const w = Math.max(76, label.textContent.length * 11);
        const collision = occupied.some((item) => Math.abs(item.x - x) < (item.w + w) / 2 && Math.abs(item.y - y) < 30);
        label.hidden = projected.depth < 0 || projected.depth > 1 || x < 30 || x > rect2.width - 30 || y < 95 || y > rect2.height - 62 || (collision || projected.occluded) && id2 !== selectedId;
        label.classList.toggle("is-selected", id2 === selectedId);
        if (!label.hidden) {
          label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
          occupied.push({ x, y, w });
        }
      }
      const rect = document.getElementById("renderCanvas").getBoundingClientRect();
      for (const { element, mesh } of facilityLabels.values()) {
        mesh.computeWorldMatrix(true);
        const center = mesh.getBoundingInfo().boundingBox.centerWorld;
        const projected = BABYLON.Vector3.Project(center.add(new BABYLON.Vector3(0, 0.12, 0)), BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport);
        const x = projected.x * rect.width / width;
        const y = projected.y * rect.height / height;
        const w = element.textContent.length * 10 + 15;
        element.hidden = !layers.labels || projected.z < 0 || projected.z > 1 || x < 30 || x > rect.width - 30 || y < 95 || y > rect.height - 62 || occupied.some((item) => Math.abs(item.x - x) < (item.w + w) / 2 && Math.abs(item.y - y) < 26);
        if (!element.hidden) {
          element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
          occupied.push({ x, y, w });
        }
      }
    }
    function createTextFallback() {
      if (fallback) return;
      fallback = CampusHud.createTextInteriorController();
      for (const feature of plan.features.buildings) {
        const key = featureKey(feature);
        const interior = interiorFor(key);
        if (interior) fallback.registerInterior(null, interior, null, key);
      }
    }
    function boot() {
      const generation = ++bootGeneration;
      controls.setStatus("loading", "\uCEA0\uD37C\uC2A4 \uC870\uAC10\uB3C4\uB97C \uC900\uBE44\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
      hud?.dispose?.();
      hud?.hideInterior();
      hud = null;
      fallback?.dispose?.();
      fallback = null;
      app.ready = false;
      locationSnapshot = null;
      platformControls?.update({ location: null });
      loader?.dispose();
      loader = null;
      routeMesh?.dispose();
      routeMesh = null;
      refinementRuntime?.dispose();
      refinementRuntime = null;
      instrumentation?.dispose();
      instrumentation = null;
      xrRuntime?.dispose();
      xrRuntime = null;
      xrStatus = null;
      xrExperience?.dispose();
      xrExperience = null;
      detailVisibility.clear();
      automaticLow = false;
      frameAverageMs = 16;
      qualityFrames = 0;
      qualityChangedAt = 0;
      measurementMode = null;
      measurementPoints = [];
      safeAreaKey = "";
      frameIntervals.length = 0;
      lastFrameTime = 0;
      frameP95Ms = 0;
      lastVisibilityTime = 0;
      app.site?.dispose();
      app.scene?.dispose();
      app.engine?.dispose();
      app.site = null;
      app.scene = null;
      app.engine = null;
      app.models.clear();
      try {
        if (typeof BABYLON === "undefined" || !BABYLON.Engine.IsSupported) throw new Error("WebGL is unavailable");
        const canvas = document.getElementById("renderCanvas");
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas is missing");
        const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: "high-performance" });
        app.engine = engine;
        const scene = new BABYLON.Scene(engine);
        app.scene = scene;
        scene.useRightHandedSystem = true;
        scene.clearColor = new BABYLON.Color4(0.72, 0.78, 0.7, 1);
        const hemi = new BABYLON.HemisphericLight("sky-light", new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.5;
        const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -0.85, 0.35), scene);
        sun.intensity = 0.45;
        const materials = createMaterials(scene);
        const site = window.CampusSiteScene.create(scene, materials, plan, { terrain: activeTerrain, canvas, metersPerUnit: 10 });
        app.site = site;
        site.cameraController.setObservationSettings?.({ eyeHeightMeters: Number(refinement.eyeHeightMeters) });
        refinementRuntime = createRefinementRuntime(BABYLON, scene, site, () => catalog);
        xrRuntime = createXrRefinement(BABYLON, scene, site, () => ({ vrMovement: refinement.vrMovement === "smooth" ? "smooth" : "teleport", vrTurn: refinement.vrTurn === "smooth" ? "smooth" : "snap", eyeHeightMeters: Number(refinement.eyeHeightMeters), catalog, campusId: activeCampusId }), (status) => {
          xrStatus = status;
          platformControls?.update({ xrStatus: status.message, arLandmarks: status.capturedIds, arCalibrationReport: status.report });
        });
        instrumentation = new BABYLON.SceneInstrumentation(scene);
        for (const feature of plan.features.buildings) {
          const proxy = site.getBuildingProxy?.(feature.id);
          if (proxy) app.models.set(feature.id, proxy);
        }
        site.cameraController.reset();
        view = "overview";
        if (!scene.activeCamera) throw new Error("Camera is unavailable");
        hud = CampusHud.createHud(scene, scene.activeCamera, CampusData.campusInfo, CampusData.confirmedBuildings, CampusData.janggongResearch, () => site.cameraController.reset());
        hud.setInteriorLifecycle?.({ capture: () => {
          cameraSnapshot = { camera: site.cameraController.capture(), view };
          return cameraSnapshot;
        }, restore: (snapshot) => {
          if (record(snapshot)) {
            site.cameraController.restore(snapshot.camera);
            if (snapshot.view === "overview" || snapshot.view === "top" || snapshot.view === "free") view = snapshot.view;
          }
          updateUi();
        }, onOpen: (id2) => {
          const feature = buildingByLegacy.get(id2) || buildingById.get(id2);
          if (feature) {
            selectedId = feature.id;
            app.selectedId = selectedId;
            controls.selectBuilding(selectedId);
            const owner = entityFor(feature.id);
            const current = publicSelectedId ? entityFor(publicSelectedId) : void 0;
            if (owner && (current?.owningBuildingId || current?.id) !== owner.id) {
              publicSelectedId = owner.id;
              floor = null;
            }
          }
        } });
        for (const [id2, model] of app.models) {
          const feature = buildingById.get(id2);
          const mesh = model.main || model.hall || model.newDorm || model.mediaHall;
          const interior = interiorFor(featureKey(feature));
          if (mesh && interior) hud.registerInterior(mesh, interior, () => site.cameraController.focusBuilding(featureKey(feature)), featureKey(feature));
        }
        const activeEntries = modelsForCampus(activeManifest, activeCampusId, plan.features.buildings);
        loader = createModelLoader({ scene, materials, site, manifest: { ...activeManifest, models: activeEntries }, maxConcurrent: 2, maxResidentModels: 24, maxResidentBytes: 128 * 1024 * 1024, legacyFactory: browserLegacyFactory, importGlb: (entry, signal) => browserGlbModel(BABYLON, scene, site, entry, signal), onState(id2, state) {
          if (generation !== bootGeneration) return;
          if (state.status !== "ready" && !loader?.models.has(id2)) {
            const entry = activeEntries.find((item) => item.id === id2);
            const feature = entry && (buildingById.get(entry.buildingId || entry.id) || buildingByLegacy.get(entry.legacyId || entry.id));
            const proxy = feature && site.getBuildingProxy?.(feature.id);
            if (feature && proxy) app.models.set(feature.id, proxy);
          }
          updateUi();
        }, onLoaded(entry, model) {
          if (generation !== bootGeneration) return;
          const feature = buildingById.get(entry.buildingId || entry.id) || buildingByLegacy.get(entry.legacyId || entry.id);
          if (!feature) return;
          model.root.metadata = { ...model.root.metadata || {}, featureId: feature.id };
          if (entry.kind === "glb") site.registerExternalModel?.(model, feature.id);
          app.models.set(feature.id, model);
          const mesh = model.main || model.hall || model.newDorm || model.mediaHall;
          const interior = interiorFor(featureKey(feature));
          if (mesh && interior) hud?.registerInterior(mesh, interior, () => site.cameraController.focusBuilding(featureKey(feature)), featureKey(feature));
          detailVisibility.delete(entry.id);
          applyQuality();
          updateLabels();
        } });
        createLabels();
        app.ready = true;
        updateSafeArea();
        Object.entries(layers).forEach(([layer, enabled]) => site.setLayerVisible(layer, enabled));
        if (exaggeration !== 1) site.setVerticalExaggeration?.(exaggeration);
        applyQuality();
        controls.setStatus("ready", "\uC804\uCCB4 \uBD80\uC9C0\uB97C \uB458\uB7EC\uBCF4\uAC70\uB098 \uAC74\uBB3C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
        engine.runRenderLoop(() => {
          if (view !== "text" && view !== "2d") {
            const start = performance.now();
            scene.render();
            const elapsed = performance.now() - start;
            frameAverageMs = frameAverageMs * 0.94 + elapsed * 0.06;
            qualityFrames += 1;
            const time = performance.now();
            if (quality === "auto" && !document.hidden && qualityFrames >= 90 && time - qualityChangedAt > 8e3) {
              const nextLow = automaticLow ? frameAverageMs >= 13 : frameAverageMs > 28;
              if (nextLow !== automaticLow) {
                automaticLow = nextLow;
                qualityChangedAt = time;
                qualityFrames = 0;
                applyQuality();
              }
            }
          }
          const now = performance.now();
          if (lastFrameTime && !document.hidden) {
            const interval = now - lastFrameTime;
            if (interval < 2e3) {
              frameIntervals.push(interval);
              if (frameIntervals.length > 240) frameIntervals.shift();
            }
          }
          lastFrameTime = now;
          if (now - lastVisibilityTime > 500) {
            lastVisibilityTime = now;
            updateSafeArea();
            updateVisibility();
            const sorted = [...frameIntervals].sort((a, b) => a - b);
            frameP95Ms = sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.95)] : 0;
          }
          if (now - lastUiTime > 300) {
            lastUiTime = now;
            updateLabels();
            updateUi();
          }
        });
        scene.onPointerObservable.add((info, eventState) => {
          if (!info.pickInfo?.hit) {
            if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) site.setInteractionState?.({ hovered: null });
            return;
          }
          if (info.type === BABYLON.PointerEventTypes.POINTERPICK && measurementMode && info.pickInfo.pickedPoint) {
            eventState.skipNextObservers = true;
            const point2 = info.pickInfo.pickedPoint;
            measurementPoints.push([point2.x * 10, -point2.z * 10, point2.y * 10]);
            const minimum = measurementMode === "area" ? 3 : 2;
            if (measurementPoints.length >= minimum) {
              measurePoints(measurementMode, measurementPoints);
              if (measurementMode === "planar-distance" || measurementMode === "height-difference" || measurementPoints.length >= 256) {
                measurementMode = null;
                hud?.setPickingEnabled?.(true);
              }
            }
            return;
          }
          if (info.type !== BABYLON.PointerEventTypes.POINTERPICK && info.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;
          let node = info.pickInfo.pickedMesh;
          while (node) {
            const id2 = node.metadata?.featureId;
            if (typeof id2 === "string" && (buildingById.has(id2) || entityFor(id2))) {
              if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) site.setInteractionState?.({ hovered: id2 });
              else selectBuilding(id2);
              break;
            }
            node = node.parent;
          }
        });
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (generation !== bootGeneration) return;
          updateVisibility();
        }));
        engine.onContextLostObservable.add(() => {
          app.ready = false;
          controls.setStatus("error", "3D \uD45C\uC2DC\uAC00 \uC911\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAC74\uBB3C \uBAA9\uB85D\uC740 \uACC4\uC18D \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
          createTextFallback();
        });
        engine.onContextRestoredObservable.add(() => {
          if (generation === bootGeneration) {
            app.ready = true;
            controls.setStatus("ready", "3D \uD45C\uC2DC\uAC00 \uBCF5\uAD6C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
            updateVisibility();
          }
        });
        updateUi();
      } catch (error) {
        app.ready = false;
        app.site?.dispose();
        app.scene?.dispose();
        app.engine?.dispose();
        app.site = null;
        app.scene = null;
        app.engine = null;
        controls.setStatus("error", "3D \uD654\uBA74\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAC74\uBB3C \uBAA9\uB85D\uACFC \uB0B4\uBD80 \uC815\uBCF4\uB294 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uAC70\uB098 WebGL\uC744 \uC9C0\uC6D0\uD558\uB294 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
        console.error("Campus initialization failed", error instanceof Error ? error.message : "Unknown initialization error");
        createTextFallback();
      }
    }
    window.addEventListener("resize", () => {
      app.engine?.resize();
      controller()?.resize();
      updateSafeArea();
      updateUi();
    });
    const floorSelection = (event) => {
      const tab = event.target instanceof Element ? event.target.closest(".floor-tab") : null;
      if (tab?.dataset.floorTarget) {
        floor = tab.dataset.floorTarget;
        persistState(true);
      }
    };
    document.addEventListener("click", floorSelection);
    function parseLocationState() {
      const hash = window.CampusPlatform.parseState(location.hash);
      return hash.valid ? hash : window.CampusPlatform.parseState(location.search);
    }
    const popstate = (event) => {
      if (record(event.state) && event.state.campusView) applyState(event.state.campusView);
      else {
        const parsed = parseLocationState();
        if (parsed.valid && parsed.state) applyState(parsed.state);
      }
    };
    window.addEventListener("popstate", popstate);
    window.addEventListener("pagehide", () => {
      applicationClosed = true;
      persistState();
      locationSnapshot = null;
      loader?.dispose();
      refinementRuntime?.dispose();
      xrRuntime?.dispose();
      instrumentation?.dispose();
      hud?.dispose?.();
      fallback?.dispose?.();
      xrExperience?.dispose();
      platformControls?.destroy();
      app.site?.dispose();
      app.scene?.dispose();
      app.engine?.dispose();
      controls.destroy();
      document.removeEventListener("click", floorSelection);
      window.removeEventListener("popstate", popstate);
    });
    boot();
    if (shared.valid && shared.state) applyState(shared.state);
    else {
      try {
        const saved = JSON.parse(localStorage.getItem("hanshin-campus-view-v1") || "null");
        if (saved) applyState(saved);
      } catch {
        controls.announce("\uC800\uC7A5\uB41C \uBCF4\uAE30 \uC0C1\uD0DC\uB97C \uC77D\uC9C0 \uBABB\uD574 \uC804\uCCB4 \uBD80\uC9C0\uB85C \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4.");
      }
    }
    async function refreshApprovedCatalog() {
      if (!/^https?:$/.test(location.protocol)) return;
      const request = new AbortController();
      const timeout = window.setTimeout(() => request.abort(), 5e3);
      try {
        const capability = await fetch(location.pathname || "/", { method: "HEAD", signal: request.signal, credentials: "same-origin", cache: "no-store" });
        if (!capability.ok || capability.headers.get("X-Campus-Api") !== "/api/v1") return;
        const endpoint = new URL("/api/v1/catalog", location.href);
        const requested = shared.valid ? shared.state : null;
        if (requested?.releaseId) endpoint.searchParams.set("release", requested.releaseId);
        if (endpoint.origin !== location.origin) return;
        const response = await fetch(endpoint, { signal: request.signal, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) {
          if (requested?.releaseId) {
            sharedStatus = "\uACF5\uC720\uD55C \uACF5\uAC1C\uD310\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uC790\uB8CC\uB97C \uD45C\uC2DC\uD569\uB2C8\uB2E4.";
            updateUi();
          }
          return;
        }
        const encoded = await response.text();
        if (encoded.length > 2 * 1024 * 1024) throw new Error("Public catalog exceeds import limit.");
        const payload = JSON.parse(encoded);
        const value = record(payload) && record(payload.data) ? payload.data.catalog || payload.data : payload;
        const checked = window.CampusPlatform.validateCatalog(value);
        if (!checked.valid || !record(value)) throw new Error("Public catalog validation failed.");
        const next = window.CampusPlatform.publicCatalog(value);
        const meta = record(payload) && record(payload.meta) ? payload.meta : null;
        if (meta && Array.isArray(meta.mediaRecords)) mediaRecords = meta.mediaRecords;
        const nextRelease = meta && typeof meta.releaseId === "string" ? meta.releaseId : null;
        if (requested?.contentVersion && requested.contentVersion !== next.contentVersion) sharedStatus = "\uACF5\uC720 \uB9C1\uD06C\uC758 \uC790\uB8CC\uD310\uACFC \uD604\uC7AC \uACF5\uAC1C\uD310\uC774 \uB2E4\uB985\uB2C8\uB2E4. \uACF5\uAC04\uC758 \uBCC0\uACBD\xB7\uD3D0\uAE30\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
        if (applicationClosed || next.contentVersion === catalog.contentVersion && releaseId === nextRelease) return;
        const state = getState();
        catalog = next;
        activeManifest = catalog.assetManifest || manifest;
        validateModelManifest(activeManifest);
        releaseId = nextRelease;
        const targetId = catalog.campuses.some((campus) => campus.id === state.campusId) ? state.campusId : catalog.activeCampusId;
        if (switchCampus(targetId)) {
          applyState({ ...state, campusId: targetId, camera: null });
          if (requested) applyState(requested);
          controls.announce(`\uC2B9\uC778\uB41C \uACF5\uAC1C \uC790\uB8CC ${next.contentVersion}\uB85C \uAC31\uC2E0\uD588\uC2B5\uB2C8\uB2E4. \uD654\uBA74\uACFC \uC790\uB8CC \uAE30\uC900\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.`);
        }
      } catch (error) {
        approvedRefreshFailed = true;
        useSavedApprovedCatalog();
        console.info("Approved catalog refresh unavailable; saved or packaged catalog remains active", error instanceof Error ? error.message : "Unavailable");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void refreshApprovedCatalog();
  }
  initializeApplication();
})();
