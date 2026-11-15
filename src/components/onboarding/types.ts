import { localDateISO } from '../../utils/localDate';
import type {
  AttendanceStatus,
  CalendarEventType,
  SemesterMode,
  SessionType,
} from '../../types/domain';

export interface DraftSubject {
  tempId: string;
  name: string;
  code: string;
  color: string;
  historicalConducted: number;
  historicalAttended: number;
}

export interface DraftTimetableEntry {
  tempId: string;
  subjectTempId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  teachingDurationMinutes: number;
  attendanceUnits: number;
  sessionType: SessionType;
}

export interface DraftCalendarEvent {
  tempId: string;
  date: string;
  endDate?: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  affectsClasses: boolean;
}

export interface DraftHistoricalLog {
  tempId: string;
  subjectTempId: string;
  date: string;
  status: AttendanceStatus;
  attendanceUnits: number;
  notes?: string;
}

export interface OnboardingDraft {
  mode: SemesterMode;
  name: string;
  institutionName: string;
  startDate: string;
  endDate: string;
  trackingStartDate: string;
  minimumAttendancePercent: number;
  subjects: DraftSubject[];
  timetableEntries: DraftTimetableEntry[];
  calendarEvents: DraftCalendarEvent[];
  historicalLogs: DraftHistoricalLog[];
}

export function createInitialOnboardingDraft(): OnboardingDraft {
  const today = new Date();
  const year = today.getFullYear();
  const startStr = `${year}-08-01`;
  const endStr = `${year}-12-15`;
  const todayStr = localDateISO(today);

  return {
    mode: 'fresh',
    name: '',
    institutionName: '',
    startDate: startStr,
    endDate: endStr,
    trackingStartDate: todayStr >= startStr && todayStr <= endStr ? todayStr : startStr,
    minimumAttendancePercent: 75,
    subjects: [],
    timetableEntries: [],
    calendarEvents: [],
    historicalLogs: [],
  };
}
