import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  formatCentsToBRL,
  formatCentsToInput,
  getTodayDateStr,
  parseBRLToCents,
  splitInstallmentsInCents,
} from '../lib/financeMath';
import {
  createTransactionOrInstallments,
  updateTransaction,
} from '../services/firestoreService';
import type {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import { Modal } from './ui/Modal';

interface TransactionModalProps {
  open: boolean;
  editingTransaction?: Transaction | null;
  defaultType?: TransactionType;
  defaultPaymentMethod?: PaymentMethod;
  onClose: () => void;
}

export function TransactionModal({
  open,
  editingTransaction,
  defaultType = 'expense',
  defaultPaymentMethod = 'account',
  onClose,
}: TransactionModalProps) {
  const { user } = useAuth();
  const { accounts, cards, categories } = useFinanceData();

  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  const [type, setType] = useState<TransactionType>(defaultType);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(getTodayDateStr());
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description);
      setAmountText(formatCentsToInput(editingTransaction.amountCents));
      setDate(editingTransaction.date);
      setCategoryId(editingTransaction.categoryId);
      setPaymentMethod(editingTransaction.paymentMethod);
      setAccountId(editingTransaction.accountId || activeAccounts[0]?.id || '');
      setCardId(editingTransaction.cardId || activeCards[0]?.id || '');
      setStatus(editingTransaction.status);
      setInstallmentsCount(1);
      setNotes(editingTransaction.notes);
    } else {
      setType(defaultType);
      setDescription('');
      setAmountText('');
      setDate(getTodayDateStr());
      const firstCat = categories.find((c) => c.type === defaultType);
      setCategoryId(firstCat?.id || '');
      setPaymentMethod(
        defaultType === 'income'
          ? 'account'
          : defaultPaymentMethod === 'card' && activeCards.length > 0
            ? 'card'
            : 'account'
      );
      setAccountId(activeAccounts[0]?.id || '');
      setCardId(activeCards[0]?.id || '');
      setStatus('paid');
      setInstallmentsCount(1);
      setNotes('');
    }
  }, [open, editingTransaction, defaultType, defaultPaymentMethod]);

  useEffect(() => {
    if (!open) return;
    const validForType = categories.filter((c) => c.type === type);
    if (validForType.length > 0 && !validForType.some((c) => c.id === categoryId)) {
      setCategoryId(validForType[0].id);
    }
    if (type === 'income' && paymentMethod === 'card') {
      setPaymentMethod('account');
    }
  }, [type, categories, categoryId, paymentMethod, open]);

  const totalCents = parseBRLToCents(amountText);
  const perInstallmentPreview =
    installmentsCount > 1 && totalCents > 0
      ? splitInstallmentsInCents(totalCents, installmentsCount)[0]
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!description.trim()) {
      setError('Informe uma descrição para o lançamento.');
      return;
    }
    if (totalCents <= 0) {
      setError('O valor deve ser maior que zero.');
      return;
    }
    if (!categoryId) {
      setError('Selecione ou crie uma categoria primeiro.');
      return;
    }
    if (paymentMethod === 'account' && !accountId) {
      setError('Selecione uma conta financeira.');
      return;
    }
    if (paymentMethod === 'card' && !cardId) {
      setError('Selecione um cartão de crédito.');
      return;
    }

    const selectedCard = cards.find((c) => c.id === cardId);

    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(user.uid, editingTransaction.id, {
          type,
          description: description.trim(),
          amountCents: totalCents,
          date,
          categoryId,
          paymentMethod,
          accountId: paymentMethod === 'account' ? accountId : '',
          cardId: paymentMethod === 'card' ? cardId : '',
          cardClosingDay: selectedCard?.closingDay ?? 10,
          status: paymentMethod === 'card' ? editingTransaction.status : status,
          notes,
        });
      } else {
        await createTransactionOrInstallments(user.uid, {
          type,
          description: description.trim(),
          totalAmountCents: totalCents,
          date,
          categoryId,
          paymentMethod,
          accountId: paymentMethod === 'account' ? accountId : '',
          cardId: paymentMethod === 'card' ? cardId : '',
          cardClosingDay: selectedCard?.closingDay ?? 10,
          status,
          installmentsCount,
          notes,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
      subtitle="Valores armazenados em centavos exatos para precisão financeira."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Type Segmented Control */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-900 text-[#DC2626] shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              type === 'income'
                ? 'bg-white dark:bg-slate-900 text-[#16A34A] shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Receita
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Supermercado, Salário, Notebook..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {installmentsCount > 1 ? 'Valor Total (R$)' : 'Valor (R$)'}
            </label>
            <input
              type="text"
              required
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Categoria
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {type === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="account">Conta / Saldo</option>
                <option value="card" disabled={activeCards.length === 0}>
                  {activeCards.length === 0
                    ? 'Cartão (cadastre um cartão primeiro)'
                    : 'Cartão de Crédito'}
                </option>
              </select>
            </div>
          )}

          {paymentMethod === 'account' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Conta Financeira
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cartão de Crédito
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                {activeCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name} ({card.brand})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentMethod === 'account' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="paid">
                  {type === 'income' ? 'Recebida (já entrou na conta)' : 'Paga'}
                </option>
                <option value="pending">
                  {type === 'income' ? 'Pendente (a receber)' : 'Pendente (a pagar)'}
                </option>
              </select>
            </div>
          )}

          {!editingTransaction && type === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Parcelas
              </label>
              <input
                type="number"
                min={1}
                max={72}
                value={installmentsCount}
                onChange={(e) =>
                  setInstallmentsCount(Math.max(1, Math.min(72, Number(e.target.value) || 1)))
                }
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
              {installmentsCount > 1 && totalCents > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {installmentsCount}x de {formatCentsToBRL(perInstallmentPreview)}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
          >
            {saving
              ? 'Salvando...'
              : editingTransaction
                ? 'Salvar Alterações'
                : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
