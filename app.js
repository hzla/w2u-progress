(function () {
  "use strict";

  const STORAGE_KEY = "white2expansion.progress.v1";
  const CATEGORIES = {
    pokemon: {
      label: "Pokemon",
      url: "data/pokemon.gen6.json",
      fields: [
        ["personalData", "Personal"],
        ["partyIcon", "Icon"],
        ["frontSprite", "Front"],
        ["backSprite", "Back"],
        ["shinyPalette", "Shiny"],
        ["verified", "Verified"]
      ],
      readonlyColumns: [
        ["assetStatus", "Asset status"],
        ["runtimeNotes", "Runtime"]
      ]
    },
    moves: {
      label: "Moves",
      url: "data/moves.gen6.json",
      fields: [
        ["animation", "Animation"],
        ["effectHandler", "Effect"],
        ["verified", "Verified"]
      ],
      readonlyColumns: [
        ["stats", "PP / Pow / Acc"],
        ["description", "Description"]
      ]
    },
    items: {
      label: "Items",
      url: "data/items.gen6.json",
      fields: [
        ["battleCode", "Battle code"],
        ["itemIcon", "Icon"],
        ["verified", "Verified"]
      ],
      readonlyColumns: [
        ["description", "Description"]
      ]
    },
    abilities: {
      label: "Abilities",
      url: "data/abilities.gen6.json",
      fields: [
        ["battleCode", "Battle code"],
        ["verified", "Verified"]
      ],
      readonlyColumns: [
        ["description", "Description"]
      ]
    }
  };

  const state = {
    activeTab: "pokemon",
    filter: "all",
    search: "",
    canEdit: isLocalhost(),
    seeds: {},
    publishedProgress: {
      pokemon: {},
      moves: {},
      items: {},
      abilities: {}
    },
    progress: {
      pokemon: {},
      moves: {},
      items: {},
      abilities: {}
    },
    publishedAt: "",
    savedAt: ""
  };

  const els = {
    tabs: Array.from(document.querySelectorAll(".tab")),
    segments: Array.from(document.querySelectorAll(".segment")),
    search: document.getElementById("search-input"),
    head: document.getElementById("tracker-head"),
    body: document.getElementById("tracker-body"),
    tableScroll: document.querySelector(".table-scroll"),
    empty: document.getElementById("empty-state"),
    rows: document.getElementById("summary-rows"),
    checked: document.getElementById("summary-checked"),
    verified: document.getElementById("summary-verified"),
    saved: document.getElementById("summary-saved"),
    checkboxTemplate: document.getElementById("checkbox-template")
  };

  function isLocalhost() {
    const hostname = window.location.hostname;
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");
  }

  function emptyProgress() {
    return { pokemon: {}, moves: {}, items: {}, abilities: {} };
  }

  function normalizeStoredProgress(raw) {
    const progress = emptyProgress();
    if (!raw || typeof raw !== "object") {
      return { progress, savedAt: "" };
    }

    const source = raw.progress && typeof raw.progress === "object" ? raw.progress : raw;
    Object.keys(progress).forEach((category) => {
      if (source[category] && typeof source[category] === "object") {
        progress[category] = source[category];
      }
    });

    return {
      progress,
      savedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
    };
  }

  function loadStoredProgress() {
    try {
      return normalizeStoredProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (_error) {
      return { progress: emptyProgress(), savedAt: "" };
    }
  }

  function saveProgress() {
    if (!state.canEdit) {
      return;
    }

    state.savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      updatedAt: state.savedAt,
      progress: state.progress
    }));
    renderSummary();
  }

  function collectProgressSnapshot() {
    const snapshot = emptyProgress();
    Object.keys(CATEGORIES).forEach((category) => {
      (state.seeds[category] || []).forEach((row) => {
        snapshot[category][row.key] = mergeProgress(category, row);
      });
      copyUnseededProgress(snapshot, category, state.publishedProgress);
      copyUnseededProgress(snapshot, category, state.progress);
    });
    return snapshot;
  }

  function copyUnseededProgress(snapshot, category, source) {
    Object.entries(source[category] || {}).forEach(([key, value]) => {
      if (!snapshot[category][key]) {
        snapshot[category][key] = value;
      }
    });
  }

  function mergeProgress(category, row) {
    return Object.assign(
      {},
      row.defaultProgress || {},
      state.publishedProgress[category][row.key] || {},
      state.progress[category][row.key] || {}
    );
  }

  function findSeedRow(category, key) {
    return (state.seeds[category] || []).find((row) => row.key === key);
  }

  function rowSearchText(row) {
    return [
      row.name,
      row.key,
      row.constant,
      row.kind,
      row.baseSpecies,
      row.baseSpeciesId,
      row.megaItem,
      row.description,
      row.assetStatus,
      row.runtimeNotes,
      row.credits,
      row.id
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function rowMatchesFilter(category, row) {
    const merged = mergeProgress(category, row);
    const fields = CATEGORIES[category].fields.map(([field]) => field);
    if (state.filter === "verified") {
      return merged.verified === true;
    }
    if (state.filter === "open") {
      return fields.some((field) => merged[field] !== true);
    }
    if (state.filter === "missingSprites") {
      return category === "pokemon" && (merged.frontSprite !== true || merged.backSprite !== true);
    }
    return true;
  }

  function getVisibleRows() {
    const category = state.activeTab;
    const term = state.search.trim().toLowerCase();
    return (state.seeds[category] || []).filter((row) => {
      return (!term || rowSearchText(row).includes(term)) && rowMatchesFilter(category, row);
    });
  }

  function formatSavedTime(value) {
    if (!value) {
      return "Not yet";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Saved";
    }
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function renderSummary() {
    const category = state.activeTab;
    const rows = state.seeds[category] || [];
    const fields = CATEGORIES[category].fields.map(([field]) => field);
    let checked = 0;
    let verified = 0;
    rows.forEach((row) => {
      const merged = mergeProgress(category, row);
      checked += fields.filter((field) => merged[field] === true).length;
      if (merged.verified === true) {
        verified += 1;
      }
    });
    els.rows.textContent = String(rows.length);
    els.checked.textContent = `${checked} / ${rows.length * fields.length}`;
    els.verified.textContent = String(verified);
    els.saved.textContent = state.canEdit
      ? formatSavedTime(state.savedAt)
      : state.publishedAt ? formatSavedTime(state.publishedAt) : "Published";
  }

  function syncEditControls() {
    document.body.classList.toggle("is-readonly", !state.canEdit);
  }

  function renderHead() {
    const category = CATEGORIES[state.activeTab];
    const columns = [
      "<tr>",
      "<th scope=\"col\">ID</th>",
      "<th scope=\"col\">Name</th>",
      ...category.readonlyColumns.map(([, label]) => `<th scope="col">${label}</th>`),
      ...category.fields.map(([, label]) => `<th scope="col" class="compact-cell">${label}</th>`),
      "<th scope=\"col\">Notes</th>",
      "</tr>"
    ];
    els.head.innerHTML = columns.join("");
  }

  function makePill(text, className) {
    if (!text) {
      return "";
    }
    return `<span class="pill ${className || ""}">${escapeHtml(text)}</span>`;
  }

  function renderNameCell(row) {
    const meta = [
      row.constant ? makePill(row.constant, "ok") : "",
      row.id != null ? makePill(`#${row.id}`, "") : "",
      row.credits ? makePill(row.credits, row.credits === "TBD" ? "warn" : "ok") : ""
    ].filter(Boolean).join("");
    return `
      <td class="name-cell">
        <strong>${escapeHtml(row.name)}</strong>
        <div class="meta-line">${meta}</div>
      </td>
    `;
  }

  function renderReadonlyCell(row, key) {
    let value = row[key];
    if (key === "stats") {
      value = `PP ${row.pp} / Pow ${row.power} / Acc ${row.accuracy}`;
    }
    return `<td class="readonly-cell">${escapeHtml(value || "")}</td>`;
  }

  function renderCheckbox(category, row, field, value) {
    const label = `${row.name} ${field}`;
    return `
      <td class="compact-cell">
        <label class="check-cell" title="${escapeHtml(label)}">
          <input type="checkbox" data-key="${escapeHtml(row.key)}" data-field="${escapeHtml(field)}" ${value ? "checked" : ""} ${state.canEdit ? "" : "disabled"} aria-label="${escapeHtml(label)}">
          <span aria-hidden="true"></span>
        </label>
      </td>
    `;
  }

  function renderRows() {
    const categoryKey = state.activeTab;
    const category = CATEGORIES[categoryKey];
    const rows = getVisibleRows();
    els.empty.hidden = rows.length !== 0;
    els.body.innerHTML = rows.map((row) => {
      const merged = mergeProgress(categoryKey, row);
      return `
        <tr>
          <td class="id-cell">${row.id == null ? "" : row.id}</td>
          ${renderNameCell(row)}
          ${category.readonlyColumns.map(([key]) => renderReadonlyCell(row, key)).join("")}
          ${category.fields.map(([field]) => renderCheckbox(categoryKey, row, field, merged[field] === true)).join("")}
          <td class="notes-cell">
            <textarea class="notes-input" data-key="${escapeHtml(row.key)}" data-field="notes" rows="1" ${state.canEdit ? "" : "readonly"} aria-label="${escapeHtml(row.name)} notes">${escapeHtml(merged.notes || "")}</textarea>
          </td>
        </tr>
      `;
    }).join("");
  }

  function removeRowIfFilteredOut(rowElement, category, row) {
    if (!rowElement || !row || rowMatchesFilter(category, row)) {
      return;
    }

    const scrollTop = els.tableScroll ? els.tableScroll.scrollTop : 0;
    const scrollLeft = els.tableScroll ? els.tableScroll.scrollLeft : 0;
    rowElement.remove();
    els.empty.hidden = els.body.children.length !== 0;
    if (els.tableScroll) {
      els.tableScroll.scrollTop = scrollTop;
      els.tableScroll.scrollLeft = scrollLeft;
    }
  }

  function render() {
    renderHead();
    renderRows();
    renderSummary();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setTab(tab) {
    state.activeTab = tab;
    if (!filterAvailableForTab(state.filter, tab)) {
      state.filter = "all";
    }
    els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
    syncFilterControls();
    els.search.placeholder = `Search ${CATEGORIES[tab].label.toLowerCase()}`;
    render();
  }

  function setFilter(filter) {
    if (!filterAvailableForTab(filter, state.activeTab)) {
      filter = "all";
    }
    state.filter = filter;
    syncFilterControls();
    render();
  }

  function filterAvailableForTab(filter, tab) {
    if (filter === "missingSprites") {
      return tab === "pokemon";
    }
    return true;
  }

  function syncFilterControls() {
    els.segments.forEach((button) => {
      const category = button.dataset.filterCategory;
      const available = !category || category === state.activeTab;
      button.hidden = !available;
      button.classList.toggle("is-active", available && button.dataset.filter === state.filter);
    });
  }

  function updateRowProgress(category, key, field, value) {
    if (!state.canEdit) {
      return;
    }

    const seedRow = findSeedRow(category, key);
    const current = mergeProgress(category, seedRow || { key, defaultProgress: {} });
    state.progress[category][key] = Object.assign({}, current, { [field]: value });
    saveProgress();
  }

  function bindEvents() {
    els.tabs.forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    });

    els.segments.forEach((button) => {
      button.addEventListener("click", () => setFilter(button.dataset.filter));
    });

    els.search.addEventListener("input", () => {
      state.search = els.search.value;
      renderRows();
    });

    els.body.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("input[type='checkbox']")) {
        const rowElement = target.closest("tr");
        if (!state.canEdit) {
          const seedRow = findSeedRow(state.activeTab, target.dataset.key);
          target.checked = mergeProgress(
            state.activeTab,
            seedRow || { key: target.dataset.key, defaultProgress: {} }
          )[target.dataset.field] === true;
          return;
        }
        const category = state.activeTab;
        const seedRow = findSeedRow(category, target.dataset.key);
        updateRowProgress(category, target.dataset.key, target.dataset.field, target.checked);
        removeRowIfFilteredOut(rowElement, category, seedRow);
      }
    });

    els.body.addEventListener("input", (event) => {
      const target = event.target;
      if (target.matches("textarea")) {
        if (!state.canEdit) {
          return;
        }
        updateRowProgress(state.activeTab, target.dataset.key, target.dataset.field, target.value);
      }
    });

  }

  async function loadSeeds() {
    const [entries, published] = await Promise.all([
      Promise.all(Object.entries(CATEGORIES).map(async ([key, config]) => {
        const response = await fetch(config.url);
        if (!response.ok) {
          throw new Error(`Failed to load ${config.url}`);
        }
        return [key, await response.json()];
      })),
      loadPublishedProgress()
    ]);
    state.seeds = Object.fromEntries(entries);
    state.publishedProgress = published.progress;
    state.publishedAt = published.savedAt;
  }

  async function loadPublishedProgress() {
    try {
      const response = await fetch("data/published-progress.json");
      if (!response.ok) {
        return { progress: emptyProgress(), savedAt: "" };
      }
      return normalizeStoredProgress(await response.json());
    } catch (_error) {
      return { progress: emptyProgress(), savedAt: "" };
    }
  }

  async function init() {
    syncEditControls();
    if (state.canEdit) {
      const stored = loadStoredProgress();
      state.progress = stored.progress;
      state.savedAt = stored.savedAt;
    }
    bindEvents();
    try {
      await loadSeeds();
      setTab("pokemon");
    } catch (error) {
      els.body.innerHTML = "";
      els.empty.hidden = false;
      els.empty.textContent = error.message;
    }
  }

  init();
})();
