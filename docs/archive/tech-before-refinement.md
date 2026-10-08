# 2026-10-07 정교화 이전 문서 보관

이 문서는 기존 조사·구현 기록을 보존한 자료다. 현재 좌표·경계·실행·검증 기준은 루트 ReadMe.md와 docs/accuracy.md, deployment.md, validation.md를 따른다. 아래의 과거 추정 수치·구현 예정·실행 방법을 현재 상태로 해석하지 않는다.

---

# 기술 문서

이 문서는 한신대학교 경기캠퍼스 3D 모델링 웹사이트의 작동 원리와 기술 구조를 설명합니다. 사용자 관점의 흐름은 `ReadMe.md`에 정리되어 있고, 이 문서는 구현 방식, 데이터 흐름, 주요 함수, 렌더링 구조, 유지보수 기준을 중심으로 설명합니다.

## 전체 기술 구조

프로젝트는 정적 웹사이트 구조입니다. 별도 번들러, 서버, 데이터베이스 없이 `index.html`이 필요한 스크립트를 순서대로 로드합니다.

기술 스택은 다음과 같습니다.

- HTML
- CSS
- JavaScript
- TypeScript 원본 병행 관리
- Babylon.js
- Babylon GUI

현재 브라우저가 실제로 실행하는 파일은 JavaScript 파일입니다. TypeScript 파일은 원본 또는 타입 확인용 파일로 함께 관리됩니다.

```text
index.html
src/app.js
src/app.ts
src/data/campus-data.js
src/data/interior-data.js
src/models/*.js
src/models/*.ts
src/ui/hud.js
tsconfig.json
```

## 로딩 순서

`index.html`은 모든 코드를 전역 스크립트 방식으로 로드합니다. ES module import/export를 사용하지 않습니다. 각 파일은 `window` 전역 객체에 필요한 데이터를 붙이고, 뒤에 로드되는 파일이 그 값을 참조합니다.

현재 로딩 순서는 다음과 같습니다.

1. Babylon.js CDN
2. Babylon GUI CDN
3. `src/data/campus-data.js`
4. `src/data/interior-data.js`
5. 건물별 모델 파일
6. `src/ui/hud.js`
7. `src/app.js`

이 순서가 중요합니다. 예를 들어 `app.js`는 `CampusData`, `JanggongModel`, `CampusHud` 같은 전역 객체를 바로 참조합니다. 따라서 데이터 파일과 모델 파일이 `app.js`보다 먼저 로드되어야 합니다.

## 전역 객체 구조

프로젝트는 번들러 없이 동작하기 때문에 전역 객체를 명시적으로 사용합니다.

주요 전역 객체는 다음과 같습니다.

- `window.CampusData`
- `window.JanggongModel`
- `window.PilheonModel`
- `window.ManwooModel`
- `window.ShalomModel`
- `window.ImmanuelModel`
- `window.GyeongsamModel`
- `window.SongamModel`
- `window.SotongModel`
- `window.PracticeModel`
- `window.HanulModel`
- `window.SeongbinModel`
- `window.SaeromModel`
- `window.HaeoreumModel`
- `window.JoonhaModel`
- `window.NeutbomModel`
- `window.ChildcareModel`
- `window.CampusHud`

건물 모델 파일은 각각 `window.<Name>Model.create<Name>Model()` 형식의 생성 함수를 제공합니다. `app.js`는 이 생성 함수를 호출해 장면에 건물을 배치합니다.

## `index.html`의 역할

`index.html`은 세 가지 역할을 합니다.

첫째, 전체 화면 캔버스를 제공합니다.

```html
<canvas id="renderCanvas" aria-label="한신대학교 Babylon.js 3D 캠퍼스 모델"></canvas>
```

둘째, 상단 상태 바와 내부 상세 패널 컨테이너를 제공합니다.

```html
<header class="campus-topbar" aria-label="프로젝트 상태">...</header>
<section id="buildingDetail" class="detail-panel" aria-label="건물 내부 상세 화면" hidden></section>
```

