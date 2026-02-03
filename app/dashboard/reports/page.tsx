'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import { Account, Transaction, Alert, CATEGORIES } from '@/types';
import { FiCalendar, FiFileText, FiRefreshCw, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';

interface ReportItem extends Transaction {
  accountName: string;
}

interface AlertReportItem extends Alert {
  accountName?: string;
}

const formatDateInput = (date: Date) => date.toISOString().split('T')[0];

const formatMonthKey = (key: string) => {
  const [year, month] = key.split('-');
  return `${month}/${year}`;
};

const getMonthKeysInRange = (start: Date, end: Date) => {
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endLimit) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<'all' | string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [startDate, setStartDate] = useState(formatDateInput(firstDay));
  const [endDate, setEndDate] = useState(formatDateInput(lastDay));
  const [reportTitle, setReportTitle] = useState('');
  const [items, setItems] = useState<ReportItem[]>([]);
  const [alertItems, setAlertItems] = useState<AlertReportItem[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const unsubscribe = onSnapshot(accountsRef, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
      })) as Account[];
      setAccounts(data);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const catsRef = collection(db, 'users', user.uid, 'categories');
    const unsubscribe = onSnapshot(catsRef, (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => (docSnap.data().name as string | undefined)?.trim())
        .filter(Boolean) as string[];
      setUserCategories(list);
    });
    return unsubscribe;
  }, [user]);

  const categoryOptions = useMemo(() => {
    const merged = [...CATEGORIES, ...userCategories];
    const seen = new Set<string>();
    return merged.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userCategories]);

  const summary = useMemo(() => {
    const totalIncome = items
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = items
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
    };
  }, [items]);

  const handleGenerate = async () => {
    if (!user) return;
    setError('');
    setAlertItems([]);

    if (!startDate || !endDate) {
      setError('Preencha o período.');
      return;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Datas inválidas.');
      return;
    }
    if (start > end) {
      setError('A data inicial deve ser antes da final.');
      return;
    }

    const targetAccounts = selectedAccount === 'all'
      ? accounts
      : accounts.filter((acc) => acc.id === selectedAccount);

    if (targetAccounts.length === 0) {
      setError('Nenhuma conta para gerar relatório.');
      return;
    }

    setLoadingReport(true);
    try {
      const results: ReportItem[] = [];
      const alertsResults: AlertReportItem[] = [];
      const accountNameById = accounts.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {});

      const monthKeys = getMonthKeysInRange(start, end);

      for (const acc of targetAccounts) {
        const txRef = collection(db, 'users', user.uid, 'accounts', acc.id, 'transactions');
        const queryParts = [
          where('date', '>=', start),
          where('date', '<=', end),
        ];
        if (selectedCategory !== 'all') {
          queryParts.push(where('category', '==', selectedCategory));
        }
        const txQuery = query(txRef, ...queryParts, orderBy('date', 'desc'));
        const snapshot = await getDocs(txQuery);
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            id: docSnap.id,
            accountId: acc.id,
            accountName: acc.name,
            amount: data.amount,
            type: data.type,
            category: data.category,
            date: data.date?.toDate?.() ?? new Date(data.date),
            description: data.description,
          });
        });
      }

      const alertsRef = collection(db, 'users', user.uid, 'alerts');
      const alertsSnap = await getDocs(alertsRef);
      alertsSnap.forEach((docSnap) => {
        const data = docSnap.data() as Alert;
        const lastPaidMonth = data.lastPaidMonth || null;

        if (!lastPaidMonth || !monthKeys.includes(lastPaidMonth)) return;

        const normalizedType = data.type || 'payable';
        alertsResults.push({
          id: docSnap.id,
          ...data,
          type: normalizedType,
          accountName: data.accountId ? accountNameById[data.accountId] : undefined,
        });
      });

      alertsResults.sort((a, b) => {
        if (a.lastPaidMonth === b.lastPaidMonth) return (a.title || '').localeCompare(b.title || '');
        if (!a.lastPaidMonth) return 1;
        if (!b.lastPaidMonth) return -1;
        return b.lastPaidMonth.localeCompare(a.lastPaidMonth);
      });

      results.sort((a, b) => (b.date as any) - (a.date as any));
      setItems(results);
      setAlertItems(alertsResults);
      setReportTitle(`Relatório - ${startDate.split('-').reverse().join('/')} a ${endDate
        .split('-')
        .reverse()
        .join('/')}`);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      setError('Não foi possível gerar o relatório.');
    } finally {
      setLoadingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="ml-64 p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-sm font-bold text-blue-500 dark:text-blue-300 flex items-center gap-2 uppercase tracking-wider">
              <FiFileText />
              Relatórios
            </p>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">{reportTitle || 'Relatório de Período'}</h1>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg hover:scale-105 transition"
            disabled={loadingReport}
          >
            <FiRefreshCw className={loadingReport ? 'animate-spin' : ''} />
            {loadingReport ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Período</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <FiCalendar className="text-blue-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <FiCalendar className="text-blue-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Conta</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value as 'all' | string)}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todas as contas</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Categoria</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'all' | string)}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todas</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-rose-400 dark:text-rose-300 font-semibold">{error}</p>}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <FiTrendingUp className="text-emerald-500" /> Entradas
            </p>
            <p className="text-2xl font-black text-emerald-600">R$ {summary.totalIncome.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <FiTrendingDown className="text-rose-500" /> Saídas
            </p>
            <p className="text-2xl font-black text-rose-600">R$ {summary.totalExpense.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Saldo do período</p>
            <p
              className={`text-2xl font-black ${
                summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              R$ {summary.net.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Alertas pagos/recebidos</h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{alertItems.length} marcados no período</span>
          </div>
          {alertItems.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Nenhum alerta marcado como pago/recebido neste período.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alertItems.map((alert) => {
                const badgeColor = alert.type === 'receivable' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200';
                const badgeLabel = alert.type === 'receivable' ? 'Recebido' : 'Pago';
                return (
                  <div key={alert.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        {alert.lastPaidMonth && (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatMonthKey(alert.lastPaidMonth)}</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{alert.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {alert.category || 'Sem categoria'} • {alert.accountName || 'Conta não definida'}
                      </p>
                      {alert.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[360px]">{alert.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {typeof alert.amount === 'number' && (
                        <p className={`text-lg font-bold ${alert.type === 'receivable' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {alert.type === 'receivable' ? '+' : '-'} R$ {alert.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Resultados</h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{items.length} transações</span>
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Nenhuma transação no período selecionado.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{item.category}</p>
                    {item.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[320px]">{item.description}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {new Date(item.date).toLocaleDateString('pt-BR')} • {item.accountName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        item.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {item.type === 'income' ? '+' : '-'} R$ {item.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
