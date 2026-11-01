import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  Edit2,
  Trash2,
  RefreshCw,
  History,
  X,
  Tag,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { usePersonalFinance } from '../../context/PersonalFinanceContext';
import { useFinance } from '../../context/FinanceContext';
import {
  PersonalBill,
  PersonalBillPayment,
  PersonalBillType,
  PersonalBillRecurrence,
  PersonalPaymentMethod,
} from '../../types/finance';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getTodayDateString,
  calculateDaysDifference,
} from '../../utils/formatters';
import { CurrencyInput } from '../common/CurrencyInput';

export const PersonalBillsView: React.FC = () => {
  const { isMasterAdmin } = useFinance();
  const {
    monthlyBills,
    categories,
    selectedMonth,
    goToNextMonth,
    goToPrevMonth,
    goToCurrentMonth,
    summary,
    upcomingBills,
    isLoading,
    addCategory,
    createBill,
    updateBill,
    deleteBill,
    payBill,
    cancelPayment,
    generateNextRecurrence,
  } = usePersonalFinance();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid' | 'partial'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<PersonalBill | null>(null);

  const [payingBill, setPayingBill] = useState<PersonalBill | null>(null);
  const [historyBill, setHistoryBill] = useState<PersonalBill | null>(null);
  const [billToDelete, setBillToDelete] = useState<PersonalBill | null>(null);
  const [recurrenceBillToGenerate, setRecurrenceBillToGenerate] = useState<PersonalBill | null>(null);
  const [paymentToCancel, setPaymentToCancel] = useState<{ bill: PersonalBill; paymentId: string } | null>(null);

  // Form states for Create/Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDueDate, setFormDueDate] = useState(getTodayDateString());
  const [formType, setFormType] = useState<PersonalBillType>('fixed');
  const [formRecurrence, setFormRecurrence] = useState<PersonalBillRecurrence>('monthly');
  const [formInstallmentsCount, setFormInstallmentsCount] = useState<number | ''>('');
  const [formCurrentInstallment, setFormCurrentInstallment] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState('');

  // Form states for Payment
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payMethod, setPayMethod] = useState<PersonalPaymentMethod>('pix');
  const [payNotes, setPayNotes] = useState('');
  const [payGenerateNext, setPayGenerateNext] = useState(true);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Month title formatter (e.g. "Novembro de 2026")
  const formattedMonthTitle = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${yStr}`;
  }, [selectedMonth]);

  // Filtered bills for the table/cards
  const filteredBills = useMemo(() => {
    return monthlyBills.filter((bill) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          bill.name.toLowerCase().includes(q) ||
          bill.category.toLowerCase().includes(q) ||
          (bill.notes && bill.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter === 'pending' && (bill.status === 'paid')) return false;
      if (statusFilter === 'overdue' && bill.status !== 'overdue') return false;
      if (statusFilter === 'paid' && bill.status !== 'paid') return false;
      if (statusFilter === 'partial' && bill.status !== 'partially_paid') return false;

      // Category filter
      if (categoryFilter !== 'all' && bill.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [monthlyBills, searchQuery, statusFilter, categoryFilter]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingBill(null);
    setFormName('');
    setFormCategory(categories[0] || 'Outras Despesas');
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setFormAmount('');
    setFormDueDate(getTodayDateString());
    setFormType('fixed');
    setFormRecurrence('monthly');
    setFormInstallmentsCount('');
    setFormCurrentInstallment('');
    setFormNotes('');
    setIsFormModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (b: PersonalBill) => {
    setEditingBill(b);
    setFormName(b.name);
    setFormCategory(b.category);
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setFormAmount(b.amount);
    setFormDueDate(b.dueDate);
    setFormType(b.type);
    setFormRecurrence(b.recurrence);
    setFormInstallmentsCount(b.installmentsCount || '');
    setFormCurrentInstallment(b.currentInstallmentNumber || '');
    setFormNotes(b.notes || '');
    setIsFormModalOpen(true);
  };

  // Save bill
  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification('error', 'Informe o nome da conta.');
      return;
    }
    if (!formAmount || Number(formAmount) <= 0) {
      showNotification('error', 'Informe um valor válido para a conta.');
      return;
    }

    let finalCategory = formCategory;
    if (isAddingNewCategory && newCategoryName.trim()) {
      finalCategory = newCategoryName.trim();
      addCategory(finalCategory);
    }

    setIsSubmitting(true);
    try {
      if (editingBill) {
        await updateBill(editingBill.id, {
          name: formName.trim(),
          category: finalCategory,
          amount: Number(formAmount),
          dueDate: formDueDate,
          type: formType,
          recurrence: formRecurrence,
          installmentsCount: formType === 'installment' && formInstallmentsCount ? Number(formInstallmentsCount) : undefined,
          currentInstallmentNumber: formType === 'installment' && formCurrentInstallment ? Number(formCurrentInstallment) : undefined,
          notes: formNotes.trim() || undefined,
        });
        showNotification('success', 'Conta pessoal atualizada com sucesso!');
      } else {
        await createBill({
          name: formName.trim(),
          category: finalCategory,
          amount: Number(formAmount),
          dueDate: formDueDate,
          type: formType,
          recurrence: formRecurrence,
          installmentsCount: formType === 'installment' && formInstallmentsCount ? Number(formInstallmentsCount) : undefined,
          currentInstallmentNumber: formType === 'installment' && formCurrentInstallment ? Number(formCurrentInstallment) : undefined,
          notes: formNotes.trim() || undefined,
        });
        showNotification('success', 'Conta pessoal cadastrada com sucesso!');
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao salvar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Payment modal
  const handleOpenPay = (b: PersonalBill) => {
    setPayingBill(b);
    setPayAmount(b.remainingAmount);
    setPayDate(getTodayDateString());
    setPayMethod('pix');
    setPayNotes('');
    setPayGenerateNext(b.recurrence !== 'none');
  };

  // Submit payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill || !payAmount || Number(payAmount) <= 0) return;

    setIsSubmitting(true);
    try {
      await payBill(payingBill.id, {
        amount: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
        generateNextRecurrenceToo: payGenerateNext,
      });
      showNotification('success', 'Pagamento registrado com sucesso!');
      setPayingBill(null);
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete bill
  const handleConfirmDeleteBill = async () => {
    if (!billToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteBill(billToDelete.id);
      showNotification('success', 'Conta excluída com sucesso.');
      setBillToDelete(null);
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao excluir conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm generate next recurrence
  const handleConfirmGenerateRecurrence = async () => {
    if (!recurrenceBillToGenerate) return;
    setIsSubmitting(true);
    try {
      const next = await generateNextRecurrence(recurrenceBillToGenerate.id);
      showNotification('success', `Próximo vencimento gerado para ${formatDate(next.dueDate)}!`);
      setRecurrenceBillToGenerate(null);
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao gerar próximo vencimento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm cancel payment
  const handleConfirmCancelPayment = async () => {
    if (!paymentToCancel) return;
    setIsSubmitting(true);
    try {
      await cancelPayment(paymentToCancel.bill.id, paymentToCancel.paymentId);
      showNotification('success', 'Pagamento cancelado com sucesso.');
      setPaymentToCancel(null);
      // Refresh history modal with updated bill if open
      const updated = monthlyBills.find((b) => b.id === paymentToCancel.bill.id);
      if (updated) setHistoryBill(updated);
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao cancelar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for visual status styling
  const getStatusBadge = (bill: PersonalBill) => {
    const daysDiff = calculateDaysDifference(bill.dueDate);
    const isDueSoon = daysDiff >= 0 && daysDiff <= 3 && bill.status !== 'paid';

    if (bill.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Paga</span>
        </span>
      );
    }
    if (bill.status === 'partially_paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Parcial</span>
        </span>
      );
    }
    if (bill.status === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Vencida</span>
        </span>
      );
    }
    if (isDueSoon) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <Clock className="w-3.5 h-3.5 text-amber-700" />
          <span>Vence em breve</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>Em aberto</span>
      </span>
    );
  };

  // Privacy Protection: if not Master Admin, show access denied
  if (!isMasterAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-3xl border border-slate-200 shadow-sm mt-8">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          A área de <strong>Minhas Contas (Finanças Pessoais)</strong> é de uso exclusivo do administrador mestre do estabelecimento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 lg:pb-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Top Banner & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
              Minhas Contas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
              Pessoal & Privado
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Controle independente de compromissos pessoais (aluguel, água, energia, cartões, financiamentos).
          </p>
        </div>

        {/* Month Navigation Control */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs self-start md:self-auto">
          <button
            type="button"
            onClick={goToPrevMonth}
            className="p-2 text-slate-600 hover:text-brand-navy hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs sm:text-sm font-black text-brand-navy px-3 min-w-[140px] text-center">
            {formattedMonthTitle}
          </span>

          <button
            type="button"
            onClick={goToNextMonth}
            className="p-2 text-slate-600 hover:text-brand-navy hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={goToCurrentMonth}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* KPI Cards (Personal Financial Summary for the selected month) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Contas do Mês */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total do Mês
          </span>
          <p className="text-xl sm:text-2xl font-black text-brand-navy tracking-tight">
            {formatCurrency(summary.totalMonthBills)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.countBills} conta(s) cadastrada(s)
          </p>
        </div>

        {/* Total Já Pago */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
            Já Pago
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
            {formatCurrency(summary.totalMonthPaid)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.countPaid} conta(s) quitada(s)
          </p>
        </div>

        {/* Total Pendente */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-blue-200 shadow-xs">
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            Pendente
          </span>
          <p className="text-xl sm:text-2xl font-black text-brand-blue tracking-tight">
            {formatCurrency(summary.totalMonthPending)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.countPending} conta(s) em aberto
          </p>
        </div>

        {/* Total Vencido */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-rose-200 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1">
            Vencido
          </span>
          <p className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
            {formatCurrency(summary.totalMonthOverdue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.countOverdue > 0 ? (
              <span className="font-bold text-rose-600">{summary.countOverdue} conta(s) vencida(s)</span>
            ) : (
              <span className="text-emerald-600 font-semibold">Nenhum atraso</span>
            )}
          </p>
        </div>
      </div>

      {/* Upcoming Reminders Ribbon (if any) */}
      {upcomingBills.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Próximos Vencimentos (próximos 5 dias):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBills.map((b) => (
              <div
                key={b.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-amber-300 text-slate-800 font-medium"
              >
                <span>{b.name}</span>
                <strong className="text-brand-navy">{formatCurrency(b.remainingAmount)}</strong>
                <span className="text-amber-800 text-[10px]">({formatDate(b.dueDate)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar & New Bill Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-brand-navy shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Todas ({monthlyBills.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-brand-navy shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'overdue' ? 'bg-white text-rose-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Vencidas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'paid' ? 'bg-white text-emerald-600 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Pagas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                statusFilter === 'partial' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Parciais
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-brand-blue cursor-pointer"
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar conta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-brand-blue bg-white"
            />
          </div>

          {/* Add Bill Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md shadow-brand-navy/20 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-brand-gold" />
            <span>Nova Conta</span>
          </button>
        </div>
      </div>

      {/* List of Personal Bills */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400">Carregando suas contas pessoais...</div>
      ) : filteredBills.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Nenhuma conta encontrada para os filtros selecionados.'
              : `Nenhuma conta cadastrada para ${formattedMonthTitle}.`}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cadastre aluguel, contas de consumo, financiamentos e cartões para manter suas finanças pessoais em dia.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-light cursor-pointer"
          >
            <Plus className="w-4 h-4 text-brand-gold" />
            <span>Cadastrar Primeira Conta</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBills.map((bill) => {
            const isFullyPaid = bill.status === 'paid';

            return (
              <div
                key={bill.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: Category + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg truncate max-w-[170px]">
                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{bill.category}</span>
                    </span>
                    {getStatusBadge(bill)}
                  </div>

                  {/* Title & Installment count */}
                  <div>
                    <h3 className="text-base font-extrabold text-brand-navy leading-tight">
                      {bill.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>Vencimento: <strong>{formatDate(bill.dueDate)}</strong></span>
                      {bill.type === 'installment' && bill.installmentsCount && (
                        <span className="text-violet-700 font-bold bg-violet-50 px-1.5 py-0.2 rounded">
                          Parc. {bill.currentInstallmentNumber || 1}/{bill.installmentsCount}
                        </span>
                      )}
                      {bill.recurrence !== 'none' && (
                        <span className="text-slate-400 font-medium capitalize">
                          • {bill.recurrence === 'monthly' ? 'Mensal' : bill.recurrence === 'weekly' ? 'Semanal' : 'Anual'}
                        </span>
                      )}
                    </div>
                  </div>

                  {bill.notes && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl italic">
                      "{bill.notes}"
                    </p>
                  )}
                </div>

                {/* Financial Values & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Valor da Conta:</span>
                      <span className="text-sm font-bold text-slate-700">
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">
                        {isFullyPaid ? 'Quitado:' : 'Saldo a Pagar:'}
                      </span>
                      <span
                        className={`text-base font-black ${
                          isFullyPaid
                            ? 'text-emerald-600'
                            : bill.status === 'overdue'
                            ? 'text-rose-600'
                            : 'text-brand-navy'
                        }`}
                      >
                        {formatCurrency(isFullyPaid ? bill.paidAmount : bill.remainingAmount)}
                      </span>
                    </div>
                  </div>

                  {bill.paidAmount > 0 && !isFullyPaid && (
                    <div className="text-[11px] text-emerald-600 font-semibold flex items-center justify-between">
                      <span>Já pago:</span>
                      <span>{formatCurrency(bill.paidAmount)}</span>
                    </div>
                  )}

                  {/* Buttons Toolbar */}
                  <div className="flex items-center justify-between pt-1 gap-1">
                    <div className="flex items-center gap-1">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(bill)}
                        className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        title="Editar conta"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setBillToDelete(bill)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        title="Excluir conta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Recurrence Next Occurrence */}
                      {bill.recurrence !== 'none' && (
                        <button
                          type="button"
                          onClick={() => setRecurrenceBillToGenerate(bill)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition cursor-pointer"
                          title="Gerar próximo vencimento desta conta recorrente"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {/* Payment History */}
                      {bill.payments && bill.payments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setHistoryBill(bill)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                          title="Ver histórico de pagamentos"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Pay Button */}
                    {!isFullyPaid ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPay(bill)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Dar Baixa</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHistoryBill(bill)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ver Recibo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR OU EDITAR CONTA PESSOAL                                      */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-700">
                  <CreditCard className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">
                    {editingBill ? 'Editar Conta Pessoal' : 'Nova Conta Pessoal'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Controle de despesa isolado e privado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome ou Descrição da Conta <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel do Apartamento / Energia Elétrica / Parcela do Carro"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Categoria <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] font-bold text-violet-600 hover:underline cursor-pointer"
                  >
                    {isAddingNewCategory ? 'Escolher existente' : '+ Nova Categoria'}
                  </button>
                </div>

                {isAddingNewCategory ? (
                  <input
                    type="text"
                    required
                    placeholder="Digite o nome da nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-violet-300 text-xs focus:border-violet-500 outline-none"
                  />
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Amount and Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor da Conta (R$) <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={formAmount}
                    onChange={(val) => setFormAmount(val)}
                    placeholder="0,00"
                    className="w-full text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data de Vencimento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:border-brand-blue outline-none bg-white"
                  />
                </div>
              </div>

              {/* Type and Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PersonalBillType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white cursor-pointer"
                  >
                    <option value="fixed">Conta Fixa</option>
                    <option value="installment">Conta Parcelada</option>
                    <option value="occasional">Eventual / Avulsa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recorrência
                  </label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value as PersonalBillRecurrence)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white cursor-pointer"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="weekly">Semanal</option>
                    <option value="annual">Anual</option>
                    <option value="none">Sem Recorrência</option>
                  </select>
                </div>
              </div>

              {/* Installment numbers if applicable */}
              {formType === 'installment' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-violet-50/60 rounded-xl border border-violet-100">
                  <div>
                    <label className="block text-[11px] font-bold text-violet-900 mb-1">
                      Total de Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Ex: 12"
                      value={formInstallmentsCount}
                      onChange={(e) => setFormInstallmentsCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-bold outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-violet-900 mb-1">
                      Parcela Atual
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="Ex: 1"
                      value={formCurrentInstallment}
                      onChange={(e) => setFormCurrentInstallment(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full px-3 py-1.5 rounded-lg border border-violet-200 text-xs font-bold outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Observations */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Código de barras no e-mail / Chave Pix cadastrada"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingBill ? 'Salvar Alterações' : 'Cadastrar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR PAGAMENTO DE CONTA PESSOAL                               */}
      {/* ========================================================================= */}
      {payingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">Dar Baixa na Conta</h3>
                  <p className="text-xs text-slate-500">{payingBill.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span>Saldo em aberto:</span>
                <span className="text-base font-black text-brand-navy">
                  {formatCurrency(payingBill.remainingAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Pago (R$) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={payAmount}
                  onChange={(val) => setPayAmount(val)}
                  max={payingBill.remainingAmount}
                  placeholder="0,00"
                  className="w-full text-sm font-black text-emerald-700"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(payingBill.remainingAmount)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  >
                    Valor Total ({formatCurrency(payingBill.remainingAmount)})
                  </button>
                  {payingBill.remainingAmount > 20 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(Number((payingBill.remainingAmount / 2).toFixed(2)))}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                    >
                      Metade (50%)
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PersonalPaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white cursor-pointer"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data do Pagamento
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:border-brand-blue outline-none bg-white"
                  />
                </div>
              </div>

              {/* Automatic recurrence generation checkbox */}
              {payingBill.recurrence !== 'none' && (
                <label className="flex items-start gap-2 p-3 bg-violet-50/70 border border-violet-100 rounded-xl cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={payGenerateNext}
                    onChange={(e) => setPayGenerateNext(e.target.checked)}
                    className="mt-0.5 rounded text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <span className="font-bold text-violet-950 block">
                      Agendar automaticamente o próximo vencimento
                    </span>
                    <span className="text-[11px] text-violet-800">
                      Gera uma nova conta para o próximo ciclo sem apagar o histórico atual.
                    </span>
                  </div>
                </label>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Comprovante arquivado"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPayingBill(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registrando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HISTÓRICO DE PAGAMENTOS DA CONTA                                    */}
      {/* ========================================================================= */}
      {historyBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">Histórico de Pagamentos</h3>
                  <p className="text-xs text-slate-500">{historyBill.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryBill(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Total da Conta:</span>
                <span className="font-bold text-slate-800">{formatCurrency(historyBill.amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Já Pago:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(historyBill.paidAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Saldo Restante:</span>
                <span className="font-black text-brand-navy">{formatCurrency(historyBill.remainingAmount)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Lançamentos Realizados
              </h4>
              {(!historyBill.payments || historyBill.payments.length === 0) ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Nenhum pagamento registrado ainda para esta conta.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyBill.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          {formatCurrency(p.amount)}{' '}
                          <span className="text-[11px] font-normal text-slate-500 capitalize">
                            • {p.paymentMethod}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Data do pagamento: {formatDate(p.paymentDate)}
                        </p>
                        {p.notes && <p className="text-[11px] text-slate-400 italic">"{p.notes}"</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentToCancel({ bill: historyBill, paymentId: p.id })}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition cursor-pointer"
                      >
                        Estornar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryBill(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR EXCLUSÃO DE CONTA                                        */}
      {/* ========================================================================= */}
      {billToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Excluir Conta Pessoal</h3>
                <p className="text-xs text-slate-500">{billToDelete.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza de que deseja remover esta conta pessoal? Esta ação removerá a conta e todo o histórico de pagamentos registrado nela.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setBillToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDeleteBill}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR GERAÇÃO DE PRÓXIMO VENCIMENTO                            */}
      {/* ========================================================================= */}
      {recurrenceBillToGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-violet-600">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Gerar Próximo Vencimento</h3>
                <p className="text-xs text-slate-500">{recurrenceBillToGenerate.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Deseja criar automaticamente a conta referente ao próximo ciclo ({recurrenceBillToGenerate.recurrence === 'weekly' ? 'semana seguinte' : recurrenceBillToGenerate.recurrence === 'annual' ? 'ano seguinte' : 'mês seguinte'})? O histórico e o status desta conta atual serão 100% preservados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setRecurrenceBillToGenerate(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmGenerateRecurrence}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Gerando...' : 'Sim, Gerar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR CANCELAMENTO/ESTORNO DE PAGAMENTO                         */}
      {/* ========================================================================= */}
      {paymentToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Estornar Pagamento</h3>
                <p className="text-xs text-slate-500">{paymentToCancel.bill.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza de que deseja cancelar este pagamento? O saldo pendente da conta será recalculado automaticamente.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setPaymentToCancel(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmCancelPayment}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Estornando...' : 'Sim, Estornar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
