import React, { useState } from 'react';
import { Bell, Check, CheckCircle2, Clock, Megaphone, XCircle } from 'lucide-react';
import {
  createNotification,
  decideExtensionRequest,
  logAuditEvent,
  markNotificationRead,
  publishAnnouncement,
} from '../services/firestoreService';
import {
  Announcement,
  DeadlineExtensionRequest,
  NotificationItem,
  Project,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  formatTimestampLocal,
  generateSafeId,
  isDateApproaching,
  isDateOverdue,
} from '../utils/calculations';

interface NotificationsPageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  notifications: NotificationItem[];
  extensionRequests: DeadlineExtensionRequest[];
  announcements: Announcement[];
  projects: Project[];
  tasks: Task[];
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  effectiveRole,
  effectiveUser,
  notifications,
  extensionRequests,
  announcements,
  projects,
  tasks,
}) => {
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annPriority, setAnnPriority] = useState<Announcement['priority']>('IMPORTANT');
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [emailAlertsPref, setEmailAlertsPref] = useState(true);

  const myNotifications = notifications.filter(
    (n) => n.recipientUid === effectiveUser.uid || effectiveRole === 'SUPER_ADMIN'
  );

  const visibleExtensions = extensionRequests.filter((r) => {
    if (effectiveRole === 'SUPER_ADMIN') return true;
    if (effectiveRole === 'ADMIN') return r.assignedAdminUid === effectiveUser.uid || r.requesterUid === effectiveUser.uid;
    return r.requesterUid === effectiveUser.uid;
  });

  const handleScanDeadlines = async () => {
    let created = 0;
    for (const t of tasks) {
      if (t.status === 'Completed') continue;
      if (isDateOverdue(t.dueDate)) {
        await createNotification({
          recipientUid: t.assigneeUid,
          type: 'TASK_OVERDUE',
          title: `Overdue Task Alert: ${t.taskCode}`,
          message: `"${t.title}" passed its due date (${t.dueDate}).`,
          entityType: 'TASK',
          entityId: t.id,
        });
        created++;
      } else if (isDateApproaching(t.dueDate, 5)) {
        await createNotification({
          recipientUid: t.assigneeUid,
          type: 'DEADLINE_APPROACHING',
          title: `Deadline Approaching: ${t.taskCode}`,
          message: `"${t.title}" is due on ${t.dueDate}.`,
          entityType: 'TASK',
          entityId: t.id,
        });
        created++;
      }
    }
    for (const p of projects) {
      if (p.status === 'Completed' || p.status === 'Cancelled') continue;
      if (isDateApproaching(p.expectedCompletionDate, 5)) {
        await createNotification({
          recipientUid: p.assignedAdminUid,
          type: 'DEADLINE_APPROACHING',
          title: `Project Deadline Approaching: ${p.projectCode}`,
          message: `${p.projectName} expected delivery is ${p.expectedCompletionDate}.`,
          entityType: 'PROJECT',
          entityId: p.id,
        });
        created++;
      }
    }
    setScanMsg(`Generated ${created} real-time deadline alert notifications.`);
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMsg.trim()) return;
    const id = generateSafeId('ann');
    await publishAnnouncement({
      id,
      title: annTitle.trim(),
      message: annMsg.trim(),
      priority: annPriority,
      authorUid: effectiveUser.uid,
      authorName: effectiveUser.displayName,
      isActive: true,
    });
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: 'ANNOUNCEMENT_PUBLISHED',
      resourceType: 'ANNOUNCEMENT',
      resourceId: id,
      summary: annTitle.trim(),
    });
    setAnnTitle('');
    setAnnMsg('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Notifications & Deadline Intelligence</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            In-app alerts, extension approval queue, and organization-wide announcements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={emailAlertsPref}
              onChange={(e) => setEmailAlertsPref(e.target.checked)}
              className="accent-emerald-500"
            />
            Email Digest Enabled
          </label>
          {effectiveRole !== 'TEAM_MEMBER' && (
            <button
              type="button"
              onClick={handleScanDeadlines}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" /> Run Deadline Alert Scan
            </button>
          )}
        </div>
      </div>

      {scanMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-200">
          {scanMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notifications Feed */}
        <div className="lg:col-span-7 glass-surface rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/8 pb-3">
            <Bell className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Notification History ({myNotifications.length})</h3>
          </div>
          {myNotifications.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No notifications recorded.</p>
          ) : (
            <div className="divide-y divide-white/6 max-h-[460px] overflow-y-auto">
              {myNotifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-white">{n.title}</span>
                      {!n.isRead && <span className="font-mono text-[10px] text-amber-300">UNREAD</span>}
                    </div>
                    <p className="text-xs text-gray-400">{n.message}</p>
                    <p className="text-[11px] font-mono text-gray-500">
                      {n.type} · {formatTimestampLocal(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id, true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-emerald-300 shrink-0"
                    >
                      <Check className="w-3 h-3" /> Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extension Requests + Announcements */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Deadline Extension Requests ({visibleExtensions.length})
            </h3>
            {visibleExtensions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4">No extension requests.</p>
            ) : (
              <div className="space-y-2.5">
                {visibleExtensions.map((req) => (
                  <div key={req.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{req.targetTitle || req.targetId}</span>
                      <span
                        className={`font-mono text-[11px] ${
                          req.status === 'APPROVED'
                            ? 'text-emerald-400'
                            : req.status === 'REJECTED'
                            ? 'text-red-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-gray-400">
                      By {req.requesterName} · {req.currentDueDate} → <span className="text-white">{req.requestedDueDate}</span>
                    </p>
                    <p className="text-gray-300">{req.reason}</p>
                    {req.status === 'PENDING' && effectiveRole !== 'TEAM_MEMBER' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            decideExtensionRequest({
                              request: req,
                              decision: 'APPROVED',
                              reviewerUid: effectiveUser.uid,
                              reviewNote: 'Approved by lead.',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 text-gray-950 font-semibold"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            decideExtensionRequest({
                              request: req,
                              decision: 'REJECTED',
                              reviewerUid: effectiveUser.uid,
                              reviewNote: 'Original SLA deadline maintained.',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 text-red-200 font-semibold"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-surface rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Organization Announcements</h3>
            </div>
            {effectiveRole === 'SUPER_ADMIN' && (
              <form onSubmit={handlePublishAnnouncement} className="space-y-2 text-xs pb-3 border-b border-white/8">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Announcement title..."
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="col-span-2 px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white"
                  />
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as Announcement['priority'])}
                    className="px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="IMPORTANT">IMPORTANT</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Broadcast message to all personnel..."
                  value={annMsg}
                  onChange={(e) => setAnnMsg(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-gray-950 font-semibold"
                >
                  Broadcast Announcement
                </button>
              </form>
            )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {announcements.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-white">{a.title}</span>
                    <span className="font-mono text-[10px] text-amber-300">{a.priority}</span>
                  </div>
                  <p className="text-gray-300">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
