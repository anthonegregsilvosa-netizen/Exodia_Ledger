// ===== Mini QuickBooks Logic (COA + Journal + Ledger) =====
const STORAGE_KEY = "exodiaLedger.journalLines.v1";
const $ = (id) => document.getElementById(id);

let COA = [];
let currentCOAType = "All";
let lines = loadLines();

// Switch tabs
window.show = function(view) {
  ["coa","journal","ledger"].forEach(v => {
    const el = $(v);
    if (!el) return;
    el.style.display = (v === view) ? "block" : "none";
  });
  if (view === "coa") renderCOA();
  if (view === "ledger") renderLedger();
};

// COA filter (Chart of Accounts buttons)
window.filterCOA = function(type){
  currentCOAType = type;
  renderCOA();
};

// Add a journal line row
window.addLine = function() {
  const tbody = $("je-lines");
  const tr = document.createElement("tr");

  const select = document.createElement("select");
  select.style.width = "420px";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Select account...";
  select.appendChild(opt0);

  // IMPORTANT: Journal Entry should list ALL accounts (not filtered)
  COA.forEach(a => {
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
  delBtn.onclick = () => {
    tr.remove();
  };

  tr.appendChild(tdWrap(select));
  tr.appendChild(tdWrap(debit, true));
  tr.appendChild(tdWrap(credit, true));
  tr.appendChild(tdWrap(delBtn, true));

  tbody.appendChild(tr);
};

// Save Journal Entry (posts to ledger automatically)
window.saveJournal = function() {
  const date = $("je-date").value;
  const ref = ($("je-ref").value || "").trim();

  if (!date) return setStatus("Please set a Date.");
  if (!ref) return setStatus("Please enter Ref No.");

  const rows = [...$("je-lines").querySelectorAll("tr")];
  const newLines = [];

  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach(r => {
    const sel = r.querySelector("select");
    const inputs = r.querySelectorAll("input");

    const accountId = sel?.value || "";
    const d = parseMoney(inputs[0]?.value);
    const c = parseMoney(inputs[1]?.value);

    if (!accountId) return;
    if (!d && !c) return;

    totalDebit += d;
    totalCredit += c;

    newLines.push({
      id: randId(),
      date,
      ref,
      accountId,
      debit: d,
      credit: c
    });
  });

  if (newLines.length < 2) return setStatus("Add at least 2 lines.");
  if (Math.abs(totalDebit - totalCredit) > 0.00001) {
    return setStatus("Not balanced: Total Debit must equal Total Credit.");
  }

  lines = lines.concat(newLines);
  persist();

  // Reset journal lines table
  $("je-lines").innerHTML = "";
  addLine(); addLine();

  setStatus("Saved ✅ General Ledger updated automatically.");
  renderCOA();
  renderLedger();
};

// Helpers for table cells
function tdWrap(el, right=false){
  const td = document.createElement("td");
  if (right) td.style.textAlign = "right";
  td.appendChild(el);
  return td;
}

function setStatus(msg){
  $("je-status").textContent = msg;
}

// Render Chart of Accounts (FILTERED by type buttons)
function renderCOA() {
  const tbody = $("coa-body");
  tbody.innerHTML = "";

  const balances = computeBalances();

  COA
    .filter(a => currentCOAType === "All" || a.type === currentCOAType)
    .forEach(a => {
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

// Render General Ledger (per selected account)
function renderLedger() {
  const sel = $("ledger-account");
  const tbody = $("ledger-body");

  // Build dropdown once
  if (sel.options.length === 0) {
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Select account...";
    sel.appendChild(o0);

    COA.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.code} - ${a.name}`;
      sel.appendChild(opt);
    });
  }

  tbody.innerHTML = "";
  const accountId = sel.value;
  if (!accountId) return;

  const acct = COA.find(a => a.id === accountId);
  const normal = acct?.normal || "Debit";

  const acctLines = lines
    .filter(l => l.accountId === accountId)
    .sort((a,b) => (a.date||"").localeCompare(b.date||"") || (a.ref||"").localeCompare(b.ref||""));

  let running = 0;

  acctLines.forEach(l => {
    const delta = (normal === "Credit")
      ? (num(l.credit) - num(l.debit))
      : (num(l.debit) - num(l.credit));

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
}

// Compute balances for COA display
function computeBalances(){
  const normals = Object.fromEntries(COA.map(a => [a.id, a.normal]));
  const balances = {};

  lines.forEach(l => {
    const normal = normals[l.accountId] || "Debit";
    const delta = (normal === "Credit")
      ? (num(l.credit) - num(l.debit))
      : (num(l.debit) - num(l.credit));

    balances[l.accountId] = (balances[l.accountId] || 0) + delta;
  });

  return balances;
}

// Storage
function loadLines(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

// Utils
function parseMoney(v){
  const cleaned = String(v||"").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function num(v){ return Number(v)||0; }
function money(n){ return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function randId(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ===== Load COA then initialize =====
(async function boot(){
  // Default date
  const d = new Date();
  if ($("je-date")) $("je-date").valueAsDate = d;

  // Load COA JSON
  try{
    COA = await fetch("./data/coa.json").then(r => r.json());
  } catch(e){
    console.log("COA load failed:", e);
    COA = [];
  }

  // Prepare journal lines
  if ($("je-lines")) {
    $("je-lines").innerHTML = "";
    addLine(); addLine();
  }

  renderCOA();
})();
