import React, { useState } from 'react';
import { Activity, Download, Save, ShieldCheck } from 'lucide-react';
import {
  logAuditEvent,
  saveSystemSettings,
  updateOwnUserSafeFields,
} from '../services/firestoreService';
import {
  AuditLog,
  Project,
  SystemSetting,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import { computeEmployeeProductivity, formatTimestampLocal } from '../utils/calculations';
import { exportJsonBackup } from '../utils/exports';

interface AuditAndSettingsPageProps {
  mode: 'audit' | 'profile';
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  auditLogs: AuditLog[];
  settings: SystemSetting | null;
  projects: Project[];
  tasks: Task[];
}

export const AuditAndSettingsPage: React.FC<AuditAndSettingsPageProps> = ({
  mode,
  effectiveRole,
  effectiveUser,
  auditLogs,
  settings,
  projects,
  tasks,
}) => {
  const [companyName, setCompanyName] = useState(settings?.companyName || 'DSR SecureTech');
  const [currency, setCurrency] = useState(settings?.currency || 'USD');
  const [warningDays, setWarningDays] = useState(String(settings?.deadlineWarningDays ?? 5));
  const [emailEnabled, setEmailEnabled] = useState(settings?.emailNotificationsEnabled ?? true);
  const [enforceRotation, setEnforceRotation] = useState(settings?.enforcePasswordRotation ?? true);

  const [displayName, setDisplayName] = useState(effectiveUser.displayName);
  const [phone, setPhone] = useState(effectiveUser.phone || '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const perf = computeEmployeeProductivity(tasks, effectiveUser.uid);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveRole !== 'SUPER_ADMIN') return;
    await saveSystemSettings({
      id: 'org-primary',
      scope: 'public',
      companyName: companyName.trim(),
      currency,
      deadlineWarningDays: Math.min(30, Math.max(1, Number(warningDays) || 5)),
      emailNotificationsEnabled: emailEnabled,
      enforcePasswordRotation: enforceRotation,
      updatedByUid: effectiveUser.uid,
    });
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: 'SYSTEM_SETTINGS_UPDATED',
      resourceType: 'SETTINGS',
      resourceId: 'org-primary',
      summary: `Updated organization governance settings (${currency}, ${warningDays}d warning).`,
    });
    setSavedMsg('System settings saved and logged.');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOwnUserSafeFields(effectiveUser.uid, {
      displayName: displayName.trim(),
      phone: phone.trim(),
    });
    setSavedMsg('Profile updated successfully.');
  };

  if (mode === 'profile') {
    const myTasks = tasks.filter((t) => t.assigneeUid === effectiveUser.uid);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Performance & Profile</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Employee ID: <span className="font-mono text-emerald-400">{effectiveUser.employeeId}</span> · {effectiveUser.designation || effectiveUser.role}
          </p>
        </div>

        {savedMsg && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-200">
            {savedMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 glass-surface rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white">Profile Details</h3>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Email (SSO Bound)</label>
                <input
                  type="email"
                  disabled
                  value={effectiveUser.email}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-gray-400"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold"
              >
                <Save className="w-3.5 h-3.5" /> Update Profile
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 glass-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">My Delivery Performance</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/6">
                <p className="text-[11px] font-sans text-gray-400">Productivity</p>
                <p className="text-xl font-bold text-emerald-400">{perf.score}%</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/6">
                <p className="text-[11px] font-sans text-gray-400">On-Time Rate</p>
                <p className="text-xl font-bold text-white">{perf.onTimeRate}%</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/6">
                <p className="text-[11px] font-sans text-gray-400">Completed</p>
                <p className="text-xl font-bold text-emerald-400">{perf.completed}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/6">
                <p className="text-[11px] font-sans text-gray-400">Total Assigned</p>
                <p className="text-xl font-bold text-white">{perf.total}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-gray-300">Recent Task History</p>
              <div className="divide-y divide-white/6 text-xs">
                {myTasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between">
                    <span className="text-gray-200 truncate">
                      <span className="font-mono text-gray-400 mr-2">{t.taskCode}</span>
                      {t.title}
                    </span>
                    <span className="font-mono text-emerald-400 shrink-0">
                      {t.status} ({t.progress}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Audit Logs & System Governance</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Immutable security audit trail, workspace settings, and full JSON backup export
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportJsonBackup(`dsr_backup_${new Date().toISOString().slice(0, 10)}`, {
              exportedAt: new Date().toISOString(),
              projects,
              tasks,
              auditLogs,
              settings,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" /> Export JSON Backup
        </button>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-200">
          {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 glass-surface rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Organization Governance Settings</h3>
          </div>
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="block text-gray-400 mb-1">Organization Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">Reporting Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Deadline Warning (Days)</label>
                <input type="number" min={1} max={30} value={warningDays} onChange={(e) => setWarningDays(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="accent-emerald-500" />
              Enable automated email notification digest
            </label>
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input type="checkbox" checked={enforceRotation} onChange={(e) => setEnforceRotation(e.target.checked)} className="accent-emerald-500" />
              Enforce first-login security verification
            </label>
            <button type="submit" className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold">
              Save Governance Settings
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 glass-surface rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Immutable Security Audit Trail ({auditLogs.length})</h3>
          </div>
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 font-mono text-gray-400 whitespace-nowrap">
                      {formatTimestampLocal(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="text-gray-200">{log.actorEmail || log.actorUid}</span>
                      <span className="block text-[10px] font-mono text-emerald-400">{log.actorRole}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-amber-300 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-gray-300">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
