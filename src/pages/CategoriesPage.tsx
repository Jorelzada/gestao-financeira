import React, { useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../services/firestoreService';
import type { Category, TransactionType } from '../types/finance';

const COLOR_PALETTE = [
  '#2563EB',
  '#16A34A',
  '#DC2626',
  '#EA580C',
  '#7C3AED',
  '#0284C7',
  '#D97706',
  '#DB2777',
  '#4F46E5',
  '#64748B',
];

export function CategoriesPage() {
  const { user } = useAuth();
  const { categories, transactions } = useFinanceData();

  const [tab, setTab] = useState<TransactionType>('expense');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [color, setColor] = useState('#2563EB');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setType(tab);
    setColor(tab === 'income' ? '#16A34A' : '#2563EB');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await updateCategory(user.uid, editing.id, {
          name: name.trim(),
          type,
          color,
          icon: editing.icon || 'Tag',
        });
      } else {
        await createCategory(user.uid, {
          name: name.trim(),
          type,
          color,
          icon: 'Tag',
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
      await deleteCategory(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const filtered = categories.filter((c) => c.type === tab);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('expense')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'expense'
                ? 'bg-white dark:bg-slate-900 text-[#DC2626] shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Despesas ({categories.filter((c) => c.type === 'expense').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('income')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'income'
                ? 'bg-white dark:bg-slate-900 text-[#16A34A] shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Receitas ({categories.filter((c) => c.type === 'income').length})
          </button>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => {
          const usageCount = transactions.filter((t) => t.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: cat.color }}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {usageCount} lançamento(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  aria-label="Editar categoria"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(cat)}
                  aria-label="Excluir categoria"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Categoria' : 'Nova Categoria'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome da Categoria
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Assinaturas, Freelance..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
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
              {busy ? 'Salvando...' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Categoria"
        description={`Deseja excluir a categoria "${deleting?.name ?? ''}"?`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
