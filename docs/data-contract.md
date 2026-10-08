# 캠퍼스 공간 데이터 계약

`src/types/platform-types.ts`가 브라우저·관리 화면·서버가 함께 사용하는 타입 계약이다. `src/domain/campus-platform.js`는 프레임워크와 저장소에 의존하지 않으며 브라우저의 `window.CampusPlatform`과 Node VM의 `globalThis.CampusPlatform`에 같은 API를 제공한다. 이 문서는 공간 도메인의 계약을 설명한다. 인증, 관리자 승인, 데이터베이스 트랜잭션 및 외부 공급자 호출은 서버 계층의 책임이다.

## 현재 자료와 정확성

기본 데이터는 `SitePlanData`와 기존 `CampusData`를 변환한다. 경기캠퍼스 1곳, 기존 모델 16개를 등록한다. 서울캠퍼스의 모델·부지·실내도는 확보하지 않았으므로 임의로 등록하지 않는다. 주소는 경기도 오산시 한신대길 137이다. 원자료, 수집 상태와 정합 오차는 `evidence/README.md`와 `src/data/site-plan.js`를 따른다.

- 공식 캠퍼스 투어의 건물명과 지도 표식을 사용한다. 표식은 측량된 건물 중심점·출입구 좌표가 아니다.
- 건물 윤곽과 회전은 원래 모델 및 공식 안내 그림을 이용한 추정이다. 높이는 실측 확인 자료가 없어 `unverified`다.
- 전체 부지의 안내 영역은 추정 폴리곤이며 법적 소유 경계가 아니다. `legal`, `planning`, `cadastral`은 확인한 공간 도형이 없어 `null`이다. 공적 고시를 출처로 보관했다는 사실만으로 경계 좌표를 확정하지 않는다.
- 기존 내부도는 `concept` / `estimated`다. 기존에 작성된 공용 구역명·층 설명·백분율 배치를 보존하지만 실제 호실 좌표나 통행 연결로 바꾸지 않는다.
- 기숙사 개별 거주실은 기본 공개 내부도와 공간 목록에서 제외한다. 공용 시설 설명은 남긴다.
- 검증된 통행 그래프, 운영시간, 현재 개방·혼잡 상태, 학교 시스템 연동 자료는 확보하지 않았다. 따라서 `routes.nodes`, `routes.edges`, `operations`, `events`, `services`는 기본 데이터에서 빈 배열이다.
- 가상 투어는 실제 건물의 자료를 차례로 보는 화면 이동이다. 현장 도보 동선이나 소요시간이 아니다.

## 영구 ID와 계층

`src/data/campus-registry.json`에 경기캠퍼스의 영구 ID 정책과 기존 모델 대응 키를 기록한다. 표기명 변경, 모델 파일 교체, 관리자 편집 때문에 ID를 바꾸지 않는다. 현재 건물 ID 형식은 `hanshin-gg:building:janggong`, 이전 모델 대응 키는 `legacyId: "janggong"` / `legacyKey: "janggong"`다. ID는 영문 소문자·숫자·콜론·밑줄·하이픈을 사용하며 최대 160자다.

`entities`는 다음 종류를 구분한다.

| kind | 의미와 참조 |
| --- | --- |
| `campus` | 캠퍼스 자체. `id === campusId`, 부모 없음 |
| `facility-group` | 복합 시설의 논리적 묶음. 물리적 건물 수를 임의로 늘리지 않음 |
| `building` | 건물. 기존 모델 키와 영구 ID를 별도로 유지 |
| `floor` | 건물 아래 층. `parentId`는 건물 ID, `floorLabel`과 `sortOrder` 사용 |
| `space` | 기존 구역 또는 확보한 공간. `floorId`는 확인할 수 있을 때만 지정 |
| `external-facility` | 운동장·주차장·녹지 등 외부 시설 |
| `door` | 자료에 존재하는 출입구. 실내 개념 문과 지리 좌표가 있는 외부 진입구를 구분 |
| `connection` | 도로·보행선·연결 후보. 표시선 자체가 검증 경로라는 의미는 아님 |

