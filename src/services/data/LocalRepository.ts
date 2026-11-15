import { buildDemoDataset } from '../../data/demoSemester';
import {
  hasDuplicateAttendanceRecord,
  normalizeHistoricalBaselines,
  type SubjectBaselineInput,
} from '../../engine';
import type { OnboardingSubmission } from '../../context/WorkspaceContext';
import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  Subject,
  TimetableEntry,
  UserProfile,
} from '../../types/domain';
import {
  clearWorkspaceSnapshot,
  createEmptyWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../storage/localWorkspaceStore';
import type { DataRepository, RepoResult } from './DataRepository';

const DEMO_SEEDED_FLAG = 'bunkwise.demoSeeded.v1';

function hasSeededDemoBefore(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEMO_SEEDED_FLAG) === 'true';
  } catch {
    return false;
  }
}

function markDemoSeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_SEEDED_FLAG, 'true');
  } catch {
    // Ignore storage write error
  }
}

export class LocalRepository implements DataRepository {
  readonly mode = 'local' as const;

  private read(): WorkspaceSnapshot {
    const current = loadWorkspaceSnapshot();
    if (current.semesters.length === 0 && !hasSeededDemoBefore()) {
      const demo = buildDemoDataset();
      const seeded: WorkspaceSnapshot = {
        version: 1,
        activeSemesterId: demo.semester.id,
        semesters: [demo.semester],
        subjects: demo.subjects,
        timetableEntries: demo.timetableEntries,
        calendarEvents: demo.calendarEvents,
        attendanceRecords: demo.attendanceRecords,
      };
      saveWorkspaceSnapshot(seeded);
      markDemoSeeded();
      return seeded;
    }
    return current;
  }

  private write(snapshot: WorkspaceSnapshot): void {
    markDemoSeeded();
    saveWorkspaceSnapshot(snapshot);
  }

  async getCurrentUser(): Promise<UserProfile> {
    return {
      id: 'local-user',
      name: 'Local Student',
      email: 'local-mode@browser.storage',
      mode: 'local',
    };
  }

  async signIn(): Promise<RepoResult<UserProfile>> {
    return {
      ok: false,
      error:
        'Supabase credentials are not configured. BunkWise is running in Local Mode.',
    };
  }

  async signUp(): Promise<RepoResult<UserProfile>> {
    return {
      ok: false,
      error:
        'Supabase credentials are not configured. BunkWise is running in Local Mode.',
    };
  }

  async signOut(): Promise<void> {
    // No remote session in Local Mode
  }

  async loadWorkspace(): Promise<WorkspaceSnapshot> {
    return this.read();
  }

  async selectSemester(semesterId: string): Promise<void> {
    const prev = this.read();
    this.write({
      ...prev,
      activeSemesterId: semesterId,
      semesters: prev.semesters.map((s) => ({
        ...s,
        isActive: s.id === semesterId,
      })),
    });
  }

