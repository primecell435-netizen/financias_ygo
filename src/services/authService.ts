/**
 * Authentication Service for Meu Financeiro
 * Enforces single authorized administrator UID: Q5ji8a8H8id22G0lRp6iqytg8ty1
 * Comprehensive error handling and real diagnostic logging
 */

import { initializeApp, deleteApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  verifyBeforeUpdateEmail,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  getAuth,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { auth, db, AUTHORIZED_ADMIN_UID, firebaseConfig } from './firebase';
import { sanitizeForFirestore } from './firestoreService';
import { SystemUser } from '../types/finance';

export const USERNAME_DOMAIN = 'meufinanceiro.internal';
export const TARGET_ADMIN_EMAIL = 'lojaprimecellfortal@gmail.com';
export const LEGACY_ADMIN_EMAIL = 'udvcantina@gmail.com';

export interface UpdateAdminEmailResult {
  status: 'verification_sent' | 'updated_directly';
  newEmail: string;
  message: string;
  uid: string;
}

export interface AuthState {
  user: User | null;
  isAdminAuthorized: boolean;
  loading: boolean;
  errorMessage: string | null;
}

export interface FirebaseAuthErrorDetails {
  code: string;
  userFriendlyMessage: string;
  technicalMessage: string;
  suggestedAction?: string;
  isApiKeyIssue: boolean;
  isDomainIssue: boolean;
  isOperationNotAllowed: boolean;
  timestamp: string;
}

export class AppAuthError extends Error {
  code: string;
  details: FirebaseAuthErrorDetails;

  constructor(details: FirebaseAuthErrorDetails) {
    super(details.userFriendlyMessage);
    this.name = 'AppAuthError';
    this.code = details.code;
    this.details = details;
  }
}

export function parseFirebaseAuthError(error: any): FirebaseAuthErrorDetails {
  const rawCode: string = error?.code || '';
  const rawMsg: string = error?.message || String(error || 'Erro desconhecido');
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  let code = rawCode;
  let userFriendlyMessage = '';
  let technicalMessage = rawMsg;
  let suggestedAction: string | undefined;
  let isApiKeyIssue = false;
  let isDomainIssue = false;
  let isOperationNotAllowed = false;

  const lowerCode = rawCode.toLowerCase();
  const lowerMsg = rawMsg.toLowerCase();

  if (
    lowerCode.includes('api-key-not-valid') ||
    lowerCode.includes('invalid-api-key') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('api_key_invalid')
  ) {
    code = 'auth/api-key-not-valid';
    isApiKeyIssue = true;
    userFriendlyMessage =
      'A Chave de API da Web (apiKey) configurada no Firebase é inválida ou foi revogada/gerada novamente no Console do Firebase.';
    suggestedAction =
      'Acesse o Console do Firebase (Configurações do Projeto > Geral > Seus Aplicativos > Web App) e copie a "Chave de API da Web" atualizada do projeto "minhas-financias-ygo".';
  } else if (
    lowerCode.includes('unauthorized-domain') ||
    lowerMsg.includes('unauthorized-domain')
  ) {
    code = 'auth/unauthorized-domain';
    isDomainIssue = true;
    userFriendlyMessage = `O domínio atual onde o sistema está rodando ("${currentHost}") não está na lista de domínios autorizados do Firebase Authentication.`;
    suggestedAction = `No Console do Firebase, acesse "Authentication > Configurações > Domínios autorizados" e adicione o domínio: ${currentHost}`;
  } else if (
    lowerCode.includes('operation-not-allowed') ||
    lowerMsg.includes('operation_not_allowed')
  ) {
    code = 'auth/operation-not-allowed';
    isOperationNotAllowed = true;
    userFriendlyMessage =
      'O provedor de login com E-mail e Senha não está ativado no Firebase Authentication.';
    suggestedAction =
      'No Console do Firebase, acesse "Authentication > Provedores de login (Sign-in method)" e ative o provedor "E-mail/senha".';
  } else if (
    lowerCode === 'auth/wrong-password' ||
    lowerCode === 'auth/invalid-credential' ||
    lowerMsg.includes('invalid_login_credentials') ||
    lowerMsg.includes('invalid_credential')
  ) {
    code = 'auth/invalid-credential';
    userFriendlyMessage = 'E-mail ou senha incorretos. Verifique suas credenciais de acesso.';
    suggestedAction = 'Confirme se digitou a senha corretamente ou use a recuperação de senha.';
  } else if (lowerCode === 'auth/user-not-found' || lowerMsg.includes('email_not_found')) {
    code = 'auth/user-not-found';
    userFriendlyMessage = 'Nenhum usuário administrador cadastrado com este e-mail no Firebase.';
    suggestedAction = 'Verifique se o e-mail digitado é o mesmo cadastrado na aba Authentication do Firebase.';
  } else if (lowerCode === 'auth/invalid-email') {
    code = 'auth/invalid-email';
    userFriendlyMessage = 'O formato do e-mail informado é inválido.';
  } else if (lowerCode === 'auth/user-disabled') {
    code = 'auth/user-disabled';
    userFriendlyMessage = 'Esta conta de administrador foi desativada no Firebase Authentication.';
  } else if (lowerCode === 'auth/too-many-requests') {
    code = 'auth/too-many-requests';
    userFriendlyMessage =
      'Muitas tentativas sem sucesso. Por segurança, aguarde alguns instantes e tente novamente.';
    suggestedAction = 'Aguarde alguns minutos ou utilize a recuperação de senha por e-mail.';
  } else if (lowerCode === 'auth/network-request-failed') {
    code = 'auth/network-request-failed';
    userFriendlyMessage = 'Falha de comunicação na rede com os servidores do Firebase.';
    suggestedAction = 'Verifique sua conexão com a internet e se não há bloqueadores de rede.';
  } else if (
    lowerCode === 'auth/requires-recent-login' ||
    lowerMsg.includes('requires-recent-login') ||
    lowerMsg.includes('requires_recent_login')
  ) {
    code = 'auth/requires-recent-login';
    userFriendlyMessage =
      'Esta alteração de segurança exige confirmação da sua senha atual de administrador.';
    suggestedAction =
      'Informe a sua senha atual nos campos abaixo para reautenticar a sessão e autorizar a alteração do e-mail.';
  } else if (
    lowerCode === 'auth/email-already-in-use' ||
    lowerMsg.includes('email-already-in-use') ||
    lowerMsg.includes('email_exists')
  ) {
    code = 'auth/email-already-in-use';
    userFriendlyMessage =
      'O e-mail informado já está cadastrado em outra conta neste projeto Firebase.';
    suggestedAction =
      'Verifique no Console do Firebase (Authentication > Usuários) se não foi criada uma segunda conta por engano. Lembre-se que o UID deve ser mantido como "' +
      AUTHORIZED_ADMIN_UID +
      '".';
  } else if (
    lowerCode.includes('permission-denied') ||
    lowerMsg.includes('missing or insufficient permissions') ||
    lowerMsg.includes('permission-denied')
  ) {
    code = 'firestore/permission-denied';
    userFriendlyMessage =
      'Permissão insuficiente no Firestore: As regras de segurança do projeto no Firebase Console precisam autorizar o acesso de operadores cadastrados.';
    suggestedAction =
      'No Firebase Console > Firestore Database > Regras, publique as regras de segurança atualizadas do arquivo firestore.rules para liberar o acesso de operadores.';
  } else {
    code = rawCode || 'auth/unknown-error';
    userFriendlyMessage = `Erro retornado pelo Firebase: ${rawMsg || 'Falha na resposta do servidor.'}`;
  }

  return {
    code,
    userFriendlyMessage,
    technicalMessage: rawMsg,
    suggestedAction,
    isApiKeyIssue,
    isDomainIssue,
    isOperationNotAllowed,
    timestamp: new Date().toISOString(),
  };
}

export function translateFirebaseAuthError(codeOrError: any): string {
  if (typeof codeOrError === 'object' && codeOrError !== null) {
    return parseFirebaseAuthError(codeOrError).userFriendlyMessage;
  }
  return parseFirebaseAuthError({ code: String(codeOrError) }).userFriendlyMessage;
}

export function usernameToInternalEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${USERNAME_DOMAIN}`;
}

export async function loginWithIdentifier(
  identifier: string,
  password: string
): Promise<{ user: User; role: 'admin' | 'operator'; username: string }> {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const trimmed = identifier.trim();

  let emailToUse = trimmed;
  if (!trimmed.includes('@')) {
    emailToUse = usernameToInternalEmail(trimmed);
  }

  console.info(`🔍 [MEU FINANCEIRO] Tentativa de login para: "${trimmed}" -> "${emailToUse}" (Host: ${currentHost})`);

  try {
    const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
    const user = cred.user;

    // Check if master administrator
    if (user.uid === AUTHORIZED_ADMIN_UID) {
      console.info(`🎉 [MEU FINANCEIRO] Administrador Principal autenticado com sucesso (UID: ${AUTHORIZED_ADMIN_UID}).`);
      return { user, role: 'admin', username: 'Administrador' };
    }

    // Check if registered system user in Firestore
    let userSnap;
    try {
      const userDocRef = doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`, user.uid);
      userSnap = await getDoc(userDocRef);
    } catch (firestoreErr: any) {
      console.error('⛔ [MEU FINANCEIRO] Erro ao consultar cadastro do operador no Firestore:', firestoreErr);
      await signOut(auth);
      if (
        firestoreErr?.code === 'permission-denied' ||
        String(firestoreErr?.message || '').toLowerCase().includes('permission')
      ) {
        throw new AppAuthError({
          code: 'firestore/permission-denied',
          userFriendlyMessage:
            'Acesso negado pelas regras de segurança do Firestore: É necessário publicar as regras de segurança atualizadas no Firebase Console para que os operadores possam acessar o sistema.',
          technicalMessage: firestoreErr.message || 'Missing or insufficient permissions',
          suggestedAction:
            'Acesse o Firebase Console > Firestore Database > Regras e publique o conteúdo do arquivo firestore.rules do projeto.',
          isApiKeyIssue: false,
          isDomainIssue: false,
          isOperationNotAllowed: false,
          timestamp: new Date().toISOString(),
        });
      }
      throw firestoreErr;
    }

    if (!userSnap.exists()) {
      console.warn(`⛔ [MEU FINANCEIRO] UID "${user.uid}" não cadastrado na lista de operadores do administrador.`);
      await signOut(auth);
      throw new AppAuthError({
        code: 'auth/user-not-registered',
        userFriendlyMessage: 'Usuário não autorizado ou cadastro não encontrado no sistema.',
        technicalMessage: `User ${user.uid} not found in system_users`,
        isApiKeyIssue: false,
        isDomainIssue: false,
        isOperationNotAllowed: false,
        timestamp: new Date().toISOString(),
      });
    }

    const userData = userSnap.data() as SystemUser;
    if (!userData.isActive) {
      console.warn(`⛔ [MEU FINANCEIRO] Usuário "${userData.username}" está desativado pelo administrador.`);
      await signOut(auth);
      throw new AppAuthError({
        code: 'auth/user-disabled',
        userFriendlyMessage: 'Sua conta de usuário foi desativada pelo administrador do sistema.',
        technicalMessage: `User ${user.uid} is inactive`,
        isApiKeyIssue: false,
        isDomainIssue: false,
        isOperationNotAllowed: false,
        timestamp: new Date().toISOString(),
      });
    }

    console.info(`🎉 [MEU FINANCEIRO] Operador "${userData.username}" autenticado com sucesso (UID: ${user.uid}).`);
    return { user, role: 'operator', username: userData.username };
  } catch (error: any) {
    if (error instanceof AppAuthError) {
      throw error;
    }

    // Fallback: If user typed their admin username or legacy email without domain
    if (!trimmed.includes('@')) {
      if (trimmed.toLowerCase() === 'lojaprimecellfortal' || trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === 'udvcantina') {
        try {
          const fallbackCred = await signInWithEmailAndPassword(auth, TARGET_ADMIN_EMAIL, password);
          if (fallbackCred.user.uid === AUTHORIZED_ADMIN_UID) {
            return { user: fallbackCred.user, role: 'admin', username: 'Administrador' };
          }
        } catch {
          // ignore fallback error and throw original
        }
      }
    }

    const details = parseFirebaseAuthError(error);
    console.error('❌ [MEU FINANCEIRO] Erro de autenticação:', details.userFriendlyMessage);
    throw new AppAuthError(details);
  }
}

