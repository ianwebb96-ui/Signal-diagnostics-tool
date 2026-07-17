/* ============================================================
   WHRL DIAGNOSTICS — CONFIG
   ============================================================
   All invented in-universe terminology lives here, in one place,
   so it can be reused consistently across every module and
   changed without hunting through UI code.

   IMPORTANT NARRATIVE RULE: nothing in this file (or anywhere
   in the app) should reference SSTV, Robot36, VIS codes, ham
   radio, amateur radio, or any real-world hobbyist terminology.
   Everything is WHRL's own invented internal vocabulary.
   ============================================================ */

const WHRL_CONFIG = {

  station: {
    name: "WHRL-LP 91.3 FM",
    system: "Engineering Diagnostics",
    lastMaintained: "rev. 2007.3"
  },

  /* ----------------------------------------------------------
     Module unlock state.
     Future waves can flip these to true as the player earns
     access — e.g. after a puzzle reveals a password, or after
     a specific wave lands. Keeping this as one flat object
     means new modules can be added here without touching the
     dashboard rendering code at all.
  ---------------------------------------------------------- */
  modulesUnlocked: {
    signalDiagnostics: true,
    audioArchive: false,
    towerLogs: false,
    equipmentInventory: false,
    fccRecords: false,
    restrictedUtilities: false
  },

  /* ----------------------------------------------------------
     Invented terminology — use these labels everywhere instead
     of any real-world signal-processing hobbyist language.
  ---------------------------------------------------------- */
  terms: {
    toolName: "Signal Diagnostics",
    recoverButton: "Recover Embedded Transmission",
    unknownCarrier: "Unknown Carrier Profile",
    legacyImageCarrier: "Legacy Image Carrier",
    spectrogramTool: "Transmission Analysis (Spectrogram)"
  },

  /* ----------------------------------------------------------
     Recovery stage labels, shown one at a time as real analysis
     runs. These are written to sound like genuine forensic
     software narrating its own process — see recovery-engine.js
     for where actual analysis timing drives these.
  ---------------------------------------------------------- */
  recoveryStages: [
    "Scanning frequency spectrum...",
    "Carrier candidate detected...",
    "Measuring noise floor...",
    "Synchronizing scan timing...",
    "Reconstructing image rows...",
    "Applying error correction...",
    "Rendering recovered frame..."
  ],

  /* ----------------------------------------------------------
     Dashboard status panel. "lastCarrierTime" is deliberately
     computed at runtime (see ui.js) rather than hardcoded here —
     it always reads 3:33 AM on whatever the visitor's current
     date is. That's the one quiet, unexplained detail this
     whole application exists to carry. Never draw attention to
     it in any label or tooltip.
  ---------------------------------------------------------- */
  dashboardStatus: {
    transmitter: { label: "Transmitter", value: "OFFLINE", state: "error" },
    generator: { label: "Backup Generator", value: "OFFLINE", state: "error" },
    remoteLink: { label: "Remote Link", value: "LOST", state: "error" },
    carrierMonitor: { label: "Carrier Monitor", value: "ACTIVE (unexplained)", state: "warn" }
  }

};
