# API·권한 계약

기본 /api/v1, 같은 origin JSON이다. 응답은 `{data,error,meta:{requestId,revision}}`, 오류는 data:null과 code/message다. SQL/stack/비밀값을 반환하지 않는다. 공개 Catalog는 비공개 객체·필드·출처·종속 공간을 제거한다.

| 공개 요청 | 동작 |
| --- | --- |
| GET /health | API/DB schema, catalog schema, revision, 시작 시각 |
| GET /catalog | 현재 승인 공개판+공개 운영 |
| GET /catalog?release=ID | 불변 과거 공개판. 현재 운영을 추가하지 않음 |
| GET /releases | 공개판 ID/시각/contentVersion |
| GET /spaces/영구ID | 공개 공간, 퇴역은410 |
| GET /operations | 공개 운영 기록, 확인/만료는 도메인 평가 |
| POST /reports | spaceId/type/description/idempotencyKey, 선택photo |
| GET /reports/ID | X-Report-Receipt 필요. 상태/답변만 |

제보 멱등키는 8~100자 문자/숫자/_/-, 같은 키와 내용은 동일 접수, 다른 내용은409다. photo는 mimeType/dataBase64이며 최대2MiB PNG/JPEG, 4096×4096/1200만pixel이다. UI 디코딩/canvas 재인코딩/동의, 서버 signature/구조/크기·PNG CRC/압축길이 검사와 PNG ancillary/JPEG APP/COM metadata 제거를 수행한다. JPEG 구조 검사는 완전한 server 이미지 디코더를 뜻하지 않는다. 사진은 관리자 attachment다.

GET /session은 user/null·csrfToken·계정 구성 여부, POST는 username/password 로그인, DELETE는 logout이다. cookie는 HttpOnly/SameSiteStrict/8시간, HTTPS production에서 Secure다. 관리자 mutation은 Origin 및 X-CSRF-Token이 필요하다.

| 관리자 요청 | 동작 |
| --- | --- |
| GET /admin/status | 범위 내 요약·제보 수. 전체판 열람 가능 여부 catalogReadable |
| GET /admin/catalog | admin 또는 포함된 모든 캠퍼스 담당 직원의 전체 관리 자료 |
| GET/POST /admin/drafts | scoped 초안 목록/생성, 생성 expectedRevision은 공개 revision |
| PATCH /admin/drafts/ID | 수정/submit/approve/reject, expectedRevision은 초안 revision |
| GET /admin/releases | 공개 이력 |
| POST /admin/releases | reviewer/admin, 승인 draftId+공개 expectedRevision |
| POST /admin/releases/ID/restore | admin, 공개 expectedRevision |
| GET /admin/reports 및 /ID | scoped 내용 |
| GET /admin/reports/ID/photo | scoped private attachment |
| PATCH /admin/reports/ID | scoped 처리 상태/답변 |
| GET/POST /admin/operations | 읽기 staff, 쓰기 reviewer/admin |
| GET /admin/providers | scoped 상태, URL/키 제외 |
| POST /admin/providers/ID/sync | scoped staff·공개 expectedRevision, 초안 저장 |
| GET /admin/audit | admin 감사 |

reviewer는 자신의 초안을 승인할 수 없다. admin은 명시적 역할로 승인할 수 있다. 승인 초안은 직접 수정하지 않고 게시 시 기준 공개 revision도 검사한다.

전체 Catalog에는 비공개 공간·출처와 공유 계약이 포함될 수 있다. 전체 열람과 초안 반환은 admin 또는 그 Catalog의 모든 캠퍼스를 담당하는 직원에게 허용한다. 전체 자료 수정·승인·게시·공급자 가져오기는 현재판과 새 자료의 모든 캠퍼스 담당 권한을 요구한다. 일부 캠퍼스 직원의 status는 열람 가능한 초안 요약과 담당 캠퍼스의 제보 수만 제공하며 공유 sources/integrations와 전체 프로세스 metrics는 빈 값이다. 초안·관리 공개 이력의 범위는 SQL에서 먼저 적용한다. 제보·운영 기록은 영구 identity의 campus_id로 범위를 판단하므로 공개판에서 삭제되거나 퇴역한 공간의 과거 제보도 담당자가 처리할 수 있다.

