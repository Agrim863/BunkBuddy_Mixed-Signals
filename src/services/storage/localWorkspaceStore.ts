import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  Subject,
  TimetableEntry,
} from '../../types/domain';

export interface WorkspaceSnapshot {
  version: 1;
  activeSemesterId: string | null;
  semesters: Semester[];
  subjects: Subject[];
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
}

const STORAGE_KEY = 'bunkwise.workspace.v1';

export function createEmptyWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    version: 1,
    activeSemesterId: null,
    semesters: [],
    subjects: [],
    timetableEntries: [],
    calendarEvents: [],
    attendanceRecords: [],
  };
}

export function loadWorkspaceSnapshot(): WorkspaceSnapshot {
  if (typeof window === 'undefined') {
    return createEmptyWorkspaceSnapshot();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyWorkspaceSnapshot();
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.semesters)) {
      return createEmptyWorkspaceSnapshot();
    }
    return {
      version: 1,
      activeSemesterId:
        typeof parsed.activeSemesterId === 'string' ? parsed.activeSemesterId : null,
      semesters: parsed.semesters,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      timetableEntries: Array.isArray(parsed.timetableEntries)
        ? parsed.timetableEntries
        : [],
      calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [],
      attendanceRecords: Array.isArray(parsed.attendanceRecords)
        ? parsed.attendanceRecords
        : [],
    };
  } catch {
    return createEmptyWorkspaceSnapshot();
  }
}

export function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearWorkspaceSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
