import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat,
  Trash2,
  Zap,
} from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  buildRecurrenceDateStr,
  formatCentsToBRL,
  formatCentsToInput,
  formatDateBR,
  formatMonthLabel,
  getTodayDateStr,
  parseBRLToCents,
  resolveRecurrenceTransactionStatus,
  shiftMonth,
} from '../lib/financeMath';
import {
  createRecurrence,
  deleteRecurrence,
  generateTransactionFromRecurrence,
  toggleRecurrenceActive,
  toggleTransactionStatus,
  updateRecurrence,
} from '../services/firestoreService';
import type {
  PaymentMethod,
  Recurrence,
  RecurrenceFrequency,
  TransactionType,
} from '../types/finance';

export function RecurrencesPage() {
  const { user } = useAuth();
  const { activeMonth, recurrences, transactions, categories, accounts, cards } = useFinanceData();

  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Recurrence | null>(null);
  const [deleting, setDeleting] = useState<Recurrence | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('account');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateStr());
  const [dayOfMonth, setDayOfMonth] = useState(() => Number.parseInt(getTodayDateStr().slice(8, 10), 10) || 5);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');

  useEffect(() => {
    const valid = categories.filter((c) => c.type === type);
    if (valid.length > 0 && !valid.some((c) => c.id === categoryId)) {
      setCategoryId(valid[0].id);
    }
    if (type === 'income' && paymentMethod === 'card') {
      setPaymentMethod('account');
    }
  }, [type, categories, categoryId, paymentMethod]);

  const openCreate = () => {
    const today = getTodayDateStr();
    setEditing(null);
    setType('expense');
    setDescription('');
    setAmountText('');
    setCategoryId(categories.find((c) => c.type === 'expense')?.id || '');
    setPaymentMethod('account');
    setAccountId(activeAccounts[0]?.id || '');
    setCardId(activeCards[0]?.id || '');
    setStartDate(today);
    setDayOfMonth(Number.parseInt(today.slice(8, 10), 10) || 5);
    setFrequency('monthly');
    setModalOpen(true);
  };

  const openEdit = (rec: Recurrence) => {
    setEditing(rec);
    setType(rec.type);
    setDescription(rec.description);
    setAmountText(formatCentsToInput(rec.amountCents));
    setCategoryId(rec.categoryId);
    setPaymentMethod(rec.paymentMethod);
    setAccountId(rec.accountId || activeAccounts[0]?.id || '');
    setCardId(rec.cardId || activeCards[0]?.id || '');
    setStartDate(buildRecurrenceDateStr(activeMonth, rec.dayOfMonth));
    setDayOfMonth(rec.dayOfMonth);
    setFrequency(rec.frequency);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !description.trim()) return;
    const amountCents = parseBRLToCents(amountText);
    if (amountCents <= 0) return;

    setBusy(true);
    try {
      if (editing) {
        await updateRecurrence(user.uid, editing.id, {
          type,
          description: description.trim(),
          amountCents,
          categoryId,
          paymentMethod,
          accountId: paymentMethod === 'account' ? accountId : '',
          cardId: paymentMethod === 'card' ? cardId : '',
          dayOfMonth,
          frequency,
          active: editing.active,
        });
      } else {
        const closingDay = cardId ? cardMap.get(cardId)?.closingDay : undefined;
        await createRecurrence(user.uid, {
          type,
          description: description.trim(),
          amountCents,
          categoryId,
          paymentMethod,
          accountId: paymentMethod === 'account' ? accountId : '',
          cardId: paymentMethod === 'card' ? cardId : '',
          cardClosingDay: closingDay,
          startDate,
          frequency,
        });
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateOne = async (rec: Recurrence) => {
    if (!user) return;
    setBusy(true);
    try {
      const closingDay = rec.cardId ? cardMap.get(rec.cardId)?.closingDay : undefined;
      await generateTransactionFromRecurrence(user.uid, rec, activeMonth, closingDay);
    } finally {
      setBusy(false);
    }
  };

  const hasTxInMonth = (recId: string, monthKey: string) =>
    transactions.find((tx) => tx.recurrenceId === recId && tx.date.slice(0, 7) === monthKey);

  const pendingForActiveMonth = recurrences.filter(
    (r) => r.active && !hasTxInMonth(r.id, activeMonth)
  );

  const handleGenerateAllPending = async () => {
    if (!user) return;
    setBusy(true);
    try {
      for (const rec of pendingForActiveMonth) {
        const closingDay = rec.cardId ? cardMap.get(rec.cardId)?.closingDay : undefined;
        await generateTransactionFromRecurrence(user.uid, rec, activeMonth, closingDay);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteRecurrence(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const todayStr = getTodayDateStr();
  const previewBaseMonth = startDate.slice(0, 7);
  const previewNextMonth = shiftMonth(previewBaseMonth, 1);
  const previewBaseStatus = resolveRecurrenceTransactionStatus(startDate, todayStr);
  const previewDay = Number.parseInt(startDate.slice(8, 10), 10) || 1;
  const previewNextDate = buildRecurrenceDateStr(previewNextMonth, previewDay);
  const previewNextStatus = resolveRecurrenceTransactionStatus(previewNextDate, todayStr);

  const nextOfActiveMonth = shiftMonth(activeMonth, 1);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Modelos Recorrentes ({recurrences.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ao cadastrar uma recorrência com sua data, o sistema define automaticamente como paga ou a pagar conforme o dia de hoje e já replica para o mês seguinte.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pendingForActiveMonth.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGenerateAllPending()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] hover:bg-green-700 text-white whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              Gerar {pendingForActiveMonth.length} Pendente(s) em {activeMonth}
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nova Recorrência
          </button>
        </div>
      </div>

      {recurrences.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhuma recorrência cadastrada.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastre despesas e receitas fixas com a data de vencimento; o sistema marca automaticamente o status e agenda no mês seguinte.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurrences.map((rec) => {
            const txActive = hasTxInMonth(rec.id, activeMonth);
            const txNext = hasTxInMonth(rec.id, nextOfActiveMonth);
            const expectedDateActive = buildRecurrenceDateStr(activeMonth, rec.dayOfMonth);
            const autoExpectedStatus = resolveRecurrenceTransactionStatus(expectedDateActive, todayStr);

            return (
              <div
                key={rec.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {rec.description}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Todo dia {rec.dayOfMonth} · {catMap.get(rec.categoryId)?.name ?? 'Outros'} ·{' '}
                        {rec.active ? 'Ativa' : 'Pausada'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-0.5">
                        {txActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              user &&
                              void toggleTransactionStatus(
                                user.uid,
                                txActive.id,
                                txActive.status === 'paid' ? 'pending' : 'paid'
                              )
                            }
                            className={`inline-flex items-center gap-1 font-semibold ${
                              txActive.status === 'paid'
                                ? 'text-[#16A34A]'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                            title="Clique para alternar o status neste mês"
                          >
                            {txActive.status === 'paid' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {rec.type === 'income' ? 'Recebida' : 'Paga'} ({formatDateBR(txActive.date)})
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {rec.type === 'income' ? 'A receber' : 'A pagar'} ({formatDateBR(txActive.date)})
                                </span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            Previsto em {formatDateBR(expectedDateActive)}:{' '}
                            <strong
                              className={
                                autoExpectedStatus === 'paid'
                                  ? 'text-[#16A34A]'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {autoExpectedStatus === 'paid'
                                ? rec.type === 'income'
                                  ? 'Recebida'
                                  : 'Paga'
                                : rec.type === 'income'
                                  ? 'A receber'
                                  : 'A pagar'}
                            </strong>
                          </span>
                        )}

                        {txNext && (
                          <span className="text-slate-500 dark:text-slate-400">
                            · Próx. mês ({nextOfActiveMonth}):{' '}
                            {txNext.status === 'paid'
                              ? rec.type === 'income'
                                ? 'Recebida'
                                : 'Paga'
                              : rec.type === 'income'
                                ? 'A receber'
                                : 'A pagar'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-base font-bold whitespace-nowrap ${
                      rec.type === 'income' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {rec.type === 'income' ? '+' : '-'}
                    {formatCentsToBRL(rec.amountCents)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={busy || !rec.active || Boolean(txActive)}
                    onClick={() => void handleGenerateOne(rec)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      txActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default'
                        : 'bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20 disabled:opacity-50'
                    }`}
                  >
                    {txActive
                      ? `Lançada em ${activeMonth}`
                      : `Lançar em ${activeMonth}`}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        user && void toggleRecurrenceActive(user.uid, rec.id, !rec.active)
                      }
                      aria-label={rec.active ? 'Pausar recorrência' : 'Ativar recorrência'}
                      title={rec.active ? 'Pausar' : 'Ativar'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {rec.active ? (
                        <PauseCircle className="w-4 h-4" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(rec)}
                      aria-label="Editar recorrência"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(rec)}
                      aria-label="Excluir recorrência"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Recorrência' : 'Nova Recorrência'}
        subtitle={
          editing
            ? 'Altere os dados padrão das próximas ocorrências.'
            : 'O status (paga ou a pagar) é detectado pela data escolhida em relação a hoje e replicado ao mês seguinte.'
        }
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-semibold rounded-md ${
                type === 'expense'
                  ? 'bg-white dark:bg-slate-900 text-[#DC2626] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Despesa / Dívida Fixa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-semibold rounded-md ${
                type === 'income'
                  ? 'bg-white dark:bg-slate-900 text-[#16A34A] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Receita Fixa
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Aluguel, Internet, Financiamento, Salário..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {editing ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dia do Mês (1-31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value) || 1)))
                  }
                  className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data de Referência
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStartDate(next);
                    const parsedDay = Number.parseInt(next.slice(8, 10), 10);
                    if (Number.isFinite(parsedDay)) {
                      setDayOfMonth(Math.max(1, Math.min(31, parsedDay)));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Frequência
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {categories
                  .filter((c) => c.type === type)
                  .map((cat) => (
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="account">Conta</option>
                  <option value="card" disabled={activeCards.length === 0}>
                    Cartão de Crédito
                  </option>
                </select>
              </div>
            )}

            {paymentMethod === 'account' ? (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Conta
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cartão
                </label>
                <select
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {activeCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!editing && startDate && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">
                Detecção automática (hoje é {formatDateBR(todayStr)}):
              </p>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Em {formatDateBR(startDate)}:</span>
                <span
                  className={`font-semibold ${
                    previewBaseStatus === 'paid'
                      ? 'text-[#16A34A]'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {previewBaseStatus === 'paid'
                    ? type === 'income'
                      ? 'Recebida automaticamente'
                      : 'Paga automaticamente'
                    : type === 'income'
                      ? 'Pendente (A receber)'
                      : 'A pagar (Pendente)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Mês seguinte ({formatDateBR(previewNextDate)}):</span>
                <span
                  className={`font-semibold ${
                    previewNextStatus === 'paid'
                      ? 'text-[#16A34A]'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {previewNextStatus === 'paid'
                    ? type === 'income'
                      ? 'Adicionada como Recebida'
                      : 'Adicionada como Paga'
                    : type === 'income'
                      ? 'Adicionada como Pendente (A receber)'
                      : 'Adicionada como A pagar'}
                </span>
              </div>
            </div>
          )}

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
              {busy ? 'Salvando...' : 'Salvar Recorrência'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Recorrência"
        description={`Deseja excluir o modelo recorrente "${deleting?.description ?? ''}"? Lançamentos já gerados serão mantidos.`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
