'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { FiSend, FiCpu, FiAlertTriangle, FiLink2 } from 'react-icons/fi';
import { Account, Transaction } from '@/types';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';

interface FinanceAssistantProps {
  accountId: string;
  accountName: string;
  accountBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type AttachedAccountContext = {
  accountId: string;
  accountName: string;
  accountBalance: number;
  totalIncome: number;
  totalExpense: number;
  netMonth: number;
  topExpenses: string[];
  recentTransactions: Array<{
    date: string;
    type: string;
    category: string;
    amount: number;
    description?: string;
  }>;
};

const renderInline = (text: string): ReactNode => {
  const fragments: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      fragments.push(text.slice(lastIndex, match.index));
    }

    if (match[1].startsWith('**')) {
      fragments.push(
        <strong key={`b-${match.index}`} className="font-semibold text-slate-900 dark:text-slate-100">
          {match[2]}
        </strong>
      );
    } else {
      fragments.push(
        <em key={`i-${match.index}`} className="italic text-slate-800 dark:text-slate-200">
          {match[3]}
        </em>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragments.push(text.slice(lastIndex));
  }

  return fragments;
};

const renderContent = (content: string): ReactNode => {
  const lines = content.split(/\n/);
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc list-outside pl-5 space-y-1">
        {bullets.map((item, idx) => (
          <li key={`li-${idx}`} className="leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
      return;
    }

    flushBullets();
    if (line.length > 0) {
      nodes.push(
        <p key={`p-${nodes.length}`} className="leading-relaxed mb-2 last:mb-0">
          {renderInline(line)}
        </p>
      );
    }
  });

  flushBullets();
  return nodes;
};

export default function FinanceAssistant({
  accountId,
  accountName,
  accountBalance,
  totalIncome,
  totalExpense,
  transactions,
}: FinanceAssistantProps) {
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pendingAttachId, setPendingAttachId] = useState('');
  const [attachedAccountId, setAttachedAccountId] = useState<string | null>(null);
  const [attachedContext, setAttachedContext] = useState<AttachedAccountContext | null>(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Oi! Posso analisar entradas e saídas e sugerir cortes ou metas de economia. O que você quer ajustar primeiro?',
    },
  ]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachmentLoaded, setAttachmentLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = useMemo(() => `ai-chat-${user?.uid ?? 'anon'}-${accountId}`, [user?.uid, accountId]);
  const attachedStorageKey = useMemo(() => `${storageKey}-attached`, [storageKey]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'accounts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.(),
      })) as Account[];
      setAccounts(accountsData);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || authLoading) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (err) {
        console.error('Falha ao carregar histórico do assistente:', err);
      }
    }
    setHistoryLoaded(true);
  }, [storageKey, authLoading]);

  useEffect(() => {
    if (typeof window === 'undefined' || !historyLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [storageKey, messages, historyLoaded]);

  useEffect(() => {
    if (typeof window === 'undefined' || authLoading) return;
    const savedAttached = localStorage.getItem(attachedStorageKey);
    if (savedAttached) {
      setAttachedAccountId(savedAttached);
      setPendingAttachId(savedAttached);
    }
    setAttachmentLoaded(true);
  }, [attachedStorageKey, authLoading]);

  useEffect(() => {
    if (typeof window === 'undefined' || !attachmentLoaded) return;
    if (attachedAccountId) {
      localStorage.setItem(attachedStorageKey, attachedAccountId);
    } else {
      localStorage.removeItem(attachedStorageKey);
    }
  }, [attachedStorageKey, attachedAccountId, attachmentLoaded]);

  useEffect(() => {
    if (pendingAttachId || accounts.length === 0) return;
    const firstOption = accounts.find((acc) => acc.id !== accountId);
    if (firstOption) {
      setPendingAttachId(firstOption.id);
    }
  }, [accounts, pendingAttachId, accountId]);

  useEffect(() => {
    if (!user || !attachedAccountId) {
      setAttachedContext(null);
      setAttachLoading(false);
      setAttachError(null);
      return;
    }

    if (attachedAccountId === accountId) {
      setAttachError('Selecione uma conta diferente da atual.');
      setAttachedAccountId(null);
      return;
    }

    let cancelled = false;
    const loadAttached = async () => {
      setAttachLoading(true);
      setAttachError(null);
      try {
        const accountRef = doc(db, 'users', user.uid, 'accounts', attachedAccountId);
        const accountSnap = await getDoc(accountRef);
        if (!accountSnap.exists()) {
          throw new Error('Conta não encontrada');
        }

        const accountData = accountSnap.data();
        const transactionsRef = collection(db, 'users', user.uid, 'accounts', attachedAccountId, 'transactions');
        const txSnapshot = await getDocs(query(transactionsRef, orderBy('date', 'desc'), limit(120)));

        const txData = txSnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            accountId: attachedAccountId,
            ...data,
            date: data.date?.toDate?.() ?? new Date(data.date ?? Date.now()),
          } as Transaction;
        });

        const now = new Date();
        const monthTx = txData.filter((t) => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const totalIncomeOther = monthTx
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpenseOther = monthTx
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const expensesByCategory = monthTx
          .filter((t) => t.type === 'expense')
          .reduce<Record<string, number>>((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Number(t.amount || 0);
            return acc;
          }, {});

        const topExpenses = Object.entries(expensesByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([category, value]) => `${category}: R$ ${value.toFixed(2)}`);

        const recentTransactions = txData.slice(0, 20).map((t) => ({
          date: new Date(t.date).toISOString().split('T')[0],
          type: t.type,
          category: t.category,
          amount: Number(Number(t.amount || 0).toFixed(2)),
          description: t.description,
        }));

        if (cancelled) return;

        setAttachedContext({
          accountId: attachedAccountId,
          accountName: accountData.name || 'Conta sem nome',
          accountBalance: Number((accountData.balance ?? 0) as number),
          totalIncome: Number(totalIncomeOther.toFixed(2)),
          totalExpense: Number(totalExpenseOther.toFixed(2)),
          netMonth: Number((totalIncomeOther - totalExpenseOther).toFixed(2)),
          topExpenses,
          recentTransactions,
        });
      } catch (err) {
        console.error('Falha ao anexar conta:', err);
        if (!cancelled) {
          setAttachError('Não foi possível anexar a conta agora.');
          setAttachedContext(null);
        }
      } finally {
        if (!cancelled) setAttachLoading(false);
      }
    };

    loadAttached();
    return () => {
      cancelled = true;
    };
  }, [user, attachedAccountId, accountId]);

  const quickPrompts = [
    {
      label: 'Plano de emergência',
      prompt: 'Monte um plano de emergência para sair do negativo em 30 dias, com cortes concretos por categoria e valores semanais.',
    },
    {
      label: 'Cortes rápidos',
      prompt: 'Liste 5 cortes imediatos por categoria com valores estimados e impacto no saldo em 30 dias.',
    },
    {
      label: 'Meta de 3 meses',
      prompt: 'Defina uma meta de economia para 3 meses, sugira distribuição 50-30-20 e cite riscos.',
    },
    {
      label: 'Reequilibrar gastos',
      prompt: 'Analise despesas e proponha novo teto por categoria para manter o saldo positivo neste mês.',
    },
    {
      label: 'Perguntas diagnósticas',
      prompt: 'Faça até 5 perguntas objetivas para diagnosticar o orçamento e priorizar ações.',
    },
  ];
  const primaryContext = useMemo(() => {
    const recentTransactions = transactions
      .slice(0, 20)
      .map((t) => ({
        date: new Date(t.date).toISOString().split('T')[0],
        type: t.type,
        category: t.category,
        amount: Number(t.amount.toFixed(2)),
        description: t.description,
      }));

    const netMonth = totalIncome - totalExpense;
    const expensesByCategory = transactions.reduce<Record<string, number>>((acc, t) => {
      if (t.type !== 'expense') return acc;
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const topExpenses = Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, value]) => `${category}: R$ ${value.toFixed(2)}`);

    return {
      accountId,
      accountName,
      accountBalance: Number(accountBalance.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      netMonth: Number(netMonth.toFixed(2)),
      topExpenses,
      recentTransactions,
    };
  }, [accountId, accountName, accountBalance, totalIncome, totalExpense, transactions]);

  const contextForModel = useMemo(
    () => ({
      primaryAccount: primaryContext,
      secondaryAccount: attachedContext ?? undefined,
    }),
    [primaryContext, attachedContext]
  );

  const attachableAccounts = useMemo(
    () => accounts.filter((acc) => acc.id !== accountId),
    [accounts, accountId]
  );

  const handleAttachAccount = () => {
    if (!pendingAttachId) {
      setAttachError('Escolha uma conta para anexar.');
      return;
    }
    setAttachError(null);
    setAttachedAccountId(pendingAttachId);
  };

  const handleClearAttachment = () => {
    setAttachedAccountId(null);
    setPendingAttachId('');
    setAttachError(null);
  };

  const sendMessage = async (content: string) => {
    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    const nextMessages = [...messages, newUserMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: c }) => ({ role, content: c })),
          context: contextForModel,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.reply) {
        setError(data.error || 'Não foi possível obter uma resposta agora.');
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: data.reply },
        ]);
      }
    } catch (err) {
      console.error(err);
      setError('Falha ao contatar a IA. Confira a chave ou tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    await sendMessage(trimmed);
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border-2 border-blue-200 dark:border-blue-900">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 text-white shadow-lg">
          <FiCpu size={20} />
        </div>
        <div>
          <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Assistente IA</p>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Sugestões de economia</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <InsightTile
          title="Saldo"
          value={`R$ ${accountBalance.toFixed(2)}`}
          tone={accountBalance >= 0 ? 'positive' : 'alert'}
          hint={accountBalance >= 0 ? 'Saldo em dia' : 'Priorize quitar o negativo'}
        />
        <InsightTile
          title="Fluxo do mês"
          value={`R$ ${(totalIncome - totalExpense).toFixed(2)}`}
          tone={totalIncome - totalExpense >= 0 ? 'positive' : 'alert'}
          hint={totalIncome - totalExpense >= 0 ? 'Superávit' : 'Ajuste gastos já'}
        />
        <InsightTile
          title="Top gastos"
          value={primaryContext.topExpenses?.[0] || 'Sem dados'}
          tone="neutral"
          hint="Revise limites dessa categoria"
        />
      </div>

      <div className="mb-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-200">
          <FiLink2 size={16} />
          <span>Anexar outra conta</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Compartilhe outra conta para a IA comparar saldos, entradas e saídas lado a lado.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <select
            value={pendingAttachId}
            onChange={(e) => setPendingAttachId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
            disabled={attachLoading || attachableAccounts.length === 0}
          >
            <option value="">Selecione uma conta</option>
            {attachableAccounts.length === 0 && <option value="" disabled>Nenhuma conta extra disponível</option>}
            {attachableAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} — R$ {(acc.balance || 0).toFixed(2)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttachAccount}
              disabled={attachLoading || attachableAccounts.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition disabled:opacity-60"
            >
              {attachLoading ? 'Anexando...' : 'Anexar conta'}
            </button>
            {attachedContext && (
              <button
                type="button"
                onClick={handleClearAttachment}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Remover
              </button>
            )}
          </div>
        </div>
        {attachError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{attachError}</p>}
        {attachedContext && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider">Conta anexada</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 truncate">{attachedContext.accountName}</p>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider">Saldo</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100">R$ {attachedContext.accountBalance.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wider">Fluxo do mês</p>
              <p className="text-base font-black text-slate-800 dark:text-slate-100">R$ {attachedContext.netMonth.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {quickPrompts.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => !loading && sendMessage(item.prompt)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-100 transition disabled:opacity-60"
            disabled={loading}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-4 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-800">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-xl text-sm leading-relaxed shadow-sm border ${
              msg.role === 'assistant'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            }`}
          >
            <span className="block font-bold mb-1 text-xs uppercase tracking-wider">
              {msg.role === 'assistant' ? 'Assistente' : 'Você'}
            </span>
            <div className="space-y-1 whitespace-pre-line">{renderContent(msg.content)}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 text-sm mb-3">
          <FiAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte como reduzir gastos ou criar metas..."
          className="flex-1 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition disabled:opacity-60 disabled:hover:scale-100"
        >
          <FiSend size={18} />
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

interface InsightTileProps {
  title: string;
  value: string;
  hint: string;
  tone: 'positive' | 'neutral' | 'alert';
}

function InsightTile({ title, value, hint, tone }: InsightTileProps) {
  const toneClasses = {
    positive: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100',
    neutral: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100',
    alert: 'border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100',
  } as const;

  return (
    <div className={`rounded-xl p-3 text-sm font-medium border shadow-sm ${toneClasses[tone]}`}>
      <div className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</div>
      <div className="text-lg font-black leading-tight">{value}</div>
      <div className="text-xs opacity-80 mt-1">{hint}</div>
    </div>
  );
}
