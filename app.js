const STORAGE_KEY = "ukTripExpenses.v1";
const REPAYMENTS_KEY = "ukTripRepayments.v1";
const SETTINGS_KEY = "ukTripSettings.v1";
const THEME_KEY = "ukTripTheme.v1";
const THEME_ORDER = ["auto", "light", "dark"];
const THEME_LABELS = { auto: "System", light: "Light", dark: "Dark" };
const CLOUD_API_URL = "/.netlify/functions/trip-data";
const HOME_CURRENCY = "BHD";
const BASE_CURRENCY = "GBP";
const RATE_API_URL = "https://api.frankfurter.dev/v2/rate/GBP/BHD";

const categories = [
  "Food",
  "Transport",
  "Flight",
  "Hotel",
  "Shopping",
  "Attractions",
  "Groceries",
  "Other",
];

const payments = ["Card", "Cash", "Apple Pay", "Bank transfer"];
const people = ["Hasan", "Husain", "Mariam"];
const baseSplitPeople = ["Hasan", "Husain"];
const splitPeople = ["Hasan", "Husain", "Ebrahim", "Mariam"];

const categoryHints = [
  { category: "Transport", words: ["tfl", "tube", "uber", "train", "rail", "bus", "taxi", "gatwick", "heathrow"] },
  { category: "Flight", words: ["flight", "airline", "british airways", "ba ", "gulf air", "easyjet", "ryanair", "ticket"] },
  { category: "Food", words: ["pret", "costa", "nero", "restaurant", "cafe", "coffee", "lunch", "dinner"] },
  { category: "Hotel", words: ["hotel", "airbnb", "booking", "stay", "inn"] },
  { category: "Shopping", words: ["boots", "primark", "selfridges", "harrods", "zara", "uniqlo"] },
  { category: "Attractions", words: ["museum", "gallery", "tower", "ticket", "tour", "theatre"] },
  { category: "Groceries", words: ["tesco", "sainsbury", "waitrose", "aldi", "lidl", "coop"] },
];

const state = {
  expenses: loadJson(STORAGE_KEY, []),
  settings: loadJson(SETTINGS_KEY, {
    budget: "",
    exchangeRate: "",
    exchangeRateDate: "",
    exchangeRateFetchedAt: "",
    cloudUpdatedAt: "",
  }),
  repayments: normalizeRepayments(loadJson(REPAYMENTS_KEY, [])),
  filters: { query: "", category: "All", payment: "All", payer: "All" },
  activePage: "overview",
  settlementView: "itemized",
  cloud: { ready: false, saving: false },
};

state.expenses = normalizeExpenses(state.expenses);

const els = {
  layout: document.querySelector("#mainLayout"),
  pageNav: document.querySelector(".page-nav"),
  pages: document.querySelectorAll("[data-page]"),
  form: document.querySelector("#expenseForm"),
  editingId: document.querySelector("#editingId"),
  editingBadge: document.querySelector("#editingBadge"),
  date: document.querySelector("#date"),
  merchant: document.querySelector("#merchant"),
  amount: document.querySelector("#amount"),
  amountCurrency: document.querySelector("#amountCurrency"),
  paidBy: document.querySelector("#paidBy"),
  category: document.querySelector("#category"),
  payment: document.querySelector("#payment"),
  excludeFromBudget: document.querySelector("#excludeFromBudget"),
  excludeFromSplit: document.querySelector("#excludeFromSplit"),
  includeEbrahim: document.querySelector("#includeEbrahim"),
  includeMariam: document.querySelector("#includeMariam"),
  notes: document.querySelector("#notes"),
  budget: document.querySelector("#budget"),
  refreshRate: document.querySelector("#refreshRate"),
  rateStatus: document.querySelector("#rateStatus"),
  cloudStatus: document.querySelector("#cloudStatus"),
  totalSpend: document.querySelector("#totalSpend"),
  homeSpend: document.querySelector("#homeSpend"),
  hasanPaid: document.querySelector("#hasanPaid"),
  hasanShare: document.querySelector("#hasanShare"),
  husainPaid: document.querySelector("#husainPaid"),
  husainShare: document.querySelector("#husainShare"),
  mariamPaid: document.querySelector("#mariamPaid"),
  mariamShare: document.querySelector("#mariamShare"),
  settlementSummary: document.querySelector("#settlementSummary"),
  settlementDetail: document.querySelector("#settlementDetail"),
  fairShareLabel: document.querySelector("#fairShareLabel"),
  hasanBalance: document.querySelector("#hasanBalance"),
  husainBalance: document.querySelector("#husainBalance"),
  ebrahimBalance: document.querySelector("#ebrahimBalance"),
  mariamBalance: document.querySelector("#mariamBalance"),
  budgetProgress: document.querySelector("#budgetProgress"),
  budgetText: document.querySelector("#budgetText"),
  budgetLabel: document.querySelector("#budgetLabel"),
  amountHeader: document.querySelector("#amountHeader"),
  categoryChart: document.querySelector("#categoryChart"),
  expenseRows: document.querySelector("#expenseRows"),
  expenseCount: document.querySelector("#expenseCount"),
  transactionPageCount: document.querySelector("#transactionPageCount"),
  directDebtCount: document.querySelector("#directDebtCount"),
  directDebtTotal: document.querySelector("#directDebtTotal"),
  outstandingTotal: document.querySelector("#outstandingTotal"),
  settledTotal: document.querySelector("#settledTotal"),
  hasanHusainNet: document.querySelector("#hasanHusainNet"),
  noteAdjustmentTotal: document.querySelector("#noteAdjustmentTotal"),
  cardPayoffPerson: document.querySelector("#cardPayoffPerson"),
  cardCharged: document.querySelector("#cardCharged"),
  cardOwnShare: document.querySelector("#cardOwnShare"),
  cardReimbursable: document.querySelector("#cardReimbursable"),
  cardRepaid: document.querySelector("#cardRepaid"),
  cardOutstanding: document.querySelector("#cardOutstanding"),
  directDebtList: document.querySelector("#directDebtList"),
  simplifiedDebtList: document.querySelector("#simplifiedDebtList"),
  settlementViewToggle: document.querySelector(".settlement-view-toggle"),
  repaymentForm: document.querySelector("#repaymentForm"),
  repaymentDate: document.querySelector("#repaymentDate"),
  repaymentFrom: document.querySelector("#repaymentFrom"),
  repaymentTo: document.querySelector("#repaymentTo"),
  repaymentAmount: document.querySelector("#repaymentAmount"),
  repaymentCurrency: document.querySelector("#repaymentCurrency"),
  repaymentNote: document.querySelector("#repaymentNote"),
  repaymentLog: document.querySelector("#repaymentLog"),
  categoryFilter: document.querySelector("#categoryFilter"),
  paymentFilter: document.querySelector("#paymentFilter"),
  payerTabs: document.querySelector(".payer-tabs"),
  search: document.querySelector("#search"),
  importExcel: document.querySelector("#importExcel"),
  importExcelFile: document.querySelector("#importExcelFile"),
  exportExcel: document.querySelector("#exportExcel"),
  downloadTemplate: document.querySelector("#downloadTemplate"),
  cancelEdit: document.querySelector("#cancelEdit"),
  openExpenseModal: document.querySelector("#openExpenseModal"),
  closeExpenseModal: document.querySelector("#closeExpenseModal"),
  expenseModalBackdrop: document.querySelector("#expenseModalBackdrop"),
};

