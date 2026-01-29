'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { FiDollarSign, FiTrendingUp, FiPieChart, FiShield } from 'react-icons/fi';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos');
      } else {
        setError('Erro ao processar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center gap-2">
          <FiDollarSign className="text-emerald-600 text-3xl" />
          <span className="text-2xl font-bold text-slate-800">FinanceDash</span>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Marketing */}
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-4">
                Controle suas finanças de forma{' '}
                <span className="text-emerald-600">inteligente</span>
              </h1>
              <p className="text-xl text-slate-600">
                Gerencie múltiplas contas, acompanhe seus gastos e tome decisões
                financeiras mais assertivas com dashboards visuais e intuitivos.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FiTrendingUp className="text-emerald-600 text-xl" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    Múltiplas Contas
                  </h3>
                  <p className="text-sm text-slate-600">
                    Gerencie todas as suas contas bancárias em um só lugar
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FiPieChart className="text-blue-600 text-xl" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    Gráficos Visuais
                  </h3>
                  <p className="text-sm text-slate-600">
                    Veja seus gastos por categoria de forma clara e objetiva
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FiShield className="text-purple-600 text-xl" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    100% Seguro
                  </h3>
                  <p className="text-sm text-slate-600">
                    Seus dados protegidos com Firebase Authentication
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FiDollarSign className="text-orange-600 text-xl" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">
                    Controle Total
                  </h3>
                  <p className="text-sm text-slate-600">
                    Acompanhe entradas, saídas e saldo em tempo real
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center gap-8 text-sm text-slate-600">
                <div>
                  <div className="text-2xl font-bold text-slate-800">100%</div>
                  <div>Gratuito</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">∞</div>
                  <div>Contas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">📊</div>
                  <div>Gráficos</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {isLogin ? 'Bem-vindo de volta!' : 'Criar conta gratuita'}
              </h2>
              <p className="text-slate-600">
                {isLogin
                  ? 'Entre para acessar seu dashboard financeiro'
                  : 'Comece a organizar suas finanças agora'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                {isLogin
                  ? 'Não tem conta? Criar agora'
                  : 'Já tem conta? Fazer login'}
              </button>
            </div>

            {!isLogin && (
              <p className="mt-4 text-xs text-slate-500 text-center">
                Ao criar uma conta, você concorda com nossos Termos de Serviço e
                Política de Privacidade
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-12 border-t border-slate-200">
        <div className="text-center text-slate-600 text-sm">
          <p>© 2026 FinanceDash. Desenvolvido com ❤️ usando Next.js e Firebase</p>
        </div>
      </footer>
    </div>
  );
}