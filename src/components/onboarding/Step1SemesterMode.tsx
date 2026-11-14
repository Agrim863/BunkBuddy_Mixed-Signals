import { CalendarCheck2, History } from 'lucide-react';
import type { SemesterMode } from '../../types/domain';
import { Badge } from '../ui';

interface Step1SemesterModeProps {
  mode: SemesterMode;
  onChangeMode: (mode: SemesterMode) => void;
}

export function Step1SemesterMode({ mode, onChangeMode }: Step1SemesterModeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">
          How are you starting this semester?
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Both modes use the same underlying calculation engine and timetable model.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChangeMode('fresh')}
          className={`flex flex-col items-start rounded-[14px] border p-5 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${
            mode === 'fresh'
              ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/25'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--primary)]/30 bg-[var(--primary)]/15 text-[var(--primary)]">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
            <Badge variant={mode === 'fresh' ? 'primary' : 'neutral'}>Zero Baseline</Badge>
          </div>
          <h4 className="mt-4 text-sm font-semibold text-[var(--text-main)]">Fresh Semester</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Starting a brand-new semester. Attendance initializes at 0/0 for all subjects and predictions run from the first scheduled class.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('ongoing')}
          className={`flex flex-col items-start rounded-[14px] border p-5 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 ${
            mode === 'ongoing'
              ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/25'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--secondary)]/40 bg-[var(--secondary)]/20 text-[var(--text-main)]">
              <History className="h-5 w-5" />
            </span>
            <Badge variant={mode === 'ongoing' ? 'secondary' : 'neutral'}>Mid-Semester</Badge>
          </div>
          <h4 className="mt-4 text-sm font-semibold text-[var(--text-main)]">Ongoing Semester</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            Joining mid-semester with existing attendance counts. Enter historical conducted/attended totals and continue tracking from today onward without double-counting.
          </p>
        </button>
      </div>
    </div>
  );
}
