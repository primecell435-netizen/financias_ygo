/**
 * Formatting and calculation utilities for Meu Financeiro
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(isNaN(amount) ? 0 : amount);
};

/**
 * Robust parser for Brazilian currency inputs.
 * Accepts:
 * - "300" -> 300.00
 * - "300,50" -> 300.50
 * - "1.500,75" -> 1500.75
 * - "0,50" or ",50" -> 0.50
 * - "300.50" -> 300.50
 * Never performs incorrect 100-division.
 */
export const parseCurrencyInput = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Number(value.toFixed(2));

  let str = String(value).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;

  // Handle formats like "1.500,75" vs "1,500.75"
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Brazilian standard: "1.500,75" -> 1500.75
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // International standard: "1,500.75" -> 1500.75
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Single comma: Brazilian decimal e.g. "300,50" or "0,50" or ",50"
    if (str.startsWith(',')) str = '0' + str;
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
};

/**
 * Formats a numeric value for display in an editable input (pt-BR standard)
 */
export const formatCurrencyForDisplay = (val: number | ''): string => {
  if (val === '' || val === undefined || val === null || isNaN(val as number)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val as number);
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dateStr;
  }
};

export const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
};

export const cleanPhoneForWhatsApp = (phone: string): string => {
  let clean = phone.replace(/\D/g, '');
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
};

export const generateWhatsAppLink = (phone: string, message: string): string => {
  const clean = cleanPhoneForWhatsApp(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${encodedMsg}`;
};

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateDaysDifference = (targetDateStr: string): number => {
  const today = new Date(getTodayDateString() + 'T00:00:00');
  const target = new Date(targetDateStr.split('T')[0] + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const computeInstallmentStatus = (
  dueDateStr: string,
  paidAmount: number,
  currentAmount: number
): { status: 'paid' | 'partially_paid' | 'pending' | 'overdue'; isOverdue: boolean; daysDiff: number } => {
  const daysDiff = calculateDaysDifference(dueDateStr);
  const isPastDue = daysDiff < 0;
  const isFullyPaid = paidAmount >= currentAmount && currentAmount > 0;
  const isPartiallyPaid = paidAmount > 0 && paidAmount < currentAmount;

  if (isFullyPaid) {
    return { status: 'paid', isOverdue: false, daysDiff };
  }

  if (isPartiallyPaid) {
    return {
      status: 'partially_paid',
      isOverdue: isPastDue,
      daysDiff,
    };
  }

  if (isPastDue) {
    return { status: 'overdue', isOverdue: true, daysDiff };
  }

  return { status: 'pending', isOverdue: false, daysDiff };
};

/**
 * Calculates the exact remaining balance of a specific sale based on all its non-transferred installments.
 * - Sums all unpaid/remaining amounts of installments belonging to saleId.
 * - Shows 0.00 ONLY when all installments for this specific sale are paid.
 * - Does NOT mix with other sales of the same client.
 * - Accurately accounts for partial and full payments.
 */
export const calculateSaleRemainingBalance = (
  saleId: string,
  installments: Array<{
    saleId: string;
    currentAmount: number;
    paidAmount: number;
    remainingAmount: number;
    isTransferred?: boolean;
    status?: string;
  }>
): {
  totalSaleAmount: number;
  totalSalePaid: number;
  totalSaleRemaining: number;
  isFullySettled: boolean;
  totalInstallmentsCount: number;
  remainingInstallmentsCount: number;
  paidInstallmentsCount: number;
} => {
  if (!saleId) {
    return {
      totalSaleAmount: 0,
      totalSalePaid: 0,
      totalSaleRemaining: 0,
      isFullySettled: true,
      totalInstallmentsCount: 0,
      remainingInstallmentsCount: 0,
      paidInstallmentsCount: 0,
    };
  }

  const saleInstallments = installments.filter(
    (i) => i.saleId === saleId && !i.isTransferred
  );

  let totalSaleRemaining = 0;
  let totalSalePaid = 0;
  let totalSaleAmount = 0;
  let remainingInstallmentsCount = 0;
  let paidInstallmentsCount = 0;

  for (const inst of saleInstallments) {
    totalSaleAmount += inst.currentAmount;
    totalSalePaid += inst.paidAmount;

    // A remaining amount cannot be less than 0
    const rem = Math.max(0, inst.remainingAmount);
    totalSaleRemaining += rem;

    if (rem <= 0.005 || inst.status === 'paid') {
      paidInstallmentsCount++;
    } else {
      remainingInstallmentsCount++;
    }
  }

  // Round values to 2 decimals to eliminate JS floating point inaccuracies
  totalSaleRemaining = Math.max(0, Number(totalSaleRemaining.toFixed(2)));
  totalSalePaid = Number(totalSalePaid.toFixed(2));
  totalSaleAmount = Number(totalSaleAmount.toFixed(2));

  return {
    totalSaleAmount,
    totalSalePaid,
    totalSaleRemaining,
    isFullySettled: totalSaleRemaining <= 0,
    totalInstallmentsCount: saleInstallments.length,
    remainingInstallmentsCount,
    paidInstallmentsCount,
  };
};

