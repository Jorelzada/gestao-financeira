import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  LogOut,
  MailCheck,
  RefreshCw,
  RotateCw,
  X,
} from 'lucide-react';
import { AppShell, type NavSection } from './components/AppShell';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TransactionModal } from './components/TransactionModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FinanceDataProvider, useFinanceData } from './contexts/FinanceDataContext';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { CardsPage } from './pages/CardsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DebtsPage } from './pages/DebtsPage';
import { GoalsPage } from './pages/GoalsPage';
import { GuidePage } from './pages/GuidePage';
import { InstallmentsPage } from './pages/InstallmentsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { NetWorthPage } from './pages/NetWorthPage';
import { RecurrencesPage } from './pages/RecurrencesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransfersPage } from './pages/TransfersPage';

function EmailVerificationGate() {
  const {
    user,
    authBusy,
    authError,
    authNotice,
    resendVerificationEmail,
    refreshVerificationStatus,
    logout,
  } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0B1120] p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
            <MailCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Confirme seu e-mail
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Para proteger seus dados financeiros no Cloud Firestore, clique no link de verificação enviado para o seu e-mail e depois clique em confirmar abaixo.
        </p>

        {authError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {authError}
          </div>
        )}

        {authNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
            {authNotice}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={authBusy}
            onClick={() => void refreshVerificationStatus()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white disabled:opacity-60"
          >
            <RefreshCw className="w-4 h-4" />
            {authBusy ? 'Verificando...' : 'Já verifiquei meu e-mail'}
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void resendVerificationEmail()}
            className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            Reenviar e-mail de verificação
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void logout()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-500 hover:text-[#DC2626]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair e escolher outro método
          </button>
        </div>
      </div>
    </div>
  );
}

type NotificationSeverity = 'info' | 'warning' | 'critical';

interface ParsedNotification {
  severity: NotificationSeverity;
  title: string;
  message: string;
  context?: string;
}

function parseDataError(rawError: string): ParsedNotification {
  let message = rawError;
  let context: string | undefined;

  try {
    const parsed = JSON.parse(rawError) as {
      error?: string;
      path?: string;
      operationType?: string;
    };
    if (parsed.error) {
      message = parsed.error;
      context = parsed.path ? `Recurso: ${parsed.path}` : undefined;
    }
  } catch {
    // Plain text message
  }

  const lower = message.toLowerCase();

  if (lower.startsWith('info:') || lower.includes('sincroniz')) {
    return {
      severity: 'info',
      title: 'Aviso de Sincronização',
      message: message.replace(/^info:\s*/i, ''),
      context,
    };
  }

  if (
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('unavailable') ||
    lower.includes('timeout')
  ) {
    return {
      severity: 'warning',
      title: 'Conexão Instável',
      message:
        'Não foi possível alcançar o servidor no momento. Verifique sua conexão com a internet e tente novamente.',
      context,
    };
  }

  if (lower.includes('quota exceeded')) {
    return {
      severity: 'critical',
      title: 'Limite de Uso Atingido',
      message:
        'A cota gratuita diária do banco de dados foi atingida. O serviço será normalizado na próxima renovação diária.',
      context,
    };
  }

  if (lower.includes('permission') || lower.includes('insufficient')) {
    return {
      severity: 'critical',
      title: 'Permissão Negada',
      message:
        'Sua sessão atual não possui autorização para acessar este recurso. Verifique se sua conta está autenticada e confirmada.',
      context,
    };
  }

  return {
    severity: 'critical',
    title: 'Erro Crítico de Sincronização',
    message,
    context,
  };
}

const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  {
    label: string;
    containerClass: string;
    iconClass: string;
    titleClass: string;
    bodyClass: string;
    Icon: typeof Info;
  }
> = {
  info: {
    label: 'Informação',
    containerClass:
      'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900/70',
    iconClass: 'text-[#2563EB] dark:text-blue-400',
    titleClass: 'text-slate-900 dark:text-blue-100',
    bodyClass: 'text-slate-600 dark:text-blue-200/80',
    Icon: Info,
  },
  warning: {
    label: 'Alerta',
    containerClass:
      'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/70',
    iconClass: 'text-amber-600 dark:text-amber-400',
    titleClass: 'text-slate-900 dark:text-amber-100',
    bodyClass: 'text-slate-700 dark:text-amber-200/80',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Erro Crítico',
    containerClass:
      'bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-900/70',
    iconClass: 'text-[#DC2626] dark:text-red-400',
    titleClass: 'text-slate-900 dark:text-red-100',
    bodyClass: 'text-slate-700 dark:text-red-200/80',
    Icon: AlertOctagon,
  },
};

function NotificationAlert({
  rawError,
  onDismiss,
}: {
  rawError: string;
  onDismiss: () => void;
}) {
  const parsed = parseDataError(rawError);
  const config = SEVERITY_CONFIG[parsed.severity];
  const Icon = config.Icon;

  return (
    <div
      role="alert"
      className={`mb-6 p-4 rounded-xl border ${config.containerClass} flex items-start justify-between gap-4`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconClass}`} />
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`font-semibold ${config.iconClass}`}>
              {config.label}
            </span>
            <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
              ·
            </span>
            <h2 className={`text-sm font-semibold ${config.titleClass}`}>
              {parsed.title}
            </h2>
          </div>
          <p className={`text-xs leading-relaxed break-words ${config.bodyClass}`}>
            {parsed.message}
          </p>
          {parsed.context && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {parsed.context}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {parsed.severity !== 'info' && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Recarregar
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar notificação"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { user, emailVerified, authReady } = useAuth();
  const { dataError, clearDataError } = useFinanceData();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [quickModalOpen, setQuickModalOpen] = useState(false);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0B1120]">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Carregando Gestão Financeira...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.isAnonymous && !emailVerified) {
    return <EmailVerificationGate />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={setActiveSection}
            onNewTransaction={() => setQuickModalOpen(true)}
          />
        );
      case 'transactions':
        return <TransactionsPage />;
      case 'transfers':
        return <TransfersPage />;
      case 'cards':
        return <CardsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'installments':
        return <InstallmentsPage />;
      case 'recurrences':
        return <RecurrencesPage />;
      case 'budgets':
        return <BudgetsPage />;
      case 'goals':
        return <GoalsPage />;
      case 'accounts':
        return <AccountsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'debts':
        return <DebtsPage />;
      case 'networth':
        return <NetWorthPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'guide':
        return (
          <GuidePage
            onNavigate={setActiveSection}
            onNewTransaction={() => setQuickModalOpen(true)}
          />
        );
    }
  };

  return (
    <AppShell
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onQuickNewTransaction={() => setQuickModalOpen(true)}
    >
      {dataError && (
        <NotificationAlert rawError={dataError} onDismiss={clearDataError} />
      )}
      {renderSection()}

      <TransactionModal
        open={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <FinanceDataProvider>
          <AuthenticatedWorkspace />
        </FinanceDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
