# 검증 기록

최신 코드 검증일은 2026-10-08이다. 자료·모델 제작 기준일은 2026-10-07로 유지한다. 자료 정확도와 미확보 측량 근거는 [accuracy.md](accuracy.md), 기존 기획은 [25개 항목](requirements-status.md)과 [32개 항목](expansion-status.md), 후속 구현은 [3D 고도화 42개 항목](refinement-status.md)을 따른다.

## 3D 고도화 검증 — 2026-10-08

| 검사 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 성공 |
| `npm.cmd run typecheck` | 성공, strict 유지 |
| `npm.cmd run test` | 262개 성공, 실패·취소·생략·todo 0 |
| `npm.cmd run build` | 성공, 최종 소스·문서 반영 산출물 생성 |
| `npm.cmd run check:generated` | 성공, TypeScript와 브라우저 JavaScript 동기화 |
| `npm.cmd run test:browser` 및 관련 최종 재검사 | 26개 사례의 최종 확인 상태: 22개 성공·4개 중복 생략. 아래 실행 이력 참조 |
| `git diff --check` | 성공, 공백 오류 없음 |

단위 검사는 별도 설치한 IfcOpenShell Python을 `CAMPUS_IFC_PYTHON`으로 지정해 실행했다. IFC 관련 3개는 선택 입력 검증, 선택 도구 누락 오류, 실제 원시 IFC 삼각분할 검사다. 실제 변환에서는 공개 요소 하나만 선택해 8개 정점·12개 삼각형을 생성하고 이름/속성/원본 GUID와 비선택 형상을 제외했다. 동일 입력의 재현성과 비영점 원점/앵커의 실제 Babylon 좌·우수 좌표계 배치도 확인했다. 학교 IFC를 검사한 결과는 아니다.

16개 조감도 GLB는 실제 Babylon 임포터의 좌·우수 좌표계 32개 조합에서 원본 월드 정점·법선·삼각형 방향·전체 범위를 비교했다. 원본 790개 메쉬를 재질별 144개로 병합하고 9,586개 삼각형을 보존했으며 총 699,688바이트다. [자산 감사 기록](../evidence/refinement-asset-audit.json)에 제작 입력·배치·통계·SHA를 보관한다. LOD 우선순위/예산/취소/재시도, HUD 100회 교체 수명, 복수 영역/구멍 면적, 층·측정·조명·XR 상태 복원, 관리자 초안 검수, 공개/비공개 투영과 불변 묶음, 공급자 오류/제한, ServiceWorker의 원자적 저장·온라인 캐시 누락 복귀를 회귀 검사했다. 자산 바이트 예산과 CPU 렌더 진단을 실제 RAM/GPU 메모리 또는 GPU 시간으로 보고하지 않는다.

### 브라우저 실행 이력과 화면

Chromium은 desktop1440×1000/mobile390×844 viewport와 SwiftShader 소프트웨어 WebGL을 사용했다. 실제 스마트폰·헤드셋 검사가 아니다. 8767번 서버의 격리 임시 DB/fixture 계정을 사용했고 정상8765번 DB에 테스트 계정을 만들지 않았다.

전체 6개 spec/26개 사례를 실행해 20개 성공·모바일 전체 부지와 외곽 2개 실패·4개 중복 생략을 확인했다. 좁은 화면에서 접힌 패널을 옆 패널로 잘못 분류한 안전 영역과 시점 보존 시 맞춤 거리 문제를 수정한 뒤 모바일 관련 4개를 재검사했다. 전체 부지·외곽·고도화 UI 3개는 성공했고 승인판 오프라인 1개는 온라인 캐시 누락 때503을 반환하는 문제를 드러냈다. ServiceWorker의 온라인 불변 파일 가져오기 복귀를 수정한 최종 소스에서 승인판 오프라인 desktop/mobile 2개와 desktop 전체 부지/외곽 2개가 모두 성공했다. 따라서 사례별 최종 확인 상태는 22개 성공·4개 중복 생략이며, 단일 전체 실행이 마지막 소스에서 모두 성공했다는 뜻은 아니다.

