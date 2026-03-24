// === Mini QuickBooks Logic (COA + Journal + Ledger + Trial Balance) + AUTH (Login only) ===

// ==============================
// Local UI memory keys
// ==============================
const LAST_VIEW_KEY = "exodiaLedger.lastView.v1";
const TAB_VIEW_KEY = "exodiaLedger.currentTabView.v1";
const WORKSHEET_VIEW_KEY = "exodiaLedger.worksheetView.v1";

const FILTER_YEAR_KEY = "exodiaLedger.filterYear.v1";
const FILTER_MONTH_KEY = "exodiaLedger.filterMonth.v1";
const LEDGER_ACCOUNT_KEY = "exodiaLedger.ledgerAccount.v1";
const JOURNAL_VIEW_KEY = "exodiaLedger.journalView.v1";
const JOURNAL_FILTER_FROM_KEY = "exodiaLedger.journalFilterFrom.v1";
const JOURNAL_FILTER_TO_KEY = "exodiaLedger.journalFilterTo.v1";

const LEDGER_FILTER_FROM_KEY = "exodiaLedger.ledgerFilterFrom.v1";
const LEDGER_FILTER_TO_KEY = "exodiaLedger.ledgerFilterTo.v1";

const WORKSHEET_FILTER_FROM_KEY = "exodiaLedger.worksheetFilterFrom.v1";
const WORKSHEET_FILTER_TO_KEY = "exodiaLedger.worksheetFilterTo.v1";

// ==============================
// Supabase Setup
// ==============================
const SUPABASE_URL = "https://vtglfaeyvmciieuntzhs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0Z2xmYWV5dm1jaWlldW50emhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2Nzg0NDUsImV4cCI6MjA4NTI1NDQ0NX0.eDOOS3BKKcNOJ_pq5-QpQkW6d1hpp2vdYPsvzzZgZzo";

// IMPORTANT: your index.html loads supabase-js first then app.js
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("Supabase library not loaded. Check script tag order in index.html.");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// DOM helper
// ==============================
const $ = (id) => document.getElementById(id);

function showSuccessMessage(message) {
  let msgBox = document.getElementById("success-message");

  if (!msgBox) {
    msgBox = document.createElement("div");
    msgBox.id = "success-message";

    msgBox.style.position = "fixed";
    msgBox.style.top = "20px";
    msgBox.style.right = "20px";
    msgBox.style.background = "#28a745";
    msgBox.style.color = "#fff";
    msgBox.style.padding = "10px 16px";
    msgBox.style.borderRadius = "6px";
    msgBox.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    msgBox.style.zIndex = "9999";
    msgBox.style.fontSize = "14px";

    document.body.appendChild(msgBox);
  }

  msgBox.textContent = message;
  msgBox.style.display = "block";

  setTimeout(() => {
    msgBox.style.display = "none";
  }, 1000);
}

// ==============================
// App state
// ==============================
let currentUser = null;
let COA = [];
let currentCOAType = "All";
let lines = []; // loaded from Supabase (journal_lines)

let journalFilterFrom = "";
let journalFilterTo = "";

let ledgerFilterFrom = "";
let ledgerFilterTo = "";

let worksheetFilterFrom = "";
let worksheetFilterTo = "";

let currentManagedUser = null;
let selectedCOAId = "";
const COMPANY_ID = "exodia-main";
  
// ==============================
// AUTH UI helpers
// ==============================
function setUI(isLoggedIn, email = "") {
  const app = $("app");
  const authBox = $("auth-box");
  const outBox = $("auth-logged-out");
  const inBox = $("auth-logged-in");
  const userEl = $("auth-user");
  const topEmailEl = $("profile-email-top");
  const greetingEl = $("profile-greeting");
  const avatarEl = $("profile-avatar");
  const avatarLargeEl = $("profile-avatar-large");

  if (isLoggedIn) {
    if (authBox) {
      authBox.style.minHeight = "0";
      authBox.style.background = "transparent";
    }

    if (app) app.style.display = "block";
    if (outBox) outBox.style.display = "none";
    if (inBox) inBox.style.display = "inline-flex";
    if (userEl) userEl.textContent = email || "";
    if (topEmailEl) topEmailEl.textContent = email || "";

    const displayName = (email || "User").split("@")[0];
    if (greetingEl) greetingEl.textContent = `Hi, ${displayName}!`;

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(email || "User")}&background=ff8a00&color=fff`;

    if (avatarEl) avatarEl.src = avatarUrl;
    if (avatarLargeEl) avatarLargeEl.src = avatarUrl;
  } else {
    if (authBox) {
      authBox.style.minHeight = "100vh";
      authBox.style.background = "#f5f6f8";
    }

    if (app) app.style.display = "none";
    if (outBox) outBox.style.display = "block";
    if (inBox) inBox.style.display = "none";
    if (userEl) userEl.textContent = "";
    if (topEmailEl) topEmailEl.textContent = "";
    if (greetingEl) greetingEl.textContent = "Hi!";
    closeProfileMenu();
  }
}

function setAuthMsg(text, isError = false) {
  const msg = $("auth-msg");
  if (!msg) return;
  msg.textContent = text || "";
  msg.style.color = isError ? "crimson" : "";
}

function setAuthMsgIn(text) {
  const msg = $("auth-msg-in");
  if (!msg) return;
  msg.textContent = text || "";
  msg.style.display = text ? "inline" : "none";
}

function clearAuthInputs() {
  const e = $("auth-email");
  const p = $("auth-pass");
  if (e) e.value = "";
  if (p) p.value = "";
}

function refreshLoginButtonState() {
  const btn = $("auth-login-btn");
  const email = ($("auth-email")?.value || "").trim();
  const pass = $("auth-pass")?.value || "";
  if (btn) btn.disabled = !(email && pass);
}

function initPasswordToggle() {
  const btn = $("auth-toggle-pass");
  const pass = $("auth-pass");
  if (!btn || !pass) return;

  btn.addEventListener("click", () => {
    pass.type = pass.type === "password" ? "text" : "password";
    btn.textContent = pass.type === "password" ? "👁" : "🙈";
  });
}

// ==============================
// AUTH actions
// ==============================
window.signIn = async function signIn() {
  const email = ($("auth-email")?.value || "").trim();
  const password = $("auth-pass")?.value || "";

  setAuthMsg("Logging in...");

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    clearAuthInputs();
    refreshLoginButtonState();
    setAuthMsg(error.message || "Login failed.", true);
    setUI(false);
    return;
  }

  currentUser = data.user;

  const { data: accessRow, error: accessError } = await sb
    .from("user_access")
    .select("*")
    .eq("email", currentUser.email)
    .single();

  if (accessError || !accessRow) {
    await sb.auth.signOut();
    currentUser = null;
    setAuthMsg("No user access record found. Please contact admin.", true);
    setUI(false);
    return;
  }

  if (String(accessRow.status || "").toLowerCase() === "disabled") {
    await sb.auth.signOut();
    currentUser = null;
    setAuthMsg("Your account is disabled. Please contact admin.", true);
    setUI(false);
    return;
  }
  
  setAuthMsg("");
  setUI(true, currentUser?.email || email);

  await initAppAfterLogin();
};

window.signOut = async function signOut() {
  await sb.auth.signOut();

  clearAuthInputs();
  refreshLoginButtonState();

  currentUser = null;
  setAuthMsg("Logged out.");
  setAuthMsgIn("");
  closeProfileMenu();
  setUI(false);
};

window.toggleProfileMenu = function toggleProfileMenu(event) {
  event?.stopPropagation?.();

  const menu = $("profile-menu");
  if (!menu) return;

  menu.style.display = menu.style.display === "block" ? "none" : "block";
};

window.closeProfileMenu = function closeProfileMenu() {
  const menu = $("profile-menu");
  if (menu) menu.style.display = "none";
};

window.goToCreateUser = function goToCreateUser() {
  window.location.href = "./create-user.html";
};

window.goToManageUserAccess = function goToManageUserAccess() {
  window.location.href = "./manage-user-access.html";
};

window.toggleLedgerDownloadMenu = function toggleLedgerDownloadMenu(event) {
  event?.stopPropagation?.();

  const menu = $("ledger-download-menu");
  if (!menu) return;

  menu.style.display = menu.style.display === "block" ? "none" : "block";
};

window.closeLedgerDownloadMenu = function closeLedgerDownloadMenu() {
  const menu = $("ledger-download-menu");
  if (menu) menu.style.display = "none";
};

document.addEventListener("click", (e) => {
  const isProfileBtn = e.target?.closest?.("#profile-btn");
  const isProfileMenu = e.target?.closest?.("#profile-menu");

  if (!isProfileBtn && !isProfileMenu) {
    closeProfileMenu();
  }
  
});

// ==============================
// Supabase helpers (JOURNAL LINES)
// ==============================
function normalizeLine(row) {
  const h = row.journal_entries || {};
  return {
    id: row.id,
    journal_id: row.journal_id || null,
    is_deleted: row.is_deleted ?? false,
    entry_date: row.entry_date,
    ref: row.ref,

    description: h.description || "",
    department: h.department || "",
    payment_method: h.payment_method || "",
    client_vendor: h.client_vendor || "",
    remarks: h.remarks || "",

    accountId: row.account_id,
    accountName: row.account_name || "",
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    created_at: row.created_at,
  };
}

function normalizeEntry(row) {
  return {
    id: row.id,
    entry_date: row.entry_date,
    ref: row.ref,
    description: row.description || "",
    department: row.department || "",
    payment_method: row.payment_method || "",
    client_vendor: row.client_vendor || "",
    remarks: row.remarks || "",
    created_at: row.created_at,
  };
}

async function sbFetchJournalEntries() {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("journal_entries")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Entries fetch error:", error);
    return [];
  }

  return (data || []).map(normalizeEntry);
}

async function sbFetchJournalLines() {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("journal_lines")
    .select(`
      *,
      journal_entries:journal_id (
        description,
        department,
        payment_method,
        client_vendor,
        remarks
      )
    `)
    .eq("company_id", COMPANY_ID)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Journal fetch error:", error);
    return [];
  }

  return (data || []).map(normalizeLine);
}

async function sbUpdateCOA(id, patch) {
  const { error } = await sb
    .from("coa_accounts")
    .update(patch)
    .eq("id", id)
    .eq("company_id", COMPANY_ID);

  if (error) throw error;
}

async function sbFetchJournalLinesByJournalId(journal_id) {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("journal_lines")
    .select("*")
    .eq("journal_id", journal_id)
    .eq("company_id", COMPANY_ID)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Lines by journal_id fetch error:", error);
    return [];
  }

  return data || [];
}

async function sbFetchJournalLinesForEntry(journal_id) {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("journal_lines")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .eq("journal_id", journal_id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Lines fetch error:", error);
    return [];
  }

  return data || [];
}

async function sbInsertJournalLines(rows) {
  const { error } = await sb.from("journal_lines").insert(rows);
  if (error) throw error;
}

async function loadLinesFromDb() {
  try {
    return await sbFetchJournalLines();
  } catch (e) {
    console.error("loadLinesFromDb failed:", e);
    return [];
  }
}

async function sbFetchJournalEntryById(id) {
  if (!currentUser) return null;

  const { data, error } = await sb
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .eq("company_id", COMPANY_ID)
    .single();

  if (error) {
    console.error("Entry by ID fetch error:", error);
    return null;
  }

  return data;
}

// ==============================
// COA indexing + line account resolver
// ==============================
let COA_BY_ID = {};
let COA_BY_CODE = {};

function rebuildCoaIndex() {
  COA_BY_ID = {};
  COA_BY_CODE = {};
  (COA || []).forEach((a) => {
    const id = String(a.id || "").trim();
    const code = String(a.code || "").trim();
    if (id) COA_BY_ID[id] = a;
    if (code) COA_BY_CODE[code] = a;
  });
}

function parseCodeFromAccountName(accountName) {
  const t = String(accountName || "").trim();
  if (!t.includes(" - ")) return "";
  return String(t.split(" - ")[0] || "").trim();
}

function resolveAccountId(rawAccountId, accountName) {
  const raw = String(rawAccountId || "").trim();
  if (!raw) return "";

  // already an actual COA id
  if (COA_BY_ID[raw]) return raw;

  // if raw is a code (e.g. "1001")
  if (COA_BY_CODE[raw]?.id) return String(COA_BY_CODE[raw].id);

  // if raw looks like "1001 - Cash on Hand"
  const rawCode = parseCodeFromAccountName(raw);
  if (rawCode && COA_BY_CODE[rawCode]?.id) return String(COA_BY_CODE[rawCode].id);

  // fallback: try account_name column
  const code = parseCodeFromAccountName(accountName);
  if (code && COA_BY_CODE[code]?.id) return String(COA_BY_CODE[code].id);

  return raw;
}

function resolveLinesAccountIds() {
  rebuildCoaIndex();
  lines = (lines || []).map((l) => ({
    ...l,
    resolvedAccountId: resolveAccountId(l.accountId, l.accountName),
  }));
}

function makeAccountSelect() {
  const sel = document.createElement("select");

  const sorted = [...COA].sort((a, b) => codeNum(a.code) - codeNum(b.code));
  sorted.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = String(a.id); // IMPORTANT: UUID
    opt.textContent = `${a.code} - ${a.name}`;
    sel.appendChild(opt);
  });

  return sel;
}

function renderEditLines(linesForEdit) {
  const tbody = document.getElementById("edit-lines-body"); // <-- change to your edit page tbody id
  if (!tbody) return;

  tbody.innerHTML = "";

  linesForEdit.forEach((line) => {
    const tr = document.createElement("tr");

    const sel = makeAccountSelect();
    const resolvedId = resolveAccountId(line.account_id, line.account_name);

    // fallback option if account doesn't exist anymore
    if (![...sel.options].some((o) => o.value === resolvedId)) {
      const fallback = document.createElement("option");
      fallback.value = resolvedId || "";
      fallback.textContent = line.account_name || "(Unknown account)";
      sel.prepend(fallback);
    }

    sel.value = resolvedId;

    const tdAcct = document.createElement("td");
    tdAcct.appendChild(sel);
    tr.appendChild(tdAcct);

    tbody.appendChild(tr);
  });
}

// ==============================
// Supabase helpers (CHART OF ACCOUNTS)
// ==============================
function normalizeCOA(row) {
  return {
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    type: row.type || "",
    normal: row.normal || "",
    is_deleted: row.is_deleted ?? false,
  };
}

async function sbFetchCOA() {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("coa_accounts")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("code", { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeCOA);
}

async function sbInsertCOA(row) {
  const { data, error } = await sb
    .from("coa_accounts")
    .insert([row])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function sbFindCOAByCodeIncludeDeleted(code) {
  if (!currentUser) return null;

  const { data, error } = await sb
    .from("coa_accounts")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .eq("code", String(code || "").trim())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data && data[0]) ? data[0] : null;
}

async function sbCreateOrRestoreCOA(row) {
  const code = String(row.code || "").trim();
  if (!code) throw new Error("Account code is required.");

  const existing = await sbFindCOAByCodeIncludeDeleted(code);

  // If existing active account already uses this code
  if (existing && !existing.is_deleted) {
    const err = new Error(`Code ${code} already exists.`);
    err.code = "DUPLICATE_ACTIVE_CODE";
    throw err;
  }

  // If existing deleted account uses this code, restore it instead of inserting
  if (existing && existing.is_deleted) {
    const { data, error } = await sb
      .from("coa_accounts")
      .update({
        name: row.name,
        type: row.type,
        normal: row.normal,
        is_deleted: false,
        updated_at: new Date().toISOString(),
        user_id: row.user_id,
        created_by: row.created_by,
      })
      .eq("id", existing.id)
      .eq("company_id", COMPANY_ID)
      .select("*")
      .single();

    if (error) throw error;
    return { data, restored: true };
  }

  // Otherwise insert new
  const data = await sbInsertCOA(row);
  return { data, restored: false };
}

async function sbSoftDeleteCOA(id) {
  const { error } = await sb
    .from("coa_accounts")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", COMPANY_ID);

  if (error) throw error;
}

// Upsert helper (used for importing JSON COA into DB without duplicates)
async function sbUpsertCOA(rows) {
  const { error } = await sb
    .from("coa_accounts")
    .upsert(rows, { onConflict: "company_id,code" });
  if (error) throw error;
}

// If DB has no COA yet (or is missing many), import/merge from JSON
async function seedCOAFromJsonIfNeeded() {
  let json = [];
  try {
    const raw = await fetch("./data/coa.json").then((r) => r.json());
    json = Array.isArray(raw) ? raw : [];
  } catch (e) {
    return; // no json
  }

  if (!json.length) return;

  let db = [];
  try {
    db = await sbFetchCOA();
  } catch (e) {
    console.warn("COA DB load failed (skip JSON import):", e);
    return;
  }

  const existingCodes = new Set(db.map((a) => String(a.code || "").trim()));
  const missing = json
    .map((r) => ({
      code: String(r.code || "").trim(),
      name: String(r.name || "").trim(),
      type: String(r.type || "").trim(),
      normal: String(r.normal || "").trim(),
    }))
    .filter((r) => r.code && r.name && !existingCodes.has(r.code));

  if (!missing.length) return;

 const rows = missing.map((r) => ({
  user_id: currentUser.id,
  company_id: COMPANY_ID,
  created_by: currentUser.id,
  code: r.code,
  name: r.name,
  type: r.type || "Asset",
  normal: r.normal || "Debit",
  is_deleted: false,
}));
  
  try {
    await sbUpsertCOA(rows);
  } catch (e) {
    console.warn("COA JSON import failed:", e);
  }
}

async function loadCOAFromDbOrJson() {
  // await seedCOAFromJsonIfNeeded();

  try {
    const dbCOA = await sbFetchCOA();
    if (dbCOA.length > 0) return dbCOA;
  } catch (e) {
    console.warn("COA DB load failed (will fallback to JSON):", e);
  }

  try {
    const json = await fetch("./data/coa.json").then((r) => r.json());
    const arr = Array.isArray(json) ? json : [];
    return arr.map((r) => ({
      id: r.id || r.code || crypto?.randomUUID?.() || String(Math.random()),
      code: r.code || "",
      name: r.name || "",
      type: r.type || "",
      normal: r.normal || "",
      is_deleted: false,
    }));
  } catch (e) {
    console.warn("COA JSON load failed:", e);
    return [];
  }
}

// ==============================
// Required-field helper (GLOBAL)
// ==============================
function markRequired(el, isBad) {
  if (!el) return;
  el.style.border = isBad ? "2px solid crimson" : "";
}

window.filterLedgerAccounts = function filterLedgerAccounts() {
  const sel = $("ledger-account");
  if (!sel) return;

  const q = ($("ledger-search")?.value || "").trim().toLowerCase();

  // rebuild dropdown every time based on search
  sel.innerHTML = "";

  const o0 = document.createElement("option");
o0.value = "";
o0.textContent = q ? "Please select an account from the results" : "Please select an account to view the ledger";
sel.appendChild(o0);

  const sorted = [...COA].sort((a, b) => {
    const ca = codeNum(a.code);
    const cb = codeNum(b.code);
    if (ca !== cb) return ca - cb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  const filtered = q
    ? sorted.filter((a) => {
        const text = `${a.code} ${a.name} ${a.type}`.toLowerCase();
        return text.includes(q);
      })
    : sorted;

  filtered.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.code} - ${a.name}`;
    sel.appendChild(opt);
  });

  // keep previous selection if still visible
  const saved = localStorage.getItem(LEDGER_ACCOUNT_KEY) || "";
  if (saved && [...sel.options].some((o) => o.value === saved)) {
    sel.value = saved;
  }

  renderLedger();
};

