import React, { useMemo, useState } from 'react';
import {
  Archive,
  Download,
  FilePlus2,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  addProjectDocument,
  createNotification,
  deleteProjectDocument,
  deleteProjectRecord,
  logAuditEvent,
  saveMilestone,
  saveProject,
  submitExtensionRequest,
} from '../services/firestoreService';
import {
  Client,
  Milestone,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  PriorityLevel,
  Project,
  ProjectCategory,
  ProjectDocument,
  ProjectStatus,
  Task,
  UserProfile,
  UserRole,
} from '../types/domain';
import {
  calculateWeightedProjectProgress,
  formatCurrency,
  generateNextProjectCode,
  generateSafeId,
  isDateOverdue,
  readFileAsDataUrl,
  validateUploadFile,
} from '../utils/calculations';

interface ProjectsPageProps {
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  projects: Project[];
  clients: Client[];
  employees: UserProfile[];
  tasks: Task[];
  milestones: Milestone[];
  documents: ProjectDocument[];
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  effectiveRole,
  effectiveUser,
  projects,
  clients,
  employees,
  tasks,
  milestones,
  documents,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const [extModalProject, setExtModalProject] = useState<Project | null>(null);
  const [extRequestedDate, setExtRequestedDate] = useState('');
  const [extReason, setExtReason] = useState('');

  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const admins = employees.filter((e) => e.role === 'ADMIN' || e.role === 'SUPER_ADMIN');
  const members = employees.filter((e) => e.role === 'TEAM_MEMBER');

