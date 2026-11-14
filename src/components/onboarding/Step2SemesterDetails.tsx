import type { OnboardingDraft } from './types';
import { Input } from '../ui';

interface Step2SemesterDetailsProps {
  draft: OnboardingDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<OnboardingDraft>) => void;
}

export function Step2SemesterDetails({
  draft,
  errors,
  onChange,
}: Step2SemesterDetailsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">Semester Details</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configure semester boundaries and your institution&apos;s minimum attendance requirement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Semester Name / Number *"
          placeholder="e.g., Semester 5 — Fall 2026"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          error={errors.name}
        />

        <Input
          label="Institution Name (Optional)"
          placeholder="e.g., National Institute of Technology"
          value={draft.institutionName}
          onChange={(e) => onChange({ institutionName: e.target.value })}
          error={errors.institutionName}
        />

        <Input
          label="Semester Start Date *"
          type="date"
          value={draft.startDate}
          onChange={(e) => {
            const nextStart = e.target.value;
            const patch: Partial<OnboardingDraft> = { startDate: nextStart };
            if (draft.mode === 'fresh' || draft.trackingStartDate < nextStart) {
              patch.trackingStartDate = nextStart;
            }
            onChange(patch);
          }}
          error={errors.startDate}
        />

        <Input
          label="Semester End Date *"
          type="date"
          value={draft.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
          error={errors.endDate}
        />
      </div>

      <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <label
              htmlFor="min-attendance-threshold"
              className="text-sm font-semibold text-[var(--text-main)]"
            >
              Minimum Attendance Requirement (%)
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              Used across recovery calculators, warnings, and bunk margin simulations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="min-attendance-threshold"
              type="number"
              min={1}
              max={99}
              step={1}
              value={draft.minimumAttendancePercent}
              onChange={(e) =>
                onChange({ minimumAttendancePercent: Number(e.target.value) })
              }
              className="w-20 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-center font-mono text-sm font-bold tabular-nums text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
            />
            <span className="font-mono text-sm font-semibold text-[var(--text-secondary)]">%</span>
          </div>
        </div>

        <input
          type="range"
          min={50}
          max={95}
          step={1}
          value={Math.min(95, Math.max(50, draft.minimumAttendancePercent || 75))}
          onChange={(e) =>
            onChange({ minimumAttendancePercent: Number(e.target.value) })
          }
          className="mt-3 w-full accent-[var(--primary)]"
        />

        {errors.minimumAttendancePercent && (
          <p className="mt-1.5 text-xs font-semibold text-[var(--status-danger)]">
            {errors.minimumAttendancePercent}
          </p>
        )}
      </div>
    </div>
  );
}
