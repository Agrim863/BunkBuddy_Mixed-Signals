import { useEffect, useState, type FormEvent } from 'react';
import {
  computeDurationMinutes,
  timetableEntrySchema,
} from '../../schemas/timetable.schema';
import { ACADEMIC_WEEKDAY_ORDER, getWeekdayName } from '../../utils/weekdays';
import type { SessionType, Subject, TimetableEntry } from '../../types/domain';
import { Button, Input, Modal, Select } from '../ui';

interface TimetableFormModalProps {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialEntry?: TimetableEntry | null;
  defaultWeekday?: number;
  onSave: (data: {
    subjectId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    teachingDurationMinutes: number;
    attendanceUnits: number;
    sessionType: SessionType;
  }) => void;
}

export function TimetableFormModal({
  open,
  onClose,
  subjects,
  initialEntry,
  defaultWeekday = 1,
  onSave,
}: TimetableFormModalProps) {
  const [subjectId, setSubjectId] = useState('');
  const [weekday, setWeekday] = useState(defaultWeekday);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [attendanceUnits, setAttendanceUnits] = useState(1);
  const [sessionType, setSessionType] = useState<SessionType>('lecture');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (initialEntry) {
      setSubjectId(initialEntry.subjectId);
      setWeekday(initialEntry.weekday);
      setStartTime(initialEntry.startTime);
      setEndTime(initialEntry.endTime);
      setDurationMinutes(initialEntry.teachingDurationMinutes);
      setAttendanceUnits(initialEntry.attendanceUnits);
      setSessionType(initialEntry.sessionType);
    } else {
      setSubjectId(subjects[0]?.id ?? '');
      setWeekday(defaultWeekday);
      setStartTime('09:00');
      setEndTime('10:00');
      setDurationMinutes(60);
      setAttendanceUnits(1);
      setSessionType('lecture');
    }
  }, [open, initialEntry, subjects, defaultWeekday]);

  const handleTimeChange = (nextStart: string, nextEnd: string) => {
    setStartTime(nextStart);
    setEndTime(nextEnd);
    const computed = computeDurationMinutes(nextStart, nextEnd);
    if (computed > 0) {
      setDurationMinutes(computed);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = timetableEntrySchema.safeParse({
      subjectId,
      weekday,
      startTime,
      endTime,
      teachingDurationMinutes: durationMinutes,
      attendanceUnits,
      sessionType,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    onSave(parsed.data);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialEntry ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
      description="Configure schedule time, teaching duration, and attendance units independently."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Subject"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          error={errors.subjectId}
        >
          <option value="">Select subject...</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name} ({sub.code})
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Weekday"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            error={errors.weekday}
          >
            {ACADEMIC_WEEKDAY_ORDER.map((day) => (
              <option key={day} value={day}>
                {getWeekdayName(day)}
              </option>
            ))}
          </Select>

          <Select
            label="Session Classification"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            error={errors.sessionType}
          >
            <option value="lecture">Lecture</option>
            <option value="lab">Lab</option>
            <option value="tutorial">Tutorial</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => handleTimeChange(e.target.value, endTime)}
            error={errors.startTime}
          />
          <Input
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => handleTimeChange(startTime, e.target.value)}
            error={errors.endTime}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Teaching Duration (minutes)"
            type="number"
            min={15}
            max={480}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            hint="Actual clock duration of the class"
            error={errors.teachingDurationMinutes}
          />
          <Input
            label="Attendance Units"
            type="number"
            min={1}
            max={12}
            value={attendanceUnits}
            onChange={(e) => setAttendanceUnits(Number(e.target.value))}
            hint="How many attendance entries this slot counts as (e.g., 2-hr lab = 1 or 2)"
            error={errors.attendanceUnits}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{initialEntry ? 'Save Changes' : 'Add Slot'}</Button>
        </div>
      </form>
    </Modal>
  );
}