// ==============================
// COA datalist (for searchable picker)
// ==============================
function refreshCoaDatalist() {
  const listId = "coa-datalist";
  let dl = document.getElementById(listId);

  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = listId;
    document.body.appendChild(dl);
  }

  dl.innerHTML = "";

  const sorted = [...COA].sort((a, b) => {
    const ca = codeNum(a.code);
    const cb = codeNum(b.code);
    if (ca !== cb) return ca - cb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  sorted.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = `${a.code} - ${a.name}`;
    dl.appendChild(opt);
  });
}

function textToAccountId(text) {
  const t = String(text || "").trim().toLowerCase();
  const found = COA.find((a) => (`${a.code} - ${a.name}`).toLowerCase() === t);
  return found ? found.id : "";
}

// ==============================
// Filters (Year/Month)
// ==============================
window.applyDateRangeFilter = function () {
  const from = $("filter-from")?.value || "";
  const to = $("filter-to")?.value || "";

  const mainView =
  sessionStorage.getItem(TAB_VIEW_KEY) ||
  localStorage.getItem(LAST_VIEW_KEY) ||
  "coa";
  const journalView = localStorage.getItem(JOURNAL_VIEW_KEY) || "entry";

  if (mainView === "journal" && journalView === "history") {
    journalFilterFrom = from;
    journalFilterTo = to;
    localStorage.setItem(JOURNAL_FILTER_FROM_KEY, from);
    localStorage.setItem(JOURNAL_FILTER_TO_KEY, to);
    renderHistory();
    return;
  }

  if (mainView === "ledger") {
    ledgerFilterFrom = from;
    ledgerFilterTo = to;
    localStorage.setItem(LEDGER_FILTER_FROM_KEY, from);
    localStorage.setItem(LEDGER_FILTER_TO_KEY, to);
    renderLedger();
    return;
  }

  if (mainView === "trial") {
    worksheetFilterFrom = from;
    worksheetFilterTo = to;
    localStorage.setItem(WORKSHEET_FILTER_FROM_KEY, from);
    localStorage.setItem(WORKSHEET_FILTER_TO_KEY, to);

    const wsPL = $("ws-pl");
    const wsSFP = $("ws-sfp");
    const wsFRS = $("ws-frs");

    if (wsPL && wsPL.style.display === "block") renderProfitAndLoss();
    else if (wsSFP && wsSFP.style.display === "block") renderStatementOfFinancialPosition();
    else if (wsFRS && wsFRS.style.display === "block") renderFinancialReportSummary();
    else renderTrialBalance();

    return;
  }
};

window.clearDateRange = function () {
  if ($("filter-from")) $("filter-from").value = "";
  if ($("filter-to")) $("filter-to").value = "";

  const mainView =
  sessionStorage.getItem(TAB_VIEW_KEY) ||
  localStorage.getItem(LAST_VIEW_KEY) ||
  "coa";
  const journalView = localStorage.getItem(JOURNAL_VIEW_KEY) || "entry";

  if (mainView === "journal" && journalView === "history") {
    journalFilterFrom = "";
    journalFilterTo = "";
    localStorage.removeItem(JOURNAL_FILTER_FROM_KEY);
    localStorage.removeItem(JOURNAL_FILTER_TO_KEY);
    renderHistory();
    return;
  }

  if (mainView === "ledger") {
    ledgerFilterFrom = "";
    ledgerFilterTo = "";
    localStorage.removeItem(LEDGER_FILTER_FROM_KEY);
    localStorage.removeItem(LEDGER_FILTER_TO_KEY);
    renderLedger();
    return;
  }

  if (mainView === "trial") {
    worksheetFilterFrom = "";
    worksheetFilterTo = "";
    localStorage.removeItem(WORKSHEET_FILTER_FROM_KEY);
    localStorage.removeItem(WORKSHEET_FILTER_TO_KEY);

    const wsPL = $("ws-pl");
    const wsSFP = $("ws-sfp");
    const wsFRS = $("ws-frs");

    if (wsPL && wsPL.style.display === "block") renderProfitAndLoss();
    else if (wsSFP && wsSFP.style.display === "block") renderStatementOfFinancialPosition();
    else if (wsFRS && wsFRS.style.display === "block") renderFinancialReportSummary();
    else renderTrialBalance();

    return;
  }
};

// ==============================
// Journal sub-tabs (Entry / History)
// ==============================
window.showJournal = function (which) {
  localStorage.setItem(JOURNAL_VIEW_KEY, which);

  const entry = $("journal");
  const hist = $("journal-history");
  const dateBar = $("date-range-bar");

  if (entry) entry.style.display = (which === "entry") ? "block" : "none";
  if (hist) hist.style.display = (which === "history") ? "block" : "none";

  // hide date range on Journal Entry, show on Journal History
  if (dateBar) dateBar.style.display = (which === "history") ? "flex" : "none";

  if (which === "entry") {
    const tbody = $("je-lines");
    if (tbody && tbody.children.length === 0) {
      addLine();
      addLine();
    }
  }

  if (which === "history") renderHistory();

  loadCurrentViewDateInputs();
};

