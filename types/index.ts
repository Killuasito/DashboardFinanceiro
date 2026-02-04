export interface Account {
  id: string;
  name: string;
  balance: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
  description?: string;
  transferPeerAccountId?: string | null;
  transferPeerTransactionId?: string | null;
}

export interface InvestmentFund {
  id: string;
  name: string;
  custodianAccountId: string;
  balance: number;
  createdAt: Date;
  lastQuotaValue?: number | null;
}

export interface InvestmentMovement {
  id: string;
  fundId: string;
  originAccountId: string;
  amount: number;
  type: 'buy' | 'sell';
  date: Date;
  quotaValue?: number | null;
  units?: number | null;
  accountTransactionId?: string;
  createdAt?: Date;
}

export interface DashboardSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  accounts: Account[];
}

export interface Alert {
  id: string;
  title: string;
  description?: string;
  dayOfMonth: number;
  lastPaidMonth?: string | null;
  category?: string;
  amount?: number;
  accountId?: string;
  type?: 'payable' | 'receivable';
  transactionId?: string | null;
  createdAt?: Date;
}

export const CATEGORIES = [
  'Alimentação',
  'Clientes',
  'Lazer',
  'Transporte',
  'Saúde',
  'Educação',
  'Moradia',
  'Outros',
] as const;