관리자 비교 검사는 단순 삼각형 fixture 대신 실제 감사한 장공관 조감도 GLB로 강화했다. desktop/mobile 2개에서 두 실제 장면의 같은 카메라, 10개 메쉬·788개 삼각형, 양쪽 캔버스의 유색 픽셀, 외부 요청/CSP 오류 없음과 로그아웃 후 자원 해제를 확인했다. 승인판 오프라인 검사는 최종 dist를 봉인한 새 fixture 공개판을 저장해 Catalog/모델/공개판 버전과 SHA, 선택 범위만 요청하는 실제 네트워크 차단/reload, 2D 안내, API/관리자 비캐시를 확인했다. 온라인503을 허용하는 검사 예외는 제거했다.

4개 생략은 같은 파일의 file 실행, CacheStorage 통합, 운영 기록 변경, editor/reviewer 공개 흐름을 desktop에서 한 번 검증하는 중복 제외다. 모바일 전체 부지·고도화 UI·실제 GLB 비교·승인 오프라인 검사는 생략하지 않았다. 실행 로그는 `var/refinement-browser-final.log`, `var/refinement-browser-mobile-recheck.log`, `var/refinement-browser-approved-offline-recheck.log`, `var/refinement-browser-desktop-fit-recheck.log`, `var/refinement-browser-admin-real-glb.log`에 보관한다.

최종 전체 부지·평면·내부·PNG, 모바일 조감도/접힌 패널, 고도화 UI와 관리자 두 GLB 화면을 직접 확인했다. [desktop 고도화 조감도](../evidence/screenshots/desktop-refinement-view.png), [mobile 고도화 조감도](../evidence/screenshots/mobile-refinement-view.png), [desktop 실제 GLB 비교](../evidence/screenshots/desktop-refinement-admin-glb.png), [mobile 실제 GLB 비교](../evidence/screenshots/mobile-refinement-admin-glb.png)는 QA 증거이며 공개 dist에서 제외한다.

### 실제 로컬 DB·서버와 공개판 보존

기존 DB는 `var/backups/before-3d-refinement-2026-10-07T14-52-05-093Z.sqlite`로 온라인 백업한 뒤 additive `0003-asset-bundles.sql`로 schema2→3을 적용했다. 기존 settings/users/sessions/drafts/releases/identities/reports/operations/audit/provider_runs 10개 테이블의 행이 백업과 동일함을 [보존 기록](../evidence/refinement-database-preservation.json)에서 확인했다. DB를 초기화하거나 기존 공개판을 새 fixture로 교체하지 않았다.

실제 `http://127.0.0.1:8765/`의 최종 dist 서버에서 schema3 health, 등록 모델16개, 기존 공개판의 불변 파일64개 전체의 HTTP 크기/SHA와 Catalog SHA, 최신 viewer5개 파일과 dist의 동일성, 비공개5개 경로404를 확인했다. [HTTP 검증](../evidence/refinement-local-release.json)과 [실제 로컬 브라우저 관측](../evidence/refinement-live-browser.json)에 기록했다. 실제 로컬 DB의 현재 Catalog를 사용한 desktop/mobile 두 캡처 모두 ready·16개 모델 로드·전체 안내 외곽 화면 맞춤·수목88개·브라우저 오류0을 확인하고 [desktop 화면](../evidence/screenshots/refinement-live-desktop.png)과 [mobile 화면](../evidence/screenshots/refinement-live-mobile.png)을 직접 검수했다. 짧은 SwiftShader 관측은 실기기 FPS·GPU·장시간 성능의 증거가 아니다. 공개 인터넷 배포도 아니다.

기존 실제 공개판은 contentVersion `hanshin-gg-2026-10-07-1`, assetsVersion `2026-10-07-refinement-lod-1`과 봉인된 파일을 유지한다. 현재 viewer와 이 묶음의 런타임은 다르며 HTTP 증거의 `currentViewerMatchesSealedRuntime:false`와 `sealedRuntimeDiffers`가 이를 명시한다. 새 빌드로 기존 묶음을 덮어쓰지 않았다. 실제 최신 앱을 승인판 오프라인 묶음으로 제공하려면 정상 자료/자산 버전의 초안을 담당자가 검토·승인·공개해야 한다. 위 승인 오프라인 통과 증거는 최신 dist의 격리 fixture 공개판이며, 정상 DB의 기존 묶음이 최신 런타임으로 교체됐다는 뜻은 아니다. 도입 전 미보관 과거 파일을 복원했다고도 주장하지 않는다.