window.showWorksheet = function (view) {
  localStorage.setItem(WORKSHEET_VIEW_KEY, view);

  const trial = $("ws-trial");
  const pl = $("ws-pl");
  const sfp = $("ws-sfp");
  const frs = $("ws-frs");

  if (trial) trial.style.display = (view === "trial") ? "block" : "none";
  if (pl) pl.style.display = (view === "pl") ? "block" : "none";
  if (sfp) sfp.style.display = (view === "sfp") ? "block" : "none";
  if (frs) frs.style.display = (view === "frs") ? "block" : "none";

  document.querySelectorAll(".worksheet-tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const buttons = document.querySelectorAll(".worksheet-tab-btn");
  if (view === "trial" && buttons[0]) buttons[0].classList.add("active");
  if (view === "pl" && buttons[1]) buttons[1].classList.add("active");
  if (view === "sfp" && buttons[2]) buttons[2].classList.add("active");
  if (view === "frs" && buttons[3]) buttons[3].classList.add("active");

  if (view === "trial") renderTrialBalance();
  if (view === "pl") renderProfitAndLoss();
  if (view === "sfp") renderStatementOfFinancialPosition();
  if (view === "frs") renderFinancialReportSummary();

  loadCurrentViewDateInputs();
};

// ==============================
// Tabs
// ==============================
window.show = function (view) {
  if (view === "journal-history") view = "journal";

  sessionStorage.setItem(TAB_VIEW_KEY, view);
  localStorage.setItem(LAST_VIEW_KEY, view);

  ["coa", "journal", "ledger", "trial"].forEach((v) => {
    const el = $(v);
    if (!el) return;
    el.style.display = (v === view) ? "block" : "none";
  });

  const hist = $("journal-history");
  if (hist) hist.style.display = "none";

  const coaTb = $("coa-toolbar");
  if (coaTb) coaTb.style.display = (view === "coa") ? "block" : "none";

  const journalTb = $("journal-toolbar");
  if (journalTb) journalTb.style.display = (view === "journal") ? "block" : "none";

  const dateBar = $("date-range-bar");
  const journalMode = localStorage.getItem(JOURNAL_VIEW_KEY) || "entry";

  if (view === "coa") {
    if (dateBar) dateBar.style.display = "none";
  } else if (view === "ledger") {
    if (dateBar) dateBar.style.display = "flex";
  } else if (view === "trial") {
    if (dateBar) dateBar.style.display = "flex";
  } else if (view === "journal") {
    if (dateBar) dateBar.style.display = (journalMode === "history") ? "flex" : "none";
  } else {
    if (dateBar) dateBar.style.display = "none";
  }

  if (view === "coa") renderCOA();
  if (view === "ledger") renderLedger();

  if (view === "trial") {
    const savedWorksheetView = localStorage.getItem(WORKSHEET_VIEW_KEY) || "trial";
    showWorksheet(savedWorksheetView);
  }

  if (view === "journal") {
    const savedJournalView = localStorage.getItem(JOURNAL_VIEW_KEY) || "entry";
    showJournal(savedJournalView);
  }

  loadCurrentViewDateInputs();
};

// ==============================
// COA buttons filter
// ==============================
window.filterCOA = function (type) {
  currentCOAType = type;
  renderCOA();
};

window.editAccountPrompt = async function editAccountPrompt(accountId) {
  if (!canEditBooks()) {
  alert("You only have view access.");
  return;
}
  
  if (!currentUser) return alert("Please login first.");
  const acct = COA.find((a) => a.id === accountId);
  if (!acct) return alert("Account not found.");

  const newName = (prompt(`Edit Account Name for ${acct.code} - ${acct.name}:`, acct.name) || "").trim();
  if (!newName) return;

  try {
    await sbUpdateCOA(accountId, { name: newName, updated_at: new Date().toISOString() });

    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    renderCOA();
    renderLedger();
    renderTrialBalance();

    alert("✅ Account updated!");
  } catch (e) {
    console.error(e);
    alert("❌ Failed to update. Check policies.");
  }
};

// ==============================
// Add Account (from your COA form in HTML)
// ==============================
window.addCOAAccount = async function addCOAAccount() {
  if (!currentUser) return alert("Please login first.");

  const codeEl = $("coa-code");
  const nameEl = $("coa-name");
  const typeEl = $("coa-type");
  const normalEl = $("coa-normal");

  const code = (codeEl?.value || "").trim();
  const name = (nameEl?.value || "").trim();
  const type = (typeEl?.value || "").trim();
  const normal = (normalEl?.value || "").trim();

  markRequired(codeEl, !code);
  markRequired(nameEl, !name);

  if (!code || !name) return;

    try {
    const result = await sbCreateOrRestoreCOA({
      user_id: currentUser.id,
      company_id: COMPANY_ID,
      created_by: currentUser.id,
      code,
      name,
      type,
      normal,
      is_deleted: false,
    });

    if (codeEl) codeEl.value = "";
    if (nameEl) nameEl.value = "";

    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    renderCOA();
    renderLedger();
    renderTrialBalance();

    showSuccessMessage("✅ Account added successfully!");
  } catch (e) {
    console.error(e);
        if (e?.code === "23505" || e?.code === "DUPLICATE_ACTIVE_CODE") {
      alert(`❌ Code ${code} already exists.`);
      return;
    }

    alert("❌ Failed to add account.");;
  }
};

// ==============================
// Journal Entry
// ==============================
window.addLine = function () {
  if (!canEditBooks()) {
    alert("You only have view access.");
    return;
  }

  const tbody = $("je-lines");
  if (!tbody) return;

  const tr = document.createElement("tr");

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "6px";

  const acctInput = document.createElement("input");
  acctInput.placeholder = "Type to search account (code or name)...";
  acctInput.style.width = "100%";
  acctInput.setAttribute("list", "coa-datalist");

  const acctId = document.createElement("input");
  acctId.type = "hidden";

  acctInput.addEventListener("input", () => {
    acctId.value = textToAccountId(acctInput.value);
  });

  wrap.appendChild(acctInput);
  wrap.appendChild(acctId);

  const debit = document.createElement("input");
  debit.placeholder = "0.00";
  debit.style.width = "100%";

  const credit = document.createElement("input");
  credit.placeholder = "0.00";
  credit.style.width = "100%";

  const delBtn = document.createElement("button");
delBtn.textContent = "Remove";
delBtn.className = "btn-soft";
delBtn.style.fontSize = "14px";
delBtn.style.padding = "8px 12px";
delBtn.onclick = () => tr.remove();

  tr.appendChild(tdWrap(wrap));
  tr.appendChild(tdWrap(debit, true));
  tr.appendChild(tdWrap(credit, true));
  tr.appendChild(tdWrap(delBtn, true));

  tbody.appendChild(tr);
};

window.saveJournal = async function () {
  if (!canEditBooks()) {
    setStatus("You only have view access.");
    return;
  }

  if (!currentUser) return setStatus("Please login first.");

  const entry_date = $("je-date")?.value || "";
  const ref = ($("je-refno")?.value || "").trim();
  const description = ($("je-description")?.value || "").trim();

  markRequired($("je-date"), !entry_date);
  markRequired($("je-refno"), !ref);
  markRequired($("je-description"), !description);

  if (!entry_date || !ref || !description) {
    setStatus("Please fill all required (*) fields before saving.");
    return;
  }

  const department = ($("je-dept")?.value || "").trim();
  const payment_method = ($("je-paymethod")?.value || "").trim();
  const client_vendor = ($("je-client")?.value || "").trim();
  const remarks = ($("je-remarks")?.value || "").trim();

  const rows = [...$("je-lines").querySelectorAll("tr")];
  const lineRows = [];

  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach((r) => {
    const hidden = r.querySelector('input[type="hidden"]');
    const tds = r.querySelectorAll("td");

    const accountId = hidden?.value || "";
    const debitInput = tds[1]?.querySelector("input");
    const creditInput = tds[2]?.querySelector("input");

    const d = parseMoney(debitInput?.value);
    const c = parseMoney(creditInput?.value);

    if (!accountId) return;
    if (!d && !c) return;

    const acct = COA.find((a) => a.id === accountId);
    const accountName = acct ? `${acct.code} - ${acct.name}` : "";

    totalDebit += d;
    totalCredit += c;

 lineRows.push({
  user_id: currentUser.id,
  company_id: COMPANY_ID,
  created_by: currentUser.id,
  journal_id: null,
  entry_date,
  ref,
  account_id: accountId,
  account_name: accountName,
  debit: d,
  credit: c,
});
});

  if (lineRows.length < 2) return setStatus("Add at least 2 lines.");
  if (Math.abs(totalDebit - totalCredit) > 0.00001) {
    setStatus("❌ Journal Entry is not balanced. Please match Debit and Credit.");
    return;
  }

  const { data: entry, error: entryErr } = await sb
    .from("journal_entries")
    .insert([
     {
  user_id: currentUser.id,
  company_id: COMPANY_ID,
  created_by: currentUser.id,
  entry_date,
  ref,
  description,
  department,
  payment_method,
  client_vendor,
  remarks,
},
    ])
    .select("id")
    .single();

  if (entryErr) {
    if (entryErr.code === "23505") {
      return setStatus("Save failed ❌ Ref No already exists. Use a new Ref No.");
    }
    console.error(entryErr);
    return setStatus("Save failed ❌ Policy/table error.");
  }

  const journal_id = entry.id;
  const finalLines = lineRows.map((r) => ({ ...r, journal_id }));

  try {
    await sbInsertJournalLines(finalLines);

    lines = await loadLinesFromDb();
    resolveLinesAccountIds();

   // keep the selected date, clear the other fields
if ($("je-refno")) $("je-refno").value = "";
if ($("je-description")) $("je-description").value = "";
if ($("je-dept")) $("je-dept").value = "";
if ($("je-paymethod")) $("je-paymethod").value = "";
if ($("je-client")) $("je-client").value = "";
if ($("je-remarks")) $("je-remarks").value = "";

// clear journal lines and give 2 fresh rows
$("je-lines").innerHTML = "";
addLine();
addLine();

// remove red borders after successful save
markRequired($("je-refno"), false);
markRequired($("je-description"), false);
markRequired($("je-date"), false);

setStatus("Saved ✅ General Ledger updated automatically.");
renderCOA();
renderLedger();
renderTrialBalance();
  } catch (e) {
    console.error(e);
    setStatus("Save failed ❌ Check console + Supabase policies.");
  }
};

// ==============================
// Render COA  ✅ FIXED (no nested forEach, no missing braces)
// ==============================
function renderCOA() {
  const tbody = $("coa-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  const balances = computeBalancesAsOf("");

  const totalsByType = {
    Asset: 0,
    Liability: 0,
    Equity: 0,
    Revenue: 0,
    Expense: 0,
  };

  COA.forEach((a) => {
    const bal = balances[a.id] || 0;
    const typeKey = normalizeAccountType(a.type);

    if (typeKey && totalsByType[typeKey] !== undefined) {
      totalsByType[typeKey] += bal;
    }
  });

  if ($("sum-asset")) $("sum-asset").textContent = money(totalsByType.Asset || 0);
  if ($("sum-liability")) $("sum-liability").textContent = money(totalsByType.Liability || 0);
  if ($("sum-equity")) $("sum-equity").textContent = money(totalsByType.Equity || 0);
  if ($("sum-revenue")) $("sum-revenue").textContent = money(totalsByType.Revenue || 0);
  if ($("sum-expense")) $("sum-expense").textContent = money(totalsByType.Expense || 0);

  const typeOrder = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 };

  const list = COA
    .filter((a) => currentCOAType === "All" || a.type === currentCOAType)
    .sort((a, b) => {
      const ta = typeOrder[a.type] ?? 99;
      const tb = typeOrder[b.type] ?? 99;
      if (ta !== tb) return ta - tb;

      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  list.forEach((a) => {
    const bal = balances[a.id] || 0;

   const tr = document.createElement("tr");
tr.setAttribute("data-coa-row", a.id);

tr.addEventListener("click", () => {
  selectedCOAId = a.id;
});

const actionHtml = canEditBooks()
  ? `
    <button class="coa-action-btn" onclick="toggleCoaMenu('${a.id}', event)">⋯</button>
    <div class="coa-menu" data-coa-menu="${a.id}">
      <button onclick="editAccountPrompt('${a.id}')">✏️ Edit name</button>
      <button class="danger" onclick="deleteCOAAccount('${a.id}')">🗑 Delete</button>
    </div>
  `
  : `<span class="muted">View only</span>`;

tr.innerHTML = `
  <td>${esc(a.code)}</td>
  <td>${esc(a.name)}</td>
  <td>${esc(a.type)}</td>
  <td>${esc(a.normal)}</td>
  <td style="text-align:right;">${money(bal)}</td>
  <td style="position:relative; text-align:right;">
    ${actionHtml}
  </td>
`;

tbody.appendChild(tr);
  });

  if (list.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">No accounts found for this filter.</td>`;
    tbody.appendChild(tr);
  }
}

// ==============================
// Render Ledger
// ==============================
function renderLedger() {
  const sel = $("ledger-account");
  const tbody = $("ledger-body");
  if (!sel || !tbody) return;

  if (sel.options.length === 0) {
    sel.innerHTML = "";

    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Please select an account to view the ledger";
    sel.appendChild(o0);

    const sorted = [...COA].sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    sorted.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.code} - ${a.name}`;
      sel.appendChild(opt);
    });

    const savedAcct = localStorage.getItem(LEDGER_ACCOUNT_KEY) || "";

    if (savedAcct) {
      if (!COA_BY_ID[savedAcct] && COA_BY_CODE[savedAcct]?.id) {
        sel.value = String(COA_BY_CODE[savedAcct].id);
      } else if ([...sel.options].some((o) => o.value === savedAcct)) {
        sel.value = savedAcct;
      } else {
        sel.value = "";
      }
    } else {
      sel.value = "";
    }
  }

  tbody.innerHTML = "";

  const accountId = String(sel.value || "").trim();
  localStorage.setItem(LEDGER_ACCOUNT_KEY, accountId);

  if (!accountId) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="11" style="text-align:center; padding:20px;">
        Please select an account to view the ledger.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  const acct = COA.find((a) => a.id === accountId);
  const normal = acct?.normal || "Debit";

  const acctLines = lines
    .filter((l) => !l.is_deleted)
    .filter((l) => (l.resolvedAccountId || l.accountId) === accountId)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (ledgerFilterFrom && d < ledgerFilterFrom) return false;
      if (ledgerFilterTo && d > ledgerFilterTo) return false;
      return true;
    })
    .sort(
  (a, b) =>
    String(a.entry_date || "").localeCompare(String(b.entry_date || "")) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""))
);

  let running = 0;

  acctLines.forEach((l) => {
    const delta =
      normal === "Credit"
        ? num(l.credit) - num(l.debit)
        : num(l.debit) - num(l.credit);

    running += delta;

    const tr = document.createElement("tr");
    const canEdit = !!l.journal_id;

    tr.innerHTML = `
      <td>${esc(l.entry_date)}</td>
      <td>${esc(l.ref)}</td>
      <td>${esc(l.description || "")}</td>
      <td>${esc(l.department || "")}</td>
      <td>${esc(l.payment_method || "")}</td>
      <td>${esc(l.client_vendor || "")}</td>
      <td>${esc(l.remarks || "")}</td>
      <td style="text-align:right;">${money(l.debit)}</td>
      <td style="text-align:right;">${money(l.credit)}</td>
      <td style="text-align:right;">${money(running)}</td>
      <td>
        ${
          canEdit
            ? `<a href="./edit.html?journal_id=${encodeURIComponent(
                l.journal_id
              )}&account_id=${encodeURIComponent(accountId)}">Edit / Delete</a>`
            : `<span class="muted">N/A</span>`
        }
      </td>
    `;

    tbody.appendChild(tr);
  });

  if (acctLines.length === 0) {
    const hasDateFilter = !!(ledgerFilterFrom || ledgerFilterTo);
    const emptyMessage = hasDateFilter
      ? "No transactions found for the selected account within the specified date range."
      : "No transactions found for the selected account.";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="11" style="text-align:center; padding:20px;">
        ${emptyMessage}
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function getCurrentLedgerExportData() {
  const sel = $("ledger-account");
  if (!sel) return null;

  const accountId = String(sel.value || "").trim();
  if (!accountId) return null;

  const acct = COA.find((a) => a.id === accountId);
  if (!acct) return null;

  const normal = acct.normal || "Debit";

  const acctLines = lines
    .filter((l) => !l.is_deleted)
    .filter((l) => (l.resolvedAccountId || l.accountId) === accountId)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (ledgerFilterFrom && d < ledgerFilterFrom) return false;
      if (ledgerFilterTo && d > ledgerFilterTo) return false;
      return true;
    })
    .sort(
      (a, b) =>
        String(a.entry_date || "").localeCompare(String(b.entry_date || "")) ||
        String(a.ref || "").localeCompare(String(b.ref || ""))
    );

  let running = 0;

  const rows = acctLines.map((l) => {
    const delta =
      normal === "Credit"
        ? num(l.credit) - num(l.debit)
        : num(l.debit) - num(l.credit);

    running += delta;

    return {
      date: l.entry_date || "",
      ref: l.ref || "",
      description: l.description || "",
      department: l.department || "",
      payment_method: l.payment_method || "",
      client_vendor: l.client_vendor || "",
      remarks: l.remarks || "",
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      running_balance: running
    };
  });

  return {
    account: acct,
    rows
  };
}

window.downloadLedgerPDF = function downloadLedgerPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const exportData = getCurrentLedgerExportData();
  if (!exportData) {
    alert("Please select an account first.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "mm", "a4");

  const accountLabel = `${exportData.account.code} - ${exportData.account.name}`;

  let subtitle = `Account: ${accountLabel}`;
  if (ledgerFilterFrom && ledgerFilterTo) {
    subtitle += ` | Date Range: ${ledgerFilterFrom} to ${ledgerFilterTo}`;
  } else if (ledgerFilterFrom) {
    subtitle += ` | From: ${ledgerFilterFrom}`;
  } else if (ledgerFilterTo) {
    subtitle += ` | To: ${ledgerFilterTo}`;
  }

  doc.setFontSize(16);
  doc.text("General Ledger", 14, 16);

  doc.setFontSize(10);
  doc.text(subtitle, 14, 23);

  const body = exportData.rows.map((r) => [
    r.date,
    r.ref,
    r.description,
    r.department,
    r.payment_method,
    r.client_vendor,
    r.remarks,
    money(r.debit),
    money(r.credit),
    money(r.running_balance)
  ]);

  doc.autoTable({
    startY: 28,
    head: [[
      "Date",
      "Ref",
      "Description",
      "Dept/CC",
      "Pay Method",
      "Client/Vendor",
      "Remarks",
      "Debit",
      "Credit",
      "Running Balance"
    ]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    },
    headStyles: {
      fillColor: [51, 51, 51]
    },
    columnStyles: {
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" }
    }
  });

  doc.save(`general-ledger-${exportData.account.code}.pdf`);
};

window.downloadLedgerExcel = function downloadLedgerExcel() {
  if (!window.XLSX) {
    alert("Excel library not loaded.");
    return;
  }

  const exportData = getCurrentLedgerExportData();
  if (!exportData) {
    alert("Please select an account first.");
    return;
  }

  const rows = exportData.rows.map((r) => ({
    Date: r.date,
    Ref: r.ref,
    Description: r.description,
    "Dept/CC": r.department,
    "Pay Method": r.payment_method,
    "Client/Vendor": r.client_vendor,
    Remarks: r.remarks,
    Debit: r.debit,
    Credit: r.credit,
    "Running Balance": r.running_balance
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "General Ledger");
  XLSX.writeFile(wb, `general-ledger-${exportData.account.code}.xlsx`);
};

// ==============================
// Compute balances
// ==============================

function computeBalances() {
  const normals = Object.fromEntries(COA.map((a) => [a.id, a.normal]));
  const balances = {};

  lines
    .filter((l) => !l.is_deleted)
    .forEach((l) => {
      const key = l.resolvedAccountId || l.accountId;
      const normal = normals[key] || "Debit";
      const delta =
        normal === "Credit"
          ? num(l.credit) - num(l.debit)
          : num(l.debit) - num(l.credit);

      balances[key] = (balances[key] || 0) + delta;
    });

  return balances;
}

function computeBalancesAsOf(endDate) {
  const normals = Object.fromEntries(COA.map((a) => [a.id, a.normal]));
  const balances = {};

  lines
    .filter((l) => !l.is_deleted)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (endDate && d > endDate) return false;
      return true;
    })
    .forEach((l) => {
      const key = l.resolvedAccountId || l.accountId;
      const normal = normals[key] || "Debit";
      const delta =
        normal === "Credit"
          ? num(l.credit) - num(l.debit)
          : num(l.debit) - num(l.credit);

      balances[key] = (balances[key] || 0) + delta;
    });

  return balances;
}

// ==============================
// Compute Current Earnings (Revenue - Expense)
// ==============================
function computeCurrentEarningsAsOf(endDate) {
  let revenue = 0;
  let expense = 0;

  lines
    .filter((l) => !l.is_deleted)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (endDate && d > endDate) return false;
      return true;
    })
    .forEach((l) => {
      const acctId = l.resolvedAccountId || l.accountId;
      const acct = COA_BY_ID[acctId];
      const type = normalizeAccountType(acct?.type);

      if (type === "Revenue") {
        revenue += num(l.credit) - num(l.debit);
      } else if (type === "Expense") {
        expense += num(l.debit) - num(l.credit);
      }
    });

  return revenue - expense;
}

function normalizeAccountType(type) {
  const t = String(type || "").trim().toLowerCase();

  if (t === "asset" || t === "assets") return "Asset";
  if (t === "liability" || t === "liabilities") return "Liability";
  if (t === "equity") return "Equity";
  if (t === "revenue" || t === "revenues" || t === "income") return "Revenue";
  if (t === "expense" || t === "expenses") return "Expense";

  return "";
}

function isDepartmentExpenseName(name) {
  const n = String(name || "").trim();

  if (
    n === "Facilities Department Expense - General" ||
    n === "Finance Department Expense - General" ||
    n === "Human Resource Department Expense - General" ||
    n === "Information Technology Department Expense - General" ||
    n === "Marketing Department Expense - General" ||
    n === "Operation Department Expense - General" ||
    n === "Sales Department Expense - General" ||
    n === "Chiefs Expense - General"
  ) {
    return true;
  }

  const prefixes = [
    "FE - ",
    "Fine - ",
    "HRE - ",
    "ITE - ",
    "ME - ",
    "OpEx - ",
    "SE - ",
    "ChiE - "
  ];

  if (prefixes.some((p) => n.startsWith(p))) return true;
  if (n === "ChiE_Office_Equipment_Expense") return true;

  return false;
}

function getDepartmentExpenseGroupName(name) {
  const n = String(name || "").trim();

  if (
    n === "Facilities Department Expense - General" ||
    n === "Finance Department Expense - General" ||
    n === "Human Resource Department Expense - General" ||
    n === "Information Technology Department Expense - General" ||
    n === "Marketing Department Expense - General" ||
    n === "Operation Department Expense - General" ||
    n === "Sales Department Expense - General" ||
    n === "Chiefs Expense - General"
  ) {
    return "General";
  }

  const prefixMap = [
    "FE - ",
    "Fine - ",
    "HRE - ",
    "ITE - ",
    "ME - ",
    "OpEx - ",
    "SE - ",
    "ChiE - "
  ];

  for (const prefix of prefixMap) {
    if (n.startsWith(prefix)) {
      let base = n.slice(prefix.length).trim();

      if (base === "Internet & IT Expense") base = "Internet & Subscription Expense";
      if (base === "Internet & Subcription Expense") base = "Internet & Subscription Expense";

      return base;
    }
  }

  if (n === "ChiE_Office_Equipment_Expense") return "Office Equipment Expense";

  return n;
}

function getDepartmentLabelFromAccountName(name) {
  const n = String(name || "").trim();

  if (n === "Facilities Department Expense - General") return "Facilities";
  if (n === "Finance Department Expense - General") return "Finance";
  if (n === "Human Resource Department Expense - General") return "Human Resource";
  if (n === "Information Technology Department Expense - General") return "Information Technology";
  if (n === "Marketing Department Expense - General") return "Marketing";
  if (n === "Operation Department Expense - General") return "Operation";
  if (n === "Sales Department Expense - General") return "Sales";
  if (n === "Chiefs Expense - General") return "Chiefs";

  if (n.startsWith("FE - ")) return "Facilities";
  if (n.startsWith("Fine - ")) return "Finance";
  if (n.startsWith("HRE - ")) return "Human Resource";
  if (n.startsWith("ITE - ")) return "Information Technology";
  if (n.startsWith("ME - ")) return "Marketing";
  if (n.startsWith("OpEx - ")) return "Operation";
  if (n.startsWith("SE - ")) return "Sales";
  if (n.startsWith("ChiE - ")) return "Chiefs";
  if (n === "ChiE_Office_Equipment_Expense") return "Chiefs";

  return "Unknown Department";
}

function getDepartmentExpenseGroupOrder(name) {
  const order = [
    "General",
    "Advertising & Marketing",
    "Meals & Entertainment",
    "Bank Fees & Charges",
    "Travel Expense",
    "Lodging Expense",
    "Mileage Expense",
    "Telephone Expense",
    "Internet & Subscription Expense",
    "Electricity & Utilities",
    "Rent Expense",
    "Janitorial & Cleaning",
    "Security Services",
    "Postage & Shipping",
    "Repairs & Maintenance",
    "Office Supplies Expense",
    "Office Equipment Expense",
    "Depreciation Expense - Office Equipment",
    "Depreciation Expense - Store Equipment",
    "Salaries & Wages",
    "Employee Benefits",
    "Employee Allowances",
    "Professional Fees",
    "Service Fees",
    "Government Fees & Permits",
    "Taxes & Licenses",
    "Parking Fees Expense"
  ];

  const idx = order.indexOf(name);
  return idx === -1 ? 999 : idx;
}

function getCompanyExpenseOrder(name) {
  const order = [
    "Company Expenses - General",
    "Advertising & Marketing",
    "Meals & Entertainment",
    "Bank Fees & Charges",
    "Travel Expense",
    "Lodging Expense",
    "Mileage Expense",
    "Telephone Expense",
    "Internet & Subcription Expense",
    "Internet & Subscription Expense",
    "Electricity & Utilities",
    "Rent Expense",
    "Janitorial & Cleaning",
    "Security Services",
    "Office Supplies Expense",
    "Postage & Shipping",
    "Repairs & Maintenance",
    "Depreciation Expense - Office Equipment",
    "Depreciation Expense - Store Equipment",
    "Salaries & Wages Expense",
    "Freelance/Service Expense",
    "Employee Benefits",
    "Employee Allowances",
    "Professional Fees",
    "Service Fees",
    "Government Fees & Permits",
    "Taxes & Licenses",
    "Parking Fees Expense",
    "Credit Card Charges",
    "Bad Debt Expense",
    "Purchase Discounts",
    "Automobile Expense",
    "Training & Development"
  ];

  const idx = order.indexOf(String(name || "").trim());
  return idx === -1 ? 999 : idx;
}

function getYearFromDate(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).slice(0, 4);
}

function computeBalancesForYear(year) {
  const normals = Object.fromEntries(COA.map((a) => [a.id, a.normal]));
  const balances = {};

  lines
    .filter((l) => !l.is_deleted)
    .filter((l) => {
      const lineYear = getYearFromDate(l.entry_date);
      return String(lineYear) === String(year);
    })
    .forEach((l) => {
      const key = l.resolvedAccountId || l.accountId;
      const normal = normals[key] || "Debit";
      const delta =
        normal === "Credit"
          ? num(l.credit) - num(l.debit)
          : num(l.debit) - num(l.credit);

      balances[key] = (balances[key] || 0) + delta;
    });

  return balances;
}

// ==============================
// Trial Balance
// ==============================
function renderTrialBalance() {
  const tbody = $("tb-body");
  const tdTotal = $("tb-total-debit");
  const tcTotal = $("tb-total-credit");
  const status = $("tb-status");

  if (!tbody || !tdTotal || !tcTotal) return;

  tbody.innerHTML = "";
  if (status) status.textContent = "";

  const balances = computeBalancesAsOf(worksheetFilterTo || "");

  const typeOrder = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 };

  const list = [...COA].sort((a, b) => {
    const ta = typeOrder[a.type] ?? 99;
    const tb = typeOrder[b.type] ?? 99;
    if (ta !== tb) return ta - tb;

    const ca = codeNum(a.code);
    const cb = codeNum(b.code);
    if (ca !== cb) return ca - cb;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  let totalDebit = 0;
  let totalCredit = 0;

  list.forEach((a) => {
    const bal = balances[a.id] || 0;

    let debit = 0;
    let credit = 0;

    if (a.normal === "Debit") {
      debit = Math.max(bal, 0);
      credit = Math.max(-bal, 0);
    } else {
      credit = Math.max(bal, 0);
      debit = Math.max(-bal, 0);
    }

    totalDebit += debit;
    totalCredit += credit;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(a.code)}</td>
      <td>${esc(a.name)}</td>
      <td>${esc(a.type)}</td>
      <td style="text-align:right;">${money(debit)}</td>
      <td style="text-align:right;">${money(credit)}</td>
    `;
    tbody.appendChild(tr);
  });

  tdTotal.textContent = money(totalDebit);
  tcTotal.textContent = money(totalCredit);

  const diff = Math.abs(totalDebit - totalCredit);
  if (status) {
    status.textContent =
      diff < 0.00001 ? "Balanced ✅" : `Not balanced ❌ (Difference: ${money(diff)})`;
  }
}

function renderProfitAndLoss() {
  const tbody = $("pl-body");
  const netEl = $("pl-net");
  if (!tbody || !netEl) return;

  tbody.innerHTML = "";

  const filteredLines = lines
    .filter((l) => !l.is_deleted)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (worksheetFilterFrom && d < worksheetFilterFrom) return false;
        if (worksheetFilterTo && d > worksheetFilterTo) return false;
      return true;
    });

  // -----------------------------
  // REVENUE
  // -----------------------------
  const revenueAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Revenue")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  let totalRevenue = 0;

 const revHead = document.createElement("tr");
