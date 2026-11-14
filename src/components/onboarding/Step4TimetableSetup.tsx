import { useState } from 'react';
import { BookPlus, Clock, Plus, Trash2 } from 'lucide-react';
import { subjectSchema } from '../../schemas/subject.schema';
import {
  computeDurationMinutes,
  timetableEntrySchema,
} from '../../schemas/timetable.schema';
import {
  ACADEMIC_WEEKDAY_ORDER,
  formatDurationMinutes,
  getWeekdayShortName,
} from '../../utils/weekdays';
import {
  SUBJECT_COLOR_PALETTE,
  type SessionType,
  type Subject,
} from '../../types/domain';
import type { ParsedTimetableDraft } from '../../services/importers/timetableMapper';
import { TimetableImportPanel } from '../timetable/TimetableImportPanel';
import { Badge, Button, Input, Select } from '../ui';
import type { DraftSubject, DraftTimetableEntry, OnboardingDraft } from './types';

interface Step4TimetableSetupProps {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
}

export function Step4TimetableSetup({ draft, onChange }: Step4TimetableSetupProps) {
  // Quick subject add form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subColor, setSubColor] = useState<string>(
    SUBJECT_COLOR_PALETTE[draft.subjects.length % SUBJECT_COLOR_PALETTE.length]!,
  );
  const [subError, setSubError] = useState<string | null>(null);

  // Manual timetable slot form
  const [selectedSubjectTempId, setSelectedSubjectTempId] = useState(
    draft.subjects[0]?.tempId ?? '',
  );
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [teachingDurationMinutes, setTeachingDurationMinutes] = useState(60);
  const [attendanceUnits, setAttendanceUnits] = useState(1);
  const [sessionType, setSessionType] = useState<SessionType>('lecture');
  const [slotError, setSlotError] = useState<string | null>(null);

  const handleAddSubject = () => {
    setSubError(null);
    const parsed = subjectSchema.safeParse({
      name: subName,
      code: subCode,
      color: subColor,
      historicalConducted: 0,
      historicalAttended: 0,
    });

    if (!parsed.success) {
      setSubError(parsed.error.issues[0]?.message ?? 'Invalid subject');
      return;
    }

    if (draft.subjects.some((s) => s.code.toUpperCase() === parsed.data.code)) {
      setSubError(`Subject code "${parsed.data.code}" is already added.`);
      return;
    }

    const created: DraftSubject = {
      tempId: `sub-${crypto.randomUUID()}`,
      name: parsed.data.name,
      code: parsed.data.code,
      color: parsed.data.color,
      historicalConducted: 0,
      historicalAttended: 0,
    };

    const nextSubjects = [...draft.subjects, created];
    onChange({ subjects: nextSubjects });
    if (!selectedSubjectTempId) {
      setSelectedSubjectTempId(created.tempId);
    }
    setSubName('');
    setSubCode('');
    setSubColor(
      SUBJECT_COLOR_PALETTE[nextSubjects.length % SUBJECT_COLOR_PALETTE.length]!,
    );
  };

  const removeSubject = (tempId: string) => {
    const nextSubjects = draft.subjects.filter((s) => s.tempId !== tempId);
    onChange({
      subjects: nextSubjects,
      timetableEntries: draft.timetableEntries.filter(
        (t) => t.subjectTempId !== tempId,
      ),
      historicalLogs: draft.historicalLogs.filter((l) => l.subjectTempId !== tempId),
    });
    if (selectedSubjectTempId === tempId) {
      setSelectedSubjectTempId(nextSubjects[0]?.tempId ?? '');
    }
  };

  const handleTimeChange = (nextStart: string, nextEnd: string) => {
    setStartTime(nextStart);
    setEndTime(nextEnd);
    const computed = computeDurationMinutes(nextStart, nextEnd);
    if (computed > 0) {
      setTeachingDurationMinutes(computed);
    }
  };

  const handleAddSlot = () => {
    setSlotError(null);
    const subjectTempId = selectedSubjectTempId || draft.subjects[0]?.tempId;
    if (!subjectTempId) {
      setSlotError('Please add at least one subject before adding timetable entries.');
      return;
    }

    const parsed = timetableEntrySchema.safeParse({
      subjectId: 'stub',
      weekday,
      startTime,
      endTime,
      teachingDurationMinutes,
      attendanceUnits,
      sessionType,
    });

    if (!parsed.success) {
      setSlotError(parsed.error.issues[0]?.message ?? 'Invalid timetable entry');
      return;
    }

    const created: DraftTimetableEntry = {
      tempId: `slot-${crypto.randomUUID()}`,
      subjectTempId,
      weekday: parsed.data.weekday,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      teachingDurationMinutes: parsed.data.teachingDurationMinutes,
      attendanceUnits: parsed.data.attendanceUnits,
      sessionType: parsed.data.sessionType,
    };

    onChange({
      timetableEntries: [...draft.timetableEntries, created],
    });
  };

  const subjectsAsDomain: Subject[] = draft.subjects.map((s) => ({
    id: s.tempId,
    semesterId: 'draft',
    name: s.name,
    code: s.code,
    color: s.color,
    historicalConducted: s.historicalConducted,
    historicalAttended: s.historicalAttended,
    createdAt: new Date().toISOString(),
  }));

  const handleImportTimetable = (rows: ParsedTimetableDraft[]) => {
    const knownByCode = new Map(
      draft.subjects.map((s) => [s.code.toUpperCase(), s]),
    );
    const knownByName = new Map(
      draft.subjects.map((s) => [s.name.toLowerCase(), s]),
    );

    const nextSubjects = [...draft.subjects];
    const nextSlots = [...draft.timetableEntries];
    let colorIdx = nextSubjects.length;

    for (const row of rows) {
      if (row.weekday === null) continue;

      let sub =
        (row.subjectId
          ? nextSubjects.find((s) => s.tempId === row.subjectId)
          : undefined) ??
        (row.subjectCode
          ? knownByCode.get(row.subjectCode.toUpperCase())
          : undefined) ??
        (row.subjectName
          ? knownByName.get(row.subjectName.toLowerCase())
          : undefined);

      if (!sub) {
        sub = {
          tempId: `sub-${crypto.randomUUID()}`,
          name: row.subjectName || row.subjectCode,
          code: (row.subjectCode || 'SUBJ').toUpperCase(),
          color:
            SUBJECT_COLOR_PALETTE[colorIdx % SUBJECT_COLOR_PALETTE.length]!,
          historicalConducted: 0,
          historicalAttended: 0,
        };
        nextSubjects.push(sub);
        knownByCode.set(sub.code.toUpperCase(), sub);
        knownByName.set(sub.name.toLowerCase(), sub);
        colorIdx++;
      }

      nextSlots.push({
        tempId: `slot-${crypto.randomUUID()}`,
        subjectTempId: sub.tempId,
        weekday: row.weekday,
        startTime: row.startTime,
        endTime: row.endTime,
        teachingDurationMinutes: row.teachingDurationMinutes,
        attendanceUnits: row.attendanceUnits,
        sessionType: row.sessionType,
      });
    }

    onChange({
      subjects: nextSubjects,
      timetableEntries: nextSlots,
    });
    if (!selectedSubjectTempId && nextSubjects[0]) {
      setSelectedSubjectTempId(nextSubjects[0].tempId);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-[var(--text-main)]">
          Subjects &amp; Weekly Timetable
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configure subjects and weekly schedule. You can map different teaching hours and attendance units per session.
        </p>
      </div>

      {/* 1. Subjects Section */}
      <div className="space-y-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">1. Add Subjects</h4>
        {subError && <p className="text-xs font-semibold text-[var(--status-danger)]">{subError}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <Input
              label="Subject Name"
              placeholder="e.g., Computer Networks"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Code"
              placeholder="CS501"
              value={subCode}
              onChange={(e) => setSubCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              label="Color"
              value={subColor}
              onChange={(e) => setSubColor(e.target.value)}
            >
              {SUBJECT_COLOR_PALETTE.map((c, i) => (
                <option key={c} value={c}>
                  Color {i + 1}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<BookPlus className="h-3.5 w-3.5" />}
              onClick={handleAddSubject}
            >
              Add
            </Button>
          </div>
        </div>

        {draft.subjects.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {draft.subjects.map((sub) => (
              <span
                key={sub.tempId}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1 pl-2.5 pr-1.5 text-xs font-semibold text-[var(--text-main)] shadow-xs"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: sub.color }}
                />
                <span>
                  {sub.name} ({sub.code})
                </span>
                <button
                  type="button"
                  onClick={() => removeSubject(sub.tempId)}
                  aria-label={`Remove ${sub.name}`}
                  className="rounded-full p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. CSV / Excel Import */}
      <TimetableImportPanel
        existingSubjects={subjectsAsDomain}
        onConfirmImport={handleImportTimetable}
      />

      {/* 3. Manual Timetable Entry */}
      <div className="space-y-3 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--text-main)]">
            2. Manual Timetable Entry
          </h4>
          <Badge variant="neutral">Duration ≠ Attendance Units</Badge>
        </div>

        {slotError && <p className="text-xs font-semibold text-[var(--status-danger)]">{slotError}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Subject"
            value={selectedSubjectTempId || draft.subjects[0]?.tempId || ''}
            onChange={(e) => setSelectedSubjectTempId(e.target.value)}
            disabled={draft.subjects.length === 0}
          >
            {draft.subjects.length === 0 ? (
              <option value="">Add a subject above first</option>
            ) : (
              draft.subjects.map((sub) => (
                <option key={sub.tempId} value={sub.tempId}>
                  {sub.name} ({sub.code})
                </option>
              ))
            )}
          </Select>

          <Select
            label="Weekday"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {ACADEMIC_WEEKDAY_ORDER.map((day) => (
              <option key={day} value={day}>
                {getWeekdayShortName(day)}
              </option>
            ))}
          </Select>

          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => handleTimeChange(e.target.value, endTime)}
          />

          <Input
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => handleTimeChange(startTime, e.target.value)}
          />

          <Input
            label="Teaching Duration (min)"
            type="number"
            min={15}
            max={480}
            value={teachingDurationMinutes}
            onChange={(e) => setTeachingDurationMinutes(Number(e.target.value))}
          />

          <Input
            label="Attendance Units"
            type="number"
            min={1}
            max={12}
            value={attendanceUnits}
            onChange={(e) => setAttendanceUnits(Number(e.target.value))}
            hint="e.g., 2h lab = 1 or 2 units"
          />

          <Select
            label="Classification"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
          >
            <option value="lecture">Lecture</option>
            <option value="lab">Lab</option>
            <option value="tutorial">Tutorial</option>
          </Select>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              disabled={draft.subjects.length === 0}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={handleAddSlot}
            >
              Add Slot
            </Button>
          </div>
        </div>

        {/* Staged Timetable Slots */}
        {draft.timetableEntries.length > 0 && (
          <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pt-2">
            {draft.timetableEntries.map((slot) => {
              const sub = draft.subjects.find((s) => s.tempId === slot.subjectTempId);
              return (
                <div
                  key={slot.tempId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                    />
                    <span className="font-bold text-[var(--text-main)]">
                      {getWeekdayShortName(slot.weekday)}
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                      {slot.startTime}–{slot.endTime}
                    </span>
                    <span className="font-semibold text-[var(--text-main)]">
                      {sub ? `${sub.name} (${sub.code})` : 'Subject'}
                    </span>
                    <Badge variant="neutral" className="capitalize">
                      {slot.sessionType}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                      <Clock className="h-3 w-3" />
                      {formatDurationMinutes(slot.teachingDurationMinutes)} •{' '}
                      {slot.attendanceUnits} unit{slot.attendanceUnits === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        timetableEntries: draft.timetableEntries.filter(
                          (t) => t.tempId !== slot.tempId,
                        ),
                      })
                    }
                    aria-label="Remove timetable entry"
                    className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
