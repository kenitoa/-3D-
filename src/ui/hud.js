// Vanilla JavaScript UI layer: Babylon.js GUI 2D AdvancedDynamicTexture only.
const GUI = window.BABYLON?.GUI;
window.CampusHud = {};

function text(name, value, size, color = "#173625", weight = "normal") {
  const block = new GUI.TextBlock(name, value);
  block.color = color;
  block.fontFamily = "Arial, Malgun Gothic, sans-serif";
  block.fontSize = size;
  block.fontWeight = weight;
  block.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  block.textWrapping = true;
  block.resizeToFit = false;
  return block;
}

function belongsToNode(mesh, root) {
  let current = mesh;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

function buildingMeshes(scene, mesh) {
  const root = mesh.parent || mesh;
  return (scene.meshes || []).filter((candidate) => candidate === mesh || belongsToNode(candidate, root));
}

function connectHover(scene, targets, badge) {
  let hideTimer = 0;
  const show = () => {
    window.clearTimeout(hideTimer);
    badge.isVisible = true;
  };
  const hide = () => {
    hideTimer = window.setTimeout(() => {
      badge.isVisible = false;
    }, 60);
  };

  if (BABYLON.ActionManager && BABYLON.ExecuteCodeAction) {
    targets.forEach((target) => {
      target.actionManager = target.actionManager || new BABYLON.ActionManager(scene);
      target.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, show));
      target.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, hide));
    });
  }
}

function connectClick(scene, targets, action) {
  if (!BABYLON.ActionManager || !BABYLON.ExecuteCodeAction) return () => {};
  const actions = [];
  targets.forEach((target) => {
    target.isPickable = true;
    target.actionManager = target.actionManager || new BABYLON.ActionManager(scene);
    target.actionManager.hoverCursor = "pointer";
    const manager = target.actionManager;
    const registered = manager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, action));
    actions.push(() => manager.unregisterAction(registered));
  });
  return () => actions.forEach((release) => release());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

const KIND_LABELS = {
  cafe: "카페/상업",
  childcare: "보육",
  corridor: "복도/연결",
  dining: "식당",
  dorm: "기숙",
  entry: "출입",
  gallery: "전시/제작",
  gym: "체육",
  hall: "홀/강당",
  lab: "실습",
  lecture: "강의",
  library: "자료/서고",
  lobby: "로비",
  lounge: "라운지",
  marker: "핵심 표식",
  office: "행정/연구",
  outside: "외부",
  restroom: "화장실",
  service: "서비스",
  studio: "스튜디오",
  support: "지원"
};

function kindLabel(kind) {
  return KIND_LABELS[kind] || "공간";
}

function inferZoneFloor(zone, data) {
  if (zone.floor || zone.level) return zone.floor || zone.level;
  const textValue = `${zone.id || ""} ${zone.label || ""}`.toLowerCase();
  const sourceFloor = String(data?.floor || "");
  if (zone.kind === "outside" || /outside|parking|stadium|playground|bus|주차|운동장|놀이터|버스|외부|도로/.test(textValue)) return "외부";
  if (/b1|지하|basement/.test(textValue)) return "B1";
  if (/5f|5층/.test(textValue)) return "5F";
  if (/4f|4층/.test(textValue)) return "4F";
  if (/3f|3층/.test(textValue)) return "3F";
  if (/2f|2층|203|204|2202|2203|2204|2207|2208|2209|2210/.test(textValue)) return "2F";
  if (/1f|1층|현관|로비|출입|식당|주방|편의점|cu|보건실|우체국|교목실|4106|유사홀|7108|총무팀|aed|열람실/.test(textValue)) return "1F";
  if (/생활관|기숙|성빈|신관|구관|2인실|3인실|세탁|독서|전산|체력|탁구|기도|세미나/.test(textValue) || /생활관/.test(sourceFloor)) return "생활관";
  return "공통";
}

function floorSortValue(floor) {
  const order = { B1: 0, "1F": 1, "2F": 2, "3F": 3, "4F": 4, "5F": 5, 생활관: 6, 외부: 8, 공통: 9 };
  return order[floor] ?? 7;
}

function groupedFloorData(data) {
  const groups = new Map();
  (data.floors || []).forEach((floor) => {
    if (!groups.has(floor)) groups.set(floor, []);
  });
  (data.zones || []).forEach((zone) => {
    const floor = inferZoneFloor(zone, data);
    if (!groups.has(floor)) groups.set(floor, []);
    groups.get(floor).push(zone);
  });
  return Array.from(groups.entries())
    .map(([floor, zones]) => ({ floor, zones }))
    .sort((a, b) => floorSortValue(a.floor) - floorSortValue(b.floor) || a.floor.localeCompare(b.floor));
}