revHead.className = "section-header";
revHead.innerHTML = `<td colspan="2">Revenue</td>`;
tbody.appendChild(revHead);

  revenueAccounts.forEach((acct) => {
    const acctId = acct.id;
    const total = filteredLines
      .filter((l) => (l.resolvedAccountId || l.accountId) === acctId)
      .reduce((sum, l) => sum + (num(l.credit) - num(l.debit)), 0);

    totalRevenue += total;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(acct.name)}</td>
      <td style="text-align:right;">${money(Math.abs(total) < 0.00001 ? 0 : total)}</td>
    `;
    tbody.appendChild(tr);
  });

  const revTotal = document.createElement("tr");
  revTotal.innerHTML = `
    <td><b>Total Revenue</b></td>
    <td style="text-align:right;"><b>${money(Math.abs(totalRevenue) < 0.00001 ? 0 : totalRevenue)}</b></td>
  `;
  tbody.appendChild(revTotal);

  // -----------------------------
  // EXPENSES
  // -----------------------------
  const expenseAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Expense");

  const departmentGroups = {};
  const companyItems = [];

  expenseAccounts.forEach((acct) => {
    const rawName = String(acct.name || "").trim();
    const acctId = acct.id;

    const acctTotal = filteredLines
      .filter((l) => (l.resolvedAccountId || l.accountId) === acctId)
      .reduce((sum, l) => sum + (num(l.debit) - num(l.credit)), 0);

    if (isDepartmentExpenseName(rawName)) {
      const groupName = getDepartmentExpenseGroupName(rawName);

      if (!departmentGroups[groupName]) {
        departmentGroups[groupName] = {
          total: 0,
          items: []
        };
      }

      departmentGroups[groupName].total += acctTotal;
      departmentGroups[groupName].items.push({
        name: rawName,
        departmentLabel: getDepartmentLabelFromAccountName(rawName),
        total: acctTotal
      });
    } else {
      companyItems.push({
        name: rawName,
        total: acctTotal,
        code: acct.code || ""
      });
    }
  });

  let totalExpense = 0;

 const expHead = document.createElement("tr");
expHead.className = "section-header";
expHead.innerHTML = `<td colspan="2">Expenses</td>`;
tbody.appendChild(expHead);

  // -----------------------------
  // DEPARTMENT EXPENSE GROUPS FIRST
  // -----------------------------
  const orderedDepartmentGroups = Object.keys(departmentGroups).sort((a, b) => {
    return getDepartmentExpenseGroupOrder(a) - getDepartmentExpenseGroupOrder(b);
  });

  orderedDepartmentGroups.forEach((groupName, i) => {
    const grp = departmentGroups[groupName];
    totalExpense += grp.total;

    const detailClass = `pl-dept-${i}`;

    const parentRow = document.createElement("tr");
    parentRow.innerHTML = `
      <td>
        <button type="button" class="btn-soft" onclick="togglePLDetail('${detailClass}', this)">▶</button>
        <b>${esc(groupName)}</b>
      </td>
      <td style="text-align:right;"><b>${money(Math.abs(grp.total) < 0.00001 ? 0 : grp.total)}</b></td>
    `;
    tbody.appendChild(parentRow);

    grp.items
      .sort((a, b) => a.departmentLabel.localeCompare(b.departmentLabel))
      .forEach((item) => {
        const dtr = document.createElement("tr");
        dtr.className = detailClass;
        dtr.style.display = "none";
        dtr.innerHTML = `
          <td style="padding-left:40px;">${esc(item.departmentLabel)}</td>
          <td style="text-align:right;">${money(Math.abs(item.total) < 0.00001 ? 0 : item.total)}</td>
        `;
        tbody.appendChild(dtr);
      });
  });

  // -----------------------------
  // COMPANY EXPENSES AFTER DEPARTMENT EXPENSES
  // -----------------------------
  if (companyItems.length > 0) {
  const companyHead = document.createElement("tr");
companyHead.className = "section-header";
companyHead.innerHTML = `<td colspan="2">Company Expenses</td>`;
tbody.appendChild(companyHead);

    companyItems
      .sort((a, b) => {
        const oa = getCompanyExpenseOrder(a.name);
        const ob = getCompanyExpenseOrder(b.name);
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      })
      .forEach((item) => {
        totalExpense += item.total;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${esc(item.name)}</td>
          <td style="text-align:right;">${money(Math.abs(item.total) < 0.00001 ? 0 : item.total)}</td>
        `;
        tbody.appendChild(tr);
      });
  }

  const expTotal = document.createElement("tr");
  expTotal.innerHTML = `
    <td><b>Total Expenses</b></td>
    <td style="text-align:right;"><b>${money(Math.abs(totalExpense) < 0.00001 ? 0 : totalExpense)}</b></td>
  `;
  tbody.appendChild(expTotal);

  const net = totalRevenue - totalExpense;
  netEl.textContent = money(Math.abs(net) < 0.00001 ? 0 : net);
}