  async createSemesterFromOnboarding(
    payload: OnboardingSubmission,
  ): Promise<RepoResult<Semester>> {
    const prev = this.read();
    const semesterId = `sem-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const newSemester: Semester = {
      ...payload.semester,
      id: semesterId,
      userId: 'local-user',
      isActive: true,
      isDemo: false,
      createdAt: now,
    };

    const tempToRealSubjectId = new Map<string, string>();
    const newSubjects: Subject[] = payload.subjects.map((sub) => {
      const realId = `sub-${crypto.randomUUID()}`;
      tempToRealSubjectId.set(sub.tempId, realId);
      return {
        id: realId,
        semesterId,
        name: sub.name,
        code: sub.code.toUpperCase(),
        color: sub.color,
        historicalConducted:
          payload.semester.mode === 'fresh' ? 0 : sub.historicalConducted,
        historicalAttended:
          payload.semester.mode === 'fresh' ? 0 : sub.historicalAttended,
        createdAt: now,
      };
    });

    const newTimetable: TimetableEntry[] = payload.timetableEntries
      .filter((entry) => tempToRealSubjectId.has(entry.subjectTempId))
      .map((entry) => ({
        id: `tt-${crypto.randomUUID()}`,
        semesterId,
        subjectId: tempToRealSubjectId.get(entry.subjectTempId)!,
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        teachingDurationMinutes: entry.teachingDurationMinutes,
        attendanceUnits: entry.attendanceUnits,
        sessionType: entry.sessionType,
      }));

    const newEvents: CalendarEvent[] = payload.calendarEvents.map((ev) => ({
      id: `cal-${crypto.randomUUID()}`,
      semesterId,
      date: ev.date,
      endDate: ev.endDate,
      eventType: ev.eventType,
      title: ev.title,
      description: ev.description,
      affectsClasses: ev.affectsClasses,
    }));

    const newLogs: AttendanceRecord[] =
      payload.semester.mode === 'ongoing'
        ? payload.historicalLogs
            .filter((log) => tempToRealSubjectId.has(log.subjectTempId))
            .map((log) => ({
              id: `rec-${crypto.randomUUID()}`,
              semesterId,
              subjectId: tempToRealSubjectId.get(log.subjectTempId)!,
              timetableEntryId: log.timetableEntryId ?? null,
              date: log.date,
              status: log.status,
              attendanceUnits: log.attendanceUnits,
              source: 'historical_log',
              notes: log.notes,
            }))
        : [];

    this.write({
      version: 1,
      activeSemesterId: semesterId,
      semesters: [
        ...prev.semesters.map((s) => ({ ...s, isActive: false })),
        newSemester,
      ],
      subjects: [...prev.subjects, ...newSubjects],
      timetableEntries: [...prev.timetableEntries, ...newTimetable],
      calendarEvents: [...prev.calendarEvents, ...newEvents],
      attendanceRecords: [...prev.attendanceRecords, ...newLogs],
    });

    return { ok: true, data: newSemester };
  }

  async updateSemester(
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
  ): Promise<RepoResult<Semester>> {
    const prev = this.read();
    let updated: Semester | null = null;
    const nextSemesters = prev.semesters.map((s) => {
      if (s.id !== semesterId) return s;
      updated = { ...s, ...patch };
      return updated;
    });
    if (!updated) return { ok: false, error: 'Semester not found' };
    this.write({ ...prev, semesters: nextSemesters });
    return { ok: true, data: updated };
  }

  async deleteSemester(semesterId: string): Promise<void> {
    const prev = this.read();
    const remainingSemesters = prev.semesters.filter((s) => s.id !== semesterId);
    const nextActiveId =
      prev.activeSemesterId === semesterId
        ? (remainingSemesters[0]?.id ?? null)
        : prev.activeSemesterId;

    this.write({
      version: 1,
      activeSemesterId: nextActiveId,
      semesters: remainingSemesters.map((s) => ({
        ...s,
        isActive: s.id === nextActiveId,
      })),
      subjects: prev.subjects.filter((sub) => sub.semesterId !== semesterId),
      timetableEntries: prev.timetableEntries.filter(
        (tt) => tt.semesterId !== semesterId,
      ),
      calendarEvents: prev.calendarEvents.filter((ev) => ev.semesterId !== semesterId),
      attendanceRecords: prev.attendanceRecords.filter(
        (rec) => rec.semesterId !== semesterId,
      ),
    });
  }

  async addSubject(
    semesterId: string,
    input: Omit<Subject, 'id' | 'semesterId' | 'createdAt'>,
  ): Promise<RepoResult<Subject>> {
    const prev = this.read();
    const normalizedCode = input.code.trim().toUpperCase();
    const duplicate = prev.subjects.some(
      (s) =>
        s.semesterId === semesterId && s.code.toUpperCase() === normalizedCode,
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Subject code "${normalizedCode}" already exists in this semester`,
      };
    }

    const created: Subject = {
      ...input,
      code: normalizedCode,
      id: `sub-${crypto.randomUUID()}`,
      semesterId,
      createdAt: new Date().toISOString(),
    };
    this.write({ ...prev, subjects: [...prev.subjects, created] });
    return { ok: true, data: created };
  }

  async updateSubject(
    subjectId: string,
    patch: Partial<Omit<Subject, 'id' | 'semesterId' | 'createdAt'>>,
  ): Promise<RepoResult<Subject>> {
    const prev = this.read();
    const existing = prev.subjects.find((s) => s.id === subjectId);
    if (!existing) return { ok: false, error: 'Subject not found' };

    if (patch.code) {
      const normalizedCode = patch.code.trim().toUpperCase();
      const duplicate = prev.subjects.some(
        (s) =>
          s.semesterId === existing.semesterId &&
          s.id !== subjectId &&
          s.code.toUpperCase() === normalizedCode,
      );
      if (duplicate) {
        return {
          ok: false,
          error: `Subject code "${normalizedCode}" already exists in this semester`,
        };
      }
    }

    const updated: Subject = {
      ...existing,
      ...patch,
      code: patch.code ? patch.code.trim().toUpperCase() : existing.code,
    };

    this.write({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === subjectId ? updated : s)),
    });
    return { ok: true, data: updated };
  }

  async deleteSubject(subjectId: string): Promise<void> {
    const prev = this.read();
    this.write({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== subjectId),
      timetableEntries: prev.timetableEntries.filter((t) => t.subjectId !== subjectId),
      attendanceRecords: prev.attendanceRecords.filter((r) => r.subjectId !== subjectId),
    });
  }

  async updateHistoricalBaselines(
    semesterId: string,
    inputs: SubjectBaselineInput[],
  ): Promise<void> {
    const prev = this.read();
    const targetSemester = prev.semesters.find((s) => s.id === semesterId);
    if (!targetSemester) return;
    const semesterSubjects = prev.subjects.filter((s) => s.semesterId === semesterId);
    const normalized = normalizeHistoricalBaselines(
      targetSemester.mode,
      semesterSubjects,
      inputs,
    );
    const byId = new Map(normalized.map((s) => [s.id, s]));
    this.write({
      ...prev,
      subjects: prev.subjects.map((s) => byId.get(s.id) ?? s),
    });
  }

  async addTimetableEntry(
    semesterId: string,
    input: Omit<TimetableEntry, 'id' | 'semesterId'>,
  ): Promise<RepoResult<TimetableEntry>> {
    const prev = this.read();
    const created: TimetableEntry = {
      ...input,
      id: `tt-${crypto.randomUUID()}`,
      semesterId,
    };
    this.write({ ...prev, timetableEntries: [...prev.timetableEntries, created] });
    return { ok: true, data: created };
  }

  async addTimetableEntriesBulk(
    semesterId: string,
    entries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry[]>> {
    const prev = this.read();
    const created: TimetableEntry[] = entries.map((e) => ({
      ...e,
      id: `tt-${crypto.randomUUID()}`,
      semesterId,
    }));
    this.write({
      ...prev,
      timetableEntries: [...prev.timetableEntries, ...created],
    });
    return { ok: true, data: created };
  }

  async updateTimetableEntry(
    entryId: string,
    patch: Partial<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry>> {
    const prev = this.read();
    const existing = prev.timetableEntries.find((t) => t.id === entryId);
    if (!existing) return { ok: false, error: 'Timetable entry not found' };
    const updated: TimetableEntry = { ...existing, ...patch };
    this.write({
      ...prev,
      timetableEntries: prev.timetableEntries.map((t) =>
        t.id === entryId ? updated : t,
      ),
    });
    return { ok: true, data: updated };
  }

  async deleteTimetableEntry(entryId: string): Promise<void> {
    const prev = this.read();
    this.write({
      ...prev,
      timetableEntries: prev.timetableEntries.filter((t) => t.id !== entryId),
    });
  }

  async addAttendanceRecord(
    semesterId: string,
    input: Omit<AttendanceRecord, 'id' | 'semesterId'>,
  ): Promise<RepoResult<AttendanceRecord>> {
    const prev = this.read();
    const semesterRecords = prev.attendanceRecords.filter(
      (r) => r.semesterId === semesterId,
    );

    if (
      hasDuplicateAttendanceRecord(semesterRecords, {
        subjectId: input.subjectId,
        date: input.date,
        timetableEntryId: input.timetableEntryId,
        source: input.source,
        status: input.status,
        attendanceUnits: input.attendanceUnits,
        notes: input.notes,
      })
    ) {
      return {
        ok: false,
        error:
          'An attendance record already exists for this timetable slot on this date. Edit the existing record instead.',
      };
    }

    const created: AttendanceRecord = {
      ...input,
      id: `rec-${crypto.randomUUID()}`,
      semesterId,
    };

    this.write({
      ...prev,
      attendanceRecords: [...prev.attendanceRecords, created],
    });
    return { ok: true, data: created };
  }

  async updateAttendanceRecord(
    recordId: string,
    patch: Partial<Omit<AttendanceRecord, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<AttendanceRecord>> {
    const prev = this.read();
    const existing = prev.attendanceRecords.find((r) => r.id === recordId);
    if (!existing) return { ok: false, error: 'Attendance record not found' };

    const updated: AttendanceRecord = { ...existing, ...patch };

    if (
      hasDuplicateAttendanceRecord(
        prev.attendanceRecords.filter((r) => r.semesterId === existing.semesterId),
        {
          subjectId: updated.subjectId,
          date: updated.date,
          timetableEntryId: updated.timetableEntryId,
          source: updated.source,
          status: updated.status,
          attendanceUnits: updated.attendanceUnits,
          notes: updated.notes,
        },
        recordId,
      )
    ) {
      return {
        ok: false,
        error: 'Duplicate record for this subject, date, and timetable slot.',
      };
    }

    this.write({
      ...prev,
      attendanceRecords: prev.attendanceRecords.map((r) =>
        r.id === recordId ? updated : r,
      ),
    });
    return { ok: true, data: updated };
  }

  async deleteAttendanceRecord(recordId: string): Promise<void> {
    const prev = this.read();
    this.write({
      ...prev,
      attendanceRecords: prev.attendanceRecords.filter((r) => r.id !== recordId),
    });
  }

  async addCalendarEvent(
    semesterId: string,
    input: Omit<CalendarEvent, 'id' | 'semesterId'>,
  ): Promise<RepoResult<CalendarEvent>> {
    const prev = this.read();
    const created: CalendarEvent = {
      ...input,
      id: `cal-${crypto.randomUUID()}`,
      semesterId,
    };
    this.write({ ...prev, calendarEvents: [...prev.calendarEvents, created] });
    return { ok: true, data: created };
  }

  async addCalendarEventsBulk(
    semesterId: string,
    events: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent[]>> {
    const prev = this.read();
    const created: CalendarEvent[] = events.map((ev) => ({
      ...ev,
      id: `cal-${crypto.randomUUID()}`,
      semesterId,
    }));
    this.write({
      ...prev,
      calendarEvents: [...prev.calendarEvents, ...created],
    });
    return { ok: true, data: created };
  }

  async updateCalendarEvent(
    eventId: string,
    patch: Partial<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent>> {
    const prev = this.read();
    const existing = prev.calendarEvents.find((ev) => ev.id === eventId);
    if (!existing) return { ok: false, error: 'Calendar event not found' };
    const updated: CalendarEvent = { ...existing, ...patch };
    this.write({
      ...prev,
      calendarEvents: prev.calendarEvents.map((ev) =>
        ev.id === eventId ? updated : ev,
      ),
    });
    return { ok: true, data: updated };
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    const prev = this.read();
    this.write({
      ...prev,
      calendarEvents: prev.calendarEvents.filter((ev) => ev.id !== eventId),
    });
  }

  async loadDemoDataset(): Promise<WorkspaceSnapshot> {
    const prev = this.read();
    const demo = buildDemoDataset();
    // Replace any prior demo semester cleanly without wiping user-created semesters
    const nonDemoSemesters = prev.semesters
      .filter((s) => !s.isDemo && s.id !== demo.semester.id)
      .map((s) => ({ ...s, isActive: false }));
    const nonDemoSemesterIds = new Set(nonDemoSemesters.map((s) => s.id));

    const next: WorkspaceSnapshot = {
      version: 1,
      activeSemesterId: demo.semester.id,
      semesters: [...nonDemoSemesters, demo.semester],
      subjects: [
        ...prev.subjects.filter((s) => nonDemoSemesterIds.has(s.semesterId)),
        ...demo.subjects,
      ],
      timetableEntries: [
        ...prev.timetableEntries.filter((t) => nonDemoSemesterIds.has(t.semesterId)),
        ...demo.timetableEntries,
      ],
      calendarEvents: [
        ...prev.calendarEvents.filter((c) => nonDemoSemesterIds.has(c.semesterId)),
        ...demo.calendarEvents,
      ],
      attendanceRecords: [
        ...prev.attendanceRecords.filter((r) => nonDemoSemesterIds.has(r.semesterId)),
        ...demo.attendanceRecords,
      ],
    };

    this.write(next);
    return next;
  }

  async clearAllData(): Promise<WorkspaceSnapshot> {
    markDemoSeeded();
    clearWorkspaceSnapshot();
    const empty = createEmptyWorkspaceSnapshot();
    saveWorkspaceSnapshot(empty);
    return empty;
  }
}
