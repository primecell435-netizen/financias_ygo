import React, { useState } from 'react';
import {
  Receipt,
  Menu,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { SyncStatusIndicator } from '../common/SyncStatusIndicator';
import { useFinance } from '../../context/FinanceContext';

interface AppHeaderProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenMobileMenu: () => void;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Visão Geral', subtitle: 'Acompanhamento do fluxo e recebíveis' },
  nova_venda: { title: 'Nova Venda Fiada', subtitle: 'Cadastre venda com parcelamento individual' },
  contas_receber: { title: 'Contas a Receber', subtitle: 'Gestão flexível de parcelas e cobranças' },
  clientes: { title: 'Clientes', subtitle: 'Contatos e histórico financeiro individual' },
  pagamentos: { title: 'Histórico de Pagamentos', subtitle: 'Recibos e entradas confirmadas' },
  agenda: { title: 'Anotações e Agenda', subtitle: 'Lembretes e compromissos de cobrança' },
  minhas_contas: { title: 'Minhas Contas', subtitle: 'Gestão de despesas e compromissos pessoais' },
  usuarios: { title: 'Usuários do Sistema', subtitle: 'Gerenciamento de operadores e permissões' },
  configuracoes: { title: 'Configurações', subtitle: 'Dados do negócio e backup do sistema' },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onNavigate,
  onOpenMobileMenu,
}) => {
  const { settings, summary, syncStatus, lastSyncedAt, syncErrorMessage, pendingSyncCount, logout, currentUser } = useFinance();
  const currentInfo = tabTitles[activeTab] || { title: 'Meu Financeiro', subtitle: '' };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3 transition-all">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Mobile hamburger + Page Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 text-slate-600 hover:text-brand-navy hover:bg-slate-100 rounded-xl transition cursor-pointer"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-black text-brand-navy tracking-tight">
                  {currentInfo.title}
                </h1>
                {summary.countOverdueInstallments > 0 && (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 animate-pulse">
                    {summary.countOverdueInstallments} em atraso
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-slate-500 font-medium">
                {currentInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Right: Sync Indicator, Ver Parcelas, Profile badge, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cloud Firestore Sync Status Indicator */}
            <SyncStatusIndicator
              status={syncStatus}
              lastSyncedAt={lastSyncedAt}
              errorMessage={syncErrorMessage}
              pendingCount={pendingSyncCount}
            />

            {/* Action: Ver Parcelas (substituindo o antigo botão de venda) */}
            <button
              type="button"
              onClick={() => onNavigate('contas_receber')}
              className={`relative z-10 pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-md transition cursor-pointer ${
                activeTab === 'contas_receber'
                  ? 'bg-brand-navy text-white'
                  : 'bg-gradient-to-r from-brand-navy to-brand-blue hover:from-brand-navy-light hover:to-brand-blue-hover text-white'
              }`}
              title="Ir para Contas a Receber / Ver Parcelas"
            >
              <Receipt className="w-4 h-4 text-brand-gold" />
              <span>Ver Parcelas</span>
            </button>

            {/* User / Business Indicator */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {settings.businessName ? settings.businessName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                  {currentUser?.email || settings.businessName || 'Administrador'}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin Autorizado</span>
                </div>
              </div>
            </div>

            {/* Logout Button (Direct in-app trigger) */}
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title="Sair da conta de administrador"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modal In-App de Confirmação de Saída (sem window.confirm) */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-brand-navy">Sair do Sistema</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Deseja realmente encerrar a sessão de administrador do <strong>Meu Financeiro</strong>?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isLoggingOut ? (
                  <span>Saindo...</span>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sim, Sair</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