init();

function init() {
  applyTheme("light");
  els.date.valueAsDate = new Date();
  els.repaymentDate.valueAsDate = new Date();
  els.budget.value = state.settings.budget;
  renderFilterOptions();
  bindEvents();
  render();
  loadCloudData().finally(() => refreshExchangeRate({ silent: hasSavedRate() }));
}

function bindEvents() {
  els.form.addEventListener("submit", saveExpense);
  els.cancelEdit.addEventListener("click", () => {
    resetForm();
    closeExpenseModal();
  });
  if (window.matchMedia) {
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = () => {
      if (getSavedTheme() === "auto") updateThemeColorMeta("auto");
    };
    if (colorSchemeQuery.addEventListener) {
      colorSchemeQuery.addEventListener("change", handleColorSchemeChange);
    } else if (colorSchemeQuery.addListener) {
      colorSchemeQuery.addListener(handleColorSchemeChange);
    }
  }
  els.openExpenseModal.addEventListener("click", openExpenseModal);
  els.closeExpenseModal.addEventListener("click", () => {
    resetForm();
    closeExpenseModal();
  });
  els.expenseModalBackdrop.addEventListener("click", () => {
    resetForm();
    closeExpenseModal();
  });
  els.pageNav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page-target]");
    if (!button) return;
    state.activePage = button.dataset.pageTarget;
    renderPage();
  });
  els.repaymentForm.addEventListener("submit", saveRepayment);
  els.cardPayoffPerson.addEventListener("change", () => renderDirectDebts(state.expenses));
  els.settlementViewToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-settlement-view]");
    if (!button) return;
    state.settlementView = button.dataset.settlementView;
    renderSettlementView();
  });
  els.directDebtList.addEventListener("click", handleDirectDebtAction);
  els.repaymentLog.addEventListener("click", handleRepaymentLogAction);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    resetForm();
    closeExpenseModal();
  });
  els.merchant.addEventListener("input", suggestCategory);
  els.notes.addEventListener("input", suggestCategory);
  els.category.addEventListener("change", syncBudgetExclusion);
  els.budget.addEventListener("input", saveSettings);
  els.refreshRate.addEventListener("click", () => refreshExchangeRate({ silent: false }));
  els.importExcel.addEventListener("click", () => els.importExcelFile.click());
  els.importExcelFile.addEventListener("change", importExcel);
  els.exportExcel.addEventListener("click", exportExcel);
  els.downloadTemplate.addEventListener("click", downloadExcelTemplate);
  els.search.addEventListener("input", () => {
    state.filters.query = els.search.value.trim().toLowerCase();
    render();
  });
  els.categoryFilter.addEventListener("change", () => {
    state.filters.category = els.categoryFilter.value;
    render();
  });
  els.paymentFilter.addEventListener("change", () => {
    state.filters.payment = els.paymentFilter.value;
    render();
  });
  els.payerTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-payer]");
    if (!button) return;
    state.filters.payer = button.dataset.payer;
    render();
  });
  els.expenseRows.addEventListener("click", handleRowAction);
}

function saveExpense(event) {
  event.preventDefault();
  const originalAmount = Number(els.amount.value);
  const originalCurrency = els.amountCurrency.value;
  const gbpAmount = convertToBaseCurrency(originalAmount, originalCurrency);

  if (!gbpAmount) {
    setRateStatus(`Refresh the ${BASE_CURRENCY} to ${HOME_CURRENCY} rate before saving a ${HOME_CURRENCY} amount.`);
    return;
  }

  const expense = {
    id: els.editingId.value || crypto.randomUUID(),
    date: els.date.value,
    merchant: els.merchant.value.trim(),
    amount: gbpAmount,
    originalAmount,
    originalCurrency,
    paidBy: els.paidBy.value,
    category: els.category.value,
    payment: els.payment.value,
    excludeFromBudget: els.excludeFromBudget.checked,
    excludeFromSplit: els.excludeFromSplit.checked,
    includeEbrahim: els.includeEbrahim.checked,
    includeMariam: els.includeMariam.checked,
    notes: els.notes.value.trim(),
  };

  if (!expense.merchant || !expense.date || !expense.amount || !expense.originalAmount) return;

  const existingIndex = state.expenses.findIndex((item) => item.id === expense.id);
  if (existingIndex >= 0) {
    state.expenses[existingIndex] = expense;
  } else {
    state.expenses.push(expense);
  }

  persist();
  resetForm();
  render();
  saveCloudData();
  closeExpenseModal();
}

