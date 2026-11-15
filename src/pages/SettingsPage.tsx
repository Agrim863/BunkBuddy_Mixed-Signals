import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Database,
  HardDrive,
  Laptop,
  LogIn,
  LogOut,
  Moon,
  PanelLeft,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { envConfig } from '../config/env';
import { useShell } from '../context/ShellContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { semesterSetupSchema } from '../schemas/semester.schema';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  SegmentedTabs,
  StatusBanner,
  useToast,
} from '../components/ui';

export function SettingsPage() {
  const { showToast } = useToast();
  const { persistenceMode, sidebarCollapsed, toggleSidebar, theme, setTheme } = useShell();
  const {
    currentUser,
    semesters,
    activeSemester,
    selectSemester,
    updateSemester,
    deleteSemester,
    openOnboarding,
    loadDemoDataset,
    clearAllData,
    signIn,
    signUp,
    signOut,
  } = useWorkspace();

  const [name, setName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trackingStartDate, setTrackingStartDate] = useState('');
  const [minPercent, setMinPercent] = useState(75);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Supabase Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setSaveMessage(null);
    setErrors({});
    if (activeSemester) {
      setName(activeSemester.name);
      setInstitutionName(activeSemester.institutionName ?? '');
      setStartDate(activeSemester.startDate);
      setEndDate(activeSemester.endDate);
      setTrackingStartDate(activeSemester.trackingStartDate);
      setMinPercent(Math.round(activeSemester.minimumAttendance * 100));
    }
  }, [activeSemester]);

  const handleSaveSemester = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSemester) return;
    setErrors({});
    setSaveMessage(null);

    const parsed = semesterSetupSchema.safeParse({
      mode: activeSemester.mode,
      name,
      institutionName: institutionName || undefined,
      startDate,
      endDate,
      trackingStartDate,
      minimumAttendancePercent: minPercent,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') {
          nextErrors[path] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    try {
      await updateSemester(activeSemester.id, {
        name,
        institutionName: institutionName || undefined,
        startDate,
        endDate,
        trackingStartDate,
        minimumAttendance: minPercent / 100,
      });
      setSaveMessage('Semester settings saved successfully.');
      showToast({
        tone: 'success',
        title: 'Settings updated',
        description: `${name} configuration saved.`,
      });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to update semester' });
    }
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'signin') {
        await signIn(authEmail, authPassword);
        showToast({
          tone: 'success',
          title: 'Signed in',
          description: 'Connected to Supabase account.',
        });
      } else {
        await signUp(authEmail, authPassword, authName);
        showToast({
          tone: 'success',
          title: 'Account created',
          description: 'Check email confirmation or sign in.',
        });
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication operation failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings &amp; Environment"
        description="Semester configurations, visual theme, layout preferences, and backend database connectivity."
      />

      {/* Persistence Environment Banner */}
      <StatusBanner
        tone={persistenceMode === 'local' ? 'warning' : 'success'}
        title={
          persistenceMode === 'local'
            ? 'Supabase credentials are not configured — Local Mode is active'
            : 'Supabase backend & authentication enabled'
        }
        description={
          persistenceMode === 'local'
            ? 'BunkWise never pretends data is saved remotely. Semesters, subjects, attendance records, and calendar events persist locally in your browser localStorage.'
            : 'Connected to Supabase PostgreSQL with Row Level Security. Sign in below to sync your semesters.'
        }
      />

      {/* Supabase Auth Panel (shown when Supabase env vars are configured) */}
      {envConfig.hasSupabaseConfig && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Supabase Account</CardTitle>
              <CardDescription>
                Authenticate to read and write your protected PostgreSQL attendance records
              </CardDescription>
            </div>
            <Database className="h-4 w-4 text-[var(--status-success)]" />
          </CardHeader>
          <CardContent>
            {currentUser && currentUser.mode === 'supabase' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--status-success)]/40 bg-[var(--status-success)]/10 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[var(--status-success)]">{currentUser.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{currentUser.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<LogOut className="h-3.5 w-3.5" />}
                  onClick={() => void signOut()}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleAuthSubmit(e)}
                className="space-y-4 max-w-md"
              >
                {authError && (
                  <StatusBanner tone="danger" title="Authentication Error" description={authError} />
                )}
                <SegmentedTabs
                  ariaLabel="Authentication mode"
                  value={authMode}
                  onChange={setAuthMode}
                  options={[
                    { id: 'signin', label: 'Sign In' },
                    { id: 'signup', label: 'Create Account' },
                  ]}
                />
                {authMode === 'signup' && (
                  <Input
                    label="Full Name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                  />
                )}
                <Input
                  label="Email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  isLoading={authLoading}
                  leftIcon={<LogIn className="h-3.5 w-3.5" />}
                >
                  {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Semester Management */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Semester Configuration</CardTitle>
            <CardDescription>
              Switch semesters, edit minimum attendance requirement, or launch onboarding.
            </CardDescription>
          </div>
          <CalendarRange className="h-4 w-4 text-[var(--primary)]" />
        </CardHeader>
        <CardContent>
          {!activeSemester ? (
            <div className="flex flex-col items-start justify-between gap-3 rounded-[12px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  No semester configured yet
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Use the 5-step onboarding wizard or load the 5-subject demo dataset.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={openOnboarding}>
                  Launch Onboarding
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                  onClick={() => void loadDemoDataset()}
                >
                  Load Demo Data
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {semesters.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {semesters.map((sem) => (
                    <button
                      key={sem.id}
                      type="button"
                      onClick={() => void selectSemester(sem.id)}
                      className={`rounded-[10px] border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        sem.id === activeSemester.id
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {sem.name}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={(e) => void handleSaveSemester(e)} className="space-y-4">
                {saveMessage && (
                  <div className="flex items-center gap-2 rounded-[10px] border border-[var(--status-success)]/35 bg-[var(--status-success)]/10 px-3 py-2 text-xs font-medium text-[var(--status-success)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                    <span>{saveMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Semester Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                  />
                  <Input
                    label="Institution (Optional)"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    error={errors.institutionName}
                  />
                  <Input
                    label="Minimum Attendance (%)"
                    type="number"
                    min={1}
                    max={99}
                    value={minPercent}
                    onChange={(e) => setMinPercent(Number(e.target.value))}
                    error={errors.minimumAttendancePercent}
                  />
                  <Input
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    error={errors.startDate}
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    error={errors.endDate}
                  />
                  <Input
                    label="Tracking Start Date"
                    type="date"
                    value={trackingStartDate}
                    onChange={(e) => setTrackingStartDate(e.target.value)}
                    error={errors.trackingStartDate}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => void deleteSemester(activeSemester.id)}
                  >
                    Delete Semester
                  </Button>
                  <Button type="submit" size="sm">
                    Save Semester Changes
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Workspace Preferences (Theme & Layout) */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Workspace &amp; Appearance</CardTitle>
              <CardDescription>Customization stored locally in browser storage</CardDescription>
            </div>
            <PanelLeft className="h-4 w-4 text-[var(--primary)]" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Theme Selector */}
            <div className="flex flex-col gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Visual Theme</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Warm Oat Milk &amp; Royal Plum (Light Mode) or Dark Mode
                </p>
              </div>
              <SegmentedTabs
                ariaLabel="Select visual theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { id: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
                  { id: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
                  { id: 'system', label: 'System', icon: <Laptop className="h-3.5 w-3.5" /> },
                ]}
              />
            </div>

            {/* Sidebar toggle */}
            <div className="flex items-center justify-between rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Desktop Sidebar</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  State: {sidebarCollapsed ? 'Collapsed (rail)' : 'Expanded'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleSidebar}>
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Persistence & Data Controls */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Persistence Environment &amp; Demo Data</CardTitle>
              <CardDescription>
                Runtime check of backend configuration and dataset controls
              </CardDescription>
            </div>
            {persistenceMode === 'local' ? (
              <HardDrive className="h-4 w-4 text-[var(--status-warning)]" />
            ) : (
              <Database className="h-4 w-4 text-[var(--status-success)]" />
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-2.5">
              <span className="text-[var(--text-secondary)]">Active Mode</span>
              <span className="font-semibold text-[var(--text-main)]">
                {persistenceMode === 'local'
                  ? 'Local Browser Storage'
                  : 'Supabase PostgreSQL'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-2.5">
              <span className="font-mono text-xs text-[var(--text-secondary)]">VITE_SUPABASE_URL</span>
              <Badge variant={envConfig.supabaseUrl ? 'success' : 'neutral'}>
                {envConfig.supabaseUrl ? 'Configured' : 'Not Set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3.5 py-2.5">
              <span className="font-mono text-xs text-[var(--text-secondary)]">VITE_SUPABASE_ANON_KEY</span>
              <Badge variant={envConfig.supabaseAnonKey ? 'success' : 'neutral'}>
                {envConfig.supabaseAnonKey ? 'Configured' : 'Not Set'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await loadDemoDataset();
                  showToast({
                    tone: 'info',
                    title: 'Demo dataset loaded',
                    description: '5 sample subjects restored.',
                  });
                }}
              >
                Load / Reset Demo Data
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await clearAllData();
                  showToast({
                    tone: 'warning',
                    title: 'Workspace cleared',
                    description: 'All local semester data removed.',
                  });
                }}
              >
                Clear All Workspace Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
