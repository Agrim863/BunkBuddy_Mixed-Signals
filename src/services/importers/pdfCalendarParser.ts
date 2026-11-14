import type { CalendarEventType } from '../../types/domain';
import { readPdfPages } from './pdfOcr';
import {
  classifyCalendarEventType,
  getDefaultAffectsClasses,
  normalizeDateString,
} from './dateNormalizer';

export interface ParsedCalendarDraft {
  id: string;
  date: string;
  endDate?: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  affectsClasses: boolean;
  sourceInfo: string;
  valid: boolean;
  error?: string;
}

const DATE_PATTERN =
  /(\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b)/gi;

export function extractCalendarEventsFromLines(
  lines: string[],
  sourceLabel = 'PDF',
): ParsedCalendarDraft[] {
  const drafts: ParsedCalendarDraft[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const matches = line.match(DATE_PATTERN);
    if (!matches || matches.length === 0) continue;

    const startRaw = matches[0]!;
    const endRaw = matches.length > 1 ? matches[1] : undefined;

    const date = normalizeDateString(startRaw);
    if (!date) continue;

    const endDate = endRaw ? normalizeDateString(endRaw) ?? undefined : undefined;

    let title = line
      .replace(startRaw, '')
      .replace(endRaw ?? '', '')
      .replace(/\b(to|till|until|-|–|—|:)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (title.length < 2) {
      title = 'Academic Calendar Event';
    }

    const eventType = classifyCalendarEventType(line);
    const affectsClasses = getDefaultAffectsClasses(eventType);

    drafts.push({
      id: `pdf-${i}-${crypto.randomUUID().slice(0, 6)}`,
      date,
      endDate: endDate && endDate >= date ? endDate : undefined,
      eventType,
      title: title.slice(0, 100),
      description: `Extracted from ${sourceLabel}`,
      affectsClasses,
      sourceInfo: line,
      valid: true,
    });
  }

  return drafts;
}

/** Parses both selectable-text and scanned PDF calendars. Dates are suggestions until reviewed. */
export async function parsePdfCalendarFile(file: File, onProgress?: (message:string)=>void): Promise<{
  drafts: ParsedCalendarDraft[];
  rawLineCount: number;
}> {
  const pages=await readPdfPages(file,onProgress);
  const lines:string[]=[];
  for(const page of pages) {
    if(page.items.length) {
      const rows=new Map<number,Array<{x:number;text:string}>>();
      for(const item of page.items) {
        const y=Math.round(item.y/4)*4;
        const bucket=rows.get(y)??[];bucket.push({x:item.x,text:item.text});rows.set(y,bucket);
      }
      for(const y of [...rows.keys()].sort((a,b)=>b-a)) lines.push(rows.get(y)!.sort((a,b)=>a.x-b.x).map(t=>t.text).join(' '));
    } else {
      // Scanned table: the event name is often on the preceding OCR line.
      const scanned=page.text.split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
      for(let i=0;i<scanned.length;i++) {
        const line=scanned[i]!;
        const dates=line.match(DATE_PATTERN);
        if(dates && line.replace(DATE_PATTERN,'').trim().length<12 && i>0) {
          lines.push(`${scanned[i-1]} ${line}`);
        } else lines.push(line);
      }
    }
  }
  const drafts=extractCalendarEventsFromLines(lines,file.name);
  // Interpret calendar wording conservatively: online teaching and festivals do not
  // automatically suspend classes; examinations require confirmation.
  for(const draft of drafts) {
    const label=draft.title.toLowerCase();
    if(/teaching (ends|commence)|commencement of teaching|classes in online mode/i.test(label)) {
      draft.eventType='teaching_day';draft.affectsClasses=false;
    } else if(/vacation|teaching suspended/i.test(label)) {
      draft.eventType='semester_break';draft.affectsClasses=true;
    } else if(/arena|aahvan|sports|festival/i.test(label)) {
      draft.eventType='college_event';draft.affectsClasses=false;
    } else if(/exam|examination/i.test(label)) {
      draft.eventType='examination';draft.affectsClasses=false;
      draft.description='Exam period: confirm whether regular teaching is suspended.';
    }
  }
  return {drafts,rawLineCount:lines.length};
}
