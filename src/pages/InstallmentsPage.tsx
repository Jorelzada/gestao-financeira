import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Plus, Trash2 } from 'lucide-react';
import { TransactionModal } from '../components/TransactionModal';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeInstallmentGroups,
  formatCentsToBRL,
  formatDateBR,
} from '../lib/financeMath';
import {
  deleteInstallmentGroup,
  toggleTransactionStatus,
} from '../services/firestoreService';
import type { InstallmentGroupSummary } from '../types/finance';

export function InstallmentsPage() {
  const { user } = useAuth();
  const { transactions, categories, accounts, cards } = useFinanceData();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<InstallmentGroupSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const groups = useMemo(
    () => computeInstallmentGroups(transactions),
    [transactions]
  );

  const totalRemainingCents = groups.reduce((s, g) => s + g.remainingCents, 0);

  const handleDeleteGroup = async () => {
    if (!user || !deletingGroup) return;
    setBusy(true);
    try {
      await deleteInstallmentGroup(
        user.uid,
        deletingGroup.items.map((i) => i.id)
      );
      setDeletingGroup(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo Total a Pagar em Parcelamentos ({groups.length} compra(s))
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(totalRemainingCents)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Compra Parcelada
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhuma compra parcelada registrada.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ao registrar uma despesa com 2 ou mais parcelas, todas as parcelas mensais são criadas automaticamente em centavos exatos.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar Parcelamento
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isExpanded = expandedId === group.groupId;
            const pct = Math.round((group.paidCount / group.totalInstallments) * 100);
            const origin =
              group.paymentMethod === 'card'
                ? cardMap.get(group.cardId)?.name ?? 'Cartão'
                : accMap.get(group.accountId)?.name ?? 'Conta';

            return (
              <div
                key={group.groupId}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {group.description}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {catMap.get(group.categoryId)?.name ?? 'Outros'} · {origin} ·{' '}
                        {group.paidCount}/{group.totalInstallments} pagas ({pct}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Restante de {formatCentsToBRL(group.totalCents)}
                      </p>
                      <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCentsToBRL(group.remainingCents)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : group.groupId)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {isExpanded ? (
                          <>
                            Ocultar <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Parcelas <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingGroup(group)}
                        aria-label="Excluir parcelamento completo"
                        className="p-2 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-left">
                          <th className="px-5 py-2.5 font-medium">Parcela</th>
                          <th className="px-4 py-2.5 font-medium">Vencimento / Data</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5 font-medium text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {group.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                              {item.installmentNumber}/{item.totalInstallments}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatDateBR(item.date)}
                              {item.invoiceMonth ? ` · Fatura ${item.invoiceMonth}` : ''}
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  user &&
                                  void toggleTransactionStatus(
                                    user.uid,
                                    item.id,
                                    item.status === 'paid' ? 'pending' : 'paid'
                                  )
                                }
                                className={`font-medium ${
                                  item.status === 'paid'
                                    ? 'text-[#16A34A]'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {item.status === 'paid' ? 'Pago' : 'Pendente'}
                              </button>
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              {formatCentsToBRL(item.amountCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TransactionModal
        open={modalOpen}
        defaultType="expense"
        defaultPaymentMethod={cards.length > 0 ? 'card' : 'account'}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deletingGroup)}
        title="Excluir Parcelamento Completo"
        description={`Deseja excluir todas as ${deletingGroup?.totalInstallments ?? 0} parcelas de "${deletingGroup?.description ?? ''}"?`}
        confirmLabel="Excluir Todas"
        danger
        busy={busy}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={() => void handleDeleteGroup()}
      />
    </div>
  );
}