셋째, 웹사이트 전체 스타일을 정의합니다. 내부도 상세 패널, 층 탭, 평면 구역, 범례, 카드형 설명 영역 등 대부분의 UI 스타일이 `index.html` 내부 CSS에 들어 있습니다.

## 장면 생성 흐름

장면 생성은 `src/app.js`의 `createScene(engine, canvas)`에서 시작됩니다.

전체 흐름은 다음과 같습니다.

1. `BABYLON.Scene` 생성
2. 배경색 설정
3. `UniversalCamera` 생성
4. 키보드 이동 설정
5. HemisphericLight와 DirectionalLight 생성
6. 재질 생성
7. 지형과 캠퍼스 컨텍스트 생성
8. 도로/보행 네트워크 생성
9. 스케일 바 생성
10. 건물별 모델 생성
11. 지형 높이에 맞춰 건물 y 위치 보정
12. HUD 생성
13. 건물 라벨 등록
14. 건물 클릭 시 내부도 패널 등록
15. 렌더 루프 시작

마지막으로 `engine.runRenderLoop()`를 통해 계속 장면을 렌더링합니다.

## 카메라

카메라는 Babylon.js의 `UniversalCamera`를 사용합니다.

```js
const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(-11.5, 7.2, -18.5), scene);
camera.setTarget(new BABYLON.Vector3(-1.5, 1.2, -4.5));
camera.attachControl(canvas, true);
```

현재 카메라 설정은 탐색형 뷰에 맞춰져 있습니다.

- `camera.speed = 0.55`
- `camera.angularSensibility = 4200`
- W/A/S/D 키 이동 지원

건물을 클릭하면 `focusAt(anchor)`가 실행되어 카메라가 해당 건물 근처로 이동합니다.

## 조명

조명은 두 개를 사용합니다.

```js
const hemi = new BABYLON.HemisphericLight("sky-light", new BABYLON.Vector3(0, 1, 0), scene);
const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -0.85, 0.35), scene);
```

`HemisphericLight`는 전체 장면의 기본 밝기를 만들고, `DirectionalLight`는 건물의 입체감을 만들기 위한 방향성 빛으로 사용됩니다.

## 재질 시스템

재질은 `createMaterials(scene)`에서 한 번에 생성됩니다.

공통 helper는 `material(scene, name, color, roughness, alpha)`입니다.

```js
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
```

이 함수는 색, 거칠기, 투명도를 일관되게 지정합니다. 반투명 재질은 `MATERIAL_ALPHABLEND`와 `needDepthPrePass`를 설정해 겹침 문제를 줄입니다.

재질은 건물별로 세분화되어 있습니다. 예를 들어 장공관, 만우관, 샬롬채플관, 경삼관 등은 각각 벽, 지붕, 창, 포치, 강조 패널에 해당하는 재질을 별도로 가집니다. 이 방식은 파일이 길어지는 단점이 있지만, 건물별 외형 조정 시 다른 건물에 영향을 덜 줍니다.

## 지형 데이터 구조

지형 데이터는 `src/data/campus-data.js`의 `CampusData.terrain`에 있습니다.

주요 필드는 다음과 같습니다.

- `source`: 표고 데이터 출처 설명
- `note`: 지형 보정 기준
- `baseElevationMeters`: 모델 기준 최저 표고
- `unitPerMeter`: 실제 표고 1m를 Babylon y축 몇 unit으로 변환할지
- `xs`: 표고 샘플 x 좌표
- `zs`: 표고 샘플 z 좌표
- `elevations`: 7x7 표고 배열
- `ridgeModifiers`: 산지 능선 보정
- `valleyModifiers`: 저지대/골짜기 보정
- `buildingPads`: 건물 주변 평탄화 패드
- `retainingWalls`: 옹벽/절토면 표현

현재 `unitPerMeter`는 `0.075`입니다. 프로젝트의 수평 기준이 `1 unit = 10m`이므로 완전한 1:1 수직 축척은 아니지만, 이전보다 고저 차가 분명히 보이도록 조정된 값입니다.

## 지형 높이 계산

지형 높이는 여러 단계로 계산됩니다.

