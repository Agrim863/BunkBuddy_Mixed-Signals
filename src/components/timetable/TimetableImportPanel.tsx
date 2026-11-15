import { useState } from 'react';
import { PdfTimetableImport } from './PdfTimetableImport';
import { AlertCircle, Check, FileSpreadsheet, Upload } from 'lucide-react';
import { parseCsvFile, type TabularData } from '../../services/importers/csvParser';
import { parseExcelFile } from '../../services/importers/excelParser';
import {
  guessTimetableColumnMapping,
  mapRowsToTimetableDrafts,
  type ParsedTimetableDraft,
  type TimetableColumnMapping,
} from '../../services/importers/timetableMapper';
import { getWeekdayShortName } from '../../utils/weekdays';
import type { Subject } from '../../types/domain';
import { Badge, Button, Select } from '../ui';

interface TimetableImportPanelProps {
  existingSubjects: Subject[];
  onConfirmImport: (validRows: ParsedTimetableDraft[]) => void;
}

export function TimetableImportPanel({
  existingSubjects,
  onConfirmImport,
}: TimetableImportPanelProps) {
  const [activeImport, setActiveImport] = useState<'pdf' | 'spreadsheet'>('pdf');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tabular, setTabular] = useState<TabularData | null>(null);
  const [mapping, setMapping] = useState<TimetableColumnMapping | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedTimetableDraft[]>([]);

  const recompute = (data: TabularData, nextMapping: TimetableColumnMapping) => {
    setPreviewRows(mapRowsToTimetableDrafts(data.rows, nextMapping, existingSubjects));
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);
    setFileName(file.name);
    setTabular(null);
    setMapping(null);
    setPreviewRows([]);

    try {
      const lower = file.name.toLowerCase();
      let data: TabularData;
      if (lower.endsWith('.csv')) {
        data = await parseCsvFile(file);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        data = await parseExcelFile(file);
      } else {
        setErrorMsg('Please select a .csv, .xlsx, or .xls timetable file.');
        return;
      }

      if (data.rows.length === 0) {
        setErrorMsg('The uploaded file contains no timetable data rows.');
        return;
      }

      const guessed = guessTimetableColumnMapping(data.headers);
      setTabular(data);
      setMapping(guessed);
      recompute(data, guessed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const validRows = previewRows.filter((r) => r.valid);

  return (
    <div className="space-y-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
      <div role="tablist" aria-label="Timetable import format" className="flex gap-1 rounded-xl bg-[var(--bg-well)] p-1">
        <button type="button" role="tab" aria-selected={activeImport==='pdf'} onClick={()=>setActiveImport('pdf')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeImport==='pdf'?'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm':'text-[var(--text-muted)]'}`}>Smart PDF</button>
        <button type="button" role="tab" aria-selected={activeImport==='spreadsheet'} onClick={()=>setActiveImport('spreadsheet')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeImport==='spreadsheet'?'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm':'text-[var(--text-muted)]'}`}>CSV / Excel</button>
      </div>
      {activeImport==='pdf' ? <PdfTimetableImport subjects={existingSubjects} onConfirm={onConfirmImport} /> : <>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-main)]">
            Import Timetable from CSV / Excel
          </h4>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Map columns, validate times &amp; attendance units, and auto-link matching subjects.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--accent-primary)] transition-all duration-150 hover:bg-[var(--accent-primary)]/20 active:scale-[0.98]">
          <Upload className="h-3.5 w-3.5" />
          <span>{loading ? 'Reading...' : 'Upload CSV / Excel'}</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={loading}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 p-3 text-xs text-[var(--status-danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-danger)]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {tabular && mapping && (
        <div className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-well)] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
              <FileSpreadsheet className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Map Columns ({fileName})</span>
            </div>
            <Badge variant={validRows.length > 0 ? 'success' : 'warning'}>
              {validRows.length} / {previewRows.length} valid
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['subjectName', 'Subject Name'],
                ['subjectCode', 'Subject Code'],
                ['weekday', 'Weekday *'],
                ['startTime', 'Start Time *'],
                ['endTime', 'End Time *'],
                ['attendanceUnits', 'Attendance Units'],
                ['sessionType', 'Session Type'],
              ] as const
            ).map(([field, label]) => (
              <Select
                key={field}
                label={label}
                value={mapping[field]}
                onChange={(e) => {
                  const next = { ...mapping, [field]: e.target.value };
                  setMapping(next);
                  recompute(tabular, next);
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

          <div className="max-h-60 overflow-auto rounded-[10px] border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--bg-card)] font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Units</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
                {previewRows.map((row) => (
                  <tr key={row.id} className={row.valid ? 'hover:bg-[var(--bg-surface-hover)]' : 'bg-[var(--status-danger-bg)]'}>
                    <td className="px-3 py-2 font-mono tabular-nums text-[var(--text-muted)]">
                      {row.rowNumber}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-[var(--text-main)]">
                        {row.subjectName || '—'}
                      </span>{' '}
                      {row.subjectCode && (
                        <span className="font-mono text-[var(--text-muted)]">({row.subjectCode})</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.weekday !== null ? getWeekdayShortName(row.weekday) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {row.startTime || '—'} – {row.endTime || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {row.teachingDurationMinutes > 0
                        ? `${row.teachingDurationMinutes} min`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.attendanceUnits}</td>
                    <td className="px-3 py-2 capitalize">{row.sessionType}</td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        <Badge variant="success">Valid</Badge>
                      ) : (
                        <span className="text-[11px] font-medium text-[var(--status-danger)]">
                          {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTabular(null);
                setMapping(null);
                setPreviewRows([]);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={validRows.length === 0}
              leftIcon={<Check className="h-3.5 w-3.5" />}
              onClick={() => {
                onConfirmImport(validRows);
                setTabular(null);
                setMapping(null);
                setPreviewRows([]);
              }}
            >
              Import {validRows.length} Valid Slot{validRows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
