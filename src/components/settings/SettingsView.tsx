import React, { useState } from 'react';
import {
  Settings,
  Building,
  Key,
  ShieldCheck,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Smartphone,
  Database,
  Cloud,
  HelpCircle,
  FileText,
  AlertTriangle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  updateAdminEmailAddress,
  TARGET_ADMIN_EMAIL,
  LEGACY_ADMIN_EMAIL,
} from '../../services/authService';
import { AUTHORIZED_ADMIN_UID } from '../../services/firebase';


export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportDatabaseJSON,
    importDatabaseJSON,
    clearAllData,
    currentUser,
    migrateLocalData,
    logout,
    syncStatus,
  } = useFinance();

  const [isMigrating, setIsMigrating] = useState(false);

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [phone, setPhone] = useState(settings.phone);
  const [pixKey, setPixKey] = useState(settings.pixKey || '');
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooterMessage || '');
  const [importJsonText, setImportJsonText] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Email update state
  const [newEmailInput, setNewEmailInput] = useState(TARGET_ADMIN_EMAIL);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailUpdateResult, setEmailUpdateResult] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      pixKey: pixKey.trim(),
      receiptFooterMessage: receiptFooter.trim(),
    });
    showNotification('success', 'Configurações atualizadas com sucesso!');
  };

  const handleExportBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meu-financeiro-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('success', 'Backup exportado com sucesso em arquivo JSON!');
  };

  const handleImportBackup = async () => {
    if (!importJsonText.trim()) return;
    const res = await importDatabaseJSON(importJsonText);
    if (res.success) {
      showNotification('success', res.message);
      setIsImportModalOpen(false);
      setImportJsonText('');
    } else {
      showNotification('error', res.message);
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        'ATENÇÃO: Deseja realmente zerar todos os dados salvos no Cloud Firestore? Esta ação é irreversível.'
      )
    ) {
      await clearAllData();
      showNotification('success', 'Todos os dados foram resetados.');
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateLocalData();
      if (res.success) {
        showNotification('success', res.message);
      } else {
        showNotification('error', res.message);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao migrar dados.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailUpdateResult(null);

    if (!newEmailInput.trim()) {
      setEmailUpdateResult({
        type: 'error',
        title: 'E-mail Obrigatório',
        message: 'Informe o novo e-mail para acesso administrativo.',
      });
      return;
    }

    if (!currentPasswordInput) {
      setEmailUpdateResult({
        type: 'error',
        title: 'Senha Atual Obrigatória',
        message: 'Por segurança do Firebase Authentication, informe sua senha atual para autorizar a alteração.',
      });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const res = await updateAdminEmailAddress(currentPasswordInput, newEmailInput.trim());
      setEmailUpdateResult({
        type: res.status === 'verification_sent' ? 'info' : 'success',
        title:
          res.status === 'verification_sent'
            ? 'Confirmação Enviada pelo Firebase'
            : 'E-mail Atualizado com Sucesso!',
        message: res.message,
      });
      setCurrentPasswordInput('');
      showNotification(
        'success',
        res.status === 'verification_sent'
          ? 'Link de verificação enviado pelo Firebase!'
          : 'E-mail de acesso atualizado com sucesso!'
      );
    } catch (err: any) {
      setEmailUpdateResult({
        type: 'error',
        title: 'Atenção ao alterar e-mail',
        message:
          err?.details?.userFriendlyMessage ||
          err?.message ||
          'Ocorreu um erro ao atualizar o e-mail no Firebase Authentication.',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 lg:pb-8">
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

      {/* Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
          Configurações do Sistema
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Personalize as informações do seu negócio, dados de recibos, PWA e integração Firebase.
        </p>
      </div>

      {/* PWA & Installability Section (Moved to Settings) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-brand-navy text-white">
            <Smartphone className="w-5 h-5 text-brand-gold" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-navy">Instalar no Dispositivo</h3>
            <p className="text-xs text-slate-500">
              Instale o Meu Financeiro no seu celular ou computador para acesso rápido em tela cheia e funcionamento offline.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-blue-light/30 border border-slate-200/80">
          <div className="space-y-1 max-w-lg">
            <p className="text-xs font-bold text-slate-800">Instalação Direta no Navegador</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              O aplicativo será adicionado à sua tela inicial sem consumir armazenamento pesado, abrindo instantaneamente com ícone exclusivo e sem barras do navegador.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-brand-navy">📱 No Android / Chrome / Edge:</p>
            <p className="text-[11px] text-slate-500">
              Clique no botão verde acima ou toque no menu do navegador (três pontos) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-brand-navy">🍏 No iPhone / iPad (Safari):</p>
            <p className="text-[11px] text-slate-500">
              Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) na barra inferior do Safari e escolha <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-brand-blue-light text-brand-blue">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-navy">Dados do Estabelecimento</h3>
            <p className="text-xs text-slate-500">
              Aparecerão nos cabeçalhos de comprovantes e mensagens aos clientes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Estabelecimento / Loja
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome do Administrador / Responsável
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Telefone / WhatsApp Comercial
            </label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Chave PIX para Cobrança (opcional)
            </label>
            <input
              type="text"
              placeholder="CPF, CNPJ, e-mail ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mensagem de Rodapé dos Recibos
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </form>

      {/* Firebase Cloud Synchronization & Security Section */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-turquoise-light text-brand-turquoise">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-navy">Conexão Firebase & Cloud Firestore</h3>
              <p className="text-xs text-slate-500">
                Sincronização em tempo real entre celular e computador com persistência offline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ativo & Conectado</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs text-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Projeto Firebase</span>
              <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">minhas-financias-ygo</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">E-mail do Administrador</span>
              <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{currentUser?.email || 'admin'}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">UID Autorizado</span>
              <p className="font-mono font-semibold text-brand-navy text-[11px] mt-0.5 break-all">
                Q5ji8a8H8id22G0lRp6iqytg8ty1
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200/70">
            <div>
              <p className="font-bold text-slate-800">Migração de Dados Locais Anteriores</p>
              <p className="text-[11px] text-slate-500">
                Transfere com segurança qualquer dado salvo no navegador para o Cloud Firestore sem duplicar.
              </p>
            </div>

            <button
              type="button"
              onClick={handleMigrate}
              disabled={isMigrating}
              className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isMigrating ? 'Migrando para a Nuvem...' : 'Migrar Dados para o Firestore'}
            </button>
          </div>
        </div>
      </div>

      {/* Alteração do E-mail de Acesso do Administrador */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-brand-navy to-brand-blue text-white shadow-sm">
              <Key className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-navy">
                Alteração de E-mail de Acesso (Administrador)
              </h3>
              <p className="text-xs text-slate-500">
                Altere o e-mail cadastrado no Firebase Authentication com total preservação do UID e dados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-brand-blue border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-blue" />
            <span>UID Protegido</span>
          </div>
        </div>

        {/* Informative Guarantee Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong>Garantia de Integridade dos Dados:</strong> O UID permanente do administrador (
              <span className="font-mono text-brand-navy font-bold">{AUTHORIZED_ADMIN_UID}</span>) é preservado.
              Todas as permissões do Cloud Firestore, vendas fiadas, clientes e histórico financeiro continuam 100% seguros e intactos.
            </p>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <Info className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
            <p>
              A troca é realizada através dos recursos oficiais do Firebase Authentication (<span className="font-mono font-semibold">verifyBeforeUpdateEmail</span>).
            </p>
          </div>
        </div>

        {/* Result Feedback Banner */}
        {emailUpdateResult && (
          <div
            className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-2 animate-in fade-in duration-200 ${
              emailUpdateResult.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : emailUpdateResult.type === 'info'
                ? 'bg-sky-50 border-sky-200 text-sky-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {emailUpdateResult.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : emailUpdateResult.type === 'info' ? (
                <Mail className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm">{emailUpdateResult.title}</p>
                <p className="leading-relaxed font-medium">{emailUpdateResult.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Change Email Form */}
        <form onSubmit={handleUpdateEmail} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail Atual Cadastrado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  disabled
                  value={currentUser?.email || LEGACY_ADMIN_EMAIL}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">E-mail registrado atualmente na sessão do Firebase.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Novo E-mail de Acesso Desejado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-blue absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="lojaprimecellfortal@gmail.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-slate-500">Endereço para o novo login.</p>
                {newEmailInput !== TARGET_ADMIN_EMAIL && (
                  <button
                    type="button"
                    onClick={() => setNewEmailInput(TARGET_ADMIN_EMAIL)}
                    className="text-[10px] text-brand-blue font-bold hover:underline cursor-pointer"
                  >
                    Usar: {TARGET_ADMIN_EMAIL}
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Senha Atual do Administrador (Reautenticação de Segurança)
              </label>
              <div className="relative max-w-md">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  placeholder="Digite sua senha atual de administrador"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                O Firebase Authentication exige confirmação da senha para validar alterações no cadastro de segurança.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowConsoleGuide(!showConsoleGuide)}
              className="text-xs text-brand-blue hover:text-brand-navy font-bold flex items-center gap-1.5 cursor-pointer text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Como alterar diretamente no Firebase Console</span>
              {showConsoleGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="submit"
              disabled={isUpdatingEmail}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-navy to-brand-blue hover:from-brand-navy-light hover:to-brand-blue-hover text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdatingEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando no Firebase...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-brand-gold" />
                  <span>Confirmar Alteração de E-mail</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Collapsible Firebase Console Step-by-Step Guide */}
        {showConsoleGuide && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Passo a passo no Console do Firebase (Alternativa Oficial Direta)</span>
            </div>
            <p className="leading-relaxed">
              Se preferir efetuar a troca de e-mail diretamente pelo painel administrativo do Firebase sem necessidade de e-mail de confirmação:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed text-amber-900 font-medium">
              <li>
                Acesse o <strong>Firebase Console</strong> (<span className="font-mono text-amber-950">console.firebase.google.com</span>) e selecione o projeto <strong>minhas-financias-ygo</strong>.
              </li>
              <li>
                No menu lateral esquerdo, clique em <strong>Criação (Build) &gt; Authentication</strong>.
              </li>
              <li>
                Na aba <strong>Usuários (Users)</strong>, localize a linha com o UID:
                <br />
                <code className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-white border border-amber-300 font-mono text-[11px] font-bold text-brand-navy">
                  {AUTHORIZED_ADMIN_UID}
                </code>{' '}
                (e-mail atual: <span className="font-mono text-[11px]">{LEGACY_ADMIN_EMAIL}</span>).
              </li>
              <li>
                Clique no menu de <strong>3 pontinhos (⋮)</strong> no lado direito dessa linha e escolha <strong>"Editar conta"</strong> ou <strong>"Alterar e-mail"</strong>.
              </li>
              <li>
                Altere o endereço para: <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300">{TARGET_ADMIN_EMAIL}</code> e salve.
              </li>
              <li>
                <strong>ATENÇÃO MÁXIMA:</strong> Nunca utilize "Excluir conta" nem "Adicionar usuário". Apenas edite a conta existente para que o UID <code className="font-mono">{AUTHORIZED_ADMIN_UID}</code> seja preservado e nenhum dado financeiro seja perdido.
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Backup & Data Management */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-navy">Segurança e Backup de Dados</h3>
            <p className="text-xs text-slate-500">
              Exporte seus dados em arquivo JSON a qualquer momento para garantir sua cópia de segurança.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-brand-gold" />
            <span>Exportar Backup (JSON)</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4 text-brand-blue" />
            <span>Restaurar Backup</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs sm:text-sm font-bold cursor-pointer ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Zerar Dados</span>
          </button>
        </div>
      </div>

      {/* MODAL IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-brand-navy">Restaurar Dados de Backup</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                X
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Cole o conteúdo do arquivo JSON exportado anteriormente para recuperar suas vendas, parcelas e clientes:
            </p>

            <textarea
              rows={8}
              placeholder='Cole o conteúdo do arquivo JSON aqui...'
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono focus:border-brand-blue outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportBackup}
                className="px-5 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Importar e Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
