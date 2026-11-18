import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Calendar, Clock, Megaphone, ShieldAlert } from 'lucide-react';
import { CommandCore3D } from '../components/CommandCore3D';
import {
  Announcement,
  AppPage,
  Client,
  Project,
  ProjectExpense,
  ProjectInvoice,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  computeEmployeeProductivity,
  daysUntil,
  formatCurrency,
  isDateApproaching,
  isDateOverdue,
} from '../utils/calculations';

interface DashboardOverviewProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  employees: UserProfile[];
  expenses: ProjectExpense[];
  invoices: ProjectInvoice[];
  announcements: Announcement[];
  onNavigate: (page: AppPage) => void;
}

const CHART_COLORS = ['#10B981', '#D4AF37', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  clients,
  tasks,
  employees,
  expenses,
  invoices,
  announcements,
  onNavigate,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Scoped datasets by role
  const scopedProjects =
    effectiveRole === 'SUPER_ADMIN'
      ? projects.filter((p) => !p.isArchived)
      : effectiveRole === 'ADMIN'
      ? projects.filter((p) => !p.isArchived && p.assignedAdminUid === effectiveUser.uid)
      : projects.filter(
          (p) => !p.isArchived && p.assignedMemberUids.includes(effectiveUser.uid)
        );

  const scopedTasks =
    effectiveRole === 'SUPER_ADMIN'
      ? tasks
      : effectiveRole === 'ADMIN'
      ? tasks.filter((t) => t.assignedAdminUid === effectiveUser.uid)
      : tasks.filter((t) => t.assigneeUid === effectiveUser.uid);

  // Super Admin financial & org metrics
  const totalBudget = scopedProjects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalRevenue = scopedProjects.reduce((s, p) => s + (Number(p.totalReceived) || 0), 0);
  const pendingPayments = scopedProjects.reduce((s, p) => s + (Number(p.pendingAmount) || 0), 0);

  const activeProjects = scopedProjects.filter(
    (p) => !['Completed', 'Cancelled'].includes(p.status)
  );
  const completedProjects = scopedProjects.filter((p) => p.status === 'Completed');
  const pendingProjects = scopedProjects.filter((p) =>
    ['Lead Received', 'Proposal Sent', 'Awaiting Approval', 'Planning', 'On Hold'].includes(p.status)
  );
  const overdueProjects = scopedProjects.filter((p) =>
    isDateOverdue(p.expectedCompletionDate, p.status === 'Completed' || p.status === 'Cancelled')
  );

  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
  const avgProductivity =
    activeEmployees.length > 0
      ? Math.round(
          activeEmployees.reduce(
            (acc, emp) => acc + computeEmployeeProductivity(tasks, emp.uid).score,
            0
          ) / activeEmployees.length
        )
      : 0;

  // Task metrics for Admin & Team Member
  const pendingTasks = scopedTasks.filter((t) => t.status !== 'Completed');
  const overdueTasks = scopedTasks.filter((t) =>
    isDateOverdue(t.dueDate, t.status === 'Completed')
  );
  const todaysTasks = scopedTasks.filter((t) => t.dueDate === todayStr && t.status !== 'Completed');
  const completedTasks = scopedTasks.filter((t) => t.status === 'Completed');
  const pendingApprovalTasks = scopedTasks.filter((t) => t.status === 'Under Review');
  const myProductivity = computeEmployeeProductivity(tasks, effectiveUser.uid);

  const upcomingDeadlines = [
    ...scopedProjects
      .filter(
        (p) =>
          p.expectedCompletionDate &&
          p.status !== 'Completed' &&
          p.status !== 'Cancelled'
      )
      .map((p) => ({
        id: p.id,
        code: p.projectCode,
        title: p.projectName,
        dueDate: p.expectedCompletionDate || '',
        kind: 'Project',
        priority: p.priority,
      })),
    ...scopedTasks
      .filter((t) => t.status !== 'Completed')
      .map((t) => ({
        id: t.id,
        code: t.taskCode,
        title: t.title,
        dueDate: t.dueDate,
        kind: 'Task',
        priority: t.priority,
      })),
  ]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  // Chart Data
  const financialChartData = scopedProjects.slice(0, 6).map((p) => {
    const pExp = expenses
      .filter((e) => e.projectId === p.id)
      .reduce((acc, e) => acc + e.amount, 0);
    return {
      name: p.projectCode.replace('DSR-PRJ-2026-', 'PRJ-'),
      Received: p.totalReceived || 0,
      Pending: p.pendingAmount || 0,
      Expenses: pExp,
    };
  });

  const statusCounts = scopedProjects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const teamPerfData = employees
    .filter((e) =>
      effectiveRole === 'ADMIN'
        ? e.managerUid === effectiveUser.uid || e.uid === effectiveUser.uid
        : e.role === 'TEAM_MEMBER'
    )
    .slice(0, 6)
    .map((emp) => {
      const m = computeEmployeeProductivity(tasks, emp.uid);
      return {
        name: emp.displayName.split(' ')[0],
        Score: m.score,
        Completed: m.completed,
        Assigned: m.total,
      };
    });

  const overdueInvoicesCount = invoices.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      {/* Top Executive Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-emerald-400">
            Enterprise Command &amp; 3D Operational Telemetry
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white mt-1">
            Welcome back, {effectiveUser.displayName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {effectiveRole !== 'TEAM_MEMBER' && (
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 transition-colors whitespace-nowrap"
            >
              Manage Projects
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors whitespace-nowrap"
          >
            Task Workbench
          </button>
        </div>
      </div>

      {/* Role-Specific Primary KPI Grid */}
      {effectiveRole === 'SUPER_ADMIN' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KpiCard label="Total Projects" value={scopedProjects.length} sub={`${activeProjects.length} active · ${completedProjects.length} done`} />
          <KpiCard label="Pending / Overdue" value={`${pendingProjects.length} / ${overdueProjects.length}`} accent={overdueProjects.length > 0 ? 'amber' : 'default'} sub="Awaiting phase or past due" />
          <KpiCard label="Total Clients" value={clients.filter((c) => c.status === 'ACTIVE').length} sub={`${clients.length} total accounts`} />
          <KpiCard label="Approved Budget" value={formatCurrency(totalBudget)} sub={`Expenses: ${formatCurrency(totalExpenses)}`} />
          <KpiCard label="Revenue & Pending" value={formatCurrency(totalRevenue)} accent="emerald" sub={`Pending: ${formatCurrency(pendingPayments)} · ${overdueInvoicesCount} overdue inv`} />
          <KpiCard label="Total Workforce" value={activeEmployees.length} sub={`Avg productivity: ${avgProductivity}%`} />
          <KpiCard label="Active Tasks" value={pendingTasks.length} sub={`${overdueTasks.length} overdue · ${pendingApprovalTasks.length} review`} />
          <KpiCard label="Net Operating P&L" value={formatCurrency(totalRevenue - totalExpenses)} accent={totalRevenue >= totalExpenses ? 'emerald' : 'amber'} sub="Received minus expenses" />
          <KpiCard label="Upcoming Deadlines" value={upcomingDeadlines.filter((d) => isDateApproaching(d.dueDate, 5)).length} accent="gold" sub="Due within 5 days" />
          <KpiCard label="Task Completion" value={`${scopedTasks.length > 0 ? Math.round((completedTasks.length / scopedTasks.length) * 100) : 0}%`} sub={`${completedTasks.length}/${scopedTasks.length} tasks closed`} />
        </section>
      )}

      {effectiveRole === 'ADMIN' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KpiCard label="Assigned Projects" value={scopedProjects.length} sub={`${activeProjects.length} running`} />
          <KpiCard label="Completed Projects" value={completedProjects.length} accent="emerald" sub="Delivered engagements" />
          <KpiCard label="Pending Tasks" value={pendingTasks.length} sub={`${pendingApprovalTasks.length} awaiting review`} />
          <KpiCard label="Overdue Tasks" value={overdueTasks.length} accent={overdueTasks.length > 0 ? 'amber' : 'default'} sub="Requires attention" />
          <KpiCard label="Team Completion" value={`${scopedTasks.length > 0 ? Math.round((completedTasks.length / scopedTasks.length) * 100) : 0}%`} accent="gold" sub={`${upcomingDeadlines.length} upcoming deadlines`} />
        </section>
      )}

      {effectiveRole === 'TEAM_MEMBER' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KpiCard label="My Assigned Tasks" value={scopedTasks.length} sub={`${todaysTasks.length} due today`} />
          <KpiCard label="Pending Approval" value={pendingApprovalTasks.length} accent="gold" sub="Submitted under review" />
          <KpiCard label="Overdue Tasks" value={overdueTasks.length} accent={overdueTasks.length > 0 ? 'amber' : 'default'} sub="Immediate priority" />
          <KpiCard label="Completed Tasks" value={completedTasks.length} accent="emerald" sub={`${scopedProjects.length} active projects`} />
          <KpiCard label="My Performance" value={`${myProductivity.score}%`} accent="emerald" sub={`On-time rate: ${myProductivity.onTimeRate}%`} />
        </section>
      )}

      {/* Primary Focal Visual Anchor: 3D Command Core + Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-7">
          <CommandCore3D
            projects={scopedProjects}
            heightClass="h-[440px] lg:h-[470px]"
            onInspectProject={() => onNavigate('projects')}
          />
        </div>

        <div className="xl:col-span-5 glass-surface rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {effectiveRole === 'SUPER_ADMIN'
                  ? 'Project Financial Cashflow'
                  : 'Team Velocity & Performance'}
              </h3>
              <p className="text-xs text-gray-400">
                {effectiveRole === 'SUPER_ADMIN'
                  ? 'Received revenue vs pending receivables and expenses'
                  : 'Weighted productivity and completed tasks by member'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(effectiveRole === 'SUPER_ADMIN' ? 'finance' : 'tasks')}
              className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[265px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {effectiveRole === 'SUPER_ADMIN' ? (
                <BarChart data={financialChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#11151C',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Received" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pending" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#64748B" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={teamPerfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#11151C',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Operational Row: Upcoming Deadlines + Status Breakdown + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Upcoming Deadlines */}
        <div className="lg:col-span-5 glass-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Upcoming & Overdue Deadlines</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('timeline')}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Timeline
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active deadlines scheduled.</p>
          ) : (
            <div className="divide-y divide-white/6">
              {upcomingDeadlines.map((item) => {
                const diff = daysUntil(item.dueDate);
                const overdue = diff !== null && diff < 0;
                return (
                  <div key={`${item.kind}-${item.id}`} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-100 truncate">{item.title}</p>
                      <p className="text-[11px] font-mono text-gray-400">
                        {item.code} · {item.kind} · {item.priority}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-mono tabular-nums font-medium ${
                          overdue ? 'text-red-400' : diff !== null && diff <= 5 ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {item.dueDate}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {diff === null
                          ? ''
                          : overdue
                          ? `${Math.abs(diff)}d overdue`
                          : diff === 0
                          ? 'Due today'
                          : `In ${diff}d`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Portfolio Status Breakdown */}
        <div className="lg:col-span-4 glass-surface rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Project Lifecycle Mix</h3>
          </div>
          {statusPieData.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No project records available.</p>
          ) : (
            <div className="flex-1 grid grid-cols-2 items-center gap-2">
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {statusPieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#11151C',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {statusPieData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-300 truncate">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="truncate">{entry.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-gray-200 font-semibold">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="lg:col-span-3 glass-surface rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Announcements</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              All
            </button>
          </div>
          {announcements.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No active directives.</p>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 3).map((ann) => (
                <div key={ann.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-100 truncate">{ann.title}</p>
                    {ann.priority === 'URGENT' && <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub: string;
  accent?: 'default' | 'emerald' | 'gold' | 'amber';
}> = ({ label, value, sub, accent = 'default' }) => {
  const borderClass =
    accent === 'emerald'
      ? 'glass-surface-emerald'
      : accent === 'gold'
      ? 'glass-surface-gold'
      : accent === 'amber'
      ? 'glass-surface border-red-500/30'
      : 'glass-surface';

  return (
    <div className={`${borderClass} spatial-card-3d rounded-xl p-4 space-y-1.5`}>
      <p className="text-xs text-gray-400 truncate">{label}</p>
      <p className="font-mono tabular-nums text-xl md:text-2xl font-bold text-white truncate">
        {value}
      </p>
      <p className="text-[11px] text-gray-400 truncate">{sub}</p>
    </div>
  );
};
