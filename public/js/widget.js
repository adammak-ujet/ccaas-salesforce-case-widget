(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const isMock = params.get("mock") === "1";

  const config = Object.assign({}, window.WIDGET_CONFIG, {
    listCasesUrl: params.get("listCasesUrl") || window.WIDGET_CONFIG.listCasesUrl,
    updateCaseUrl: params.get("updateCaseUrl") || window.WIDGET_CONFIG.updateCaseUrl,
    getActivityUrl: params.get("getActivityUrl") || window.WIDGET_CONFIG.getActivityUrl,
    customerLogoUrl: params.get("logo") || window.WIDGET_CONFIG.customerLogoUrl,
    apiKey: params.get("apiKey") || window.WIDGET_CONFIG.apiKey,
  });

  const phone = params.get("phone") || "";
  const email = params.get("email") || "";

  const els = {
    customerLogo: document.getElementById("customerLogo"),

    caseListSection: document.getElementById("caseListSection"),
    casesLoading: document.getElementById("casesLoading"),
    casesEmpty: document.getElementById("casesEmpty"),
    casesError: document.getElementById("casesError"),
    casesList: document.getElementById("casesList"),

    caseSection: document.getElementById("caseSection"),
    backToListBtn: document.getElementById("backToListBtn"),
    caseError: document.getElementById("caseError"),
    caseForm: document.getElementById("caseForm"),
    caseStatusPill: document.getElementById("caseStatusPill"),
    fCaseNumber: document.getElementById("fCaseNumber"),
    fContactName: document.getElementById("fContactName"),
    fPriority: document.getElementById("fPriority"),
    fPhone: document.getElementById("fPhone"),
    fEmail: document.getElementById("fEmail"),
    fDescription: document.getElementById("fDescription"),
    saveBtn: document.getElementById("saveBtn"),
    saveStatus: document.getElementById("saveStatus"),

    activitySection: document.getElementById("activitySection"),
    refreshBtn: document.getElementById("refreshBtn"),
    activityLoading: document.getElementById("activityLoading"),
    activityEmpty: document.getElementById("activityEmpty"),
    activityError: document.getElementById("activityError"),
    activityList: document.getElementById("activityList"),
  };

  let allCases = [];
  let currentCase = null;
  let dirtyFields = new Set();

  function setHidden(el, hidden) {
    el.hidden = hidden;
  }

  function apiHeaders(extra) {
    const headers = Object.assign({}, extra);
    if (config.apiKey) headers["X-Widget-Key"] = config.apiKey;
    return headers;
  }

  async function apiFetch(url, options) {
    const res = await fetch(url, Object.assign({}, options, { headers: apiHeaders((options && options.headers) || {}) }));
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${body ? " — " + body : ""}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  if (config.customerLogoUrl) {
    els.customerLogo.src = config.customerLogoUrl;
    setHidden(els.customerLogo, false);
  }

  // ---------- Case list ----------

  function priorityBadgeClass(priority) {
    const p = (priority || "").toLowerCase();
    if (p === "high") return "badge--priority-high";
    if (p === "medium") return "badge--priority-medium";
    if (p === "low") return "badge--priority-low";
    return "";
  }

  function renderCaseList(cases) {
    allCases = cases || [];
    els.casesList.innerHTML = "";

    if (allCases.length === 0) {
      setHidden(els.casesEmpty, false);
      setHidden(els.casesList, true);
      return;
    }
    setHidden(els.casesEmpty, true);
    setHidden(els.casesList, false);

    // Newest first — trust the backend's ORDER BY, but sort defensively here too.
    allCases
      .slice()
      .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
      .forEach((c) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "case-list-item";
        btn.innerHTML = `
          <span class="case-list-item-top">
            <span class="case-list-number">${escapeHtml(c.caseNumber)}</span>
            <span class="case-list-badges">
              ${c.priority ? `<span class="badge ${priorityBadgeClass(c.priority)}">${escapeHtml(c.priority)}</span>` : ""}
              ${c.status ? `<span class="badge">${escapeHtml(c.status)}</span>` : ""}
            </span>
          </span>
          <span class="case-list-subject">${escapeHtml(c.subject || c.description || "(no subject)")}</span>
          <span class="case-list-meta">${formatDate(c.createdDate)}</span>
        `;
        btn.addEventListener("click", () => selectCase(c));
        li.appendChild(btn);
        els.casesList.appendChild(li);
      });
  }

  async function loadCaseList() {
    setHidden(els.casesLoading, false);
    setHidden(els.casesEmpty, true);
    setHidden(els.casesError, true);
    setHidden(els.casesList, true);
    setHidden(els.caseSection, true);
    setHidden(els.activitySection, true);

    try {
      let cases;
      if (isMock) {
        await new Promise((r) => setTimeout(r, 250));
        cases = window.WIDGET_MOCK.cases;
      } else {
        if (!config.listCasesUrl) throw new Error("Widget is not configured with a listCasesUrl (see js/config.js).");
        if (!phone && !email) throw new Error("No phone or email provided in the widget URL.");
        const qs = new URLSearchParams();
        if (phone) qs.set("phone", phone);
        if (email) qs.set("email", email);
        cases = await apiFetch(`${config.listCasesUrl}?${qs.toString()}`);
      }
      renderCaseList(cases);
    } catch (err) {
      els.casesError.textContent = err.message || "Failed to load cases.";
      setHidden(els.casesError, false);
    } finally {
      setHidden(els.casesLoading, true);
    }
  }

  els.backToListBtn.addEventListener("click", () => {
    setHidden(els.caseSection, true);
    setHidden(els.activitySection, true);
    setHidden(els.caseListSection, false);
  });

  // ---------- Case detail (selected case) ----------

  function renderCase(c) {
    currentCase = c;
    dirtyFields.clear();
    els.fCaseNumber.textContent = c.caseNumber || "—";
    els.fContactName.textContent = c.contactName || "—";
    els.fPriority.value = c.priority || "Medium";
    els.fPhone.value = c.phone || "";
    els.fEmail.value = c.email || "";
    els.fDescription.value = c.description || "";
    document.querySelectorAll("#caseForm .field").forEach((f) => f.classList.remove("is-dirty"));
    updateSaveButton();
    setHidden(els.caseError, true);
    els.caseStatusPill.textContent = c.status ? c.status : "Connected";
    setHidden(els.caseStatusPill, false);
    setHidden(els.backToListBtn, false);
    els.refreshBtn.disabled = false;
  }

  function selectCase(c) {
    setHidden(els.caseListSection, true);
    setHidden(els.caseSection, false);
    setHidden(els.activitySection, false);
    renderCase(c);
    loadActivity();
  }

  function updateSaveButton() {
    els.saveBtn.disabled = dirtyFields.size === 0;
  }

  function markDirty(fieldName, inputEl) {
    dirtyFields.add(fieldName);
    inputEl.closest(".field").classList.add("is-dirty");
    updateSaveButton();
  }

  [
    ["priority", els.fPriority],
    ["phone", els.fPhone],
    ["email", els.fEmail],
    ["description", els.fDescription],
  ].forEach(([name, el]) => {
    el.addEventListener("input", () => markDirty(name, el));
    el.addEventListener("change", () => markDirty(name, el));
  });

  // ---------- Activity ----------

  function activityIcon(type) {
    if (type === "chatter") return "💬";
    if (type === "task") return "✅";
    if (type === "email") return "✉️";
    return "•";
  }

  function renderActivity(items) {
    els.activityList.innerHTML = "";
    if (!items || items.length === 0) {
      setHidden(els.activityEmpty, false);
      return;
    }
    setHidden(els.activityEmpty, true);
    items
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((item) => {
        const li = document.createElement("li");
        li.className = "activity-item";
        li.innerHTML = `
          <span class="activity-icon">${activityIcon(item.type)}</span>
          <span class="activity-body">
            <span class="activity-title">${escapeHtml(item.author || "")}</span>
            <p class="activity-text">${escapeHtml(item.text || "")}</p>
            <span class="activity-meta">${formatDate(item.date)}</span>
          </span>
        `;
        els.activityList.appendChild(li);
      });
  }

  async function loadActivity() {
    if (!currentCase) return;
    setHidden(els.activityLoading, false);
    setHidden(els.activityError, true);
    try {
      let items;
      if (isMock) {
        await new Promise((r) => setTimeout(r, 200));
        items = window.WIDGET_MOCK.activity;
      } else {
        if (!config.getActivityUrl) throw new Error("Widget is not configured with a getActivityUrl (see js/config.js).");
        items = await apiFetch(`${config.getActivityUrl}?caseId=${encodeURIComponent(currentCase.caseId)}`);
      }
      renderActivity(items);
    } catch (err) {
      els.activityError.textContent = err.message || "Failed to load activity.";
      setHidden(els.activityError, false);
    } finally {
      setHidden(els.activityLoading, true);
    }
  }

  els.refreshBtn.addEventListener("click", loadActivity);

  // ---------- Save ----------

  els.caseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (dirtyFields.size === 0 || !currentCase) return;

    const payload = { caseId: currentCase.caseId, contactId: currentCase.contactId, case: {}, contact: {} };
    if (dirtyFields.has("priority")) payload.case.Priority = els.fPriority.value;
    if (dirtyFields.has("description")) payload.case.Description = els.fDescription.value;
    if (dirtyFields.has("phone")) payload.contact.Phone = els.fPhone.value;
    if (dirtyFields.has("email")) payload.contact.Email = els.fEmail.value;

    els.saveBtn.disabled = true;
    els.saveStatus.textContent = "Saving…";

    try {
      if (isMock) {
        await new Promise((r) => setTimeout(r, 300));
      } else {
        if (!config.updateCaseUrl) throw new Error("Widget is not configured with an updateCaseUrl (see js/config.js).");
        await apiFetch(config.updateCaseUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      currentCase = Object.assign({}, currentCase, {
        priority: els.fPriority.value,
        phone: els.fPhone.value,
        email: els.fEmail.value,
        description: els.fDescription.value,
      });
      dirtyFields.clear();
      document.querySelectorAll("#caseForm .field").forEach((f) => f.classList.remove("is-dirty"));
      els.saveStatus.textContent = "Saved";
      setTimeout(() => (els.saveStatus.textContent = ""), 2500);
    } catch (err) {
      els.saveStatus.textContent = "";
      els.caseError.textContent = err.message || "Failed to save changes.";
      setHidden(els.caseError, false);
    } finally {
      updateSaveButton();
    }
  });

  loadCaseList();
})();
