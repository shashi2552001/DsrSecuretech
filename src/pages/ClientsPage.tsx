import React, { useState } from 'react';
import { Building2, Mail, MapPin, Phone, Plus, Search, X } from 'lucide-react';
import { logAuditEvent, saveClient } from '../services/firestoreService';
import { Client, Project, UserProfile, UserRole } from '../types/domain';
import { formatCurrency, generateSafeId } from '../utils/calculations';

interface ClientsPageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  clients: Client[];
  projects: Project[];
  admins: UserProfile[];
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  effectiveRole,
  effectiveUser,
  clients,
  projects,
  admins,
}) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  if (effectiveRole === 'TEAM_MEMBER') {
    return (
      <div className="glass-surface rounded-xl p-8 text-center">
        <p className="text-sm text-gray-300">
          Client directory and PII records are restricted to executive leadership and assigned operations leads.
        </p>
      </div>
    );
  }

  const visibleClients = clients.filter((c) => {
    if (effectiveRole === 'ADMIN' && c.assignedAdminUid !== effectiveUser.uid) return false;
    if (
      search.trim() &&
      !`${c.clientName} ${c.companyName} ${c.email}`.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Enterprise Client Directory</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Multi-project client accounts, requirements, and assigned governance leads
          </p>
        </div>
        {effectiveRole === 'SUPER_ADMIN' && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>

      <div className="glass-surface rounded-xl p-3.5 relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-6 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter clients by company, contact, or email..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleClients.map((client) => {
          const clientProjects = projects.filter((p) => p.clientId === client.id && !p.isArchived);
          const totalValue = clientProjects.reduce((acc, p) => acc + (p.quotedAmount || p.budget || 0), 0);

          return (
            <div key={client.id} className="glass-surface rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-base font-semibold text-white">{client.companyName}</h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Contact: {client.contactPerson || client.clientName} · Admin: {client.assignedAdminName || 'Unassigned'}
                  </p>
                </div>
                {effectiveRole === 'SUPER_ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(client);
                      setCreating(false);
                    }}
                    className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-200"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-mono">{client.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{client.address || 'Address not recorded'}</span>
                </div>
              </div>

              {client.requirements && (
                <p className="text-xs text-gray-400 bg-white/[0.02] border border-white/6 rounded-lg p-3 leading-relaxed">
                  {client.requirements}
                </p>
              )}

              <div className="pt-2 border-t border-white/8 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Projects ({clientProjects.length}) · Received {client.receivedDate || '—'}
                  </span>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                    Portfolio: {formatCurrency(totalValue)}
                  </span>
                </div>
                {clientProjects.length > 0 && (
                  <div className="space-y-1">
                    {clientProjects.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] text-gray-300">
                        <span className="truncate">
                          <span className="font-mono text-gray-400">{p.projectCode}</span> · {p.projectName}
                        </span>
                        <span className="font-mono text-emerald-400 shrink-0">{p.status} ({p.progress}%)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <ClientFormModal
          initial={editing}
          admins={admins}
          effectiveUser={effectiveUser}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const ClientFormModal: React.FC<{
  initial: Client | null;
  admins: UserProfile[];
  effectiveUser: UserProfile;
  onClose: () => void;
  onSaved: () => void;
}> = ({ initial, admins, effectiveUser, onClose, onSaved }) => {
  const isNew = !initial;
  const [clientName, setClientName] = useState(initial?.clientName || '');
  const [companyName, setCompanyName] = useState(initial?.companyName || '');
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate || new Date().toISOString().slice(0, 10));
  const [requirements, setRequirements] = useState(initial?.requirements || '');
  const [assignedAdminUid, setAssignedAdminUid] = useState(initial?.assignedAdminUid || admins[0]?.uid || effectiveUser.uid);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = initial?.id || generateSafeId('cli');
      const adminObj = admins.find((a) => a.uid === assignedAdminUid);
      await saveClient(
        {
          id,
          clientName: clientName.trim(),
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          receivedDate,
          requirements: requirements.trim(),
          assignedAdminUid,
          assignedAdminName: adminObj?.displayName || 'Operations Lead',
          status: initial?.status || 'ACTIVE',
        },
        isNew
      );
      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveUser.role,
        action: isNew ? 'CLIENT_CREATED' : 'CLIENT_UPDATED',
        resourceType: 'CLIENT',
        resourceId: id,
        summary: `${companyName} (${clientName})`,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-surface max-w-xl w-full rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <h3 className="text-base font-bold text-white">{isNew ? 'Add Client Account' : 'Edit Client'}</h3>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-gray-400 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Primary Client Name *</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Corporate Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Project Received Date</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Assigned Operations Lead</label>
            <select
              value={assignedAdminUid}
              onChange={(e) => setAssignedAdminUid(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            >
              {admins.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName} ({a.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Office Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-gray-400 mb-1">Requirements Summary</label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
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
            {saving ? 'Saving...' : 'Save Client'}
          </button>
        </div>
      </form>
    </div>
  );
};
