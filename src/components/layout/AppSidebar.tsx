import React, { useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  Receipt,
  Wallet,
  CalendarCheck,
  Settings,
  X,
  CreditCard,
  Shield,
  LogOut,
  UserCheck,
  Landmark,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface AppSidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const { summary, settings, logout, currentUser, isMasterAdmin, userRole, operatorProfile, systemUsers } = useFinance();
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

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      color: 'text-brand-blue',
    },
    {
      id: 'nova_venda',
      label: 'Nova Venda Fiada',
      icon: PlusCircle,
      badge: null,
      highlight: true,
      color: 'text-brand-gold',
    },
    {
      id: 'contas_receber',
      label: 'Contas a Receber',
      icon: Receipt,
      badge: summary.countOverdueInstallments > 0 ? summary.countOverdueInstallments : null,
      badgeColor: 'bg-rose-500 text-white',
      color: 'text-brand-navy',
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
      badge: summary.countClients > 0 ? summary.countClients : null,
      badgeColor: 'bg-slate-200 text-slate-700',
      color: 'text-brand-turquoise',
    },
    {
      id: 'pagamentos',
      label: 'Pagamentos',
      icon: Wallet,
      badge: null,
      color: 'text-emerald-600',
    },
    {
      id: 'agenda',
      label: 'Anotações e Agenda',
      icon: CalendarCheck,
      badge: null,
      color: 'text-amber-600',
    },
    ...(isMasterAdmin
      ? [
          {
            id: 'minhas_contas',
            label: 'Minhas Contas',
            icon: Landmark,
            badge: null,
            color: 'text-violet-600',
          },
          {
            id: 'usuarios',
            label: 'Usuários do Sistema',
            icon: UserCheck,
            badge: systemUsers.length > 0 ? systemUsers.length : null,
            badgeColor: 'bg-indigo-100 text-indigo-700',
            color: 'text-indigo-600',
          },
        ]
      : []),
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      badge: null,
      color: 'text-slate-500',
    },
  ];

  const handleSelect = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Logo & Title */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-linear-to-b from-brand-navy-light/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-navy flex items-center justify-center text-white shadow-md shadow-brand-navy/20">
            <CreditCard className="w-5 h-5 text-brand-gold" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-brand-navy">
              MEU FINANCEIRO
            </h2>
            <p className="text-[10px] uppercase font-bold tracking-wider text-brand-turquoise">
              Controle de Vendas Fiadas
            </p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navegação Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-navy text-white shadow-sm shadow-brand-navy/30'
                  : item.highlight
                  ? 'bg-brand-blue-light/70 text-brand-navy hover:bg-brand-blue-light border border-brand-blue/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-brand-navy'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-brand-gold' : item.color
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== null && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User identification & Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between px-2 py-2 text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 truncate max-w-[150px]" title={currentUser?.email || ''}>
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate text-xs font-bold text-slate-700">
              {isMasterAdmin
                ? 'Administrador'
                : operatorProfile?.username || (currentUser?.email ? currentUser.email.split('@')[0] : 'Operador')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-white hover:bg-rose-600 px-3 py-1.5 rounded-xl transition cursor-pointer"
            title="Sair da conta de administrador"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Modal In-App de Confirmação de Saída */}
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