첫 번째 단계는 표고 샘플 보간입니다. `interpolatedElevationMeters(terrain, x, z)`가 7x7 표고 배열에서 현재 좌표 주변의 값을 bilinear interpolation 방식으로 계산합니다.

두 번째 단계는 지형 보정입니다. `terrainModifierMeters(terrain, x, z)`가 능선과 골짜기 보정값을 더합니다. `ridgeModifiers`는 특정 중심점 주변을 높이고, `valleyModifiers`는 특정 중심점 주변을 낮춥니다.

세 번째 단계는 건물 패드 보정입니다. `terrainHeightMeters(terrain, x, z)`는 건물 주변에 너무 급격한 경사가 생기지 않도록 `buildingPads`를 적용합니다. 건물 중심부는 상대적으로 평탄하게 만들고, 가장자리에서는 원래 지형으로 자연스럽게 전환합니다.

마지막 단계는 Babylon y축 변환입니다.

```js
function terrainHeightAt(terrain, x, z) {
  return (terrainHeightMeters(terrain, x, z) - terrain.baseElevationMeters) * terrain.unitPerMeter;
}
```

이 값이 실제 메쉬와 건물 배치의 y 좌표에 사용됩니다.

## 지형 메쉬 생성

지형은 `createTerrainGround(scene, materials, terrain)`에서 생성됩니다.

핵심 방식은 다음과 같습니다.

1. 장면 범위를 x/z 격자로 나눕니다.
2. 각 격자점마다 `terrainHeightAt()`으로 y 높이를 구합니다.
3. positions, indices, uvs 배열을 직접 구성합니다.
4. `BABYLON.VertexData.ComputeNormals()`로 법선을 계산합니다.
5. `BABYLON.Mesh`에 VertexData를 적용합니다.

이 방식은 `CreateGround`보다 복잡하지만, 지형 높이가 위치마다 다르게 적용되므로 캠퍼스 경사와 단차를 표현할 수 있습니다.

## 옹벽과 절토면

옹벽은 `createRetainingWalls(scene, materials, terrain)`에서 생성됩니다.

`CampusData.terrain.retainingWalls`에 있는 각 선형 데이터는 `points`와 `dropMeters`를 가집니다. 각 점에서 위쪽 y 좌표와 아래쪽 y 좌표를 만들고, 두 점 사이를 사각 면으로 이어 절토면처럼 보이게 합니다.

현재 옹벽은 다음 구간을 표현합니다.

- 생활관 주변 서쪽 사면
- 샬롬채플관~한울관 테라스
- 만우관~늦봄관 절토 구간
- 장준하통일관 동쪽 사면
- 경삼관~소통관 주변 단차
- 동쪽 진입부 절토 구간

## 도로와 보행로

도로와 보행로 데이터는 `CampusData.roadNetwork`에 있습니다. 원본은 OpenStreetMap의 highway way 정보를 모델 좌표계로 변환한 것입니다.

도로 렌더링은 `createRoadNetwork()`가 담당합니다. 실제 선형 메쉬 생성은 `createStripPath()`에서 합니다.

도로 정리 과정은 다음과 같습니다.

1. `clipPathAroundBuildings()`가 건물과 너무 겹치는 도로 구간을 자릅니다.
2. `simplifyPath()`가 Douglas-Peucker 방식으로 꺾임이 많은 경로를 단순화합니다.
3. `cleanPathForRender()`가 너무 짧은 조각을 버립니다.
4. `createStripPath()`가 폭이 있는 띠 형태의 메쉬를 만듭니다.

최근 정리 작업으로 다음 기준이 적용되어 있습니다.

- 차량 도로는 tolerance `0.7`, 최소 길이 `3.6`
- 보행로는 tolerance `0.55`, 최소 길이 `4.2`
- `steps` 타입 보행로는 화면이 지저분해지는 문제 때문에 렌더링하지 않음
- 건물 입구 방향 보조선은 데이터는 유지하지만 화면에는 그리지 않음

## 건물 모델 구조

건물별 모델 파일은 대체로 다음 구조를 따릅니다.