### 외부 자료·실기기 인수에서 남은 사항

실제 학교 법적/지적/측량 경계·정밀 DEM·실내 평면·통행/접근성·정밀 GLB/IFC·학교 API·운영 자료·두 번째 캠퍼스 자료는 미확보/미연결이다. 실제 허가 미디어·검수된 AR 현장 앵커와 AI 공급자도 미등록/미설정이다. IFC 선택 변환, 근거 AI 어댑터, WebXR VR/AR 및 기준점 정합의 구현과 자동 fixture 검사를 현장 서비스 인수로 해석하지 않는다.

압축 확장 검증은 있으나 실제 Draco/Meshopt 디코더와 완전한 KTX2 번들을 제공하지 않으며 WebGPU 후보 비교도 미실시다. 검증 전 기본 WebGL을 유지한다. 실제 터치/QR 카메라·스크린리더/보조기술 사용자·VR/AR 헤드셋·30분 성능/발열·장면100회 반복·학교 사용자 과업·Docker 실행·GitHub CI·HTTPS/공개 배포·운영 복구 훈련은 미검증이다. [인수 프로토콜](refinement-acceptance.md)의 실제 날짜/자료판/기기/담당자/결과가 채워져야 외부 인수 완료로 기록한다.

## 이전 단계의 검증 기록

아래는 2026-10-07 확장 플랫폼과 그 이전 부지 정교화 단계의 역사 기록이다. 당시 검사 수/DB schema/기능 한계를 보존하며 현재 구현 상태는 위 2026-10-08 고도화 기록을 따른다. 특히 당시의 승인 Catalog 오프라인 미지원과 IFC/AR 미구현 설명은 후속 구현 이전 상태다.

### 확장 플랫폼 검사

확장판의 최종 제품 소스에서 다음 검사를 완료했다. 아래 59개 및 7개 브라우저 결과는 확장 전 부지 정교화 단계의 기록이다.

| 검사 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 성공 |
| `npm.cmd run typecheck` | 성공, strict 유지 |
| `npm.cmd run test` | 159개 성공, 실패/생략 0 |
| `npm.cmd run build` | 성공, 16개 TS 입력·앱·서버·공개 자산·오프라인 SHA manifest |
| `npm.cmd run check:generated` | 성공 |
| Chromium desktop/mobile | 전체 20개 사례 중 16개 성공·4개 중복 생략 |
| `git diff --check` | 성공, 공백 오류 없음 |

브라우저는 `npx.cmd playwright test tests/browser/platform.spec.mjs`(6 성공·관리자 모바일 중복 2 생략)와 `npx.cmd playwright test tests/browser/campus.spec.mjs tests/browser/model-load.spec.mjs tests/browser/offline.spec.mjs`로 전체 파일을 실행했다. 초기 기존 UI 선택자 중복과 GLB fixture의 잘못된 AbortSignal을 수정한 후 `--grep "complete campus overview|actual Babylon"`으로 해당 desktop/mobile 4개를 재실행해 모두 성공했다. 변경은 검사 코드에만 있었으며 나머지 성공 경로의 제품 소스는 동일하다.

159개 검사는 영구 ID·참조·공개 투영·복수 부지/구멍·독립 좌표, 검증 경로/만료, 실제 16개 legacy 모델, GLB 바이트/단위/형상/취소/정리, HUD 교체/캠퍼스 전환 리스너 수명, DOM/로컬 저장, 세션·CSRF·역할·다중 캠퍼스 private 범위, SQL 페이징, 초안/타인 승인/불변 공개판/복구, 비공개 사진/접수/영수증, 미래 운영 취소/날짜, 공급자 실패/마지막 성공, 백업/재열기, 정적 allowlist/junction, atomic cache와 실제 QR 픽셀 디코딩을 포함한다.

