(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TripExpenseLogic = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const BASE_CURRENCY = "GBP";
  const HOME_CURRENCY = "BHD";
  const baseSplitPeople = ["Hasan", "Husain"];
  const splitPeople = ["Hasan", "Husain", "Ebrahim", "Mariam"];
  const payingPeople = ["Hasan", "Husain", "Mariam"];

  function getTotals(expenses) {
    return expenses.reduce(
      (summary, expense) => {
        const gbp = Number(expense.amount) || 0;
        const paidBy = payingPeople.includes(expense.paidBy) ? expense.paidBy : "Hasan";
        summary.totalGbp += gbp;
        if (expense.excludeFromBudget) {
          summary.excludedGbp += gbp;
        } else {
          summary.budgetGbp += gbp;
        }
        summary.byCategory[expense.category] = (summary.byCategory[expense.category] || 0) + gbp;
        summary.byPayer[paidBy] = (summary.byPayer[paidBy] || 0) + gbp;
        summary.byPayment[expense.payment] = (summary.byPayment[expense.payment] || 0) + gbp;
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
        byPayment: {},
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

  function getDirectDebts(expenses, options = {}) {
    const pairs = {};
    let totalOwed = 0;
    let totalOwedHome = 0;
    let noteAdjustments = 0;
    let noteAdjustmentsHome = 0;

    const addDebt = (debtor, creditor, amount, expense, reason, homeRate) => {
      if (debtor === creditor || amount <= 0) return;
      const homeAmount = amount * homeRate;
      const key = `${debtor}->${creditor}`;
      if (!pairs[key]) {
        pairs[key] = { debtor, creditor, amount: 0, homeAmount: 0, items: [] };
      }
      pairs[key].amount += amount;
      pairs[key].homeAmount += homeAmount;
      pairs[key].items.push({
        expenseId: expense.id,
        merchant: expense.merchant,
        payment: expense.payment,
        amount,
        homeAmount,
        homeRate,
        reason,
      });
      totalOwed += amount;
      totalOwedHome += homeAmount;
    };

    expenses.forEach((expense) => {
      const amount = Number(expense.amount) || 0;
      const paidBy = payingPeople.includes(expense.paidBy) ? expense.paidBy : "Hasan";
      const homeRate = getHomeRateForExpense(expense, options.exchangeRate);
      if (!amount || expense.excludeFromSplit) return;

      const exactEbrahimShare = getExactEbrahimShare(expense, options.exchangeRate);
      if (exactEbrahimShare.amount > 0 && exactEbrahimShare.amount < amount) {
        const remainingParticipants = getSplitParticipants(expense).filter((person) => person !== "Ebrahim");
        const remainingAmount = amount - exactEbrahimShare.amount;
        const remainingShare = remainingParticipants.length ? remainingAmount / remainingParticipants.length : 0;
        noteAdjustments += exactEbrahimShare.amount;
        noteAdjustmentsHome += exactEbrahimShare.homeAmount;
        addDebt(
          "Ebrahim",
          paidBy,
          exactEbrahimShare.amount,
          expense,
          "Note exact amount for Ebrahim",
          exactEbrahimShare.homeRate,
        );
        remainingParticipants.forEach((person) => {
          addDebt(person, paidBy, remainingShare, expense, "Remaining after Ebrahim note split", homeRate);
        });
        return;
      }

      const participants = getSplitParticipants(expense);
      const share = participants.length ? amount / participants.length : 0;
      participants.forEach((person) => {
        addDebt(person, paidBy, share, expense, `Split ${participants.length} ways`, homeRate);
      });
    });

    return { pairs, totalOwed, totalOwedHome, noteAdjustments, noteAdjustmentsHome };
  }

  function getNettedDebtPairs(expenses, repayments, options = {}) {
    const gross = getDirectDebts(expenses, options);
    const pairMap = {};

    const ensurePair = (first, second) => {
      const [a, b] = [first, second].sort();
      const key = `${a}->${b}`;
      if (!pairMap[key]) {
        pairMap[key] = {
          key,
          a,
          b,
          signed: 0,
          signedHome: 0,
          original: 0,
          originalHome: 0,
          repaid: 0,
          repaidHome: 0,
          items: [],
        };
      }
      return pairMap[key];
    };

    const addSigned = (from, to, amount, homeAmount) => {
      const pair = ensurePair(from, to);
      const direction = pair.a === from ? 1 : -1;
      pair.signed += direction * amount;
      pair.signedHome += direction * homeAmount;
      return pair;
    };

    Object.values(gross.pairs).forEach((debt) => {
      const pair = addSigned(debt.debtor, debt.creditor, debt.amount, debt.homeAmount);
      pair.original += debt.amount;
      pair.originalHome += debt.homeAmount;
      pair.items.push(...debt.items.map((item) => ({ ...item, debtor: debt.debtor, creditor: debt.creditor })));
    });

    repayments.forEach((repayment) => {
      const amount = Number(repayment.amount) || 0;
      if (!amount || repayment.from === repayment.to) return;
      const homeRate = getHomeRateForRepayment(repayment, options.exchangeRate);
      const homeAmount = amount * homeRate;
      const pair = addSigned(repayment.from, repayment.to, -amount, -homeAmount);
      pair.repaid += amount;
      pair.repaidHome += homeAmount;
    });

    return Object.values(pairMap).map((pair) => {
      const remaining = Math.abs(pair.signed);
      const remainingHome = Math.abs(pair.signedHome);
      const debtor = pair.signed >= 0 ? pair.a : pair.b;
      const creditor = pair.signed >= 0 ? pair.b : pair.a;
      const settled = remaining < 0.01;
      const progress = pair.original ? Math.min((pair.repaid / pair.original) * 100, 100) : 100;
      return {
        ...pair,
        debtor,
        creditor,
        remaining: settled ? 0 : remaining,
        remainingHome: settled ? 0 : remainingHome,
        settled,
        progress,
      };
    });
  }

  function getBalancesFromDebtPairs(pairs) {
    return pairs.reduce(
      (balances, pair) => {
        if (!pair.settled) {
          balances[pair.debtor] = (balances[pair.debtor] || 0) - pair.remaining;
          balances[pair.creditor] = (balances[pair.creditor] || 0) + pair.remaining;
        }
        return balances;
      },
      { Hasan: 0, Husain: 0, Ebrahim: 0, Mariam: 0 },
    );
  }

  function getSimplifiedTransfers(pairs) {
    const balances = getBalancesFromDebtPairs(pairs);
    const creditors = Object.entries(balances)
      .filter(([, amount]) => amount > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }));
    const debtors = Object.entries(balances)
      .filter(([, amount]) => amount < -0.01)
      .sort((a, b) => a[1] - b[1])
      .map(([name, amount]) => ({ name, amount: Math.abs(amount) }));
    const transfers = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.amount, creditor.amount);
      transfers.push({ from: debtor.name, to: creditor.name, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount < 0.01) debtorIndex += 1;
      if (creditor.amount < 0.01) creditorIndex += 1;
    }

    return transfers;
  }

  function getCardPayoffSummary(expenses, repayments, person, options = {}) {
    const direct = getDirectDebts(expenses, options);
    const cardExpenses = expenses.filter((expense) => expense.paidBy === person && expense.payment === "Card");
    const cardIds = new Set(cardExpenses.map((expense) => expense.id));
    const totalCharged = cardExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const totalChargedHome = cardExpenses.reduce(
      (sum, expense) => sum + (Number(expense.amount) || 0) * getHomeRateForExpense(expense, options.exchangeRate),
      0,
    );
    const reimbursable = Object.values(direct.pairs)
      .filter((pair) => pair.creditor === person)
      .reduce((sum, pair) => sum + pair.items
        .filter((item) => cardIds.has(item.expenseId))
        .reduce((itemSum, item) => itemSum + item.amount, 0), 0);
    const reimbursableHome = Object.values(direct.pairs)
      .filter((pair) => pair.creditor === person)
      .reduce((sum, pair) => sum + pair.items
        .filter((item) => cardIds.has(item.expenseId))
        .reduce((itemSum, item) => itemSum + item.homeAmount, 0), 0);
    const repaid = repayments
      .filter((repayment) => repayment.to === person)
      .reduce((sum, repayment) => sum + (Number(repayment.amount) || 0), 0);
    const repaidHome = repayments
      .filter((repayment) => repayment.to === person)
      .reduce((sum, repayment) => sum + (Number(repayment.amount) || 0) * getHomeRateForRepayment(repayment, options.exchangeRate), 0);
    const outstanding = Math.max(reimbursable - repaid, 0);
    const outstandingHome = Math.max(reimbursableHome - repaidHome, 0);
    return {
      totalCharged,
      totalChargedHome,
      ownShare: Math.max(totalCharged - reimbursable, 0),
      ownShareHome: Math.max(totalChargedHome - reimbursableHome, 0),
      reimbursable,
      reimbursableHome,
      repaid,
      repaidHome,
      outstanding,
      outstandingHome,
    };
  }

  function getExactEbrahimShare(expense, exchangeRate) {
    const notes = String(expense.notes || "");
    const match = notes.match(/\b(?:ebrahim|berm)\s*:\s*(\d+(?:\.\d+)?)\s*BHD\b/i);
    if (!match) return { amount: 0, homeAmount: 0, homeRate: getHomeRateForExpense(expense, exchangeRate) };
    const homeAmount = Number(match[1]) || 0;
    const homeRate = getHomeRateForExpense(expense, exchangeRate);
    return {
      amount: homeAmount && homeRate ? homeAmount / homeRate : 0,
      homeAmount,
      homeRate,
    };
  }

  function getHomeRateForExpense(expense, exchangeRate) {
    const originalAmount = Number(expense.originalAmount);
    const amount = Number(expense.amount);
    if (expense.originalCurrency === HOME_CURRENCY && originalAmount && amount) {
      return originalAmount / amount;
    }
    return Number(exchangeRate) || 0;
  }

  function getHomeRateForRepayment(repayment, exchangeRate) {
    const originalAmount = Number(repayment.originalAmount);
    const amount = Number(repayment.amount);
    if (repayment.originalCurrency === HOME_CURRENCY && originalAmount && amount) {
      return originalAmount / amount;
    }
    return Number(exchangeRate) || 0;
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;
    const source = String(text || "").replace(/^\uFEFF/, "");

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
    return rows;
  }

  return {
    BASE_CURRENCY,
    HOME_CURRENCY,
    baseSplitPeople,
    splitPeople,
    getTotals,
    getSplitParticipants,
    getDirectDebts,
    getNettedDebtPairs,
    getBalancesFromDebtPairs,
    getSimplifiedTransfers,
    getCardPayoffSummary,
    getExactEbrahimShare,
    getHomeRateForExpense,
    parseCsvRows,
  };
});
