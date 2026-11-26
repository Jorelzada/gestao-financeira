export type ThemeMode = 'light' | 'dark';

export interface UserSettings {
  id: string;
  userId: string;
  displayAlias: string;
  theme: ThemeMode;
  currency: 'BRL';
  seededDefaults: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment';

export interface Account {
  id: string;
  userId: string;
  name: string;
  institution: string;
  type: AccountType;
  initialBalanceCents: number;
  color: string;
  archived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'account' | 'card';
export type TransactionStatus = 'paid' | 'pending';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  brand: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
  archived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  invoiceMonth: string; // YYYY-MM or ''
  status: TransactionStatus;
  installmentGroupId: string;
  installmentNumber: number;
  totalInstallments: number;
  recurrenceId: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Transfer {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvoicePayment {
  id: string;
  userId: string;
  cardId: string;
  accountId: string;
  invoiceMonth: string; // YYYY-MM
  amountCents: number;
  paidDate: string; // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly';

export interface Recurrence {
  id: string;
  userId: string;
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
  lastGeneratedMonth: string; // YYYY-MM or ''
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitCents: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type GoalStatus = 'active' | 'completed';

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string; // YYYY-MM-DD
  color: string;
  status: GoalStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DebtStatus = 'active' | 'paid';

export interface Debt {
  id: string;
  userId: string;
  name: string;
  creditor: string;
  totalCents: number;
  remainingCents: number;
  monthlyPaymentCents: number;
  interestRatePercent: number;
  dueDay: number;
  status: DebtStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AssetCategory =
  | 'fixed_income'
  | 'equities'
  | 'real_estate'
  | 'vehicle'
  | 'reserve'
  | 'other';

export type AssetLiquidity = 'high' | 'medium' | 'low';

export interface Asset {
  id: string;
  userId: string;
  name: string;
  category: AssetCategory;
  valueCents: number;
  liquidity: AssetLiquidity;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CardInvoiceSummary {
  key: string; // `${cardId}__${invoiceMonth}`
  cardId: string;
  cardName: string;
  cardColor: string;
  invoiceMonth: string;
  closingDay: number;
  dueDay: number;
  totalCents: number;
  transactions: Transaction[];
  payment: InvoicePayment | null;
  status: 'paid' | 'closed' | 'open';
}

export interface InstallmentGroupSummary {
  groupId: string;
  description: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  totalInstallments: number;
  paidCount: number;
  totalCents: number;
  remainingCents: number;
  installmentCents: number;
  firstDate: string;
  lastDate: string;
  items: Transaction[];
}
