import { localDateISO } from '../../utils/localDate';
import { useEffect, useState, type FormEvent } from 'react';
import {
  calendarEventSchema,
  calendarEventTypes,
  defaultAffectsClassesForEvent,
} from '../../schemas/calendar.schema';
import type { RepoResult } from '../../services/data';
import type { CalendarEvent, CalendarEventType } from '../../types/domain';
import { EVENT_TYPE_LABELS } from './CalendarImportReview';
import { Button, Input, Modal, Select, StatusBanner } from '../ui';

interface CalendarEventModalProps {
  open: boolean;
  onClose: () => void;
  initialEvent?: CalendarEvent | null;
  defaultDate?: string;
  onSave: (
    input: Omit<CalendarEvent, 'id' | 'semesterId'>,
  ) => Promise<RepoResult<CalendarEvent>>;
}

export function CalendarEventModal({
  open,
  onClose,
  initialEvent,
  defaultDate,
  onSave,
}: CalendarEventModalProps) {
  const todayIso = localDateISO();
  const [date, setDate] = useState(defaultDate ?? todayIso);
  const [endDate, setEndDate] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('official_holiday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [affectsClasses, setAffectsClasses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSaving(false);
    if (initialEvent) {
      setDate(initialEvent.date);
      setEndDate(initialEvent.endDate ?? '');
      setEventType(initialEvent.eventType);
      setTitle(initialEvent.title);
      setDescription(initialEvent.description ?? '');
      setAffectsClasses(initialEvent.affectsClasses);
    } else {
      setDate(defaultDate ?? todayIso);
      setEndDate('');
      setEventType('official_holiday');
      setTitle('');
      setDescription('');
      setAffectsClasses(true);
    }
  }, [open, initialEvent, defaultDate, todayIso]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = calendarEventSchema.safeParse({
      date,
      endDate: endDate || undefined,
      eventType,
      title,
      description: description.trim() || undefined,
      affectsClasses,
    });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? 'Invalid event details');
      return;
    }

    setSaving(true);
    try {
      const res = await onSave({
        date: parsed.data.date,
        endDate: parsed.data.endDate || undefined,
        eventType: parsed.data.eventType,
        title: parsed.data.title,
        description: parsed.data.description,
        affectsClasses: parsed.data.affectsClasses,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialEvent ? 'Edit Calendar Event' : 'Create Calendar Event'}
      description="Add official holidays, breaks, exams, cancelled classes, or college events."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {errorMsg && (
          <StatusBanner tone="danger" title="Validation Error" description={errorMsg} />
        )}

        <Input
          label="Event Title *"
          placeholder="e.g., Republic Day Holiday"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Start Date *"
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
        </div>

        <Select
          label="Category"
          value={eventType}
          onChange={(e) => {
            const next = e.target.value as CalendarEventType;
            setEventType(next);
            setAffectsClasses(defaultAffectsClassesForEvent(next));
          }}
        >
          {calendarEventTypes.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Input
          label="Description (Optional)"
          placeholder="Additional details or campus notice"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-well)] px-3.5 py-2.5 text-xs text-[var(--text-main)] transition-colors hover:border-[var(--border-strong)]">
          <input
            type="checkbox"
            checked={affectsClasses}
            onChange={(e) => setAffectsClasses(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--bg-card)] accent-[var(--accent-primary)]"
          />
          <span className="text-[var(--text-muted)]">
            Suspend scheduled classes on this date (excluded from conducted predictions)
          </span>
        </label>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {initialEvent ? 'Save Event' : 'Create Event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
