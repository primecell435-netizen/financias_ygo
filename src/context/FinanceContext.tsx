/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Client,
  Sale,
  Installment,
  InstallmentAuditEntry,
  PaymentRecord,
  FinancialNote,
  UserSettings,
  FinancialSummary,
  InstallmentInterval,
  PaymentMethod,
  SystemUser,
} from '../types/finance';
import { computeInstallmentStatus, getTodayDateString } from '../utils/formatters';
import { AUTHORIZED_ADMIN_UID, auth } from '../services/firebase';
import {
  subscribeToAuth,
  logoutAdmin,
  createSystemUser as authCreateUser,
  listSystemUsers,
  toggleSystemUserStatus as authToggleStatus,
  deleteSystemUser as authDeleteUser,
} from '../services/authService';
import {
  subscribeCollection,
  subscribeUserSettings,
  saveDocument,
  deleteDocument,
  createSaleWithInstallments,
  deleteSaleWithAssociated,
  saveUserSettings,
  migrateLocalDataToCloud,
  SyncStatusType,
} from '../services/firestoreService';

interface FinanceContextType {
  // Authentication & Users
  currentUser: User | null;
  isAdminAuthorized: boolean;
  isMasterAdmin: boolean;
  userRole: 'admin' | 'operator' | null;
  operatorProfile: SystemUser | null;
  isAuthLoading: boolean;
  logout: () => Promise<void>;

  // Operator Management (Master Admin only)
  systemUsers: SystemUser[];
  createSystemUser: (username: string, password: string) => Promise<{ uid: string; username: string }>;
  toggleSystemUserStatus: (uid: string, username: string, isActive: boolean) => Promise<void>;
  deleteSystemUser: (uid: string, username: string) => Promise<void>;
  refreshSystemUsers: () => Promise<void>;

  // Sync state
  syncStatus: SyncStatusType;
  lastSyncedAt: Date | null;
  syncErrorMessage: string | null;
  pendingSyncCount: number;

  // Data
  clients: Client[];
  sales: Sale[];
  installments: Installment[];
  payments: PaymentRecord[];
  notes: FinancialNote[];
  settings: UserSettings;
  summary: FinancialSummary;

  // Actions - Sales & Installments
  createSale: (
    saleData: {
      clientId?: string;
      clientName: string;
      clientPhone: string;
      productDescription: string;
      totalAmount: number;
      installmentsCount: number;
      intervalType: InstallmentInterval;
      firstDueDate: string;
      notes?: string;
      observation?: string;
      observacao?: string;
    },
    customInstallments?: Array<{
      installmentNumber: number;
      amount: number;
      dueDate: string;
      notes?: string;
      observation?: string;
      observacao?: string;
    }>
  ) => Promise<{ saleId: string; installmentsCreated: number }>;

  registerPayment: (params: {
    installmentId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate?: string;
    notes?: string;
    postPaymentAction?: 'keep_open' | 'transfer_next' | 'transfer_date' | 'split';
    targetDueDate?: string;
    targetInstallmentId?: string;
    splitCount?: number;
    splitIntervalDays?: number;
  }) => Promise<{ success: boolean; message: string; paymentId?: string }>;

  transferRemainingBalance: (params: {
    installmentId: string;
    mode: 'next' | 'custom_date';
    targetDueDate?: string;
    targetInstallmentId?: string;
    notes?: string;
  }) => Promise<{ success: boolean; message: string }>;

  splitRemainingBalance: (params: {
    installmentId: string;
    numberOfSplits: number;
    intervalDays: number;
    notes?: string;
  }) => Promise<{ success: boolean; message: string }>;

  updateInstallment: (params: {
    installmentId: string;
    newAmount?: number;
    newDueDate?: string;
    reason: string;
  }) => Promise<{ success: boolean; message: string }>;

  deleteSale: (saleId: string) => Promise<{ success: boolean; message: string }>;

