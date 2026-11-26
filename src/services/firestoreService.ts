import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  addMonthsToDate,
  computeInvoiceMonth,
  MAX_SAFE_CENTS,
  splitInstallmentsInCents,
} from '../lib/financeMath';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AccountType,
  AssetCategory,
  AssetLiquidity,
  CardInvoiceSummary,
  Debt,
  Goal,
  PaymentMethod,
  Recurrence,
  RecurrenceFrequency,
  ThemeMode,
  TransactionStatus,
  TransactionType,
} from '../types/finance';

function newId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  return Math.max(min, Math.min(max, n));
}

function safeColor(color: string, fallback = '#2563EB'): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
}> = [
  { name: 'Salário', type: 'income', color: '#16A34A', icon: 'Briefcase' },
  { name: 'Freelance', type: 'income', color: '#0EA5E9', icon: 'Laptop' },
  { name: 'Rendimentos', type: 'income', color: '#10B981', icon: 'TrendingUp' },
  { name: 'Outras Receitas', type: 'income', color: '#6366F1', icon: 'PlusCircle' },
  { name: 'Alimentação', type: 'expense', color: '#EA580C', icon: 'Utensils' },
  { name: 'Moradia', type: 'expense', color: '#2563EB', icon: 'Home' },
  { name: 'Transporte', type: 'expense', color: '#0284C7', icon: 'Car' },
  { name: 'Saúde', type: 'expense', color: '#DC2626', icon: 'HeartPulse' },
  { name: 'Educação', type: 'expense', color: '#7C3AED', icon: 'GraduationCap' },
  { name: 'Assinaturas', type: 'expense', color: '#D97706', icon: 'Repeat' },
  { name: 'Lazer', type: 'expense', color: '#DB2777', icon: 'Film' },
  { name: 'Compras', type: 'expense', color: '#4F46E5', icon: 'ShoppingBag' },
  { name: 'Outros', type: 'expense', color: '#64748B', icon: 'Tag' },
];

