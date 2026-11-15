import { ShellProvider, useShell } from './context/ShellContext';
import { SimulationProvider } from './context/SimulationContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { OnboardingWizardModal } from './components/onboarding/OnboardingWizardModal';
import { LandingPage } from './components/auth/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { MyAttendancePage } from './pages/MyAttendancePage';
import { BunkSimulatorPage } from './pages/BunkSimulatorPage';
import { MassBunkPlannerPage } from './pages/MassBunkPlannerPage';
import { AcademicCalendarPage } from './pages/AcademicCalendarPage';
import { TimetablePage } from './pages/TimetablePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

function ActiveRouteView() {
  const { activeRoute } = useShell();

  const renderPage = () => {
    switch (activeRoute) {
      case 'overview':
        return <OverviewPage />;
      case 'my-attendance':
        return <MyAttendancePage />;
      case 'bunk-simulator':
        return <BunkSimulatorPage />;
      case 'mass-bunk-planner':
        return <MassBunkPlannerPage />;
      case 'academic-calendar':
        return <AcademicCalendarPage />;
      case 'timetable':
        return <TimetablePage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
    }
  };

  return (
    <div key={activeRoute} className="bw-animate-view-in">
      {renderPage()}
    </div>
  );
}

function AppEntry() {
  const { loading, currentUser, persistenceMode } = useWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0e10] text-[#f7f7f5]">
        <div className="flex items-center gap-3 text-sm text-white/65">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#a9bba5]" />
          Preparing your BunkBuddy workspace…
        </div>
      </div>
    );
  }

  // Authentication is mandatory. LocalRepository supplies a synthetic
  // "Local Student" profile for offline development, not a real login.
  // Never let that synthetic profile unlock the application.
  if (persistenceMode !== 'supabase' || !currentUser) {
    return <LandingPage />;
  }

  return (
    <>
      <AppShell>
        <ActiveRouteView />
      </AppShell>
      <OnboardingWizardModal />
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <SimulationProvider>
          <ShellProvider>
            <AppEntry />
          </ShellProvider>
        </SimulationProvider>
      </WorkspaceProvider>
    </ToastProvider>
  );
}

export default App;
