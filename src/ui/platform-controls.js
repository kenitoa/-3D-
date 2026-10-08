/* Progressive campus services. All spatial and operational assertions come from the catalog. */
(function attachPlatformControls() {
  "use strict";

  let active = null;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const WORDS = {
    ko: { search: "공간·목적 검색", map: "문자·2D 안내", route: "길찾기", personal: "나의 장소·시간표", tour: "가상 캠퍼스 투어", operations: "행사·운영 안내", share: "선택·시점 공유", feedback: "지도·시설 문제 제보", helper: "자료에 근거한 도우미", data: "자료·레이어·변경 비교", device: "기기·오프라인", all: "전체", select: "선택", favorite: "즐겨찾기", remove: "삭제", unknown: "미확인", empty: "등록된 자료가 없습니다.", back: "조감도로 돌아가기", current: "현재", historic: "과거", proposed: "계획", searchButton: "찾기", save: "저장", next: "다음", previous: "이전", stop: "투어 종료", start: "투어 시작", language: "표시 언어", verified: "공식자료 확인", mapped: "지도 자료 기반", estimated: "자료 기반 추정" },
    en: { search: "Find a space", map: "Text / 2D guide", route: "Directions", personal: "My places / timetable", tour: "Virtual campus tour", operations: "Events / operating information", share: "Share a place / view", feedback: "Report a map / facility issue", helper: "Catalog-based helper", data: "Datasets / layers / comparison", device: "Device / offline", all: "All", select: "Select", favorite: "Favorite", remove: "Remove", unknown: "Unverified", empty: "No registered information.", back: "Return to overview", current: "Current", historic: "Historic", proposed: "Proposed", searchButton: "Find", save: "Save", next: "Next", previous: "Previous", stop: "End tour", start: "Start tour", language: "Display language", verified: "Official information verified", mapped: "Map-based", estimated: "Estimated from sources" }
  };

  function node(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = String(text);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function https(value) {
    try { const url = new URL(String(value)); return url.protocol === "https:" ? url.href : null; } catch { return null; }
  }

  function list(value) { return Array.isArray(value) ? value : []; }

  function initialize(options = {}) {
    if (active) active.destroy();
    const mount = options.mount || document.getElementById("campusTools");
    if (!mount) return null;
    const domain = window.CampusPlatform;
    let catalog = options.catalog;
    const onAction = typeof options.onAction === "function" ? options.onAction : () => {};
    const getState = typeof options.getState === "function" ? options.getState : () => ({});
    let language = "ko", selectedId = null, modelStates = {}, modelStateKey = "", quality = "auto", offlineInitialized = false, temporaryLocation = null, locationKey = "", destroyed = false, searchHighlightKey = "";
    let importedCatalog = null, tourState = null, photo = null, photoBusy = false, photoGeneration = 0, apiBusy = false, reportKey = null, reportFingerprint = null, refinement = null;
    const events = [], pending = new Set();
    const storedKey = "hanshin-campus-personal-v1";
    let personal = { version: 1, favorites: [], recent: [], timetable: [] };
    let store = null;
    const root = node("div", null, { class: "platform-controls", id: "campusPlatform" });
    mount.append(root);
    root.innerHTML = `
      <p class="platform-note">공간·운영 정보는 등록된 자료의 확인 수준과 날짜를 따릅니다.</p>
      <label class="platform-field"><span data-i18n="language">표시 언어</span><select data-field="language"><option value="ko">한국어</option><option value="en">English</option></select></label>
      <details class="site-section platform-section" data-section="search"><summary data-i18n="search">공간·목적 검색</summary><div class="site-section-body">
        <form data-form="search"><label class="platform-field">이름·번호·서비스<input type="search" data-field="query" maxlength="120" placeholder="예: 도서관, 지원센터, 203" autocomplete="off"></label>
          <label class="platform-field">목적<select data-field="purpose"><option value="">전체</option></select></label>
          <label class="platform-field">건물<select data-field="building"><option value="">전체</option></select></label>
          <label class="platform-field">층<select data-field="floor"><option value="">전체</option></select></label>
          <button type="submit" data-i18n="searchButton">찾기</button></form>
        <p data-output="search-count" role="status"></p><ul class="platform-list" data-output="search-results"></ul>
        <section class="platform-selected" data-output="selected" aria-label="선택한 공간" hidden></section>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="map">문자·2D 안내</summary><div class="site-section-body">
        <div class="platform-row"><button type="button" data-command="text">문자 안내</button><button type="button" data-command="2d">2D 안내</button><button type="button" data-command="overview">3D 전체</button></div>
        <p class="platform-note">같은 공간 ID와 확인 수준을 사용합니다. 개념 내부도에서 실제 경로를 만들지 않습니다.</p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="route">길찾기</summary><div class="site-section-body">
        <form data-form="route"><label class="platform-field">출발 공간<select data-field="from" required></select></label><label class="platform-field">도착 공간<select data-field="to" required></select></label>
          <label class="platform-check"><input type="checkbox" data-field="accessible">검증된 무장애 연결만 사용</label><button type="submit">경로 확인</button>
          <button type="button" data-command="location">현재 위치 확인</button></form><p data-output="location" role="status"></p><p data-output="route" role="status"></p><ol data-output="route-steps"></ol>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="personal">나의 장소·시간표</summary><div class="site-section-body">
        <h3>즐겨찾기</h3><ul class="platform-list" data-output="favorites"></ul><h3>최근 선택</h3><ul class="platform-list" data-output="recent"></ul>
        <form data-form="schedule"><label class="platform-field">일정 이름<input data-field="schedule-title" maxlength="80" required></label><label class="platform-field">공간<select data-field="schedule-space" required></select></label>
          <div class="platform-row"><label class="platform-field">요일<select data-field="schedule-day"><option value="1">월</option><option value="2">화</option><option value="3">수</option><option value="4">목</option><option value="5">금</option><option value="6">토</option><option value="0">일</option></select></label><label class="platform-field">시작<input data-field="schedule-time" type="time" required></label><label class="platform-field">종료<input data-field="schedule-end" type="time" required></label></div><button type="submit">수동 일정 추가</button></form>
        <ul class="platform-list" data-output="timetable"></ul><label class="platform-field">내보낸 JSON 시간표 가져오기<input type="file" data-field="schedule-import" accept="application/json,.json"></label>
        <p class="platform-note">학교 시간표 연동은 미연결입니다. 직접 등록하거나 이 화면에서 내보낸 JSON을 사용합니다.</p>
        <div class="platform-row"><button type="button" data-command="schedule-export">시간표 내보내기</button><button type="button" data-command="personal-reset">개인 저장 초기화</button></div><p data-output="storage" role="status"></p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="tour">가상 캠퍼스 투어</summary><div class="site-section-body">
        <label class="platform-field">가상 탐색 순서<select data-field="tour"></select></label><button type="button" data-command="tour-start" data-i18n="start">투어 시작</button>
        <div class="platform-row"><button type="button" data-command="tour-prev" data-i18n="previous" disabled>이전</button><button type="button" data-command="tour-next" data-i18n="next" disabled>다음</button><button type="button" data-command="tour-stop" data-i18n="stop" disabled>투어 종료</button></div>
        <p data-output="tour" role="status"></p><p class="platform-note">자료 기반 가상 탐색이며 현장 통행·방문 가능 여부를 보증하지 않습니다.</p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="operations">행사·운영 안내</summary><div class="site-section-body"><ul data-output="events"></ul><ul data-output="operations"></ul><p class="platform-note">미확인과 만료 상태는 열림·통행 가능으로 해석하지 않습니다.</p><ul data-output="services"></ul></div></details>
      <details class="site-section platform-section"><summary data-i18n="share">선택·시점 공유</summary><div class="site-section-body">
        <button type="button" data-command="share">공유 링크 만들기</button><label class="platform-field">공유 주소<input data-field="share-url" readonly></label>
        <div class="platform-row"><button type="button" data-command="share-copy">주소 복사</button><button type="button" data-command="qr">QR 만들기</button><button type="button" data-command="export">현재 안내 이미지 저장</button></div>
        <img class="platform-qr" data-output="qr" alt="현재 선택과 시점의 공유 QR 코드" hidden><p data-output="share" role="status"></p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="feedback">지도·시설 문제 제보</summary><div class="site-section-body">
        <form data-form="report"><label class="platform-field">공간<select data-field="report-space" required></select></label><label class="platform-field">문제 유형<select data-field="report-type"><option value="map">지도·공간 정보 오류</option><option value="facility">시설 문제</option><option value="access">접근·이동 문제</option><option value="closure">폐쇄·통제 확인 요청</option></select></label>
          <label class="platform-field">설명<textarea data-field="report-description" maxlength="2000" minlength="5" required></textarea></label><label class="platform-field">선택 사진 · PNG/JPEG 2MB 이하<input data-field="report-photo" type="file" accept="image/png,image/jpeg"></label>
          <img class="platform-photo" data-output="photo" alt="제출할 사진 미리보기" hidden><button type="button" data-command="photo-remove">사진 제거</button><label class="platform-check"><input type="checkbox" data-field="photo-consent">사진에 개인정보가 없으며 담당자의 비공개 검토용 제출에 동의합니다.</label>
          <p class="platform-note">사진은 픽셀 재인코딩으로 원본 위치 메타데이터를 제거합니다. 제보는 승인 전에 지도에 공개되지 않습니다.</p><button type="submit">제보 제출</button></form><p data-output="report" role="status"></p>
        <form data-form="receipt"><label class="platform-field">접수번호<input data-field="receipt-id" maxlength="100" autocomplete="off" required></label><label class="platform-field">비공개 조회 토큰<input data-field="receipt-token" maxlength="300" autocomplete="off" required></label><div class="platform-row"><button type="submit">제보 처리 상태 조회</button><button type="button" data-command="receipt-copy">조회 정보 복사</button></div></form><p class="platform-note">조회 토큰은 이 화면에만 유지합니다. 영구 저장·공유 링크에 포함하지 않으며 토큰을 가진 사람은 처리 상태를 볼 수 있습니다.</p><p data-output="receipt" role="status"></p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="helper">자료에 근거한 도우미</summary><div class="site-section-body"><form data-form="helper"><label class="platform-field">등록된 공간·서비스 찾기<input data-field="helper" maxlength="120" required></label><button type="submit">근거와 함께 찾기</button></form><ul data-output="helper"></ul><p class="platform-note">등록된 자료만 검색합니다. 운영 정보나 통행 가능한 경로를 만들어 답하지 않습니다.</p></div></details>
      <details class="site-section platform-section"><summary data-i18n="data">자료·레이어·변경 비교</summary><div class="site-section-body">
        <p data-output="catalog"></p><label class="platform-field">캠퍼스<select data-field="campus"></select></label><label class="platform-field">표시 자료<select data-field="history"><option value="current">현재</option><option value="historic">과거</option><option value="proposed">계획</option></select></label>
        <div data-output="layers"></div><p data-output="history"></p><label class="platform-field">공개 catalog JSON 검토<input data-field="catalog-import" type="file" accept="application/json,.json"></label>
        <p data-output="import" role="status"></p><ul data-output="diff"></ul><button type="button" data-command="catalog-apply" disabled>검증한 자료로 전환</button><button type="button" data-command="catalog-export">현재 공개 자료 내보내기</button>
        <p class="platform-note">가져오기는 이 브라우저의 자료 전환이며 학교의 승인·공개 배포를 뜻하지 않습니다. 계획 자료는 현재 시설과 구분합니다.</p>
      </div></details>
      <details class="site-section platform-section"><summary data-i18n="device">기기·오프라인</summary><div class="site-section-body">
        <label class="platform-field">표현 품질<select data-field="quality"><option value="auto">자동</option><option value="low">간단하게</option><option value="high">자세하게</option></select></label><p data-output="network" role="status"></p>
        <div class="platform-row"><button type="button" data-command="offline-save">오프라인 자료 저장·갱신</button><button type="button" data-command="offline-clear">오프라인 자료 삭제</button></div><p class="platform-note">저장된 기본 지도와 건물 안내를 사용할 수 있습니다. 온라인에서 새로 공개한 자료와 최신 운영 정보는 포함되지 않습니다.</p><p data-output="offline" role="status"></p>
        <button type="button" data-command="catalog-refresh">공개 자료 새로 확인</button><button type="button" data-command="xr">XR 지원 확인</button><p data-output="xr" role="status"></p>
        <a class="platform-admin" href="admin.html">담당자 관리 화면</a>
      </div></details><p class="platform-announcement" data-output="announcement" role="status" aria-live="polite"></p>`;
    const overlay = node("section", null, { class: "platform-map-overlay", id: "campusAlternativeMap", role: "dialog", "aria-modal": "true", "aria-label": "문자·2D 캠퍼스 안내", tabindex: "-1" });
    overlay.hidden = true;
    overlay.innerHTML = `<header><h2 data-map-title>캠퍼스 안내</h2><button type="button" data-map-close>조감도로 돌아가기</button></header><p data-map-note></p><div class="platform-map-body"><div data-map-svg></div><ul class="platform-map-list" data-map-list></ul></div><section data-map-selected aria-label="선택한 공간"></section>`;
    document.body.append(overlay);
    let previousFocus = null, inertState = [];
    const fields = new Map(Array.from(root.querySelectorAll("[data-field]")).map((element) => [element.dataset.field, element]));
    const outputs = new Map(Array.from(root.querySelectorAll("[data-output]")).map((element) => [element.dataset.output, element]));
    const commandsByName = new Map(Array.from(root.querySelectorAll("[data-command]")).map((element) => [element.dataset.command, element]));
    const q = (name) => fields.get(name);
    const output = (name) => outputs.get(name);
    const command = (name) => commandsByName.get(name);
    const t = (key) => WORDS[language][key] || key;
    const listen = (target, event, callback) => { target.addEventListener(event, callback); events.push(() => target.removeEventListener(event, callback)); };
    const announce = (message) => { if (!destroyed) output("announcement").textContent = message; };
    const action = (name, payload = {}) => { if (!destroyed) return onAction(name, payload); };
    const visible = (entity) => { if (!entity || entity.campusId !== q("campus").value) return false; const seen = new Set(); let current = entity; while (current) { if (current.sensitive || (current.visibility && current.visibility !== "public") || seen.has(current.id)) return false; seen.add(current.id); if (!current.parentId) return true; current = list(catalog?.entities).find((item) => item.id === current.parentId); if (!current) return false; } return true; };
    const entities = () => list(catalog?.entities).filter(visible);
    const resolve = (id) => list(catalog?.entities).find((item) => item.id === id) || null;
    const displayName = (entity) => language === "en" && entity?.translations?.en?.verified === true ? entity.translations.en.name : entity?.displayTitle || entity?.name || entity?.id || t("unknown");
    const confidence = (value) => t(value && WORDS.ko[value] ? value : "unknown");
    const taxonomy = (value) => { const labels = { campus: ["캠퍼스", "Campus"], building: ["건물", "Building"], floor: ["층", "Floor"], space: ["공간", "Space"], "facility-group": ["시설군", "Facility group"], "external-facility": ["외부 시설", "Outdoor facility"], door: ["출입구", "Entrance"], connection: ["연결 공간", "Connection"], lecture: ["강의", "Teaching"], office: ["행정·연구", "Office / research"], lab: ["실습", "Laboratory"], library: ["도서관", "Library"], cafe: ["카페·편의", "Cafe / convenience"], dining: ["식당", "Dining"], hall: ["강당", "Hall"], support: ["지원 공간", "Support"], service: ["서비스 공간", "Service"], lounge: ["휴게", "Lounge"], restroom: ["화장실", "Restroom"], corridor: ["통로", "Corridor"], entry: ["출입부", "Entry"], residential: ["생활관", "Residence"], boundary: ["부지 안내 경계", "Guide boundary"], buildings: ["건물", "Buildings"], roads: ["차량 도로", "Roads"], paths: ["보행로", "Paths"], parking: ["주차", "Parking"], sports: ["체육", "Sports"], greenery: ["녹지", "Green areas"], trees: ["수목", "Trees"], water: ["수변 공간", "Water"], entrances: ["진입·출입구", "Entrances"], context: ["주변 공간", "Context"], labels: ["공간 이름", "Labels"], contours: ["등고선", "Contours"] }; return labels[value]?.[language === "en" ? 1 : 0] || value; };
    const ancestors = (entity) => { const result = []; const seen = new Set(); let current = entity; while (current && !seen.has(current.id)) { seen.add(current.id); result.unshift(current); current = resolve(current.parentId); } return result; };
    const pathName = (entity) => ancestors(entity).map(displayName).join(" › ");
    const asyncTask = (promise) => { const task = Promise.resolve(promise); pending.add(task); task.then(() => pending.delete(task), () => pending.delete(task)); return task; };

    function errorText(error) { return error instanceof Error ? error.message.slice(0, 400) : "요청을 완료하지 못했습니다."; }
    function savePersonal() {
      try {
        if (store?.save) { const result = store.save(personal); if (result?.ok === false) throw new Error(result.error || "브라우저 저장에 실패했습니다."); }
        else window.localStorage.setItem(storedKey, JSON.stringify(personal));
        output("storage").textContent = "이 브라우저에만 저장했습니다.";
      } catch (error) { output("storage").textContent = `저장할 수 없습니다. 현재 화면의 입력은 유지합니다. ${errorText(error)}`; }
    }
    function loadPersonal() {
      try {
        if (domain?.createLocalStore) store = domain.createLocalStore(window.localStorage, storedKey);
        const raw = store?.load ? store.load() : JSON.parse(window.localStorage.getItem(storedKey) || "null");
        if (raw?.ok === false) throw new Error(raw.error || "브라우저 저장을 읽을 수 없습니다.");
        const saved = raw?.value || raw;
        if ((saved?.schemaVersion ?? saved?.version) === 1) personal = { version: 1, favorites: list(saved.favorites).filter((id) => typeof id === "string").slice(0, 100), recent: list(saved.recent).filter((id) => typeof id === "string").slice(0, 20), timetable: validateSchedule({ version: 1, entries: list(saved.timetable) }, true) };
      } catch (error) { output("storage").textContent = `저장된 정보를 읽을 수 없습니다. ${errorText(error)}`; }
    }
    function fillSelect(select, values, includeAll = false) {
      const previous = select.value;
      select.replaceChildren();
      if (includeAll) select.append(node("option", t("all"), { value: "" }));
      values.forEach((value) => select.append(node("option", value.label, { value: value.value })));
      if (Array.from(select.options).some((option) => option.value === previous)) select.value = previous;
      select.disabled = !values.length;
    }
    function populate() {
      fillSelect(q("campus"), list(catalog?.campuses).map((campus) => ({ value: campus.id, label: campus.name || campus.id })));
      if (!q("campus").value && catalog?.activeCampusId) q("campus").value = catalog.activeCampusId;
      const current = entities();
      fillSelect(q("purpose"), [...new Set(current.map((entity) => entity.category).filter(Boolean))].sort().map((value) => ({ value, label: taxonomy(value) })), true);
      fillSelect(q("building"), current.filter((entity) => entity.kind === "building" && entity.status !== "historic").map((entity) => ({ value: entity.id, label: displayName(entity) })), true);
      populateFloors();
      const choices = current.filter((entity) => entity.status !== "historic").map((entity) => ({ value: entity.id, label: pathName(entity) }));
      ["from", "to", "schedule-space", "report-space"].forEach((field) => fillSelect(q(field), choices));
      fillSelect(q("tour"), list(catalog?.tours).filter((tour) => !tour.campusId || tour.campusId === q("campus").value).map((tour) => ({ value: tour.id, label: tour.name || tour.title || tour.id })));
      command("tour-start").disabled = !q("tour").options.length;
      output("catalog").textContent = `공개 자료 ${catalog?.contentVersion || catalog?.datasetVersion || t("unknown")} · 모델 자산 ${catalog?.assetsVersion || t("unknown")}`;
      renderSearch(); renderPersonal(); renderOperations(); renderLayers(); renderHistory(); renderSelected();
    }
    function populateFloors() {
      fillSelect(q("floor"), entities().filter((entity) => entity.kind === "floor" && (!q("building").value || entity.owningBuildingId === q("building").value || entity.parentId === q("building").value)).map((entity) => ({ value: entity.id, label: pathName(entity) })), true);
    }
    function matches(query, purpose) {
      let matches = entities();
      if (domain?.search && q("history").value === "current") {
        const result = domain.search(catalog, query, { campusId: q("campus").value, purpose: purpose || undefined, language, status: q("history").value });
        matches = Array.isArray(result) ? result.map((item) => item.entity || item).filter(visible) : list(result?.items || result?.results).map((item) => item.entity || item).filter(visible);
      } else {
        const words = query.normalize("NFKC").trim().toLocaleLowerCase("ko").split(/\s+/).filter(Boolean);
        matches = matches.filter((entity) => { const text = [entity.name, entity.displayTitle, entity.number, entity.purpose, entity.category, entity.floorLabel, entity.roomCode, ...list(entity.aliases), entity.translations?.[language]?.verified ? entity.translations[language].name : ""].join(" ").normalize("NFKC").toLocaleLowerCase("ko"); return words.every((word) => text.includes(word)); });
      }
      if (purpose) matches = matches.filter((entity) => list(entity.purpose).includes(purpose) || entity.purpose === purpose || entity.category === purpose);
      const term = query.normalize("NFKC").trim().toLocaleLowerCase("ko");
      const exact = (entity) => term && [entity.name, entity.displayTitle, ...list(entity.aliases)].some((value) => String(value || "").normalize("NFKC").toLocaleLowerCase("ko") === term) ? 1 : 0;
      return matches.filter((entity) => (entity.status || "current") === q("history").value).sort((a, b) => exact(b) - exact(a) || (!term ? Number(b.kind === "building") - Number(a.kind === "building") : 0));
    }
    function spaceButton(entity) {
      const button = node("button", pathName(entity), { type: "button", "data-space-id": entity.id, "aria-pressed": String(entity.id === selectedId) });
      return button;
    }
    function renderSearch() {
      let results = matches(q("query").value, q("purpose").value);
      const building = q("building").value, floor = q("floor").value;
      if (building) results = results.filter((entity) => entity.id === building || entity.owningBuildingId === building || ancestors(entity).some((part) => part.id === building));
      if (floor) results = results.filter((entity) => entity.id === floor || ancestors(entity).some((part) => part.id === floor));
      const target = output("search-results"); target.replaceChildren();
      results.slice(0, 150).forEach((entity) => { const item = node("li"); item.append(spaceButton(entity), node("small", `${taxonomy(entity.kind)} · ${confidence(entity.confidence)}`)); target.append(item); });
      output("search-count").textContent = results.length ? `${results.length}개 공간${results.length > 150 ? " · 앞 150개 표시, 검색어를 구체화해 주세요." : ""}` : "검색 결과가 없습니다. 이름·목적·층 조건을 확인해 주세요.";
      const highlightKey = `${catalog?.contentVersion}:${results.map((entity) => entity.id).join("|")}`;
      if (highlightKey !== searchHighlightKey) { searchHighlightKey = highlightKey; action("search-highlight", { entityIds: results.map((entity) => entity.id) }); }
    }
    function sourceLine(entity) {
      const sourceIds = new Set([entity.sourceId, ...Object.values(entity.claims || {}).flatMap((claim) => [claim?.sourceId, ...list(claim?.sourceIds)])].filter(Boolean));
      const paragraph = node("p", `${confidence(entity.confidence)} · ${entity.status === "proposed" ? "계획 자료" : entity.status === "historic" ? "과거 자료" : "현재 표시 자료"}`);
      sourceIds.forEach((id) => { const source = list(catalog.sources).find((item) => item.id === id); if (!source || (source.visibility && source.visibility !== "public")) return; const link = https(source.url); const date = source.date || source.dates?.referenceDate || source.dates?.reviewedAt || "기준일 미확인"; paragraph.append(document.createTextNode(" · "), link ? node("a", `${source.title || id} (${date})`, { href: link, target: "_blank", rel: "noopener noreferrer" }) : node("span", `${source.title || id} (${date})`)); });
      return paragraph;
    }
    function operation(entity) {
      if (!domain?.operationStatus) return { status: "unknown", label: "운영 정보 미확인", records: [] };
      try { return domain.operationStatus(catalog, entity.id); } catch { return { status: "unknown", label: "운영 정보 미확인", records: [] }; }
    }
    function detail(entity, target, interactive = true) {
      target.replaceChildren();
      if (!entity || !visible(entity)) { target.hidden = true; return; }
      target.hidden = false;
      target.append(node("h3", pathName(entity)), sourceLine(entity));
      if (language === "en" && entity.translations?.en?.verified !== true) target.append(node("p", "Verified English name is unavailable; the registered Korean name is retained."));
      const op = operation(entity);
      target.append(node("p", `운영: ${op.label || op.status || "미확인"}${op.expiresAt ? ` · 유효기한 ${op.expiresAt}` : ""}`));
      ancestors(entity).slice(0, -1).forEach((parent) => { const parentOperation = operation(parent); if (parentOperation.status === "closed") target.append(node("p", `상위 공간 제한: ${displayName(parent)} · ${parentOperation.label}. 공간별 설명과 별개로 출입·연결이 제한될 수 있습니다.`)); });
      const claimRows = Object.entries(entity.claims || {}).map(([key, value]) => `${({ name: "명칭", location: "위치", outline: "외곽", height: "높이", operation: "운영" })[key] || key}: ${confidence(value?.confidence || value?.status || "unknown")}${value?.dates?.referenceDate || value?.date ? ` (${value?.dates?.referenceDate || value.date})` : ""}`);
      if (claimRows.length) target.append(node("p", claimRows.join(" · ")));
      if (entity.kind === "floor" || entity.kind === "space" || entity.kind === "room") target.append(node("p", "층·공간의 존재 정보와 평면상의 실제 위치는 별도로 확인해야 합니다. 개념 평면은 현장 안내 경로가 아닙니다."));
      const related = entities().filter((item) => item.parentId === entity.id || (item.kind === "door" && item.owningBuildingId === (entity.owningBuildingId || entity.id)));
      const children = node("ul", null, { class: "platform-list" }); related.forEach((item) => { const row = node("li"); row.append(spaceButton(item), node("small", `${confidence(item.confidence)} · ${item.description || item.note || "출입 상태는 확인이 필요합니다."}`)); children.append(row); });
      if (related.length) target.append(children);
      const model = modelStates[entity.legacyKey || entity.legacyId || entity.id] || modelStates[entity.owningBuildingId];
      if (model) { const status = typeof model === "string" ? model : model.status || "상태 미확인"; target.append(node("p", `외관 모델: ${status}`)); if (status === "error" && interactive) target.append(node("button", "외관 모델 다시 불러오기", { type: "button", "data-model-retry": entity.owningBuildingId || entity.id })); }
      if (interactive) {
        const row = node("div", null, { class: "platform-row" });
        row.append(node("button", personal.favorites.includes(entity.id) ? "즐겨찾기 해제" : t("favorite"), { type: "button", "data-favorite-id": entity.id }), node("button", "도착지로 지정", { type: "button", "data-destination-id": entity.id }));
        target.append(row);
        if (entity.owningBuildingId || entity.kind === "building") target.append(node("button", "건물 내부 개념 상세", { type: "button", "data-interior-id": entity.owningBuildingId || entity.id }));
      }
    }
    function renderSelected() { const entity = resolve(selectedId); detail(entity, output("selected")); if (!overlay.hidden) detail(entity, overlay.querySelector("[data-map-selected]")); refinement?.update({ selectedId }); }
    function select(id, focus = true) {
      const entity = resolve(id);
      if (!entity || !visible(entity)) { announce("이 공간은 현재 공개 자료에서 찾을 수 없습니다."); return; }
      selectedId = id; personal.recent = [id, ...personal.recent.filter((value) => value !== id)].slice(0, 20); savePersonal();
      ["to", "report-space", "schedule-space"].forEach((field) => { if (Array.from(q(field).options).some((option) => option.value === id)) q(field).value = id; });
      renderSelected(); renderPersonal(); renderSearch();
      if (!overlay.hidden) renderSvg(overlay.dataset.mode);
      if (focus) action("select", { id });
      announce(`${displayName(entity)} · ${confidence(entity.confidence)}`);
    }
    function validateSchedule(value, allowMissingSpace = false) {
      if (!value || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 100) throw new Error("시간표 JSON은 {version:1,entries:[...]} 형식이며 최대 100개입니다.");
      return value.entries.map((entry, index) => {
        if (!entry || typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 80 || typeof entry.entityId !== "string" || !Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.end) || entry.end <= entry.start) throw new Error(`${index + 1}번째 일정의 이름·공간·요일·시작/종료 시각을 확인해 주세요.`);
        const entity = resolve(entry.entityId); if (!allowMissingSpace && (!entity || (entity.visibility && entity.visibility !== "public"))) throw new Error(`${index + 1}번째 일정의 공간이 현재 공개 자료에 없습니다.`);
        return { id: typeof entry.id === "string" ? entry.id.slice(0, 100) : `schedule-${Date.now()}-${index}`, title: entry.title.trim(), entityId: entry.entityId, day: entry.day, start: entry.start, end: entry.end };
      });
    }
    function renderPersonal() {
      ["favorites", "recent"].forEach((kind) => { const target = output(kind); target.replaceChildren(); personal[kind].forEach((id) => { const entity = resolve(id); const item = node("li"); item.append(entity && visible(entity) ? spaceButton(entity) : node("span", `공간 미확인: ${id}`)); if (kind === "favorites") item.append(node("button", t("remove"), { type: "button", "data-favorite-id": id })); target.append(item); }); if (!personal[kind].length) target.append(node("li", t("empty"))); });
      const target = output("timetable"); target.replaceChildren();
      personal.timetable.forEach((entry) => { const item = node("li"); item.append(node("span", `${["일", "월", "화", "수", "목", "금", "토"][entry.day]} ${entry.start}~${entry.end} · ${entry.title}`)); const entity = resolve(entry.entityId); item.append(entity && visible(entity) ? spaceButton(entity) : node("span", "현재 자료에서 공간을 확인할 수 없습니다."), node("button", t("remove"), { type: "button", "data-schedule-remove": entry.id })); target.append(item); });
      if (!personal.timetable.length) target.append(node("li", "직접 등록한 일정이 없습니다."));
    }
    function download(value, fileName, type = "application/json") { const url = URL.createObjectURL(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type })); const link = node("a", null, { href: url, download: fileName }); document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    function renderOperations() {
      const opTarget = output("operations"); opTarget.replaceChildren();
      entities().forEach((entity) => { const op = operation(entity); if (op.status === "unknown" && !list(op.records).length) return; const item = node("li"); item.append(spaceButton(entity), node("span", ` · ${op.label || op.status}${op.expiresAt ? ` · ${op.expiresAt}까지` : ""}`)); opTarget.append(item); });
      if (!opTarget.children.length) opTarget.append(node("li", "유효한 운영 자료가 등록되지 않았습니다. 이용·출입 가능 여부는 미확인입니다."));
      const eventTarget = output("events"); eventTarget.replaceChildren();
      list(catalog?.events).filter((event) => (!event.campusId || event.campusId === q("campus").value) && (!event.entityId || visible(resolve(event.entityId))) && (!event.visibility || event.visibility === "public")).forEach((event) => { const start = event.validFrom || event.startsAt || event.startAt, until = event.validUntil || event.endsAt || event.endAt; const item = node("li", `${event.title || event.name || event.id} · ${start || "시작 미확인"} ~ ${until || "종료 미확인"}`); const end = Date.parse(until || ""); item.append(node("small", Number.isFinite(end) && end < Date.now() ? "기간이 종료된 안내" : "행사 운영·방문 가능 여부는 자료의 확인 수준을 따릅니다.")); const space = resolve(event.spaceId || event.entityId); if (space && visible(space)) item.append(spaceButton(space)); const source = list(catalog.sources).find((item) => list(event.sourceIds).includes(item.id)); const url = https(event.url || source?.url); if (url) item.append(node("a", "등록된 행사 출처", { href: url, target: "_blank", rel: "noopener noreferrer" })); eventTarget.append(item); });
      if (!eventTarget.children.length) eventTarget.append(node("li", "공개 행사 자료가 등록되지 않았습니다."));
      const services = output("services"); services.replaceChildren();
      list(catalog?.services).filter((service) => (!service.campusId || service.campusId === q("campus").value) && (!service.entityId || visible(resolve(service.entityId))) && (!service.visibility || service.visibility === "public")).forEach((service) => { const item = node("li", service.name || service.title || service.id); const source = list(catalog.sources).find((item) => list(service.sourceIds).includes(item.id)); const url = https(service.url || service.officialUrl || source?.url); if (url) item.append(node("a", "등록된 서비스 안내로 이동", { href: url, target: "_blank", rel: "noopener noreferrer" })); else item.append(node("small", "연결 주소 미확인")); item.append(node("small", "외부 안내 연결 · 예약·학교 계정 연동 미연결")); services.append(item); });
      if (!services.children.length) services.append(node("li", "등록된 공식 서비스 연결이 없습니다."));
    }
    function renderLayers() {
      const target = output("layers"); target.replaceChildren();
      list(catalog?.layers).forEach((layer) => { const label = node("label", null, { class: "platform-check" }); const input = node("input", null, { type: "checkbox", "data-platform-layer": layer.id }); input.checked = layer.defaultVisible === true; input.disabled = layer.available === false || layer.status === "unavailable"; label.append(input, document.createTextNode(taxonomy(layer.name || layer.title || layer.id))); target.append(label, node("p", layer.note || `${confidence(layer.confidence || layer.status)}${input.disabled ? " · 원자료 미확보" : ""}`, { class: "platform-note" })); });
      if (!target.children.length) target.append(node("p", "추가 레이어 자료가 없습니다."));
    }
    function renderHistory() { const status = q("history").value; const found = entities().filter((entity) => (entity.status || "current") === status); output("history").textContent = `${t(status)} ${found.length}개 · ${status === "proposed" ? "승인된 현재 시설이 아닙니다." : status === "historic" ? "과거 기록이며 현재 시설·통행 상태와 다릅니다." : "현재 표시 자료에도 추정·미확인 항목이 포함됩니다."}`; }
    function points(value) { const raw = Array.isArray(value) ? value : value?.pointsMeters || value?.coordinates || value?.geometry?.coordinates || []; const result = []; function visit(part) { if (!Array.isArray(part)) return; if (part.length >= 2 && Number.isFinite(part[0]) && Number.isFinite(part[1])) result.push([part[0], part[1]]); else part.forEach(visit); } visit(raw); return result; }
    function localPoint(point, geometry) { if (geometry?.coordinateSystem !== "WGS84") return point; const campus = list(catalog?.campuses).find((item) => item.id === geometry.originId); if (!campus?.origin) return point; const radians = campus.origin.lat * Math.PI / 180; const weight = Math.sqrt(1 - 6.6943799901413165e-3 * Math.sin(radians) ** 2); const east = 6378137 / weight * Math.cos(radians), north = 6378137 * (1 - 6.6943799901413165e-3) / weight ** 3; return [(point[0] - campus.origin.lon) * Math.PI / 180 * east, (point[1] - campus.origin.lat) * Math.PI / 180 * north]; }
    function outerRings(shape) { const local = (ring) => points(ring).map((point) => localPoint(point, shape)); if (shape?.type === "MultiPolygon") return list(shape.coordinates).map((polygon) => local(polygon[0])).filter((ring) => ring.length >= 3); if (shape?.type === "Polygon") return [local(shape.coordinates?.[0])]; const ring = local(shape); return ring.length >= 3 ? [ring] : []; }
    function entityPosition(entity) { const position = entity.position; if (position && Number.isFinite(position.east) && Number.isFinite(position.north)) return [position.east, position.north]; const shape = points(entity.geometry).map((point) => localPoint(point, entity.geometry)); return shape.length ? [shape.reduce((sum, point) => sum + point[0], 0) / shape.length, shape.reduce((sum, point) => sum + point[1], 0) / shape.length] : null; }
    function showMap(mode, dispatch = true) {
      if (overlay.hidden) { previousFocus = document.activeElement; inertState = Array.from(document.body.children).filter((element) => element !== overlay).map((element) => ({ element, inert: element.inert })); inertState.forEach(({ element }) => { element.inert = true; }); }
      overlay.hidden = false; overlay.dataset.mode = mode; overlay.querySelector("[data-map-title]").textContent = mode === "2d" ? "2D 캠퍼스 안내" : "문자 캠퍼스 안내"; overlay.querySelector("[data-map-close]").textContent = t("back");
      overlay.querySelector("[data-map-note]").textContent = "전체 안내 부지와 공개 공간 목록입니다. 이름 연결선은 위치 표기이며 이동 경로가 아닙니다. 안내 경계·개념 평면은 법적 경계·실측 경로가 아닙니다.";
      const target = overlay.querySelector("[data-map-list]"); target.replaceChildren(); entities().filter((entity) => (entity.status || "current") === q("history").value).forEach((entity) => { const item = node("li"); item.append(spaceButton(entity), sourceLine(entity)); target.append(item); });
      renderSvg(mode); renderSelected(); if (dispatch) action("view", { view: mode }); overlay.querySelector("[data-map-close]").focus();
    }
    function renderSvg(mode) {
      const target = overlay.querySelector("[data-map-svg]"); target.replaceChildren(); target.hidden = mode !== "2d";
      if (mode !== "2d") return;
      const campus = list(catalog?.campuses).find((item) => item.id === q("campus").value); const boundaryRings = outerRings(campus?.boundaries?.guide); const boundary = boundaryRings.flat();
      const positioned = entities().filter((entity) => (entity.kind === "building" || entity.kind === "door") && (entity.status || "current") === q("history").value).map((entity) => ({ entity, point: entityPosition(entity) })).filter((item) => item.point);
      const allPoints = [...boundary, ...positioned.map((item) => item.point)];
      if (!allPoints.length) { target.append(node("p", "이 자료에는 검증 가능한 표시 좌표가 없습니다. 문자 목록을 이용해 주세요.")); return; }
      const minX = Math.min(...allPoints.map((point) => point[0])), maxX = Math.max(...allPoints.map((point) => point[0])), minY = Math.min(...allPoints.map((point) => point[1])), maxY = Math.max(...allPoints.map((point) => point[1]));
      const spanX = maxX - minX, spanY = maxY - minY, scale = Math.min(760 / Math.max(1, spanX), 560 / Math.max(1, spanY));
      const offsetX = (800 - spanX * scale) / 2, offsetY = (600 - spanY * scale) / 2;
      const project = (point) => [offsetX + (point[0] - minX) * scale, offsetY + (maxY - point[1]) * scale];
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 800 600"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "전체 캠퍼스 안내 영역과 건물 위치. 아래 목록에서 같은 공간을 선택할 수 있습니다.");
      const guide = campus?.boundaries?.guide; const polygons = guide?.type === "MultiPolygon" ? list(guide.coordinates) : guide?.type === "Polygon" ? [guide.coordinates] : boundaryRings.map((ring) => [ring]);
      polygons.forEach((rings) => { const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", list(rings).map((ring) => points(ring).map((point, index) => `${index ? "L" : "M"}${project(localPoint(point, guide)).join(",")}`).join(" ") + " Z").join(" ")); path.setAttribute("fill-rule", "evenodd"); path.setAttribute("class", "platform-guide-boundary"); svg.append(path); });
      const svgNode = (tag, attrs = {}, text) => { const result = document.createElementNS(svg.namespaceURI, tag); Object.entries(attrs).forEach(([name, value]) => result.setAttribute(name, String(value))); if (text) result.textContent = text; return result; };
      const fontSize = window.innerWidth <= 550 ? 26 : 14, labelHeight = fontSize + 6;
      const labelBoxes = [{ x: 748, y: 0, width: 52, height: 30 }];
      const labelTarget = svgNode("g", { class: "platform-map-labels" });
      positioned.forEach(({ entity, point }) => {
        const projected = project(point), selected = entity.id === selectedId;
        const group = svgNode("g", { "data-map-marker": entity.id });
        group.append(svgNode("title", {}, pathName(entity)), svgNode("circle", { cx: projected[0], cy: projected[1], r: entity.kind === "building" ? 8 : 5, class: selected ? "platform-map-point selected" : "platform-map-point" })); svg.append(group);
        if (entity.kind !== "building" && entity.owningBuildingId && !selected) return;
        const fullName = displayName(entity), name = fullName.length > 28 ? `${fullName.slice(0, 27)}…` : fullName;
        const width = Math.min(740, [...name].reduce((sum, character) => sum + (/^[\x20-\x7e]$/.test(character) ? fontSize * .58 : fontSize), 0) + 8);
        let box = null;
        for (let row = 0; row < 20 && !box; row++) {
          const distance = 14 + Math.floor(row / 2) * (labelHeight + 4), y = projected[1] + (row % 2 ? distance : -distance - labelHeight);
          for (const xCandidate of [projected[0] + 12, projected[0] - width - 12]) {
            const candidate = { x: Math.max(8, Math.min(792 - width, xCandidate)), y, width, height: labelHeight };
            if (y < 8 || y + labelHeight > 590) continue;
            if (!labelBoxes.some((other) => candidate.x < other.x + other.width + 4 && candidate.x + width + 4 > other.x && candidate.y < other.y + other.height + 3 && candidate.y + labelHeight + 3 > other.y)) { box = candidate; break; }
          }
        }
        if (!box) return;
        labelBoxes.push(box);
        const label = svgNode("g", { "data-map-label": entity.id });
        const nameText = svgNode("text", { x: box.x + 4, y: box.y + fontSize + 1 }, name); nameText.style.fontSize = `${fontSize}px`;
        label.append(svgNode("line", { x1: projected[0], y1: projected[1], x2: Math.max(box.x, Math.min(box.x + width, projected[0])), y2: box.y + labelHeight / 2, class: "platform-label-leader" }), svgNode("rect", { x: box.x, y: box.y, width, height: box.height, rx: 3, class: "platform-label-background" }), nameText, svgNode("title", {}, fullName)); labelTarget.append(label);
      });
      svg.append(labelTarget);
      if (temporaryLocation?.inside === true && temporaryLocation.campusId === campus?.id) {
        const point = project([temporaryLocation.east, temporaryLocation.north]);
        const accuracy = Number.isFinite(temporaryLocation.accuracyMeters) && temporaryLocation.accuracyMeters >= 0 ? temporaryLocation.accuracyMeters : null;
        const marker = svgNode("g", { class: "platform-temporary-location" });
        const timestamp = temporaryLocation.timestamp ? new Date(temporaryLocation.timestamp) : null, measuredAt = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleString("ko-KR") : "측정 시각 미제공";
        marker.append(svgNode("title", {}, `이 기기의 일시 위치 · 정확도 ${accuracy === null ? "미제공" : `약 ${Math.round(accuracy)}m`} · ${measuredAt}. 실제 통행 경로를 의미하지 않습니다.`));
        if (accuracy !== null) marker.append(svgNode("circle", { cx: point[0], cy: point[1], r: Math.max(2, accuracy * scale), class: "platform-location-accuracy" }));
        marker.append(svgNode("circle", { cx: point[0], cy: point[1], r: 6, class: "platform-location-point" })); svg.append(marker);
      }
      const north = document.createElementNS(svg.namespaceURI, "text"); north.setAttribute("x", String(fontSize > 14 ? 742 : 770)); north.setAttribute("y", String(fontSize + 7)); north.style.fontSize = `${fontSize}px`; north.textContent = "↑ N"; svg.append(north); target.append(svg);
    }
    function closeMap(dispatch = true) { if (overlay.hidden) return; overlay.hidden = true; inertState.forEach(({ element, inert }) => { element.inert = inert; }); inertState = []; if (dispatch) action("view", { view: "overview" }); if (previousFocus?.isConnected) previousFocus.focus(); }
    function stops(tour) { return list(tour?.stops).map((stop) => typeof stop === "string" ? { entityId: stop } : stop).filter((stop) => resolve(stop.entityId || stop.spaceId || stop.id)); }
    function showTour() {
      if (!tourState) return;
      const stop = tourState.stops[tourState.index], entity = resolve(stop.entityId || stop.spaceId || stop.id);
      select(entity.id, false); action("tour-focus", { id: entity.id });
      output("tour").textContent = `${tourState.index + 1}/${tourState.stops.length} · ${displayName(entity)} · ${stop.description || stop.note || entity.description || "등록된 공간의 위치와 확인 수준을 살펴보세요."}`;
      command("tour-prev").disabled = tourState.index === 0; command("tour-next").disabled = tourState.index === tourState.stops.length - 1; command("tour-stop").disabled = false;
    }
    function stopTour() { if (!tourState) return; const snapshot = tourState.snapshot; tourState = null; action("tour-restore", { snapshot: snapshot.camera || snapshot }); if (snapshot.selectedId && resolve(snapshot.selectedId)) selectedId = snapshot.selectedId; else selectedId = null; renderSelected(); ["tour-prev", "tour-next", "tour-stop"].forEach((name) => { command(name).disabled = true; }); output("tour").textContent = "투어를 종료하고 이전 시점으로 돌아왔습니다."; }
    async function computeRoute() {
      output("route-steps").replaceChildren();
      if (!domain?.route) { output("route").textContent = "경로 계산 기능을 불러오지 못했습니다."; return; }
      try {
        const result = domain.route(catalog, { fromId: q("from").value, toId: q("to").value, accessible: q("accessible").checked });
        output("route").textContent = result.status === "found" ? `${result.verified ? "검증된 연결" : "자료 기반 경로"}${Number.isFinite(result.distanceMeters) ? ` · 약 ${Math.round(result.distanceMeters)}m` : ""}. ${result.reason || "예상 이동 시간은 제공하지 않습니다."}` : result.reason || "현장 확인한 연결이 부족하여 경로를 제공할 수 없습니다.";
        list(result.steps).forEach((step) => output("route-steps").append(node("li", typeof step === "string" ? step : step.instruction || step.text || step.label || "연결 단계")));
        action("route", { result });
      } catch (error) { output("route").textContent = errorText(error); }
    }
    async function share() {
      try {
        if (!domain?.serializeState) throw new Error("공유 상태 변환기를 불러오지 못했습니다.");
        const current = getState() || {};
        const state = { version: 1, campusId: q("campus").value, entityId: selectedId, view: overlay.hidden ? current.view || "overview" : overlay.dataset.mode, layers: Array.isArray(current.layers) ? current.layers : Object.entries(current.layers || {}).filter(([, enabled]) => enabled).map(([id]) => id), floorId: current.floorId || null, time: null, contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, ...(current.releaseId ? { releaseId: current.releaseId } : {}) };
        const value = domain.serializeState(state); const url = new URL(window.location.href); url.hash = String(value).replace(/^[#?]/, "");
        if (catalog?.contentVersion) url.searchParams.set("contentVersion", catalog.contentVersion);
        if (catalog?.assetsVersion) url.searchParams.set("assetsVersion", catalog.assetsVersion);
        if (current.releaseId) url.searchParams.set("release", current.releaseId);
        q("share-url").value = url.href; output("qr").hidden = true; output("share").textContent = `선택·보기 상태와 자료판 ${catalog?.contentVersion || "미확인"}을 담았습니다. 현재 위치와 개인 시간표는 포함하지 않습니다.`;
      } catch (error) { output("share").textContent = errorText(error); }
    }
    async function generateQr() {
      if (!q("share-url").value) await share();
      if (!q("share-url").value) return;
      try { if (!window.CampusQr?.toDataURL) throw new Error("QR 생성기를 사용할 수 없습니다. 공유 주소 복사를 이용해 주세요."); const value = await window.CampusQr.toDataURL(q("share-url").value); if (!/^data:image\/(png|gif|svg\+xml);/.test(value)) throw new Error("QR 이미지 응답을 확인할 수 없습니다."); output("qr").src = value; output("qr").hidden = false; output("share").textContent = "유효한 공유 주소로 QR을 생성했습니다."; } catch (error) { output("share").textContent = errorText(error); }
    }
    async function readJson(file) { if (!file || file.size > MAX_IMPORT_BYTES) throw new Error("JSON 파일은 2MB 이하로 선택해 주세요."); return JSON.parse(await file.text()); }
    async function importCatalog(file) {
      importedCatalog = null; command("catalog-apply").disabled = true; output("diff").replaceChildren();
      try {
        if (!domain?.validateCatalog) throw new Error("자료 검증기를 불러오지 못했습니다.");
        const value = await readJson(file); const result = domain.validateImport ? domain.validateImport(value, catalog) : domain.validateCatalog(value); if (result === false || result?.valid === false || result?.ok === false) throw new Error(list(result?.errors).map((item) => typeof item === "string" ? item : item.message).join(" · ") || "자료 검증에 실패했습니다.");
        const normalized = result.catalog || value; const publicValue = domain.publicCatalog ? domain.publicCatalog(normalized) : normalized;
        if (list(publicValue.entities).some((entity) => entity.visibility && entity.visibility !== "public")) throw new Error("공개 표시용 자료만 가져올 수 있습니다.");
        importedCatalog = publicValue;
        const diff = domain.diffCatalog ? domain.diffCatalog(catalog, publicValue) : null;
        if (diff) Object.entries(diff).forEach(([key, items]) => { if (Array.isArray(items)) items.slice(0, 30).forEach((item) => output("diff").append(node("li", `${key}: ${typeof item === "string" ? item : item.id || item.entityId || item.name || "공간 변경"}`))); });
        output("import").textContent = `검증한 공개 자료: ${publicValue.contentVersion || publicValue.datasetVersion} · ${list(publicValue.entities).length}개 공간. 전환하기 전 변경 목록을 확인해 주세요.`; command("catalog-apply").disabled = false;
      } catch (error) { output("import").textContent = `가져오지 못했습니다. ${errorText(error)}`; }
    }
    function apiBase() { const base = new URL(options.apiBase || "/api/v1", window.location.href); if (base.origin !== window.location.origin || !/^https?:$/.test(base.protocol)) throw new Error("API는 같은 출처의 HTTP 실행에서 사용할 수 있습니다."); return base.href.replace(/\/$/, ""); }
    async function request(path, method = "GET", body, extraHeaders = {}) {
      const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 12000);
      try { const response = await window.fetch(`${apiBase()}${path}`, { method, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", ...extraHeaders, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error?.message || `요청 실패 (${response.status})`); return payload.data; }
      catch (error) { throw new Error(error?.name === "AbortError" ? "서버 응답 시간이 초과되었습니다. 입력은 유지됩니다." : `서버 연결 또는 요청을 완료하지 못했습니다. ${errorText(error)}`, { cause: error }); }
      finally { window.clearTimeout(timeout); }
    }
    async function loadPhoto(file) {
      const generation = ++photoGeneration;
      photo = null; output("photo").hidden = true; q("photo-consent").checked = false;
      output("photo").removeAttribute("src");
      if (!file) { photoBusy = false; root.querySelector("[data-form=report] button[type=submit]").disabled = apiBusy; return; }
      photoBusy = true; root.querySelector("[data-form=report] button[type=submit]").disabled = true; output("report").textContent = "사진을 확인하고 위치 메타데이터를 제거합니다…";
      try {
        if (file.size > MAX_IMPORT_BYTES || !["image/png", "image/jpeg"].includes(file.type)) throw new Error("PNG/JPEG 사진을 2MB 이하로 선택해 주세요.");
        const url = URL.createObjectURL(file);
        try {
          const image = new window.Image(); await new Promise((resolveImage, reject) => { image.onload = resolveImage; image.onerror = () => reject(new Error("사진의 실제 이미지 형식을 확인할 수 없습니다.")); image.src = url; });
          if (generation !== photoGeneration || destroyed) return;
          if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24000000) throw new Error("사진 픽셀 크기가 너무 크거나 유효하지 않습니다.");
          const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio); const context = canvas.getContext("2d"); if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다."); context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg"; const dataUrl = canvas.toDataURL(mimeType, 0.85); const dataBase64 = dataUrl.split(",")[1]; if (!dataBase64 || Math.ceil(dataBase64.length * 3 / 4) > MAX_IMPORT_BYTES) throw new Error("변환한 사진도 2MB를 초과합니다. 더 작은 사진을 선택해 주세요."); photo = { mimeType, dataBase64 }; output("photo").src = dataUrl; output("photo").hidden = false; output("report").textContent = "원본 위치 메타데이터를 제거했습니다. 사진 제출 동의를 확인해 주세요.";
        } finally { URL.revokeObjectURL(url); }
      } catch (error) { if (generation === photoGeneration && !destroyed) { q("report-photo").value = ""; output("report").textContent = errorText(error); } }
      finally { if (generation === photoGeneration) { photoBusy = false; root.querySelector("[data-form=report] button[type=submit]").disabled = apiBusy; } }
    }
    async function submitReport() {
      if (apiBusy) return;
      if (photoBusy) { output("report").textContent = "사진 처리 중입니다. 완료 후 제출해 주세요."; return; }
      const description = q("report-description").value.trim(); if (description.length < 5 || description.length > 2000) { output("report").textContent = "설명은 5~2000자로 작성해 주세요."; return; }
      if (!resolve(q("report-space").value)) { output("report").textContent = "공개 공간을 선택해 주세요."; return; }
      if (photo && !q("photo-consent").checked) { output("report").textContent = "사진의 비공개 검토용 제출에 동의하거나 사진을 제거해 주세요."; return; }
      apiBusy = true; const button = root.querySelector("[data-form=report] button[type=submit]"); button.disabled = true; output("report").textContent = "제보를 제출합니다…";
      try { const body = { spaceId: q("report-space").value, type: q("report-type").value, description, ...(photo ? { photo, photoConsent: true } : {}) }; const fingerprint = JSON.stringify(body); if (fingerprint !== reportFingerprint || !reportKey) { reportFingerprint = fingerprint; reportKey = window.crypto?.randomUUID?.() || `report-${Date.now()}-${Math.random().toString(16).slice(2)}`; } const data = await request("/reports", "POST", { ...body, idempotencyKey: reportKey }); const report = data?.report || data; if (!report?.id) throw new Error("접수 번호가 없는 응답입니다. 담당자에게 접수 여부를 확인해 주세요."); q("receipt-id").value = report.id; q("receipt-token").value = data.receiptToken || report.receiptToken || ""; output("report").textContent = `접수번호 ${report.id} · ${report.status || "접수"}. 검토 전에는 지도에 공개되지 않습니다.${q("receipt-token").value ? " 아래 조회 정보를 필요한 경우 직접 복사해 보관해 주세요." : ""}`; q("report-description").value = ""; q("report-photo").value = ""; photo = null; reportKey = null; reportFingerprint = null; output("photo").hidden = true; output("photo").removeAttribute("src"); q("photo-consent").checked = false; }
      catch (error) { output("report").textContent = `${errorText(error)} 입력과 사진은 유지합니다.`; }
      finally { apiBusy = false; button.disabled = false; }
    }
    async function receipt() { const id = q("receipt-id").value.trim(), token = q("receipt-token").value.trim(); if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !token || token.length > 300) { output("receipt").textContent = "접수번호와 비공개 조회 토큰을 확인해 주세요."; return; } try { const data = await request(`/reports/${encodeURIComponent(id)}`, "GET", undefined, { "X-Report-Receipt": token }); output("receipt").textContent = `${({ received: "접수", reviewing: "검토 중", resolved: "처리 완료", rejected: "반려" })[data.status] || data.status} · ${data.updatedAt || data.createdAt || "시각 미확인"}${data.responseNote ? ` · ${data.responseNote}` : ""}`; } catch (error) { output("receipt").textContent = errorText(error); } }
    async function offline(name) {
      try { if (!window.CampusOffline) throw new Error("오프라인 저장 기능을 불러오지 못했습니다. 현재 공개 자료 JSON을 내보낼 수 있습니다."); output("offline").textContent = "오프라인 자료를 확인합니다…"; const status = name === "clear" ? await window.CampusOffline.clear() : name === "download" ? await window.CampusOffline.download({ details: true }) : await window.CampusOffline.status(); if (status.error) throw new Error(status.error); output("offline").textContent = !status.supported ? "이 실행 환경은 오프라인 저장을 지원하지 않습니다." : status.saved ? `저장 자료 ${status.version || "버전 미확인"} · ${Math.ceil((status.bytes || 0) / 1024)}KB · ${status.updatedAt || "저장 시각 미확인"}. 운영 정보는 저장 시점 기준입니다.` : "저장된 오프라인 자료가 없습니다."; } catch (error) { output("offline").textContent = errorText(error); }
    }
    function network() { output("network").textContent = window.navigator.onLine === false ? "브라우저가 오프라인 상태를 보고했습니다. 등록된 자료는 계속 탐색할 수 있습니다." : "브라우저 연결 신호: 온라인. 실제 서버·학교 시스템 연결 성공을 뜻하지 않습니다."; }
    async function location() {
      if (!window.navigator.geolocation) { output("location").textContent = "이 환경에서 위치 확인을 지원하지 않습니다. 출발 공간을 직접 선택해 주세요."; return; }
      output("location").textContent = "기기의 위치 권한과 정확도를 확인합니다…";
      window.navigator.geolocation.getCurrentPosition((position) => { if (destroyed) return; output("location").textContent = `위치 오차 약 ${Math.round(position.coords.accuracy)}m · ${new Date(position.timestamp).toLocaleString()}. 이 값으로 건물·층·호실을 확정하지 않습니다. 출발 공간을 직접 선택해 주세요.`; action("location", { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp }); }, () => { if (!destroyed) output("location").textContent = "위치를 확인하지 못했습니다. 권한·연결 상태를 확인하거나 출발 공간을 직접 선택해 주세요."; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 });
    }
    async function xr() { try { if (!window.navigator.xr?.isSessionSupported) throw new Error("이 브라우저에는 WebXR 지원 확인 기능이 없습니다. 3D·2D·문자 안내를 이용해 주세요."); const supported = await window.navigator.xr.isSessionSupported("immersive-vr"); output("xr").textContent = supported ? "기기가 VR 세션을 지원합니다. 공간 정확도는 일반 조감도와 같으며 XR 실행은 연결된 장면 기능을 따릅니다." : "현재 기기에서 immersive VR을 지원하지 않습니다."; if (supported) action("xr", { supported: true }); } catch (error) { output("xr").textContent = errorText(error); } }
    function setLanguage(value) { language = value === "en" ? "en" : "ko"; root.lang = language; q("language").value = language; root.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); }); populate(); if (!overlay.hidden) showMap(overlay.dataset.mode); action("language", { language }); }
    function handleSpaceClick(event) {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.spaceId) select(button.dataset.spaceId);
      if (button.dataset.favoriteId) { const id = button.dataset.favoriteId; personal.favorites = personal.favorites.includes(id) ? personal.favorites.filter((item) => item !== id) : [...personal.favorites, id].slice(-100); savePersonal(); renderPersonal(); renderSelected(); }
      if (button.dataset.destinationId) { q("to").value = button.dataset.destinationId; announce("선택한 공간을 도착지로 지정했습니다."); }
      if (button.dataset.interiorId) { if (!overlay.hidden) closeMap(); action("interior", { id: button.dataset.interiorId }); }
      if (button.dataset.modelRetry) action("model-retry", { id: button.dataset.modelRetry });
      if (button.dataset.scheduleRemove) { personal.timetable = personal.timetable.filter((entry) => entry.id !== button.dataset.scheduleRemove); savePersonal(); renderPersonal(); }
    }
    listen(root, "click", handleSpaceClick); listen(overlay, "click", handleSpaceClick);
    listen(overlay.querySelector("[data-map-close]"), "click", closeMap);
    listen(overlay, "keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closeMap(); } if (event.key === "Tab") { const focusable = Array.from(overlay.querySelectorAll("button,a,input,select,textarea,[tabindex='0']")).filter((element) => !element.disabled && !element.hidden); const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } });
    listen(root, "keydown", (event) => { const button = event.target.closest("button[data-space-id]"); if (!button || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return; const buttons = Array.from(button.closest("ul").querySelectorAll("button[data-space-id]")); const index = buttons.indexOf(button); const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length; event.preventDefault(); buttons[next]?.focus(); });
    listen(root.querySelector("[data-form=search]"), "submit", (event) => { event.preventDefault(); renderSearch(); });
    ["query", "purpose", "floor"].forEach((field) => listen(q(field), field === "query" ? "input" : "change", renderSearch));
    listen(q("building"), "change", () => { populateFloors(); renderSearch(); }); listen(q("language"), "change", () => setLanguage(q("language").value));
    listen(q("campus"), "change", () => { stopTour(); temporaryLocation = null; locationKey = ""; selectedId = null; populate(); action("campus", { campusId: q("campus").value }); });
    listen(q("history"), "change", () => { renderHistory(); renderSearch(); if (!overlay.hidden) showMap(overlay.dataset.mode); action("history", { status: q("history").value }); });
    listen(root.querySelector("[data-form=route]"), "submit", (event) => { event.preventDefault(); asyncTask(computeRoute()); });
    listen(root.querySelector("[data-form=schedule]"), "submit", (event) => { event.preventDefault(); try { const entries = validateSchedule({ version: 1, entries: [{ title: q("schedule-title").value, entityId: q("schedule-space").value, day: Number(q("schedule-day").value), start: q("schedule-time").value, end: q("schedule-end").value }] }); if (personal.timetable.length >= 100) throw new Error("일정은 최대 100개입니다."); personal.timetable.push(entries[0]); savePersonal(); renderPersonal(); q("schedule-title").value = ""; } catch (error) { output("storage").textContent = errorText(error); } });
    listen(q("schedule-import"), "change", () => asyncTask((async () => { try { const entries = validateSchedule(await readJson(q("schedule-import").files[0])); personal.timetable = entries; savePersonal(); renderPersonal(); } catch (error) { output("storage").textContent = `시간표를 변경하지 않았습니다. ${errorText(error)}`; } finally { q("schedule-import").value = ""; } })()));
    listen(q("catalog-import"), "change", () => asyncTask(importCatalog(q("catalog-import").files[0])));
    listen(q("report-photo"), "change", () => asyncTask(loadPhoto(q("report-photo").files[0])));
    listen(root.querySelector("[data-form=report]"), "submit", (event) => { event.preventDefault(); asyncTask(submitReport()); });
    listen(root.querySelector("[data-form=receipt]"), "submit", (event) => { event.preventDefault(); asyncTask(receipt()); });
    listen(root.querySelector("[data-form=helper]"), "submit", (event) => { event.preventDefault(); const target = output("helper"); target.replaceChildren(); const found = matches(q("helper").value, ""); found.slice(0, 15).forEach((entity) => { const item = node("li"); item.append(spaceButton(entity), sourceLine(entity), node("p", `운영: ${operation(entity).label || "미확인"}`)); target.append(item); }); if (!found.length) target.append(node("li", "등록된 자료에서 답을 찾지 못했습니다. 이름·목적을 바꾸거나 공식 안내를 확인해 주세요.")); });
    listen(root, "change", (event) => { if (event.target.dataset.platformLayer) action("layer", { layer: event.target.dataset.platformLayer, enabled: event.target.checked }); });
    listen(q("quality"), "change", () => { quality = q("quality").value; action("quality", { quality }); });
    const commands = {
      text: () => showMap("text"), "2d": () => showMap("2d"), overview: () => { closeMap(); action("view", { view: "overview" }); },
      "tour-start": () => { stopTour(); const tour = list(catalog?.tours).find((item) => item.id === q("tour").value); const tourStops = stops(tour); if (!tourStops.length) { output("tour").textContent = "공개 자료에 연결된 투어 정차점이 없습니다."; return; } tourState = { stops: tourStops, index: 0, snapshot: getState() || {} }; action("tour-capture", { snapshot: tourState.snapshot }); showTour(); },
      "tour-prev": () => { if (tourState && tourState.index > 0) { tourState.index--; showTour(); } }, "tour-next": () => { if (tourState && tourState.index < tourState.stops.length - 1) { tourState.index++; showTour(); } }, "tour-stop": stopTour,
      "schedule-export": () => download({ version: 1, entries: personal.timetable }, "campus-timetable.json"), "personal-reset": () => { if (!window.confirm("이 브라우저의 즐겨찾기·최근 선택·수동 시간표를 모두 지울까요?")) return; personal = { version: 1, favorites: [], recent: [], timetable: [] }; savePersonal(); renderPersonal(); renderSelected(); },
      share, qr: generateQr, "share-copy": async () => { if (!q("share-url").value) await share(); if (!q("share-url").value) return; try { await window.navigator.clipboard.writeText(q("share-url").value); output("share").textContent = "공유 주소를 복사했습니다."; } catch { q("share-url").focus(); q("share-url").select(); output("share").textContent = "자동 복사를 사용할 수 없습니다. 선택한 주소를 직접 복사해 주세요."; } }, export: () => action("export", { view: getState().view || "overview" }), location,
      "photo-remove": () => { photoGeneration++; photo = null; photoBusy = false; q("report-photo").value = ""; output("photo").hidden = true; output("photo").removeAttribute("src"); q("photo-consent").checked = false; root.querySelector("[data-form=report] button[type=submit]").disabled = apiBusy; output("report").textContent = "사진을 제거했습니다."; },
      "receipt-copy": async () => { if (!q("receipt-id").value || !q("receipt-token").value) { output("receipt").textContent = "접수번호와 조회 토큰이 필요합니다."; return; } try { await window.navigator.clipboard.writeText(JSON.stringify({ id: q("receipt-id").value, receiptToken: q("receipt-token").value })); output("receipt").textContent = "조회 정보를 복사했습니다. 이 정보는 비공개로 보관해 주세요."; } catch { q("receipt-token").focus(); q("receipt-token").select(); output("receipt").textContent = "자동 복사를 사용할 수 없습니다. 접수번호와 선택한 조회 토큰을 직접 복사해 주세요."; } },
      "catalog-apply": () => { if (!importedCatalog || !window.confirm("검증한 자료로 이 브라우저의 안내 화면을 전환할까요? 학교 공개 자료를 변경하는 작업은 아닙니다.")) return; stopTour(); catalog = importedCatalog; importedCatalog = null; selectedId = null; populate(); command("catalog-apply").disabled = true; action("switchCatalog", { catalog }); output("import").textContent = "검증한 공개 자료로 전환했습니다."; },
      "catalog-export": () => download(domain?.publicCatalog ? domain.publicCatalog(catalog) : catalog, "campus-public-catalog.json"),
      "catalog-refresh": async () => { try { const value = await request("/catalog"); const next = value?.catalog || value; const validation = domain?.validateCatalog?.(next); if (!domain?.validateCatalog || validation?.valid === false || validation?.ok === false || validation === false) throw new Error("서버 자료의 구조를 확인할 수 없습니다."); importedCatalog = domain.publicCatalog ? domain.publicCatalog(next) : next; output("import").textContent = `서버 공개 자료 ${importedCatalog.contentVersion}. 전환 버튼으로 적용할 수 있습니다.`; command("catalog-apply").disabled = false; announce("서버 자료를 검증했습니다. 자료·레이어·변경 비교에서 전환해 주세요."); } catch (error) { announce(errorText(error)); } },
      "offline-save": () => offline("download"), "offline-clear": () => { if (window.confirm("저장된 오프라인 앱 자료를 삭제할까요? 개인 시간표·즐겨찾기는 유지합니다.")) return offline("clear"); }, xr
    };
    listen(root, "click", (event) => { const button = event.target.closest("button[data-command]"); if (button && commands[button.dataset.command]) asyncTask(Promise.resolve().then(() => commands[button.dataset.command]())).catch((error) => announce(errorText(error))); });
    listen(window, "online", network); listen(window, "offline", network);
    let timer = window.setInterval(() => { if (!destroyed) renderOperations(); }, 60000);
    const controller = {
      get catalog() { return catalog; },
      update(next = {}) {
        if (destroyed) return;
        if (next.catalog && next.catalog !== catalog) { stopTour(); temporaryLocation = null; locationKey = ""; catalog = next.catalog; populate(); }
        let changed = false, mapChanged = false;
        if (Object.prototype.hasOwnProperty.call(next, "selectedId")) { const entity = resolve(next.selectedId); const targetId = entity ? entity.id : entities().find((item) => item.legacyKey === next.selectedId || item.legacyId === next.selectedId)?.id || null; if (targetId !== selectedId) { selectedId = targetId; changed = true; mapChanged = true; } }
        if (next.modelStates) { const key = JSON.stringify(next.modelStates); if (key !== modelStateKey) { modelStates = next.modelStates; modelStateKey = key; changed = true; } }
        if (Object.prototype.hasOwnProperty.call(next, "location")) { const value = next.location; const location = value && typeof value.campusId === "string" && list(catalog?.campuses).some((campus) => campus.id === value.campusId) && Number.isFinite(value.east) && Number.isFinite(value.north) && typeof value.inside === "boolean" ? { campusId: value.campusId, east: value.east, north: value.north, accuracyMeters: Number.isFinite(value.accuracyMeters) && value.accuracyMeters >= 0 ? value.accuracyMeters : null, timestamp: value.timestamp || null, inside: value.inside } : null; const key = JSON.stringify(location); if (key !== locationKey) { temporaryLocation = location; locationKey = key; mapChanged = true; } }
        if (changed) renderSelected();
        if (mapChanged && !overlay.hidden) renderSvg(overlay.dataset.mode);
        if (next.layers) { const enabled = Array.isArray(next.layers) ? new Set(next.layers) : new Set(Object.entries(next.layers).filter(([, value]) => value).map(([id]) => id)); root.querySelectorAll("[data-platform-layer]").forEach((input) => { input.checked = enabled.has(input.dataset.platformLayer); }); }
        if (next.quality) { quality = next.quality; q("quality").value = quality; }
        if (["text", "2d"].includes(next.view) && (overlay.hidden || overlay.dataset.mode !== next.view)) showMap(next.view, false);
        if (["overview", "top", "free"].includes(next.view) && !overlay.hidden) closeMap(false);
        if (next.language && next.language !== language) setLanguage(next.language);
        if (next.offlineReady === true && !offlineInitialized) { offlineInitialized = true; asyncTask(offline("status")); }
        if (next.exportStatus) announce(next.exportStatus);
        refinement?.update({ ...next, selectedId });
      },
      destroy() { if (destroyed) return; stopTour(); closeMap(); refinement?.destroy(); destroyed = true; events.splice(0).forEach((remove) => remove()); window.clearInterval(timer); timer = null; root.remove(); overlay.remove(); if (active === controller) active = null; },
      whenIdle: () => Promise.allSettled([...Array.from(pending), refinement?.whenIdle()])
    };
    active = controller;
    try { if (!catalog || !Array.isArray(catalog.entities) || !Array.isArray(catalog.campuses)) throw new Error("공간 자료를 불러오지 못했습니다."); loadPersonal(); populate(); network(); asyncTask(offline("status")); if (!domain) announce("공간 계산·자료 검증 기능을 불러오지 못했습니다. 목록은 사용할 수 있습니다."); }
    catch (error) { announce(errorText(error)); root.querySelectorAll("form button, select, input[type=file]").forEach((element) => { element.disabled = true; }); }
    if (catalog?.campuses?.length && window.CampusRefinementControls) refinement = window.CampusRefinementControls.initialize({ mount: root, catalog, getState, mediaRecords: options.mediaRecords, onAction: action, applyPurpose(purpose) { const section = root.querySelector(`[data-section="search"]`); if (section && purpose !== "facilities") section.open = true; if (purpose === "facilities") root.querySelector('[data-field="history"]').closest("details").open = true; } });
    return controller;
  }

  window.CampusPlatformControls = { initialize, safeSourceUrl: https };
})();
