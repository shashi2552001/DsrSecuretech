import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import { where } from 'firebase/firestore';
import {
  addTaskAttachment,
  addTaskComment,
  createNotification,
  logAuditEvent,
  saveTask,
  submitExtensionRequest,
  subscribeCollection,
} from '../services/firestoreService';
import {
  PriorityLevel,
  Project,
  TASK_STATUSES,
  Task,
  TaskActivityLog,
  TaskAttachment,
  TaskComment,
  TaskStatus,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  formatTimestampLocal,
  generateNextTaskCode,
  generateSafeId,
  isDateOverdue,
  readFileAsDataUrl,
  validateUploadFile,
} from '../utils/calculations';

interface TasksPageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  tasks: Task[];
  employees: UserProfile[];
}

export const TasksPage: React.FC<TasksPageProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  tasks,
  employees,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const scopedProjects = projects.filter((p) => {
    if (p.isArchived) return false;
    if (effectiveRole === 'ADMIN') return p.assignedAdminUid === effectiveUser.uid;
    if (effectiveRole === 'TEAM_MEMBER') return p.assignedMemberUids.includes(effectiveUser.uid);
    return true;
  });

  const scopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (effectiveRole === 'ADMIN' && t.assignedAdminUid !== effectiveUser.uid) return false;
      if (effectiveRole === 'TEAM_MEMBER' && t.assigneeUid !== effectiveUser.uid) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (
        search.trim() &&
        !`${t.taskCode} ${t.title} ${t.projectName} ${t.assigneeName || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, effectiveRole, effectiveUser.uid, statusFilter, search]);

  const activeTask = selectedTask ? tasks.find((t) => t.id === selectedTask.id) || selectedTask : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {effectiveRole === 'TEAM_MEMBER' ? 'My Assigned Tasks' : 'Task Delegation & Review'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {scopedTasks.length} tasks · Weighted completion automatically updates parent project progress
          </p>
        </div>

        {(effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Assign New Task
          </button>
        )}
      </div>

      {statusBanner && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button type="button" onClick={() => setStatusBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="glass-surface rounded-xl p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by ID (DSR-TSK-...), title, project, assignee..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Tasks Table */}
      <div className="glass-surface rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
              <tr>
                <th className="py-3 px-4 font-medium">Task ID</th>
                <th className="py-3 px-4 font-medium">Deliverable & Project</th>
                <th className="py-3 px-4 font-medium">Assignee</th>
                <th className="py-3 px-4 font-medium">Priority</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Progress</th>
                <th className="py-3 px-4 font-medium text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {scopedTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    No tasks found for this filter.
                  </td>
                </tr>
              ) : (
                scopedTasks.map((task) => {
                  const overdue = isDateOverdue(task.dueDate, task.status === 'Completed');
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-gray-300 whitespace-nowrap">
                        {task.taskCode}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-medium text-white truncate">{task.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {task.projectCode} · {task.projectName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                        {task.assigneeName || task.assigneeUid}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span
                          className={
                            task.priority === 'CRITICAL'
                              ? 'text-red-400'
                              : task.priority === 'HIGH'
                              ? 'text-amber-300'
                              : 'text-gray-300'
                          }
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={
                            task.status === 'Completed'
                              ? 'text-emerald-400 font-medium'
                              : task.status === 'Blocked' || task.status === 'Revision Required'
                              ? 'text-red-400 font-medium'
                              : task.status === 'Under Review'
                              ? 'text-amber-300 font-medium'
                              : 'text-gray-300'
                          }
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {task.progress}%
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                          overdue ? 'text-red-400 font-semibold' : 'text-gray-300'
                        }`}
                      >
                        {task.dueDate}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <CreateTaskModal
          projects={scopedProjects}
          employees={employees}
          existingTasks={tasks}
          effectiveUser={effectiveUser}
          onClose={() => setCreating(false)}
          onCreated={(msg) => {
            setCreating(false);
            setStatusBanner(msg);
          }}
        />
      )}

      {activeTask && (
        <TaskDetailDrawer
          task={activeTask}
          effectiveRole={effectiveRole}
          effectiveUser={effectiveUser}
          employees={employees}
          onClose={() => setSelectedTask(null)}
          onUpdated={(msg) => setStatusBanner(msg)}
        />
      )}
    </div>
  );
};

