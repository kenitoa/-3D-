# 실행·배포·복구

## 로컬 실행과 관리자

Node.js 22.22.3 이상이 필요하다. Windows 루트 `start.cmd`를 더블클릭하면 설치·빌드·풀스택 서버 실행 후 브라우저를 연다. 사용자 주소는 **http://127.0.0.1:8765/**, 관리자 주소는 **http://127.0.0.1:8765/admin.html**이다. 자동 열기가 실패하면 주소창에 입력한다.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run build
npm.cmd run dev
```

산출물 서버는 `node scripts/serve.mjs --dist --platform`이다. --platform을 빼면 정적 제공만 한다. 빌드 후 index.html 직접 열기도 기본 탐색을 제공하지만 서버 저장/관리/API는 없다. vendor는 로컬이며 최초 npm 설치와 별도 공급자 조회에는 네트워크가 필요하다.

별도 대화형 터미널에서 `npm.cmd run admin:create`로 계정·역할·캠퍼스 범위·숨김 비밀번호를 입력한다. 기본 계정은 없다. 비밀번호는 12~256자이며 editor/reviewer는 `hanshin-gg` 같은 명시적 범위를 요구한다. editor 작성/제출→다른 reviewer 검토/승인/공개 흐름을 사용한다. admin은 승인/복구를 수행할 수 있다.

```powershell
npm.cmd run admin:disable -- old_username
npm.cmd run db:backup -- C:\campus-backups\campus-20261007.sqlite
```

비활성화 시 세션을 폐기한다. 비밀번호 재설정 웹/CLI는 현재 없으며 새 계정 생성과 이전 계정 비활성화로 복구한다. 온라인 백업은 새 .sqlite 파일만 허용한다.

## 환경 변수

.env.example은 키 목록이다. 서버는 .env를 자동 읽지 않는다. PowerShell 환경 변수 또는 배포 환경으로 전달한다. Compose는 자체 환경 치환을 사용한다.

| 키 | 의미 |
| --- | --- |
| PORT | 기본 8765, 1024~65535 |
| CAMPUS_DB_PATH | 기본 var/campus.sqlite. 공개/source 디렉터리·연결 파일 금지 |
| CAMPUS_PUBLIC_ORIGIN | 정확한 origin. development 기본 localhost/127.0.0.1. production 필수이며 외부 주소는 HTTPS |
| CAMPUS_BIND_HOST | 기본 127.0.0.1. 컨테이너에서 명시적 0.0.0.0 |
| CAMPUS_EMBED_ORIGINS | 승인 HTTPS iframe 부모 origin, 쉼표 구분. 관리자 iframe은 금지 |
| CAMPUS_PROVIDERS_FILE | 비공개 공급자 JSON 파일. 미설정이면 미연결 |
| CAMPUS_PROVIDER_TOKEN | secretEnv로 지정 가능한 비밀 환경 변수 예. 브라우저에 전달 금지 |
| CAMPUS_TRUSTED_PROXY_IPS | 선택한 프록시의 정확한 IP 목록. 기본 신뢰 없음 |
| CAMPUS_IFC_PYTHON | 선택 제작 도구의 절대 Python 경로. 서버/브라우저 실행에 불필요 |

프록시는 Host를 공개 origin에 맞춰 전달하고 X-Forwarded-For를 단일 실제 클라이언트 IP로 덮어써야 한다. IP 체인은 거부한다. 신뢰 프록시 설정 없이 여러 사용자 요청이 같은 프록시를 통과하면 IP 속도 제한을 공유한다. 서버 포트는 방화벽/loopback으로 제한하고 HTTPS는 reverse proxy에서 종료한다.

공급자 파일은 JSON 배열이며 최대 20개의 id/url/sourceId/campusId/kind(catalog, operations 또는 assistant)/enabled/secretEnv를 갖는다. URL은 명시적 HTTPS443 endpoint, secretEnv는 CAMPUS_PROVIDER_ 접두사 환경 변수 이름이다. 비밀 값은 파일에 쓰지 않는다. 정규화 Catalog 또는 운영 배열을 검증 후 초안에 넣으며 자동 공개하지 않는다. assistant는 승인된 공개 후보/출처 ID만 응답으로 사용한다. 실제 학교 공급자는 미연결이다.

## 배포와 저장

정적 배포는 dist 전체를 한 버전으로 제공한다. 풀스택 실행에는 서버 코드/SQL/도메인 자료와 별도 영속 DB가 필요하다. Dockerfile은 다단계 Node22.22.3 이미지, 비루트 사용자, healthcheck를 사용한다. Compose는 var 영속 볼륨·읽기 전용 rootfs·tmpfs·capability 제거·SIGTERM 종료를 설정한다.

```powershell
$env:CAMPUS_PUBLIC_ORIGIN='https://campus.example.org'
docker compose up --build -d
docker compose logs campus
```

컨테이너 계정 생성은 `docker compose exec campus node scripts/manage-platform.mjs create-user`, 온라인 백업은 `docker compose exec campus node scripts/manage-platform.mjs backup /app/var/backups/new.sqlite`로 실행한다. 비밀번호는 대화형 숨김 입력이며 백업은 영속 var 볼륨 안의 새 파일을 사용한다.

예시 도메인은 실제 배포 주소가 아니다. Compose는 호스트 loopback8765로 제공하므로 HTTPS 프록시가 필요하다. DB 볼륨을 삭제하지 않는다. SQLite 단일 인스턴스 범위이며 여러 replica를 동일 파일에 연결하지 않는다.

Compose에 전달하는 공급자 파일 경로는 컨테이너 내부 경로다. 예를 들어 var 볼륨에 비공개 설정을 준비하고 CAMPUS_PROVIDERS_FILE=/app/var/providers.json을 설정한다. 별도 파일 mount와 CAMPUS_PROVIDER_ 접두사의 추가 비밀 환경 변수는 비공개 Compose override/배포 설정으로 전달한다. 호스트 파일 경로나 모든 환경 변수를 자동 전달하지 않는다.

.github/workflows/validate.yml은 Windows/Linux Node 검사·Linux Chromium·컨테이너 build/start/health를 정의한다. 이번 환경에 Docker CLI가 없고 GitHub에 push하지 않았으므로 **컨테이너 실행·CI 성공·공개 배포는 미검증**이다.

공개 자산 allowlist는 원문 PDF/HTML/학교 삽화·QA 이미지·개발/비밀 파일·DB/백업을 제외하고 실제 경로까지 검사한다. CSP는 script/worker/connect self, 관리자 frame-ancestors none, viewer는 self와 승인 origin이다. HTTPS 설정 시 Secure cookie/HSTS를 제공한다.

오프라인 다운로드는 기본 공개 manifest 또는 서버가 재확인한 승인 불변 묶음의 크기/SHA-256을 검사 후 저장 포인터를 교체한다. 승인판은 기본/선택/전체 범위를 지원하며 실패 시 이전 완료판을 유지한다. API 응답 URL·관리자·제보·사진·세션은 캐시하지 않는다. 검증한 승인 Catalog/manifest는 내부 캐시에 보관하며 저장하지 않은 상세는 오프라인에서 요청하지 않는다. 네트워크 없는 운영정보를 최신으로 표시하지 않는다. 이미 봉인된 공개판의 런타임은 새 빌드로 변경되지 않으므로 최신 앱을 승인판 오프라인 묶음에 반영하려면 새 자료/자산 버전으로 검토·승인·공개한다.

## 검증과 복구

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run check:generated
npx.cmd playwright install chromium
npm.cmd run test:browser
git diff --check
```

브라우저 검사는 8767 격리 임시 DB/fixture 계정을 사용한다. 정상 var/campus.sqlite에 테스트 계정을 만들지 않는다. 실행 서버8765와 분리한다.

배포 전 온라인 백업, staging health/API/로그인/게시/복구/제보/자산을 확인한다. 첫 시작 시 SQL migration1→2→3이 순서대로 적용된다. 기존 schema2 DB에는 기존 행을 유지하고 불변 자산 묶음용 테이블을 추가하는 `0003-asset-bundles.sql`만 적용된다. 이미 적용한 파일은 수정하지 않는다. 앱보다 새 DB schema는 시작을 거부한다.

자료 롤백은 관리자에서 이전 불변 공개판 포인터를 선택한다. DB 재해 복구는 서버를 멈추고 현재 DB/WAL/SHM을 별도 보존한 뒤 새 경로에 백업을 복원하고 CAMPUS_DB_PATH를 변경해 검증한다. 구버전 앱 롤백에는 호환 DB 백업 또는 호환 앱이 필요하다. 실제 운영 복구 훈련은 미검증이다.
