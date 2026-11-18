import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { UserProfile } from '../types/domain';
import { LoginScene3D } from './LoginScene3D';

interface AuthGateProps {
  onTempLogin: (accessId: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  signingIn: boolean;
  authError: string | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  onTempLogin,
  onGoogleSignIn,
  signingIn,
  authError,
}) => {
  const [accessId, setAccessId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formFocused, setFormFocused] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);

  const handleTempSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    await onTempLogin(accessId, password);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoverySubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#06080C] text-gray-100 flex flex-col justify-between p-5 sm:p-8 lg:p-10 relative overflow-hidden">
      {/* Live Full-Viewport Interactive 3D Security Core Backdrop */}
      <LoginScene3D focused={formFocused} />

      {/* Readability Vignette Gradient (solid alpha fade, zero backdrop-blur over WebGL) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(6,8,12,0.42) 0%, rgba(6,8,12,0.58) 45%, rgba(6,8,12,0.88) 100%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/logo_061eb742.png"
            alt="DSR SecureTech Emblem"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-contain bg-white/95 p-0.5 border border-emerald-500/40"
          />
          <div>
            <span className="font-display font-bold text-lg tracking-tight text-white block leading-none">
              DSR SecureTech
            </span>
            <span className="font-mono text-[10px] tracking-widest uppercase text-emerald-400">
              Enterprise Operations Grid
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setRecoverySubmitted(false);
            setRecoveryOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-emerald-300 border border-white/10 transition-colors whitespace-nowrap"
          style={{ backgroundColor: 'rgba(11, 15, 22, 0.88)' }}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Credential Recovery
        </button>
      </header>

      <main className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-8">
        {/* Left Spatial Command Narrative */}
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">
            Zero-Trust Project & Workforce Telemetry
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08] [text-wrap:balance]">
            DSR Project Command Center
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-lg leading-relaxed">
            Real-time 3D operational topology, portfolio milestones, financial cashflow ledger, and encrypted compliance workflows built for DSR SecureTech engineering operations.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
            <div
              className="rounded-xl p-3.5 border border-white/10"
              style={{ backgroundColor: 'rgba(10, 14, 21, 0.86)' }}
            >
              <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums">3D Core</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Live Topology</p>
            </div>
            <div
              className="rounded-xl p-3.5 border border-white/10"
              style={{ backgroundColor: 'rgba(10, 14, 21, 0.86)' }}
            >
              <p className="font-mono text-lg font-bold text-amber-300 tabular-nums">P&amp;L Sync</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Invoice Ledger</p>
            </div>
            <div
              className="rounded-xl p-3.5 border border-white/10"
              style={{ backgroundColor: 'rgba(10, 14, 21, 0.86)' }}
            >
              <p className="font-mono text-lg font-bold text-white tabular-nums">Audit Lock</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Trace Logs</p>
            </div>
          </div>
        </div>

        {/* Right Temp ID & Password Portal Card (Solid semi-opaque card, zero blur over canvas) */}
        <div className="lg:col-span-6 lg:pl-6">
          <div
            onFocus={() => setFormFocused(true)}
            onBlur={() => setFormFocused(false)}
            className="rounded-2xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl space-y-5"
            style={{ backgroundColor: 'rgba(11, 15, 22, 0.94)' }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Enterprise Command Access</h2>
                  <p className="text-xs text-gray-400">
                    Sign in with Temporary ID &amp; Password
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded">
                AES-256
              </span>
            </div>

            {authError && (
              <div className="rounded-lg border border-red-500/45 bg-red-500/12 px-4 py-3 text-xs text-red-200 leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleTempSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="dsr-temp-id"
                  className="block text-xs font-medium text-gray-300 mb-1.5"
                >
                  Temporary Access ID or Corporate Email
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="dsr-temp-id"
                    type="text"
                    required
                    autoComplete="username"
                    value={accessId}
                    onChange={(e) => setAccessId(e.target.value)}
                    placeholder="Enter Access ID or corporate email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070A0F] border border-white/15 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="dsr-temp-pass"
                    className="block text-xs font-medium text-gray-300"
                  >
                    Password
                  </label>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="dsr-temp-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#070A0F] border border-white/15 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-gray-950 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {signingIn ? 'Verifying Access Token...' : 'Launch Command Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Secondary Google Cloud SSO option */}
            <div className="pt-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] font-mono text-gray-500 uppercase">Or Cloud SSO</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/10 border border-white/12 text-gray-200 transition-colors cursor-pointer"
              >
                Continue with Google Workspace SSO
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 border-t border-white/10 pt-4">
        <span>© {new Date().getFullYear()} DSR SecureTech. All rights reserved.</span>
        <span className="font-mono text-[11px]">DSR Project Command Center · v3.0 3D</span>
      </footer>

      {recoveryOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-xl p-6 space-y-4 border border-white/15"
            style={{ backgroundColor: '#0D1118' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">Credential Recovery</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {recoverySubmitted ? (
              <div className="space-y-3 text-xs text-gray-300">
                <p className="text-emerald-400 font-medium">
                  Recovery notice logged for {recoveryEmail}.
                </p>
                <p className="leading-relaxed text-gray-400">
                  Contact your DSR SecureTech Security Operations desk or an authorized organization administrator to receive your externally issued temporary Access ID and passcode.
                </p>
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(false)}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-gray-950 font-semibold"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Enter your corporate DSR SecureTech email or Access ID to request a temporary password reissue.
                </p>
                <input
                  type="text"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="name@dsrsecuretech.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/15 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-gray-950"
                  >
                    Request Reissue
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const FirstLoginPolicyModal: React.FC<{
  profile: UserProfile;
  isTempSession?: boolean;
  onAcknowledge: (displayName: string, phone: string, newPassword?: string) => Promise<void>;
}> = ({ profile, isTempSession = false, onAcknowledge }) => {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || !displayName.trim()) return;
    if (isTempSession && newPassword.trim().length > 0 && newPassword.trim().length < 8) return;
    setSaving(true);
    try {
      await onAcknowledge(
        displayName.trim(),
        phone.trim(),
        newPassword.trim() ? newPassword.trim() : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-xl p-6 space-y-4 border border-amber-500/35"
        style={{ backgroundColor: '#0D1118' }}
      >
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-white">
              First-Login Security Verification
            </h3>
            <p className="text-xs text-gray-400">
              ID: <span className="font-mono text-emerald-400">{profile.employeeId}</span> ·{' '}
              {profile.designation || 'Enterprise Operator'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          Confirm your display identity{isTempSession ? ', optionally rotate your temporary passcode,' : ''} and accept security governance compliance to activate full access.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Full Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Corporate Contact Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1-415-000-0000"
              className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          {isTempSession && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                New Personal Password (optional, min 8 chars)
              </label>
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current temporary pass"
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
          <label className="flex items-start gap-2.5 text-xs text-gray-300 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span>
              I acknowledge DSR SecureTech confidentiality, audit logging, and data security compliance policies.
            </span>
          </label>
          <button
            type="submit"
            disabled={!confirmed || saving}
            className="w-full py-2.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-gray-950 transition-colors"
          >
            {saving ? 'Activating Account...' : 'Complete Security Verification'}
          </button>
        </form>
      </div>
    </div>
  );
};
