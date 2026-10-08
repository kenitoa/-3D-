/* Catalog-grounded 3D planning tools. They never infer a survey, approval or open route. */
(function attachRefinementControls() {
  "use strict";
  const list = (value) => Array.isArray(value) ? value : [];
  function element(tag, text, attributes = {}) {
    const result = document.createElement(tag);
    if (text !== undefined && text !== null) result.textContent = String(text);
    Object.entries(attributes).forEach(([key, value]) => result.setAttribute(key, String(value)));
    return result;
  }
  function name(entity) { return entity?.displayTitle || entity?.name || entity?.id || "공간 미확인"; }
  function publicEntity(catalog, entity) {
    const seen = new Set();
    while (entity) {
      if (entity.sensitive || entity.visibility && entity.visibility !== "public" || seen.has(entity.id)) return false;
      seen.add(entity.id);
      if (!entity.parentId) return true;
      entity = list(catalog?.entities).find((item) => item.id === entity.parentId);
    }
    return false;
  }
  function initialize(options = {}) {
    const mount = options.mount;
    if (!mount) return null;
    const root = element("section", null, { class: "refinement-controls", id: "campusRefinement", "aria-label": "3D 공간 고도화" });
    let catalog = options.catalog, selectedId = null, destroyed = false, comparison = null, comparisonBase = null, currentState = {}, media = list(options.mediaRecords), navigationKey = "", legendKey = "", mediaKey = "", anchorsKey = "";
    const listeners = [], pending = new Set();
    const getState = typeof options.getState === "function" ? options.getState : () => currentState;
    const onAction = typeof options.onAction === "function" ? options.onAction : () => {};
    root.innerHTML = `<nav class="refinement-breadcrumb" data-ref-output="breadcrumb" aria-label="현재 공간 위치"></nav>
      <details class="site-section refinement-section"><summary>이용 목적·시점 조작</summary><div class="site-section-body">
        <label class="platform-field">안내 목적<select data-ref-field="purpose"><option value="visitor">처음 방문 · 목적지·출입구</option><option value="student">재학생 · 건물·층·공간</option><option value="facilities">시설 검토 · 형상·변경·운영</option></select></label><button type="button" data-ref-command="purpose">목적에 맞는 안내 적용</button><p data-ref-output="purpose" role="status"></p>
        <div class="refinement-camera" role="group" aria-label="카메라 버튼 조작"><button type="button" data-ref-camera="rotate-left" aria-label="왼쪽으로 회전">↶ 회전</button><button type="button" data-ref-camera="rotate-right" aria-label="오른쪽으로 회전">↷ 회전</button><button type="button" data-ref-camera="zoom-in">확대 +</button><button type="button" data-ref-camera="zoom-out">축소 −</button><button type="button" data-ref-camera="move-north">북쪽 이동 ↑</button><button type="button" data-ref-camera="move-south">남쪽 이동 ↓</button><button type="button" data-ref-camera="move-west">서쪽 이동 ←</button><button type="button" data-ref-camera="move-east">동쪽 이동 →</button></div>
        <p class="platform-note">버튼에 초점을 두고 방향키·+/−로 조작할 수 있습니다. 북방위는 등록된 좌표 기준이며 장면 회전과 구분합니다.</p>
        <label class="platform-check"><input type="checkbox" data-ref-field="reduced-motion">시점 전환 동작 줄이기</label>
        <label class="platform-field">조명 표현<select data-ref-field="lighting"><option value="guide">공간 안내</option><option value="day">낮 표현</option><option value="evening">저녁 표현</option></select></label><p class="platform-note">조명 표현은 일조 분석이나 실제 시간대의 검증 결과가 아닙니다.</p>
        <label class="platform-field">선택 건물의 층<select data-ref-field="floor"></select></label><label class="platform-field">층 관찰<select data-ref-field="floor-mode"><option value="exterior">외관 복원</option><option value="cut">층 절단</option><option value="isolate">선택 층 강조</option><option value="explode">층 분리</option></select></label><button type="button" data-ref-command="floor">층 관찰 적용</button><p data-ref-output="floor" role="status">검수된 층 형상이 있을 때 적용합니다. 기존 개념도에는 실제 실내 형상을 생성하지 않습니다.</p>
      </div></details>
      <details class="site-section refinement-section"><summary>경계·정확도 범례</summary><div class="site-section-body"><ul class="refinement-legend" data-ref-output="legend"></ul><div data-ref-output="claims"></div><p data-ref-output="version"></p><p data-ref-output="shared" role="status"></p></div></details>
      <details class="site-section refinement-section"><summary>측정·자료판 비교</summary><div class="site-section-body">
        <form data-ref-form="measure"><label class="platform-field">측정 종류<select data-ref-field="measure-type"><option value="planar-distance">평면 거리</option><option value="path-distance">입력점 연결 거리</option><option value="height-difference">높이 차이</option><option value="area">평면 영역 면적</option></select></label>
          <label class="platform-field">미터 좌표 · 동쪽,북쪽,높이 · 한 줄에 한 점<textarea data-ref-field="measure-points" spellcheck="false" maxlength="12000" placeholder="0,0,0&#10;10,0,0"></textarea></label>
          <div class="platform-row"><button type="submit">입력 좌표 측정</button><button type="button" data-ref-command="measure-outline">선택 공간 외곽 면적</button><button type="button" data-ref-command="measure-pick">3D에서 점 선택</button><button type="button" data-ref-command="measure-clear">측정 지우기</button></div></form><p data-ref-output="measure" role="status">등록된 미터 좌표 또는 선택 점을 측정합니다. 안내선의 면적은 법적 부지 면적이 아닙니다.</p>
        <label class="platform-field">비교할 공개 Catalog JSON · 2MB 이하<input type="file" data-ref-field="compare-file" accept="application/json,.json"></label><div class="platform-row"><button type="button" data-ref-command="compare-current">현재 자료 보기</button><button type="button" data-ref-command="compare-other" disabled>비교 자료 보기</button></div><p data-ref-output="compare" role="status">확인된 자료판을 가져오면 같은 카메라에서 형상 변경을 비교합니다.</p><ul class="platform-list" data-ref-output="compare-diff"></ul>
      </div></details>
      <details class="site-section refinement-section"><summary>운영 주제·근거 안내</summary><div class="site-section-body">
        <label class="platform-field">주제 레이어<select data-ref-field="theme"><option value="none">기본 공간</option><option value="construction">공사</option><option value="events">행사</option><option value="access">출입 제한</option><option value="hours">운영시간</option></select></label><ul class="platform-list" data-ref-output="theme"></ul>
        <form data-ref-form="helper"><label class="platform-field">안내 목적에 맞는 공간 찾기<input type="search" data-ref-field="helper-query" maxlength="120" required></label><button type="submit">등록 자료와 근거 확인</button><button type="button" data-ref-command="assistant" disabled>등록된 AI 연동에 질문</button></form><ul class="platform-list" data-ref-output="helper"></ul><p data-ref-output="assistant" role="status">외부 AI 연동의 설정 여부를 확인하면 질문할 수 있습니다.</p><p class="platform-note">승인되어 전달된 공개 자료에서 찾습니다. 외부 생성형 AI·학교 API는 연결된 경우에만 사용하며 등록되지 않은 경로·운영시간·공간을 생성하지 않습니다.</p>
        <h3>선택 공간의 공개 미디어</h3><div data-ref-output="media"></div>
      </div></details>
      <details class="site-section refinement-section"><summary>3D 품질·오프라인·XR</summary><div class="site-section-body"><dl class="refinement-diagnostics" data-ref-output="diagnostics"></dl>
        <label class="platform-field">VR 이동<select data-ref-field="vr-movement"><option value="teleport">순간 이동</option><option value="smooth">연속 이동</option></select></label><label class="platform-field">VR 회전<select data-ref-field="vr-turn"><option value="snap">단계 회전</option><option value="smooth">연속 회전</option></select></label><label class="platform-field">관찰 시점 높이 · m<input type="number" data-ref-field="eye-height" min="0.5" max="2.3" step="0.05" value="1.6"></label><button type="button" data-ref-command="vr-preferences">VR 관찰 설정 적용</button><button type="button" data-ref-command="ar">AR 기기 지원 확인</button>
        <label class="platform-field">등록된 현장 AR 기준 구역<select data-ref-field="ar-anchor"></select></label><label class="platform-field">캡처할 기준점·독립 검수점<select data-ref-field="ar-landmark"></select></label><div class="platform-row"><button type="button" data-ref-command="ar-start" disabled>현장 정합 시작</button><button type="button" data-ref-command="ar-capture" disabled>선택 기준점 캡처</button><button type="button" data-ref-command="ar-review" disabled>정합 검토</button><button type="button" data-ref-command="ar-exit">AR 종료</button></div><p data-ref-output="xr" role="status">기기 지원과 현장 정합을 각각 확인한 뒤 실행합니다.</p><pre data-ref-output="ar-report"></pre>
        <label class="platform-field">오프라인 저장 범위<select data-ref-field="offline-scope"><option value="basic">기본 조감도·안내</option><option value="selected">선택 건물의 공개 상세</option><option value="all">전체 공개 상세</option></select></label><p data-ref-output="offline">오프라인 자료는 저장 기준일과 자료·모델 버전을 함께 확인해야 합니다.</p><div class="platform-row"><button type="button" data-ref-command="offline-bundle">승인 공개판 용량 확인</button><button type="button" data-ref-command="offline-save">선택 범위 저장</button></div>
      </div></details><p class="refinement-status" data-ref-output="status" role="status" aria-live="polite"></p>`;
    mount.prepend(root);
    const field = (key) => root.querySelector(`[data-ref-field="${key}"]`);
    const output = (key) => root.querySelector(`[data-ref-output="${key}"]`);
    const command = (key) => root.querySelector(`[data-ref-command="${key}"]`);
    const listen = (target, event, callback) => { target.addEventListener(event, callback); listeners.push(() => target.removeEventListener(event, callback)); };
    const status = (text) => { if (!destroyed) output("status").textContent = text; };
    const track = (promise) => { const task = Promise.resolve(promise); pending.add(task); task.then(() => pending.delete(task), () => pending.delete(task)); return task; };
    const action = (key, payload = {}) => { if (!destroyed) return onAction(key, payload); };
    const resolve = (id) => list(catalog?.entities).find((item) => item.id === id);
    const currentCampus = () => list(catalog?.campuses).find((item) => item.id === (getState().campusId || catalog?.activeCampusId)) || catalog?.campuses?.[0];
    const visibleEntities = () => list(catalog?.entities).filter((item) => item.campusId === currentCampus()?.id && publicEntity(catalog, item));
    function sourceCitation(target, sourceId) {
      const source = list(catalog?.sources).find((item) => item.id === sourceId && (!item.visibility || item.visibility === "public"));
      if (!source) { target.append(element("span", "출처 미확인")); return; }
      const text = `${source.title || source.id} · ${source.dates?.referenceDate || source.date || "기준일 미확인"}`;
      let url = null;
      try { const candidate = new URL(source.url); if (candidate.protocol === "https:") url = candidate.href; } catch { /* No public link was registered. */ }
      target.append(url ? element("a", text, { href: url, target: "_blank", rel: "noopener noreferrer" }) : element("span", text));
    }
    function renderNavigation() {
      const key = JSON.stringify([catalog?.contentVersion, selectedId, currentCampus()?.id]); if (key === navigationKey) return; navigationKey = key;
      const breadcrumb = output("breadcrumb"); breadcrumb.replaceChildren();
      const chain = [], visited = new Set(); let entity = resolve(selectedId);
      while (entity && !visited.has(entity.id) && publicEntity(catalog, entity)) { visited.add(entity.id); chain.unshift(entity); entity = resolve(entity.parentId); }
      breadcrumb.append(element("button", `${currentCampus()?.name || "캠퍼스"} 전체`, { type: "button", "data-ref-overview": "true" }));
      chain.filter((item) => item.kind !== "campus").forEach((item, index, items) => { breadcrumb.append(element("span", "›", { "aria-hidden": "true" }), element("button", name(item), { type: "button", "data-ref-space": item.id, ...(index === items.length - 1 ? { "aria-current": "location" } : {}) })); });
      if (selectedId && !resolve(selectedId)) breadcrumb.append(element("span", "현재 자료에서 대상이 변경되거나 제외되었습니다."));
      if (resolve(selectedId)) {
        const views = element("div", null, { class: "platform-row" });
        [["overview", "3D 관찰"], ["2d", "2D 위치"], ["text", "문자 정보"]].forEach(([view, label]) => views.append(element("button", label, { type: "button", "data-ref-view": view })));
        breadcrumb.append(views);
      }
      const currentFloor = chain.find((item) => item.kind === "floor"), building = chain.find((item) => item.kind === "building"), previousFloor = field("floor").value; field("floor").replaceChildren();
      const floors = visibleEntities().filter((item) => item.kind === "floor" && (item.owningBuildingId === building?.id || item.parentId === building?.id)); floors.forEach((item) => field("floor").append(element("option", name(item), { value: item.id }))); if (currentFloor) field("floor").value = currentFloor.id; else if (floors.some((item) => item.id === previousFloor)) field("floor").value = previousFloor;
      field("floor").disabled = !floors.length; command("floor").disabled = !floors.length;
    }
    function renderLegend() {
      const state = { ...currentState, ...(getState() || {}) }, key = JSON.stringify([catalog?.contentVersion, selectedId, currentCampus()?.id, state.sharedStatus, state.sharedVersion, state.boundaryLegend]); if (key === legendKey) return; legendKey = key;
      const target = output("legend"); target.replaceChildren();
      const defaults = { guide: { name: "안내 영역", pattern: "dash", color: "#285940" }, legal: { name: "소유 경계", pattern: "solid", color: "#623d4f" }, cadastral: { name: "지적 경계", pattern: "dot", color: "#456779" }, planning: { name: "계획 경계", pattern: "dash-dot", color: "#8c6926" } };
      Object.entries(defaults).forEach(([key, fallback]) => { const canonical = list(state.boundaryLegend).find((item) => item.type === key), style = canonical || fallback, shape = currentCampus()?.boundaries?.[key], row = element("li", null, { "data-boundary-kind": key }); const swatch = document.createElementNS("http://www.w3.org/2000/svg", "svg"); swatch.setAttribute("width", "35"); swatch.setAttribute("height", "15"); swatch.setAttribute("aria-hidden", "true"); swatch.setAttribute("class", "refinement-boundary-svg"); const line = document.createElementNS(swatch.namespaceURI, "line"); line.setAttribute("x1", "1"); line.setAttribute("x2", "34"); line.setAttribute("y1", "8"); line.setAttribute("y2", "8"); line.setAttribute("stroke", /^#[a-f0-9]{6}$/i.test(style.color) ? style.color : fallback.color); line.setAttribute("stroke-width", "3"); const pattern = ({ dash: "8 5", dot: "2 5", "dash-dot": "11 4 2 4" })[style.pattern]; if (pattern) line.setAttribute("stroke-dasharray", pattern); swatch.append(line); row.append(swatch, element("span", `${style.name} · ${({ solid: "실선", dash: "점선", dot: "점", "dash-dot": "일점쇄선" })[style.pattern] || "미등록 표현"} · ${shape ? ({ verified: "확인 자료", mapped: "지도 자료", estimated: "추정 자료", unverified: "미확인 자료" })[shape.confidence] || "확인 수준 미등록" : "자료 미확보"}`)); target.append(row); });
      const selected = resolve(selectedId), claims = output("claims"); claims.replaceChildren();
      if (selected && publicEntity(catalog, selected)) Object.entries(selected.claims || {}).forEach(([key, claim]) => { const row = element("p", `${({ name: "명칭", location: "위치", outline: "외곽", height: "높이", operation: "운영" })[key] || key}: ${({ verified: "확인", mapped: "지도 기반", estimated: "추정", unverified: "미확인" })[claim.confidence] || "미확인"} · ${claim.dates?.referenceDate || "기준일 미확인"} · `); list(claim.sourceIds).forEach((id, index) => { if (index) row.append(document.createTextNode(" / ")); sourceCitation(row, id); }); if (!list(claim.sourceIds).length) row.append(document.createTextNode("근거 미등록")); claims.append(row); });
      else claims.append(element("p", "공간을 선택하면 이름·위치·외곽·높이·운영의 확인 수준을 각각 표시합니다."));
      output("version").textContent = `자료 ${catalog?.contentVersion || "미확인"} · 모델 ${catalog?.assetsVersion || "미확인"} · 높이 기준 ${currentCampus()?.verticalDatum || "미확인"}`;
      output("shared").textContent = state.sharedStatus === "retired" ? "공유 대상이 현재 공개판에서 제외되었습니다. 전체 부지와 공간 목록을 확인해 주세요." : state.sharedStatus && !["current", "version-changed"].includes(state.sharedStatus) ? state.sharedStatus : state.sharedVersion && state.sharedVersion !== catalog?.contentVersion ? `공유 당시 자료 ${state.sharedVersion} · 현재 표시 ${catalog?.contentVersion}. 대상과 형상이 달라질 수 있습니다.` : state.sharedVersion ? `공유 자료판 ${state.sharedVersion}` : "공유·내보내기에는 자료판과 확인 수준을 함께 표시합니다.";
    }
    function displayMeasurement(result, origin) {
      const precision = result.approximate ? 1 : 2, unit = result.unit === "m2" ? "m²" : "m";
      output("measure").textContent = `${origin} · ${result.approximate ? "약 " : ""}${Number(result.value).toLocaleString("ko-KR", { maximumFractionDigits: precision })}${unit}${Number.isFinite(result.uncertainty) ? ` · 불확도 ±${result.uncertainty.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${unit}` : " · 측량 오차 미확인"} · 자료 ${result.version || catalog?.contentVersion || "미확인"}. 안내선 면적은 법적 부지 면적이 아닙니다.`;
    }
    function typedPoints() {
      const text = field("measure-points").value.trim(); if (!text) throw new Error("측정할 미터 좌표를 입력해 주세요.");
      const points = text.split(/\r?\n/).map((line) => line.trim().split(/[,\s]+/).map((value) => Number(value)));
      if (points.length > 300 || points.some((point) => point.length < 2 || point.length > 3 || point.some((value) => !Number.isFinite(value) || Math.abs(value) > 100000))) throw new Error("좌표는 한 줄에 유한한 미터 값 2~3개로 입력하며 최대 300점입니다.");
      return points;
    }
    function measure(points, kind, confirmation = "unverified", origin = "입력 좌표") {
      if (!window.CampusRefinement?.measureGeometry) throw new Error("좌표 측정 모듈을 불러오지 못했습니다.");
      const result = window.CampusRefinement.measureGeometry(points, kind, { confirmation, version: catalog?.contentVersion });
      displayMeasurement(result, origin); action("refinement-measure", { mode: kind, points, result });
    }
    function renderTheme() {
      const theme = field("theme").value, target = output("theme"); target.replaceChildren();
      const records = theme === "events" ? list(catalog?.events) : list(catalog?.operations);
      let found = records.filter((item) => (!item.campusId || item.campusId === currentCampus()?.id) && (!item.visibility || item.visibility === "public") && item.status !== "cancelled" && (theme === "events" || theme === "construction" && (item.status || item.state) === "construction" || theme === "access" && ["closed", "restricted"].includes(item.status || item.state) || theme === "hours" && ["open", "unknown"].includes(item.status || item.state)));
      if (theme === "none") found = [];
      found.forEach((record) => { const item = element("li"), entity = resolve(record.entityId || record.spaceId); const end = record.endsAt || record.validUntil || record.expiresAt; item.append(element("strong", record.title || record.label || "운영 기록"), element("span", `${record.startsAt || record.validFrom || "시작 미확인"} ~ ${end || "종료 미확인"}${end && Date.parse(end) < Date.now() ? " · 기간 만료" : ""}`)); if (entity && publicEntity(catalog, entity)) item.append(element("button", name(entity), { type: "button", "data-ref-space": entity.id })); const citation = element("p"); sourceCitation(citation, record.sourceId || list(record.sourceIds)[0]); item.append(citation, element("small", "위치가 확인된 등록 대상만 강조합니다. 기록만으로 실제 공사 면적·통행 가능성을 확정하지 않습니다.")); target.append(item); });
      if (!found.length) target.append(element("li", theme === "none" ? "기본 공간을 표시합니다." : "공개된 해당 주제 자료가 없습니다. 정상 운영 상태를 뜻하지 않습니다."));
      action("refinement-theme", { theme, entityIds: found.map((record) => record.entityId || record.spaceId).filter((id) => resolve(id) && publicEntity(catalog, resolve(id))) });
    }
    function helper() {
      const query = field("helper-query").value.normalize("NFKC").trim(), target = output("helper"); target.replaceChildren();
      let results;
      if (window.CampusPlatform?.search) results = list(window.CampusPlatform.search(catalog, query, { campusId: currentCampus()?.id })).map((item) => item.entity || item).filter((item) => publicEntity(catalog, item));
      else results = visibleEntities().filter((item) => [name(item), ...list(item.aliases), item.category, item.purpose].join(" ").toLowerCase().includes(query.toLowerCase()));
      const purpose = field("purpose").value; const priority = (entity) => purpose === "visitor" ? Number(["building", "door", "external-facility"].includes(entity.kind)) : purpose === "student" ? Number(["floor", "space", "building"].includes(entity.kind)) : Number(Boolean(entity.geometry)); results.sort((a, b) => priority(b) - priority(a));
      results.slice(0, 20).forEach((entity) => { const row = element("li"); row.append(element("button", name(entity), { type: "button", "data-ref-space": entity.id }), element("small", `공간 ${entity.id} · 자료 ${catalog?.contentVersion} · 위치 ${entity.claims?.location?.confidence || "미확인"} · 운영 ${entity.claims?.operation?.confidence || "미확인"}`)); const citations = element("p"); const ids = [...new Set([entity.sourceId, ...Object.values(entity.claims || {}).flatMap((claim) => list(claim.sourceIds))].filter(Boolean))]; ids.forEach((id, index) => { if (index) citations.append(document.createTextNode(" / ")); sourceCitation(citations, id); }); row.append(citations); target.append(row); });
      if (!results.length) target.append(element("li", "등록된 공개 자료에서 찾지 못했습니다. 이름·목적·번호를 확인해 주세요."));
    }
    function renderMedia() {
      const key = JSON.stringify([selectedId, catalog?.contentVersion, media]); if (key === mediaKey) return; mediaKey = key;
      const target = output("media"); target.querySelectorAll("audio,video").forEach((item) => item.pause()); target.replaceChildren();
      const selectedMedia = media.filter((item) => item.entityId === selectedId);
      let count = 0;
      selectedMedia.forEach((item) => { try { if (!window.CampusRefinement?.validateMedia) return; const immutable = /^assets\/releases\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|mp3|ogg|wav|mp4|webm)$/.test(item.path); const verified = window.CampusRefinement.validateMedia(immutable ? { ...item, path: `assets/media/approved.${item.path.split(".").at(-1)}` } : item); if (verified === false || verified?.valid === false || verified?.ok === false || !resolve(item.entityId) || !publicEntity(catalog, resolve(item.entityId)) || !list(catalog?.sources).some((source) => source.id === item.sourceId && (!source.visibility || source.visibility === "public"))) return; const mediaElement = element(item.kind === "image" ? "img" : item.kind, null, { src: item.path, ...(item.kind === "image" ? { alt: item.caption || item.description || `${name(resolve(item.entityId))} 공개 자료`, loading: "lazy" } : { controls: "", preload: "none" }) }); const caption = element("p", `사용권 ${item.license} · `); sourceCitation(caption, item.sourceId); target.append(mediaElement, caption); count++; } catch { /* Unlicensed or invalid media is not mounted. */ } });
      if (!count) target.append(element("p", "선택 공간에 출처·공개 사용권이 확인된 사진·영상·음성 자료가 등록되지 않았습니다."));
    }
    function renderDiagnostics() {
      const state = { ...currentState, ...(getState() || {}) }, diagnostics = state.diagnostics || {}, target = output("diagnostics"); target.replaceChildren();
      const pairs = [["품질", state.quality || diagnostics.quality || "자동"], ["모델 단계", diagnostics.lod || "장면의 등록 모델 기준"], ["메쉬", diagnostics.meshes ?? diagnostics.meshCount], ["그리기 요청", diagnostics.drawCalls], ["삼각형", diagnostics.triangles], ["프레임", Number.isFinite(diagnostics.fps) ? `${diagnostics.fps.toFixed(1)}fps` : undefined], ["상세 자원", diagnostics.loadedDetails], ["상주 자산 크기", Number.isFinite(diagnostics.residentBytes) ? `${(diagnostics.residentBytes / 1024 / 1024).toFixed(1)}MB` : undefined], ["자료판", catalog?.contentVersion]];
      pairs.forEach(([label, value]) => { target.append(element("dt", label), element("dd", value === undefined || value === null ? "측정 대기" : typeof value === "object" ? JSON.stringify(value).slice(0, 800) : value)); });
      output("offline").textContent = state.offlineStatus || (state.offlineBundle?.version ? `저장 공개판 ${state.offlineBundle.version} · 모델 ${state.offlineBundle.assetsVersion || "미확인"} · 기준일 ${state.offlineBundle.savedAt || state.offlineBundle.updatedAt || "미확인"}. 운영 정보는 저장 당시 기준입니다.` : "저장된 기본 자료와 새 승인 공개판의 저장 범위는 구분합니다. 관리자·제보·개인 정보는 오프라인 묶음에 포함하지 않습니다.");
      if (state.offlineEstimate) output("offline").textContent += ` · 선택 범위 ${state.offlineEstimate.scope || field("offline-scope").value} · ${Number.isFinite(state.offlineEstimate.bytes) ? `예상 ${(state.offlineEstimate.bytes / 1024 / 1024).toFixed(1)}MB` : "용량 확인 대기"}`;
      command("assistant").disabled = state.assistantConfigured !== true;
      if (state.assistantConfigured === false) output("assistant").textContent = "외부 AI 연동이 등록되지 않았습니다. 등록 자료 검색을 계속 사용할 수 있습니다.";
      if (state.assistantResult) { output("assistant").replaceChildren(); const result = state.assistantResult; output("assistant").append(element("p", result.answer || result.message || "등록된 근거 답변이 없습니다.")); list(result.entityIds).filter((id) => resolve(id) && publicEntity(catalog, resolve(id))).forEach((id) => output("assistant").append(element("button", name(resolve(id)), { type: "button", "data-ref-space": id }))); list(result.sourceIds).forEach((id) => { const row = element("p"); sourceCitation(row, id); output("assistant").append(row); }); }
      renderAnchors(state);
    }
    function renderAnchors(state) {
      const anchors = list(state.arAnchors), key = JSON.stringify(anchors); if (key !== anchorsKey) { anchorsKey = key; const previous = field("ar-anchor").value; field("ar-anchor").replaceChildren(); anchors.forEach((anchor) => field("ar-anchor").append(element("option", anchor.title || anchor.name || anchor.id, { value: anchor.id }))); if (anchors.some((anchor) => anchor.id === previous)) field("ar-anchor").value = previous; populateLandmarks(); }
      field("ar-anchor").disabled = !anchors.length; command("ar-start").disabled = !anchors.length; command("ar-review").disabled = !anchors.length; command("ar-capture").disabled = !anchors.length || !field("ar-landmark").options.length;
      if (!anchors.length && !state.xrStatus) output("xr").textContent = "현장 검수된 AR 기준 구역이 등록되지 않았습니다. 기준점·독립 검수점·허용 오차를 등록한 뒤 정합을 시작할 수 있습니다.";
      if (state.arCalibrationReport || list(state.arLandmarks).length) output("ar-report").textContent = JSON.stringify({ ...(state.arCalibrationReport ? { report: state.arCalibrationReport } : {}), ...(list(state.arLandmarks).length ? { capturedLandmarks: state.arLandmarks } : {}) }, null, 2);
    }
    function populateLandmarks() { const state = { ...currentState, ...(getState() || {}) }, anchor = list(state.arAnchors).find((item) => item.id === field("ar-anchor").value), previous = field("ar-landmark").value; field("ar-landmark").replaceChildren(); list(anchor?.landmarks).forEach((landmark) => field("ar-landmark").append(element("option", `${landmark.role === "holdout" ? "독립 검수점" : "정합 기준점"} · ${landmark.id}`, { value: landmark.id, "data-role": landmark.role }))); if (list(anchor?.landmarks).some((landmark) => landmark.id === previous)) field("ar-landmark").value = previous; }
    function arCommand(command) { const anchorId = field("ar-anchor").value; if (command !== "exit" && !anchorId) throw new Error("등록된 현장 기준 구역을 선택해 주세요."); return action("refinement-ar", { command, ...(anchorId ? { anchorId } : {}), ...(command === "capture" ? { landmarkId: field("ar-landmark").value, role: field("ar-landmark").selectedOptions[0]?.dataset.role } : {}) }); }
    function offlineRequest(command) { const scope = field("offline-scope").value; if (scope === "selected" && !resolve(selectedId)) throw new Error("상세를 저장할 건물을 먼저 선택해 주세요."); return action("refinement-offline", { command, scope, selectedId, details: scope !== "basic", selectedOnly: scope === "selected", catalogVersion: catalog?.contentVersion, assetsVersion: catalog?.assetsVersion }); }
    async function importComparison(file) {
      comparison = null; command("compare-other").disabled = true; output("compare-diff").replaceChildren();
      if (!file || file.size > 2 * 1024 * 1024) throw new Error("2MB 이하 공개 Catalog JSON을 선택해 주세요.");
      const value = JSON.parse(await file.text()), domain = window.CampusPlatform;
      const result = domain?.validateCatalog?.(value); if (!result || result.valid === false || result.ok === false) throw new Error(list(result?.errors).join(" · ") || "비교 자료의 구조 검증에 실패했습니다.");
      comparisonBase = comparisonBase || catalog; comparison = domain.publicCatalog(value);
      const diff = window.CampusRefinement?.compareRelease ? window.CampusRefinement.compareRelease(comparisonBase, comparison) : domain.diffCatalog(comparisonBase, comparison);
      Object.entries(diff || {}).forEach(([key, entries]) => list(entries).slice(0, 100).forEach((entry) => output("compare-diff").append(element("li", `${({ added: "추가", removed: "제외", changed: "변경" })[key] || key}: ${typeof entry === "string" ? entry : entry.id || entry.entityId || JSON.stringify(entry)}`))));
      if (!output("compare-diff").children.length) output("compare-diff").append(element("li", "공간 형상·명칭·근거의 차이가 없습니다."));
      output("compare").textContent = `기준 ${comparisonBase.contentVersion} ↔ 비교 ${comparison.contentVersion}. 구조 검증은 학교 승인·현장 검증을 뜻하지 않습니다. 과거·계획 기록은 현재 시설과 구분합니다.`;
      command("compare-other").disabled = false;
    }
    function preferences() {
      const eyeHeightMeters = Number(field("eye-height").value); if (!Number.isFinite(eyeHeightMeters) || eyeHeightMeters < 0.5 || eyeHeightMeters > 2.3) throw new Error("관찰 시점 높이는 0.5~2.3m로 입력해 주세요.");
      const value = { reducedMotion: field("reduced-motion").checked, vrMovement: field("vr-movement").value, vrTurn: field("vr-turn").value, eyeHeightMeters };
      action("refinement-preferences", value); status("관찰 설정을 적용했습니다. 실제 XR 기기의 조작·가독성·멀미 검수는 별도로 필요합니다.");
    }
    const commands = {
      purpose() { const purpose = field("purpose").value; const layers = { visitor: ["boundary", "buildings", "roads", "paths", "entrances", "labels"], student: ["boundary", "buildings", "paths", "labels"], facilities: ["boundary", "buildings", "roads", "paths", "parking", "sports", "greenery", "context", "labels", "contours"] }[purpose]; action("refinement-purpose", { purpose, layers: layers.filter((id) => list(catalog?.layers).some((layer) => layer.id === id)) }); if (options.applyPurpose) options.applyPurpose(purpose); output("purpose").textContent = `${field("purpose").selectedOptions[0].textContent} 안내를 적용했습니다. 선택한 목적만 사용하며 사용자 신분을 추정하지 않습니다.`; },
      "measure-outline"() { const entity = resolve(selectedId); if (!entity?.geometry || entity.geometry.coordinateSystem !== "local-meters") throw new Error("미터 좌표로 등록된 외곽을 가진 공간을 선택해 주세요."); const shape = entity.geometry; if (!["Polygon", "MultiPolygon"].includes(shape.type)) throw new Error("선택 공간에 영역 외곽이 없습니다."); const parts = shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates; const domain = window.CampusRefinement; if (!domain?.measureGeometry) throw new Error("측정 모듈을 불러오지 못했습니다."); let value = 0; parts.forEach((rings) => rings.forEach((ring, index) => { value += (index === 0 ? 1 : -1) * domain.measureGeometry(ring, "area", { confirmation: shape.confidence }).value; })); displayMeasurement({ value, unit: "m2", approximate: shape.confidence !== "verified", version: catalog.contentVersion, uncertainty: null }, `${name(entity)} 외곽`); action("refinement-measure", { mode: "outline", entityId: entity.id, geometry: shape }); },
      "measure-pick"() { action("refinement-measure", { mode: field("measure-type").value, pick: true }); output("measure").textContent = "3D 장면에서 측정점을 선택합니다. 직접 좌표 입력도 사용할 수 있습니다."; },
      "measure-clear"() { field("measure-points").value = ""; output("measure").textContent = "측정을 지웠습니다."; action("refinement-measure", { mode: "clear" }); },
      "compare-current"() { const baseline = comparisonBase || catalog; action("refinement-compare", { catalog: baseline, version: baseline.contentVersion, clear: true }); status("같은 카메라에서 기준 자료를 표시합니다."); },
      "compare-other"() { if (comparison) { action("refinement-compare", { catalog: comparison, version: comparison.contentVersion }); status(`비교 자료 ${comparison.contentVersion}를 표시합니다. 실제 승인 여부는 원자료 담당자에게 확인해야 합니다.`); } },
      "vr-preferences": preferences,
      floor() { const floorId = field("floor").value; if (!resolve(floorId)) throw new Error("등록된 층을 선택해 주세요."); action("refinement-floor", { floorId, mode: field("floor-mode").value }); output("floor").textContent = "등록된 층 형상의 확인 수준을 검사합니다. 형상이 없는 개념 층은 문자·개념 안내로 탐색할 수 있습니다."; },
      async ar() { if (!window.navigator.xr?.isSessionSupported) throw new Error("현재 브라우저에 WebXR 지원 확인 기능이 없습니다. 2D·문자 안내를 이용해 주세요."); const supported = await window.navigator.xr.isSessionSupported("immersive-ar"); output("xr").textContent = supported ? "기기가 AR을 지원합니다. 검수된 기준점·현장 앵커·위치 오차를 확인하기 전에는 실제 공간 안내를 시작하지 않습니다." : "현재 기기에서 immersive AR을 지원하지 않습니다."; action("refinement-ar", { command: "capability", supported }); },
      "ar-start"() { return arCommand("start"); }, "ar-capture"() { return arCommand("capture"); }, "ar-review"() { return arCommand("review"); }, "ar-exit"() { return arCommand("exit"); },
      "offline-bundle"() { return offlineRequest("inspect"); }, "offline-save"() { return offlineRequest("download"); },
      assistant() { const query = field("helper-query").value.trim(); if (!query) throw new Error("안내 질문을 입력해 주세요."); helper(); output("assistant").textContent = "등록된 AI 연동에서 근거 답변을 확인합니다. 실패 시 등록 자료 검색 결과를 계속 사용할 수 있습니다."; return action("refinement-assistant", { query, purpose: field("purpose").value }); }
    };
    listen(root, "click", (event) => { const button = event.target.closest("button"); if (!button || button.disabled) return; if (button.dataset.refSpace) { selectedId = button.dataset.refSpace; action("select", { id: selectedId }); renderNavigation(); renderLegend(); renderMedia(); } else if (button.dataset.refOverview) action("view", { view: "overview" }); else if (button.dataset.refView) action("view", { view: button.dataset.refView, id: selectedId }); else if (button.dataset.refCamera) action("refinement-camera", { command: button.dataset.refCamera }); else if (commands[button.dataset.refCommand]) track(Promise.resolve().then(() => commands[button.dataset.refCommand]())).catch((error) => status(error.message)); });
    listen(root, "submit", (event) => { const form = event.target.closest("[data-ref-form]"); if (!form) return; event.preventDefault(); try { if (form.dataset.refForm === "measure") measure(typedPoints(), field("measure-type").value); else helper(); } catch (error) { status(error.message); } });
    listen(field("compare-file"), "change", () => track(importComparison(field("compare-file").files[0])).catch((error) => { output("compare").textContent = error.message; }));
    listen(field("theme"), "change", renderTheme);
    listen(field("ar-anchor"), "change", () => { populateLandmarks(); renderAnchors({ ...currentState, ...(getState() || {}) }); });
    listen(field("reduced-motion"), "change", () => { try { preferences(); } catch (error) { status(error.message); } });
    listen(field("lighting"), "change", () => action("refinement-lighting", { lighting: field("lighting").value, preset: ({ guide: "guide", day: "observe", evening: "evening" })[field("lighting").value] }));
    listen(root.querySelector(".refinement-camera"), "keydown", (event) => { const directions = { ArrowUp: "move-north", ArrowDown: "move-south", ArrowLeft: "move-west", ArrowRight: "move-east", "+": "zoom-in", "=": "zoom-in", "-": "zoom-out" }; if (directions[event.key]) { event.preventDefault(); action("refinement-camera", { command: directions[event.key] }); } });
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)"); field("reduced-motion").checked = mediaQuery?.matches === true;
    if (mediaQuery?.addEventListener) listen(mediaQuery, "change", () => { field("reduced-motion").checked = mediaQuery.matches; preferences(); });
    if (field("reduced-motion").checked) preferences();
    renderNavigation(); renderLegend(); renderMedia(); renderDiagnostics(); output("theme").append(element("li", "주제를 선택하면 공개된 등록 대상과 기준일을 확인합니다."));
    return { update(next = {}) { if (destroyed) return; currentState = { ...currentState, ...next }; if (next.catalog && next.catalog !== catalog) { catalog = next.catalog; navigationKey = legendKey = mediaKey = ""; command("compare-other").disabled = !comparison; } if (Object.prototype.hasOwnProperty.call(next, "selectedId")) selectedId = next.selectedId; if (next.mediaRecords) media = list(next.mediaRecords); if (next.measureResult) displayMeasurement(next.measureResult, "3D 선택점"); if (next.floorStatus) output("floor").textContent = next.floorStatus; if (next.xrStatus) output("xr").textContent = next.xrStatus; if (next.refinementStatus) status(next.refinementStatus); renderNavigation(); renderLegend(); renderMedia(); renderDiagnostics(); if (next.offlineStatus) output("offline").textContent = next.offlineStatus; if (next.assistantStatus) output("assistant").textContent = next.assistantStatus; }, get comparison() { return comparison; }, whenIdle: () => Promise.allSettled(Array.from(pending)), destroy() { if (destroyed) return; destroyed = true; root.querySelectorAll("audio,video").forEach((item) => item.pause()); listeners.splice(0).forEach((remove) => remove()); root.remove(); } };
  }
  window.CampusRefinementControls = { initialize, publicEntity };
})();