function renderStatementOfFinancialPosition() {
  const tbody = $("sfp-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  const balances = computeBalancesAsOf(worksheetFilterTo || "");
  const currentEarnings = computeCurrentEarningsAsOf(worksheetFilterTo || "");

  const assetAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Asset")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const liabilityAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Liability")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const equityAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Equity")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

function addSectionRow(title) {
  const tr = document.createElement("tr");
  tr.className = "section-header";
  tr.innerHTML = `
    <td colspan="3">${esc(title)}</td>
  `;
  tbody.appendChild(tr);
}

function addAccountRow(acct, amount) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${esc(acct.code || "")}</td>
    <td>${esc(acct.name || "")}</td>
    <td style="text-align:right;">${money(amount)}</td>
  `;
  tbody.appendChild(tr);
}

function addTotalRow(title, amount) {
  const tr = document.createElement("tr");
  tr.className = "total-row";
  tr.innerHTML = `
    <td colspan="2">${esc(title)}</td>
    <td style="text-align:right;">${money(amount)}</td>
  `;
  tbody.appendChild(tr);
}

  addSectionRow("Assets");
  assetAccounts.forEach((acct) => {
    const bal = balances[acct.id] || 0;
    totalAssets += bal;
    addAccountRow(acct, bal);
  });
  addTotalRow("Total Assets", totalAssets);

  addSectionRow("Liabilities");
  liabilityAccounts.forEach((acct) => {
    const bal = balances[acct.id] || 0;
    totalLiabilities += bal;
    addAccountRow(acct, bal);
  });
  addTotalRow("Total Liabilities", totalLiabilities);

  addSectionRow("Equity");
  equityAccounts.forEach((acct) => {
    const bal = balances[acct.id] || 0;
    totalEquity += bal;
    addAccountRow(acct, bal);
  });

  addAccountRow(
    { code: "", name: "Current Period Profit / Loss" },
    currentEarnings
  );

  totalEquity += currentEarnings;

  addTotalRow("Total Equity", totalEquity);
  addTotalRow("Total Liabilities and Equity", totalLiabilities + totalEquity);
}

function renderFinancialReportSummary() {
  const head = $("frs-head");
  const body = $("frs-body");
  if (!head || !body) return;

  const y1 = ($("frs-year-1")?.value || "").trim();
  const y2 = ($("frs-year-2")?.value || "").trim();
  const y3 = ($("frs-year-3")?.value || "").trim();

  const years = [y1, y2, y3].filter(Boolean);

  if (years.length === 0) {
    const currentYear = new Date().getFullYear();
    if ($("frs-year-1")) $("frs-year-1").value = currentYear;
    years.push(String(currentYear));
  }

  const balancesByYear = {};
  years.forEach((yr) => {
    balancesByYear[yr] = computeBalancesForYear(yr);
  });

  head.innerHTML = `
    <tr>
      <th style="text-align:left;">Code</th>
      <th style="text-align:left;">Account Name</th>
      ${years.map((yr) => `<th style="text-align:right;">${esc(yr)}</th>`).join("")}
    </tr>
  `;

  body.innerHTML = "";

  const sections = [
    { title: "Assets", type: "Asset" },
    { title: "Liabilities", type: "Liability" },
    { title: "Equity", type: "Equity" },
    { title: "Revenue", type: "Revenue" },
    { title: "Expenses", type: "Expense" }
  ];

  sections.forEach((section) => {
    const accounts = COA
      .filter((a) => normalizeAccountType(a.type) === section.type)
      .sort((a, b) => {
        const ca = codeNum(a.code);
        const cb = codeNum(b.code);
        if (ca !== cb) return ca - cb;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const sectionRow = document.createElement("tr");
    sectionRow.innerHTML = `
      <td colspan="${2 + years.length}" style="font-weight:bold; background:#f5f5f5;">
        ${esc(section.title)}
      </td>
    `;
    body.appendChild(sectionRow);

    const totals = {};
    years.forEach((yr) => totals[yr] = 0);

    accounts.forEach((acct) => {
      const rowVals = years.map((yr) => {
        const bal = balancesByYear[yr][acct.id] || 0;
        totals[yr] += bal;
        return bal;
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(acct.code || "")}</td>
        <td>${esc(acct.name || "")}</td>
        ${rowVals.map((v) => `<td style="text-align:right;">${money(v)}</td>`).join("")}
      `;
      body.appendChild(tr);
    });

    const totalRow = document.createElement("tr");
    totalRow.innerHTML = `
      <td></td>
      <td><b>Total ${esc(section.title)}</b></td>
      ${years.map((yr) => `<td style="text-align:right;"><b>${money(totals[yr])}</b></td>`).join("")}
    `;
    body.appendChild(totalRow);
  });
}

