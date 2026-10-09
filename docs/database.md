# 데이터베이스와 마이그레이션

로컬은 Node native SQLite(DatabaseSync/online backup), Vercel은 외부 Turso libSQL을 사용한다. 공통 비동기 SQL 어댑터로 API 트랜잭션을 유지한다. 기본 var/campus.sqlite는 공개 경로 밖이며 git에서 제외한다. 로컬은 WAL·foreign_keys·busy_timeout과 SQL 바인딩을 사용한다. 원격은 공급자의 동시성 관리와 바인딩을 사용하며 WAL/busy_timeout을 설정하지 않는다.

| 마이그레이션 | 저장 범위 |
| --- | --- |
| 0001-platform.sql | settings/users/sessions/drafts/releases/identities/reports/operations/audit |
| 0002-provider-runs.sql | 공급자 시도/성공·초안·상태·정제 오류 |
| 0003-asset-bundles.sql | 불변 공개 자료 묶음·SHA/확장자별 파일 BLOB·공개판 파일 관계 |
| 0004-serverless.sql | 공유 속도 제한·공급자 잠금·재개 가능한 데이터 이전 상태 |

migrations는 적용 버전과 UTC 시간을 저장한다. 최초 공개 자료는 불변 release다. 게시 시 새 release, currentRelease pointer, revision을 트랜잭션으로 갱신한다. 초안 revision/기준 공개 revision을 검사한다. ID ledger는 종류/캠퍼스 재사용과 퇴역 ID 재활용을 막는다. 명시적 이전판 복구는 원래 정체성을 활성화할 수 있다.

사용자는 salted scrypt hash·역할·캠퍼스 범위, 세션은 token hash·만료·CSRF를 저장한다. 즐겨찾기/최근/수동 시간표는 로컬 자료이며 계정 동기화하지 않는다. 제보 내용/사진은 private DB, 영수증 조회는 secret에서 만든 조회키로 상태/답변만 반환한다. 운영 기록은 출처/담당/검토자/기간/개별 revision을 갖는다.

온라인 백업 명령은 `npm.cmd run db:backup -- <new.sqlite>`이며 기존 파일을 덮어쓰지 않는다. migration3는 기존 데이터를 삭제하지 않고 새 공개판의 자료·파일을 함께 보관한다. 자산 BLOB이 DB에 포함되어 파일 증가량과 백업 시간을 관찰해야 한다. 도입 전 공개판은 처음 묶음을 만들 때 현재 등록 파일을 사용하며 과거 미보관 파일을 재구성하지 않는다. 운영 백업 주기·보존기간·암호화 저장소·복구 책임자·재해 복구 훈련은 미합의/미검증이다.

앱보다 새 schema는 시작을 거부한다. 적용 migration은 편집하지 않는다. 원격 API는 schema 4와 완료된 이전을 요구하며 런타임에서 자동 변경하지 않는다. [배포·복구 절차](deployment.md)와 [Vercel 이전 순서](vercel-deployment.md)를 따른다. 다중 인스턴스 기능은 libSQL 통합 테스트로 검증하며 실제 클라우드 대량 부하는 별도 측정이 필요하다.
