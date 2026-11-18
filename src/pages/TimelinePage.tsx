import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CalendarDays, CheckCircle2, Columns3, Flag, GanttChartSquare } from 'lucide-react';
import { saveTask } from '../services/firestoreService';
import {
  Milestone,
  Project,
  TASK_STATUSES,
  Task,
  TaskStatus,
  UserProfile,
  UserRole,
} from '../types/domain';
import { isDateOverdue } from '../utils/calculations';

interface TimelinePageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
}

type TimelineTab = 'gantt' | 'kanban' | 'calendar' | 'milestones' | 'graph';

export const TimelinePage: React.FC<TimelinePageProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  tasks,
  milestones,
}) => {
  const [tab, setTab] = useState<TimelineTab>('gantt');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');

  const scopedProjects = useMemo(
    () =>
      projects.filter((p) => {
        if (p.isArchived) return false;
        if (effectiveRole === 'ADMIN') return p.assignedAdminUid === effectiveUser.uid;
        if (effectiveRole === 'TEAM_MEMBER') return p.assignedMemberUids.includes(effectiveUser.uid);
        return true;
      }),
    [projects, effectiveRole, effectiveUser.uid]
  );

  const scopedTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (effectiveRole === 'ADMIN' && t.assignedAdminUid !== effectiveUser.uid) return false;
        if (effectiveRole === 'TEAM_MEMBER' && t.assigneeUid !== effectiveUser.uid) return false;
        if (selectedProjectId !== 'ALL' && t.projectId !== selectedProjectId) return false;
        return true;
      }),
    [tasks, effectiveRole, effectiveUser.uid, selectedProjectId]
  );

  const scopedMilestones = useMemo(
    () =>
      milestones.filter((m) => {
        if (effectiveRole === 'ADMIN' && m.assignedAdminUid !== effectiveUser.uid) return false;
        if (effectiveRole === 'TEAM_MEMBER' && !m.projectMemberUids.includes(effectiveUser.uid))
          return false;
        if (selectedProjectId !== 'ALL' && m.projectId !== selectedProjectId) return false;
        return true;
      }),
    [milestones, effectiveRole, effectiveUser.uid, selectedProjectId]
  );

  // Calendar setup for current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const handleKanbanAdvance = async (task: Task, nextStatus: TaskStatus) => {
    if (effectiveRole === 'TEAM_MEMBER' && task.status === 'Completed') return;
    await saveTask(
      {
        ...task,
        status: nextStatus,
        progress: nextStatus === 'Completed' ? 100 : nextStatus === 'Under Review' ? 95 : task.progress,
      },
      false,
      effectiveRole,
      { uid: effectiveUser.uid, name: effectiveUser.displayName }
    );
  };

  const progressGraphData = scopedProjects.map((p) => ({
    name: p.projectCode.replace('DSR-PRJ-2026-', 'PRJ-'),
    Progress: p.progress,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Timeline & Execution Views</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gantt schedule, Kanban workflow, deadline calendar, milestones, and weighted progress graphs
          </p>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
        >
          <option value="ALL">All Visible Projects</option>
          {scopedProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode} · {p.projectName}
            </option>
          ))}
        </select>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white/[0.03] border border-white/8 w-fit">
        {(
          [
            { id: 'gantt', label: 'Gantt Chart', icon: GanttChartSquare },
            { id: 'kanban', label: 'Kanban Board', icon: Columns3 },
            { id: 'calendar', label: 'Calendar View', icon: CalendarDays },
            { id: 'milestones', label: 'Milestones', icon: Flag },
            { id: 'graph', label: 'Progress Graph', icon: CheckCircle2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-emerald-500 text-gray-950 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* GANTT VIEW */}
      {tab === 'gantt' && (
        <div className="glass-surface rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Project Lifecycle & Schedule Span</h3>
          <div className="space-y-3">
            {scopedProjects
              .filter((p) => selectedProjectId === 'ALL' || p.id === selectedProjectId)
              .map((p) => {
                const start = p.startDate || p.receivedDate || '—';
                const end = p.expectedCompletionDate || '—';
                return (
                  <div key={p.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/6 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-white">
                        <span className="font-mono text-emerald-400 mr-2">{p.projectCode}</span>
                        {p.projectName}
                      </span>
                      <span className="font-mono text-gray-400">
                        Rec: {p.receivedDate || '—'} · Plan: {p.planningDate || '—'} · Start: {start} · Delivery: {end}
                      </span>
                    </div>
                    <div className="h-4 rounded-md bg-black/50 border border-white/8 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 flex items-center justify-end pr-2 text-[10px] font-mono font-bold text-gray-950"
                        style={{ width: `${Math.max(8, p.progress)}%` }}
                      >
                        {p.progress}%
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* KANBAN VIEW */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TASK_STATUSES.map((statusCol) => {
            const colTasks = scopedTasks.filter((t) => t.status === statusCol);
            return (
              <div key={statusCol} className="glass-surface rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/8 pb-2">
                  <span className="text-xs font-semibold text-white">{statusCol}</span>
                  <span className="font-mono text-xs text-emerald-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <p className="text-[11px] text-gray-500 py-4 text-center">Empty column</p>
                  ) : (
                    colTasks.map((t) => {
                      const nextCandidate: TaskStatus | null =
                        statusCol === 'Not Started'
                          ? 'In Progress'
                          : statusCol === 'In Progress'
                          ? 'Under Review'
                          : statusCol === 'Under Review' && effectiveRole !== 'TEAM_MEMBER'
                          ? 'Completed'
                          : statusCol === 'Revision Required'
                          ? 'In Progress'
                          : null;

                      return (
                        <div key={t.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 space-y-2 text-xs">
                          <div className="flex justify-between font-mono text-[11px] text-gray-400">
                            <span>{t.taskCode}</span>
                            <span className={isDateOverdue(t.dueDate, t.status === 'Completed') ? 'text-red-400' : ''}>
                              {t.dueDate}
                            </span>
                          </div>
                          <p className="font-medium text-gray-100">{t.title}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-gray-400">{t.assigneeName}</span>
                            {nextCandidate && (
                              <button
                                type="button"
                                onClick={() => handleKanbanAdvance(t, nextCandidate)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px]"
                              >
                                Move <ArrowRight className="w-3 h-3" /> {nextCandidate}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {tab === 'calendar' && (
        <div className="glass-surface rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {now.toLocaleString(undefined, { month: 'long', year: 'numeric' })} Deadline Calendar
            </h3>
            <span className="text-xs text-gray-400">Tasks & Milestones plotted by due date</span>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-mono text-gray-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[78px] rounded-lg bg-black/20" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateIso = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
              const dayTasks = scopedTasks.filter((t) => t.dueDate === dateIso);
              const dayMilestones = scopedMilestones.filter((m) => m.dueDate === dateIso);
              const isToday = dateIso === now.toISOString().slice(0, 10);

              return (
                <div
                  key={dateIso}
                  className={`min-h-[82px] rounded-lg p-1.5 border text-left space-y-1 ${
                    isToday ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-white/6 bg-white/[0.02]'
                  }`}
                >
                  <span className={`font-mono text-[11px] ${isToday ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                    {dayNum}
                  </span>
                  {dayMilestones.map((m) => (
                    <p key={m.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-amber-500/20 text-amber-200">
                      MS: {m.title}
                    </p>
                  ))}
                  {dayTasks.map((t) => (
                    <p key={t.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-200">
                      {t.taskCode}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MILESTONES */}
      {tab === 'milestones' && (
        <div className="glass-surface rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Milestone Tracker</h3>
          <div className="divide-y divide-white/6">
            {scopedMilestones.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-white">{m.title}</p>
                  <p className="text-gray-400">
                    {m.projectCode} · {m.deliverables || 'Milestone deliverable'}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-emerald-400">{m.status}</p>
                  <p className="text-gray-400">{m.dueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROGRESS GRAPH */}
      {tab === 'graph' && (
        <div className="glass-surface rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Weighted Project Completion Graph</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressGraphData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#11151C',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Progress" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
