import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, RotateCcw } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeCardInvoices,
  formatCentsToBRL,
  formatDateBR,
  formatMonthLabel,
  getTodayDateStr,
} from '../lib/financeMath';
import { payCardInvoice, revertInvoicePayment } from '../services/firestoreService';
import type { CardInvoiceSummary } from '../types/finance';

export function InvoicesPage() {
  const { user } = useAuth();
  const { cards, transactions, invoicePayments, accounts, categories } =
    useFinanceData();

  const [selectedCardId, setSelectedCardId] = useState('all');
  const [payingInvoice, setPayingInvoice] = useState<CardInvoiceSummary | null>(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [payDate, setPayDate] = useState(getTodayDateStr());
  const [busy, setBusy] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const invoices = useMemo(() => {
    const all = computeCardInvoices(cards, transactions, invoicePayments);
    if (selectedCardId === 'all') return all;
    return all.filter((inv) => inv.cardId === selectedCardId);
  }, [cards, transactions, invoicePayments, selectedCardId]);

  const openPayModal = (inv: CardInvoiceSummary) => {
    setPayingInvoice(inv);
    setPayAccountId(activeAccounts[0]?.id || '');
    setPayDate(getTodayDateStr());
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payingInvoice || !payAccountId) return;
    setBusy(true);
    try {
      await payCardInvoice(user.uid, payingInvoice, payAccountId, payDate);
      setPayingInvoice(null);
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async (inv: CardInvoiceSummary) => {
    if (!user) return;
    setBusy(true);
    try {
      await revertInvoicePayment(user.uid, inv);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Faturas de Cartão de Crédito
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ao pagar uma fatura, o saldo da conta escolhida é debitado sem duplicar as compras nos relatórios de despesas.
          </p>
        </div>

        <select
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        >
          <option value="all">Todos os cartões</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {invoices.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhuma fatura gerada até o momento.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre despesas utilizando um cartão de crédito para visualizar os ciclos de fatura aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const statusLabel =
              inv.status === 'paid'
                ? 'Fatura Paga'
                : inv.status === 'closed'
                  ? 'Fatura Fechada'
                  : 'Fatura Aberta';
            const statusColor =
              inv.status === 'paid'
                ? 'text-[#16A34A]'
                : inv.status === 'closed'
                  ? 'text-[#DC2626]'
                  : 'text-[#2563EB]';

            return (
              <div
                key={inv.key}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: inv.cardColor }}
                    >
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {inv.cardName} · {formatMonthLabel(inv.invoiceMonth)}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                        {' · '}
                        Fecha dia {inv.closingDay} · Vence dia {inv.dueDay}
                        {' · '}
                        {inv.transactions.length} lançamento(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total da Fatura</p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCentsToBRL(inv.totalCents)}
                      </p>
                    </div>

                    {inv.status === 'paid' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRevert(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Estornar Pagamento
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={activeAccounts.length === 0}
                        onClick={() => openPayModal(inv)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] hover:bg-green-700 text-white disabled:opacity-50 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pagar Fatura
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {inv.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                            {formatDateBR(tx.date)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                            {tx.description}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {catMap.get(tx.categoryId)?.name ?? 'Outros'}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatCentsToBRL(tx.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(payingInvoice)}
        title="Pagar Fatura do Cartão"
        subtitle={
          payingInvoice
            ? `${payingInvoice.cardName} · ${formatMonthLabel(payingInvoice.invoiceMonth)}`
            : undefined
        }
        onClose={() => setPayingInvoice(null)}
      >
        <form onSubmit={(e) => void handleConfirmPay(e)} className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-300">Valor a debitar</span>
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCentsToBRL(payingInvoice?.totalCents ?? 0)}
            </span>
          </div>

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
              Data do Pagamento
            </label>
            <input
              type="date"
              required
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPayingInvoice(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#16A34A] hover:bg-green-700 text-white"
            >
              {busy ? 'Quitando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
