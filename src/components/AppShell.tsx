import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AppPage, UserProfile, UserRole } from '../types/domain';

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '3D Command Center', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MEMBER'] },
  { id: 'projects', label: 'Projects', icon: Briefcase, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MEMBER'] },
  { id: 'clients', label: 'Clients', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { id: 'tasks', label: 'Tasks & Deliverables', icon: CheckSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MEMBER'] },
  { id: 'timeline', label: 'Timeline & Kanban', icon: CalendarClock, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MEMBER'] },
  { id: 'finance', label: 'Finance & P&L', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { id: 'reports', label: 'Reports & Exports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { id: 'workforce', label: 'Workforce & Access', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { id: 'notifications', label: 'Notifications & Alerts', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_MEMBER'] },
  { id: 'audit', label: 'Audit Logs & Settings', icon: Activity, roles: ['SUPER_ADMIN'] },
  { id: 'profile', label: 'My Performance & Profile', icon: UserCheck, roles: ['ADMIN', 'TEAM_MEMBER'] },
];

interface AppShellProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  effectiveRole: UserRole;
  effectiveUser: UserProfile;
  unreadCount: number;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activePage,
  onNavigate,
  effectiveRole,
  effectiveUser,
  unreadCount,
  onSignOut,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole));
  const currentNav = NAV_ITEMS.find((n) => n.id === activePage);

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0C0F14] border-r border-white/8">
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/8">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/assets/aistudio/logo_061eb742.png"
            alt="DSR SecureTech"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-contain bg-white/95 p-0.5 shrink-0 border border-emerald-500/30"
          />
          {!collapsed && (
            <span className="font-display font-bold text-sm tracking-tight text-white truncate">
              DSR Command
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-gray-400'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && item.id === 'notifications' && unreadCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] font-semibold text-amber-300">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/8 space-y-2.5">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/6">
            <p className="text-xs font-semibold text-gray-100 truncate">
              {effectiveUser.displayName}
            </p>
            <p className="text-[11px] font-mono text-emerald-400/90 truncate">
              {effectiveUser.employeeId}
            </p>
            <p className="text-[11px] text-gray-400 truncate">
              {effectiveUser.designation || effectiveUser.department || 'Operations'}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 border border-white/8 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090B0E] text-gray-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[260px] h-full">{SidebarContent}</div>
          <div className="flex-1 bg-black/70" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-[#0B0E13]/95 border-b border-white/8 px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
              <span className="text-gray-400 hidden sm:inline whitespace-nowrap">
                DSR SecureTech
              </span>
              <span className="text-gray-600 hidden sm:inline">/</span>
              <span className="font-semibold text-white truncate">
                {currentNav?.label || '3D Command Center'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline font-mono text-[11px] text-gray-400 border border-white/10 bg-white/[0.03] px-2.5 py-1 rounded-md">
              ID: {effectiveUser.employeeId}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/10 border border-white/10 text-gray-200 transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] font-bold text-amber-300">
                  ({unreadCount})
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
