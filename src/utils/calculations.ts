import { Project, ProjectExpense, ProjectInvoice, Task } from '../types/domain';

/**
 * Computes weighted project completion percentage directly from its task records.
 * Completed tasks contribute 100%, other tasks contribute their progress% * weight.
 */
export function calculateWeightedProjectProgress(tasks: Task[]): number {
  if (!tasks || tasks.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const task of tasks) {
    const w = Math.max(1, Number(task.weight) || 1);
    const effectiveProgress =
      task.status === 'Completed'
        ? 100
        : Math.min(100, Math.max(0, Number(task.progress) || 0));
    totalWeight += w;
    weightedSum += effectiveProgress * w;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function isDateOverdue(dateStr?: string, completed?: boolean): boolean {
  if (!dateStr || completed) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export function isDateApproaching(dateStr?: string, warningDays = 5, completed?: boolean): boolean {
  if (!dateStr || completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= warningDays;
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(amount: number | undefined, currency = 'USD'): string {
  const val = Number(amount || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatTimestampLocal(ts: unknown): string {
  if (!ts) return '—';
  let date: Date | null = null;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string') {
    date = new Date(ts);
  } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    date = new Date((ts as { seconds: number }).seconds * 1000);
  }
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateNextProjectCode(existingProjects: Project[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const p of existingProjects) {
    const match = p.projectCode?.match(/^DSR-PRJ-\d{4}-(\d{4})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  return `DSR-PRJ-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export function generateNextTaskCode(existingTasks: Task[]): string {
  let maxSeq = 1000;
  for (const t of existingTasks) {
    const match = t.taskCode?.match(/^DSR-TSK-(\d{4,6})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  return `DSR-TSK-${maxSeq + 1}`;
}

export function generateNextInvoiceCode(existingInvoices: ProjectInvoice[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const match = inv.invoiceNumber?.match(/^DSR-INV-\d{4}-(\d{4})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  return `DSR-INV-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

export function computeEmployeeProductivity(tasks: Task[], uid: string): {
  total: number;
  completed: number;
  onTimeRate: number;
  avgProgress: number;
  score: number;
} {
  const myTasks = tasks.filter((t) => t.assigneeUid === uid);
  if (myTasks.length === 0) {
    return { total: 0, completed: 0, onTimeRate: 100, avgProgress: 0, score: 0 };
  }
  const completedTasks = myTasks.filter((t) => t.status === 'Completed');
  const overdueTasks = myTasks.filter((t) => isDateOverdue(t.dueDate, t.status === 'Completed'));
  const avgProgress = Math.round(
    myTasks.reduce((acc, t) => acc + (t.status === 'Completed' ? 100 : t.progress), 0) / myTasks.length
  );
  const onTimeRate = Math.round(((myTasks.length - overdueTasks.length) / myTasks.length) * 100);
  const score = Math.round(avgProgress * 0.6 + onTimeRate * 0.4);
  return {
    total: myTasks.length,
    completed: completedTasks.length,
    onTimeRate,
    avgProgress,
    score,
  };
}

export function computeProjectFinancialSummary(
  project: Project,
  expenses: ProjectExpense[],
  invoices: ProjectInvoice[]
) {
  const projectExpenses = expenses
    .filter((e) => e.projectId === project.id)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const projectInvoices = invoices.filter((i) => i.projectId === project.id);
  const invoicedTotal = projectInvoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const received = project.totalReceived ?? projectInvoices.reduce((acc, i) => acc + (Number(i.paidAmount) || 0), 0);
  const budget = Number(project.budget || 0);
  const pending = Math.max(0, (Number(project.quotedAmount || budget) || invoicedTotal) - received);
  const netProfit = received - projectExpenses;

  return {
    budget,
    quoted: Number(project.quotedAmount || budget),
    received,
    pending,
    expenses: projectExpenses,
    invoicedTotal,
    netProfit,
  };
}

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_INLINE_FILE_BYTES = 350 * 1024; // 350KB safe Firestore inline payload limit

export function validateUploadFile(file: File): { ok: boolean; error?: string } {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g|webp|txt|csv|json|docx|xlsx)$/i)) {
    return { ok: false, error: 'Unsupported file type. Allowed: PDF, PNG, JPG, TXT, CSV, JSON, DOCX, XLSX.' };
  }
  if (file.size > MAX_INLINE_FILE_BYTES) {
    return {
      ok: false,
      error: `File size (${Math.round(file.size / 1024)} KB) exceeds 350 KB secure inline vault limit.`,
    };
  }
  return { ok: true };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