function saveRepayment(event) {
  event.preventDefault();
  const originalAmount = Number(els.repaymentAmount.value);
  const originalCurrency = els.repaymentCurrency.value;
  const amount = convertToBaseCurrency(originalAmount, originalCurrency);

  if (!amount) {
    setRateStatus(`Refresh the ${BASE_CURRENCY} to ${HOME_CURRENCY} rate before saving a ${HOME_CURRENCY} repayment.`);
    return;
  }

  if (els.repaymentFrom.value === els.repaymentTo.value) {
    setCloudStatus("Choose two different people");
    return;
  }

  state.repayments.push({
    id: crypto.randomUUID(),
    date: els.repaymentDate.value,
    from: els.repaymentFrom.value,
    to: els.repaymentTo.value,
    amount,
    originalAmount,
    originalCurrency,
    note: els.repaymentNote.value.trim(),
  });

  persist();
  resetRepaymentForm();
  render();
  saveCloudData();
  setCloudStatus("Repayment saved");
}

function suggestCategory() {
  if (els.editingId.value) return;
  const haystack = `${els.merchant.value} ${els.notes.value}`.toLowerCase();
  const match = categoryHints.find((hint) =>
    hint.words.some((word) => haystack.includes(word)),
  );
  if (match) {
    els.category.value = match.category;
    syncBudgetExclusion();
  }
}

function saveSettings() {
  state.settings = {
    budget: els.budget.value,
    exchangeRate: state.settings.exchangeRate,
    exchangeRateDate: state.settings.exchangeRateDate,
    exchangeRateFetchedAt: state.settings.exchangeRateFetchedAt,
    cloudUpdatedAt: state.settings.cloudUpdatedAt,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
  saveCloudData();
}

async function refreshExchangeRate({ silent } = { silent: false }) {
  if (!silent) setRateStatus("Fetching GBP to BHD rate...");

  try {
    const response = await fetch(RATE_API_URL);
    if (!response.ok) throw new Error(`Rate API returned ${response.status}`);

    const data = await response.json();
    const rate = Number(data.rate);
    if (!rate) throw new Error("Rate API did not return a numeric rate");

    state.settings.exchangeRate = String(rate);
    state.settings.exchangeRateDate = data.date || "";
    state.settings.exchangeRateFetchedAt = new Date().toISOString();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    saveCloudData();
    render();
  } catch {
    renderRateStatus(true);
  }
}

function render() {
  const filtered = getFilteredExpenses();
  const totals = getTotals(state.expenses);
  const filteredTotals = getTotals(filtered);
  renderPage();
  renderMetrics(totals);
  renderPayerTabs();
  renderCategoryChart(filteredTotals.byCategory, filteredTotals.totalGbp);
  renderRows(filtered);
  renderDirectDebts(state.expenses);
}

function renderPage() {
  els.pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === state.activePage);
  });
  els.pageNav.querySelectorAll("button[data-page-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.pageTarget === state.activePage);
  });
  els.layout.classList.toggle("single-page-layout", state.activePage !== "overview");
}

function renderMetrics(totals) {
  const budget = Number(state.settings.budget);
  const exchangeRate = Number(state.settings.exchangeRate);
  const adjustedBalances = getBalancesFromDebtPairs(getNettedDebtPairs(state.expenses, state.repayments));
  const budgetSpend = totals.budgetGbp;
  const excludedSpend = totals.excludedGbp;
  const hasanPaid = totals.byPayer.Hasan || 0;
  const husainPaid = totals.byPayer.Husain || 0;
  const mariamPaid = totals.byPayer.Mariam || 0;
  const hasanPercent = totals.totalGbp ? Math.round((hasanPaid / totals.totalGbp) * 100) : 0;
  const husainPercent = totals.totalGbp ? Math.round((husainPaid / totals.totalGbp) * 100) : 0;
  const mariamPercent = totals.totalGbp ? Math.round((mariamPaid / totals.totalGbp) * 100) : 0;
  const settlement = getSettlement(adjustedBalances);

  els.totalSpend.textContent = formatDisplayMoney(totals.totalGbp);
  els.homeSpend.textContent = formatAlternateMoney(totals.totalGbp);
  els.hasanPaid.textContent = formatDisplayMoney(hasanPaid);
  els.hasanShare.textContent = `${hasanPercent}% of spending`;
  els.husainPaid.textContent = formatDisplayMoney(husainPaid);
  els.husainShare.textContent = `${husainPercent}% of spending`;
  els.mariamPaid.textContent = formatDisplayMoney(mariamPaid);
  els.mariamShare.textContent = `${mariamPercent}% of spending`;
  els.settlementSummary.textContent = settlement.summary;
  els.settlementDetail.textContent = settlement.detail;
  els.fairShareLabel.textContent = totals.splitGbp ? `${formatDisplayMoney(totals.splitGbp)} split` : "Each share";
  els.hasanBalance.textContent = formatBalance(adjustedBalances.Hasan || 0);
  els.husainBalance.textContent = formatBalance(adjustedBalances.Husain || 0);
  els.ebrahimBalance.textContent = formatBalance(adjustedBalances.Ebrahim || 0);
  els.mariamBalance.textContent = formatBalance(adjustedBalances.Mariam || 0);
  els.amountHeader.textContent = `${getDisplayCurrency()} amount`;

  if (budget > 0) {
    const used = (budgetSpend / budget) * 100;
    const remaining = budget - budgetSpend;
    const excludedLabel = excludedSpend
      ? ` ${formatDisplayMoney(excludedSpend)} prepaid outside budget.`
      : "";
    els.budgetProgress.style.width = `${Math.min(used, 100)}%`;
    els.budgetText.textContent =
      remaining >= 0
        ? `${formatDisplayMoney(budgetSpend)} of ${formatDisplayMoney(budget)} used. ${formatDisplayMoney(remaining)} remaining.${excludedLabel}`
        : `${formatDisplayMoney(budgetSpend)} of ${formatDisplayMoney(budget)} used. ${formatDisplayMoney(Math.abs(remaining))} over budget.${excludedLabel}`;
    els.budgetLabel.textContent = formatDisplayMoney(budget);
  } else {
    els.budgetProgress.style.width = "0%";
    els.budgetText.textContent = "Add a trip budget to track remaining spend.";
    els.budgetLabel.textContent = "Optional";
  }

  renderRateStatus(false);
}

