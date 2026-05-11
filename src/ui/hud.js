// Vanilla JavaScript UI layer: Babylon.js GUI 2D AdvancedDynamicTexture only.
const GUI = BABYLON.GUI;
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
  if (!BABYLON.ActionManager || !BABYLON.ExecuteCodeAction) return;
  targets.forEach((target) => {
    target.isPickable = true;
    target.actionManager = target.actionManager || new BABYLON.ActionManager(scene);
    target.actionManager.hoverCursor = "pointer";
    target.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, action));
  });
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
    <button class="floor-tab${index === 0 ? " is-active" : ""}" type="button" data-floor-target="${escapeHtml(group.floor)}">
      <span>${escapeHtml(group.floor)}</span><em>${group.zones.length}구역</em>
    </button>`).join("");
}

function floorLayersHtml(floors, title) {
  return floors.map((group, index) => `
    <div class="floor-layer" data-floor-layer="${escapeHtml(group.floor)}"${index === 0 ? "" : " hidden"}>
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

function createInteriorDetailController(scene) {
  const panel = document.getElementById("buildingDetail");
  if (!panel) {
    return { registerInterior: () => {}, hide: () => {} };
  }

  const hide = () => {
    panel.hidden = true;
    panel.innerHTML = "";
  };

  const open = (data) => {
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
            <h2 class="detail-title">${escapeHtml(data.title)}</h2>
            <p class="detail-subtitle">${escapeHtml(data.subtitle || "")}</p>
          </div>
          <button class="detail-close" type="button" aria-label="상세 화면 닫기">×</button>
        </header>
        <div class="detail-plan-wrap">
          <div class="floor-tabs" aria-label="층 선택">${floorTabs}</div>
          <div class="detail-floor" aria-label="${escapeHtml(data.title)} 평면 배치도">
            <div class="floor-frame" aria-hidden="true"></div>
            <div class="footprint-layer" aria-hidden="true">${footprints}</div>
            <div class="floor-core-line floor-core-line-x" aria-hidden="true"></div>
            <div class="floor-core-line floor-core-line-y" aria-hidden="true"></div>
            ${floorLayers}
            <div class="plan-compass" aria-hidden="true"><span>N</span></div>
            <div class="plan-scale" aria-hidden="true"><span></span>공개자료 기반 축소 평면</div>
          </div>
          <div class="detail-legend">${legend}</div>
        </div>
      </div>
      <aside class="detail-aside">
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
    const close = panel.querySelector(".detail-close");
    if (close) close.addEventListener("click", hide, { once: true });
    panel.querySelectorAll(".floor-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-floor-target");
        panel.querySelectorAll(".floor-tab").forEach((button) => {
          button.classList.toggle("is-active", button === tab);
        });
        panel.querySelectorAll(".floor-layer").forEach((layer) => {
          layer.hidden = layer.getAttribute("data-floor-layer") !== target;
        });
      });
    });
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) hide();
  });

  return {
    hide,
    registerInterior: (mesh, data, focus) => connectClick(scene, buildingMeshes(scene, mesh), () => {
      if (typeof focus === "function") focus();
      open(data);
    })
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

function createScaleBar(ui, scale) {
  const panel = new GUI.StackPanel("scale-panel");
  panel.width = "300px";
  panel.height = "78px";
  panel.paddingLeft = "24px";
  panel.paddingBottom = "22px";
  panel.spacing = 5;
  panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  ui.addControl(panel);

  const title = text("scale-title", `축척 ${scale.designScale}`, 15, "#173625", "800");
  title.height = "22px";
  panel.addControl(title);

  const barWrap = new GUI.Rectangle("scale-bar-wrap");
  barWrap.width = "240px";
  barWrap.height = "24px";
  barWrap.thickness = 0;
  barWrap.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(barWrap);

  const bar = new GUI.Rectangle("scale-bar");
  bar.width = "220px";
  bar.height = "8px";
  bar.thickness = 0;
  bar.background = "#173625";
  bar.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  bar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  barWrap.addControl(bar);

  [0, 1].forEach((side) => {
    const tick = new GUI.Rectangle(`scale-tick-${side}`);
    tick.width = "3px";
    tick.height = "22px";
    tick.thickness = 0;
    tick.background = "#173625";
    tick.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    tick.left = side ? "217px" : "0px";
    barWrap.addControl(tick);
  });

  const meter = text("scale-meter", `${scale.scaleBarMeters}m · 1 unit = ${scale.babylonUnitMeters}m`, 13, "#345440", "700");
  meter.height = "20px";
  panel.addControl(meter);
}

window.CampusHud.createHud = function createHud(scene, camera, campusInfo, buildings, janggongResearch, focusJanggong) {
  const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("campus-ui", true, scene);
  ui.idealWidth = 1440;
  ui.idealHeight = 900;
  ui.renderAtIdealSize = true;
  createScaleBar(ui, CampusData.scale);
  const detail = createInteriorDetailController(scene);

  return {
    ui,
    labelForMesh: (mesh, label, color) => labelForMesh(ui, scene, mesh, label, color),
    registerInterior: (mesh, data, focus) => detail.registerInterior(mesh, data, focus),
    hideInterior: () => detail.hide()
  };
};