export async function loginAdmin(email: string, password: string): Promise<User> {
  const result = await loginWithIdentifier(email, password);
  return result.user;
}

export async function resetAdminPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    console.info(`📧 [MEU FINANCEIRO] E-mail de redefinição de senha enviado para: ${email.trim()}`);
  } catch (error: any) {
    const details = parseFirebaseAuthError(error);
    console.error('❌ [MEU FINANCEIRO] Erro ao enviar e-mail de redefinição:', details);
    throw new AppAuthError(details);
  }
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
  console.info('👋 [MEU FINANCEIRO] Sessão encerrada.');
}

export function subscribeToAuth(
  callback: (
    user: User | null,
    isAuthorized: boolean,
    role: 'admin' | 'operator' | null,
    systemUser: SystemUser | null
  ) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (user.uid === AUTHORIZED_ADMIN_UID) {
        callback(user, true, 'admin', null);
      } else {
        try {
          const userDocRef = doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`, user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data() as SystemUser;
            if (data.isActive) {
              callback(user, true, 'operator', data);
              return;
            }
          }
        } catch (e) {
          console.warn('Erro ao verificar permissão do operador:', e);
        }
        await signOut(auth);
        callback(null, false, null, null);
      }
    } else {
      callback(null, false, null, null);
    }
  });
}

/**
 * Creates a new system user (operator) under the master admin.
 * Uses an isolated secondary FirebaseApp instance so the master admin session is NOT modified!
 * Enforces uniqueness, minimum length, and secure Firebase Authentication storage (no plaintext passwords in Firestore).
 */
export async function createSystemUser(
  username: string,
  password: string,
  adminUid: string
): Promise<{ uid: string; username: string }> {
  if (adminUid !== AUTHORIZED_ADMIN_UID) {
    throw new AppAuthError({
      code: 'auth/unauthorized',
      userFriendlyMessage: 'Apenas o Administrador Principal tem permissão para cadastrar novos usuários.',
      technicalMessage: 'Only master admin can create users',
      isApiKeyIssue: false,
      isDomainIssue: false,
      isOperationNotAllowed: false,
      timestamp: new Date().toISOString(),
    });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (cleanUsername.length < 3) {
    throw new AppAuthError({
      code: 'auth/invalid-username',
      userFriendlyMessage: 'O nome de login deve ter pelo menos 3 caracteres (letras, números ou sublinhado).',
      technicalMessage: 'Username too short',
      isApiKeyIssue: false,
      isDomainIssue: false,
      isOperationNotAllowed: false,
      timestamp: new Date().toISOString(),
    });
  }

  if (password.length < 6) {
    throw new AppAuthError({
      code: 'auth/weak-password',
      userFriendlyMessage: 'A senha do usuário deve conter no mínimo 6 caracteres.',
      technicalMessage: 'Password too short',
      isApiKeyIssue: false,
      isDomainIssue: false,
      isOperationNotAllowed: false,
      timestamp: new Date().toISOString(),
    });
  }

  // 1. Check uniqueness via index doc in Firestore
  const indexDocRef = doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users_index`, cleanUsername);
  const indexSnap = await getDoc(indexDocRef);
  if (indexSnap.exists()) {
    throw new AppAuthError({
      code: 'auth/username-already-exists',
      userFriendlyMessage: `O nome de login "${cleanUsername}" já está cadastrado no sistema. Escolha outro nome.`,
      technicalMessage: 'Username exists in index',
      isApiKeyIssue: false,
      isDomainIssue: false,
      isOperationNotAllowed: false,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Create isolated secondary app to avoid signing out the current admin session
  const tempAppName = `UserCreator_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const secondaryApp = initializeApp(firebaseConfig, tempAppName);
  const secondaryAuth = getAuth(secondaryApp);
  const internalEmail = usernameToInternalEmail(cleanUsername);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, password);
    const newUid = cred.user.uid;

    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    const now = new Date().toISOString();
    const userRecord: SystemUser = {
      uid: newUid,
      username: cleanUsername,
      internalEmail,
      role: 'operator',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: adminUid,
    };

    // Save user record and index in Firestore
    await setDoc(doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`, newUid), sanitizeForFirestore(userRecord));
    await setDoc(indexDocRef, sanitizeForFirestore({
      uid: newUid,
      username: cleanUsername,
      isActive: true,
      createdAt: now,
    }));

    console.info(`✅ [MEU FINANCEIRO] Novo usuário "${cleanUsername}" criado com sucesso (UID: ${newUid}).`);
    return { uid: newUid, username: cleanUsername };
  } catch (err: any) {
    try {
      await deleteApp(secondaryApp);
    } catch {}

    if (err?.code === 'auth/email-already-in-use') {
      throw new AppAuthError({
        code: 'auth/username-already-exists',
        userFriendlyMessage: `O nome de login "${cleanUsername}" já está em uso no Firebase. Escolha outro nome.`,
        technicalMessage: err.message,
        isApiKeyIssue: false,
        isDomainIssue: false,
        isOperationNotAllowed: false,
        timestamp: new Date().toISOString(),
      });
    }

    const details = parseFirebaseAuthError(err);
    throw new AppAuthError(details);
  }
}

export async function listSystemUsers(adminUid: string): Promise<SystemUser[]> {
  if (adminUid !== AUTHORIZED_ADMIN_UID) return [];
  try {
    const colRef = collection(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`);
    const snap = await getDocs(colRef);
    const users: SystemUser[] = [];
    snap.forEach((d) => {
      users.push(d.data() as SystemUser);
    });
    return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return [];
  }
}

export async function toggleSystemUserStatus(
  uid: string,
  username: string,
  isActive: boolean,
  adminUid: string
): Promise<void> {
  if (adminUid !== AUTHORIZED_ADMIN_UID) {
    throw new Error('Apenas o Administrador Principal pode alterar o status de usuários.');
  }
  const now = new Date().toISOString();
  await setDoc(
    doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`, uid),
    { isActive, updatedAt: now },
    { merge: true }
  );
  await setDoc(
    doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users_index`, username.toLowerCase()),
    { isActive, updatedAt: now },
    { merge: true }
  );
}

export async function deleteSystemUser(
  uid: string,
  username: string,
  adminUid: string
): Promise<void> {
  if (adminUid !== AUTHORIZED_ADMIN_UID) {
    throw new Error('Apenas o Administrador Principal pode excluir usuários.');
  }
  await deleteDoc(doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users`, uid));
  await deleteDoc(doc(db, `users/${AUTHORIZED_ADMIN_UID}/system_users_index`, username.toLowerCase()));
}