window.downloadTrialBalancePDF = function downloadTrialBalancePDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const title = "Trial Balance";
  const from = worksheetFilterFrom || "";
  const to = worksheetFilterTo || "";

  let subtitle = "As of current date";
if (to) subtitle = `As of ${to}`;
  
  doc.setFontSize(16);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.text(subtitle, 14, 25);
  
  const balances = computeBalancesAsOf(worksheetFilterTo || "");
  const typeOrder = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 };

  const list = [...COA].sort((a, b) => {
    const ta = typeOrder[a.type] ?? 99;
    const tb = typeOrder[b.type] ?? 99;
    if (ta !== tb) return ta - tb;

    const ca = codeNum(a.code);
    const cb = codeNum(b.code);
    if (ca !== cb) return ca - cb;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const rows = list.map((a) => {
    const bal = balances[a.id] || 0;

    let debit = 0;
    let credit = 0;

    if (a.normal === "Debit") {
      debit = Math.max(bal, 0);
      credit = Math.max(-bal, 0);
    } else {
      credit = Math.max(bal, 0);
      debit = Math.max(-bal, 0);
    }

    totalDebit += debit;
    totalCredit += credit;

    return [
      a.code || "",
      a.name || "",
      a.type || "",
      money(debit),
      money(credit),
    ];
  });

  doc.autoTable({
    startY: 30,
    head: [["Code", "Account Name", "Type", "Debit", "Credit"]],
    body: rows,
    foot: [[
      "",
      "",
      "Total",
      money(totalDebit),
      money(totalCredit)
    ]],
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [51, 51, 51],
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const diff = Math.abs(totalDebit - totalCredit);
  const status = diff < 0.00001
    ? "Balanced"
    : `Not balanced (Difference: ${money(diff)})`;

  const finalY = doc.lastAutoTable.finalY || 30;
  doc.setFontSize(10);
  doc.text(`Status: ${status}`, 14, finalY + 10);

  doc.save("trial-balance.pdf");
};

function loadImageAsDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = reject;
    img.src = src;
  });
}

