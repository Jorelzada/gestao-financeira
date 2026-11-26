import React, { useState } from 'react';
import { CheckCircle2, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  formatCentsToBRL,
  formatCentsToInput,
  getTodayDateStr,
  parseBRLToCents,
} from '../lib/financeMath';
import {
  createDebt,
  deleteDebt,
  registerDebtPayment,
  updateDebt,
} from '../services/firestoreService';
import type { Debt } from '../types/finance';

export function DebtsPage() {
  const { user } = useAuth();
  const { debts, accounts, categories } = useFinanceData();

  const activeAccounts = accounts.filter((a) => !a.archived);
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [creditor, setCreditor] = useState('');
  const [totalText, setTotalText] = useState('');
  const [remainingText, setRemainingText] = useState('');
  const [monthlyText, setMonthlyText] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [dueDay, setDueDay] = useState(10);

  const [payAmountText, setPayAmountText] = useState('');
  const [createTx, setCreateTx] = useState(true);
  const [payAccountId, setPayAccountId] = useState('');
  const [payCategoryId, setPayCategoryId] = useState('');
  const [payDate, setPayDate] = useState(getTodayDateStr());

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCreditor('');
    setTotalText('');
    setRemainingText('');
    setMonthlyText('');
    setInterestRate('0');
    setDueDay(10);
    setModalOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setName(d.name);
    setCreditor(d.creditor);
    setTotalText(formatCentsToInput(d.totalCents));
    setRemainingText(formatCentsToInput(d.remainingCents));
    setMonthlyText(formatCentsToInput(d.monthlyPaymentCents));
    setInterestRate(String(d.interestRatePercent));
    setDueDay(d.dueDay);
    setModalOpen(true);
  };

  const openPayModal = (d: Debt) => {
    setPayingDebt(d);
    setPayAmountText(
      formatCentsToInput(
        d.monthlyPaymentCents > 0
          ? Math.min(d.monthlyPaymentCents, d.remainingCents)
          : d.remainingCents
      )
    );
    setCreateTx(activeAccounts.length > 0 && expenseCategories.length > 0);
    setPayAccountId(activeAccounts[0]?.id || '');
    setPayCategoryId(expenseCategories[0]?.id || '');
    setPayDate(getTodayDateStr());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !creditor.trim()) return;
    const totalCents = parseBRLToCents(totalText);
    const remainingCents = parseBRLToCents(remainingText || totalText);
    const monthlyPaymentCents = parseBRLToCents(monthlyText);
    if (totalCents <= 0) return;

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        creditor: creditor.trim(),
        totalCents,
        remainingCents,
        monthlyPaymentCents,
        interestRatePercent: Math.max(0, Math.min(100, Number.parseFloat(interestRate) || 0)),
        dueDay,
      };
      if (editing) {
        await updateDebt(user.uid, editing, payload);
      } else {
        await createDebt(user.uid, payload);
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payingDebt) return;
    const payCents = parseBRLToCents(payAmountText);
    if (payCents <= 0) return;

    setBusy(true);
    try {
      await registerDebtPayment(user.uid, payingDebt, payCents, {
        createTransaction: createTx,
        accountId: payAccountId,
        categoryId: payCategoryId,
        date: payDate,
      });
      setPayingDebt(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteDebt(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const totalRemaining = debts
    .filter((d) => d.status === 'active')
    .reduce((s, d) => s + d.remainingCents, 0);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo Devedor Total ({debts.filter((d) => d.status === 'active').length} ativa(s))
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#DC2626]">
            {formatCentsToBRL(totalRemaining)}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Dívida
        </button>
      </div>

      {debts.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhuma dívida ou financiamento cadastrado.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre empréstimos ou financiamentos para acompanhar amortizações e impacto no seu patrimônio líquido.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map((d) => {
            const paidCents = Math.max(0, d.totalCents - d.remainingCents);
            const pct =
              d.totalCents > 0 ? Math.min(100, Math.round((paidCents / d.totalCents) * 100)) : 0;

            return (
              <div
                key={d.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-[#DC2626] flex items-center justify-center shrink-0">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {d.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Credor: {d.creditor} · Vence dia {d.dueDay} · Juros {d.interestRatePercent}% a.m.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      aria-label="Editar dívida"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(d)}
                      aria-label="Excluir dívida"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Amortizado: {pct}%
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#DC2626]">
                      Restante: {formatCentsToBRL(d.remainingCents)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#16A34A]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Parcela prevista: {formatCentsToBRL(d.monthlyPaymentCents)}
                  </span>

                  {d.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Quitada
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPayModal(d)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20"
                    >
                      Registrar Pagamento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Dívida' : 'Nova Dívida'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descrição
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Financiamento Veículo"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Credor
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Ex.: Banco X"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Original (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={totalText}
                onChange={(e) => setTotalText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Saldo Devedor (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={remainingText}
                onChange={(e) => setRemainingText(e.target.value)}
                placeholder="Igual ao original"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Parcela Mensal (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={monthlyText}
                onChange={(e) => setMonthlyText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Taxa de Juros (% a.m.)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dia de Vencimento (1-28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={dueDay}
                onChange={(e) => setDueDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              {busy ? 'Salvando...' : 'Salvar Dívida'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(payingDebt)}
        title={`Registrar Amortização — ${payingDebt?.name ?? ''}`}
        onClose={() => setPayingDebt(null)}
      >
        <form onSubmit={(e) => void handlePay(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Pago (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={payAmountText}
                onChange={(e) => setPayAmountText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Data
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={createTx}
              onChange={(e) => setCreateTx(e.target.checked)}
              disabled={activeAccounts.length === 0 || expenseCategories.length === 0}
            />
            Registrar também como lançamento de despesa na conta
          </label>

          {createTx && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conta Pagadora
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={payCategoryId}
                  onChange={(e) => setPayCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPayingDebt(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#16A34A] hover:bg-green-700 text-white"
            >
              {busy ? 'Registrando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Dívida"
        description={`Deseja excluir a dívida "${deleting?.name ?? ''}"?`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
