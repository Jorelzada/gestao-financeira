import React, { useState } from 'react';
import { Archive, Landmark, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeAccountBalanceCents,
  formatCentsToBRL,
  formatCentsToInput,
  parseBRLToCents,
} from '../lib/financeMath';
import {
  createAccount,
  deleteAccount,
  toggleAccountArchived,
  updateAccount,
} from '../services/firestoreService';
import type { Account, AccountType } from '../types/finance';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  wallet: 'Carteira / Dinheiro',
  investment: 'Conta Investimento',
};

const COLOR_OPTIONS = ['#2563EB', '#16A34A', '#0F172A', '#7C3AED', '#EA580C', '#0284C7'];

export function AccountsPage() {
  const { user } = useAuth();
  const { accounts, transactions, transfers, invoicePayments } = useFinanceData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [initialBalanceText, setInitialBalanceText] = useState('0,00');
  const [color, setColor] = useState('#2563EB');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setInstitution('');
    setType('checking');
    setInitialBalanceText('0,00');
    setColor('#2563EB');
    setModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setName(acc.name);
    setInstitution(acc.institution);
    setType(acc.type);
    setInitialBalanceText(formatCentsToInput(acc.initialBalanceCents));
    setColor(acc.color);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const initialBalanceCents = parseBRLToCents(initialBalanceText);
      if (editing) {
        await updateAccount(user.uid, editing.id, {
          name: name.trim(),
          institution: institution.trim(),
          type,
          initialBalanceCents,
          color,
        });
      } else {
        await createAccount(user.uid, {
          name: name.trim(),
          institution: institution.trim(),
          type,
          initialBalanceCents,
          color,
        });
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteAccount(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);
  const totalBalance = activeAccounts.reduce(
    (sum, a) => sum + computeAccountBalanceCents(a, transactions, transfers, invoicePayments),
    0
  );

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo Total Consolidado ({activeAccounts.length} contas ativas)
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(totalBalance)}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeAccounts.map((acc) => {
          const currentBalance = computeAccountBalanceCents(
            acc,
            transactions,
            transfers,
            invoicePayments
          );
          return (
            <div
              key={acc.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: acc.color }}
                  >
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {acc.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {ACCOUNT_TYPE_LABELS[acc.type]}
                      {acc.institution ? ` · ${acc.institution}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(acc)}
                    aria-label="Editar conta"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => user && void toggleAccountArchived(user.uid, acc.id, true)}
                    aria-label="Arquivar conta"
                    title="Arquivar conta"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(acc)}
                    aria-label="Excluir conta"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Saldo Atual
                </span>
                <span
                  className={`text-lg font-bold font-mono tabular-nums ${
                    currentBalance >= 0
                      ? 'text-slate-900 dark:text-white'
                      : 'text-[#DC2626]'
                  }`}
                >
                  {formatCentsToBRL(currentBalance)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {archivedAccounts.length > 0 && (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Contas Arquivadas ({archivedAccounts.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {archivedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="py-2.5 flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {acc.name} · {ACCOUNT_TYPE_LABELS[acc.type]}
                </span>
                <button
                  type="button"
                  onClick={() => user && void toggleAccountArchived(user.uid, acc.id, false)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Conta Financeira' : 'Nova Conta Financeira'}
        subtitle="Informe apenas um apelido identificador. Nunca solicitamos agência ou número bancário."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da Conta
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Conta Corrente Principal"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="checking">Conta Corrente</option>
                <option value="savings">Poupança</option>
                <option value="wallet">Carteira / Dinheiro</option>
                <option value="investment">Conta Investimento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instituição (opcional)
              </label>
              <input
                type="text"
                maxLength={60}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Ex.: Banco Digital"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Saldo Inicial (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={initialBalanceText}
              onChange={(e) => setInitialBalanceText(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cor de identificação
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#2563EB] scale-105' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
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
              {busy ? 'Salvando...' : 'Salvar Conta'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Conta"
        description={`Deseja excluir a conta "${deleting?.name ?? ''}"? Os lançamentos, transferências e recorrências vinculados a ela também serão removidos (para manter o histórico, use a opção Arquivar).`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