실제 Chromium에서는 2F 선택/복원·2D/문자·즐겨찾기/시간표·투어·mock GPS 정확도 원·QR 디코딩 및 새 컨텍스트 공유 복원, 사진 동의/접수/조회, editor→다른 reviewer 승인/공개, 운영 같은 ID의 등록/기간 연장/취소를 확인했다. WebGL 실패 대체와 PNG 출력도 확인했다. GLB는 실제 Babylon plugin에 작은 자급형 triangle fixture를 전달해 현재 CSP(connect-src self)·형상/좌표·cleanup·외부/Blob 요청 없음까지 검사했다. fixture 검사는 학교 정밀 모델이나 현장 GPS 검증이 아니다.

실제 ServiceWorker/CacheStorage에서는 공개 manifest의 모든 바이트/SHA, API/admin 제외, 네트워크 차단 뒤 reload·16개 상세·2D/문자·내부 안내, 캐시 삭제와 다른 앱 캐시 보존을 확인했다. 오프라인에는 빌드된 기본 공개 자료를 사용하며 온라인에서 새로 게시한 API Catalog와 최신 운영 자료는 저장하지 않는다. 서비스워커의 중간/정리 실패·동시 저장·SHA 불일치 분기는 VM 회귀로 별도 검사했다.

최종 `node scripts/serve.mjs --dist --platform` 서버를 `http://127.0.0.1:8765/`에서 실행했다. 진입 HEAD200·API health/schema2, 공개 자산 44개 총11,138,390바이트의 HTTP200/크기/SHA 일치, private 경로4개404, 익명 admin/status401과 limit1 페이징을 확인했다. 실제 운영 DB를 테스트 fixture로 초기화하지 않았다. 공개 인터넷 배포의 증거는 아니다.

최신 화면은 `evidence/screenshots/`의 desktop/mobile-overview/top/interior/export, `*-platform-{2d,personal,share-qr,report-receipt}.png`, `desktop-admin-{approved-draft,operation-cancelled}.png`다. QA 이미지는 공개 dist에서 제외한다.

최신 짧은 SwiftShader 관측은 desktop 6프레임/551.5ms, mobile 15프레임/504ms, mesh 1,042개다. 약 10.88/29.76fps이며 [desktop 관측](../evidence/screenshots/desktop-render-observation.json), [mobile 관측](../evidence/screenshots/mobile-render-observation.json)에 기록했다. 실제 기기 GPU·메모리·발열·장시간 성능이나 사용자 성과를 보장하지 않는다.

실제 학교 API·법적/측량 경계·실내 평면·현장 통행/접근성·학교 GLB·다른 학교 자료는 미확보/미연결이다. 원시 IFC 자동 변환과 AR 현장 정합은 미구현이다. 실제 QR 카메라·XR/스마트폰·보조기술 사용자·대화형 CLI 비밀번호 입력/브라우저 자동 열기·Docker 실행·GitHub CI·공개 배포·운영 복구 훈련은 이번 자동 검사로 검증하지 않았다.

### 부지 정교화 단계 기록

#### 자동 검사

| 명령 | 상태 | 검증 범위 |
|---|---|---|
| `npm.cmd run lint` | 성공 | 원본 TS·새 JS·스크립트·테스트 규칙 |
| `npm.cmd run typecheck` | 성공 | strict TypeScript와 @ts-check 원본 |
| `npm.cmd run test` | 59개 성공 | 자료·좌표·장면·모델·DOM·정적 전달 |
| `npm.cmd run build` | 성공 | 16개 모델 JS·앱 동기화, 로컬 runtime, 공개 자산 목록 |
| `npm.cmd run check:generated` | 성공 | TS/브라우저 JS 바이트 동기화 |
| `npm.cmd run test:browser` | 7개 성공·1개 중복 제외 | 실제 Chromium WebGL 데스크톱·모바일 viewport |
| `git diff --check` | 성공 | 변경 공백 오류 |

#### 공간과 모델

59개 검사는 자료·공간 19개, 장면·모델 14개, 실제 모델 통합 3개, DOM·내부도 12개, 실제 정적 전달 11개로 구성된다.

공식 안내 마커 15개·기존 모델 16개를 구분해 유지하고 모든 표시 건물·시설 구획이 추정 안내 외곽에 포함되는지 검사했다. 면적·미터 투영·단위·북쪽과 동서 방향·독립 등록 오차·클리핑 연결·계단 유지·노드별 등급 분리를 검사했다. 원문 파일 없는 새 체크아웃에서도 공간 데이터가 동일하게 재생성된다.

