import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SubjectBaselineInput } from '../engine';
import { createDataRepository, type RepoResult } from '../services/data';
import { getSupabaseClient } from '../services/data/supabaseClient';
import {
  createEmptyWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../services/storage/localWorkspaceStore';
import type {
  AttendanceRecord,
  CalendarEvent,
  DataPersistenceMode,
  Semester,
  Subject,
  TimetableEntry,
  UserProfile,
} from '../types/domain';

export interface OnboardingSubmission {
  semester: Omit<Semester, 'id' | 'userId' | 'isActive' | 'createdAt'>;
  subjects: Array<Omit<Subject, 'id' | 'semesterId' | 'createdAt'> & { tempId: string }>;
  timetableEntries: Array<
    Omit<TimetableEntry, 'id' | 'semesterId' | 'subjectId'> & { subjectTempId: string }
  >;
  calendarEvents: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>;
  historicalLogs: Array<
    Omit<AttendanceRecord, 'id' | 'semesterId' | 'subjectId'> & { subjectTempId: string }
  >;
}

interface WorkspaceContextValue {
  loading: boolean;
  persistenceMode: DataPersistenceMode;
  currentUser: UserProfile | null;
  semesters: Semester[];
  activeSemester: Semester | null;
  subjects: Subject[];
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
  onboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  refreshWorkspace: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<RepoResult<UserProfile>>;
  signUp: (name: string, email: string, password: string) => Promise<RepoResult<UserProfile>>;
  signOut: () => Promise<void>;
  selectSemester: (semesterId: string) => Promise<void>;
  completeOnboarding: (payload: OnboardingSubmission) => Promise<RepoResult<Semester>>;
  updateSemester: (
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
  ) => Promise<RepoResult<Semester>>;
  deleteSemester: (semesterId: string) => Promise<void>;
  addSubject: (
    input: Omit<Subject, 'id' | 'semesterId' | 'createdAt'>,
  ) => Promise<RepoResult<Subject>>;
  updateSubject: (
    subjectId: string,
    patch: Partial<Omit<Subject, 'id' | 'semesterId' | 'createdAt'>>,
  ) => Promise<RepoResult<Subject>>;
  deleteSubject: (subjectId: string) => Promise<void>;
  addTimetableEntry: (
    input: Omit<TimetableEntry, 'id' | 'semesterId'>,
  ) => Promise<RepoResult<TimetableEntry>>;
  addTimetableEntriesBulk: (
    entries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ) => Promise<RepoResult<TimetableEntry[]>>;
  updateTimetableEntry: (
    entryId: string,
    patch: Partial<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ) => Promise<RepoResult<TimetableEntry>>;
  deleteTimetableEntry: (entryId: string) => Promise<void>;
  addAttendanceRecord: (
    input: Omit<AttendanceRecord, 'id' | 'semesterId'>,
  ) => Promise<RepoResult<AttendanceRecord>>;
  updateAttendanceRecord: (
    recordId: string,
    patch: Partial<Omit<AttendanceRecord, 'id' | 'semesterId'>>,
  ) => Promise<RepoResult<AttendanceRecord>>;
  deleteAttendanceRecord: (recordId: string) => Promise<void>;
  addCalendarEvent: (
    input: Omit<CalendarEvent, 'id' | 'semesterId'>,
  ) => Promise<RepoResult<CalendarEvent>>;
  addCalendarEventsBulk: (
    events: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ) => Promise<RepoResult<CalendarEvent[]>>;
  updateCalendarEvent: (
    eventId: string,
    patch: Partial<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ) => Promise<RepoResult<CalendarEvent>>;
  deleteCalendarEvent: (eventId: string) => Promise<void>;
  updateHistoricalBaselines: (
    semesterId: string,
    inputs: SubjectBaselineInput[],
  ) => Promise<void>;
  loadDemoDataset: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createDataRepository(), []);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(
    createEmptyWorkspaceSnapshot,
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [user, data] = await Promise.all([
        repo.getCurrentUser(),
        repo.loadWorkspace(),
      ]);
      setCurrentUser(user);
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refreshWorkspace();
    const client = getSupabaseClient();
    if (!client) return;
    const { data: subscription } = client.auth.onAuthStateChange(() => {
      void refreshWorkspace();
    });
    return () => subscription.subscription.unsubscribe();
  }, [refreshWorkspace]);

  const activeSemester = useMemo(() => {
    if (snapshot.semesters.length === 0) return null;
    return (
      snapshot.semesters.find((s) => s.id === snapshot.activeSemesterId) ??
      snapshot.semesters.find((s) => s.isActive) ??
      snapshot.semesters[0] ??
      null
    );
  }, [snapshot.semesters, snapshot.activeSemesterId]);

  const activeSemesterId = activeSemester?.id ?? null;

  const subjects = useMemo(
    () =>
      activeSemesterId
        ? snapshot.subjects.filter((s) => s.semesterId === activeSemesterId)
        : [],
    [snapshot.subjects, activeSemesterId],
  );

  const timetableEntries = useMemo(
    () =>
      activeSemesterId
        ? snapshot.timetableEntries.filter((t) => t.semesterId === activeSemesterId)
        : [],
    [snapshot.timetableEntries, activeSemesterId],
  );

  const calendarEvents = useMemo(
    () =>
      activeSemesterId
        ? snapshot.calendarEvents.filter((c) => c.semesterId === activeSemesterId)
        : [],
    [snapshot.calendarEvents, activeSemesterId],
  );

  const attendanceRecords = useMemo(
    () =>
      activeSemesterId
        ? snapshot.attendanceRecords.filter((r) => r.semesterId === activeSemesterId)
        : [],
    [snapshot.attendanceRecords, activeSemesterId],
  );

  const openOnboarding = useCallback(() => setOnboardingOpen(true), []);
  const closeOnboarding = useCallback(() => setOnboardingOpen(false), []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await repo.signIn(email, password);
      if (res.ok) await refreshWorkspace();
      return res;
    },
    [repo, refreshWorkspace],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await repo.signUp(name, email, password);
      if (res.ok) await refreshWorkspace();
      return res;
    },
    [repo, refreshWorkspace],
  );

  const signOut = useCallback(async () => {
    await repo.signOut();
    await refreshWorkspace();
  }, [repo, refreshWorkspace]);

  const selectSemester = useCallback(
    async (semesterId: string) => {
      await repo.selectSemester(semesterId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const completeOnboarding = useCallback(
    async (payload: OnboardingSubmission): Promise<RepoResult<Semester>> => {
      const res = await repo.createSemesterFromOnboarding(payload);
      if (res.ok) {
        setSnapshot(await repo.loadWorkspace());
        setOnboardingOpen(false);
      }
      return res;
    },
    [repo],
  );

  const updateSemester = useCallback(
    async (
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
    ) => {
      const res = await repo.updateSemester(semesterId, patch);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo],
  );

  const deleteSemester = useCallback(
    async (semesterId: string) => {
      await repo.deleteSemester(semesterId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const addSubject = useCallback(
    async (input: Omit<Subject, 'id' | 'semesterId' | 'createdAt'>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addSubject(activeSemesterId, input);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const updateSubject = useCallback(
    async (
      subjectId: string,
      patch: Partial<Omit<Subject, 'id' | 'semesterId' | 'createdAt'>>,
    ) => {
      const res = await repo.updateSubject(subjectId, patch);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo],
  );

  const deleteSubject = useCallback(
    async (subjectId: string) => {
      await repo.deleteSubject(subjectId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const addTimetableEntry = useCallback(
    async (input: Omit<TimetableEntry, 'id' | 'semesterId'>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addTimetableEntry(activeSemesterId, input);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const addTimetableEntriesBulk = useCallback(
    async (entries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addTimetableEntriesBulk(activeSemesterId, entries);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const updateTimetableEntry = useCallback(
    async (
      entryId: string,
      patch: Partial<Omit<TimetableEntry, 'id' | 'semesterId'>>,
    ) => {
      const res = await repo.updateTimetableEntry(entryId, patch);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo],
  );

  const deleteTimetableEntry = useCallback(
    async (entryId: string) => {
      await repo.deleteTimetableEntry(entryId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const addAttendanceRecord = useCallback(
    async (input: Omit<AttendanceRecord, 'id' | 'semesterId'>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addAttendanceRecord(activeSemesterId, input);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const updateAttendanceRecord = useCallback(
    async (
      recordId: string,
      patch: Partial<Omit<AttendanceRecord, 'id' | 'semesterId'>>,
    ) => {
      const res = await repo.updateAttendanceRecord(recordId, patch);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo],
  );

  const deleteAttendanceRecord = useCallback(
    async (recordId: string) => {
      await repo.deleteAttendanceRecord(recordId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const addCalendarEvent = useCallback(
    async (input: Omit<CalendarEvent, 'id' | 'semesterId'>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addCalendarEvent(activeSemesterId, input);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const addCalendarEventsBulk = useCallback(
    async (events: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>) => {
      if (!activeSemesterId) {
        return { ok: false, error: 'Create or select a semester first' } as const;
      }
      const res = await repo.addCalendarEventsBulk(activeSemesterId, events);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo, activeSemesterId],
  );

  const updateCalendarEvent = useCallback(
    async (
      eventId: string,
      patch: Partial<Omit<CalendarEvent, 'id' | 'semesterId'>>,
    ) => {
      const res = await repo.updateCalendarEvent(eventId, patch);
      if (res.ok) setSnapshot(await repo.loadWorkspace());
      return res;
    },
    [repo],
  );

  const deleteCalendarEvent = useCallback(
    async (eventId: string) => {
      await repo.deleteCalendarEvent(eventId);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const updateHistoricalBaselines = useCallback(
    async (semesterId: string, inputs: SubjectBaselineInput[]) => {
      await repo.updateHistoricalBaselines(semesterId, inputs);
      setSnapshot(await repo.loadWorkspace());
    },
    [repo],
  );

  const loadDemoDataset = useCallback(async () => {
    setSnapshot(await repo.loadDemoDataset());
  }, [repo]);

  const clearAllData = useCallback(async () => {
    setSnapshot(await repo.clearAllData());
  }, [repo]);

  const value: WorkspaceContextValue = {
    loading,
    persistenceMode: repo.mode,
    currentUser,
    semesters: snapshot.semesters,
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    onboardingOpen,
    openOnboarding,
    closeOnboarding,
    refreshWorkspace,
    signIn,
    signUp,
    signOut,
    selectSemester,
    completeOnboarding,
    updateSemester,
    deleteSemester,
    addSubject,
    updateSubject,
    deleteSubject,
    addTimetableEntry,
    addTimetableEntriesBulk,
    updateTimetableEntry,
    deleteTimetableEntry,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
    addCalendarEvent,
    addCalendarEventsBulk,
    updateCalendarEvent,
    deleteCalendarEvent,
    updateHistoricalBaselines,
    loadDemoDataset,
    clearAllData,
  };

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside a WorkspaceProvider');
  }
  return ctx;
}
