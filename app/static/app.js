const translations = {
  ru: {
    tagline: "Лиды из Telegram и ручного ввода — в одном рабочем списке.",
    openBot: "Открыть бота", newLead: "+ Новый лид", metricTotal: "Всего", metricNew: "Новые", metricManual: "Вручную",
    searchLabel: "Поиск", searchPlaceholder: "Имя, контакт или запрос", tagLabel: "Тег", allTags: "Все", refresh: "Обновить",
    leadsTitle: "Лиды", loading: "Загрузка…", emptyTitle: "Ничего не найдено", emptyText: "Смените фильтр или добавьте первый лид.",
    selectLeadTitle: "Выберите лид", selectLeadText: "Справа появятся контакт, запрос, источник и теги.",
    footerBuilt: "Собрано как сфокусированный продуктовый MVP.", manualEntry: "РУЧНОЕ ДОБАВЛЕНИЕ", newLeadTitle: "Новый лид",
    nameLabel: "Имя", namePlaceholder: "Анна Петрова", contactLabel: "Контакт", contactPlaceholder: "@anna или +7…",
    requestLabel: "Запрос", requestPlaceholder: "Что нужно клиенту", cancel: "Отмена", createLead: "Создать лид",
    sourceManual: "Вручную", statusNew: "Новый", statusProgress: "В работе", statusWon: "Успех", statusLost: "Закрыт",
    created: "Создан", contact: "Контакт", request: "Запрос", status: "Статус", tags: "Теги", noTags: "Тегов пока нет",
    save: "Сохранить", leadCreated: "Лид создан", tagsSaved: "Теги сохранены", statusUpdated: "Статус обновлён", error: "Ошибка",
    leadsOne: "лид", leadsMany: "лидов"
  },
  en: {
    tagline: "Telegram and manually entered leads in one focused workspace.",
    openBot: "Open bot", newLead: "+ New lead", metricTotal: "Total", metricNew: "New", metricManual: "Manual",
    searchLabel: "Search", searchPlaceholder: "Name, contact or request", tagLabel: "Tag", allTags: "All", refresh: "Refresh",
    leadsTitle: "Leads", loading: "Loading…", emptyTitle: "Nothing found", emptyText: "Change the filter or add your first lead.",
    selectLeadTitle: "Select a lead", selectLeadText: "Contact, request, source and tags will appear here.",
    footerBuilt: "Built as a focused product MVP.", manualEntry: "MANUAL ENTRY", newLeadTitle: "New lead",
    nameLabel: "Name", namePlaceholder: "Anna Petrova", contactLabel: "Contact", contactPlaceholder: "@anna or +1…",
    requestLabel: "Request", requestPlaceholder: "What does the client need?", cancel: "Cancel", createLead: "Create lead",
    sourceManual: "Manual", statusNew: "New", statusProgress: "In progress", statusWon: "Won", statusLost: "Closed",
    created: "Created", contact: "Contact", request: "Request", status: "Status", tags: "Tags", noTags: "No tags yet",
    save: "Save", leadCreated: "Lead created", tagsSaved: "Tags saved", statusUpdated: "Status updated", error: "Error",
    leadsOne: "lead", leadsMany: "leads"
  },
  de: {
    tagline: "Telegram-Leads und manuell erfasste Anfragen in einem Arbeitsbereich.",
    openBot: "Bot öffnen", newLead: "+ Neuer Lead", metricTotal: "Gesamt", metricNew: "Neu", metricManual: "Manuell",
    searchLabel: "Suche", searchPlaceholder: "Name, Kontakt oder Anfrage", tagLabel: "Tag", allTags: "Alle", refresh: "Aktualisieren",
    leadsTitle: "Leads", loading: "Laden…", emptyTitle: "Nichts gefunden", emptyText: "Filter ändern oder den ersten Lead hinzufügen.",
    selectLeadTitle: "Lead auswählen", selectLeadText: "Kontakt, Anfrage, Quelle und Tags erscheinen hier.",
    footerBuilt: "Als fokussiertes Produkt-MVP gebaut.", manualEntry: "MANUELLE ERFASSUNG", newLeadTitle: "Neuer Lead",
    nameLabel: "Name", namePlaceholder: "Anna Petrova", contactLabel: "Kontakt", contactPlaceholder: "@anna oder +49…",
    requestLabel: "Anfrage", requestPlaceholder: "Was braucht der Kunde?", cancel: "Abbrechen", createLead: "Lead erstellen",
    sourceManual: "Manuell", statusNew: "Neu", statusProgress: "In Bearbeitung", statusWon: "Gewonnen", statusLost: "Geschlossen",
    created: "Erstellt", contact: "Kontakt", request: "Anfrage", status: "Status", tags: "Tags", noTags: "Noch keine Tags",
    save: "Speichern", leadCreated: "Lead erstellt", tagsSaved: "Tags gespeichert", statusUpdated: "Status aktualisiert", error: "Fehler",
    leadsOne: "Lead", leadsMany: "Leads"
  }
};

