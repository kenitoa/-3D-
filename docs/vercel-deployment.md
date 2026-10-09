# Vercel 전체 기능 배포

정적 화면은 `dist/`, API는 `api/campus.mjs` Node Function, 영속 데이터는 Turso libSQL에 둔다. 로컬 실행은 기존 SQLite를 유지한다. Vercel 함수의 임시 파일 시스템에 DB를 만들지 않는다. 작성·검토·승인·제보·세션 API와 URL은 그대로다.

## 데이터 이전 순서

1. 최종 이전 동안 기존 서버에서 작성/제보를 중단한다. 온라인 스냅샷은 한 시점의 일관된 자료이므로 이후 변경은 자동 동기화되지 않는다.
2. 아래 명령으로 **새 파일**에 온라인 백업을 만들고 그 사본에 migration 4를 적용한다. 원본을 직접 마이그레이션하지 않는다. `var/backups`를 먼저 생성한다.

```powershell
npm.cmd run build
npm.cmd run db:remote -- prepare-upload var/campus.sqlite var/backups/new-upload.sqlite
```

3. Turso의 Create Database → Upload SQLite File에서 사본을 가져온다. 계정의 무료 범위와 가까운 지역을 선택한다. 이미 데이터가 있는 DB에 덮어쓰지 않는다. 계정·제보 사진·비밀 설정이 포함되므로 비공개 DB로 취급한다.
4. 연결 후 `migrations`의 최댓값 4, 각 테이블 건수, `PRAGMA foreign_key_check`를 확인한다. 로컬 CLI로도 준비 상태를 검증할 수 있다.

```powershell
node --env-file=.env scripts/manage-remote.mjs check
```

파일 업로드를 사용하지 않을 때는 빈 Turso DB에 `node --env-file=.env scripts/manage-remote.mjs import var/backups/new-upload.sqlite`로 이전한다. 모든 비즈니스 테이블과 rowid/BLOB을 복사하고 행별 해시·건수·외래 키를 비교한다. 같은 사본은 중단 후 재개 가능하다. 다른 사본이나 기존 데이터가 있는 대상은 거부한다. 완료 전에는 API 시작을 거부한다. 일시적인 속도 제한·공급자 잠금은 복사하지 않는다.

## Vercel 연결과 환경 변수

GitHub 앱에는 이 저장소 하나만 연결하고 프로젝트를 가져온다. Framework는 Other, Root Directory는 루트, Node.js는 22.x, Build는 `npm run build`, Output은 `dist`다. 저장소의 `vercel.json`이 정적 배포와 Node Function 라우팅을 함께 정의한다. Production 환경에만 아래 값을 설정한다.

| 키 | 설정 |
| --- | --- |
| CAMPUS_PUBLIC_ORIGIN | 최종 HTTPS origin. 경로와 마지막 슬래시 없이 정확한 주소 |
| TURSO_DATABASE_URL | 해당 DB의 `libsql://…turso.io` 주소 |
| TURSO_AUTH_TOKEN | 해당 DB에 한정한 읽기/쓰기 토큰. 브라우저 번들에 노출 금지 |

실제 `.env`와 `.vercel`은 git에서 제외된다. 비밀값은 터미널 인자·문서·소스에 쓰지 않는다. Preview에 Production DB 자격 증명을 복사하지 않는다. Preview 기능 검증에는 별도 DB·origin이 필요하다. 토큰 만료 전에 교체하고 재배포한다.

API 실행 시 schema/초기 공개판/영수증 비밀 설정을 검사하며 자동 초기화나 마이그레이션을 하지 않는다. DB URL은 TLS Turso 주소만 허용한다. Vercel이 덮어쓴 단일 `X-Forwarded-For`를 이 어댑터에서만 신뢰한다. HttpOnly·Secure·SameSite=Strict 세션, origin·CSRF·역할·캠퍼스 검사를 유지한다. 응답은 DB 트랜잭션 커밋 후 내보낸다.

## 검증과 운영

배포 후 `/api/v1/health`에서 schema 4와 status ok, `/api/v1/catalog`, `/api/v1/bundle`, SHA 자산 URL, `/admin.html`의 로그인과 제보·별도 검토자 승인 흐름을 확인한다. 공개판 수·파일 수와 기존 DB를 비교한다. DB가 없거나 준비되지 않았으면 API는 정제된 503을 반환하며 화면 정적 배포만으로 전체 기능 완료로 간주하지 않는다.

DB에 관리자 계정이 없다면 비공개 `.env`에 위 서버 환경 변수를 설정한 뒤 대화형 터미널에서 `node --env-file=.env scripts/manage-platform.mjs create-user`로 생성한다. 비밀번호는 숨김 입력하며 기본 계정은 없다. 계정 폐기는 `node --env-file=.env scripts/manage-platform.mjs disable-user <username>`이며 세션도 폐기한다. 외부 DB 백업은 Turso의 export/복구 도구를 사용한다. 기존 `db:backup`은 로컬 DB 전용이다.

속도 제한과 공급자 동기화 잠금은 DB로 공유한다. 요청/오류 로그는 Vercel에 정제된 JSON으로 남기며 프로세스 메모리 지표는 해당 함수 인스턴스 범위다. 장기 모니터링은 Vercel 로그와 Turso 사용량에서 확인한다. 전송/DB 접근 시간 제한이 있으며 자동 재시도는 변경 요청에 적용하지 않는다. 큰 자산은 스트리밍하지만 메모리에 한 파일을 읽는다. Vercel의 요청 본문 4.5 MB 제한은 앱의 6 MB JSON 한도보다 앞서 적용된다. 제보 사진은 2 MB다. 무료 할당량·대량 부하·장기 백업 보존은 별도 운영 확인이 필요하다.

## 복구

원본 SQLite와 업로드 사본을 비공개 위치에 보관한다. migration 4는 기존 테이블/컬럼을 삭제하지 않는다. 문제가 생기면 해당 배포를 롤백하거나 로컬 서버로 돌아갈 수 있다. 외부 DB에 신규 데이터가 쌓인 후 로컬로 돌아갈 때는 먼저 외부 DB를 export하여 새 파일에서 검증한다. 원본 파일에 덮어쓰거나 원격 DB를 초기화하지 않는다. Vercel의 이전 버전 중 schema 4를 지원하지 않는 코드로 API를 롤백하지 않는다.

공식 제한: [Vercel SQLite 지원](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [Turso 이전](https://docs.turso.tech/cloud/migrate-to-turso), [Vercel 요청 헤더](https://vercel.com/docs/headers/request-headers).
