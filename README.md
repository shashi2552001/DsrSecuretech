# DSR SecureTech — DSR Project Command Center

Enterprise Project Management, Operations, Financial Governance, and Workforce Portal for **DSR SecureTech**.

## Architecture Overview
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Three.js (3D Enterprise Project Topology), Recharts, Lucide Icons.
- **Database & Auth**: Firebase Firestore (configured via `firebase-applet-config.json` and `firebase-blueprint.json`) + Google Enterprise SSO via Firebase Authentication.
- **Security**: Zero-trust `firestore.rules` audited with `@firebase/eslint-plugin-security-rules`, enforcing strict Role-Based Access Control (`SUPER_ADMIN`, `ADMIN`, `TEAM_MEMBER`), PII isolation, field allowlisting, server timestamp integrity (`request.time`), and immutable audit logs.
- **Exports**: Real client-side CSV, Excel (`.xlsx` via SheetJS), PDF (`.pdf` via `jspdf` + `jspdf-autotable`), and JSON full-snapshot backups.

## Role-Based Access Control (RBAC)
1. **Super Admin (`SUPER_ADMIN`)**: Full organization dashboard (10+ KPIs, 3D topology, P&L charts), Project CRUD (`DSR-PRJ-YYYY-NNNN`), Client management, Financial ledger (invoices, payments, expenses), Employee & Authority management, 14 exportable reports, Announcements, Audit Logs, and System Settings.
2. **Admin (`ADMIN`)**: Scoped exclusively to assigned projects and team members. Can assign/reassign tasks, review submitted deliverables (Approve / Request Revision), manage project milestones/documents, request deadline extensions, and view scoped reports. Cannot access unassigned projects, delete projects, or alter Super Admin permissions.
3. **Team Member (`TEAM_MEMBER`)**: Scoped exclusively to assigned tasks and active projects. Can update progress %, submit deliverables for review, upload validated attachments, comment, report blockers, request deadline extensions, and view personal productivity metrics. Cannot view client PII or financial ledgers.

## Development & Verification Commands
```bash
npm install
npm run lint
npm run build
npx eslint firestore.rules
```
