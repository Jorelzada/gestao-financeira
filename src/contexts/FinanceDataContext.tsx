import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  filterActiveInvoicePayments,
  filterActiveRecurrences,
  filterActiveTransactions,
  filterActiveTransfers,
  getCurrentMonthKey,
  shiftMonth,
} from '../lib/financeMath';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  cleanupOrphanedRecords,
  ensureUserWorkspace,
  syncRecurrencesThroughNextMonth,
  updateUserTheme,
} from '../services/firestoreService';
import type {
  Account,
  Asset,
  Budget,
  Category,
  CreditCard,
  Debt,
  Goal,
  InvoicePayment,
  Recurrence,
  ThemeMode,
  Transaction,
  Transfer,
  UserSettings,
} from '../types/finance';
import { useAuth } from './AuthContext';

interface FinanceDataContextValue {
  loading: boolean;
  dataError: string | null;
  clearDataError: () => void;
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  settings: UserSettings | null;
  accounts: Account[];
  categories: Category[];
  cards: CreditCard[];
  transactions: Transaction[];
  transfers: Transfer[];
  invoicePayments: InvoicePayment[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  assets: Asset[];
}

const FinanceDataContext = createContext<FinanceDataContextValue | null>(null);

const THEME_STORAGE_KEY = 'financeflow_theme';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return 'light';
}

