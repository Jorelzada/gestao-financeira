import React, { useState } from 'react';
import { CreditCard as CardIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeCardInvoices,
  computeCardUsedLimitCents,
  formatCentsToBRL,
  formatCentsToInput,
  parseBRLToCents,
} from '../lib/financeMath';
import { createCard, deleteCard, updateCard } from '../services/firestoreService';
import type { CreditCard } from '../types/finance';

const CARD_COLORS = ['#0F172A', '#2563EB', '#7C3AED', '#047857', '#B91C1C', '#334155'];

export function CardsPage() {
  const { user } = useAuth();
  const { cards, transactions, invoicePayments } = useFinanceData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [deleting, setDeleting] = useState<CreditCard | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Mastercard');
  const [limitText, setLimitText] = useState('3000,00');
  const [closingDay, setClosingDay] = useState(10);
  const [dueDay, setDueDay] = useState(17);
  const [color, setColor] = useState('#0F172A');

  const invoices = computeCardInvoices(cards, transactions, invoicePayments);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setBrand('Mastercard');
    setLimitText('3000,00');
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
    setClosingDay(card.closingDay);
    setDueDay(card.dueDay);
    setColor(card.color);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const limitCents = parseBRLToCents(limitText);
      if (editing) {
        await updateCard(user.uid, editing.id, {
          name: name.trim(),
          brand: brand.trim() || 'Virtual',
          limitCents,
          closingDay,
          dueDay,
          color,
        });
      } else {
        await createCard(user.uid, {
          name: name.trim(),
          brand: brand.trim() || 'Virtual',
          limitCents,
          closingDay,
          dueDay,
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
      await deleteCard(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Cartões Fictícios de Controle
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastre apenas apelido, limite e dias de fechamento/vencimento. Nunca informe número do cartão, validade ou CVV.
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

      {cards.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhum cartão cadastrado.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adicione um cartão fictício para acompanhar faturas mensais, compras parceladas e limite disponível.
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
            const usedCents = computeCardUsedLimitCents(card.id, invoices);
            const availableCents = Math.max(0, card.limitCents - usedCents);
            const usedPct =
              card.limitCents > 0
                ? Math.min(100, Math.round((usedCents / card.limitCents) * 100))
                : 0;

            return (
              <div
                key={card.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
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
                      Limite utilizado ({usedPct}%)
                    </span>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatCentsToBRL(usedCents)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        usedPct >= 90
                          ? 'bg-[#DC2626]'
                          : usedPct >= 70
                            ? 'bg-amber-500'
                            : 'bg-[#2563EB]'
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      Disponível: {formatCentsToBRL(availableCents)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      Limite: {formatCentsToBRL(card.limitCents)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Cartão"
        description={`Deseja excluir o cartão "${deleting?.name ?? ''}"?`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
