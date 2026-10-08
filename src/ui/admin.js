/* Same-origin authenticated administration. Credentials and CSRF tokens remain in memory. */
(function attachAdmin() {
  "use strict";
  let active = null;
  function element(tag, text, attrs = {}) { const result = document.createElement(tag); if (text !== undefined) result.textContent = String(text); Object.entries(attrs).forEach(([key, value]) => result.setAttribute(key, String(value))); return result; }
  function rows(value) { return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []; }
  function initialize(options = {}) {
    if (active) active.destroy();
    const byId = (id) => document.getElementById(id);
    if (!byId("adminWorkspace")) return null;
    let user = null, csrf = null, revision = null, currentCatalog = null, catalogEditable = false, drafts = [], releases = [], reports = [], operations = [], providers = [], selectedDraft = null, selectedReport = null, selectedOperation = null, sessionEpoch = 0, busy = false, destroyed = false, spatialReview = null;
    const listeners = [], tasks = new Set(), controllers = new Set();
    const pagination = new Map();
    const listEndpoints = new Map([["/admin/drafts", "adminDraftSelect"], ["/admin/releases", "adminReleases"], ["/admin/reports", "adminReportSelect"], ["/admin/operations", "adminOperations"], ["/admin/providers", "adminProviders"]]);
    const pageControls = new Map();
    listEndpoints.forEach((id, path) => { const controls = element("nav", undefined, { class: "admin-pagination", "aria-label": `${({ adminDraftSelect: "초안", adminReleases: "공개판", adminReportSelect: "제보", adminOperations: "운영 기록", adminProviders: "자료 연동" })[id]} 목록 페이지` }); const previous = element("button", "이전 목록", { type: "button", "data-admin-page": path, "data-page-direction": "previous", disabled: "" }); const next = element("button", "다음 목록", { type: "button", "data-admin-page": path, "data-page-direction": "next", disabled: "" }); const info = element("span", "목록을 불러오면 페이지 정보를 확인할 수 있습니다.", { role: "status" }); controls.append(previous, info, next); const host = byId(id); (host.tagName === "SELECT" ? host.parentElement : host).after(controls); pageControls.set(path, { controls, previous, next, info }); });
    const domain = window.CampusPlatform;
    const listen = (target, name, callback) => { target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback)); };
    const message = (text, error = false) => { if (!destroyed) { byId("adminMessage").textContent = text; byId("adminMessage").dataset.error = String(error); } };
    const reviewRole = () => user && ["admin", "reviewer"].includes(user.role);
    const ownsDraft = () => selectedDraft && (user?.role === "admin" || selectedDraft.authorId === user?.id);
    const editableDraft = () => !selectedDraft || (ownsDraft() && ["draft", "rejected"].includes(selectedDraft.status));
    const apiBase = () => { const base = new URL(options.apiBase || "/api/v1", window.location.href); if (!/^https?:$/.test(base.protocol) || base.origin !== window.location.origin) throw new Error("관리 API는 같은 출처의 HTTP 서버에서만 사용할 수 있습니다."); return base.href.replace(/\/$/, ""); };
    const track = (promise) => { const task = Promise.resolve(promise); tasks.add(task); task.then(() => tasks.delete(task), () => tasks.delete(task)); return task; };
    function clearPrivate() { sessionEpoch++; user = null; csrf = null; revision = null; currentCatalog = null; catalogEditable = false; drafts = []; releases = []; reports = []; operations = []; providers = []; selectedDraft = null; selectedReport = null; selectedOperation = null; pagination.clear(); ["adminCatalog", "adminDraftSummary", "adminReportNote", "adminOperationTitle", "adminOperationOwner", "adminOperationStart", "adminOperationEnd"].forEach((id) => { byId(id).value = ""; }); ["adminReportDetail", "adminReleases", "adminOperations", "adminProviders", "adminValidation", "adminDiff", "adminSummary", "adminIntegrations"].forEach((id) => byId(id).replaceChildren()); ["adminDraftSelect", "adminReportSelect", "adminOperationEntity", "adminOperationSource"].forEach((id) => byId(id).replaceChildren()); byId("adminDraftInfo").textContent = ""; byId("adminOperationInfo").textContent = "새 운영 기록"; renderPermission(); }
    function renderPermission() {
      spatialReview?.update({ currentCatalog, editable: !!user && catalogEditable && editableDraft() && !busy, clear: !user });
      byId("adminLogin").hidden = !!user; byId("adminWorkspace").hidden = !user;
      byId("adminIdentity").textContent = user ? `${user.username} · ${user.role} · 공개 자료 revision ${revision ?? "미확인"}` : "";
      byId("adminScope").textContent = user ? `담당 범위: ${user.role === "admin" ? "관리자 전체 권한" : rows(user.campusIds).join(", ") || "범위 미제공"}` : "";
      ["adminCatalog", "adminDraftSummary", "adminCatalogFile", "adminValidate"].forEach((id) => { byId(id).disabled = busy || !user || !catalogEditable || !editableDraft(); });
      byId("adminUseCurrent").disabled = busy || !user || !catalogEditable;
      byId("adminSaveDraft").disabled = busy || !user || !catalogEditable || !editableDraft();
      byId("adminCatalogPermission").textContent = !user ? "로그인 후 자료 편집 범위를 확인합니다." : catalogEditable ? "전체 Catalog 담당 범위가 확인되었습니다." : "전체 Catalog 편집 권한이 없습니다. 공개 자료를 바탕으로 담당 범위의 제보·운영 목록을 이용할 수 있습니다. 전체 JSON 편집은 사용할 수 없습니다.";
      byId("adminPublish").disabled = busy || !reviewRole() || selectedDraft?.status !== "approved";
      document.querySelectorAll("[data-draft-action]").forEach((button) => { const action = button.dataset.draftAction; button.disabled = busy || !selectedDraft || (action === "submit" ? !ownsDraft() || !["draft", "rejected"].includes(selectedDraft.status) : !reviewRole() || selectedDraft.status !== "submitted" || (user.role !== "admin" && selectedDraft.authorId === user.id)); });
      byId("adminSaveReport").disabled = busy || !user || !selectedReport;
      byId("adminLoadReport").disabled = busy || !reports.length;
      byId("adminLoadDraft").disabled = busy || !drafts.length;
      byId("adminSaveOperation").disabled = busy || !reviewRole() || !byId("adminOperationEntity").options.length || !byId("adminOperationSource").options.length || !!selectedOperation && !Number.isInteger(selectedOperation.revision);
      byId("adminNewOperation").disabled = busy || !reviewRole();
      document.querySelectorAll("[data-operation-edit]").forEach((button) => { button.disabled = busy || !reviewRole(); });
      byId("adminOperationForm").querySelectorAll("input,select").forEach((input) => { input.disabled = busy || !reviewRole(); });
      document.querySelectorAll("[data-restore-release]").forEach((button) => { button.disabled = busy || user?.role !== "admin"; });
      document.querySelectorAll("[data-provider-sync]").forEach((button) => { button.disabled = busy || !user || button.dataset.providerEnabled !== "true"; });
      pageControls.forEach(({ previous, next, info }, path) => { const page = pagination.get(path); previous.disabled = busy || !user || !page || page.offset <= 0; next.disabled = busy || !user || !page || !page.hasMore || !Number.isInteger(page.nextOffset); info.textContent = page ? `${page.offset + 1}번째부터 최대 ${page.limit}개 · ${page.hasMore ? "다음 목록 있음" : "마지막 목록"}` : user ? "페이지 정보가 제공되지 않았습니다." : "로그인 후 목록을 확인할 수 있습니다."; });
    }
    async function request(path, method = "GET", body) {
      const controller = new AbortController(), epoch = sessionEpoch; controllers.add(controller); const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await window.fetch(`${apiBase()}${path}`, { method, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" && csrf ? { "X-CSRF-Token": csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
        const result = await response.json();
        if (epoch === sessionEpoch && Number.isInteger(result.meta?.revision)) revision = Math.max(revision || 0, result.meta.revision);
        if (!response.ok || result.error) { if (response.status === 401) clearPrivate(); const error = new Error(response.status === 401 ? "세션이 종료되어 비공개 화면 내용을 지웠습니다. 다시 로그인해 주세요." : result.error?.message || `요청 실패 (${response.status})`); error.code = result.error?.code || "REQUEST_FAILED"; error.status = response.status; throw error; }
        const key = path.split("?")[0], page = result.meta?.pagination;
        if (epoch === sessionEpoch && listEndpoints.has(key) && page && Number.isInteger(page.limit) && page.limit > 0 && Number.isInteger(page.offset) && page.offset >= 0 && typeof page.hasMore === "boolean") pagination.set(key, { limit: page.limit, offset: page.offset, hasMore: page.hasMore, nextOffset: Number.isInteger(page.nextOffset) && page.nextOffset > page.offset ? page.nextOffset : null });
        return result.data;
      } catch (error) { if (error.name === "AbortError") throw new Error("서버 응답 시간이 초과되었습니다. 편집 내용은 유지했습니다.", { cause: error }); if (error instanceof TypeError) throw new Error("API 서버에 연결할 수 없습니다. 서버 실행과 주소를 확인해 주세요.", { cause: error }); throw error; }
      finally { window.clearTimeout(timeout); controllers.delete(controller); }
    }
    async function mutation(run) {
      if (busy || destroyed) return;
      busy = true; renderPermission();
      try { await run(); }
      catch (error) { message(`${error.message}${error.code === "REVISION_CONFLICT" || error.code === "BASE_RELEASE_CHANGED" ? " 편집 내용은 유지했습니다. 최신 상태를 확인한 뒤 변경을 다시 검토해 주세요." : ""}`, true); }
      finally { busy = false; renderPermission(); }
    }
    function selectOptions(select, values, includeNew = false) { const previous = select.value; select.replaceChildren(); if (includeNew) select.append(element("option", "새 초안", { value: "" })); values.forEach((value) => select.append(element("option", value.label, { value: value.id }))); if (Array.from(select.options).some((option) => option.value === previous)) select.value = previous; }
    function renderLists() {
      selectOptions(byId("adminDraftSelect"), drafts.map((draft) => ({ id: draft.id, label: `${draft.status} · ${draft.summary} · v${draft.revision}` })), true);
      const target = byId("adminReleases"); target.replaceChildren(); releases.forEach((release) => { const row = element("li"); row.append(element("strong", release.summary || release.id), element("p", `${release.id} · ${release.createdAt || "시각 미제공"}`), element("a", "해당 공개판 조감도", { href: `index.html?release=${encodeURIComponent(release.id)}` }), element("button", "이 공개판으로 복구", { type: "button", "data-restore-release": release.id })); target.append(row); }); if (!releases.length) target.append(element("li", "등록된 공개판이 없습니다."));
      selectOptions(byId("adminReportSelect"), reports.map((report) => ({ id: report.id, label: `${report.status} · ${report.type} · ${report.id}` })));
      const operationTarget = byId("adminOperations"); operationTarget.replaceChildren(); operations.forEach((operation) => { const item = element("li", `${operation.title || operation.label} · ${operation.entityId} · ${operation.status || operation.state} · ${operation.startsAt || operation.validFrom} ~ ${operation.endsAt || operation.validUntil} · ${operation.owner || "담당 미확인"} · ${operation.visibility}${Date.parse(operation.endsAt || operation.validUntil) < Date.now() ? " · 기간 만료" : ""}`); item.append(element("button", "기록 선택·수정", { type: "button", "data-operation-edit": operation.id })); operationTarget.append(item); }); if (!operations.length) operationTarget.append(element("li", "등록된 운영 기록이 없습니다."));
      const scopedEntities = rows(currentCatalog?.entities).filter((entity) => user?.role === "admin" || rows(user?.campusIds).includes(entity.campusId));
      selectOptions(byId("adminOperationEntity"), scopedEntities.map((entity) => ({ id: entity.id, label: `${entity.displayTitle || entity.name} · ${entity.id}` })));
      selectOptions(byId("adminOperationSource"), rows(currentCatalog?.sources).map((source) => ({ id: source.id, label: source.title || source.id })));
      const providerTarget = byId("adminProviders"); providerTarget.replaceChildren(); providers.forEach((provider) => { const item = element("li"); item.append(element("strong", `${provider.id} · ${provider.kind}`), element("p", `캠퍼스 ${provider.campusId} · 출처 ${provider.sourceId} · 상태 ${provider.state || "미확인"} · 마지막 성공 ${provider.lastSuccessAt || "기록 없음"}${provider.errorCode ? ` · 오류 ${provider.errorCode}` : ""}`), element("button", "등록된 연동에서 검토 초안 가져오기", { type: "button", "data-provider-sync": provider.id, "data-provider-enabled": String(provider.enabled === true) })); providerTarget.append(item); }); if (!providers.length) providerTarget.append(element("li", "등록된 학교 시스템 연동이 없습니다."));
      renderPermission();
    }
    function renderStatus(status) {
      const summary = byId("adminSummary"); summary.replaceChildren();
      const values = { "현재 공개판": status.currentRelease || "미확인", "전역 변경 번호": status.catalogRevision ?? revision ?? "미확인", "제보 수": status.reportCount ?? "미확인", "서버 시작": status.startedAt || "미확인" };
      Object.entries(values).forEach(([title, value]) => summary.append(element("dt", title), element("dd", value)));
      const integrations = byId("adminIntegrations"); integrations.replaceChildren(); rows(status.integrations).forEach((integration) => integrations.append(element("li", `${integration.id} · ${integration.status || "미연결"} · 마지막 성공 ${integration.lastSuccessAt || "기록 없음"}`))); if (!integrations.children.length) integrations.append(element("li", "등록된 시스템 연동이 없습니다."));
    }
    async function refresh() {
      if (!user) return;
      const epoch = sessionEpoch, actorId = user.id;
      message("최신 자료·초안·제보·운영 상태를 확인합니다…");
      const catalogRequest = request("/admin/catalog").then((value) => ({ catalog: value, editable: true })).catch(async (error) => { if (error.status !== 403) throw error; return { catalog: await request("/catalog"), editable: false }; });
      const results = await Promise.allSettled([request("/admin/status"), catalogRequest, request(listPath("/admin/drafts")), request(listPath("/admin/releases")), request(listPath("/admin/reports")), request(listPath("/admin/operations")), request(listPath("/admin/providers"))]);
      if (destroyed || !user || epoch !== sessionEpoch || actorId !== user.id) return;
      if (results[0].status === "fulfilled") renderStatus(results[0].value);
      if (results[1].status === "fulfilled") { currentCatalog = results[1].value.catalog; catalogEditable = results[1].value.editable; } else catalogEditable = false;
      if (results[2].status === "fulfilled") { drafts = rows(results[2].value); if (selectedDraft) selectedDraft = drafts.find((draft) => draft.id === selectedDraft.id) || selectedDraft; }
      if (results[3].status === "fulfilled") releases = rows(results[3].value);
      if (results[4].status === "fulfilled") reports = rows(results[4].value);
      if (results[5].status === "fulfilled") operations = rows(results[5].value);
      if (results[6].status === "fulfilled") providers = rows(results[6].value);
      renderLists();
      const failures = results.filter((result) => result.status === "rejected");
      message(failures.length ? `일부 최신 정보를 확인하지 못했습니다. ${failures.map((result) => result.reason.message).join(" · ")}` : `최신 상태를 확인했습니다. 편집 중인 JSON은 자동 덮어쓰지 않습니다.${catalogEditable ? "" : " 전체 자료 편집 권한이 없어 공개 자료로 담당 제보·운영 목록을 제공합니다."}`, !!failures.length);
    }
    function listPath(path) { const page = pagination.get(path); return page && page.offset > 0 ? `${path}?limit=${page.limit}&offset=${page.offset}` : path; }
    async function navigateList(path, direction) { const page = pagination.get(path); if (!page || !listEndpoints.has(path)) return; const offset = direction === "previous" ? Math.max(0, page.offset - page.limit) : page.nextOffset; if (!Number.isInteger(offset)) return; await mutation(async () => { const values = rows(await request(`${path}?limit=${page.limit}&offset=${offset}`)); if (path === "/admin/drafts") drafts = values; else if (path === "/admin/releases") releases = values; else if (path === "/admin/reports") reports = values; else if (path === "/admin/operations") operations = values; else if (path === "/admin/providers") providers = values; renderLists(); message("선택한 목록 페이지를 불러왔습니다. 편집 중인 폼은 유지됩니다."); }); }
    async function session() {
      const epoch = sessionEpoch;
      try { const state = await request("/session"); if (epoch !== sessionEpoch || destroyed) return; user = state.user || null; csrf = state.csrfToken || null; byId("adminSetupNote").textContent = state.adminConfigured === false ? "관리 계정이 아직 설정되지 않았습니다. 서버 담당자가 계정 생성 절차를 먼저 완료해야 합니다." : "발급된 계정과 담당 캠퍼스 범위를 사용합니다."; renderPermission(); if (user) await refresh(); else message("로그인 후 담당 범위의 자료를 관리할 수 있습니다."); }
      catch (error) { if (epoch !== sessionEpoch || destroyed) return; clearPrivate(); message(`${error.message} 정적 조감도만 실행 중인 경우 관리 API 서버가 필요합니다.`, true); }
    }
    function prepareCurrent() { if (!currentCatalog || !catalogEditable) { message("최신 전체 Catalog와 담당 편집 범위를 먼저 확인해 주세요.", true); return; } selectedDraft = null; byId("adminDraftSelect").value = ""; byId("adminDraftSummary").value = ""; byId("adminCatalog").value = JSON.stringify(currentCatalog, null, 2); byId("adminDraftInfo").textContent = `새 초안 · 기준 revision ${revision}`; byId("adminValidation").replaceChildren(); byId("adminDiff").replaceChildren(); renderPermission(); }
    function loadDraft() { const draft = drafts.find((value) => value.id === byId("adminDraftSelect").value); if (!draft) { prepareCurrent(); return; } if (byId("adminCatalog").value && !window.confirm("선택한 초안의 JSON으로 편집 화면을 바꿀까요? 현재 입력은 대체됩니다.")) return; selectedDraft = draft; byId("adminCatalog").value = JSON.stringify(draft.catalog, null, 2); byId("adminDraftSummary").value = draft.summary; byId("adminDraftInfo").textContent = `${draft.id} · ${draft.status} · 초안 revision ${draft.revision} · 기준 공개 revision ${draft.baseRevision}. ${user.role !== "admin" && draft.authorId === user.id ? "본인 작성 초안은 다른 검토자가 승인해야 합니다." : ""}`; renderPermission(); validate(); }
    function validate() {
      const validationTarget = byId("adminValidation"), diffTarget = byId("adminDiff"); validationTarget.replaceChildren(); diffTarget.replaceChildren();
      try {
        const raw = byId("adminCatalog").value; if (raw.length > 2 * 1024 * 1024) throw new Error("Catalog JSON은 2MB 이하로 입력해 주세요.");
        const value = JSON.parse(raw); if (!domain?.validateCatalog) throw new Error("공간 자료 검증기를 불러오지 못했습니다."); const result = domain.validateCatalog(value); if (!result.valid) throw new Error(rows(result.errors).map((item) => typeof item === "string" ? item : item.message || JSON.stringify(item)).join(" · ") || "Catalog 형식을 확인해 주세요.");
        if (domain.validateImport && currentCatalog) { const imported = domain.validateImport(value, currentCatalog); if (!imported.valid) throw new Error(rows(imported.errors).map((item) => typeof item === "string" ? item : item.message || JSON.stringify(item)).join(" · ")); }
        validationTarget.append(element("li", `구조 검증 통과 · ${rows(value.entities).length}개 공간 · ${value.contentVersion}. 구조 통과는 현장 측량·학교 승인을 뜻하지 않습니다.`));
        const diff = domain.diffCatalog?.(currentCatalog, value); if (diff) Object.entries(diff).forEach(([key, values]) => { if (Array.isArray(values)) values.slice(0, 100).forEach((item) => diffTarget.append(element("li", `${key}: ${typeof item === "string" ? item : item.id || item.entityId || item.name || JSON.stringify(item)}`))); });
        if (!diffTarget.children.length) diffTarget.append(element("li", "공간 변경 목록이 없습니다. 출처·버전·운영 기록 변경도 JSON에서 확인해 주세요."));
        return value;
      } catch (error) { validationTarget.append(element("li", error.message)); message(error.message, true); return null; }
    }
    async function saveDraft() { const catalog = validate(); if (!catalog) return; const summary = byId("adminDraftSummary").value.trim(); if (!summary || summary.length > 500 || !Number.isInteger(revision)) { message("변경 요약과 최신 공개 revision을 확인해 주세요.", true); return; } await mutation(async () => { selectedDraft = selectedDraft ? await request(`/admin/drafts/${encodeURIComponent(selectedDraft.id)}`, "PATCH", { catalog, summary, expectedRevision: selectedDraft.revision }) : await request("/admin/drafts", "POST", { catalog, summary, expectedRevision: revision }); byId("adminDraftInfo").textContent = `${selectedDraft.id} · ${selectedDraft.status} · revision ${selectedDraft.revision}`; await refresh(); byId("adminDraftSelect").value = selectedDraft.id; message("초안을 저장했습니다. 아직 공개 지도에 반영하지 않았습니다."); }); }
    async function draftAction(action) { if (!selectedDraft) return; if (!window.confirm(`${selectedDraft.summary}\n초안 ${selectedDraft.id}\n${action === "submit" ? "검토에 제출" : action === "approve" ? "승인" : "반려"}할까요?`)) return; await mutation(async () => { selectedDraft = await request(`/admin/drafts/${encodeURIComponent(selectedDraft.id)}`, "PATCH", { action, expectedRevision: selectedDraft.revision }); await refresh(); message(`초안 상태: ${selectedDraft.status}. 승인 후 공개 버튼으로 버전을 발행할 수 있습니다.`); }); }
    async function publish() { if (!selectedDraft || selectedDraft.status !== "approved") return; if (!window.confirm(`승인된 초안을 공개 지도에 반영할까요?\n${selectedDraft.summary}\n초안 ${selectedDraft.id}\n현재 전역 revision ${revision}`)) return; await mutation(async () => { const released = await request("/admin/releases", "POST", { draftId: selectedDraft.id, expectedRevision: revision }); await refresh(); message(`공개판 ${released.id}를 발행했습니다. 조감도에서 최신 공개 자료를 다시 확인할 수 있습니다.`); }); }
    async function restore(id) { const release = releases.find((value) => value.id === id); if (!release || user?.role !== "admin") return; if (!window.confirm(`현재 공개 자료 전체를 다음 공개판으로 복구할까요?\n${release.summary}\n${release.id}\n현재 전역 revision ${revision}`)) return; await mutation(async () => { await request(`/admin/releases/${encodeURIComponent(id)}/restore`, "POST", { expectedRevision: revision }); await refresh(); message(`공개판 ${id}로 복구했습니다.`); }); }
    function loadReport() { selectedReport = reports.find((report) => report.id === byId("adminReportSelect").value) || null; const target = byId("adminReportDetail"); target.replaceChildren(); if (!selectedReport) { target.append(element("p", "등록된 접수가 없습니다.")); renderPermission(); return; } const report = selectedReport; target.append(element("p", `${report.id} · ${report.spaceId} · ${report.type} · ${report.createdAt}`), element("p", report.description)); if (report.hasPhoto) target.append(element("a", "비공개 첨부 사진 다운로드", { href: `${apiBase()}/admin/reports/${encodeURIComponent(report.id)}/photo`, download: "report-photo" })); byId("adminReportStatus").value = report.status; byId("adminReportNote").value = report.responseNote || ""; renderPermission(); }
    async function saveReport() { if (!selectedReport) return; await mutation(async () => { const report = await request(`/admin/reports/${encodeURIComponent(selectedReport.id)}`, "PATCH", { status: byId("adminReportStatus").value, responseNote: byId("adminReportNote").value.trim() }); selectedReport = report; await refresh(); byId("adminReportSelect").value = report.id; loadReport(); message("제보의 처리 상태를 저장했습니다. 공간 자료 변경은 별도 초안·승인 절차를 따릅니다."); }); }
    function localTime(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }
    function loadOperation(id) {
      const record = operations.find((item) => item.id === id);
      if (!record || !reviewRole()) return;
      if (byId("adminOperationTitle").value && !window.confirm("다른 운영 기록을 불러올까요? 현재 폼 입력은 선택한 기록으로 대체됩니다.")) return;
      selectedOperation = record;
      byId("adminOperationEntity").value = record.entityId;
      byId("adminOperationTitle").value = record.title || record.label || "";
      byId("adminOperationOwner").value = record.owner || "";
      byId("adminOperationStatus").value = record.status || record.state || "unknown";
      byId("adminOperationStart").value = localTime(record.startsAt || record.validFrom);
      byId("adminOperationEnd").value = localTime(record.endsAt || record.validUntil);
      byId("adminOperationSource").value = record.sourceId || rows(record.sourceIds)[0] || "";
      byId("adminOperationVisibility").value = record.visibility || "restricted";
      byId("adminOperationInfo").textContent = `${record.id} · 기록 revision ${record.revision ?? "미확인"}. 기간·상태를 변경해 저장합니다.${Number.isInteger(record.revision) ? "" : " 최신 자료에서 변경 번호를 확인해야 저장할 수 있습니다."}`;
      renderPermission(); byId("adminOperationTitle").focus();
    }
    function newOperation() { if (!reviewRole() || busy) return; if (byId("adminOperationTitle").value && !window.confirm("새 운영 기록을 작성할까요? 현재 폼 입력은 초기화됩니다.")) return; selectedOperation = null; byId("adminOperationForm").reset(); byId("adminOperationInfo").textContent = "새 운영 기록"; renderPermission(); byId("adminOperationTitle").focus(); }
    async function saveOperation() {
      const start = new Date(byId("adminOperationStart").value), end = new Date(byId("adminOperationEnd").value); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start > 366 * 24 * 60 * 60 * 1000) { message("운영기간은 종료가 시작보다 늦고 1년 이내여야 합니다.", true); return; }
      if (selectedOperation && !Number.isInteger(selectedOperation.revision)) { message("기록 변경 번호가 없습니다. 최신 상태를 확인하고 기록을 다시 선택해 주세요.", true); return; }
      const body = { entityId: byId("adminOperationEntity").value, title: byId("adminOperationTitle").value.trim(), owner: byId("adminOperationOwner").value.trim(), status: byId("adminOperationStatus").value, startsAt: start.toISOString(), endsAt: end.toISOString(), sourceId: byId("adminOperationSource").value, visibility: byId("adminOperationVisibility").value, ...(selectedOperation ? { id: selectedOperation.id, expectedRevision: selectedOperation.revision } : {}) };
      if (!window.confirm(`${body.title}\n공간 ${body.entityId}\n${body.status} · ${body.startsAt} ~ ${body.endsAt}\n공개 범위 ${body.visibility}\n검토한 운영 정보를 저장할까요?`)) return;
      await mutation(async () => { const saved = await request("/admin/operations", "POST", body); selectedOperation = saved?.id ? saved : null; await refresh(); byId("adminOperationInfo").textContent = selectedOperation ? `${selectedOperation.id} · 기록 revision ${selectedOperation.revision ?? "미확인"} · 저장됨` : "저장한 운영 기록을 목록에서 다시 선택할 수 있습니다."; message("운영 상태와 유효기간을 저장했습니다."); });
    }
    async function syncProvider(id) { const provider = providers.find((item) => item.id === id); if (!provider?.enabled) return; if (!window.confirm(`등록된 연동에서 검토할 초안을 가져올까요?\n${provider.id} · ${provider.campusId}\n출처 ${provider.sourceId}\n자동 공개하지 않습니다.`)) return; await mutation(async () => { const result = await request(`/admin/providers/${encodeURIComponent(id)}/sync`, "POST", { expectedRevision: revision }); await refresh(); if (result.draftId) byId("adminDraftSelect").value = result.draftId; message(result.draftId ? `연동 자료를 초안 ${result.draftId}로 가져왔습니다. 초안을 불러와 근거·차이를 검토하고 제출해 주세요. 공개 지도는 아직 변경하지 않았습니다.` : "연동 응답에 검토 초안 번호가 없습니다. 담당자에게 결과를 확인해 주세요.", !result.draftId); }); }
    listen(byId("adminLoginForm"), "submit", (event) => {
      event.preventDefault();
      track(mutation(async () => { sessionEpoch++; const state = await request("/session", "POST", { username: byId("adminUsername").value.trim(), password: byId("adminPassword").value }); user = state.user; csrf = state.csrfToken || null; if (!user || !csrf) { clearPrivate(); throw new Error("인증된 세션·CSRF 응답을 확인할 수 없습니다."); } renderPermission(); await refresh(); }).finally(() => { byId("adminPassword").value = ""; }));
    });
    listen(byId("adminReconnect"), "click", () => track(session())); listen(byId("adminRefresh"), "click", () => track(refresh()));
    listen(byId("adminLogout"), "click", () => track(mutation(async () => { await request("/session", "DELETE"); clearPrivate(); message("로그아웃했습니다."); byId("adminUsername").focus(); })));
    listen(byId("adminUseCurrent"), "click", () => { if (!byId("adminCatalog").value || window.confirm("최신 공개 자료로 새 초안을 준비할까요? 현재 입력은 대체됩니다.")) prepareCurrent(); });
    listen(byId("adminLoadDraft"), "click", loadDraft); listen(byId("adminValidate"), "click", validate);
    listen(byId("adminCatalogFile"), "change", () => track((async () => { try { const file = byId("adminCatalogFile").files[0]; if (!file || file.size > 2 * 1024 * 1024) throw new Error("2MB 이하 JSON 파일을 선택해 주세요."); const text = await file.text(); JSON.parse(text); byId("adminCatalog").value = text; validate(); } catch (error) { message(`자료를 가져오지 못했습니다. ${error.message}`, true); } finally { byId("adminCatalogFile").value = ""; } })()));
    listen(byId("adminDraftForm"), "submit", (event) => { event.preventDefault(); track(saveDraft()); });
    document.querySelectorAll("[data-draft-action]").forEach((button) => listen(button, "click", () => track(draftAction(button.dataset.draftAction))));
    listen(byId("adminPublish"), "click", () => track(publish())); listen(byId("adminReleases"), "click", (event) => { const button = event.target.closest("[data-restore-release]"); if (button) track(restore(button.dataset.restoreRelease)); });
    listen(byId("adminLoadReport"), "click", loadReport); listen(byId("adminReportForm"), "submit", (event) => { event.preventDefault(); track(saveReport()); }); listen(byId("adminOperationForm"), "submit", (event) => { event.preventDefault(); track(saveOperation()); });
    listen(byId("adminNewOperation"), "click", newOperation); listen(byId("adminOperations"), "click", (event) => { const button = event.target.closest("[data-operation-edit]"); if (button) loadOperation(button.dataset.operationEdit); });
    listen(byId("adminProviders"), "click", (event) => { const button = event.target.closest("[data-provider-sync]"); if (button) track(syncProvider(button.dataset.providerSync)); });
    pageControls.forEach(({ controls }) => listen(controls, "click", (event) => { const button = event.target.closest("[data-admin-page]"); if (button && !button.disabled) track(navigateList(button.dataset.adminPage, button.dataset.pageDirection)); }));
    if (window.CampusRefinementReview) spatialReview = window.CampusRefinementReview.initialize({ mount: byId("adminDraftForm").parentElement, editor: byId("adminCatalog"), summary: byId("adminDraftSummary"), onChange: validate });
    const controller = { refresh, whenIdle: () => Promise.allSettled([...Array.from(tasks), spatialReview?.whenIdle()]), destroy() { if (destroyed) return; destroyed = true; spatialReview?.destroy(); listeners.splice(0).forEach((remove) => remove()); controllers.forEach((controller) => controller.abort()); pageControls.forEach(({ controls }) => controls.remove()); if (active === controller) active = null; } };
    active = controller; renderPermission(); track(session()); return controller;
  }
  window.CampusAdmin = { initialize };
  const boot = () => { if (document.body?.dataset.adminAuto === "true") initialize(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