  // Actions - Clients
  createClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<Client>;
  updateClient: (id: string, clientData: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<{ success: boolean; message: string }>;

  // Actions - Notes & Agenda
  createNote: (noteData: Omit<FinancialNote, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<FinancialNote>;
  toggleNote: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Actions - Settings & Data Management
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (jsonString: string) => Promise<{ success: boolean; message: string }>;
  migrateLocalData: () => Promise<{ success: boolean; migratedCount: number; message: string }>;
  clearAllData: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  businessName: 'Meu Estabelecimento',
  ownerName: 'Administrador',
  phone: '',
  pixKey: '',
  pixKeyType: 'chave_aleatoria' as any,
  receiptFooterMessage: 'Obrigado pela preferência e pontualidade!',
  enableSoundAlerts: true,
  userId: AUTHORIZED_ADMIN_UID,
};

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'admin' | 'operator' | null>(null);
  const [operatorProfile, setOperatorProfile] = useState<SystemUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // System Users Management (Operators registered by Master Admin)
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  // Sync state with Cloud Firestore
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Financial Data Collections
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  const isMasterAdmin = currentUser?.uid === AUTHORIZED_ADMIN_UID;
  // All business financial data is anchored to the master company account UID
  const activeUid = AUTHORIZED_ADMIN_UID;

  // Refresh operators list
  const refreshSystemUsers = useCallback(async () => {
    if (currentUser?.uid === AUTHORIZED_ADMIN_UID) {
      try {
        const users = await listSystemUsers(AUTHORIZED_ADMIN_UID);
        setSystemUsers(users);
      } catch (err) {
        console.error('Erro ao listar usuários operadores:', err);
      }
    } else {
      setSystemUsers([]);
    }
  }, [currentUser]);

  // Create operator user
  const createSystemUser = useCallback(
    async (username: string, password: string) => {
      const res = await authCreateUser(username, password, AUTHORIZED_ADMIN_UID);
      await refreshSystemUsers();
      return res;
    },
    [refreshSystemUsers]
  );

  // Toggle operator active/inactive
  const toggleSystemUserStatus = useCallback(
    async (uid: string, username: string, isActive: boolean) => {
      await authToggleStatus(uid, username, isActive, AUTHORIZED_ADMIN_UID);
      await refreshSystemUsers();
    },
    [refreshSystemUsers]
  );

  // Delete operator user
  const deleteSystemUser = useCallback(
    async (uid: string, username: string) => {
      await authDeleteUser(uid, username, AUTHORIZED_ADMIN_UID);
      await refreshSystemUsers();
    },
    [refreshSystemUsers]
  );

  // 1. Subscribe to Firebase Authentication
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = subscribeToAuth((user, isAuthorized, role, opProfile) => {
      setCurrentUser(user);
      setIsAdminAuthorized(isAuthorized);
      setUserRole(role);
      setOperatorProfile(opProfile || null);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch operators when master admin is authenticated
  useEffect(() => {
    if (currentUser?.uid === AUTHORIZED_ADMIN_UID) {
      refreshSystemUsers();
    } else {
      setSystemUsers([]);
    }
  }, [currentUser, refreshSystemUsers]);

  // Monitor online / offline network state
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('synced'), 1200);
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Real-time Firestore Listeners (only attach when authorized admin is logged in)
  useEffect(() => {
    if (!currentUser || !isAdminAuthorized) {
      setClients([]);
      setSales([]);
      setInstallments([]);
      setPayments([]);
      setNotes([]);
      return;
    }

    setSyncStatus('syncing');

    // Subscribe to Clients
    const unsubClients = subscribeCollection<Client>(
      'clients',
      (items, metadata) => {
        setClients(items);
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    // Subscribe to Sales
    const unsubSales = subscribeCollection<Sale>(
      'sales',
      (items, metadata) => {
        setSales(items);
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    // Subscribe to Installments
    const unsubInstallments = subscribeCollection<Installment>(
      'installments',
      (items, metadata) => {
        setInstallments(items);
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    // Subscribe to Payments
    const unsubPayments = subscribeCollection<PaymentRecord>(
      'payments',
      (items, metadata) => {
        setPayments(items);
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    // Subscribe to Notes
    const unsubNotes = subscribeCollection<FinancialNote>(
      'notes',
      (items, metadata) => {
        setNotes(items);
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    // Subscribe to Settings
    const unsubSettings = subscribeUserSettings(
      (savedSettings, metadata) => {
        if (savedSettings) {
          setSettings(savedSettings);
        }
        if (metadata.hasPendingWrites) {
          setSyncStatus('pending');
        } else if (!metadata.fromCache) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncErrorMessage(err.message);
      },
      activeUid
    );

    return () => {
      unsubClients();
      unsubSales();
      unsubInstallments();
      unsubPayments();
      unsubNotes();
      unsubSettings();
    };
  }, [currentUser, isAdminAuthorized, activeUid]);

  // Recalculate summary strictly from real numbers
  const summary: FinancialSummary = useMemo(() => {
    let totalReceivable = 0;
    let totalReceived = 0;
    let totalOverdue = 0;
    let totalPending = 0;
    let totalDueToday = 0;
    let totalDueNext7Days = 0;
    let countOverdueInstallments = 0;
    let countPendingInstallments = 0;

    for (const p of payments) {
      totalReceived += p.amount;
    }

    for (const inst of installments) {
      if (inst.isTransferred) continue; // Skip transferred origin records

      const { status, isOverdue, daysDiff } = computeInstallmentStatus(
        inst.dueDate,
        inst.paidAmount,
        inst.currentAmount
      );

      if (status !== 'paid') {
        const remaining = Math.max(0, inst.remainingAmount);
        totalReceivable += remaining;
        countPendingInstallments += 1;

        if (isOverdue) {
          totalOverdue += remaining;
          countOverdueInstallments += 1;
        } else {
          totalPending += remaining;
        }

        if (daysDiff === 0) {
          totalDueToday += remaining;
        } else if (daysDiff > 0 && daysDiff <= 7) {
          totalDueNext7Days += remaining;
        }
      }
    }

    const countActiveSales = sales.filter((s) => s.status === 'active').length;

    return {
      totalReceivable,
      totalReceived,
      totalOverdue,
      totalPending,
      totalDueToday,
      totalDueNext7Days,
      countActiveSales,
      countClients: clients.length,
      countOverdueInstallments,
      countPendingInstallments,
    };
  }, [installments, payments, sales, clients]);

  // Client actions -> sync with Cloud Firestore
  const createClient = useCallback(
    async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Client> => {
      const now = new Date().toISOString();
      const newClient: Client = {
        ...clientData,
        id: `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        userId: activeUid,
      };

      setSyncStatus('pending');
      await saveDocument('clients', newClient.id, newClient, activeUid);
      return newClient;
    },
    [activeUid]
  );

  const updateClient = useCallback(
    async (id: string, clientData: Partial<Client>): Promise<boolean> => {
      setSyncStatus('pending');
      await saveDocument('clients', id, clientData, activeUid);
      return true;
    },
    [activeUid]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<{ success: boolean; message: string }> => {
      const hasActiveInstallments = installments.some(
        (inst) => inst.clientId === id && inst.status !== 'paid' && !inst.isTransferred
      );
      if (hasActiveInstallments) {
        return {
          success: false,
          message: 'Não é possível excluir o cliente enquanto houver parcelas em aberto vinculadas.',
        };
      }

      setSyncStatus('pending');
      await deleteDocument('clients', id, activeUid);
      return { success: true, message: 'Cliente excluído com sucesso.' };
    },
    [installments, activeUid]
  );

  // Create Sale & Individual Installments with Atomic Batch commit to Cloud Firestore
  const createSale = useCallback(
    async (
      saleData: {
        clientId?: string;
        clientName: string;
        clientPhone: string;
        productDescription: string;
        totalAmount: number;
        installmentsCount: number;
        intervalType: InstallmentInterval;
        firstDueDate: string;
        notes?: string;
        observation?: string;
        observacao?: string;
      },
      customInstallments?: Array<{
        installmentNumber: number;
        amount: number;
        dueDate: string;
        notes?: string;
        observation?: string;
        observacao?: string;
      }>
    ): Promise<{ saleId: string; installmentsCreated: number }> => {
      const now = new Date().toISOString();
      const saleId = `venda_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Resolve or create client
      let targetClientId = saleData.clientId;
      if (!targetClientId) {
        const existingClient = clients.find(
          (c) => c.name.toLowerCase().trim() === saleData.clientName.toLowerCase().trim()
        );
        if (existingClient) {
          targetClientId = existingClient.id;
        } else {
          const created = await createClient({
            name: saleData.clientName.trim(),
            phone: saleData.clientPhone.trim(),
            notes: `Criado a partir da venda: ${saleData.productDescription}`,
            observation: `Criado a partir da venda: ${saleData.productDescription}`,
          });
          targetClientId = created.id;
        }
      }

      // Normalize observation / notes from all possible property names
      const rawNotes =
        (saleData as any).notes ??
        (saleData as any).observation ??
        (saleData as any).observacao ??
        (saleData as any).obs ??
        '';
      const cleanNotes =
        typeof rawNotes === 'string'
          ? rawNotes.trim()
          : (rawNotes !== null && rawNotes !== undefined ? String(rawNotes).trim() : '');

      const newSale: Sale = {
        id: saleId,
        clientId: targetClientId,
        clientName: saleData.clientName.trim(),
        clientPhone: saleData.clientPhone.trim(),
        productDescription: saleData.productDescription.trim(),
        totalAmount: saleData.totalAmount,
        installmentsCount: saleData.installmentsCount,
        intervalType: saleData.intervalType,
        firstDueDate: saleData.firstDueDate,
        notes: cleanNotes || undefined,
        observation: cleanNotes || undefined,
        observacao: cleanNotes || undefined,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        userId: activeUid,
      };

      const newInstallments: Installment[] = [];

      if (customInstallments && customInstallments.length > 0) {
        customInstallments.forEach((inst, index) => {
          const instId = `parc_${saleId}_${index + 1}`;
          const amount = inst.amount;
          const { status, isOverdue } = computeInstallmentStatus(inst.dueDate, 0, amount);

          // Inherit sale notes if installment does not have its own specific notes
          const rawInstNotes =
            (inst as any).notes ??
            (inst as any).observation ??
            (inst as any).observacao ??
            cleanNotes;
          const instCleanNotes =
            typeof rawInstNotes === 'string'
              ? rawInstNotes.trim()
              : (rawInstNotes !== null && rawInstNotes !== undefined ? String(rawInstNotes).trim() : '');

          newInstallments.push({
            id: instId,
            saleId,
            clientId: targetClientId!,
            clientName: saleData.clientName.trim(),
            clientPhone: saleData.clientPhone.trim(),
            installmentNumber: inst.installmentNumber || index + 1,
            totalInstallments: saleData.installmentsCount,
            productDescription: saleData.productDescription.trim(),
            originalAmount: amount,
            currentAmount: amount,
            paidAmount: 0,
            remainingAmount: amount,
            dueDate: inst.dueDate,
            status,
            isOverdue,
            payments: [],
            history: [
              {
                id: `hist_${Date.now()}_${index}`,
                timestamp: now,
                action: 'created',
                description: `Parcela ${index + 1}/${saleData.installmentsCount} criada com valor de R$ ${amount.toFixed(2)}.`,
                amountAffected: amount,
                userNote: instCleanNotes || undefined,
              },
            ],
            notes: instCleanNotes || undefined,
            observation: instCleanNotes || undefined,
            observacao: instCleanNotes || undefined,
            createdAt: now,
            updatedAt: now,
            userId: activeUid,
          });
        });
      } else {
        const baseAmount = Number((saleData.totalAmount / saleData.installmentsCount).toFixed(2));
        const remainder = Number((saleData.totalAmount - baseAmount * saleData.installmentsCount).toFixed(2));

        for (let i = 1; i <= saleData.installmentsCount; i++) {
          const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
          const instId = `parc_${saleId}_${i}`;

          const baseDate = new Date(saleData.firstDueDate + 'T12:00:00');
          if (saleData.intervalType === 'weekly') {
            baseDate.setDate(baseDate.getDate() + (i - 1) * 7);
          } else if (saleData.intervalType === 'biweekly') {
            baseDate.setDate(baseDate.getDate() + (i - 1) * 14);
          } else {
            baseDate.setMonth(baseDate.getMonth() + (i - 1));
          }

          const dueDateStr = baseDate.toISOString().split('T')[0];
          const { status, isOverdue } = computeInstallmentStatus(dueDateStr, 0, installmentAmount);

          newInstallments.push({
            id: instId,
            saleId,
            clientId: targetClientId!,
            clientName: saleData.clientName.trim(),
            clientPhone: saleData.clientPhone.trim(),
            installmentNumber: i,
            totalInstallments: saleData.installmentsCount,
            productDescription: saleData.productDescription.trim(),
            originalAmount: installmentAmount,
            currentAmount: installmentAmount,
            paidAmount: 0,
            remainingAmount: installmentAmount,
            dueDate: dueDateStr,
            status,
            isOverdue,
            payments: [],
            history: [
              {
                id: `hist_${Date.now()}_${i}`,
                timestamp: now,
                action: 'created',
                description: `Parcela ${i}/${saleData.installmentsCount} criada no valor de R$ ${installmentAmount.toFixed(2)}.`,
                amountAffected: installmentAmount,
                userNote: cleanNotes || undefined,
              },
            ],
            notes: cleanNotes || undefined,
            observation: cleanNotes || undefined,
            observacao: cleanNotes || undefined,
            createdAt: now,
            updatedAt: now,
            userId: activeUid,
          });
        }
      }

      setSyncStatus('pending');
      // Commit atomically to Firestore
      await createSaleWithInstallments(newSale, newInstallments, activeUid);

      return { saleId, installmentsCreated: newInstallments.length };
    },
    [activeUid, clients, createClient]
  );

  // Register Payment (Full or Partial) with Firestore synchronization
  const registerPayment = useCallback(
    async (params: {
      installmentId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      paymentDate?: string;
      notes?: string;
      postPaymentAction?: 'keep_open' | 'transfer_next' | 'transfer_date' | 'split';
      targetDueDate?: string;
      targetInstallmentId?: string;
      splitCount?: number;
      splitIntervalDays?: number;
    }): Promise<{ success: boolean; message: string; paymentId?: string }> => {
      const now = new Date().toISOString();
      const payDate = params.paymentDate || getTodayDateString();

      const targetInst = installments.find((i) => i.id === params.installmentId);
      if (!targetInst) {
        return { success: false, message: 'Parcela não encontrada.' };
      }

      if (targetInst.isTransferred) {
        return { success: false, message: 'Esta parcela foi transferida anteriormente.' };
      }

      if (params.amount <= 0) {
        return { success: false, message: 'O valor do pagamento deve ser maior que zero.' };
      }

      const paymentId = `pgto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newPaidAmount = targetInst.paidAmount + params.amount;
      const newRemaining = Math.max(0, targetInst.currentAmount - newPaidAmount);

      const paymentRecord: PaymentRecord = {
        id: paymentId,
        installmentId: targetInst.id,
        saleId: targetInst.saleId,
        clientId: targetInst.clientId,
        clientName: targetInst.clientName,
        amount: params.amount,
        paymentDate: payDate,
        paymentMethod: params.paymentMethod,
        notes: params.notes,
        createdAt: now,
        userId: activeUid,
      };

      const isFull = newPaidAmount >= targetInst.currentAmount;
      const { status, isOverdue } = computeInstallmentStatus(targetInst.dueDate, newPaidAmount, targetInst.currentAmount);

      const auditEntry: InstallmentAuditEntry = {
        id: `audit_${Date.now()}`,
        timestamp: now,
        action: isFull ? 'full_payment' : 'partial_payment',
        description: isFull
          ? `Pagamento integral registrado no valor de R$ ${params.amount.toFixed(2)} via ${params.paymentMethod.toUpperCase()}.`
          : `Pagamento parcial de R$ ${params.amount.toFixed(2)} via ${params.paymentMethod.toUpperCase()}. Saldo restante: R$ ${newRemaining.toFixed(2)}.`,
        amountAffected: params.amount,
        userNote: params.notes,
      };

      const updatedTargetInst: Installment = {
        ...targetInst,
        paidAmount: newPaidAmount,
        remainingAmount: newRemaining,
        status,
        isOverdue,
        payments: [...targetInst.payments, paymentRecord],
        history: [...targetInst.history, auditEntry],
        updatedAt: now,
      };

      setSyncStatus('pending');

      // Save Payment Document
      await saveDocument('payments', paymentRecord.id, paymentRecord, activeUid);

      // Handle Post-payment actions on remaining balance
      if (!isFull && newRemaining > 0 && params.postPaymentAction) {
        if (params.postPaymentAction === 'transfer_next') {
          const nextInst = installments.find(
            (i) =>
              i.saleId === targetInst.saleId &&
              i.installmentNumber > targetInst.installmentNumber &&
              i.status !== 'paid' &&
              !i.isTransferred
          );

          if (nextInst) {
            const nextUpdatedAmount = nextInst.currentAmount + newRemaining;
            const nextUpdatedRemaining = nextUpdatedAmount - nextInst.paidAmount;

            const updatedNextInst: Installment = {
              ...nextInst,
              currentAmount: nextUpdatedAmount,
              remainingAmount: nextUpdatedRemaining,
              history: [
                ...nextInst.history,
                {
                  id: `audit_in_${Date.now()}`,
                  timestamp: now,
                  action: 'balance_transferred_in',
                  description: `Saldo de R$ ${newRemaining.toFixed(2)} recebido da parcela ${targetInst.installmentNumber}. Novo valor: R$ ${nextUpdatedAmount.toFixed(2)}.`,
                  amountAffected: newRemaining,
                },
              ],
              updatedAt: now,
            };

            updatedTargetInst.remainingAmount = 0;
            updatedTargetInst.status = 'paid';
            updatedTargetInst.transferredToInstallmentId = nextInst.id;
            updatedTargetInst.history.push({
              id: `audit_out_${Date.now()}`,
              timestamp: now,
              action: 'balance_transferred_out',
              description: `Saldo restante de R$ ${newRemaining.toFixed(2)} transferido para a parcela ${nextInst.installmentNumber}.`,
              amountAffected: newRemaining,
            });

            await saveDocument('installments', updatedNextInst.id, updatedNextInst, activeUid);
          }
        } else if (params.postPaymentAction === 'transfer_date' && params.targetDueDate) {
          const newInstId = `parc_${targetInst.saleId}_transf_${Date.now()}`;
          const transferDueDate = params.targetDueDate;
          const { status: newStatus, isOverdue: newIsOverdue } = computeInstallmentStatus(
            transferDueDate,
            0,
            newRemaining
          );

          const newRescheduledInst: Installment = {
            id: newInstId,
            saleId: targetInst.saleId,
            clientId: targetInst.clientId,
            clientName: targetInst.clientName,
            clientPhone: targetInst.clientPhone,
            installmentNumber: targetInst.installmentNumber,
            totalInstallments: targetInst.totalInstallments,
            productDescription: `${targetInst.productDescription} (Saldo transferido)`,
            originalAmount: newRemaining,
            currentAmount: newRemaining,
            paidAmount: 0,
            remainingAmount: newRemaining,
            dueDate: transferDueDate,
            status: newStatus,
            isOverdue: newIsOverdue,
            payments: [],
            history: [
              {
                id: `audit_new_${Date.now()}`,
                timestamp: now,
                action: 'created',
                description: `Criada por transferência de saldo de R$ ${newRemaining.toFixed(2)} da parcela ${targetInst.installmentNumber}. Vencimento: ${transferDueDate}.`,
                amountAffected: newRemaining,
              },
            ],
            createdAt: now,
            updatedAt: now,
            userId: activeUid,
          };

          updatedTargetInst.remainingAmount = 0;
          updatedTargetInst.status = 'paid';
          updatedTargetInst.transferredToDate = transferDueDate;
          updatedTargetInst.history.push({
            id: `audit_out_${Date.now()}`,
            timestamp: now,
            action: 'balance_transferred_out',
            description: `Saldo de R$ ${newRemaining.toFixed(2)} prorrogado e transferido para nova data: ${transferDueDate}.`,
            amountAffected: newRemaining,
          });

          await saveDocument('installments', newRescheduledInst.id, newRescheduledInst, activeUid);
        }
      }

      // Save Target Installment to Firestore
      await saveDocument('installments', updatedTargetInst.id, updatedTargetInst, activeUid);

      // Check if all installments for this sale are paid
      const saleInstallments = installments.map((i) => (i.id === targetInst.id ? updatedTargetInst : i)).filter((i) => i.saleId === targetInst.saleId);
      const allPaid = saleInstallments.length > 0 && saleInstallments.every((i) => i.status === 'paid');

      if (allPaid) {
        await saveDocument('sales', targetInst.saleId, { status: 'completed' }, activeUid);
      }

      return {
        success: true,
        message: isFull ? 'Pagamento integral registrado no Firebase!' : 'Pagamento parcial registrado no Firebase!',
        paymentId,
      };
    },
    [installments, activeUid]
  );

  // Transfer remaining balance of an installment
  const transferRemainingBalance = useCallback(
    async (params: {
      installmentId: string;
      mode: 'next' | 'custom_date';
      targetDueDate?: string;
      targetInstallmentId?: string;
      notes?: string;
    }): Promise<{ success: boolean; message: string }> => {
      const now = new Date().toISOString();
      const targetInst = installments.find((i) => i.id === params.installmentId);

      if (!targetInst) return { success: false, message: 'Parcela não encontrada.' };
      if (targetInst.remainingAmount <= 0) {
        return { success: false, message: 'Esta parcela não possui saldo em aberto para transferir.' };
      }

      const balanceToTransfer = targetInst.remainingAmount;
      setSyncStatus('pending');

      if (params.mode === 'next') {
        const nextInst = installments.find(
          (i) =>
            i.saleId === targetInst.saleId &&
            i.installmentNumber > targetInst.installmentNumber &&
            i.status !== 'paid' &&
            !i.isTransferred
        );

        if (!nextInst) {
          return {
            success: false,
            message: 'Não há próxima parcela ativa nesta venda. Escolha uma data personalizada.',
          };
        }

        const newAmount = nextInst.currentAmount + balanceToTransfer;
        const newRem = newAmount - nextInst.paidAmount;

        const updatedNextInst: Installment = {
          ...nextInst,
          currentAmount: newAmount,
          remainingAmount: newRem,
          history: [
            ...nextInst.history,
            {
              id: `audit_in_${Date.now()}`,
              timestamp: now,
              action: 'balance_transferred_in',
              description: `Transferência de saldo de R$ ${balanceToTransfer.toFixed(2)} recebida da parcela ${targetInst.installmentNumber}.`,
              amountAffected: balanceToTransfer,
              userNote: params.notes,
            },
          ],
          updatedAt: now,
        };

        const updatedTargetInst: Installment = {
          ...targetInst,
          remainingAmount: 0,
          isTransferred: true,
          transferredToInstallmentId: nextInst.id,
          status: targetInst.paidAmount > 0 ? 'partially_paid' : 'paid',
          history: [
            ...targetInst.history,
            {
              id: `audit_out_${Date.now()}`,
              timestamp: now,
              action: 'balance_transferred_out',
              description: `Saldo de R$ ${balanceToTransfer.toFixed(2)} transferido integralmente para a parcela ${nextInst.installmentNumber}.`,
              amountAffected: balanceToTransfer,
              userNote: params.notes,
            },
          ],
          updatedAt: now,
        };

        await saveDocument('installments', updatedNextInst.id, updatedNextInst, activeUid);
        await saveDocument('installments', updatedTargetInst.id, updatedTargetInst, activeUid);
      } else {
        if (!params.targetDueDate) {
          return { success: false, message: 'Informe a nova data de vencimento.' };
        }

        const newInstId = `parc_${targetInst.saleId}_reag_${Date.now()}`;
        const { status, isOverdue } = computeInstallmentStatus(params.targetDueDate, 0, balanceToTransfer);

        const newInst: Installment = {
          id: newInstId,
          saleId: targetInst.saleId,
          clientId: targetInst.clientId,
          clientName: targetInst.clientName,
          clientPhone: targetInst.clientPhone,
          installmentNumber: targetInst.installmentNumber,
          totalInstallments: targetInst.totalInstallments,
          productDescription: `${targetInst.productDescription} (Reagendamento)`,
          originalAmount: balanceToTransfer,
          currentAmount: balanceToTransfer,
          paidAmount: 0,
          remainingAmount: balanceToTransfer,
          dueDate: params.targetDueDate,
          status,
          isOverdue,
          payments: [],
          history: [
            {
              id: `audit_${Date.now()}`,
              timestamp: now,
              action: 'created',
              description: `Criada a partir de saldo transferido da parcela ${targetInst.installmentNumber}. Vencimento: ${params.targetDueDate}.`,
              amountAffected: balanceToTransfer,
              userNote: params.notes,
            },
          ],
          createdAt: now,
          updatedAt: now,
          userId: activeUid,
        };

        const updatedTargetInst: Installment = {
          ...targetInst,
          remainingAmount: 0,
          isTransferred: true,
          transferredToDate: params.targetDueDate,
          history: [
            ...targetInst.history,
            {
              id: `audit_out_${Date.now()}`,
              timestamp: now,
              action: 'balance_transferred_out',
              description: `Saldo de R$ ${balanceToTransfer.toFixed(2)} transferido para nova data: ${params.targetDueDate}.`,
              amountAffected: balanceToTransfer,
              userNote: params.notes,
            },
          ],
          updatedAt: now,
        };

        await saveDocument('installments', newInst.id, newInst, activeUid);
        await saveDocument('installments', updatedTargetInst.id, updatedTargetInst, activeUid);
      }

      return { success: true, message: 'Saldo transferido e sincronizado com o Firebase!' };
    },
    [installments, activeUid]
  );

  // Split remaining balance into multiple installments
  const splitRemainingBalance = useCallback(
    async (params: {
      installmentId: string;
      numberOfSplits: number;
      intervalDays: number;
      notes?: string;
    }): Promise<{ success: boolean; message: string }> => {
      const now = new Date().toISOString();
      const targetInst = installments.find((i) => i.id === params.installmentId);

      if (!targetInst) return { success: false, message: 'Parcela não encontrada.' };
      if (params.numberOfSplits < 2) return { success: false, message: 'A divisão deve ter pelo menos 2 parcelas.' };
      if (targetInst.remainingAmount <= 0) return { success: false, message: 'Sem saldo restante para dividir.' };

      const balance = targetInst.remainingAmount;
      const baseSplit = Number((balance / params.numberOfSplits).toFixed(2));
      const remainder = Number((balance - baseSplit * params.numberOfSplits).toFixed(2));

      setSyncStatus('pending');

      const baseDate = new Date();
      for (let s = 1; s <= params.numberOfSplits; s++) {
        const splitAmount = s === 1 ? baseSplit + remainder : baseSplit;
        const d = new Date(baseDate);
        d.setDate(d.getDate() + s * params.intervalDays);
        const dueStr = d.toISOString().split('T')[0];

        const { status, isOverdue } = computeInstallmentStatus(dueStr, 0, splitAmount);

        const newSubInst: Installment = {
          id: `parc_${targetInst.saleId}_div_${Date.now()}_${s}`,
          saleId: targetInst.saleId,
          clientId: targetInst.clientId,
          clientName: targetInst.clientName,
          clientPhone: targetInst.clientPhone,
          installmentNumber: targetInst.installmentNumber,
          totalInstallments: targetInst.totalInstallments,
          productDescription: `${targetInst.productDescription} (Sub-parcela ${s}/${params.numberOfSplits})`,
          originalAmount: splitAmount,
          currentAmount: splitAmount,
          paidAmount: 0,
          remainingAmount: splitAmount,
          dueDate: dueStr,
          status,
          isOverdue,
          payments: [],
          history: [
            {
              id: `audit_div_${Date.now()}_${s}`,
              timestamp: now,
              action: 'balance_split',
              description: `Gerada pela divisão do saldo de R$ ${balance.toFixed(2)} em ${params.numberOfSplits}x.`,
              amountAffected: splitAmount,
              userNote: params.notes,
            },
          ],
          createdAt: now,
          updatedAt: now,
          userId: activeUid,
        };

        await saveDocument('installments', newSubInst.id, newSubInst, activeUid);
      }

      const updatedTargetInst: Installment = {
        ...targetInst,
        remainingAmount: 0,
        isTransferred: true,
        history: [
          ...targetInst.history,
          {
            id: `audit_split_out_${Date.now()}`,
            timestamp: now,
            action: 'balance_split',
            description: `Saldo de R$ ${balance.toFixed(2)} foi dividido em ${params.numberOfSplits} novas parcelas com intervalo de ${params.intervalDays} dias.`,
            amountAffected: balance,
            userNote: params.notes,
          },
        ],
        updatedAt: now,
      };

      await saveDocument('installments', updatedTargetInst.id, updatedTargetInst, activeUid);

      return {
        success: true,
        message: `Saldo dividido em ${params.numberOfSplits} parcelas e salvo na nuvem!`,
      };
    },
    [installments, activeUid]
  );

  // Edit Installment Amount or Due Date with audit log
  const updateInstallment = useCallback(
    async (params: {
      installmentId: string;
      newAmount?: number;
      newDueDate?: string;
      reason: string;
    }): Promise<{ success: boolean; message: string }> => {
      const now = new Date().toISOString();
      const targetInst = installments.find((i) => i.id === params.installmentId);

      if (!targetInst) return { success: false, message: 'Parcela não encontrada.' };
      if (!params.reason.trim()) {
        return { success: false, message: 'É obrigatório informar o motivo da alteração no histórico.' };
      }

      const updatedAmount = params.newAmount !== undefined ? params.newAmount : targetInst.currentAmount;
      const updatedDueDate = params.newDueDate || targetInst.dueDate;
      const updatedRemaining = Math.max(0, updatedAmount - targetInst.paidAmount);

      const { status, isOverdue } = computeInstallmentStatus(updatedDueDate, targetInst.paidAmount, updatedAmount);

      const auditEntries: InstallmentAuditEntry[] = [];

      if (params.newAmount !== undefined && params.newAmount !== targetInst.currentAmount) {
        auditEntries.push({
          id: `audit_edit_amt_${Date.now()}`,
          timestamp: now,
          action: 'amount_adjusted',
          description: `Valor alterado de R$ ${targetInst.currentAmount.toFixed(2)} para R$ ${updatedAmount.toFixed(2)}. Motivo: ${params.reason}`,
          previousValue: targetInst.currentAmount,
          newValue: updatedAmount,
        });
      }

      if (params.newDueDate && params.newDueDate !== targetInst.dueDate) {
        auditEntries.push({
          id: `audit_edit_date_${Date.now()}`,
          timestamp: now,
          action: 'due_date_rescheduled',
          description: `Vencimento prorrogado de ${targetInst.dueDate} para ${updatedDueDate}. Motivo: ${params.reason}`,
          previousValue: targetInst.dueDate,
          newValue: updatedDueDate,
        });
      }

      const updatedInst: Installment = {
        ...targetInst,
        currentAmount: updatedAmount,
        remainingAmount: updatedRemaining,
        dueDate: updatedDueDate,
        status,
        isOverdue,
        history: [...targetInst.history, ...auditEntries],
        updatedAt: now,
      };

      setSyncStatus('pending');
      await saveDocument('installments', targetInst.id, updatedInst, activeUid);

      return { success: true, message: 'Parcela atualizada e sincronizada com o Firebase.' };
    },
    [installments, activeUid]
  );

  // Delete sale & related installments atomically from Cloud Firestore
  const deleteSale = useCallback(
    async (saleId: string): Promise<{ success: boolean; message: string }> => {
      setSyncStatus('pending');
      await deleteSaleWithAssociated(saleId, installments, payments, activeUid);
      return { success: true, message: 'Venda e registros associados removidos com sucesso da nuvem.' };
    },
    [installments, payments, activeUid]
  );

  // Notes & Agenda -> Cloud Firestore
  const createNote = useCallback(
    async (noteData: Omit<FinancialNote, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<FinancialNote> => {
      const now = new Date().toISOString();
      const newNote: FinancialNote = {
        ...noteData,
        id: `nota_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        userId: activeUid,
      };

      setSyncStatus('pending');
      await saveDocument('notes', newNote.id, newNote, activeUid);
      return newNote;
    },
    [activeUid]
  );

  const toggleNote = useCallback(
    async (id: string) => {
      const n = notes.find((item) => item.id === id);
      if (n) {
        setSyncStatus('pending');
        await saveDocument('notes', id, { isCompleted: !n.isCompleted }, activeUid);
      }
    },
    [notes, activeUid]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      setSyncStatus('pending');
      await deleteDocument('notes', id, activeUid);
    },
    [activeUid]
  );

  // Settings -> Cloud Firestore
  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      const updated = { ...settings, ...newSettings, userId: activeUid };
      setSyncStatus('pending');
      await saveUserSettings(updated, activeUid);
    },
    [settings, activeUid]
  );

  // Data Migration from LocalStorage to Cloud Firestore
  const migrateLocalData = useCallback(async () => {
    setSyncStatus('syncing');
    const result = await migrateLocalDataToCloud(activeUid);
    if (result.success) {
      setSyncStatus('synced');
    } else {
      setSyncStatus('error');
      setSyncErrorMessage(result.message);
    }
    return result;
  }, [activeUid]);

  // Export JSON Backup
  const exportDatabaseJSON = useCallback((): string => {
    const backup = {
      exportDate: new Date().toISOString(),
      version: '2.0-firebase',
      userId: activeUid,
      data: {
        clients,
        sales,
        installments,
        payments,
        notes,
        settings,
      },
    };
    return JSON.stringify(backup, null, 2);
  }, [clients, sales, installments, payments, notes, settings, activeUid]);

  // Import JSON Backup to Firestore
  const importDatabaseJSON = useCallback(
    async (jsonString: string): Promise<{ success: boolean; message: string }> => {
      try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.data) {
          return { success: false, message: 'Estrutura de arquivo de backup inválida.' };
        }

        setSyncStatus('syncing');

        if (Array.isArray(parsed.data.clients)) {
          for (const c of parsed.data.clients) {
            await saveDocument('clients', c.id, c, activeUid);
          }
        }
        if (Array.isArray(parsed.data.sales)) {
          for (const s of parsed.data.sales) {
            await saveDocument('sales', s.id, s, activeUid);
          }
        }
        if (Array.isArray(parsed.data.installments)) {
          for (const i of parsed.data.installments) {
            await saveDocument('installments', i.id, i, activeUid);
          }
        }
        if (Array.isArray(parsed.data.payments)) {
          for (const p of parsed.data.payments) {
            await saveDocument('payments', p.id, p, activeUid);
          }
        }
        if (Array.isArray(parsed.data.notes)) {
          for (const n of parsed.data.notes) {
            await saveDocument('notes', n.id, n, activeUid);
          }
        }
        if (parsed.data.settings) {
          await saveUserSettings(parsed.data.settings, activeUid);
        }

        setSyncStatus('synced');
        return { success: true, message: 'Dados restaurados com sucesso no Cloud Firestore!' };
      } catch (err: any) {
        setSyncStatus('error');
        return {
          success: false,
          message: `Falha ao importar: ${err.message || 'Arquivo corrompido.'}`,
        };
      }
    },
    [activeUid]
  );

  const clearAllData = useCallback(async () => {
    // Delete in Firestore
    for (const c of clients) await deleteDocument('clients', c.id, activeUid);
    for (const s of sales) await deleteDocument('sales', s.id, activeUid);
    for (const i of installments) await deleteDocument('installments', i.id, activeUid);
    for (const p of payments) await deleteDocument('payments', p.id, activeUid);
    for (const n of notes) await deleteDocument('notes', n.id, activeUid);
  }, [clients, sales, installments, payments, notes, activeUid]);

  const logout = useCallback(async () => {
    await logoutAdmin();
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        currentUser,
        isAdminAuthorized,
        isMasterAdmin,
        userRole,
        operatorProfile,
        isAuthLoading,
        logout,
        systemUsers,
        createSystemUser,
        toggleSystemUserStatus,
        deleteSystemUser,
        refreshSystemUsers,
        syncStatus,
        lastSyncedAt,
        syncErrorMessage,
        pendingSyncCount,
        clients,
        sales,
        installments,
        payments,
        notes,
        settings,
        summary,
        createSale,
        registerPayment,
        transferRemainingBalance,
        splitRemainingBalance,
        updateInstallment,
        deleteSale,
        createClient,
        updateClient,
        deleteClient,
        createNote,
        toggleNote,
        deleteNote,
        updateSettings,
        exportDatabaseJSON,
        importDatabaseJSON,
        migrateLocalData,
        clearAllData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
