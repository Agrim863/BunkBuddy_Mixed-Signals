import { addDays, format, parseISO } from 'date-fns';
import type { SemesterAttendanceReport } from './attendanceAggregator';
import {
  calculateFuturePercentage,
  calculateImmediateSafeBunks,
  calculatePercentage,
  calculatePercentagePointDelta,
  calculateRecoveryClasses,
  calculateSemesterAbsenceBudget,
  classifyAttendanceStatus,
  type AttendanceHealthStatus,
} from './attendanceMath';
import type { ScheduledSession } from './scheduleEngine';

export type SimulationHorizon =
  | 'immediate'
  | 'next_14_days'
  | 'next_30_days'
  | 'semester_end';

export interface ScenarioOutcome {
  id: 'A' | 'B' | 'C' | 'CUSTOM';
  label: string;
  description: string;
  attended: number;
  conducted: number;
  currentPercentage: number | null;
  simulatedPercentage: number | null;
  percentagePointDelta: number | null;
  status: AttendanceHealthStatus;
  recoveryClassesNeeded: number | null;
  immediateSafeBunksAfter: number;
  semesterAbsenceBudgetAfter: number;
  missedUnitsInScenario: number;
  attendedFutureUnitsInScenario: number;
}

export interface BunkSimulationInput {
  report: SemesterAttendanceReport;
  focusSubjectId: string | 'all';
  singleDate: string;
  selectedSessionKeys: string[];
  extraMissedUnits: number;
  otherUpcomingAttendRate: number; // 0..1
  horizon: SimulationHorizon;
}

export interface BunkSimulationResult {
  scopeLabel: string;
  horizonSessionsCount: number;
  horizonUnitsTotal: number;
  selectedSessionsCount: number;
  selectedUnitsTotal: number;
  singleDateSessionsCount: number;
  singleDateUnitsTotal: number;
  primary: ScenarioOutcome;
  overall: ScenarioOutcome;
  scenarios: {
    A: ScenarioOutcome;
    B: ScenarioOutcome;
    C: ScenarioOutcome;
  };
  overallScenarios: {
    A: ScenarioOutcome;
    B: ScenarioOutcome;
    C: ScenarioOutcome;
  };
}

export function getSessionKey(
  session: Pick<ScheduledSession, 'date' | 'timetableEntryId'>,
): string {
  return `${session.date}::${session.timetableEntryId}`;
}

function getHorizonCutoffDate(
  asOfDate: string,
  semesterEndDate: string,
  horizon: SimulationHorizon,
): string {
  const base = parseISO(asOfDate);
  if (Number.isNaN(base.getTime())) return semesterEndDate;
  if (horizon === 'next_14_days') {
    const cutoff = format(addDays(base, 14), 'yyyy-MM-dd');
    return cutoff < semesterEndDate ? cutoff : semesterEndDate;
  }
  if (horizon === 'next_30_days') {
    const cutoff = format(addDays(base, 30), 'yyyy-MM-dd');
    return cutoff < semesterEndDate ? cutoff : semesterEndDate;
  }
  return semesterEndDate;
}

function evaluateScenarioOutcome(params: {
  id: ScenarioOutcome['id'];
  label: string;
  description: string;
  baseAttended: number;
  baseConducted: number;
  futureAttended: number;
  futureConducted: number;
  totalRemainingSemesterUnits: number;
  minimumThreshold: number;
}): ScenarioOutcome {
  const {
    id,
    label,
    description,
    baseAttended,
    baseConducted,
    futureAttended,
    futureConducted,
    totalRemainingSemesterUnits,
    minimumThreshold,
  } = params;

  const currentPercentage = calculatePercentage(baseAttended, baseConducted);
  const simulatedPercentage = calculateFuturePercentage(
    baseAttended,
    baseConducted,
    futureAttended,
    futureConducted,
  );
  const delta = calculatePercentagePointDelta(currentPercentage, simulatedPercentage);

  const simAttended = baseAttended + futureAttended;
  const simConducted = baseConducted + futureConducted;
  const remainingAfterHorizon = Math.max(
    0,
    totalRemainingSemesterUnits - futureConducted,
  );

  return {
    id,
    label,
    description,
    attended: simAttended,
    conducted: simConducted,
    currentPercentage,
    simulatedPercentage,
    percentagePointDelta: delta,
    status: classifyAttendanceStatus(simulatedPercentage, minimumThreshold),
    recoveryClassesNeeded: calculateRecoveryClasses(
      simAttended,
      simConducted,
      minimumThreshold,
    ),
    immediateSafeBunksAfter: calculateImmediateSafeBunks(
      simAttended,
      simConducted,
      minimumThreshold,
    ),
    semesterAbsenceBudgetAfter: calculateSemesterAbsenceBudget(
      simAttended,
      simConducted,
      remainingAfterHorizon,
      minimumThreshold,
    ),
    missedUnitsInScenario: Math.max(0, futureConducted - futureAttended),
    attendedFutureUnitsInScenario: futureAttended,
  };
}

