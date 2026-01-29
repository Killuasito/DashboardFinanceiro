'use client';

import { useState, useEffect } from 'react';
import { addDoc, collection, doc, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { CATEGORIES } from '@/types';
import { FiX, FiPlus, FiMinus, FiDollarSign, FiCalendar, FiTag, FiEdit3 } from 'react-icons/fi';

interface TransactionModalProps {
  accountId: string;
  onClose: () => void;
}

export default function TransactionModal({ accountId, onClose }: TransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const categoriesRef = collection(db, 'users', user.uid, 'categories');
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const cats = snapshot.docs
        .map((doc) => (doc.data().name as string | undefined)?.trim())
        .filter(Boolean) as string[];
      setUserCategories(cats);
    });

    return unsubscribe;
  }, [user]);

  const categoryOptions = [
    ...CATEGORIES,
    ...userCategories.filter(
      (cat) => !CATEGORIES.some((defaultCat) => defaultCat.toLowerCase() === cat.toLowerCase())
    ),
  ];

  const handleAddCategory = async () => {
    if (!user) return;
    const name = newCategory.trim();
    if (!name) return;

    const exists = categoryOptions.some((cat) => cat.toLowerCase() === name.toLowerCase());
    if (exists) {
      setNewCategory('');
      setCategory(name);
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'categories'), {
        name,
        createdAt: new Date(),
      });
      setNewCategory('');
      setCategory(name);
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount)) return;

    const accountRef = doc(db, 'users', user.uid, 'accounts', accountId);

    try {
      await addDoc(
        collection(db, 'users', user.uid, 'accounts', accountId, 'transactions'),
        {
          amount: numericAmount,
          type,
          category,
          date: new Date(date),
          description,
          createdAt: new Date(),
        }
      );

      // Atualiza o saldo da conta de forma transacional para refletir imediatamente no dashboard
      await runTransaction(db, async (transaction) => {
        const accountSnap = await transaction.get(accountRef);
        const currentBalance = accountSnap.exists() ? accountSnap.data().balance || 0 : 0;
        const delta = type === 'income' ? numericAmount : -numericAmount;
        transaction.update(accountRef, { balance: currentBalance + delta });
      });

      setAmount('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-blue-500/20 overflow-hidden mx-auto">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 opacity-10"></div>
          <div className="relative flex items-center justify-between p-4 border-b border-blue-500/20">
            <div>
              <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">Nova Transação</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Adicione uma entrada ou saída</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-4 grid gap-3 sm:grid-cols-2">
          {/* Tipo */}
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tipo de Transação</p>
            <div className="flex flex-row flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  type === 'income'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/40 scale-105 border border-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <FiPlus size={16} /> Entrada
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  type === 'expense'
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/40 scale-105 border border-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <FiMinus size={16} /> Saída
              </button>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              <FiDollarSign size={14} />
              <span>Valor</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-semibold transition-all"
              placeholder="R$ 0,00"
              required
            />
          </div>

          {/* Data */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              <FiCalendar size={14} />
              <span>Data</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-medium transition-all"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              <FiTag size={14} />
              <span>Categoria</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-medium transition-all"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all"
                placeholder="Nova categoria"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold whitespace-nowrap shadow-sm hover:shadow-md"
              >
                <FiPlus className="inline" size={14} /> Adicionar
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              <FiEdit3 size={14} />
              <span>Descrição (opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 resize-none transition-all"
              rows={2}
              placeholder="Adicione detalhes sobre esta transação..."
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-blue-500/10 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 transition-all font-semibold shadow-md shadow-blue-500/40 hover:shadow-lg hover:scale-105"
            >
              ✓ Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}