"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, onSnapshot, runTransaction, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/components/AuthProvider";
import { Account, InvestmentFund, InvestmentMovement } from "@/types";
import { FiArrowDownCircle, FiArrowUpCircle, FiCalendar, FiDollarSign, FiPieChart, FiPlusCircle, FiShield, FiEdit3, FiTrash2, FiCheck, FiX } from "react-icons/fi";

const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

const toDateInput = (value?: Date | string | null) => {
  if (!value) return new Date().toISOString().split("T")[0];
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];
  return dt.toISOString().split("T")[0];
};

const buildDate = (value: string) => {
  const [year, month, day] = value.split("-").map((v) => parseInt(v, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date();
  }
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export default function InvestmentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [funds, setFunds] = useState<InvestmentFund[]>([]);
  const [movements, setMovements] = useState<InvestmentMovement[]>([]);

  const [fundName, setFundName] = useState("");
  const [custodianAccountId, setCustodianAccountId] = useState<string>("");

  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [originAccountId, setOriginAccountId] = useState<string>("");
  const [amount, setAmount] = useState("1000");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [quotaValue, setQuotaValue] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const [editingMovement, setEditingMovement] = useState<InvestmentMovement | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [editQuotaValue, setEditQuotaValue] = useState("");
  const [editOriginAccountId, setEditOriginAccountId] = useState<string>("");

  const [deletingFundId, setDeletingFundId] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

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
      if (!custodianAccountId && list[0]) {
        setCustodianAccountId(list[0].id);
      }
      if (!originAccountId && list[0]) {
        setOriginAccountId(list[0].id);
      }
    });

    return unsubscribe;
  }, [user, custodianAccountId, originAccountId]);

  useEffect(() => {
    if (!user) return;

    const fundsRef = collection(db, "users", user.uid, "investments");
    const unsubscribe = onSnapshot(fundsRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
      })) as InvestmentFund[];
      setFunds(list);
      if (!selectedFundId && list[0]) {
        setSelectedFundId(list[0].id);
      }
    });

    return unsubscribe;
  }, [user, selectedFundId]);

  useEffect(() => {
    if (!user || !selectedFundId) return;

    const movementsRef = collection(db, "users", user.uid, "investments", selectedFundId, "movements");
    const unsubscribe = onSnapshot(movementsRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        fundId: selectedFundId,
        ...docSnap.data(),
        date: docSnap.data().date?.toDate(),
        createdAt: docSnap.data().createdAt?.toDate(),
      })) as InvestmentMovement[];
      setMovements(list);
    });

    return unsubscribe;
  }, [user, selectedFundId]);

  const totalInvested = useMemo(() => funds.reduce((sum, f) => sum + (f.balance || 0), 0), [funds]);

  const handleAddFund = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = fundName.trim();
    if (!name) return;
    const custodian = custodianAccountId || accounts[0]?.id || "";
    if (!custodian) {
      setStatusMessage("Cadastre uma conta para definir o custodiante.");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "investments"), {
        name,
        custodianAccountId: custodian,
        balance: 0,
        lastQuotaValue: null,
        createdAt: new Date(),
      });
      setFundName("");
      setStatusMessage("Fundo cadastrado com sucesso.");
    } catch (error) {
      console.error("Erro ao criar fundo:", error);
      setStatusMessage("Não foi possível criar o fundo.");
    }
  };

  const handleContribution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const fundId = selectedFundId || funds[0]?.id;
    if (!fundId) {
      setStatusMessage("Cadastre um fundo antes de aplicar.");
      return;
    }

    const originId = originAccountId || accounts[0]?.id;
    if (!originId) {
      setStatusMessage("Cadastre uma conta de origem.");
      return;
    }

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setStatusMessage("Informe um valor válido para o aporte.");
      return;
    }

    const parsedQuota = quotaValue ? parseFloat(quotaValue.replace(",", ".")) : NaN;
    const quotaNumber = Number.isNaN(parsedQuota) ? null : parsedQuota;
    const targetDate = buildDate(date);
    const now = new Date();

    const fundRef = doc(db, "users", user.uid, "investments", fundId);
    const accountRef = doc(db, "users", user.uid, "accounts", originId);
    const fundMovementRef = doc(collection(db, "users", user.uid, "investments", fundId, "movements"));
    const accountTxRef = doc(collection(db, "users", user.uid, "accounts", originId, "transactions"));

    try {
      await runTransaction(db, async (tx) => {
        const [fundSnap, accountSnap] = await Promise.all([
          tx.get(fundRef),
          tx.get(accountRef),
        ]);

        if (!fundSnap.exists()) throw new Error("Fundo não encontrado.");
        if (!accountSnap.exists()) throw new Error("Conta de origem não encontrada.");

        const fundData = fundSnap.data();
        const accountData = accountSnap.data();
        const currentFundBalance = fundData.balance || 0;
        const currentAccountBalance = accountData.balance || 0;

        // Permite aporte mesmo sem saldo: registra saldo negativo na conta origem
        const units = quotaNumber && quotaNumber > 0 ? numericAmount / quotaNumber : null;
        const fundNameLabel = fundData.name || "Fundo";

        tx.update(accountRef, { balance: currentAccountBalance - numericAmount });
        tx.set(accountTxRef, {
          amount: numericAmount,
          type: "expense",
          category: "Investimentos",
          date: targetDate,
          description: `Aporte em ${fundNameLabel}`,
          createdAt: now,
        });

        tx.update(fundRef, {
          balance: currentFundBalance + numericAmount,
          lastQuotaValue: quotaNumber ?? null,
        });

        tx.set(fundMovementRef, {
          amount: numericAmount,
          type: "buy",
          originAccountId: originId,
          date: targetDate,
          quotaValue: quotaNumber ?? null,
          units: units ?? null,
          accountTransactionId: accountTxRef.id,
          createdAt: now,
        });
      });

      setAmount("1000");
      setQuotaValue("");
      setStatusMessage("Aporte registrado e saldo atualizado.");
    } catch (error: any) {
      console.error("Erro ao registrar aporte:", error);
      setStatusMessage(error?.message || "Não foi possível registrar o aporte.");
    }
  };

  const startEditMovement = (mv: InvestmentMovement) => {
    setEditingMovement(mv);
    setEditAmount(mv.amount.toString());
    setEditDate(toDateInput(mv.date));
    setEditQuotaValue(mv.quotaValue ? mv.quotaValue.toString() : "");
    setEditOriginAccountId(mv.originAccountId);
    setStatusMessage("");
  };

  const cancelEditMovement = () => {
    setEditingMovement(null);
    setEditAmount("");
    setEditDate(new Date().toISOString().split("T")[0]);
    setEditQuotaValue("");
    setEditOriginAccountId(originAccountId || accounts[0]?.id || "");
  };

  const handleUpdateMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !editingMovement) return;

    const fundId = selectedFundId || funds[0]?.id;
    if (!fundId) {
      setStatusMessage("Selecione um fundo para editar.");
      return;
    }

    const targetOriginId = editOriginAccountId || editingMovement.originAccountId;
    if (!targetOriginId) {
      setStatusMessage("Selecione a conta de origem.");
      return;
    }
    const numericAmount = parseFloat(editAmount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setStatusMessage("Informe um valor válido para o aporte.");
      return;
    }

    const parsedQuota = editQuotaValue ? parseFloat(editQuotaValue.replace(",", ".")) : NaN;
    const quotaNumber = Number.isNaN(parsedQuota) ? null : parsedQuota;
    const units = quotaNumber && quotaNumber > 0 ? numericAmount / quotaNumber : null;
    const targetDate = buildDate(editDate);
    const now = new Date();

    const fundRef = doc(db, "users", user.uid, "investments", fundId);
    const movementRef = doc(db, "users", user.uid, "investments", fundId, "movements", editingMovement.id);
    const oldOriginRef = doc(db, "users", user.uid, "accounts", editingMovement.originAccountId);
    const newOriginRef = doc(db, "users", user.uid, "accounts", targetOriginId);
    const oldTxRef = editingMovement.accountTransactionId
      ? doc(db, "users", user.uid, "accounts", editingMovement.originAccountId, "transactions", editingMovement.accountTransactionId)
      : null;
    const needNewTx = !oldTxRef || targetOriginId !== editingMovement.originAccountId;
    const newTxRef = needNewTx
      ? doc(collection(db, "users", user.uid, "accounts", targetOriginId, "transactions"))
      : oldTxRef;

    try {
      await runTransaction(db, async (tx) => {
        const [fundSnap, oldOriginSnap, newOriginSnap, movementSnap, oldTxSnap] = await Promise.all([
          tx.get(fundRef),
          tx.get(oldOriginRef),
          tx.get(newOriginRef),
          tx.get(movementRef),
          oldTxRef ? tx.get(oldTxRef) : Promise.resolve(null),
        ]);

        if (!fundSnap.exists()) throw new Error("Fundo não encontrado.");
        if (!oldOriginSnap.exists()) throw new Error("Conta de origem anterior não encontrada.");
        if (!newOriginSnap.exists()) throw new Error("Conta de origem selecionada não encontrada.");
        if (!movementSnap.exists()) throw new Error("Movimento não encontrado.");

        const fundData = fundSnap.data();
        const fundNameLabel = fundData.name || "Fundo";
        const currentFundBalance = fundData.balance || 0;
        const oldAccountBalance = oldOriginSnap.data().balance || 0;
        const newAccountBalance = newOriginSnap.data().balance || 0;
        const oldAmount = editingMovement.amount;

        if (targetOriginId === editingMovement.originAccountId) {
          const updatedAccountBalance = oldAccountBalance + oldAmount - numericAmount;
          const updatedFundBalance = currentFundBalance - oldAmount + numericAmount;

          tx.update(fundRef, {
            balance: updatedFundBalance,
            lastQuotaValue: quotaNumber ?? fundData.lastQuotaValue ?? null,
          });

          tx.update(oldOriginRef, { balance: updatedAccountBalance });

          const txRef = newTxRef!;
          tx.set(txRef, {
            amount: numericAmount,
            type: "expense",
            category: "Investimentos",
            date: targetDate,
            description: `Aporte em ${fundNameLabel}`,
            createdAt: oldTxSnap?.data()?.createdAt || now,
          });

          tx.update(movementRef, {
            amount: numericAmount,
            date: targetDate,
            quotaValue: quotaNumber ?? null,
            units: units ?? null,
            originAccountId: targetOriginId,
            accountTransactionId: txRef.id,
          });
        } else {
          const revertedOldAccount = oldAccountBalance + oldAmount;
          const fundAfterRevert = currentFundBalance - oldAmount;
          const updatedNewAccount = newAccountBalance - numericAmount;
          const finalFundBalance = fundAfterRevert + numericAmount;

          tx.update(oldOriginRef, { balance: revertedOldAccount });
          if (oldTxRef && oldTxSnap?.exists()) {
            tx.delete(oldTxRef);
          }

          tx.update(newOriginRef, { balance: updatedNewAccount });
          tx.update(fundRef, {
            balance: finalFundBalance,
            lastQuotaValue: quotaNumber ?? fundData.lastQuotaValue ?? null,
          });

          const txRef = newTxRef!;
          tx.set(txRef, {
            amount: numericAmount,
            type: "expense",
            category: "Investimentos",
            date: targetDate,
            description: `Aporte em ${fundNameLabel}`,
            createdAt: now,
          });

          tx.update(movementRef, {
            amount: numericAmount,
            date: targetDate,
            quotaValue: quotaNumber ?? null,
            units: units ?? null,
            originAccountId: targetOriginId,
            accountTransactionId: txRef.id,
          });
        }
      });

      setStatusMessage("Aporte atualizado.");
      cancelEditMovement();
    } catch (error: any) {
      console.error("Erro ao editar aporte:", error);
      setStatusMessage(error?.message || "Não foi possível editar o aporte.");
    }
  };

  const handleDeleteMovement = async (mv: InvestmentMovement) => {
    if (!user) return;
    const fundId = selectedFundId || funds[0]?.id;
    if (!fundId) {
      setStatusMessage("Selecione um fundo para excluir.");
      return;
    }
    const confirmDelete = window.confirm("Remover este aporte? Isso ajustará os saldos.");
    if (!confirmDelete) return;

    const fundRef = doc(db, "users", user.uid, "investments", fundId);
    const accountRef = doc(db, "users", user.uid, "accounts", mv.originAccountId);
    const movementRef = doc(db, "users", user.uid, "investments", fundId, "movements", mv.id);
    const accountTxRef = mv.accountTransactionId
      ? doc(db, "users", user.uid, "accounts", mv.originAccountId, "transactions", mv.accountTransactionId)
      : null;

    try {
      await runTransaction(db, async (tx) => {
        const [fundSnap, accountSnap, movementSnap, accountTxSnap] = await Promise.all([
          tx.get(fundRef),
          tx.get(accountRef),
          tx.get(movementRef),
          accountTxRef ? tx.get(accountTxRef) : Promise.resolve(null),
        ]);

        if (!fundSnap.exists()) throw new Error("Fundo não encontrado.");
        if (!accountSnap.exists()) throw new Error("Conta de origem não encontrada.");
        if (!movementSnap.exists()) throw new Error("Movimento não encontrado.");

        const currentFundBalance = fundSnap.data().balance || 0;
        const currentAccountBalance = accountSnap.data().balance || 0;

        // Usa valor real da transação, se existir, para reverter com precisão
        const txAmount = accountTxSnap?.exists() ? accountTxSnap.data().amount : mv.amount;
        const amountToRevert = typeof txAmount === "number" ? txAmount : 0;

        // Para movimento de compra, reverte: fundo -, conta +. (Venda seria o inverso, se existir no futuro.)
        const isSell = mv.type === "sell";
        const fundDelta = isSell ? amountToRevert : -amountToRevert;
        const accountDelta = isSell ? -amountToRevert : amountToRevert;

        tx.update(fundRef, { balance: currentFundBalance + fundDelta });

        // Só ajusta a conta se conhecemos a transação original ou se há valor válido
        if (accountTxSnap?.exists() && amountToRevert > 0) {
          tx.update(accountRef, { balance: currentAccountBalance + accountDelta });
        }

        if (accountTxRef && accountTxSnap?.exists()) {
          tx.delete(accountTxRef);
        }

        tx.delete(movementRef);
      });

      if (editingMovement?.id === mv.id) {
        cancelEditMovement();
      }
      setStatusMessage("Aporte excluído.");
    } catch (error: any) {
      console.error("Erro ao excluir aporte:", error);
      setStatusMessage(error?.message || "Não foi possível excluir o aporte.");
    }
  };

  const handleDeleteFund = async (fund: InvestmentFund) => {
    if (!user) return;
    const confirmDelete = window.confirm(`Excluir o fundo "${fund.name}"? Isso reverte aportes e ajusta saldos.`);
    if (!confirmDelete) return;

    const fundId = fund.id;
    const movementsRef = collection(db, "users", user.uid, "investments", fundId, "movements");
    setDeletingFundId(fundId);
    try {
      const movementsSnap = await getDocs(movementsRef);

      for (const mvDoc of movementsSnap.docs) {
        const mv = mvDoc.data() as InvestmentMovement;
        const mvId = mvDoc.id;
        const amount = typeof mv.amount === "number" ? mv.amount : 0;
        const originId = mv.originAccountId;
        const fundRef = doc(db, "users", user.uid, "investments", fundId);
        const movementRef = doc(db, "users", user.uid, "investments", fundId, "movements", mvId);
        const accountRef = originId ? doc(db, "users", user.uid, "accounts", originId) : null;
        const accountTxRef = mv.accountTransactionId && originId
          ? doc(db, "users", user.uid, "accounts", originId, "transactions", mv.accountTransactionId)
          : null;

        await runTransaction(db, async (tx) => {
          const [fundSnap, accountSnap, txSnap] = await Promise.all([
            tx.get(fundRef),
            accountRef ? tx.get(accountRef) : Promise.resolve(null),
            accountTxRef ? tx.get(accountTxRef) : Promise.resolve(null),
          ]);

          if (!fundSnap.exists()) throw new Error("Fundo não encontrado.");
          const fundBalance = fundSnap.data().balance || 0;
          const fundDelta = mv.type === "sell" ? amount : -amount;
          tx.update(fundRef, { balance: fundBalance + fundDelta });

          if (accountRef && accountSnap?.exists()) {
            const accountBalance = accountSnap.data().balance || 0;
            const accountDelta = mv.type === "sell" ? -amount : amount;
            tx.update(accountRef, { balance: accountBalance + accountDelta });
          }

          if (accountTxRef && txSnap?.exists()) {
            tx.delete(accountTxRef);
          }

          tx.delete(movementRef);
        });
      }

      const fundRef = doc(db, "users", user.uid, "investments", fundId);
      await runTransaction(db, async (tx) => {
        tx.delete(fundRef);
      });

      if (selectedFundId === fundId) {
        const other = funds.find((f) => f.id !== fundId);
        setSelectedFundId(other?.id || "");
        setMovements([]);
      }

      setStatusMessage("Fundo excluído com sucesso.");
    } catch (error: any) {
      console.error("Erro ao excluir fundo:", error);
      setStatusMessage(error?.message || "Não foi possível excluir o fundo.");
    } finally {
      setDeletingFundId("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950">
      <Sidebar />
      <main className="ml-64 p-6 lg:p-10 space-y-8">
        <header className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-500 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <FiPieChart />
              Investimentos
            </p>
            <h1 className="text-4xl font-black text-blue-700 dark:text-blue-200">Fundos e Aportes</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              Cadastre fundos, vincule o custodiante e registre aportes gerando saída na conta e entrada no fundo.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total investido</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-300">{formatCurrency(totalInvested)}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-900 p-6 shadow-lg space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300">
              <FiShield />
              <h2 className="text-xl font-black">Cadastrar fundo</h2>
            </div>
            <form className="space-y-3" onSubmit={handleAddFund}>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1">Nome do fundo</label>
                <input
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  placeholder="Ex: BTG Pactual Selic"
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1">Custodiante (Conta)</label>
                <select
                  value={custodianAccountId}
                  onChange={(e) => setCustodianAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-linear-to-r from-blue-600 via-blue-500 to-cyan-500 text-white font-semibold shadow-md hover:shadow-lg hover:scale-[1.01] transition"
              >
                <FiPlusCircle /> Cadastrar fundo
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-900 p-6 shadow-lg space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
              <FiArrowDownCircle />
              <h2 className="text-xl font-black">Novo aporte (Aplicar/Comprar)</h2>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleContribution}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Fundo de destino</label>
                <select
                  value={selectedFundId}
                  onChange={(e) => setSelectedFundId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Conta de origem</label>
                <select
                  value={originAccountId}
                  onChange={(e) => setOriginAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Valor</label>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-3 text-blue-500" size={16} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Será gerada saída na conta de origem e entrada no saldo do fundo.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block flex items-center gap-1">
                  <FiCalendar size={14} />
                  Data da aplicação
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Valor da cota (opcional)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={quotaValue}
                  onChange={(e) => setQuotaValue(e.target.value)}
                  placeholder="Peça o valor da cota do dia para registrar unidades"
                  className="w-full px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  - Gera saída (transferência) na conta origem. <br />
                  - Gera entrada no saldo do fundo. <br />
                  - Se informado, salva valor da cota e unidades compradas.
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linear-to-r from-emerald-600 to-emerald-500 text-white font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition"
                >
                  <FiArrowUpCircle /> Aplicar/Comprar
                </button>
              </div>
            </form>
            {statusMessage && <p className="text-sm text-blue-600 dark:text-blue-300 font-semibold">{statusMessage}</p>}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {funds.length === 0 ? (
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-2xl p-8 text-center text-slate-600 dark:text-slate-300 font-medium">
              Cadastre seu primeiro fundo para começar a investir.
            </div>
          ) : (
            funds.map((fund) => {
              const custodian = accounts.find((acc) => acc.id === fund.custodianAccountId)?.name || "Conta não definida";
              const isActive = fund.id === selectedFundId;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFundId(fund.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedFundId(fund.id);
                    }
                  }}
                  className={`text-left rounded-2xl p-5 border transition shadow-sm hover:shadow-lg hover:scale-[1.01] cursor-pointer focus:outline-none ${
                    isActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
                      : "border-blue-100 dark:border-blue-900 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-linear-to-br from-blue-600 to-cyan-500 text-white">
                        <FiPieChart />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Fundo</p>
                        <h3 className="text-xl font-black">{fund.name}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200">Custódia: {custodian}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFund(fund);
                        }}
                        disabled={deletingFundId === fund.id}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition disabled:opacity-60"
                        title="Excluir fundo"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saldo do fundo</p>
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(fund.balance || 0)}</p>
                    </div>
                    {fund.lastQuotaValue ? (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cota registrada</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(fund.lastQuotaValue)}</p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">Sem cota registrada</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {selectedFundId && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-900 shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-100 dark:border-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiArrowUpCircle className="text-blue-600" />
                <h3 className="text-lg font-black text-blue-700 dark:text-blue-200">Aportes deste fundo</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{movements.length} registros</span>
            </div>
            {movements.length === 0 ? (
              <div className="p-6 text-slate-600 dark:text-slate-300">Nenhum aporte registrado ainda.</div>
            ) : (
              <div className="divide-y divide-blue-50 dark:divide-blue-900">
                {movements
                  .slice()
                  .sort((a, b) => {
                    const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
                    const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
                    return db - da;
                  })
                  .map((mv) => {
                    const originName = accounts.find((acc) => acc.id === mv.originAccountId)?.name || "Conta";
                    const isEditing = editingMovement?.id === mv.id;
                    return (
                      <div key={mv.id} className="px-6 py-3 flex flex-col gap-2">
                        {isEditing ? (
                          <form onSubmit={handleUpdateMovement} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Valor</label>
                              <input
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Data</label>
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Cota (opcional)</label>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={editQuotaValue}
                                onChange={(e) => setEditQuotaValue(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">Conta de origem</label>
                              <select
                                value={editOriginAccountId}
                                onChange={(e) => setEditOriginAccountId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                {accounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-4 flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={cancelEditMovement}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <FiX /> Cancelar
                              </button>
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition"
                              >
                                <FiCheck /> Salvar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(mv.amount)}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {mv.date instanceof Date ? mv.date.toLocaleDateString("pt-BR") : "Data"} • Origem: {originName}
                              </p>
                              {mv.quotaValue ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                                  Cota: {formatCurrency(mv.quotaValue)} {mv.units ? `• Unidades: ${mv.units.toFixed(4)}` : ""}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Cota não informada</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200">Aporte</span>
                              <button
                                type="button"
                                onClick={() => startEditMovement(mv)}
                                className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                                title="Editar aporte"
                              >
                                <FiEdit3 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMovement(mv)}
                                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                                title="Excluir aporte"
                              >
                                <FiTrash2 size={16} />
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
        )}
      </main>
    </div>
  );
}
