import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { AppShell } from './components/AppShell';
import { AuthGate, FirstLoginPolicyModal } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth, googleAuthProvider } from './lib/firebase';
import { AuditAndSettingsPage } from './pages/AuditAndSettingsPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { FinancePage } from './pages/FinancePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ReportsPage } from './pages/ReportsPage';
import { TasksPage } from './pages/TasksPage';
import { TimelinePage } from './pages/TimelinePage';
import { WorkforcePage } from './pages/WorkforcePage';
import {
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
  UserProfile,
  fetchUserByUid,
  recordLoginSession,
  subscribeCollection,
  updateLoginSessionStatus,
  updateOwnUserSafeFields,
  upsertUserProfile,
} from './services/firestoreService';
import {
  authenticateTempCredentials,
  clearActiveTempSession,
  getActiveTempSessionUser,
  updateLocalUserTempPassword,
} from './services/localStoreService';
import { seedEnterpriseDemoData } from './services/seedService';
import { AppPage, UserRole } from './types/domain';

function MainPortal() {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [isTempSession, setIsTempSession] = useState<boolean>(() => Boolean(getActiveTempSessionUser()));
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getActiveTempSessionUser());
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const activeSessionIdRef = useRef<string | null>(null);

  // Live collections (Firestore in SSO mode, localStore in Temp ID mode)
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<DeadlineExtensionRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [settingsList, setSettingsList] = useState<SystemSetting[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // 1. Firebase SSO Auth Listener (preserves active Temp ID session if !fbUser)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        const localUser = getActiveTempSessionUser();
        if (localUser) {
          setIsTempSession(true);
          setUserProfile(localUser);
        } else {
          setIsTempSession(false);
          setUserProfile(null);
        }
        setAuthReady(true);
        setDataLoading(false);
        return;
      }

      // Firebase user signed in — switch cleanly into cloud workspace
      clearActiveTempSession();
      setIsTempSession(false);
      setWorkspaceError(null);

      try {
        setDataLoading(true);
        const isBootstrapSuperAdmin =
          user.email?.toLowerCase() === 'itsdemoid00@gmail.com' && user.emailVerified;

        let profile = await fetchUserByUid(user.uid);

        if (!profile) {
          const initialRole: UserRole = isBootstrapSuperAdmin ? 'SUPER_ADMIN' : 'TEAM_MEMBER';
          const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
            uid: user.uid,
            employeeId: isBootstrapSuperAdmin
              ? 'DSR-SA-001'
              : `DSR-TM-${String(Math.floor(100 + Math.random() * 899))}`,
            displayName: user.displayName || user.email?.split('@')[0] || 'DSR User',
            email: user.email || '',
            phone: '',
            department: isBootstrapSuperAdmin ? 'Executive Governance' : 'Cybersecurity & VAPT',
            designation: isBootstrapSuperAdmin ? 'Chief Information Security Officer' : 'Security Engineer',
            role: initialRole,
            permissions: [],
            managerUid: user.uid,
            joiningDate: new Date().toISOString().slice(0, 10),
            status: 'ACTIVE',
            mustChangePassword: !isBootstrapSuperAdmin,
            lastLoginAt: new Date().toISOString(),
          };
          await upsertUserProfile(user.uid, newProfile, true);
          profile = { ...newProfile };
        } else {
          await updateOwnUserSafeFields(user.uid, {
            lastLoginAt: new Date().toISOString(),
          });
        }

        if (isBootstrapSuperAdmin && import.meta.env.DEV) {
          await seedEnterpriseDemoData(
            user.uid,
            user.email || 'itsdemoid00@gmail.com',
            user.displayName || 'DSR Executive Command'
          );
        }

        if (!activeSessionIdRef.current) {
          const sid = await recordLoginSession({
            userUid: user.uid,
            userEmail: user.email || '',
            userRole: profile.role,
          });
          activeSessionIdRef.current = sid;
        }

        setUserProfile(profile);
        setAuthReady(true);
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? `${err.message} You can also launch the portal using your Temp ID & Password.`
            : 'Failed to initialize cloud session. Try Temp ID & Password.'
        );
        setAuthReady(true);
        setDataLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // 2. Role-Scoped Real-Time Listeners (works identically for Temp ID mode & Cloud SSO)
  useEffect(() => {
    if (!authReady || !userProfile) return;
    if (!fbUser && !isTempSession) return;

    const isSuper = userProfile.role === 'SUPER_ADMIN';
    const isAdmin = userProfile.role === 'ADMIN';
    const uid = fbUser?.uid || userProfile.uid;

    setDataLoading(true);
    setWorkspaceError(null);

    const handleSubError = (err: Error) => {
      setWorkspaceError(err.message);
      setDataLoading(false);
    };

    const unsubs = [
      subscribeCollection<Department>(
        'departments',
        isSuper ? [] : [where('isActive', '==', true)],
        setDepartments,
        handleSubError
      ),
      subscribeCollection<Project>(
        'projects',
        isSuper
          ? []
          : isAdmin
          ? [where('assignedAdminUid', '==', uid)]
          : [where('assignedMemberUids', 'array-contains', uid)],
        (data) => {
          setProjects(data);
          setDataLoading(false);
        },
        handleSubError
      ),
      subscribeCollection<Milestone>(
        'milestones',
        isSuper
          ? []
          : isAdmin
          ? [where('assignedAdminUid', '==', uid)]
          : [where('projectMemberUids', 'array-contains', uid)],
        setMilestones,
        handleSubError
      ),
      subscribeCollection<Task>(
        'tasks',
        isSuper
          ? []
          : isAdmin
          ? [where('assignedAdminUid', '==', uid)]
          : [where('assigneeUid', '==', uid)],
        setTasks,
        handleSubError
      ),
      subscribeCollection<ProjectDocument>(
        'project_documents',
        isSuper
          ? []
          : isAdmin
          ? [where('assignedAdminUid', '==', uid)]
          : [where('projectMemberUids', 'array-contains', uid)],
        setDocuments,
        handleSubError
      ),
      subscribeCollection<NotificationItem>(
        'notifications',
        isSuper ? [] : [where('recipientUid', '==', uid)],
        setNotifications,
        handleSubError
      ),
      subscribeCollection<DeadlineExtensionRequest>(
        'deadline_extension_requests',
        isSuper
          ? []
          : isAdmin
          ? [where('assignedAdminUid', '==', uid)]
          : [where('requesterUid', '==', uid)],
        setExtensionRequests,
        handleSubError
      ),
      subscribeCollection<Announcement>(
        'announcements',
        isSuper ? [] : [where('isActive', '==', true)],
        setAnnouncements,
        handleSubError
      ),
      subscribeCollection<SystemSetting>(
        'system_settings',
        isSuper ? [] : [where('scope', '==', 'public')],
        setSettingsList,
        handleSubError
      ),
    ];

    if (isSuper) {
      unsubs.push(
        subscribeCollection<UserProfile>('users', [], setEmployees, handleSubError),
        subscribeCollection<Client>('clients', [], setClients, handleSubError),
        subscribeCollection<ProjectExpense>('project_expenses', [], setExpenses, handleSubError),
        subscribeCollection<ProjectInvoice>('project_invoices', [], setInvoices, handleSubError),
        subscribeCollection<Payment>('payments', [], setPayments, handleSubError),
        subscribeCollection<AuditLog>('audit_logs', [], setAuditLogs, handleSubError),
        subscribeCollection<LoginSession>('login_sessions', [], setLoginSessions, handleSubError)
      );
    } else if (isAdmin) {
      unsubs.push(
        subscribeCollection<UserProfile>('users', [where('managerUid', '==', uid)], setEmployees, handleSubError),
        subscribeCollection<Client>('clients', [where('assignedAdminUid', '==', uid)], setClients, handleSubError),
        subscribeCollection<ProjectExpense>('project_expenses', [where('assignedAdminUid', '==', uid)], setExpenses, handleSubError),
        subscribeCollection<ProjectInvoice>('project_invoices', [where('assignedAdminUid', '==', uid)], setInvoices, handleSubError),
        subscribeCollection<Payment>('payments', [where('assignedAdminUid', '==', uid)], setPayments, handleSubError)
      );
    } else {
      setEmployees([userProfile]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, fbUser, isTempSession, userProfile?.uid, userProfile?.role]);

  const handleTempLogin = async (accessId: string, password: string) => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const result = authenticateTempCredentials(accessId, password);
      if (result.ok === false) {
        setAuthError(result.error);
        return;
      }
      setIsTempSession(true);
      setUserProfile(result.user);
      setActivePage('dashboard');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In was cancelled or blocked.';
      setAuthError(
        `${msg} — Tip: Use the Temporary Access ID & Password form above for instant access.`
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    clearActiveTempSession();
    setIsTempSession(false);
    if (activeSessionIdRef.current && fbUser) {
      try {
        await updateLoginSessionStatus(activeSessionIdRef.current, 'SIGNED_OUT');
      } catch {
        // Ignore session close error during sign out
      }
      activeSessionIdRef.current = null;
    }
    if (fbUser) {
      await signOut(auth);
    }
    setUserProfile(null);
    setActivePage('dashboard');
  };

  const effectiveRole: UserRole = userProfile?.role || 'TEAM_MEMBER';
  const effectiveUser = userProfile;

  const unreadCount = useMemo(() => {
    if (!effectiveUser) return 0;
    return notifications.filter(
      (n) => !n.isRead && (n.recipientUid === effectiveUser.uid || effectiveRole === 'SUPER_ADMIN')
    ).length;
  }, [notifications, effectiveUser, effectiveRole]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#06080C] flex items-center justify-center p-6">
        <div className="glass-surface rounded-xl px-6 py-5 flex items-center gap-3 text-xs text-gray-300">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          Initializing DSR SecureTech Command Center...
        </div>
      </div>
    );
  }

  if ((!fbUser && !isTempSession) || !userProfile || !effectiveUser) {
    return (
      <AuthGate
        onTempLogin={handleTempLogin}
        onGoogleSignIn={handleGoogleSignIn}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  if (userProfile.status === 'INACTIVE') {
    return (
      <div className="min-h-screen bg-[#090B0E] text-gray-100 flex items-center justify-center p-6">
        <div className="glass-surface max-w-md w-full rounded-xl p-6 space-y-4 text-center">
          <h2 className="text-lg font-bold text-red-400">Account Deactivated</h2>
          <p className="text-xs text-gray-300">
            Your DSR SecureTech workspace access has been deactivated by Executive Security Governance.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const orgSettings = settingsList[0] || null;
  const admins = employees.filter((e) => e.role === 'ADMIN' || e.role === 'SUPER_ADMIN');

  return (
    <>
      {userProfile.mustChangePassword && effectiveRole !== 'SUPER_ADMIN' && (
        <FirstLoginPolicyModal
          profile={userProfile}
          isTempSession={isTempSession}
          onAcknowledge={async (displayName, phone, newPassword) => {
            if (isTempSession) {
              const updated = updateLocalUserTempPassword(
                userProfile.uid,
                newPassword || userProfile.tempPassword || 'Dsr@2026#Temp',
                displayName,
                phone
              );
              if (updated) {
                setUserProfile(updated);
              }
            } else {
              await updateOwnUserSafeFields(userProfile.uid, {
                displayName,
                phone,
                mustChangePassword: false,
              });
              setUserProfile({ ...userProfile, displayName, phone, mustChangePassword: false });
            }
          }}
        />
      )}

      <AppShell
        activePage={activePage}
        onNavigate={setActivePage}
        effectiveRole={effectiveRole}
        effectiveUser={effectiveUser}
        unreadCount={unreadCount}
        onSignOut={handleSignOut}
      >
        {workspaceError && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <span>{workspaceError}</span>
            <button
              type="button"
              onClick={() => setWorkspaceError(null)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {dataLoading ? (
          <div className="space-y-4">
            <div className="h-10 w-64 rounded-lg bg-white/5" />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/6" />
              ))}
            </div>
            <div className="h-80 rounded-xl bg-white/5 border border-white/6" />
          </div>
        ) : (
          <>
            {activePage === 'dashboard' && (
              <DashboardOverview
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                clients={clients}
                tasks={tasks}
                employees={employees}
                expenses={expenses}
                invoices={invoices}
                announcements={announcements}
                onNavigate={setActivePage}
              />
            )}

            {activePage === 'projects' && (
              <ProjectsPage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                clients={clients}
                employees={employees}
                tasks={tasks}
                milestones={milestones}
                documents={documents}
              />
            )}

            {activePage === 'clients' && (
              <ClientsPage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                clients={clients}
                projects={projects}
                admins={admins}
              />
            )}

            {activePage === 'tasks' && (
              <TasksPage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                tasks={tasks}
                employees={employees}
              />
            )}

            {activePage === 'timeline' && (
              <TimelinePage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                tasks={tasks}
                milestones={milestones}
              />
            )}

            {activePage === 'finance' && (
              <FinancePage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                expenses={expenses}
                invoices={invoices}
                payments={payments}
              />
            )}

            {activePage === 'reports' && (
              <ReportsPage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                projects={projects}
                clients={clients}
                tasks={tasks}
                employees={employees}
                expenses={expenses}
                invoices={invoices}
                auditLogs={auditLogs}
              />
            )}

            {activePage === 'workforce' && (
              <WorkforcePage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                employees={employees}
                departments={departments}
                tasks={tasks}
                loginSessions={loginSessions}
              />
            )}

            {activePage === 'notifications' && (
              <NotificationsPage
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                notifications={notifications}
                extensionRequests={extensionRequests}
                announcements={announcements}
                projects={projects}
                tasks={tasks}
              />
            )}

            {activePage === 'audit' && effectiveRole === 'SUPER_ADMIN' && (
              <AuditAndSettingsPage
                mode="audit"
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                auditLogs={auditLogs}
                settings={orgSettings}
                projects={projects}
                tasks={tasks}
              />
            )}

            {activePage === 'profile' && (
              <AuditAndSettingsPage
                mode="profile"
                effectiveRole={effectiveRole}
                effectiveUser={effectiveUser}
                auditLogs={auditLogs}
                settings={orgSettings}
                projects={projects}
                tasks={tasks}
              />
            )}
          </>
        )}
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainPortal />
    </ErrorBoundary>
  );
}
