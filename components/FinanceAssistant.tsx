'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Transaction } from '@/types';
import { FiSend, FiCpu, FiAlertTriangle } from 'react-icons/fi';

interface FinanceAssistantProps {
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
  accountName,
  accountBalance,
  totalIncome,
  totalExpense,
  transactions,
}: FinanceAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Oi! Posso analisar entradas e saídas e sugerir cortes ou metas de economia. O que você quer ajustar primeiro?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const contextForModel = useMemo(() => {
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
      accountName,
      accountBalance: Number(accountBalance.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      netMonth: Number(netMonth.toFixed(2)),
      topExpenses,
      recentTransactions,
    };
  }, [accountName, accountBalance, totalIncome, totalExpense, transactions]);

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
          value={contextForModel.topExpenses?.[0] || 'Sem dados'}
          tone="neutral"
          hint="Revise limites dessa categoria"
        />
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
