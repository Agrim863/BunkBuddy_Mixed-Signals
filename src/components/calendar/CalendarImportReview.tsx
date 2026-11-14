import { useState } from 'react';
import { groqSmartImport } from '../../services/importers/groqDocumentIntelligence';
import { AlertCircle, Check, FileSpreadsheet, FileText, Trash2, Upload } from 'lucide-react';
import { parseCsvFile, type TabularData } from '../../services/importers/csvParser';
import { parseExcelFile } from '../../services/importers/excelParser';
import type { ParsedCalendarDraft } from '../../services/importers/pdfCalendarParser';
import {
  guessCalendarColumnMapping,
  mapRowsToCalendarDrafts,
  type CalendarColumnMapping,
} from '../../services/importers/calendarMapper';
import { calendarEventTypes, defaultAffectsClassesForEvent } from '../../schemas/calendar.schema';
import type { CalendarEventType } from '../../types/domain';
import { Badge, Button, Select } from '../ui';

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  official_holiday: 'Official Holiday',
  semester_break: 'Semester Break',
  examination: 'Examination Period',
  college_event: 'College Event',
  non_teaching_day: 'Non-Teaching Day',
  teaching_day: 'Teaching Day',
  cancelled_class: 'Cancelled Class',
};

interface CalendarImportReviewProps {
  onConfirmImport: (
    events: Array<{
      date: string;
      endDate?: string;
      eventType: CalendarEventType;
      title: string;
      description?: string;
      affectsClasses: boolean;
    }>,
  ) => void;
}

