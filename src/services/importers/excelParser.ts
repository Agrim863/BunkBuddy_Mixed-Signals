import type { TabularData } from './csvParser';

export async function parseExcelFile(file: File): Promise<TabularData> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  const nonEmptyRows = matrix.filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim().length > 0),
  );

  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = nonEmptyRows[0]!;
  const headers = rawHeaders.map((cell, idx) => {
    const text = String(cell ?? '').trim();
    return text.length > 0 ? text : `Column ${idx + 1}`;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmptyRows.length; r++) {
    const rowCells = nonEmptyRows[r]!;
    const record: Record<string, string> = {};
    let hasValue = false;

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c]!;
      const val = String(rowCells[c] ?? '').trim();
      if (val.length > 0) hasValue = true;
      record[header] = val;
    }

    if (hasValue) {
      rows.push(record);
    }
  }

  return { headers, rows };
}
