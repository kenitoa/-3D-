# 보안과 운영 책임

공개 읽기와 private 관리 자료를 분리한다. 서버는 모든 요청과 공간의 캠퍼스 범위에서 역할을 확인한다. UI 숨김을 권한 경계로 사용하지 않는다. 공개 투영은 중첩 allowlist로 개인/민감 공간·비공개 출처·사진·검토 메모를 제외한다.

전체 private Catalog·초안 반환은 admin 또는 자료에 포함된 모든 캠퍼스를 담당하는 직원만 허용한다. 전체 수정·승인·게시·공급자 가져오기는 현재판과 새 판 모두의 캠퍼스 권한을 요구한다. 일부 캠퍼스 직원에게 다른 캠퍼스의 비공개 자료를 보내어 변경 불가로만 제한하지 않는다. status의 공유 출처·연동·프로세스 지표는 전체판 권한이 없으면 제외하고 초안/공개 이력은 SQL의 모든 캠퍼스 조건으로 필터한다. 제보 수·제보/운영 목록·제보 첨부는 영구 identity.campus_id로 판단하여 퇴역·삭제된 공간도 범위가 유지된다. 목록의 limit/offset은 검증·바인딩하고 범위를 적용한 후 페이지를 구성한다. 상세 계약은 [API](api.md)를 따른다.

비밀번호는 random salt+scrypt(N32768/r8/p1), 세션은32byte random/hash 저장/8시간 만료다. 기본 계정은 없다. 실패 응답은 계정 존재를 구분하지 않는다. Host/Origin/CSRF·SameSite/HttpOnly/Secure와 계정 비활성화 세션 폐기를 적용한다. 학교 SSO/MFA/웹 비밀번호 재설정은 미연결이다.

입력 크기/ID/날짜/도형/참조/출처/파일 구조를 검증하고 SQL 바인딩과 textContent/검증 URL을 사용한다. 공개 자산 실제 경로/allowlist·CSP self·관리자 iframe 금지, 자급형 GLB만 허용한다. 공급자는 고정 HTTPS443·public DNS/IP·TLS lookup 고정·redirect금지·8초timeout/제한retry·2MiB JSON 제한이다.

로그는 UTC/requestId/operation path/duration/status다. password/cookie/CSRF/receipt/API key/사진/내용/query를 기록하지 않는다. DB 공유 IP 제한은 로그인8회/15분, 제보6회/시간, API300회/분이다. 신뢰 프록시는 정확한 IP를 명시하고 단일 X-Forwarded-For를 덮어쓰는 조건이다. Vercel 전용 어댑터는 공급자가 덮어쓴 단일 헤더만 사용한다. 인스턴스 재생성 후 제한 유지와 libSQL 세션/권한/승인은 통합 테스트로 확인하며 클라우드 공격 부하/침투 시험은 별도다.

제보와 사진은 private DB에 저장하고 scoped 담당자에게만 제공한다. metadata 제거와 사용자 동의를 적용한다. 조회키는 상태/답변만 보여준다. 사용자에게 불필요한 개인정보 입력을 피하도록 안내한다. 학교 운영 전에 책임부서·보존/삭제기간·SLA·비밀 교체·백업 접근/암호화를 정해야 한다. 현재 자동 삭제 scheduler는 없다.

온라인 SQLite 백업은 기존 파일을 덮어쓰지 않는 새 .sqlite 파일만 허용하며 본 DB와 동일한 실제 부모 경로·링크 검사를 적용한다. dist/src/styles/vendor/evidence/docs/server와 그 하위 경로 또는 해당 경로를 가리키는 링크에 저장하지 않는다. 백업은 비공개 보관 경로에 두고 별도로 접근 권한·암호화·복구 훈련을 관리한다.

[배포](deployment.md)와 [DB](database.md), [32개 반영 상태](expansion-status.md)를 따른다. 실제 공개 운영·학교 외부 부하·보조기술/실기기·장애/복구 훈련은 미검증이다.