function renderCategoryChart(byCategory, totalGbp) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    els.categoryChart.className = "bar-chart empty-state";
    els.categoryChart.textContent = "No expenses yet";
    return;
  }

  els.categoryChart.className = "bar-chart";
  els.categoryChart.innerHTML = entries
    .map(([name, amount]) => {
      const width = totalGbp ? (amount / totalGbp) * 100 : 0;
      return `
        <div class="bar-row">
          <div class="bar-name">${escapeHtml(name)}</div>
          <div class="bar-track" aria-label="${escapeHtml(name)} ${Math.round(width)}%">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${formatDisplayMoney(amount)}</div>
        </div>
      `;
    })
    .join("");
}

function renderPayerTabs() {
  const activeLabel = state.filters.payer === "All" ? "All spending" : `${state.filters.payer} paid`;
  const filteredCount = getFilteredExpenses().length;
  els.expenseCount.textContent = `${activeLabel}: ${filteredCount} ${filteredCount === 1 ? "expense" : "expenses"}`;
  els.transactionPageCount.textContent = `${filteredCount} ${filteredCount === 1 ? "expense" : "expenses"}`;

  els.payerTabs.querySelectorAll("button[data-payer]").forEach((button) => {
    button.classList.toggle("active", button.dataset.payer === state.filters.payer);
  });
}

