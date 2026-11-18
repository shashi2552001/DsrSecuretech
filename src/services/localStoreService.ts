import {
  ALL_PERMISSIONS,
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
} from '../types/domain';
import { calculateWeightedProjectProgress, generateSafeId } from '../utils/calculations';

const WORKSPACE_STORAGE_KEY = 'dsr_cmd_workspace_v2';
const SESSION_STORAGE_KEY = 'dsr_cmd_temp_session_v2';

export const DEFAULT_TEMP_ACCESS_ID = 'DSR-CMD-2026';
export const DEFAULT_TEMP_ACCESS_PASS = 'Dsr@2026#Temp';

export interface WorkspaceDataset {
  users: UserProfile[];
  departments: Department[];
  clients: Client[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  task_comments: TaskComment[];
  task_attachments: TaskAttachment[];
  task_activity_logs: TaskActivityLog[];
  project_documents: ProjectDocument[];
  project_expenses: ProjectExpense[];
  project_invoices: ProjectInvoice[];
  payments: Payment[];
  notifications: NotificationItem[];
  deadline_extension_requests: DeadlineExtensionRequest[];
  announcements: Announcement[];
  audit_logs: AuditLog[];
  login_sessions: LoginSession[];
  system_settings: SystemSetting[];
}

export type CollectionKey = keyof WorkspaceDataset;

function offsetDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function createInitialEnterpriseDataset(): WorkspaceDataset {
  const nowIso = new Date().toISOString();
  const commandUid = 'dsr-cmd-primary';

  const users: UserProfile[] = [
    {
      uid: commandUid,
      employeeId: DEFAULT_TEMP_ACCESS_ID,
      displayName: 'Arjun Deshmukh',
      email: 'command@dsrsecuretech.com',
      phone: '+1-415-890-2100',
      department: 'Executive Governance',
      designation: 'Chief Information Security Officer',
      role: 'SUPER_ADMIN',
      permissions: [...ALL_PERMISSIONS],
      managerUid: commandUid,
      joiningDate: '2023-01-10',
      status: 'ACTIVE',
      mustChangePassword: false,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-admin-dsr-001',
      employeeId: 'DSR-ADM-001',
      displayName: 'Vikramaditya Rao',
      email: 'vikram.rao@dsrsecuretech.com',
      phone: '+1-415-890-2142',
      department: 'Cybersecurity & VAPT',
      designation: 'Principal Security Lead',
      role: 'ADMIN',
      permissions: ['projects:edit', 'tasks:assign', 'tasks:review', 'reports:export', 'finance:view'],
      managerUid: commandUid,
      joiningDate: '2023-06-15',
      status: 'ACTIVE',
      mustChangePassword: true,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-admin-dsr-002',
      employeeId: 'DSR-ADM-002',
      displayName: 'Meera Krishnan',
      email: 'meera.krishnan@dsrsecuretech.com',
      phone: '+1-415-890-2188',
      department: 'AI & Automation',
      designation: 'Director of AI Systems',
      role: 'ADMIN',
      permissions: ['projects:edit', 'tasks:assign', 'tasks:review', 'reports:export', 'finance:view'],
      managerUid: commandUid,
      joiningDate: '2024-02-01',
      status: 'ACTIVE',
      mustChangePassword: false,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-member-dsr-001',
      employeeId: 'DSR-TM-001',
      displayName: 'Ananya Deshmukh',
      email: 'ananya.d@dsrsecuretech.com',
      phone: '+1-415-890-2204',
      department: 'Cybersecurity & VAPT',
      designation: 'Senior Penetration Tester',
      role: 'TEAM_MEMBER',
      permissions: [],
      managerUid: 'demo-admin-dsr-001',
      joiningDate: '2024-04-12',
      status: 'ACTIVE',
      mustChangePassword: true,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-member-dsr-002',
      employeeId: 'DSR-TM-002',
      displayName: 'Rohan Malhotra',
      email: 'rohan.malhotra@dsrsecuretech.com',
      phone: '+1-415-890-2219',
      department: 'Enterprise Software & EMS',
      designation: 'Staff Systems Architect',
      role: 'TEAM_MEMBER',
      permissions: [],
      managerUid: 'demo-admin-dsr-001',
      joiningDate: '2024-07-08',
      status: 'ACTIVE',
      mustChangePassword: false,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-member-dsr-003',
      employeeId: 'DSR-TM-003',
      displayName: 'Elena Vance',
      email: 'elena.vance@dsrsecuretech.com',
      phone: '+1-415-890-2265',
      department: 'AI & Automation',
      designation: 'ML Automation Engineer',
      role: 'TEAM_MEMBER',
      permissions: [],
      managerUid: 'demo-admin-dsr-002',
      joiningDate: '2025-01-14',
      status: 'ACTIVE',
      mustChangePassword: false,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      uid: 'demo-member-dsr-004',
      employeeId: 'DSR-TM-004',
      displayName: 'Kabir Sen',
      email: 'kabir.sen@dsrsecuretech.com',
      phone: '+1-415-890-2290',
      department: 'Data Security & Compliance',
      designation: 'Cloud Zero-Trust Engineer',
      role: 'TEAM_MEMBER',
      permissions: [],
      managerUid: 'demo-admin-dsr-002',
      joiningDate: '2025-03-20',
      status: 'ACTIVE',
      mustChangePassword: false,
      tempPassword: DEFAULT_TEMP_ACCESS_PASS,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const departments: Department[] = [
    { id: 'dept-cyber', name: 'Cybersecurity & VAPT', headUid: 'demo-admin-dsr-001', headName: 'Vikramaditya Rao', isActive: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'dept-ai', name: 'AI & Automation', headUid: 'demo-admin-dsr-002', headName: 'Meera Krishnan', isActive: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'dept-eng', name: 'Enterprise Software & EMS', headUid: 'demo-admin-dsr-001', headName: 'Vikramaditya Rao', isActive: true, createdAt: nowIso, updatedAt: nowIso },
    { id: 'dept-data', name: 'Data Security & Compliance', headUid: 'demo-admin-dsr-002', headName: 'Meera Krishnan', isActive: true, createdAt: nowIso, updatedAt: nowIso },
  ];

  const clients: Client[] = [
    {
      id: 'cli-finvault',
      clientName: 'Marcus Sterling',
      companyName: 'FinVault Global Bank',
      contactPerson: 'Marcus Sterling (VP Security)',
      email: 'm.sterling@finvaultbank.example',
      phone: '+1-212-555-0194',
      address: '450 Lexington Ave, New York, NY 10017',
      receivedDate: offsetDate(-45),
      requirements: 'Full-stack PCI-DSS 4.0 VAPT audit, API penetration testing, and SOC remediation playbook.',
      assignedAdminUid: 'demo-admin-dsr-001',
      assignedAdminName: 'Vikramaditya Rao',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'cli-meridian',
      clientName: 'Claire Dubois',
      companyName: 'Meridian Freight & Logistics',
      contactPerson: 'Claire Dubois (CIO)',
      email: 'cdubois@meridianfreight.example',
      phone: '+1-312-555-0148',
      address: '200 W Madison St, Chicago, IL 60606',
      receivedDate: offsetDate(-35),
      requirements: 'Enterprise Order Management System (OMS) modernization with real-time fleet telemetry.',
      assignedAdminUid: 'demo-admin-dsr-001',
      assignedAdminName: 'Vikramaditya Rao',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'cli-aegis',
      clientName: 'Dr. Arjun Nair',
      companyName: 'Aegis Health Systems',
      contactPerson: 'Dr. Arjun Nair (CISO)',
      email: 'anair@aegishealth.example',
      phone: '+1-617-555-0177',
      address: '100 Federal St, Boston, MA 02110',
      receivedDate: offsetDate(-25),
      requirements: 'Automated threat triage pipeline and HIPAA data encryption governance.',
      assignedAdminUid: 'demo-admin-dsr-002',
      assignedAdminName: 'Meera Krishnan',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'cli-helios',
      clientName: 'Hannah Lindqvist',
      companyName: 'Helios Energy Grid',
      contactPerson: 'Hannah Lindqvist (Head of OT)',
      email: 'hlindqvist@heliosgrid.example',
      phone: '+1-512-555-0131',
      address: '300 W 6th St, Austin, TX 78701',
      receivedDate: offsetDate(-60),
      requirements: 'OT/ICS Zero-Trust network segmentation and Executive Monitoring System (EMS).',
      assignedAdminUid: 'demo-admin-dsr-002',
      assignedAdminName: 'Meera Krishnan',
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const projects: Project[] = [
    {
      id: 'prj-001',
      projectCode: 'DSR-PRJ-2026-0001',
      projectName: 'FinVault Core Banking VAPT & Red Team',
      clientId: 'cli-finvault',
      clientName: 'FinVault Global Bank',
      category: 'VAPT',
      description: 'Comprehensive vulnerability assessment and red-team adversary simulation across mobile banking, payment rails, and core ledger APIs.',
      requirements: 'OWASP API Top 10 coverage, executive risk scoring matrix, and verified re-testing.',
      receivedDate: offsetDate(-44),
      planningDate: offsetDate(-40),
      startDate: offsetDate(-35),
      expectedCompletionDate: offsetDate(12),
      actualCompletionDate: '',
      quotedAmount: 145000,
      budget: 120000,
      advanceReceived: 50000,
      totalReceived: 100000,
      pendingAmount: 45000,
      assignedAdminUid: 'demo-admin-dsr-001',
      assignedAdminName: 'Vikramaditya Rao',
      assignedMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'],
      assignedMemberNames: ['Ananya Deshmukh', 'Rohan Malhotra'],
      priority: 'CRITICAL',
      status: 'In Progress',
      progress: 69,
      internalRemarks: 'Phase 2 API exploitation complete; awaiting client hotfix window for re-test.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prj-002',
      projectCode: 'DSR-PRJ-2026-0002',
      projectName: 'Meridian Distributed OMS Modernization',
      clientId: 'cli-meridian',
      clientName: 'Meridian Freight & Logistics',
      category: 'OMS',
      description: 'Cloud-native Order Management System replacement with automated SLA tracking and warehouse ERP connectors.',
      requirements: 'Zero-downtime migration from legacy monolith, role-based dispatcher portal.',
      receivedDate: offsetDate(-32),
      planningDate: offsetDate(-28),
      startDate: offsetDate(-24),
      expectedCompletionDate: offsetDate(28),
      actualCompletionDate: '',
      quotedAmount: 180000,
      budget: 155000,
      advanceReceived: 60000,
      totalReceived: 90000,
      pendingAmount: 90000,
      assignedAdminUid: 'demo-admin-dsr-001',
      assignedAdminName: 'Vikramaditya Rao',
      assignedMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'],
      assignedMemberNames: ['Ananya Deshmukh', 'Rohan Malhotra'],
      priority: 'HIGH',
      status: 'In Progress',
      progress: 56,
      internalRemarks: 'Core order state machine deployed to staging cluster.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prj-003',
      projectCode: 'DSR-PRJ-2026-0003',
      projectName: 'Aegis Autonomous SOC Triage Engine',
      clientId: 'cli-aegis',
      clientName: 'Aegis Health Systems',
      category: 'AI & Automation',
      description: 'Automated SIEM alert enrichment and HIPAA compliance anomaly workflow orchestration.',
      requirements: 'Sub-2-minute alert correlation, audit-ready incident trace retention.',
      receivedDate: offsetDate(-22),
      planningDate: offsetDate(-18),
      startDate: offsetDate(-15),
      expectedCompletionDate: offsetDate(4),
      actualCompletionDate: '',
      quotedAmount: 112000,
      budget: 95000,
      advanceReceived: 40000,
      totalReceived: 75000,
      pendingAmount: 37000,
      assignedAdminUid: 'demo-admin-dsr-002',
      assignedAdminName: 'Meera Krishnan',
      assignedMemberUids: ['demo-member-dsr-003', 'demo-member-dsr-004'],
      assignedMemberNames: ['Elena Vance', 'Kabir Sen'],
      priority: 'HIGH',
      status: 'Under Review',
      progress: 95,
      internalRemarks: 'Ready for final CISO sign-off review.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prj-004',
      projectCode: 'DSR-PRJ-2026-0004',
      projectName: 'Helios Zero-Trust Grid Segmentation',
      clientId: 'cli-helios',
      clientName: 'Helios Energy Grid',
      category: 'Cybersecurity',
      description: 'Micro-segmentation and cryptographic identity enforcement across substation telemetry gateways.',
      requirements: 'NERC CIP compliance audit artifacts and automated certificate rotation.',
      receivedDate: offsetDate(-75),
      planningDate: offsetDate(-70),
      startDate: offsetDate(-65),
      expectedCompletionDate: offsetDate(-5),
      actualCompletionDate: offsetDate(-6),
      quotedAmount: 98000,
      budget: 82000,
      advanceReceived: 45000,
      totalReceived: 98000,
      pendingAmount: 0,
      assignedAdminUid: 'demo-admin-dsr-002',
      assignedAdminName: 'Meera Krishnan',
      assignedMemberUids: ['demo-member-dsr-004'],
      assignedMemberNames: ['Kabir Sen'],
      priority: 'MEDIUM',
      status: 'Completed',
      progress: 100,
      internalRemarks: 'Delivered 1 day ahead of schedule; full payment settled.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prj-005',
      projectCode: 'DSR-PRJ-2026-0005',
      projectName: 'FinVault Data Loss Prevention Rollout',
      clientId: 'cli-finvault',
      clientName: 'FinVault Global Bank',
      category: 'Data Security',
      description: 'Endpoint and cloud storage DLP policy enforcement across 4,500 corporate workstations.',
      requirements: 'Zero false-positive blocking on treasury wire workflows.',
      receivedDate: offsetDate(-12),
      planningDate: offsetDate(-8),
      startDate: offsetDate(-4),
      expectedCompletionDate: offsetDate(35),
      actualCompletionDate: '',
      quotedAmount: 85000,
      budget: 72000,
      advanceReceived: 25000,
      totalReceived: 25000,
      pendingAmount: 60000,
      assignedAdminUid: 'demo-admin-dsr-001',
      assignedAdminName: 'Vikramaditya Rao',
      assignedMemberUids: ['demo-member-dsr-001'],
      assignedMemberNames: ['Ananya Deshmukh'],
      priority: 'MEDIUM',
      status: 'Planning',
      progress: 25,
      internalRemarks: 'Baseline classification taxonomy under review.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'prj-006',
      projectCode: 'DSR-PRJ-2026-0006',
      projectName: 'Helios Executive Telemetry EMS Portal',
      clientId: 'cli-helios',
      clientName: 'Helios Energy Grid',
      category: 'EMS',
      description: 'Enterprise Management System unifying workforce dispatch, asset health, and regional SLA dashboards.',
      requirements: 'SSO integration and real-time operational alerting.',
      receivedDate: offsetDate(-3),
      planningDate: '',
      startDate: '',
      expectedCompletionDate: offsetDate(50),
      actualCompletionDate: '',
      quotedAmount: 130000,
      budget: 110000,
      advanceReceived: 0,
      totalReceived: 0,
      pendingAmount: 130000,
      assignedAdminUid: 'demo-admin-dsr-002',
      assignedAdminName: 'Meera Krishnan',
      assignedMemberUids: ['demo-member-dsr-003'],
      assignedMemberNames: ['Elena Vance'],
      priority: 'LOW',
      status: 'Proposal Sent',
      progress: 10,
      internalRemarks: 'Commercial proposal sent; procurement review expected next week.',
      isArchived: false,
      createdByUid: commandUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const milestones: Milestone[] = [
    { id: 'ms-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'External & API Attack Surface Discovery', dueDate: offsetDate(-15), status: 'COMPLETED', deliverables: 'Endpoint inventory & threat model', createdAt: nowIso, updatedAt: nowIso },
    { id: 'ms-002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'Core Ledger Exploitation & Remediation Report', dueDate: offsetDate(4), status: 'IN_PROGRESS', deliverables: 'Draft VAPT findings report & CVSS scoring', createdAt: nowIso, updatedAt: nowIso },
    { id: 'ms-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'OMS Event Bus & ERP Connector Cutover', dueDate: offsetDate(14), status: 'IN_PROGRESS', deliverables: 'Staging integration sign-off', createdAt: nowIso, updatedAt: nowIso },
    { id: 'ms-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', assignedAdminUid: 'demo-admin-dsr-002', projectMemberUids: ['demo-member-dsr-003', 'demo-member-dsr-004'], title: 'Production SIEM Rulebook Deployment', dueDate: offsetDate(3), status: 'IN_PROGRESS', deliverables: 'Runbook & automated alert routing', createdAt: nowIso, updatedAt: nowIso },
  ];

  const tasks: Task[] = [
    {
      id: 'tsk-001', taskCode: 'DSR-TSK-1001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
      projectName: 'FinVault Core Banking VAPT & Red Team', title: 'OAuth2 & Payment Gateway Token Hijack Audit',
      description: 'Validate PKCE enforcement, JWT signature verification, and replay protections across FinVault payment endpoints.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
      assignedDate: offsetDate(-20), startDate: offsetDate(-18), dueDate: offsetDate(-2),
      priority: 'CRITICAL', status: 'Completed', progress: 100, weight: 30,
      submissionNote: 'Verified all 18 token flows; 2 medium findings patched.', reviewFeedback: 'Approved cleanly.',
      createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-002', taskCode: 'DSR-TSK-1002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
      projectName: 'FinVault Core Banking VAPT & Red Team', title: 'Core Wire Transfer BOLA / IDOR Penetration Suite',
      description: 'Execute horizontal privilege escalation tests against multi-currency account endpoints.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
      assignedDate: offsetDate(-12), startDate: offsetDate(-10), dueDate: offsetDate(0),
      priority: 'CRITICAL', status: 'In Progress', progress: 70, weight: 35,
      submissionNote: '14/20 endpoints tested.', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-003', taskCode: 'DSR-TSK-1003', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
      projectName: 'FinVault Core Banking VAPT & Red Team', title: 'Kubernetes Lateral Movement & Secret Extraction Audit',
      description: 'Assess pod security standards and KMS IAM role boundaries in FinVault EKS staging cluster.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
      assignedDate: offsetDate(-10), startDate: offsetDate(-8), dueDate: offsetDate(-1),
      priority: 'HIGH', status: 'Blocked', progress: 40, weight: 35,
      blockerReason: 'Awaiting client bastion VPN whitelist for EKS read-only audit role.', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-004', taskCode: 'DSR-TSK-1004', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
      projectName: 'Meridian Distributed OMS Modernization', title: 'Order State Machine & Idempotency Layer',
      description: 'Implement distributed lock and idempotency keys for high-volume freight booking ingestion.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
      assignedDate: offsetDate(-15), startDate: offsetDate(-14), dueDate: offsetDate(5),
      priority: 'HIGH', status: 'Under Review', progress: 95, weight: 40,
      submissionNote: 'Load tested at 4,200 req/s with zero duplicate commits.', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-005', taskCode: 'DSR-TSK-1005', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
      projectName: 'Meridian Distributed OMS Modernization', title: 'Dispatcher RBAC & Webhook Signature Verification',
      description: 'Harden regional dispatcher access scopes and HMAC-SHA256 webhook verification.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
      assignedDate: offsetDate(-6), startDate: offsetDate(-3), dueDate: offsetDate(7),
      priority: 'MEDIUM', status: 'Revision Required', progress: 60, weight: 30,
      reviewFeedback: 'Please enforce timestamp replay window <= 300s on webhook verifier.', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-006', taskCode: 'DSR-TSK-1006', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
      projectName: 'Meridian Distributed OMS Modernization', title: 'Legacy EDI Batch Importer Cutover Script',
      description: 'Author dry-run validation and rollback scripts for legacy shipment records.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
      assignedDate: offsetDate(-2), startDate: offsetDate(0), dueDate: offsetDate(15),
      priority: 'MEDIUM', status: 'Not Started', progress: 0, weight: 30, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-007', taskCode: 'DSR-TSK-1007', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003',
      projectName: 'Aegis Autonomous SOC Triage Engine', title: 'HIPAA PHI Redaction Pipeline & Guardrails',
      description: 'Ensure zero unmasked patient identifiers enter external telemetry sinks.',
      assignedByUid: 'demo-admin-dsr-002', assignedByName: 'Meera Krishnan', assignedAdminUid: 'demo-admin-dsr-002',
      assigneeUid: 'demo-member-dsr-004', assigneeName: 'Kabir Sen',
      assignedDate: offsetDate(-14), startDate: offsetDate(-12), dueDate: offsetDate(-1),
      priority: 'CRITICAL', status: 'Completed', progress: 100, weight: 50,
      submissionNote: '99.98% precision verified against synthetic EHR benchmark.', reviewFeedback: 'Excellent coverage.',
      createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-008', taskCode: 'DSR-TSK-1008', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003',
      projectName: 'Aegis Autonomous SOC Triage Engine', title: 'Alert Correlation Scoring Calibration',
      description: 'Tune false-positive suppression thresholds on firewall anomaly bursts.',
      assignedByUid: 'demo-admin-dsr-002', assignedByName: 'Meera Krishnan', assignedAdminUid: 'demo-admin-dsr-002',
      assigneeUid: 'demo-member-dsr-003', assigneeName: 'Elena Vance',
      assignedDate: offsetDate(-9), startDate: offsetDate(-7), dueDate: offsetDate(2),
      priority: 'HIGH', status: 'Under Review', progress: 90, weight: 50,
      submissionNote: 'Reduced noisy triage alerts by 68%.', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-009', taskCode: 'DSR-TSK-1009', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004',
      projectName: 'Helios Zero-Trust Grid Segmentation', title: 'mTLS Substation Gateway Certificate Rotation',
      description: 'Deploy automated 24-hour short-lived mTLS certificates across 42 OT gateways.',
      assignedByUid: 'demo-admin-dsr-002', assignedByName: 'Meera Krishnan', assignedAdminUid: 'demo-admin-dsr-002',
      assigneeUid: 'demo-member-dsr-004', assigneeName: 'Kabir Sen',
      assignedDate: offsetDate(-40), startDate: offsetDate(-38), dueDate: offsetDate(-7),
      priority: 'HIGH', status: 'Completed', progress: 100, weight: 100,
      submissionNote: 'All 42 gateways rotated cleanly with zero packet loss.', reviewFeedback: 'Signed off by Helios OT lead.',
      createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: 'tsk-010', taskCode: 'DSR-TSK-1010', projectId: 'prj-005', projectCode: 'DSR-PRJ-2026-0005',
      projectName: 'FinVault Data Loss Prevention Rollout', title: 'Treasury Sensitive Data Classification Taxonomy',
      description: 'Define regex and fingerprint rules for SWIFT, IBAN, and customer PII records.',
      assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
      assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
      assignedDate: offsetDate(-4), startDate: offsetDate(-2), dueDate: offsetDate(10),
      priority: 'MEDIUM', status: 'In Progress', progress: 25, weight: 50, createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  const project_expenses: ProjectExpense[] = [
    { id: 'exp-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', assignedAdminUid: 'demo-admin-dsr-001', category: 'Contractor', description: 'Specialized hardware security module (HSM) pentest consultant', amount: 18500, expenseDate: offsetDate(-15), recordedByUid: commandUid, createdAt: nowIso },
    { id: 'exp-002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', assignedAdminUid: 'demo-admin-dsr-001', category: 'Licensing', description: 'Enterprise Burp Suite & fuzzing cluster licenses', amount: 6400, expenseDate: offsetDate(-25), recordedByUid: commandUid, createdAt: nowIso },
    { id: 'exp-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', projectName: 'Meridian Distributed OMS Modernization', assignedAdminUid: 'demo-admin-dsr-001', category: 'Infrastructure', description: 'Dedicated staging Kubernetes & telemetry cluster', amount: 12800, expenseDate: offsetDate(-10), recordedByUid: commandUid, createdAt: nowIso },
    { id: 'exp-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', projectName: 'Aegis Autonomous SOC Triage Engine', assignedAdminUid: 'demo-admin-dsr-002', category: 'Vendor', description: 'HIPAA third-party cryptographic attestation review', amount: 14200, expenseDate: offsetDate(-8), recordedByUid: commandUid, createdAt: nowIso },
    { id: 'exp-005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', projectName: 'Helios Zero-Trust Grid Segmentation', assignedAdminUid: 'demo-admin-dsr-002', category: 'Operational', description: 'On-site substation deployment & field travel', amount: 19500, expenseDate: offsetDate(-20), recordedByUid: commandUid, createdAt: nowIso },
  ];

  const project_invoices: ProjectInvoice[] = [
    { id: 'inv-001', invoiceNumber: 'DSR-INV-2026-0001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', clientId: 'cli-finvault', clientName: 'FinVault Global Bank', assignedAdminUid: 'demo-admin-dsr-001', amount: 100000, paidAmount: 100000, issueDate: offsetDate(-35), dueDate: offsetDate(-5), status: 'PAID', createdAt: nowIso, updatedAt: nowIso },
    { id: 'inv-002', invoiceNumber: 'DSR-INV-2026-0002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', clientId: 'cli-finvault', clientName: 'FinVault Global Bank', assignedAdminUid: 'demo-admin-dsr-001', amount: 45000, paidAmount: 0, issueDate: offsetDate(-3), dueDate: offsetDate(12), status: 'SENT', createdAt: nowIso, updatedAt: nowIso },
    { id: 'inv-003', invoiceNumber: 'DSR-INV-2026-0003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', projectName: 'Meridian Distributed OMS Modernization', clientId: 'cli-meridian', clientName: 'Meridian Freight & Logistics', assignedAdminUid: 'demo-admin-dsr-001', amount: 120000, paidAmount: 90000, issueDate: offsetDate(-20), dueDate: offsetDate(-1), status: 'OVERDUE', createdAt: nowIso, updatedAt: nowIso },
    { id: 'inv-004', invoiceNumber: 'DSR-INV-2026-0004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', projectName: 'Aegis Autonomous SOC Triage Engine', clientId: 'cli-aegis', clientName: 'Aegis Health Systems', assignedAdminUid: 'demo-admin-dsr-002', amount: 112000, paidAmount: 75000, issueDate: offsetDate(-14), dueDate: offsetDate(6), status: 'PARTIAL', createdAt: nowIso, updatedAt: nowIso },
    { id: 'inv-005', invoiceNumber: 'DSR-INV-2026-0005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', projectName: 'Helios Zero-Trust Grid Segmentation', clientId: 'cli-helios', clientName: 'Helios Energy Grid', assignedAdminUid: 'demo-admin-dsr-002', amount: 98000, paidAmount: 98000, issueDate: offsetDate(-50), dueDate: offsetDate(-10), status: 'PAID', createdAt: nowIso, updatedAt: nowIso },
  ];

  const payments: Payment[] = [
    { id: 'pay-001', invoiceId: 'inv-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', amount: 100000, paymentDate: offsetDate(-18), method: 'Wire Transfer', reference: 'SWIFT-FV-992841', recordedByUid: commandUid, createdAt: nowIso },
    { id: 'pay-002', invoiceId: 'inv-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', assignedAdminUid: 'demo-admin-dsr-001', amount: 90000, paymentDate: offsetDate(-12), method: 'ACH', reference: 'ACH-MFL-44021', recordedByUid: commandUid, createdAt: nowIso },
    { id: 'pay-003', invoiceId: 'inv-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', assignedAdminUid: 'demo-admin-dsr-002', amount: 75000, paymentDate: offsetDate(-7), method: 'Wire Transfer', reference: 'WIRE-AEG-78210', recordedByUid: commandUid, createdAt: nowIso },
    { id: 'pay-004', invoiceId: 'inv-005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', assignedAdminUid: 'demo-admin-dsr-002', amount: 98000, paymentDate: offsetDate(-14), method: 'Wire Transfer', reference: 'WIRE-HEL-55109', recordedByUid: commandUid, createdAt: nowIso },
  ];

  const deadline_extension_requests: DeadlineExtensionRequest[] = [
    {
      id: 'ext-001',
      targetType: 'TASK',
      targetId: 'tsk-003',
      targetTitle: 'Kubernetes Lateral Movement & Secret Extraction Audit',
      projectId: 'prj-001',
      assignedAdminUid: 'demo-admin-dsr-001',
      requesterUid: 'demo-member-dsr-002',
      requesterName: 'Rohan Malhotra',
      currentDueDate: offsetDate(-1),
      requestedDueDate: offsetDate(5),
      reason: 'Client InfoSec team scheduled bastion IP whitelist maintenance window for tomorrow.',
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann-001',
      title: 'Q4 ISO-27001 & VAPT Delivery Governance Window',
      message: 'All active engagement leads must ensure weekly weighted task progress and deliverable artifacts are uploaded prior to Friday 17:00 UTC executive review.',
      priority: 'IMPORTANT',
      authorUid: commandUid,
      authorName: 'Arjun Deshmukh',
      isActive: true,
      createdAt: nowIso,
    },
  ];

  const notifications: NotificationItem[] = [
    { id: 'ntf-001', recipientUid: commandUid, type: 'PAYMENT_DUE', title: 'Overdue Invoice Alert: DSR-INV-2026-0003', message: 'Meridian Freight & Logistics has $30,000 remaining past due date.', entityType: 'INVOICE', entityId: 'inv-003', isRead: false, createdAt: nowIso },
    { id: 'ntf-002', recipientUid: 'demo-admin-dsr-001', type: 'EXTENSION_REQUESTED', title: 'Extension Request: DSR-TSK-1003', message: 'Rohan Malhotra requested a 6-day extension due to bastion maintenance.', entityType: 'TASK', entityId: 'tsk-003', isRead: false, createdAt: nowIso },
    { id: 'ntf-003', recipientUid: 'demo-member-dsr-001', type: 'TASK_REJECTED', title: 'Revision Requested: DSR-TSK-1005', message: 'Vikramaditya Rao requested replay window <= 300s on webhook verifier.', entityType: 'TASK', entityId: 'tsk-005', isRead: false, createdAt: nowIso },
  ];

  const audit_logs: AuditLog[] = [
    {
      id: 'aud-seed-001',
      actorUid: commandUid,
      actorEmail: 'command@dsrsecuretech.com',
      actorRole: 'SUPER_ADMIN',
      action: 'ORG_WORKSPACE_INITIALIZED',
      resourceType: 'SYSTEM',
      resourceId: 'org-primary',
      summary: 'Initialized DSR SecureTech enterprise workspace with baseline governance records.',
      createdAt: nowIso,
    },
  ];

  const system_settings: SystemSetting[] = [
    {
      id: 'org-primary',
      scope: 'public',
      companyName: 'DSR SecureTech',
      currency: 'USD',
      deadlineWarningDays: 5,
      emailNotificationsEnabled: true,
      enforcePasswordRotation: true,
      updatedByUid: commandUid,
      updatedAt: nowIso,
    },
  ];

  return {
    users,
    departments,
    clients,
    projects,
    milestones,
    tasks,
    task_comments: [],
    task_attachments: [],
    task_activity_logs: [],
    project_documents: [],
    project_expenses,
    project_invoices,
    payments,
    notifications,
    deadline_extension_requests,
    announcements,
    audit_logs,
    login_sessions: [],
    system_settings,
  };
}

let cachedDataset: WorkspaceDataset | null = null;
const listeners = new Map<CollectionKey, Set<(items: unknown[]) => void>>();

function getStore(): WorkspaceDataset {
  if (cachedDataset) return cachedDataset;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceDataset;
        if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.users)) {
          cachedDataset = parsed;
          return cachedDataset;
        }
      }
    } catch {
      // Corrupt cache fallback
    }
  }
  cachedDataset = createInitialEnterpriseDataset();
  persistStore(cachedDataset);
  return cachedDataset;
}

function persistStore(dataset: WorkspaceDataset): void {
  cachedDataset = dataset;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Storage quota exceeded safeguard
    }
  }
}

function notifyCollection(key: CollectionKey): void {
  const store = getStore();
  const subs = listeners.get(key);
  if (!subs) return;
  const data = [...(store[key] as unknown[])];
  subs.forEach((cb) => cb(data));
}

export function subscribeLocalCollection<T>(
  key: CollectionKey,
  onData: (items: T[]) => void
): () => void {
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(onData as (items: unknown[]) => void);
  const store = getStore();
  onData([...(store[key] as unknown[])] as T[]);

  return () => {
    subs?.delete(onData as (items: unknown[]) => void);
  };
}

export function getLocalCollection<T>(key: CollectionKey): T[] {
  return [...(getStore()[key] as unknown[])] as T[];
}

export function upsertLocalRecord<T extends { id?: string; uid?: string }>(
  key: CollectionKey,
  record: T
): void {
  const store = getStore();
  const list = [...(store[key] as unknown as T[])];
  const targetId = key === 'users' ? record.uid : record.id;
  const idx = list.findIndex((item) => (key === 'users' ? item.uid : item.id) === targetId);
  const stamped = { ...record };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...stamped };
  } else {
    list.unshift(stamped);
  }
  const next = { ...store, [key]: list };
  persistStore(next);
  notifyCollection(key);
}

export function deleteLocalRecord(key: CollectionKey, id: string): void {
  const store = getStore();
  const list = (store[key] as unknown as Array<{ id?: string; uid?: string }>).filter(
    (item) => (key === 'users' ? item.uid : item.id) !== id
  );
  const next = { ...store, [key]: list };
  persistStore(next);
  notifyCollection(key);
}

export function recalculateLocalProjectProgress(projectId: string): number {
  const tasks = getLocalCollection<Task>('tasks').filter((t) => t.projectId === projectId);
  const progress = calculateWeightedProjectProgress(tasks);
  const projects = getLocalCollection<Project>('projects');
  const target = projects.find((p) => p.id === projectId);
  if (target) {
    upsertLocalRecord('projects', {
      ...target,
      progress,
      updatedAt: new Date().toISOString(),
    });
  }
  return progress;
}

export function authenticateTempCredentials(
  accessIdInput: string,
  passwordInput: string
): { ok: true; user: UserProfile } | { ok: false; error: string } {
  const cleanId = accessIdInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();
  if (!cleanId || !cleanPass) {
    return { ok: false, error: 'Please enter both your Access / Temp ID and password.' };
  }

  const users = getLocalCollection<UserProfile>('users');
  const matched = users.find(
    (u) =>
      u.employeeId.toLowerCase() === cleanId ||
      u.email.toLowerCase() === cleanId
  );

  if (!matched) {
    return { ok: false, error: `Access ID "${accessIdInput.trim()}" was not found.` };
  }

  if (matched.status === 'INACTIVE') {
    return { ok: false, error: 'This access account has been deactivated by workspace governance.' };
  }

  const expectedPass = matched.tempPassword || DEFAULT_TEMP_ACCESS_PASS;
  if (cleanPass !== expectedPass) {
    return { ok: false, error: 'Invalid temporary or workspace password.' };
  }

  const updated: UserProfile = {
    ...matched,
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  upsertLocalRecord('users', updated);

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, updated.uid);
  }

  upsertLocalRecord('login_sessions', {
    id: generateSafeId('ses'),
    userUid: updated.uid,
    userEmail: updated.email,
    userRole: updated.role,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 280) : 'Web Client',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, user: updated };
}

export function getActiveTempSessionUser(): UserProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const uid = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!uid) return null;
  const users = getLocalCollection<UserProfile>('users');
  return users.find((u) => u.uid === uid) || null;
}

export function clearActiveTempSession(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export function updateLocalUserTempPassword(
  uid: string,
  newPassword: string,
  displayName?: string,
  phone?: string
): UserProfile | null {
  const users = getLocalCollection<UserProfile>('users');
  const existing = users.find((u) => u.uid === uid);
  if (!existing) return null;
  const updated: UserProfile = {
    ...existing,
    displayName: displayName?.trim() || existing.displayName,
    phone: phone !== undefined ? phone.trim() : existing.phone,
    tempPassword: newPassword.trim(),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };
  upsertLocalRecord('users', updated);
  return updated;
}
