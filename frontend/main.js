/* ============================================================
   NEIGHBORHOOD HELP PLATFORM — app.js
   Organized into focused render + utility functions.
   ============================================================ */

// ─── CONFIGURATION ────────────────────────────────────────────
const API_BASE  = "http://localhost:8000";
let   MOCK_MODE = true; // false → calls real API with Bearer token

// ─── MOCK DATA ────────────────────────────────────────────────
const MOCK_DATA = {
  user: {
    name: "Rahul",
    is_available: true,
    has_skills: true,
    unread_notifications: 3
  },
  stats: {
    got_help: 6,
    helped_others: 8,
    avg_rating: 4.8,
    active_now: 2
  },
  active_requests: [
    {
      id: 12,
      title: "Fell at home, need help",
      category: "elderly_care",
      status: "open",
      is_sos: true,
      escalation: { notified: 5, radius_km: 1, next_expand_in_sec: 80 }
    },
    {
      id: 9,
      title: "Math tutoring for Class 9",
      category: "tutoring",
      status: "accepted",
      is_sos: false,
      helper: { name: "Priya", badge: "silver", rating: 4.6 }
    }
  ],
  helping: [
    {
      id: 31,
      title: "Move a sofa",
      category: "moving",
      status: "in_progress",
      is_sos: false
    }
  ],
  past: [
    { id: 3, title: "Pet care",    status: "completed", date: "2026-09-28", rating: 5 },
    { id: 4, title: "Plumbing fix",status: "cancelled", date: "2026-09-25", rating: null }
  ],
  trust: {
    badge: "gold",
    parts: { verified: 30, completed: 25, rating: 25, response: 20 },
    tip: "Verify your phone number to gain +5 trust points."
  },
  suggested: [
    { id: 41, title: "Carry water cans", distance_km: 0.9, score: 87 },
    { id: 44, title: "Fix laptop WiFi",  distance_km: 1.6, score: 79 },
    { id: 47, title: "Walk a dog",       distance_km: 2.2, score: 71 }
  ],
  impact: {
    helps_this_month: 142,
    resolved_pct: 96,
    accepted_within_10min_pct: 82
  },
  notifications: [
    { id: 1, text: "New urgent request 0.8 km away", is_read: false },
    { id: 2, text: "Priya accepted your request",    is_read: false },
    { id: 3, text: "Please rate Amit's help",        is_read: true  }
  ]
};

// ─── APP STATE ────────────────────────────────────────────────
let appState   = JSON.parse(JSON.stringify(MOCK_DATA)); // deep clone
let currentTab = "asked";   // "asked" | "helping"
let escalationTimers = {};  // { reqId: intervalId }
let notifPollInterval = null;

// ─── STATUS CONFIG ────────────────────────────────────────────
const STATUS_STEPS = [
  { key: "open",        label: "Open"       },
  { key: "accepted",    label: "Accepted"   },
  { key: "in_progress", label: "In Progress"},
  { key: "completed",   label: "Done"       }
];
const STATUS_ORDER = { open: 0, accepted: 1, in_progress: 2, completed: 3 };

const BADGE_META = {
  gold:   { emoji: "🥇", chipClass: "badge-chip--gold" },
  silver: { emoji: "🥈", chipClass: "badge-chip--silver" },
  bronze: { emoji: "🥉", chipClass: "badge-chip--bronze" }
};

const CAT_LABELS = {
  elderly_care: "Elderly Care", tutoring: "Tutoring",
  moving: "Moving & Lifting", neighborhood_support: "Neighborhood"
};

// ═══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  startNotificationPolling();

  // Close notif dropdown on outside click
  document.addEventListener("click", e => {
    const btn  = document.getElementById("notifBtn");
    const drop = document.getElementById("notifDropdown");
    if (btn && drop && !btn.contains(e.target) && !drop.contains(e.target)) {
      drop.classList.remove("open");
    }
  });
});

async function initDashboard() {
  if (!MOCK_MODE) await fetchDashboardFromAPI();

  renderImpactBanner();
  renderHeader();
  renderStats();
  renderRequests();
  renderPastRequests();
  renderTrust();
  renderSuggested();
  renderNotifications();
  updateDevCard();
}

