/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { OfflineIndicator } from './components/common/OfflineIndicator';

import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { NewSaleView } from './components/sales/NewSaleView';
import { AccountsReceivableView } from './components/installments/AccountsReceivableView';
import { ClientsView } from './components/clients/ClientsView';
import { PaymentsView } from './components/payments/PaymentsView';
import { NotesAgendaView } from './components/notes/NotesAgendaView';
import { SettingsView } from './components/settings/SettingsView';
import { UsersManagementView } from './components/users/UsersManagementView';
import { useKeyboardAdjustment } from './hooks/useKeyboardAdjustment';

function FinanceApp() {
  // Activate automatic virtual keyboard handling and input auto-scroll
  useKeyboardAdjustment();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedReceivableClientId, setSelectedReceivableClientId] = useState<string | null>(null);

  const handleNavigate = (tab: string, clientId?: string | null) => {
    if (tab === 'contas_receber' && clientId) {
      setSelectedReceivableClientId(clientId);
    } else if (tab === 'contas_receber') {
      setSelectedReceivableClientId(null);
    }
    setActiveTab(tab);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={(tab, clientId) => handleNavigate(tab, clientId)}
          />
        );
      case 'nova_venda':
        return (
          <NewSaleView
            onSuccess={() => handleNavigate('contas_receber')}
            onCancel={() => handleNavigate('dashboard')}
          />
        );
      case 'contas_receber':
        return (
          <AccountsReceivableView
            initialClientId={selectedReceivableClientId}
          />
        );
      case 'clientes':
        return (
          <ClientsView
            onNavigateToSale={() => handleNavigate('nova_venda')}
            onNavigateToReceivableClient={(clientId) => handleNavigate('contas_receber', clientId)}
          />
        );
      case 'pagamentos':
        return <PaymentsView />;
      case 'agenda':
        return <NotesAgendaView />;
      case 'usuarios':
        return <UsersManagementView />;
      case 'configuracoes':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={(tab) => handleNavigate(tab)} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans selection:bg-brand-blue-light selection:text-brand-navy">
      {/* Desktop & Mobile Sidebar Drawer */}
      <AppSidebar
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky Header */}
        <AppHeader
          activeTab={activeTab}
          onNavigate={(tab) => setActiveTab(tab)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavigation
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      {/* Connectivity Alert for PWA Offline Mode */}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AuthGatekeeper />
    </FinanceProvider>
  );
}

function AuthGatekeeper() {
  useKeyboardAdjustment();
  const { isAuthLoading, currentUser, isAdminAuthorized } = useFinance();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-navy text-white flex items-center justify-center font-black text-xl shadow-lg shadow-brand-navy/30 animate-pulse">
          F
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-navy border-t-transparent animate-spin" />
          <span>Verificando autenticação segura...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdminAuthorized) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  return <FinanceApp />;
}
