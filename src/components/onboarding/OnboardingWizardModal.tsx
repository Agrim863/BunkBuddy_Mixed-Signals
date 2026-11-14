import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { semesterSetupSchema } from '../../schemas/semester.schema';
import { historicalInitializationSchema } from '../../schemas/attendance.schema';
import { Button, useToast } from '../ui';
import { Step1SemesterMode } from './Step1SemesterMode';
import { Step2SemesterDetails } from './Step2SemesterDetails';
import { Step3AcademicCalendar } from './Step3AcademicCalendar';
import { Step4TimetableSetup } from './Step4TimetableSetup';
import { Step5AttendanceInit } from './Step5AttendanceInit';
import { createInitialOnboardingDraft, type OnboardingDraft } from './types';

const STEPS = [
  { step: 1, title: 'Semester Mode' },
  { step: 2, title: 'Details' },
  { step: 3, title: 'Calendar' },
  { step: 4, title: 'Timetable' },
  { step: 5, title: 'Attendance Init' },
] as const;

export function OnboardingWizardModal() {
  const { onboardingOpen, closeOnboarding, completeOnboarding } = useWorkspace();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(createInitialOnboardingDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState(onboardingOpen);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (onboardingOpen) {
      setRendered(true);
      setClosing(false);
      setCurrentStep(1);
      setDraft(createInitialOnboardingDraft());
      setErrors({});
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [onboardingOpen, rendered]);

  useEffect(() => {
    if (!onboardingOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOnboarding();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onboardingOpen, closeOnboarding]);

  if (!rendered) return null;

  const updateDraft = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const validateCurrentStep = (): boolean => {
    setErrors({});
    if (currentStep === 2) {
      const tracking =
        draft.mode === 'fresh' ? draft.startDate : draft.trackingStartDate;
      const parsed = semesterSetupSchema.safeParse({
        mode: draft.mode,
        name: draft.name,
        institutionName: draft.institutionName || undefined,
        startDate: draft.startDate,
        endDate: draft.endDate,
        trackingStartDate: tracking,
        minimumAttendancePercent: draft.minimumAttendancePercent,
      });

      if (!parsed.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          nextErrors[String(issue.path[0] ?? 'form')] = issue.message;
        }
        setErrors(nextErrors);
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      if (draft.subjects.length === 0) {
        setErrors({
          timetable: 'Add at least one subject before continuing to attendance initialization.',
        });
        return false;
      }
      return true;
    }

    if (currentStep === 5 && draft.mode === 'ongoing') {
      const parsed = historicalInitializationSchema.safeParse({
        trackingStartDate: draft.trackingStartDate,
        subjectTotals: draft.subjects.map((s) => ({
          subjectId: s.tempId,
          conducted: s.historicalConducted,
          attended: s.historicalAttended,
        })),
      });

      if (!parsed.success) {
        const nextErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          nextErrors[String(issue.path[0] ?? 'attendance')] = issue.message;
        }
        setErrors(nextErrors);
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinish = async () => {
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    try {
      const res = await completeOnboarding({
        semester: {
          name: draft.name.trim(),
          institutionName: draft.institutionName.trim() || undefined,
          mode: draft.mode,
          startDate: draft.startDate,
          endDate: draft.endDate,
          trackingStartDate:
            draft.mode === 'fresh' ? draft.startDate : draft.trackingStartDate,
          minimumAttendance: draft.minimumAttendancePercent / 100,
        },
        subjects: draft.subjects,
        timetableEntries: draft.timetableEntries,
        calendarEvents: draft.calendarEvents.map((ev) => ({
          date: ev.date,
          endDate: ev.endDate,
          eventType: ev.eventType,
          title: ev.title,
          description: ev.description,
          affectsClasses: ev.affectsClasses,
        })),
        historicalLogs: draft.historicalLogs.map((log) => ({
          subjectTempId: log.subjectTempId,
          timetableEntryId: null,
          date: log.date,
          status: log.status,
          attendanceUnits: log.attendanceUnits,
          source: 'historical_log',
          notes: log.notes,
        })),
      });
      if (!res.ok) {
        setErrors({ timetable: res.error });
      } else {
        showToast({
          tone: 'success',
          title: 'Semester initialized',
          description: `${res.data.name} is now active.`,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm ${
        closing ? 'bw-animate-backdrop-out pointer-events-none' : 'bw-animate-backdrop-in'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Semester Onboarding Wizard"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closing) closeOnboarding();
      }}
    >
      <div
        className={`flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xl ${
          closing ? 'bw-animate-modal-out' : 'bw-animate-modal-in'
        }`}
      >
        {/* Header & Stepper */}
        <div className="border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                BunkWise Semester Onboarding
              </h2>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Step {currentStep} of 5 — {STEPS[currentStep - 1]?.title}
              </p>
            </div>
            <button
              type="button"
              onClick={closeOnboarding}
              aria-label="Close onboarding wizard"
              className="rounded-[8px] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {STEPS.map((item) => {
              const isDone = currentStep > item.step;
              const isActive = currentStep === item.step;
              return (
                <div key={item.step} className="space-y-1">
                  <div
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      isDone
                        ? 'bg-[var(--status-success)]'
                        : isActive
                          ? 'bg-[var(--primary)]'
                          : 'bg-[var(--border-subtle)]'
                    }`}
                  />
                  <p
                    className={`hidden text-[11px] font-medium sm:block ${
                      isActive
                        ? 'font-bold text-[var(--primary)]'
                        : isDone
                          ? 'text-[var(--status-success)]'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {item.step}. {item.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errors.timetable && (
            <div className="mb-4 rounded-[10px] border border-[var(--status-danger)]/35 bg-[var(--status-danger)]/10 px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger)]">
              {errors.timetable}
            </div>
          )}

          {currentStep === 1 && (
            <Step1SemesterMode
              mode={draft.mode}
              onChangeMode={(mode) =>
                updateDraft({
                  mode,
                  trackingStartDate:
                    mode === 'fresh' ? draft.startDate : draft.trackingStartDate,
                })
              }
            />
          )}
          {currentStep === 2 && (
            <Step2SemesterDetails
              draft={draft}
              errors={errors}
              onChange={updateDraft}
            />
          )}
          {currentStep === 3 && (
            <Step3AcademicCalendar draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 4 && (
            <Step4TimetableSetup draft={draft} onChange={updateDraft} />
          )}
          {currentStep === 5 && (
            <Step5AttendanceInit
              draft={draft}
              errors={errors}
              onChange={updateDraft}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-6 py-3.5">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? closeOnboarding : handleBack}
            leftIcon={currentStep > 1 ? <ArrowLeft className="h-4 w-4" /> : undefined}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => void handleFinish()}
              isLoading={submitting}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Complete Semester Setup
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