모든 엔터티는 `campusId`, `parentId`, `owningBuildingId`, `floorId`, `visibility`, `status`, `confidence`, `sensitive`를 가진다. 부모·소유 건물·층은 같은 캠퍼스를 참조해야 하며 부모 순환은 거부한다. `position`, `geometry`, `floorId`, `roomCode`, 운영 관련 사실은 확보하지 못했으면 `null` 또는 미확인으로 남긴다. `resolve`는 영구 ID를 우선 찾고 활성 캠퍼스의 기존 `legacyId`를 호환 조회한다. 이 함수 자체는 인증·인가를 수행하지 않는다. 공개 화면은 공개 투영 결과를 사용해야 한다.

`status`는 `current`, `historic`, `proposed`로 구분한다. 검색은 현재 공개 엔터티만 반환한다. 이름·역할·별칭·층 표기·확보한 호실 표기가 검색 대상이다. 영어 등 번역은 `translations[language] = {name, verified, sourceId}`로 별도 보관하며 검토된 출처가 있는 번역만 공개·검색한다.

## 카탈로그와 버전

최상위 계약은 다음과 같다. 배열에 실제 확보한 자료만 넣는다.

```text
schemaVersion: 1
contentVersion: 자료 개정 버전
assetsVersion: 모델·미디어 개정 버전
datasetVersion: contentVersion과 동일한 호환 별칭
activeCampusId: 등록된 캠퍼스 ID
metadata: 내부 메타데이터
campuses[], entities[], sources[]
routes: {nodes: 영구 엔터티 ID[], edges: RouteEdge[]}
operations[], tours[], events[], services[], layers[]
```

자료를 바꾸면 `contentVersion`을 변경해야 한다. 동일 입력의 재가져오기는 허용한다. 모델 자산만 바뀌면 `assetsVersion` 변경을 함께 기록한다. `diffCatalog`는 엔터티 추가·삭제·변경 필드와 경계·출처·경로·운영·투어·활동·레이어·자산 버전 변경을 반환한다. 이를 관리자 검토 자료로 사용할 수 있다. 차이 계산만으로 승인 여부를 판단하지 않는다.

## 좌표, 지형과 경계

캠퍼스마다 독립적인 `origin: {lat, lon}`, 미터 단위, `terrain`, `boundaries`를 갖는다. 서로 다른 캠퍼스의 미터 좌표를 한 원점으로 합치지 않는다. 지형은 증가하는 격자 축 `xs`, `zs`, 대응하는 `elevations`, `baseElevationMeters`를 검증한다. 격자마다 `coordinateSystem`, `horizontalUnit`, `verticalUnit: "m"`, `originId`를 명시한다. 수직 기준 및 현장 정합을 확인하지 못했으면 미확인 상태를 표시한다.

새 미터 지형은 `coordinateSystem: "local-meters"`, `horizontalUnit: "m"`, `xs` 동향·`zs` 북향을 사용한다. 기존 지형은 `legacy-model-units` / `world-unit`로 보존하며 렌더 계획에 서로 역변환인 `legacyToMeters` / `metersToLegacy`가 있어야 한다. 단위가 없는 격자를 임의로 미터 지형으로 인정하지 않는다. 미터 격자를 렌더러의 기존 샘플러에 전달할 때는 동일 미터 축을 사용하는 항등 변환을 생성한다.

공간 도형은 `Point`, `LineString`, `Polygon`, `MultiPolygon`을 지원한다. `coordinateSystem: "local-meters"`는 `[east, north]`, 단위 `m`이다. `coordinateSystem: "WGS84"`는 `[longitude, latitude]`, 단위 `degree`다. `originId`는 해당 캠퍼스 ID다. 엔터티의 `position`은 항상 해당 원점의 미터 좌표 `{east, north, up}`이며 미확인 고도는 `up: null`이다.

Polygon은 `[exterior, ...holes]`, MultiPolygon은 Polygon 배열을 사용한다. 각 ring은 마지막 좌표가 첫 좌표와 같아야 한다. 영면적·자기 교차·반복 꼭짓점·바깥과 접촉하는 구멍·구멍 겹침·분리 폴리곤끼리의 중첩은 거부한다. 다른 폴리곤의 구멍 안에 완전히 들어간 독립 영역은 허용한다. 복잡한 접점 도형은 GIS 단계에서 단순하고 서로 겹치지 않는 도형으로 정리한 뒤 입력한다.

