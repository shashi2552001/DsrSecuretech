import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  AuditLog,
  Client,
  PROJECT_STATUSES,
  Project,
  ProjectExpense,
  ProjectInvoice,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  computeEmployeeProductivity,
  computeProjectFinancialSummary,
  formatCurrency,
  formatTimestampLocal,
  isDateOverdue,
} from '../utils/calculations';
import {
  ExportColumn,
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
} from '../utils/exports';

interface ReportsPageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  employees: UserProfile[];
  expenses: ProjectExpense[];
  invoices: ProjectInvoice[];
  auditLogs: AuditLog[];
}

const REPORT_TYPES = [
  { id: 'all_projects', label: 'All Projects Report' },
  { id: 'client_wise', label: 'Client-Wise Project Report' },
  { id: 'project_budget', label: 'Project Budget Report' },
  { id: 'project_pnl', label: 'Project Profit & Loss Report' },
  { id: 'employee_perf', label: 'Employee Performance Report' },
  { id: 'admin_perf', label: 'Admin Performance Report' },
  { id: 'task_completion', label: 'Task Completion Report' },
  { id: 'overdue_tasks', label: 'Overdue Task Report' },
  { id: 'deadline_compliance', label: 'Deadline Compliance Report' },
  { id: 'monthly_projects', label: 'Monthly Project Report' },
  { id: 'financial_summary', label: 'Financial Summary' },
  { id: 'payment_pending', label: 'Payment Pending Report' },
  { id: 'project_activity', label: 'Project Activity Report' },
  { id: 'audit_trail', label: 'Audit Trail Report' },
] as const;

type ReportId = (typeof REPORT_TYPES)[number]['id'];

