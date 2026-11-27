import React, { useMemo, useState } from 'react';
import { CreditCard as CardIcon, Layers, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeCardInvoices,
  computeCardLimitBreakdown,
  formatCentsToBRL,
  formatCentsToInput,
  formatMonthLabel,
  formatShortMonth,
  parseBRLToCents,
} from '../lib/financeMath';
import {
  createCard,
  deleteCard,
  recordCardTotalSpend,
  updateCard,
} from '../services/firestoreService';
import type { CreditCard } from '../types/finance';

const CARD_COLORS = ['#0F172A', '#2563EB', '#7C3AED', '#047857', '#B91C1C', '#334155'];

export function CardsPage() {
  const { user } = useAuth();
  const { activeMonth, cards, transactions, invoicePayments, categories } = useFinanceData();

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [deleting, setDeleting] = useState<CreditCard | null>(null);
  const [busy, setBusy] = useState(false);

  // Card create/edit form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Mastercard');
  const [limitText, setLimitText] = useState('3000,00');
  const [initialSpendText, setInitialSpendText] = useState('0,00');
  const [initialAvailableText, setInitialAvailableText] = useState('3000,00');
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(17);
  const [color, setColor] = useState('#0F172A');

  // Individual card spend & limit modal state
  const [spendCard, setSpendCard] = useState<CreditCard | null>(null);
  const [spendMode, setSpendMode] = useState<'set_total' | 'add'>('set_total');
  const [spendMonth, setSpendMonth] = useState(activeMonth);
  const [spendLimitText, setSpendLimitText] = useState('');
  const [spendMonthlyText, setSpendMonthlyText] = useState('');
  const [spendAvailableText, setSpendAvailableText] = useState('');
  const [spendAddAmountText, setSpendAddAmountText] = useState('');
  const [spendCategoryId, setSpendCategoryId] = useState('');
  const [spendDescription, setSpendDescription] = useState('');
  const [spendError, setSpendError] = useState<string | null>(null);

  const invoices = useMemo(
    () => computeCardInvoices(cards, transactions, invoicePayments),
    [cards, transactions, invoicePayments]
  );

  const cardBreakdowns = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCardLimitBreakdown>>();
    for (const card of cards) {
      map.set(card.id, computeCardLimitBreakdown(card, activeMonth, transactions, invoices));
    }
    return map;
  }, [cards, activeMonth, transactions, invoices]);

  const defaultExpenseCategoryId =
    expenseCategories.find((c) => c.name.toLowerCase().includes('compra'))?.id ||
    expenseCategories[0]?.id ||
    '';

  const openCreate = () => {
    setEditing(null);
    setName('');
    setBrand('Mastercard');
    setLimitText('3000,00');
    setInitialSpendText('0,00');
    setInitialAvailableText('3000,00');
    setClosingDay(10);
    setDueDay(17);
    setColor('#0F172A');
    setModalOpen(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditing(card);
    setName(card.name);
    setBrand(card.brand);
    setLimitText(formatCentsToInput(card.limitCents));
    setInitialSpendText('');
    setInitialAvailableText('');
    setClosingDay(card.closingDay);
    setDueDay(card.dueDay);
    setColor(card.color);
    setModalOpen(true);
  };

  // Create-modal 3-field sync handlers (for new card with 0 active installments)
  const handleCreateLimitChange = (val: string) => {
    setLimitText(val);
    if (editing) return;
    const limitCents = Math.max(0, parseBRLToCents(val));
    const spendCents = Math.max(0, parseBRLToCents(initialSpendText));
    setInitialAvailableText(formatCentsToInput(Math.max(0, limitCents - spendCents)));
  };

  const handleCreateSpendChange = (val: string) => {
    setInitialSpendText(val);
    const limitCents = Math.max(0, parseBRLToCents(limitText));
    const spendCents = Math.max(0, parseBRLToCents(val));
    setInitialAvailableText(formatCentsToInput(Math.max(0, limitCents - spendCents)));
  };

  const handleCreateAvailableChange = (val: string) => {
    setInitialAvailableText(val);
    const limitCents = Math.max(0, parseBRLToCents(limitText));
    const availCents = Math.max(0, parseBRLToCents(val));
    setInitialSpendText(formatCentsToInput(Math.max(0, limitCents - availCents)));
  };

  const openSpendModal = (card: CreditCard) => {
    const breakdown = computeCardLimitBreakdown(card, activeMonth, transactions, invoices);
    setSpendCard(card);
    setSpendMode('set_total');
    setSpendMonth(activeMonth);
    setSpendLimitText(formatCentsToInput(breakdown.limitCents));
    setSpendMonthlyText(formatCentsToInput(breakdown.monthlySpendCents));
    setSpendAvailableText(formatCentsToInput(breakdown.availableLimitCents));
    setSpendAddAmountText('');
    setSpendCategoryId(defaultExpenseCategoryId);
    setSpendDescription(`Gasto Total — ${card.name}`);
    setSpendError(null);
  };

  const spendBreakdown = useMemo(() => {
    if (!spendCard) return null;
    return computeCardLimitBreakdown(spendCard, spendMonth, transactions, invoices);
  }, [spendCard, spendMonth, transactions, invoices]);

  const handleSpendMonthChange = (nextMonth: string) => {
    setSpendMonth(nextMonth);
    setSpendError(null);
    if (!spendCard) return;
    const nextBreakdown = computeCardLimitBreakdown(spendCard, nextMonth, transactions, invoices);
    if (spendMode === 'set_total') {
      const currentLimitCents = Math.max(0, parseBRLToCents(spendLimitText));
      const committedWithoutMonthSpend =
        nextBreakdown.activeInstallmentsCents + nextBreakdown.otherMonthsNonInstallmentCents;
      const nextAvail = Math.max(
        0,
        currentLimitCents - nextBreakdown.monthlySpendCents - committedWithoutMonthSpend
      );
      setSpendMonthlyText(formatCentsToInput(nextBreakdown.monthlySpendCents));
      setSpendAvailableText(formatCentsToInput(nextAvail));
    }
  };

  // Spend-modal 3-field sync handlers (taking activeInstallments + otherMonths into account)
  const committedOutsideMonthlyCents = spendBreakdown
    ? spendBreakdown.activeInstallmentsCents + spendBreakdown.otherMonthsNonInstallmentCents
    : 0;

  const handleSpendLimitChange = (val: string) => {
    setSpendLimitText(val);
    setSpendError(null);
    const newLimit = Math.max(0, parseBRLToCents(val));
    const curMonthly = Math.max(0, parseBRLToCents(spendMonthlyText));
    const nextAvail = Math.max(0, newLimit - curMonthly - committedOutsideMonthlyCents);
    setSpendAvailableText(formatCentsToInput(nextAvail));
  };

  const handleSpendMonthlyChange = (val: string) => {
    setSpendMonthlyText(val);
    setSpendError(null);
    const curLimit = Math.max(0, parseBRLToCents(spendLimitText));
    const newMonthly = Math.max(0, parseBRLToCents(val));
    const nextAvail = Math.max(0, curLimit - newMonthly - committedOutsideMonthlyCents);
    setSpendAvailableText(formatCentsToInput(nextAvail));
  };

  const handleSpendAvailableChange = (val: string) => {
    setSpendAvailableText(val);
    setSpendError(null);
    const curLimit = Math.max(0, parseBRLToCents(spendLimitText));
    const newAvail = Math.max(0, parseBRLToCents(val));
    const derivedMonthly = Math.max(0, curLimit - newAvail - committedOutsideMonthlyCents);
    setSpendMonthlyText(formatCentsToInput(derivedMonthly));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const limitCents = Math.max(0, parseBRLToCents(limitText));
      const safeName = name.trim();
      const safeBrand = brand.trim() || 'Virtual';
      if (editing) {
        await updateCard(user.uid, editing.id, {
          name: safeName,
          brand: safeBrand,
          limitCents,
          closingDay,
          dueDay,
          color,
        });
      } else {
        const createdId = await createCard(user.uid, {
          name: safeName,
          brand: safeBrand,
          limitCents,
          closingDay,
          dueDay,
          color,
        });

        const initialSpendCents = Math.max(0, parseBRLToCents(initialSpendText));
        if (initialSpendCents > 0 && defaultExpenseCategoryId) {
          await recordCardTotalSpend(user.uid, {
            card: {
              id: createdId,
              userId: user.uid,
              name: safeName,
              brand: safeBrand,
              limitCents,
              closingDay,
              dueDay,
              color,
              archived: false,
            },
            invoiceMonth: activeMonth,
            categoryId: defaultExpenseCategoryId,
            description: `Gasto Total — ${safeName}`,
            amountCents: initialSpendCents,
            mode: 'set_total',
            itemizedTotalCents: 0,
          });
        }
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !spendCard || !spendBreakdown) return;
    setSpendError(null);

    if (!spendCategoryId) {
      setSpendError('Crie ou selecione uma categoria de despesa antes de registrar.');
      return;
    }

    if (spendMode === 'add') {
      const addCents = parseBRLToCents(spendAddAmountText);
      if (addCents <= 0) {
        setSpendError('Informe um valor maior que zero para adicionar.');
        return;
      }

      setBusy(true);
      try {
        await recordCardTotalSpend(user.uid, {
          card: spendCard,
          invoiceMonth: spendMonth,
          categoryId: spendCategoryId,
          description: spendDescription.trim() || `Gasto Avulso — ${spendCard.name}`,
          amountCents: addCents,
          mode: 'add',
        });
        setSpendCard(null);
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextLimitCents = parseBRLToCents(spendLimitText);
    const nextMonthlySpendCents = parseBRLToCents(spendMonthlyText);

    if (nextLimitCents <= 0) {
      setSpendError('Informe um Limite Total maior que zero para o cartão.');
      return;
    }

    if (nextMonthlySpendCents < 0) {
      setSpendError('O Gasto Mensal não pode ser negativo.');
      return;
    }

    if (nextMonthlySpendCents < spendBreakdown.itemizedMonthlySpendCents) {
      setSpendError(
        `Já existem ${formatCentsToBRL(spendBreakdown.itemizedMonthlySpendCents)} em compras avulsas/detalhadas nesta fatura. Informe um Gasto Mensal igual ou maior, ou ajuste os lançamentos individuais.`
      );
      return;
    }

    setBusy(true);
    try {
      if (nextLimitCents !== spendCard.limitCents) {
        await updateCard(user.uid, spendCard.id, {
          name: spendCard.name,
          brand: spendCard.brand,
          limitCents: nextLimitCents,
          closingDay: spendCard.closingDay,
          dueDay: spendCard.dueDay,
          color: spendCard.color,
        });
      }

      await recordCardTotalSpend(user.uid, {
        card: { ...spendCard, limitCents: nextLimitCents },
        invoiceMonth: spendMonth,
        categoryId: spendCategoryId,
        description: spendDescription.trim() || `Gasto Total — ${spendCard.name}`,
        amountCents: nextMonthlySpendCents,
        mode: 'set_total',
        existingConsolidatedTxId: spendBreakdown.consolidatedMonthlyTxId,
        itemizedTotalCents: spendBreakdown.itemizedMonthlySpendCents,
      });

      setSpendCard(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteCard(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const totalMonthCardSpendCents = cards.reduce((sum, card) => {
    const bd = cardBreakdowns.get(card.id);
    return sum + (bd?.targetMonthTotalInvoiceCents ?? 0);
  }, 0);

  const totalActiveInstallmentsCents = cards.reduce((sum, card) => {
    const bd = cardBreakdowns.get(card.id);
    return sum + (bd?.activeInstallmentsCents ?? 0);
  }, 0);

  const totalActiveInstallmentCount = cards.reduce((sum, card) => {
    const bd = cardBreakdowns.get(card.id);
    return sum + (bd?.activeInstallmentGroups.length ?? 0);
  }, 0);

  const totalAvailableAcrossCardsCents = cards.reduce((sum, card) => {
    const bd = cardBreakdowns.get(card.id);
    return sum + (bd?.availableLimitCents ?? card.limitCents);
  }, 0);

  const totalLimitAcrossCardsCents = cards.reduce((sum, card) => sum + card.limitCents, 0);

  const previewAddCents = Math.max(0, parseBRLToCents(spendAddAmountText));
  const previewAddMonthlyCents = (spendBreakdown?.monthlySpendCents ?? 0) + previewAddCents;
  const previewAddAvailableCents = spendBreakdown
    ? Math.max(
        0,
        spendBreakdown.limitCents -
          previewAddMonthlyCents -
          spendBreakdown.activeInstallmentsCents -
          spendBreakdown.otherMonthsNonInstallmentCents
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Cartões Fictícios de Controle
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Preencha limite total, gasto mensal ou limite disponível e acompanhe automaticamente o impacto de cada parcelamento ativo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Cartão
        </button>
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fatura dos Cartões ({formatShortMonth(activeMonth)})
            </p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCentsToBRL(totalMonthCardSpendCents)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parcelamentos Ativos ({totalActiveInstallmentCount})
            </p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatCentsToBRL(totalActiveInstallmentsCents)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Limite Disponível Total (de {formatCentsToBRL(totalLimitAcrossCardsCents)})
            </p>
            <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#16A34A] dark:text-emerald-400">
              {formatCentsToBRL(totalAvailableAcrossCardsCents)}
            </p>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhum cartão cadastrado.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adicione um cartão fictício para controlar limite total, gasto mensal, limite disponível e parcelamentos ativos.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar primeiro cartão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => {
            const breakdown =
              cardBreakdowns.get(card.id) ??
              computeCardLimitBreakdown(card, activeMonth, transactions, invoices);

            return (
              <div
                key={card.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: card.color }}
                      >
                        <CardIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {card.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {card.brand} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(card)}
                        aria-label="Editar cartão"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(card)}
                        aria-label="Excluir cartão"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Limite comprometido ({breakdown.usedPercent}%)
                      </span>
                      <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                        {formatCentsToBRL(breakdown.totalCommittedCents)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          breakdown.usedPercent >= 90
                            ? 'bg-[#DC2626]'
                            : breakdown.usedPercent >= 70
                              ? 'bg-amber-500'
                              : 'bg-[#2563EB]'
                        }`}
                        style={{ width: `${breakdown.usedPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Limite Total
                      </p>
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {formatCentsToBRL(breakdown.limitCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Gasto Mensal ({formatShortMonth(activeMonth)})
                      </p>
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {formatCentsToBRL(breakdown.monthlySpendCents)}
                      </p>
                      {breakdown.targetMonthInstallmentsCents > 0 && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          + {formatCentsToBRL(breakdown.targetMonthInstallmentsCents)} parcela
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Parcelamento Ativo
                      </p>
                      <p className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                        {formatCentsToBRL(breakdown.activeInstallmentsCents)}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {breakdown.activeInstallmentGroups.length > 0
                          ? `${breakdown.activeInstallmentGroups.length} ${
                              breakdown.activeInstallmentGroups.length === 1
                                ? 'compra ativa'
                                : 'compras ativas'
                            }`
                          : 'Nenhum ativo'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Limite Disponível
                      </p>
                      <p
                        className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                          breakdown.availableLimitCents > 0
                            ? 'text-[#16A34A] dark:text-emerald-400'
                            : 'text-[#DC2626]'
                        }`}
                      >
                        {formatCentsToBRL(breakdown.availableLimitCents)}
                      </p>
                    </div>
                  </div>

                  {breakdown.activeInstallmentGroups.length > 0 && (
                    <div className="p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        <span>Parcelamentos Ativos Identificados</span>
                      </div>
                      <ul className="space-y-1">
                        {breakdown.activeInstallmentGroups.slice(0, 3).map((g) => (
                          <li
                            key={g.groupId}
                            className="flex items-center justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-300"
                          >
                            <span className="truncate">
                              {g.description} ({g.paidCount}/{g.totalInstallments})
                            </span>
                            <span className="font-mono tabular-nums font-semibold shrink-0">
                              {formatCentsToBRL(g.remainingCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {breakdown.activeInstallmentGroups.length > 3 && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                          +{breakdown.activeInstallmentGroups.length - 3} parcelamento(s) ativo(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openSpendModal(card)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-[#2563EB] dark:text-blue-400 hover:bg-[#2563EB]/10 dark:hover:bg-blue-500/15 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Gastos e Limite do Cartão
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Editar Cartão Fictício' : 'Novo Cartão Fictício'}
        subtitle="Apenas dados de planejamento. Não insira números reais de cartão ou CVV."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Apelido do Cartão
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Cartão Roxo"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bandeira / Rótulo
              </label>
              <input
                type="text"
                required
                maxLength={30}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex.: Mastercard, Visa"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {!editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Limite Total (R$)
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={limitText}
                    onChange={(e) => handleCreateLimitChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Gasto Mensal ({formatShortMonth(activeMonth)})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={initialSpendText}
                    onChange={(e) => handleCreateSpendChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Limite Disponível (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={initialAvailableText}
                    onChange={(e) => handleCreateAvailableChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Os três campos se ajustam automaticamente entre si. Se houver gasto mensal, ele será lançado na fatura de {formatMonthLabel(activeMonth)}.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Limite Total (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={limitText}
                onChange={(e) => setLimitText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dia Fechamento (1-28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                required
                value={closingDay}
                onChange={(e) => setClosingDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dia Vencimento (1-28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                required
                value={dueDay}
                onChange={(e) => setDueDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cor
            </label>
            <div className="flex gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#2563EB]' : ''
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
              {busy ? 'Salvando...' : 'Salvar Cartão'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Card Spend & Limit 3-Field Modal */}
      <Modal
        open={Boolean(spendCard)}
        title={`Gastos e Limite — ${spendCard?.name ?? ''}`}
        subtitle="Preencha limite total, gasto mensal ou limite disponível; o sistema desconta automaticamente os parcelamentos ativos."
        onClose={() => setSpendCard(null)}
      >
        <form onSubmit={(e) => void handleSaveSpend(e)} className="space-y-4">
          {spendError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {spendError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setSpendMode('set_total');
                setSpendError(null);
                if (spendBreakdown) {
                  setSpendLimitText(formatCentsToInput(spendBreakdown.limitCents));
                  setSpendMonthlyText(formatCentsToInput(spendBreakdown.monthlySpendCents));
                  setSpendAvailableText(formatCentsToInput(spendBreakdown.availableLimitCents));
                }
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                spendMode === 'set_total'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Definir gastos e limite
            </button>
            <button
              type="button"
              onClick={() => {
                setSpendMode('add');
                setSpendError(null);
                setSpendAddAmountText('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                spendMode === 'add'
                  ? 'bg-white dark:bg-slate-900 text-[#2563EB] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Adicionar gasto avulso
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mês da Fatura
              </label>
              <input
                type="month"
                required
                value={spendMonth}
                onChange={(e) => handleSpendMonthChange(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {spendMode === 'add' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor a Adicionar (R$)
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={spendAddAmountText}
                  onChange={(e) => setSpendAddAmountText(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {spendMode === 'set_total' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Limite Total (R$)
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={spendLimitText}
                  onChange={(e) => handleSpendLimitChange(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gasto Mensal (R$)
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={spendMonthlyText}
                  onChange={(e) => handleSpendMonthlyChange(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Limite Disponível (R$)
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={spendAvailableText}
                  onChange={(e) => handleSpendAvailableChange(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          ) : (
            spendBreakdown && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Limite Total</span>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatCentsToBRL(spendBreakdown.limitCents)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Novo Gasto Mensal</span>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatCentsToBRL(previewAddMonthlyCents)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Novo Limite Disponível</span>
                  <p className="font-mono tabular-nums font-semibold text-[#16A34A] dark:text-emerald-400 mt-0.5">
                    {formatCentsToBRL(previewAddAvailableCents)}
                  </p>
                </div>
              </div>
            )
          )}

          {spendBreakdown && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Parcelamento Ativo Identificado</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                  {formatCentsToBRL(spendBreakdown.activeInstallmentsCents)}
                </span>
              </div>

              {spendBreakdown.activeInstallmentGroups.length > 0 ? (
                <ul className="space-y-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                  {spendBreakdown.activeInstallmentGroups.map((g) => (
                    <li
                      key={g.groupId}
                      className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
                    >
                      <span className="truncate">
                        {g.description} ({g.paidCount}/{g.totalInstallments} pagas · {formatCentsToBRL(g.installmentCents)}/mês)
                      </span>
                      <span className="font-mono tabular-nums font-medium shrink-0">
                        {formatCentsToBRL(g.remainingCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  Nenhum parcelamento ativo identificado neste cartão.
                </p>
              )}

              {spendMode === 'set_total' && (
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Compras avulsas já lançadas em {spendMonth}:</span>
                    <span className="font-mono tabular-nums font-medium">
                      {formatCentsToBRL(spendBreakdown.itemizedMonthlySpendCents)}
                    </span>
                  </div>
                  {spendBreakdown.otherMonthsNonInstallmentCents > 0 && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>Gastos à vista em aberto (outros meses):</span>
                      <span className="font-mono tabular-nums font-medium">
                        {formatCentsToBRL(spendBreakdown.otherMonthsNonInstallmentCents)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-900 dark:text-white font-semibold pt-1">
                    <span>Limite Disponível calculado:</span>
                    <span className="font-mono tabular-nums text-[#16A34A] dark:text-emerald-400">
                      {formatCentsToBRL(
                        Math.max(
                          0,
                          parseBRLToCents(spendLimitText) -
                            Math.max(0, parseBRLToCents(spendMonthlyText)) -
                            spendBreakdown.activeInstallmentsCents -
                            spendBreakdown.otherMonthsNonInstallmentCents
                        )
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Baseado em: Limite Total − Gasto Mensal − Parcelamento Ativo
                    {spendBreakdown.otherMonthsNonInstallmentCents > 0 ? ' − Outros meses' : ''}.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Descrição
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={spendDescription}
                onChange={(e) => setSpendDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={spendCategoryId}
                onChange={(e) => setSpendCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSpendCard(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              {busy ? 'Salvando...' : 'Salvar Gastos e Limite'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Cartão"
        description={`Deseja excluir o cartão "${deleting?.name ?? ''}"? Os lançamentos, parcelamentos, faturas e recorrências vinculados a ele também serão removidos.`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
