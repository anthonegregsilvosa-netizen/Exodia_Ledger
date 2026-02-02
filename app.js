// === Mini QuickBooks Logic (COA + Journal + Ledger + Trial Balance) + LOGIN =====

const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FILTER_YEAR_KEY = "exodiaLedger.filterYear.v1";
const FILTER_MONTH_KEY = "exodiaLedger.filterMonth.v1";
const LEDGER_ACCOUNT_KEY = "exodiaLedger.ledgerAccount.v1";
const LAST_VIEW_KEY = "exodiaLedger.lastView.v1";

const $ = (id) => document.getElementById(id);

let COA = [];
let currentCOAType = "All";
let lines = []; // from Supabase
let filterYear = "";
let filterMonth = "";
let currentUser = null; // session user

// ==============================
// UI lock/unlock (login-first)
// ==============================
function setUI(isLoggedIn, email = "") {
  const authOut = $("auth-logged-out");
  const authIn = $("auth-logged-in");
  const app = $("app");
  const userEl = $("auth-user");

  if (isLoggedIn) {
    if (authOut) authOut.style.display = "none";
    if (authIn) authIn.style.display = "block";
    if (app) app.style.display = "block";
    if (userEl) userEl.textContent = email || "";
  } else {
    if (authOut) authOut.style.display = "block";
    if (authIn) authIn.style.display = "none";
    if (app) app.style.display = "none";
    if (userEl) userEl.textContent = "";
  }
}

// ==============================
// Supabase DB helpers
// Table: public.journal_lines
// columns expected: id uuid, date date, ref text, account_id text, debit numeric, credit numeric, user_id uuid, created_at timestamptz
// ==============================
async function sbFetchJournalLines() {
  if (!currentUser) return [];

  const { data, error } = await sb
    .from("journal_lines")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function sbInsertJournalLines(rows) {
  const { error } = await sb.from("journal_lines").insert(rows);
  if (error) throw error;
}

// ==============================
// AUTH (login only)
// ==============================
window.signIn = async function signIn() {
  const email = ($("auth-email")?.value || "").trim();
  const password = $("auth-pass")?.value || "";
  const msg = $("auth-msg");

  if (msg) msg.textContent = "Logging in...";

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    if (msg) msg.textContent = "Wrong email/password ❌";
    setUI(false);
    return;
  }

  currentUser = data.user;
  if (msg) msg.textContent = "Logged in ✅";

  setUI(true, currentUser?.email || email);
  await initAppAfterLogin();
};

window.signOut = async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  setUI(false);
  const msg = $("auth-msg");
  if (msg) msg.textContent = "Logged out.";
};

// restore session on refresh
(async function restoreSession() {
  const { data } = await sb.auth.getSession();
  const session = data.session;

  if (session?.user) {
    currentUser = session.user;
    setUI(true, currentUser.email);
    await initAppAfterLogin();
  } else {
    setUI(false);
  }
})();

// ==============================
// Init after login (load COA + lines + UI)
// ==============================
async function initAppAfterLogin() {
  // Default date
  const d = new Date();
  if ($("je-date")) $("je-date").valueAsDate = d;

  // Load COA JSON
  try {
    COA = await fetch("./data/coa.json").then((r) => r.json());
  } catch (e) {
    console.log("COA load failed:", e);
    COA = [];
  }

  // Load lines from Supabase
  try {
    lines = await sbFetchJournalLines();
  } catch (e) {
    console.error("Load lines failed:", e);
    setStatus("Load failed ❌ Check console / RLS policies.");
    lines = [];
  }

  buildYearDropdownFromLines();
  restoreSavedFiltersAndApply();
  prepareJournalLinesUI();

  // Restore last opened tab
  const lastView = localStorage.getItem(LAST_VIEW_KEY) || "coa";
  show(lastView);

  // Render initial
  renderCOA();
  renderLedger();
  renderTrialBalance();
}

