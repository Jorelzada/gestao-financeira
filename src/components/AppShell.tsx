import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Scale,
  Settings,
  Sun,
  Tag,
  Target,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFinanceData } from '../contexts/FinanceDataContext';
import { formatMonthLabel, shiftMonth } from '../lib/financeMath';

export type NavSection =
  | 'dashboard'
  | 'transactions'
  | 'transfers'
  | 'cards'
  | 'invoices'
  | 'installments'
  | 'recurrences'
  | 'budgets'
  | 'goals'
  | 'accounts'
  | 'categories'
  | 'debts'
  | 'networth'
  | 'reports'
  | 'settings'
  | 'guide';

interface NavGroup {
  label: string;
  items: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'transactions', label: 'Lançamentos', icon: Receipt },
      { id: 'transfers', label: 'Transferências', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Crédito e Compromissos',
    items: [
      { id: 'cards', label: 'Cartões', icon: CreditCard },
      { id: 'invoices', label: 'Faturas', icon: FileText },
      { id: 'installments', label: 'Parcelamentos', icon: Layers },
      { id: 'recurrences', label: 'Recorrências', icon: Repeat },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { id: 'budgets', label: 'Orçamentos', icon: PiggyBank },
      { id: 'goals', label: 'Metas', icon: Target },
      { id: 'debts', label: 'Dívidas', icon: Scale },
      { id: 'networth', label: 'Patrimônio', icon: TrendingUp },
    ],
  },
  {
    label: 'Estrutura e Sistema',
    items: [
      { id: 'accounts', label: 'Contas', icon: Landmark },
      { id: 'categories', label: 'Categorias', icon: Tag },
      { id: 'reports', label: 'Relatórios e Exportação', icon: BarChart3 },
      { id: 'settings', label: 'Configurações', icon: Settings },
      { id: 'guide', label: 'Guia de Uso', icon: BookOpen },
    ],
  },
];

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Dashboard Financeiro',
  transactions: 'Receitas e Despesas',
  transfers: 'Transferências entre Contas',
  cards: 'Cartões de Crédito',
  invoices: 'Faturas Mensais',
  installments: 'Compras Parceladas',
  recurrences: 'Despesas e Receitas Recorrentes',
  budgets: 'Orçamentos por Categoria',
  goals: 'Metas Financeiras',
  accounts: 'Contas Financeiras',
  categories: 'Categorias',
  debts: 'Gestão de Dívidas',
  networth: 'Patrimônio Líquido',
  reports: 'Relatórios e Exportação',
  settings: 'Configurações da Conta',
  guide: 'Guia de Uso do Sistema',
};

interface AppShellProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onQuickNewTransaction: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeSection,
  onSelectSection,
  onQuickNewTransaction,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const { activeMonth, setActiveMonth, theme, toggleTheme, settings } =
    useFinanceData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName =
    settings?.displayAlias ||
    (user?.isAnonymous ? 'Modo Anônimo' : user?.displayName || 'Minha Conta');

  const handleNavClick = (section: NavSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Gestão Financeira
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Menu principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {displayName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {user?.isAnonymous ? 'Sessão anônima local' : user?.email || 'Conta sincronizada'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#DC2626] dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Encerrar sessão</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0B1120] text-[#0F172A] dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Abrir navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
                {SECTION_TITLES[activeSection]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Month Navigator */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveMonth(shiftMonth(activeMonth, -1))}
                aria-label="Mês anterior"
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 sm:px-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap tabular-nums">
                {formatMonthLabel(activeMonth)}
              </span>
              <button
                type="button"
                onClick={() => setActiveMonth(shiftMonth(activeMonth, 1))}
                aria-label="Próximo mês"
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onQuickNewTransaction}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
