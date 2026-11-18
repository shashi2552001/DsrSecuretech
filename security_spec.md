# DSR Project Command Center — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **No Self-Privilege Escalation**: A non-bootstrapped user cannot create or update their `/users/{userId}` document with `role: 'SUPER_ADMIN'` or `role: 'ADMIN'`, nor mutate `permissions`, `status`, or `employeeId`.
2. **PII Isolation**: `/users/{userId}` and `/clients/{clientId}` contain PII (`email`, `phone`, `address`). Unrelated Team Members cannot read another user's `/users` document or any `/clients` document.
3. **Project & Task Scoping**: Admins can only read/manage projects where `assignedAdminUid == request.auth.uid`. Team Members can only read projects where `request.auth.uid in assignedMemberUids` and can only update their own assigned tasks' progress/status/submissionNote/blockerReason — never reassigning tasks or changing budgets.
4. **Financial Isolation**: `/project_expenses`, `/project_invoices`, and `/payments` are strictly inaccessible to Team Members (`TEAM_MEMBER`).
5. **Immutable Audit Trail**: `/audit_logs` and `/task_activity_logs` are append-only (`allow update, delete: if false;`).
6. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`, all document IDs must match `^[a-zA-Z0-9_-]{1,128}$`, and all strings/arrays have explicit upper bounds.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. **Self-Elevation on Registration**: Authenticated Team Member creates `/users/{myUid}` with `role: "SUPER_ADMIN"`.
2. **Shadow Field Injection on User Update**: Authenticated user updates `/users/{myUid}` with `{ displayName: "Test", isVerified: true, updatedAt: request.time }`.
3. **Role Tampering on Update**: Authenticated Admin updates `/users/{myUid}` changing `role` from `"ADMIN"` to `"SUPER_ADMIN"`.
4. **Email Spoofing Bypass**: Unverified token (`email_verified: false`) claiming `itsdemoid00@gmail.com` attempts to list `/users`.
5. **Cross-Tenant PII Read**: Team Member attempts `get` on `/clients/cli-001` or `/users/other-uid`.
6. **Unauthorized Financial Read**: Team Member attempts `list` on `/project_invoices` or `/project_expenses`.
7. **Unauthorized Project Deletion**: Admin or Team Member attempts `delete` on `/projects/prj-001`.
8. **Task Reassignment by Team Member**: Team Member updates `/tasks/tsk-001` attempting to modify `assigneeUid` or `weight`.
9. **Audit Log Tampering**: Even Super Admin or Admin attempts `update` or `delete` on `/audit_logs/log-001`.
10. **ID Poisoning**: Authenticated user attempts `create` at `/tasks/` with a 500-char junk ID containing `/` or spaces.
11. **Client Timestamp Forgery**: Authenticated user creates `/tasks/tsk-999` with `createdAt` set to a past client timestamp instead of `request.time`.
12. **Blanket Query Scraping**: Team Member runs `list` on `/tasks` without `where('assigneeUid', '==', uid)` matching `resource.data`.
