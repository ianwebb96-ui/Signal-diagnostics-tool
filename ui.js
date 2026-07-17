/* ============================================================
   WHRL DIAGNOSTICS — SHARED UI HELPERS
   ============================================================
   Small, reusable rendering functions. This file knows nothing
   about audio, signal recovery, or how any specific module
   works — it only knows how to draw the shared chrome elements
   (status rows, the utilities menu) that every page uses.

   Keeping this separate from config.js and from any module's
   own logic means the visual language can be reused by future
   modules (Tower Logs, Equipment Inventory, etc.) without
   duplicating markup.
   ============================================================ */

/**
 * Renders a single status row into a container element.
 * @param {HTMLElement} container
 * @param {{label: string, value: string, state: string}} item
 */
function renderStatusRow(container, item) {
  const row = document.createElement("div");
  row.className = "status-row";
  row.innerHTML = `
    <span class="status-label">${item.label}</span>
    <span class="status-value ${item.state}">${item.value}</span>
  `;
  container.appendChild(row);
}

/**
 * Computes "today's date, 3:33:14 AM" as a display string.
 *
 * This is the one deliberate unexplained detail in the whole
 * application: the "Last Carrier Detection" timestamp always
 * reads 3:33 AM on whatever day the visitor happens to load the
 * page, regardless of when that actually is. Nothing in the UI
 * ever comments on this. It should just quietly always be true.
 *
 * @returns {string} formatted date/time string
 */
function getLastCarrierTimestamp() {
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return `${dateStr}, 3:33:14 AM`;
}

/**
 * Renders the utilities menu on the dashboard, respecting the
 * unlock state in WHRL_CONFIG.modulesUnlocked. Locked items
 * render as visible but non-interactive — this is deliberate:
 * seeing "Tower Logs [restricted]" sitting on the menu does real
 * atmospheric work (implies a larger, lived-in system) even
 * before that module has any content behind it.
 *
 * @param {HTMLElement} container
 */
function renderUtilityMenu(container) {
  const items = [
    { key: "signalDiagnostics", label: "Signal Diagnostics", href: "signal-diagnostics.html", icon: "◈" },
    { key: "audioArchive", label: "Audio Archive", href: "#", icon: "▤" },
    { key: "towerLogs", label: "Tower Logs", href: "#", icon: "▥" },
    { key: "equipmentInventory", label: "Equipment Inventory", href: "#", icon: "▦" },
    { key: "fccRecords", label: "FCC Records", href: "#", icon: "▧" },
    { key: "restrictedUtilities", label: "Restricted Utilities", href: "#", icon: "▨" }
  ];

  const list = document.createElement("ul");
  list.className = "util-menu";

  items.forEach(item => {
    const unlocked = WHRL_CONFIG.modulesUnlocked[item.key];
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = unlocked ? "" : "locked";
    a.href = unlocked ? item.href : "javascript:void(0)";
    a.innerHTML = `
      <span class="menu-icon">${item.icon}</span>
      <span>${item.label}${unlocked ? "" : " &nbsp;[restricted]"}</span>
    `;
    if (!unlocked) {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        alert("Administrator access required.");
      });
    }
    li.appendChild(a);
    list.appendChild(li);
  });

  container.appendChild(list);
}
