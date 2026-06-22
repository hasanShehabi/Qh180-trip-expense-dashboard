const STORAGE_KEY = "ukTripExpenses.v1";
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
  filters: { query: "", category: "All", payment: "All", payer: "All" },
  cloud: { ready: false, saving: false },
};

state.expenses = state.expenses.map((expense) => ({
  ...expense,
  paidBy: people.includes(expense.paidBy) ? expense.paidBy : "Hasan",
  excludeFromBudget: Boolean(expense.excludeFromBudget),
  excludeFromSplit: Boolean(expense.excludeFromSplit),
  includeEbrahim: Boolean(expense.includeEbrahim),
  includeMariam: Boolean(expense.includeMariam),
}));

const els = {
  form: document.querySelector("#expenseForm"),
  editingId: document.querySelector("#editingId"),
  editingBadge: document.querySelector("#editingBadge"),
  date: document.querySelector("#date"),
  merchant: document.querySelector("#merchant"),
  amount: document.querySelector("#amount"),
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
  categoryFilter: document.querySelector("#categoryFilter"),
  paymentFilter: document.querySelector("#paymentFilter"),
  payerTabs: document.querySelector(".payer-tabs"),
  search: document.querySelector("#search"),
  cancelEdit: document.querySelector("#cancelEdit"),
  openExpenseModal: document.querySelector("#openExpenseModal"),
  closeExpenseModal: document.querySelector("#closeExpenseModal"),
  expenseModalBackdrop: document.querySelector("#expenseModalBackdrop"),
};

init();

function init() {
  applyTheme(getSavedTheme());
  els.date.valueAsDate = new Date();
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

  const expense = {
    id: els.editingId.value || crypto.randomUUID(),
    date: els.date.value,
    merchant: els.merchant.value.trim(),
    amount: Number(els.amount.value),
    paidBy: els.paidBy.value,
    category: els.category.value,
    payment: els.payment.value,
    excludeFromBudget: els.excludeFromBudget.checked,
    excludeFromSplit: els.excludeFromSplit.checked,
    includeEbrahim: els.includeEbrahim.checked,
    includeMariam: els.includeMariam.checked,
    notes: els.notes.value.trim(),
  };

  if (!expense.merchant || !expense.date || !expense.amount) return;

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
  renderMetrics(totals);
  renderPayerTabs();
  renderCategoryChart(filteredTotals.byCategory, filteredTotals.totalGbp);
  renderRows(filtered);
}

function renderMetrics(totals) {
  const budget = Number(state.settings.budget);
  const exchangeRate = Number(state.settings.exchangeRate);
  const budgetSpend = totals.budgetGbp;
  const excludedSpend = totals.excludedGbp;
  const hasanPaid = totals.byPayer.Hasan || 0;
  const husainPaid = totals.byPayer.Husain || 0;
  const mariamPaid = totals.byPayer.Mariam || 0;
  const hasanPercent = totals.totalGbp ? Math.round((hasanPaid / totals.totalGbp) * 100) : 0;
  const husainPercent = totals.totalGbp ? Math.round((husainPaid / totals.totalGbp) * 100) : 0;
  const mariamPercent = totals.totalGbp ? Math.round((mariamPaid / totals.totalGbp) * 100) : 0;
  const settlement = getSettlement(totals.balances);

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
  els.hasanBalance.textContent = formatBalance(totals.balances.Hasan || 0);
  els.husainBalance.textContent = formatBalance(totals.balances.Husain || 0);
  els.ebrahimBalance.textContent = formatBalance(totals.balances.Ebrahim || 0);
  els.mariamBalance.textContent = formatBalance(totals.balances.Mariam || 0);
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
            ${exchangeRate ? `<br><small>${formatMoney(Number(expense.amount) * exchangeRate, HOME_CURRENCY)}</small>` : ""}
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
    state.expenses = state.expenses.filter((item) => item.id !== expense.id);
    persist();
    render();
    saveCloudData();
    return;
  }

  els.editingId.value = expense.id;
  els.date.value = expense.date;
  els.merchant.value = expense.merchant;
  els.amount.value = expense.amount;
  els.paidBy.value = people.includes(expense.paidBy) ? expense.paidBy : "Hasan";
  els.category.value = expense.category;
  els.payment.value = expense.payment;
  els.excludeFromBudget.checked = Boolean(expense.excludeFromBudget);
  els.excludeFromSplit.checked = Boolean(expense.excludeFromSplit);
  els.includeEbrahim.checked = Boolean(expense.includeEbrahim);
  els.includeMariam.checked = Boolean(expense.includeMariam);
  els.notes.value = expense.notes || "";
  els.editingBadge.classList.remove("hidden");
  openExpenseModal();
  els.merchant.focus();
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.date.valueAsDate = new Date();
  els.paidBy.value = "Hasan";
  els.category.value = "Food";
  els.payment.value = "Card";
  els.excludeFromBudget.checked = false;
  els.excludeFromSplit.checked = false;
  els.includeEbrahim.checked = false;
  els.includeMariam.checked = false;
  els.editingBadge.classList.add("hidden");
}

