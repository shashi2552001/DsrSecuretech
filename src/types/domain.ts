export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_MEMBER';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const PROJECT_CATEGORIES = [
  'Cybersecurity',
  'VAPT',
  'Digital Transformation',
  'AI & Automation',
  'Software Development',
  'Website Development',
  'Social Media Management',
  'EMS',
  'OMS',
  'Data Security',
  'Consulting',
  'Other',
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_STATUSES = [
  'Lead Received',
  'Proposal Sent',
  'Awaiting Approval',
  'Approved',
  'Planning',
  'In Progress',
  'On Hold',
  'Under Review',
  'Completed',
  'Cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = [
  'Not Started',
  'In Progress',
  'Under Review',
  'Revision Required',
  'Completed',
  'Blocked',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ALL_PERMISSIONS = [
  'projects:create',
  'projects:edit',
  'projects:archive',
  'clients:manage',
  'finance:manage',
  'finance:view',
  'employees:manage',
  'authority:manage',
  'tasks:assign',
  'tasks:review',
  'reports:export',
  'announcements:publish',
  'audit:view',
] as const;
export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export interface UserProfile {
  uid: string;
  employeeId: string;
  displayName: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  role: UserRole;
  permissions?: string[];
  managerUid?: string;
  joiningDate?: string;
  status: AccountStatus;
  mustChangePassword?: boolean;
  tempPassword?: string;
  lastLoginAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Department {
  id: string;
  name: string;
  headUid?: string;
  headName?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Client {
  id: string;
  clientName: string;
  companyName: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  address?: string;
  receivedDate?: string;
  requirements?: string;
  assignedAdminUid: string;
  assignedAdminName?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  clientId: string;
  clientName: string;
  category: ProjectCategory;
  description?: string;
  requirements?: string;
  receivedDate?: string;
  planningDate?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  quotedAmount?: number;
  budget?: number;
  advanceReceived?: number;
  totalReceived?: number;
  pendingAmount?: number;
  assignedAdminUid: string;
  assignedAdminName?: string;
  assignedMemberUids: string[];
  assignedMemberNames?: string[];
  priority: PriorityLevel;
  status: ProjectStatus;
  progress: number;
  internalRemarks?: string;
  isArchived: boolean;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Milestone {
  id: string;
  projectId: string;
  projectCode?: string;
  assignedAdminUid: string;
  projectMemberUids: string[];
  title: string;
  dueDate: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  deliverables?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Task {
  id: string;
  taskCode: string;
  projectId: string;
  projectCode?: string;
  projectName: string;
  title: string;
  description?: string;
  assignedByUid: string;
  assignedByName?: string;
  assignedAdminUid: string;
  assigneeUid: string;
  assigneeName?: string;
  assignedDate?: string;
  startDate?: string;
  dueDate: string;
  priority: PriorityLevel;
  status: TaskStatus;
  progress: number;
  weight: number;
  blockerReason?: string;
  reviewFeedback?: string;
  submissionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string;
  assignedAdminUid: string;
  assigneeUid: string;
  authorUid: string;
  authorName: string;
  authorRole?: UserRole;
  message: string;
  createdAt?: unknown;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  projectId: string;
  assignedAdminUid: string;
  assigneeUid: string;
  uploadedByUid: string;
  uploadedByName?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl?: string;
  createdAt?: unknown;
}

export interface TaskActivityLog {
  id: string;
  taskId: string;
  projectId: string;
  assignedAdminUid: string;
  assigneeUid: string;
  actorUid: string;
  actorName?: string;
  action: string;
  details?: string;
  createdAt?: unknown;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  assignedAdminUid: string;
  projectMemberUids: string[];
  uploadedByUid: string;
  uploadedByName?: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: 'SOW' | 'Architecture' | 'VAPT Report' | 'Contract' | 'Deliverable' | 'Other';
  dataUrl?: string;
  createdAt?: unknown;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  assignedAdminUid: string;
  category: 'Operational' | 'Vendor' | 'Infrastructure' | 'Licensing' | 'Contractor';
  description: string;
  amount: number;
  expenseDate: string;
  recordedByUid: string;
  createdAt?: unknown;
}

export interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  clientId: string;
  clientName?: string;
  assignedAdminUid: string;
  amount: number;
  paidAmount: number;
  issueDate?: string;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Payment {
  id: string;
  invoiceId: string;
  projectId: string;
  projectCode?: string;
  assignedAdminUid: string;
  amount: number;
  paymentDate: string;
  method: 'Wire Transfer' | 'ACH' | 'Corporate Card' | 'UPI / NEFT' | 'Check';
  reference?: string;
  recordedByUid: string;
  createdAt?: unknown;
}

export type NotificationType =
  | 'PROJECT_ASSIGNED'
  | 'TASK_ASSIGNED'
  | 'DEADLINE_APPROACHING'
  | 'TASK_OVERDUE'
  | 'PROJECT_STATUS'
  | 'TASK_SUBMITTED'
  | 'TASK_APPROVED'
  | 'TASK_REJECTED'
  | 'EXTENSION_REQUESTED'
  | 'EXTENSION_DECIDED'
  | 'PAYMENT_DUE'
  | 'ANNOUNCEMENT';

export interface NotificationItem {
  id: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt?: unknown;
}

export interface DeadlineExtensionRequest {
  id: string;
  targetType: 'TASK' | 'PROJECT';
  targetId: string;
  targetTitle?: string;
  projectId: string;
  assignedAdminUid: string;
  requesterUid: string;
  requesterName?: string;
  currentDueDate: string;
  requestedDueDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewerUid?: string;
  reviewNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  authorUid: string;
  authorName?: string;
  isActive: boolean;
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string;
  createdAt?: unknown;
}

export interface LoginSession {
  id: string;
  userUid: string;
  userEmail: string;
  userRole: UserRole;
  userAgent?: string;
  status: 'ACTIVE' | 'REVOKED' | 'SIGNED_OUT';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemSetting {
  id: string;
  scope: 'public' | 'restricted';
  companyName: string;
  currency: string;
  deadlineWarningDays: number;
  emailNotificationsEnabled?: boolean;
  enforcePasswordRotation?: boolean;
  updatedByUid?: string;
  updatedAt?: unknown;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type AppPage =
  | 'dashboard'
  | 'projects'
  | 'clients'
  | 'tasks'
  | 'timeline'
  | 'finance'
  | 'reports'
  | 'workforce'
  | 'notifications'
  | 'audit'
  | 'profile';
