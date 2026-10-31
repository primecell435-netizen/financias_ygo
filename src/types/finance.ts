/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InstallmentInterval = 'monthly' | 'weekly' | 'biweekly' | 'custom';

export type InstallmentStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue';

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'outro';

export interface PaymentRecord {
  id: string;
  installmentId: string;
  saleId: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentDate: string; // ISO date YYYY-MM-DD or full timestamp
  paymentMethod: PaymentMethod;
  notes?: string;
  observation?: string;
  observacao?: string;
  createdAt: string;
  userId: string;
}

export interface InstallmentAuditEntry {
  id: string;
  timestamp: string;
  action:
    | 'created'
    | 'partial_payment'
    | 'full_payment'
    | 'balance_transferred_out'
    | 'balance_transferred_in'
    | 'balance_split'
    | 'due_date_rescheduled'
    | 'amount_adjusted'
    | 'note_added';
  description: string;
  amountAffected?: number;
  previousValue?: string | number;
  newValue?: string | number;
  userNote?: string;
}

export interface Installment {
  id: string;
  saleId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  installmentNumber: number;
  totalInstallments: number;
  productDescription: string;
  originalAmount: number;
  currentAmount: number; // After adjustments or received balance transfers
  paidAmount: number;
  remainingAmount: number;
  dueDate: string; // YYYY-MM-DD
  status: InstallmentStatus;
  isOverdue: boolean; // Can be true even if partially_paid!
  payments: PaymentRecord[];
  history: InstallmentAuditEntry[];
  notes?: string;
  observation?: string;
  observacao?: string;
  transferredToInstallmentId?: string;
  transferredToDate?: string;
  isTransferred?: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Sale {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  productDescription: string;
  totalAmount: number;
  installmentsCount: number;
  intervalType: InstallmentInterval;
  firstDueDate: string;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  observation?: string;
  observacao?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  document?: string; // CPF ou RG opcional
  address?: string;
  notes?: string;
  observation?: string;
  observacao?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface FinancialNote {
  id: string;
  title: string;
  content: string;
  type: 'reminder' | 'collection' | 'general' | 'visit';
  targetDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  clientId?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface UserSettings {
  businessName: string;
  ownerName: string;
  phone: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  receiptFooterMessage?: string;
  enableSoundAlerts: boolean;
  userId: string;
}

export interface FinancialSummary {
  totalReceivable: number;
  totalReceived: number;
  totalOverdue: number;
  totalPending: number;
  totalDueToday: number;
  totalDueNext7Days: number;
  countActiveSales: number;
  countClients: number;
  countOverdueInstallments: number;
  countPendingInstallments: number;
}

export interface SystemUser {
  uid: string;
  username: string;
  internalEmail: string;
  role: 'admin' | 'operator';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
