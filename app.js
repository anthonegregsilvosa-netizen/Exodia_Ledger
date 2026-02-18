// === Mini QuickBooks Logic (COA + Journal + Ledger + Trial Balance) + AUTH (Login only) ===

// ==============================
// Local UI memory keys
// ==============================
const LAST_VIEW_KEY = "exodiaLedger.lastView.v1";
const FILTER_YEAR_KEY = "exodiaLedger.filterYear.v1";
const FILTER_MONTH_KEY = "exodiaLedger.filterMonth.v1";
const LEDGER_ACCOUNT_KEY = "exodiaLedger.ledgerAccount.v1";

// ==============================
// Supabase Setup
// ==============================
const SUPABASE_URL = "https://vtglfaeyvmciieuntzhs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0Z2xmYWV5dm1jaWlldW50emhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2Nzg0NDUsImV4cCI6MjA4NTI1NDQ0NX0.eDOOS3BKKcNOJ_pq5-QpQkW6d1hpp2vdYPsvzzZgZzo";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==============================
// DOM helper
// ==============================
const $ = (id) => document.getElementById(id);

// ==============================
// App state
// ==============================
let currentUser = null;
let COA = [];
let currentCOAType = "All";
let lines = []; // loaded from Supabase (journal_lines)

let filterYear = "";
let filterMonth = "";

