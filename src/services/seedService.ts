import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { ALL_PERMISSIONS, OperationType } from '../types/domain';

function offsetDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/**
 * Seeds realistic DSR SecureTech enterprise data into Firestore in development mode
 * when the organization dataset has not yet been initialized.
 * Writes parent collections before child collections so relational exists() rules pass.
 */
export async function seedEnterpriseDemoData(superAdminUid: string, superAdminEmail: string, superAdminName: string): Promise<boolean> {
  try {
    const markerRef = doc(db, 'system_settings', 'org-primary');
    const markerSnap = await getDoc(markerRef);
    if (markerSnap.exists()) {
      return false;
    }

    // 1. System Settings
    await setDoc(markerRef, {
      id: 'org-primary',
      scope: 'public',
      companyName: 'DSR SecureTech',
      currency: 'USD',
      deadlineWarningDays: 5,
      emailNotificationsEnabled: true,
      enforcePasswordRotation: true,
      updatedByUid: superAdminUid,
      updatedAt: serverTimestamp(),
    });

    // 2. Departments
    const departments = [
      { id: 'dept-cyber', name: 'Cybersecurity & VAPT', headUid: 'demo-admin-dsr-001', headName: 'Vikramaditya Rao', isActive: true },
      { id: 'dept-ai', name: 'AI & Automation', headUid: 'demo-admin-dsr-002', headName: 'Meera Krishnan', isActive: true },
      { id: 'dept-eng', name: 'Enterprise Software & EMS', headUid: 'demo-admin-dsr-001', headName: 'Vikramaditya Rao', isActive: true },
      { id: 'dept-data', name: 'Data Security & Compliance', headUid: 'demo-admin-dsr-002', headName: 'Meera Krishnan', isActive: true },
    ];
    for (const d of departments) {
      await setDoc(doc(db, 'departments', d.id), {
        ...d,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Users (Super Admin, 2 Admins, 4 Team Members)
    const users = [
      {
        uid: superAdminUid,
        employeeId: 'DSR-SA-001',
        displayName: superAdminName || 'DSR Executive Command',
        email: superAdminEmail,
        phone: '+1-415-890-2100',
        department: 'Executive Governance',
        designation: 'Chief Information Security Officer',
        role: 'SUPER_ADMIN',
        permissions: [...ALL_PERMISSIONS],
        managerUid: superAdminUid,
        joiningDate: '2023-01-10',
        status: 'ACTIVE',
        mustChangePassword: false,
        lastLoginAt: new Date().toISOString(),
      },
      {
        uid: 'demo-admin-dsr-001',
        employeeId: 'DSR-ADM-001',
        displayName: 'Vikramaditya Rao',
        email: 'admin@dsrsecuretech.com',
        phone: '+1-415-890-2142',
        department: 'Cybersecurity & VAPT',
        designation: 'Principal Security Lead',
        role: 'ADMIN',
        permissions: ['projects:edit', 'tasks:assign', 'tasks:review', 'reports:export', 'finance:view'],
        managerUid: superAdminUid,
        joiningDate: '2023-06-15',
        status: 'ACTIVE',
        mustChangePassword: true,
        lastLoginAt: new Date().toISOString(),
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
        managerUid: superAdminUid,
        joiningDate: '2024-02-01',
        status: 'ACTIVE',
        mustChangePassword: false,
        lastLoginAt: new Date().toISOString(),
      },
      {
        uid: 'demo-member-dsr-001',
        employeeId: 'DSR-TM-001',
        displayName: 'Ananya Deshmukh',
        email: 'member@dsrsecuretech.com',
        phone: '+1-415-890-2204',
        department: 'Cybersecurity & VAPT',
        designation: 'Senior Penetration Tester',
        role: 'TEAM_MEMBER',
        permissions: [],
        managerUid: 'demo-admin-dsr-001',
        joiningDate: '2024-04-12',
        status: 'ACTIVE',
        mustChangePassword: true,
        lastLoginAt: new Date().toISOString(),
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
        lastLoginAt: new Date().toISOString(),
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
        lastLoginAt: new Date().toISOString(),
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
        lastLoginAt: new Date().toISOString(),
      },
    ];

    for (const u of users) {
      await setDoc(doc(db, 'users', u.uid), {
        ...u,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 4. Clients
    const clients = [
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
      },
    ];
    for (const c of clients) {
      await setDoc(doc(db, 'clients', c.id), {
        ...c,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 5. Projects
    const projects = [
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
        progress: 63,
        internalRemarks: 'Phase 2 API exploitation complete; awaiting client hotfix window for re-test.',
        isArchived: false,
        createdByUid: superAdminUid,
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
        progress: 45,
        internalRemarks: 'Core order state machine deployed to staging cluster.',
        isArchived: false,
        createdByUid: superAdminUid,
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
        progress: 82,
        internalRemarks: 'Ready for final CISO sign-off review.',
        isArchived: false,
        createdByUid: superAdminUid,
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
        createdByUid: superAdminUid,
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
        progress: 15,
        internalRemarks: 'Baseline classification taxonomy under review.',
        isArchived: false,
        createdByUid: superAdminUid,
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
        progress: 0,
        internalRemarks: 'Commercial proposal sent; procurement review expected next week.',
        isArchived: false,
        createdByUid: superAdminUid,
      },
    ];

    for (const p of projects) {
      await setDoc(doc(db, 'projects', p.id), {
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 6. Milestones
    const milestones = [
      { id: 'ms-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'External & API Attack Surface Discovery', dueDate: offsetDate(-15), status: 'COMPLETED', deliverables: 'Endpoint inventory & threat model' },
      { id: 'ms-002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'Core Ledger Exploitation & Remediation Report', dueDate: offsetDate(4), status: 'IN_PROGRESS', deliverables: 'Draft VAPT findings report & CVSS scoring' },
      { id: 'ms-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', assignedAdminUid: 'demo-admin-dsr-001', projectMemberUids: ['demo-member-dsr-001', 'demo-member-dsr-002'], title: 'OMS Event Bus & ERP Connector Cutover', dueDate: offsetDate(14), status: 'IN_PROGRESS', deliverables: 'Staging integration sign-off' },
      { id: 'ms-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', assignedAdminUid: 'demo-admin-dsr-002', projectMemberUids: ['demo-member-dsr-003', 'demo-member-dsr-004'], title: 'Production SIEM Rulebook Deployment', dueDate: offsetDate(3), status: 'IN_PROGRESS', deliverables: 'Runbook & automated alert routing' },
    ];
    for (const m of milestones) {
      await setDoc(doc(db, 'milestones', m.id), {
        ...m,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 7. Tasks (Covers all 6 statuses + overdue + today + approaching)
    const tasks = [
      {
        id: 'tsk-001', taskCode: 'DSR-TSK-1001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
        projectName: 'FinVault Core Banking VAPT & Red Team', title: 'OAuth2 & Payment Gateway Token Hijack Audit',
        description: 'Validate PKCE enforcement, JWT signature verification, and replay protections across FinVault payment endpoints.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
        assignedDate: offsetDate(-20), startDate: offsetDate(-18), dueDate: offsetDate(-2),
        priority: 'CRITICAL', status: 'Completed', progress: 100, weight: 30,
        submissionNote: 'Verified all 18 token flows; 2 medium findings patched.', reviewFeedback: 'Approved cleanly.',
      },
      {
        id: 'tsk-002', taskCode: 'DSR-TSK-1002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
        projectName: 'FinVault Core Banking VAPT & Red Team', title: 'Core Wire Transfer BOLA / IDOR Penetration Suite',
        description: 'Execute horizontal privilege escalation tests against multi-currency account endpoints.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
        assignedDate: offsetDate(-12), startDate: offsetDate(-10), dueDate: offsetDate(0),
        priority: 'CRITICAL', status: 'In Progress', progress: 70, weight: 35,
        submissionNote: '14/20 endpoints tested.',
      },
      {
        id: 'tsk-003', taskCode: 'DSR-TSK-1003', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001',
        projectName: 'FinVault Core Banking VAPT & Red Team', title: 'Kubernetes Lateral Movement & Secret Extraction Audit',
        description: 'Assess pod security standards and KMS IAM role boundaries in FinVault EKS staging cluster.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
        assignedDate: offsetDate(-10), startDate: offsetDate(-8), dueDate: offsetDate(-1),
        priority: 'HIGH', status: 'Blocked', progress: 40, weight: 35,
        blockerReason: 'Awaiting client bastion VPN whitelist for EKS read-only audit role.',
      },
      {
        id: 'tsk-004', taskCode: 'DSR-TSK-1004', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
        projectName: 'Meridian Distributed OMS Modernization', title: 'Order State Machine & Idempotency Layer',
        description: 'Implement distributed lock and idempotency keys for high-volume freight booking ingestion.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
        assignedDate: offsetDate(-15), startDate: offsetDate(-14), dueDate: offsetDate(5),
        priority: 'HIGH', status: 'Under Review', progress: 95, weight: 40,
        submissionNote: 'Load tested at 4,200 req/s with zero duplicate commits.',
      },
      {
        id: 'tsk-005', taskCode: 'DSR-TSK-1005', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
        projectName: 'Meridian Distributed OMS Modernization', title: 'Dispatcher RBAC & Webhook Signature Verification',
        description: 'Harden regional dispatcher access scopes and HMAC-SHA256 webhook verification.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
        assignedDate: offsetDate(-6), startDate: offsetDate(-3), dueDate: offsetDate(7),
        priority: 'MEDIUM', status: 'Revision Required', progress: 60, weight: 30,
        reviewFeedback: 'Please enforce timestamp replay window <= 300s on webhook verifier.',
      },
      {
        id: 'tsk-006', taskCode: 'DSR-TSK-1006', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002',
        projectName: 'Meridian Distributed OMS Modernization', title: 'Legacy EDI Batch Importer Cutover Script',
        description: 'Author dry-run validation and rollback scripts for legacy shipment records.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-002', assigneeName: 'Rohan Malhotra',
        assignedDate: offsetDate(-2), startDate: offsetDate(0), dueDate: offsetDate(15),
        priority: 'MEDIUM', status: 'Not Started', progress: 0, weight: 30,
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
      },
      {
        id: 'tsk-008', taskCode: 'DSR-TSK-1008', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003',
        projectName: 'Aegis Autonomous SOC Triage Engine', title: 'Alert Correlation Scoring Calibration',
        description: 'Tune false-positive suppression thresholds on firewall anomaly bursts.',
        assignedByUid: 'demo-admin-dsr-002', assignedByName: 'Meera Krishnan', assignedAdminUid: 'demo-admin-dsr-002',
        assigneeUid: 'demo-member-dsr-003', assigneeName: 'Elena Vance',
        assignedDate: offsetDate(-9), startDate: offsetDate(-7), dueDate: offsetDate(2),
        priority: 'HIGH', status: 'Under Review', progress: 90, weight: 50,
        submissionNote: 'Reduced noisy triage alerts by 68%.',
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
      },
      {
        id: 'tsk-010', taskCode: 'DSR-TSK-1010', projectId: 'prj-005', projectCode: 'DSR-PRJ-2026-0005',
        projectName: 'FinVault Data Loss Prevention Rollout', title: 'Treasury Sensitive Data Classification Taxonomy',
        description: 'Define regex and fingerprint rules for SWIFT, IBAN, and customer PII records.',
        assignedByUid: 'demo-admin-dsr-001', assignedByName: 'Vikramaditya Rao', assignedAdminUid: 'demo-admin-dsr-001',
        assigneeUid: 'demo-member-dsr-001', assigneeName: 'Ananya Deshmukh',
        assignedDate: offsetDate(-4), startDate: offsetDate(-2), dueDate: offsetDate(10),
        priority: 'MEDIUM', status: 'In Progress', progress: 25, weight: 50,
      },
    ];

    for (const t of tasks) {
      await setDoc(doc(db, 'tasks', t.id), {
        ...t,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 8. Financial Expenses, Invoices & Payments
    const expenses = [
      { id: 'exp-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', assignedAdminUid: 'demo-admin-dsr-001', category: 'Contractor', description: 'Specialized hardware security module (HSM) pentest consultant', amount: 18500, expenseDate: offsetDate(-15), recordedByUid: superAdminUid },
      { id: 'exp-002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', assignedAdminUid: 'demo-admin-dsr-001', category: 'Licensing', description: 'Enterprise Burp Suite & fuzzing cluster licenses', amount: 6400, expenseDate: offsetDate(-25), recordedByUid: superAdminUid },
      { id: 'exp-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', projectName: 'Meridian Distributed OMS Modernization', assignedAdminUid: 'demo-admin-dsr-001', category: 'Infrastructure', description: 'Dedicated staging Kubernetes & telemetry cluster', amount: 12800, expenseDate: offsetDate(-10), recordedByUid: superAdminUid },
      { id: 'exp-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', projectName: 'Aegis Autonomous SOC Triage Engine', assignedAdminUid: 'demo-admin-dsr-002', category: 'Vendor', description: 'HIPAA third-party cryptographic attestation review', amount: 14200, expenseDate: offsetDate(-8), recordedByUid: superAdminUid },
      { id: 'exp-005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', projectName: 'Helios Zero-Trust Grid Segmentation', assignedAdminUid: 'demo-admin-dsr-002', category: 'Operational', description: 'On-site substation deployment & field travel', amount: 19500, expenseDate: offsetDate(-20), recordedByUid: superAdminUid },
    ];
    for (const e of expenses) {
      await setDoc(doc(db, 'project_expenses', e.id), { ...e, createdAt: serverTimestamp() });
    }

    const invoices = [
      { id: 'inv-001', invoiceNumber: 'DSR-INV-2026-0001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', clientId: 'cli-finvault', clientName: 'FinVault Global Bank', assignedAdminUid: 'demo-admin-dsr-001', amount: 100000, paidAmount: 100000, issueDate: offsetDate(-35), dueDate: offsetDate(-5), status: 'PAID' },
      { id: 'inv-002', invoiceNumber: 'DSR-INV-2026-0002', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', projectName: 'FinVault Core Banking VAPT & Red Team', clientId: 'cli-finvault', clientName: 'FinVault Global Bank', assignedAdminUid: 'demo-admin-dsr-001', amount: 45000, paidAmount: 0, issueDate: offsetDate(-3), dueDate: offsetDate(12), status: 'SENT' },
      { id: 'inv-003', invoiceNumber: 'DSR-INV-2026-0003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', projectName: 'Meridian Distributed OMS Modernization', clientId: 'cli-meridian', clientName: 'Meridian Freight & Logistics', assignedAdminUid: 'demo-admin-dsr-001', amount: 120000, paidAmount: 90000, issueDate: offsetDate(-20), dueDate: offsetDate(-1), status: 'OVERDUE' },
      { id: 'inv-004', invoiceNumber: 'DSR-INV-2026-0004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', projectName: 'Aegis Autonomous SOC Triage Engine', clientId: 'cli-aegis', clientName: 'Aegis Health Systems', assignedAdminUid: 'demo-admin-dsr-002', amount: 112000, paidAmount: 75000, issueDate: offsetDate(-14), dueDate: offsetDate(6), status: 'PARTIAL' },
      { id: 'inv-005', invoiceNumber: 'DSR-INV-2026-0005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', projectName: 'Helios Zero-Trust Grid Segmentation', clientId: 'cli-helios', clientName: 'Helios Energy Grid', assignedAdminUid: 'demo-admin-dsr-002', amount: 98000, paidAmount: 98000, issueDate: offsetDate(-50), dueDate: offsetDate(-10), status: 'PAID' },
    ];
    for (const inv of invoices) {
      await setDoc(doc(db, 'project_invoices', inv.id), { ...inv, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }

    const payments = [
      { id: 'pay-001', invoiceId: 'inv-001', projectId: 'prj-001', projectCode: 'DSR-PRJ-2026-0001', assignedAdminUid: 'demo-admin-dsr-001', amount: 100000, paymentDate: offsetDate(-18), method: 'Wire Transfer', reference: 'SWIFT-FV-992841', recordedByUid: superAdminUid },
      { id: 'pay-002', invoiceId: 'inv-003', projectId: 'prj-002', projectCode: 'DSR-PRJ-2026-0002', assignedAdminUid: 'demo-admin-dsr-001', amount: 90000, paymentDate: offsetDate(-12), method: 'ACH', reference: 'ACH-MFL-44021', recordedByUid: superAdminUid },
      { id: 'pay-003', invoiceId: 'inv-004', projectId: 'prj-003', projectCode: 'DSR-PRJ-2026-0003', assignedAdminUid: 'demo-admin-dsr-002', amount: 75000, paymentDate: offsetDate(-7), method: 'Wire Transfer', reference: 'WIRE-AEG-78210', recordedByUid: superAdminUid },
      { id: 'pay-004', invoiceId: 'inv-005', projectId: 'prj-004', projectCode: 'DSR-PRJ-2026-0004', assignedAdminUid: 'demo-admin-dsr-002', amount: 98000, paymentDate: offsetDate(-14), method: 'Wire Transfer', reference: 'WIRE-HEL-55109', recordedByUid: superAdminUid },
    ];
    for (const pay of payments) {
      await setDoc(doc(db, 'payments', pay.id), { ...pay, createdAt: serverTimestamp() });
    }

    // 9. Deadline Extension Request, Announcements, Notifications, Audit Logs
    await setDoc(doc(db, 'deadline_extension_requests', 'ext-001'), {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'announcements', 'ann-001'), {
      id: 'ann-001',
      title: 'Q4 ISO-27001 & VAPT Delivery Governance Window',
      message: 'All active engagement leads must ensure weekly weighted task progress and deliverable artifacts are uploaded prior to Friday 17:00 UTC executive review.',
      priority: 'IMPORTANT',
      authorUid: superAdminUid,
      authorName: superAdminName || 'DSR Executive Command',
      isActive: true,
      createdAt: serverTimestamp(),
    });

    const notifications = [
      { id: 'ntf-001', recipientUid: superAdminUid, type: 'PAYMENT_DUE', title: 'Overdue Invoice Alert: DSR-INV-2026-0003', message: 'Meridian Freight & Logistics has $30,000 remaining past due date.', entityType: 'INVOICE', entityId: 'inv-003', isRead: false },
      { id: 'ntf-002', recipientUid: 'demo-admin-dsr-001', type: 'EXTENSION_REQUESTED', title: 'Extension Request: DSR-TSK-1003', message: 'Rohan Malhotra requested a 6-day extension due to bastion maintenance.', entityType: 'TASK', entityId: 'tsk-003', isRead: false },
      { id: 'ntf-003', recipientUid: 'demo-member-dsr-001', type: 'TASK_REJECTED', title: 'Revision Requested: DSR-TSK-1005', message: 'Vikramaditya Rao requested replay window <= 300s on webhook verifier.', entityType: 'TASK', entityId: 'tsk-005', isRead: false },
    ];
    for (const n of notifications) {
      await setDoc(doc(db, 'notifications', n.id), { ...n, createdAt: serverTimestamp() });
    }

    await setDoc(doc(db, 'audit_logs', 'aud-seed-001'), {
      id: 'aud-seed-001',
      actorUid: superAdminUid,
      actorEmail: superAdminEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ORG_WORKSPACE_INITIALIZED',
      resourceType: 'SYSTEM',
      resourceId: 'org-primary',
      summary: 'Initialized DSR SecureTech enterprise workspace with baseline governance records.',
      createdAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedEnterpriseDemoData');
  }
}
