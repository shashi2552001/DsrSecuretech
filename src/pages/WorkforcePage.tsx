import React, { useState } from 'react';
import { KeyRound, Plus, Shield, UserCheck, UserX, X } from 'lucide-react';
import {
  logAuditEvent,
  updateLoginSessionStatus,
  upsertUserProfile,
} from '../services/firestoreService';
import {
  ALL_PERMISSIONS,
  Department,
  LoginSession,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  computeEmployeeProductivity,
  formatTimestampLocal,
  generateSafeId,
} from '../utils/calculations';

interface WorkforcePageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  employees: UserProfile[];
  departments: Department[];
  tasks: Task[];
  loginSessions: LoginSession[];
}

export const WorkforcePage: React.FC<WorkforcePageProps> = ({
  effectiveRole,
  effectiveUser,
  employees,
  departments,
  tasks,
  loginSessions,
}) => {
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'directory' | 'sessions'>('directory');
  const [issuedCredsBanner, setIssuedCredsBanner] = useState<{
    employeeId: string;
    tempPass: string;
    name: string;
  } | null>(null);

  if (effectiveRole === 'TEAM_MEMBER') {
    return (
      <div className="glass-surface rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300">
          Workforce directory &amp; access authority controls require leadership clearance.
        </p>
      </div>
    );
  }

  const formatAccessTier = (role: UserRole): string =>
    role === 'SUPER_ADMIN'
      ? 'Executive Command'
      : role === 'ADMIN'
      ? 'Operations Lead'
      : 'Specialist';

  const visibleEmployees =
    effectiveRole === 'ADMIN'
      ? employees.filter((e) => e.managerUid === effectiveUser.uid || e.uid === effectiveUser.uid)
      : employees;

  const admins = employees.filter((e) => e.role === 'ADMIN' || e.role === 'SUPER_ADMIN');

  const handleToggleAccountStatus = async (emp: UserProfile) => {
    if (effectiveRole !== 'SUPER_ADMIN' || emp.uid === effectiveUser.uid) return;
    const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await upsertUserProfile(emp.uid, { ...emp, status: nextStatus }, false);
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: nextStatus === 'ACTIVE' ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      resourceType: 'USER',
      resourceId: emp.uid,
      summary: `${emp.employeeId} (${emp.email}) marked ${nextStatus}`,
    });
  };

  const handleForceReset = async (emp: UserProfile) => {
    if (effectiveRole !== 'SUPER_ADMIN') return;
    const tempPass = `Dsr#${Math.floor(1000 + Math.random() * 8999)}Tmp`;
    await upsertUserProfile(
      emp.uid,
      { ...emp, tempPassword: tempPass, mustChangePassword: true },
      false
    );
    setIssuedCredsBanner({ employeeId: emp.employeeId, tempPass, name: emp.displayName });
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: 'CREDENTIAL_RESET_FLAGGED',
      resourceType: 'USER',
      resourceId: emp.uid,
      summary: `Issued temporary passcode & flagged ${emp.employeeId} for verification`,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {effectiveRole === 'SUPER_ADMIN' ? 'Workforce & Access Governance' : 'Assigned Personnel'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {visibleEmployees.length} personnel · Temporary access passes, productivity scores, and session logs
          </p>
        </div>

        {effectiveRole === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setTab('directory')}
                className={`px-3 py-1.5 rounded ${tab === 'directory' ? 'bg-emerald-500 text-gray-950 font-semibold' : 'text-gray-300'}`}
              >
                Directory & RBAC
              </button>
              <button
                type="button"
                onClick={() => setTab('sessions')}
                className={`px-3 py-1.5 rounded ${tab === 'sessions' ? 'bg-emerald-500 text-gray-950 font-semibold' : 'text-gray-300'}`}
              >
                Login History ({loginSessions.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setEditing(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Personnel
            </button>
          </div>
        )}
      </div>

      {issuedCredsBanner && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-emerald-300">
              Temporary Access Credentials Issued for {issuedCredsBanner.name}
            </p>
            <p className="text-gray-300 font-mono mt-0.5">
              Temp ID: <span className="text-white font-semibold">{issuedCredsBanner.employeeId}</span> · Temp Pass:{' '}
              <span className="text-amber-300 font-semibold">{issuedCredsBanner.tempPass}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIssuedCredsBanner(null)}
            className="text-gray-400 hover:text-white px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === 'directory' && (
        <div className="glass-surface rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
                <tr>
                  <th className="py-3 px-4">Access ID</th>
                  <th className="py-3 px-4">Name & Contact</th>
                  <th className="py-3 px-4">Department & Title</th>
                  <th className="py-3 px-4">Access Tier</th>
                  <th className="py-3 px-4 text-right">Productivity</th>
                  <th className="py-3 px-4">Status</th>
                  {effectiveRole === 'SUPER_ADMIN' && <th className="py-3 px-4 text-right">Governance</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleEmployees.map((emp) => {
                  const perf = computeEmployeeProductivity(tasks, emp.uid);
                  return (
                    <tr key={emp.uid} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono text-gray-300 whitespace-nowrap">
                        {emp.employeeId}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{emp.displayName}</p>
                        <p className="text-[11px] text-gray-400">{emp.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-200">{emp.department || '—'}</p>
                        <p className="text-[11px] text-gray-400">{emp.designation || '—'}</p>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span
                          className={
                            emp.role === 'SUPER_ADMIN'
                              ? 'text-emerald-400 font-semibold'
                              : emp.role === 'ADMIN'
                              ? 'text-amber-300 font-semibold'
                              : 'text-gray-300'
                          }
                        >
                          {formatAccessTier(emp.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="text-emerald-400 font-semibold">{perf.score}%</span>
                        <span className="block text-[11px] text-gray-400">
                          {perf.completed}/{perf.total} tasks
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className={emp.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}>
                          {emp.status}
                        </span>
                      </td>
                      {effectiveRole === 'SUPER_ADMIN' && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(emp);
                                setCreating(false);
                              }}
                              className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-200"
                            >
                              <Shield className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                              Edit / Perms
                            </button>
                            <button
                              type="button"
                              onClick={() => handleForceReset(emp)}
                              title="Force security verification on next login"
                              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-amber-300"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {emp.uid !== effectiveUser.uid && (
                              <button
                                type="button"
                                onClick={() => handleToggleAccountStatus(emp)}
                                title={emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300"
                              >
                                {emp.status === 'ACTIVE' ? (
                                  <UserX className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sessions' && effectiveRole === 'SUPER_ADMIN' && (
        <div className="glass-surface rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] border-b border-white/8 text-gray-400">
                <tr>
                  <th className="py-3 px-4">User Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Client Environment</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {loginSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 text-white">{s.userEmail}</td>
                    <td className="py-3 px-4 text-emerald-400">{formatAccessTier(s.userRole)}</td>
                    <td className="py-3 px-4 text-gray-400 max-w-xs truncate">{s.userAgent || 'Browser'}</td>
                    <td className="py-3 px-4 font-mono text-gray-400">{formatTimestampLocal(s.createdAt)}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={s.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => updateLoginSessionStatus(s.id, 'REVOKED')}
                          className="px-2.5 py-1 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <PersonnelFormModal
          initial={editing}
          admins={admins}
          departments={departments}
          existingEmployees={employees}
          effectiveUser={effectiveUser}
          onIssuedTempCreds={(creds) => setIssuedCredsBanner(creds)}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const PersonnelFormModal: React.FC<{
  initial: UserProfile | null;
  admins: UserProfile[];
  departments: Department[];
  existingEmployees: UserProfile[];
  effectiveUser: UserProfile;
  onIssuedTempCreds: (creds: { employeeId: string; tempPass: string; name: string }) => void;
  onClose: () => void;
}> = ({ initial, admins, departments, existingEmployees, effectiveUser, onIssuedTempCreds, onClose }) => {
  const isNew = !initial;
  const [displayName, setDisplayName] = useState(initial?.displayName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [department, setDepartment] = useState(initial?.department || departments[0]?.name || 'Cybersecurity & VAPT');
  const [designation, setDesignation] = useState(initial?.designation || 'Security Engineer');
  const [role, setRole] = useState<UserRole>(initial?.role || 'TEAM_MEMBER');
  const [managerUid, setManagerUid] = useState(initial?.managerUid || admins[0]?.uid || effectiveUser.uid);
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || new Date().toISOString().slice(0, 10));
  const [tempPassword, setTempPassword] = useState(
    initial?.tempPassword || `Dsr#${Math.floor(1000 + Math.random() * 8999)}Tmp`
  );
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions || []);
  const [saving, setSaving] = useState(false);

  const togglePerm = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const uid = initial?.uid || generateSafeId('emp');
      const prefix = role === 'SUPER_ADMIN' ? 'SA' : role === 'ADMIN' ? 'ADM' : 'TM';
      const nextNum = String(existingEmployees.length + 10).padStart(3, '0');
      const employeeId = initial?.employeeId || `DSR-${prefix}-${nextNum}`;
      const cleanPass = tempPassword.trim() || `Dsr#${Math.floor(1000 + Math.random() * 8999)}Tmp`;

      await upsertUserProfile(
        uid,
        {
          uid,
          employeeId,
          displayName: displayName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          department,
          designation: designation.trim(),
          role,
          permissions,
          managerUid,
          joiningDate,
          status: initial?.status || 'ACTIVE',
          mustChangePassword: initial?.mustChangePassword ?? true,
          tempPassword: cleanPass,
          lastLoginAt: initial?.lastLoginAt || '',
        },
        isNew
      );

      onIssuedTempCreds({ employeeId, tempPass: cleanPass, name: displayName.trim() });

      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveUser.role,
        action: isNew ? 'PERSONNEL_CREATED' : 'PERSONNEL_UPDATED',
        resourceType: 'USER',
        resourceId: uid,
        summary: `${employeeId} (${displayName}) tier=${role}`,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="glass-surface max-w-2xl w-full rounded-2xl p-6 space-y-4 my-8 text-xs">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <h3 className="text-base font-bold text-white">
            {isNew ? 'Provision Access Account' : `Manage ${initial?.employeeId}`}
          </h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-400 mb-1">Full Name *</label>
            <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Corporate Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Access Clearance *</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
              <option value="TEAM_MEMBER">Specialist Clearance</option>
              <option value="ADMIN">Operations Lead Clearance</option>
              <option value="SUPER_ADMIN">Executive Command Clearance</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Temporary Password *</label>
            <input type="text" required value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 font-mono text-amber-300" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Reporting Lead</label>
            <select value={managerUid} onChange={(e) => setManagerUid(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
              {admins.map((a) => (
                <option key={a.uid} value={a.uid}>{a.displayName} ({a.employeeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white">
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Designation</label>
            <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Contact Number</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Joining Date</label>
            <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white" />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-gray-400">Granular Permissions</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PERMISSIONS.map((perm) => {
              const active = permissions.includes(perm);
              return (
                <button
                  key={perm}
                  type="button"
                  onClick={() => togglePerm(perm)}
                  className={`px-2.5 py-1 rounded border font-mono text-[11px] transition-colors ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {perm}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-white/8">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-emerald-500 text-gray-950 font-semibold">
            {saving ? 'Saving...' : 'Save Account'}
          </button>
        </div>
      </form>
    </div>
  );
};
