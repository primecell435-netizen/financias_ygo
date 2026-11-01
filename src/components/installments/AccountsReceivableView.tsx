import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Receipt,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Scissors,
  Edit3,
  History,
  MessageCircle,
  X,
  FileText,
  ChevronRight,
  ArrowLeft,
  Info,
  Phone,
  User,
  ExternalLink,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Installment, PaymentMethod } from '../../types/finance';
import { CurrencyInput } from '../common/CurrencyInput';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  calculateDaysDifference,
  generateWhatsAppLink,
  getTodayDateString,
  calculateSaleRemainingBalance,
} from '../../utils/formatters';

interface ClientReceivableGroup {
  clientId: string;
  clientName: string;
  clientPhone: string;
  totalSold: number;
  totalReceived: number;
  totalPending: number;
  pendingCount: number;
  overdueCount: number;
  partialCount: number;
  todayCount: number;
  next7Count: number;
  totalInstallmentsCount: number;
  installments: Installment[];
}

interface AccountsReceivableViewProps {
  initialClientId?: string | null;
}

export const AccountsReceivableView: React.FC<AccountsReceivableViewProps> = ({
  initialClientId = null,
}) => {
  const {
    installments,
    clients,
    registerPayment,
    transferRemainingBalance,
    splitRemainingBalance,
    updateInstallment,
    deleteSale,
    settings,
  } = useFinance();

  // Navigation state: null = client list; string = client ID
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId);

  // In-app sale deletion state
  const [saleToDelete, setSaleToDelete] = useState<{ saleId: string; description: string } | null>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  useEffect(() => {
    setSelectedClientId(initialClientId);
  }, [initialClientId]);

  // Search & Filters for Client list
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<'pending' | 'overdue' | 'today' | 'partial' | 'all'>('pending');

  // Filter inside the individual client's installments page
  const [installmentStatusFilter, setInstallmentStatusFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');

  // Modals state
  const [selectedInstForPayment, setSelectedInstForPayment] = useState<Installment | null>(null);
  const [selectedInstForTransfer, setSelectedInstForTransfer] = useState<Installment | null>(null);
  const [selectedInstForSplit, setSelectedInstForSplit] = useState<Installment | null>(null);
  const [selectedInstForEdit, setSelectedInstForEdit] = useState<Installment | null>(null);
  const [selectedInstForHistory, setSelectedInstForHistory] = useState<Installment | null>(null);

  // Form states for modals
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');
  const [payDate, setPayDate] = useState<string>(getTodayDateString());
  const [payNotes, setPayNotes] = useState<string>('');
  const [postPayAction, setPostPayAction] = useState<
    'keep_open' | 'transfer_next' | 'transfer_date'
  >('keep_open');
  const [postPayTargetDate, setPostPayTargetDate] = useState<string>('');

  // Immediate payment receipt modal
  const [paymentReceiptModal, setPaymentReceiptModal] = useState<{
    clientName: string;
    clientPhone: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    notes?: string;
    installmentNumber: number;
    totalInstallments: number;
    productDescription: string;
    remainingInstallmentAmount: number;
    saleId: string;
  } | null>(null);

  // Transfer modal state
  const [transferMode, setTransferMode] = useState<'next' | 'custom_date'>('next');
  const [transferCustomDate, setTransferCustomDate] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Split modal state
  const [splitCount, setSplitCount] = useState<number>(2);
  const [splitIntervalDays, setSplitIntervalDays] = useState<number>(30);
  const [splitNotes, setSplitNotes] = useState<string>('');

  // Edit modal state
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');

  // Feedback toast message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleConfirmDeleteSale = async () => {
    if (!saleToDelete) return;
    setIsDeletingSale(true);
    try {
      const res = await deleteSale(saleToDelete.saleId);
      if (res.success) {
        showNotification('success', 'Venda e parcelas excluídas com sucesso.');
        setSaleToDelete(null);
      } else {
        showNotification('error', res.message || 'Erro ao excluir venda.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao excluir venda.');
    } finally {
      setIsDeletingSale(false);
    }
  };

  // Group installments by Client (each client appears exactly once!)
  const clientGroups: ClientReceivableGroup[] = useMemo(() => {
    const map = new Map<string, ClientReceivableGroup>();

    // Index all registered clients first
    for (const cli of clients) {
      map.set(cli.id, {
        clientId: cli.id,
        clientName: cli.name,
        clientPhone: cli.phone || '',
        totalSold: 0,
        totalReceived: 0,
        totalPending: 0,
        pendingCount: 0,
        overdueCount: 0,
        partialCount: 0,
        todayCount: 0,
        next7Count: 0,
        totalInstallmentsCount: 0,
        installments: [],
      });
    }

    // Now populate from installments
    for (const inst of installments) {
      let group = map.get(inst.clientId);
      if (!group) {
        // Fallback for any installment with custom/unindexed client ID
        group = {
          clientId: inst.clientId,
          clientName: inst.clientName,
          clientPhone: inst.clientPhone || '',
          totalSold: 0,
          totalReceived: 0,
          totalPending: 0,
          pendingCount: 0,
          overdueCount: 0,
          partialCount: 0,
          todayCount: 0,
          next7Count: 0,
          totalInstallmentsCount: 0,
          installments: [],
        };
        map.set(inst.clientId, group);
      }

      // If client group phone is empty, check installment
      if (!group.clientPhone && inst.clientPhone) {
        group.clientPhone = inst.clientPhone;
      }

      group.installments.push(inst);
      group.totalInstallmentsCount += 1;
      group.totalSold += inst.originalAmount;
      group.totalReceived += inst.paidAmount;

      if (!inst.isTransferred && inst.status !== 'paid') {
        const daysDiff = calculateDaysDifference(inst.dueDate);
        group.totalPending += inst.remainingAmount;
        group.pendingCount += 1;

        if (inst.isOverdue || daysDiff < 0) {
          group.overdueCount += 1;
        }

        if (daysDiff === 0) {
          group.todayCount += 1;
        } else if (daysDiff > 0 && daysDiff <= 7) {
          group.next7Count += 1;
        }

        if (inst.paidAmount > 0 && inst.remainingAmount > 0) {
          group.partialCount += 1;
        }
      }
    }

    // Return array of client groups
    return Array.from(map.values());
  }, [installments, clients]);

  // Filtered Client List for main view
  const filteredClientGroups = useMemo(() => {
    return clientGroups
      .filter((group) => {
        // Search query by name or phone
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matches =
            group.clientName.toLowerCase().includes(q) ||
            group.clientPhone.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
          if (!matches) return false;
        }

        // Rule 8: Clientes que não possuem valores pendentes não precisam aparecer na listagem principal
        // Unless filter 'all' is explicitly chosen
        if (clientFilter === 'pending') {
          return group.totalPending > 0;
        }
        if (clientFilter === 'overdue') {
          return group.overdueCount > 0 && group.totalPending > 0;
        }
        if (clientFilter === 'today') {
          return group.todayCount > 0 && group.totalPending > 0;
        }
        if (clientFilter === 'partial') {
          return group.partialCount > 0 && group.totalPending > 0;
        }
        if (clientFilter === 'all') {
          // Show all clients who have at least 1 installment/sale
          return group.totalInstallmentsCount > 0;
        }

        return group.totalPending > 0;
      })
      .sort((a, b) => {
        // Prioritize clients with overdue installments, then by highest pending amount
        if (a.overdueCount !== b.overdueCount) {
          return b.overdueCount - a.overdueCount;
        }
        return b.totalPending - a.totalPending;
      });
  }, [clientGroups, searchQuery, clientFilter]);

  // Selected client group data
  const selectedClientGroup = useMemo(() => {
    if (!selectedClientId) return null;
    return clientGroups.find((g) => g.clientId === selectedClientId) || null;
  }, [clientGroups, selectedClientId]);

  // Installments for selected client, sorted by due date and installment number
  const selectedClientInstallments = useMemo(() => {
    if (!selectedClientGroup) return [];

    return [...selectedClientGroup.installments]
      .filter((inst) => {
        if (installmentStatusFilter === 'open') {
          return inst.status !== 'paid' && !inst.isTransferred;
        }
        if (installmentStatusFilter === 'overdue') {
          return inst.isOverdue && !inst.isTransferred && inst.status !== 'paid';
        }
        if (installmentStatusFilter === 'paid') {
          return inst.status === 'paid';
        }
        return true;
      })
      .sort((a, b) => {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [selectedClientGroup, installmentStatusFilter]);

  // Handlers for Modals
  const handleOpenPayment = (inst: Installment) => {
    setSelectedInstForPayment(inst);
    setPayAmount(inst.remainingAmount);
    setPayMethod('pix');
    setPayDate(getTodayDateString());
    setPayNotes('');
    setPostPayAction('keep_open');
    const nextD = new Date();
    nextD.setDate(nextD.getDate() + 30);
    setPostPayTargetDate(nextD.toISOString().split('T')[0]);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForPayment || !payAmount || Number(payAmount) <= 0) return;

    const res = await registerPayment({
      installmentId: selectedInstForPayment.id,
      amount: Number(payAmount),
      paymentMethod: payMethod,
      paymentDate: payDate,
      notes: payNotes,
      postPaymentAction: postPayAction,
      targetDueDate: postPayAction === 'transfer_date' ? postPayTargetDate : undefined,
    });

    if (res.success) {
      showNotification('success', res.message);
      const remainingThisInst = Math.max(0, selectedInstForPayment.remainingAmount - Number(payAmount));
      setPaymentReceiptModal({
        clientName: selectedInstForPayment.clientName,
        clientPhone: selectedInstForPayment.clientPhone,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        paymentDate: payDate,
        notes: payNotes,
        installmentNumber: selectedInstForPayment.installmentNumber,
        totalInstallments: selectedInstForPayment.totalInstallments,
        productDescription: selectedInstForPayment.productDescription,
        remainingInstallmentAmount: remainingThisInst,
        saleId: selectedInstForPayment.saleId,
      });
      setSelectedInstForPayment(null);
    } else {
      showNotification('error', res.message);
    }
  };

  const handleOpenTransfer = (inst: Installment) => {
    setSelectedInstForTransfer(inst);
    setTransferMode('next');
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setTransferCustomDate(d.toISOString().split('T')[0]);
    setTransferNotes('');
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForTransfer) return;

    const res = await transferRemainingBalance({
      installmentId: selectedInstForTransfer.id,
      mode: transferMode,
      targetDueDate: transferMode === 'custom_date' ? transferCustomDate : undefined,
      notes: transferNotes,
    });

    if (res.success) {
      showNotification('success', res.message);
      setSelectedInstForTransfer(null);
    } else {
      showNotification('error', res.message);
    }
  };

  const handleOpenSplit = (inst: Installment) => {
    setSelectedInstForSplit(inst);
    setSplitCount(2);
    setSplitIntervalDays(30);
    setSplitNotes('');
  };

  const handleSubmitSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForSplit) return;

    const res = await splitRemainingBalance({
      installmentId: selectedInstForSplit.id,
      numberOfSplits: splitCount,
      intervalDays: splitIntervalDays,
      notes: splitNotes,
    });

    if (res.success) {
      showNotification('success', res.message);
      setSelectedInstForSplit(null);
    } else {
      showNotification('error', res.message);
    }
  };

  const handleOpenEdit = (inst: Installment) => {
    setSelectedInstForEdit(inst);
    setEditAmount(inst.currentAmount);
    setEditDueDate(inst.dueDate);
    setEditReason('');
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForEdit) return;

    if (!editReason.trim()) {
      showNotification('error', 'É obrigatório informar o motivo da alteração no histórico.');
      return;
    }

    const res = await updateInstallment({
      installmentId: selectedInstForEdit.id,
      newAmount: editAmount !== '' ? Number(editAmount) : undefined,
      newDueDate: editDueDate,
      reason: editReason.trim(),
    });

    if (res.success) {
      showNotification('success', res.message);
      setSelectedInstForEdit(null);
    } else {
      showNotification('error', res.message);
    }
  };

  // Generate full account summary message for WhatsApp
  const handleSendClientSummaryWhatsApp = (group: ClientReceivableGroup) => {
    const lines = [
      `*EXTRATO DE CONTAS A RECEBER*`,
      `*Estabelecimento:* ${settings.businessName || 'Meu Financeiro'}`,
      `*Cliente:* ${group.clientName}`,
      `----------------------------------------`,
      `*Total Vendido:* ${formatCurrency(group.totalSold)}`,
      `*Total Já Pago:* ${formatCurrency(group.totalReceived)}`,
      `*Saldo Devedor Total:* ${formatCurrency(group.totalPending)}`,
      `*Parcelas em Aberto:* ${group.pendingCount}`,
      `----------------------------------------`,
      `*Detalhes das parcelas:*`,
    ];

    const openInsts = group.installments.filter((i) => !i.isTransferred && i.status !== 'paid');
    openInsts.forEach((inst) => {
      const isPast = calculateDaysDifference(inst.dueDate) < 0;
      lines.push(
        `• Parcela ${inst.installmentNumber}/${inst.totalInstallments} (${inst.productDescription}): ${formatCurrency(inst.remainingAmount)} - Vencimento: ${formatDate(inst.dueDate)}${isPast ? ' (EM ATRASO)' : ''}`
      );
    });

    if (settings.pixKey) {
      lines.push(`\n*Chave PIX para pagamento:* ${settings.pixKey}`);
    }

    lines.push(`\nQualquer dúvida, estamos à disposição!`);
    const message = lines.join('\n');
    const url = generateWhatsAppLink(group.clientPhone, message);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 lg:pb-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
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

      {/* ========================================================================= */}
      {/* VIEW 1: LISTA PRINCIPAL DE CLIENTES (Cada cliente aparece uma única vez)  */}
      {/* ========================================================================= */}
      {!selectedClientId ? (
        <div className="space-y-6">
          {/* Header & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
                Contas a Receber
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Selecione um cliente para visualizar todas as parcelas e realizar recebimentos ou alterações.
              </p>
            </div>

            {/* Search input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar cliente por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
              />
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              {
                id: 'pending',
                label: 'Com Pendências',
                count: clientGroups.filter((g) => g.totalPending > 0).length,
              },
              {
                id: 'overdue',
                label: 'Em Atraso',
                count: clientGroups.filter((g) => g.overdueCount > 0 && g.totalPending > 0).length,
                color: 'text-rose-600',
              },
              {
                id: 'today',
                label: 'Vencem Hoje',
                count: clientGroups.filter((g) => g.todayCount > 0 && g.totalPending > 0).length,
                color: 'text-amber-700',
              },
              {
                id: 'partial',
                label: 'Com Pagamento Parcial',
                count: clientGroups.filter((g) => g.partialCount > 0 && g.totalPending > 0).length,
              },
              {
                id: 'all',
                label: 'Todos os Clientes',
                count: clientGroups.filter((g) => g.totalInstallmentsCount > 0).length,
              },
            ].map((tab) => {
              const isActive = clientFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setClientFilter(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-brand-navy text-white border-brand-navy shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Client List */}
          {filteredClientGroups.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {searchQuery
                  ? 'Nenhum cliente encontrado para esta busca.'
                  : clientFilter === 'pending'
                  ? 'Nenhum cliente com valores pendentes no momento!'
                  : 'Nenhum cliente correspondente ao filtro.'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {clientFilter === 'pending'
                  ? 'Todas as contas a receber estão quitadas ou não há vendas fiadas cadastradas.'
                  : 'Tente alterar o filtro ou a busca para localizar o cliente.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredClientGroups.map((group) => {
                const hasOverdue = group.overdueCount > 0;
                const hasToday = group.todayCount > 0;
                const hasPartial = group.partialCount > 0;
                const isAllPaid = group.totalPending <= 0;

                return (
                  <div
                    key={group.clientId}
                    onClick={() => {
                      setSelectedClientId(group.clientId);
                      setInstallmentStatusFilter('all');
                    }}
                    className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all shadow-xs hover:shadow-md cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      hasOverdue
                        ? 'border-rose-200 hover:border-rose-300 ring-1 ring-rose-100'
                        : hasToday
                        ? 'border-amber-300 hover:border-amber-400 ring-1 ring-amber-100'
                        : isAllPaid
                        ? 'border-slate-200 bg-slate-50/50 opacity-80'
                        : 'border-slate-200 hover:border-brand-blue/40'
                    }`}
                  >
                    {/* Left: Client info and Badges */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center font-black text-xs">
                          {group.clientName.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="text-base font-black text-brand-navy group-hover:text-brand-blue transition-colors">
                          {group.clientName}
                        </h3>

                        {/* Status Badges */}
                        {hasOverdue && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            <AlertTriangle className="w-3 h-3" />
                            {group.overdueCount} {group.overdueCount === 1 ? 'parcela em atraso' : 'parcelas em atraso'}
                          </span>
                        )}

                        {hasToday && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            Vence hoje
                          </span>
                        )}

                        {hasPartial && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                            Possui pagto. parcial
                          </span>
                        )}

                        {isAllPaid && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Todas quitadas
                          </span>
                        )}
                      </div>

                      {/* Phone and Quick WhatsApp */}
                      <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-500">
                        {group.clientPhone ? (
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {formatPhone(group.clientPhone)}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Sem telefone cadastrado</span>
                        )}

                        <span className="text-slate-300">•</span>
                        <span>
                          {group.pendingCount} de {group.totalInstallmentsCount} parcelas em aberto
                        </span>
                      </div>
                    </div>

                    {/* Right: Balance amount and Open Arrow */}
                    <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">
                          Total Pendente
                        </p>
                        <p
                          className={`text-lg sm:text-xl font-black ${
                            isAllPaid
                              ? 'text-emerald-600'
                              : hasOverdue
                              ? 'text-rose-600'
                              : 'text-brand-navy'
                          }`}
                        >
                          {formatCurrency(group.totalPending)}
                        </p>
                        {group.totalReceived > 0 && (
                          <p className="text-[11px] text-slate-400">
                            Já pago: <strong className="text-emerald-700">{formatCurrency(group.totalReceived)}</strong>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {group.clientPhone && group.totalPending > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendClientSummaryWhatsApp(group);
                            }}
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            title="Enviar resumo completo pelo WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-navy group-hover:bg-brand-navy-light text-white text-xs font-bold transition shadow-xs"
                        >
                          <span>Abrir Parcelas</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: PÁGINA INDIVIDUAL DO CLIENTE (Com todas as parcelas e ações)       */
        /* ========================================================================= */
        selectedClientGroup && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Bar with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-brand-navy hover:bg-slate-50 font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Lista de Clientes</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedClientGroup.clientPhone && (
                  <button
                    onClick={() => handleSendClientSummaryWhatsApp(selectedClientGroup)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Extrato Geral no WhatsApp</span>
                  </button>
                )}
              </div>
            </div>

            {/* Client Profile and Financial Summary Header */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-navy text-white flex items-center justify-center font-black text-lg shadow-sm">
                    {selectedClientGroup.clientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-brand-navy">
                      {selectedClientGroup.clientName}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatPhone(selectedClientGroup.clientPhone) || 'Sem telefone'}</span>
                    </p>
                  </div>
                </div>

                {/* Overdue / Status Notice */}
                {selectedClientGroup.overdueCount > 0 ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold self-start sm:self-auto">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{selectedClientGroup.overdueCount} parcela(s) em atraso</span>
                  </div>
                ) : selectedClientGroup.totalPending === 0 ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold self-start sm:self-auto">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Cliente com todas as contas quitadas</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold self-start sm:self-auto">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Pagamentos em dia</span>
                  </div>
                )}
              </div>

              {/* 4 Financial Indicator Cards for this Client */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Vendido
                  </span>
                  <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">
                    {formatCurrency(selectedClientGroup.totalSold)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedClientGroup.totalInstallmentsCount} parcelas geradas
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Total Recebido
                  </span>
                  <p className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
                    {formatCurrency(selectedClientGroup.totalReceived)}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Pagamentos confirmados
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border ${
                    selectedClientGroup.overdueCount > 0
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-brand-blue-light/50 border-brand-blue/20'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block ${
                      selectedClientGroup.overdueCount > 0 ? 'text-rose-700' : 'text-brand-navy'
                    }`}
                  >
                    Saldo Pendente
                  </span>
                  <p
                    className={`text-lg sm:text-xl font-black mt-1 ${
                      selectedClientGroup.overdueCount > 0 ? 'text-rose-600' : 'text-brand-navy'
                    }`}
                  >
                    {formatCurrency(selectedClientGroup.totalPending)}
                  </p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      selectedClientGroup.overdueCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {selectedClientGroup.pendingCount} parcela(s) em aberto
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Situação Atual
                  </span>
                  <p className="text-base sm:text-lg font-black text-slate-800 mt-1">
                    {selectedClientGroup.pendingCount === 0
                      ? '100% Quitado'
                      : `${selectedClientGroup.pendingCount} pendente(s)`}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedClientGroup.overdueCount > 0
                      ? `${selectedClientGroup.overdueCount} em atraso`
                      : 'Nenhum atraso'}
                  </p>
                </div>
              </div>
            </div>

            {/* Installments Table/List Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-bold text-brand-navy flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-brand-blue" />
                  <span>Relação de Parcelas de {selectedClientGroup.clientName}</span>
                </h3>

                {/* Sub-filter tabs inside client view */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'all', label: 'Todas as Parcelas', count: selectedClientGroup.installments.length },
                    {
                      id: 'open',
                      label: 'Em Aberto',
                      count: selectedClientGroup.installments.filter((i) => i.status !== 'paid' && !i.isTransferred).length,
                    },
                    {
                      id: 'overdue',
                      label: 'Em Atraso',
                      count: selectedClientGroup.installments.filter((i) => i.isOverdue && !i.isTransferred).length,
                    },
                    {
                      id: 'paid',
                      label: 'Quitadas',
                      count: selectedClientGroup.installments.filter((i) => i.status === 'paid').length,
                    },
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setInstallmentStatusFilter(subTab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        installmentStatusFilter === subTab.id
                          ? 'bg-brand-navy text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{subTab.label}</span>
                      <span className="ml-1 opacity-70">({subTab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Installments Cards */}
              {selectedClientInstallments.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                  <p className="text-sm font-bold text-slate-700">Nenhuma parcela neste filtro.</p>
                  <p className="text-xs text-slate-400">Altere o filtro acima para ver outras parcelas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {selectedClientInstallments.map((inst) => {
                    const daysDiff = calculateDaysDifference(inst.dueDate);
                    const isOverdue = daysDiff < 0 && inst.status !== 'paid' && !inst.isTransferred;
                    const isToday = daysDiff === 0 && inst.status !== 'paid' && !inst.isTransferred;
                    const isPaid = inst.status === 'paid';
                    const hasPartial = inst.paidAmount > 0 && inst.remainingAmount > 0;

                    return (
                      <div
                        key={inst.id}
                        className={`p-4 sm:p-5 rounded-2xl bg-white border transition shadow-xs hover:shadow-md ${
                          isOverdue
                            ? 'border-rose-300 ring-1 ring-rose-200'
                            : isToday
                            ? 'border-amber-300 ring-1 ring-amber-200'
                            : isPaid
                            ? 'border-slate-200 bg-slate-50/50 opacity-90'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Parcela Info & Badges */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-brand-navy bg-slate-100 px-2.5 py-0.5 rounded-lg">
                                Parcela {inst.installmentNumber}/{inst.totalInstallments}
                              </span>

                              {/* Status Badges */}
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  Atrasada ({Math.abs(daysDiff)} dias)
                                </span>
                              )}
                              {isToday && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  <Clock className="w-3 h-3" />
                                  Vence Hoje
                                </span>
                              )}
                              {hasPartial && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
                                  Parcialmente Pago ({formatCurrency(inst.paidAmount)})
                                </span>
                              )}
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Quitada
                                </span>
                              )}
                              {inst.isTransferred && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                  Saldo Transferido
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 font-medium">
                              Produto: <strong>{inst.productDescription}</strong> • Vencimento:{' '}
                              <strong className={isOverdue ? 'text-rose-600 font-black' : 'text-slate-900'}>
                                {formatDate(inst.dueDate)}
                              </strong>
                              {!isOverdue && !isPaid && daysDiff > 0 && (
                                <span className="text-slate-400 font-normal ml-1">
                                  (em {daysDiff} {daysDiff === 1 ? 'dia' : 'dias'})
                                </span>
                              )}
                            </p>

                            {(inst.notes || inst.observation) && (
                              <p className="text-[11px] text-slate-500 italic">
                                Observação: "{inst.notes || inst.observation}"
                              </p>
                            )}
                          </div>

                          {/* Values Breakdown */}
                          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 justify-between sm:justify-start">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Valor Original</p>
                              <p className="text-xs font-semibold text-slate-600">
                                {formatCurrency(inst.originalAmount)}
                              </p>
                            </div>

                            {inst.paidAmount > 0 && (
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Valor Recebido</p>
                                <p className="text-xs font-bold text-emerald-600">
                                  {formatCurrency(inst.paidAmount)}
                                </p>
                              </div>
                            )}

                            <div className="pl-2 border-l border-slate-200">
                              <p className="text-[10px] text-slate-500 uppercase font-black">Saldo Restante</p>
                              <p
                                className={`text-base font-black ${
                                  isPaid ? 'text-slate-400' : isOverdue ? 'text-rose-600' : 'text-brand-navy'
                                }`}
                              >
                                {formatCurrency(inst.remainingAmount)}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons for this installment */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 justify-end">
                            {!isPaid && !inst.isTransferred && (
                              <button
                                onClick={() => handleOpenPayment(inst)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-extrabold shadow-xs hover:shadow-md transition cursor-pointer"
                                title="Receber pagamento integral ou parcial"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Receber</span>
                              </button>
                            )}

                            {!isPaid && !inst.isTransferred && (
                              <button
                                onClick={() => handleOpenTransfer(inst)}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-navy hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                                title="Transferir saldo para próxima parcela ou outra data"
                              >
                                <ArrowRightLeft className="w-4 h-4 text-brand-blue" />
                              </button>
                            )}

                            {!isPaid && !inst.isTransferred && inst.remainingAmount > 10 && (
                              <button
                                onClick={() => handleOpenSplit(inst)}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-navy hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                                title="Dividir saldo em várias parcelas"
                              >
                                <Scissors className="w-4 h-4 text-brand-turquoise" />
                              </button>
                            )}

                            {!isPaid && !inst.isTransferred && (
                              <button
                                onClick={() => handleOpenEdit(inst)}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-navy hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                                title="Editar valor ou vencimento (com justificativa)"
                              >
                                <Edit3 className="w-4 h-4 text-amber-600" />
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedInstForHistory(inst)}
                              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-navy hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                              title="Ver histórico e auditoria desta parcela"
                            >
                              <History className="w-4 h-4 text-slate-500" />
                            </button>

                            {inst.saleId && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSaleToDelete({
                                    saleId: inst.saleId,
                                    description: `${inst.productDescription} (Venda #${inst.saleId.slice(-6)})`,
                                  })
                                }
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer"
                                title="Excluir ou cancelar esta venda e suas parcelas"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {selectedClientGroup.clientPhone && !isPaid && !inst.isTransferred && (
                              <a
                                href={generateWhatsAppLink(
                                  selectedClientGroup.clientPhone,
                                  `Olá ${selectedClientGroup.clientName}, tudo bem? Passando para lembrar da parcela ${inst.installmentNumber}/${inst.totalInstallments} de ${inst.productDescription} no valor de ${formatCurrency(inst.remainingAmount)} com vencimento em ${formatDate(inst.dueDate)}.`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                                title="Enviar lembrete desta parcela no WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECEBER PAGAMENTO (TOTAL OU PARCIAL COM FLEXIBILIDADE)           */}
      {/* ========================================================================= */}
      {selectedInstForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">Receber Pagamento</h3>
                  <p className="text-xs text-slate-500">
                    {selectedInstForPayment.clientName} • Parcela {selectedInstForPayment.installmentNumber}/
                    {selectedInstForPayment.totalInstallments}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInstForPayment(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span>Saldo em aberto desta parcela:</span>
                <span className="text-base font-black text-brand-navy">
                  {formatCurrency(selectedInstForPayment.remainingAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor a Receber (R$) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={payAmount}
                  onChange={(val) => setPayAmount(val)}
                  max={selectedInstForPayment.remainingAmount}
                  className="w-full text-sm font-black text-emerald-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  placeholder="0,00"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayAmount(selectedInstForPayment.remainingAmount)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  >
                    Valor Total ({formatCurrency(selectedInstForPayment.remainingAmount)})
                  </button>
                  {selectedInstForPayment.remainingAmount > 20 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmount(Number((selectedInstForPayment.remainingAmount / 2).toFixed(2)))
                      }
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                    >
                      Metade (50%)
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none"
                  />
                </div>
              </div>

              {/* Partial Payment Flexibility */}
              {payAmount !== '' && Number(payAmount) < selectedInstForPayment.remainingAmount && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-amber-800 font-bold">
                    <Info className="w-4 h-4" />
                    <span>Pagamento Parcial detectado!</span>
                  </div>
                  <p className="text-slate-600">
                    Saldo que restará em aberto:{' '}
                    <strong className="text-brand-navy">
                      {formatCurrency(selectedInstForPayment.remainingAmount - Number(payAmount))}
                    </strong>
                    . O que deseja fazer com este saldo restante?
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="postPay"
                        checked={postPayAction === 'keep_open'}
                        onChange={() => setPostPayAction('keep_open')}
                        className="text-brand-blue focus:ring-brand-blue"
                      />
                      <span>Manter saldo em aberto nesta mesma parcela</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="postPay"
                        checked={postPayAction === 'transfer_next'}
                        onChange={() => setPostPayAction('transfer_next')}
                        className="text-brand-blue focus:ring-brand-blue"
                      />
                      <span>Transferir saldo para a próxima parcela deste cliente</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="postPay"
                        checked={postPayAction === 'transfer_date'}
                        onChange={() => setPostPayAction('transfer_date')}
                        className="text-brand-blue focus:ring-brand-blue"
                      />
                      <span>Prorrogar/transferir para outra data personalizada</span>
                    </label>
                  </div>

                  {postPayAction === 'transfer_date' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nova data de vencimento do saldo restante:
                      </label>
                      <input
                        type="date"
                        required
                        value={postPayTargetDate}
                        onChange={(e) => setPostPayTargetDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-amber-300 text-xs font-semibold focus:border-brand-blue outline-none bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações / Recibo (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pago via Pix com comprovante"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={() => setSelectedInstForPayment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRANSFERIR SALDO RESTANTE                                        */}
      {/* ========================================================================= */}
      {selectedInstForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-blue-light text-brand-blue">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">Transferir Saldo</h3>
              </div>
              <button
                onClick={() => setSelectedInstForTransfer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <p className="text-slate-500">Saldo a transferir da parcela {selectedInstForTransfer.installmentNumber}:</p>
                <p className="text-lg font-black text-brand-navy">
                  {formatCurrency(selectedInstForTransfer.remainingAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={transferMode === 'next'}
                    onChange={() => setTransferMode('next')}
                    className="text-brand-blue"
                  />
                  <span>Transferir e somar à próxima parcela ativa</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={transferMode === 'custom_date'}
                    onChange={() => setTransferMode('custom_date')}
                    className="text-brand-blue"
                  />
                  <span>Transferir para uma nova data de vencimento</span>
                </label>
              </div>

              {transferMode === 'custom_date' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Novo Vencimento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={transferCustomDate}
                    onChange={(e) => setTransferCustomDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Cliente pediu prorrogação por motivo pessoal"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={() => setSelectedInstForTransfer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DIVIDIR SALDO RESTANTE                                           */}
      {/* ========================================================================= */}
      {selectedInstForSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-turquoise-light text-brand-turquoise">
                  <Scissors className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">Dividir Saldo Restante</h3>
              </div>
              <button
                onClick={() => setSelectedInstForSplit(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSplit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <p className="text-slate-500">Saldo atual da parcela {selectedInstForSplit.installmentNumber}:</p>
                <p className="text-lg font-black text-brand-navy">
                  {formatCurrency(selectedInstForSplit.remainingAmount)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dividir em quantas vezes?</label>
                  <select
                    value={splitCount}
                    onChange={(e) => setSplitCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-brand-navy focus:border-brand-blue outline-none bg-white"
                  >
                    <option value={2}>2 vezes ({formatCurrency(selectedInstForSplit.remainingAmount / 2)} cada)</option>
                    <option value={3}>3 vezes ({formatCurrency(selectedInstForSplit.remainingAmount / 3)} cada)</option>
                    <option value={4}>4 vezes ({formatCurrency(selectedInstForSplit.remainingAmount / 4)} cada)</option>
                    <option value={5}>5 vezes ({formatCurrency(selectedInstForSplit.remainingAmount / 5)} cada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Intervalo de dias</label>
                  <select
                    value={splitIntervalDays}
                    onChange={(e) => setSplitIntervalDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none bg-white"
                  >
                    <option value={7}>A cada 7 dias (Semanal)</option>
                    <option value={15}>A cada 15 dias (Quinzenal)</option>
                    <option value={30}>A cada 30 dias (Mensal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Justificativa no Histórico</label>
                <input
                  type="text"
                  placeholder="Ex: Renegociação para facilitar pagamento do cliente"
                  value={splitNotes}
                  onChange={(e) => setSplitNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={() => setSelectedInstForSplit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-turquoise hover:bg-brand-turquoise-dark text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirmar Divisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDITAR PARCELA (COM JUSTIFICATIVA OBRIGATÓRIA NO HISTÓRICO)       */}
      {/* ========================================================================= */}
      {selectedInstForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">Editar Parcela</h3>
                  <p className="text-xs text-slate-500">
                    Parcela {selectedInstForEdit.installmentNumber}/{selectedInstForEdit.totalInstallments} •{' '}
                    {selectedInstForEdit.clientName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInstForEdit(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Novo Valor da Parcela (R$) <span className="text-rose-500">*</span>
                </label>
                <CurrencyInput
                  value={editAmount}
                  onChange={(val) => setEditAmount(val)}
                  className="w-full text-sm font-bold text-slate-900 focus:border-brand-blue"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nova Data de Vencimento
                </label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo da Alteração <span className="text-rose-500">*</span> (Ficará registrado no histórico)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Concedido desconto / Prorrogado a pedido"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={() => setSelectedInstForEdit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Salvar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: HISTÓRICO & AUDITORIA DE UMA PARCELA                              */}
      {/* ========================================================================= */}
      {selectedInstForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100 text-brand-navy">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">Histórico & Auditoria</h3>
                  <p className="text-xs text-slate-500">
                    Parcela {selectedInstForHistory.installmentNumber}/
                    {selectedInstForHistory.totalInstallments} • {selectedInstForHistory.clientName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInstForHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Valor Atual:</span>
                  <p className="font-extrabold text-slate-800">
                    {formatCurrency(selectedInstForHistory.currentAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Total Pago:</span>
                  <p className="font-extrabold text-emerald-600">
                    {formatCurrency(selectedInstForHistory.paidAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Saldo Restante:</span>
                  <p className="font-extrabold text-brand-navy">
                    {formatCurrency(selectedInstForHistory.remainingAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Vencimento:</span>
                  <p className="font-extrabold text-slate-800">
                    {formatDate(selectedInstForHistory.dueDate)}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Linha do Tempo de Movimentações
                </h4>
                <div className="space-y-3 pl-2 border-l-2 border-brand-blue/30">
                  {selectedInstForHistory.history.map((entry, idx) => (
                    <div key={idx} className="relative pl-4 space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-brand-navy border-2 border-white" />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-slate-700 capitalize">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span>{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-600">{entry.description}</p>
                      {entry.userNote && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded-lg">
                          Nota: "{entry.userNote}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedInstForHistory(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM SALE DELETION */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmar Exclusão de Venda</h3>
                <p className="text-xs text-slate-500">{saleToDelete.description}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Esta ação cancelará e removerá permanentemente esta venda e todas as parcelas vinculadas do Cloud Firestore.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingSale}
                onClick={() => setSaleToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingSale}
                onClick={handleConfirmDeleteSale}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingSale ? 'Excluindo...' : 'Sim, Excluir Venda'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: COMPROVANTE DE PAGAMENTO COM SALDO REAL DA VENDA */}
      {paymentReceiptModal && (() => {
        const saleStats = calculateSaleRemainingBalance(paymentReceiptModal.saleId, installments);
        // The remaining balance of the sale reflecting this payment
        const effectiveSaleRemaining = Math.max(0, Number((saleStats.totalSaleRemaining - paymentReceiptModal.amount).toFixed(2)));
        const isSaleSettled = effectiveSaleRemaining <= 0.005;

        const formatMethodLabel = (m: string) => {
          switch (m) {
            case 'pix': return 'PIX';
            case 'dinheiro': return 'Dinheiro';
            case 'cartao_credito': return 'Cartão de Crédito';
            case 'cartao_debito': return 'Cartão de Débito';
            case 'transferencia': return 'Transferência Bancária';
            default: return 'Outro';
          }
        };

        const handleSendReceiptWhatsApp = () => {
          const msg = `*COMPROVANTE DE PAGAMENTO*
----------------------------------------
*Estabelecimento:* ${settings.businessName || 'Meu Financeiro'}
*Cliente:* ${paymentReceiptModal.clientName}
*Valor Recebido:* ${formatCurrency(paymentReceiptModal.amount)}
*Forma:* ${formatMethodLabel(paymentReceiptModal.paymentMethod)}
*Data:* ${formatDate(paymentReceiptModal.paymentDate)}
*Produto / Descrição:* ${paymentReceiptModal.productDescription}
*Referente à:* Parcela ${paymentReceiptModal.installmentNumber}/${paymentReceiptModal.totalInstallments}
*Situação desta Parcela:* ${paymentReceiptModal.remainingInstallmentAmount <= 0.005 ? 'Quitada' : `Saldo desta parcela: ${formatCurrency(paymentReceiptModal.remainingInstallmentAmount)}`}
*Saldo Restante desta Venda:* ${isSaleSettled ? 'R$ 0,00 (Venda Totalmente Quitada! 🎉)' : `${formatCurrency(effectiveSaleRemaining)}`}
${paymentReceiptModal.notes ? `*Obs:* ${paymentReceiptModal.notes}\n` : ''}----------------------------------------
${settings.receiptFooterMessage || 'Obrigado pela preferência e pontualidade!'}`;

          const url = generateWhatsAppLink(paymentReceiptModal.clientPhone, msg);
          window.open(url, '_blank');
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5 font-black" />
                  </div>
                  <h3 className="text-base font-bold text-brand-navy">Comprovante de Pagamento</h3>
                </div>
                <button
                  onClick={() => setPaymentReceiptModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Paper Preview */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs space-y-2 font-mono text-slate-800">
                <div className="text-center pb-2 border-b border-slate-200">
                  <p className="font-extrabold text-sm">{settings.businessName || 'MEU FINANCEIRO'}</p>
                  <p className="text-[10px] text-slate-500">Recibo de Quitação</p>
                </div>

                <div className="space-y-1 pt-1">
                  <p><strong>Cliente:</strong> {paymentReceiptModal.clientName}</p>
                  <p><strong>Data:</strong> {formatDate(paymentReceiptModal.paymentDate)}</p>
                  <p><strong>Forma:</strong> {formatMethodLabel(paymentReceiptModal.paymentMethod)}</p>
                  <p className="text-sm font-black text-emerald-700 pt-1">
                    VALOR RECEBIDO: {formatCurrency(paymentReceiptModal.amount)}
                  </p>
                  <div className="pt-2 border-t border-slate-200 space-y-0.5 text-[11px]">
                    <p><strong>Ref:</strong> {paymentReceiptModal.productDescription} (Parc. {paymentReceiptModal.installmentNumber}/{paymentReceiptModal.totalInstallments})</p>
                    <p><strong>Saldo desta Parcela:</strong> {paymentReceiptModal.remainingInstallmentAmount <= 0.005 ? 'Quitada' : formatCurrency(paymentReceiptModal.remainingInstallmentAmount)}</p>
                    <p className="font-bold text-brand-navy">
                      <strong>Saldo Restante desta Venda:</strong>{' '}
                      {isSaleSettled
                        ? 'R$ 0,00 (Venda Quitada!)'
                        : formatCurrency(effectiveSaleRemaining)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                  {settings.receiptFooterMessage || 'Obrigado pela preferência e pontualidade!'}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSendReceiptWhatsApp}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar no WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentReceiptModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
