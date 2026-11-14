import { useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import {
  calendarEventSchema,
  defaultAffectsClassesForEvent,
} from '../../schemas/calendar.schema';
import type { CalendarEventType } from '../../types/domain';
import {
  CalendarImportReview,
  EVENT_TYPE_LABELS,
} from '../calendar/CalendarImportReview';
import { Badge, Button, Input, Select } from '../ui';
import type { DraftCalendarEvent, OnboardingDraft } from './types';

const STEP3_CATEGORIES: CalendarEventType[] = [
  'official_holiday',
  'semester_break',
  'examination',
  'college_event',
  'non_teaching_day',
];

interface Step3AcademicCalendarProps {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
}

export function Step3AcademicCalendar({ draft, onChange }: Step3AcademicCalendarProps) {
  const [date, setDate] = useState(draft.startDate);
  const [endDate, setEndDate] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('official_holiday');
  const [title, setTitle] = useState('');
  const [affectsClasses, setAffectsClasses] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const handleManualAdd = () => {
    setFormError(null);
    const parsed = calendarEventSchema.safeParse({
      date,
      endDate: endDate || undefined,
      eventType,
      title,
      affectsClasses,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid calendar entry');
      return;
    }

    const nextEvent: DraftCalendarEvent = {
      tempId: `cal-${crypto.randomUUID()}`,
      date: parsed.data.date,
      endDate: parsed.data.endDate || undefined,
      eventType: parsed.data.eventType,
      title: parsed.data.title,
      affectsClasses: parsed.data.affectsClasses,
    };

    onChange({
      calendarEvents: [...draft.calendarEvents, nextEvent].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    });

    setTitle('');
    setEndDate('');
  };

  const handleConfirmedImport = (
    events: Array<{
      date: string;
      endDate?: string;
      eventType: CalendarEventType;
      title: string;
      description?: string;
      affectsClasses: boolean;
    }>,
  ) => {
    const newItems: DraftCalendarEvent[] = events.map((ev) => ({
      tempId: `cal-${crypto.randomUUID()}`,
      ...ev,
    }));
    onChange({
      calendarEvents: [...draft.calendarEvents, ...newItems].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    });
  };

  const removeEvent = (tempId: string) => {
    onChange({
      calendarEvents: draft.calendarEvents.filter((ev) => ev.tempId !== tempId),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">Academic Calendar</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Add holidays, semester breaks, exams, college events, or non-teaching days manually or via PDF/Excel/CSV upload.
        </p>
      </div>

      {/* File upload + review workflow */}
      <CalendarImportReview onConfirmImport={handleConfirmedImport} />

      {/* Manual Holiday / Event Entry */}
      <div className="space-y-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">Manual Holiday / Event Entry</h4>

        {formError && (
          <p className="text-xs font-semibold text-[var(--status-danger)]">{formError}</p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Start Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Select
            label="Category"
            value={eventType}
            onChange={(e) => {
              const next = e.target.value as CalendarEventType;
              setEventType(next);
              setAffectsClasses(defaultAffectsClassesForEvent(next));
            }}
          >
            {STEP3_CATEGORIES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Input
            label="Title"
            placeholder="e.g., Independence Day"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={affectsClasses}
              onChange={(e) => setAffectsClasses(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--primary)]"
            />
            <span>No classes conducted on this date/range</span>
          </label>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<CalendarPlus className="h-3.5 w-3.5" />}
            onClick={handleManualAdd}
          >
            Add Calendar Event
          </Button>
        </div>
      </div>

      {/* Staged Calendar Events */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Staged Calendar Events ({draft.calendarEvents.length})
          </span>
        </div>

        {draft.calendarEvents.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-5 text-center text-xs text-[var(--text-secondary)]">
            No calendar events added yet. You can add them now or manage them later in Academic Calendar.
          </div>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {draft.calendarEvents.map((ev) => (
              <div
                key={ev.tempId}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold tabular-nums text-[var(--text-main)]">
                      {ev.date}
                      {ev.endDate ? ` → ${ev.endDate}` : ''}
                    </span>
                    <Badge variant={ev.affectsClasses ? 'warning' : 'neutral'}>
                      {EVENT_TYPE_LABELS[ev.eventType]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[var(--text-secondary)]">{ev.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEvent(ev.tempId)}
                  aria-label={`Remove ${ev.title}`}
                  className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
