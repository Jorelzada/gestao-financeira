import type {
  Account,
  Asset,
  CardInvoiceSummary,
  Category,
  CreditCard,
  Debt,
  InstallmentGroupSummary,
  InvoicePayment,
  Transaction,
  TransactionStatus,
  Transfer,
} from '../types/finance';

export const MAX_SAFE_CENTS = 100_000_000_000;

export function formatCentsToBRL(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeCents / 100);
}

export function formatCentsToInput(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  return (safeCents / 100).toFixed(2).replace('.', ',');
}

export function parseBRLToCents(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const isNegative = trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  // Handle Brazilian formatting (e.g. 1.234,56) vs US decimal (e.g. 1234.56)
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  const cents = Math.round(value * 100);
  const signed = isNegative ? -cents : cents;
  return Math.max(-MAX_SAFE_CENTS, Math.min(MAX_SAFE_CENTS, signed));
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(): string {
  return getTodayDateStr().slice(0, 7);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number.parseInt(yStr, 10);
  const month = Number.parseInt(mStr, 10) - 1;
  const date = new Date(year, month + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number.parseInt(yStr, 10);
  const month = Number.parseInt(mStr, 10) - 1;
  const date = new Date(year, month, 1);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortMonth(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number.parseInt(yStr, 10);
  const month = Number.parseInt(mStr, 10) - 1;
  const date = new Date(year, month, 1);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
  }).format(date);
  return label.replace('.', '');
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number.parseInt(yStr, 10);
  const month = Number.parseInt(mStr, 10) - 1;
  const day = Number.parseInt(dStr, 10);

  const targetMonthDate = new Date(year, month + monthsToAdd, 1);
  const lastDayOfTargetMonth = new Date(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth() + 1,
    0
  ).getDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return `${targetMonthDate.getFullYear()}-${String(targetMonthDate.getMonth() + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Determines which invoice month (YYYY-MM) a card purchase belongs to.
 * Purchases made on or after closingDay roll over to the next month's invoice.
 */
export function computeInvoiceMonth(purchaseDate: string, closingDay: number): string {
  const monthKey = purchaseDate.slice(0, 7);
  const day = Number.parseInt(purchaseDate.slice(8, 10), 10);
  if (Number.isFinite(day) && day >= closingDay) {
    return shiftMonth(monthKey, 1);
  }
  return monthKey;
}

/**
 * Returns a purchase date (YYYY-MM-DD) whose credit card invoice falls in targetInvoiceMonth.
 */
export function getDateForInvoiceMonth(
  targetInvoiceMonth: string,
  closingDay: number,
  referenceDate: string = getTodayDateStr()
): string {
  if (
    referenceDate.slice(0, 7) === targetInvoiceMonth &&
    computeInvoiceMonth(referenceDate, closingDay) === targetInvoiceMonth
  ) {
    return referenceDate;
  }
  if (closingDay > 1) {
    return `${targetInvoiceMonth}-01`;
  }
  const prevMonth = shiftMonth(targetInvoiceMonth, -1);
  return `${prevMonth}-15`;
}

/**
 * Returns the accounting month (YYYY-MM) of a transaction.
 * Card transactions use their billing `invoiceMonth` so purchases made after closingDay
 * or consolidated monthly card spends belong strictly to their respective invoice month.
 */
export function getTransactionMonthKey(tx: Transaction): string {
  if (tx.paymentMethod === 'card' && tx.invoiceMonth) {
    return tx.invoiceMonth;
  }
  return tx.date.slice(0, 7);
}

/**
 * Builds a valid YYYY-MM-DD date inside targetMonth, clamping dayOfMonth (1..31) to month length.
 */
export function buildRecurrenceDateStr(targetMonth: string, dayOfMonth: number): string {
  const [yStr, mStr] = targetMonth.split('-');
  const year = Number.parseInt(yStr, 10);
  const monthIndex = Number.parseInt(mStr, 10) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.max(1, Math.min(lastDay, Math.round(dayOfMonth)));
  return `${targetMonth}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Resolves automatic paid/pending status by comparing the scheduled date against today.
 * Dates on or before today are automatically marked as paid/received; future dates stay pending.
 */
export function resolveRecurrenceTransactionStatus(
  txDate: string,
  today: string = getTodayDateStr()
): TransactionStatus {
  return txDate <= today ? 'paid' : 'pending';
}

/**
 * Splits a total amount in cents into N integer installments whose exact sum equals totalCents.
 * Any remainder cents are added to the first installment(s) so there is zero rounding drift.
 */
export function splitInstallmentsInCents(totalCents: number, count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const safeTotal = Math.max(0, Math.round(totalCents));
  const base = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal % safeCount;

  return Array.from({ length: safeCount }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

/**
 * Computes an account's real-time balance in cents.
 * Transfers adjust balances without affecting income/expense metrics.
 * Invoice payments deduct from the paying account without duplicating expense totals.
 */
export function computeAccountBalanceCents(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[],
  invoicePayments: InvoicePayment[]
): number {
  let balance = account.initialBalanceCents;

  for (const tx of transactions) {
    if (tx.paymentMethod !== 'account' || tx.accountId !== account.id || tx.status !== 'paid') {
      continue;
    }
    if (tx.type === 'income') {
      balance += tx.amountCents;
    } else {
      balance -= tx.amountCents;
    }
  }

  for (const tr of transfers) {
    if (tr.fromAccountId === account.id) {
      balance -= tr.amountCents;
    }
    if (tr.toAccountId === account.id) {
      balance += tr.amountCents;
    }
  }

  for (const pay of invoicePayments) {
    if (pay.accountId === account.id) {
      balance -= pay.amountCents;
    }
  }

  return balance;
}

export interface MonthlySummary {
  monthKey: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  paidIncomeCents: number;
  pendingIncomeCents: number;
  paidExpenseCents: number;
  pendingExpenseCents: number;
  savingsRatePercent: number;
}

/**
 * Computes monthly income, expenses, and net result.
 * Strictly excludes transfers and invoice payments to avoid double-counting.
 */
export function computeMonthlySummary(
  monthKey: string,
  transactions: Transaction[]
): MonthlySummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let paidIncomeCents = 0;
  let pendingIncomeCents = 0;
  let paidExpenseCents = 0;
  let pendingExpenseCents = 0;

  for (const tx of transactions) {
    if (getTransactionMonthKey(tx) !== monthKey) continue;
    if (tx.type === 'income') {
      incomeCents += tx.amountCents;
      if (tx.status === 'paid') paidIncomeCents += tx.amountCents;
      else pendingIncomeCents += tx.amountCents;
    } else {
      expenseCents += tx.amountCents;
      if (tx.status === 'paid') paidExpenseCents += tx.amountCents;
      else pendingExpenseCents += tx.amountCents;
    }
  }

  const netCents = incomeCents - expenseCents;
  const savingsRatePercent =
    incomeCents > 0 ? Math.round((netCents / incomeCents) * 1000) / 10 : 0;

  return {
    monthKey,
    incomeCents,
    expenseCents,
    netCents,
    paidIncomeCents,
    pendingIncomeCents,
    paidExpenseCents,
    pendingExpenseCents,
    savingsRatePercent,
  };
}

export function computeCardInvoices(
  cards: CreditCard[],
  transactions: Transaction[],
  invoicePayments: InvoicePayment[],
  referenceDate: string = getTodayDateStr()
): CardInvoiceSummary[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const paymentMap = new Map(
    invoicePayments.map((p) => [`${p.cardId}__${p.invoiceMonth}`, p])
  );

  const grouped = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.paymentMethod !== 'card' || !tx.cardId || !tx.invoiceMonth) continue;
    const key = `${tx.cardId}__${tx.invoiceMonth}`;
    const list = grouped.get(key) ?? [];
    list.push(tx);
    grouped.set(key, list);
  }

  // Ensure every card has at least its current active invoice month listed if unpaid
  const currentMonth = referenceDate.slice(0, 7);
  const currentDay = Number.parseInt(referenceDate.slice(8, 10), 10);

  const results: CardInvoiceSummary[] = [];

  for (const [key, items] of grouped.entries()) {
    const [cardId, invoiceMonth] = key.split('__');
    const card = cardMap.get(cardId);
    if (!card) continue;

    const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    const payment = paymentMap.get(key) ?? null;

    let status: 'paid' | 'closed' | 'open' = 'open';
    if (payment && payment.amountCents >= totalCents) {
      status = 'paid';
    } else if (
      invoiceMonth < currentMonth ||
      (invoiceMonth === currentMonth && currentDay >= card.closingDay)
    ) {
      status = 'closed';
    }

    results.push({
      key,
      cardId,
      cardName: card.name,
      cardColor: card.color,
      invoiceMonth,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      totalCents,
      transactions: [...items].sort((a, b) => b.date.localeCompare(a.date)),
      payment,
      status,
    });
  }

  return results.sort((a, b) => b.invoiceMonth.localeCompare(a.invoiceMonth));
}

export function computeCardUsedLimitCents(
  cardId: string,
  invoices: CardInvoiceSummary[]
): number {
  let used = 0;
  for (const inv of invoices) {
    if (inv.cardId !== cardId) continue;
    const paid = inv.payment?.amountCents ?? 0;
    used += Math.max(0, inv.totalCents - paid);
  }
  return used;
}

export interface CardLimitBreakdown {
  limitCents: number;
  monthlySpendCents: number; // Unpaid non-installment spend in targetMonth
  itemizedMonthlySpendCents: number; // Unpaid non-installment itemized spend in targetMonth
  consolidatedMonthlySpendCents: number; // Unpaid [Gasto Total] consolidated tx in targetMonth
  consolidatedMonthlyTxId: string | null;
  targetMonthInstallmentsCents: number; // Installment portion due in targetMonth
  targetMonthTotalInvoiceCents: number; // Total invoice in targetMonth (monthlySpend + month installments)
  activeInstallmentsCents: number; // Total unpaid installment balance across all months
  activeInstallmentGroups: InstallmentGroupSummary[];
  otherMonthsNonInstallmentCents: number; // Unpaid non-installment spend in other months
  totalCommittedCents: number; // monthlySpend + activeInstallments + otherMonthsNonInstallment
  availableLimitCents: number; // Math.max(0, limitCents - totalCommittedCents)
  usedPercent: number;
  isTargetMonthPaid: boolean;
}

export function isInstallmentTransaction(tx: Transaction): boolean {
  return tx.totalInstallments > 1 || Boolean(tx.installmentGroupId);
}

export function computeCardLimitBreakdown(
  card: CreditCard,
  targetMonth: string,
  transactions: Transaction[],
  invoices: CardInvoiceSummary[]
): CardLimitBreakdown {
  const paidInvoiceMonths = new Set(
    invoices
      .filter((inv) => inv.cardId === card.id && inv.status === 'paid')
      .map((inv) => inv.invoiceMonth)
  );
  const isTargetMonthPaid = paidInvoiceMonths.has(targetMonth);

  const cardExpenseTxs = transactions.filter(
    (tx) => tx.paymentMethod === 'card' && tx.cardId === card.id && tx.type === 'expense'
  );

  const isTxUnpaid = (tx: Transaction) =>
    tx.status !== 'paid' && !paidInvoiceMonths.has(tx.invoiceMonth);

  let itemizedMonthlySpendCents = 0;
  let consolidatedMonthlySpendCents = 0;
  let consolidatedMonthlyTxId: string | null = null;
  let targetMonthInstallmentsCents = 0;
  let activeInstallmentsCents = 0;
  let otherMonthsNonInstallmentCents = 0;
  let targetMonthTotalInvoiceCents = 0;

  // Normalize paid status for installment groups if their invoice is paid
  const normalizedCardTxs: Transaction[] = [];

  for (const tx of cardExpenseTxs) {
    const installment = isInstallmentTransaction(tx);
    const unpaid = isTxUnpaid(tx);

    if (installment) {
      normalizedCardTxs.push(unpaid ? tx : { ...tx, status: 'paid' });
    }

    if (tx.invoiceMonth === targetMonth) {
      targetMonthTotalInvoiceCents += tx.amountCents;
      if (installment) {
        if (unpaid) {
          targetMonthInstallmentsCents += tx.amountCents;
        }
      } else if (unpaid) {
        if (tx.notes.startsWith('[Gasto Total]')) {
          consolidatedMonthlySpendCents += tx.amountCents;
          if (!consolidatedMonthlyTxId) {
            consolidatedMonthlyTxId = tx.id;
          }
        } else {
          itemizedMonthlySpendCents += tx.amountCents;
        }
      }
    } else if (unpaid && !installment) {
      otherMonthsNonInstallmentCents += tx.amountCents;
    }

    if (installment && unpaid) {
      activeInstallmentsCents += tx.amountCents;
    }
  }

  const activeInstallmentGroups = computeInstallmentGroups(normalizedCardTxs).filter(
    (g) => g.remainingCents > 0
  );

  const monthlySpendCents = itemizedMonthlySpendCents + consolidatedMonthlySpendCents;
  const totalCommittedCents =
    monthlySpendCents + activeInstallmentsCents + otherMonthsNonInstallmentCents;
  const availableLimitCents = Math.max(0, card.limitCents - totalCommittedCents);
  const usedPercent =
    card.limitCents > 0
      ? Math.min(100, Math.round((totalCommittedCents / card.limitCents) * 100))
      : 0;

  return {
    limitCents: card.limitCents,
    monthlySpendCents,
    itemizedMonthlySpendCents,
    consolidatedMonthlySpendCents,
    consolidatedMonthlyTxId,
    targetMonthInstallmentsCents,
    targetMonthTotalInvoiceCents,
    activeInstallmentsCents,
    activeInstallmentGroups,
    otherMonthsNonInstallmentCents,
    totalCommittedCents,
    availableLimitCents,
    usedPercent,
    isTargetMonthPaid,
  };
}

export function computeInstallmentGroups(
  transactions: Transaction[]
): InstallmentGroupSummary[] {
  const grouped = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx.installmentGroupId || tx.totalInstallments <= 1) continue;
    const list = grouped.get(tx.installmentGroupId) ?? [];
    list.push(tx);
    grouped.set(tx.installmentGroupId, list);
  }

  const summaries: InstallmentGroupSummary[] = [];

  for (const [groupId, items] of grouped.entries()) {
    const sorted = [...items].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const paidCount = sorted.filter((i) => i.status === 'paid').length;
    const totalCents = sorted.reduce((sum, i) => sum + i.amountCents, 0);
    const remainingCents = sorted
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + i.amountCents, 0);

    summaries.push({
      groupId,
      description: first.description.replace(/\s*\(\d+\/\d+\)$/, ''),
      categoryId: first.categoryId,
      paymentMethod: first.paymentMethod,
      accountId: first.accountId,
      cardId: first.cardId,
      totalInstallments: first.totalInstallments,
      paidCount,
      totalCents,
      remainingCents,
      installmentCents: first.amountCents,
      firstDate: first.date,
      lastDate: last.date,
      items: sorted,
    });
  }

  return summaries.sort((a, b) => b.firstDate.localeCompare(a.firstDate));
}