export async function ensureUserWorkspace(
  userId: string,
  displayAlias: string,
  preferredTheme: ThemeMode
): Promise<void> {
  const userPath = `users/${userId}`;
  const userRef = doc(db, 'users', userId);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.seededDefaults) return;
    }

    const batch = writeBatch(db);
    if (!snap.exists()) {
      batch.set(userRef, {
        userId,
        displayAlias: clampStr(displayAlias, 60) || 'Minha Conta',
        theme: preferredTheme,
        currency: 'BRL',
        seededDefaults: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(userRef, {
        seededDefaults: true,
        updatedAt: serverTimestamp(),
      });
    }

    // Seed clean structural categories and an initial zero-balance wallet account
    const existingCats = await getDocs(
      query(collection(db, 'users', userId, 'categories'), where('userId', '==', userId))
    );
    if (existingCats.empty) {
      for (const cat of DEFAULT_CATEGORIES) {
        const catId = newId('cat');
        batch.set(doc(db, 'users', userId, 'categories', catId), {
          userId,
          name: cat.name,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const existingAccs = await getDocs(
      query(collection(db, 'users', userId, 'accounts'), where('userId', '==', userId))
    );
    if (existingAccs.empty) {
      const accId = newId('acc');
      batch.set(doc(db, 'users', userId, 'accounts', accId), {
        userId,
        name: 'Conta Principal',
        institution: 'Carteira',
        type: 'checking',
        initialBalanceCents: 0,
        color: '#2563EB',
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function updateUserTheme(userId: string, theme: ThemeMode): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      theme,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileAlias(
  userId: string,
  displayAlias: string,
  theme: ThemeMode
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      displayAlias: clampStr(displayAlias, 60) || 'Minha Conta',
      theme,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Accounts ---
export async function createAccount(
  userId: string,
  input: {
    name: string;
    institution: string;
    type: AccountType;
    initialBalanceCents: number;
    color: string;
  }
): Promise<string> {
  const id = newId('acc');
  const path = `users/${userId}/accounts/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'accounts', id), {
      userId,
      name: clampStr(input.name, 60),
      institution: clampStr(input.institution, 60),
      type: input.type,
      initialBalanceCents: clampInt(input.initialBalanceCents, -MAX_SAFE_CENTS, MAX_SAFE_CENTS),
      color: safeColor(input.color),
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: {
    name: string;
    institution: string;
    type: AccountType;
    initialBalanceCents: number;
    color: string;
  }
): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'accounts', accountId), {
      name: clampStr(input.name, 60),
      institution: clampStr(input.institution, 60),
      type: input.type,
      initialBalanceCents: clampInt(input.initialBalanceCents, -MAX_SAFE_CENTS, MAX_SAFE_CENTS),
      color: safeColor(input.color),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleAccountArchived(
  userId: string,
  accountId: string,
  archived: boolean
): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'accounts', accountId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  const path = `users/${userId}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Categories ---
export async function createCategory(
  userId: string,
  input: { name: string; type: TransactionType; color: string; icon: string }
): Promise<string> {
  const id = newId('cat');
  const path = `users/${userId}/categories/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'categories', id), {
      userId,
      name: clampStr(input.name, 50),
      type: input.type,
      color: safeColor(input.color),
      icon: clampStr(input.icon || 'Tag', 32),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: { name: string; type: TransactionType; color: string; icon: string }
): Promise<void> {
  const path = `users/${userId}/categories/${categoryId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'categories', categoryId), {
      name: clampStr(input.name, 50),
      type: input.type,
      color: safeColor(input.color),
      icon: clampStr(input.icon || 'Tag', 32),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const path = `users/${userId}/categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'categories', categoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Fictional Credit Cards ---
export async function createCard(
  userId: string,
  input: {
    name: string;
    brand: string;
    limitCents: number;
    closingDay: number;
    dueDay: number;
    color: string;
  }
): Promise<string> {
  const id = newId('card');
  const path = `users/${userId}/cards/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'cards', id), {
      userId,
      name: clampStr(input.name, 60),
      brand: clampStr(input.brand || 'Virtual', 30),
      limitCents: clampInt(input.limitCents, 0, MAX_SAFE_CENTS),
      closingDay: clampInt(input.closingDay, 1, 28),
      dueDay: clampInt(input.dueDay, 1, 28),
      color: safeColor(input.color, '#0F172A'),
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCard(
  userId: string,
  cardId: string,
  input: {
    name: string;
    brand: string;
    limitCents: number;
    closingDay: number;
    dueDay: number;
    color: string;
  }
): Promise<void> {
  const path = `users/${userId}/cards/${cardId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'cards', cardId), {
      name: clampStr(input.name, 60),
      brand: clampStr(input.brand || 'Virtual', 30),
      limitCents: clampInt(input.limitCents, 0, MAX_SAFE_CENTS),
      closingDay: clampInt(input.closingDay, 1, 28),
      dueDay: clampInt(input.dueDay, 1, 28),
      color: safeColor(input.color, '#0F172A'),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const path = `users/${userId}/cards/${cardId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'cards', cardId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Transactions & Installments ---
export async function createTransactionOrInstallments(
  userId: string,
  input: {
    type: TransactionType;
    description: string;
    totalAmountCents: number;
    date: string;
    categoryId: string;
    paymentMethod: PaymentMethod;
    accountId: string;
    cardId: string;
    cardClosingDay?: number;
    status: TransactionStatus;
    installmentsCount: number;
    notes: string;
  }
): Promise<void> {
  const count = clampInt(input.installmentsCount, 1, 120);
  const path = `users/${userId}/transactions`;

  try {
    const batch = writeBatch(db);
    const groupId = count > 1 ? newId('inst') : '';
    const amounts = splitInstallmentsInCents(
      clampInt(input.totalAmountCents, 1, MAX_SAFE_CENTS),
      count
    );

    for (let i = 0; i < count; i++) {
      const txId = newId('tx');
      const txDate = i === 0 ? input.date : addMonthsToDate(input.date, i);
      const isCard = input.paymentMethod === 'card' && input.type === 'expense';
      const invoiceMonth = isCard
        ? computeInvoiceMonth(txDate, input.cardClosingDay ?? 10)
        : '';

      const descBase = clampStr(input.description, 105);
      const description =
        count > 1 ? `${descBase} (${i + 1}/${count})` : clampStr(input.description, 120);

      batch.set(doc(db, 'users', userId, 'transactions', txId), {
        userId,
        type: input.type,
        description,
        amountCents: Math.max(1, amounts[i]),
        date: txDate,
        categoryId: input.categoryId,
        paymentMethod: isCard ? 'card' : 'account',
        accountId: isCard ? '' : input.accountId,
        cardId: isCard ? input.cardId : '',
        invoiceMonth,
        status: isCard ? 'pending' : i === 0 ? input.status : 'pending',
        installmentGroupId: groupId,
        installmentNumber: i + 1,
        totalInstallments: count,
        recurrenceId: '',
        notes: clampStr(input.notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: {
    type: TransactionType;
    description: string;
    amountCents: number;
    date: string;
    categoryId: string;
    paymentMethod: PaymentMethod;
    accountId: string;
    cardId: string;
    cardClosingDay?: number;
    status: TransactionStatus;
    notes: string;
  }
): Promise<void> {
  const path = `users/${userId}/transactions/${transactionId}`;
  const isCard = input.paymentMethod === 'card' && input.type === 'expense';
  const invoiceMonth = isCard
    ? computeInvoiceMonth(input.date, input.cardClosingDay ?? 10)
    : '';
  try {
    await updateDoc(doc(db, 'users', userId, 'transactions', transactionId), {
      type: input.type,
      description: clampStr(input.description, 120),
      amountCents: clampInt(input.amountCents, 1, MAX_SAFE_CENTS),
      date: input.date,
      categoryId: input.categoryId,
      paymentMethod: isCard ? 'card' : 'account',
      accountId: isCard ? '' : input.accountId,
      cardId: isCard ? input.cardId : '',
      invoiceMonth,
      status: input.status,
      notes: clampStr(input.notes, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleTransactionStatus(
  userId: string,
  transactionId: string,
  status: TransactionStatus
): Promise<void> {
  const path = `users/${userId}/transactions/${transactionId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'transactions', transactionId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  const path = `users/${userId}/transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'transactions', transactionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteInstallmentGroup(
  userId: string,
  transactionIds: string[]
): Promise<void> {
  const path = `users/${userId}/transactions`;
  try {
    const batch = writeBatch(db);
    for (const id of transactionIds) {
      batch.delete(doc(db, 'users', userId, 'transactions', id));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Transfers ---
export async function createTransfer(
  userId: string,
  input: {
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    date: string;
    description: string;
  }
): Promise<string> {
  const id = newId('trf');
  const path = `users/${userId}/transfers/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'transfers', id), {
      userId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountCents: clampInt(input.amountCents, 1, MAX_SAFE_CENTS),
      date: input.date,
      description: clampStr(input.description || 'Transferência entre contas', 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateTransfer(
  userId: string,
  transferId: string,
  input: {
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    date: string;
    description: string;
  }
): Promise<void> {
  const path = `users/${userId}/transfers/${transferId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'transfers', transferId), {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountCents: clampInt(input.amountCents, 1, MAX_SAFE_CENTS),
      date: input.date,
      description: clampStr(input.description || 'Transferência entre contas', 120),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteTransfer(userId: string, transferId: string): Promise<void> {
  const path = `users/${userId}/transfers/${transferId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'transfers', transferId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Credit Card Invoice Payments ---
export async function payCardInvoice(
  userId: string,
  invoice: CardInvoiceSummary,
  accountId: string,
  paidDate: string
): Promise<void> {
  const paymentId = `${invoice.cardId}__${invoice.invoiceMonth}`;
  const path = `users/${userId}/invoicePayments/${paymentId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', userId, 'invoicePayments', paymentId), {
      userId,
      cardId: invoice.cardId,
      accountId,
      invoiceMonth: invoice.invoiceMonth,
      amountCents: Math.max(1, invoice.totalCents),
      paidDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const tx of invoice.transactions) {
      if (tx.status !== 'paid') {
        batch.update(doc(db, 'users', userId, 'transactions', tx.id), {
          status: 'paid',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revertInvoicePayment(
  userId: string,
  invoice: CardInvoiceSummary
): Promise<void> {
  if (!invoice.payment) return;
  const path = `users/${userId}/invoicePayments/${invoice.payment.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'invoicePayments', invoice.payment.id));
    for (const tx of invoice.transactions) {
      if (tx.status === 'paid') {
        batch.update(doc(db, 'users', userId, 'transactions', tx.id), {
          status: 'pending',
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Recurrences ---
export async function createRecurrence(
  userId: string,
  input: {
    type: TransactionType;
    description: string;
    amountCents: number;
    categoryId: string;
    paymentMethod: PaymentMethod;
    accountId: string;
    cardId: string;
    dayOfMonth: number;
    frequency: RecurrenceFrequency;
  }
): Promise<string> {
  const id = newId('rec');
  const path = `users/${userId}/recurrences/${id}`;
  const isCard = input.paymentMethod === 'card' && input.type === 'expense';
  try {
    await setDoc(doc(db, 'users', userId, 'recurrences', id), {
      userId,
      type: input.type,
      description: clampStr(input.description, 120),
      amountCents: clampInt(input.amountCents, 1, MAX_SAFE_CENTS),
      categoryId: input.categoryId,
      paymentMethod: isCard ? 'card' : 'account',
      accountId: isCard ? '' : input.accountId,
      cardId: isCard ? input.cardId : '',
      dayOfMonth: clampInt(input.dayOfMonth, 1, 28),
      frequency: input.frequency,
      active: true,
      lastGeneratedMonth: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateRecurrence(
  userId: string,
  recurrenceId: string,
  input: {
    type: TransactionType;
    description: string;
    amountCents: number;
    categoryId: string;
    paymentMethod: PaymentMethod;
    accountId: string;
    cardId: string;
    dayOfMonth: number;
    frequency: RecurrenceFrequency;
    active: boolean;
  }
): Promise<void> {
  const path = `users/${userId}/recurrences/${recurrenceId}`;
  const isCard = input.paymentMethod === 'card' && input.type === 'expense';
  try {
    await updateDoc(doc(db, 'users', userId, 'recurrences', recurrenceId), {
      type: input.type,
      description: clampStr(input.description, 120),
      amountCents: clampInt(input.amountCents, 1, MAX_SAFE_CENTS),
      categoryId: input.categoryId,
      paymentMethod: isCard ? 'card' : 'account',
      accountId: isCard ? '' : input.accountId,
      cardId: isCard ? input.cardId : '',
      dayOfMonth: clampInt(input.dayOfMonth, 1, 28),
      frequency: input.frequency,
      active: input.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleRecurrenceActive(
  userId: string,
  recurrenceId: string,
  active: boolean
): Promise<void> {
  const path = `users/${userId}/recurrences/${recurrenceId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'recurrences', recurrenceId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function generateTransactionFromRecurrence(
  userId: string,
  recurrence: Recurrence,
  targetMonth: string,
  cardClosingDay?: number
): Promise<void> {
  const path = `users/${userId}/recurrences/${recurrence.id}`;
  const day = String(clampInt(recurrence.dayOfMonth, 1, 28)).padStart(2, '0');
  const dateStr = `${targetMonth}-${day}`;
  const isCard = recurrence.paymentMethod === 'card' && recurrence.type === 'expense';
  const invoiceMonth = isCard ? computeInvoiceMonth(dateStr, cardClosingDay ?? 10) : '';

  try {
    const batch = writeBatch(db);
    const txId = newId('tx');
    batch.set(doc(db, 'users', userId, 'transactions', txId), {
      userId,
      type: recurrence.type,
      description: recurrence.description,
      amountCents: recurrence.amountCents,
      date: dateStr,
      categoryId: recurrence.categoryId,
      paymentMethod: isCard ? 'card' : 'account',
      accountId: isCard ? '' : recurrence.accountId,
      cardId: isCard ? recurrence.cardId : '',
      invoiceMonth,
      status: 'pending',
      installmentGroupId: '',
      installmentNumber: 1,
      totalInstallments: 1,
      recurrenceId: recurrence.id,
      notes: 'Gerado automaticamente por recorrência',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'users', userId, 'recurrences', recurrence.id), {
      lastGeneratedMonth: targetMonth,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteRecurrence(userId: string, recurrenceId: string): Promise<void> {
  const path = `users/${userId}/recurrences/${recurrenceId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'recurrences', recurrenceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Budgets ---
export async function upsertBudget(
  userId: string,
  input: { id?: string; categoryId: string; month: string; limitCents: number }
): Promise<string> {
  const id = input.id || `${input.categoryId}_${input.month}`;
  const path = `users/${userId}/budgets/${id}`;
  try {
    if (input.id) {
      await updateDoc(doc(db, 'users', userId, 'budgets', id), {
        categoryId: input.categoryId,
        month: input.month,
        limitCents: clampInt(input.limitCents, 1, MAX_SAFE_CENTS),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingSnap = await getDoc(doc(db, 'users', userId, 'budgets', id));
      if (existingSnap.exists()) {
        await updateDoc(doc(db, 'users', userId, 'budgets', id), {
          limitCents: clampInt(input.limitCents, 1, MAX_SAFE_CENTS),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', userId, 'budgets', id), {
          userId,
          categoryId: input.categoryId,
          month: input.month,
          limitCents: clampInt(input.limitCents, 1, MAX_SAFE_CENTS),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const path = `users/${userId}/budgets/${budgetId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Goals ---
export async function createGoal(
  userId: string,
  input: {
    name: string;
    targetCents: number;
    currentCents: number;
    targetDate: string;
    color: string;
  }
): Promise<string> {
  const id = newId('goal');
  const path = `users/${userId}/goals/${id}`;
  const targetCents = clampInt(input.targetCents, 1, MAX_SAFE_CENTS);
  const currentCents = clampInt(input.currentCents, 0, MAX_SAFE_CENTS);
  try {
    await setDoc(doc(db, 'users', userId, 'goals', id), {
      userId,
      name: clampStr(input.name, 80),
      targetCents,
      currentCents,
      targetDate: input.targetDate,
      color: safeColor(input.color),
      status: currentCents >= targetCents ? 'completed' : 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateGoalDetails(
  userId: string,
  goal: Goal,
  input: {
    name: string;
    targetCents: number;
    targetDate: string;
    color: string;
  }
): Promise<void> {
  const path = `users/${userId}/goals/${goal.id}`;
  const targetCents = clampInt(input.targetCents, 1, MAX_SAFE_CENTS);
  try {
    if (goal.status === 'completed') {
      await updateDoc(doc(db, 'users', userId, 'goals', goal.id), {
        targetCents,
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', userId, 'goals', goal.id), {
        name: clampStr(input.name, 80),
        targetCents,
        targetDate: input.targetDate,
        color: safeColor(input.color),
        status: goal.currentCents >= targetCents ? 'completed' : 'active',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adjustGoalProgress(
  userId: string,
  goal: Goal,
  deltaCents: number
): Promise<void> {
  const path = `users/${userId}/goals/${goal.id}`;
  const nextCurrent = clampInt(goal.currentCents + deltaCents, 0, MAX_SAFE_CENTS);
  const nextStatus = nextCurrent >= goal.targetCents ? 'completed' : 'active';
  try {
    if (goal.status === 'completed') {
      await updateDoc(doc(db, 'users', userId, 'goals', goal.id), {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
      return;
    }
    await updateDoc(doc(db, 'users', userId, 'goals', goal.id), {
      currentCents: nextCurrent,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const path = `users/${userId}/goals/${goalId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'goals', goalId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Debts ---
export async function createDebt(
  userId: string,
  input: {
    name: string;
    creditor: string;
    totalCents: number;
    remainingCents: number;
    monthlyPaymentCents: number;
    interestRatePercent: number;
    dueDay: number;
  }
): Promise<string> {
  const id = newId('debt');
  const path = `users/${userId}/debts/${id}`;
  const totalCents = clampInt(input.totalCents, 1, MAX_SAFE_CENTS);
  const remainingCents = clampInt(input.remainingCents, 0, MAX_SAFE_CENTS);
  try {
    await setDoc(doc(db, 'users', userId, 'debts', id), {
      userId,
      name: clampStr(input.name, 80),
      creditor: clampStr(input.creditor, 60),
      totalCents,
      remainingCents,
      monthlyPaymentCents: clampInt(input.monthlyPaymentCents, 0, MAX_SAFE_CENTS),
      interestRatePercent: Math.max(0, Math.min(100, Number(input.interestRatePercent) || 0)),
      dueDay: clampInt(input.dueDay, 1, 28),
      status: remainingCents === 0 ? 'paid' : 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateDebt(
  userId: string,
  debt: Debt,
  input: {
    name: string;
    creditor: string;
    totalCents: number;
    remainingCents: number;
    monthlyPaymentCents: number;
    interestRatePercent: number;
    dueDay: number;
  }
): Promise<void> {
  const path = `users/${userId}/debts/${debt.id}`;
  const remainingCents = clampInt(input.remainingCents, 0, MAX_SAFE_CENTS);
  try {
    if (debt.status === 'paid') {
      await updateDoc(doc(db, 'users', userId, 'debts', debt.id), {
        status: 'active',
        remainingCents: Math.max(1, remainingCents),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    await updateDoc(doc(db, 'users', userId, 'debts', debt.id), {
      name: clampStr(input.name, 80),
      creditor: clampStr(input.creditor, 60),
      totalCents: clampInt(input.totalCents, 1, MAX_SAFE_CENTS),
      remainingCents,
      monthlyPaymentCents: clampInt(input.monthlyPaymentCents, 0, MAX_SAFE_CENTS),
      interestRatePercent: Math.max(0, Math.min(100, Number(input.interestRatePercent) || 0)),
      dueDay: clampInt(input.dueDay, 1, 28),
      status: remainingCents === 0 ? 'paid' : 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function registerDebtPayment(
  userId: string,
  debt: Debt,
  paymentCents: number,
  options?: {
    createTransaction: boolean;
    accountId: string;
    categoryId: string;
    date: string;
  }
): Promise<void> {
  const path = `users/${userId}/debts/${debt.id}`;
  const safePay = clampInt(paymentCents, 1, MAX_SAFE_CENTS);
  const nextRemaining = Math.max(0, debt.remainingCents - safePay);
  const nextStatus = nextRemaining === 0 ? 'paid' : 'active';

  try {
    const batch = writeBatch(db);
    if (debt.status === 'paid') {
      batch.update(doc(db, 'users', userId, 'debts', debt.id), {
        status: 'active',
        remainingCents: debt.remainingCents,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(doc(db, 'users', userId, 'debts', debt.id), {
        remainingCents: nextRemaining,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    }

    if (options?.createTransaction && options.accountId && options.categoryId) {
      const txId = newId('tx');
      batch.set(doc(db, 'users', userId, 'transactions', txId), {
        userId,
        type: 'expense',
        description: clampStr(`Amortização: ${debt.name}`, 120),
        amountCents: safePay,
        date: options.date,
        categoryId: options.categoryId,
        paymentMethod: 'account',
        accountId: options.accountId,
        cardId: '',
        invoiceMonth: '',
        status: 'paid',
        installmentGroupId: '',
        installmentNumber: 1,
        totalInstallments: 1,
        recurrenceId: '',
        notes: clampStr(`Pagamento para ${debt.creditor}`, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteDebt(userId: string, debtId: string): Promise<void> {
  const path = `users/${userId}/debts/${debtId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'debts', debtId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Net Worth Assets ---
export async function createAsset(
  userId: string,
  input: {
    name: string;
    category: AssetCategory;
    valueCents: number;
    liquidity: AssetLiquidity;
    notes: string;
  }
): Promise<string> {
  const id = newId('ast');
  const path = `users/${userId}/assets/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'assets', id), {
      userId,
      name: clampStr(input.name, 80),
      category: input.category,
      valueCents: clampInt(input.valueCents, 0, MAX_SAFE_CENTS),
      liquidity: input.liquidity,
      notes: clampStr(input.notes, 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateAsset(
  userId: string,
  assetId: string,
  input: {
    name: string;
    category: AssetCategory;
    valueCents: number;
    liquidity: AssetLiquidity;
    notes: string;
  }
): Promise<void> {
  const path = `users/${userId}/assets/${assetId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'assets', assetId), {
      name: clampStr(input.name, 80),
      category: input.category,
      valueCents: clampInt(input.valueCents, 0, MAX_SAFE_CENTS),
      liquidity: input.liquidity,
      notes: clampStr(input.notes, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const path = `users/${userId}/assets/${assetId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'assets', assetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Wipe User Workspace Data ---
const SUBCOLLECTIONS = [
  'transactions',
  'transfers',
  'invoicePayments',
  'recurrences',
  'budgets',
  'goals',
  'debts',
  'assets',
  'cards',
  'accounts',
  'categories',
] as const;

export async function resetUserWorkspace(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    for (const sub of SUBCOLLECTIONS) {
      const snap = await getDocs(
        query(collection(db, 'users', userId, sub), where('userId', '==', userId))
      );
      if (snap.empty) continue;
      // Delete in chunks of 400 to respect Firestore 500-op batch limit
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + 400)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    }
    await updateDoc(doc(db, 'users', userId), {
      seededDefaults: false,
      updatedAt: serverTimestamp(),
    });
    await ensureUserWorkspace(userId, 'Minha Conta', 'light');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