```js
window.SomeBuildingModel = window.SomeBuildingModel || {};

window.SomeBuildingModel.createSomeBuildingModel = function createSomeBuildingModel(scene, materials) {
  const root = new BABYLON.TransformNode("some-root", scene);
  const main = BABYLON.MeshBuilder.CreateBox("some-main", { ... }, scene);
  main.parent = root;
  main.material = materials.someWall;
  ...
  return { root, main, ... };
};
```

건물 생성 함수는 `root`와 주요 메쉬를 반환합니다. `root`는 전체 건물의 위치를 옮기기 위한 부모 노드입니다. `main`, `hall`, `newDorm`, `mediaHall` 같은 주요 메쉬는 라벨 연결, 클릭 연결, 지형 높이 계산에 사용됩니다.

## 건물 배치와 지형 높이 보정

건물은 모델 파일 내부에서 기본 x/z 위치를 갖고 생성됩니다. 이후 `applyTerrainOffsets()`가 각 건물을 지형 높이에 맞게 y축으로 올립니다.

핵심 함수는 다음과 같습니다.

```js
function terrainBaseHeightForModel(model, anchor) { ... }
function applyTerrainOffsets(items) { ... }
```

`terrainBaseHeightForModel()`은 건물의 기준 메쉬 bounding box를 읽고, 건물 중심과 모서리 주변의 지형 높이를 샘플링합니다. 그중 가장 높은 값을 건물의 기준 y 높이로 사용합니다.

이 방식은 건물이 경사진 지형에 묻히거나 공중에 떠 보이는 문제를 줄이기 위한 것입니다. 완전한 지형 절삭 모델은 아니지만, 현재의 단순 box 기반 건물 모델에서는 실용적인 보정 방식입니다.

## HUD 구조

HUD는 `src/ui/hud.js`에 있습니다.

주요 기능은 다음과 같습니다.

- 건물 hover 라벨 표시
- 스케일 바 표시
- 건물 클릭 이벤트 연결
- 내부 상세 패널 생성
- 층 탭 전환
- Escape 키로 패널 닫기

Babylon GUI는 3D 캔버스 위의 라벨과 스케일 바에 사용됩니다. 내부 상세 패널은 일반 HTML DOM으로 생성됩니다.

이렇게 나눈 이유는 다음과 같습니다.

- 건물 라벨은 3D 메쉬와 연결되어야 하므로 Babylon GUI가 적합합니다.
- 내부도 패널은 복잡한 HTML, 버튼, 스크롤, 반응형 레이아웃이 필요하므로 DOM이 더 적합합니다.

## 건물 라벨

건물 라벨은 `labelForMesh()`가 만듭니다. 각 라벨은 `GUI.Rectangle`과 `GUI.TextBlock`으로 구성됩니다.

라벨은 기본적으로 숨겨져 있고, 마우스를 건물 위에 올리면 표시됩니다.

이벤트 연결은 `connectHover()`에서 합니다. 해당 건물의 root 하위 메쉬 전체에 ActionManager를 등록해, 건물의 어느 부분에 마우스를 올려도 같은 라벨이 표시되도록 합니다.

## 클릭 이벤트와 내부도 연결

건물 클릭 이벤트는 `registerInterior()`를 통해 연결됩니다.

`app.js`에서는 다음과 같은 배열을 순회합니다.

```js
[
  [pilheon.main, CampusData.pilheonInterior, focusAt(CampusData.campusBoundary.anchors.pilheon)],
  [manwoo.main, CampusData.manwooInterior, focusAt(CampusData.campusBoundary.anchors.manwoo)],
  ...
].forEach(([mesh, interior, focus]) => {
  if (interior) hud.registerInterior(mesh, interior, focus);
});
```

사용자가 건물을 클릭하면 다음 순서로 동작합니다.

1. 해당 건물로 카메라가 이동합니다.
2. `open(data)`가 호출됩니다.
3. 내부도 데이터가 층별로 그룹화됩니다.
4. HTML 문자열이 생성됩니다.
5. `#buildingDetail` 패널에 삽입됩니다.
6. 층 탭 이벤트가 등록됩니다.

## 내부도 데이터 렌더링

내부도 렌더링은 `hud.js`의 여러 함수가 나눠 처리합니다.

