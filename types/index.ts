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
}

export interface DashboardSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  accounts: Account[];
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