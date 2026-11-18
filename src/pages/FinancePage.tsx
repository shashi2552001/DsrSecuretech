import React, { useState } from 'react';
import { CreditCard, Plus, Receipt, X } from 'lucide-react';
import {
  addProjectExpense,
  logAuditEvent,
  recordInvoicePayment,
  saveInvoice,
} from '../services/firestoreService';
import {
  Payment,
  Project,
  ProjectExpense,
  ProjectInvoice,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  formatCurrency,
  generateNextInvoiceCode,
  generateSafeId,
} from '../utils/calculations';

interface FinancePageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  expenses: ProjectExpense[];
  invoices: ProjectInvoice[];
  payments: Payment[];
}

export const FinancePage: React.FC<FinancePageProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  expenses,
  invoices,
  payments,
}) => {
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [payInvoice, setPayInvoice] = useState<ProjectInvoice | null>(null);

  if (effectiveRole === 'TEAM_MEMBER') {
    return (
      <div className="glass-surface rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300">
          Financial ledgers, budgets, and client invoices require leadership clearance.
        </p>
      </div>
    );
  }

  const scopedProjects =
    effectiveRole === 'ADMIN'
      ? projects.filter((p) => p.assignedAdminUid === effectiveUser.uid)
      : projects;

  const scopedInvoices =
    effectiveRole === 'ADMIN'
      ? invoices.filter((i) => i.assignedAdminUid === effectiveUser.uid)
      : invoices;

  const scopedExpenses =
    effectiveRole === 'ADMIN'
      ? expenses.filter((e) => e.assignedAdminUid === effectiveUser.uid)
      : expenses;

  const totalQuoted = scopedProjects.reduce((s, p) => s + (p.quotedAmount || 0), 0);
  const totalBudget = scopedProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalReceived = scopedProjects.reduce((s, p) => s + (p.totalReceived || 0), 0);
  const totalPending = scopedProjects.reduce((s, p) => s + (p.pendingAmount || 0), 0);
  const totalExpenses = scopedExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalReceived - totalExpenses;

  const isSuper = effectiveRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Financial Command & P&L Ledger</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Project budgets, client invoices, payment collections, and operational/vendor expenses
          </p>
        </div>
        {isSuper && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setExpenseModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Record Expense
            </button>
            <button
              type="button"
              onClick={() => setInvoiceModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
            >
              <Receipt className="w-3.5 h-3.5" /> Issue Invoice
            </button>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <FinKpi label="Quoted Value" value={formatCurrency(totalQuoted)} />
        <FinKpi label="Approved Budget" value={formatCurrency(totalBudget)} />
        <FinKpi label="Received Payments" value={formatCurrency(totalReceived)} tone="emerald" />
        <FinKpi label="Pending Receivables" value={formatCurrency(totalPending)} tone="gold" />
        <FinKpi label="Total Expenses" value={formatCurrency(totalExpenses)} />
        <FinKpi label="Net Profit / Loss" value={formatCurrency(netProfit)} tone={netProfit >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Invoices Table */}
      <div className="glass-surface rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Client Invoices ({scopedInvoices.length})</h3>
          <span className="text-xs font-mono text-gray-400">{payments.length} recorded settlements</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Project & Client</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {scopedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono text-gray-200">{inv.invoiceNumber}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-white">{inv.projectName || inv.projectCode}</p>
                    <p className="text-[11px] text-gray-400">{inv.clientName}</p>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-gray-300">{inv.dueDate}</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={
                        inv.status === 'PAID'
                          ? 'text-emerald-400'
                          : inv.status === 'OVERDUE'
                          ? 'text-red-400'
                          : 'text-amber-300'
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {formatCurrency(inv.amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                    {formatCurrency(inv.paidAmount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isSuper && inv.status !== 'PAID' ? (
                      <button
                        type="button"
                        onClick={() => setPayInvoice(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-medium"
                      >
                        <CreditCard className="w-3 h-3" /> Record Payment
                      </button>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses Ledger */}
      <div className="glass-surface rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8">
          <h3 className="text-sm font-semibold text-white">Operational & Vendor Expenses ({scopedExpenses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {scopedExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-3 px-4 font-mono tabular-nums text-gray-400">{e.expenseDate}</td>
                  <td className="py-3 px-4 text-gray-200">{e.projectCode} · {e.projectName}</td>
                  <td className="py-3 px-4 text-amber-300">{e.category}</td>
                  <td className="py-3 px-4 text-gray-300">{e.description}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {formatCurrency(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {invoiceModal && (
        <IssueInvoiceModal
          projects={projects}
          existingInvoices={invoices}
          effectiveUser={effectiveUser}
          onClose={() => setInvoiceModal(false)}
        />
      )}

      {expenseModal && (
        <AddExpenseModal
          projects={projects}
          effectiveUser={effectiveUser}
          onClose={() => setExpenseModal(false)}
        />
      )}

      {payInvoice && (
        <RecordPaymentModal
          invoice={payInvoice}
          effectiveUser={effectiveUser}
          onClose={() => setPayInvoice(null)}
        />
      )}
    </div>
  );
};

const FinKpi: React.FC<{ label: string; value: string; tone?: 'default' | 'emerald' | 'gold' | 'red' }> = ({
  label,
  value,
  tone = 'default',
}) => (
  <div className="glass-surface rounded-xl p-4 space-y-1">
    <p className="text-[11px] text-gray-400 truncate">{label}</p>
    <p
      className={`font-mono tabular-nums text-lg font-bold truncate ${
        tone === 'emerald'
          ? 'text-emerald-400'
          : tone === 'gold'
          ? 'text-amber-300'
          : tone === 'red'
          ? 'text-red-400'
          : 'text-white'
      }`}
    >
      {value}
    </p>
  </div>
);

const IssueInvoiceModal: React.FC<{
  projects: Project[];
  existingInvoices: ProjectInvoice[];
  effectiveUser: UserProfile;
  onClose: () => void;
}> = ({ projects, existingInvoices, effectiveUser, onClose }) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [amount, setAmount] = useState('25000');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setSaving(true);
    try {
      const id = generateSafeId('inv');
      const invoiceNumber = generateNextInvoiceCode(existingInvoices);
      await saveInvoice(
        {
          id,
          invoiceNumber,
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          clientId: project.clientId,
          clientName: project.clientName,
          assignedAdminUid: project.assignedAdminUid,
          amount: Math.max(1, Number(amount) || 0),
          paidAmount: 0,
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate,
          status: 'SENT',
        },
        true
      );
      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveUser.role,
        action: 'INVOICE_ISSUED',
        resourceType: 'INVOICE',
        resourceId: id,
        summary: `Issued ${invoiceNumber} for ${project.projectCode} ($${amount})`,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-surface max-w-md w-full rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Issue Client Invoice</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Invoice Amount ($)</label>
          <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono" />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Payment Due Date</label>
          <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold">
            {saving ? 'Issuing...' : 'Issue Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AddExpenseModal: React.FC<{
  projects: Project[];
  effectiveUser: UserProfile;
  onClose: () => void;
}> = ({ projects, effectiveUser, onClose }) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [category, setCategory] = useState<ProjectExpense['category']>('Operational');
  const [amount, setAmount] = useState('5000');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setSaving(true);
    try {
      const id = generateSafeId('exp');
      await addProjectExpense({
        id,
        projectId: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        assignedAdminUid: project.assignedAdminUid,
        category,
        description: description.trim(),
        amount: Math.max(1, Number(amount) || 0),
        expenseDate,
        recordedByUid: effectiveUser.uid,
      });
      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveUser.role,
        action: 'EXPENSE_RECORDED',
        resourceType: 'EXPENSE',
        resourceId: id,
        summary: `Recorded ${category} expense $${amount} on ${project.projectCode}`,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-surface max-w-md w-full rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Record Project Expense</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode} · {p.projectName}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-gray-400 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ProjectExpense['category'])} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
              <option value="Operational">Operational</option>
              <option value="Vendor">Vendor</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Licensing">Licensing</option>
              <option value="Contractor">Contractor</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Amount ($)</label>
            <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Date</label>
          <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Description</label>
          <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold">
            {saving ? 'Saving...' : 'Record Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};

const RecordPaymentModal: React.FC<{
  invoice: ProjectInvoice;
  effectiveUser: UserProfile;
  onClose: () => void;
}> = ({ invoice, effectiveUser, onClose }) => {
  const remaining = Math.max(0, invoice.amount - invoice.paidAmount);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<Payment['method']>('Wire Transfer');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = generateSafeId('pay');
      await recordInvoicePayment({
        id,
        invoiceId: invoice.id,
        projectId: invoice.projectId,
        projectCode: invoice.projectCode,
        assignedAdminUid: invoice.assignedAdminUid,
        amount: Math.max(1, Number(amount) || 0),
        paymentDate: new Date().toISOString().slice(0, 10),
        method,
        reference: reference.trim(),
        recordedByUid: effectiveUser.uid,
      });
      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveUser.role,
        action: 'PAYMENT_RECORDED',
        resourceType: 'INVOICE',
        resourceId: invoice.id,
        summary: `Recorded $${amount} payment against ${invoice.invoiceNumber}`,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-surface max-w-md w-full rounded-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Record Payment · {invoice.invoiceNumber}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-gray-400">Remaining Balance: {formatCurrency(remaining)}</p>
        <div>
          <label className="block text-gray-400 mb-1">Amount ($)</label>
          <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono" />
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Payment Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
            <option value="Wire Transfer">Wire Transfer</option>
            <option value="ACH">ACH</option>
            <option value="Corporate Card">Corporate Card</option>
            <option value="UPI / NEFT">UPI / NEFT</option>
            <option value="Check">Check</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-400 mb-1">Transaction Reference</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SWIFT / ACH / Ref #" className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold">
            {saving ? 'Recording...' : 'Confirm Payment'}
          </button>
        </div>
      </form>
    </div>
  );
};