경계에는 `boundaryType`을 명시한다. 안내 영역은 `isLegalBoundary: false`다. `legal`, `planning`, `cadastral`을 입력하려면 확인한 출처와 `verified` 분류가 필요하다. 부지 면적은 안내 도형의 면적과 법적 면적을 구분해 표시한다.

가져오기 후 `campus.visualizationPlan`을 계약에서 재생성한다. WGS84 도형은 원점 근처의 타원체 선형 투영으로 미터 좌표를 만든다. 원점에서 위경도 차이가 각각 0.1도를 넘는 자료는 거부한다. 이 변환은 측량 성과 또는 국가 투영좌표계 변환의 대체물이 아니다. 원래 좌표계가 다른 자료는 변환 근거를 갖춘 수집 단계에서 WGS84 또는 계약의 미터 좌표로 정규화해야 한다.

렌더러 호환 필드는 `boundaries.campusMapped.polygonsMeters: [{outer, holes}]` 및 `features[layer][].polygonsMeters`다. `pointsMeters`는 첫 바깥 ring을 위한 호환 필드다. 분리 영역·구멍을 모두 보존하려면 `polygonsMeters`를 사용한다. `projection`은 실제 원점을 보존한다. 기존 지형 격자 정합에 필요한 `legacyToMeters` / `metersToLegacy`의 유한한 3계수 `x`, `y`만 기존 계획에서 가져오며, 임의 원자료 속성은 렌더 계획에 복사하지 않는다. 모델의 회전은 `modelPose.rotationRadians`이며 실측 확인되지 않은 회전은 `estimated`다.

## 출처와 사실별 확인 상태

출처는 `id`, `title`, 자격 증명 없는 HTTPS `url` 또는 로컬 자료용 빈 URL, `scope`, `usage`, `visibility`, `confidence`, `dates`를 가진다. 출처를 공개할 수 있다고 원본 이미지·PDF 재배포 권리가 자동으로 생기지는 않는다. 원문과 출처 설명에 기록한 사용 조건을 유지한다.

엔터티의 `claims`는 `name`, `location`, `outline`, `height`, `operation`을 각각 구분한다. 각 claim은 `sourceIds`, `confidence`, `method`, `dates`, `notes`를 가진다. 건물명이 공식 자료에 있다는 사실로 윤곽·높이·운영시간까지 검증됐다고 승격하지 않는다. `verified` claim에는 출처가 필요하다.

날짜 필드는 `referenceDate`, `issuedAt`, `observedAt`, `collectedAt`, `reviewedAt`, `validFrom`, `validUntil`이다. 기존 자료의 단일 기준일은 `referenceDate`에만 옮긴다. 공표·관측·수집·검토일을 실제로 확보하지 못했으면 각각 `null`이다. 날짜는 유효한 ISO 날짜 또는 시간으로 검증하며 운영·경로 조회 시각은 시간대를 포함한 ISO timestamp다. 서버 저장·조회는 UTC ISO 표기를 사용한다. 날짜를 채웠다는 이유만으로 최신 자료라고 표시하지 않는다.

## 가져오기와 공개 투영

`validateCatalog` / `validateImport`는 스키마 버전, 최대 2 MiB의 UTF-8 JSON 크기, 최대 10,000개 엔터티, ID 중복, 참조, 종류, 좌표계·단위, 출처, 날짜, 도형과 공개 범위를 검사한다. ring은 최대 1,000좌표, 도형은 최대 10,000좌표, Polygon은 최대 63개 구멍, MultiPolygon은 최대 64개 영역을 받는다. 프로토타입 관련 키, URL의 자격 증명·인증 쿼리, 잘못된 날짜, 원점 불일치 등을 거부한다.

GIS/BIM 입력은 이 계약으로 정규화한 카탈로그 JSON을 가져온다. 이 모듈은 원시 IFC·GIS ZIP·임의 좌표계 파일을 직접 해석하거나 파일 안의 외부 URL을 실행하지 않는다. 별도 변환기가 원본 ID, 모델 매핑, 좌표계·단위, 출처와 확인 상태를 명시해야 한다. GLB 파일의 바이트·자산 매핑 검증은 모델 로더의 별도 계약을 따른다. HTTP 공급자 URL·호출 권한·요청 제한은 서버의 공급자 설정 계층에서 검증한다.

