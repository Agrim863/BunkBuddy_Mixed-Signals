import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildCombinedTrajectorySeries,
  buildRecoveryCurveSeries,
  computeSemesterAttendanceReport,
  getSessionKey,
  simulateBunkScenario,
  simulateMassBunkDate,
} from '../engine';
import { semesterSetupSchema } from '../schemas/semester.schema';
import { LocalRepository } from '../services/data/LocalRepository';
import { parseCsvText } from '../services/importers/csvParser';
import {
  guessCalendarColumnMapping,
  mapRowsToCalendarDrafts,
} from '../services/importers/calendarMapper';
import {
  guessTimetableColumnMapping,
  mapRowsToTimetableDrafts,
} from '../services/importers/timetableMapper';

const memoryStore = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStore.set(key, value);
      },
      removeItem: (key: string) => {
        memoryStore.delete(key);
      },
    },
  },
});

describe('End-to-End Application Workflows', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('completes Fresh Semester onboarding via CSV imports, tracks attendance, and computes recovery accurately', async () => {
    const repo = new LocalRepository();
    await repo.clearAllData();

    // Step 2 validation
    const semParsed = semesterSetupSchema.parse({
      mode: 'fresh',
      name: 'Fresh Semester 1',
      institutionName: 'State Tech University',
      startDate: '2026-09-07', // Monday
      endDate: '2026-09-27',
      trackingStartDate: '2026-09-07',
      minimumAttendancePercent: 75,
    });

    // Step 3 Calendar CSV import
    const calCsv = parseCsvText(
      [
        'Date,Event Title,Type',
        '2026-09-14,Regional Holiday,Official Holiday',
      ].join('\n'),
    );
    const calDrafts = mapRowsToCalendarDrafts(
      calCsv.rows,
      guessCalendarColumnMapping(calCsv.headers),
    );
    expect(calDrafts.every((d) => d.valid)).toBe(true);

    // Step 4 Timetable CSV import (2-hour lab counting as 1 attendance unit)
    const ttCsv = parseCsvText(
      [
        'Subject,Code,Day,Start,End,Units,Type',
        'Linear Algebra,MA101,Monday,09:00,10:00,1,Lecture',
        'Physics Lab,PH102,Wednesday,14:00,16:00,1,Lab',
      ].join('\n'),
    );
    const ttDrafts = mapRowsToTimetableDrafts(
      ttCsv.rows,
      guessTimetableColumnMapping(ttCsv.headers),
      [],
    );
    expect(ttDrafts.every((d) => d.valid)).toBe(true);

    const subjectTempIds = new Map<string, string>();
    const subjectsPayload = ttDrafts.map((row, idx) => {
      const tempId = `tmp-sub-${idx}`;
      subjectTempIds.set(row.subjectCode, tempId);
      return {
        tempId,
        name: row.subjectName,
        code: row.subjectCode,
        color: idx === 0 ? '#6366F1' : '#10B981',
        historicalConducted: 0,
        historicalAttended: 0,
      };
    });

    const createdSem = await repo.createSemesterFromOnboarding({
      semester: {
        name: semParsed.name,
        institutionName: semParsed.institutionName,
        mode: semParsed.mode,
        startDate: semParsed.startDate,
        endDate: semParsed.endDate,
        trackingStartDate: semParsed.trackingStartDate,
        minimumAttendance: semParsed.minimumAttendancePercent / 100,
      },
      subjects: subjectsPayload,
      timetableEntries: ttDrafts.map((d) => ({
        subjectTempId: subjectTempIds.get(d.subjectCode)!,
        weekday: d.weekday!,
        startTime: d.startTime,
        endTime: d.endTime,
        teachingDurationMinutes: d.teachingDurationMinutes,
        attendanceUnits: d.attendanceUnits,
        sessionType: d.sessionType,
      })),
      calendarEvents: calDrafts.map((c) => ({
        date: c.date,
        endDate: c.endDate,
        eventType: c.eventType,
        title: c.title,
        description: c.description,
        affectsClasses: c.affectsClasses,
      })),
      historicalLogs: [],
    });
    expect(createdSem.ok).toBe(true);

    let ws = await repo.loadWorkspace();
    const sem = ws.semesters.find((s) => s.id === ws.activeSemesterId)!;
    const subs = ws.subjects.filter((s) => s.semesterId === sem.id);
    const tts = ws.timetableEntries.filter((t) => t.semesterId === sem.id);
    const cals = ws.calendarEvents.filter((c) => c.semesterId === sem.id);

    // Initially C = 0 -> percentage is null (N/A)
    const initialReport = computeSemesterAttendanceReport({
      semester: sem,
      subjects: subs,
      timetableEntries: tts,
      calendarEvents: cals,
      attendanceRecords: [],
      asOfDate: '2026-09-07',
    });
    expect(initialReport.overall.conducted).toBe(0);
    expect(initialReport.overall.percentage).toBeNull();
    // 2026-09-14 is blocked by holiday, so only 2 Mondays (Sep 7, Sep 21) + 3 Wednesdays = 5 units
    expect(initialReport.overall.remainingScheduledUnits).toBe(5);

    // Log a mass bunk on Sep 7 (MA101) and cancelled on Sep 9 (PH102)
    const maSub = subs.find((s) => s.code === 'MA101')!;
    const phSub = subs.find((s) => s.code === 'PH102')!;
    const maSlot = tts.find((t) => t.subjectId === maSub.id)!;
    const phSlot = tts.find((t) => t.subjectId === phSub.id)!;

    await repo.addAttendanceRecord(sem.id, {
      subjectId: maSub.id,
      timetableEntryId: maSlot.id,
      date: '2026-09-07',
      status: 'mass_bunk',
      attendanceUnits: 1,
      source: 'tracked',
    });
    await repo.addAttendanceRecord(sem.id, {
      subjectId: phSub.id,
      timetableEntryId: phSlot.id,
      date: '2026-09-09',
      status: 'cancelled',
      attendanceUnits: 1,
      source: 'tracked',
    });

    ws = await repo.loadWorkspace();
    const afterReport = computeSemesterAttendanceReport({
      semester: sem,
      subjects: subs,
      timetableEntries: tts,
      calendarEvents: cals,
      attendanceRecords: ws.attendanceRecords.filter((r) => r.semesterId === sem.id),
      asOfDate: '2026-09-10',
    });

    // Mass bunk counts as 0/1 (0%), cancelled does NOT increase conducted (0/0 N/A)
    const maSummary = afterReport.subjectSummaries.find(
      (s) => s.subject.id === maSub.id,
    )!;
    const phSummary = afterReport.subjectSummaries.find(
      (s) => s.subject.id === phSub.id,
    )!;
    expect(maSummary.conducted).toBe(1);
    expect(maSummary.attended).toBe(0);
    expect(maSummary.percentage).toBe(0);
    expect(maSummary.recoveryClassesNeeded).toBe(3); // 3/4 = 75%
    expect(phSummary.conducted).toBe(0);
    expect(phSummary.percentage).toBeNull();
  });

  it('completes Ongoing Semester workflow across Bunk Simulator, Mass Bunk Tracker, and Analytics without mutating records', async () => {
    const repo = new LocalRepository();
    const ws = await repo.loadWorkspace(); // Auto-seeds 5-subject Demo Data
    const sem = ws.semesters.find((s) => s.id === ws.activeSemesterId)!;
    const subs = ws.subjects.filter((s) => s.semesterId === sem.id);
    const tts = ws.timetableEntries.filter((t) => t.semesterId === sem.id);
    const cals = ws.calendarEvents.filter((c) => c.semesterId === sem.id);
    const recs = ws.attendanceRecords.filter((r) => r.semesterId === sem.id);

    const recordSnapshotBefore = JSON.stringify(recs);

    const report = computeSemesterAttendanceReport({
      semester: sem,
      subjects: subs,
      timetableEntries: tts,
      calendarEvents: cals,
      attendanceRecords: recs,
      asOfDate: sem.trackingStartDate,
    });

    const firstUpcoming = report.upcomingSessions[0]!;
    const sim = simulateBunkScenario({
      report,
      focusSubjectId: 'all',
      singleDate: firstUpcoming.date,
      selectedSessionKeys: [getSessionKey(firstUpcoming)],
      extraMissedUnits: 2,
      otherUpcomingAttendRate: 0.9,
      horizon: 'next_30_days',
    });
    expect(sim.scenarios.A.simulatedPercentage!).toBeGreaterThan(
      sim.scenarios.C.simulatedPercentage!,
    );

    const massBunk = simulateMassBunkDate({
      report,
      dateIso: firstUpcoming.date,
      timetableEntries: tts,
      calendarEvents: cals,
      attendanceRecords: recs,
      selectedTimetableEntryIds: tts
        .filter((t) => t.weekday === firstUpcoming.weekday)
        .map((t) => t.id),
    });
    expect(massBunk.consolidatedImpact.totalMissedUnits).toBeGreaterThan(0);

    const trajectory = buildCombinedTrajectorySeries({
      semester: sem,
      subjects: subs,
      attendanceRecords: recs,
      report,
    });
    expect(trajectory.some((t) => t.phase === 'historical')).toBe(true);
    expect(trajectory.some((t) => t.phase === 'predicted')).toBe(true);

    const dangerSubject = report.overall.subjectsBelowThreshold[0]!;
    const recoveryCurve = buildRecoveryCurveSeries(
      dangerSubject,
      sem.minimumAttendance,
      dangerSubject.recoveryClassesNeeded,
    );
    expect(recoveryCurve.length).toBeGreaterThan(1);

    // Persisted records remain completely untouched after simulations
    const wsAfter = await repo.loadWorkspace();
    const recsAfter = wsAfter.attendanceRecords.filter((r) => r.semesterId === sem.id);
    expect(JSON.stringify(recsAfter)).toBe(recordSnapshotBefore);
  });
});