export interface NetWorthSummary {
  accountsTotalCents: number;
  assetsTotalCents: number;
  grossAssetsCents: number;
  debtsTotalCents: number;
  unpaidInvoicesCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
}

export function computeNetWorth(
  accounts: Account[],
  assets: Asset[],
  debts: Debt[],
  transactions: Transaction[],
  transfers: Transfer[],
  invoicePayments: InvoicePayment[],
  cards: CreditCard[]
): NetWorthSummary {
  const accountsTotalCents = accounts
    .filter((a) => !a.archived)
    .reduce(
      (sum, acc) => sum + computeAccountBalanceCents(acc, transactions, transfers, invoicePayments),
      0
    );

  const assetsTotalCents = assets.reduce((sum, a) => sum + a.valueCents, 0);
  const grossAssetsCents = accountsTotalCents + assetsTotalCents;

  const debtsTotalCents = debts
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => sum + d.remainingCents, 0);

  const invoices = computeCardInvoices(cards, transactions, invoicePayments);
  const unpaidInvoicesCents = invoices.reduce((sum, inv) => {
    const paid = inv.payment?.amountCents ?? 0;
    return sum + Math.max(0, inv.totalCents - paid);
  }, 0);

  const totalLiabilitiesCents = debtsTotalCents + unpaidInvoicesCents;
  const netWorthCents = grossAssetsCents - totalLiabilitiesCents;

  return {
    accountsTotalCents,
    assetsTotalCents,
    grossAssetsCents,
    debtsTotalCents,
    unpaidInvoicesCents,
    totalLiabilitiesCents,
    netWorthCents,
  };
}

