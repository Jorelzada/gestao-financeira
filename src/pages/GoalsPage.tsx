import React, { useState } from 'react';
import { Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
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
  adjustGoalProgress,
  createGoal,
  deleteGoal,
  updateGoalDetails,
} from '../services/firestoreService';
import type { Goal } from '../types/finance';

const GOAL_COLORS = ['#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#0284C7'];

export function GoalsPage() {
  const { user } = useAuth();
  const { goals } = useFinanceData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [adjustingGoal, setAdjustingGoal] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [currentText, setCurrentText] = useState('0,00');
  const [targetDate, setTargetDate] = useState(getTodayDateStr());
  const [color, setColor] = useState('#2563EB');

  const [deltaMode, setDeltaMode] = useState<'add' | 'sub'>('add');
  const [deltaText, setDeltaText] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setTargetText('');
    setCurrentText('0,00');
    setTargetDate(getTodayDateStr());
    setColor('#2563EB');
    setModalOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setName(g.name);
    setTargetText(formatCentsToInput(g.targetCents));
    setCurrentText(formatCentsToInput(g.currentCents));
    setTargetDate(g.targetDate);
    setColor(g.color);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const targetCents = parseBRLToCents(targetText);
    const currentCents = parseBRLToCents(currentText);
    if (targetCents <= 0) return;

    setBusy(true);
    try {
      if (editing) {
        await updateGoalDetails(user.uid, editing, {
          name: name.trim(),
          targetCents,
          targetDate,
          color,
        });
      } else {
        await createGoal(user.uid, {
          name: name.trim(),
          targetCents,
          currentCents,
          targetDate,
          color,
        });
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !adjustingGoal) return;
    const cents = parseBRLToCents(deltaText);
    if (cents <= 0) return;

    setBusy(true);
    try {
      await adjustGoalProgress(
        user.uid,
        adjustingGoal,
        deltaMode === 'add' ? cents : -cents
      );
      setAdjustingGoal(null);
      setDeltaText('');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleting) return;
    setBusy(true);
    try {
      await deleteGoal(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const totalSaved = goals.reduce((s, g) => s + g.currentCents, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetCents, 0);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acumulado em Metas ({goals.length} objetivo(s))
          </p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCentsToBRL(totalSaved)} de {formatCentsToBRL(totalTarget)}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nenhuma meta financeira cadastrada.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crie objetivos como Reserva de Emergência, Viagem ou Compra Planejada e acompanhe seus aportes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.currentCents / g.targetCents) * 100));
            return (
              <div
                key={g.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: g.color }}
                    >
                      <Target className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {g.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Prazo: {formatDateBR(g.targetDate)} ·{' '}
                        <span
                          className={
                            g.status === 'completed'
                              ? 'text-[#16A34A] font-semibold'
                              : ''
                          }
                        >
                          {g.status === 'completed' ? 'Concluída' : `${pct}% atingido`}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      aria-label="Editar meta"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(g)}
                      aria-label="Excluir meta"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: g.status === 'completed' ? '#16A34A' : g.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {formatCentsToBRL(g.currentCents)} / {formatCentsToBRL(g.targetCents)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustingGoal(g);
                      setDeltaMode('add');
                      setDeltaText('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    {g.status === 'completed' ? 'Reabrir Meta' : 'Aportar / Resgatar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Meta Financeira' : 'Nova Meta Financeira'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da Meta
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Reserva de Emergência"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Alvo (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {!editing && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor Inicial Guardado (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Data Prevista
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cor
            </label>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
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
              {busy ? 'Salvando...' : 'Salvar Meta'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(adjustingGoal)}
        title={
          adjustingGoal?.status === 'completed'
            ? 'Reabrir Meta Concluída'
            : `Atualizar Progresso — ${adjustingGoal?.name ?? ''}`
        }
        onClose={() => setAdjustingGoal(null)}
      >
        {adjustingGoal?.status === 'completed' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta meta já foi concluída. Deseja reabri-la para continuar realizando movimentações?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAdjustingGoal(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  user &&
                  adjustingGoal &&
                  void adjustGoalProgress(user.uid, adjustingGoal, 0).then(() =>
                    setAdjustingGoal(null)
                  )
                }
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] text-white"
              >
                Reabrir Meta
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleAdjust(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setDeltaMode('add')}
                className={`py-2 text-xs font-semibold rounded-md ${
                  deltaMode === 'add'
                    ? 'bg-white dark:bg-slate-900 text-[#16A34A] shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Aportar (+)
              </button>
              <button
                type="button"
                onClick={() => setDeltaMode('sub')}
                className={`py-2 text-xs font-semibold rounded-md ${
                  deltaMode === 'sub'
                    ? 'bg-white dark:bg-slate-900 text-[#DC2626] shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Resgatar (-)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={deltaText}
                onChange={(e) => setDeltaText(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAdjustingGoal(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
              >
                Confirmar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Meta"
        description={`Deseja excluir a meta "${deleting?.name ?? ''}"?`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