// ═══════════════════════════════════════════════════════════════
//  API — real calls (used when MOCK_MODE = false)
// ═══════════════════════════════════════════════════════════════
async function fetchDashboardFromAPI() {
  /* [API] GET /dashboard — replace mock with live data */
  try {
    const token = localStorage.getItem("token") || "";
    const res   = await fetch(`${API_BASE}/dashboard`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    appState = await res.json();
  } catch (err) {
    console.warn("[API] Dashboard fetch failed, using mock:", err);
    showToast("⚠️", "API Offline", "Running on mock data (no backend).");
  }
}

async function patchAvailability(val) {
  /* [API] PATCH /me — update availability on server */
  if (MOCK_MODE) return;
  try {
    const token = localStorage.getItem("token") || "";
    await fetch(`${API_BASE}/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ is_available: val })
    });
  } catch (err) {
    console.error("[API] Availability PATCH failed:", err);
  }
}

// ─── POLLING (every 5 s) ─────────────────────────────────────
function startNotificationPolling() {
  if (notifPollInterval) clearInterval(notifPollInterval);

  notifPollInterval = setInterval(async () => {
    if (MOCK_MODE) {
      /* [MOCK] No-op: static mock data; no real changes */
      return;
    }
    /* [API] GET /notifications — refresh badge + dropdown */
    try {
      const token = localStorage.getItem("token") || "";
      const res   = await fetch(`${API_BASE}/notifications`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        appState.notifications = await res.json();
        renderNotifications();
      }
    } catch (err) {
      console.error("[API] Notifications poll failed:", err);
    }
  }, 5000);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — IMPACT BANNER
// ═══════════════════════════════════════════════════════════════
function renderImpactBanner() {
  const { helps_this_month, resolved_pct, accepted_within_10min_pct } = appState.impact;
  const el = document.getElementById("impactText");
  if (!el) return;
  el.innerHTML = `
    <strong>${helps_this_month}</strong> helps this month
    <span class="impact-banner__dot"></span>
    <strong>${resolved_pct}%</strong> resolved
    <span class="impact-banner__dot"></span>
    <strong>${accepted_within_10min_pct}%</strong> accepted within 10 min
  `;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — HEADER
// ═══════════════════════════════════════════════════════════════
function renderHeader() {
  // Name
  const nameEl = document.getElementById("headerName");
  if (nameEl) nameEl.textContent = appState.user.name;

  // Badge chip
  const chipEl  = document.getElementById("headerBadge");
  const badge   = (appState.trust.badge || "bronze").toLowerCase();
  const meta    = BADGE_META[badge] || BADGE_META.bronze;
  if (chipEl) {
    chipEl.className = `badge-chip ${meta.chipClass}`;
    chipEl.textContent = `${cap(badge)} ${meta.emoji}`;
  }

  // Toggle
  const toggle = document.getElementById("availToggle");
  const state  = document.getElementById("availState");
  if (toggle) toggle.checked = appState.user.is_available;
  if (state)  state.textContent = appState.user.is_available ? "ON" : "OFF";
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — STAT CARDS
// ═══════════════════════════════════════════════════════════════
function renderStats() {
  const grid = document.getElementById("statsGrid");
  if (!grid) return;

  const s = appState.stats;
  const cards = [
    { label: "Got Help",      value: s.got_help,      suffix: "",     color: "",              sub: "Requests made",      icon: "🙏" },
    { label: "Helped Others", value: s.helped_others, suffix: "",     color: "",              sub: "Volunteered",        icon: "🤝" },
    { label: "Avg Rating",    value: s.avg_rating,    suffix: " ★",   color: "--amber",       sub: "Community trust",    icon: "⭐" },
    { label: "Active Now",    value: s.active_now,    suffix: "",     color: "--green",       sub: "In-flight tasks",    icon: "⚡" }
  ];

  grid.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-card__label">${c.label}</div>
      <div class="stat-card__value${c.color === '--amber' ? ' stat-card__value--amber' : c.color === '--green' ? ' stat-card__value--green' : ''}">
        ${c.value}${c.suffix}
      </div>
      <div class="stat-card__sub">${c.sub}</div>
      <span class="stat-card__icon" aria-hidden="true">${c.icon}</span>
    </div>
  `).join("");
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — REQUEST CARDS  (tab-aware)
// ═══════════════════════════════════════════════════════════════
function renderRequests() {
  const list = currentTab === "asked"
    ? appState.active_requests
    : appState.helping;

  // Update tab counts
  setEl("tabCountAsked",   appState.active_requests.length);
  setEl("tabCountHelping", appState.helping.length);

  const container = document.getElementById("requestsList");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = emptyState(
      "🤝",
      currentTab === "asked" ? "No active requests." : "You're not helping anyone yet.",
      currentTab === "asked"
        ? "Need neighborhood support? Post a request above."
        : "Browse suggested requests on the right to lend a hand."
    );
    return;
  }

  container.innerHTML = list.map(req => buildRequestCard(req)).join("");
  startEscalationTimers();
}

function buildRequestCard(req) {
  const isSOS   = req.is_sos;
  const status  = req.status;
  const catLabel = CAT_LABELS[req.category] || cap(req.category || "General");

  return `
    <div class="req-card${isSOS ? ' req-card--sos' : ''}" id="reqCard-${req.id}">

      <!-- Card Header -->
      <div class="req-card__header">
        <div>
          <div class="req-card__title-row">
            <h3 class="req-card__title">${esc(req.title)}</h3>
            ${isSOS ? `<span class="chip chip--sos"><span class="sos-dot"></span>SOS Urgent</span>` : ''}
          </div>
          <div class="req-card__meta">
            <span class="chip chip--cat">${catLabel}</span>
            <span class="req-card__id">#${req.id}</span>
          </div>
        </div>
      </div>

      <!-- SOS Live Escalation Box -->
      ${isSOS && status === "open" && req.escalation ? `
        <div class="escalation-box">
          <div class="escalation-box__left">
            <span class="escalation-box__icon">📡</span>
            <div class="escalation-box__text">
              <strong>Searching…</strong>&nbsp;
              <span id="escNotified-${req.id}">${req.escalation.notified}</span> helpers notified within
              <span id="escRadius-${req.id}">${req.escalation.radius_km}</span> km
            </div>
          </div>
          <div class="escalation-box__timer">
            <span class="escalation-box__timer-label">expanding in</span>
            <span class="escalation-box__timer-val" id="escTimer-${req.id}">${req.escalation.next_expand_in_sec}s</span>
          </div>
        </div>
      ` : ''}

      <!-- Status Progress or Cancelled Chip -->
      <div style="margin-top:18px;">
        ${status === "cancelled"
          ? `<span class="chip chip--grey">✖ Cancelled</span>`
          : buildProgressLine(status)}
      </div>

      <!-- Assigned Helper Strip -->
      ${req.helper ? `
        <div class="helper-strip">
          <div class="helper-strip__left">
            <div class="helper-strip__avatar" aria-hidden="true">${req.helper.name.charAt(0)}</div>
            <div>
              <div class="helper-strip__name">${esc(req.helper.name)}</div>
              <div class="helper-strip__role">Assigned Volunteer</div>
            </div>
          </div>
          <div class="helper-strip__right">
            <span class="chip chip--cat">${cap(req.helper.badge)} ${BADGE_META[req.helper.badge]?.emoji || ''}</span>
            <span class="helper-strip__rating">★ ${req.helper.rating}</span>
          </div>
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div class="req-card__actions">
        <button class="btn btn--ghost" onclick="handleAction('view',${req.id})" aria-label="View request ${req.id}">
          View
        </button>
        ${status === "accepted" || status === "in_progress" ? `
          <button class="btn btn--outline" onclick="handleAction('chat',${req.id},'${req.helper?.name || 'Helper'}')" aria-label="Chat about request ${req.id}">
            💬 Chat
          </button>
        ` : ''}
        ${status === "open" || status === "accepted" ? `
          <button class="btn btn--danger" onclick="handleAction('cancel',${req.id})" aria-label="Cancel request ${req.id}">
            Cancel
          </button>
        ` : ''}
        ${status === "in_progress" ? `
          <button class="btn btn--success" onclick="handleAction('complete',${req.id})" aria-label="Mark request ${req.id} complete">
            ✓ Complete
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function buildProgressLine(status) {
  const activeIdx = STATUS_ORDER[status] ?? 0;
  const pct       = (activeIdx / (STATUS_STEPS.length - 1)) * 100;

  const stepsHtml = STATUS_STEPS.map((step, i) => {
    let cls = "";
    if (i < activeIdx) {
      cls = "past";
    } else if (i === activeIdx) {
      if (step.key === "in_progress") cls = "active-amber";
      else if (step.key === "completed") cls = "active-green";
      else cls = "active";
    }
    const label = i < activeIdx ? "✓" : i + 1;
    return `
      <div class="progress-step ${cls}">
        <div class="progress-step__circle">${label}</div>
        <span class="progress-step__label">${step.label}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="progress-track">
      <div class="progress-steps">
        <div class="progress-fill" style="width:calc(${pct}% * (100% - 24px) / 100%)"></div>
        ${stepsHtml}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — PAST REQUESTS
// ═══════════════════════════════════════════════════════════════
function renderPastRequests() {
  const container = document.getElementById("pastList");
  if (!container) return;

  const items = appState.past.slice(0, 5);

  if (!items.length) {
    container.innerHTML = `<p style="font-size:12.5px;color:var(--text-muted);text-align:center;padding:16px 0;">No past history recorded.</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="past-item">
      <div>
        <div class="past-item__title">${esc(item.title)}</div>
        <div class="past-item__date">${item.date || 'Recent'}</div>
      </div>
      <div class="past-item__right">
        ${item.rating ? `<span class="past-item__rating">★ ${item.rating}</span>` : ''}
        <span class="chip ${item.status === 'completed' ? 'chip--green' : 'chip--grey'}">
          ${item.status === 'completed' ? '✓ Done' : '✖ Cancelled'}
        </span>
      </div>
    </div>
  `).join("");
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — TRUST SCORE
// ═══════════════════════════════════════════════════════════════
function renderTrust() {
  const trust  = appState.trust;
  const badge  = (trust.badge || "bronze").toLowerCase();
  const meta   = BADGE_META[badge] || BADGE_META.bronze;

  // Badge pill
  const pill = document.getElementById("trustBadgePill");
  if (pill) {
    pill.className = `badge-chip ${meta.chipClass}`;
    pill.textContent = `${cap(badge)} ${meta.emoji}`;
  }

  // Bars
  const barsEl = document.getElementById("trustBars");
  if (barsEl) {
    const rows = [
      { label: "Verified profile",  val: trust.parts.verified,  max: 30 },
      { label: "Completed helps",   val: trust.parts.completed, max: 25 },
      { label: "Rating score",      val: trust.parts.rating,    max: 25 },
      { label: "Reply time",        val: trust.parts.response,  max: 20 }
    ];

    barsEl.innerHTML = rows.map(r => `
      <div class="trust-bar-row">
        <div class="trust-bar-row__top">
          <span class="trust-bar-row__label">${r.label}</span>
          <span class="trust-bar-row__val">${r.val} pts</span>
        </div>
        <div class="trust-bar-row__track">
          <div class="trust-bar-row__fill" style="width:${(r.val / r.max) * 100}%"></div>
        </div>
      </div>
    `).join("");
  }

  // Tip
  const tipEl = document.getElementById("trustTip");
  if (tipEl) tipEl.textContent = trust.tip || "Verify additional info to boost your trust score.";
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — SUGGESTED REQUESTS
// ═══════════════════════════════════════════════════════════════
function renderSuggested() {
  const container = document.getElementById("suggestedList");
  if (!container) return;

  const { is_available, has_skills } = appState.user;

  if (!is_available || !has_skills) {
    container.innerHTML = `
      <div class="suggest-empty">
        <div style="font-size:28px;margin-bottom:8px;">📍</div>
        <p class="suggest-empty__text">
          Turn on <strong>Available</strong> and add skills<br>to see requests near you.
        </p>
        ${!is_available ? `
          <button class="suggest-empty__btn" onclick="forceAvailable()">Turn On Available</button>
        ` : ''}
      </div>
    `;
    return;
  }

  const top3 = (appState.suggested || []).slice(0, 3);
  if (!top3.length) {
    container.innerHTML = `<p style="font-size:12.5px;color:var(--text-muted);text-align:center;padding:16px 0;">No nearby matches right now.</p>`;
    return;
  }

  container.innerHTML = `<div class="suggested-list">` +
    top3.map(item => `
      <div class="suggest-card" onclick="offerHelp(${item.id},'${esc(item.title)}')">
        <div class="suggest-card__top">
          <span class="suggest-card__title">${esc(item.title)}</span>
          <span class="suggest-card__score">${item.score}% match</span>
        </div>
        <div class="suggest-card__bottom">
          <span class="suggest-card__dist">📍 ${item.distance_km} km away</span>
          <button class="suggest-card__offer" aria-label="Offer help for ${esc(item.title)}">Offer Help</button>
        </div>
      </div>
    `).join("")
  + `</div>`;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER — NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function renderNotifications() {
  const notifList  = document.getElementById("notifList");
  const notifBadge = document.getElementById("notifBadge");
  const notifs     = appState.notifications || [];
  const unread     = notifs.filter(n => !n.is_read).length;

  // Bell badge
  if (notifBadge) {
    if (unread > 0) {
      notifBadge.textContent = unread;
      notifBadge.classList.remove("hidden");
    } else {
      notifBadge.classList.add("hidden");
    }
  }

  if (!notifList) return;

  if (!notifs.length) {
    notifList.innerHTML = `<div style="padding:20px;text-align:center;font-size:12.5px;color:var(--text-muted);">All caught up! 🎉</div>`;
    return;
  }

  notifList.innerHTML = notifs.slice(0, 5).map(n => `
    <div class="notif-item ${n.is_read ? 'read' : 'unread'}">
      <span class="notif-item__dot"></span>
      <span class="notif-item__text">${esc(n.text)}</span>
    </div>
  `).join("");
}

// ═══════════════════════════════════════════════════════════════
//  ESCALATION TIMERS — tick every 1 s per SOS open request
// ═══════════════════════════════════════════════════════════════
function startEscalationTimers() {
  // Clear existing
  Object.values(escalationTimers).forEach(clearInterval);
  escalationTimers = {};

  appState.active_requests.forEach(req => {
    if (!req.is_sos || req.status !== "open" || !req.escalation) return;

    escalationTimers[req.id] = setInterval(() => {
      if (req.escalation.next_expand_in_sec > 0) {
        req.escalation.next_expand_in_sec--;
        const el = document.getElementById(`escTimer-${req.id}`);
        if (el) el.textContent = `${req.escalation.next_expand_in_sec}s`;
      } else {
        // Auto-expand radius when countdown hits 0
        req.escalation.radius_km   += 1;
        req.escalation.notified    += Math.floor(Math.random() * 4) + 2;
        req.escalation.next_expand_in_sec = 90;

        const rEl = document.getElementById(`escRadius-${req.id}`);
        const nEl = document.getElementById(`escNotified-${req.id}`);
        const tEl = document.getElementById(`escTimer-${req.id}`);
        if (rEl) rEl.textContent = req.escalation.radius_km;
        if (nEl) nEl.textContent = req.escalation.notified;
        if (tEl) tEl.textContent = `${req.escalation.next_expand_in_sec}s`;
      }
    }, 1000);
  });
}

// ═══════════════════════════════════════════════════════════════
//  USER INTERACTIONS
// ═══════════════════════════════════════════════════════════════

// Available toggle
function onAvailableToggle(checked) {
  appState.user.is_available = checked;
  const stateEl = document.getElementById("availState");
  if (stateEl) stateEl.textContent = checked ? "ON" : "OFF";
  patchAvailability(checked);
  renderSuggested();
  showToast(
    checked ? "✅" : "⏸",
    "Availability Updated",
    checked ? "You're now visible to neighbors needing help." : "You're offline from new requests."
  );
}

function forceAvailable() {
  const toggle = document.getElementById("availToggle");
  if (toggle) { toggle.checked = true; onAvailableToggle(true); }
}

// Tab switch
function switchTab(tab) {
  currentTab = tab;
  ["asked", "helping"].forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    if (!btn) return;
    btn.classList.toggle("active", t === tab);
  });
  renderRequests();
}

// Notification dropdown
function toggleNotifDropdown() {
  document.getElementById("notifDropdown")?.classList.toggle("open");
}

function markAllRead() {
  appState.notifications.forEach(n => n.is_read = true);
  renderNotifications();
}

// Past accordion
function togglePastAccordion() {
  const acc = document.getElementById("pastAccordion");
  if (acc) acc.classList.toggle("open");
}

// Request actions
function handleAction(type, id, extra) {
  const req = [...appState.active_requests, ...appState.helping].find(r => r.id === id);

  switch (type) {
    case "view":
      showToast("🔎", `Request #${id}`, "Opening request details & map view.");
      break;

    case "chat":
      showToast("💬", `Chat with ${extra || "Helper"}`, "Encrypted neighbor-to-neighbor chat opened.");
      break;

    case "cancel":
      if (!req) break;
      if (confirm(`Cancel "${req.title}"? This will notify any assigned helpers.`)) {
        req.status = "cancelled";
        renderRequests();
        showToast("🚫", "Cancelled", `Request "${req.title}" was cancelled.`);
      }
      break;

    case "complete":
      if (!req) break;
      req.status = "completed";
      // Move out of active into past
      appState.active_requests = appState.active_requests.filter(r => r.id !== id);
      appState.helping          = appState.helping.filter(r => r.id !== id);
      appState.past.unshift({ id: req.id, title: req.title, status: "completed", date: new Date().toISOString().slice(0,10), rating: null });
      renderRequests();
      renderPastRequests();
      showToast("✅", "Completed!", "Great work — your neighbor thanks you! Rate the experience.");
      break;
  }
}

function offerHelp(id, title) {
  const idx = appState.suggested.findIndex(s => s.id === id);
  if (idx !== -1) {
    const item = appState.suggested.splice(idx, 1)[0];
    appState.helping.push({ id: item.id, title: item.title, category: "neighborhood_support", status: "in_progress", is_sos: false });
    appState.stats.active_now++;
    renderStats();
    renderSuggested();
    renderRequests();
    showToast("🤝", "Help Offered", `You signed up to help with: "${title}". Waiting for confirmation.`);
  }
}

// Mock-mode toggle (dev helper)
function toggleMockMode() {
  MOCK_MODE = !MOCK_MODE;
  updateDevCard();
  showToast("🔄", "Mode Switched", `Now running in ${MOCK_MODE ? "Mock" : "Live API"} mode.`);
  if (!MOCK_MODE) initDashboard();
}

function updateDevCard() {
  const el = document.getElementById("devModeStatus");
  if (el) el.textContent = MOCK_MODE ? "Mock Data — Active" : "Live API — Active";
  const btn = document.getElementById("devModeBtn");
  if (btn) btn.textContent = MOCK_MODE ? "Switch to Live API" : "Switch to Mock";
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════
let toastTimer = null;

function showToast(icon, title, msg) {
  const toast    = document.getElementById("toast");
  const iconEl   = document.getElementById("toastIcon");
  const titleEl  = document.getElementById("toastTitle");
  const msgEl    = document.getElementById("toastMsg");

  if (!toast) return;
  if (iconEl)  iconEl.textContent  = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = msg;

  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════
const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
const esc  = s => String(s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

function emptyState(emoji, title, sub) {
  return `
    <div class="empty-state">
      <div class="empty-state__emoji">${emoji}</div>
      <div class="empty-state__title">${title}</div>
      <div class="empty-state__sub">${sub}</div>
    </div>
  `;
}
