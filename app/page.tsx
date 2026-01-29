'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  FiDollarSign,
  FiTrendingUp,
  FiPieChart,
  FiShield,
  FiSun,
  FiMoon,
} from 'react-icons/fi';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <FiDollarSign className="text-3xl" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-800 dark:text-white">FinanceDash</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">Painel financeiro inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              aria-label="Alternar tema"
            >
              {theme === 'light' ? <FiMoon /> : <FiSun />}
              <span>{theme === 'light' ? 'Modo escuro' : 'Modo claro'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-emerald-200 blur-3xl opacity-50 dark:bg-emerald-900" />
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-blue-200 blur-3xl opacity-50 dark:bg-blue-900" />
          </div>

          {/* Left Side - Marketing */}
          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-100">
                <FiTrendingUp />
                Inteligência financeira em tempo real
              </span>
              <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-900 dark:text-white">
                Controle suas finanças de forma{' '}
                <span className="text-emerald-600 dark:text-emerald-300">inteligente</span>
              </h1>
              <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">
                Gerencie múltiplas contas, acompanhe gastos e tome decisões mais
                assertivas com dashboards visuais e intuitivos.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[{
                title: 'Múltiplas Contas',
                desc: 'Gerencie todas as suas contas em um só lugar',
                icon: <FiTrendingUp className="text-emerald-500" />,
                bg: 'bg-emerald-50 dark:bg-emerald-900/40',
              }, {
                title: 'Gráficos Visuais',
                desc: 'Gastos por categoria de forma clara',
                icon: <FiPieChart className="text-blue-500" />,
                bg: 'bg-blue-50 dark:bg-blue-900/40',
              }, {
                title: 'Segurança Total',
                desc: 'Dados protegidos com Firebase Auth',
                icon: <FiShield className="text-purple-500" />,
                bg: 'bg-purple-50 dark:bg-purple-900/40',
              }, {
                title: 'Controle em Tempo Real',
                desc: 'Entradas, saídas e saldo atualizados',
                icon: <FiDollarSign className="text-orange-500" />,
                bg: 'bg-orange-50 dark:bg-orange-900/40',
              }].map((item) => (
                <div
                  key={item.title}
                  className={`flex gap-4 rounded-2xl border border-slate-200/70 p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-800/60 ${item.bg}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900/70">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[{
                label: 'Gratuito para sempre',
                value: '100%'
              }, {
                label: 'Contas conectadas',
                value: '∞'
              }, {
                label: 'Insights gerados',
                value: '150+'
              }].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">{stat.value}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-emerald-100/60 via-white to-blue-100/50 blur-3xl dark:from-emerald-900/40 dark:via-slate-900 dark:to-blue-900/30" />
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {isLogin ? 'Bem-vindo de volta!' : 'Criar conta gratuita'}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    {isLogin
                      ? 'Entre para acessar seu dashboard financeiro'
                      : 'Comece a organizar suas finanças agora'}
                  </p>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  Acesso seguro
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-600"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-600"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 py-3 text-white font-semibold shadow-lg transition hover:from-emerald-500 hover:to-blue-500 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="text-sm font-medium text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  {isLogin
                    ? 'Não tem conta? Criar agora'
                    : 'Já tem conta? Fazer login'}
                </button>
              </div>

              {!isLogin && (
                <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Ao criar uma conta, você concorda com nossos Termos de Serviço e
                  Política de Privacidade
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto mt-12 px-6 py-8 border-t border-slate-200/80 dark:border-slate-800">
        <div className="text-center text-sm text-slate-600 dark:text-slate-400">
          <p>© 2026 FinanceDash. Desenvolvido com ❤️ usando Next.js e Firebase</p>
        </div>
      </footer>
    </div>
  );
}