function buildScopeScenarios(params: {
  baseAttended: number;
  baseConducted: number;
  totalRemainingSemesterUnits: number;
  minimumThreshold: number;
  horizonSessions: ScheduledSession[];
  selectedKeySet: Set<string>;
  singleDate: string;
  extraMissedUnits: number;
  otherUpcomingAttendRate: number;
  horizon: SimulationHorizon;
}): {
  primary: ScenarioOutcome;
  scenarios: { A: ScenarioOutcome; B: ScenarioOutcome; C: ScenarioOutcome };
} {
  const {
    baseAttended,
    baseConducted,
    totalRemainingSemesterUnits,
    minimumThreshold,
    horizonSessions,
    selectedKeySet,
    singleDate,
    extraMissedUnits,
    otherUpcomingAttendRate,
    horizon,
  } = params;

  const safeExtra = Math.max(0, Math.floor(extraMissedUnits));
  const safeRate = Math.min(1, Math.max(0, otherUpcomingAttendRate));

  const horizonTotalUnits = horizonSessions.reduce(
    (sum, s) => sum + s.attendanceUnits,
    0,
  );

  // Selected multi-day sessions (Scenario C)
  const selectedSessions = horizonSessions.filter((s) =>
    selectedKeySet.has(getSessionKey(s)),
  );
  const selectedUnits = selectedSessions.reduce(
    (sum, s) => sum + s.attendanceUnits,
    0,
  );

  // Single-date sessions (Scenario B)
  const singleDateSessions = horizonSessions.filter((s) => s.date === singleDate);
  const singleDateSelected = singleDateSessions.filter((s) =>
    selectedKeySet.has(getSessionKey(s)),
  );
  const singleDateMissedUnits =
    singleDateSelected.length > 0
      ? singleDateSelected.reduce((sum, s) => sum + s.attendanceUnits, 0)
      : singleDateSessions.reduce((sum, s) => sum + s.attendanceUnits, 0);

  // Scenario A: Attend all upcoming classes
  const aFutureUnits =
    horizon === 'immediate' ? totalRemainingSemesterUnits : horizonTotalUnits;
  const scenarioA = evaluateScenarioOutcome({
    id: 'A',
    label: 'Scenario A: Attend All Upcoming',
    description:
      aFutureUnits > 0
        ? `Attend all ${aFutureUnits} scheduled upcoming unit(s)`
        : 'No upcoming scheduled classes in window',
    baseAttended,
    baseConducted,
    futureAttended: aFutureUnits,
    futureConducted: aFutureUnits,
    totalRemainingSemesterUnits,
    minimumThreshold,
  });

  // Scenario B: Miss selected/scheduled classes on singleDate
  const bMissedUnits =
    singleDateMissedUnits > 0 ? singleDateMissedUnits : safeExtra;
  const bOtherUnits =
    horizon === 'immediate'
      ? 0
      : Math.max(0, horizonTotalUnits - singleDateMissedUnits);
  const bOtherAttended = Math.round(bOtherUnits * safeRate);
  const scenarioB = evaluateScenarioOutcome({
    id: 'B',
    label: `Scenario B: Miss ${singleDate || 'Selected Date'}`,
    description:
      singleDateMissedUnits > 0
        ? `Miss ${bMissedUnits} unit(s) on ${singleDate}; attend ${Math.round(safeRate * 100)}% of other classes`
        : `Miss ${bMissedUnits} unit(s); attend ${Math.round(safeRate * 100)}% of remaining classes`,
    baseAttended,
    baseConducted,
    futureAttended: bOtherAttended,
    futureConducted: bMissedUnits + bOtherUnits,
    totalRemainingSemesterUnits,
    minimumThreshold,
  });

  // Scenario C: Miss multiple selected classes across different days (+ extraMissedUnits)
  const cMissedUnits = selectedUnits + safeExtra;
  const cOtherUnits =
    horizon === 'immediate'
      ? 0
      : Math.max(0, horizonTotalUnits - selectedUnits);
  const cOtherAttended = Math.round(cOtherUnits * safeRate);
  const scenarioC = evaluateScenarioOutcome({
    id: 'C',
    label: 'Scenario C: Multi-Day Absences',
    description: `Miss ${cMissedUnits} unit(s) across selected days; attend ${Math.round(safeRate * 100)}% of remaining classes`,
    baseAttended,
    baseConducted,
    futureAttended: cOtherAttended,
    futureConducted: cMissedUnits + cOtherUnits,
    totalRemainingSemesterUnits,
    minimumThreshold,
  });

  return {
    primary: scenarioC,
    scenarios: {
      A: scenarioA,
      B: scenarioB,
      C: scenarioC,
    },
  };
}