window.downloadProfitLossPDF = async function downloadProfitLossPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let logoData = null;
  try {
    logoData = await loadImageAsDataURL("./img/exodia-logo.png");
  } catch (e) {
    console.warn("Logo failed to load:", e);
  }

  const COLOR_BLACK = [20, 20, 20];
  const COLOR_ORANGE = [245, 124, 0];
  const COLOR_GRAY = [110, 110, 110];
  const COLOR_LIGHT = [248, 248, 248];
  const COLOR_BORDER = [225, 225, 225];

  const companyName = "Exodia Gaming Development Inc.";
  const reportTitle = "Statement of Profit and Loss";
  const generatedOn = new Date().toLocaleString();

  function formatDatePretty(d) {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

 let subtitle = "";
if (worksheetFilterFrom && worksheetFilterTo) {
  subtitle = `For the period from ${formatDatePretty(worksheetFilterFrom)} to ${formatDatePretty(worksheetFilterTo)}`;
} else if (worksheetFilterTo) {
  subtitle = `For the period ended ${formatDatePretty(worksheetFilterTo)}`;
} else if (worksheetFilterFrom) {
  subtitle = `Beginning ${formatDatePretty(worksheetFilterFrom)}`;
}

    const filteredLines = lines
    .filter((l) => !l.is_deleted)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (worksheetFilterFrom && d < worksheetFilterFrom) return false;
      if (worksheetFilterTo && d > worksheetFilterTo) return false;
      return true;
    });

  const revenueAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Revenue")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const expenseAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Expense");

  const bodyRows = [];
  let totalRevenue = 0;
  let totalExpense = 0;

  bodyRows.push([
    {
      content: "Revenue",
      colSpan: 2,
      styles: {
        fontStyle: "bold",
        fillColor: COLOR_LIGHT,
        textColor: COLOR_BLACK
      }
    }
  ]);

  revenueAccounts.forEach((acct) => {
    const acctId = acct.id;
    const total = filteredLines
      .filter((l) => (l.resolvedAccountId || l.accountId) === acctId)
      .reduce((sum, l) => sum + (num(l.credit) - num(l.debit)), 0);

    totalRevenue += total;

    bodyRows.push([
      acct.name || "",
      money(Math.abs(total) < 0.00001 ? 0 : total)
    ]);
  });

  bodyRows.push([
    { content: "Total Revenue", styles: { fontStyle: "bold" } },
    {
      content: money(Math.abs(totalRevenue) < 0.00001 ? 0 : totalRevenue),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  bodyRows.push([
    {
      content: "Expenses",
      colSpan: 2,
      styles: {
        fontStyle: "bold",
        fillColor: COLOR_LIGHT,
        textColor: COLOR_BLACK
      }
    }
  ]);

  const departmentGroups = {};
  const companyItems = [];

  expenseAccounts.forEach((acct) => {
    const rawName = String(acct.name || "").trim();
    const acctId = acct.id;

    const acctTotal = filteredLines
      .filter((l) => (l.resolvedAccountId || l.accountId) === acctId)
      .reduce((sum, l) => sum + (num(l.debit) - num(l.credit)), 0);

    if (isDepartmentExpenseName(rawName)) {
      const groupName = getDepartmentExpenseGroupName(rawName);

      if (!departmentGroups[groupName]) {
        departmentGroups[groupName] = {
          total: 0,
          items: []
        };
      }

      departmentGroups[groupName].total += acctTotal;
      departmentGroups[groupName].items.push({
        name: rawName,
        departmentLabel: getDepartmentLabelFromAccountName(rawName),
        total: acctTotal
      });
    } else {
      companyItems.push({
        name: rawName,
        total: acctTotal,
        code: acct.code || ""
      });
    }
  });

  const orderedDepartmentGroups = Object.keys(departmentGroups).sort((a, b) => {
    return getDepartmentExpenseGroupOrder(a) - getDepartmentExpenseGroupOrder(b);
  });

  orderedDepartmentGroups.forEach((groupName) => {
    const grp = departmentGroups[groupName];
    totalExpense += grp.total;

    bodyRows.push([
      `  ${groupName}`,
      money(Math.abs(grp.total) < 0.00001 ? 0 : grp.total)
    ]);

    grp.items
      .sort((a, b) => a.departmentLabel.localeCompare(b.departmentLabel))
      .forEach((item) => {
        bodyRows.push([
          `      ${item.departmentLabel}`,
          money(Math.abs(item.total) < 0.00001 ? 0 : item.total)
        ]);
      });
  });

  if (companyItems.length > 0) {
    bodyRows.push([
      {
        content: "Company Expenses",
        colSpan: 2,
        styles: {
          fontStyle: "bold",
          fillColor: [252, 252, 252],
          textColor: COLOR_BLACK
        }
      }
    ]);

    companyItems
      .sort((a, b) => {
        const oa = getCompanyExpenseOrder(a.name);
        const ob = getCompanyExpenseOrder(b.name);
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      })
      .forEach((item) => {
        totalExpense += item.total;

        bodyRows.push([
          item.name,
          money(Math.abs(item.total) < 0.00001 ? 0 : item.total)
        ]);
      });
  }

  bodyRows.push([
    { content: "Total Expenses", styles: { fontStyle: "bold" } },
    {
      content: money(Math.abs(totalExpense) < 0.00001 ? 0 : totalExpense),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  const net = totalRevenue - totalExpense;

  // Header
  doc.setFillColor(...COLOR_BLACK);
  doc.rect(0, 0, pageWidth, 34, "F");

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 34, pageWidth, 4, "F");

if (logoData) {
  const logoWidth = 120;
  const logoHeight = 24;
  const logoX = (pageWidth - logoWidth) / 2;
  const logoY = 5;

  doc.addImage(logoData, "PNG", logoX, logoY, logoWidth, logoHeight);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
} else {
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName, pageWidth / 2, 20, { align: "center" });
}

  // Title
  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(reportTitle, pageWidth/2, 46, {align:"center"});

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(...COLOR_GRAY);
if (subtitle) {
  doc.text(subtitle, pageWidth / 2, 56, { align: "center" });
}

  // Information box
  doc.setFillColor(...COLOR_LIGHT);
  doc.roundedRect(14, 64, pageWidth - 28, 32, 3, 3, "F");

  doc.setDrawColor(...COLOR_ORANGE);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 64, pageWidth - 28, 32, 3, 3, "S");

  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Report Information", 18, 71);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Document: ${reportTitle}`, 18, 76);
  doc.text(`Prepared for: Internal Management Reporting`, 18, 81);
  doc.text(`Generated on: ${generatedOn}`, 18, 86);
  doc.text(`Source: Exodia Ledger System`, 18, 91);
  
  // Table
  doc.autoTable({
    startY: 102,
    head: [["Particulars", "Amount"]],
    body: bodyRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3.5,
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: COLOR_BLACK,
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 125 },
      1: { halign: "right", cellWidth: 55 }
    },
    margin: { left: 14, right: 14 }
  });

  let finalY = doc.lastAutoTable.finalY || 100;

if (finalY + 30 > pageHeight - 10) {
  doc.addPage();
  finalY = 20;
}

  doc.setFillColor(...COLOR_ORANGE);
  doc.roundedRect(14, finalY + 8, pageWidth - 28, 14, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Net Profit / Loss", 18, finalY + 17);

  doc.text(
    money(Math.abs(net) < 0.00001 ? 0 : net),
    pageWidth - 18,
    finalY + 17,
    { align: "right" }
  );

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(
    "This report was generated from the Exodia Ledger system for internal use.",
    14,
    pageHeight - 10
  );

  doc.save("statement-of-profit-and-loss.pdf");
};

window.downloadStatementOfFinancialPositionPDF = async function downloadStatementOfFinancialPositionPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let logoData = null;
  try {
    logoData = await loadImageAsDataURL("./img/exodia-logo.png");
  } catch (e) {
    console.warn("Logo failed to load:", e);
  }

  const COLOR_BLACK = [20, 20, 20];
  const COLOR_ORANGE = [245, 124, 0];
  const COLOR_GRAY = [110, 110, 110];
  const COLOR_LIGHT = [248, 248, 248];
  const COLOR_BORDER = [225, 225, 225];

  const companyName = "Exodia Gaming Development Inc.";
  const reportTitle = "Statement of Financial Position";
  const generatedOn = new Date().toLocaleString();

  function formatDatePretty(d) {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

 let subtitle = "";
if (worksheetFilterFrom && worksheetFilterTo) {
  subtitle = `As of ${formatDatePretty(worksheetFilterTo)}`;
} else if (worksheetFilterTo) {
  subtitle = `As of ${formatDatePretty(worksheetFilterTo)}`;
} else if (worksheetFilterFrom) {
  subtitle = `From ${formatDatePretty(worksheetFilterFrom)}`;
} else {
  subtitle = "As of current filtered balances";
}
  
  const balances = computeBalancesAsOf(worksheetFilterTo || "");

  const assetAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Asset")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const liabilityAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Liability")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const equityAccounts = COA
    .filter((a) => normalizeAccountType(a.type) === "Equity")
    .sort((a, b) => {
      const ca = codeNum(a.code);
      const cb = codeNum(b.code);
      if (ca !== cb) return ca - cb;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const bodyRows = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  bodyRows.push([
    {
      content: "Assets",
      colSpan: 3,
      styles: {
        fontStyle: "bold",
        fillColor: COLOR_LIGHT,
        textColor: COLOR_BLACK
      }
    }
  ]);

  assetAccounts.forEach((acct) => {
    const bal = balances[acct.id] || 0;
    totalAssets += bal;

    bodyRows.push([
      acct.code || "",
      acct.name || "",
      money(bal)
    ]);
  });

  bodyRows.push([
    { content: "", styles: { fontStyle: "bold" } },
    { content: "Total Assets", styles: { fontStyle: "bold" } },
    {
      content: money(totalAssets),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  bodyRows.push([
    {
      content: "Liabilities",
      colSpan: 3,
      styles: {
        fontStyle: "bold",
        fillColor: COLOR_LIGHT,
        textColor: COLOR_BLACK
      }
    }
  ]);

  liabilityAccounts.forEach((acct) => {
    const bal = balances[acct.id] || 0;
    totalLiabilities += bal;

    bodyRows.push([
      acct.code || "",
      acct.name || "",
      money(bal)
    ]);
  });

  bodyRows.push([
    { content: "", styles: { fontStyle: "bold" } },
    { content: "Total Liabilities", styles: { fontStyle: "bold" } },
    {
      content: money(totalLiabilities),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  bodyRows.push([
    {
      content: "Equity",
      colSpan: 3,
      styles: {
        fontStyle: "bold",
        fillColor: COLOR_LIGHT,
        textColor: COLOR_BLACK
      }
    }
  ]);

  equityAccounts.forEach((acct) => {
  const bal = balances[acct.id] || 0;
  totalEquity += bal;

  bodyRows.push([
    acct.code || "",
    acct.name || "",
    money(bal)
  ]);
});

const currentEarnings = computeCurrentEarningsAsOf(worksheetFilterTo || "");

bodyRows.push([
  "",
  "Current Period Profit / Loss",
  money(currentEarnings)
]);

totalEquity += currentEarnings;

  bodyRows.push([
    { content: "", styles: { fontStyle: "bold" } },
    { content: "Total Equity", styles: { fontStyle: "bold" } },
    {
      content: money(totalEquity),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  bodyRows.push([
    { content: "", styles: { fontStyle: "bold" } },
    { content: "Total Liabilities and Equity", styles: { fontStyle: "bold" } },
    {
      content: money(totalLiabilities + totalEquity),
      styles: { fontStyle: "bold", halign: "right" }
    }
  ]);

  // Header
  doc.setFillColor(...COLOR_BLACK);
  doc.rect(0, 0, pageWidth, 34, "F");

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 34, pageWidth, 4, "F");

  if (logoData) {
    const logoWidth = 120;
    const logoHeight = 24;
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = 5;

    doc.addImage(logoData, "PNG", logoX, logoY, logoWidth, logoHeight);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(companyName, pageWidth / 2, 20, { align: "center" });
  }

  // Title
  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(reportTitle, pageWidth / 2, 46, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_GRAY);
  if (subtitle) {
    doc.text(subtitle, pageWidth / 2, 56, { align: "center" });
  }

  // Information box
  doc.setFillColor(...COLOR_LIGHT);
  doc.roundedRect(14, 64, pageWidth - 28, 32, 3, 3, "F");

  doc.setDrawColor(...COLOR_ORANGE);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 64, pageWidth - 28, 32, 3, 3, "S");

  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Report Information", 18, 71);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Document: ${reportTitle}`, 18, 76);
  doc.text(`Prepared for: Internal Management Reporting`, 18, 81);
  doc.text(`Generated on: ${generatedOn}`, 18, 86);
  doc.text(`Source: Exodia Ledger System`, 18, 91);

  // Table
  doc.autoTable({
    startY: 102,
    head: [["Code", "Account Name", "Amount"]],
    body: bodyRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3.5,
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: COLOR_BLACK,
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 28 },
      1: { halign: "left", cellWidth: 97 },
      2: { halign: "right", cellWidth: 55 }
    },
    margin: { left: 14, right: 14 }
  });

let finalY = doc.lastAutoTable.finalY || 100;

// if not enough space for total box + footer, move to new page
if (finalY + 30 > pageHeight - 10) {
  doc.addPage();
  finalY = 20;
}

doc.setFillColor(...COLOR_ORANGE);
doc.roundedRect(14, finalY + 8, pageWidth - 28, 14, 2, 2, "F");

doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("Total Liabilities and Equity", 18, finalY + 17);

doc.text(
  money(totalLiabilities + totalEquity),
  pageWidth - 18,
  finalY + 17,
  { align: "right" }
);

doc.setFont("helvetica", "italic");
doc.setFontSize(8.5);
doc.setTextColor(...COLOR_GRAY);
doc.text(
  "This report was generated from the Exodia Ledger system for internal use.",
  14,
  pageHeight - 10
);

  doc.save("statement-of-financial-position.pdf");
};

window.downloadFinancialReportSummaryPDF = async function downloadFinancialReportSummaryPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library not loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let logoData = null;
  try {
    logoData = await loadImageAsDataURL("./img/exodia-logo.png");
  } catch (e) {
    console.warn("Logo failed to load:", e);
  }

  const COLOR_BLACK = [20, 20, 20];
  const COLOR_ORANGE = [245, 124, 0];
  const COLOR_GRAY = [110, 110, 110];
  const COLOR_LIGHT = [248, 248, 248];
  const COLOR_BORDER = [225, 225, 225];

  const reportTitle = "Financial Report Summary";
  const generatedOn = new Date().toLocaleString();

  const y1 = ($("frs-year-1")?.value || "").trim();
  const y2 = ($("frs-year-2")?.value || "").trim();
  const y3 = ($("frs-year-3")?.value || "").trim();
  const years = [y1, y2, y3].filter(Boolean);

  if (years.length === 0) years.push(String(new Date().getFullYear()));

  const balancesByYear = {};
  years.forEach((yr) => {
    balancesByYear[yr] = computeBalancesForYear(yr);
  });

  // header
  doc.setFillColor(...COLOR_BLACK);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 28, pageWidth, 4, "F");

  if (logoData) {
    doc.addImage(logoData, "PNG", (pageWidth - 90) / 2, 4, 90, 18);
  }

  doc.setTextColor(...COLOR_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(reportTitle, pageWidth / 2, 42, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(`Years: ${years.join(", ")}`, pageWidth / 2, 49, { align: "center" });
  doc.text(`Generated on: ${generatedOn}`, pageWidth / 2, 55, { align: "center" });

  const rows = [];
  const sections = [
    { title: "Assets", type: "Asset" },
    { title: "Liabilities", type: "Liability" },
    { title: "Equity", type: "Equity" },
    { title: "Revenue", type: "Revenue" },
    { title: "Expenses", type: "Expense" }
  ];

  sections.forEach((section) => {
    rows.push([
      {
        content: section.title,
        colSpan: 2 + years.length,
        styles: {
          fontStyle: "bold",
          fillColor: COLOR_LIGHT,
          textColor: COLOR_BLACK
        }
      }
    ]);

    const accounts = COA
      .filter((a) => normalizeAccountType(a.type) === section.type)
      .sort((a, b) => {
        const ca = codeNum(a.code);
        const cb = codeNum(b.code);
        if (ca !== cb) return ca - cb;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const totals = {};
    years.forEach((yr) => totals[yr] = 0);

    accounts.forEach((acct) => {
      const vals = years.map((yr) => {
        const bal = balancesByYear[yr][acct.id] || 0;
        totals[yr] += bal;
        return money(bal);
      });

      rows.push([
        acct.code || "",
        acct.name || "",
        ...vals
      ]);
    });

    rows.push([
      "",
      `Total ${section.title}`,
      ...years.map((yr) => money(totals[yr]))
    ]);
  });

  doc.autoTable({
    startY: 65,
    head: [[
      "Code",
      "Account Name",
      ...years
    ]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 3,
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: COLOR_BLACK,
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 22 },
      1: { halign: "left", cellWidth: 90 }
    },
    margin: { left: 10, right: 10 }
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(
    "This report was generated from the Exodia Ledger system for internal use.",
    10,
    pageHeight - 8
  );

  doc.save("financial-report-summary.pdf");
};

async function loadCurrentManagedUser() {
  if (!currentUser) return null;

  const { data, error } = await sb
    .from("user_access")
    .select("*")
    .eq("email", currentUser.email)
    .single();

  if (error) {
    console.error("Failed to load current managed user:", error);
    currentManagedUser = null;
    return null;
  }

  currentManagedUser = data;
  return data;
}

function applyUserAccessUI() {
  const role = String(currentManagedUser?.access_level || "").toLowerCase();

  const createBtn = $("menu-create-user");
  const manageBtn = $("menu-manage-access");
  const isAdmin = isAdminUser();
  const canEdit = canEditBooks();

  if (createBtn) createBtn.style.display = isAdmin ? "block" : "none";
  if (manageBtn) manageBtn.style.display = isAdmin ? "block" : "none";

  const addAccountBtn = document.querySelector("#coa-toolbar .btn-add");
  if (addAccountBtn) addAccountBtn.style.display = canEdit ? "inline-block" : "none";

  const saveJournalBtn = document.querySelector(".je-actions .btn-dark");
  const addLineBtn = document.querySelector(".je-actions .btn-soft");

  if (saveJournalBtn) saveJournalBtn.style.display = canEdit ? "inline-block" : "none";
  if (addLineBtn) addLineBtn.style.display = canEdit ? "inline-block" : "none";
}

function getCurrentAccessLevel() {
  return String(currentManagedUser?.access_level || "").toLowerCase();
}

function isAdminUser() {
  const email = String(currentUser?.email || "").toLowerCase();
  return getCurrentAccessLevel() === "admin" || email === "financeadmin@exodiagamedev.com";
}

function isEditorUser() {
  return getCurrentAccessLevel() === "editor";
}

function isViewerUser() {
  const role = getCurrentAccessLevel();
  return role === "view only" || role === "viewer";
}

function canManageUsers() {
  return isAdminUser();
}

function canEditBooks() {
  return isAdminUser() || isEditorUser();
}

function canViewBooks() {
  return isAdminUser() || isEditorUser() || isViewerUser();
}

// ==============================
// Init after login
// ==============================
async function initAppAfterLogin() {
  const d = new Date();
  if ($("je-date")) $("je-date").valueAsDate = d;

  COA = await loadCOAFromDbOrJson();
  refreshCoaDatalist();

  lines = await loadLinesFromDb();
  resolveLinesAccountIds();

  await loadCurrentManagedUser();
  applyUserAccessUI();

  const ledgerSel = $("ledger-account");
  if (ledgerSel) ledgerSel.innerHTML = "";

  journalFilterFrom = localStorage.getItem(JOURNAL_FILTER_FROM_KEY) || "";
  journalFilterTo = localStorage.getItem(JOURNAL_FILTER_TO_KEY) || "";

  ledgerFilterFrom = localStorage.getItem(LEDGER_FILTER_FROM_KEY) || "";
  ledgerFilterTo = localStorage.getItem(LEDGER_FILTER_TO_KEY) || "";

  worksheetFilterFrom = localStorage.getItem(WORKSHEET_FILTER_FROM_KEY) || "";
  worksheetFilterTo = localStorage.getItem(WORKSHEET_FILTER_TO_KEY) || "";

  loadCurrentViewDateInputs(); "";

 const lastView =
  sessionStorage.getItem(TAB_VIEW_KEY) ||
  localStorage.getItem(LAST_VIEW_KEY) ||
  "coa";
  const acctFromUrl = getQueryParam("account_id");
  const savedLedgerAccount = localStorage.getItem(LEDGER_ACCOUNT_KEY) || "";

  if (window.location.hash === "#ledger" || acctFromUrl) {
    show("ledger");

    if ($("ledger-account")) {
      $("ledger-account").value = acctFromUrl || savedLedgerAccount || "";
    }

    renderLedger();

    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    show(lastView);

    if (lastView === "ledger" && $("ledger-account")) {
      $("ledger-account").value = savedLedgerAccount || "";
      renderLedger();
    }
  }
}

// ==============================
// Render Journal History ✅
// ==============================
function renderHistory() {
  const tbody = $("history-body");
  const status = $("history-status");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (status) status.textContent = "Loading...";

  if (!currentUser) {
    if (status) status.textContent = "Please login first.";
    return;
  }

  sbFetchJournalEntries()
    .then((entries) => {
      tbody.innerHTML = "";
      console.log("Journal entries loaded:", entries);

      if (!entries || entries.length === 0) {
        if (status) status.textContent = "No journal entries found.";
        return;
      }

      if (status) status.textContent = "";

      const filteredEntries = entries.filter((e) => {
  const d = String(e.entry_date || "");
  if (journalFilterFrom && d < journalFilterFrom) return false;
  if (journalFilterTo && d > journalFilterTo) return false;
  return true;
});

if (filteredEntries.length === 0) {
  if (status) status.textContent = "No journal entries found for this filter.";
  return;
}

filteredEntries.forEach((e) => {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${esc(e.entry_date || "")}</td>
    <td>${esc(formatDateTime(e.created_at))}</td>
    <td>${esc(e.ref || "")}</td>
    <td>${esc(e.description || "")}</td>
    <td>${esc(e.department || "")}</td>
    <td>${esc(e.payment_method || "")}</td>
    <td>${esc(e.client_vendor || "")}</td>
    <td>${esc(e.remarks || "")}</td>
    <td>
      <button class="btn" onclick="viewHistoryEntry('${e.id}')">View</button>
    </td>
  `;
  tbody.appendChild(tr);
});
    })
    .catch((err) => {
      console.error("renderHistory error:", err);
      if (status) status.textContent = "Failed to load history.";
    });
}

// helper: format created_at into readable time
function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

window.closeHistoryModal = function closeHistoryModal() {
  const m = $("history-modal");
  if (m) m.style.display = "none";
};

window.viewHistoryEntry = async function viewHistoryEntry(journal_id) {
  if (!currentUser) return alert("Please login first.");

  const modal = $("history-modal");
  const linesBody = $("hm-lines");
  if (!modal || !linesBody) return alert("History modal not found in HTML.");

  // fetch header
 const { data: entry, error } = await sb
  .from("journal_entries")
  .select("*")
  .eq("id", journal_id)
  .eq("company_id", COMPANY_ID)
  .single();

  if (error) {
    console.error(error);
    alert("Failed to load journal entry.");
    return;
  }

  // fill header
  $("hm-date").textContent = entry.entry_date || "";
  $("hm-ref").textContent = entry.ref || "";
  $("hm-desc").textContent = entry.description || "";
  $("hm-dept").textContent = entry.department || "";
  $("hm-pay").textContent = entry.payment_method || "";
  $("hm-client").textContent = entry.client_vendor || "";
  $("hm-remarks").textContent = entry.remarks || "";

  // fetch lines
  const jLines = await sbFetchJournalLinesForEntry(journal_id);

  // render lines
  linesBody.innerHTML = "";
  let firstAccountId = "";

  jLines.forEach((l) => {
    if (!firstAccountId) firstAccountId = l.account_id || "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(l.account_name || "")}</td>
      <td style="text-align:right;">${money(l.debit || 0)}</td>
      <td style="text-align:right;">${money(l.credit || 0)}</td>
    `;
    linesBody.appendChild(tr);
  });

  if (jLines.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="text-align:center; padding:10px;">No lines found.</td>`;
    linesBody.appendChild(tr);
  }

  // wire Edit/Delete button
  const btn = $("hm-edit-btn");
  if (btn) {
    btn.onclick = () => {
      const acct = encodeURIComponent(firstAccountId || "");
      window.location.href = `./edit.html?journal_id=${encodeURIComponent(journal_id)}&account_id=${acct}`;
    };
  }

  modal.style.display = "grid";
};

// ==============================
// Restore session on refresh
// ==============================
(async function restoreSession() {
  initPasswordToggle();

  $("auth-email")?.addEventListener("input", refreshLoginButtonState);
  $("auth-pass")?.addEventListener("input", refreshLoginButtonState);
  refreshLoginButtonState();

  const { data } = await sb.auth.getSession();
  const session = data.session;

    if (session?.user) {
    currentUser = session.user;

    const { data: accessRow, error: accessError } = await sb
      .from("user_access")
      .select("*")
      .eq("email", currentUser.email)
      .single();

    if (accessError || !accessRow) {
      await sb.auth.signOut();
      currentUser = null;
      setUI(false);
      setAuthMsg("No user access record found. Please contact admin.", true);
      return;
    }

    if (String(accessRow.status || "").toLowerCase() === "disabled") {
      await sb.auth.signOut();
      currentUser = null;
      setUI(false);
      setAuthMsg("Your account is disabled. Please contact admin.", true);
      return;
    }

    setUI(true, currentUser.email);
    await initAppAfterLogin();
  } else {
    setUI(false);
  }
  
})();

// ==============================
// Helpers / Utils
// ==============================

function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name) || "";
}
  
function tdWrap(el, right = false) {
  const td = document.createElement("td");
  if (right) td.style.textAlign = "right";
  td.appendChild(el);
  return td;
}

function setStatus(msg) {
  const el = $("je-status");
  if (el) el.textContent = msg;
}

function codeNum(code) {
  const n = Number(String(code || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 999999999;
}

function parseMoney(v) {
  const cleaned = String(v || "").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function num(v) {
  return Number(v) || 0;
}

function money(n) {
  let val = Number(n) || 0;

  // fix negative zero / tiny floating errors
  if (Math.abs(val) < 0.00001) val = 0;

  return val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadCurrentViewDateInputs() {
  const mainView =
  sessionStorage.getItem(TAB_VIEW_KEY) ||
  localStorage.getItem(LAST_VIEW_KEY) ||
  "coa";
  const journalView = localStorage.getItem(JOURNAL_VIEW_KEY) || "entry";

  let from = "";
  let to = "";

  if (mainView === "journal" && journalView === "history") {
    from = journalFilterFrom;
    to = journalFilterTo;
  } else if (mainView === "ledger") {
    from = ledgerFilterFrom;
    to = ledgerFilterTo;
  } else if (mainView === "trial") {
    from = worksheetFilterFrom;
    to = worksheetFilterTo;
  }

  if ($("filter-from")) $("filter-from").value = from || "";
  if ($("filter-to")) $("filter-to").value = to || "";
}

window.togglePLDetail = function (className, btn) {
  const rows = document.querySelectorAll("." + className);
  let isOpening = false;

  rows.forEach((row) => {
    if (row.style.display === "none") isOpening = true;
  });

  rows.forEach((row) => {
    row.style.display = isOpening ? "table-row" : "none";
  });

  if (btn) {
    btn.textContent = isOpening ? "▼" : "▶";
  }
};

// ✅ Live red-border validation for required fields
["je-date", "je-refno", "je-description"].forEach((id) => {
  $(id)?.addEventListener("input", () => {
    const el = $(id);
    const val = (el?.value || "").trim();
    markRequired(el, !val);
  });
});

// ==============================
// INLINE EDIT COA NAME (no prompt)
// ==============================
window.startEditCOAName = function (id) {
  const row = document.querySelector(`[data-coa-row='${id}']`);
  if (!row) return;

  row.querySelector(".coa-name-view").style.display = "none";
  row.querySelector(".coa-name-edit").style.display = "inline-block";

  row.querySelector(".coa-actions-view").style.display = "none";
  row.querySelector(".coa-actions-edit").style.display = "inline-block";
};

window.cancelEditCOAName = function () {
  renderCOA();
};

window.saveEditCOAName = async function (id) {
  const row = document.querySelector(`[data-coa-row='${id}']`);
  if (!row) return;

  const input = row.querySelector("[data-coa-edit-name]");
  const newName = (input?.value || "").trim();
  if (!newName) return alert("Name is required.");

  try {
    await sbUpdateCOA(id, { name: newName, updated_at: new Date().toISOString() });

    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    renderCOA();
    renderLedger();
    renderTrialBalance();
  } catch (e) {
    console.error(e);
    alert("Failed to update account name.");
  }
};

function closeAllCoaMenus() {
  document.querySelectorAll(".coa-menu").forEach((m) => (m.style.display = "none"));
}

window.toggleCoaMenu = function (id, ev) {
  ev?.stopPropagation?.();
  const menu = document.querySelector(`[data-coa-menu='${id}']`);
  if (!menu) return;
  const isOpen = menu.style.display === "block";
  closeAllCoaMenus();
  menu.style.display = isOpen ? "none" : "block";
};

// close menu when clicking anywhere else
document.addEventListener("click", (e) => {
  const isLedgerBtn = e.target?.closest?.("#ledger-download-btn");
  const isLedgerMenu = e.target?.closest?.("#ledger-download-menu");

  if (!isLedgerBtn && !isLedgerMenu) {
    closeLedgerDownloadMenu();
  }
});

// ==============================
// DELETE COA ACCOUNT (soft delete)
// ==============================
window.deleteCOAAccount = async function (id) {
  if (!canEditBooks()) {
    alert("You only have view access.");
    return;
  }

  if (!currentUser) return alert("Please login first.");

  const acct = COA.find((a) => a.id === id);
  const label = acct ? `${acct.code} - ${acct.name}` : "this account";

  const ok = confirm(`Delete ${label}?\n\n(This is soft delete and can be restored from DB if needed.)`);
  if (!ok) return;

  try {
    await sbSoftDeleteCOA(id);

    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    renderCOA();
    renderLedger();
    renderTrialBalance();
  } catch (e) {
    console.error(e);
    alert("Failed to delete account. Check RLS policies.");
  }
};

// ==============================
// COA TOOLBAR (TOP OPTIONS BAR)
// ==============================
window.focusAddAccount = function () {
  show("coa");
  $("coa-code")?.focus();
};

window.editSelectedCOA = function () {
  if (!selectedCOAId) return alert("Select an account first.");
  editAccountPrompt(selectedCOAId);
};

window.deleteSelectedCOA = function () {
  if (!selectedCOAId) return alert("Select an account first.");
  deleteCOAAccount(selectedCOAId);
};

// ==============================
// ADD ACCOUNT POPUP (LIKE EDIT)
// ==============================
window.addAccountPopup = async function () {
  if (!currentUser) return alert("Please login first.");

  const code = (prompt("Account Code (e.g. 1001):") || "").trim();
  if (!code) return;

  const name = (prompt(`Account Name for ${code}:`) || "").trim();
  if (!name) return;

  const type = (prompt("Account Type (Asset/Liability/Equity/Revenue/Expense):", "Asset") || "").trim();
  if (!type) return;

  const normal = (prompt("Normal Balance (Debit/Credit):", "Debit") || "").trim();
  if (!normal) return;

  try {
   await sbInsertCOA({
  user_id: currentUser.id,
  company_id: COMPANY_ID,
  created_by: currentUser.id,
  code,
  name,
  type,
  normal,
  is_deleted: false,
});
    
    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    renderCOA();
    renderLedger();
    renderTrialBalance();

    alert("✅ Account added successfully!");
  } catch (e) {
    console.error(e);
    alert("❌ Failed to add account (maybe duplicate code).");
  }
};

window.openAddCoaModal = function () {
  if (!canEditBooks()) {
    alert("You only have view access.");
    return;
  }

  $("addcoa-modal").style.display = "grid";
  $("addcoa-code").value = getNextAccountCode();
  $("addcoa-name").value = "";
  $("addcoa-type").value = "Asset";
  $("addcoa-normal").value = "Debit";
  $("addcoa-msg").textContent = "";
  $("addcoa-name").focus();
};

window.closeAddCoaModal = function () {
  $("addcoa-modal").style.display = "none";
};

window.saveAddCoaModal = async function () {
  if (!canEditBooks()) {
    alert("You only have view access.");
    return;
  }

  const code = $("addcoa-code").value.trim();
  const name = $("addcoa-name").value.trim();
  const type = $("addcoa-type").value;
  const normal = $("addcoa-normal").value;

  const exists = COA.some(a => !a.is_deleted && String(a.code).trim() === code);
  if (exists) {
    $("addcoa-msg").textContent = `Code ${code} already exists. Please use another code.`;
    return;
  }

  if (!code || !name) {
    $("addcoa-msg").textContent = "Code and Name are required.";
    return;
  }

    try {
    const result = await sbCreateOrRestoreCOA({
      user_id: currentUser.id,
      company_id: COMPANY_ID,
      created_by: currentUser.id,
      code,
      name,
      type,
      normal,
      is_deleted: false,
    });

    COA = await sbFetchCOA();
    refreshCoaDatalist();
    resolveLinesAccountIds();

    const ledgerSel = $("ledger-account");
    if (ledgerSel) ledgerSel.innerHTML = "";

    currentCOAType = "All";

    renderCOA();
    renderLedger();
    renderTrialBalance();

    $("addcoa-msg").textContent = "";
    closeAddCoaModal();
  } catch (e) {
    console.error(e);

            if (e?.code === "23505" || e?.code === "DUPLICATE_ACTIVE_CODE") {
      $("addcoa-msg").textContent = `Code ${code} already exists. Please use another code.`;
      return;
    }
      
    $("addcoa-msg").textContent = "Failed to add account. Check your connection/policies.";
  }
};

function getNextAccountCode() {
  const codes = (COA || [])
    .filter(a => !a.is_deleted)
    .map(a => Number(String(a.code || "").replace(/[^0-9]/g, "")))
    .filter(n => Number.isFinite(n));

  if (codes.length === 0) return "1001";
  return String(Math.max(...codes) + 1);
}

