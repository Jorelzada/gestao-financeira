import React, { useMemo, useState } from 'react';
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  formatCentsToBRL,
  formatCentsToInput,
  formatMonthLabel,
  parseBRLToCents,
} from '../lib/financeMath';
import { deleteBudget, upsertBudget } from '../services/firestoreService';
import type { Budget } from '../types/finance';

export function BudgetsPage() {
  const { user } = useAuth();
  const { activeMonth, budgets, categories, transactions } = useFinanceData();

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [limitText, setLimitText] = useState('');

  const monthBudgets = budgets.filter((b) => b.month === activeMonth);

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.date.slice(0, 7) === activeMonth) {
        map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountCents);
      }
    }
    return map;
  }, [transactions, activeMonth]);

  const totalBudgeted = monthBudgets.reduce((s, b) => s + b.limitCents, 0);
  const totalSpentBudgeted = monthBudgets.reduce(
    (s, b) => s + (spentByCat.get(b.categoryId) ?? 0),
    0
  );

  const openCreate = () => {
    setEditing(null);
    setCategoryId(expenseCategories[0]?.id || '');
    setLimitText('');
    setModalOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    setCategoryId(b.categoryId);
    setLimitText(formatCentsToInput(b.limitCents));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !categoryId) return;
    const limitCents = parseBRLToCents(limitText);
    if (limitCents <= 0) return;

    setBusy(true);
    try {
      await upsertBudget(user.uid, {
        id: editing?.id,
        categoryId,
        month: activeMonth,
        limitCents,
      });
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteBudget(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Orçamentos de {formatMonthLabel(activeMonth)}
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(totalSpentBudgeted)} gastos de {formatCentsToBRL(totalBudgeted)} planejados
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={expenseCategories.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Definir Orçamento
        </button>
      </div>

      {monthBudgets.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhum orçamento definido para {formatMonthLabel(activeMonth)}.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Estabeleça tetos mensais por categoria para receber alertas visuais ao se aproximar do limite.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {monthBudgets.map((b) => {
            const cat = catMap.get(b.categoryId);
            const spent = spentByCat.get(b.categoryId) ?? 0;
            const rawPct = b.limitCents > 0 ? Math.round((spent / b.limitCents) * 100) : 0;
            const barPct = Math.min(100, rawPct);
            const remaining = b.limitCents - spent;
            const statusText =
              rawPct > 100
                ? 'Limite excedido'
                : rawPct >= 80
                  ? 'Atenção ao limite'
                  : 'Dentro do orçamento';
            const statusColor =
              rawPct > 100
                ? 'text-[#DC2626]'
                : rawPct >= 80
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-[#16A34A]';

            return (
              <div
                key={b.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat?.color ?? '#2563EB' }}
                    >
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {cat?.name ?? 'Categoria'}
                      </h3>
                      <p className={`text-xs font-medium ${statusColor}`}>
                        {statusText} · {rawPct}% utilizado
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      aria-label="Editar orçamento"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(b)}
                      aria-label="Excluir orçamento"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      rawPct > 100
                        ? 'bg-[#DC2626]'
                        : rawPct >= 80
                          ? 'bg-amber-500'
                          : 'bg-[#16A34A]'
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-slate-600 dark:text-slate-300 font-mono">
                    Gasto: {formatCentsToBRL(spent)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    {remaining >= 0
                      ? `Disponível: ${formatCentsToBRL(remaining)}`
                      : `Excesso: ${formatCentsToBRL(Math.abs(remaining))}`}{' '}
                    / Limite: {formatCentsToBRL(b.limitCents)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Orçamento' : 'Definir Orçamento Mensal'}
        subtitle={`Referência: ${formatMonthLabel(activeMonth)}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Categoria de Despesa
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={Boolean(editing)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Limite Mensal (R$)
            </label>
            <input
              type="text"
              required
              inputMode="decimal"
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              {busy ? 'Salvando...' : 'Salvar Orçamento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Orçamento"
        description="Deseja remover este limite de orçamento?"
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