운영 입력은 entityId/title/owner/status(open,closed,restricted,unknown,construction,cancelled)/startsAt/endsAt/sourceId/visibility(public,restricted)다. 시간대 있는 ISO 기간·최대366일이며 달력 날짜·윤년·0~23시·0~59분/초·시간대 시/분을 검증한 뒤 UTC로 정규화한다. 존재하지 않는 날짜를 자동 보정해 수락하지 않는다. legacy 공간 키 입력은 영구 공간 ID로 저장한다. 새 생성 revision1, 기존 id 수정은 expectedRevision을 요구한다. 취소 기록은 관리 목록·감사 이력에 보존하되 공개 Catalog와 운영 목록에서는 SQL 페이징 전에 제외한다. 취소 뒤 별도의 유효한 운영 근거가 없으면 이용 상태는 unknown이다. 실제 자료 확인한 reviewer가 등록해야 한다.

대표 상태는422입력/자료오류,401인증,403권한/출처/CSRF,409revision/승인/기준판충돌,429속도제한,503공급자실패다. 사용자 message와 code를 구분한다.

GET /releases, /operations 및 /admin/releases, /drafts, /reports, /operations, /audit 목록은 `limit`·`offset`을 지원한다. limit은 기본·최대100, 감사는 기본·최대200이고 최소1이다. offset은 기본0, 최대100000이다. 10진 정수만 허용하고 중복·빈 값·음수·소수·범위 초과는422 INVALID_PAGINATION이다. 범위와 공개 필터를 SQL에서 먼저 적용하고 `LIMIT limit+1 OFFSET offset`으로 다음 페이지를 확인한다. 응답 data는 기존 배열 형식을 유지하며 `meta.pagination:{limit,offset,hasMore,nextOffset}`이 추가된다. nextOffset은 다음 페이지가 없거나 offset 상한을 넘어가면 null이다. 시각 내림차순·동률 ID 내림차순(감사는 ID)이며 offset 방식이므로 동시 등록 중 페이지 위치는 이동할 수 있다. 관리자 status의 초안 요약은 별도로 최근100개다. 관리 UI는 초안·공개 이력·제보·운영·감사 목록에 이전/다음 페이지 버튼을 제공하고 검증한 pagination 메타만 사용한다.

Catalog 최대2MiB/1만entity다. 전체판 열람 권한이 있는 관리자 status 지표는 요청/오류/충돌/제보/게시이며 프로세스 재시작 시 메모리 지표는 초기화된다. 감사/제보/공개판은 DB에 남는다. 임의 CORS/parent-window 제어 메시지는 제공하지 않는다.

## 고도화 공개 묶음·근거 안내

`GET /api/v1/bundle?release=<releaseId>`는 승인 공개판의 `catalog`, `manifest`, `catalogHash`, `contentVersion`, `assetsVersion`, `assets`, `mediaRecords`, `createdAt`를 반환한다. assets는 `path:assets/releases/<SHA>.<확장자>`, `originalPath`, `bytes`, `sha256`, `detail`이다. 파일은 GET/HEAD로 읽으며 불변 캐시 정책을 사용한다. 미등록 파일은404이고 관리자 미리보기·원본 IFC·비공개 공간/속성은 공개 묶음에 포함하지 않는다. `/catalog` meta.releaseId와 실제 assetManifest를 사용한다. 기존 공개판 조회 및 공유 링크의 contentVersion/assetsVersion/releaseId는 선택 필드이므로 기존 링크도 유지된다.

오프라인은 API 응답 URL을 캐시하지 않는다. 저장 요청 시 같은 출처 서버의 해당 승인 묶음을 재확인하고 JSON/SHA/공개성/모델 파일을 검사해 내부 캐시에 보관한다. 기본/선택/전체 범위를 지원하며 모든 파일 검사가 끝나야 저장 포인터를 바꾼다. 운영 정보는 저장 당시 기준이다.

`GET /api/v1/assistant/status`는 활성 등록 공급자의 비밀 값 없는 ID/campusId/sourceId만 반환한다. `POST /api/v1/assistant`는 `{question,campusId,contentVersion,purpose?}`를 받는다. 질문500자, 분당15회, 현재 공개 캠퍼스/자료판을 검사한다. 답은 `{contentVersion,entities,sourceIds,mode}`이며 entities 필드는 현재 승인 자료에서 다시 구성한다. 외부 생성 문장은 반환하지 않는다. 이전 자료판은409 CATALOG_CHANGED다.

assistant 공급자는 서버가 등록한 검수 공개 출처와 연결된 HTTPS endpoint만 사용한다. POST32KiB/응답2MiB/전체8초, 검증 DNS 고정·리다이렉트 금지·POST 자동 재시도 없음이다. 응답 `{contentVersion,entityIds,sourceIds}`가 현재 승인 후보와 다르거나 실패하면 등록 자료 검색으로 복귀한다. GPS·비공개 공간·세션 정보는 공급자 입력에서 제외한다. 실제 공급자는 미설정이다.
