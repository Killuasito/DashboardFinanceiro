'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import { Account } from '@/types';
import { FiTrash2, FiPlusCircle, FiDollarSign } from 'react-icons/fi';

export default function DashboardHome() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const accountsQuery = query(collection(db, 'users', user.uid, 'accounts'));
    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Account[];
      setAccounts(accountsData);
    });

    return unsubscribe;
  }, [user]);

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    if (!user) return;
    
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir a conta "${accountName}"? Todas as transações serão perdidas.`
    );
    
    if (!confirmDelete) return;

    try {
      // Deletar todas as transações da conta
      const transactionsRef = collection(db, 'users', user.uid, 'accounts', accountId, 'transactions');
      const transactionsSnapshot = await getDocs(transactionsRef);
      
      const deletePromises = transactionsSnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, 'users', user.uid, 'accounts', accountId, 'transactions', docSnap.id))
      );
      
      await Promise.all(deletePromises);
      
      // Deletar a conta
      await deleteDoc(doc(db, 'users', user.uid, 'accounts', accountId));
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      alert('Erro ao excluir conta. Tente novamente.');
    }
  };

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950">
      <div className="mb-8 border-l-4 border-blue-600 pl-6">
        <h2 className="text-5xl font-black mb-2 text-blue-600 dark:text-blue-400">Minhas Contas</h2>
        <p className="text-slate-700 dark:text-slate-300 text-lg font-medium">Selecione uma conta para ver o dashboard e os gráficos.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-3xl p-12 text-center shadow-xl">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <FiPlusCircle className="text-5xl text-white" />
          </div>
          <p className="text-slate-700 dark:text-slate-200 text-xl mb-2 font-bold">Nenhuma conta criada ainda</p>
          <p className="text-slate-500 dark:text-slate-400 text-base">Use o botão "+" na barra lateral para adicionar sua primeira conta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group relative bg-white dark:bg-slate-900 dark:from-slate-900 dark:to-slate-950 border-2 border-blue-200 dark:border-blue-900 rounded-2xl p-6 shadow-xl hover:shadow-2xl flex flex-col gap-4 transition-all duration-300 hover:scale-[1.03] hover:border-blue-500 dark:hover:border-blue-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full -ml-12 -mb-12"></div>
              
              <div className="relative space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Conta Bancária</p>
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{account.name}</h3>
              </div>
              <div className="relative space-y-1 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-900">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <FiDollarSign className="text-base" />
                  <span>Saldo Atual</span>
                </p>
                <p className={`text-4xl font-black ${(account.balance || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  R$ {(account.balance || 0).toFixed(2)}
                </p>
              </div>
              <div className="relative flex gap-2 mt-auto pt-4 border-t-2 border-blue-100 dark:border-blue-900">
                <button
                  onClick={() => router.push(`/dashboard/${account.id}`)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold transition-all duration-200 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:scale-[1.02]"
                >
                  Abrir dashboard
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAccount(account.id, account.name);
                  }}
                  className="px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                  title="Excluir conta"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}