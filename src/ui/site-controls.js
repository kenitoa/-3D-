/* Accessible DOM controls complement the existing Babylon canvas and interior views. */
(function attachSiteControls() {
  "use strict";

  const VIEW_NAMES = { overview: "전체 조감도", top: "위에서 보기", free: "자유 탐색" };
  const CONFIDENCE_NAMES = { verified: "공식자료 확인", mapped: "지도 자료 기반", estimated: "자료 기반 추정", unknown: "미확인" };
  const LAYER_NAMES = { boundary: "부지 안내 경계", trees: "수목", labels: "건물 이름", contours: "등고선" };
  let activeController = null;

  function safeSourceUrl(value) {
    try {
      const parsed = new URL(String(value));
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  }

  function normalizeBuilding(building) {
    return {
      ...building,
      id: String(building.id || building.legacyKey || building.key || ""),
      name: String(building.name || building.title || "이름 미확인"),
      number: String(building.number || building.no || ""),
      aliases: Array.isArray(building.aliases) ? building.aliases.map(String) : []
    };
  }

  function buildingMatches(building, query) {
    const normalized = String(query).trim().toLocaleLowerCase("ko").replace(/\s+/g, "");
    return !normalized || [building.name, building.number, ...building.aliases]
      .some((value) => String(value).toLocaleLowerCase("ko").replace(/\s+/g, "").includes(normalized));
  }

  function initialize(options = {}) {
    if (activeController) activeController.destroy();
    const root = document.getElementById("siteControls");
    if (!root) return null;
    const buildings = (options.buildings || []).map(normalizeBuilding).filter((building) => building.id);
    const evidence = options.evidence || {};
    const actions = typeof options.onAction === "function" ? options.onAction : () => {};
    const listeners = [];
    const state = { view: "overview", status: "loading", selectedId: null, layers: { boundary: true, trees: true, labels: true, contours: false }, exaggeration: 1 };
    let destroyed = false;
    let dismissedError = false;
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      listeners.push(() => target.removeEventListener(type, callback));
    };
    const q = (selector) => root.querySelector(selector);

    root.innerHTML = `
      <button class="site-panel-toggle" type="button" aria-expanded="true" aria-controls="campusTools">캠퍼스 탐색 <span aria-hidden="true">⌃</span></button>
      <div id="campusTools" class="site-panel-body">
        <button class="site-inline-retry" type="button" data-action="retry-inline" hidden>3D 다시 시도</button>
        <nav class="site-view-tabs" aria-label="캠퍼스 보기 방식">
          <button class="scene-control" type="button" data-view="overview" aria-pressed="true">전체 조감도</button>
          <button class="scene-control" type="button" data-view="top" aria-pressed="false">위에서 보기</button>
          <button class="scene-control" type="button" data-view="free" aria-pressed="false">자유 탐색</button>
        </nav>
        <div class="site-camera-tools" role="group" aria-label="카메라 조작">
          <button class="scene-control" type="button" data-action="reset" title="전체 부지가 보이도록 초기화">전체 보기</button>
          <button class="scene-control icon-control" type="button" data-action="zoom-in" aria-label="확대">＋</button>
          <button class="scene-control icon-control" type="button" data-action="zoom-out" aria-label="축소">−</button>
          <button class="scene-control icon-control" type="button" data-action="rotate-left" aria-label="왼쪽으로 회전">↶</button>
          <button class="scene-control icon-control" type="button" data-action="rotate-right" aria-label="오른쪽으로 회전">↷</button>
        </div>
        <p class="site-current-view">현재 보기: <strong data-current-view>전체 조감도</strong></p>
        <details class="site-section" open>
          <summary>건물 찾기 <span data-building-count></span></summary>
          <div class="site-section-body">
            <label class="site-search-label" for="campusBuildingSearch">건물 이름·번호 검색</label>
            <input id="campusBuildingSearch" class="site-search" type="search" placeholder="예: 경삼관, 6동" autocomplete="off" aria-controls="campusBuildingList" aria-describedby="campusSearchCount">
            <p id="campusSearchCount" class="site-small" aria-live="polite"></p>
            <ul id="campusBuildingList" class="site-building-list" aria-label="캠퍼스 건물 목록"></ul>
            <p class="site-no-results" hidden>검색 결과가 없습니다. 이름이나 건물 번호를 확인해 주세요.</p>
          </div>
        </details>
        <section class="site-selected" aria-labelledby="selectedBuildingName" hidden>
          <div class="site-selected-head"><h2 id="selectedBuildingName"></h2><button type="button" data-action="clear-selection" aria-label="건물 선택 해제">×</button></div>
          <p data-selected-role></p>
          <p class="site-confidence" data-selected-confidence></p>
          <p class="site-small" data-selected-entrance></p>
          <button class="scene-control site-interior-button" type="button" data-action="interior">건물 내부 상세 보기</button>
        </section>
        <details class="site-section">
          <summary>표시 설정</summary>
          <div class="site-section-body site-layers">
            <label><input type="checkbox" data-layer="boundary" checked> 부지 안내 경계</label>
            <label><input type="checkbox" data-layer="trees" checked> 수목</label>
            <label><input type="checkbox" data-layer="labels" checked> 건물 이름</label>
            <label><input type="checkbox" data-layer="contours"> 등고선</label>
            <label class="site-exaggeration-label" for="campusExaggeration">지형 높이 <output id="campusExaggerationValue" for="campusExaggeration">1.0배</output></label>
            <input id="campusExaggeration" class="scene-control" type="range" min="1" max="2" step="0.25" value="1" aria-describedby="campusHeightNote">
            <p id="campusHeightNote" class="site-small">1배는 수평·수직 비율이 같습니다. 실제 지형과 세부 단차는 추정이 포함됩니다.</p>
          </div>
        </details>
        <details class="site-section">
          <summary>조감도 범례</summary>
          <ul class="site-legend site-section-body">
            <li><span class="site-symbol boundary-symbol" aria-hidden="true"></span>지도 기반 캠퍼스 안내 경계</li>
            <li><span class="site-symbol verified-symbol" aria-hidden="true"></span>확인된 공간·연결 정보</li>
            <li><span class="site-symbol estimated-symbol" aria-hidden="true"></span>추정 공간·연결 정보</li>
            <li><span class="site-symbol road-symbol" aria-hidden="true"></span>차량 도로</li>
            <li><span class="site-symbol walk-symbol" aria-hidden="true"></span>보행로 / 단차가 있는 계단</li>
            <li><span class="site-symbol green-symbol" aria-hidden="true"></span>녹지·수목</li>
            <li><span class="site-symbol sport-symbol" aria-hidden="true"></span>운동장·체육 공간</li>
            <li><span class="site-symbol parking-symbol" aria-hidden="true">P</span>주차 공간</li>
          </ul>
        </details>
        <details class="site-section" data-evidence-panel>
          <summary>자료·부지 확인 수준</summary>
          <div class="site-section-body site-evidence">
            <p data-evidence-date></p>
            <p><strong data-boundary-label></strong><br><span data-boundary-note></span></p>
            <p data-coordinate-note></p>
            <p data-area-note></p>
            <dl class="site-boundary-types"><dt>캠퍼스 안내 영역</dt><dd>지도에서 학교 공간으로 안내하는 범위입니다.</dd><dt>도시계획시설 경계</dt><dd>공적 계획에서 정한 대학 시설 범위로, 해당 고시 도면을 별도로 대조해야 합니다.</dd><dt>필지·소유 경계</dt><dd>지적·소유 자료로 확인하는 범위이며 캠퍼스 안내 영역과 동일하다고 단정할 수 없습니다.</dd><dt>주변 표현 범위</dt><dd>접근 도로와 주변 지형을 설명하는 배경입니다.</dd></dl>
            <h3>반영 자료</h3><ul data-source-list></ul>
            <h3>추가 확인이 필요한 항목</h3><ul data-unknown-list></ul>
          </div>
        </details>
        <details class="site-section">
          <summary>조작 방법</summary>
          <div class="site-section-body site-small"><p>마우스 또는 한 손가락으로 회전하고, 휠 또는 두 손가락으로 확대·축소합니다. 위에서 보기에서는 드래그로 이동합니다.</p><p>키보드: Tab으로 버튼과 건물 목록을 이동하고 Enter로 선택합니다. 방향·확대 버튼으로 카메라를 조작할 수 있습니다. 내부 상세는 Esc로 닫습니다.</p><p>3D 화면 사용이 어려우면 건물 목록에서 건물 설명과 공개자료 기반 내부 정보를 확인할 수 있습니다.</p></div>
        </details>
        <button class="scene-control site-export" type="button" data-action="export">현재 조감도 이미지 저장</button>
        <p class="site-small site-export-status" data-export-status aria-live="polite"></p>
      </div>`;

    const setText = (selector, value) => { const element = q(selector); if (element) element.textContent = String(value || ""); };
    const announce = (message) => {
      const region = document.getElementById("campusAnnouncement");
      if (region) region.textContent = String(message || "");
    };
    const dispatch = (action, payload = {}) => {
      try {
        const result = actions(action, payload);
        if (result && typeof result.catch === "function") result.catch(() => announce("작업을 완료하지 못했습니다. 다시 시도해 주세요."));
      } catch {
        announce("작업을 완료하지 못했습니다. 다시 시도해 주세요.");
      }
    };

    const showSelection = (id) => {
      const building = buildings.find((item) => item.id === id);
      state.selectedId = building ? building.id : null;
      const section = q(".site-selected");
      section.hidden = !building;
      q(".site-building-list").querySelectorAll("button").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.buildingId === state.selectedId));
      });
      if (!building) return;
      setText("#selectedBuildingName", `${building.number ? `${building.number} · ` : ""}${building.name}`);
      setText("[data-selected-role]", building.description || building.role || "건물 외관과 주변 접근 공간을 확인할 수 있습니다.");
      setText("[data-selected-confidence]", `외부 배치: ${CONFIDENCE_NAMES[building.confidence] || "자료 기반 추정"} · 내부 실 배치는 공개자료 기반 추정`);
      const entrance = typeof building.entrance === "string" ? building.entrance : building.entrance?.note;
      setText("[data-selected-entrance]", entrance || "출입구·층별 외부 연결은 위치와 운영 상태를 현장에서 추가 확인해야 합니다.");
      q("[data-action=interior]").hidden = building.hasInterior === false;
      announce(`${building.name} 선택. ${CONFIDENCE_NAMES[building.confidence] || "자료 기반 추정"}`);
    };

    const renderBuildings = () => {
      const query = q(".site-search").value;
      const matches = buildings.filter((building) => buildingMatches(building, query));
      const list = q(".site-building-list");
      list.replaceChildren();
      matches.forEach((building) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.buildingId = building.id;
        button.setAttribute("aria-pressed", String(building.id === state.selectedId));
        const number = document.createElement("span");
        number.className = "site-building-number";
        number.textContent = building.number || "•";
        const name = document.createElement("span");
        name.textContent = building.name;
        button.append(number, name);
        li.append(button);
        list.append(li);
      });
      setText("#campusSearchCount", `${matches.length}개 건물${query ? ` · “${query}” 검색 결과` : ""}`);
      q(".site-no-results").hidden = matches.length !== 0;
    };

    const setStatus = (status, message) => {
      state.status = status;
      const overlay = document.getElementById("campusLoadStatus");
      const statusText = document.getElementById("campusLoadMessage");
      const retry = document.getElementById("campusRetry");
      const dismiss = document.getElementById("campusFallbackDismiss");
      const title = document.getElementById("campusLoadTitle");
      if (status !== "error") dismissedError = false;
      if (overlay) { overlay.hidden = status === "ready" || (status === "error" && dismissedError); overlay.dataset.status = status; }
      if (title) title.textContent = status === "error" ? "3D 화면을 표시하지 못했습니다" : "캠퍼스 조감도를 준비합니다";
      if (statusText) statusText.textContent = message || (status === "error" ? "건물 목록과 자료 안내는 계속 이용할 수 있습니다. WebGL을 사용할 수 있는 브라우저에서 다시 시도해 주세요." : "건물·부지·지형 데이터를 읽고 있습니다.");
      if (retry) retry.hidden = status !== "error";
      if (dismiss) dismiss.hidden = status !== "error";
      q(".site-inline-retry").hidden = status !== "error";
      root.querySelectorAll(".scene-control, [data-layer]").forEach((control) => { control.disabled = status !== "ready"; });
      // Interior data is independent of WebGL; make it available in the text fallback.
      q("[data-action=interior]").disabled = status === "loading";
      root.dataset.status = status;
      if (status === "error") {
        const body = q(".site-panel-body");
        body.hidden = false;
        q(".site-panel-toggle").setAttribute("aria-expanded", "true");
        announce(statusText?.textContent || "3D 화면 오류. 건물 목록에서 정보를 확인할 수 있습니다.");
      }
    };

    const update = (next = {}) => {
      if (destroyed) return;
      if (next.view && VIEW_NAMES[next.view]) {
        state.view = next.view;
        setText("[data-current-view]", VIEW_NAMES[state.view]);
        root.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
        const display = document.getElementById("campusViewBadge");
        if (display) display.textContent = VIEW_NAMES[state.view];
      }
      if (next.layers) {
        Object.assign(state.layers, next.layers);
        root.querySelectorAll("[data-layer]").forEach((input) => { input.checked = !!state.layers[input.dataset.layer]; });
      }
      if (Number.isFinite(next.exaggeration)) {
        state.exaggeration = next.exaggeration;
        q("#campusExaggeration").value = String(next.exaggeration);
        setText("#campusExaggerationValue", `${next.exaggeration.toFixed(2).replace(/0$/, "")}배`);
      }
      if (Object.prototype.hasOwnProperty.call(next, "selectedId")) showSelection(next.selectedId);
      if (Number.isFinite(next.northDegrees)) {
        const needle = document.getElementById("campusNorthNeedle");
        if (needle) needle.style.transform = `rotate(${next.northDegrees}deg)`;
        const north = document.getElementById("campusNorth");
        if (north) north.setAttribute("aria-label", `북쪽 방향: 화면 위에서 시계 방향 ${Math.round(((next.northDegrees % 360) + 360) % 360)}도`);
      }
      if (next.scale) {
        const { meters, pixels, approximate } = next.scale;
        const bar = document.getElementById("campusScaleBar");
        const label = document.getElementById("campusScaleLabel");
        const scale = document.getElementById("campusScale");
        const valid = Number.isFinite(meters) && meters > 0 && Number.isFinite(pixels) && pixels > 0;
        if (scale) scale.hidden = !valid;
        if (valid && bar && label) {
          bar.style.width = `${Math.min(pixels, 220)}px`;
          label.textContent = `${meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`}${approximate ? " · 화면 중심 기준" : ""}`;
          scale.setAttribute("aria-label", `${label.textContent}. 지도 자료 기준이며 측량값과 차이가 있을 수 있습니다.`);
        }
      }
      if (next.status) setStatus(next.status, next.message);
      if (next.exportStatus !== undefined) setText("[data-export-status]", next.exportStatus);
      if (next.message && !next.status) announce(next.message);
    };

    setText("[data-building-count]", `${buildings.length}개`);
    setText("[data-evidence-date]", `자료 확인일: ${evidence.referenceDate || "기준일 미확인"}`);
    setText("[data-boundary-label]", evidence.boundaryLabel || "캠퍼스 안내 영역");
    setText("[data-boundary-note]", evidence.boundaryNote || "지도상의 대학 영역을 표현하며 법적 소유 경계는 미확인입니다.");
    setText("[data-coordinate-note]", evidence.coordinateNote || "모든 공간은 동일한 모델 좌표 기준으로 표현합니다. 측량 정확도는 별도 검증이 필요합니다.");
    setText("[data-area-note]", evidence.areaNote || "기존 부지·주차 집계값은 대상 범위가 확인될 때까지 확정 수치로 사용하지 않습니다.");
    const dateBadge = document.getElementById("campusDataBadge");
    if (dateBadge) dateBadge.textContent = evidence.referenceDate ? `자료 ${evidence.referenceDate}` : "자료 기준일 미확인";
    (evidence.sources || []).forEach((source) => {
      const li = document.createElement("li");
      const url = safeSourceUrl(source.url);
      const title = document.createElement(url ? "a" : "strong");
      title.textContent = source.title || source.id || "출처";
      if (url) { title.href = url; title.target = "_blank"; title.rel = "noopener noreferrer"; }
      const note = document.createElement("span");
      note.textContent = ` · ${source.date || "기준일 미확인"} · ${CONFIDENCE_NAMES[source.confidence] || "자료 기준"}${source.scope ? ` — ${source.scope}` : ""}`;
      li.append(title, note);
      q("[data-source-list]").append(li);
    });
    const unknowns = evidence.unknown || ["법적 소유 경계", "세부 지형·실측 치수", "출입구 운영 상태", "전체 부속시설 및 주차 집계 범위"];
    unknowns.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = String(item);
      q("[data-unknown-list]").append(li);
    });

    listen(q(".site-panel-toggle"), "click", () => {
      const button = q(".site-panel-toggle");
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      q(".site-panel-body").hidden = !expanded;
      dispatch("resize", {});
    });
    listen(q(".site-search"), "input", renderBuildings);
    listen(q(".site-search"), "keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        const first = q(".site-building-list button");
        if (first) { event.preventDefault(); if (event.key === "Enter") first.click(); first.focus(); }
      }
    });
    listen(q(".site-building-list"), "click", (event) => {
      const button = event.target.closest("button[data-building-id]");
      if (!button) return;
      showSelection(button.dataset.buildingId);
      dispatch("select", { id: button.dataset.buildingId });
    });
    listen(q(".site-building-list"), "keydown", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const buttons = Array.from(q(".site-building-list").querySelectorAll("button"));
      const position = buttons.indexOf(button);
      const next = event.key === "ArrowDown" ? Math.min(position + 1, buttons.length - 1) : event.key === "ArrowUp" ? Math.max(position - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus(); }
    });
    listen(root, "click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.view) dispatch("view", { view: button.dataset.view });
      const action = button.dataset.action;
      if (action === "reset") dispatch("reset", {});
      if (action === "zoom-in" || action === "zoom-out") dispatch("zoom", { direction: action === "zoom-in" ? 1 : -1 });
      if (action === "rotate-left" || action === "rotate-right") dispatch("rotate", { direction: action === "rotate-left" ? -1 : 1 });
      if (action === "clear-selection") { showSelection(null); dispatch("select", { id: null }); }
      if (action === "interior" && state.selectedId) dispatch("interior", { id: state.selectedId });
      if (action === "export") { setText("[data-export-status]", "이미지를 준비합니다…"); dispatch("export", { view: state.view }); }
      if (action === "retry-inline") { dismissedError = false; dispatch("retry"); }
    });
    root.querySelectorAll("[data-layer]").forEach((input) => listen(input, "change", () => {
      state.layers[input.dataset.layer] = input.checked;
      dispatch("toggle", { layer: input.dataset.layer, enabled: input.checked });
      announce(`${LAYER_NAMES[input.dataset.layer]} ${input.checked ? "표시" : "숨김"}`);
    }));
    listen(q("#campusExaggeration"), "input", () => {
      const factor = Number(q("#campusExaggeration").value);
      update({ exaggeration: factor });
      dispatch("exaggeration", { factor });
    });
    const retry = document.getElementById("campusRetry");
    if (retry) listen(retry, "click", () => dispatch("retry"));
    const dismiss = document.getElementById("campusFallbackDismiss");
    if (dismiss) listen(dismiss, "click", () => {
      dismissedError = true;
      const overlay = document.getElementById("campusLoadStatus");
      if (overlay) overlay.hidden = true;
      q(".site-search").focus();
      announce("건물 목록과 자료 안내를 확인할 수 있습니다. 3D 다시 시도 버튼으로 화면을 다시 열 수 있습니다.");
    });
    const canvas = document.getElementById("renderCanvas");
    if (canvas) listen(canvas, "keydown", (event) => {
      if (event.key === "Escape") q(".site-panel-toggle").focus();
    });

    renderBuildings();
    if (window.innerWidth < 700) {
      q(".site-panel-toggle").setAttribute("aria-expanded", "false");
      q(".site-panel-body").hidden = true;
    }
    setStatus(options.status || "loading");
    activeController = {
      update, setStatus, announce,
      selectBuilding: showSelection,
      destroy() { destroyed = true; listeners.forEach((remove) => remove()); if (activeController === this) activeController = null; }
    };
    return activeController;
  }

  window.CampusSiteControls = { initialize, buildingMatches, safeSourceUrl };
}());
