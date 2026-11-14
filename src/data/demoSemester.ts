import { addDays, format, subDays } from 'date-fns';
import type {
  AttendanceRecord,
  CalendarEvent,
  Semester,
  Subject,
  TimetableEntry,
} from '../types/domain';

export interface DemoDataset {
  semester: Semester;
  subjects: Subject[];
  timetableEntries: TimetableEntry[];
  calendarEvents: CalendarEvent[];
  attendanceRecords: AttendanceRecord[];
}

/**
 * Generates a realistic 5-subject ongoing semester dataset anchored around referenceDate
 * so upcoming classes, holidays, warnings, and trend series are always relevant and verifiable.
 */
export function buildDemoDataset(referenceDate = new Date()): DemoDataset {
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  const semesterId = 'demo-sem-5';
  const startDate = iso(subDays(referenceDate, 45));
  const endDate = iso(addDays(referenceDate, 45));
  const trackingStartDate = iso(subDays(referenceDate, 14));
  const nowIso = referenceDate.toISOString();

  const semester: Semester = {
    id: semesterId,
    userId: 'local-user',
    name: 'Semester 5 — Computer Science (Demo)',
    institutionName: 'Demo Engineering Institute',
    mode: 'ongoing',
    startDate,
    endDate,
    trackingStartDate,
    minimumAttendance: 0.75,
    isActive: true,
    isDemo: true,
    createdAt: nowIso,
  };

  // 5 realistic subjects covering safe, borderline, and below-threshold states
  const subjects: Subject[] = [
    {
      id: 'demo-sub-dsa',
      semesterId,
      name: 'Data Structures & Algorithms',
      code: 'CS301',
      color: '#6366F1',
      historicalConducted: 18,
      historicalAttended: 16,
      createdAt: nowIso,
    },
    {
      id: 'demo-sub-os',
      semesterId,
      name: 'Operating Systems',
      code: 'CS302',
      color: '#3B82F6',
      historicalConducted: 16,
      historicalAttended: 13,
      createdAt: nowIso,
    },
    {
      id: 'demo-sub-dbms',
      semesterId,
      name: 'Database Systems',
      code: 'CS303',
      color: '#10B981',
      historicalConducted: 15,
      historicalAttended: 10,
      createdAt: nowIso,
    },
    {
      id: 'demo-sub-cn',
      semesterId,
      name: 'Computer Networks',
      code: 'CS304',
      color: '#F59E0B',
      historicalConducted: 14,
      historicalAttended: 10,
      createdAt: nowIso,
    },
    {
      id: 'demo-sub-se-lab',
      semesterId,
      name: 'Software Engineering Lab',
      code: 'CS305',
      color: '#8B5CF6',
      historicalConducted: 10,
      historicalAttended: 9,
      createdAt: nowIso,
    },
  ];

  // Weekly timetable covering Monday (1) to Friday (5), including a 2-hr lab with 2 units & a 2-hr lab with 1 unit
  const timetableEntries: TimetableEntry[] = [
    {
      id: 'demo-tt-1',
      semesterId,
      subjectId: 'demo-sub-dsa',
      weekday: 1,
      startTime: '09:00',
      endTime: '10:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-2',
      semesterId,
      subjectId: 'demo-sub-os',
      weekday: 1,
      startTime: '10:15',
      endTime: '11:15',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-3',
      semesterId,
      subjectId: 'demo-sub-dbms',
      weekday: 1,
      startTime: '14:00',
      endTime: '16:00',
      teachingDurationMinutes: 120,
      attendanceUnits: 2,
      sessionType: 'lab',
    },
    {
      id: 'demo-tt-4',
      semesterId,
      subjectId: 'demo-sub-cn',
      weekday: 2,
      startTime: '09:00',
      endTime: '10:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-5',
      semesterId,
      subjectId: 'demo-sub-dsa',
      weekday: 2,
      startTime: '11:30',
      endTime: '12:30',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'tutorial',
    },
    {
      id: 'demo-tt-6',
      semesterId,
      subjectId: 'demo-sub-os',
      weekday: 3,
      startTime: '09:00',
      endTime: '10:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-7',
      semesterId,
      subjectId: 'demo-sub-se-lab',
      weekday: 3,
      startTime: '14:00',
      endTime: '16:00',
      teachingDurationMinutes: 120,
      attendanceUnits: 1, // 2-hour lab counting as 1 attendance entry
      sessionType: 'lab',
    },
    {
      id: 'demo-tt-8',
      semesterId,
      subjectId: 'demo-sub-dbms',
      weekday: 4,
      startTime: '10:00',
      endTime: '11:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-9',
      semesterId,
      subjectId: 'demo-sub-cn',
      weekday: 4,
      startTime: '11:15',
      endTime: '12:15',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-10',
      semesterId,
      subjectId: 'demo-sub-dsa',
      weekday: 5,
      startTime: '09:00',
      endTime: '10:00',
      teachingDurationMinutes: 60,
      attendanceUnits: 1,
      sessionType: 'lecture',
    },
    {
      id: 'demo-tt-11',
      semesterId,
      subjectId: 'demo-sub-se-lab',
      weekday: 5,
      startTime: '13:30',
      endTime: '15:30',
      teachingDurationMinutes: 120,
      attendanceUnits: 1,
      sessionType: 'lab',
    },
  ];

  // Calendar events: 3 upcoming events (holiday, break, college event)
  const calendarEvents: CalendarEvent[] = [
    {
      id: 'demo-cal-1',
      semesterId,
      date: iso(addDays(referenceDate, 4)),
      eventType: 'official_holiday',
      title: 'Founder’s Day Holiday',
      description: 'Official campus holiday — no lectures conducted.',
      affectsClasses: true,
    },
    {
      id: 'demo-cal-2',
      semesterId,
      date: iso(addDays(referenceDate, 12)),
      endDate: iso(addDays(referenceDate, 13)),
      eventType: 'college_event',
      title: 'Annual Tech Symposium',
      description: 'Department workshops; regular classes run unless cancelled.',
      affectsClasses: false,
    },
    {
      id: 'demo-cal-3',
      semesterId,
      date: iso(addDays(referenceDate, 20)),
      endDate: iso(addDays(referenceDate, 22)),
      eventType: 'semester_break',
      title: 'Mid-Semester Recess',
      description: 'Three-day academic break.',
      affectsClasses: true,
    },
  ];

  // Tracked attendance records over the past 14 days (strictly >= trackingStartDate and <= yesterday)
  const attendanceRecords: AttendanceRecord[] = [
    {
      id: 'demo-rec-1',
      semesterId,
      subjectId: 'demo-sub-dsa',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 13)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
      notes: 'Trees & graphs lecture',
    },
    {
      id: 'demo-rec-2',
      semesterId,
      subjectId: 'demo-sub-os',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 13)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-3',
      semesterId,
      subjectId: 'demo-sub-dbms',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 11)),
      status: 'absent',
      attendanceUnits: 2,
      source: 'tracked',
      notes: 'Missed SQL indexing lab',
    },
    {
      id: 'demo-rec-4',
      semesterId,
      subjectId: 'demo-sub-cn',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 10)),
      status: 'mass_bunk',
      attendanceUnits: 1,
      source: 'tracked',
      notes: 'Class conducted despite mass bunk',
    },
    {
      id: 'demo-rec-5',
      semesterId,
      subjectId: 'demo-sub-dsa',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 8)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-6',
      semesterId,
      subjectId: 'demo-sub-os',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 7)),
      status: 'absent',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-7',
      semesterId,
      subjectId: 'demo-sub-se-lab',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 6)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-8',
      semesterId,
      subjectId: 'demo-sub-dbms',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 5)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-9',
      semesterId,
      subjectId: 'demo-sub-cn',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 4)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-10',
      semesterId,
      subjectId: 'demo-sub-os',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 3)),
      status: 'cancelled',
      attendanceUnits: 1,
      source: 'tracked',
      notes: 'Instructor away at conference (not counted)',
    },
    {
      id: 'demo-rec-11',
      semesterId,
      subjectId: 'demo-sub-dsa',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 2)),
      status: 'present',
      attendanceUnits: 1,
      source: 'tracked',
    },
    {
      id: 'demo-rec-12',
      semesterId,
      subjectId: 'demo-sub-cn',
      timetableEntryId: null,
      date: iso(subDays(referenceDate, 1)),
      status: 'absent',
      attendanceUnits: 1,
      source: 'tracked',
    },
  ];

  return {
    semester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
  };
}
