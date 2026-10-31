import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Users,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface BottomNavigationProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenMobileMenu: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onNavigate,
}) => {
  const { summary } = useFinance();

  const primaryTabs = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: LayoutDashboard,
    },
    {
      id: 'contas_receber',
      label: 'A Receber',
      icon: Receipt,
      badge: summary.countOverdueInstallments > 0 ? summary.countOverdueInstallments : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'nova_venda',
      label: 'Vender',
      icon: PlusCircle,
      isCenterAction: true,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isCenterAction) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
                aria-label="Cadastrar Nova Venda"
              >
                <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-brand-navy to-brand-blue flex items-center justify-center text-white shadow-lg shadow-brand-navy/30 group-active:scale-95 transition-transform border-4 border-white">
                  <PlusCircle className="w-6 h-6 text-brand-gold" />
                </div>
                <span className="text-[10px] font-bold text-brand-navy mt-0.5">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-colors cursor-pointer ${
                isActive ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-navy stroke-[2.4]' : ''}`} />
                {tab.badge !== null && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
