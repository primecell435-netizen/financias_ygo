import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Search,
  Calendar,
  Receipt,
  Share2,
  Printer,
  X,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { PaymentRecord } from '../../types/finance';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  generateWhatsAppLink,
} from '../../utils/formatters';

export const PaymentsView: React.FC = () => {
  const { payments, installments, settings, clients } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentRecord | null>(
    null
  );

  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return p.clientName.toLowerCase().includes(q) || p.paymentMethod.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments, searchQuery]);

  const totalFiltered = filteredPayments.reduce((acc, p) => acc + p.amount, 0);

  const formatMethodLabel = (m: string) => {
    switch (m) {
      case 'pix':
        return 'PIX';
      case 'dinheiro':
        return 'Dinheiro em espécie';
      case 'cartao_credito':
        return 'Cartão de Crédito';
      case 'cartao_debito':
        return 'Cartão de Débito';
      case 'transferencia':
        return 'Transferência Bancária';
      default:
        return 'Outro';
    }
  };

  const generateReceiptText = (payment: PaymentRecord) => {
    const inst = installments.find((i) => i.id === payment.installmentId);
    return `*COMPROVANTE DE PAGAMENTO*
----------------------------------------
*Estabelecimento:* ${settings.businessName || 'Meu Financeiro'}
*Cliente:* ${payment.clientName}
*Valor Recebido:* ${formatCurrency(payment.amount)}
*Forma:* ${formatMethodLabel(payment.paymentMethod)}
*Data:* ${formatDate(payment.paymentDate)}
${inst ? `*Referente à:* Parcela ${inst.installmentNumber}/${inst.totalInstallments} (${inst.productDescription})\n*Saldo Restante:* ${formatCurrency(inst.remainingAmount)}` : ''}
${(payment.notes || payment.observation) ? `*Obs:* ${payment.notes || payment.observation}\n` : ''}----------------------------------------
${settings.receiptFooterMessage || 'Obrigado pela preferência e pontualidade!'}`;
  };

  const handleSendReceiptWhatsApp = (payment: PaymentRecord) => {
    const cli = clients.find((c) => c.id === payment.clientId);
    const phone = cli ? cli.phone : '';
    const text = generateReceiptText(payment);
    const url = generateWhatsAppLink(phone, text);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
            Histórico de Pagamentos Recebidos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Registro imutável de todas as baixas, quitações parciais e totais com comprovantes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por cliente ou forma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:border-brand-blue outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Summary metric card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
            Total Entrado ({filteredPayments.length} pagamentos)
          </span>
          <p className="text-2xl lg:text-3xl font-black tracking-tight mt-1">
            {formatCurrency(totalFiltered)}
          </p>
        </div>
        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-200" />
        </div>
      </div>

      {/* Payments list */}
      {filteredPayments.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">Nenhum pagamento registrado ainda</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Assim que você registrar um pagamento total ou parcial em "Contas a Receber", o recibo aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => {
            const inst = installments.find((i) => i.id === payment.installmentId);

            return (
              <div
                key={payment.id}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">
                      {payment.clientName}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {formatMethodLabel(payment.paymentMethod)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Data:{' '}
                    <strong className="text-slate-800">{formatDate(payment.paymentDate)}</strong>{' '}
                    {inst && (
                      <>
                        • Parcela {inst.installmentNumber}/{inst.totalInstallments} (
                        {inst.productDescription})
                      </>
                    )}
                  </p>

                  {(payment.notes || payment.observation) && (
                    <p className="text-[11px] text-slate-500 italic">Obs: "{payment.notes || payment.observation}"</p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Valor Recebido</p>
                    <p className="text-lg font-black text-emerald-600">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedPaymentForReceipt(payment)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      title="Ver Comprovante"
                    >
                      <Receipt className="w-4 h-4 text-brand-navy" />
                    </button>

                    <button
                      onClick={() => handleSendReceiptWhatsApp(payment)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition cursor-pointer"
                      title="Enviar comprovante via WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: COMPROVANTE DE PAGAMENTO */}
      {selectedPaymentForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-brand-navy">Comprovante de Pagamento</h3>
              <button
                onClick={() => setSelectedPaymentForReceipt(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Preview Paper */}
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs space-y-2 font-mono text-slate-800">
              <div className="text-center pb-2 border-b border-slate-200">
                <p className="font-extrabold text-sm">{settings.businessName || 'MEU FINANCEIRO'}</p>
                <p className="text-[10px] text-slate-500">Recibo de Quitação</p>
              </div>

              <div className="space-y-1 pt-1">
                <p>
                  <strong>Cliente:</strong> {selectedPaymentForReceipt.clientName}
                </p>
                <p>
                  <strong>Data:</strong> {formatDate(selectedPaymentForReceipt.paymentDate)}
                </p>
                <p>
                  <strong>Forma:</strong> {formatMethodLabel(selectedPaymentForReceipt.paymentMethod)}
                </p>
                <p className="text-sm font-black text-emerald-700 pt-1">
                  VALOR PAGO: {formatCurrency(selectedPaymentForReceipt.amount)}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                {settings.receiptFooterMessage || 'Obrigado pela preferência e pontualidade!'}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleSendReceiptWhatsApp(selectedPaymentForReceipt)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                onClick={() => window.print()}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Imprimir"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