function syncBudgetExclusion() {
  if (els.editingId.value) return;
  els.excludeFromBudget.checked = ["Flight", "Hotel"].includes(els.category.value);
}

function openExpenseModal() {
  document.body.classList.add("expense-modal-open");
  window.requestAnimationFrame(() => els.merchant.focus());
}

function closeExpenseModal() {
  document.body.classList.remove("expense-modal-open");
}

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEME_ORDER.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

function applyTheme(theme) {
  const next = THEME_ORDER.includes(theme) ? theme : "auto";
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
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "auto" && prefersDark);
  meta.setAttribute("content", isDark ? "#111827" : "#eef3f8");
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
  return expenses.reduce(
    (summary, expense) => {
      const gbp = Number(expense.amount) || 0;
      const paidBy = people.includes(expense.paidBy) ? expense.paidBy : "Hasan";
      summary.totalGbp += gbp;
      if (expense.excludeFromBudget) {
        summary.excludedGbp += gbp;
      } else {
        summary.budgetGbp += gbp;
      }
      summary.byCategory[expense.category] = (summary.byCategory[expense.category] || 0) + gbp;
      summary.byPayer[paidBy] = (summary.byPayer[paidBy] || 0) + gbp;
      if (!expense.excludeFromSplit) {
        const participants = getSplitParticipants(expense);
        const share = participants.length ? gbp / participants.length : 0;
        summary.splitGbp += gbp;
        summary.byPayerSplit[paidBy] = (summary.byPayerSplit[paidBy] || 0) + gbp;
        summary.balances[paidBy] = (summary.balances[paidBy] || 0) + gbp;
        participants.forEach((person) => {
          summary.balances[person] = (summary.balances[person] || 0) - share;
        });
      }
      return summary;
    },
    {
      totalGbp: 0,
      budgetGbp: 0,
      excludedGbp: 0,
      splitGbp: 0,
      byCategory: {},
      byPayer: { Hasan: 0, Husain: 0, Mariam: 0 },
      byPayerSplit: { Hasan: 0, Husain: 0, Mariam: 0 },
      balances: { Hasan: 0, Husain: 0, Ebrahim: 0, Mariam: 0 },
    },
  );
}

function getSplitParticipants(expense) {
  const participants = [...baseSplitPeople];
  if (expense.includeEbrahim) participants.push("Ebrahim");
  if (expense.includeMariam) participants.push("Mariam");
  return participants;
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

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
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
      (Array.isArray(cloudData.expenses) && cloudData.expenses.length > 0) || cloudData.updatedAt;
    const hasLocalExpenses = state.expenses.length > 0;

    state.cloud.ready = true;

    if (hasCloudData) {
      state.expenses = normalizeExpenses(cloudData.expenses);
      state.settings = {
        ...state.settings,
        ...(cloudData.settings || {}),
        cloudUpdatedAt: cloudData.updatedAt || "",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      els.budget.value = state.settings.budget || "";
      render();
      setCloudStatus("Synced");
      return;
    }

    if (hasLocalExpenses) {
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));

  if (!state.cloud.ready || state.cloud.saving) return;

  state.cloud.saving = true;
  setCloudStatus("Saving...");

  try {
    const response = await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        expenses: state.expenses,
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

function setCloudStatus(message) {
  els.cloudStatus.textContent = message;
}

function normalizeExpenses(expenses) {
  return (Array.isArray(expenses) ? expenses : []).map((expense) => ({
    ...expense,
    paidBy: people.includes(expense.paidBy) ? expense.paidBy : "Hasan",
    excludeFromBudget: Boolean(expense.excludeFromBudget),
    excludeFromSplit: Boolean(expense.excludeFromSplit),
    includeEbrahim: Boolean(expense.includeEbrahim),
    includeMariam: Boolean(expense.includeMariam),
  }));
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
