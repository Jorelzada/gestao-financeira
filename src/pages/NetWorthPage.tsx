import React, { useState } from 'react';
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  computeNetWorth,
  formatCentsToBRL,
  formatCentsToInput,
  parseBRLToCents,
} from '../lib/financeMath';
import {
  createAsset,
  deleteAsset,
  updateAsset,
} from '../services/firestoreService';
import type { Asset, AssetCategory, AssetLiquidity } from '../types/finance';

const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  fixed_income: 'Renda Fixa',
  equities: 'Renda Variável / Ações',
  real_estate: 'Imóveis',
  vehicle: 'Veículos',
  reserve: 'Reserva / Liquidez',
  other: 'Outros Bens',
};

const ASSET_CATEGORY_COLORS: Record<AssetCategory, string> = {
  fixed_income: '#2563EB',
  equities: '#7C3AED',
  real_estate: '#16A34A',
  vehicle: '#EA580C',
  reserve: '#0284C7',
  other: '#64748B',
};

const LIQUIDITY_LABELS: Record<AssetLiquidity, string> = {
  high: 'Alta Liquidez',
  medium: 'Média Liquidez',
  low: 'Baixa Liquidez',
};

export function NetWorthPage() {
  const { user } = useAuth();
  const {
    accounts,
    assets,
    debts,
    transactions,
    transfers,
    invoicePayments,
    cards,
  } = useFinanceData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('fixed_income');
  const [valueText, setValueText] = useState('');
  const [liquidity, setLiquidity] = useState<AssetLiquidity>('high');
  const [notes, setNotes] = useState('');

  const netWorth = computeNetWorth(
    accounts,
    assets,
    debts,
    transactions,
    transfers,
    invoicePayments,
    cards
  );

  const allocationData = (() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    if (netWorth.accountsTotalCents > 0) {
      map.set('accounts', {
        name: 'Saldo em Contas',
        value: netWorth.accountsTotalCents / 100,
        color: '#0F172A',
      });
    }
    for (const a of assets) {
      if (a.valueCents <= 0) continue;
      const prev = map.get(a.category);
      map.set(a.category, {
        name: ASSET_CATEGORY_LABELS[a.category],
        value: (prev?.value ?? 0) + a.valueCents / 100,
        color: ASSET_CATEGORY_COLORS[a.category],
      });
    }
    return Array.from(map.values());
  })();

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategory('fixed_income');
    setValueText('');
    setLiquidity('high');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (a: Asset) => {
    setEditing(a);
    setName(a.name);
    setCategory(a.category);
    setValueText(formatCentsToInput(a.valueCents));
    setLiquidity(a.liquidity);
    setNotes(a.notes);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const valueCents = parseBRLToCents(valueText);
    setBusy(true);
    try {
      if (editing) {
        await updateAsset(user.uid, editing.id, {
          name: name.trim(),
          category,
          valueCents,
          liquidity,
          notes,
        });
      } else {
        await createAsset(user.uid, {
          name: name.trim(),
          category,
          valueCents,
          liquidity,
          notes,
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
      await deleteAsset(user.uid, deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Consolidated Net Worth KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Ativos Brutos</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#16A34A]">
            {formatCentsToBRL(netWorth.grossAssetsCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Contas: {formatCentsToBRL(netWorth.accountsTotalCents)} · Bens: {formatCentsToBRL(netWorth.assetsTotalCents)}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Passivos Totais</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#DC2626]">
            {formatCentsToBRL(netWorth.totalLiabilitiesCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Dívidas: {formatCentsToBRL(netWorth.debtsTotalCents)} · Faturas: {formatCentsToBRL(netWorth.unpaidInvoicesCents)}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Patrimônio Líquido</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              netWorth.netWorthCents >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-[#DC2626]'
            }`}
          >
            {formatCentsToBRL(netWorth.netWorthCents)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ativos Brutos menos Passivos Totais
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Distribuição de Ativos
          </h2>
          {allocationData.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-10 text-center">
              Cadastre bens, investimentos ou saldos positivos para visualizar a alocação patrimonial.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {allocationData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(Number(value ?? 0))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {allocationData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Bens e Investimentos ({assets.length})
            </h2>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Ativo
            </button>
          </div>

          {assets.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Nenhum bem ou investimento cadastrado.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adicione CDBs, ações, imóveis, veículos ou reservas de valor.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: ASSET_CATEGORY_COLORS[asset.category] }}
                    >
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {asset.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ASSET_CATEGORY_LABELS[asset.category]} · {LIQUIDITY_LABELS[asset.liquidity]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                      {formatCentsToBRL(asset.valueCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(asset)}
                      aria-label="Editar ativo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#2563EB]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(asset)}
                      aria-label="Excluir ativo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#DC2626]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Ativo Patrimonial' : 'Novo Ativo Patrimonial'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome do Ativo / Bem
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Tesouro Selic, Apartamento, ETF..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Classe
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="fixed_income">Renda Fixa</option>
                <option value="equities">Renda Variável</option>
                <option value="reserve">Reserva</option>
                <option value="real_estate">Imóveis</option>
                <option value="vehicle">Veículos</option>
                <option value="other">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Liquidez
              </label>
              <select
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value as AssetLiquidity)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Valor Atual (R$)
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              maxLength={240}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              {busy ? 'Salvando...' : 'Salvar Ativo'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir Ativo"
        description={`Deseja excluir "${deleting?.name ?? ''}" do seu patrimônio?`}
        confirmLabel="Excluir"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
