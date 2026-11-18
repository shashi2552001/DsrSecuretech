/**
 * Security Rules Unit Specification Verification
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules invariants.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Self-Elevation on Registration',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Non-bootstrapped user attempts to create /users/{uid} with role SUPER_ADMIN.',
  },
  {
    id: 'DD-02',
    title: 'Shadow Field Injection on Update',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Authenticated user injects undocumented field isVerified: true into /users/{uid}.',
  },
  {
    id: 'DD-03',
    title: 'Role Tampering on Profile Update',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Admin attempts to mutate own role from ADMIN to SUPER_ADMIN.',
  },
  {
    id: 'DD-04',
    title: 'Unverified Email Claim Spoofing',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Token with email_verified: false attempts to list /users.',
  },
  {
    id: 'DD-05',
    title: 'Cross-Tenant Client PII Read',
    collection: 'clients',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Team Member attempts to read /clients/{clientId} containing email/phone/address.',
  },
  {
    id: 'DD-06',
    title: 'Unauthorized Financial Invoice Read',
    collection: 'project_invoices',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Team Member attempts to list financial invoices or expenses.',
  },
  {
    id: 'DD-07',
    title: 'Unauthorized Project Deletion',
    collection: 'projects',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Admin or Team Member attempts to delete a project document.',
  },
  {
    id: 'DD-08',
    title: 'Task Reassignment by Team Member',
    collection: 'tasks',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Team Member attempts to modify assigneeUid or weight on an assigned task.',
  },
  {
    id: 'DD-09',
    title: 'Audit Log Mutation',
    collection: 'audit_logs',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Even Super Admin cannot update or delete immutable audit logs.',
  },
  {
    id: 'DD-10',
    title: 'Document ID Poisoning',
    collection: 'tasks',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'ID exceeding 128 chars or containing invalid characters rejected by isValidId().',
  },
  {
    id: 'DD-11',
    title: 'Client Timestamp Forgery',
    collection: 'tasks',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Client submits forged createdAt != request.time.',
  },
  {
    id: 'DD-12',
    title: 'Terminal State Modification by Member',
    collection: 'tasks',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Team Member attempts to reopen a task whose status is already Completed.',
  },
];
