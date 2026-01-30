// === Mini QuickBooks Logic (COA + Journal + Ledger + Trial Balance) =====

const LAST_VIEW_KEY = "exodiaLedger.lastView.v1";

// ==============================
// Supabase Setup
// ==============================
const SUPABASE_URL = "https://vtglfaeyvmciieuntzhs.supabase.co";
const SUPABASE_ANON_KEY =
  "PASTE_YOUR_ANON_KEY_HERE"; // keep anon key only

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==============================
// Supabase helpers
// ==============================
async function sbFetchJournalLines() {
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
const FILTER_YEAR_KEY = "exodiaLedger.filterYear.v1";
const FILTER_MONTH_KEY = "exodiaLedger.filterMonth.v1";
const LEDGER_ACCOUNT_KEY = "exodiaLedger.ledgerAccount.v1";

const $ = (id) => document.getElementById(id);

let COA = [];
let lines = [];
let currentCOAType = "All";
let filterYear = "";
let filterMonth = "";

// ==============================
// Filters
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
    if (el) el.style.display = v === view ? "block" : "none";
  });

  if (view === "coa") renderCOA();
  if (view === "ledger") renderLedger();
  if (view === "trial") renderTrialBalance();
};

// ==============================
// Journal Entry
// ==============================
window.addLine = function () {
  const tbody = $("je-lines");
  if (!tbody) return;

  const tr = document.createElement("tr");

  const select = document.createElement("select");
  select.style.width = "420px";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select account...";
  select.appendChild(opt0);

  [...COA]
    .sort((a, b) => Number(a.code) - Number(b.code))
    .forEach((a) => {
      const opt = document.createElement("option");
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

  tr.append(tdWrap(select), tdWrap(debit, true), tdWrap(credit, true), tdWrap(delBtn, true));
  tbody.appendChild(tr);
};

window.saveJournal = async function () {
  try {
    const date = $("je-date")?.value;
    const ref = ($("je-ref")?.value || "").trim();
    if (!date || !ref) return setStatus("Date and Ref required.");

    const rows = [...$("je-lines").querySelectorAll("tr")];
    const newLines = [];
    let td = 0, tc = 0;

    rows.forEach((r) => {
      const sel = r.querySelector("select");
      const inputs = r.querySelectorAll("input");

      const account_id = sel?.value;
      const debit = parseMoney(inputs[0]?.value);
      const credit = parseMoney(inputs[1]?.value);

      if (!account_id || (!debit && !credit)) return;

      td += debit;
      tc += credit;

      newLines.push({
        date,
        ref,
        account_id,
        debit,
        credit,
      });
    });

    if (newLines.length < 2) return setStatus("At least 2 lines required.");
    if (Math.abs(td - tc) > 0.00001) return setStatus("Not balanced.");

    await sbInsertJournalLines(newLines);
    lines = await sbFetchJournalLines();

    renderCOA();
    renderLedger();
    renderTrialBalance();

    $("je-lines").innerHTML = "";
    addLine(); addLine();
    setStatus("Saved ✅");

  } catch (e) {
    console.error(e);
    setStatus("Save failed ❌ (check console)");
  }
};

// ==============================
// Rendering + Helpers (unchanged logic)
// ==============================
function renderCOA() { /* same as before */ }
function renderLedger() { /* same as before */ }
function renderTrialBalance() { /* same as before */ }

// ==============================
// Boot
// ==============================
(async function boot() {
  COA = await fetch("./data/coa.json").then(r => r.json());
  lines = await sbFetchJournalLines();

  if ($("je-date")) $("je-date").valueAsDate = new Date();
  if ($("je-lines")) { addLine(); addLine(); }

  show(localStorage.getItem(LAST_VIEW_KEY) || "coa");
})();

// ==============================
// Utils
// ==============================
function tdWrap(el, right=false){const td=document.createElement("td");if(right)td.style.textAlign="right";td.appendChild(el);return td;}
function setStatus(m){const el=$("je-status");if(el)el.textContent=m;}
function parseMoney(v){const n=Number(String(v||"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;}
