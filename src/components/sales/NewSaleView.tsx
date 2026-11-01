import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Calendar,
  Users,
  DollarSign,
  Package,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { InstallmentInterval } from '../../types/finance';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { CurrencyInput } from '../common/CurrencyInput';
import { useFormDraft } from '../../hooks/useFormDraft';

interface NewSaleViewProps {
  onSuccess: (saleId: string) => void;
  onCancel: () => void;
}

interface SaleFormData {
  selectedClientId: string;
  clientName: string;
  clientPhone: string;
  productDescription: string;
  totalAmount: number | '';
  installmentsCount: number;
  intervalType: InstallmentInterval;
  firstDueDate: string;
  notes: string;
}

export const NewSaleView: React.FC<NewSaleViewProps> = ({ onSuccess, onCancel }) => {
  const { clients, createSale } = useFinance();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [productDescription, setProductDescription] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [intervalType, setIntervalType] = useState<InstallmentInterval>('monthly');
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft persistence
  const { hasDraft, draftValues, draftTimestamp, saveDraft, clearDraft } = useFormDraft<SaleFormData>({
    formKey: 'nova_venda',
    initialValues: {
      selectedClientId: '',
      clientName: '',
      clientPhone: '',
      productDescription: '',
      totalAmount: '',
      installmentsCount: 1,
      intervalType: 'monthly',
      firstDueDate,
      notes: '',
    },
    isFieldEmpty: (v) => !v.clientName && !v.productDescription && (!v.totalAmount || (v.totalAmount as unknown) === ''),
  });

  const [draftBannerVisible, setDraftBannerVisible] = useState<boolean>(true);

  // Restore draft callback
  const handleRestoreDraft = () => {
    if (!draftValues) return;
    if (draftValues.selectedClientId !== undefined) setSelectedClientId(draftValues.selectedClientId);
    if (draftValues.clientName !== undefined) setClientName(draftValues.clientName);
    if (draftValues.clientPhone !== undefined) setClientPhone(draftValues.clientPhone);
    if (draftValues.productDescription !== undefined) setProductDescription(draftValues.productDescription);
    if (draftValues.totalAmount !== undefined) setTotalAmount(draftValues.totalAmount);
    if (draftValues.installmentsCount !== undefined) setInstallmentsCount(draftValues.installmentsCount);
    if (draftValues.intervalType !== undefined) setIntervalType(draftValues.intervalType);
    if (draftValues.firstDueDate !== undefined) setFirstDueDate(draftValues.firstDueDate);
    if (draftValues.notes !== undefined) setNotes(draftValues.notes);
    setDraftBannerVisible(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftBannerVisible(false);
  };

  // Auto-save form draft on changes
  useEffect(() => {
    saveDraft({
      selectedClientId,
      clientName,
      clientPhone,
      productDescription,
      totalAmount,
      installmentsCount,
      intervalType,
      firstDueDate,
      notes,
    });
  }, [
    selectedClientId,
    clientName,
    clientPhone,
    productDescription,
    totalAmount,
    installmentsCount,
    intervalType,
    firstDueDate,
    notes,
    saveDraft,
  ]);

  // Editable preview installments
  const [previewInstallments, setPreviewInstallments] = useState<
    Array<{ installmentNumber: number; amount: number; dueDate: string; notes?: string }>
  >([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When client selection changes
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const cli = clients.find((c) => c.id === clientId);
      if (cli) {
        setClientName(cli.name);
        setClientPhone(cli.phone);
      }
    } else {
      setClientName('');
      setClientPhone('');
    }
  };

  // Auto-generate preview installments when total, count, interval or firstDueDate changes
  useEffect(() => {
    if (!totalAmount || Number(totalAmount) <= 0 || installmentsCount <= 0 || !firstDueDate) {
      setPreviewInstallments([]);
      return;
    }

    const numTotal = Number(totalAmount);
    const count = Number(installmentsCount);
    const baseAmount = Number((numTotal / count).toFixed(2));
    const remainder = Number((numTotal - baseAmount * count).toFixed(2));

    const list: Array<{ installmentNumber: number; amount: number; dueDate: string }> = [];

    for (let i = 1; i <= count; i++) {
      const val = i === 1 ? baseAmount + remainder : baseAmount;
      const date = new Date(firstDueDate + 'T12:00:00');

      if (intervalType === 'weekly') {
        date.setDate(date.getDate() + (i - 1) * 7);
      } else if (intervalType === 'biweekly') {
        date.setDate(date.getDate() + (i - 1) * 14);
      } else if (intervalType === 'monthly') {
        date.setMonth(date.getMonth() + (i - 1));
      }

      list.push({
        installmentNumber: i,
        amount: val,
        dueDate: date.toISOString().split('T')[0],
      });
    }

    setPreviewInstallments(list);
  }, [totalAmount, installmentsCount, intervalType, firstDueDate]);

  // Handle editing of an individual preview installment value
  const handleUpdatePreviewItem = (index: number, field: 'amount' | 'dueDate', value: any) => {
    setPreviewInstallments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: field === 'amount' ? Number(value) : value };
      return updated;
    });
  };

  // Check sum of preview installments
  const previewSum = previewInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const sumDifference = totalAmount ? Number((Number(totalAmount) - previewSum).toFixed(2)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!clientName.trim()) {
      setErrorMsg('Informe o nome do cliente.');
      return;
    }

    if (!productDescription.trim()) {
      setErrorMsg('Informe a descrição do produto ou serviço fiado.');
      return;
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      setErrorMsg('Informe um valor total válido para a venda.');
      return;
    }

    if (Math.abs(sumDifference) > 0.05) {
      setErrorMsg(
        `A soma das parcelas (R$ ${previewSum.toFixed(2)}) não confere com o valor total da venda (R$ ${Number(totalAmount).toFixed(2)}). Ajuste os valores.`
      );
      return;
    }

    setIsSubmitting(true);
    const trimmedNotes = notes.trim();
    try {
      const result = await createSale(
        {
          clientId: selectedClientId || undefined,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          productDescription: productDescription.trim(),
          totalAmount: Number(totalAmount),
          installmentsCount: Number(installmentsCount),
          intervalType,
          firstDueDate,
          notes: trimmedNotes,
          observation: trimmedNotes,
          observacao: trimmedNotes,
        },
        previewInstallments
      );

      // Successfully saved to Firestore -> clear draft
      clearDraft();
      onSuccess(result.saleId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao cadastrar venda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 lg:pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
            Cadastrar Nova Venda Fiada
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Preencha os dados da venda. Cada parcela será gerada como um registro individual.
          </p>
        </div>
      </div>

      {/* Draft Recovery Notification Banner */}
      {hasDraft && draftBannerVisible && draftValues && (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                Rascunho de venda em andamento encontrado
              </p>
              <p className="text-xs text-slate-500">
                Você possui dados salvos automaticamente que ainda não foram gravados. Deseja recuperá-los?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              Restaurar Rascunho
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer Identification */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-brand-navy text-white">
              <Users className="w-5 h-5 text-brand-gold" />
            </div>
            <h3 className="text-base font-bold text-brand-navy">1. Identificação do Cliente</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Existing client picker */}
            {clients.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selecionar Cliente Cadastrado (Opcional)
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
                >
                  <option value="">+ Digitar novo cliente ou selecionar da lista...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome do Cliente <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: João da Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp <span className="text-slate-400 font-normal">(para avisos de cobrança)</span>
              </label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Sale & Product Details */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-brand-turquoise text-white">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-brand-navy">2. Detalhes da Venda</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descrição do Produto ou Serviço <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 2 Calças Jeans + 1 Perfume"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Total da Venda (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-extrabold text-slate-400">R$</span>
                  <CurrencyInput
                    required
                    placeholder="0,00"
                    value={totalAmount}
                    onChange={(val) => setTotalAmount(val)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantidade de Parcelas
                </label>
                <select
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-brand-navy focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition bg-white"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      {num}x {totalAmount && num > 0 ? `(${formatCurrency(Number(totalAmount) / num)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Periodicidade
                </label>
                <select
                  value={intervalType}
                  onChange={(e) => setIntervalType(e.target.value as InstallmentInterval)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition bg-white font-medium"
                >
                  <option value="monthly">Mensal (a cada 30 dias)</option>
                  <option value="biweekly">Quinzenal (a cada 15 dias)</option>
                  <option value="weekly">Semanal (a cada 7 dias)</option>
                  <option value="custom">Personalizado (datas livres)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primeiro Vencimento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition font-medium"
                />
              </div>

              <div>
                <label
                  htmlFor="sale-observation"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Observações adicionais (opcional)
                </label>
                <input
                  id="sale-observation"
                  name="observation"
                  type="text"
                  placeholder="Ex: Entregue em mãos, combinar retirada"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Interactive Installments Preview & Individual Customization */}
        {previewInstallments.length > 0 && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-gold text-slate-900">
                  <DollarSign className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-navy">
                    3. Detalhamento Individual das Parcelas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Você pode alterar os valores e vencimentos específicos de cada parcela antes de salvar.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500">Soma das Parcelas: </span>
                <span
                  className={`text-sm font-black ${
                    Math.abs(sumDifference) > 0.05 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(previewSum)}
                </span>
                {Math.abs(sumDifference) > 0.05 && (
                  <p className="text-[11px] font-bold text-rose-500">
                    Diferença: {formatCurrency(sumDifference)}
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Parcela</th>
                    <th className="py-2.5 px-3">Data de Vencimento</th>
                    <th className="py-2.5 px-3">Valor da Parcela (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewInstallments.map((inst, index) => (
                    <tr key={index} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-bold text-brand-navy">
                        Parcela {inst.installmentNumber}/{installmentsCount}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => handleUpdatePreviewItem(index, 'dueDate', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative max-w-[140px]">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">R$</span>
                          <CurrencyInput
                            value={inst.amount}
                            onChange={(val) => handleUpdatePreviewItem(index, 'amount', val === '' ? 0 : val)}
                            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:border-brand-blue outline-none"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 keyboard-safe-bottom">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || Math.abs(sumDifference) > 0.05}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-navy to-brand-blue hover:from-brand-navy-light hover:to-brand-blue-hover text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Gravando Venda...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-brand-gold" />
                <span>Confirmar e Gerar Parcelas</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
