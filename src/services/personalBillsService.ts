/**
 * Cloud Firestore Service for "Minhas Contas" (Personal Finances)
 * STRICTLY ISOLATED from commercial sales, clients, installments, and receipts.
 * Access is restricted exclusively to the Master Admin (AUTHORIZED_ADMIN_UID).
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
  SnapshotMetadata,
} from 'firebase/firestore';
import { db, AUTHORIZED_ADMIN_UID } from './firebase';
import {
  PersonalBill,
  PersonalBillPayment,
  PersonalBillStatus,
  PersonalPaymentMethod,
} from '../types/finance';
import { calculateDaysDifference, getTodayDateString } from '../utils/formatters';

const PERSONAL_BILLS_COLLECTION = 'personal_bills';

export const computePersonalBillStatus = (
  dueDateStr: string,
  paidAmount: number,
  totalAmount: number
): PersonalBillStatus => {
  const daysDiff = calculateDaysDifference(dueDateStr);
  const isPastDue = daysDiff < 0;
  const isFullyPaid = paidAmount >= totalAmount - 0.005 && totalAmount > 0;
  const isPartiallyPaid = paidAmount > 0.005 && paidAmount < totalAmount - 0.005;

  if (isFullyPaid) {
    return 'paid';
  }
  if (isPartiallyPaid) {
    return 'partially_paid';
  }
  if (isPastDue) {
    return 'overdue';
  }
  return 'pending';
};

/**
 * Subscribe to real-time changes in the personal bills collection.
 */
