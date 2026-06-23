const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(appDir, "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(appDir, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(appDir, "styles.css"), "utf8");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function extractArray(source, declarationName) {
  const match = source.match(new RegExp(`const\\s+${declarationName}\\s*=\\s*\\[([^\\]]+)\\]`));
  assert.ok(match, `Expected ${declarationName} array declaration`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function assertIncludes(source, needle, label = needle) {
  assert.ok(source.includes(needle), `Expected source to include ${label}`);
}

test("supports Hasan, Husain, and Mariam as payers", () => {
  assert.deepEqual(extractArray(appSource, "people"), ["Hasan", "Husain", "Mariam"]);
  assertIncludes(htmlSource, '<select id="paidBy" name="paidBy" required>');
  assertIncludes(htmlSource, '<option value="Hasan">Hasan</option>');
  assertIncludes(htmlSource, '<option value="Husain">Husain</option>');
  assertIncludes(htmlSource, '<option value="Mariam">Mariam</option>');
  assertIncludes(htmlSource, 'data-payer="Hasan"');
  assertIncludes(htmlSource, 'data-payer="Husain"');
  assertIncludes(htmlSource, 'data-payer="Mariam"');
  assertIncludes(htmlSource, 'id="mariamPaid"');
  assertIncludes(htmlSource, 'id="mariamShare"');
  assertIncludes(appSource, 'paidBy: people.includes(expense.paidBy) ? expense.paidBy : "Hasan"');
});

test("supports prepaid flight and hotel costs outside the spending budget", () => {
  assertIncludes(appSource, '"Flight"');
  assertIncludes(htmlSource, '<option value="Flight">Flight</option>');
  assertIncludes(htmlSource, 'id="excludeFromBudget"');
  assertIncludes(htmlSource, "Exclude from spending budget");
  assertIncludes(appSource, "excludeFromBudget: els.excludeFromBudget.checked");
  assertIncludes(appSource, 'els.category.addEventListener("change", syncBudgetExclusion)');
  assertIncludes(appSource, '["Flight", "Hotel"].includes(els.category.value)');
  assertIncludes(appSource, "const budgetSpend = totals.budgetGbp");
  assertIncludes(appSource, "summary.excludedGbp += gbp");
  assertIncludes(appSource, "Outside budget");
});

test("keeps BHD conversion visible without a currency toggle", () => {
  assertIncludes(appSource, 'const HOME_CURRENCY = "BHD"');
  assertIncludes(appSource, 'const BASE_CURRENCY = "GBP"');
  assertIncludes(appSource, 'const RATE_API_URL = "https://api.frankfurter.dev/v2/rate/GBP/BHD"');
  assertIncludes(htmlSource, 'id="homeSpend"');
  assertIncludes(appSource, "formatAlternateMoney");
  assertIncludes(appSource, "formatExpenseAmountDetail(expense, exchangeRate)");
  assert.ok(!htmlSource.includes('id="currencyToggle"'));
  assert.ok(!htmlSource.includes("View in BHD"));
  assert.ok(!appSource.includes("function toggleDisplayCurrency()"));
});

test("supports entering amounts in GBP or BHD", () => {
  assertIncludes(htmlSource, 'id="amountCurrency"');
  assertIncludes(htmlSource, '<option value="GBP">GBP</option>');
  assertIncludes(htmlSource, '<option value="BHD">BHD</option>');
  assertIncludes(appSource, "const originalAmount = Number(els.amount.value)");
  assertIncludes(appSource, "const originalCurrency = els.amountCurrency.value");
  assertIncludes(appSource, "const gbpAmount = convertToBaseCurrency(originalAmount, originalCurrency)");
  assertIncludes(appSource, "originalAmount: Number(expense.originalAmount) || amount");
  assertIncludes(appSource, "originalCurrency");
  assertIncludes(appSource, "Entered ${formatMoney(originalAmount, HOME_CURRENCY)}");
});

test("exports Excel-friendly CSV and template files", () => {
  assertIncludes(htmlSource, 'id="importExcel"');
  assertIncludes(htmlSource, "Import Excel");
  assertIncludes(htmlSource, 'id="importExcelFile"');
  assertIncludes(htmlSource, 'accept=".csv,text/csv"');
  assertIncludes(htmlSource, 'id="exportExcel"');
  assertIncludes(htmlSource, "Export Excel");
  assertIncludes(htmlSource, 'id="downloadTemplate"');
  assertIncludes(htmlSource, "Excel template");
  assertIncludes(appSource, 'els.importExcel.addEventListener("click", () => els.importExcelFile.click())');
  assertIncludes(appSource, 'els.importExcelFile.addEventListener("change", importExcel)');
  assertIncludes(appSource, 'els.exportExcel.addEventListener("click", exportExcel)');
  assertIncludes(appSource, 'els.downloadTemplate.addEventListener("click", downloadExcelTemplate)');
  assertIncludes(appSource, "async function importExcel(event)");
  assertIncludes(appSource, "function parseExpenseCsv(text)");
  assertIncludes(appSource, "function buildExpenseFromImportRow(headers, row, rowNumber)");
  assertIncludes(appSource, "function exportExcel()");
  assertIncludes(appSource, "function downloadExcelTemplate()");
  assertIncludes(appSource, "trip-expenses-${new Date().toISOString().slice(0, 10)}.csv");
  assertIncludes(appSource, "trip-expense-template.csv");
  assertIncludes(appSource, "Imported ${imported.length}");
  assertIncludes(cssSource, ".export-actions");
});

test("retains equal split settlement logic", () => {
  assertIncludes(appSource, "function getSettlement(balances)");
  assertIncludes(appSource, "const settlement = getSettlement(totals.balances)");
  assertIncludes(appSource, "summary.balances[paidBy] = (summary.balances[paidBy] || 0) + gbp");
  assertIncludes(appSource, "summary.balances[person] = (summary.balances[person] || 0) - share");
  assertIncludes(appSource, "summary: `${debtor} owes ${creditor}`");
  assertIncludes(htmlSource, 'id="settlementSummary"');
  assertIncludes(htmlSource, 'id="settlementDetail"');
  assertIncludes(htmlSource, "Net settle up");
});

test("shows direct itemized settlement page with note-based Ebrahim amounts", () => {
  assertIncludes(htmlSource, 'class="page-nav"');
  assertIncludes(htmlSource, 'data-page-target="expenses"');
  assertIncludes(htmlSource, 'data-page-target="settlements"');
  assertIncludes(htmlSource, "Who owes who");
  assertIncludes(htmlSource, 'id="directDebtTotal"');
  assertIncludes(htmlSource, 'id="hasanHusainNet"');
  assertIncludes(htmlSource, 'id="noteAdjustmentTotal"');
  assertIncludes(htmlSource, 'id="directDebtList"');
  assertIncludes(appSource, "state.activePage = button.dataset.pageTarget");
  assertIncludes(appSource, "function renderDirectDebts(expenses)");
  assertIncludes(appSource, "function getDirectDebts(expenses)");
  assertIncludes(appSource, "function getExactEbrahimShare(expense)");
  assertIncludes(appSource, '/(ebrahim|berm)/i.test(notes)');
  assertIncludes(appSource, "Note exact amount for Ebrahim");
  assertIncludes(cssSource, ".direct-debt-card");
  assertIncludes(cssSource, ".layout.settlement-layout .entry-panel");
});

test("supports payments that do not need to be split", () => {
  assertIncludes(htmlSource, 'id="excludeFromSplit"');
  assertIncludes(htmlSource, "Do not split this payment");
  assertIncludes(appSource, "excludeFromSplit: els.excludeFromSplit.checked");
  assertIncludes(appSource, "excludeFromSplit: Boolean(expense.excludeFromSplit)");
  assertIncludes(appSource, "summary.splitGbp += gbp");
  assertIncludes(appSource, "summary.byPayerSplit[paidBy]");
  assertIncludes(appSource, "totals.splitGbp ? `${formatDisplayMoney(totals.splitGbp)} split` : \"Each share\"");
  assertIncludes(appSource, "function getExpenseSplitNote(expense)");
  assertIncludes(appSource, "Not split");
  assertIncludes(cssSource, ".amount-cell .split-note");
});

test("supports splitting selected bills with Ebrahim and Mariam", () => {
  assert.deepEqual(extractArray(appSource, "baseSplitPeople"), ["Hasan", "Husain"]);
  assert.deepEqual(extractArray(appSource, "splitPeople"), ["Hasan", "Husain", "Ebrahim", "Mariam"]);
  assertIncludes(htmlSource, 'id="includeEbrahim"');
  assertIncludes(htmlSource, "Include Ebrahim in the split");
  assertIncludes(htmlSource, 'id="includeMariam"');
  assertIncludes(htmlSource, "Include Mariam in the split");
  assertIncludes(htmlSource, 'id="ebrahimBalance"');
  assertIncludes(htmlSource, 'id="mariamBalance"');
  assertIncludes(appSource, "includeEbrahim: els.includeEbrahim.checked");
  assertIncludes(appSource, "includeMariam: els.includeMariam.checked");
  assertIncludes(appSource, "includeEbrahim: Boolean(expense.includeEbrahim)");
  assertIncludes(appSource, "includeMariam: Boolean(expense.includeMariam)");
  assertIncludes(appSource, "function getSplitParticipants(expense)");
  assertIncludes(appSource, 'if (expense.includeEbrahim) participants.push("Ebrahim")');
  assertIncludes(appSource, 'if (expense.includeMariam) participants.push("Mariam")');
  assertIncludes(appSource, "const share = participants.length ? gbp / participants.length : 0");
  assertIncludes(appSource, "const debtors = participants.filter((person) => person !== paidBy)");
  assertIncludes(appSource, 'const suffix = debtors.length > 1 ? " each" : ""');
});

test("removes retired header action buttons", () => {
  assert.ok(!htmlSource.includes('id="seedDemo"'));
  assert.ok(!htmlSource.includes('id="exportCsv"'));
  assert.ok(!htmlSource.includes("Load sample"));
  assert.ok(!htmlSource.includes("Export CSV"));
  assert.ok(!appSource.includes("function loadSampleExpenses()"));
  assert.ok(!appSource.includes("function exportCsv()"));
});

test("HTML defines every ID queried by app.js", () => {
  const queriedIds = [...appSource.matchAll(/querySelector\("#([^"]+)"\)/g)].map((match) => match[1]);
  const htmlIds = new Set([...htmlSource.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const missingIds = queriedIds.filter((id) => !htmlIds.has(id));

  assert.deepEqual(missingIds, []);
});

test("HTML references expected dashboard IDs", () => {
  const expectedIds = [
    "expenseForm",
    "amountCurrency",
    "paidBy",
    "importExcel",
    "importExcelFile",
    "exportExcel",
    "downloadTemplate",
    "directDebtTotal",
    "hasanHusainNet",
    "noteAdjustmentTotal",
    "directDebtList",
    "totalSpend",
    "homeSpend",
    "hasanPaid",
    "husainPaid",
    "mariamPaid",
    "settlementSummary",
    "settlementDetail",
    "amountHeader",
    "expenseRows",
  ];

  for (const id of expectedIds) {
    assertIncludes(htmlSource, `id="${id}"`);
  }
});

test("keeps mobile transaction card support", () => {
  assertIncludes(appSource, 'data-label="Merchant"');
  assertIncludes(appSource, 'data-label="Paid by"');
  assertIncludes(appSource, 'data-label="${getDisplayCurrency()} amount"');
  assertIncludes(cssSource, "@media (max-width: 1099px)");
  assertIncludes(cssSource, "td::before");
  assertIncludes(cssSource, "content: attr(data-label)");
  assertIncludes(cssSource, "@media (max-width: 460px)");
});

test("shows compact payments first on mobile", () => {
  assertIncludes(htmlSource, 'class="panel payments-panel"');
  assertIncludes(cssSource, ".payments-panel");
  assertIncludes(cssSource, "order: -3");
  assertIncludes(cssSource, 'td[data-label="Payment"]');
  assertIncludes(cssSource, "font-size: 0.68rem");
  assertIncludes(cssSource, ".payments-panel .link-button");
});

test("locks mobile viewport zoom and horizontal overflow", () => {
  assertIncludes(htmlSource, "maximum-scale=1");
  assertIncludes(htmlSource, "user-scalable=no");
  assertIncludes(htmlSource, "viewport-fit=cover");
  assertIncludes(cssSource, "overscroll-behavior-x: none");
  assertIncludes(cssSource, "overflow-x: clip");
  assertIncludes(cssSource, "touch-action: pan-y");
  assertIncludes(cssSource, "max-width: 100vw");
});

test("keeps desktop payment rows from clipping stacked amounts", () => {
  assertIncludes(cssSource, "@media (min-width: 1100px)");
  assertIncludes(cssSource, "flex-direction: column");
  assertIncludes(cssSource, ".amount-cell br");
  assertIncludes(cssSource, "display: none");
  assertIncludes(cssSource, "@media (min-width: 1440px)");
});

test("keeps mobile expense modal support", () => {
  assertIncludes(htmlSource, 'id="openExpenseModal"');
  assertIncludes(htmlSource, 'id="openExpenseModal" type="button" aria-label="Log expense">+</button>');
  assertIncludes(htmlSource, 'id="closeExpenseModal"');
  assertIncludes(htmlSource, 'id="expenseModalBackdrop"');
  assertIncludes(appSource, "function openExpenseModal()");
  assertIncludes(appSource, "function closeExpenseModal()");
  assertIncludes(appSource, 'document.body.classList.add("expense-modal-open")');
  assertIncludes(appSource, 'els.openExpenseModal.addEventListener("click", openExpenseModal)');
  assertIncludes(cssSource, ".mobile-fab");
  assertIncludes(cssSource, "body.expense-modal-open .entry-panel");
  assert.ok(cssSource.indexOf("body.expense-modal-open .entry-panel") < cssSource.indexOf("@media (max-width: 1099px)"));
  assertIncludes(cssSource, "body.expense-modal-open .app-shell");
  assertIncludes(cssSource, "z-index: 900");
  assertIncludes(cssSource, "z-index: 1000");
});

test("uses simple fixed light mode with compact cloud-only header", () => {
  assertIncludes(cssSource, "color-scheme: light");
  assertIncludes(cssSource, "--bg: #f7f8fb");
  assertIncludes(cssSource, "--surface: #ffffff");
  assertIncludes(htmlSource, '<html lang="en" data-theme="light">');
  assertIncludes(appSource, 'applyTheme("light")');
  assertIncludes(appSource, 'const next = "light"');
  assertIncludes(htmlSource, "<title>Trip Expenses</title>");
  assertIncludes(htmlSource, '<header class="topbar">');
  assertIncludes(htmlSource, 'id="cloudStatus" aria-live="polite"');
  assert.ok(!htmlSource.includes('id="themeToggle"'));
  assert.ok(!cssSource.includes("prefers-color-scheme: dark"));
  assert.ok(!cssSource.includes('data-theme="dark"'));
  assert.ok(!htmlSource.includes("<h1>Trip Expenses</h1>"));
  assert.ok(!htmlSource.includes("UK trip tracker"));
  assert.ok(!htmlSource.includes("<h1>Hasan & Husain Expenses</h1>"));
});

test("keeps Netlify cloud persistence wired", () => {
  const functionSource = fs.readFileSync(
    path.join(appDir, "netlify", "functions", "trip-data.js"),
    "utf8",
  );
  const netlifyConfig = fs.readFileSync(path.join(appDir, "netlify.toml"), "utf8");
  const packageJson = fs.readFileSync(path.join(appDir, "package.json"), "utf8");

  assertIncludes(appSource, 'const CLOUD_API_URL = "/.netlify/functions/trip-data"');
  assertIncludes(appSource, "function loadCloudData()");
  assertIncludes(appSource, "function saveCloudData()");
  assertIncludes(htmlSource, 'id="cloudStatus"');
  assertIncludes(functionSource, 'import { getStore } from "@netlify/blobs"');
  assertIncludes(functionSource, 'getStore(STORE_NAME)');
  assertIncludes(functionSource, "await store.setJSON(DATA_KEY, data)");
  assertIncludes(netlifyConfig, 'functions = "netlify/functions"');
  assertIncludes(packageJson, '"@netlify/blobs"');
});
