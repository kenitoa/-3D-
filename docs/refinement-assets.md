# 3D 자산 제작·공개 규격

좌표 원본은 캠퍼스별 동쪽·북쪽·높이 미터 좌표다. 장면은 1단위=10m, Y 위쪽, Z=-북쪽이다. `placement`에 단위, 위축, 원점, 앵커 미터 좌표, 회전, 고도 기준, measured/inferred를 명시한다. inferred는 변환을 통과해도 측량 자료로 승격하지 않는다. 원본과 변환물을 분리하고 제작자·도구·설정·출처·재사용 권리·원본 SHA를 기록한다.

조감도 변환은 원본 16개 모델을 기존 배치에서 평가하고 삼각형을 제거하지 않으며 같은 재질을 병합한다. 좌표/법선/삼각형 방향은 이 프로젝트의 Babylon 9.29.0 실제 GLB 어댑터로 다시 읽어 검증한다. Standard diffuse/alpha는 PBR baseColor/roughness로 근사된다. 근접 보기에는 원본 재질이 남아 있다. 텍스처·다중 재질·미지원 속성은 조용히 삭제하지 않고 변환을 거부한다.

```powershell
node scripts/asset-audit.mjs --generate-overview --write-manifest --output evidence/refinement-asset-audit.json
npm.cmd run build
```

현재 조감도 자산은 원본 790개 메쉬를 재질별 144개 메쉬로 병합하고 원본 9,586개 삼각형을 보존한다. 총 699,688 bytes다. 이것은 프로젝트 내부 원본 보존 검사이며 실제 학교 건물 치수의 정확도 증명은 아니다. LOD는 먼 거리 대체 형상→조감도 GLB→근접 원본의 세 단계다. 비선택 모델의 화면 점유율이 0.003 미만이면 상세를 해제하고, 근접 단계는 화면 점유율 0.045/거리160m를 사용하며 15% 히스테리시스로 왕복을 줄인다. 큐·자원 예산을 넘는 가시 모델을 매 프레임 다시 요청하지 않으며 실패 모델은 명시적 재시도 전까지 반복 요청하지 않는다. 128MiB 상주 예산은 등록 자산 바이트의 합 기준이며 실제 브라우저 RAM/GPU 메모리 상한을 보장하지 않는다. 원본 교체가 실패하면 이전 형상이나 기본 대체 형상을 유지한다.

GLB는 자체 포함만 허용한다. 외부 URI, 스킨/애니메이션 등 현재 등록 계약 밖의 기능, 비공개/미등록 의미 ID는 검증한다. Draco/Meshopt는 등록된 로컬 디코더가 있을 때만 사용할 수 있다. 현재 디코더와 KTX2 전체 번들은 제공하지 않는다. 압축과 WebGPU는 실제 패키지·기기·성능 비교를 통과하기 전 기본 경로로 선택하지 않는다.

IFC는 별도 제작 단계다. `scripts/ifc-requirements.txt`의 선택 Python 도구를 설치하고 `CAMPUS_IFC_PYTHON`을 절대 경로로 지정한다. 서버나 브라우저에서 신뢰하지 않은 원본을 자동 실행하지 않는다. CLI는 입력 128MiB, 출력 64MiB, 기본 120초로 제한하며 Python isolated 모드로 실행한다. 이는 OS 수준 샌드박스가 아니다. 신뢰된 제작 환경에서 원본 권리를 확인한 뒤 실행한다.

```powershell
$env:CAMPUS_IFC_PYTHON = 'C:\absolute\ifc-tools\Scripts\python.exe'
node scripts/import-ifc.mjs source.ifc private-selection.json assets/models/new-model.glb
```

실제 사용 인자는 스크립트의 사용 안내를 따른다. 요청 JSON은 `publicAllowlist:[{globalId,spaceId}]`, `sourceOriginMeters`, `sourceId`, `license`, `placement`가 필요하다. 공개 건물 요소를 명시적으로 골라 실제 메쉬를 생성하고 IFC 이름·속성·비선택 요소를 출력에서 제외한다. 원본 GUID 매핑은 `var/` 제작 기록에만 보관한다. GLB 공개 승인 전에 각 `spaceId`의 공개 부모 관계와 형상을 검수한다.

관리 화면은 공개하지 않은 로컬 GLB의 통계와 두 실제 장면을 같은 카메라에서 비교한다. 이 검토만으로 파일이 서버에 업로드되거나 승인되지 않는다. 제작한 자산을 명시적으로 등록하고 `assetManifest` 초안을 검토해 승인해야 한다. 운영 중 변경은 새 contentVersion/manifest version을 부여한다.

새 공개판은 자료, 모델/LOD, 로컬 미디어, 실행 파일을 SHA 경로로 DB에 함께 보관한다. 승인 트랜잭션에서 공개 포인터와 묶음을 갱신하고 이전 공개판 파일은 보존한다. 도입 전 공개판은 첫 접근 시 현재 등록 자산으로 묶음을 만들기 때문에 과거에 보관하지 않은 파일을 재구성한 것으로 해석하지 않는다. 이후 앱 소스를 수정하거나 재빌드해도 이미 봉인된 공개판의 실행 파일은 바뀌지 않는다. 최신 앱을 승인판 오프라인 묶음에 제공하려면 새 contentVersion/manifest version으로 초안을 검토·승인·공개한다. `var/campus.sqlite`의 온라인 백업에는 자산 BLOB도 포함되므로 저장량과 백업 시간을 관찰한다.

미디어는 `assets/media/manifest.json`에 공개 공간 ID·공개 출처·명시적 권리·로컬 경로·종류를 등록한다. AR 현장 앵커는 `assets/ar/manifest.json`에 검수일·만료일·출처·허용 오차·기준점 2개 이상·서로 다른 독립 검수점 3개 이상을 등록한다. 현재 두 목록은 비어 있다.