function renderRows(expenses) {
  if (!expenses.length) {
    els.expenseRows.innerHTML = `<tr><td colspan="7" class="empty-table">No matching expenses.</td></tr>`;
    return;
  }

  const exchangeRate = Number(state.settings.exchangeRate);

  els.expenseRows.innerHTML = expenses
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (expense) => `
        <tr>
          <td data-label="Date">${formatDate(expense.date)}</td>
          <td data-label="Merchant">
            <strong>${escapeHtml(expense.merchant)}</strong>
            ${expense.notes ? `<br><small>${escapeHtml(expense.notes)}</small>` : ""}
          </td>
          <td data-label="Category"><span class="category-pill" data-category="${escapeHtml(expense.category)}">${escapeHtml(expense.category)}</span></td>
          <td data-label="Paid by"><span class="person-pill" data-person="${escapeHtml(expense.paidBy || "Hasan")}">${escapeHtml(expense.paidBy || "Hasan")}</span></td>
          <td data-label="Payment"><span class="payment-pill">${escapeHtml(expense.payment)}</span></td>
          <td class="amount-cell" data-label="${getDisplayCurrency()} amount">
            <strong>${formatDisplayMoney(expense.amount)}</strong>
            <br><small>${escapeHtml(formatExpenseAmountDetail(expense, exchangeRate))}</small>
            ${expense.excludeFromBudget ? `<br><small class="budget-note">Outside budget</small>` : ""}
            <br><small class="split-note">${escapeHtml(getExpenseSplitNote(expense))}</small>
          </td>
          <td data-label="Actions">
            <div class="row-actions">
              <button class="link-button" type="button" data-action="edit" data-id="${expense.id}">Edit</button>
              <button class="link-button button danger" type="button" data-action="delete" data-id="${expense.id}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderFilterOptions() {
  els.categoryFilter.innerHTML =
    `<option value="All">All categories</option>` +
    categories.map((category) => `<option value="${category}">${category}</option>`).join("");

  els.paymentFilter.innerHTML =
    `<option value="All">All payments</option>` +
    payments.map((payment) => `<option value="${payment}">${payment}</option>`).join("");
}

function handleRowAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const expense = state.expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === "delete") {
    if (!window.confirm(`Delete ${expense.merchant}?`)) return;
    state.expenses = state.expenses.filter((item) => item.id !== expense.id);
    persist();
    render();
    saveCloudData();
    return;
  }

  els.editingId.value = expense.id;
  els.date.value = expense.date;
  els.merchant.value = expense.merchant;
  els.amount.value = getOriginalAmount(expense);
  els.amountCurrency.value = getOriginalCurrency(expense);
  els.paidBy.value = people.includes(expense.paidBy) ? expense.paidBy : "Hasan";
  els.category.value = expense.category;
  els.payment.value = expense.payment;
  els.excludeFromBudget.checked = Boolean(expense.excludeFromBudget);
  els.excludeFromSplit.checked = Boolean(expense.excludeFromSplit);
  els.includeEbrahim.checked = Boolean(expense.includeEbrahim);
  els.includeMariam.checked = Boolean(expense.includeMariam);
  els.notes.value = expense.notes || "";
  els.editingBadge.classList.remove("hidden");
  state.activePage = "log";
  renderPage();
  openExpenseModal();
  els.merchant.focus();
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.date.valueAsDate = new Date();
  els.amountCurrency.value = BASE_CURRENCY;
  els.paidBy.value = "Hasan";
  els.category.value = "Food";
  els.payment.value = "Card";
  els.excludeFromBudget.checked = false;
  els.excludeFromSplit.checked = false;
  els.includeEbrahim.checked = false;
  els.includeMariam.checked = false;
  els.editingBadge.classList.add("hidden");
}

function resetRepaymentForm() {
  els.repaymentForm.reset();
  els.repaymentDate.valueAsDate = new Date();
  els.repaymentFrom.value = "Hasan";
  els.repaymentTo.value = "Husain";
  els.repaymentCurrency.value = HOME_CURRENCY;
}

function handleDirectDebtAction(event) {
  const button = event.target.closest("button[data-action='record-repayment']");
  if (!button) return;

  const amount = Number(button.dataset.amount) || 0;
  els.repaymentFrom.value = button.dataset.from;
  els.repaymentTo.value = button.dataset.to;
  els.repaymentDate.valueAsDate = new Date();
  els.repaymentNote.value = `Repayment for ${button.dataset.from} to ${button.dataset.to}`;

  const rate = Number(state.settings.exchangeRate);
  if (rate) {
    els.repaymentCurrency.value = HOME_CURRENCY;
    els.repaymentAmount.value = roundMoney(amount * rate);
  } else {
    els.repaymentCurrency.value = BASE_CURRENCY;
    els.repaymentAmount.value = roundMoney(amount);
  }

  els.repaymentAmount.focus();
}

function handleRepaymentLogAction(event) {
  const button = event.target.closest("button[data-action='delete-repayment']");
  if (!button) return;
  if (!window.confirm("Delete this repayment?")) return;

  state.repayments = state.repayments.filter((repayment) => repayment.id !== button.dataset.id);
  persist();
  render();
  saveCloudData();
  setCloudStatus("Repayment deleted");
}

function syncBudgetExclusion() {
  if (els.editingId.value) return;
  els.excludeFromBudget.checked = ["Flight", "Hotel"].includes(els.category.value);
}

function openExpenseModal() {
  state.activePage = "log";
  renderPage();
  document.body.classList.add("expense-modal-open");
  window.requestAnimationFrame(() => els.merchant.focus());
}

function closeExpenseModal() {
  document.body.classList.remove("expense-modal-open");
}

function getSavedTheme() {
  return "light";
}

function applyTheme(theme) {
  const next = "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
  updateThemeColorMeta(next);
}

function cycleTheme() {
  const current = getSavedTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  applyTheme(next);
}

function updateThemeColorMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute("content", "#f7f8fb");
}

function getLogicOptions() {
  return { exchangeRate: Number(state.settings.exchangeRate) };
}

function getFilteredExpenses() {
  return state.expenses.filter((expense) => {
    const text = `${expense.merchant} ${expense.notes || ""}`.toLowerCase();
    const matchesQuery = !state.filters.query || text.includes(state.filters.query);
    const matchesCategory =
      state.filters.category === "All" || expense.category === state.filters.category;
    const matchesPayment = state.filters.payment === "All" || expense.payment === state.filters.payment;
    const paidBy = people.includes(expense.paidBy) ? expense.paidBy : "Hasan";
    const matchesPayer = state.filters.payer === "All" || paidBy === state.filters.payer;
    return matchesQuery && matchesCategory && matchesPayment && matchesPayer;
  });
}

function getTotals(expenses) {
  return TripExpenseLogic.getTotals(expenses);
}

function getSplitParticipants(expense) {
  return TripExpenseLogic.getSplitParticipants(expense);
}

function getExpenseSplitNote(expense) {
  if (expense.excludeFromSplit) return "Not split";

  const gbp = Number(expense.amount) || 0;
  const paidBy = people.includes(expense.paidBy) ? expense.paidBy : "Hasan";
  const participants = getSplitParticipants(expense);
  const debtors = participants.filter((person) => person !== paidBy);
  const share = participants.length ? gbp / participants.length : 0;
  const verb = debtors.length === 1 ? "owes" : "owe";
  const suffix = debtors.length > 1 ? " each" : "";

  return `${formatNameList(debtors)} ${verb} ${paidBy} ${formatDisplayMoney(share)}${suffix}`;
}

function convertToBaseCurrency(amount, currency) {
  const numericAmount = Number(amount);
  if (!numericAmount) return 0;
  if (currency === BASE_CURRENCY) return numericAmount;
  const rate = Number(state.settings.exchangeRate);
  return currency === HOME_CURRENCY && rate ? numericAmount / rate : 0;
}

function getOriginalCurrency(expense) {
  return [BASE_CURRENCY, HOME_CURRENCY].includes(expense.originalCurrency)
    ? expense.originalCurrency
    : BASE_CURRENCY;
}

function getOriginalAmount(expense) {
  return Number(expense.originalAmount) || Number(expense.amount) || 0;
}

function formatExpenseAmountDetail(expense, exchangeRate) {
  const originalCurrency = getOriginalCurrency(expense);
  const originalAmount = getOriginalAmount(expense);

  if (originalCurrency === HOME_CURRENCY) {
    return `Entered ${formatMoney(originalAmount, HOME_CURRENCY)}`;
  }

  return exchangeRate
    ? formatMoney(Number(expense.amount) * exchangeRate, HOME_CURRENCY)
    : `${HOME_CURRENCY} rate unavailable`;
}

function getSettlement(balances) {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0.01)
    .sort((a, b) => b[1] - a[1]);
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -0.01)
    .sort((a, b) => a[1] - b[1]);

  if (!creditors.length || !debtors.length) {
    return { summary: "Even", detail: "No split needed" };
  }

  if (creditors.length === 1 && debtors.length === 1) {
    const [creditor, creditAmount] = creditors[0];
    const [debtor] = debtors[0];
    return {
      summary: `${debtor} owes ${creditor}`,
      detail: formatDisplayMoney(creditAmount),
    };
  }

  if (creditors.length === 1) {
    const [creditor] = creditors[0];
    return {
      summary: `${formatNameList(debtors.map(([name]) => name))} owe ${creditor}`,
      detail: debtors
        .map(([name, amount]) => `${name}: ${formatDisplayMoney(Math.abs(amount))}`)
        .join("; "),
    };
  }

  return {
    summary: "Settle multiple balances",
    detail: creditors
      .map(([name, amount]) => `${name} is owed ${formatDisplayMoney(amount)}`)
      .join("; "),
  };
}

function renderDirectDebts(expenses) {
  const direct = getDirectDebts(expenses);
  const nettedPairs = getNettedDebtPairs(expenses, state.repayments);
  const simplifiedTransfers = TripExpenseLogic.getSimplifiedTransfers(nettedPairs);
  const pairs = nettedPairs
    .slice()
    .sort((a, b) => {
      if (a.settled !== b.settled) return a.settled ? 1 : -1;
      return b.remaining - a.remaining;
    });
  const openPairs = pairs.filter((pair) => !pair.settled);
  const outstanding = openPairs.reduce((sum, pair) => sum + pair.remaining, 0);
  const settled = pairs.reduce((sum, pair) => sum + Math.min(pair.repaid, pair.original), 0);

  els.directDebtCount.textContent = `${openPairs.length} open`;
  els.directDebtTotal.textContent = formatHomeMoneyFromGbp(outstanding);
  els.outstandingTotal.textContent = formatHomeMoneyFromGbp(outstanding);
  els.settledTotal.textContent = formatHomeMoneyFromGbp(settled);
  els.noteAdjustmentTotal.textContent = formatMoney(direct.noteAdjustmentsHome, HOME_CURRENCY);
  els.hasanHusainNet.textContent = getTwoPersonNetLabel(nettedPairs, "Hasan", "Husain");
  renderCardPayoff();

  if (!pairs.length) {
    els.directDebtList.innerHTML = `<div class="empty-state direct-empty">No shared debts yet.</div>`;
    els.simplifiedDebtList.innerHTML = `<div class="empty-state direct-empty">No simplified transfers yet.</div>`;
    renderSettlementView();
    renderRepaymentLog();
    return;
  }

  els.directDebtList.innerHTML = pairs
    .map(
      (pair) => `
        <article class="direct-debt-card">
          <div class="direct-debt-card-heading">
            <div>
              <span>${escapeHtml(pair.debtor)} owes ${escapeHtml(pair.creditor)}</span>
              <strong>${pair.settled ? "Settled" : formatHomeMoney(pair.remainingHome, HOME_CURRENCY)}</strong>
              <small>Original ${formatHomeMoney(pair.originalHome, HOME_CURRENCY)} · Repaid ${formatHomeMoney(pair.repaidHome, HOME_CURRENCY)} · ${pair.items.length} ${pair.items.length === 1 ? "item" : "items"}</small>
            </div>
            <span class="settlement-badge ${pair.settled ? "settled" : ""}">${pair.settled ? "Settled" : "Open"}</span>
          </div>
          <div class="repayment-progress" aria-label="${escapeHtml(pair.debtor)} repayment progress">
            <div style="width:${pair.progress}%"></div>
          </div>
          <div class="direct-debt-items">
            ${pair.items
              .map(
                (item) => `
                  <div class="direct-debt-item">
                    <div>
                      <strong>${escapeHtml(item.merchant)}</strong>
                      <small>${escapeHtml(item.debtor)} owed ${escapeHtml(item.creditor)} · ${escapeHtml(item.reason)}</small>
                    </div>
                    <span>${formatHomeMoney(item.homeAmount, HOME_CURRENCY)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="direct-debt-actions">
            <button class="button secondary" type="button" data-action="record-repayment" data-from="${escapeHtml(pair.debtor)}" data-to="${escapeHtml(pair.creditor)}" data-amount="${pair.remaining}" ${pair.settled ? "disabled" : ""}>
              Record payment
            </button>
          </div>
        </article>
      `,
    )
    .join("");
  els.simplifiedDebtList.innerHTML = simplifiedTransfers.length
    ? simplifiedTransfers
      .map(
        (transfer) => `
          <article class="direct-debt-card simplified-transfer-card">
            <div class="direct-debt-card-heading">
              <div>
                <span>${escapeHtml(transfer.from)} pays ${escapeHtml(transfer.to)}</span>
                <strong>${formatHomeMoneyFromGbp(transfer.amount)}</strong>
                <small>Minimum-transfer settlement after repayments</small>
              </div>
              <span class="settlement-badge">Simplified</span>
            </div>
          </article>
        `,
      )
      .join("")
    : `<div class="empty-state direct-empty">No simplified transfers needed.</div>`;
  renderSettlementView();
  renderRepaymentLog();
}

function renderSettlementView() {
  els.directDebtList.classList.toggle("hidden", state.settlementView !== "itemized");
  els.simplifiedDebtList.classList.toggle("hidden", state.settlementView !== "simplified");
  els.settlementViewToggle.querySelectorAll("button[data-settlement-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settlementView === state.settlementView);
  });
}

