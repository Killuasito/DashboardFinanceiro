"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/components/AuthProvider";
import { Alert, CATEGORIES, Account } from "@/types";
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
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = useState("0");
  const [newCategory, setNewCategory] = useState("");
  const [userCategories, setUserCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDay, setEditDay] = useState("1");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string>(CATEGORIES[0]);
  const [editAmount, setEditAmount] = useState("0");
  const [editAccountId, setEditAccountId] = useState<string>("");
  const { user, loading } = useAuth();
  const router = useRouter();
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  const categoryOptions = useMemo(() => {
    const merged = [...CATEGORIES, ...userCategories];
    const seen = new Set<string>();
    return merged.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userCategories]);

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

  useEffect(() => {
    if (!user) return;

    const categoriesRef = collection(db, "users", user.uid, "categories");
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => (docSnap.data().name as string | undefined)?.trim())
        .filter(Boolean) as string[];
      setUserCategories(list);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const accountsRef = collection(db, "users", user.uid, "accounts");
    const unsubscribe = onSnapshot(accountsRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
      })) as Account[];
      setAccounts(list);
      if (!accountId && list.length > 0) {
        setAccountId(list[0].id);
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

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const parsedAmount = parseFloat(amount || "0");
    const safeAmount = Number.isNaN(parsedAmount) ? 0 : Math.max(parsedAmount, 0);
    const selectedAccountId = accountId || accounts[0]?.id || "";
    if (!selectedAccountId) {
      alert("Selecione uma conta para registrar o pagamento.");
      return;
    }

    const parsedDay = Math.min(Math.max(parseInt(dayOfMonth || "1", 10), 1), 31);

    try {
      await addDoc(collection(db, "users", user.uid, "alerts"), {
        title: trimmedTitle,
        description: description.trim() || null,
        dayOfMonth: parsedDay,
        category,
        amount: safeAmount,
        accountId: selectedAccountId,
        lastPaidMonth: null,
        createdAt: new Date(),
      });
      setTitle("");
      setDescription("");
      setDayOfMonth("5");
      setAmount("0");
      setCategory(categoryOptions[0] || CATEGORIES[0]);
      setAccountId(selectedAccountId);
    } catch (error) {
      console.error("Erro ao criar alerta:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!user) return;
    const name = newCategory.trim();
    if (!name) return;

    const exists = categoryOptions.some((cat) => cat.toLowerCase() === name.toLowerCase());
    if (exists) {
      setCategory(name);
      setNewCategory("");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "categories"), {
        name,
        createdAt: new Date(),
      });
      setCategory(name);
      setNewCategory("");
    } catch (error) {
      console.error("Erro ao adicionar categoria:", error);
    }
  };

  const togglePaid = async (alertItem: Alert, isPaid: boolean) => {
    if (!user) return;
    const alertRef = doc(db, "users", user.uid, "alerts", alertItem.id);
    const markingPaid = !isPaid;

    try {
      if (markingPaid) {
        const targetAccountId = alertItem.accountId || accountId || accounts[0]?.id;
        const paymentAmount = alertItem.amount ?? 0;

        if (!targetAccountId || paymentAmount <= 0) {
          window.alert("Defina um valor e uma conta para registrar no relatório.");
          return;
        }

        const accountRef = doc(db, "users", user.uid, "accounts", targetAccountId);
        const txCollection = collection(db, "users", user.uid, "accounts", targetAccountId, "transactions");
        const newTxRef = doc(txCollection);

        await runTransaction(db, async (tx) => {
          const accSnap = await tx.get(accountRef);
          const currentBalance = accSnap.exists() ? accSnap.data().balance || 0 : 0;

          tx.set(newTxRef, {
            amount: paymentAmount,
            type: "expense",
            category: alertItem.category || categoryOptions[0] || "Outros",
            date: new Date(),
            description: alertItem.title,
            createdAt: new Date(),
          });

          tx.update(accountRef, { balance: currentBalance - paymentAmount });
          tx.update(alertRef, { lastPaidMonth: currentMonthKey, accountId: targetAccountId, amount: paymentAmount });
        });
      } else {
        await updateDoc(alertRef, {
          lastPaidMonth: null,
        });
      }
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

  const startEdit = (alertItem: Alert) => {
    setEditingId(alertItem.id);
    setEditTitle(alertItem.title || "");
    setEditDay(String(alertItem.dayOfMonth || 1));
    setEditDescription(alertItem.description || "");
    setEditCategory(alertItem.category || categoryOptions[0] || CATEGORIES[0]);
    setEditAmount(String(alertItem.amount ?? 0));
    setEditAccountId(alertItem.accountId || accountId || accounts[0]?.id || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDay("1");
    setEditDescription("");
    setEditCategory(categoryOptions[0] || CATEGORIES[0]);
    setEditAmount("0");
    setEditAccountId(accountId || accounts[0]?.id || "");
  };

  const handleUpdateAlert = async () => {
    if (!user || !editingId) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    const parsedDay = Math.min(Math.max(parseInt(editDay || "1", 10), 1), 31);
    const parsedAmount = parseFloat(editAmount || "0");
    const safeAmount = Number.isNaN(parsedAmount) ? 0 : Math.max(parsedAmount, 0);
    const targetAccountId = editAccountId || accounts[0]?.id || "";
    if (!targetAccountId) {
      window.alert("Selecione uma conta para o alerta.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid, "alerts", editingId), {
        title: trimmedTitle,
        dayOfMonth: parsedDay,
        description: editDescription.trim() || null,
        category: editCategory,
        amount: safeAmount,
        accountId: targetAccountId,
      });
      cancelEdit();
    } catch (error) {
      console.error("Erro ao atualizar alerta:", error);
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <section className="lg:col-span-2 bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900 rounded-2xl shadow-xl p-7 relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 pointer-events-none opacity-60">
              <div className="absolute -right-10 -top-16 w-40 h-40 rounded-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10" />
              <div className="absolute -left-12 bottom-0 w-32 h-32 rounded-full bg-gradient-to-tr from-blue-500/8 to-transparent" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-8 bg-gradient-to-b from-blue-600 to-cyan-500 rounded-full" />
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Novo alerta</h2>
            </div>
            <form onSubmit={handleAddAlert} className="space-y-5 relative flex flex-col">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Conta de Telefone"
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1 space-y-2">
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
                <div className="sm:col-span-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Valor</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
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
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Conta</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 block">Categoria</label>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCategory(categoryOptions[0] || CATEGORIES[0])}
                    className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition whitespace-nowrap"
                  >
                    Resetar
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nova categoria"
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold hover:from-blue-700 hover:to-blue-800 transition shadow-md"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/40 transition-all duration-200"
                >
                  <FiPlusCircle />
                  Criar alerta
                </button>
              </div>
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
              <div className="grid grid-cols-1 gap-5">
                {sortedAlerts.map((alert) => {
                  const isPaid = alert.lastPaidMonth === currentMonthKey;
                  return (
                    <div
                      key={alert.id}
                      className="relative bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900 rounded-3xl p-7 shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200"
                    >
                      {editingId === alert.id ? (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200">
                                  Dia {editDay}
                                </span>
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 text-xs font-bold">
                                  Editando alerta
                                </span>
                              </div>
                              <input
                                className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                              />
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Dia</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={editDay}
                                    onChange={(e) => setEditDay(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-bold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Valor</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Conta</label>
                                  <select
                                    value={editAccountId}
                                    onChange={(e) => setEditAccountId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                  >
                                    {accounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {acc.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1 md:col-span-1">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Categoria</label>
                                  <select
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                  >
                                    {categoryOptions.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Descrição</label>
                                  <input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                    placeholder="Detalhes do alerta"
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition"
                              aria-label="Excluir alerta"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={handleUpdateAlert}
                              type="button"
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-md"
                            >
                              <FiCheckCircle /> Salvar
                            </button>
                            <button
                              onClick={cancelEdit}
                              type="button"
                              className="px-4 py-3 rounded-xl font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
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
                              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">{alert.title}</h3>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {alert.category && (
                                  <span className="text-xs font-bold text-blue-600 dark:text-blue-300">{alert.category}</span>
                                )}
                                {typeof alert.amount === "number" && (
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">R$ {alert.amount.toFixed(2)}</span>
                                )}
                              </div>
                              {alert.accountId && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Conta: {accounts.find((acc) => acc.id === alert.accountId)?.name || "-"}
                                </p>
                              )}
                              {alert.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{alert.description}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => startEdit(alert)}
                                className="px-3 py-2 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-transparent hover:border-blue-200 dark:hover:border-blue-700 text-sm font-semibold"
                                aria-label="Editar alerta"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(alert.id)}
                                className="px-3 py-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 text-sm font-semibold"
                                aria-label="Excluir alerta"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePaid(alert, isPaid)}
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
                      )}
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
