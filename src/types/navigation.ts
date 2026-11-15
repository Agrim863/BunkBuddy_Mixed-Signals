import type { NavRouteId } from './domain';

export interface NavItemConfig {
  id: NavRouteId;
  label: string;
  shortLabel: string;
  description: string;
  group: 'core' | 'planning' | 'schedule' | 'system';
  keywords: string[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Attendance summary, warnings, upcoming classes, and quick actions',
    group: 'core',
    keywords: ['dashboard', 'home', 'summary', 'stats'],
  },
  {
    id: 'my-attendance',
    label: 'My Attendance',
    shortLabel: 'Attendance',
    description: 'Manage subjects, log attendance, and review subject history',
    group: 'core',
    keywords: ['subjects', 'present', 'absent', 'records', 'history'],
  },
  {
    id: 'bunk-simulator',
    label: 'Bunk Simulator',
    shortLabel: 'Simulator',
    description: 'Test what-if absences and compare scenarios without saving',
    group: 'planning',
    keywords: ['simulate', 'miss', 'recovery', 'margin', 'scenario'],
  },
  {
    id: 'mass-bunk-planner',
    label: 'Mass Bunk Tracker',
    shortLabel: 'Mass Tracker',
    description: 'Evaluate whole-day multi-subject bunk impact on a selected date',
    group: 'planning',
    keywords: ['mass bunk', 'group', 'date', 'impact'],
  },
  {
    id: 'academic-calendar',
    label: 'Academic Calendar',
    shortLabel: 'Calendar',
    description: 'Manage holidays, breaks, exams, events, and cancelled lectures',
    group: 'schedule',
    keywords: ['holidays', 'exams', 'breaks', 'events', 'pdf', 'csv'],
  },
  {
    id: 'timetable',
    label: 'Timetable',
    shortLabel: 'Timetable',
    description: 'Weekly class schedule with lecture duration and attendance units',
    group: 'schedule',
    keywords: ['schedule', 'slots', 'lab', 'tutorial', 'units', 'import'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    description: 'Historical trends, subject comparisons, and recovery projections',
    group: 'schedule',
    keywords: ['charts', 'graphs', 'trends', 'predictions'],
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Semester setup, persistence mode, and environment configuration',
    group: 'system',
    keywords: ['preferences', 'supabase', 'local', 'onboarding', 'threshold'],
  },
];

export const NAV_GROUP_LABELS: Record<NavItemConfig['group'], string> = {
  core: 'Workspace',
  planning: 'Planners',
  schedule: 'Schedule & Insights',
  system: 'System',
};
