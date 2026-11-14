import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDemoDataset } from '../../data/demoSemester';
import {
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
  createEmptyWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../storage/localWorkspaceStore';
import type { DataRepository, RepoResult } from './DataRepository';

interface DbSemesterRow {
  id: string;
  user_id: string;
  name: string;
  institution_name: string | null;
  mode: 'fresh' | 'ongoing';
  start_date: string;
  end_date: string;
  tracking_start_date: string;
  minimum_attendance: number;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}

interface DbSubjectRow {
  id: string;
  semester_id: string;
  name: string;
  code: string;
  color: string;
  historical_conducted: number;
  historical_attended: number;
  created_at: string;
}

interface DbTimetableRow {
  id: string;
  semester_id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  teaching_duration_minutes: number;
  attendance_units: number;
  session_type: 'lecture' | 'lab' | 'tutorial';
}

interface DbAttendanceRecordRow {
  id: string;
  semester_id: string;
  subject_id: string;
  timetable_entry_id: string | null;
  date: string;
  status: AttendanceRecord['status'];
  attendance_units: number;
  source: AttendanceRecord['source'];
  notes: string | null;
}

interface DbCalendarRow {
  id: string;
  semester_id: string;
  date: string;
  end_date: string | null;
  event_type: CalendarEvent['eventType'];
  title: string;
  description: string | null;
  affects_classes: boolean;
}

const mapSemester = (row: DbSemesterRow): Semester => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  institutionName: row.institution_name ?? undefined,
  mode: row.mode,
  startDate: row.start_date,
  endDate: row.end_date,
  trackingStartDate: row.tracking_start_date,
  minimumAttendance: Number(row.minimum_attendance),
  isActive: row.is_active,
  isDemo: row.is_demo,
  createdAt: row.created_at,
});

const mapSubject = (row: DbSubjectRow): Subject => ({
  id: row.id,
  semesterId: row.semester_id,
  name: row.name,
  code: row.code,
  color: row.color,
  historicalConducted: row.historical_conducted,
  historicalAttended: row.historical_attended,
  createdAt: row.created_at,
});

const mapTimetable = (row: DbTimetableRow): TimetableEntry => ({
  id: row.id,
  semesterId: row.semester_id,
  subjectId: row.subject_id,
  weekday: row.weekday,
  startTime: row.start_time.slice(0, 5),
  endTime: row.end_time.slice(0, 5),
  teachingDurationMinutes: row.teaching_duration_minutes,
  attendanceUnits: row.attendance_units,
  sessionType: row.session_type,
});

const mapRecord = (row: DbAttendanceRecordRow): AttendanceRecord => ({
  id: row.id,
  semesterId: row.semester_id,
  subjectId: row.subject_id,
  timetableEntryId: row.timetable_entry_id,
  date: row.date,
  status: row.status,
  attendanceUnits: row.attendance_units,
  source: row.source,
  notes: row.notes ?? undefined,
});

const mapCalendar = (row: DbCalendarRow): CalendarEvent => ({
  id: row.id,
  semesterId: row.semester_id,
  date: row.date,
  endDate: row.end_date ?? undefined,
  eventType: row.event_type,
  title: row.title,
  description: row.description ?? undefined,
  affectsClasses: row.affects_classes,
});