export function subscribePersonalBills(
  onData: (bills: PersonalBill[], metadata: SnapshotMetadata) => void,
  onError: (error: Error) => void,
  adminUid: string = AUTHORIZED_ADMIN_UID
): Unsubscribe {
  const path = `users/${adminUid}/${PERSONAL_BILLS_COLLECTION}`;
  const colRef = collection(db, path);
  const q = query(colRef);

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const items: PersonalBill[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const payments: PersonalBillPayment[] = Array.isArray(data.payments) ? data.payments : [];

        // Sum payments to ensure mathematical integrity
        const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        const amount = Number(data.amount || 0);
        const remaining = Math.max(0, Number((amount - totalPaid).toFixed(2)));
        const status = computePersonalBillStatus(data.dueDate, totalPaid, amount);

        items.push({
          id: d.id,
          name: data.name || '',
          category: data.category || 'Outros',
          amount,
          paidAmount: totalPaid,
          remainingAmount: remaining,
          dueDate: data.dueDate || getTodayDateString(),
          type: data.type || 'fixed',
          recurrence: data.recurrence || 'monthly',
          installmentsCount: data.installmentsCount,
          currentInstallmentNumber: data.currentInstallmentNumber,
          notes: data.notes || '',
          status,
          payments,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          userId: adminUid,
        });
      });

      // Sort by due date ascending
      items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      onData(items, snapshot.metadata);
    },
    (err) => {
      console.error('[PersonalBillsService] Realtime subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Create or update a personal bill.
 */
export async function savePersonalBill(
  bill: Omit<PersonalBill, 'id' | 'paidAmount' | 'remainingAmount' | 'status' | 'payments' | 'createdAt' | 'updatedAt' | 'userId'> & {
    id?: string;
    payments?: PersonalBillPayment[];
    createdAt?: string;
  },
  adminUid: string = AUTHORIZED_ADMIN_UID
): Promise<PersonalBill> {
  const now = new Date().toISOString();
  const billId = bill.id || `conta_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const payments = bill.payments || [];
  const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const remaining = Math.max(0, Number((bill.amount - totalPaid).toFixed(2)));
  const status = computePersonalBillStatus(bill.dueDate, totalPaid, bill.amount);

  const fullBill: PersonalBill = {
    id: billId,
    name: bill.name.trim(),
    category: bill.category.trim() || 'Outros',
    amount: Number(bill.amount.toFixed(2)),
    paidAmount: Number(totalPaid.toFixed(2)),
    remainingAmount: remaining,
    dueDate: bill.dueDate,
    type: bill.type,
    recurrence: bill.recurrence,
    installmentsCount: bill.installmentsCount,
    currentInstallmentNumber: bill.currentInstallmentNumber,
    notes: bill.notes?.trim() || undefined,
    status,
    payments,
    createdAt: bill.createdAt || now,
    updatedAt: now,
    userId: adminUid,
  };

  const docRef = doc(db, `users/${adminUid}/${PERSONAL_BILLS_COLLECTION}`, billId);
  await setDoc(docRef, fullBill);
  return fullBill;
}

/**
 * Delete a personal bill completely.
 */
export async function deletePersonalBill(
  billId: string,
  adminUid: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const docRef = doc(db, `users/${adminUid}/${PERSONAL_BILLS_COLLECTION}`, billId);
  await deleteDoc(docRef);
}

/**
 * Register a payment for a personal bill (full or partial).
 */
export async function registerPersonalBillPayment(
  bill: PersonalBill,
  paymentData: {
    amount: number;
    paymentDate: string;
    paymentMethod: PersonalPaymentMethod;
    notes?: string;
  },
  adminUid: string = AUTHORIZED_ADMIN_UID
): Promise<{ bill: PersonalBill; payment: PersonalBillPayment }> {
  const now = new Date().toISOString();
  const newPayment: PersonalBillPayment = {
    id: `pag_pessoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    billId: bill.id,
    amount: Number(paymentData.amount.toFixed(2)),
    paymentDate: paymentData.paymentDate || getTodayDateString(),
    paymentMethod: paymentData.paymentMethod,
    notes: paymentData.notes?.trim() || undefined,
    createdAt: now,
    userId: adminUid,
  };

  const updatedPayments = [...(bill.payments || []), newPayment];
  const newPaidAmount = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
  const newRemaining = Math.max(0, Number((bill.amount - newPaidAmount).toFixed(2)));
  const newStatus = computePersonalBillStatus(bill.dueDate, newPaidAmount, bill.amount);

  const updatedBill: PersonalBill = {
    ...bill,
    paidAmount: Number(newPaidAmount.toFixed(2)),
    remainingAmount: newRemaining,
    status: newStatus,
    payments: updatedPayments,
    updatedAt: now,
  };

  const docRef = doc(db, `users/${adminUid}/${PERSONAL_BILLS_COLLECTION}`, bill.id);
  await setDoc(docRef, updatedBill);
  return { bill: updatedBill, payment: newPayment };
}

/**
 * Cancel / delete an existing payment for a personal bill.
 */
export async function cancelPersonalBillPayment(
  bill: PersonalBill,
  paymentId: string,
  adminUid: string = AUTHORIZED_ADMIN_UID
): Promise<PersonalBill> {
  const now = new Date().toISOString();
  const updatedPayments = (bill.payments || []).filter((p) => p.id !== paymentId);
  const newPaidAmount = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
  const newRemaining = Math.max(0, Number((bill.amount - newPaidAmount).toFixed(2)));
  const newStatus = computePersonalBillStatus(bill.dueDate, newPaidAmount, bill.amount);

  const updatedBill: PersonalBill = {
    ...bill,
    paidAmount: Number(newPaidAmount.toFixed(2)),
    remainingAmount: newRemaining,
    status: newStatus,
    payments: updatedPayments,
    updatedAt: now,
  };

  const docRef = doc(db, `users/${adminUid}/${PERSONAL_BILLS_COLLECTION}`, bill.id);
  await setDoc(docRef, updatedBill);
  return updatedBill;
}

/**
 * Generate the next occurrence of a recurrent bill without modifying or deleting the current bill.
 */
export async function generateNextRecurrentBill(
  currentBill: PersonalBill,
  adminUid: string = AUTHORIZED_ADMIN_UID
): Promise<PersonalBill> {
  const [yearStr, monthStr, dayStr] = currentBill.dueDate.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(year, month - 1, day);

  if (currentBill.recurrence === 'weekly') {
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (currentBill.recurrence === 'annual') {
    targetDate.setFullYear(targetDate.getFullYear() + 1);
  } else {
    // Default: monthly
    targetDate.setMonth(targetDate.getMonth() + 1);
  }

  const nextDueDate = targetDate.toISOString().split('T')[0];

  let nextInstallmentNumber = currentBill.currentInstallmentNumber;
  if (currentBill.type === 'installment' && typeof nextInstallmentNumber === 'number') {
    nextInstallmentNumber += 1;
  }

  return await savePersonalBill(
    {
      name: currentBill.name,
      category: currentBill.category,
      amount: currentBill.amount,
      dueDate: nextDueDate,
      type: currentBill.type,
      recurrence: currentBill.recurrence,
      installmentsCount: currentBill.installmentsCount,
      currentInstallmentNumber: nextInstallmentNumber,
      notes: currentBill.notes,
    },
    adminUid
  );
}
