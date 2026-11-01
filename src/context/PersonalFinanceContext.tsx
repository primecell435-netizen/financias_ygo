/**
 * Context for "Minhas Contas" (Personal Finances)
 * STRICT ISOLATION: Operates independently from commercial sales, cash flow, clients, and receipts.
 * Strictly limited to Master Administrator.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  PersonalBill,
  PersonalBillPayment,
  PersonalFinancialSummary,
  PersonalPaymentMethod,
  PersonalBillType,
  PersonalBillRecurrence,
} from '../types/finance';
import {
  subscribePersonalBills,
  savePersonalBill,
  deletePersonalBill as apiDeletePersonalBill,
  registerPersonalBillPayment,
  cancelPersonalBillPayment,
  generateNextRecurrentBill,
} from '../services/personalBillsService';
import { useFinance } from './FinanceContext';
import { AUTHORIZED_ADMIN_UID } from '../services/firebase';
import { calculateDaysDifference } from '../utils/formatters';

interface PersonalFinanceContextType {
  bills: PersonalBill[];
  monthlyBills: PersonalBill[];
  categories: string[];
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (month: string) => void;
  goToNextMonth: () => void;
  goToPrevMonth: () => void;
  goToCurrentMonth: () => void;
  summary: PersonalFinancialSummary;
  upcomingBills: PersonalBill[];
  isLoading: boolean;
  addCategory: (categoryName: string) => void;
  createBill: (data: {
    name: string;
    category: string;
    amount: number;
    dueDate: string;
    type: PersonalBillType;
    recurrence: PersonalBillRecurrence;
    installmentsCount?: number;
    currentInstallmentNumber?: number;
    notes?: string;
  }) => Promise<PersonalBill>;
  updateBill: (
    billId: string,
    data: {
      name: string;
      category: string;
      amount: number;
      dueDate: string;
      type: PersonalBillType;
      recurrence: PersonalBillRecurrence;
      installmentsCount?: number;
      currentInstallmentNumber?: number;
      notes?: string;
    }
  ) => Promise<PersonalBill>;
  deleteBill: (billId: string) => Promise<void>;
  payBill: (
    billId: string,
    paymentData: {
      amount: number;
      paymentDate: string;
      paymentMethod: PersonalPaymentMethod;
      notes?: string;
      generateNextRecurrenceToo?: boolean;
    }
  ) => Promise<void>;
  cancelPayment: (billId: string, paymentId: string) => Promise<void>;
  generateNextRecurrence: (billId: string) => Promise<PersonalBill>;
}

const DEFAULT_CATEGORIES = [
  'Moradia (Aluguel/Condomínio)',
  'Transporte (Carro/Combustível)',
  'Serviços (Água/Luz/Gás)',
  'Telecom (Internet/Telefone)',
  'Bancos e Cartão de Crédito',
  'Empréstimos e Financiamentos',
  'Assinaturas e Streaming',
  'Educação',
  'Saúde e Farmácia',
  'Alimentação',
  'Outras Despesas',
];

const PersonalFinanceContext = createContext<PersonalFinanceContextType | undefined>(undefined);

export const PersonalFinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isMasterAdmin } = useFinance();
  const [bills, setBills] = useState<PersonalBill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Default month: Current month in 'YYYY-MM'
  const getCurrentMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  // Category management stored locally
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('meu_financeiro_personal_categories');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_CATEGORIES;
  });

  const addCategory = useCallback((cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      try {
        localStorage.setItem('meu_financeiro_personal_categories', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  // Listen to Firestore personal bills ONLY if authenticated as Master Admin
  useEffect(() => {
    if (!currentUser || !isMasterAdmin || currentUser.uid !== AUTHORIZED_ADMIN_UID) {
      setBills([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribePersonalBills(
      (loadedBills) => {
        setBills(loadedBills);
        setIsLoading(false);
      },
      (err) => {
        console.error('[PersonalFinanceContext] Error subscribing to personal bills:', err);
        setIsLoading(false);
      },
      AUTHORIZED_ADMIN_UID
    );

    return () => unsub();
  }, [currentUser, isMasterAdmin]);

  // Month navigation helpers
  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const [yStr, mStr] = prev.split('-');
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    });
  }, []);

  const goToPrevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      const [yStr, mStr] = prev.split('-');
      let y = parseInt(yStr, 10);
      let m = parseInt(mStr, 10);
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    });
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(getCurrentMonthStr());
  }, []);

  // Filter bills strictly belonging to selectedMonth
  const monthlyBills = useMemo(() => {
    return bills.filter((b) => b.dueDate.startsWith(selectedMonth));
  }, [bills, selectedMonth]);

  // Compute monthly personal summary
  const summary: PersonalFinancialSummary = useMemo(() => {
    let totalMonthBills = 0;
    let totalMonthPaid = 0;
    let totalMonthPending = 0;
    let totalMonthOverdue = 0;
    let countPaid = 0;
    let countPending = 0;
    let countOverdue = 0;

    for (const b of monthlyBills) {
      totalMonthBills += b.amount;
      totalMonthPaid += b.paidAmount;

      if (b.status === 'paid') {
        countPaid += 1;
      } else {
        totalMonthPending += b.remainingAmount;
        if (b.status === 'overdue') {
          totalMonthOverdue += b.remainingAmount;
          countOverdue += 1;
        } else {
          countPending += 1;
        }
      }
    }

    return {
      totalMonthBills: Number(totalMonthBills.toFixed(2)),
      totalMonthPaid: Number(totalMonthPaid.toFixed(2)),
      totalMonthPending: Number(totalMonthPending.toFixed(2)),
      totalMonthOverdue: Number(totalMonthOverdue.toFixed(2)),
      countBills: monthlyBills.length,
      countPaid,
      countPending,
      countOverdue,
    };
  }, [monthlyBills]);

  // Upcoming bills (unpaid and due in the next 5 days or today)
  const upcomingBills = useMemo(() => {
    return bills
      .filter((b) => {
        if (b.status === 'paid') return false;
        const diff = calculateDaysDifference(b.dueDate);
        return diff >= 0 && diff <= 5;
      })
      .slice(0, 4);
  }, [bills]);

  // Actions
  const createBill = useCallback(
    async (data: {
      name: string;
      category: string;
      amount: number;
      dueDate: string;
      type: PersonalBillType;
      recurrence: PersonalBillRecurrence;
      installmentsCount?: number;
      currentInstallmentNumber?: number;
      notes?: string;
    }) => {
      return await savePersonalBill(data, AUTHORIZED_ADMIN_UID);
    },
    []
  );

  const updateBill = useCallback(
    async (
      billId: string,
      data: {
        name: string;
        category: string;
        amount: number;
        dueDate: string;
        type: PersonalBillType;
        recurrence: PersonalBillRecurrence;
        installmentsCount?: number;
        currentInstallmentNumber?: number;
        notes?: string;
      }
    ) => {
      const existing = bills.find((b) => b.id === billId);
      return await savePersonalBill(
        {
          ...data,
          id: billId,
          payments: existing?.payments || [],
          createdAt: existing?.createdAt,
        },
        AUTHORIZED_ADMIN_UID
      );
    },
    [bills]
  );

  const deleteBill = useCallback(async (billId: string) => {
    await apiDeletePersonalBill(billId, AUTHORIZED_ADMIN_UID);
  }, []);

  const payBill = useCallback(
    async (
      billId: string,
      paymentData: {
        amount: number;
        paymentDate: string;
        paymentMethod: PersonalPaymentMethod;
        notes?: string;
        generateNextRecurrenceToo?: boolean;
      }
    ) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) throw new Error('Conta pessoal não encontrada.');

      await registerPersonalBillPayment(bill, paymentData, AUTHORIZED_ADMIN_UID);

      if (paymentData.generateNextRecurrenceToo && bill.recurrence !== 'none') {
        await generateNextRecurrentBill(bill, AUTHORIZED_ADMIN_UID);
      }
    },
    [bills]
  );

  const cancelPayment = useCallback(
    async (billId: string, paymentId: string) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) throw new Error('Conta pessoal não encontrada.');

      await cancelPersonalBillPayment(bill, paymentId, AUTHORIZED_ADMIN_UID);
    },
    [bills]
  );

  const generateNextRecurrence = useCallback(
    async (billId: string) => {
      const bill = bills.find((b) => b.id === billId);
      if (!bill) throw new Error('Conta pessoal não encontrada.');
      return await generateNextRecurrentBill(bill, AUTHORIZED_ADMIN_UID);
    },
    [bills]
  );

  return (
    <PersonalFinanceContext.Provider
      value={{
        bills,
        monthlyBills,
        categories,
        selectedMonth,
        setSelectedMonth,
        goToNextMonth,
        goToPrevMonth,
        goToCurrentMonth,
        summary,
        upcomingBills,
        isLoading,
        addCategory,
        createBill,
        updateBill,
        deleteBill,
        payBill,
        cancelPayment,
        generateNextRecurrence,
      }}
    >
      {children}
    </PersonalFinanceContext.Provider>
  );
};

export const usePersonalFinance = () => {
  const context = useContext(PersonalFinanceContext);
  if (!context) {
    throw new Error('usePersonalFinance must be used within a PersonalFinanceProvider');
  }
  return context;
};
