import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import {
  Announcement,
  AuditLog,
  Client,
  DeadlineExtensionRequest,
  Department,
  LoginSession,
  Milestone,
  NotificationItem,
  NotificationType,
  OperationType,
  Payment,
  Project,
  ProjectDocument,
  ProjectExpense,
  ProjectInvoice,
  SystemSetting,
  Task,
  TaskActivityLog,
  TaskAttachment,
  TaskComment,
  UserProfile,
  UserRole,
} from '../types/domain';
import { calculateWeightedProjectProgress, generateSafeId } from '../utils/calculations';
import {
  type CollectionKey,
  deleteLocalRecord,
  getLocalCollection,
  recalculateLocalProjectProgress,
  subscribeLocalCollection,
  upsertLocalRecord,
} from './localStoreService';

function isCloudMode(): boolean {
  return Boolean(auth.currentUser);
}

export function subscribeCollection<T>(
  collectionName: CollectionKey,
  constraints: QueryConstraint[],
  onData: (items: T[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!isCloudMode()) {
    return subscribeLocalCollection<T>(collectionName, onData);
  }

  const q =
    constraints.length > 0
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
      })) as T[];
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        } else {
          console.error(`Firestore subscription error on ${collectionName}:`, wrapped);
        }
      }
    }
  );
}

