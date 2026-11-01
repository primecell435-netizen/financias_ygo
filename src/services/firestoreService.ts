/**
 * Cloud Firestore Database Service for Meu Financeiro
 * Real-time synchronization, atomic batch operations, and offline support
 * Scoped strictly to the authorized admin UID: Q5ji8a8H8id22G0lRp6iqytg8ty1
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  getDocs,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
  SnapshotMetadata,
} from 'firebase/firestore';
import { db, AUTHORIZED_ADMIN_UID, handleFirestoreError, OperationType } from './firebase';
import {
  Client,
  Sale,
  Installment,
  PaymentRecord,
  FinancialNote,
  UserSettings,
} from '../types/finance';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

// Collection path generator scoped to the user ID
export const getCollectionPath = (collectionName: string, userId: string = AUTHORIZED_ADMIN_UID) => {
  return `users/${userId}/${collectionName}`;
};

// Generic Realtime Collection Listener with metadata tracking (fromCache / hasPendingWrites)
export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onData: (data: T[], metadata: SnapshotMetadata) => void,
  onError: (error: Error) => void,
  userId: string = AUTHORIZED_ADMIN_UID
): Unsubscribe {
  const path = getCollectionPath(collectionName, userId);
  const colRef = collection(db, path);
  const q = query(colRef);

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((d) => {
        const itemData = d.data();
        items.push({
          ...(itemData as T),
          id: d.id,
        });
      });
      onData(items, snapshot.metadata);
    },
    (err) => {
      console.warn(`Erro no listener da coleção ${collectionName}:`, err?.message || err);
      if (onError) {
        onError(err);
      }
    }
  );
}

// Single Document / Settings Listener
export function subscribeUserSettings(
  onData: (settings: UserSettings | null, metadata: SnapshotMetadata) => void,
  onError: (error: Error) => void,
  userId: string = AUTHORIZED_ADMIN_UID
): Unsubscribe {
  const docRef = doc(db, `users/${userId}/settings/profile`);

  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as UserSettings, snapshot.metadata);
      } else {
        onData(null, snapshot.metadata);
      }
    },
    (err) => {
      console.warn('Erro ao ler configurações do usuário:', err?.message || err);
      if (onError) {
        onError(err);
      }
    }
  );
}

/**
 * Recursively removes all undefined properties from objects and arrays,
 * while preserving valid values: 0, false, empty strings, null, Dates, and nested arrays/objects.
 * This guarantees compliance with Cloud Firestore strict rejection of undefined values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (data instanceof Date) {
    return data;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      const sanitized = sanitizeForFirestore(value);
      if (sanitized !== undefined) {
        clean[key] = sanitized;
      }
    }
  }
  return clean as T;
}

// Save or Update a single document
export async function saveDocument<T extends Record<string, any>>(
  collectionName: string,
  docId: string,
  data: T,
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const path = getCollectionPath(collectionName, userId);
  const docRef = doc(db, path, docId);

  const cleanData = sanitizeForFirestore({
    ...data,
    id: docId,
    userId,
    updatedAt: new Date().toISOString(),
  });

  try {
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Erro ao salvar documento em ${path}/${docId}:`, err);
    handleFirestoreError(err, OperationType.WRITE, `${path}/${docId}`);
  }
}

// Delete a single document
export async function deleteDocument(
  collectionName: string,
  docId: string,
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const path = getCollectionPath(collectionName, userId);
  const docRef = doc(db, path, docId);

  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${docId}`);
  }
}

// Atomic Batch: Create Sale and all its individual installments together
export async function createSaleWithInstallments(
  sale: Sale,
  installmentsList: Installment[],
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Sale document - safely sanitized against undefined fields
  const saleDocRef = doc(db, getCollectionPath('sales', userId), sale.id);
  const cleanSale = sanitizeForFirestore({
    ...sale,
    userId,
    updatedAt: new Date().toISOString(),
  });
  batch.set(saleDocRef, cleanSale);

  // 2. Individual installment documents - safely sanitized against undefined fields
  for (const inst of installmentsList) {
    const instDocRef = doc(db, getCollectionPath('installments', userId), inst.id);
    const cleanInst = sanitizeForFirestore({
      ...inst,
      userId,
      updatedAt: new Date().toISOString(),
    });
    batch.set(instDocRef, cleanInst);
  }

  try {
    await batch.commit();
  } catch (err) {
    console.error(`Erro ao gravar lote de venda no Firestore:`, err);
    handleFirestoreError(err, OperationType.WRITE, getCollectionPath('sales', userId));
  }
}

// Atomic Batch: Delete Sale and all its associated installments and payments
export async function deleteSaleWithAssociated(
  saleId: string,
  installmentsList: Installment[],
  paymentsList: PaymentRecord[],
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const batch = writeBatch(db);

  // Delete sale doc
  const saleDocRef = doc(db, getCollectionPath('sales', userId), saleId);
  batch.delete(saleDocRef);

  // Delete matching installments
  const matchingInsts = installmentsList.filter((i) => i.saleId === saleId);
  for (const inst of matchingInsts) {
    batch.delete(doc(db, getCollectionPath('installments', userId), inst.id));
  }

  // Delete matching payments
  const matchingPayments = paymentsList.filter((p) => p.saleId === saleId);
  for (const pay of matchingPayments) {
    batch.delete(doc(db, getCollectionPath('payments', userId), pay.id));
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, getCollectionPath('sales', userId));
  }
}

// Save User Settings
export async function saveUserSettings(
  settingsData: UserSettings,
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<void> {
  const docRef = doc(db, `users/${userId}/settings/profile`);
  const cleanSettings = sanitizeForFirestore({ ...settingsData, userId });
  try {
    await setDoc(docRef, cleanSettings, { merge: true });
  } catch (err) {
    console.error('Erro ao salvar configurações do usuário no Firestore:', err);
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/settings/profile`);
  }
}

// Careful Non-Destructive Data Migration from LocalStorage to Cloud Firestore
export async function migrateLocalDataToCloud(
  userId: string = AUTHORIZED_ADMIN_UID
): Promise<{
  success: boolean;
  migratedCount: number;
  message: string;
}> {
  try {
    // 1. Read existing local data
    const localClients = localStorage.getItem(`meu_financeiro_clients_${userId}`);
    const localSales = localStorage.getItem(`meu_financeiro_sales_${userId}`);
    const localInsts = localStorage.getItem(`meu_financeiro_installments_${userId}`);
    const localPayments = localStorage.getItem(`meu_financeiro_payments_${userId}`);
    const localNotes = localStorage.getItem(`meu_financeiro_notes_${userId}`);
    const localSettings = localStorage.getItem(`meu_financeiro_settings_${userId}`);

    const clients: Client[] = localClients ? JSON.parse(localClients) : [];
    const sales: Sale[] = localSales ? JSON.parse(localSales) : [];
    const installments: Installment[] = localInsts ? JSON.parse(localInsts) : [];
    const payments: PaymentRecord[] = localPayments ? JSON.parse(localPayments) : [];
    const notes: FinancialNote[] = localNotes ? JSON.parse(localNotes) : [];
    const settings: UserSettings | null = localSettings ? JSON.parse(localSettings) : null;

    const totalToMigrate = clients.length + sales.length + installments.length + payments.length + notes.length;
    if (totalToMigrate === 0 && !settings) {
      return { success: true, migratedCount: 0, message: 'Nenhum dado local precisando de migração.' };
    }

    // 2. Perform a safety local backup copy before writing
    const backupKey = `meu_financeiro_pre_migration_backup_${Date.now()}`;
    localStorage.setItem(
      backupKey,
      JSON.stringify({
        date: new Date().toISOString(),
        userId,
        clients,
        sales,
        installments,
        payments,
        notes,
        settings,
      })
    );

    // 3. Check existing cloud documents to avoid overwriting or duplicating
    const cloudClientsSnap = await getDocs(collection(db, getCollectionPath('clients', userId)));
    const existingClientIds = new Set(cloudClientsSnap.docs.map((d) => d.id));

    const cloudSalesSnap = await getDocs(collection(db, getCollectionPath('sales', userId)));
    const existingSaleIds = new Set(cloudSalesSnap.docs.map((d) => d.id));

    const cloudInstsSnap = await getDocs(collection(db, getCollectionPath('installments', userId)));
    const existingInstIds = new Set(cloudInstsSnap.docs.map((d) => d.id));

    const cloudPaymentsSnap = await getDocs(collection(db, getCollectionPath('payments', userId)));
    const existingPaymentIds = new Set(cloudPaymentsSnap.docs.map((d) => d.id));

    const cloudNotesSnap = await getDocs(collection(db, getCollectionPath('notes', userId)));
    const existingNoteIds = new Set(cloudNotesSnap.docs.map((d) => d.id));

    let countMigrated = 0;
    const batch = writeBatch(db);

    for (const c of clients) {
      if (!existingClientIds.has(c.id)) {
        batch.set(doc(db, getCollectionPath('clients', userId), c.id), sanitizeForFirestore({ ...c, userId }));
        countMigrated++;
      }
    }

    for (const s of sales) {
      if (!existingSaleIds.has(s.id)) {
        batch.set(doc(db, getCollectionPath('sales', userId), s.id), sanitizeForFirestore({ ...s, userId }));
        countMigrated++;
      }
    }

    for (const inst of installments) {
      if (!existingInstIds.has(inst.id)) {
        batch.set(doc(db, getCollectionPath('installments', userId), inst.id), sanitizeForFirestore({ ...inst, userId }));
        countMigrated++;
      }
    }

    for (const p of payments) {
      if (!existingPaymentIds.has(p.id)) {
        batch.set(doc(db, getCollectionPath('payments', userId), p.id), sanitizeForFirestore({ ...p, userId }));
        countMigrated++;
      }
    }

    for (const n of notes) {
      if (!existingNoteIds.has(n.id)) {
        batch.set(doc(db, getCollectionPath('notes', userId), n.id), sanitizeForFirestore({ ...n, userId }));
        countMigrated++;
      }
    }

    if (settings) {
      batch.set(doc(db, `users/${userId}/settings/profile`), sanitizeForFirestore({ ...settings, userId }), { merge: true });
    }

    if (countMigrated > 0 || settings) {
      await batch.commit();
    }

    return {
      success: true,
      migratedCount: countMigrated,
      message: `${countMigrated} registros locais foram sincronizados com segurança no Cloud Firestore!`,
    };
  } catch (err: any) {
    console.error('Erro na migração:', err);
    return {
      success: false,
      migratedCount: 0,
      message: `Erro ao migrar dados: ${err.message || String(err)}`,
    };
  }
}