- `groupedFloorData(data)`: 구역을 층별로 묶음
- `floorTabsHtml(floors)`: 층 탭 HTML 생성
- `floorLayersHtml(floors, title)`: 층별 평면 레이어 생성
- `floorZoneHtml(zone, index)`: 개별 구역 HTML 생성
- `footprintHtml(data)`: 건물 외형 배경 윤곽 생성
- `legendHtml(zones)`: 공간 종류 범례 생성
- `roomCardsHtml(rooms)`: 핵심 공간 카드 생성

내부도는 SVG나 Canvas가 아니라 HTML/CSS absolute layout으로 구성됩니다. 각 구역은 `.floor-zone` div이며, `left`, `top`, `width`, `height`를 퍼센트로 지정합니다.

이 방식의 장점은 다음과 같습니다.

- 구현이 단순합니다.
- 텍스트와 버튼 접근성이 좋습니다.
- CSS로 공간 종류별 색과 패턴을 쉽게 조정할 수 있습니다.
- 반응형 패널 크기 변화에 대응하기 쉽습니다.

단점은 다음과 같습니다.

- 실제 CAD 도면처럼 정밀한 스케일 표현은 어렵습니다.
- 복잡한 곡선 벽, 비정형 복도, 계단실 세부 구조 표현에는 한계가 있습니다.
- 확대/축소, 측정, 레이어 on/off 같은 도면 도구 기능은 없습니다.

## 층 추론 로직

내부도 데이터에는 모든 zone에 명시적 층이 들어 있지 않을 수 있습니다. 이때 `inferZoneFloor(zone, data)`가 zone id와 label을 보고 층을 추론합니다.

예를 들어 다음 단어들이 있으면 해당 층으로 분류합니다.

- `b1`, `지하` -> `B1`
- `5f`, `5층` -> `5F`
- `4f`, `4층` -> `4F`
- `3f`, `3층` -> `3F`
- `2f`, `2층`, `203`, `204`, `2202` 등 -> `2F`
- `1f`, `1층`, `현관`, `로비`, `식당`, `편의점` 등 -> `1F`

생활관 관련 키워드는 `생활관` 그룹으로 묶고, 주차장·운동장·외부 도로 등은 `외부` 그룹으로 묶습니다.

이 로직은 편리하지만 완전하지 않습니다. 특정 호실 번호가 다른 층을 의미하는 경우가 생기면 zone에 `floor` 값을 명시하는 편이 더 안전합니다.

## 데이터 파일의 책임 분리

현재 데이터는 크게 두 파일로 나뉩니다.

`campus-data.js`는 캠퍼스 전체 레벨의 데이터입니다.

- 캠퍼스 기본 정보
- 축척 정보
- 지형 정보
- 건물 앵커 좌표
- 도로와 보행로
- 입구 방향 데이터
- 장공관 조사 메모

`interior-data.js`는 건물 내부 상세 데이터입니다.

- 건물별 내부도
- 확인된 층 범위
- 내부 구역
- 핵심 공간
- 자료 기준
- 배치 기준

이 분리는 중요합니다. 캠퍼스 전체 배치가 바뀌어도 내부 평면 데이터는 유지할 수 있고, 내부도 보강 작업을 하더라도 지형과 도로 데이터에는 영향을 주지 않습니다.

## TypeScript 설정

