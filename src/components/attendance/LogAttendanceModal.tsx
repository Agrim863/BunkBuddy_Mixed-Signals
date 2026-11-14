import { localDateISO } from '../../utils/localDate';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseISO } from 'date-fns';
import { attendanceRecordSchema } from '../../schemas/attendance.schema';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Semester,
  Subject,
  TimetableEntry,
} from '../../types/domain';
import type { RepoResult } from '../../services/data';
import { Button, Input, Modal, Select, StatusBanner } from '../ui';

interface LogAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  semester: Semester;
  subjects: Subject[];
  timetableEntries: TimetableEntry[];
  initialRecord?: AttendanceRecord | null;
  defaultDate?: string;
  onSave: (
    input: Omit<AttendanceRecord, 'id' | 'semesterId'>,
  ) => Promise<RepoResult<AttendanceRecord>>;
}

export function LogAttendanceModal({
  open,
  onClose,
  semester,
  subjects,
  timetableEntries,
  initialRecord,
  defaultDate,
  onSave,
}: LogAttendanceModalProps) {
  const todayIso = localDateISO();
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(defaultDate ?? todayIso);
  const [timetableEntryId, setTimetableEntryId] = useState<string>('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [attendanceUnits, setAttendanceUnits] = useState(1);
  const [source, setSource] = useState<'tracked' | 'historical_log'>('tracked');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSaving(false);
    if (initialRecord) {
      setSubjectId(initialRecord.subjectId);
      setDate(initialRecord.date);
      setTimetableEntryId(initialRecord.timetableEntryId ?? '');
      setStatus(initialRecord.status);
      setAttendanceUnits(initialRecord.attendanceUnits);
      setSource(initialRecord.source);
      setNotes(initialRecord.notes ?? '');
    } else {
      const targetDate = defaultDate ?? todayIso;
      setSubjectId(subjects[0]?.id ?? '');
      setDate(targetDate);
      setTimetableEntryId('');
      setStatus('present');
      setAttendanceUnits(1);
      setSource(
        semester.mode === 'ongoing' && targetDate < semester.trackingStartDate
          ? 'historical_log'
          : 'tracked',
      );
      setNotes('');
    }
  }, [open, initialRecord, subjects, defaultDate, todayIso, semester]);

  const matchingSlots = useMemo(() => {
    if (!date || !subjectId) return [];
    const parsed = parseISO(date);
    if (Number.isNaN(parsed.getTime())) return [];
    const weekday = parsed.getDay();
    return timetableEntries.filter(
      (t) => t.subjectId === subjectId && t.weekday === weekday,
    );
  }, [date, subjectId, timetableEntries]);

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    setTimetableEntryId('');
    if (!initialRecord && semester.mode === 'ongoing') {
      setSource(
        nextDate < semester.trackingStartDate ? 'historical_log' : 'tracked',
      );
    }
  };

  const handleSlotChange = (slotId: string) => {
    setTimetableEntryId(slotId);
    const slot = timetableEntries.find((t) => t.id === slotId);
    if (slot) {
      setAttendanceUnits(slot.attendanceUnits);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = attendanceRecordSchema.safeParse({
      subjectId,
      timetableEntryId: timetableEntryId || null,
      date,
      status,
      attendanceUnits,
      source,
      notes: notes.trim() || undefined,
    });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? 'Invalid attendance record');
      return;
    }

    if (
      parsed.data.source === 'historical_log' &&
      parsed.data.date >= semester.trackingStartDate
    ) {
      setErrorMsg(
        `Historical audit logs must precede tracking start date (${semester.trackingStartDate}). Use "Tracked" for dates from ${semester.trackingStartDate} onward.`,
      );
      return;
    }

    if (
      parsed.data.source === 'tracked' &&
      parsed.data.date < semester.trackingStartDate
    ) {
      setErrorMsg(
        `Dates before ${semester.trackingStartDate} belong to your pre-tracking baseline. Choose "Historical Log (Audit Only)" or update the subject's historical baseline to avoid double-counting.`,
      );
      return;
    }

    setSaving(true);
    try {
      const res = await onSave({
        subjectId: parsed.data.subjectId,
        timetableEntryId: parsed.data.timetableEntryId ?? null,
        date: parsed.data.date,
        status: parsed.data.status,
        attendanceUnits: parsed.data.attendanceUnits,
        source: parsed.data.source,
        notes: parsed.data.notes,
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
      title={initialRecord ? 'Update Attendance Record' : 'Log Attendance'}
      description="Record present, absent, mass bunk, cancelled, or holiday status with accurate attendance units."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {errorMsg && (
          <StatusBanner tone="danger" title="Validation Error" description={errorMsg} />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setTimetableEntryId('');
            }}
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} ({sub.code})
              </option>
            ))}
          </Select>

          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Timetable Slot (Optional)"
            value={timetableEntryId}
            onChange={(e) => handleSlotChange(e.target.value)}
          >
            <option value="">Ad-hoc / Extra / Unlinked Session</option>
            {matchingSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.startTime}–{slot.endTime} ({slot.sessionType},{' '}
                {slot.attendanceUnits}u)
              </option>
            ))}
          </Select>

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
          >
            <option value="present">Present (Attended + Conducted)</option>
            <option value="absent">Absent (Missed + Conducted)</option>
            <option value="mass_bunk">Mass Bunk (Counts as Conducted Absence)</option>
            <option value="cancelled">Cancelled Lecture (Not Conducted)</option>
            <option value="holiday">Holiday (Not Conducted)</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Attendance Units"
            type="number"
            min={1}
            max={12}
            value={attendanceUnits}
            onChange={(e) => setAttendanceUnits(Number(e.target.value))}
            hint="Matches your institution's attendance weight for this session"
          />

          <Select
            label="Record Type"
            value={source}
            disabled={Boolean(initialRecord)}
            onChange={(e) =>
              setSource(e.target.value as 'tracked' | 'historical_log')
            }
          >
            <option value="tracked">
              Tracked (Updates Conducted/Attended Totals)
            </option>
            {semester.mode === 'ongoing' && (
              <option value="historical_log">
                Historical Log (Audit History Before {semester.trackingStartDate})
              </option>
            )}
          </Select>
        </div>

        <Input
          label="Notes (Optional)"
          placeholder="e.g., Guest lecture or medical absence"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {initialRecord ? 'Save Record' : 'Save Attendance'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
