import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Receipt,
  Users,
  PlusCircle,
  ArrowRight,
  MessageCircle,
  ShieldAlert,
  Calendar,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  formatCurrency,
  formatDate,
  generateWhatsAppLink,
  calculateDaysDifference,
} from '../../utils/formatters';

interface DashboardViewProps {
  onNavigate: (tab: string, clientId?: string) => void;
  onSelectInstallment?: (installmentId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { summary, installments, sales, clients, settings } = useFinance();

  // Filter urgent installments (overdue + due today + due in 7 days)
  const urgentInstallments = React.useMemo(() => {
    return installments
      .filter((i) => i.status !== 'paid' && !i.isTransferred)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [installments]);

  // Real collection rate (if total volume > 0)
  const totalVolume = summary.totalReceived + summary.totalReceivable;
  const collectionPercentage = totalVolume > 0 ? Math.round((summary.totalReceived / totalVolume) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 lg:pb-6">
      {/* Welcome Banner with Quick Action */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-navy via-brand-navy-light to-brand-blue p-6 lg:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-brand-gold-light border border-white/10">
              <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
              Painel Financeiro em Tempo Real
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
              {settings.businessName || 'Meu Financeiro'}
            </h2>
            <p className="text-slate-200 text-xs sm:text-sm font-normal">
              Controle absoluto de cobranças, parcelamento flexível e vendas fiadas sem perdas.
            </p>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-16 w-64 h-64 rounded-full bg-brand-turquoise/20 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards (Values strictly derived from real data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total a Receber */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              A Receber
            </span>
            <div className="p-2.5 rounded-xl bg-brand-blue-light text-brand-blue">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-brand-navy tracking-tight">
              {formatCurrency(summary.totalReceivable)}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span className="font-semibold text-brand-blue">
                {summary.countPendingInstallments}
              </span>
              <span>parcela(s) em aberto</span>
            </div>
          </div>
        </div>

        {/* Total Recebido */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Recebido
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-600 tracking-tight">
              {formatCurrency(summary.totalReceived)}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span className="font-semibold text-emerald-700">
                {collectionPercentage}%
              </span>
              <span>do volume total quitado</span>
            </div>
          </div>
        </div>

        {/* Total em Atraso (Vermelho) */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Em Atraso
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-600 tracking-tight">
              {formatCurrency(summary.totalOverdue)}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              {summary.countOverdueInstallments > 0 ? (
                <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[11px]">
                  {summary.countOverdueInstallments} vencida(s)
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">Nenhum atraso</span>
              )}
            </div>
          </div>
        </div>

        {/* Vencimentos Hoje & 7 Dias (Amarelo / Dourado) */}
        <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Próximos Vencimentos
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600 tracking-tight">
              {formatCurrency(summary.totalDueToday + summary.totalDueNext7Days)}
            </p>
            <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
              <span>Hoje: <strong>{formatCurrency(summary.totalDueToday)}</strong></span>
              <span>7 dias: <strong>{formatCurrency(summary.totalDueNext7Days)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Quick Stats Bar */}
      {totalVolume > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-800">
              Taxa de Arrecadação Global
            </span>
            <span className="font-extrabold text-brand-navy">
              {formatCurrency(summary.totalReceived)} de {formatCurrency(totalVolume)} ({collectionPercentage}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${collectionPercentage}%` }}
              title={`Recebido: ${collectionPercentage}%`}
            />
            {summary.totalOverdue > 0 && (
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100 - collectionPercentage, Math.round((summary.totalOverdue / totalVolume) * 100))}%`,
                }}
                title="Em atraso"
              />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Recebido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                A Vencer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Vencido
              </span>
            </div>
            <span>{sales.length} vendas cadastradas • {clients.length} clientes</span>
          </div>
        </div>
      )}

      {/* Two Column Layout: Urgent Collections & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Next / Urgent Collections */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-navy" />
              <span>Vencimentos Prioritários</span>
            </h3>
            <button
              onClick={() => onNavigate('contas_receber')}
              className="text-xs font-bold text-brand-blue hover:text-brand-navy flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas as parcelas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {urgentInstallments.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Nenhuma parcela pendente no momento!
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Todas as cobranças estão quitadas ou você ainda não cadastrou uma venda fiada.
              </p>
              <button
                onClick={() => onNavigate('nova_venda')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-light transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-brand-gold" />
                <span>Cadastrar Nova Venda</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {urgentInstallments.map((inst) => {
                const daysDiff = calculateDaysDifference(inst.dueDate);
                const isOverdue = daysDiff < 0;
                const isToday = daysDiff === 0;

                return (
                  <div
                    key={inst.id}
                    className={`p-4 rounded-2xl bg-white border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isOverdue
                        ? 'border-rose-200 hover:border-rose-300'
                        : isToday
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          {inst.clientName}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600">
                          Parcela {inst.installmentNumber}/{inst.totalInstallments}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-100 text-rose-700">
                            Atrasada ({Math.abs(daysDiff)}d)
                          </span>
                        )}
                        {isToday && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-100 text-amber-800">
                            Vence Hoje
                          </span>
                        )}
                        {inst.paidAmount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700">
                            Pago parc.
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {inst.productDescription} • Vencimento: <strong>{formatDate(inst.dueDate)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Saldo a receber</p>
                        <p className="text-base font-black text-brand-navy">
                          {formatCurrency(inst.remainingAmount)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {inst.clientPhone && (
                          <a
                            href={generateWhatsAppLink(
                              inst.clientPhone,
                              `Olá ${inst.clientName}, tudo bem? Passando para lembrar da parcela ${inst.installmentNumber}/${inst.totalInstallments} no valor de ${formatCurrency(inst.remainingAmount)} com vencimento em ${formatDate(inst.dueDate)}.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                            title="Lembrar cobrança no WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          onClick={() => onNavigate('contas_receber', inst.clientId)}
                          className="px-3 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold transition cursor-pointer"
                        >
                          Gerenciar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right (1 col): System Summary & Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-brand-turquoise" />
            <span>Acesso Rápido</span>
          </h3>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <button
              onClick={() => onNavigate('nova_venda')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-brand-blue-light/60 transition group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-navy text-white group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-4 h-4 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Registrar Venda Fiada</p>
                  <p className="text-[11px] text-slate-500">Com parcelas e datas customizadas</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-navy" />
            </button>

            <button
              onClick={() => onNavigate('clientes')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-brand-blue-light/60 transition group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-turquoise text-white group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Gerenciar Clientes</p>
                  <p className="text-[11px] text-slate-500">{clients.length} clientes cadastrados</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-navy" />
            </button>

            <button
              onClick={() => onNavigate('pagamentos')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-brand-blue-light/60 transition group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600 text-white group-hover:scale-105 transition-transform">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Recibos e Pagamentos</p>
                  <p className="text-[11px] text-slate-500">Histórico de quitações e entradas</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-navy" />
            </button>

            <button
              onClick={() => onNavigate('agenda')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-brand-blue-light/60 transition group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-white group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Agenda & Cobranças</p>
                  <p className="text-[11px] text-slate-500">Lembretes de visitas e pagamentos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-navy" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