`tsconfig.json`은 다음 특징을 가집니다.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.js"]
}
```

`noEmit: true`이므로 TypeScript는 빌드 산출물을 만들지 않습니다. 현재 구조에서는 `.ts` 파일을 검사하고, 실제 실행은 `.js` 파일이 담당합니다.

주의할 점은 `.ts`를 수정했을 때 `.js`가 자동으로 갱신되지 않는다는 점입니다. 현재 프로젝트는 수동으로 `app.ts`와 `app.js`, 각 모델의 `.ts`와 `.js`를 함께 맞추는 방식입니다. 이 방식은 작은 프로젝트에서는 단순하지만, 규모가 커지면 실수 위험이 큽니다.

## 검증 방법

현재 가장 빠른 검증은 Node.js로 JavaScript 파일을 파싱하는 것입니다.

```powershell
node -e "const fs=require('fs'); for (const f of ['src/data/campus-data.js','src/data/interior-data.js','src/ui/hud.js','src/app.js']) new Function(fs.readFileSync(f,'utf8')); console.log('parsed ok')"
```

이 검증은 문법 오류를 빠르게 잡을 수 있습니다. 다만 Babylon.js 전역 객체가 없는 Node 환경에서 실제 렌더링까지 검증하는 것은 아닙니다.

지형 데이터 확인은 다음처럼 할 수 있습니다.

```powershell
node -e "global.window={}; require('./src/data/campus-data.js'); const t=window.CampusData.terrain; console.log(JSON.stringify({unitPerMeter:t.unitPerMeter, retainingWalls:t.retainingWalls.length}, null, 2));"
```

내부도 개수 확인은 다음처럼 할 수 있습니다.

```powershell
node -e "global.window={}; require('./src/data/campus-data.js'); require('./src/data/interior-data.js'); const keys=Object.keys(window.CampusData).filter(k=>k.endsWith('Interior')); console.log(keys.length);"
```

현재 확인된 내부도 수는 16개입니다.

## 현재 구현상 중요한 설계 선택

첫 번째 선택은 전역 스크립트 구조입니다. 번들러가 없기 때문에 설정이 단순하고 `index.html`만 열어도 동작합니다. 대신 파일 로딩 순서가 중요하고, 이름 충돌을 조심해야 합니다.

두 번째 선택은 건물별 모델 파일 분리입니다. 각 건물의 외관 조정이 독립적이므로 특정 건물 수정이 다른 건물에 미치는 영향이 작습니다. 대신 공통 컴포넌트가 부족해 유사한 창문, 지붕, 계단 생성 코드가 반복될 수 있습니다.

세 번째 선택은 HTML 기반 내부도입니다. 실제 도면 수준의 정밀도는 낮지만, 텍스트가 많은 조사 기반 평면을 빠르게 표현하기 좋습니다.

네 번째 선택은 공개자료 기반 모델링 기준입니다. 실제 실내 도면과 다를 수 있는 부분은 단정하지 않고, 자료 기준과 배치 기준을 UI에 함께 노출합니다.

## 성능 관점

현재 장면은 건물 16개, 지형 메쉬, 도로/보행로, HUD로 구성됩니다. 건물 모델이 대부분 기본 primitive box 기반이라 GPU 부담은 크지 않습니다.

성능에 영향을 줄 수 있는 요소는 다음과 같습니다.

- 지형 메쉬 세그먼트 수
- 도로/보행로 메쉬 조각 수
- 건물별 창문/장식 primitive 수
- Babylon GUI 라벨 수
- 내부도 패널 HTML 생성량

최근 도로 정리 작업으로 짧은 선 조각과 계단선 렌더링을 줄였기 때문에 화면의 시각적 복잡도와 메쉬 수가 어느 정도 감소했습니다.

## 유지보수 규칙

이 프로젝트를 계속 확장할 때는 다음 규칙을 지키는 것이 좋습니다.

1. 공개자료로 확인된 사실과 추정 배치를 분리합니다.
2. 새 건물을 추가할 때는 `campus-data.js`, 모델 파일, `interior-data.js`, `app.js` 등록을 함께 확인합니다.
3. `.ts`를 수정했다면 실제 실행 파일인 `.js`도 반드시 동기화합니다.
4. 화면에 보이는 보조선은 최소화합니다.
5. 내부도는 한 화면에 모든 층을 겹치지 말고 층 탭으로 분리합니다.
6. 실제 지형과 다르게 보이는 부분은 지형 데이터, 건물 패드, 옹벽을 함께 조정합니다.
7. 조사 근거는 `search.md`에 남깁니다.

## 새 건물 추가 절차

새 건물을 추가하려면 다음 단계를 따릅니다.

1. `src/models/<building>.ts`와 `src/models/<building>.js`를 만듭니다.
2. `window.<Building>Model.create<Building>Model()` 함수를 정의합니다.
3. `index.html`에 새 모델 스크립트를 `app.js`보다 먼저 추가합니다.
4. `campus-data.js`의 `campusBoundary.anchors`에 건물 기준 좌표를 추가합니다.
5. 필요하면 `terrain.buildingPads`에 건물 주변 평탄화 패드를 추가합니다.
6. `interior-data.js`에 `<building>Interior` 데이터를 추가합니다.
7. `app.js`와 `app.ts`에서 모델 생성, 지형 offset, 라벨, 내부도 등록을 추가합니다.
8. Node 파싱 검증을 실행합니다.
9. 브라우저에서 위치, 크기, 클릭, 내부도 탭을 확인합니다.

## 기존 건물 외관 수정 절차

외관을 수정할 때는 건물별 모델 파일을 먼저 봅니다. 예를 들어 장준하통일관은 `src/models/joonha.js`와 `src/models/joonha.ts`를 수정합니다.

수정 시 확인할 항목은 다음과 같습니다.

- root 위치가 다른 건물과 맞는지
- 주요 메쉬 이름이 `app.js`에서 참조되는 이름과 맞는지
- 반환 객체에 `main`, `hall`, `newDorm`, `mediaHall` 등 기준 메쉬가 포함되는지
- 재질 이름이 `createMaterials()`에 있는지
- 건물 클릭 영역이 너무 작지 않은지
- 지형과 교차하거나 떠 보이지 않는지

## 내부도 수정 절차

내부도를 수정할 때는 `src/data/interior-data.js`를 수정합니다.

가장 중요한 것은 `zones`입니다. zone은 내부 평면의 사각 구역입니다.

```js
{
  id: "example-room",
  label: "공간명",
  kind: "office",
  x: 10,
  y: 20,
  w: 30,
  h: 15
}
```

`kind`는 색상과 범례를 결정합니다. 현재 주요 kind는 다음과 같습니다.

- `cafe`
- `childcare`
- `corridor`
- `dining`
- `dorm`
- `entry`
- `gallery`
- `gym`
- `hall`
- `lab`
- `lecture`
- `library`
- `lobby`
- `lounge`
- `marker`
- `office`
- `outside`
- `restroom`
- `service`
- `studio`
- `support`

층 분류가 잘못되면 zone에 `floor: "3F"`처럼 명시 값을 넣는 방식이 좋습니다.

## 지형 수정 절차

지형 수정은 `campus-data.js`의 `terrain` 객체에서 합니다.

수정 우선순위는 다음과 같습니다.

1. 실제 표고 샘플이 있으면 `elevations`를 수정합니다.
2. 특정 방향의 능선이 부족하면 `ridgeModifiers`를 수정합니다.
3. 저지대가 부족하면 `valleyModifiers`를 수정합니다.
4. 건물이 경사에 묻히면 `buildingPads`를 수정합니다.
5. 단차가 필요한 구간은 `retainingWalls`를 수정합니다.
6. 전체 지형이 너무 평평하거나 과하면 `unitPerMeter`를 조정합니다.

화면이 지저분해지는 문제 때문에 현재 등고선, 캠퍼스 경계선, 초록색 사면 패치, 입구 방향 보조선은 렌더링하지 않습니다. 데이터는 일부 남아 있지만 화면 표현은 표고 메쉬와 옹벽 중심입니다.

## 알려진 기술 부채

현재 가장 큰 기술 부채는 `.ts`와 `.js`의 수동 동기화입니다. 장기적으로는 TypeScript 빌드 과정을 도입해 `.ts`만 수정하고 `.js`는 자동 생성하는 구조가 더 안전합니다.

두 번째 기술 부채는 전역 객체 기반 구조입니다. 규모가 커지면 모듈 시스템을 쓰는 편이 안전합니다. 다만 현재처럼 `index.html` 하나로 바로 실행하는 구조에서는 전역 스크립트 방식이 단순하다는 장점도 있습니다.

세 번째 기술 부채는 실제 지형/건축 도면 데이터 부재입니다. 현재 모델은 공개자료 기반 추정 모델이므로, 정확도를 더 높이려면 수치지형도, 건축물대장 상세 도면, 캠퍼스 실제 도면, 현장 사진을 더 확보해야 합니다.