export const ReportsPage: React.FC<ReportsPageProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  clients,
  tasks,
  employees,
  expenses,
  invoices,
  auditLogs,
}) => {
  const [reportId, setReportId] = useState<ReportId>('all_projects');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [adminFilter, setAdminFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (effectiveRole === 'TEAM_MEMBER') {
    return (
      <div className="glass-surface rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300">
          Enterprise reports and analytics exports require leadership clearance.
        </p>
      </div>
    );
  }

  const scopedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (effectiveRole === 'ADMIN' && p.assignedAdminUid !== effectiveUser.uid) return false;
      if (clientFilter !== 'ALL' && p.clientId !== clientFilter) return false;
      if (adminFilter !== 'ALL' && p.assignedAdminUid !== adminFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (dateFrom && p.startDate && p.startDate < dateFrom) return false;
      if (dateTo && p.expectedCompletionDate && p.expectedCompletionDate > dateTo) return false;
      return true;
    });
  }, [projects, effectiveRole, effectiveUser.uid, clientFilter, adminFilter, statusFilter, dateFrom, dateTo]);

  const scopedTasks = useMemo(() => {
    const projectIds = new Set(scopedProjects.map((p) => p.id));
    return tasks.filter((t) => projectIds.has(t.projectId));
  }, [tasks, scopedProjects]);

  const admins = employees.filter((e) => e.role === 'ADMIN' || e.role === 'SUPER_ADMIN');

  const { columns, rows, title } = useMemo<{
    title: string;
    columns: ExportColumn[];
    rows: Record<string, unknown>[];
  }>(() => {
    const label = REPORT_TYPES.find((r) => r.id === reportId)?.label || 'Report';

    switch (reportId) {
      case 'all_projects':
      case 'monthly_projects':
      case 'project_activity':
        return {
          title: label,
          columns: [
            { header: 'Project ID', key: 'projectCode' },
            { header: 'Project Name', key: 'projectName' },
            { header: 'Client', key: 'clientName' },
            { header: 'Category', key: 'category' },
            { header: 'Operations Lead', key: 'assignedAdminName' },
            { header: 'Status', key: 'status' },
            { header: 'Progress %', key: 'progress' },
            { header: 'Deadline', key: 'expectedCompletionDate' },
          ],
          rows: scopedProjects.map((p) => ({
            projectCode: p.projectCode,
            projectName: p.projectName,
            clientName: p.clientName,
            category: p.category,
            assignedAdminName: p.assignedAdminName || '—',
            status: p.status,
            progress: `${p.progress}%`,
            expectedCompletionDate: p.expectedCompletionDate || '—',
          })),
        };

      case 'client_wise':
        return {
          title: label,
          columns: [
            { header: 'Client Company', key: 'companyName' },
            { header: 'Contact', key: 'clientName' },
            { header: 'Projects', key: 'count' },
            { header: 'Quoted Total', key: 'quoted' },
            { header: 'Received', key: 'received' },
            { header: 'Pending', key: 'pending' },
          ],
          rows: clients.map((c) => {
            const cProjs = scopedProjects.filter((p) => p.clientId === c.id);
            return {
              companyName: c.companyName,
              clientName: c.clientName,
              count: cProjs.length,
              quoted: formatCurrency(cProjs.reduce((s, p) => s + (p.quotedAmount || 0), 0)),
              received: formatCurrency(cProjs.reduce((s, p) => s + (p.totalReceived || 0), 0)),
              pending: formatCurrency(cProjs.reduce((s, p) => s + (p.pendingAmount || 0), 0)),
            };
          }),
        };

      case 'project_budget':
      case 'project_pnl':
      case 'financial_summary':
        return {
          title: label,
          columns: [
            { header: 'Project ID', key: 'projectCode' },
            { header: 'Project Name', key: 'projectName' },
            { header: 'Quoted', key: 'quoted' },
            { header: 'Budget', key: 'budget' },
            { header: 'Received', key: 'received' },
            { header: 'Expenses', key: 'expenses' },
            { header: 'Pending', key: 'pending' },
            { header: 'Net P&L', key: 'netProfit' },
          ],
          rows: scopedProjects.map((p) => {
            const fin = computeProjectFinancialSummary(p, expenses, invoices);
            return {
              projectCode: p.projectCode,
              projectName: p.projectName,
              quoted: formatCurrency(fin.quoted),
              budget: formatCurrency(fin.budget),
              received: formatCurrency(fin.received),
              expenses: formatCurrency(fin.expenses),
              pending: formatCurrency(fin.pending),
              netProfit: formatCurrency(fin.netProfit),
            };
          }),
        };

      case 'payment_pending':
        return {
          title: label,
          columns: [
            { header: 'Invoice #', key: 'invoiceNumber' },
            { header: 'Project', key: 'projectCode' },
            { header: 'Client', key: 'clientName' },
            { header: 'Total', key: 'amount' },
            { header: 'Paid', key: 'paid' },
            { header: 'Pending', key: 'pending' },
            { header: 'Due Date', key: 'dueDate' },
            { header: 'Status', key: 'status' },
          ],
          rows: invoices
            .filter((i) => i.status !== 'PAID')
            .map((i) => ({
              invoiceNumber: i.invoiceNumber,
              projectCode: i.projectCode || i.projectId,
              clientName: i.clientName || '—',
              amount: formatCurrency(i.amount),
              paid: formatCurrency(i.paidAmount),
              pending: formatCurrency(Math.max(0, i.amount - i.paidAmount)),
              dueDate: i.dueDate,
              status: i.status,
            })),
        };

      case 'employee_perf':
        return {
          title: label,
          columns: [
            { header: 'Employee ID', key: 'employeeId' },
            { header: 'Name', key: 'displayName' },
            { header: 'Department', key: 'department' },
            { header: 'Assigned Tasks', key: 'total' },
            { header: 'Completed', key: 'completed' },
            { header: 'On-Time %', key: 'onTimeRate' },
            { header: 'Score %', key: 'score' },
          ],
          rows: employees
            .filter((e) => e.role === 'TEAM_MEMBER')
            .map((e) => {
              const m = computeEmployeeProductivity(tasks, e.uid);
              return {
                employeeId: e.employeeId,
                displayName: e.displayName,
                department: e.department || '—',
                total: m.total,
                completed: m.completed,
                onTimeRate: `${m.onTimeRate}%`,
                score: `${m.score}%`,
              };
            }),
        };

      case 'admin_perf':
        return {
          title: label,
          columns: [
            { header: 'Lead ID', key: 'employeeId' },
            { header: 'Operations Lead', key: 'displayName' },
            { header: 'Managed Projects', key: 'projCount' },
            { header: 'Completed Projects', key: 'doneCount' },
            { header: 'Avg Project Progress', key: 'avgProgress' },
          ],
          rows: admins.map((a) => {
            const aProjs = scopedProjects.filter((p) => p.assignedAdminUid === a.uid);
            const avg =
              aProjs.length > 0
                ? Math.round(aProjs.reduce((s, p) => s + p.progress, 0) / aProjs.length)
                : 0;
            return {
              employeeId: a.employeeId,
              displayName: a.displayName,
              projCount: aProjs.length,
              doneCount: aProjs.filter((p) => p.status === 'Completed').length,
              avgProgress: `${avg}%`,
            };
          }),
        };

      case 'task_completion':
      case 'overdue_tasks':
      case 'deadline_compliance': {
        const filtered =
          reportId === 'overdue_tasks'
            ? scopedTasks.filter((t) => isDateOverdue(t.dueDate, t.status === 'Completed'))
            : scopedTasks;
        return {
          title: label,
          columns: [
            { header: 'Task ID', key: 'taskCode' },
            { header: 'Title', key: 'title' },
            { header: 'Project', key: 'projectCode' },
            { header: 'Assignee', key: 'assigneeName' },
            { header: 'Status', key: 'status' },
            { header: 'Progress', key: 'progress' },
            { header: 'Due Date', key: 'dueDate' },
            { header: 'SLA', key: 'sla' },
          ],
          rows: filtered.map((t) => ({
            taskCode: t.taskCode,
            title: t.title,
            projectCode: t.projectCode || t.projectId,
            assigneeName: t.assigneeName || '—',
            status: t.status,
            progress: `${t.progress}%`,
            dueDate: t.dueDate,
            sla: isDateOverdue(t.dueDate, t.status === 'Completed') ? 'OVERDUE' : 'ON_TRACK',
          })),
        };
      }

      case 'audit_trail':
        return {
          title: label,
          columns: [
            { header: 'Timestamp', key: 'time' },
            { header: 'Actor', key: 'actorEmail' },
            { header: 'Role', key: 'actorRole' },
            { header: 'Action', key: 'action' },
            { header: 'Resource', key: 'resource' },
            { header: 'Summary', key: 'summary' },
          ],
          rows: auditLogs.map((a) => ({
            time: formatTimestampLocal(a.createdAt),
            actorEmail: a.actorEmail || a.actorUid,
            actorRole: a.actorRole,
            action: a.action,
            resource: `${a.resourceType}:${a.resourceId}`,
            summary: a.summary,
          })),
        };
    }
  }, [reportId, scopedProjects, scopedTasks, clients, expenses, invoices, employees, admins, tasks, auditLogs]);

  const fileSlug = `dsr_${reportId}_${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Enterprise Reports & Exports</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Live database intelligence with CSV, Excel (.xlsx), and PDF exports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportReportToCsv(fileSlug, columns, rows)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => exportReportToExcel(fileSlug, title, columns, rows)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() =>
              exportReportToPdf(
                fileSlug,
                title,
                `DSR SecureTech · Records: ${rows.length}`,
                columns,
                rows
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" /> PDF Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-surface rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <div className="lg:col-span-2">
          <label className="block text-gray-400 mb-1">Report Type</label>
          <select
            value={reportId}
            onChange={(e) => setReportId(e.target.value as ReportId)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
          >
            {REPORT_TYPES.filter((r) =>
              effectiveRole === 'SUPER_ADMIN'
                ? true
                : !['audit_trail', 'admin_perf'].includes(r.id)
            ).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Client</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Operations Lead</label>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
          >
            <option value="ALL">All Leads</option>
            {admins.map((a) => (
              <option key={a.uid} value={a.uid}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Project Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
          >
            <option value="ALL">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="glass-surface rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="font-mono text-xs text-emerald-400">{rows.length} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="py-3 px-4 font-medium whitespace-nowrap">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-gray-400">
                    No records match the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    {columns.map((c) => (
                      <td key={c.key} className="py-2.5 px-4 text-gray-200 font-mono tabular-nums whitespace-nowrap">
                        {String(r[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
