'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import AccountView from '@/components/AccountView';

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const accountRef = doc(db, 'users', user.uid, 'accounts', accountId);
    const unsubscribe = onSnapshot(accountRef, (snapshot) => {
      if (snapshot.exists()) {
        setAccountName(snapshot.data().name);
      }
    });

    return unsubscribe;
  }, [user, accountId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-64">
        <AccountView accountId={accountId} accountName={accountName} />
      </main>
    </div>
  );
}