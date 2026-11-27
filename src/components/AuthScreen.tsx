import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthScreen() {
  const {
    signInWithGoogle,
    signInAsGuest,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    authBusy,
    authError,
    authNotice,
    clearAuthMessages,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthMessages();

    if (!email.trim()) {
      setLocalError('Informe seu endereço de e-mail.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('As senhas digitadas não coincidem.');
        return;
      }
      await signUpWithEmail(email, password);
    } else {
      await signInWithEmail(email, password);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B1120] text-[#0F172A] dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">
              Gestão Financeira
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
            Controle Financeiro Pessoal
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <section className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
                GESTÃO FINANCEIRA COMPLETA E PRIVADA
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
                Organize contas, faturas, parcelamentos e patrimônio em um só lugar.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Acompanhe fluxo de caixa em centavos exatos, controle orçamentos mensais, planeje metas e acompanhe sua evolução patrimonial com isolamento total de dados por usuário.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Faturas e Parcelamentos
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Ciclo automático por dia de fechamento, sem duplicar despesas ao pagar a fatura.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Privacidade Garantida
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Nunca solicitamos CPF, RG, número de cartão, CVV ou senhas bancárias.
                </p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {mode === 'login' ? 'Acessar sua conta' : 'Criar nova conta'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Entre com e-mail e senha, Google ou modo anônimo.
                </p>
              </div>

              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLocalError(null);
                    clearAuthMessages();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setLocalError(null);
                    clearAuthMessages();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Criar conta
                </button>
              </div>
            </div>

            {displayError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="leading-relaxed">{displayError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalError(null);
                      clearAuthMessages();
                    }}
                    className="underline font-medium"
                  >
                    Dispensar aviso
                  </button>
                </div>
              </div>
            )}

            {authNotice && (
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{authNotice}</p>
              </div>
            )}

            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Senha
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void sendPasswordReset(email)}
                      className="text-xs font-medium text-[#2563EB] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita sua senha"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
              >
                {authBusy
                  ? 'Processando...'
                  : mode === 'login'
                    ? 'Entrar com E-mail'
                    : 'Criar Conta com E-mail'}
              </button>
            </form>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="px-3 text-xs text-slate-400">ou continue com</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Google
              </button>

              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signInAsGuest()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
                Modo Anônimo
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>Dados isolados por usuário via Firebase Auth &amp; Firestore Rules.</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