export class SupabaseRepository implements DataRepository {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    const name =
      (data.user.user_metadata?.name as string | undefined) ??
      data.user.email?.split('@')[0] ??
      'Student';
    return {
      id: data.user.id,
      name,
      email: data.user.email ?? '',
      mode: 'supabase',
    };
  }

  async signIn(email: string, password: string): Promise<RepoResult<UserProfile>> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Sign-in failed' };
    }
    return {
      ok: true,
      data: {
        id: data.user.id,
        name:
          (data.user.user_metadata?.name as string | undefined) ??
          data.user.email?.split('@')[0] ??
          'Student',
        email: data.user.email ?? email,
        mode: 'supabase',
      },
    };
  }

  async signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<RepoResult<UserProfile>> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Sign-up failed' };
    }
    return {
      ok: true,
      data: {
        id: data.user.id,
        name,
        email: data.user.email ?? email,
        mode: 'supabase',
      },
    };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async loadWorkspace(): Promise<WorkspaceSnapshot> {
    const user = await this.getCurrentUser();
    if (!user) return createEmptyWorkspaceSnapshot();

    const [semRes, subRes, ttRes, calRes, recRes] = await Promise.all([
      this.client.from('semesters').select('*').order('created_at', { ascending: true }),
      this.client.from('subjects').select('*').order('created_at', { ascending: true }),
      this.client.from('timetable_entries').select('*'),
      this.client.from('calendar_events').select('*').order('date', { ascending: true }),
      this.client
        .from('attendance_records')
        .select('*')
        .order('date', { ascending: false }),
    ]);

    const semesters = ((semRes.data ?? []) as DbSemesterRow[]).map(mapSemester);
    const active = semesters.find((s) => s.isActive) ?? semesters[0] ?? null;

    return {
      version: 1,
      activeSemesterId: active?.id ?? null,
      semesters,
      subjects: ((subRes.data ?? []) as DbSubjectRow[]).map(mapSubject),
      timetableEntries: ((ttRes.data ?? []) as DbTimetableRow[]).map(mapTimetable),
      calendarEvents: ((calRes.data ?? []) as DbCalendarRow[]).map(mapCalendar),
      attendanceRecords: ((recRes.data ?? []) as DbAttendanceRecordRow[]).map(
        mapRecord,
      ),
    };
  }

  async selectSemester(semesterId: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;
    await this.client
      .from('semesters')
      .update({ is_active: false })
      .eq('user_id', user.id);
    await this.client
      .from('semesters')
      .update({ is_active: true })
      .eq('id', semesterId);
  }

  async createSemesterFromOnboarding(
    payload: OnboardingSubmission,
  ): Promise<RepoResult<Semester>> {
    const user = await this.getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in to Supabase first.' };

    await this.client
      .from('semesters')
      .update({ is_active: false })
      .eq('user_id', user.id);

    const { data: semData, error: semError } = await this.client
      .from('semesters')
      .insert({
        user_id: user.id,
        name: payload.semester.name,
        institution_name: payload.semester.institutionName ?? null,
        mode: payload.semester.mode,
        start_date: payload.semester.startDate,
        end_date: payload.semester.endDate,
        tracking_start_date: payload.semester.trackingStartDate,
        minimum_attendance: payload.semester.minimumAttendance,
        is_active: true,
        is_demo: false,
      })
      .select()
      .single();

    if (semError || !semData) {
      return { ok: false, error: semError?.message ?? 'Failed to create semester' };
    }

    const semester = mapSemester(semData as DbSemesterRow);
    const tempToReal = new Map<string, string>();

    if (payload.subjects.length > 0) {
      const { data: subData } = await this.client
        .from('subjects')
        .insert(
          payload.subjects.map((s) => ({
            semester_id: semester.id,
            name: s.name,
            code: s.code.toUpperCase(),
            color: s.color,
            historical_conducted:
              payload.semester.mode === 'fresh' ? 0 : s.historicalConducted,
            historical_attended:
              payload.semester.mode === 'fresh' ? 0 : s.historicalAttended,
          })),
        )
        .select();

      const insertedSubjects = (subData ?? []) as DbSubjectRow[];
      for (const draftSub of payload.subjects) {
        const match = insertedSubjects.find(
          (row) => row.code.toUpperCase() === draftSub.code.toUpperCase(),
        );
        if (match) tempToReal.set(draftSub.tempId, match.id);
      }
    }

    const ttRows = payload.timetableEntries
      .filter((t) => tempToReal.has(t.subjectTempId))
      .map((t) => ({
        semester_id: semester.id,
        subject_id: tempToReal.get(t.subjectTempId)!,
        weekday: t.weekday,
        start_time: t.startTime,
        end_time: t.endTime,
        teaching_duration_minutes: t.teachingDurationMinutes,
        attendance_units: t.attendanceUnits,
        session_type: t.sessionType,
      }));
    if (ttRows.length > 0) {
      await this.client.from('timetable_entries').insert(ttRows);
    }

    if (payload.calendarEvents.length > 0) {
      await this.client.from('calendar_events').insert(
        payload.calendarEvents.map((ev) => ({
          semester_id: semester.id,
          date: ev.date,
          end_date: ev.endDate ?? null,
          event_type: ev.eventType,
          title: ev.title,
          description: ev.description ?? null,
          affects_classes: ev.affectsClasses,
        })),
      );
    }

    if (payload.semester.mode === 'ongoing' && payload.historicalLogs.length > 0) {
      const recRows = payload.historicalLogs
        .filter((l) => tempToReal.has(l.subjectTempId))
        .map((l) => ({
          semester_id: semester.id,
          subject_id: tempToReal.get(l.subjectTempId)!,
          timetable_entry_id: null,
          date: l.date,
          status: l.status,
          attendance_units: l.attendanceUnits,
          source: 'historical_log' as const,
          notes: l.notes ?? null,
        }));
      if (recRows.length > 0) {
        await this.client.from('attendance_records').insert(recRows);
      }
    }

    return { ok: true, data: semester };
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
    const { data, error } = await this.client
      .from('semesters')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.institutionName !== undefined
          ? { institution_name: patch.institutionName ?? null }
          : {}),
        ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
        ...(patch.endDate !== undefined ? { end_date: patch.endDate } : {}),
        ...(patch.trackingStartDate !== undefined
          ? { tracking_start_date: patch.trackingStartDate }
          : {}),
        ...(patch.minimumAttendance !== undefined
          ? { minimum_attendance: patch.minimumAttendance }
          : {}),
      })
      .eq('id', semesterId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to update semester' };
    }
    return { ok: true, data: mapSemester(data as DbSemesterRow) };
  }

  async deleteSemester(semesterId: string): Promise<void> {
    await this.client.from('semesters').delete().eq('id', semesterId);
  }

  async addSubject(
    semesterId: string,
    input: Omit<Subject, 'id' | 'semesterId' | 'createdAt'>,
  ): Promise<RepoResult<Subject>> {
    const { data, error } = await this.client
      .from('subjects')
      .insert({
        semester_id: semesterId,
        name: input.name,
        code: input.code.toUpperCase(),
        color: input.color,
        historical_conducted: input.historicalConducted,
        historical_attended: input.historicalAttended,
      })
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to add subject' };
    }
    return { ok: true, data: mapSubject(data as DbSubjectRow) };
  }

  async updateSubject(
    subjectId: string,
    patch: Partial<Omit<Subject, 'id' | 'semesterId' | 'createdAt'>>,
  ): Promise<RepoResult<Subject>> {
    const { data, error } = await this.client
      .from('subjects')
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.code !== undefined ? { code: patch.code.toUpperCase() } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.historicalConducted !== undefined
          ? { historical_conducted: patch.historicalConducted }
          : {}),
        ...(patch.historicalAttended !== undefined
          ? { historical_attended: patch.historicalAttended }
          : {}),
      })
      .eq('id', subjectId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to update subject' };
    }
    return { ok: true, data: mapSubject(data as DbSubjectRow) };
  }

  async deleteSubject(subjectId: string): Promise<void> {
    await this.client.from('subjects').delete().eq('id', subjectId);
  }

  async updateHistoricalBaselines(
    semesterId: string,
    inputs: SubjectBaselineInput[],
  ): Promise<void> {
    const { data: semData } = await this.client
      .from('semesters')
      .select('*')
      .eq('id', semesterId)
      .single();
    const { data: subData } = await this.client
      .from('subjects')
      .select('*')
      .eq('semester_id', semesterId);
    if (!semData || !subData) return;

    const sem = mapSemester(semData as DbSemesterRow);
    const normalized = normalizeHistoricalBaselines(
      sem.mode,
      (subData as DbSubjectRow[]).map(mapSubject),
      inputs,
    );
    await Promise.all(
      normalized.map((s) =>
        this.client
          .from('subjects')
          .update({
            historical_conducted: s.historicalConducted,
            historical_attended: s.historicalAttended,
          })
          .eq('id', s.id),
      ),
    );
  }

  async addTimetableEntry(
    semesterId: string,
    input: Omit<TimetableEntry, 'id' | 'semesterId'>,
  ): Promise<RepoResult<TimetableEntry>> {
    const { data, error } = await this.client
      .from('timetable_entries')
      .insert({
        semester_id: semesterId,
        subject_id: input.subjectId,
        weekday: input.weekday,
        start_time: input.startTime,
        end_time: input.endTime,
        teaching_duration_minutes: input.teachingDurationMinutes,
        attendance_units: input.attendanceUnits,
        session_type: input.sessionType,
      })
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to add timetable entry' };
    }
    return { ok: true, data: mapTimetable(data as DbTimetableRow) };
  }

  async addTimetableEntriesBulk(
    semesterId: string,
    entries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry[]>> {
    if (entries.length === 0) return { ok: true, data: [] };
    const { data, error } = await this.client
      .from('timetable_entries')
      .insert(
        entries.map((input) => ({
          semester_id: semesterId,
          subject_id: input.subjectId,
          weekday: input.weekday,
          start_time: input.startTime,
          end_time: input.endTime,
          teaching_duration_minutes: input.teachingDurationMinutes,
          attendance_units: input.attendanceUnits,
          session_type: input.sessionType,
        })),
      )
      .select();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: ((data ?? []) as DbTimetableRow[]).map(mapTimetable) };
  }

  async updateTimetableEntry(
    entryId: string,
    patch: Partial<Omit<TimetableEntry, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<TimetableEntry>> {
    const { data, error } = await this.client
      .from('timetable_entries')
      .update({
        ...(patch.subjectId !== undefined ? { subject_id: patch.subjectId } : {}),
        ...(patch.weekday !== undefined ? { weekday: patch.weekday } : {}),
        ...(patch.startTime !== undefined ? { start_time: patch.startTime } : {}),
        ...(patch.endTime !== undefined ? { end_time: patch.endTime } : {}),
        ...(patch.teachingDurationMinutes !== undefined
          ? { teaching_duration_minutes: patch.teachingDurationMinutes }
          : {}),
        ...(patch.attendanceUnits !== undefined
          ? { attendance_units: patch.attendanceUnits }
          : {}),
        ...(patch.sessionType !== undefined
          ? { session_type: patch.sessionType }
          : {}),
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to update timetable slot' };
    }
    return { ok: true, data: mapTimetable(data as DbTimetableRow) };
  }

  async deleteTimetableEntry(entryId: string): Promise<void> {
    await this.client.from('timetable_entries').delete().eq('id', entryId);
  }

  async addAttendanceRecord(
    semesterId: string,
    input: Omit<AttendanceRecord, 'id' | 'semesterId'>,
  ): Promise<RepoResult<AttendanceRecord>> {
    const { data, error } = await this.client
      .from('attendance_records')
      .insert({
        semester_id: semesterId,
        subject_id: input.subjectId,
        timetable_entry_id: input.timetableEntryId ?? null,
        date: input.date,
        status: input.status,
        attendance_units: input.attendanceUnits,
        source: input.source,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? 'Failed to save attendance record',
      };
    }
    return { ok: true, data: mapRecord(data as DbAttendanceRecordRow) };
  }

  async updateAttendanceRecord(
    recordId: string,
    patch: Partial<Omit<AttendanceRecord, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<AttendanceRecord>> {
    const { data, error } = await this.client
      .from('attendance_records')
      .update({
        ...(patch.subjectId !== undefined ? { subject_id: patch.subjectId } : {}),
        ...(patch.timetableEntryId !== undefined
          ? { timetable_entry_id: patch.timetableEntryId ?? null }
          : {}),
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.attendanceUnits !== undefined
          ? { attendance_units: patch.attendanceUnits }
          : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to update record' };
    }
    return { ok: true, data: mapRecord(data as DbAttendanceRecordRow) };
  }

  async deleteAttendanceRecord(recordId: string): Promise<void> {
    await this.client.from('attendance_records').delete().eq('id', recordId);
  }

  async addCalendarEvent(
    semesterId: string,
    input: Omit<CalendarEvent, 'id' | 'semesterId'>,
  ): Promise<RepoResult<CalendarEvent>> {
    const { data, error } = await this.client
      .from('calendar_events')
      .insert({
        semester_id: semesterId,
        date: input.date,
        end_date: input.endDate ?? null,
        event_type: input.eventType,
        title: input.title,
        description: input.description ?? null,
        affects_classes: input.affectsClasses,
      })
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to add calendar event' };
    }
    return { ok: true, data: mapCalendar(data as DbCalendarRow) };
  }

  async addCalendarEventsBulk(
    semesterId: string,
    events: Array<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent[]>> {
    if (events.length === 0) return { ok: true, data: [] };
    const { data, error } = await this.client
      .from('calendar_events')
      .insert(
        events.map((input) => ({
          semester_id: semesterId,
          date: input.date,
          end_date: input.endDate ?? null,
          event_type: input.eventType,
          title: input.title,
          description: input.description ?? null,
          affects_classes: input.affectsClasses,
        })),
      )
      .select();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: ((data ?? []) as DbCalendarRow[]).map(mapCalendar) };
  }

  async updateCalendarEvent(
    eventId: string,
    patch: Partial<Omit<CalendarEvent, 'id' | 'semesterId'>>,
  ): Promise<RepoResult<CalendarEvent>> {
    const { data, error } = await this.client
      .from('calendar_events')
      .update({
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.endDate !== undefined ? { end_date: patch.endDate ?? null } : {}),
        ...(patch.eventType !== undefined ? { event_type: patch.eventType } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description ?? null }
          : {}),
        ...(patch.affectsClasses !== undefined
          ? { affects_classes: patch.affectsClasses }
          : {}),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Failed to update event' };
    }
    return { ok: true, data: mapCalendar(data as DbCalendarRow) };
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    await this.client.from('calendar_events').delete().eq('id', eventId);
  }

  async loadDemoDataset(): Promise<WorkspaceSnapshot> {
    const user = await this.getCurrentUser();
    if (!user) return createEmptyWorkspaceSnapshot();
    const demo = buildDemoDataset();
    const res = await this.createSemesterFromOnboarding({
      semester: {
        name: demo.semester.name,
        institutionName: demo.semester.institutionName,
        mode: demo.semester.mode,
        startDate: demo.semester.startDate,
        endDate: demo.semester.endDate,
        trackingStartDate: demo.semester.trackingStartDate,
        minimumAttendance: demo.semester.minimumAttendance,
      },
      subjects: demo.subjects.map((s) => ({
        tempId: s.id,
        name: s.name,
        code: s.code,
        color: s.color,
        historicalConducted: s.historicalConducted,
        historicalAttended: s.historicalAttended,
      })),
      timetableEntries: demo.timetableEntries.map((t) => ({
        subjectTempId: t.subjectId,
        weekday: t.weekday,
        startTime: t.startTime,
        endTime: t.endTime,
        teachingDurationMinutes: t.teachingDurationMinutes,
        attendanceUnits: t.attendanceUnits,
        sessionType: t.sessionType,
      })),
      calendarEvents: demo.calendarEvents.map((ev) => ({
        date: ev.date,
        endDate: ev.endDate,
        eventType: ev.eventType,
        title: ev.title,
        description: ev.description,
        affectsClasses: ev.affectsClasses,
      })),
      historicalLogs: [],
    });
    if (res.ok) {
      await this.client
        .from('semesters')
        .update({ is_demo: true })
        .eq('id', res.data.id);
    }
    return this.loadWorkspace();
  }

  async clearAllData(): Promise<WorkspaceSnapshot> {
    const user = await this.getCurrentUser();
    if (user) {
      await this.client.from('semesters').delete().eq('user_id', user.id);
    }
    return this.loadWorkspace();
  }
}
