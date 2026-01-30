"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/components/AuthProvider";
import { Alert } from "@/types";
import {
  FiBell,
  FiCheckCircle,
  FiClock,
  FiPlusCircle,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [title, setTitle] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [description, setDescription] = useState("");
  const { user, loading } = useAuth();
  const router = useRouter();
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const alertsQuery = query(collection(db, "users", user.uid, "alerts"));
    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const alertData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
      })) as Alert[];
      setAlerts(alertData);
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Carregando...</div>
      </div>
    );
  }

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const parsedDay = Math.min(Math.max(parseInt(dayOfMonth || "1", 10), 1), 31);

    try {
      await addDoc(collection(db, "users", user.uid, "alerts"), {
        title: trimmedTitle,
        description: description.trim() || null,
        dayOfMonth: parsedDay,
        lastPaidMonth: null,
        createdAt: new Date(),
      });
      setTitle("");
      setDescription("");
      setDayOfMonth("5");
    } catch (error) {
      console.error("Erro ao criar alerta:", error);
    }
  };

  const togglePaid = async (alertId: string, isPaid: boolean) => {
    if (!user) return;
    const alertRef = doc(db, "users", user.uid, "alerts", alertId);

    try {
      await updateDoc(alertRef, {
        lastPaidMonth: isPaid ? null : currentMonthKey,
      });
    } catch (error) {
      console.error("Erro ao atualizar alerta:", error);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!user) return;
    const confirmDelete = window.confirm("Deseja remover este alerta?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "alerts", alertId));
    } catch (error) {
      console.error("Erro ao excluir alerta:", error);
    }
  };

  const sortedAlerts = [...alerts].sort((a, b) => (a.dayOfMonth || 0) - (b.dayOfMonth || 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="flex items-center justify-between mb-8 border-l-4 border-blue-600 pl-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/40">
                <FiBell size={20} />
              </div>
              <h1 className="text-4xl font-black text-blue-700 dark:text-blue-300">Alertas Mensais</h1>
            </div>
            <p className="text-slate-700 dark:text-slate-300 mt-2 font-medium">
              Configure lembretes mensais para não esquecer contas recorrentes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900 rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-8 bg-gradient-to-b from-blue-600 to-cyan-500 rounded-full" />
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Novo alerta</h2>
            </div>
            <form onSubmit={handleAddAlert} className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Conta de Telefone"
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Dia</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Detalhes (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: vence dia 05, valor aproximado R$ 120"
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/40 transition-all duration-200 hover:scale-[1.01]"
              >
                <FiPlusCircle />
                Criar alerta
              </button>
            </form>
          </section>

          <section className="lg:col-span-2 space-y-4">
            {sortedAlerts.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-2xl p-10 text-center shadow-xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center mb-4 shadow-lg">
                  <FiBell size={26} />
                </div>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Nenhum alerta criado</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Use o formulário ao lado para adicionar seus lembretes mensais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedAlerts.map((alert) => {
                  const isPaid = alert.lastPaidMonth === currentMonthKey;
                  return (
                    <div
                      key={alert.id}
                      className="relative bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200">
                              Dia {alert.dayOfMonth}
                            </span>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300 text-xs font-bold">
                                <FiCheckCircle /> Pago este mês
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 text-xs font-bold">
                                <FiClock /> Aguardando pagamento
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">{alert.title}</h3>
                          {alert.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-300">{alert.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(alert.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition"
                          aria-label="Excluir alerta"
                        >
                          <FiTrash2 />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => togglePaid(alert.id, isPaid)}
                          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-md ${
                            isPaid
                              ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                              : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
                          }`}
                        >
                          {isPaid ? <FiXCircle /> : <FiCheckCircle />}
                          {isPaid ? "Marcar como pendente" : "Marcar como pago"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
