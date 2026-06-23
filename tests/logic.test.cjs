const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { module: { exports: {} } };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "..", "logic.js"), "utf8"),
  sandbox,
);
const Logic = sandbox.module.exports;

function round(value) {
  return Math.round(value * 100) / 100;
}

function expense(overrides) {
  return {
    id: crypto.randomUUID(),
    date: "2026-06-24",
    merchant: "Test",
    amount: 100,
    originalAmount: 100,
    originalCurrency: "GBP",
    paidBy: "Hasan",
    category: "Food",
    payment: "Card",
    excludeFromSplit: false,
    includeEbrahim: false,
    includeMariam: false,
    notes: "",
    ...overrides,
  };
}

{
  const rows = [
    expense({ id: "a", amount: 90, originalAmount: 90, includeEbrahim: true }),
  ];
  const direct = Logic.getDirectDebts(rows, { exchangeRate: 0.5 });
  assert.equal(round(direct.pairs["Husain->Hasan"].amount), 30);
  assert.equal(round(direct.pairs["Ebrahim->Hasan"].amount), 30);
}

{
  const rows = [expense({ id: "a", amount: 100 })];
  const partial = Logic.getNettedDebtPairs(rows, [{ from: "Husain", to: "Hasan", amount: 25 }], { exchangeRate: 0.5 })[0];
  assert.equal(partial.debtor, "Husain");
  assert.equal(partial.creditor, "Hasan");
  assert.equal(round(partial.remaining), 25);

  const full = Logic.getNettedDebtPairs(rows, [{ from: "Husain", to: "Hasan", amount: 50 }], { exchangeRate: 0.5 })[0];
  assert.equal(full.settled, true);

  const overpaid = Logic.getNettedDebtPairs(rows, [{ from: "Husain", to: "Hasan", amount: 60 }], { exchangeRate: 0.5 })[0];
  assert.equal(overpaid.debtor, "Hasan");
  assert.equal(overpaid.creditor, "Husain");
  assert.equal(round(overpaid.remaining), 10);
}

{
  const bhdExpense = expense({
    id: "bhd",
    amount: 60,
    originalAmount: 30,
    originalCurrency: "BHD",
  });
  const pair = Logic.getNettedDebtPairs([bhdExpense], [], { exchangeRate: 0.7 })[0];
  assert.equal(round(pair.originalHome), 15);
  assert.equal(round(pair.remainingHome), 15);
}

{
  const noteExpense = expense({
    id: "note",
    amount: 100,
    originalAmount: 50,
    originalCurrency: "BHD",
    includeEbrahim: true,
    notes: "Ebrahim: 12.5 BHD",
  });
  const direct = Logic.getDirectDebts([noteExpense], { exchangeRate: 0.7 });
  assert.equal(round(direct.pairs["Ebrahim->Hasan"].homeAmount), 12.5);
  assert.equal(direct.pairs["Ebrahim->Hasan"].items[0].date, "2026-06-24");
  assert.equal(direct.pairs["Ebrahim->Hasan"].items[0].notes, "Ebrahim: 12.5 BHD");
  assert.equal(direct.pairs["Ebrahim->Hasan"].items[0].reason, "Note exact amount for Ebrahim");
}

{
  const bermExpense = expense({
    id: "berm",
    date: "2026-06-21",
    merchant: "ibo cafe",
    amount: 21.42,
    originalAmount: 10.66,
    originalCurrency: "BHD",
    includeEbrahim: false,
    notes: "Berm: 2.5 BHD to pay for his coffee",
  });
  const direct = Logic.getDirectDebts([bermExpense], { exchangeRate: 0.5 });
  assert.equal(round(direct.pairs["Ebrahim->Hasan"].homeAmount), 2.5);
  assert.equal(round(direct.pairs["Husain->Hasan"].homeAmount), 4.08);
}

{
  const cardExpense = expense({
    id: "card",
    amount: 100,
    originalAmount: 50,
    originalCurrency: "BHD",
  });
  const summary = Logic.getCardPayoffSummary(
    [cardExpense],
    [{ from: "Husain", to: "Hasan", amount: 20, originalAmount: 10, originalCurrency: "BHD" }],
    "Hasan",
    { exchangeRate: 0.7 },
  );
  assert.equal(round(summary.totalChargedHome), 50);
  assert.equal(round(summary.reimbursableHome), 25);
  assert.equal(round(summary.repaidHome), 10);
  assert.equal(round(summary.outstandingHome), 15);
}

{
  const rows = Logic.parseCsvRows("Date,Merchant,Amount\n2026-06-24,\"Coffee, tea\",4.5\n");
  assert.equal(JSON.stringify(rows), JSON.stringify([
    ["Date", "Merchant", "Amount"],
    ["2026-06-24", "Coffee, tea", "4.5"],
  ]));
}

console.log("logic tests ok");
