'use client';

import { useState, useEffect } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { CATEGORIES } from '@/types';
import { FiX, FiPlus, FiMinus, FiDollarSign, FiCalendar, FiTag, FiEdit3, FiTrash2 } from 'react-icons/fi';

interface TransactionModalProps {
  accountId: string;
  onClose: () => void;
  transaction?: {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: Date;
    description?: string;
  };
}

export default function TransactionModal({ accountId, onClose, transaction }: TransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [userCategories, setUserCategories] = useState<{ id: string; name: string }[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [selectedUserCategoryId, setSelectedUserCategoryId] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!transaction) {
      setAmount('');
      setType('expense');
      setCategory(CATEGORIES[0]);
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      return;
    }

    setAmount(transaction.amount.toString());
    setType(transaction.type);
    setCategory(transaction.category);
    setDate(transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setDescription(transaction.description || '');
  }, [transaction]);

  useEffect(() => {
    if (!user) return;

    const categoriesRef = collection(db, 'users', user.uid, 'categories');
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const cats = snapshot.docs
        .map((doc) => {
          const name = (doc.data().name as string | undefined)?.trim();
          return name ? { id: doc.id, name } : null;
        })
        .filter(Boolean) as { id: string; name: string }[];
      setUserCategories(cats);
      if (cats.length === 0) {
        setSelectedUserCategoryId('');
      } else if (!cats.some((cat) => cat.id === selectedUserCategoryId)) {
        setSelectedUserCategoryId('');
      }
    });

    return unsubscribe;
  }, [user, selectedUserCategoryId]);

  const categoryOptions = [
    ...CATEGORIES,
    ...userCategories
      .map((cat) => cat.name)
      .filter((cat) => !CATEGORIES.some((defaultCat) => defaultCat.toLowerCase() === cat.toLowerCase())),
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

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'categories', categoryId));

      if (category.toLowerCase() === categoryName.toLowerCase()) {
        setCategory(CATEGORIES[0]);
      }

      if (selectedUserCategoryId === categoryId) {
        setSelectedUserCategoryId('');
      }
    } catch (error) {
      console.error('Erro ao remover categoria:', error);
    }
  };

  const buildDateWithTime = (value: string, base?: Date) => {
    const [year, month, day] = value.split('-').map((v) => parseInt(v, 10));
    const ref = base ?? new Date();
    const hours = ref.getHours();
    const minutes = ref.getMinutes();
    const seconds = ref.getSeconds();
    const ms = ref.getMilliseconds();
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return ref;
    }
    // Preserve time from ref (existing transaction or "now") to avoid shifting to noon/UTC
    return new Date(year, month - 1, day, hours, minutes, seconds, ms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount)) return;

    const accountRef = doc(db, 'users', user.uid, 'accounts', accountId);

    // Edita transação existente
    if (transaction) {
      const transactionRef = doc(db, 'users', user.uid, 'accounts', accountId, 'transactions', transaction.id);

      const oldDelta = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      const newDelta = type === 'income' ? numericAmount : -numericAmount;
      const netChange = newDelta - oldDelta;
      const parsedDate = buildDateWithTime(date, transaction.date ? new Date(transaction.date) : undefined);

      try {
        await runTransaction(db, async (tx) => {
          const accountSnap = await tx.get(accountRef);
          const currentBalance = accountSnap.exists() ? accountSnap.data().balance || 0 : 0;
          tx.update(accountRef, { balance: currentBalance + netChange });
          tx.update(transactionRef, {
            amount: numericAmount,
            type,
            category,
            date: parsedDate,
            description,
          });
        });

        onClose();
      } catch (error) {
        console.error('Erro ao atualizar transação:', error);
      }
      return;
    }

    try {
      const parsedDate = buildDateWithTime(date, new Date());

      await addDoc(collection(db, 'users', user.uid, 'accounts', accountId, 'transactions'), {
        amount: numericAmount,
        type,
        category,
        date: parsedDate,
        description,
        createdAt: new Date(),
      });

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
              <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {transaction ? 'Editar Transação' : 'Nova Transação'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {transaction ? 'Atualize os dados desta transação' : 'Adicione uma entrada ou saída'}
              </p>
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
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-semibold transition-all outline-none"
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
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-medium transition-all outline-none"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide outline-none">
              <FiTag size={14} />
              <span>Categoria</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 font-medium transition-all outline-none"
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
                className="flex-1 px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all outline-none"
                placeholder="Nova categoria"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold whitespace-nowrap shadow-sm hover:shadow-md outline-none"
              >
                <FiPlus className="inline" size={14} /> Adicionar
              </button>
            </div>
            {userCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Suas categorias
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedUserCategoryId}
                    onChange={(e) => setSelectedUserCategoryId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 transition-all outline-none"
                  >
                    <option value="">Selecione uma categoria</option>
                    {userCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedUserCategoryId}
                    onClick={() => {
                      const target = userCategories.find((cat) => cat.id === selectedUserCategoryId);
                      if (target) handleDeleteCategory(target.id, target.name);
                    }}
                    className={`px-3 py-2 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 transition-all border ${
                      selectedUserCategoryId
                        ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    }`}
                    aria-label="Remover categoria selecionada"
                  >
                    <FiTrash2 size={14} /> Remover selecionada
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Use a lista para escolher e excluir categorias criadas sem poluir a tela.
                </p>
              </div>
            )}
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
              className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100 resize-none transition-all outline-none"
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
              ✓ {transaction ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}