`publicCatalog`는 새 객체를 만든다. `visibility !== "public"` 또는 `sensitive` 엔터티, 비공개 부모·건물·층에 종속된 엔터티, 비공개 출처 및 이를 참조하는 경로·운영·활동·투어 정류장을 제외한다. 공개 근거를 잃은 claim은 `unverified`로 낮추며 원문의 비공개 메모를 제거한다. 좌표·도형·날짜·번역·접근성·지형·회전 같은 중첩 객체도 알려진 필드만 복사한다. 내부 `feature`, 임의 관리자 필드, 원시 렌더 계획과 자료 첨부 객체를 그대로 내보내지 않는다.

안내 영역의 근거 또는 캠퍼스 엔터티 자체가 비공개이면 해당 캠퍼스 전체를 공개 투영에서 제외한다. 공개 가능한 캠퍼스가 하나도 없으면 빈 캠퍼스 배열과 빈 활성 ID가 나온다. 서버는 이를 공개 준비가 안 된 상태로 처리해야 하며, 정상 활성 카탈로그 검증을 통과했다고 표현하지 않는다. 공개 투영은 서버 인가를 대체하지 않는다.

## 경로와 운영 상태

`routes.nodes`는 영구 엔터티 ID 배열이다. 선을 그릴 수 있다는 사실만으로 연결을 만들지 않는다. Edge는 `from`, `to`, `campusId`, `lengthMeters`, `bidirectional`, `kind`, `verification`, `sourceIds`, `reviewedAt`, `validFrom`, `validUntil`, `accessibility`를 가진다. `kind`는 `walk`, `stairs`, `ramp`, `lift`, `door`다.

경로 탐색은 공개 현재 엔터티·확인된 위치·실제 그래프에 등록된 연결만 사용한다. 출처, 검토일, 만료일이 있는 `verified` edge만 사용하며 조회 시각에 유효해야 한다. 단방향 연결을 존중하고 검증된 거리 합이 최소인 경로를 반환한다. 동일 캠퍼스에 연결이 없거나 자료가 만료되면 `status: "unavailable"`, `verified: false`, 빈 `nodes` / `edges` / `steps`, `distanceMeters: null`과 이유를 반환한다. 추정 내부도에서 호실 경로를 만들지 않는다.

무장애 옵션은 계단을 제외하는 데서 끝나지 않는다. `accessibility`는 검토된 휠체어 이용 프로필, 폭·경사·문턱·노면·단차 없음·운영상태·유효기간을 모두 요구한다. 값이 있다는 사실만으로 임의 법적 기준에 적합하다고 판단하지 않는다. 현장 담당자가 실제 이용 프로필 적합성을 확인한 뒤 `verification: "verified"`, `assessedProfile: "wheelchair"`를 부여해야 한다. 이 검토 권한과 승인 이력은 관리자 서버가 관리한다.

운영 자료는 공개 검증 기록만 사용한다. `observedAt`, `validFrom`, `validUntil`을 요구하고 미래 관측은 현재 상태로 사용하지 않는다. 유효한 폐쇄 기록은 개방 기록보다 우선한다. 반환 상태는 `open`, `closed`, `expired`, `unknown`이다. 경로의 노드 또는 상위 시설이 폐쇄되거나 운영 근거가 만료되면 경로를 차단한다. 만료된 폐쇄를 자동 개방으로 해석하지 않는다. 원자료가 없을 때는 `unknown`이며 “정상 운영”을 기본값으로 만들지 않는다.

## 공개 함수

| 함수 | 입력 / 출력 |
| --- | --- |
| `createCatalog(plan, legacyCampusData)` | 기존 자료를 Catalog로 변환하고 검증. 잘못된 기본 자료면 오류 |
| `validateCatalog(input)` | `{valid, errors}` |
| `search(catalog, query, {kind?, category?, campusId?, language?})` | 공개 투영된 현재 엔터티 배열 |
| `resolve(catalog, id)` | 엔터티 또는 `null`; 서버 인가와 별개인 내부 조회 |
| `route(catalog, {from?, to?, fromId?, toId?, accessible?, at?})` | `RouteResult`; 두 ID 표기는 호환 별칭 |
| `operationStatus(recordsOrCatalog, entityId, at?)` | `{status, label, records, expiresAt}`. 배열 입력은 이미 공개용으로 선택한 기록을 전달 |
| `diffCatalog(before, after)` | 추가·삭제·변경 ID와 필드, 변경된 카탈로그 영역 |
| `publicCatalog(catalog)` | 비공개와 원시 필드를 제외한 독립 Catalog |
| `validateImport(input, current?)` | JSON 문자열 또는 객체 → `{valid, errors, catalog, diff}` |
| `serializeState(state)` | 검증된 상태를 URL query로 직렬화. 잘못된 상태면 오류 |
| `parseState(input, catalog?)` | 객체·query·전체 URL → `{valid, errors, state}` |
| `createLocalStore(storage?, key?)` | 로컬 저장 어댑터. 저장소 없거나 실패해도 결과에 명시 |

