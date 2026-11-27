import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard as CardIcon,
  Landmark,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NavSection } from '../components/AppShell';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  buildCashflowSeries,
  buildCategoryBreakdown,
  computeAccountBalanceCents,
  computeCardInvoices,
  computeMonthlySummary,
  computeNetWorth,
  formatCentsToBRL,
  formatDateBR,
  formatMonthLabel,
} from '../lib/financeMath';

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
  onNewTransaction: () => void;
}

export function DashboardPage({
  onNavigate,
  onNewTransaction,
}: DashboardPageProps) {
  const {
    loading,
    activeMonth,
    accounts,
    categories,
    cards,
    transactions,
    transfers,
    invoicePayments,
    budgets,
    debts,
    assets,
  } = useFinanceData();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="lg:col-span-4 h-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const summary = computeMonthlySummary(activeMonth, transactions);
  const netWorth = computeNetWorth(
    accounts,
    assets,
    debts,
    transactions,
    transfers,
    invoicePayments,
    cards
  );
  const cashflowSeries = buildCashflowSeries(6, activeMonth, transactions);
  const expenseBreakdown = buildCategoryBreakdown(
    activeMonth,
    'expense',
    transactions,
    categories
  );

  const invoices = computeCardInvoices(cards, transactions, invoicePayments);
  const openInvoices = invoices.filter((inv) => inv.status !== 'paid');
  const monthTransactions = transactions
    .filter((tx) => tx.date.slice(0, 7) === activeMonth)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const monthBudgets = budgets.filter((b) => b.month === activeMonth);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.date.slice(0, 7) === activeMonth && tx.type === 'expense') {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + tx.amountCents
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Primary KPI Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saldo em Contas</span>
            <Wallet className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(netWorth.accountsTotalCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {accounts.filter((a) => !a.archived).length} conta(s) ativa(s)
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Receitas do Mês</span>
            <ArrowUpRight className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A34A]">
            {formatCentsToBRL(summary.incomeCents)}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-[#16A34A] font-medium">
              Recebida: {formatCentsToBRL(summary.paidIncomeCents)}
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Pendente: {formatCentsToBRL(summary.pendingIncomeCents)}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Despesas do Mês</span>
            <ArrowDownRight className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#DC2626]">
            {formatCentsToBRL(summary.expenseCents)}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">
              Pagas: {formatCentsToBRL(summary.paidExpenseCents)}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Resultado: {formatCentsToBRL(summary.netCents)}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Patrimônio Líquido</span>
            <TrendingUp className="w-4 h-4 text-[#2563EB]" />
          </div>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              netWorth.netWorthCents >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-[#DC2626]'
            }`}
          >
            {formatCentsToBRL(netWorth.netWorthCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Faturas em aberto: {formatCentsToBRL(netWorth.unpaidInvoicesCents)}
          </p>
        </div>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Fluxo de Caixa (Últimos 6 Meses)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Receitas vs. Despesas — transferências e pagamentos de fatura não são duplicados
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap"
            >
              Ver relatórios
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <Bar dataKey="receitas" name="Receitas" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Despesas por Categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatMonthLabel(activeMonth)}
              </p>
            </div>
          </div>

          {expenseBreakdown.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma despesa registrada neste mês.
              </p>
              <button
                type="button"
                onClick={onNewTransaction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Lançamento
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="amountBRL"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {expenseBreakdown.map((entry) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(Number(value ?? 0))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {expenseBreakdown.slice(0, 5).map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                      {item.percentage}% · {formatCentsToBRL(item.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom Grid: Recent Transactions, Accounts, Invoices & Budgets */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Últimos Lançamentos do Mês
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-medium text-[#2563EB] hover:underline"
            >
              Ver todos
            </button>
          </div>

          {monthTransactions.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum lançamento encontrado em {formatMonthLabel(activeMonth)}.
              </p>
              <button
                type="button"
                onClick={onNewTransaction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Criar primeiro lançamento
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-left">
                    <th className="pb-2.5 font-medium">Data</th>
                    <th className="pb-2.5 font-medium">Descrição</th>
                    <th className="pb-2.5 font-medium">Categoria</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {monthTransactions.map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const statusLabel =
                      tx.status === 'paid'
                        ? tx.type === 'income'
                          ? 'Recebida'
                          : 'Paga'
                        : tx.type === 'income'
                          ? 'A receber'
                          : 'A pagar';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {formatDateBR(tx.date)}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                          {tx.description}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {cat?.name ?? 'Outros'}
                        </td>
                        <td
                          className={`py-2.5 pr-3 text-xs font-medium whitespace-nowrap ${
                            tx.status === 'paid'
                              ? 'text-[#16A34A]'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {statusLabel}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                            tx.type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCentsToBRL(tx.amountCents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Accounts Summary */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Saldos por Conta
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="text-xs font-medium text-[#2563EB] hover:underline"
              >
                Gerenciar
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {accounts
                .filter((a) => !a.archived)
                .slice(0, 4)
                .map((acc) => {
                  const bal = computeAccountBalanceCents(
                    acc,
                    transactions,
                    transfers,
                    invoicePayments
                  );
                  return (
                    <div
                      key={acc.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {acc.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {acc.institution || 'Conta financeira'}
                        </p>
                      </div>
                      <span
                        className={`font-mono tabular-nums font-semibold whitespace-nowrap ${
                          bal >= 0
                            ? 'text-slate-900 dark:text-white'
                            : 'text-[#DC2626]'
                        }`}
                      >
                        {formatCentsToBRL(bal)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Open Invoices & Budgets */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardIcon className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Faturas e Orçamentos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('invoices')}
                className="text-xs font-medium text-[#2563EB] hover:underline"
              >
                Abrir faturas
              </button>
            </div>

            {openInvoices.length === 0 && monthBudgets.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhuma fatura em aberto ou orçamento configurado para este mês.
              </p>
            ) : (
              <div className="space-y-3">
                {openInvoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.key}
                    className="flex items-center justify-between text-xs gap-2"
                  >
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {inv.cardName} · {inv.invoiceMonth} (
                      {inv.status === 'closed' ? 'Fechada' : 'Aberta'})
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCentsToBRL(inv.totalCents)}
                    </span>
                  </div>
                ))}

                {monthBudgets.slice(0, 3).map((b) => {
                  const cat = catMap.get(b.categoryId);
                  const spent = spentByCategory.get(b.categoryId) ?? 0;
                  const pct = Math.min(100, Math.round((spent / b.limitCents) * 100));
                  const exceeded = spent > b.limitCents;
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300">
                          Orçamento: {cat?.name ?? 'Categoria'}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            exceeded ? 'text-[#DC2626] font-semibold' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {formatCentsToBRL(spent)} / {formatCentsToBRL(b.limitCents)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            exceeded
                              ? 'bg-[#DC2626]'
                              : pct >= 80
                                ? 'bg-amber-500'
                                : 'bg-[#16A34A]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