  const scopedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (!showArchived && p.isArchived) return false;
      if (effectiveRole === 'ADMIN' && p.assignedAdminUid !== effectiveUser.uid) return false;
      if (effectiveRole === 'TEAM_MEMBER' && !p.assignedMemberUids.includes(effectiveUser.uid))
        return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (
        search.trim() &&
        !`${p.projectCode} ${p.projectName} ${p.clientName} ${p.category}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [projects, showArchived, effectiveRole, effectiveUser.uid, statusFilter, categoryFilter, search]);

  const activeDetail = selectedProject
    ? projects.find((p) => p.id === selectedProject.id) || selectedProject
    : null;

  const handleSaveProjectForm = async (
    payload: Omit<Project, 'createdAt' | 'updatedAt'>,
    isNew: boolean
  ) => {
    try {
      const isAdminPartial = effectiveRole === 'ADMIN' && !isNew;
      await saveProject(payload, isNew, isAdminPartial);
      await logAuditEvent({
        actorUid: effectiveUser.uid,
        actorEmail: effectiveUser.email,
        actorRole: effectiveRole,
        action: isNew ? 'PROJECT_CREATED' : 'PROJECT_UPDATED',
        resourceType: 'PROJECT',
        resourceId: payload.id,
        summary: `${payload.projectCode} (${payload.projectName}) status: ${payload.status}`,
      });
      if (isNew) {
        await createNotification({
          recipientUid: payload.assignedAdminUid,
          type: 'PROJECT_ASSIGNED',
          title: `New Project Assigned: ${payload.projectCode}`,
          message: `You have been assigned as lead Admin for ${payload.projectName}.`,
          entityType: 'PROJECT',
          entityId: payload.id,
        });
      }
      setStatusMessage({ type: 'ok', text: `Saved ${payload.projectCode} successfully.` });
      setCreatingNew(false);
      setEditingProject(null);
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save project.',
      });
    }
  };

  const handleArchiveToggle = async (project: Project) => {
    if (effectiveRole !== 'SUPER_ADMIN') return;
    await saveProject({ ...project, isArchived: !project.isArchived }, false, false);
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: project.isArchived ? 'PROJECT_RESTORED' : 'PROJECT_ARCHIVED',
      resourceType: 'PROJECT',
      resourceId: project.id,
      summary: `${project.projectCode} archive state toggled.`,
    });
  };

  const handleDeleteProject = async (project: Project) => {
    if (effectiveRole !== 'SUPER_ADMIN') return;
    await deleteProjectRecord(project.id);
    await logAuditEvent({
      actorUid: effectiveUser.uid,
      actorEmail: effectiveUser.email,
      actorRole: effectiveRole,
      action: 'PROJECT_DELETED',
      resourceType: 'PROJECT',
      resourceId: project.id,
      summary: `Deleted project ${project.projectCode} (${project.projectName})`,
    });
    if (selectedProject?.id === project.id) setSelectedProject(null);
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extModalProject || !extRequestedDate || !extReason.trim()) return;
    await submitExtensionRequest({
      id: generateSafeId('ext'),
      targetType: 'PROJECT',
      targetId: extModalProject.id,
      targetTitle: `${extModalProject.projectCode} · ${extModalProject.projectName}`,
      projectId: extModalProject.id,
      assignedAdminUid: extModalProject.assignedAdminUid,
      requesterUid: effectiveUser.uid,
      requesterName: effectiveUser.displayName,
      currentDueDate: extModalProject.expectedCompletionDate || new Date().toISOString().slice(0, 10),
      requestedDueDate: extRequestedDate,
      reason: extReason.trim(),
      status: 'PENDING',
    });
    setExtModalProject(null);
    setExtReason('');
    setStatusMessage({ type: 'ok', text: 'Project deadline extension request submitted.' });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Project Command Registry</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Progress is automatically calculated from weighted task completion · {scopedProjects.length} visible records
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {effectiveRole === 'SUPER_ADMIN' && (
            <>
              <button
                type="button"
                onClick={() => setShowArchived((s) => !s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showArchived
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {showArchived ? 'Showing Archived' : 'Show Archived'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setEditingProject(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg px-4 py-2.5 text-xs flex items-center justify-between border ${
            statusMessage.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-surface rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID (DSR-PRJ-...), name, client..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Categories</option>
          {PROJECT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Interactive Project Cards Grid */}
      {scopedProjects.length === 0 ? (
        <div className="glass-surface rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-gray-200">No projects match the current filters.</p>
          <p className="text-xs text-gray-400">Adjust your filters or create a new project record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scopedProjects.map((project) => {
            const pTasks = tasks.filter((t) => t.projectId === project.id);
            const computedProgress =
              pTasks.length > 0 ? calculateWeightedProjectProgress(pTasks) : project.progress;
            const overdue = isDateOverdue(
              project.expectedCompletionDate,
              project.status === 'Completed' || project.status === 'Cancelled'
            );

            return (
              <div
                key={project.id}
                className="glass-surface rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/35 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-gray-400">
                    <span>{project.projectCode}</span>
                    <span
                      className={
                        project.priority === 'CRITICAL'
                          ? 'text-red-400 font-semibold'
                          : project.priority === 'HIGH'
                          ? 'text-amber-300 font-semibold'
                          : 'text-gray-400'
                      }
                    >
                      {project.priority}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white leading-snug">
                    {project.projectName}
                  </h3>

                  <p className="text-xs text-gray-400">
                    {project.clientName} · {project.category} · {project.status}
                  </p>

                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Weighted Progress ({pTasks.length} tasks)</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-400">
                        {computedProgress}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-[width] duration-300"
                        style={{ width: `${computedProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/6">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      Lead: <span className="text-gray-200">{project.assignedAdminName || 'Unassigned'}</span>
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        overdue ? 'text-red-400 font-semibold' : 'text-gray-300'
                      }`}
                    >
                      Due {project.expectedCompletionDate || 'TBD'}
                    </span>
                  </div>

                  {effectiveRole !== 'TEAM_MEMBER' && (
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-gray-400">
                      <span>Budget: {formatCurrency(project.budget)}</span>
                      <span className="text-emerald-400">
                        Rec: {formatCurrency(project.totalReceived)}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-100 border border-white/10 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                      Workspace
                    </button>

                    <div className="flex items-center gap-1.5">
                      {(effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProject(project);
                            setCreatingNew(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10"
                        >
                          Edit
                        </button>
                      )}
                      {effectiveRole === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => {
                            setExtModalProject(project);
                            setExtRequestedDate(project.expectedCompletionDate || '');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                        >
                          Extend
                        </button>
                      )}
                      {effectiveRole === 'SUPER_ADMIN' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(project)}
                            title={project.isArchived ? 'Restore' : 'Archive'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/5"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(project)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Workspace Detail Modal */}
      {activeDetail && (
        <ProjectDetailModal
          project={activeDetail}
          effectiveRole={effectiveRole}
          effectiveUser={effectiveUser}
          tasks={tasks.filter((t) => t.projectId === activeDetail.id)}
          milestones={milestones.filter((m) => m.projectId === activeDetail.id)}
          documents={documents.filter((d) => d.projectId === activeDetail.id)}
          onClose={() => setSelectedProject(null)}
          onSubmitForApproval={async () => {
            await saveProject({ ...activeDetail, status: 'Under Review' }, false, effectiveRole === 'ADMIN');
            setStatusMessage({ type: 'ok', text: `${activeDetail.projectCode} submitted for executive review.` });
          }}
        />
      )}

      {/* Create / Edit Project Modal */}
      {(creatingNew || editingProject) && (
        <ProjectFormModal
          initial={editingProject}
          existingProjects={projects}
          clients={clients}
          admins={admins}
          members={members}
          effectiveRole={effectiveRole}
          effectiveUser={effectiveUser}
          onClose={() => {
            setCreatingNew(false);
            setEditingProject(null);
          }}
          onSubmit={handleSaveProjectForm}
        />
      )}

      {/* Extension Modal */}
      {extModalProject && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleRequestExtension} className="glass-surface max-w-md w-full rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Request Deadline Extension</h3>
              <button type="button" onClick={() => setExtModalProject(null)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {extModalProject.projectCode} · Current Deadline: {extModalProject.expectedCompletionDate || 'Unset'}
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Proposed Completion Date</label>
              <input
                type="date"
                required
                value={extRequestedDate}
                onChange={(e) => setExtRequestedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Justification</label>
              <textarea
                required
                rows={3}
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                placeholder="Explain scope change or client dependency..."
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setExtModalProject(null)} className="px-4 py-2 text-xs text-gray-300">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-gray-950">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const ProjectDetailModal: React.FC<{
  project: Project;
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  tasks: Task[];
  milestones: Milestone[];
  documents: ProjectDocument[];
  onClose: () => void;
  onSubmitForApproval: () => Promise<void>;
}> = ({
  project,
  effectiveRole,
  effectiveUser,
  tasks,
  milestones,
  documents,
  onClose,
  onSubmitForApproval,
}) => {
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState('');
  const [docCategory, setDocCategory] = useState<ProjectDocument['category']>('Architecture');
  const [docError, setDocError] = useState<string | null>(null);

  const computedProgress =
    tasks.length > 0 ? calculateWeightedProjectProgress(tasks) : project.progress;

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim() || !msDate) return;
    await saveMilestone(
      {
        id: generateSafeId('ms'),
        projectId: project.id,
        projectCode: project.projectCode,
        assignedAdminUid: project.assignedAdminUid,
        projectMemberUids: project.assignedMemberUids,
        title: msTitle.trim(),
        dueDate: msDate,
        status: 'PLANNED',
        deliverables: '',
      },
      true
    );
    setMsTitle('');
    setMsDate('');
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateUploadFile(file);
    if (!check.ok) {
      setDocError(check.error || 'Invalid file.');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    await addProjectDocument({
      id: generateSafeId('doc'),
      projectId: project.id,
      assignedAdminUid: project.assignedAdminUid,
      projectMemberUids: project.assignedMemberUids,
      uploadedByUid: effectiveUser.uid,
      uploadedByName: effectiveUser.displayName,
      title: file.name,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      category: docCategory,
      dataUrl,
    });
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-surface max-w-4xl w-full rounded-2xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="text-xs font-mono text-emerald-400">
              {project.projectCode} · {project.category} · {project.status}
            </p>
            <h2 className="text-xl font-bold text-white mt-1">{project.projectName}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Client: {project.clientName} · Operations Lead: {project.assignedAdminName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {effectiveRole === 'ADMIN' && project.status !== 'Under Review' && project.status !== 'Completed' && (
              <button
                type="button"
                onClick={onSubmitForApproval}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-gray-950 whitespace-nowrap"
              >
                Submit for Executive Approval
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-2 md:col-span-2">
            <p className="font-semibold text-gray-200">Scope & Requirements</p>
            <p className="text-gray-300 leading-relaxed">{project.description || 'No description provided.'}</p>
            {project.requirements && (
              <p className="text-gray-400 leading-relaxed pt-1 border-t border-white/6">
                Requirements: {project.requirements}
              </p>
            )}
            {project.internalRemarks && effectiveRole !== 'TEAM_MEMBER' && (
              <p className="text-amber-300/90 pt-1">Internal Remarks: {project.internalRemarks}</p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/6 space-y-2 font-mono tabular-nums">
            <p className="font-sans font-semibold text-gray-200">Schedule & Progress</p>
            <div className="flex justify-between"><span className="text-gray-400">Received:</span><span>{project.receivedDate || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Start:</span><span>{project.startDate || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Deadline:</span><span>{project.expectedCompletionDate || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Weighted %:</span><span className="text-emerald-400">{computedProgress}%</span></div>
            <div className="pt-1 font-sans text-gray-400">
              Team: {(project.assignedMemberNames || []).join(', ') || 'None assigned'}
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Milestones ({milestones.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {milestones.map((m) => (
              <div key={m.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-medium text-gray-100">{m.title}</p>
                  <p className="font-mono text-gray-400">Due {m.dueDate}</p>
                </div>
                {effectiveRole !== 'TEAM_MEMBER' ? (
                  <select
                    value={m.status}
                    onChange={(e) =>
                      saveMilestone({ ...m, status: e.target.value as Milestone['status'] }, false)
                    }
                    className="px-2 py-1 rounded bg-black/50 border border-white/10 text-xs text-emerald-300"
                  >
                    <option value="PLANNED">PLANNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DELAYED">DELAYED</option>
                  </select>
                ) : (
                  <span className="font-mono text-gray-300">{m.status}</span>
                )}
              </div>
            ))}
          </div>
          {effectiveRole !== 'TEAM_MEMBER' && (
            <form onSubmit={handleAddMilestone} className="flex flex-wrap gap-2 pt-1">
              <input
                type="text"
                placeholder="New milestone title..."
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
              />
              <input
                type="date"
                value={msDate}
                onChange={(e) => setMsDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-gray-950"
              >
                <FilePlus2 className="w-3.5 h-3.5" /> Add Milestone
              </button>
            </form>
          )}
        </div>

        {/* Project Documents */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Project Documents ({documents.length})</h3>
            {effectiveRole !== 'TEAM_MEMBER' && (
              <div className="flex items-center gap-2">
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as ProjectDocument['category'])}
                  className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-200"
                >
                  <option value="SOW">SOW</option>
                  <option value="Architecture">Architecture</option>
                  <option value="VAPT Report">VAPT Report</option>
                  <option value="Contract">Contract</option>
                  <option value="Deliverable">Deliverable</option>
                  <option value="Other">Other</option>
                </select>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  Upload File
                  <input type="file" onChange={handleUploadDoc} className="hidden" />
                </label>
              </div>
            )}
          </div>
          {docError && <p className="text-xs text-red-400">{docError}</p>}
          {documents.length === 0 ? (
            <p className="text-xs text-gray-500">No documents attached yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/6 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-medium text-gray-100">{d.fileName}</p>
                    <p className="text-gray-400">
                      {d.category} · {Math.round(d.fileSize / 1024)} KB · Uploaded by {d.uploadedByName || 'Lead'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.dataUrl && (
                      <a
                        href={d.dataUrl}
                        download={d.fileName}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-emerald-300"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    )}
                    {effectiveRole !== 'TEAM_MEMBER' && (
                      <button
                        type="button"
                        onClick={() => deleteProjectDocument(d.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProjectFormModal: React.FC<{
  initial: Project | null;
  existingProjects: Project[];
  clients: Client[];
  admins: UserProfile[];
  members: UserProfile[];
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  onClose: () => void;
  onSubmit: (payload: Omit<Project, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
}> = ({
  initial,
  existingProjects,
  clients,
  admins,
  members,
  effectiveRole,
  effectiveUser,
  onClose,
  onSubmit,
}) => {
  const isNew = !initial;
  const isAdminRestricted = effectiveRole === 'ADMIN';

  const [projectName, setProjectName] = useState(initial?.projectName || '');
  const [clientId, setClientId] = useState(initial?.clientId || clients[0]?.id || '');
  const [category, setCategory] = useState<ProjectCategory>(initial?.category || 'Cybersecurity');
  const [description, setDescription] = useState(initial?.description || '');
  const [requirements, setRequirements] = useState(initial?.requirements || '');
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate || new Date().toISOString().slice(0, 10));
  const [planningDate, setPlanningDate] = useState(initial?.planningDate || new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(initial?.startDate || new Date().toISOString().slice(0, 10));
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(initial?.expectedCompletionDate || '');
  const [quotedAmount, setQuotedAmount] = useState(String(initial?.quotedAmount ?? 50000));
  const [budget, setBudget] = useState(String(initial?.budget ?? 40000));
  const [advanceReceived, setAdvanceReceived] = useState(String(initial?.advanceReceived ?? 0));
  const [assignedAdminUid, setAssignedAdminUid] = useState(initial?.assignedAdminUid || admins[0]?.uid || effectiveUser.uid);
  const [assignedMemberUids, setAssignedMemberUids] = useState<string[]>(initial?.assignedMemberUids || []);
  const [priority, setPriority] = useState<PriorityLevel>(initial?.priority || 'MEDIUM');
  const [status, setStatus] = useState<ProjectStatus>(initial?.status || 'Planning');
  const [internalRemarks, setInternalRemarks] = useState(initial?.internalRemarks || '');
  const [saving, setSaving] = useState(false);

  const toggleMember = (uid: string) => {
    setAssignedMemberUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedClient = clients.find((c) => c.id === clientId);
      const selectedAdmin = admins.find((a) => a.uid === assignedAdminUid);
      const selectedMemberNames = members
        .filter((m) => assignedMemberUids.includes(m.uid))
        .map((m) => m.displayName);

      const quotedNum = Math.max(0, Number(quotedAmount) || 0);
      const budgetNum = Math.max(0, Number(budget) || 0);
      const advNum = Math.max(0, Number(advanceReceived) || 0);
      const totalRec = initial ? Number(initial.totalReceived || advNum) : advNum;

      await onSubmit(
        {
          id: initial?.id || generateSafeId('prj'),
          projectCode: initial?.projectCode || generateNextProjectCode(existingProjects),
          projectName: projectName.trim(),
          clientId: clientId || 'unassigned',
          clientName: selectedClient?.companyName || initial?.clientName || 'Enterprise Client',
          category,
          description: description.trim(),
          requirements: requirements.trim(),
          receivedDate,
          planningDate,
          startDate,
          expectedCompletionDate,
          actualCompletionDate: status === 'Completed' ? new Date().toISOString().slice(0, 10) : initial?.actualCompletionDate || '',
          quotedAmount: quotedNum,
          budget: budgetNum,
          advanceReceived: advNum,
          totalReceived: totalRec,
          pendingAmount: Math.max(0, quotedNum - totalRec),
          assignedAdminUid,
          assignedAdminName: selectedAdmin?.displayName || initial?.assignedAdminName || 'Operations Lead',
          assignedMemberUids,
          assignedMemberNames: selectedMemberNames,
          priority,
          status,
          progress: initial?.progress ?? 0,
          internalRemarks: internalRemarks.trim(),
          isArchived: initial?.isArchived ?? false,
          createdByUid: initial?.createdByUid || effectiveUser.uid,
        },
        isNew
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="glass-surface max-w-3xl w-full rounded-2xl p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <h2 className="text-lg font-bold text-white">
            {isNew ? 'Create Enterprise Project' : `Edit ${initial?.projectCode}`}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block text-gray-400 mb-1">Project Name *</label>
            <input
              type="text"
              required
              disabled={isAdminRestricted}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Client *</label>
            <select
              disabled={isAdminRestricted}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white disabled:opacity-60"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.clientName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Category</label>
            <select
              disabled={isAdminRestricted}
              value={category}
              onChange={(e) => setCategory(e.target.value as ProjectCategory)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white disabled:opacity-60"
            >
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Assigned Project Admin</label>
            <select
              disabled={isAdminRestricted}
              value={assignedAdminUid}
              onChange={(e) => setAssignedAdminUid(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white disabled:opacity-60"
            >
              {admins.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName} ({a.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Received Date</label>
            <input
              type="date"
              disabled={isAdminRestricted}
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white disabled:opacity-60"
            />
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
            <label className="block text-gray-400 mb-1">Expected Completion Date *</label>
            <input
              type="date"
              required
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1">Planning Date</label>
            <input
              type="date"
              value={planningDate}
              onChange={(e) => setPlanningDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>

          {!isAdminRestricted && (
            <>
              <div>
                <label className="block text-gray-400 mb-1">Quoted Amount ($)</label>
                <input
                  type="number"
                  min={0}
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Approved Budget ($)</label>
                <input
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Advance Received ($)</label>
                <input
                  type="number"
                  min={0}
                  value={advanceReceived}
                  onChange={(e) => setAdvanceReceived(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white font-mono"
                />
              </div>
            </>
          )}
        </div>

        <div className="text-xs space-y-2">
          <label className="block text-gray-400">Assigned Personnel</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = assignedMemberUids.includes(m.uid);
              return (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => toggleMember(m.uid)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    selected
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {m.displayName} ({m.employeeId})
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-gray-400 mb-1">Project Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Client Requirements</label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="block text-gray-400 mb-1">Internal Remarks</label>
          <input
            type="text"
            value={internalRemarks}
            onChange={(e) => setInternalRemarks(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-white/8">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-300">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950"
          >
            {saving ? 'Saving...' : isNew ? 'Create Project' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