// ==============================
// Filters (Year/Month)
// ==============================
window.applyDateFilter = function applyDateFilter() {
  const y = $("filter-year")?.value ?? "";
  const m = $("filter-month")?.value ?? "";

  filterYear = (!y || y === "All") ? "" : y;
  filterMonth = (!m || m === "All") ? "" : m;

  localStorage.setItem(FILTER_YEAR_KEY, y);
  localStorage.setItem(FILTER_MONTH_KEY, m);

  renderCOA();
  renderLedger();
  renderTrialBalance();
};

function buildYearDropdownFromLines() {
  const yearSel = $("filter-year");
  if (!yearSel) return;

  const yearsFromLines = lines
    .map((l) => String(l.date || "").slice(0, 4))
    .filter((y) => y && /^\d{4}$/.test(y));

  const years = Array.from(new Set(yearsFromLines)).sort();

  yearSel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "All";
  optAll.textContent = "All";
  yearSel.appendChild(optAll);

  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  });
}

function restoreSavedFiltersAndApply() {
  const savedYear = localStorage.getItem(FILTER_YEAR_KEY) || "All";
  const savedMonth = localStorage.getItem(FILTER_MONTH_KEY) || "";

  if ($("filter-year")) $("filter-year").value = savedYear;
  if ($("filter-month")) $("filter-month").value = savedMonth;

  window.applyDateFilter();
}

// ==============================
// Tabs
// ==============================
window.show = function show(view) {
  localStorage.setItem(LAST_VIEW_KEY, view);

  ["coa", "journal", "ledger", "trial"].forEach((v) => {
    const el = $(v);
    if (!el) return;
    el.style.display = v === view ? "block" : "none";
  });

  if (view === "coa") renderCOA();
  if (view === "ledger") renderLedger();
  if (view === "trial") renderTrialBalance();
};

// ==============================
// COA buttons filter
// ==============================
window.filterCOA = function filterCOA(type) {
  currentCOAType = type;
  renderCOA();
};

// ==============================
// Journal Entry UI
// ==============================
function prepareJournalLinesUI() {
  if ($("je-lines")) {
    $("je-lines").innerHTML = "";
    addLine();
    addLine();
  }
}

