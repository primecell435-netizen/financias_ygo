/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { SystemUser } from '../../types/finance';

export const UsersManagementView: React.FC = () => {
  const {
    isMasterAdmin,
    systemUsers,
    createSystemUser,
    toggleSystemUserStatus,
    deleteSystemUser,
    refreshSystemUsers,
  } = useFinance();

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Status/Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // If not master admin, display access denied
  if (!isMasterAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/60 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso Restrito ao Administrador
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            O gerenciamento de usuários e operadores do sistema é exclusivo do Administrador Principal.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    resetForm();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setFormError('Informe o nome de login do operador.');
      return;
    }

    if (cleanUsername.length < 3) {
      setFormError('O nome de login deve ter no mínimo 3 caracteres.');
      return;
    }

    if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
      setFormError('O nome de login deve conter apenas letras minúsculas, números, ponto, traço ou sublinhado.');
      return;
    }

    if (!password) {
      setFormError('Defina uma senha para o usuário.');
      return;
    }

    if (password.length < 6) {
      setFormError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSystemUser(cleanUsername, password);
      setFormSuccess(`Operador "${cleanUsername}" cadastrado com sucesso!`);
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar operador. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: SystemUser) => {
    setActionLoadingId(user.uid);
    try {
      await toggleSystemUserStatus(user.uid, user.username, !user.isActive);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status do operador.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSystemUser(userToDelete.uid, userToDelete.username);
      setUserToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir operador.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Gerenciar Usuários do Sistema
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Cadastre operadores com nome de login e senha para acessar o Meu Financeiro.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshSystemUsers()}
            title="Atualizar lista"
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Novo Operador
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p className="font-semibold text-indigo-950 dark:text-indigo-200">
            Acesso Seguro e Simplificado
          </p>
          <p>
            Os operadores utilizam apenas o <strong>Nome de Login</strong> e a <strong>Senha</strong> cadastrados aqui para entrar no sistema. Suas senhas são protegidas com criptografia de ponta a ponta pelo Firebase Authentication.
          </p>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 dark:text-white text-base">
              Operadores Cadastrados
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {systemUsers.length}
            </span>
          </div>
        </div>

        {systemUsers.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/60 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Users className="w-8 h-8" />
            </div>
            <p className="text-gray-900 dark:text-white font-medium">Nenhum operador cadastrado ainda</p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              Clique no botão "Novo Operador" para criar o primeiro usuário com login e senha.
            </p>
            <button
              onClick={handleOpenModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Cadastrar Primeiro Operador
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {systemUsers.map((user) => {
              const isLoading = actionLoadingId === user.uid;
              return (
                <div
                  key={user.uid}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base transition-colors ${
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-white text-base">
                          {user.username}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                            user.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <UserCheck className="w-3 h-3" /> Ativo
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" /> Inativo
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Cadastrado em:{' '}
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                            : 'Data recente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleToggleStatus(user)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                        user.isActive
                          ? 'border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          : 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      }`}
                      title={user.isActive ? 'Desativar acesso' : 'Ativar acesso'}
                    >
                      {isLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : user.isActive ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Ativar
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserToDelete(user)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Excluir operador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Cadastrar Novo Operador */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden modal-scroll-container">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    Novo Usuário Operador
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Apenas 3 campos para liberar o acesso
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Campo 1: Nome de login */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  1. Nome de Login
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="ex: maria, caixa, atendente1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Sem espaços nem caracteres especiais. Este será o identificador de login.
                </p>
              </div>

              {/* Campo 2: Senha */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Campo 3: Confirmar Senha */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  3. Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a mesma senha novamente"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Salvar Operador
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão de Operador */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-5 border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Excluir Operador?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Tem certeza de que deseja excluir o acesso do operador{' '}
              <strong>"{userToDelete.username}"</strong>? Ele não poderá mais fazer login no sistema.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Confirmar Exclusão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
