import type { SubjectBaselineInput } from '../../engine';
import type {
  AttendanceRecord,
  CalendarEvent,
  DataPersistenceMode,
  Semester,
  Subject,
  TimetableEntry,
  UserProfile,
} from '../../types/domain';
import type { OnboardingSubmission } from '../../context/WorkspaceContext';
import type { WorkspaceSnapshot } from '../storage/localWorkspaceStore';

export type RepoResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DataRepository {
  readonly mode: DataPersistenceMode;

  getCurrentUser(): Promise<UserProfile | null>;
  signIn(email: string, password: string): Promise<RepoResult<UserProfile>>;
  signUp(name: string, email: string, password: string): Promise<RepoResult<UserProfile>>;
  signOut(): Promise<void>;

  loadWorkspace(): Promise<WorkspaceSnapshot>;

  selectSemester(semesterId: string): Promise<void>;
  createSemesterFromOnboarding(
    payload: OnboardingSubmission,
  ): Promise<RepoResult<Semester>>;
  updateSemester(
    semesterId: string,
    patch: Partial<
      Pick<
        Semester,
        | 'name'
        | 'institutionName'
        | 'startDate'
        | 'endDate'
        | 'trackingStartDate'
        | 'minimumAttendance'
      >
    >,
  ): Promise<RepoResult<Semester>>;
  deleteSemester(semesterId: string): Promise<void>;

  addSubject(
    semesterId: string,
    input: Omit<Subject, 'id' | 'semesterId' | 'createdAt'>,
  ): Promise<RepoResult<Subject>>;
  updateSubject(
    subjectId: string,
    patch: Partial<Omit<Subject, 'id' | 'semesterId' | 'createdAt'>>,
  ): Promise<RepoResult<Subject>>;
  deleteSubject(subjectId: string): Promise<void>;
  updateHistoricalBaselines(
    semesterId: string,
    inputs: SubjectBaselineInput[],
  ): Promise<void>;

  addTimetableEntry(
    semesterId: string,
    input: Omit<TimetableEntry, 'id' | 'semesterId'>,
  ): Promise<RepoResult<TimetableEntry>>;
  addTimetableEntriesBulk(
    semesterId: string,
    entries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry[]>>;
  updateTimetableEntry(
    entryId: string,
    patch: Partial<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry>>;
  deleteTimetableEntry(entryId: string): Promise<void>;

  addAttendanceRecord(
    semesterId: string,
    input: Omit<AttendanceRecord, 'id' | 'semesterId'>,
  ): Promise<RepoResult<AttendanceRecord>>;
  updateAttendanceRecord(
    recordId: string,
    patch: Partial<Omit<AttendanceRecord, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<AttendanceRecord>>;
  deleteAttendanceRecord(recordId: string): Promise<void>;

  addCalendarEvent(
    semesterId: string,
    input: Omit<CalendarEvent, 'id' | 'semesterId'>,
  ): Promise<RepoResult<CalendarEvent>>;
  addCalendarEventsBulk(
    semesterId: string,
    events: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent[]>>;
  updateCalendarEvent(
    eventId: string,
    patch: Partial<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent>>;
  deleteCalendarEvent(eventId: string): Promise<void>;

  loadDemoDataset(): Promise<WorkspaceSnapshot>;
  clearAllData(): Promise<WorkspaceSnapshot>;
}