window.addLine = function addLine() {
  const tbody = $("je-lines");
  if (!tbody) return;

  const tr = document.createElement("tr");

  const select = document.createElement("select");
  select.style.width = "420px";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select account...";
  select.appendChild(opt0);

  const sortedForDropdown = [...COA].sort((a, b) => {
    const ca = codeNum(a.code);
    const cb = codeNum(b.code);
    if (ca !== cb) return ca - cb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  sortedForDropdown.forEach((a) => {
    const opt = document.createElement("option");
    // your COA json must have "id" field matching what you want to store in journal_lines.account_id
    opt.value = a.id;
    opt.textContent = `${a.code} - ${a.name}`;
    select.appendChild(opt);
  });

  const debit = document.createElement("input");
  debit.placeholder = "0.00";
  debit.style.width = "140px";

  const credit = document.createElement("input");
  credit.placeholder = "0.00";
  credit.style.width = "140px";

  const delBtn = document.createElement("button");
  delBtn.textContent = "X";
  delBtn.onclick = () => tr.remove();

  tr.appendChild(tdWrap(select));
  tr.appendChild(tdWrap(debit, true));
  tr.appendChild(tdWrap(credit, true));
  tr.appendChild(tdWrap(delBtn, true));

  tbody.appendChild(tr);
};

window.saveJournal = async function saveJournal() {
  if (!currentUser) return setStatus("Please login first.");

  const date = $("je-date")?.value;
  const ref = ($("je-ref")?.value || "").trim();

  if (!date) return setStatus("Please set a Date.");
  if (!ref) return setStatus("Please enter Ref No.");

  const rows = [...$("je-lines").querySelectorAll("tr")];
  const newLines = [];

  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach((r) => {
    const sel = r.querySelector("select");
    const inputs = r.querySelectorAll("input");

    const account_id = sel?.value || "";
    const d = parseMoney(inputs[0]?.value);
    const c = parseMoney(inputs[1]?.value);

    if (!account_id) return;
    if (!d && !c) return;

    totalDebit += d;
    totalCredit += c;

    newLines.push({
      // use uuid if your table requires id; better is to set default gen_random_uuid() in DB
      id: (crypto?.randomUUID?.() || randId()),
      date,
      ref,
      account_id,
      debit: d,
      credit: c,
      user_id: currentUser.id, // important for RLS user ownership
    });
  });

  if (newLines.length < 2) return setStatus("Add at least 2 lines.");
  if (Math.abs(totalDebit - totalCredit) > 0.00001) {
    return setStatus("Not balanced: Total Debit must equal Total Credit.");
  }

  try {
    await sbInsertJournalLines(newLines);

    // reload from DB
    lines = await sbFetchJournalLines();
    buildYearDropdownFromLines();
    restoreSavedFiltersAndApply();

    // Reset JE table
    $("je-lines").innerHTML = "";
    addLine();
    addLine();

    setStatus("Saved ✅ General Ledger updated automatically.");
    renderCOA();
    renderLedger();
    renderTrialBalance();
  } catch (e) {
    console.error("Supabase insert error:", e);
    setStatus("Save failed ❌ Check console + Supabase RLS/table columns.");
  }
};

// ==============================
// Render COA
// ==============================
function renderCOA() {
  const tbody = $("coa-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  const balances = computeBalances();

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
    tr.innerHTML = `
      <td>${esc(a.code)}</td>
      <td>${esc(a.name)}</td>
      <td>${esc(a.type)}</td>
      <td>${esc(a.normal)}</td>
      <td style="text-align:right;">${money(bal)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================
// Render Ledger (Account dropdown remembers selection)
// ==============================
function renderLedger() {
  const sel = $("ledger-account");
  const tbody = $("ledger-body");
  if (!sel || !tbody) return;

  // Build dropdown once (reset if COA changed)
  if (sel.options.length === 0) {
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Select account...";
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
    if (savedAcct) sel.value = savedAcct;
  }

  tbody.innerHTML = "";
  const accountId = sel.value;

  localStorage.setItem(LEDGER_ACCOUNT_KEY, accountId || "");
  if (!accountId) return;

  const acct = COA.find((a) => a.id === accountId);
  const normal = acct?.normal || "Debit";

  const acctLines = lines
    .filter((l) => l.account_id === accountId)
    .filter((l) => {
      if (filterYear && !String(l.date || "").startsWith(filterYear)) return false;
      if (filterMonth && Number(String(l.date || "").slice(5, 7)) !== Number(filterMonth)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        String(a.date || "").localeCompare(String(b.date || "")) ||
        String(a.ref || "").localeCompare(String(b.ref || ""))
    );

  let running = 0;

  acctLines.forEach((l) => {
    const delta =
      normal === "Credit"
        ? num(l.credit) - num(l.debit)
        : num(l.debit) - num(l.credit);

    running += delta;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(l.date)}</td>
      <td>${esc(l.ref)}</td>
      <td style="text-align:right;">${money(l.debit)}</td>
      <td style="text-align:right;">${money(l.credit)}</td>
      <td style="text-align:right;">${money(running)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (acctLines.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">No transactions for this account (with current filter).</td>`;
    tbody.appendChild(tr);
  }
}
window.renderLedger = renderLedger; // for onchange

// ==============================
// Compute balances (uses filters)
// ==============================
function computeBalances() {
  const normals = Object.fromEntries(COA.map((a) => [a.id, a.normal]));
  const balances = {};

  lines
    .filter((l) => {
      if (filterYear && !String(l.date || "").startsWith(filterYear)) return false;
      if (filterMonth && Number(String(l.date || "").slice(5, 7)) !== Number(filterMonth)) return false;
      return true;
    })
    .forEach((l) => {
      const normal = normals[l.account_id] || "Debit";
      const delta =
        normal === "Credit"
          ? num(l.credit) - num(l.debit)
          : num(l.debit) - num(l.credit);

      balances[l.account_id] = (balances[l.account_id] || 0) + delta;
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

  const balances = computeBalances();

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
      diff < 0.00001
        ? "Balanced ✅"
        : `Not balanced ❌ (Difference: ${money(diff)})`;
  }
}
window.renderTrialBalance = renderTrialBalance;

// ==============================
// Helpers
// ==============================
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
  return (Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function randId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
