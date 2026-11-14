# Phase 2: Groq Vision Smart Import (initial integration)

This implementation extends the existing PDF timetable and calendar importers with an **optional Groq Vision** mode. CSV/Excel and local PDF parsing remain available.

## How it works

1. Browser renders PDF pages as JPEG using PDF.js. The timetable importer locates the chosen section (default A8) from embedded text and sends only that page; calendar mode sends up to eight pages.
2. An authenticated Supabase Edge Function forwards the page image to Groq's `qwen/qwen3.8-27b` vision model and asks for structured JSON.
3. Client validates dates, time formats, subject codes, weekdays, and event types, then presents editable drafts for review.
4. User confirms before data enters the existing workspace.

**No Groq key is embedded in the frontend.** The uploaded page images leave the user's browser and are processed by Groq. Users must opt in using the checkbox.

## Configure

1. Use an existing Supabase project and sign in to BunkBuddy (the Edge Function rejects unauthenticated users).
2. In your local frontend `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project's public values. Never put `GROQ_API_KEY` in a `VITE_` variable.
3. Set the server secret using Supabase CLI: `supabase secrets set GROQ_API_KEY=YOUR_KEY` (avoid checking the key into Git).
4. Deploy the Edge Function: `supabase functions deploy smart-document-import`.
5. Start the app: `npm ci && npm run dev`.
6. Open Academic Calendar → Import → enable Groq Vision, or Timetable → Import PDF → select section A8 / group G1 → enable Groq Vision.

## Limitations / next iteration

- This is a **first integration, not a verified end-to-end deployment**. No Groq key or deployed Supabase function was available for a live API test.
- The timetable PDF needs selectable text for automatic section-page discovery. For image-only timetables, the section page locator must be extended.
- Model outputs are probabilistic. Always review merged lab cells, group-specific sessions, and academic calendar date ranges.
- Calendar start/end events are imported as labeled `teaching_day` events, **not automatically written into semester start/end settings**. Semester boundary syncing and an explicit approval flow are a follow-up task.
- Academic events such as exams and festivals default to non-blocking unless confirmed otherwise.
- API quotas and charges depend on your Groq account; verify limits before processing large documents.
- No server-side rate limiting or per-user quota is implemented yet. Add before a public launch.
- The authenticated Edge Function currently expects a logged-in Supabase user; local-only mode cannot invoke it.