const supportedLangs = ["ru", "en", "de"];
const browserLang = (navigator.language || "ru").slice(0, 2).toLowerCase();
const state = {
  leads: [], tags: [], selectedId: null, activeTag: "", search: "",
  lang: supportedLangs.includes(localStorage.getItem("nadein-crm-lang"))
    ? localStorage.getItem("nadein-crm-lang")
    : (supportedLangs.includes(browserLang) ? browserLang : "en")
};

const $ = (id) => document.getElementById(id);
const t = (key) => translations[state.lang][key] ?? translations.en[key] ?? key;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll(".lang-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.lang === state.lang));
  document.title = `Nadein CRM — ${state.lang === "ru" ? "лиды из Telegram" : state.lang === "de" ? "Telegram-Leads" : "Telegram leads"}`;
  renderTagFilters();
  renderLeads();
  if (state.selectedId) {
    const selected = state.leads.find((lead) => lead.id === state.selectedId);
    if (selected) renderDetail(selected);
  }
}

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
  return source === "telegram_bot" ? "Telegram" : source === "manual" ? t("sourceManual") : source;
}

function statusLabel(status) {
  return ({new:t("statusNew"), in_progress:t("statusProgress"), won:t("statusWon"), lost:t("statusLost")})[status] || status;
}

function formatDate(value) {
  const locale = {ru:"ru-RU", en:"en-GB", de:"de-DE"}[state.lang] || "en-GB";
  return new Intl.DateTimeFormat(locale, {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(value));
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
  if (!root) return;
  root.innerHTML = `<button class="chip ${state.activeTag === "" ? "active" : ""}" data-tag="">${esc(t("allTags"))}</button>` +
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
  if (!root) return;
  const count = state.leads.length;
  $("listCaption").textContent = `${count} ${count === 1 ? t("leadsOne") : t("leadsMany")}`;
  $("emptyState").classList.toggle("hidden", count > 0);
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
        ${lead.tags.map(tag => `<span class="badge tag-badge">#${esc(tag.name)}</span>`).join("")}
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
  const tagText = lead.tags.map(tag => tag.name).join(", ");
  root.innerHTML = `
    <div class="detail">
      <div class="eyebrow">${esc(sourceLabel(lead.source).toUpperCase())}</div>
      <h2>${esc(lead.name)}</h2>
      <div class="detail-meta">${t("created")} ${formatDate(lead.created_at)} · ID ${esc(lead.id.split("-")[0])}</div>

      <div class="detail-block"><h4>${t("contact")}</h4><p>${esc(lead.contact)}</p></div>
      <div class="detail-block"><h4>${t("request")}</h4><p>${esc(lead.request)}</p></div>
      <div class="detail-block">
        <h4>${t("status")}</h4>
        <div class="status-row">
          ${["new","in_progress","won","lost"].map(s => `<button class="ghost ${lead.status === s ? "active" : ""}" data-status="${s}">${statusLabel(s)}</button>`).join("")}
        </div>
      </div>
      <div class="detail-block">
        <h4>${t("tags")}</h4>
        <div class="badges" style="margin-bottom:10px">${lead.tags.length ? lead.tags.map(tag => `<span class="badge tag-badge">#${esc(tag.name)}</span>`).join("") : `<span class="lead-contact">${t("noTags")}</span>`}</div>
        <div class="tag-editor">
          <input id="tagInput" value="${esc(tagText)}" placeholder="hot, design, repeat">
          <button class="primary" id="saveTags">${t("save")}</button>
        </div>
      </div>
      ${lead.telegram_username ? `<div class="detail-block"><h4>Telegram</h4><p>@${esc(lead.telegram_username)}</p></div>` : ""}
    </div>`;

  root.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", async () => {
    const updated = await api(`/api/leads/${lead.id}/status`, {method:"PATCH", body:JSON.stringify({status:btn.dataset.status})});
    updateLead(updated); toast(t("statusUpdated")); await loadMetrics();
  }));

  $("saveTags").addEventListener("click", async () => {
    const tags = $("tagInput").value.split(",").map(x => x.trim()).filter(Boolean);
    const updated = await api(`/api/leads/${lead.id}/tags`, {method:"PUT", body:JSON.stringify({tags})});
    updateLead(updated); toast(t("tagsSaved")); await loadTags();
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
    toast(`${t("error")}: ${error.message}`);
  }
}

document.querySelectorAll(".lang-btn").forEach((btn) => btn.addEventListener("click", () => {
  state.lang = btn.dataset.lang;
  localStorage.setItem("nadein-crm-lang", state.lang);
  applyLanguage();
}));

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
    await refreshAll(); selectLead(lead.id); toast(t("leadCreated"));
  } catch (err) {
    error.textContent = err.message; error.classList.remove("hidden");
  }
});

applyLanguage();
refreshAll();
