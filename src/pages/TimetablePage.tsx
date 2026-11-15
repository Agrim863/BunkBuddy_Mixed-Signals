import { useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  Edit2,
  FileSpreadsheet,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { PageHeader } from '../components/layout/PageHeader';
import { SubjectFormModal } from '../components/timetable/SubjectFormModal';
import { TimetableFormModal } from '../components/timetable/TimetableFormModal';
import { TimetableImportPanel } from '../components/timetable/TimetableImportPanel';
import type { ParsedTimetableDraft } from '../services/importers/timetableMapper';
import { SUBJECT_COLOR_PALETTE, type Subject, type TimetableEntry } from '../types/domain';
import {
  ACADEMIC_WEEKDAY_ORDER,
  formatDurationMinutes,
  getWeekdayName,
} from '../utils/weekdays';
import { Badge, Button, Card, EmptyState, Tooltip, useToast } from '../components/ui';

export function TimetablePage() {
  const { showToast } = useToast();
  const {
    activeSemester,
    subjects,
    timetableEntries,
    openOnboarding,
    addSubject,
    updateSubject,
    deleteSubject,
    addTimetableEntry,
    addTimetableEntriesBulk,
    updateTimetableEntry,
    deleteTimetableEntry,
  } = useWorkspace();

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [defaultWeekday, setDefaultWeekday] = useState(1);

  const [showImportPanel, setShowImportPanel] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const entriesByWeekday = useMemo(() => {
    const grouped = new Map<number, TimetableEntry[]>();
    for (const day of ACADEMIC_WEEKDAY_ORDER) {
      grouped.set(day, []);
    }
    for (const entry of timetableEntries) {
      const bucket = grouped.get(entry.weekday) ?? [];
      bucket.push(entry);
      grouped.set(entry.weekday, bucket);
    }
    for (const [day, list] of grouped.entries()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      grouped.set(day, list);
    }
    return grouped;
  }, [timetableEntries]);

  const handleImportRows = async (rows: ParsedTimetableDraft[]) => {
    const knownByCode = new Map(subjects.map((s) => [s.code.toUpperCase(), s]));
    const knownByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));
    const pendingEntries: Array<Omit<TimetableEntry, 'id' | 'semesterId'>> = [];

    let colorIdx = subjects.length;

    for (const row of rows) {
      if (row.weekday === null) continue;
      let subject =
        (row.subjectId ? subjectById.get(row.subjectId) : undefined) ??
        (row.subjectCode ? knownByCode.get(row.subjectCode.toUpperCase()) : undefined) ??
        (row.subjectName ? knownByName.get(row.subjectName.toLowerCase()) : undefined);

      if (!subject) {
        const res = await addSubject({
          name: row.subjectName || row.subjectCode,
          code: (row.subjectCode || 'SUBJ').toUpperCase(),
          color: SUBJECT_COLOR_PALETTE[colorIdx % SUBJECT_COLOR_PALETTE.length]!,
          historicalConducted: 0,
          historicalAttended: 0,
        });
        if (!res.ok) continue;
        subject = res.data;
        colorIdx++;
        knownByCode.set(subject.code.toUpperCase(), subject);
        knownByName.set(subject.name.toLowerCase(), subject);
      }

      pendingEntries.push({
        subjectId: subject.id,
        weekday: row.weekday,
        startTime: row.startTime,
        endTime: row.endTime,
        teachingDurationMinutes: row.teachingDurationMinutes,
        attendanceUnits: row.attendanceUnits,
        sessionType: row.sessionType,
      });
    }

    if (pendingEntries.length > 0) {
      const res = await addTimetableEntriesBulk(pendingEntries);
      if (res.ok) {
        setShowImportPanel(false);
        showToast({
          tone: 'success',
          title: 'Timetable imported',
          description: `Successfully added ${res.data.length} timetable slot(s).`,
        });
      }
    }
  };

  if (!activeSemester) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Timetable"
          description="Manage your weekly class timetable, durations, and attendance units."
        />
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="No active semester found"
          description="Create or select a semester to start organizing your weekly timetable."
          action={
            <Button leftIcon={<Rocket className="h-4 w-4" />} onClick={openOnboarding}>
              Start Semester Onboarding
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description={`${activeSemester.name} • Weekly class schedule with separate teaching durations and attendance credit weights.`}
        badge={
          <Badge variant="primary">
            {timetableEntries.length} slot{timetableEntries.length === 1 ? '' : 's'}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<BookOpen className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditingSubject(null);
                setSubjectModalOpen(true);
              }}
            >
              Add Subject
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              onClick={() => setShowImportPanel((prev) => !prev)}
            >
              {showImportPanel ? 'Hide Importer' : 'Import CSV / Excel'}
            </Button>
            <Button
              size="sm"
              disabled={subjects.length === 0}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditingEntry(null);
                setDefaultWeekday(1);
                setSlotModalOpen(true);
              }}
            >
              Add Timetable Slot
            </Button>
          </>
        }
      />

      {/* Accordion Import Panel */}
      <div className="bw-accordion" data-open={showImportPanel ? 'true' : 'false'}>
        <div>
          {showImportPanel && (
            <TimetableImportPanel
              existingSubjects={subjects}
              onConfirmImport={handleImportRows}
            />
          )}
        </div>
      </div>

      {/* Subjects Strip Card */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Enrolled Subjects ({subjects.length})
            </span>
          </div>
          {subjects.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Add at least one subject to start creating timetable slots.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] py-1 pl-2.5 pr-1.5 text-xs shadow-xs transition-colors hover:border-[var(--border-strong)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="font-semibold text-[var(--text-main)]">
                    {sub.name} <span className="font-mono text-[var(--text-secondary)]">({sub.code})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubject(sub);
                      setSubjectModalOpen(true);
                    }}
                    aria-label={`Edit ${sub.name}`}
                    className="rounded-full p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSubject(sub.id)}
                    aria-label={`Delete ${sub.name}`}
                    className="rounded-full p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Weekly Schedule Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ACADEMIC_WEEKDAY_ORDER.map((day) => {
          const daySlots = entriesByWeekday.get(day) ?? [];
          return (
            <Card key={day} padding="sm" className="flex flex-col">
              <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-main)]">
                    {getWeekdayName(day)}
                  </h3>
                  <Badge variant="neutral">{daySlots.length}</Badge>
                </div>
                <button
                  type="button"
                  disabled={subjects.length === 0}
                  onClick={() => {
                    setEditingEntry(null);
                    setDefaultWeekday(day);
                    setSlotModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-semibold text-[var(--primary)] transition-all duration-150 active:scale-95 hover:bg-[var(--primary)]/10 disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {daySlots.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] py-8 text-xs text-[var(--text-secondary)]">
                  No classes scheduled
                </div>
              ) : (
                <div className="space-y-2.5">
                  {daySlots.map((slot) => {
                    const subject = subjectById.get(slot.subjectId);
                    const isExpanded = expandedSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`rounded-[10px] border p-3 transition-all duration-150 ${
                          isExpanded
                            ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10 shadow-xs'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSlotId(isExpanded ? null : slot.id)
                            }
                            aria-expanded={isExpanded}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: subject?.color ?? 'var(--primary)' }}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                {subject?.name ?? 'Unknown Subject'}
                              </p>
                              <p className="font-mono text-xs text-[var(--text-secondary)]">
                                {subject?.code ?? 'SUBJ'}
                              </p>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Tooltip content="Edit slot">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEntry(slot);
                                  setSlotModalOpen(true);
                                }}
                                aria-label="Edit timetable slot"
                                className="rounded-[6px] p-1 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] active:scale-95"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                            <Tooltip content="Delete slot">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteTimetableEntry(slot.id);
                                  showToast({
                                    tone: 'info',
                                    title: 'Timetable slot removed',
                                  });
                                }}
                                aria-label="Delete timetable slot"
                                className="rounded-[6px] p-1 text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)] active:scale-95"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Distinct Duration vs. Attendance Units */}
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                          <span className="font-mono font-medium tabular-nums text-[var(--text-main)]">
                            {slot.startTime} – {slot.endTime}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="neutral" className="capitalize">
                              {slot.sessionType}
                            </Badge>
                            <Badge variant="secondary" title="Teaching Duration">
                              ⏱ {formatDurationMinutes(slot.teachingDurationMinutes)}
                            </Badge>
                            <Badge variant="primary" title="Attendance Units (Weight)">
                              {slot.attendanceUnits} unit{slot.attendanceUnits === 1 ? '' : 's'}
                            </Badge>
                          </div>
                        </div>

                        {/* Expandable Secondary Details Drawer */}
                        <div
                          className="bw-accordion"
                          data-open={isExpanded ? 'true' : 'false'}
                        >
                          <div>
                            <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-secondary)]">
                              <span>
                                Code:{' '}
                                <strong className="font-mono text-[var(--text-main)]">
                                  {subject?.code ?? 'N/A'}
                                </strong>{' '}
                                • Session length is{' '}
                                <strong className="font-mono text-[var(--text-main)]">
                                  {formatDurationMinutes(slot.teachingDurationMinutes)}
                                </strong>
                                , contributing{' '}
                                <strong className="font-mono text-[var(--primary)]">
                                  {slot.attendanceUnits} attendance unit
                                  {slot.attendanceUnits === 1 ? '' : 's'}
                                </strong>{' '}
                                to conducted and attended totals.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Subject Add/Edit Modal */}
      <SubjectFormModal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        initialSubject={editingSubject}
        onSubmitSubject={(data) => {
          if (editingSubject) {
            return updateSubject(editingSubject.id, data);
          }
          return addSubject(data);
        }}
      />

      {/* Timetable Slot Add/Edit Modal */}
      <TimetableFormModal
        open={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        subjects={subjects}
        initialEntry={editingEntry}
        defaultWeekday={defaultWeekday}
        onSave={(data) => {
          if (editingEntry) {
            updateTimetableEntry(editingEntry.id, data);
          } else {
            addTimetableEntry(data);
          }
        }}
      />
    </div>
  );
}
