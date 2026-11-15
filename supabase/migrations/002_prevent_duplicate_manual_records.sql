-- Reject identical slot-less attendance submissions while allowing separately
-- identified sessions (different notes/status/units) on the same day.
-- Review any pre-existing duplicates before applying this migration.
create unique index if not exists uq_slotless_attendance_record
  on public.attendance_records (semester_id, subject_id, date, source, status, attendance_units, (coalesce(btrim(notes), '')))
  where timetable_entry_id is null;
