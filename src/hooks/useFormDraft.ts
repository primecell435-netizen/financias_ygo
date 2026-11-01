/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';

interface UseFormDraftOptions<T> {
  formKey: string;
  initialValues: T;
  isFieldEmpty?: (values: T) => boolean;
}

export function useFormDraft<T extends Record<string, any>>({
  formKey,
  initialValues,
  isFieldEmpty = (v) => Object.values(v).every((x) => !x || x === ''),
}: UseFormDraftOptions<T>) {
  const { currentUser } = useFinance();
  const userId = currentUser?.uid || 'guest';
  const storageKey = `meu_financeiro_draft_${userId}_${formKey}`;

  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [draftValues, setDraftValues] = useState<T | null>(null);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);

  // Check for saved draft on mount or when user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && !isFieldEmpty(parsed.data)) {
          setHasDraft(true);
          setDraftValues(parsed.data);
          setDraftTimestamp(parsed.updatedAt || null);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler rascunho local:', e);
    }
    setHasDraft(false);
    setDraftValues(null);
    setDraftTimestamp(null);
  }, [storageKey]);

  // Save draft debounce
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDraft = useCallback(
    (values: T) => {
      // Security: Never save password fields in draft
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(values)) {
        if (!k.toLowerCase().includes('password') && !k.toLowerCase().includes('senha')) {
          sanitized[k] = v;
        }
      }

      if (isFieldEmpty(sanitized as T)) {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
        setHasDraft(false);
        setDraftValues(null);
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        try {
          const payload = {
            data: sanitized,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(storageKey, JSON.stringify(payload));
          setHasDraft(true);
          setDraftValues(sanitized as T);
          setDraftTimestamp(payload.updatedAt);
        } catch (err) {
          console.warn('Erro ao salvar rascunho:', err);
        }
      }, 300);
    },
    [storageKey, isFieldEmpty]
  );

  const clearDraft = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setHasDraft(false);
    setDraftValues(null);
    setDraftTimestamp(null);
  }, [storageKey]);

  return {
    hasDraft,
    draftValues,
    draftTimestamp,
    saveDraft,
    clearDraft,
  };
}