function floorZoneHtml(zone, index) {
  const style = `left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%;`;
  const label = escapeHtml(zone.label).replace(/\n/g, "<br>");
  return `
    <div class="floor-zone" data-kind="${escapeHtml(zone.kind)}" data-zone="${escapeHtml(zone.id || `zone-${index + 1}`)}" style="${style}">
      <span class="zone-door" aria-hidden="true"></span>
      <span class="zone-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="zone-fixture" aria-hidden="true"></span>
      <span class="zone-label">${label}</span>
      <span class="zone-kind">${escapeHtml(kindLabel(zone.kind))}</span>
    </div>`;
}

function floorTabsHtml(floors) {
  return floors.map((group, index) => `
    <button class="floor-tab${index === 0 ? " is-active" : ""}" type="button" role="tab" id="interior-tab-${index}" aria-controls="interior-layer-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-floor-target="${escapeHtml(group.floor)}">
      <span>${escapeHtml(group.floor)}</span><em>${group.zones.length}구역</em>
    </button>`).join("");
}

function floorLayersHtml(floors, title) {
  return floors.map((group, index) => `
    <div class="floor-layer" role="tabpanel" id="interior-layer-${index}" aria-labelledby="interior-tab-${index}" tabindex="0" data-floor-layer="${escapeHtml(group.floor)}"${index === 0 ? "" : " hidden"}>
      <div class="floor-layer-title">${escapeHtml(title)} · ${escapeHtml(group.floor)}</div>
      ${group.zones.length ? group.zones.map(floorZoneHtml).join("") : `<div class="floor-empty">공개자료에서 확인된 실 배치가 아직 없습니다.</div>`}
    </div>`).join("");
}

function footprintHtml(data) {
  return (data.footprints || []).map((shape) => {
    const style = `left:${shape.x}%;top:${shape.y}%;width:${shape.w}%;height:${shape.h}%;`;
    return `
      <div class="footprint-block" data-shape="${escapeHtml(shape.shape || "rect")}" data-kind="${escapeHtml(shape.kind || "main")}" style="${style}">
        <span>${escapeHtml(shape.label || "")}</span>
      </div>`;
  }).join("");
}

function legendHtml(zones) {
  const kinds = Array.from(new Set((zones || []).map((zone) => zone.kind))).filter(Boolean);
  return kinds.map((kind) => `
    <span class="legend-item" data-kind="${escapeHtml(kind)}">
      <span class="legend-swatch"></span>${escapeHtml(kindLabel(kind))}
    </span>`).join("");
}

function roomCardsHtml(rooms) {
  return (rooms || []).map((room, index) => `
    <li class="room-card">
      <span class="room-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="room-text"><strong>${escapeHtml(room.name)}</strong><em>${escapeHtml(room.use)}</em></span>
    </li>`).join("");
}