/**
 * Pure Bunk Simulator calculation engine.
 * Never mutates persisted attendance records.
 */
export function simulateBunkScenario(
  input: BunkSimulationInput,
): BunkSimulationResult {
  const {
    report,
    focusSubjectId,
    singleDate,
    selectedSessionKeys,
    extraMissedUnits,
    otherUpcomingAttendRate,
    horizon,
  } = input;

  const minimumThreshold = report.semester.minimumAttendance;
  const cutoffDate = getHorizonCutoffDate(
    report.asOfDate,
    report.semester.endDate,
    horizon,
  );

  const allUpcoming = report.upcomingSessions;
  const horizonAllSessions =
    horizon === 'immediate'
      ? allUpcoming
      : allUpcoming.filter((s) => s.date <= cutoffDate);

  const selectedKeySet = new Set(selectedSessionKeys);

  const overallScope = buildScopeScenarios({
    baseAttended: report.overall.attended,
    baseConducted: report.overall.conducted,
    totalRemainingSemesterUnits: report.overall.remainingScheduledUnits,
    minimumThreshold,
    horizonSessions: horizonAllSessions,
    selectedKeySet,
    singleDate,
    extraMissedUnits,
    otherUpcomingAttendRate,
    horizon,
  });

  if (focusSubjectId === 'all') {
    const selected = horizonAllSessions.filter((s) =>
      selectedKeySet.has(getSessionKey(s)),
    );
    const singleDay = horizonAllSessions.filter((s) => s.date === singleDate);

    return {
      scopeLabel: 'Overall Semester',
      horizonSessionsCount: horizonAllSessions.length,
      horizonUnitsTotal: horizonAllSessions.reduce(
        (sum, s) => sum + s.attendanceUnits,
        0,
      ),
      selectedSessionsCount: selected.length,
      selectedUnitsTotal:
        selected.reduce((sum, s) => sum + s.attendanceUnits, 0) +
        Math.max(0, Math.floor(extraMissedUnits)),
      singleDateSessionsCount: singleDay.length,
      singleDateUnitsTotal: singleDay.reduce(
        (sum, s) => sum + s.attendanceUnits,
        0,
      ),
      primary: overallScope.primary,
      overall: overallScope.primary,
      scenarios: overallScope.scenarios,
      overallScenarios: overallScope.scenarios,
    };
  }

  const subjectSummary = report.subjectSummaries.find(
    (s) => s.subject.id === focusSubjectId,
  );

  if (!subjectSummary) {
    return {
      scopeLabel: 'Overall Semester',
      horizonSessionsCount: horizonAllSessions.length,
      horizonUnitsTotal: horizonAllSessions.reduce(
        (sum, s) => sum + s.attendanceUnits,
        0,
      ),
      selectedSessionsCount: 0,
      selectedUnitsTotal: Math.max(0, Math.floor(extraMissedUnits)),
      singleDateSessionsCount: 0,
      singleDateUnitsTotal: 0,
      primary: overallScope.primary,
      overall: overallScope.primary,
      scenarios: overallScope.scenarios,
      overallScenarios: overallScope.scenarios,
    };
  }

  const subjectHorizonSessions = horizonAllSessions.filter(
    (s) => s.subjectId === focusSubjectId,
  );
  const subjectScope = buildScopeScenarios({
    baseAttended: subjectSummary.attended,
    baseConducted: subjectSummary.conducted,
    totalRemainingSemesterUnits: subjectSummary.remainingScheduledUnits,
    minimumThreshold,
    horizonSessions: subjectHorizonSessions,
    selectedKeySet,
    singleDate,
    extraMissedUnits,
    otherUpcomingAttendRate,
    horizon,
  });

  const selectedForSubject = subjectHorizonSessions.filter((s) =>
    selectedKeySet.has(getSessionKey(s)),
  );
  const singleDayForSubject = subjectHorizonSessions.filter(
    (s) => s.date === singleDate,
  );

  return {
    scopeLabel: `${subjectSummary.subject.name} (${subjectSummary.subject.code})`,
    horizonSessionsCount: subjectHorizonSessions.length,
    horizonUnitsTotal: subjectHorizonSessions.reduce(
      (sum, s) => sum + s.attendanceUnits,
      0,
    ),
    selectedSessionsCount: selectedForSubject.length,
    selectedUnitsTotal:
      selectedForSubject.reduce((sum, s) => sum + s.attendanceUnits, 0) +
      Math.max(0, Math.floor(extraMissedUnits)),
    singleDateSessionsCount: singleDayForSubject.length,
    singleDateUnitsTotal: singleDayForSubject.reduce(
      (sum, s) => sum + s.attendanceUnits,
      0,
    ),
    primary: subjectScope.primary,
    overall: overallScope.primary,
    scenarios: subjectScope.scenarios,
    overallScenarios: overallScope.scenarios,
  };
}
