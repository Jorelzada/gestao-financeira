import { describe, expect, it } from 'vitest';
import {
  addMonthsToDate,
  buildCashflowSeries,
  buildCategoryBreakdown,
  computeAccountBalanceCents,
  computeCardInvoices,
  computeCardUsedLimitCents,
  computeInstallmentGroups,
  computeInvoiceMonth,
  computeMonthlySummary,
  computeNetWorth,
  generateTransactionsCSV,
  parseBRLToCents,
  shiftMonth,
  splitInstallmentsInCents,
} from '../financeMath';
import type {
  Account,
  Asset,
  Category,
  CreditCard,
  Debt,
  InvoicePayment,
  Transaction,
  Transfer,
} from '../../types/finance';

describe('financeMath — Cent-Exact Financial Rules', () => {
  it('parses Brazilian currency strings into exact integer cents', () => {
    expect(parseBRLToCents('1.234,56')).toBe(123456);
    expect(parseBRLToCents('0,01')).toBe(1);
    expect(parseBRLToCents('R$ 500,00')).toBe(50000);
    expect(parseBRLToCents('-250,45')).toBe(-25045);
    expect(parseBRLToCents('199.90')).toBe(19990);
    expect(parseBRLToCents('')).toBe(0);
  });

  it('splits installment totals into exact integer cents with zero drift', () => {
    const parts3 = splitInstallmentsInCents(10000, 3);
    expect(parts3).toEqual([3334, 3333, 3333]);
    expect(parts3.reduce((a, b) => a + b, 0)).toBe(10000);

    const parts7 = splitInstallmentsInCents(25000, 7);
    expect(parts7.reduce((a, b) => a + b, 0)).toBe(25000);
    expect(parts7.length).toBe(7);
  });

  it('clamps month overflow days properly when advancing installment dates', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToDate('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('routes credit card purchases to correct invoice month based on closingDay', () => {
    expect(computeInvoiceMonth('2026-05-09', 10)).toBe('2026-05');
    expect(computeInvoiceMonth('2026-05-10', 10)).toBe('2026-06');
    expect(computeInvoiceMonth('2026-12-20', 15)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('computes account balance excluding pending items, including transfers and invoice payments', () => {
    const accounts: Account[] = [
      {
        id: 'acc_1',
        userId: 'u1',
        name: 'Corrente',
        institution: 'Banco A',
        type: 'checking',
        initialBalanceCents: 100000, // R$ 1.000,00
        color: '#2563EB',
        archived: false,
      },
      {
        id: 'acc_2',
        userId: 'u1',
        name: 'Poupança',
        institution: 'Banco A',
        type: 'savings',
        initialBalanceCents: 50000, // R$ 500,00
        color: '#16A34A',
        archived: false,
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 't1',
        userId: 'u1',
        type: 'income',
        description: 'Salário',
        amountCents: 500000,
        date: '2026-05-05',
        categoryId: 'c_sal',
        paymentMethod: 'account',
        accountId: 'acc_1',
        cardId: '',
        invoiceMonth: '',
        status: 'paid',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: '',
      },
      {
        id: 't2',
        userId: 'u1',
        type: 'expense',
        description: 'Aluguel',
        amountCents: 150000,
        date: '2026-05-10',
        categoryId: 'c_home',
        paymentMethod: 'account',
        accountId: 'acc_1',
        cardId: '',
        invoiceMonth: '',
        status: 'paid',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: '',
      },
      {
        id: 't3',
        userId: 'u1',
        type: 'expense',
        description: 'Conta futura pendente',
        amountCents: 20000,
        date: '2026-05-25',
        categoryId: 'c_home',
        paymentMethod: 'account',
        accountId: 'acc_1',
        cardId: '',
        invoiceMonth: '',
        status: 'pending',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: '',
      },
      {
        id: 't4',
        userId: 'u1',
        type: 'expense',
        description: 'Compra no cartão',
        amountCents: 30000,
        date: '2026-05-04',
        categoryId: 'c_food',
        paymentMethod: 'card',
        accountId: '',
        cardId: 'card_1',
        invoiceMonth: '2026-05',
        status: 'paid',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: '',
      },
    ];

    const transfers: Transfer[] = [
      {
        id: 'tr_1',
        userId: 'u1',
        fromAccountId: 'acc_1',
        toAccountId: 'acc_2',
        amountCents: 100000, // R$ 1.000,00 moved from acc_1 to acc_2
        date: '2026-05-12',
        description: 'Reserva mensal',
      },
    ];

    const invoicePayments: InvoicePayment[] = [
      {
        id: 'card_1__2026-05',
        userId: 'u1',
        cardId: 'card_1',
        accountId: 'acc_1',
        invoiceMonth: '2026-05',
        amountCents: 30000,
        paidDate: '2026-05-15',
      },
    ];

    // acc_1: 100000 + 500000 - 150000 - 100000 - 30000 = 320000
    expect(
      computeAccountBalanceCents(accounts[0], transactions, transfers, invoicePayments)
    ).toBe(320000);
    // acc_2: 50000 + 100000 = 150000
    expect(
      computeAccountBalanceCents(accounts[1], transactions, transfers, invoicePayments)
    ).toBe(150000);

    // Monthly summary must NOT count transfer or invoicePayment as income/expense!
    const summary = computeMonthlySummary('2026-05', transactions);
    expect(summary.incomeCents).toBe(500000);
    // Expenses = t2 (150000) + t3 (20000) + t4 (30000) = 200000 (no double counting of invoicePayment!)
    expect(summary.expenseCents).toBe(200000);
    expect(summary.netCents).toBe(300000);
    expect(summary.savingsRatePercent).toBe(60);
  });

  it('computes card invoices, available limits, installment groups, and net worth accurately', () => {
    const cards: CreditCard[] = [
      {
        id: 'card_1',
        userId: 'u1',
        name: 'Principal',
        brand: 'Master',
        limitCents: 200000,
        closingDay: 10,
        dueDay: 17,
        color: '#0F172A',
        archived: false,
      },
    ];

    const accounts: Account[] = [
      {
        id: 'acc_1',
        userId: 'u1',
        name: 'Conta',
        institution: '',
        type: 'checking',
        initialBalanceCents: 500000,
        color: '#2563EB',
        archived: false,
      },
    ];

    const assets: Asset[] = [
      {
        id: 'ast_1',
        userId: 'u1',
        name: 'Tesouro Selic',
        category: 'fixed_income',
        valueCents: 1000000,
        liquidity: 'high',
        notes: '',
      },
    ];

    const debts: Debt[] = [
      {
        id: 'd_1',
        userId: 'u1',
        name: 'Empréstimo',
        creditor: 'Banco B',
        totalCents: 400000,
        remainingCents: 250000,
        monthlyPaymentCents: 50000,
        interestRatePercent: 1.5,
        dueDay: 10,
        status: 'active',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx_i1',
        userId: 'u1',
        type: 'expense',
        description: 'Monitor (1/2)',
        amountCents: 40000,
        date: '2026-05-05',
        categoryId: 'cat_shop',
        paymentMethod: 'card',
        accountId: '',
        cardId: 'card_1',
        invoiceMonth: '2026-05',
        status: 'pending',
        installmentGroupId: 'inst_1',
        installmentNumber: 1,
        totalInstallments: 2,
        recurrenceId: '',
        notes: '',
      },
      {
        id: 'tx_i2',
        userId: 'u1',
        type: 'expense',
        description: 'Monitor (2/2)',
        amountCents: 40000,
        date: '2026-06-05',
        categoryId: 'cat_shop',
        paymentMethod: 'card',
        accountId: '',
        cardId: 'card_1',
        invoiceMonth: '2026-06',
        status: 'pending',
        installmentGroupId: 'inst_1',
        installmentNumber: 2,
        totalInstallments: 2,
        recurrenceId: '',
        notes: '',
      },
    ];

    const invoices = computeCardInvoices(cards, transactions, [], '2026-05-12');
    expect(invoices.length).toBe(2);
    expect(invoices.find((i) => i.invoiceMonth === '2026-05')?.status).toBe('closed');
    expect(invoices.find((i) => i.invoiceMonth === '2026-06')?.status).toBe('open');

    const usedLimit = computeCardUsedLimitCents('card_1', invoices);
    expect(usedLimit).toBe(80000);

    const instGroups = computeInstallmentGroups(transactions);
    expect(instGroups.length).toBe(1);
    expect(instGroups[0].description).toBe('Monitor');
    expect(instGroups[0].remainingCents).toBe(80000);

    const netWorth = computeNetWorth(accounts, assets, debts, transactions, [], [], cards);
    // Gross = 500000 + 1000000 = 1500000
    // Liabilities = 250000 (debt) + 80000 (unpaid invoices) = 330000
    // Net Worth = 1170000
    expect(netWorth.grossAssetsCents).toBe(1500000);
    expect(netWorth.totalLiabilitiesCents).toBe(330000);
    expect(netWorth.netWorthCents).toBe(1170000);
  });

  it('builds cashflow series, category breakdown, and CSV export', () => {
    const categories: Category[] = [
      { id: 'c1', userId: 'u1', name: 'Moradia', type: 'expense', color: '#2563EB', icon: 'Home' },
    ];
    const transactions: Transaction[] = [
      {
        id: 't1',
        userId: 'u1',
        type: 'expense',
        description: 'Aluguel "Casa"',
        amountCents: 120000,
        date: '2026-05-05',
        categoryId: 'c1',
        paymentMethod: 'account',
        accountId: 'a1',
        cardId: '',
        invoiceMonth: '',
        status: 'paid',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: '',
      },
    ];

    const series = buildCashflowSeries(3, '2026-05', transactions);
    expect(series.length).toBe(3);
    expect(series[2].despesas).toBe(1200);

    const breakdown = buildCategoryBreakdown('2026-05', 'expense', transactions, categories);
    expect(breakdown[0].percentage).toBe(100);

    const csv = generateTransactionsCSV(transactions, categories, [], []);
    expect(csv).toContain('"Aluguel ""Casa"""');
    expect(csv).toContain('"-1200,00"');
  });
});
