import React, { useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  formatCentsToBRL,
  formatCentsToInput,
  formatDateBR,
  getTodayDateStr,
  parseBRLToCents,
} from '../lib/financeMath';
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from '../services/firestoreService';
import type { Transfer } from '../types/finance';

export function TransfersPage() {
  const { user } = useAuth();
  const { accounts, transfers } = useFinanceData();

  const activeAccounts = accounts.filter((a) => !a.archived);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [deleting, setDeleting] = useState<Transfer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(getTodayDateStr());
  const [description, setDescription] = useState('');

  const openCreate = () => {
    setError(null);
    setEditing(null);
    setFromAccountId(activeAccounts[0]?.id || '');
    setToAccountId(activeAccounts[1]?.id || activeAccounts[0]?.id || '');
    setAmountText('');
    setDate(getTodayDateStr());
    setDescription('Transferência entre contas');
    setModalOpen(true);
  };

  const openEdit = (tr: Transfer) => {
    setError(null);
    setEditing(tr);
    setFromAccountId(tr.fromAccountId);
    setToAccountId(tr.toAccountId);
    setAmountText(formatCentsToInput(tr.amountCents));
    setDate(tr.date);
    setDescription(tr.description);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const amountCents = parseBRLToCents(amountText);
    if (!fromAccountId || !toAccountId) {
      setError('Selecione as contas de origem e destino.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('A conta de origem e a conta de destino devem ser diferentes.');
      return;
    }
    if (amountCents <= 0) {
      setError('O valor da transferência deve ser maior que zero.');
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await updateTransfer(user.uid, editing.id, {
          fromAccountId,
          toAccountId,
          amountCents,
          date,
          description: description.trim() || 'Transferência entre contas',
        });
      } else {
        await createTransfer(user.uid, {
          fromAccountId,
          toAccountId,
          amountCents,
          date,
          description: description.trim() || 'Transferência entre contas',
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar transferência.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteTransfer(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const sortedTransfers = [...transfers].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Movimentações entre Contas Próprias
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transferências ajustam os saldos das contas envolvidas sem contar como receita ou despesa.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={activeAccounts.length < 2}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Transferência
        </button>
      </div>

      {activeAccounts.length < 2 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
          Cadastre pelo menos 2 contas financeiras ativas para realizar transferências entre elas.
        </div>
      )}

      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {sortedTransfers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhuma transferência registrada ainda.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use transferências para mover recursos entre sua conta corrente, poupança ou carteira.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Fluxo</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedTransfers.map((tr) => (
                  <tr
                    key={tr.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatDateBR(tr.date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {tr.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {accMap.get(tr.fromAccountId)?.name ?? 'Origem'}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        {accMap.get(tr.toAccountId)?.name ?? 'Destino'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCentsToBRL(tr.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(tr)}
                          aria-label="Editar transferência"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(tr)}
                          aria-label="Excluir transferência"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Transferência' : 'Nova Transferência'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Conta de Origem
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
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
                Conta de Destino
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0,00"
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
              {busy ? 'Salvando...' : 'Confirmar Transferência'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Transferência"
        description={`Deseja excluir a transferência "${deleting?.description ?? ''}"? Os saldos das duas contas serão recalculados.`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
