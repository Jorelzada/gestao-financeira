import React, { useEffect, useState } from 'react';
import { Moon, ShieldCheck, Sun, Trash2, UserCheck } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import {
  resetUserWorkspace,
  updateUserProfileAlias,
} from '../services/firestoreService';

export function SettingsPage() {
  const { user, upgradeGuestToGoogle, authError, clearAuthMessages, authBusy } =
    useAuth();
  const { theme, setThemeMode, settings } = useFinanceData();

  const [alias, setAlias] = useState(settings?.displayAlias || '');
  const [savingAlias, setSavingAlias] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (settings?.displayAlias) {
      setAlias(settings.displayAlias);
    }
  }, [settings?.displayAlias]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAlias(true);
    setSavedFeedback(false);
    try {
      await updateUserProfileAlias(user.uid, alias.trim() || 'Minha Conta', theme);
      setSavedFeedback(true);
    } finally {
      setSavingAlias(false);
    }
  };

  const handleResetAll = async () => {
    if (!user) return;
    setResetBusy(true);
    try {
      await resetUserWorkspace(user.uid);
      setConfirmReset(false);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Profile & Theme */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Preferências do Espaço Financeiro
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Personalize seu apelido de exibição e tema visual. Nenhum dado pessoal sensível é armazenado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Apelido do Espaço
            </label>
            <input
              type="text"
              maxLength={60}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Ex.: Finanças Pessoais"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tema da Interface
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  theme === 'light'
                    ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Sun className="w-4 h-4" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'border-[#2563EB] bg-[#2563EB]/15 text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Moon className="w-4 h-4" />
                Escuro
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#16A34A]">
            {savedFeedback ? 'Preferências salvas com sucesso.' : ''}
          </span>
          <button
            type="submit"
            disabled={savingAlias}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            {savingAlias ? 'Salvando...' : 'Salvar Preferências'}
          </button>
        </div>
      </form>

      {/* Anonymous Account Upgrade */}
      {user?.isAnonymous && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Vincular Sessão Anônima a uma Conta Google
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Você está usando uma sessão anônima. Vincule sua conta Google para preservar seus dados entre diferentes navegadores e dispositivos.
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
              <span>{authError}</span>
              <button type="button" onClick={clearAuthMessages} className="underline">
                Fechar
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void upgradeGuestToGoogle()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white"
          >
            {authBusy ? 'Vinculando...' : 'Vincular com Google'}
          </button>
        </div>
      )}

      {/* Privacy & Security */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-[#16A34A]">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Privacidade e Isolamento de Dados
          </h3>
        </div>
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>
            O FinanceFlow não coleta CPF, RG, endereço, número real de cartão, validade, CVV ou senhas bancárias.
          </li>
          <li>
            Todos os registros financeiros são isolados por usuário autenticado (`users/{'{uid}'}`) e protegidos por regras rigorosas no Cloud Firestore.
          </li>
          <li>
            Todos os cálculos monetários utilizam valores inteiros em centavos para eliminar erros de arredondamento.
          </li>
        </ul>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#DC2626]">
            Limpar Dados Financeiros
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Remove todas as contas, lançamentos, faturas, metas, dívidas e ativos do seu espaço e restaura categorias padrão.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#DC2626] hover:bg-red-700 text-white whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Resetar Espaço
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Resetar Todos os Dados"
        description="Esta ação apagará permanentemente todos os seus lançamentos, contas, cartões, faturas, orçamentos, metas, dívidas e bens no Firestore. Deseja continuar?"
        confirmLabel="Apagar Tudo"
        danger
        busy={resetBusy}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleResetAll()}
      />
    </div>
  );
}