function createInteriorDetailController(scene, camera) {
  const panel = document.getElementById("buildingDetail");
  if (!panel) {
    return { registerInterior: () => {}, hide: () => {}, openInterior: () => false, openData: () => {}, setLifecycle: () => {}, setPickingEnabled: () => {}, dispose: () => {} };
  }
  const registry = new Map();
  let previousFocus = null;
  let snapshot = null;
  let openedId = null;
  let backgroundState = [];
  let lifecycle = {};
  let disposed = false;
  let pickingEnabled = true;
  const releasePicking = new Map();
  const captureCamera = () => {
    if (!camera) return null;
    const saved = {};
    ["position", "rotation", "rotationQuaternion"].forEach((key) => {
      if (camera[key] && typeof camera[key].clone === "function") saved[key] = camera[key].clone();
    });
    if (typeof camera.getTarget === "function") saved.target = camera.getTarget().clone();
    ["alpha", "beta", "radius", "mode", "orthoLeft", "orthoRight", "orthoTop", "orthoBottom"].forEach((key) => {
      if (camera[key] !== undefined) saved[key] = camera[key];
    });
    return saved;
  };
  const restoreCamera = (saved) => {
    if (!camera || !saved) return;
    if (saved.target && typeof camera.setTarget === "function") camera.setTarget(saved.target);
    Object.entries(saved).forEach(([key, value]) => {
      if (key === "target") return;
      if (value && typeof value.clone === "function" && camera[key] && typeof camera[key].copyFrom === "function") camera[key].copyFrom(value);
      else camera[key] = value;
    });
  };
  const hide = () => {
    if (disposed || panel.hidden) return;
    panel.hidden = true;
    panel.innerHTML = "";
    backgroundState.forEach(([element, wasInert]) => { element.inert = wasInert; });
    backgroundState = [];
    if (typeof lifecycle.restore === "function") lifecycle.restore(snapshot);
    else restoreCamera(snapshot);
    if (typeof lifecycle.onClose === "function") lifecycle.onClose(openedId);
    snapshot = null;
    openedId = null;
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
    else document.getElementById("renderCanvas")?.focus();
    previousFocus = null;
  };
  const open = (data, focus, id) => {
    if (disposed) return false;
    if (panel.hidden) {
      previousFocus = document.activeElement;
      snapshot = typeof lifecycle.capture === "function" ? lifecycle.capture() : captureCamera();
      backgroundState = Array.from(document.body.children)
        .filter((element) => element !== panel && !["SCRIPT", "NOSCRIPT"].includes(element.tagName))
        .map((element) => [element, !!element.inert]);
      backgroundState.forEach(([element]) => { element.inert = true; });
    }
    openedId = id || String(data.id || "").replace(/-interior$/, "");
    if (typeof focus === "function") focus();
    const floors = groupedFloorData(data);
    const floorTabs = floorTabsHtml(floors);
    const floorLayers = floorLayersHtml(floors, data.title || "내부도");
    const footprints = footprintHtml(data);
    const legend = legendHtml(data.zones || []);
    const confirmed = (data.confirmed || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const rooms = roomCardsHtml(data.rooms || []);
    panel.innerHTML = `
      <div class="detail-main">
        <header class="detail-head">
          <div>
            <div class="detail-kicker">
              <span class="detail-badge">${escapeHtml(data.floor || "1F")}</span>
              <span class="detail-count">${floors.length}개 층 · ${(data.zones || []).length}개 구역 · ${(data.rooms || []).length}개 핵심 공간</span>
            </div>
            <h2 id="interiorDetailTitle" class="detail-title">${escapeHtml(data.title)}</h2>
            <p class="detail-subtitle">${escapeHtml(data.subtitle || "")}</p>
          </div>
          <button class="detail-close" type="button" aria-label="상세 화면 닫기">×</button>
        </header>
        <div class="detail-plan-wrap">
          <div class="floor-tabs" role="tablist" aria-label="층 선택">${floorTabs}</div>
          <div class="detail-floor" aria-label="${escapeHtml(data.title)} 평면 배치도">
            <div class="floor-frame" aria-hidden="true"></div>
            <div class="footprint-layer" aria-hidden="true">${footprints}</div>
            <div class="floor-core-line floor-core-line-x" aria-hidden="true"></div>
            <div class="floor-core-line floor-core-line-y" aria-hidden="true"></div>
            ${floorLayers}
            <div class="plan-scale">공개자료 기반 추정 배치 · 방위·실측 치수 미확인</div>
          </div>
          <div class="detail-legend">${legend}</div>
        </div>
      </div>
      <aside class="detail-aside">
        <section class="detail-card">
          <h3>외부와의 연결</h3>
          <p>선택한 건물의 외관 모델과 연결된 내부 정보입니다. 현관·층별 외부 출입구의 정확한 위치, 지형 단차와 운영 상태는 추가 확인이 필요합니다.</p>
        </section>
        <section class="detail-card">
          <h3>확인된 내부 요소</h3>
          <ul>${confirmed}</ul>
        </section>
        <section class="detail-card detail-card-rooms">
          <h3>공간 구성</h3>
          <ul class="room-card-list">${rooms}</ul>
        </section>
        <section class="detail-card">
          <h3>자료 기준</h3>
          <p>${escapeHtml(data.source || "")}</p>
        </section>
        <section class="detail-card">
          <h3>배치 기준</h3>
          <p>${escapeHtml(data.note || "")}</p>
        </section>
      </aside>`;
    panel.hidden = false;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "interiorDetailTitle");
    const close = panel.querySelector(".detail-close");
    if (close) close.addEventListener("click", hide, { once: true });
    const selectFloor = (tab) => {
        const target = tab.getAttribute("data-floor-target");
        panel.querySelectorAll(".floor-tab").forEach((button) => {
          button.classList.toggle("is-active", button === tab);
          button.setAttribute("aria-selected", String(button === tab));
          button.tabIndex = button === tab ? 0 : -1;
        });
        panel.querySelectorAll(".floor-layer").forEach((layer) => {
          layer.hidden = layer.getAttribute("data-floor-layer") !== target;
        });
    };
    panel.querySelectorAll(".floor-tab").forEach((tab) => {
      tab.addEventListener("click", () => selectFloor(tab));
      tab.addEventListener("keydown", (event) => {
        const tabs = Array.from(panel.querySelectorAll(".floor-tab"));
        const index = tabs.indexOf(tab);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); selectFloor(tabs[next]); tabs[next].focus(); }
      });
    });
    if (typeof lifecycle.onOpen === "function") lifecycle.onOpen(openedId);
    close?.focus();
  };

  const keydown = (event) => {
    if (disposed || panel.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); hide(); return; }
    if (event.key === "Tab") {
      const controls = Array.from(panel.querySelectorAll("button, a[href], input, select, textarea, [tabindex]"))
        .filter((element) => !element.disabled && element.tabIndex >= 0 && !element.closest("[hidden]"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
  };
  document.addEventListener("keydown", keydown);

  return {
    hide,
    dispose() { if (disposed) return; hide(); disposed = true; document.removeEventListener("keydown", keydown); registry.clear(); releasePicking.forEach((release) => release()); releasePicking.clear(); lifecycle = {}; },
    setLifecycle: (callbacks) => { lifecycle = callbacks || {}; },
    setPickingEnabled: (enabled) => { pickingEnabled = enabled === true; },
    openData: (data) => open(data),
    openInterior: (id) => {
      if (disposed) return false;
      const entry = registry.get(id) || registry.get(String(id).replace(/-interior$/, ""));
      if (!entry) return false;
      open(entry.data, entry.focus, entry.id);
      return true;
    },
    registerInterior: (mesh, data, focus, buildingId) => {
      if (disposed) return;
      const id = buildingId || String(data.id || "").replace(/-interior$/, "");
      const entry = { id, data, focus };
      registry.set(id, entry);
      if (data.id) registry.set(data.id, entry);
      releasePicking.get(id)?.(); releasePicking.delete(id);
      if (scene && mesh) {
        const release = connectClick(scene, buildingMeshes(scene, mesh), () => { if (pickingEnabled) open(data, focus, id); });
        releasePicking.set(id, release);
        mesh.onDisposeObservable?.addOnce(() => { if (releasePicking.get(id) === release) { release(); releasePicking.delete(id); } });
      }
    }
  };
}

function labelForMesh(ui, scene, mesh, label, color = "#183a29") {
  const badge = new GUI.Rectangle(`building-label-${label}`);
  badge.width = `${Math.max(96, Math.min(178, label.length * 15 + 26))}px`;
  badge.height = "28px";
  badge.cornerRadius = 4;
  badge.thickness = 1;
  badge.color = "#f5f0d8";
  badge.background = color;
  badge.alpha = 0.92;
  badge.linkOffsetY = -42;
  badge.isPointerBlocker = false;
  badge.isVisible = false;
  badge.linkWithMesh(mesh);
  ui.addControl(badge);

  const caption = text(`building-label-text-${label}`, label, 13, "#fff8dc", "800");
  caption.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  caption.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  caption.textWrapping = false;
  badge.addControl(caption);
  connectHover(scene, buildingMeshes(scene, mesh), badge);
  return badge;
}

window.CampusHud.createHud = function createHud(scene, camera, _campusInfo, _buildings, _janggongResearch, _focusJanggong) {
  const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("campus-ui", true, scene);
  ui.idealWidth = 1440;
  ui.idealHeight = 900;
  ui.renderAtIdealSize = true;
  const detail = createInteriorDetailController(scene, camera);

  return {
    ui,
    labelForMesh: (mesh, label, color) => labelForMesh(ui, scene, mesh, label, color),
    registerInterior: (mesh, data, focus, id) => detail.registerInterior(mesh, data, focus, id),
    openInterior: (id) => detail.openInterior(id),
    setInteriorLifecycle: (callbacks) => detail.setLifecycle(callbacks),
    setPickingEnabled: (enabled) => detail.setPickingEnabled(enabled),
    hideInterior: () => detail.hide(),
    dispose: () => { detail.dispose(); ui.dispose(); }
  };
};

window.CampusHud.createTextInteriorController = () => createInteriorDetailController(null, null);