function renderCardPayoff() {
  const summary = TripExpenseLogic.getCardPayoffSummary(
    state.expenses,
    state.repayments,
    els.cardPayoffPerson.value,
    getLogicOptions(),
  );
  els.cardCharged.textContent = formatMoney(summary.totalChargedHome, HOME_CURRENCY);
  els.cardOwnShare.textContent = formatMoney(summary.ownShareHome, HOME_CURRENCY);
  els.cardReimbursable.textContent = formatMoney(summary.reimbursableHome, HOME_CURRENCY);
  els.cardRepaid.textContent = formatMoney(summary.repaidHome, HOME_CURRENCY);
  els.cardOutstanding.textContent = formatMoney(summary.outstandingHome, HOME_CURRENCY);
}

function renderRepaymentLog() {
  if (!state.repayments.length) {
    els.repaymentLog.innerHTML = `<div class="empty-state direct-empty">No repayments recorded yet.</div>`;
    return;
  }

  els.repaymentLog.innerHTML = state.repayments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      (repayment) => `
        <div class="repayment-log-row">
          <div>
            <strong>${escapeHtml(repayment.from)} paid ${escapeHtml(repayment.to)}</strong>
            <small>${formatDate(repayment.date)} · ${escapeHtml(repayment.note || "No note")}</small>
          </div>
          <span>${formatMoney(getRepaymentHomeAmount(repayment), HOME_CURRENCY)}</span>
          <button class="link-button button danger" type="button" data-action="delete-repayment" data-id="${escapeHtml(repayment.id)}">Delete</button>
        </div>
      `,
    )
    .join("");
}

function getDirectDebts(expenses) {
  return TripExpenseLogic.getDirectDebts(expenses, getLogicOptions());
}

function getNettedDebtPairs(expenses, repayments) {
  return TripExpenseLogic.getNettedDebtPairs(expenses, repayments, getLogicOptions());
}