/**
 * Updates administrator access email in Firebase Authentication
 * 1. Preserves existing UID (AUTHORIZED_ADMIN_UID)
 * 2. Reauthenticates with current password (required by Firebase)
 * 3. Uses official verifyBeforeUpdateEmail (or falls back to updateEmail)
 * 4. Preserves all Firestore security rules and financial records
 */
export async function updateAdminEmailAddress(
  currentPassword: string,
  newEmail: string = TARGET_ADMIN_EMAIL
): Promise<UpdateAdminEmailResult> {
  const user = auth.currentUser;
  if (!user) {
    const details = parseFirebaseAuthError({
      code: 'auth/no-current-user',
      message: 'Nenhum administrador autenticado na sessão atual para alterar o e-mail.',
    });
    throw new AppAuthError(details);
  }

  if (user.uid !== AUTHORIZED_ADMIN_UID) {
    const details = parseFirebaseAuthError({
      code: 'auth/unauthorized-uid',
      message: `Apenas o administrador com UID "${AUTHORIZED_ADMIN_UID}" pode realizar esta alteração.`,
    });
    throw new AppAuthError(details);
  }

  const target = newEmail.trim().toLowerCase();
  const currentEmail = user.email || LEGACY_ADMIN_EMAIL;

  console.info(
    `🔄 [MEU FINANCEIRO] Iniciando alteração de e-mail de acesso de "${currentEmail}" para "${target}" (UID: ${user.uid})`
  );

  try {
    // 1. Reautenticação oficial obrigatória pelo Firebase Authentication
    const credential = EmailAuthProvider.credential(currentEmail, currentPassword);
    await reauthenticateWithCredential(user, credential);
    console.info(`✅ [MEU FINANCEIRO] Reautenticação com senha bem-sucedida para o UID: ${user.uid}`);

    // 2. Disparar o fluxo oficial de alteração de e-mail do Firebase
    try {
      await verifyBeforeUpdateEmail(user, target);
      console.info(`📧 [MEU FINANCEIRO] Link de verificação enviado pelo Firebase para "${target}"`);
      return {
        status: 'verification_sent',
        newEmail: target,
        uid: user.uid,
        message: `O Firebase enviou um link de confirmação para "${target}". Abra a caixa de entrada deste novo e-mail e clique no link de validação. O UID "${AUTHORIZED_ADMIN_UID}" e todo o histórico financeiro foram preservados integralmente.`,
      };
    } catch (verifyErr: any) {
      console.warn('⚠️ verifyBeforeUpdateEmail reportou erro ou método não suportado, tentando updateEmail direto:', verifyErr);
      await updateEmail(user, target);
      console.info(`✅ [MEU FINANCEIRO] E-mail atualizado diretamente no Firebase Authentication para "${target}"`);
      return {
        status: 'updated_directly',
        newEmail: target,
        uid: user.uid,
        message: `E-mail de acesso atualizado diretamente com sucesso para "${target}" no UID "${AUTHORIZED_ADMIN_UID}". Todos os dados e permissões foram preservados integralmente.`,
      };
    }
  } catch (error: any) {
    const details = parseFirebaseAuthError(error);
    console.error('❌ [MEU FINANCEIRO] Erro ao alterar e-mail do administrador:', {
      código: details.code,
      mensagemTécnica: details.technicalMessage,
      mensagemAmigável: details.userFriendlyMessage,
      sugestãoDeCorreção: details.suggestedAction,
      uid: user.uid,
      novoEmail: target,
      erroOriginal: error,
    });
    throw new AppAuthError(details);
  }
}