경로 `nodes`는 위치가 있는 엔터티 배열이다. 각 step은 `fromId`, `toId`, 이름을 이용한 `text`, `distanceMeters`, `kind`를 가진다. 확보하지 않은 회전 방향·예상 이동시간·실시간 센서 상태는 생성하지 않는다.

## 공유 주소와 개인 로컬 자료

공유 상태는 `{version: 1, campusId, entityId, view, layers, floorId, time}`이다. `view`는 `overview`, `top`, `free`, `2d`, `text`다. layer ID는 카탈로그 등록값을 사용하며 기본 목록에는 `trees`도 포함한다. 영구 ID를 사용하고 공개 범위·캠퍼스 일치·층 소유 건물·ISO 시각을 검증한다. 비공개 부모 아래의 공개 표시 공간도 복원하지 않는다. query 최대 길이는 4,096자이며 중복 필드와 잘못된 URI 인코딩을 거부한다. 토큰, 개인 시간표, 즐겨찾기, 임의 스크립트는 공유 상태에 포함하지 않는다.

`createLocalStore(storage, key = "hanshin-campus-platform:v1")`는 `getItem`, `setItem`, `removeItem` 어댑터를 받는다. 개인 자료는 `{schemaVersion: 1, favorites, recent, timetable}`이다. 즐겨찾기는 중복 없이 최대 500개, 최근 기록은 최대 30개, 시간표는 최대 200개를 저장한다. 시간표 항목은 `{id, entityId, title, day: 0..6, start: "HH:mm", end: "HH:mm"}`이며 종료는 시작보다 늦어야 한다.

`load`, 전체 `save`, 즐겨찾기 추가·삭제, 최근 기록 추가, 시간표 저장·삭제, `reset`은 모두 `{ok, value, error}`를 반환한다. 전체 `save`는 검증 후 단일 쓰기를 수행한다. 저장 실패를 성공으로 바꾸지 않고 마지막 유효 상태를 반환한다. 버전 0의 알려진 기존 건물 ID는 영구 ID로 이전한다. 손상된 저장 자료를 임의 덮어쓰지 않으며 사용자가 개인 자료 초기화를 선택할 수 있다. 초기화는 이 저장 키만 제거하고 다른 앱 자료는 건드리지 않는다. 서버 계정 동기화·학교 시간표 연동은 확보된 기능으로 주장하지 않는다.

## 검증과 데이터 갱신 절차

자료 갱신은 원본·권한·기준일·좌표계 확인 → 계약 정규화 → `validateImport` → 변경 비교 → 담당자 검토 → 서버 승인·공개 투영 → 버전 확인 순서로 진행한다. 실패한 수집을 성공으로 기록하지 않고 이전 자료의 기준일과 미확인 표시를 유지한다. 폐쇄·접근성·운영 정보는 재검토 기한을 포함해야 한다.

`node --test tests/campus-platform.test.mjs`는 실제 16개 모델 ID·개념 내부도 보존, 자료 미확보 상태, 공간 참조, 잘못된 도형, MultiPolygon 구멍·분리 영역, 독립 원점의 WGS84 변환, 공개 정보 누출, 경로 검토·방향·만료·접근성·폐쇄, 버전 변경, 공유 상태와 로컬 저장 실패를 검증한다. 경로 및 두 번째 캠퍼스 테스트 데이터는 테스트 파일 안의 격리된 fixture이며 운영 자료로 배포하지 않는다. 실제 휠체어 통행·학교 API·센서·현장 측량·관리자 외부 사용 시험을 했다는 증거로 해석하지 않는다.