function getBalancesFromDebtPairs(pairs) {
  return TripExpenseLogic.getBalancesFromDebtPairs(pairs);
}

function getExactEbrahimShare(expense) {
  return TripExpenseLogic.getExactEbrahimShare(expense, Number(state.settings.exchangeRate)).amount;
}

function getHomeRateForExpense(expense) {
  return TripExpenseLogic.getHomeRateForExpense(expense, Number(state.settings.exchangeRate));
}

function getRepaymentHomeAmount(repayment) {
  const originalAmount = Number(repayment.originalAmount);
  if (repayment.originalCurrency === HOME_CURRENCY && originalAmount) return originalAmount;
  return (Number(repayment.amount) || 0) * Number(state.settings.exchangeRate || 0);
}

function getTwoPersonNetLabel(pairs, first, second) {
  const pair = pairs.find((item) => [item.a, item.b].includes(first) && [item.a, item.b].includes(second));
  if (!pair || pair.settled) return "Even";
  return `${pair.debtor} owes ${formatMoney(pair.remainingHome, HOME_CURRENCY)}`;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
  localStorage.setItem(REPAYMENTS_KEY, JSON.stringify(state.repayments));
}

async function importExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseExpenseCsv(text);
    if (!imported.length) {
      setCloudStatus("No import rows found");
      return;
    }

    state.expenses = normalizeExpenses([...state.expenses, ...imported]);
    persist();
    render();
    saveCloudData();
    setCloudStatus(`Imported ${imported.length} ${imported.length === 1 ? "expense" : "expenses"}`);
  } catch (error) {
    setCloudStatus(error.message || "Import failed");
  } finally {
    els.importExcelFile.value = "";
  }
}

function exportExcel() {
  const exchangeRate = Number(state.settings.exchangeRate);
  const rows = [
    [
      "Date",
      "Merchant",
      "Amount",
      "Currency",
      "GBP Amount",
      "BHD Amount",
      "Paid By",
      "Category",
      "Payment",
      "Exclude From Budget",
      "Do Not Split",
      "Include Ebrahim",
      "Include Mariam",
      "Notes",
    ],
    ...state.expenses
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((expense) => {
        const gbp = Number(expense.amount) || 0;
        return [
          expense.date,
          expense.merchant,
          getOriginalAmount(expense),
          getOriginalCurrency(expense),
          roundMoney(gbp),
          getHomeRateForExpense(expense) ? roundMoney(gbp * getHomeRateForExpense(expense)) : "",
          expense.paidBy || "Hasan",
          expense.category,
          expense.payment,
          expense.excludeFromBudget ? "Yes" : "No",
          expense.excludeFromSplit ? "Yes" : "No",
          expense.includeEbrahim ? "Yes" : "No",
          expense.includeMariam ? "Yes" : "No",
          expense.notes || "",
        ];
      }),
  ];

  downloadCsv(`trip-expenses-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function downloadExcelTemplate() {
  downloadCsv("trip-expense-template.csv", [
    [
      "Date",
      "Merchant",
      "Amount",
      "Currency",
      "Paid By",
      "Category",
      "Payment",
      "Exclude From Budget",
      "Do Not Split",
      "Include Ebrahim",
      "Include Mariam",
      "Notes",
    ],
    [
      "2026-06-22",
      "Example lunch",
      "10.50",
      "GBP",
      "Hasan",
      "Food",
      "Card",
      "No",
      "No",
      "No",
      "No",
      "Optional notes",
    ],
  ]);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(formatCsvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseExpenseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const imported = rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row, index) => buildExpenseFromImportRow(headers, row, index + 2))
    .filter(Boolean);

  return imported;
}

function parseCsvRows(text) {
  return TripExpenseLogic.parseCsvRows(text);
}

function buildExpenseFromImportRow(headers, row, rowNumber) {
  const get = (header) => row[headers.indexOf(normalizeHeader(header))] || "";
  const date = get("Date").trim();
  const merchant = get("Merchant").trim();
  const originalAmount = Number(get("Amount"));
  const originalCurrency = normalizeCurrency(get("Currency"));
  const amount = convertToBaseCurrency(originalAmount, originalCurrency);

  if (!date || !merchant || !originalAmount) return null;
  if (!originalCurrency) throw new Error(`Import row ${rowNumber}: currency must be GBP or BHD`);
  if (!amount) throw new Error(`Import row ${rowNumber}: refresh rate before importing BHD amounts`);

  const category = normalizeOption(get("Category"), categories, "Other");
  const payment = normalizeOption(get("Payment"), payments, "Card");
  const paidBy = normalizeOption(get("Paid By"), people, "Hasan");

  return {
    id: crypto.randomUUID(),
    date,
    merchant,
    amount,
    originalAmount,
    originalCurrency,
    paidBy,
    category,
    payment,
    excludeFromBudget: parseYesNo(get("Exclude From Budget")),
    excludeFromSplit: parseYesNo(get("Do Not Split")),
    includeEbrahim: parseYesNo(get("Include Ebrahim")),
    includeMariam: parseYesNo(get("Include Mariam")),
    notes: get("Notes").trim(),
  };
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCurrency(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return [BASE_CURRENCY, HOME_CURRENCY].includes(normalized) ? normalized : "";
}

function normalizeOption(value, options, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === normalized) || fallback;
}

function parseYesNo(value) {
  return ["yes", "true", "1", "y"].includes(String(value || "").trim().toLowerCase());
}

async function loadCloudData() {
  setCloudStatus("Syncing...");

  try {
    const response = await fetch(CLOUD_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Cloud load failed: ${response.status}`);

    const cloudData = await response.json();
    const hasCloudData =
      (Array.isArray(cloudData.expenses) && cloudData.expenses.length > 0) ||
      (Array.isArray(cloudData.repayments) && cloudData.repayments.length > 0) ||
      cloudData.updatedAt;
    const hasLocalExpenses = state.expenses.length > 0;
    const hasLocalRepayments = state.repayments.length > 0;

    state.cloud.ready = true;

    if (hasCloudData) {
      state.expenses = normalizeExpenses(cloudData.expenses);
      state.repayments = normalizeRepayments(cloudData.repayments);
      state.settings = {
        ...state.settings,
        ...(cloudData.settings || {}),
        cloudUpdatedAt: cloudData.updatedAt || "",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
      localStorage.setItem(REPAYMENTS_KEY, JSON.stringify(state.repayments));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      els.budget.value = state.settings.budget || "";
      render();
      setCloudStatus("Synced");
      return;
    }

    if (hasLocalExpenses || hasLocalRepayments) {
      await saveCloudData();
    } else {
      setCloudStatus("Cloud ready");
    }
  } catch {
    state.cloud.ready = false;
    setCloudStatus("Offline cache");
  }
}

