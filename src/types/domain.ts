export type SemesterMode = 'fresh' | 'ongoing';

export type SessionType = 'lecture' | 'lab' | 'tutorial';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'cancelled'
  | 'holiday'
  | 'mass_bunk';

export type CalendarEventType =
  | 'teaching_day'
  | 'official_holiday'
  | 'semester_break'
  | 'examination'
  | 'college_event'
  | 'non_teaching_day'
  | 'cancelled_class';

export const SUBJECT_COLOR_PALETTE = [
  '#6366F1',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
] as const;

export type DataPersistenceMode = 'local' | 'supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  mode: DataPersistenceMode;
}

export interface Semester {
  id: string;
  userId: string;
  name: string;
  institutionName?: string;
  mode: SemesterMode;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  trackingStartDate: string; // YYYY-MM-DD
  minimumAttendance: number; // Decimal 0..1 (e.g., 0.75)
  isActive: boolean;
  isDemo?: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  color: string;
  historicalConducted: number;
  historicalAttended: number;
  createdAt: string;
}

export interface TimetableEntry {
  id: string;
  semesterId: string;
  subjectId: string;
  weekday: number; // 0 (Sun) - 6 (Sat)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  teachingDurationMinutes: number;
  attendanceUnits: number;
  sessionType: SessionType;
}

export interface AttendanceRecord {
  id: string;
  semesterId: string;
  subjectId: string;
  timetableEntryId?: string | null;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  attendanceUnits: number;
  source: 'tracked' | 'historical_log';
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  semesterId: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  eventType: CalendarEventType;
  title: string;
  description?: string;
  affectsClasses: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  createdAt: string;
  read: boolean;
  targetRoute?: NavRouteId;
}

export type NavRouteId =
  | 'overview'
  | 'my-attendance'
  | 'bunk-simulator'
  | 'mass-bunk-planner'
  | 'academic-calendar'
  | 'timetable'
  | 'analytics'
  | 'settings';
