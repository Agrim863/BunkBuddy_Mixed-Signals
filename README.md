# BunkWise — Smart Attendance & Bunk Planner

BunkWise is a full-featured academic attendance tracker, recovery planner, and bunk impact simulator built with React, TypeScript, Tailwind CSS, Recharts, Zod, `date-fns`, and Supabase (with automatic Local Persistence fallback).

## Core Capabilities

- **Dual Onboarding Workflows**:
  - **Fresh Semester**: Initializes attendance at zero and projects predictions from your first scheduled session.
  - **Ongoing Semester**: Captures historical conducted/attended counts, sets your live tracking date, and optionally stores audit-only historical logs without double-counting.
- **Pure Attendance Calculation Engine (`src/engine/`)**:
  - Computes current percentage $P = (A / C) \times 100$ (displays `N/A` when $C = 0$), future predictions $P_{\text{future}}$, consecutive recovery requirements $x = \lceil (M \cdot C - A)/(1 - M) \rceil$, immediate safe bunks, and remaining semester absence budget.
  - Enforces academic rules: holidays and cancelled classes never increase conducted totals, mass bunks count as conducted absences, and teaching duration is modeled independently from attendance units.
- **Bunk Simulator & Mass Bunk Tracker**:
  - Isolated in-memory scenario simulation (`Scenario A`: attend all upcoming, `Scenario B`: miss target date, `Scenario C`: miss multi-day selections) plus whole-day multi-subject mass bunk evaluation.
- **Academic Calendar & Weekly Timetable**:
  - Month and week calendar views, date-level scheduled lecture inspection, manual event CRUD, and PDF/Excel/CSV upload with column mapping and an editable review step before saving.
- **Analytics**:
  - Recharts visualizations separating confirmed historical progression from predicted trajectories, subject comparisons, unit breakdowns, and consecutive recovery curves against your configurable threshold.

## Local Development Mode vs. Supabase Mode

- **Local Development Mode (Default when `.env` is unset)**:
  - Runs automatically when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured.
  - Persists data in browser `localStorage` and clearly displays a **Local Mode** status indicator.
  - Auto-seeds a clearly labeled 5-subject **Demo Data** semester on first launch (removable or resettable anytime in **Settings**).
- **Supabase Mode**:
  1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  2. Apply the relational PostgreSQL schema and Row Level Security policies in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) in your Supabase SQL Editor.
  3. Sign in or create an account via **Settings** to sync data remotely.

## Scripts

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Strict TypeScript type checking
npm run typecheck

# Run unit & end-to-end workflow tests
npm test

# Build for production
npm run build
```
