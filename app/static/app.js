const state = { leads: [], tags: [], selectedId: null, activeTag: "", search: "" };

const $ = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function sourceLabel(source) {
  return source === "telegram_bot" ? "Telegram" : source === "manual" ? "Вручную" : source;
}

function statusLabel(status) {
  return ({new:"Новый", in_progress:"В работе", won:"Успех", lost:"Закрыт"})[status] || status;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(value));
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2400);
}

async function loadMetrics() {
  const m = await api("/api/metrics");
  $("metricTotal").textContent = m.total;
  $("metricNew").textContent = m.new;
  $("metricTelegram").textContent = m.telegram;
  $("metricManual").textContent = m.manual;
}

async function loadTags() {
  state.tags = await api("/api/tags");
  renderTagFilters();
}

function renderTagFilters() {
  const root = $("tagFilters");
  root.innerHTML = `<button class="chip ${state.activeTag === "" ? "active" : ""}" data-tag="">Все</button>` +
    state.tags.map(tag => `<button class="chip ${state.activeTag === tag.name ? "active" : ""}" data-tag="${esc(tag.name)}">${esc(tag.name)}</button>`).join("");
  root.querySelectorAll("[data-tag]").forEach(btn => btn.addEventListener("click", () => {
    state.activeTag = btn.dataset.tag || "";
    loadLeads();
    renderTagFilters();
  }));
}

async function loadLeads() {
  const params = new URLSearchParams();
  if (state.activeTag) params.set("tag", state.activeTag);
  if (state.search.trim()) params.set("search", state.search.trim());
  state.leads = await api(`/api/leads?${params}`);
  renderLeads();
  if (state.selectedId) {
    const exists = state.leads.find(l => l.id === state.selectedId);
    if (exists) renderDetail(exists);
  }
}

function renderLeads() {
  const root = $("leadList");
  $("listCaption").textContent = `${state.leads.length} ${state.leads.length === 1 ? "лид" : "лидов"}`;
  $("emptyState").classList.toggle("hidden", state.leads.length > 0);
  root.innerHTML = state.leads.map(lead => `
    <article class="lead-card ${lead.id === state.selectedId ? "active" : ""}" data-id="${lead.id}" tabindex="0">
      <div class="lead-main">
        <div>
          <div class="lead-title">${esc(lead.name)}</div>
          <div class="lead-contact">${esc(lead.contact)}</div>
        </div>
        <div class="badges">
          <span class="badge status-${lead.status}">${statusLabel(lead.status)}</span>
          <span class="badge source-${lead.source}">${esc(sourceLabel(lead.source))}</span>
        </div>
      </div>
      <div class="lead-request">${esc(lead.request)}</div>
      <div class="badges">
        ${lead.tags.map(t => `<span class="badge tag-badge">#${esc(t.name)}</span>`).join("")}
        <span class="badge">${formatDate(lead.created_at)}</span>
      </div>
    </article>
  `).join("");

  root.querySelectorAll(".lead-card").forEach(card => {
    const pick = () => selectLead(card.dataset.id);
    card.addEventListener("click", pick);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") pick(); });
  });
}

function selectLead(id) {
  state.selectedId = id;
  renderLeads();
  const lead = state.leads.find(item => item.id === id);
  if (lead) renderDetail(lead);
}

function renderDetail(lead) {
  $("detailPlaceholder").classList.add("hidden");
  const root = $("detailContent");
  root.classList.remove("hidden");
  const tagText = lead.tags.map(t => t.name).join(", ");
  root.innerHTML = `
    <div class="detail">
      <div class="eyebrow">${esc(sourceLabel(lead.source).toUpperCase())}</div>
      <h2>${esc(lead.name)}</h2>
      <div class="detail-meta">Создан ${formatDate(lead.created_at)} · ID ${esc(lead.id.split("-")[0])}</div>

      <div class="detail-block"><h4>Контакт</h4><p>${esc(lead.contact)}</p></div>
      <div class="detail-block"><h4>Запрос</h4><p>${esc(lead.request)}</p></div>
      <div class="detail-block">
        <h4>Статус</h4>
        <div class="status-row">
          ${["new","in_progress","won","lost"].map(s => `<button class="ghost ${lead.status === s ? "active" : ""}" data-status="${s}">${statusLabel(s)}</button>`).join("")}
        </div>
      </div>
      <div class="detail-block">
        <h4>Теги</h4>
        <div class="badges" style="margin-bottom:10px">${lead.tags.length ? lead.tags.map(t => `<span class="badge tag-badge">#${esc(t.name)}</span>`).join("") : '<span class="lead-contact">Тегов пока нет</span>'}</div>
        <div class="tag-editor">
          <input id="tagInput" value="${esc(tagText)}" placeholder="hot, design, repeat">
          <button class="primary" id="saveTags">Сохранить</button>
        </div>
      </div>
      ${lead.telegram_username ? `<div class="detail-block"><h4>Telegram</h4><p>@${esc(lead.telegram_username)}</p></div>` : ""}
    </div>`;

  root.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", async () => {
    const updated = await api(`/api/leads/${lead.id}/status`, {method:"PATCH", body:JSON.stringify({status:btn.dataset.status})});
    updateLead(updated); toast("Статус обновлён"); await loadMetrics();
  }));

  $("saveTags").addEventListener("click", async () => {
    const tags = $("tagInput").value.split(",").map(x => x.trim()).filter(Boolean);
    const updated = await api(`/api/leads/${lead.id}/tags`, {method:"PUT", body:JSON.stringify({tags})});
    updateLead(updated); toast("Теги сохранены"); await loadTags();
  });
}

function updateLead(updated) {
  const index = state.leads.findIndex(item => item.id === updated.id);
  if (index >= 0) state.leads[index] = updated;
  renderLeads(); renderDetail(updated);
}

async function refreshAll() {
  try {
    await Promise.all([loadMetrics(), loadTags()]);
    await loadLeads();
  } catch (error) {
    toast(`Ошибка: ${error.message}`);
  }
}

const dialog = $("createDialog");
$("openCreate").addEventListener("click", () => dialog.showModal());
$("closeCreate").addEventListener("click", () => dialog.close());
$("cancelCreate").addEventListener("click", () => dialog.close());
$("refreshBtn").addEventListener("click", refreshAll);

let searchTimer;
$("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  state.search = e.target.value;
  searchTimer = setTimeout(loadLeads, 220);
});

$("createForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const error = $("createError");
  error.classList.add("hidden");
  try {
    const lead = await api("/api/leads", {method:"POST", body:JSON.stringify({...data, source:"manual"})});
    event.target.reset(); dialog.close();
    state.activeTag = ""; state.search = ""; $("searchInput").value = "";
    await refreshAll(); selectLead(lead.id); toast("Лид создан");
  } catch (err) {
    error.textContent = err.message; error.classList.remove("hidden");
  }
});

refreshAll();
