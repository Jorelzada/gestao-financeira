import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  buildCashflowSeries,
  buildCategoryBreakdown,
  computeMonthlySummary,
  formatCentsToBRL,
  formatMonthLabel,
  generateTransactionsCSV,
  getTransactionMonthKey,
} from '../lib/financeMath';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const {
    activeMonth,
    transactions,
    categories,
    accounts,
    cards,
    transfers,
    invoicePayments,
    budgets,
    goals,
    debts,
    assets,
    recurrences,
  } = useFinanceData();

  const [monthsRange, setMonthsRange] = useState<6 | 12>(12);

  const summary = computeMonthlySummary(activeMonth, transactions);
  const series = buildCashflowSeries(monthsRange, activeMonth, transactions);
  const expenseCategories = buildCategoryBreakdown(
    activeMonth,
    'expense',
    transactions,
    categories
  );
  const incomeCategories = buildCategoryBreakdown(
    activeMonth,
    'income',
    transactions,
    categories
  );

  const cardExpenseCents = transactions
    .filter(
      (tx) =>
        getTransactionMonthKey(tx) === activeMonth &&
        tx.type === 'expense' &&
        tx.paymentMethod === 'card'
    )
    .reduce((s, t) => s + t.amountCents, 0);

  const accountExpenseCents = transactions
    .filter(
      (tx) =>
        getTransactionMonthKey(tx) === activeMonth &&
        tx.type === 'expense' &&
        tx.paymentMethod === 'account'
    )
    .reduce((s, t) => s + t.amountCents, 0);

  const handleExportCSV = () => {
    const csv = generateTransactionsCSV(transactions, categories, accounts, cards);
    triggerDownload(`gestao-financeira-lancamentos-${activeMonth}.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      currency: 'BRL',
      accounts,
      categories,
      cards,
      transactions,
      transfers,
      invoicePayments,
      recurrences,
      budgets,
      goals,
      debts,
      assets,
    };
    triggerDownload(
      `gestao-financeira-backup-${activeMonth}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;'
    );
  };

  return (
    <div className="space-y-6">
      {/* Export Bar */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Exportação de Dados Financeiros
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exporte seus lançamentos para planilhas (CSV compatível com Excel) ou gere um backup completo em JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar CSV ({transactions.length})
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileJson className="w-4 h-4" />
            Backup JSON
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Receitas Recebidas ({formatMonthLabel(activeMonth)})
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#16A34A]">
            {formatCentsToBRL(summary.paidIncomeCents)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Receitas Pendentes (A receber)
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatCentsToBRL(summary.pendingIncomeCents)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Taxa de Poupança ({formatMonthLabel(activeMonth)})
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {summary.savingsRatePercent}%
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Despesas em Conta / Débito
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(accountExpenseCents)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Despesas no Cartão de Crédito
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(cardExpenseCents)}
          </p>
        </div>
      </div>

      {/* Multi-month Trend Chart */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Evolução Mensal (Receitas, Despesas e Saldo)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparativo histórico encerrando em {formatMonthLabel(activeMonth)}
            </p>
          </div>
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setMonthsRange(6)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                monthsRange === 6
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              6 meses
            </button>
            <button
              type="button"
              onClick={() => setMonthsRange(12)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                monthsRange === 12
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              12 meses
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
              />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(Number(value ?? 0))
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="receitas"
                name="Receitas"
                stroke="#16A34A"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke="#DC2626"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Resultado Líquido"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Ranking de Despesas — {formatMonthLabel(activeMonth)}
          </h3>
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Nenhuma despesa registrada neste mês.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenseCategories.map((item) => (
                <div
                  key={item.categoryId}
                  className="py-2.5 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                    {item.percentage}% · {formatCentsToBRL(item.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Fontes de Receita — {formatMonthLabel(activeMonth)}
          </h3>
          {incomeCategories.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Nenhuma receita registrada neste mês.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {incomeCategories.map((item) => (
                <div
                  key={item.categoryId}
                  className="py-2.5 flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5 tabular-nums">
                      Recebida: {formatCentsToBRL(item.paidAmountCents)} · Pendente:{' '}
                      {formatCentsToBRL(item.pendingAmountCents)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#16A34A] shrink-0">
                    {item.percentage}% · {formatCentsToBRL(item.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Silent helper check so Download icon import is used cleanly */}
      <div className="hidden" aria-hidden="true">
        <Download className="w-3 h-3" />
      </div>
    </div>
  );
}