export function FinanceDataProvider({ children }: { children: React.ReactNode }) {
  const { user, emailVerified, authReady } = useAuth();

  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [activeMonth, setActiveMonth] = useState<string>(getCurrentMonthKey);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Synchronize <html> .dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
    if (user && (user.isAnonymous || emailVerified)) {
      void updateUserTheme(user.uid, mode);
    }
  };

  const toggleTheme = () => {
    setThemeMode(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user || (!user.isAnonymous && !emailVerified)) {
      setSettings(null);
      setAccounts([]);
      setCategories([]);
      setCards([]);
      setTransactions([]);
      setTransfers([]);
      setInvoicePayments([]);
      setRecurrences([]);
      setBudgets([]);
      setGoals([]);
      setDebts([]);
      setAssets([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDataError(null);

    const uid = user.uid;
    const alias = user.isAnonymous
      ? 'Visitante'
      : user.displayName || 'Minha Conta';

    void ensureUserWorkspace(uid, alias, theme).catch((err) => {
      if (!cancelled) {
        setDataError(err instanceof Error ? err.message : 'Erro ao inicializar espaço de trabalho.');
      }
    });

    const loadedFlags = new Set<string>();
    const expectedStreams = [
      'settings',
      'accounts',
      'categories',
      'cards',
      'transactions',
      'transfers',
      'invoicePayments',
      'recurrences',
      'budgets',
      'goals',
      'debts',
      'assets',
    ];

    const markLoaded = (key: string) => {
      if (cancelled) return;
      loadedFlags.add(key);
      if (loadedFlags.size >= expectedStreams.length) {
        setLoading(false);
      }
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as UserSettings;
            setSettings(data);
            if (data.theme === 'dark' || data.theme === 'light') {
              setTheme(data.theme);
            }
          }
          markLoaded('settings');
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        }
      )
    );

    const bindCollection = <T extends { id: string }>(
      subName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const colPath = `users/${uid}/${subName}`;
      const q = query(collection(db, 'users', uid, subName), where('userId', '==', uid));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
          setter(items);
          markLoaded(subName);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colPath);
        }
      );
      unsubs.push(unsub);
    };

    bindCollection<Account>('accounts', setAccounts);
    bindCollection<Category>('categories', setCategories);
    bindCollection<CreditCard>('cards', setCards);
    bindCollection<Transaction>('transactions', setTransactions);
    bindCollection<Transfer>('transfers', setTransfers);
    bindCollection<InvoicePayment>('invoicePayments', setInvoicePayments);
    bindCollection<Recurrence>('recurrences', setRecurrences);
    bindCollection<Budget>('budgets', setBudgets);
    bindCollection<Goal>('goals', setGoals);
    bindCollection<Debt>('debts', setDebts);
    bindCollection<Asset>('assets', setAssets);

    return () => {
      cancelled = true;
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [authReady, user, emailVerified]);

  const activeRecurrences = useMemo(
    () => (loading ? [] : filterActiveRecurrences(recurrences, accounts, cards)),
    [loading, recurrences, accounts, cards]
  );

  const activeTransactions = useMemo(
    () =>
      loading
        ? []
        : filterActiveTransactions(transactions, accounts, cards, activeRecurrences),
    [loading, transactions, accounts, cards, activeRecurrences]
  );

  const activeTransfers = useMemo(
    () => (loading ? [] : filterActiveTransfers(transfers, accounts)),
    [loading, transfers, accounts]
  );

  const activeInvoicePayments = useMemo(
    () => (loading ? [] : filterActiveInvoicePayments(invoicePayments, cards)),
    [loading, invoicePayments, cards]
  );

  const cleanedOrphansUidRef = useRef<string | null>(null);

  // Clean up any pre-existing orphaned documents left in Firestore from past deletions
  useEffect(() => {
    if (!user || (!user.isAnonymous && !emailVerified)) {
      cleanedOrphansUidRef.current = null;
      return;
    }
    if (loading || cleanedOrphansUidRef.current === user.uid) return;
    cleanedOrphansUidRef.current = user.uid;

    const activeRecIds = new Set(activeRecurrences.map((r) => r.id));
    const activeTxIds = new Set(activeTransactions.map((t) => t.id));
    const activeTransferIds = new Set(activeTransfers.map((t) => t.id));
    const activeInvPayIds = new Set(activeInvoicePayments.map((p) => p.id));

    const orphanRecIds = recurrences.filter((r) => !activeRecIds.has(r.id)).map((r) => r.id);
    const orphanTxIds = transactions.filter((t) => !activeTxIds.has(t.id)).map((t) => t.id);
    const orphanTransferIds = transfers.filter((t) => !activeTransferIds.has(t.id)).map((t) => t.id);
    const orphanInvPayIds = invoicePayments
      .filter((p) => !activeInvPayIds.has(p.id))
      .map((p) => p.id);

    if (
      orphanRecIds.length === 0 &&
      orphanTxIds.length === 0 &&
      orphanTransferIds.length === 0 &&
      orphanInvPayIds.length === 0
    ) {
      return;
    }

    void cleanupOrphanedRecords(user.uid, {
      transactionIds: orphanTxIds,
      transferIds: orphanTransferIds,
      invoicePaymentIds: orphanInvPayIds,
      recurrenceIds: orphanRecIds,
    }).catch(() => undefined);
  }, [
    loading,
    user,
    emailVerified,
    recurrences,
    transactions,
    transfers,
    invoicePayments,
    activeRecurrences,
    activeTransactions,
    activeTransfers,
    activeInvoicePayments,
  ]);

  const syncedBatchKeysRef = useRef<Set<string>>(new Set());

  // Automatically propagate active recurrences into current month and next month
  useEffect(() => {
    if (loading || !user || (!user.isAnonymous && !emailVerified)) return;
    if (activeRecurrences.length === 0) return;

    const currentMonth = getCurrentMonthKey();
    const nextMonth = shiftMonth(currentMonth, 1);

    const needsSync = activeRecurrences.some((rec) => {
      if (!rec.active) return false;
      if (rec.lastGeneratedMonth && rec.lastGeneratedMonth >= nextMonth) return false;
      const key = `${user.uid}__${rec.id}__${nextMonth}`;
      return !syncedBatchKeysRef.current.has(key);
    });

    if (!needsSync) return;

    for (const rec of activeRecurrences) {
      if (rec.active) {
        syncedBatchKeysRef.current.add(`${user.uid}__${rec.id}__${nextMonth}`);
      }
    }

    void syncRecurrencesThroughNextMonth(
      user.uid,
      activeRecurrences,
      activeTransactions,
      cards
    ).catch((err) => {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Não foi possível sincronizar recorrências para o próximo mês.'
      );
    });
  }, [loading, user, emailVerified, activeRecurrences, activeTransactions, cards]);

  return (
    <FinanceDataContext.Provider
      value={{
        loading,
        dataError,
        clearDataError: () => setDataError(null),
        activeMonth,
        setActiveMonth,
        theme,
        toggleTheme,
        setThemeMode,
        settings,
        accounts,
        categories,
        cards,
        transactions: activeTransactions,
        transfers: activeTransfers,
        invoicePayments: activeInvoicePayments,
        recurrences: activeRecurrences,
        budgets,
        goals,
        debts,
        assets,
      }}
    >
      {children}
    </FinanceDataContext.Provider>
  );
}

export function useFinanceData(): FinanceDataContextValue {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error('useFinanceData must be used inside FinanceDataProvider');
  return ctx;
}
