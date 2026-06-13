const STORAGE_KEY = "ukTripExpenses.v1";
const SETTINGS_KEY = "ukTripSettings.v1";
const CLOUD_API_URL = "/.netlify/functions/trip-data";
const HOME_CURRENCY = "BHD";
const BASE_CURRENCY = "GBP";
const RATE_API_URL = "https://api.frankfurter.dev/v2/rate/GBP/BHD";

const categories = [
  "Food",
  "Transport",
  "Hotel",
  "Shopping",
  "Attractions",
  "Groceries",
  "Other",
];

const payments = ["Card", "Cash", "Apple Pay", "Bank transfer"];
const people = ["Hasan", "Husain"];

const categoryHints = [
  { category: "Transport", words: ["tfl", "tube", "uber", "train", "rail", "bus", "taxi", "gatwick", "heathrow"] },
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
    displayCurrency: BASE_CURRENCY,
    cloudUpdatedAt: "",
  }),
  filters: { query: "", category: "All", payment: "All", payer: "All" },
  cloud: { ready: false, saving: false },
};

if (![BASE_CURRENCY, HOME_CURRENCY].includes(state.settings.displayCurrency)) {
  state.settings.displayCurrency = BASE_CURRENCY;
}

state.expenses = state.expenses.map((expense) => ({
  ...expense,
  paidBy: people.includes(expense.paidBy) ? expense.paidBy : "Hasan",
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
  notes: document.querySelector("#notes"),
  budget: document.querySelector("#budget"),
  refreshRate: document.querySelector("#refreshRate"),
  rateStatus: document.querySelector("#rateStatus"),
  cloudStatus: document.querySelector("#cloudStatus"),
  currencyToggle: document.querySelector("#currencyToggle"),
  totalSpend: document.querySelector("#totalSpend"),
  homeSpend: document.querySelector("#homeSpend"),
  hasanPaid: document.querySelector("#hasanPaid"),
  hasanShare: document.querySelector("#hasanShare"),
  husainPaid: document.querySelector("#husainPaid"),
  husainShare: document.querySelector("#husainShare"),
  settlementSummary: document.querySelector("#settlementSummary"),
  settlementDetail: document.querySelector("#settlementDetail"),
  fairShareLabel: document.querySelector("#fairShareLabel"),
  hasanBalance: document.querySelector("#hasanBalance"),
  husainBalance: document.querySelector("#husainBalance"),
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
  exportCsv: document.querySelector("#exportCsv"),
  seedDemo: document.querySelector("#seedDemo"),
};

init();

function init() {
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
  els.openExpenseModal.addEventListener("click", () => openExpenseModal());
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
  els.budget.addEventListener("input", saveSettings);
  els.refreshRate.addEventListener("click", () => refreshExchangeRate({ silent: false }));
  els.currencyToggle.addEventListener("click", toggleDisplayCurrency);
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
  els.exportCsv.addEventListener("click", exportCsv);
  els.seedDemo.addEventListener("click", loadSampleExpenses);
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
  if (match) els.category.value = match.category;
}

function saveSettings() {
  state.settings = {
    budget: els.budget.value,
    exchangeRate: state.settings.exchangeRate,
    exchangeRateDate: state.settings.exchangeRateDate,
    exchangeRateFetchedAt: state.settings.exchangeRateFetchedAt,
    displayCurrency: state.settings.displayCurrency,
    cloudUpdatedAt: state.settings.cloudUpdatedAt,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  render();
  saveCloudData();
}

function toggleDisplayCurrency() {
  const nextCurrency =
    state.settings.displayCurrency === HOME_CURRENCY ? BASE_CURRENCY : HOME_CURRENCY;
  state.settings.displayCurrency = nextCurrency;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  saveCloudData();

  if (nextCurrency === HOME_CURRENCY && !hasSavedRate()) {
    refreshExchangeRate({ silent: false });
    return;
  }

  render();
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
  const hasanPaid = totals.byPayer.Hasan || 0;
  const husainPaid = totals.byPayer.Husain || 0;
  const hasanPercent = totals.totalGbp ? Math.round((hasanPaid / totals.totalGbp) * 100) : 0;
  const husainPercent = totals.totalGbp ? Math.round((husainPaid / totals.totalGbp) * 100) : 0;
  const settlement = getSettlement(totals.totalGbp, hasanPaid, husainPaid);
  const fairShare = totals.totalGbp / people.length;
  const hasanBalance = hasanPaid - fairShare;
  const husainBalance = husainPaid - fairShare;

  els.totalSpend.textContent = formatDisplayMoney(totals.totalGbp);
  els.homeSpend.textContent = formatAlternateMoney(totals.totalGbp);
  els.hasanPaid.textContent = formatDisplayMoney(hasanPaid);
  els.hasanShare.textContent = `${hasanPercent}% of spending`;
  els.husainPaid.textContent = formatDisplayMoney(husainPaid);
  els.husainShare.textContent = `${husainPercent}% of spending`;
  els.settlementSummary.textContent = settlement.summary;
  els.settlementDetail.textContent = settlement.detail;
  els.fairShareLabel.textContent = totals.totalGbp ? formatDisplayMoney(fairShare) : "Each share";
  els.hasanBalance.textContent = formatBalance(hasanBalance);
  els.husainBalance.textContent = formatBalance(husainBalance);
  els.currencyToggle.textContent =
    getDisplayCurrency() === HOME_CURRENCY ? `View in ${BASE_CURRENCY}` : `View in ${HOME_CURRENCY}`;
  els.currencyToggle.classList.toggle("active", getDisplayCurrency() === HOME_CURRENCY);
  els.amountHeader.textContent = `${getDisplayCurrency()} amount`;

  if (budget > 0) {
    const used = (totals.totalGbp / budget) * 100;
    const remaining = budget - totals.totalGbp;
    els.budgetProgress.style.width = `${Math.min(used, 100)}%`;
    els.budgetText.textContent =
      remaining >= 0
        ? `${formatDisplayMoney(totals.totalGbp)} of ${formatDisplayMoney(budget)} used. ${formatDisplayMoney(remaining)} remaining.`
        : `${formatDisplayMoney(totals.totalGbp)} of ${formatDisplayMoney(budget)} used. ${formatDisplayMoney(Math.abs(remaining))} over budget.`;
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
  const displayCurrency = getDisplayCurrency();

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
            ${
              displayCurrency === HOME_CURRENCY
                ? `<br><small>${formatMoney(expense.amount, BASE_CURRENCY)}</small>`
                : exchangeRate
                  ? `<br><small>${formatMoney(Number(expense.amount) * exchangeRate, HOME_CURRENCY)}</small>`
                  : ""
            }
            ${
              displayCurrency === HOME_CURRENCY && !exchangeRate
                ? `<br><small>${HOME_CURRENCY} rate unavailable</small>`
                : ""
            }
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
  els.editingBadge.classList.add("hidden");
}

function openExpenseModal() {
  document.body.classList.add("expense-modal-open");
  window.requestAnimationFrame(() => els.merchant.focus());
}

function closeExpenseModal() {
  document.body.classList.remove("expense-modal-open");
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
      summary.byCategory[expense.category] = (summary.byCategory[expense.category] || 0) + gbp;
      summary.byPayer[paidBy] = (summary.byPayer[paidBy] || 0) + gbp;
      return summary;
    },
    { totalGbp: 0, byCategory: {}, byPayer: { Hasan: 0, Husain: 0 } },
  );
}

function getSettlement(totalGbp, hasanPaid, husainPaid) {
  if (!totalGbp) {
    return { summary: "Even", detail: "No split needed" };
  }

  const fairShare = totalGbp / people.length;
  const hasanBalance = hasanPaid - fairShare;

  if (Math.abs(hasanBalance) < 0.01) {
    return { summary: "Even", detail: "Both have paid their share" };
  }

  if (hasanBalance > 0) {
    return {
      summary: "Husain owes Hasan",
      detail: formatDisplayMoney(hasanBalance),
    };
  }

  return {
    summary: "Hasan owes Husain",
    detail: formatDisplayMoney(Math.abs(husainPaid - fairShare)),
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
      if (![BASE_CURRENCY, HOME_CURRENCY].includes(state.settings.displayCurrency)) {
        state.settings.displayCurrency = BASE_CURRENCY;
      }
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
  const rate = Number(state.settings.exchangeRate);
  if (state.settings.displayCurrency === HOME_CURRENCY && rate) return HOME_CURRENCY;
  return BASE_CURRENCY;
}

function formatDisplayMoney(gbpAmount) {
  const rate = Number(state.settings.exchangeRate);
  if (state.settings.displayCurrency === HOME_CURRENCY && rate) {
    return formatMoney(Number(gbpAmount) * rate, HOME_CURRENCY);
  }

  return formatMoney(gbpAmount, BASE_CURRENCY);
}

function formatAlternateMoney(gbpAmount) {
  const rate = Number(state.settings.exchangeRate);
  if (getDisplayCurrency() === HOME_CURRENCY) {
    return `Original: ${formatMoney(gbpAmount, BASE_CURRENCY)}`;
  }

  return rate
    ? `${HOME_CURRENCY}: ${formatMoney(Number(gbpAmount) * rate, HOME_CURRENCY)}`
    : `${HOME_CURRENCY} rate unavailable`;
}

function formatBalance(gbpAmount) {
  if (Math.abs(gbpAmount) < 0.01) return "Even";
  const label = gbpAmount > 0 ? "is owed" : "owes";
  return `${label} ${formatDisplayMoney(Math.abs(gbpAmount))}`;
}

function formatNumber(amount) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
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

function exportCsv() {
  const exchangeRate = Number(state.settings.exchangeRate);
  const headers = [
    "Date",
    "Merchant",
    "GBP Amount",
    "BHD Amount",
    "GBP to BHD Rate",
    "Paid By",
    "Category",
    "Payment",
    "Notes",
  ];
  const rows = state.expenses.map((expense) => [
    expense.date,
    expense.merchant,
    expense.amount,
    exchangeRate ? (Number(expense.amount) * exchangeRate).toFixed(3) : "",
    exchangeRate || "",
    expense.paidBy || "Hasan",
    expense.category,
    expense.payment,
    expense.notes || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "uk-trip-expenses.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadSampleExpenses() {
  state.expenses = [
    {
      id: crypto.randomUUID(),
      date: todayMinus(4),
      merchant: "Heathrow Express",
      amount: 25,
      paidBy: "Hasan",
      category: "Transport",
      payment: "Card",
      notes: "Airport transfer",
    },
    {
      id: crypto.randomUUID(),
      date: todayMinus(3),
      merchant: "Pret a Manger",
      amount: 11.85,
      paidBy: "Husain",
      category: "Food",
      payment: "Apple Pay",
      notes: "Breakfast",
    },
    {
      id: crypto.randomUUID(),
      date: todayMinus(2),
      merchant: "Tower of London",
      amount: 34.8,
      paidBy: "Hasan",
      category: "Attractions",
      payment: "Card",
      notes: "Entry ticket",
    },
    {
      id: crypto.randomUUID(),
      date: todayMinus(1),
      merchant: "Tesco Express",
      amount: 18.4,
      paidBy: "Husain",
      category: "Groceries",
      payment: "Card",
      notes: "Snacks and water",
    },
  ];
  persist();
  render();
  saveCloudData();
}

function todayMinus(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
