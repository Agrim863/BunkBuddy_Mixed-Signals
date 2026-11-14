import { ShellProvider, useShell } from './context/ShellContext';
import { SimulationProvider } from './context/SimulationContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { OnboardingWizardModal } from './components/onboarding/OnboardingWizardModal';
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

export function App() {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <SimulationProvider>
          <ShellProvider>
            <AppShell>
              <ActiveRouteView />
            </AppShell>
            <OnboardingWizardModal />
          </ShellProvider>
        </SimulationProvider>
      </WorkspaceProvider>
    </ToastProvider>
  );
}

export default App;
