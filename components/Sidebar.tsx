'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';
import { Account } from '@/types';
import {
  FiHome,
  FiPlusCircle,
  FiLogOut,
  FiDollarSign,
  FiMoon,
  FiSun,
  FiBarChart2,
  FiBell,
  FiPieChart,
  FiEdit3,
  FiCheck,
  FiX,
} from 'react-icons/fi';

export default function Sidebar() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'accounts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Account[];
      setAccounts(accountsData);
    });

    return unsubscribe;
  }, [user]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAccountName.trim()) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'accounts'), {
        name: newAccountName,
        balance: parseFloat(newAccountBalance) || 0,
        createdAt: new Date(),
      });
      setNewAccountName('');
      setNewAccountBalance('');
      setShowAddAccount(false);
    } catch (error) {
      console.error('Erro ao adicionar conta:', error);
    }
  };

  const startEdit = (account: Account) => {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditBalance(account.balance.toString());
  };

  const cancelEdit = () => {
    setEditingAccountId(null);
    setEditName('');
    setEditBalance('');
  };

  const handleUpdateAccount = async () => {
    if (!user || !editingAccountId) return;
    const name = editName.trim();
    if (!name) return;

    const parsedBalance = parseFloat(editBalance || '0');
    const accountRef = doc(db, 'users', user.uid, 'accounts', editingAccountId);

    try {
      await updateDoc(accountRef, {
        name,
        balance: Number.isNaN(parsedBalance) ? 0 : parsedBalance,
      });
      cancelEdit();
    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
    }
  };

  return (
    <aside className="w-64 bg-linear-to-b from-blue-900 via-slate-950 to-slate-950 dark:from-blue-950 dark:via-slate-950 dark:to-black text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl border-r-2 border-blue-900/50">
      <div className="p-6 border-b-2 border-blue-900/50 bg-linear-to-r from-blue-900/20 to-transparent">
        <h1 className="text-2xl font-black flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/50">
            <FiDollarSign className="text-white" size={24} />
          </div>
          <span className="text-blue-400">FinanceDash</span>
        </h1>
        <p className="text-xs text-slate-400 mt-2 ml-12">Gestão financeira inteligente</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-transparent">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-900/30 hover:bg-blue-800/50 transition-all duration-200 mb-4 group border border-blue-800/50 hover:border-blue-600 shadow-lg"
        >
          <FiHome className="group-hover:scale-110 transition-transform text-blue-400" size={20} />
          <span className="font-bold text-blue-100">Contas Bancárias</span>
        </button>

        <button
          onClick={() => router.push('/dashboard/reports')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-900/20 hover:bg-blue-800/40 transition-all duration-200 mb-6 group border border-blue-800/40 hover:border-blue-500 shadow-lg"
        >
          <FiBarChart2 className="group-hover:scale-110 transition-transform text-blue-300" size={20} />
          <span className="font-bold text-blue-100">Relatórios</span>
        </button>

        <button
          onClick={() => router.push('/dashboard/investments')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-900/15 hover:bg-blue-800/35 transition-all duration-200 mb-6 group border border-blue-800/35 hover:border-blue-500 shadow-lg"
        >
          <FiPieChart className="group-hover:scale-110 transition-transform text-blue-200" size={20} />
          <span className="font-bold text-blue-100">Investimentos</span>
        </button>

        <button
          onClick={() => router.push('/dashboard/alerts')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-900/10 hover:bg-blue-800/30 transition-all duration-200 mb-6 group border border-blue-800/30 hover:border-blue-500 shadow-lg"
        >
          <FiBell className="group-hover:scale-110 transition-transform text-blue-200" size={20} />
          <span className="font-bold text-blue-100">Alertas</span>
        </button>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-sm font-black text-blue-400 uppercase tracking-wider">Minhas Contas</h3>
            <button
              onClick={() => setShowAddAccount(!showAddAccount)}
              className="text-blue-400 hover:text-cyan-400 transition-colors p-1 hover:scale-110 duration-200"
            >
              <FiPlusCircle size={20} />
            </button>
          </div>

          {showAddAccount && (
            <form onSubmit={handleAddAccount} className="mb-4 p-4 bg-blue-950/50 rounded-xl border-2 border-blue-900/50 shadow-xl">
              <input
                type="text"
                placeholder="Nome da conta"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 rounded-lg mb-2 text-sm border border-blue-800/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium outline-none"
              />
              <input
                type="number"
                placeholder="Saldo inicial"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 rounded-lg mb-3 text-sm border border-blue-800/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium outline-none"
              />
              <button
                type="submit"
                className="w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/50 transition-all hover:scale-105"
              >
                ✓ Adicionar Conta
              </button>
            </form>
          )}

          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border-2 border-blue-900/30 shadow-md hover:shadow-lg transition-all duration-200 group"
              >
                {editingAccountId === account.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 rounded-lg text-sm border border-blue-800/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Nome da conta"
                    />
                    <input
                      type="number"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 rounded-lg text-sm border border-blue-800/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Saldo inicial"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUpdateAccount}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition"
                      >
                        <FiCheck size={16} /> Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 transition"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/${encodeURIComponent(account.id)}`)}
                      className="text-left flex-1"
                    >
                      <div className="font-bold group-hover:text-blue-400 transition-colors text-blue-100">{account.name}</div>
                      <div className="text-sm text-slate-400 group-hover:text-cyan-400 transition-colors font-medium">
                        R$ {account.balance.toFixed(2)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(account)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-900/50 transition"
                      aria-label={`Editar conta ${account.name}`}
                    >
                      <FiEdit3 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t-2 border-blue-900/50 space-y-2 bg-linear-to-r from-blue-950/30 to-transparent">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-900/30 hover:bg-blue-800/50 transition-all duration-200 text-blue-200 hover:text-blue-100 group border border-blue-900/50 hover:border-blue-600 shadow-lg"
        >
          {theme === 'dark' ? (
            <FiSun className="group-hover:rotate-180 transition-transform duration-500 text-yellow-400" size={20} />
          ) : (
            <FiMoon className="group-hover:-rotate-12 transition-transform duration-300 text-blue-400" size={20} />
          )}
          <span className="font-bold">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-900/30 hover:bg-rose-800/50 transition-all duration-200 text-rose-200 hover:text-white group border border-rose-900/50 hover:border-rose-600 shadow-lg"
        >
          <FiLogOut className="group-hover:translate-x-1 transition-transform" size={20} />
          <span className="font-bold">Sair</span>
        </button>
      </div>
    </aside>
  );
}