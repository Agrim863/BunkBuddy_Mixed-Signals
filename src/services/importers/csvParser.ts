export interface TabularData {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * RFC-4180 CSV parser supporting quoted fields, embedded commas, and escaped double quotes.
 */
export function parseCsvText(csvText: string): TabularData {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i]!;
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    matrix.push(row);
  }

  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = matrix[0]!;
  const headers = rawHeaders.map((h, idx) => (h.length > 0 ? h : `Column ${idx + 1}`));
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r]!;
    const record: Record<string, string> = {};
    let hasAnyValue = false;

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c]!;
      const value = (cells[c] ?? '').trim();
      if (value.length > 0) hasAnyValue = true;
      record[header] = value;
    }

    if (hasAnyValue) {
      rows.push(record);
    }
  }

  return { headers, rows };
}

export async function parseCsvFile(file: File): Promise<TabularData> {
  const text = await file.text();
  return parseCsvText(text);
}
