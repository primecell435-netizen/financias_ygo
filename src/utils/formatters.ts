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
