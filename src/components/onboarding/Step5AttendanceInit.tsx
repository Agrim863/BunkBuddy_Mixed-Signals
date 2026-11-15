import { Input, StatusBanner } from '../ui';
import type { OnboardingDraft } from './types';

interface Step5AttendanceInitProps {
  draft: OnboardingDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<OnboardingDraft>) => void;
}

export function Step5AttendanceInit({
  draft,
  errors,
  onChange,
}: Step5AttendanceInitProps) {
  const updateSubjectTotals = (
    tempId: string,
    field: 'historicalConducted' | 'historicalAttended',
    value: number,
  ) => {
    const cleanVal = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    onChange({
      subjects: draft.subjects.map((sub) =>
        sub.tempId === tempId ? { ...sub, [field]: cleanVal } : sub,
      ),
    });
  };

  if (draft.mode === 'fresh') {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-main)]">
            Attendance Initialization — Fresh Semester
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Your subjects will start with zero conducted and zero attended classes.
          </p>
        </div>

        <StatusBanner
          tone="success"
          title="Zero Baseline Ready"
          description={`Predictions will start from your first scheduled session on or after ${draft.startDate}.`}
        />

        <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Initialized Subjects ({draft.subjects.length})
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {draft.subjects.map((sub) => (
              <div
                key={sub.tempId}
                className="flex items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="truncate font-semibold text-[var(--text-main)]">
                    {sub.name} ({sub.code})
                  </span>
                </div>
                <span className="font-mono font-medium tabular-nums text-[var(--text-secondary)]">0 / 0 (N/A)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">
          Attendance Initialization — Ongoing Semester
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Enter your existing conducted &amp; attended counts up to yesterday, and set your current tracking start date.
        </p>
      </div>

      <StatusBanner
        tone="info"
        title="No Double-Counting Guarantee"
        description="Scheduled timetable sessions before your Current Tracking Date are excluded from future predictions so your historical totals are never counted twice."
      />

      <div className="max-w-xs">
        <Input
          label="Current Tracking Date *"
          type="date"
          min={draft.startDate}
          max={draft.endDate}
          value={draft.trackingStartDate}
          onChange={(e) => onChange({ trackingStartDate: e.target.value })}
          hint="Live daily tracking & predictions start from this date"
          error={errors.trackingStartDate}
        />
      </div>

      {errors.subjectTotals && (
        <p className="text-xs font-semibold text-[var(--status-danger)]">{errors.subjectTotals}</p>
      )}

      {/* Per-subject historical conducted / attended table */}
      <div className="overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-well)] font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Subject</th>
              <th className="px-4 py-2.5 font-semibold">Conducted Units</th>
              <th className="px-4 py-2.5 font-semibold">Attended Units</th>
              <th className="px-4 py-2.5 font-semibold">Current %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {draft.subjects.map((sub) => {
              const invalid = sub.historicalAttended > sub.historicalConducted;
              const pct =
                sub.historicalConducted === 0
                  ? 'N/A'
                  : `${((sub.historicalAttended / sub.historicalConducted) * 100).toFixed(1)}%`;

              return (
                <tr key={sub.tempId} className={invalid ? 'bg-[var(--status-danger)]/10' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      />
                      <span className="font-semibold text-[var(--text-main)]">
                        {sub.name} ({sub.code})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={sub.historicalConducted}
                      onChange={(e) =>
                        updateSubjectTotals(
                          sub.tempId,
                          'historicalConducted',
                          Number(e.target.value),
                        )
                      }
                      className="w-24 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={sub.historicalAttended}
                      onChange={(e) =>
                        updateSubjectTotals(
                          sub.tempId,
                          'historicalAttended',
                          Number(e.target.value),
                        )
                      }
                      className={`w-24 rounded-[8px] border bg-[var(--bg-surface-well)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[var(--text-main)] focus:outline-none ${
                        invalid ? 'border-[var(--status-danger)]' : 'border-[var(--border-subtle)] focus:border-[var(--primary)]'
                      }`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold tabular-nums text-[var(--text-main)]">
                    {pct}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