export async function logAuditEvent(params: {
  actorUid: string;
  actorEmail?: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string;
}): Promise<void> {
  const id = generateSafeId('aud');
  if (!isCloudMode()) {
    upsertLocalRecord<AuditLog>('audit_logs', {
      id,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail || '',
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      summary: params.summary.slice(0, 500),
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail || '',
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      summary: params.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}

export async function createNotification(params: {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const id = generateSafeId('ntf');
  if (!isCloudMode()) {
    upsertLocalRecord<NotificationItem>('notifications', {
      id,
      recipientUid: params.recipientUid,
      type: params.type,
      title: params.title.slice(0, 180),
      message: params.message.slice(0, 800),
      entityType: params.entityType || '',
      entityId: params.entityId || '',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      recipientUid: params.recipientUid,
      type: params.type,
      title: params.title.slice(0, 180),
      message: params.message.slice(0, 800),
      entityType: params.entityType || '',
      entityId: params.entityId || '',
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${id}`);
  }
}

export async function markNotificationRead(notificationId: string, isRead = true): Promise<void> {
  if (!isCloudMode()) {
    const existing = getLocalCollection<NotificationItem>('notifications').find(
      (n) => n.id === notificationId
    );
    if (existing) {
      upsertLocalRecord<NotificationItem>('notifications', { ...existing, isRead });
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function upsertUserProfile(
  uid: string,
  data: Omit<UserProfile, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<UserProfile>('users', {
      ...data,
      uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  // Strip local-only tempPassword before writing to Firestore (hasOnly rule protection)
  const { tempPassword: _omitTemp, ...firestoreSafe } = data;
  void _omitTemp;

  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid), {
        ...firestoreSafe,
        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', uid), {
        ...firestoreSafe,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateOwnUserSafeFields(
  uid: string,
  fields: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'mustChangePassword' | 'lastLoginAt'>>
): Promise<void> {
  if (!isCloudMode()) {
    const existing = getLocalCollection<UserProfile>('users').find((u) => u.uid === uid);
    if (existing) {
      upsertLocalRecord<UserProfile>('users', {
        ...existing,
        ...fields,
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function recordLoginSession(params: {
  userUid: string;
  userEmail: string;
  userRole: UserRole;
}): Promise<string> {
  const id = generateSafeId('ses');
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<LoginSession>('login_sessions', {
      id,
      userUid: params.userUid,
      userEmail: params.userEmail,
      userRole: params.userRole,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 280) : 'Web Client',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return id;
  }

  try {
    await setDoc(doc(db, 'login_sessions', id), {
      id,
      userUid: params.userUid,
      userEmail: params.userEmail,
      userRole: params.userRole,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 280) : 'Web Client',
      status: 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `login_sessions/${id}`);
  }
}

export async function updateLoginSessionStatus(
  sessionId: string,
  status: LoginSession['status']
): Promise<void> {
  if (!isCloudMode()) {
    const existing = getLocalCollection<LoginSession>('login_sessions').find(
      (s) => s.id === sessionId
    );
    if (existing) {
      upsertLocalRecord<LoginSession>('login_sessions', {
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'login_sessions', sessionId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `login_sessions/${sessionId}`);
  }
}

export async function saveClient(
  client: Omit<Client, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Client>('clients', {
      ...client,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'clients', client.id), {
        ...client,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'clients', client.id), {
        ...client,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `clients/${client.id}`);
  }
}

export async function saveDepartment(
  dept: Omit<Department, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Department>('departments', {
      ...dept,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'departments', dept.id), {
        ...dept,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'departments', dept.id), {
        ...dept,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `departments/${dept.id}`);
  }
}

export async function saveProject(
  project: Omit<Project, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  isAdminPartialUpdate = false
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Project>('projects', {
      ...project,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'projects', project.id), {
        ...project,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (isAdminPartialUpdate) {
      await updateDoc(doc(db, 'projects', project.id), {
        description: project.description || '',
        requirements: project.requirements || '',
        planningDate: project.planningDate || '',
        startDate: project.startDate || '',
        expectedCompletionDate: project.expectedCompletionDate || '',
        assignedMemberUids: project.assignedMemberUids,
        assignedMemberNames: project.assignedMemberNames || [],
        priority: project.priority,
        status: project.status,
        progress: project.progress,
        internalRemarks: project.internalRemarks || '',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'projects', project.id), {
        ...project,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `projects/${project.id}`);
  }
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  if (!isCloudMode()) {
    deleteLocalRecord('projects', projectId);
    return;
  }

  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
  }
}

export async function recalculateAndSyncProjectProgress(
  projectId: string,
  roleMode: 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER' = 'SUPER_ADMIN',
  actorUid?: string
): Promise<number> {
  if (!isCloudMode()) {
    return recalculateLocalProjectProgress(projectId);
  }

  // Team members are forbidden by firestore.rules from updating parent project records directly
  if (roleMode === 'TEAM_MEMBER') {
    return 0;
  }

  try {
    const constraints: QueryConstraint[] = [where('projectId', '==', projectId)];
    if (roleMode === 'ADMIN' && actorUid) {
      constraints.push(where('assignedAdminUid', '==', actorUid));
    }
    const snap = await getDocs(query(collection(db, 'tasks'), ...constraints));
    const projectTasks = snap.docs.map((d) => ({ ...(d.data() as Task), id: d.id }));
    const progress = calculateWeightedProjectProgress(projectTasks);
    await updateDoc(doc(db, 'projects', projectId), {
      progress,
      updatedAt: serverTimestamp(),
    });
    return progress;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
}

export async function saveMilestone(
  milestone: Omit<Milestone, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Milestone>('milestones', {
      ...milestone,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'milestones', milestone.id), {
        ...milestone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'milestones', milestone.id), {
        title: milestone.title,
        dueDate: milestone.dueDate,
        status: milestone.status,
        deliverables: milestone.deliverables || '',
        projectMemberUids: milestone.projectMemberUids,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `milestones/${milestone.id}`);
  }
}

export async function saveTask(
  task: Omit<Task, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  updateMode: 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER' = 'SUPER_ADMIN',
  actor?: { uid: string; name: string }
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Task>('tasks', {
      ...task,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    if (actor) {
      const logId = generateSafeId('tlog');
      upsertLocalRecord<TaskActivityLog>('task_activity_logs', {
        id: logId,
        taskId: task.id,
        projectId: task.projectId,
        assignedAdminUid: task.assignedAdminUid,
        assigneeUid: task.assigneeUid,
        actorUid: actor.uid,
        actorName: actor.name,
        action: isNew ? 'Task Assigned' : `Updated status to ${task.status} (${task.progress}%)`,
        details: task.reviewFeedback || task.submissionNote || task.blockerReason || task.title,
        createdAt: nowIso,
      });
    }
    recalculateLocalProjectProgress(task.projectId);
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'tasks', task.id), {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (updateMode === 'TEAM_MEMBER') {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: task.status,
        progress: task.progress,
        blockerReason: task.blockerReason || '',
        submissionNote: task.submissionNote || '',
        updatedAt: serverTimestamp(),
      });
    } else if (updateMode === 'ADMIN') {
      await updateDoc(doc(db, 'tasks', task.id), {
        title: task.title,
        description: task.description || '',
        assigneeUid: task.assigneeUid,
        assigneeName: task.assigneeName || '',
        startDate: task.startDate || '',
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        weight: task.weight,
        reviewFeedback: task.reviewFeedback || '',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'tasks', task.id), {
        ...task,
        updatedAt: serverTimestamp(),
      });
    }

    if (actor) {
      const logId = generateSafeId('tlog');
      await setDoc(doc(db, 'task_activity_logs', logId), {
        id: logId,
        taskId: task.id,
        projectId: task.projectId,
        assignedAdminUid: task.assignedAdminUid,
        assigneeUid: task.assigneeUid,
        actorUid: actor.uid,
        actorName: actor.name,
        action: isNew ? 'Task Assigned' : `Updated status to ${task.status} (${task.progress}%)`,
        details: task.reviewFeedback || task.submissionNote || task.blockerReason || task.title,
        createdAt: serverTimestamp(),
      });
    }

    if (updateMode !== 'TEAM_MEMBER') {
      await recalculateAndSyncProjectProgress(task.projectId, updateMode, actor?.uid);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `tasks/${task.id}`);
  }
}

export async function addTaskComment(comment: Omit<TaskComment, 'createdAt'>): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<TaskComment>('task_comments', {
      ...comment,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'task_comments', comment.id), {
      ...comment,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `task_comments/${comment.id}`);
  }
}

export async function addTaskAttachment(attachment: Omit<TaskAttachment, 'createdAt'>): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<TaskAttachment>('task_attachments', {
      ...attachment,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'task_attachments', attachment.id), {
      ...attachment,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `task_attachments/${attachment.id}`);
  }
}

export async function addProjectDocument(docRecord: Omit<ProjectDocument, 'createdAt'>): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<ProjectDocument>('project_documents', {
      ...docRecord,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'project_documents', docRecord.id), {
      ...docRecord,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `project_documents/${docRecord.id}`);
  }
}

export async function deleteProjectDocument(docId: string): Promise<void> {
  if (!isCloudMode()) {
    deleteLocalRecord('project_documents', docId);
    return;
  }

  try {
    await deleteDoc(doc(db, 'project_documents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `project_documents/${docId}`);
  }
}

export async function addProjectExpense(expense: Omit<ProjectExpense, 'createdAt'>): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<ProjectExpense>('project_expenses', {
      ...expense,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'project_expenses', expense.id), {
      ...expense,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `project_expenses/${expense.id}`);
  }
}

export async function saveInvoice(
  invoice: Omit<ProjectInvoice, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<ProjectInvoice>('project_invoices', {
      ...invoice,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    if (isNew) {
      await setDoc(doc(db, 'project_invoices', invoice.id), {
        ...invoice,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'project_invoices', invoice.id), {
        ...invoice,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `project_invoices/${invoice.id}`);
  }
}

export async function recordInvoicePayment(payment: Omit<Payment, 'createdAt'>): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<Payment>('payments', { ...payment, createdAt: nowIso });
    const inv = getLocalCollection<ProjectInvoice>('project_invoices').find(
      (i) => i.id === payment.invoiceId
    );
    if (inv) {
      const newPaid = Number(inv.paidAmount || 0) + Number(payment.amount || 0);
      const newStatus: ProjectInvoice['status'] =
        newPaid >= inv.amount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : inv.status;
      upsertLocalRecord<ProjectInvoice>('project_invoices', {
        ...inv,
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: nowIso,
      });
    }
    const prj = getLocalCollection<Project>('projects').find((p) => p.id === payment.projectId);
    if (prj) {
      const newReceived = Number(prj.totalReceived || 0) + Number(payment.amount || 0);
      const targetAmount = Number(prj.quotedAmount || prj.budget || 0);
      const newPending = Math.max(0, targetAmount - newReceived);
      upsertLocalRecord<Project>('projects', {
        ...prj,
        totalReceived: newReceived,
        pendingAmount: newPending,
        updatedAt: nowIso,
      });
    }
    return;
  }

  try {
    await setDoc(doc(db, 'payments', payment.id), {
      ...payment,
      createdAt: serverTimestamp(),
    });

    const invRef = doc(db, 'project_invoices', payment.invoiceId);
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      const inv = invSnap.data() as ProjectInvoice;
      const newPaid = Number(inv.paidAmount || 0) + Number(payment.amount || 0);
      const newStatus: ProjectInvoice['status'] =
        newPaid >= inv.amount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : inv.status;
      await updateDoc(invRef, {
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    }

    const prjRef = doc(db, 'projects', payment.projectId);
    const prjSnap = await getDoc(prjRef);
    if (prjSnap.exists()) {
      const prj = prjSnap.data() as Project;
      const newReceived = Number(prj.totalReceived || 0) + Number(payment.amount || 0);
      const targetAmount = Number(prj.quotedAmount || prj.budget || 0);
      const newPending = Math.max(0, targetAmount - newReceived);
      await updateDoc(prjRef, {
        totalReceived: newReceived,
        pendingAmount: newPending,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${payment.id}`);
  }
}

export async function submitExtensionRequest(
  reqData: Omit<DeadlineExtensionRequest, 'createdAt' | 'updatedAt'>
): Promise<void> {
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<DeadlineExtensionRequest>('deadline_extension_requests', {
      ...reqData,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return;
  }

  try {
    await setDoc(doc(db, 'deadline_extension_requests', reqData.id), {
      ...reqData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `deadline_extension_requests/${reqData.id}`);
  }
}

export async function decideExtensionRequest(params: {
  request: DeadlineExtensionRequest;
  decision: 'APPROVED' | 'REJECTED';
  reviewerUid: string;
  reviewNote: string;
}): Promise<void> {
  const { request, decision, reviewerUid, reviewNote } = params;
  if (!isCloudMode()) {
    const nowIso = new Date().toISOString();
    upsertLocalRecord<DeadlineExtensionRequest>('deadline_extension_requests', {
      ...request,
      status: decision,
      reviewerUid,
      reviewNote,
      updatedAt: nowIso,
    });
    if (decision === 'APPROVED') {
      if (request.targetType === 'TASK') {
        const t = getLocalCollection<Task>('tasks').find((x) => x.id === request.targetId);
        if (t) {
          upsertLocalRecord<Task>('tasks', { ...t, dueDate: request.requestedDueDate, updatedAt: nowIso });
        }
      } else {
        const p = getLocalCollection<Project>('projects').find((x) => x.id === request.targetId);
        if (p) {
          upsertLocalRecord<Project>('projects', {
            ...p,
            expectedCompletionDate: request.requestedDueDate,
            updatedAt: nowIso,
          });
        }
      }
    }
    await createNotification({
      recipientUid: request.requesterUid,
      type: 'EXTENSION_DECIDED',
      title: `Deadline Extension ${decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      message: `${request.targetTitle || request.targetId}: ${reviewNote || decision}`,
      entityType: request.targetType,
      entityId: request.targetId,
    });
    return;
  }

  try {
    await updateDoc(doc(db, 'deadline_extension_requests', request.id), {
      status: decision,
      reviewerUid,
      reviewNote,
      updatedAt: serverTimestamp(),
    });

    if (decision === 'APPROVED') {
      if (request.targetType === 'TASK') {
        await updateDoc(doc(db, 'tasks', request.targetId), {
          dueDate: request.requestedDueDate,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'projects', request.targetId), {
          expectedCompletionDate: request.requestedDueDate,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await createNotification({
      recipientUid: request.requesterUid,
      type: 'EXTENSION_DECIDED',
      title: `Deadline Extension ${decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      message: `${request.targetTitle || request.targetId}: ${reviewNote || decision}`,
      entityType: request.targetType,
      entityId: request.targetId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `deadline_extension_requests/${request.id}`);
  }
}

export async function publishAnnouncement(
  announcement: Omit<Announcement, 'createdAt'>
): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<Announcement>('announcements', {
      ...announcement,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'announcements', announcement.id), {
      ...announcement,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `announcements/${announcement.id}`);
  }
}

export async function saveSystemSettings(
  setting: Omit<SystemSetting, 'updatedAt'>
): Promise<void> {
  if (!isCloudMode()) {
    upsertLocalRecord<SystemSetting>('system_settings', {
      ...setting,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await setDoc(doc(db, 'system_settings', setting.id), {
      ...setting,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `system_settings/${setting.id}`);
  }
}

export async function fetchUserByUid(uid: string): Promise<UserProfile | null> {
  if (!isCloudMode()) {
    return getLocalCollection<UserProfile>('users').find((u) => u.uid === uid) || null;
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export type {
  Announcement,
  AuditLog,
  Client,
  DeadlineExtensionRequest,
  Department,
  LoginSession,
  Milestone,
  NotificationItem,
  Payment,
  Project,
  ProjectDocument,
  ProjectExpense,
  ProjectInvoice,
  SystemSetting,
  Task,
  TaskActivityLog,
  TaskAttachment,
  TaskComment,
  UserProfile,
};
