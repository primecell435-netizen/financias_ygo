/**
 * Firebase Modular SDK Setup for Meu Financeiro
 * Configured with the user's specific Firebase project: minhas-financias-ygo
 * Single Authorized Admin UID: Q5ji8a8H8id22G0lRp6iqytg8ty1
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';

export const DEFAULT_FIREBASE_API_KEY = "AIzaSyBLnxSGbHSDWcjbX_ykG_E7uN-WsmkMzS8";
export const STORAGE_KEY_CUSTOM_API_KEY = "meu_financeiro_custom_firebase_api_key";

export function getEffectiveFirebaseApiKey(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_API_KEY);
    if (custom && custom.trim().length > 10) {
      return custom.trim();
    }
  }
  return DEFAULT_FIREBASE_API_KEY;
}

export function saveCustomFirebaseApiKey(newKey: string): void {
  if (typeof window !== 'undefined') {
    if (newKey && newKey.trim().length > 10) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_API_KEY, newKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_API_KEY);
    }
    window.location.reload();
  }
}

export function resetFirebaseApiKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_API_KEY);
    window.location.reload();
  }
}

export async function testFirebaseConnection(apiKeyToTest?: string): Promise<{
  success: boolean;
  status: number;
  code: string;
  message: string;
  details?: any;
}> {
  const key = apiKeyToTest ? apiKeyToTest.trim() : getEffectiveFirebaseApiKey();
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'diagnostics_probe@test.local',
          password: 'probe_test_password_123',
          returnSecureToken: false,
        }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return {
        success: true,
        status: 200,
        code: 'OK',
        message: 'Conexão com Firebase Authentication estabelecida com sucesso.',
      };
    }

    const err = data.error || {};
    const errMessage: string = err.message || '';

    // If Google returns EMAIL_NOT_FOUND or INVALID_LOGIN_CREDENTIALS,
    // it proves the API key and connection to Identity Toolkit ARE ACTIVE AND REACHABLE!
    if (
      errMessage === 'EMAIL_NOT_FOUND' ||
      errMessage === 'INVALID_PASSWORD' ||
      errMessage === 'INVALID_LOGIN_CREDENTIALS' ||
      errMessage.includes('INVALID_LOGIN_CREDENTIALS')
    ) {
      return {
        success: true,
        status: 200,
        code: 'CONNECTION_ACTIVE',
        message: 'Conexão com Firebase Authentication ativa e respondendo com sucesso.',
      };
    }

    if (errMessage.includes('API key not valid') || errMessage.includes('API_KEY_INVALID')) {
      return {
        success: false,
        status: res.status,
        code: 'auth/api-key-not-valid',
        message: 'A Chave de API da Web (apiKey) configurada não é válida para este projeto.',
        details: err,
      };
    }

    if (errMessage.includes('OPERATION_NOT_ALLOWED')) {
      return {
        success: false,
        status: res.status,
        code: 'auth/operation-not-allowed',
        message: 'O provedor de login E-mail e Senha não está ativado no Firebase Console.',
        details: err,
      };
    }

    return {
      success: false,
      status: res.status,
      code: errMessage || `HTTP_${res.status}`,
      message: errMessage || 'Erro retornado pelo Firebase Authentication.',
      details: err,
    };
  } catch (netErr: any) {
    return {
      success: false,
      status: 0,
      code: 'auth/network-request-failed',
      message: netErr?.message || 'Falha de rede ao conectar aos servidores do Firebase.',
    };
  }
}

export const firebaseConfig = {
  apiKey: getEffectiveFirebaseApiKey(),
  authDomain: "minhas-financias-ygo.firebaseapp.com",
  projectId: "minhas-financias-ygo",
  storageBucket: "minhas-financias-ygo.firebasestorage.app",
  messagingSenderId: "603240438972",
  appId: "1:603240438972:web:39fa66a0248b89651c84b9",
  measurementId: "G-NVXRDP5JVW",
};

// Authorized Single Administrator UID as defined in project requirements
export const AUTHORIZED_ADMIN_UID = "Q5ji8a8H8id22G0lRp6iqytg8ty1";

// Initialize Firebase App only once
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication with Local Browser Persistence
export const auth: Auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth persistence warning:', err);
  });
} catch (e) {
  console.warn('Could not set persistence:', e);
}

// Initialize Cloud Firestore with offline multi-tab persistent cache
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // If already initialized, retrieve existing instance
  firestoreInstance = getFirestore(app);
}

export const db: Firestore = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}
