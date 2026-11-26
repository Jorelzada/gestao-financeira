import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { TransactionModal } from '../components/TransactionModal';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeMonthlySummary,
  formatCentsToBRL,
  formatDateBR,
  formatMonthLabel,
} from '../lib/financeMath';
import {
  deleteTransaction,
  toggleTransactionStatus,
} from '../services/firestoreService';
import type { Transaction } from '../types/finance';

export function TransactionsPage() {
  const { user } = useAuth();
  const { activeMonth, transactions, categories, accounts, cards } =
    useFinanceData();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyActiveMonth, setOnlyActiveMonth] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const cardMap = useMemo(
    () => new Map(cards.map((c) => [c.id, c])),
    [cards]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (onlyActiveMonth && tx.date.slice(0, 7) !== activeMonth) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (q && !tx.description.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    onlyActiveMonth,
    activeMonth,
    typeFilter,
    statusFilter,
    categoryFilter,
    search,
  ]);

  const monthSummary = computeMonthlySummary(activeMonth, transactions);

  const handleToggleStatus = async (tx: Transaction) => {
    if (!user) return;
    const nextStatus = tx.status === 'paid' ? 'pending' : 'paid';
    await toggleTransactionStatus(user.uid, tx.id, nextStatus);
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingTx) return;
    setBusyDelete(true);
    try {
      await deleteTransaction(user.uid, deletingTx.id);
      setDeletingTx(null);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Period KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Receitas ({formatMonthLabel(activeMonth)})
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#16A34A]">
            {formatCentsToBRL(monthSummary.incomeCents)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Despesas ({formatMonthLabel(activeMonth)})
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#DC2626]">
            {formatCentsToBRL(monthSummary.expenseCents)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resultado do Mês
          </p>
          <p
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              monthSummary.netCents >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-[#DC2626]'
            }`}
          >
            {formatCentsToBRL(monthSummary.netCents)}
          </p>
        </div>
      </div>

      {/* Filters & Action Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(['all', 'income', 'expense'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setTypeFilter(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  typeFilter === val
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {val === 'all' ? 'Todos' : val === 'income' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="all">Todos os status</option>
            <option value="paid">Pago / Recebido</option>
            <option value="pending">Pendente</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="all">Todas categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyActiveMonth((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              onlyActiveMonth
                ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {onlyActiveMonth ? `Somente ${activeMonth}` : 'Todos os meses'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingTx(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Lançamento
        </button>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhum lançamento encontrado para os filtros atuais.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registre receitas, despesas à vista ou compras parceladas no cartão.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingTx(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar lançamento
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const originLabel =
                    tx.paymentMethod === 'account'
                      ? accMap.get(tx.accountId)?.name ?? 'Conta'
                      : `${cardMap.get(tx.cardId)?.name ?? 'Cartão'} (${tx.invoiceMonth})`;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDateBR(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </p>
                        {tx.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {tx.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {cat?.name ?? 'Outros'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {originLabel}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(tx)}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            tx.status === 'paid'
                              ? 'text-[#16A34A]'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                          title="Alternar status"
                        >
                          {tx.status === 'paid' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {tx.type === 'income' ? 'Recebido' : 'Pago'}
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              Pendente
                            </>
                          )}
                        </button>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          tx.type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCentsToBRL(tx.amountCents)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(tx);
                              setModalOpen(true);
                            }}
                            aria-label="Editar lançamento"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            aria-label="Excluir lançamento"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        editingTransaction={editingTx}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTx)}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja excluir "${deletingTx?.description ?? ''}"? Esta ação atualiza seus saldos imediatamente.`}
        confirmLabel="Excluir"
        danger
        busy={busyDelete}
        onCancel={() => setDeletingTx(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
