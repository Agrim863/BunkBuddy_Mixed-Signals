export type AttendanceHealthStatus = 'no_data' | 'safe' | 'borderline' | 'danger';

const EPS = 1e-9;

/**
 * Computes current attendance percentage P = (A / C) * 100.
 * Returns null when C <= 0 so callers display "N/A".
 */
export function calculatePercentage(attended: number, conducted: number): number | null {
  if (conducted <= 0) return null;
  const safeAttended = Math.min(conducted, Math.max(0, attended));
  return (safeAttended * 100) / conducted;
}

/**
 * Formats an attendance percentage or returns "N/A" when conducted is 0.
 */
export function formatPercentage(
  percentage: number | null,
  decimals = 1,
): string {
  if (percentage === null || !Number.isFinite(percentage)) return 'N/A';
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Computes future attendance percentage:
 * P_future = ((A + F_attended) / (C + F_conducted)) * 100
 */
export function calculateFuturePercentage(
  attended: number,
  conducted: number,
  futureAttended: number,
  futureConducted: number,
): number | null {
  const totalConducted = conducted + futureConducted;
  if (totalConducted <= 0) return null;
  const totalAttended = Math.min(totalConducted, Math.max(0, attended + futureAttended));
  return (totalAttended * 100) / totalConducted;
}

/**
 * Computes percentage-point difference (toPct - fromPct).
 * Returns null when either percentage is unavailable.
 */
export function calculatePercentagePointDelta(
  fromPct: number | null,
  toPct: number | null,
): number | null {
  if (fromPct === null || toPct === null) return null;
  return toPct - fromPct;
}

/**
 * Formats percentage-point delta with explicit sign and "pp" suffix (e.g., "+2.4 pp", "-1.8 pp").
 */
export function formatPercentagePointDelta(
  delta: number | null,
  decimals = 2,
): string {
  if (delta === null || !Number.isFinite(delta)) return 'N/A';
  const rounded = Math.abs(delta) < 1e-6 ? 0 : delta;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimals)} pp`;
}

/**
 * Calculates minimum consecutive attendance units needed to reach minimum threshold M (decimal, e.g., 0.75):
 * x = ceil((M * C - A) / (1 - M))
 * Returns 0 when already at/above threshold or when C === 0.
 * Returns null when M >= 1 and A < C (mathematically unreachable).
 */
export function calculateRecoveryClasses(
  attended: number,
  conducted: number,
  minimumThreshold: number,
): number | null {
  if (conducted <= 0) return 0;
  if (minimumThreshold <= 0) return 0;

  const ratio = attended / conducted;
  if (ratio >= minimumThreshold - EPS) {
    return 0;
  }

  if (minimumThreshold >= 1) {
    return null;
  }

  const raw = (minimumThreshold * conducted - attended - EPS) / (1 - minimumThreshold);
  return Math.max(1, Math.ceil(raw));
}

/**
 * Calculates maximum consecutive future attendance units a student can miss right now
 * while keeping A / (C + y) >= M.
 */
export function calculateImmediateSafeBunks(
  attended: number,
  conducted: number,
  minimumThreshold: number,
): number {
  if (conducted <= 0 || minimumThreshold <= 0) return 0;
  if (attended / conducted < minimumThreshold - EPS) return 0;

  const maxSkip = Math.floor(
    (attended - minimumThreshold * conducted) / minimumThreshold + EPS,
  );
  return Math.max(0, maxSkip);
}

/**
 * Calculates maximum future attendance units that can be missed out of remainingFutureConducted
 * while still finishing the semester at or above threshold M:
 * (A + remainingFutureConducted - k) / (C + remainingFutureConducted) >= M
 */
export function calculateSemesterAbsenceBudget(
  attended: number,
  conducted: number,
  remainingFutureConducted: number,
  minimumThreshold: number,
): number {
  if (remainingFutureConducted <= 0) return 0;
  const finalConducted = conducted + remainingFutureConducted;
  if (finalConducted <= 0) return 0;

  const maxAttendedPossible = attended + remainingFutureConducted;
  const minRequiredAttended = minimumThreshold * finalConducted;

  if (maxAttendedPossible < minRequiredAttended - EPS) {
    return 0;
  }

  const budget = Math.floor(maxAttendedPossible - minRequiredAttended + EPS);
  return Math.max(0, Math.min(remainingFutureConducted, budget));
}

/**
 * Classifies attendance status against decimal threshold M (e.g., 0.75).
 * Borderline is within +5.0 percentage points above the required threshold.
 */
export function classifyAttendanceStatus(
  percentage: number | null,
  minimumThreshold: number,
  borderlineBufferPoints = 5,
): AttendanceHealthStatus {
  if (percentage === null) return 'no_data';
  const thresholdPct = minimumThreshold * 100;
  if (percentage < thresholdPct - 1e-6) return 'danger';
  if (percentage < thresholdPct + borderlineBufferPoints - 1e-6) return 'borderline';
  return 'safe';
}
