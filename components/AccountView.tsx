'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { Transaction } from '@/types';
import TransactionModal from './TransactionModal';
import FinanceAssistant from './FinanceAssistant';
import { FiPlus, FiArrowUp, FiArrowDown, FiTrash, FiDollarSign, FiTrendingUp, FiTrendingDown, FiPieChart, FiBarChart2, FiList, FiChevronDown, FiChevronRight, FiEdit3 } from 'react-icons/fi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface AccountViewProps {
  accountId: string;
  accountName: string;
}

export default function AccountView({ accountId, accountName }: AccountViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountTitle, setAccountTitle] = useState(accountName);
  const [accountBalance, setAccountBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showTransactions, setShowTransactions] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const accountRef = doc(db, 'users', user.uid, 'accounts', accountId);
    const unsubscribe = onSnapshot(accountRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setAccountTitle(data.name || accountName);
      setAccountBalance(data.balance || 0);
    });

    return unsubscribe;
  }, [user, accountId, accountName]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'accounts', accountId, 'transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transData = snapshot.docs.map((doc) => ({
        id: doc.id,
        accountId,
        ...doc.data(),
        date: doc.data().date?.toDate(),
      })) as Transaction[];
      setTransactions(transData);
    });

    return unsubscribe;
  }, [user, accountId]);
  const handleDelete = async (transaction: Transaction) => {
    if (!user) return;
    const confirmDelete = window.confirm('Deseja excluir esta transação?');
    if (!confirmDelete) return;

    const accountRef = doc(db, 'users', user.uid, 'accounts', accountId);
    const transactionRef = doc(
      db,
      'users',
      user.uid,
      'accounts',
      accountId,
      'transactions',
      transaction.id
    );

    try {
      await runTransaction(db, async (tx) => {
        const accountSnap = await tx.get(accountRef);
        const currentBalance = accountSnap.exists() ? accountSnap.data().balance || 0 : 0;
        const delta = transaction.type === 'income' ? -transaction.amount : transaction.amount;
        tx.update(accountRef, { balance: currentBalance + delta });
        tx.delete(transactionRef);
      });
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthTransactions = transactions.filter((t) => {
    const tDate = t.date instanceof Date ? t.date : new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const totalIncome = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeByCategory = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const incomePieData = Object.entries(incomeByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const expensesByCategory = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ];

  const barData = [
    { name: 'Entradas', value: totalIncome, fill: '#10b981' },
    { name: 'Saídas', value: totalExpense, fill: '#ef4444' },
  ];

  const formatCurrency = (value: number | string | undefined) => {
    const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
    return `R$ ${numericValue.toFixed(2)}`;
  };

  const tooltipFormatter: TooltipProps<ValueType, NameType>['formatter'] = (value) => {
    if (Array.isArray(value)) {
      const firstValue = value[0];
      return formatCurrency(typeof firstValue === 'number' || typeof firstValue === 'string' ? firstValue : 0);
    }
    return formatCurrency(typeof value === 'number' || typeof value === 'string' ? value : 0);
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions]);

  const transactionsByDay = useMemo(() => {
    const groups: { key: string; label: string; items: Transaction[]; ts: number }[] = [];
    const map = new Map<string, { items: Transaction[]; ts: number; label: string }>();

    sortedTransactions.forEach((t) => {
      const dateObj = t.date instanceof Date ? t.date : new Date(t.date);
      const dateKey = Number.isNaN(dateObj.getTime()) ? 'invalid' : dateObj.toISOString().slice(0, 10);
      const label = Number.isNaN(dateObj.getTime())
        ? 'Data inválida'
        : dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      const ts = Number.isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();

      if (!map.has(dateKey)) {
        map.set(dateKey, { items: [], ts, label });
      }
      map.get(dateKey)!.items.push(t);
    });

    map.forEach((value, key) => {
      groups.push({ key, label: value.label, items: value.items, ts: value.ts });
    });

    groups.sort((a, b) => b.ts - a.ts);
    return groups;
  }, [sortedTransactions]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div className="border-l-4 border-blue-600 pl-4 sm:pl-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-blue-600 dark:text-blue-400 break-words">
            {accountTitle}
          </h2>
          <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 mt-2 font-semibold">
            Saldo:{' '}
            <span
              className={`font-black text-xl sm:text-2xl ${
                accountBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              R$ {accountBalance.toFixed(2)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white px-4 py-3 sm:px-6 sm:py-4 rounded-xl transition-all duration-200 font-bold shadow-lg shadow-blue-500/50 hover:shadow-xl hover:scale-105 w-full sm:w-auto"
        >
          <FiPlus size={20} />
          Nova Transação
        </button>
      </div>

      {/* Resumo da conta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 dark:from-slate-900 dark:to-slate-950 p-6 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-blue-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-br from-blue-500/10 to-cyan-500/10 rounded-full -mr-12 -mt-12"></div>
          <p className="relative text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FiDollarSign className="text-sm" />
            <span>Saldo Atual</span>
          </p>
          <p className={`relative text-4xl font-black mt-2 ${accountBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>R$ {accountBalance.toFixed(2)}</p>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-950 p-6 rounded-2xl shadow-xl border-2 border-emerald-200 dark:border-emerald-900 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -mr-12 -mt-12"></div>
          <p className="relative text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FiTrendingUp className="text-sm" />
            <span>Entradas (mês)</span>
          </p>
          <p className="relative text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-2">R$ {totalIncome.toFixed(2)}</p>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-slate-950 p-6 rounded-2xl shadow-xl border-2 border-rose-200 dark:border-rose-900 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-rose-500">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500/10 to-red-500/10 rounded-full -mr-12 -mt-12"></div>
          <p className="relative text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FiTrendingDown className="text-sm" />
            <span>Saídas (mês)</span>
          </p>
          <p className="relative text-4xl font-black text-rose-600 dark:text-rose-400 mt-2">R$ {totalExpense.toFixed(2)}</p>
        </div>
      </div>

      {/* Gráficos da conta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900">
          <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
            <FiPieChart />
            <span>Gastos por Categoria</span>
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={90}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFormatter} />
                <Legend
                  verticalAlign="bottom"
                  height={80}
                  wrapperStyle={{ overflowY: 'auto' }}
                  formatter={(value: string) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-12 font-medium">Nenhum gasto registrado neste mês</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900">
          <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
            <FiPieChart />
            <span>Recebimento por Categoria</span>
          </h3>
          {incomePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <Pie
                  data={incomePieData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={90}
                  dataKey="value"
                >
                  {incomePieData.map((entry, index) => (
                    <Cell key={`income-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFormatter} />
                <Legend
                  verticalAlign="bottom"
                  height={80}
                  wrapperStyle={{ overflowY: 'auto' }}
                  formatter={(value: string) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-12 font-medium">Nenhum recebimento registrado neste mês</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900">
          <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
            <FiBarChart2 />
            <span>Entradas vs Saídas</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="value">
                {barData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-8">
        <FinanceAssistant
          accountId={accountId}
          accountName={accountTitle}
          accountBalance={accountBalance}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          transactions={transactions}
        />
      </div>

      {/* Lista de Transações */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900">
        <div className="p-6 border-b-2 border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 flex items-center justify-between gap-4">
          <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <FiList />
            <span>Transações</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowTransactions((prev) => !prev)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-blue-200 dark:border-blue-800 shadow-sm transition"
            aria-expanded={showTransactions}
          >
            {showTransactions ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
            {showTransactions ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {!showTransactions && (
          <div className="p-6 text-slate-500 dark:text-slate-400 text-sm font-medium">
            Lista de transações recolhida
          </div>
        )}
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
            showTransactions ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
          aria-hidden={!showTransactions}
        >
          {transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
              Nenhuma transação registrada ainda
            </div>
          ) : (
            <div className="divide-y-2 divide-blue-100 dark:divide-blue-900">
              {transactionsByDay.map((group) => (
                <div key={group.key} className="border-b border-blue-100 dark:border-blue-900 last:border-b-0">
                  <div className="px-5 py-3 bg-blue-50/60 dark:bg-blue-950/30 flex items-center justify-between">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-200 uppercase tracking-wide">{group.label}</p>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{group.items.length} transações</span>
                  </div>
                  <div className="divide-y divide-blue-100 dark:divide-blue-900">
                    {group.items.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="p-5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-3 rounded-xl shadow-md ${
                              transaction.type === 'income'
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                                : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                            }`}
                          >
                            {transaction.type === 'income' ? (
                              <FiArrowUp size={24} />
                            ) : (
                              <FiArrowDown size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{transaction.category}</p>
                            {transaction.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400">{transaction.description}</p>
                            )}
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              {new Date(transaction.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div
                            className={`text-xl font-bold ${
                              transaction.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {transaction.type === 'income' ? '+' : '-'} R${' '}
                            {transaction.amount.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingTransaction(transaction);
                                setShowModal(true);
                              }}
                              className="p-2 rounded-lg text-slate-400 hover:text-blue-500 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                              aria-label="Editar transação"
                            >
                              <FiEdit3 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all duration-200"
                              aria-label="Excluir transação"
                            >
                              <FiTrash size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <TransactionModal
          accountId={accountId}
          onClose={() => {
            setShowModal(false);
            setEditingTransaction(null);
          }}
          transaction={editingTransaction || undefined}
        />
      )}
    </div>
  );
}