export interface CashflowPoint {
  monthKey: string;
  label: string;
  receitas: number;
  receitasRecebidas: number;
  receitasPendentes: number;
  despesas: number;
  saldo: number;
}

export function buildCashflowSeries(
  monthsCount: number,
  endMonthKey: string,
  transactions: Transaction[]
): CashflowPoint[] {
  const points: CashflowPoint[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const mk = shiftMonth(endMonthKey, -i);
    const summary = computeMonthlySummary(mk, transactions);
    points.push({
      monthKey: mk,
      label: formatShortMonth(mk),
      receitas: Math.round(summary.incomeCents) / 100,
      receitasRecebidas: Math.round(summary.paidIncomeCents) / 100,
      receitasPendentes: Math.round(summary.pendingIncomeCents) / 100,
      despesas: Math.round(summary.expenseCents) / 100,
      saldo: Math.round(summary.netCents) / 100,
    });
  }
  return points;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  amountCents: number;
  paidAmountCents: number;
  pendingAmountCents: number;
  amountBRL: number;
  percentage: number;
}

export function buildCategoryBreakdown(
  monthKey: string,
  type: 'income' | 'expense',
  transactions: Transaction[],
  categories: Category[]
): CategoryBreakdownItem[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { total: number; paid: number; pending: number }>();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (getTransactionMonthKey(tx) !== monthKey || tx.type !== type) continue;
    const entry = totals.get(tx.categoryId) ?? { total: 0, paid: 0, pending: 0 };
    entry.total += tx.amountCents;
    if (tx.status === 'paid') {
      entry.paid += tx.amountCents;
    } else {
      entry.pending += tx.amountCents;
    }
    totals.set(tx.categoryId, entry);
    grandTotal += tx.amountCents;
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [categoryId, entry] of totals.entries()) {
    const cat = catMap.get(categoryId);
    items.push({
      categoryId,
      name: cat?.name ?? 'Sem categoria',
      color: cat?.color ?? '#64748B',
      amountCents: entry.total,
      paidAmountCents: entry.paid,
      pendingAmountCents: entry.pending,
      amountBRL: entry.total / 100,
      percentage: grandTotal > 0 ? Math.round((entry.total / grandTotal) * 1000) / 10 : 0,
    });
  }

  return items.sort((a, b) => b.amountCents - a.amountCents);
}

