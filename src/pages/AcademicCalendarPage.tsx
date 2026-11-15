import { localDateISO } from '../utils/localDate';
import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Plus,
  Rocket,
  Trash2,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  generateScheduledSessions,
  getBlockingCalendarEvent,
  getCalendarEventsForDate,
} from '../engine';
import type { CalendarEvent, CalendarEventType } from '../types/domain';
import { getWeekdayName } from '../utils/weekdays';
import { CalendarEventModal } from '../components/calendar/CalendarEventModal';
import {
  CalendarImportReview,
  EVENT_TYPE_LABELS,
} from '../components/calendar/CalendarImportReview';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SegmentedTabs,
  Tooltip,
  useToast,
  type BadgeVariant,
} from '../components/ui';

type CalendarViewMode = 'month' | 'week';

function eventBadgeVariant(type: CalendarEventType): BadgeVariant {
  switch (type) {
    case 'official_holiday':
    case 'semester_break':
    case 'non_teaching_day':
      return 'warning';
    case 'examination':
    case 'cancelled_class':
      return 'danger';
    case 'college_event':
      return 'secondary';
    case 'teaching_day':
      return 'success';
  }
}

export function AcademicCalendarPage() {
  const { showToast } = useToast();
  const {
    activeSemester,
    subjects,
    timetableEntries,
    calendarEvents,
    attendanceRecords,
    openOnboarding,
    addCalendarEvent,
    addCalendarEventsBulk,
    updateCalendarEvent,
    deleteCalendarEvent,
  } = useWorkspace();

  const todayIso = localDateISO();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [showImporter, setShowImporter] = useState(false);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const gridDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(cursorDate);
      const monthEnd = endOfMonth(cursorDate);
      const start = startOfWeek(monthStart, { weekStartsOn: 1 });
      const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const days: Date[] = [];
      let curr = start;
      while (curr <= end) {
        days.push(curr);
        curr = addDays(curr, 1);
      }
      return days;
    }
    const weekStart = startOfWeek(cursorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, cursorDate]);

  const handleNavigatePrev = () => {
    setCursorDate((prev) =>
      viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1),
    );
  };

  const handleNavigateNext = () => {
    setCursorDate((prev) =>
      viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1),
    );
  };

  const handleToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDate(todayIso);
  };

  const selectedDayEvents = useMemo(
    () => getCalendarEventsForDate(calendarEvents, selectedDate),
    [calendarEvents, selectedDate],
  );

  const selectedDayBlocking = useMemo(
    () => getBlockingCalendarEvent(calendarEvents, selectedDate),
    [calendarEvents, selectedDate],
  );

  const selectedDayLectures = useMemo(() => {
    if (!activeSemester) return [];
    const parsed = parseISO(selectedDate);
    if (Number.isNaN(parsed.getTime())) return [];
    const weekday = parsed.getDay();
    if (selectedDate < activeSemester.startDate || selectedDate > activeSemester.endDate) {
      return [];
    }
    return timetableEntries
      .filter((t) => t.weekday === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [activeSemester, selectedDate, timetableEntries]);

  const futurePreview = useMemo(() => {
    if (!activeSemester) {
      return { sessions: [], teachingDaysCount: 0, blockedCount: 0 };
    }
    const sessions = generateScheduledSessions({
      semester: activeSemester,
      timetableEntries,
      calendarEvents,
      attendanceRecords,
      fromDate: todayIso,
      toDate: activeSemester.endDate,
    });
    const teachingDays = new Set(sessions.map((s) => s.date));
    const blockedEvents = calendarEvents.filter(
      (ev) => ev.affectsClasses && (ev.endDate ?? ev.date) >= todayIso,
    );
    return {
      sessions: sessions.slice(0, 10),
      teachingDaysCount: teachingDays.size,
      blockedCount: blockedEvents.length,
    };
  }, [activeSemester, timetableEntries, calendarEvents, attendanceRecords, todayIso]);

  if (!activeSemester) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Calendar"
          description="Manage holidays, semester breaks, exam weeks, and track non-teaching days."
        />
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No Active Semester"
          description="Create or select a semester to visualize academic events and teaching schedules."
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
        title="Academic Calendar"
        description={`${activeSemester.name} • Manage holidays, exam blocks, and track teaching vs. non-teaching days.`}
        badge={
          <Badge variant="primary">
            {calendarEvents.length} event{calendarEvents.length === 1 ? '' : 's'}
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => setShowImporter((prev) => !prev)}
            >
              {showImporter ? 'Hide Importer' : 'Import PDF / Excel / CSV'}
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditingEvent(null);
                setEventModalOpen(true);
              }}
            >
              Add Event
            </Button>
          </>
        }
      />

      {/* Accordion Import Panel */}
      <div className="bw-accordion" data-open={showImporter ? 'true' : 'false'}>
        <div>
          {showImporter && (
            <CalendarImportReview
              onConfirmImport={async (events) => {
                await addCalendarEventsBulk(events);
                setShowImporter(false);
                showToast({
                  tone: 'success',
                  title: 'Calendar events imported',
                  description: `Added ${events.length} event(s) to your academic calendar.`,
                });
              }}
            />
          )}
        </div>
      </div>

      {/* Main Grid: Calendar Matrix + Date Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Calendar Matrix Card */}
        <Card className="xl:col-span-8">
          <CardHeader className="pb-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigatePrev}
                  aria-label="Previous period"
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday} className="h-8 px-2.5 text-xs font-semibold">
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNavigateNext}
                  aria-label="Next period"
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <h3 className="ml-2 font-mono text-sm font-bold text-[var(--text-main)]">
                  {viewMode === 'month'
                    ? format(cursorDate, 'MMMM yyyy')
                    : `Week of ${format(gridDays[0]!, 'MMM d')} – ${format(
                        gridDays[6]!,
                        'MMM d, yyyy',
                      )}`}
                </h3>
              </div>

              <SegmentedTabs
                ariaLabel="Calendar view mode"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { id: 'month', label: 'Month' },
                  { id: 'week', label: 'Week' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1.5 pb-2 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {gridDays.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const weekday = day.getDay();
                const isSelected = iso === selectedDate;
                const isToday = iso === todayIso;
                const inCurrentMonth =
                  viewMode === 'week' || isSameMonth(day, cursorDate);
                const inSemester =
                  iso >= activeSemester.startDate && iso <= activeSemester.endDate;

                const dayEvents = getCalendarEventsForDate(calendarEvents, iso);
                const blocking = getBlockingCalendarEvent(calendarEvents, iso);
                const dayLectureCount = inSemester
                  ? timetableEntries.filter((t) => t.weekday === weekday).length
                  : 0;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    aria-pressed={isSelected}
                    className={`flex min-w-0 flex-col items-start justify-between rounded-[12px] border p-1.5 text-left transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 sm:p-2 ${
                      viewMode === 'week' ? 'min-h-36' : 'min-h-20 sm:min-h-24'
                    } ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/30 shadow-xs'
                        : blocking
                          ? 'border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 hover:-translate-y-0.5 hover:border-[var(--status-warning)]/60'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    } ${!inCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold tabular-nums transition-colors ${
                          isToday
                            ? 'bg-[var(--primary)] text-white'
                            : isSelected
                              ? 'bg-[var(--primary)]/20 text-[var(--primary)] font-bold'
                              : 'text-[var(--text-main)]'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayLectureCount > 0 && !blocking && (
                        <span className="hidden rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--text-secondary)] sm:inline">
                          {dayLectureCount}c
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 w-full min-w-0 space-y-1">
                      {dayEvents.slice(0, viewMode === 'week' ? 4 : 2).map((ev) => (
                        <Tooltip
                          key={ev.id}
                          className="block w-full min-w-0"
                          content={`${ev.title} • ${EVENT_TYPE_LABELS[ev.eventType]}${
                            ev.affectsClasses ? ' (Classes suspended)' : ''
                          }`}
                        >
                          <div
                            className={`w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              ev.affectsClasses
                                ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                                : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                            }`}
                          >
                            {ev.title}
                          </div>
                        </Tooltip>
                      ))}
                      {dayEvents.length > (viewMode === 'week' ? 4 : 2) && (
                        <div className="font-mono text-[10px] font-medium text-[var(--text-secondary)]">
                          +{dayEvents.length - (viewMode === 'week' ? 4 : 2)} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Inspector & Future Sessions Preview */}
        <div className="space-y-6 xl:col-span-4">
          <Card>
            <CardHeader className="pb-3.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Date Details
                  </span>
                </div>
                <CardTitle className="mt-0.5 font-mono text-lg">{selectedDate}</CardTitle>
                <CardDescription>
                  {(() => {
                    const parsed = parseISO(selectedDate);
                    return Number.isNaN(parsed.getTime())
                      ? 'Select a date'
                      : getWeekdayName(parsed.getDay());
                  })()}{' '}
                  •{' '}
                  {selectedDayBlocking ? (
                    <span className="font-semibold text-[var(--status-warning)]">
                      Non-Teaching ({selectedDayBlocking.title})
                    </span>
                  ) : (
                    <span className="font-semibold text-[var(--status-success)]">
                      Scheduled Teaching Day
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditingEvent(null);
                  setEventModalOpen(true);
                }}
              >
                Add Event
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Events on Selected Date */}
              <div className="space-y-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Calendar Events ({selectedDayEvents.length})
                </span>
                {selectedDayEvents.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3 py-3 text-xs text-[var(--text-secondary)]">
                    No academic calendar events on this date.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[var(--text-main)]">
                              {ev.title}
                            </span>
                            <Badge variant={eventBadgeVariant(ev.eventType)}>
                              {EVENT_TYPE_LABELS[ev.eventType]}
                            </Badge>
                          </div>
                          {ev.description && (
                            <p className="mt-1 text-[var(--text-secondary)]">{ev.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(ev);
                              setEventModalOpen(true);
                            }}
                            aria-label="Edit event"
                            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCalendarEvent(ev.id)}
                            aria-label="Delete event"
                            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lectures Scheduled on Selected Date */}
              <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Scheduled Lectures ({selectedDayLectures.length})
                </span>
                {selectedDayLectures.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3 py-3 text-xs text-[var(--text-secondary)]">
                    No timetable slots scheduled on this weekday.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayLectures.map((slot) => {
                      const sub = subjectById.get(slot.subjectId);
                      const recorded = attendanceRecords.find(
                        (r) =>
                          r.source === 'tracked' &&
                          r.date === selectedDate &&
                          r.timetableEntryId === slot.id,
                      );
                      return (
                        <div
                          key={slot.id}
                          className={`rounded-[10px] border p-2.5 text-xs ${
                            selectedDayBlocking
                              ? 'border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 opacity-80'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface-well)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: sub?.color ?? 'var(--primary)' }}
                              />
                              <span className="truncate font-semibold text-[var(--text-main)]">
                                {sub ? `${sub.name} (${sub.code})` : 'Subject'}
                              </span>
                            </div>
                            <Badge variant="neutral">{slot.attendanceUnits}u</Badge>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span className="font-mono tabular-nums">
                              {slot.startTime}–{slot.endTime} • {slot.sessionType}
                            </span>
                            {selectedDayBlocking ? (
                              <span className="font-semibold text-[var(--status-warning)]">
                                Suspended
                              </span>
                            ) : recorded ? (
                              <span className="font-semibold capitalize text-[var(--primary)]">
                                {recorded.status.replace('_', ' ')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Future Teaching Sessions Preview */}
          <Card>
            <CardHeader className="pb-3.5">
              <div>
                <CardTitle>Future Sessions Preview</CardTitle>
                <CardDescription>
                  {futurePreview.teachingDaysCount} teaching days &amp;{' '}
                  {futurePreview.blockedCount} holiday/blocked events left
                </CardDescription>
              </div>
              <Clock className="h-4 w-4 text-[var(--primary)]" />
            </CardHeader>
            <CardContent>
              {futurePreview.sessions.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  No future teaching sessions remaining in semester bounds.
                </p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {futurePreview.sessions.map((session) => {
                    const sub = subjectById.get(session.subjectId);
                    return (
                      <button
                        key={`${session.date}-${session.timetableEntryId}`}
                        type="button"
                        onClick={() => {
                          setSelectedDate(session.date);
                          setCursorDate(parseISO(session.date));
                        }}
                        className="flex w-full items-center justify-between rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--primary)]/60 hover:bg-[var(--bg-surface-hover)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-main)]">
                            {sub?.code ?? 'SUB'} • {session.date}
                          </p>
                          <p className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
                            {session.startTime}–{session.endTime}
                          </p>
                        </div>
                        <Badge variant="primary">{session.attendanceUnits}u</Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All Semester Events Directory */}
      <Card>
        <CardHeader className="pb-3.5">
          <div>
            <CardTitle>All Semester Calendar Events ({calendarEvents.length})</CardTitle>
            <CardDescription>
              Sorted chronologically across holidays, breaks, exams, and college events
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {calendarEvents.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
              No calendar events added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {[...calendarEvents]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-3 text-xs transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-bold tabular-nums text-[var(--text-main)]">
                        {ev.date}
                        {ev.endDate ? ` → ${ev.endDate}` : ''}
                      </p>
                      <p className="mt-0.5 truncate font-semibold text-[var(--text-main)]">
                        {ev.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={eventBadgeVariant(ev.eventType)}>
                          {EVENT_TYPE_LABELS[ev.eventType]}
                        </Badge>
                        {ev.affectsClasses && (
                          <Badge variant="neutral">Non-Teaching</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEvent(ev);
                          setEventModalOpen(true);
                        }}
                        aria-label={`Edit ${ev.title}`}
                        className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCalendarEvent(ev.id)}
                        aria-label={`Delete ${ev.title}`}
                        className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CalendarEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        initialEvent={editingEvent}
        defaultDate={selectedDate}
        onSave={async (input) => {
          const res = editingEvent
            ? await updateCalendarEvent(editingEvent.id, input)
            : await addCalendarEvent(input);
          if (res.ok) {
            showToast({
              tone: 'success',
              title: editingEvent ? 'Event updated' : 'Event created',
              description: `${input.title} (${input.date})`,
            });
          }
          return res;
        }}
      />
    </div>
  );
}