실제 16개 상세 모델을 Babylon NullEngine에 로드해 기존 주 메쉬 정점과 내부 상세를 보존하고, 복합 건축 범위 전체의 정렬·축척·반복 정렬·지형 강조를 검사한다. 반복 창호·띠장 병합은 원본의 모든 해당 정점과 병합 후 월드 좌표를 비교한다. 지면의 upward/smooth 법선, 부지 밖 지면의 내부 빈 영역, 지형에 맞춘 도로·경계도 검사한다.

정적 전달은 실제 HTTP GET/HEAD·405·비정상 URI·개발 파일 차단·프로젝트 밖 junction 거부·dist 원자료와 stale 파일 제외·첫 화면 200 확인을 독립 임시 checkout에서 검사한다. 사용자 브라우저 자동 실행 자체는 검증하지 않았다.

최종 `node scripts/serve.mjs --dist` 배포 산출물도 `http://127.0.0.1:8765/`에서 확인했다. 진입점과 런타임 자산 27개는 모두 HTTP 200, 개발·원문·QA 파일 5개는 HTTP 404였다. 이 서버를 Headless Chromium으로 열어 ready 상태·건물 16개·장면 오류 0·브라우저 pageerror 0을 확인했다. 공개 인터넷 배포의 증거는 아니다.

#### 브라우저와 화면 증거

Headless Chromium은 SwiftShader 소프트웨어 WebGL로 실행했다. 데스크톱 1440×1000, 모바일 390×844 화면이다. 전체 안내 외곽의 화면 포함·패널 가림·검정/과노출·북쪽과 동서 방향·건물 검색·키보드·층 탭·Esc·카메라와 포커스 복귀·레이어·지형 강조·PNG crop/출처·오프라인 file 실행·WebGL 문자 대체를 검사했다.

최종 창호·복합 건물 축척·카메라 맞춤·PNG 라벨 수정 후 `npx.cmd playwright test --grep "complete campus overview|entrance, perimeter"`로 관련 데스크톱·모바일 4개를 다시 실행해 모두 통과했다. 변경되지 않은 오프라인·WebGL 대체 경로 3개는 앞선 전체 실행에서 통과했다. 모바일 오프라인 1개는 동일 파일의 중복 검사로 명시적으로 제외했다. 최종 확대 이미지에서도 지면 관통·공중 창호·복합 건물 과대 축척·PNG 라벨 겹침이 해결된 것을 확인했다.

최종 화면 증거는 루트 `evidence/screenshots/`에 있다. QA 이미지는 공개 dist에 포함하지 않는다.

- [전체 조감도](../evidence/screenshots/desktop-overview.png)
- [평면 전체 부지](../evidence/screenshots/desktop-top.png)
- [모바일 조감도](../evidence/screenshots/mobile-overview.png)
- [진입부](../evidence/screenshots/desktop-entry.png)
- [외곽](../evidence/screenshots/desktop-perimeter.png)
- [내부 상세](../evidence/screenshots/desktop-interior.png)
- [저장 PNG](../evidence/screenshots/desktop-export.png)
- [WebGL 대체](../evidence/screenshots/mobile-webgl-fallback.png)

#### 성능과 한계

불투명 반복 외관을 병합해 현재 장면 mesh 수를 1,556개에서 1,010개로 줄였다. 실제 소프트웨어 렌더 관측은 `desktop-render-observation.json`, `mobile-render-observation.json`에 기록한다. 이 값은 실기기 GPU나 사용자 스마트폰의 프레임률을 보장하지 않는다.

부지 정교화 단계의 짧은 관측은 데스크톱 6프레임/552.9ms, 모바일 12프레임/544.8ms(약 10.85/22.03fps)였다. 최신 확장판 관측은 위 확장 플랫폼 검사에 기록한다. 측정 환경은 ANGLE SwiftShader이며 화면 해상도·시점·CPU 부하가 다른 실기기 성능의 증거로 사용하지 않는다.

정밀 DEM·실제 footprint/높이·최신 항공영상·지적/소유 경계·현장 통행 가능 여부·실기기·보조기술 사용자 검토는 미검증이다. 측량 또는 법적 경계 검증의 완료로 보고하지 않는다. 공개 호스팅에는 배포하지 않았다.
