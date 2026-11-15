# massbunk2 — Phase 1 reliability fixes

## Changes
- Mass bunk engine ignores already-recorded sessions (prevents double-counting) and excludes dates blocked by academic calendar events.
- Mass bunk UI disables unavailable sessions and excludes them from Select All/default selection.
- Shared local date helper replaces UTC `toISOString().slice(0,10)` for today's date across pages, components and engine.
- Local repository rejects identical slot-less submissions while permitting separately identified sessions using different notes.
- Supabase migration `002_prevent_duplicate_manual_records.sql` enforces the same slot-less identity constraint at database level. **Apply this migration to an existing Supabase database before relying on cloud duplicate protection.** Existing duplicates must be resolved first.
- Attendance percentages are capped to 0–100 even when input counts are inconsistent.
- Regression tests added for mass bunk and slot-less duplicates.

## Verification
- `tsc --noEmit` passed.
- Vitest could not start in the audit environment because the supplied node_modules has Windows-only native dependencies. On Windows run `npm ci`, `npm test`, `npm run build`.

## Notes
- Two separate slot-less sessions on the same subject/date with the same status and attendance units must have different notes to distinguish them. A stable per-session identifier would be a more robust future enhancement.
- The mass bunk tracker is a simulation, not an attendance logging operation.
- No existing user data was intentionally modified.