async function saveCloudData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
  localStorage.setItem(REPAYMENTS_KEY, JSON.stringify(state.repayments));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));

  if (!state.cloud.ready || state.cloud.saving) return;

  state.cloud.saving = true;
  setCloudStatus("Saving...");

  try {
    const remoteResponse = await fetch(CLOUD_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (remoteResponse.ok) {
      const remoteData = await remoteResponse.json();
      const remoteUpdatedAt = remoteData.updatedAt || "";
      if (remoteUpdatedAt && state.settings.cloudUpdatedAt && remoteUpdatedAt !== state.settings.cloudUpdatedAt) {
        state.expenses = mergeById(normalizeExpenses(remoteData.expenses), state.expenses);
        state.repayments = mergeById(normalizeRepayments(remoteData.repayments), state.repayments);
        setCloudStatus("Merged cloud changes");
      }
    }

    const response = await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        expenses: state.expenses,
        repayments: state.repayments,
        settings: state.settings,
      }),
    });
    if (!response.ok) throw new Error(`Cloud save failed: ${response.status}`);

    const cloudData = await response.json();
    state.settings.cloudUpdatedAt = cloudData.updatedAt || new Date().toISOString();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    setCloudStatus("Saved to cloud");
  } catch {
    state.cloud.ready = false;
    setCloudStatus("Saved locally");
  } finally {
    state.cloud.saving = false;
  }
}

function mergeById(remoteItems, localItems) {
  const merged = new Map();
  remoteItems.forEach((item) => merged.set(item.id, item));
  localItems.forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

function setCloudStatus(message) {
  els.cloudStatus.textContent = message;
}

function normalizeExpenses(expenses) {
  return (Array.isArray(expenses) ? expenses : []).map((expense) => {
    const originalCurrency = [BASE_CURRENCY, HOME_CURRENCY].includes(expense.originalCurrency)
      ? expense.originalCurrency
      : BASE_CURRENCY;
    const amount = Number(expense.amount) || 0;
    return {
      ...expense,
      amount,
      originalAmount: Number(expense.originalAmount) || amount,
      originalCurrency,
      paidBy: people.includes(expense.paidBy) ? expense.paidBy : "Hasan",
      excludeFromBudget: Boolean(expense.excludeFromBudget),
      excludeFromSplit: Boolean(expense.excludeFromSplit),
      includeEbrahim: Boolean(expense.includeEbrahim),
      includeMariam: Boolean(expense.includeMariam),
    };
  });
}

function normalizeRepayments(repayments) {
  return (Array.isArray(repayments) ? repayments : []).map((repayment) => {
    const originalCurrency = [BASE_CURRENCY, HOME_CURRENCY].includes(repayment.originalCurrency)
      ? repayment.originalCurrency
      : BASE_CURRENCY;
    const amount = Number(repayment.amount) || 0;
    return {
      ...repayment,
      id: repayment.id || crypto.randomUUID(),
      date: repayment.date || new Date().toISOString().slice(0, 10),
      from: splitPeople.includes(repayment.from) ? repayment.from : "Hasan",
      to: splitPeople.includes(repayment.to) ? repayment.to : "Husain",
      amount,
      originalAmount: Number(repayment.originalAmount) || amount,
      originalCurrency,
      note: repayment.note || "",
    };
  });
}

function renderRateStatus(hadError) {
  const rate = Number(state.settings.exchangeRate);
  if (!rate) {
    setRateStatus(hadError ? "Could not load the GBP to BHD rate." : "GBP to BHD rate loading...");
    return;
  }

  const dateLabel = state.settings.exchangeRateDate
    ? ` for ${formatDate(state.settings.exchangeRateDate)}`
    : "";
  const staleLabel = hadError ? " Last saved rate shown." : "";
  setRateStatus(`1 GBP = ${formatMoney(rate, HOME_CURRENCY)}${dateLabel}.${staleLabel}`);
}

function setRateStatus(message) {
  els.rateStatus.textContent = message;
}

function hasSavedRate() {
  return Boolean(Number(state.settings.exchangeRate));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function getDisplayCurrency() {
  return BASE_CURRENCY;
}

function formatDisplayMoney(gbpAmount) {
  return formatMoney(gbpAmount, BASE_CURRENCY);
}

function formatAlternateMoney(gbpAmount) {
  const rate = Number(state.settings.exchangeRate);
  return rate
    ? `${HOME_CURRENCY}: ${formatMoney(Number(gbpAmount) * rate, HOME_CURRENCY)}`
    : `${HOME_CURRENCY} rate unavailable`;
}

function formatHomeMoneyFromGbp(gbpAmount) {
  const rate = Number(state.settings.exchangeRate);
  return rate ? formatMoney(Number(gbpAmount) * rate, HOME_CURRENCY) : formatDisplayMoney(gbpAmount);
}

function formatBalance(gbpAmount) {
  if (Math.abs(gbpAmount) < 0.01) return "Even";
  const label = gbpAmount > 0 ? "is owed" : "owes";
  return `${label} ${formatDisplayMoney(Math.abs(gbpAmount))}`;
}

function formatNameList(names) {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}