const CreateTaskModal: React.FC<{
  projects: Project[];
  employees: UserProfile[];
  existingTasks: Task[];
  effectiveUser: UserProfile;
  onClose: () => void;
  onCreated: (msg: string) => void;
}> = ({ projects, employees, existingTasks, effectiveUser, onClose, onCreated }) => {
  const members = employees.filter((e) => e.status === 'ACTIVE');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUid, setAssigneeUid] = useState(members.find((m) => m.role === 'TEAM_MEMBER')?.uid || members[0]?.uid || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [weight, setWeight] = useState('25');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find((p) => p.id === projectId);
    const assignee = members.find((m) => m.uid === assigneeUid);
    if (!project || !assignee) return;

    setSaving(true);
    try {
      const taskCode = generateNextTaskCode(existingTasks);
      const id = generateSafeId('tsk');
      await saveTask(
        {
          id,
          taskCode,
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          title: title.trim(),
          description: description.trim(),
          assignedByUid: effectiveUser.uid,
          assignedByName: effectiveUser.displayName,
          assignedAdminUid: project.assignedAdminUid,
          assigneeUid: assignee.uid,
          assigneeName: assignee.displayName,
          assignedDate: new Date().toISOString().slice(0, 10),
          startDate,
          dueDate,
          priority,
          status: 'Not Started',
          progress: 0,
          weight: Math.min(100, Math.max(1, Number(weight) || 20)),
        },
        true,
        effectiveUser.role,
        { uid: effectiveUser.uid, name: effectiveUser.displayName }
      );
      await createNotification({
        recipientUid: assignee.uid,
        type: 'TASK_ASSIGNED',
        title: `New Task Assigned: ${taskCode}`,
        message: `${title.trim()} (${project.projectName}) · Due ${dueDate}`,
        entityType: 'TASK',
        entityId: id,
      });
      onCreated(`Assigned ${taskCode} to ${assignee.displayName}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-surface max-w-xl w-full rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <h3 className="text-base font-bold text-white">Assign Deliverable Task</h3>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Project *</label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} · {p.projectName}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Penetration Test Payment Gateway APIs"
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Assign To *</label>
            <select
              required
              value={assigneeUid}
              onChange={(e) => setAssigneeUid(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            >
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName} ({m.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Priority & Weight (%)</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="px-2.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <input
                type="number"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="px-2.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Due Date *</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Detailed Instructions</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-gray-950"
          >
            {saving ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

const TaskDetailDrawer: React.FC<{
  task: Task;
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  employees: UserProfile[];
  onClose: () => void;
  onUpdated: (msg: string) => void;
}> = ({ task, effectiveRole, effectiveUser, employees, onClose, onUpdated }) => {
  const [progress, setProgress] = useState(task.progress);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [submissionNote, setSubmissionNote] = useState(task.submissionNote || '');
  const [blockerReason, setBlockerReason] = useState(task.blockerReason || '');
  const [reviewFeedback, setReviewFeedback] = useState(task.reviewFeedback || '');
  const [assigneeUid, setAssigneeUid] = useState(task.assigneeUid);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);

  const [commentText, setCommentText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [extDate, setExtDate] = useState(task.dueDate);
  const [extReason, setExtReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgress(task.progress);
    setStatus(task.status);
    setSubmissionNote(task.submissionNote || '');
    setBlockerReason(task.blockerReason || '');
    setReviewFeedback(task.reviewFeedback || '');
    setAssigneeUid(task.assigneeUid);
  }, [task]);

  useEffect(() => {
    const scopeConstraint =
      effectiveRole === 'SUPER_ADMIN'
        ? [where('taskId', '==', task.id)]
        : effectiveRole === 'ADMIN'
        ? [where('assignedAdminUid', '==', effectiveUser.uid)]
        : [where('assigneeUid', '==', effectiveUser.uid)];

    const u1 = subscribeCollection<TaskComment>(
      'task_comments',
      scopeConstraint,
      (rows) => setComments(rows.filter((r) => r.taskId === task.id))
    );
    const u2 = subscribeCollection<TaskAttachment>(
      'task_attachments',
      scopeConstraint,
      (rows) => setAttachments(rows.filter((r) => r.taskId === task.id))
    );
    const u3 = subscribeCollection<TaskActivityLog>(
      'task_activity_logs',
      scopeConstraint,
      (rows) => setActivityLogs(rows.filter((r) => r.taskId === task.id))
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [task.id, effectiveRole, effectiveUser.uid]);

  const handleSaveUpdate = async (overrideStatus?: TaskStatus, overrideProgress?: number) => {
    setSaving(true);
    try {
      const nextStatus = overrideStatus ?? status;
      const nextProgress = overrideProgress ?? progress;
      const newAssignee = employees.find((e) => e.uid === assigneeUid);

      await saveTask(
        {
          ...task,
          status: nextStatus,
          progress: nextStatus === 'Completed' ? 100 : nextProgress,
          submissionNote: submissionNote.trim(),
          blockerReason: blockerReason.trim(),
          reviewFeedback: reviewFeedback.trim(),
          assigneeUid: newAssignee?.uid || task.assigneeUid,
          assigneeName: newAssignee?.displayName || task.assigneeName,
        },
        false,
        effectiveRole,
        { uid: effectiveUser.uid, name: effectiveUser.displayName }
      );

      if (nextStatus === 'Under Review') {
        await createNotification({
          recipientUid: task.assignedAdminUid,
          type: 'TASK_SUBMITTED',
          title: `Task Submitted for Review: ${task.taskCode}`,
          message: `${effectiveUser.displayName} submitted "${task.title}"`,
          entityType: 'TASK',
          entityId: task.id,
        });
      } else if (nextStatus === 'Completed' || nextStatus === 'Revision Required') {
        await createNotification({
          recipientUid: task.assigneeUid,
          type: nextStatus === 'Completed' ? 'TASK_APPROVED' : 'TASK_REJECTED',
          title: `Task ${nextStatus === 'Completed' ? 'Approved' : 'Needs Revision'}: ${task.taskCode}`,
          message: reviewFeedback.trim() || task.title,
          entityType: 'TASK',
          entityId: task.id,
        });
      }

      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveRole,
        action: `TASK_${nextStatus.toUpperCase().replace(/\s+/g, '_')}`,
        resourceType: 'TASK',
        resourceId: task.id,
        summary: `${task.taskCode} updated to ${nextStatus} (${nextProgress}%)`,
      });
      onUpdated(`Updated ${task.taskCode} -> ${nextStatus}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addTaskComment({
      id: generateSafeId('cmt'),
      taskId: task.id,
      projectId: task.projectId,
      assignedAdminUid: task.assignedAdminUid,
      assigneeUid: task.assigneeUid,
      authorUid: effectiveUser.uid,
      authorName: effectiveUser.displayName,
      authorRole: effectiveRole,
      message: commentText.trim(),
    });
    setCommentText('');
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateUploadFile(file);
    if (!check.ok) {
      setUploadError(check.error || 'File validation failed.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    await addTaskAttachment({
      id: generateSafeId('att'),
      taskId: task.id,
      projectId: task.projectId,
      assignedAdminUid: task.assignedAdminUid,
      assigneeUid: task.assigneeUid,
      uploadedByUid: effectiveUser.uid,
      uploadedByName: effectiveUser.displayName,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      dataUrl,
    });
    e.target.value = '';
  };

  const handleSubmitExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extDate || !extReason.trim()) return;
    await submitExtensionRequest({
      id: generateSafeId('ext'),
      targetType: 'TASK',
      targetId: task.id,
      targetTitle: `${task.taskCode} · ${task.title}`,
      projectId: task.projectId,
      assignedAdminUid: task.assignedAdminUid,
      requesterUid: effectiveUser.uid,
      requesterName: effectiveUser.displayName,
      currentDueDate: task.dueDate,
      requestedDueDate: extDate,
      reason: extReason.trim(),
      status: 'PENDING',
    });
    await createNotification({
      recipientUid: task.assignedAdminUid,
      type: 'EXTENSION_REQUESTED',
      title: `Extension Requested: ${task.taskCode}`,
      message: `${effectiveUser.displayName} requested extension to ${extDate}`,
      entityType: 'TASK',
      entityId: task.id,
    });
    setExtOpen(false);
    setExtReason('');
    onUpdated(`Extension request sent for ${task.taskCode}.`);
  };

  const memberCannotEditCompleted =
    effectiveRole === 'TEAM_MEMBER' && task.status === 'Completed';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-surface max-w-4xl w-full rounded-2xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="text-xs font-mono text-emerald-400">
              {task.taskCode} · {task.projectCode} · Weight {task.weight}%
            </p>
            <h2 className="text-xl font-bold text-white mt-1">{task.title}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Project: {task.projectName} · Assigned by {task.assignedByName || 'Admin'} · Due {task.dueDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {task.description && (
          <p className="text-xs text-gray-300 bg-white/[0.03] border border-white/6 rounded-xl p-4 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Controls Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Progress & Status</span>
              <span className="font-mono text-emerald-400 font-bold">{progress}%</span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              disabled={memberCannotEditCompleted}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">Status</label>
                <select
                  disabled={memberCannotEditCompleted}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-2.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                >
                  {TASK_STATUSES.filter((s) =>
                    effectiveRole === 'TEAM_MEMBER'
                      ? !['Completed', 'Revision Required'].includes(s) || s === task.status
                      : true
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {effectiveRole !== 'TEAM_MEMBER' && (
                <div>
                  <label className="block text-gray-400 mb-1">Reassign Member</label>
                  <select
                    value={assigneeUid}
                    onChange={(e) => setAssigneeUid(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                  >
                    {employees
                      .filter((e) => e.status === 'ACTIVE')
                      .map((e) => (
                        <option key={e.uid} value={e.uid}>
                          {e.displayName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Submission / Work Notes</label>
              <textarea
                rows={2}
                disabled={memberCannotEditCompleted}
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                placeholder="Summarize completed deliverables or test coverage..."
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
              />
            </div>

            {status === 'Blocked' && (
              <div>
                <label className="block text-red-300 mb-1">Blocker Description</label>
                <input
                  type="text"
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  placeholder="Describe dependency or access blocker..."
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-red-500/40 text-white"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!memberCannotEditCompleted && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveUpdate()}
                    className="px-3.5 py-2 rounded-lg font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950"
                  >
                    Save Progress
                  </button>
                  {effectiveRole === 'TEAM_MEMBER' && status !== 'Under Review' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveUpdate('Under Review', 100)}
                      className="px-3.5 py-2 rounded-lg font-semibold bg-amber-500 hover:bg-amber-400 text-gray-950"
                    >
                      Submit for Review
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExtOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200"
                  >
                    <Clock className="w-3.5 h-3.5" /> Request Extension
                  </button>
                </>
              )}
            </div>

            {extOpen && (
              <form onSubmit={handleSubmitExtension} className="pt-3 border-t border-white/10 space-y-2">
                <input
                  type="date"
                  required
                  value={extDate}
                  onChange={(e) => setExtDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-black/50 border border-white/15 text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Reason for deadline extension..."
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-black/50 border border-white/15 text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-amber-500 text-gray-950 font-semibold"
                >
                  Send Request
                </button>
              </form>
            )}
          </div>

          {/* Admin Review + Deliverable Attachments */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-2.5">
              <p className="font-semibold text-white">Review & Feedback</p>
              {task.reviewFeedback && effectiveRole === 'TEAM_MEMBER' && (
                <p className="text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                  Admin Feedback: {task.reviewFeedback}
                </p>
              )}
              {effectiveRole !== 'TEAM_MEMBER' ? (
                <>
                  <textarea
                    rows={2}
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Add review feedback for assignee..."
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveUpdate('Completed', 100)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-gray-950 font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Complete
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveUpdate('Revision Required', Math.min(progress, 80))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 font-semibold"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Request Revision
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-400">
                  Submit completed work above for engagement lead review and sign-off.
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Attachments ({attachments.length})</span>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-emerald-300 cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" /> Attach File
                  <input type="file" onChange={handleUploadAttachment} className="hidden" />
                </label>
              </div>
              {uploadError && <p className="text-red-400">{uploadError}</p>}
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between gap-2 py-1 border-t border-white/6">
                  <span className="truncate text-gray-300">
                    {att.fileName} ({Math.round(att.fileSize / 1024)} KB)
                  </span>
                  {att.dataUrl && (
                    <a
                      href={att.dataUrl}
                      download={att.fileName}
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Get
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comments & Activity History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-white">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Comments ({comments.length})
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg bg-black/40 border border-white/6">
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span className="font-semibold text-gray-200">{c.authorName}</span>
                    <span>{formatTimestampLocal(c.createdAt)}</span>
                  </div>
                  <p className="text-gray-300 mt-1">{c.message}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-gray-950 font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-2.5">
            <p className="font-semibold text-white">Activity History ({activityLogs.length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activityLogs.length === 0 ? (
                <p className="text-gray-500">No transitions logged yet.</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="border-b border-white/6 pb-1.5">
                    <p className="text-gray-200 font-medium">{log.action}</p>
                    <p className="text-[11px] text-gray-400">
                      {log.actorName} · {formatTimestampLocal(log.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