export function CalendarImportReview({ onConfirmImport }: CalendarImportReviewProps) {
  const [loading, setLoading] = useState(false);
  const [aiWarnings,setAiWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // For CSV/Excel column mapping before review
  const [tabular, setTabular] = useState<TabularData | null>(null);
  const [mapping, setMapping] = useState<CalendarColumnMapping | null>(null);

  // Review rows (shown before saving)
  const [reviewRows, setReviewRows] = useState<ParsedCalendarDraft[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const applyTabularMapping = (data: TabularData, nextMapping: CalendarColumnMapping) => {
    const mapped = mapRowsToCalendarDrafts(data.rows, nextMapping);
    setReviewRows(mapped);
    setSelectedIds(new Set(mapped.filter((r) => r.valid).map((r) => r.id)));
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setAiWarnings([]);
    setErrorMsg(null);
    setFileName(file.name);
    setTabular(null);
    setMapping(null);
    setReviewRows([]);

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv')) {
        const data = await parseCsvFile(file);
        if (data.rows.length === 0) {
          setErrorMsg('No rows found in CSV file.');
          return;
        }
        const guessed = guessCalendarColumnMapping(data.headers);
        setTabular(data);
        setMapping(guessed);
        applyTabularMapping(data, guessed);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const data = await parseExcelFile(file);
        if (data.rows.length === 0) {
          setErrorMsg('No rows found in the first worksheet.');
          return;
        }
        const guessed = guessCalendarColumnMapping(data.headers);
        setTabular(data);
        setMapping(guessed);
        applyTabularMapping(data, guessed);
      } else if (lower.endsWith('.pdf')) {
        const ai = await groqSmartImport(file, 'calendar', setProgress);
        setReviewRows(ai.calendar);
        setSelectedIds(new Set(ai.calendar.map(d => d.id)));
        setAiWarnings(ai.warnings);
        if (!ai.calendar.length) setErrorMsg('No valid academic events found. Check the PDF and try again.');
      } else {
        setErrorMsg('Unsupported file format. Please upload a .pdf, .csv, or .xlsx file.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setProgress('');
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<ParsedCalendarDraft>) => {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        const valid = Boolean(merged.date && merged.title.trim());
        return {
          ...merged,
          valid,
          error: valid ? undefined : 'Start date and title are required.',
        };
      }),
    );
  };

  const handleConfirm = () => {
    const toSave = reviewRows
      .filter((r) => selectedIds.has(r.id) && r.valid)
      .map((r) => ({
        date: r.date,
        endDate: r.endDate,
        eventType: r.eventType,
        title: r.title.trim(),
        description: r.description,
        affectsClasses: r.affectsClasses,
      }));

    if (toSave.length === 0) {
      setErrorMsg('No valid rows are currently selected for import.');
      return;
    }

    onConfirmImport(toSave);
    setReviewRows([]);
    setSelectedIds(new Set());
    setTabular(null);
    setMapping(null);
    setFileName(null);
  };

  const validSelectedCount = reviewRows.filter(
    (r) => selectedIds.has(r.id) && r.valid,
  ).length;

  return (
    <div className="space-y-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-main)]">
            Import Academic Calendar (PDF, Excel, CSV)
          </h4>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Extracted events appear in a review table below before being saved.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--primary)] transition-all duration-150 hover:border-[var(--primary)] hover:bg-[var(--primary)]/20">
          <Upload className="h-3.5 w-3.5" />
          <span>{loading ? 'Parsing file...' : 'Choose PDF / Excel / CSV'}</span>
          <input
            type="file"
            accept=".pdf,.csv,.xlsx,.xls"
            disabled={loading}
            onChange={(e) => {
              void handleFileChange(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>
      </div>

      <p className="text-xs text-[var(--text-muted)]">PDFs are analyzed with Groq AI. CSV and Excel files are parsed locally. Confirm class cancellations before importing.</p>
      {aiWarnings.map((w,i)=><p key={i} className="text-sm text-[var(--status-warning)]">Review: {w}</p>)}
      {progress && <p role="status" className="text-sm text-[var(--text-secondary)]">{progress}</p>}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[var(--status-danger)]/35 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--status-danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-danger)]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Column Mapping Controls for CSV/Excel */}
      {tabular && mapping && (
        <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Column Mapping — {fileName}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['date', 'Start Date *'],
                ['endDate', 'End Date'],
                ['title', 'Event Title *'],
                ['eventType', 'Category / Type'],
              ] as const
            ).map(([field, label]) => (
              <Select
                key={field}
                label={label}
                value={mapping[field]}
                onChange={(e) => {
                  const next = { ...mapping, [field]: e.target.value };
                  setMapping(next);
                  applyTabularMapping(tabular, next);
                }}
              >
                <option value="">-- Not mapped --</option>
                {tabular.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Review Screen before saving */}
      {reviewRows.length > 0 && (
        <div className="space-y-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--primary)]" />
              <span className="text-xs font-semibold text-[var(--text-main)]">
                Review Extracted Events ({reviewRows.length} found)
              </span>
              {fileName && <Badge variant="neutral">{fileName}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReviewRows([]);
                  setSelectedIds(new Set());
                  setTabular(null);
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                disabled={validSelectedCount === 0}
                leftIcon={<Check className="h-3.5 w-3.5" />}
                onClick={handleConfirm}
              >
                Save {validSelectedCount} Reviewed Event{validSelectedCount === 1 ? '' : 's'}
              </Button>
            </div>
          </div>

          <div className="max-h-72 overflow-auto rounded-[10px] border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--bg-surface-well)] font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Keep</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">End Date</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Non-Teaching</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {reviewRows.map((row) => (
                  <tr key={row.id} className={row.valid ? 'hover:bg-[var(--bg-surface-hover)]' : 'bg-[var(--status-danger)]/10'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        disabled={!row.valid}
                        onChange={() => toggleSelection(row.id)}
                        className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateDraft(row.id, { date: e.target.value })}
                        className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2 py-1 text-xs text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                      />
                      {row.error && (
                        <p className="mt-1 text-[11px] text-[var(--status-danger)]">{row.error}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.endDate ?? ''}
                        onChange={(e) =>
                          updateDraft(row.id, { endDate: e.target.value || undefined })
                        }
                        className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2 py-1 text-xs text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => updateDraft(row.id, { title: e.target.value })}
                        className="w-44 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2 py-1 text-xs text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.eventType}
                        onChange={(e) => {
                          const nextType = e.target.value as CalendarEventType;
                          updateDraft(row.id, {
                            eventType: nextType,
                            affectsClasses: defaultAffectsClassesForEvent(nextType),
                          });
                        }}
                        className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-well)] px-2 py-1 text-xs text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
                      >
                        {calendarEventTypes.map((type) => (
                          <option key={type} value={type}>
                            {EVENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={row.affectsClasses}
                          onChange={(e) =>
                            updateDraft(row.id, { affectsClasses: e.target.checked })
                          }
                          className="h-3.5 w-3.5 rounded border-[var(--border-subtle)] accent-[var(--primary)]"
                        />
                        <span>Skips classes</span>
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewRows((prev) => prev.filter((r) => r.id !== row.id));
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(row.id);
                            return next;
                          });
                        }}
                        aria-label="Remove imported row"
                        className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--status-danger)]/15 hover:text-[var(--status-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
