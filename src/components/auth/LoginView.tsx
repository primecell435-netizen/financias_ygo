/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  CreditCard,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  X,
  Mail,
  RefreshCw,
} from 'lucide-react';
import {
  loginWithIdentifier,
  resetAdminPassword,
  parseFirebaseAuthError,
  FirebaseAuthErrorDetails,
  AppAuthError,
} from '../../services/authService';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setErrorMessage('Informe seu nome de login e senha para acessar.');
      return;
    }

    setLoading(true);
    try {
      await loginWithIdentifier(cleanIdentifier, password);
      onLoginSuccess();
    } catch (err: any) {
      if (err instanceof AppAuthError) {
        setErrorMessage(err.details.userFriendlyMessage);
      } else {
        const details = parseFirebaseAuthError(err);
        setErrorMessage(details.userFriendlyMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setResetFeedback({
        type: 'error',
        text: 'Informe um e-mail válido para receber o link de recuperação de senha.',
      });
      return;
    }

    setResetLoading(true);
    try {
      await resetAdminPassword(resetEmail.trim());
      setResetFeedback({
        type: 'success',
        text: 'E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada e pasta de spam.',
      });
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetFeedback(null);
      }, 3500);
    } catch (err: any) {
      setResetFeedback({
        type: 'error',
        text: err?.details?.userFriendlyMessage || err.message || 'Erro ao enviar e-mail de recuperação.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative overflow-hidden">
      {/* Subtle Background Ambience */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-600/20 mb-2">
            <CreditCard className="w-8 h-8 text-amber-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            MEU FINANCEIRO
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-indigo-600 tracking-wide uppercase">
            Controle de Contas e Vendas Fiadas
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Acesso ao Sistema</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Digite seu usuário e senha para entrar
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo 1: Nome de Login */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome de Login
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Nome de login ou e-mail"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-hidden transition font-medium"
                />
              </div>
            </div>

            {/* Campo 2: Senha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(identifier.includes('@') ? identifier : '');
                    setIsResetModalOpen(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-hidden transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-md shadow-indigo-600/20 hover:shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Meu Financeiro &copy; {new Date().getFullYear()} &bull; Todos os direitos reservados
        </p>
      </div>

      {/* Modal: Redefinição de Senha */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Mail className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Recuperar Senha</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Informe o e-mail cadastrado do administrador para enviarmos um link oficial de redefinição de senha.
            </p>

            {resetFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  resetFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {resetFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <span className="leading-relaxed">{resetFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail do Administrador
                </label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@gmail.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-hidden transition font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