export function generateTransactionsCSV(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  cards: CreditCard[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(cards.map((c) => [c.id, c.name]));

  const escapeCSV = (val: string) => {
    const safe = val.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const headers = [
    'Data',
    'Tipo',
    'Descrição',
    'Categoria',
    'Forma de Pagamento',
    'Conta / Cartão',
    'Parcela',
    'Status',
    'Valor (R$)',
    'Observações',
  ];

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const origin =
        tx.paymentMethod === 'account'
          ? accMap.get(tx.accountId) ?? 'Conta'
          : cardMap.get(tx.cardId) ?? 'Cartão';
      const parcela =
        tx.totalInstallments > 1 ? `${tx.installmentNumber}/${tx.totalInstallments}` : 'À vista';
      const signedCents = tx.type === 'income' ? tx.amountCents : -tx.amountCents;
      return [
        formatDateBR(tx.date),
        tx.type === 'income' ? 'Receita' : 'Despesa',
        tx.description,
        catMap.get(tx.categoryId) ?? 'Outros',
        tx.paymentMethod === 'account' ? 'Conta' : 'Cartão de Crédito',
        origin,
        parcela,
        tx.status === 'paid'
          ? tx.type === 'income'
            ? 'Recebida'
            : 'Paga'
          : tx.type === 'income'
            ? 'Pendente (A receber)'
            : 'Pendente (A pagar)',
        (signedCents / 100).toFixed(2).replace('.', ','),
        tx.notes,
      ]
        .map(escapeCSV)
        .join(';');
    });

  return '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows].join('\n');
}