// ==============================
// AUTH UI helpers
// ==============================
function setUI(isLoggedIn, email = "") {
  const app = $("app");
  const outBox = $("auth-logged-out");
  const inBox = $("auth-logged-in");
  const userEl = $("auth-user");

  if (isLoggedIn) {
    if (app) app.style.display = "block";
    if (outBox) outBox.style.display = "none";
    if (inBox) inBox.style.display = "block";
    if (userEl) userEl.textContent = email || "";
  } else {
    if (app) app.style.display = "none";
    if (outBox) outBox.style.display = "block";
    if (inBox) inBox.style.display = "none";
    if (userEl) userEl.textContent = "";
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
  setAuthMsg("");
  setAuthMsgIn("Logged in ✅");
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
  setUI(false);
};

// ==============================
// Supabase helpers
// ==============================
function normalizeLine(row) {
  return {
    id: row.id,
    journal_id: row.journal_id || null,
    is_deleted: row.is_deleted ?? false,

    entry_date: row.entry_date,
    ref: row.ref,
    accountId: row.account_id,
    accountName: row.account_name || "",
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    created_at: row.created_at,
  };
}

async function sbFetchJournalLines() {
  if (!currentUser) return [];
  const { data, error } = await sb
    .from("journal_lines")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeLine);
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

// ==============================
// Required-field helper (GLOBAL)
// ==============================
function markRequired(el, isBad) {
  if (!el) return;
  el.style.border = isBad ? "2px solid crimson" : "";
}

// ==============================
// Filters (Year/Month)
// ==============================
window.applyDateFilter = function () {
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

// ==============================
// Tabs
// ==============================
window.show = function (view) {
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
window.filterCOA = function (type) {
  currentCOAType = type;
  renderCOA();
};

// ==============================
// Journal Entry
// ==============================
window.addLine = function () {
  const tbody = $("je-lines");
  if (!tbody) return;

  const tr = document.createElement("tr");

  // --- Searchable account picker (datalist) ---
  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "6px";

  const acctInput = document.createElement("input");
  acctInput.placeholder = "Type to search account (code or name)...";
  acctInput.style.width = "420px";

  // hidden account_id storage (this is what we save)
  const acctId = document.createElement("input");
  acctId.type = "hidden";

  const listId = "coa-datalist";
  acctInput.setAttribute("list", listId);

  // Create datalist ONCE
  let dl = document.getElementById(listId);
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = listId;

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

    document.body.appendChild(dl);
  }

  // map "CODE - NAME" -> id
  function textToAccountId(text) {
    const t = String(text || "").trim().toLowerCase();
    const found = COA.find(
      (a) => (`${a.code} - ${a.name}`).toLowerCase() === t
    );
    return found ? found.id : "";
  }

  // when user types/selects a value
  acctInput.addEventListener("input", () => {
    acctId.value = textToAccountId(acctInput.value);
  });

  wrap.appendChild(acctInput);
  wrap.appendChild(acctId);

  // Debit/Credit inputs
  const debit = document.createElement("input");
  debit.placeholder = "0.00";
  debit.style.width = "140px";

  const credit = document.createElement("input");
  credit.placeholder = "0.00";
  credit.style.width = "140px";

  const delBtn = document.createElement("button");
  delBtn.textContent = "X";
  delBtn.onclick = () => tr.remove();

  tr.appendChild(tdWrap(wrap));
  tr.appendChild(tdWrap(debit, true));
  tr.appendChild(tdWrap(credit, true));
  tr.appendChild(tdWrap(delBtn, true));

  tbody.appendChild(tr);
};

window.saveJournal = async function () {
  if (!currentUser) return setStatus("Please login first.");

  // ✅ REQUIRED FIELDS (match your HTML IDs)
  const entry_date = $("je-date")?.value || "";
  const ref = ($("je-refno")?.value || "").trim();
  const description = ($("je-description")?.value || "").trim();

  // highlight red borders if missing
  markRequired($("je-date"), !entry_date);
  markRequired($("je-refno"), !ref);
  markRequired($("je-description"), !description);

  // stop saving if missing required fields
  if (!entry_date || !ref || !description) {
    setStatus("Please fill all required (*) fields before saving.");
    return;
  }

  // OPTIONAL header fields (only if present in HTML)
  const department = ($("je-dept")?.value || "").trim();
  const payment_method = ($("je-paymethod")?.value || "").trim();
  const client_vendor = ($("je-client")?.value || "").trim();
  const remarks = ($("je-remarks")?.value || "").trim();

  // Collect lines + validate
  const rows = [...$("je-lines").querySelectorAll("tr")];
  const lineRows = [];

  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach((r) => {
    const hidden = r.querySelector('input[type="hidden"]');
const tds = r.querySelectorAll("td");

const accountId = hidden?.value || "";

// debit/credit are in column 2 and 3
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
      journal_id: null, // fill after header insert
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

  // Insert header
  const { data: entry, error: entryErr } = await sb
    .from("journal_entries")
    .insert([
      {
        user_id: currentUser.id,
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

  // Insert lines linked to header
  const journal_id = entry.id;
  const finalLines = lineRows.map((r) => ({ ...r, journal_id }));

  try {
    await sbInsertJournalLines(finalLines);
    lines = await loadLinesFromDb();

    $("je-lines").innerHTML = "";
    addLine();
    addLine();

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
// Render Ledger
// ==============================
function renderLedger() {
  const sel = $("ledger-account");
  const tbody = $("ledger-body");
  if (!sel || !tbody) return;

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
  .filter((l) => !l.is_deleted)
  .filter((l) => l.accountId === accountId)
    .filter((l) => {
      const d = String(l.entry_date || "");
      if (filterYear && !d.startsWith(filterYear)) return false;
      if (filterMonth && Number(d.slice(5, 7)) !== Number(filterMonth)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        String(a.entry_date || "").localeCompare(String(b.entry_date || "")) ||
        String(a.ref || "").localeCompare(String(b.ref || ""))
    );

  let running = 0;

acctLines.forEach((l) => {
  const delta =
    normal === "Credit"
      ? num(l.credit) - num(l.debit)
      : num(l.debit) - num(l.credit);

  running += delta;

  const tr = document.createElement("tr"); // ✅ THIS WAS MISSING

  const canEdit = !!l.journal_id;

  tr.innerHTML = `
    <td>${esc(l.entry_date)}</td>
    <td>${esc(l.ref)}</td>
    <td style="text-align:right;">${money(l.debit)}</td>
    <td style="text-align:right;">${money(l.credit)}</td>
    <td style="text-align:right;">${money(running)}</td>
    <td>
      ${
        canEdit
          ? `<a href="./edit.html?journal_id=${encodeURIComponent(l.journal_id)}&account_id=${encodeURIComponent(accountId)}">Edit / Delete</a>`
          : `<span class="muted">N/A</span>`
      }
    </td>
  `;

  tbody.appendChild(tr);
});

  if (acctLines.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">No transactions for this account (with current filter).</td>`;
    tbody.appendChild(tr);
  }
}

// ==============================
// Compute balances
// ==============================
function computeBalances() {
  const normals = Object.fromEntries(COA.map((a) => [a.id, a.normal]));
  const balances = {};

  lines
  .filter((l) => !l.is_deleted)
  .filter((l) => {
      const d = String(l.entry_date || "");
      if (filterYear && !d.startsWith(filterYear)) return false;
      if (filterMonth && Number(d.slice(5, 7)) !== Number(filterMonth)) return false;
      return true;
    })
    .forEach((l) => {
      const normal = normals[l.accountId] || "Debit";
      const delta =
        normal === "Credit"
          ? num(l.credit) - num(l.debit)
          : num(l.debit) - num(l.credit);

      balances[l.accountId] = (balances[l.accountId] || 0) + delta;
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

// ==============================
// Init after login
// ==============================
async function initAppAfterLogin() {
  const d = new Date();
  if ($("je-date")) $("je-date").valueAsDate = d;

  try {
    COA = await fetch("./data/coa.json").then((r) => r.json());
  } catch (e) {
    console.log("COA load failed:", e);
    COA = [];
  }

  lines = await loadLinesFromDb();

  const ledgerSel = $("ledger-account");
  if (ledgerSel) ledgerSel.innerHTML = "";

  const yearSel = $("filter-year");
  if (yearSel) {
    const yearsFromLines = lines
      .map((l) => String(l.entry_date || "").slice(0, 4))
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

    const savedYear = localStorage.getItem(FILTER_YEAR_KEY) || "All";
    const savedMonth = localStorage.getItem(FILTER_MONTH_KEY) || "";
    if ($("filter-year")) $("filter-year").value = savedYear;
    if ($("filter-month")) $("filter-month").value = savedMonth;
  }

  if ($("je-lines")) {
    $("je-lines").innerHTML = "";
    addLine();
    addLine();
  }

  applyDateFilter();

  const lastView = localStorage.getItem(LAST_VIEW_KEY) || "coa";
  show(lastView);
}

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
    setUI(true, currentUser.email);
    await initAppAfterLogin();
  } else {
    setUI(false);
  }
})();

// ==============================
// Helpers / Utils
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

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ Live red-border validation for required fields
["je-date", "je-refno", "je-description"].forEach((id) => {
  $(id)?.addEventListener("input", () => {
    const el = $(id);
    const val = (el?.value || "").trim();
    markRequired(el, !val);
  });
});
