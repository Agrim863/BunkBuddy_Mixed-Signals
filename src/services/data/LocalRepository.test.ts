import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoDataset } from '../../data/demoSemester';
import {
  buildHistoricalTrendPoints,
  computeSemesterAttendanceReport,
} from '../../engine';
import { LocalRepository } from './LocalRepository';

// Lightweight localStorage mock for Node Vitest environment
const memoryStore = new Map<string, string>();
const windowMock = {
  localStorage: {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
  },
};

Object.assign(globalThis, { window: windowMock });

describe('LocalRepository & Demo Dataset', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('auto-seeds clearly labeled 5-subject demo dataset on first visit and persists edits', async () => {
    const repo = new LocalRepository();
    const initial = await repo.loadWorkspace();

    expect(initial.semesters).toHaveLength(1);
    expect(initial.semesters[0]?.isDemo).toBe(true);
    expect(initial.subjects).toHaveLength(5);

    const semId = initial.semesters[0]!.id;
    const subId = initial.subjects[0]!.id;

    // Duplicate record guard for same timetable slot + date
    const first = await repo.addAttendanceRecord(semId, {
      subjectId: subId,
      timetableEntryId: 'demo-tt-1',
      date: initial.semesters[0]!.trackingStartDate,
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    });
    expect(first.ok).toBe(true);

    const dup = await repo.addAttendanceRecord(semId, {
      subjectId: subId,
      timetableEntryId: 'demo-tt-1',
      date: initial.semesters[0]!.trackingStartDate,
      status: 'absent',
      attendanceUnits: 1,
      source: 'tracked',
    });
    expect(dup.ok).toBe(false);
  });

  it('rejects identical slot-less submissions but allows distinct sessions', async () => {
    const repo = new LocalRepository();
    const data = await repo.loadWorkspace();
    const input = { subjectId: data.subjects[0]!.id, date: '2026-11-12', status: 'absent' as const, attendanceUnits: 1, source: 'tracked' as const, notes: 'Extra class A' };
    expect((await repo.addAttendanceRecord(data.semesters[0]!.id, input)).ok).toBe(true);
    expect((await repo.addAttendanceRecord(data.semesters[0]!.id, input)).ok).toBe(false);
    expect((await repo.addAttendanceRecord(data.semesters[0]!.id, { ...input, notes: 'Extra class B' })).ok).toBe(true);
  });

  it('computes realistic demo report and cumulative historical trend points', () => {
    const demo = buildDemoDataset(new Date('2026-11-10T10:00:00Z'));
    const report = computeSemesterAttendanceReport({
      semester: demo.semester,
      subjects: demo.subjects,
      timetableEntries: demo.timetableEntries,
      calendarEvents: demo.calendarEvents,
      attendanceRecords: demo.attendanceRecords,
      asOfDate: '2026-11-10',
    });

    expect(report.subjectSummaries).toHaveLength(5);
    expect(report.overall.conducted).toBeGreaterThan(0);
    expect(report.overall.subjectsBelowThreshold.length).toBeGreaterThan(0);

    const trend = buildHistoricalTrendPoints({
      semester: demo.semester,
      subjects: demo.subjects,
      attendanceRecords: demo.attendanceRecords,
    });
    expect(trend[0]?.label).toBe('Baseline');
    expect(trend.length).toBeGreaterThan(3);
  });
});
