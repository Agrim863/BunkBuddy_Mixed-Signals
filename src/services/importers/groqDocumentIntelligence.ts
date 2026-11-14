import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ParsedCalendarDraft } from './pdfCalendarParser';
import type { ParsedTimetableDraft } from './timetableMapper';
import { getSupabaseClient } from '../data/supabaseClient';
import type { CalendarEventType, SessionType } from '../../types/domain';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type SmartDocumentKind = 'calendar' | 'timetable';
export interface SmartTimetableSession { draft: ParsedTimetableDraft; groups: string[]; evidence?: string }
export interface SmartImportResult { calendar: ParsedCalendarDraft[]; timetable: ParsedTimetableDraft[]; sessions: SmartTimetableSession[]; groups: string[]; warnings: string[]; }
const allowedEvents = new Set<CalendarEventType>(['teaching_day','official_holiday','semester_break','examination','college_event','non_teaching_day','cancelled_class']);
const allowedSessions = new Set<SessionType>(['lecture','lab','tutorial']);
const iso = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const hhmm = (s: unknown) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const mins = (s:string) => Number(s.slice(0,2))*60+Number(s.slice(3));

/** Render pages locally. Only selected page images are sent to the authenticated Edge Function. */
export async function renderPdfForGroq(file:File,kind:SmartDocumentKind,onProgress?:(s:string)=>void):Promise<string[]> {
 if(file.size>15*1024*1024)throw new Error('PDF is too large (15 MB maximum).');
 const loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
 const doc=await loadingTask.promise;
 try {
  if(doc.numPages>30)throw new Error('PDF exceeds 30 pages. Split it before importing.');
  const indices:number[]=[];
  if(kind==='calendar') {for(let i=1;i<=Math.min(doc.numPages,8);i++)indices.push(i);}
  else {
   if(doc.numPages!==1)throw new Error('Upload a single-page PDF containing only your section timetable. Split multi-section PDFs first.');
   indices.push(1);
  }
  const images:string[]=[];
  for(const i of indices){
   onProgress?.(`Rendering page ${i} of ${doc.numPages}`);
   const page=await doc.getPage(i);const viewport=page.getViewport({scale:1.7});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
   await page.render({canvas,canvasContext:ctx,viewport}).promise;
   images.push(canvas.toDataURL('image/jpeg',0.8));canvas.width=0;canvas.height=0;
  }
  return images;
 }finally{await loadingTask.destroy();}
}

export async function groqSmartImport(file:File,kind:SmartDocumentKind,onProgress?:(s:string)=>void):Promise<SmartImportResult>{
 const url=(import.meta.env.VITE_SUPABASE_URL??'').replace(/\/$/,'');
 const anon=(import.meta.env.VITE_SUPABASE_ANON_KEY??'');
 if(!url||!anon)throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Groq Smart Import.');
 const images=await renderPdfForGroq(file,kind,onProgress);
 const result:SmartImportResult={calendar:[],timetable:[],sessions:[],groups:[],warnings:[]};
 const client=getSupabaseClient();
 if(!client)throw new Error('Supabase is not configured.');
 const {data:{session},error:sessionError}=await client.auth.getSession();
 if(sessionError||!session?.access_token)throw new Error('Sign in to BunkBuddy to use Groq Smart Import.');
 for(let i=0;i<images.length;i++){
  onProgress?.(`Groq is interpreting page ${i+1} of ${images.length}`);
  const response=await fetch(`${url}/functions/v1/smart-document-import`,{
   method:'POST',headers:{'Content-Type':'application/json',apikey:anon,Authorization:`Bearer ${session.access_token}`},
   body:JSON.stringify({kind,image:images[i]})
  });
  const payload=await response.json().catch(()=>({error:'Invalid server response'}));
  if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:`Groq import failed (${response.status})`);
  if(Array.isArray(payload.warnings))result.warnings.push(...payload.warnings.filter((v:unknown)=>typeof v==='string'));
  if(kind==='calendar')for(const [j,row] of (Array.isArray(payload.events)?payload.events:[]).entries()){
   if(!iso(row.date)||typeof row.title!=='string'||!row.title.trim())continue;
   const type:CalendarEventType=allowedEvents.has(row.eventType)?row.eventType:'college_event';
   const supported=typeof row.evidence==='string'&&row.evidence.trim().length>0;
   const affectsClasses=supported&&row.affectsClasses===true;
   const title=typeof row.shortTitle==='string'&&row.shortTitle.trim()?row.shortTitle.trim():row.title.trim();
   const evidence=typeof row.evidence==='string'?row.evidence.trim():'';
   const original=typeof row.originalTitle==='string'?row.originalTitle.trim():row.title.trim();
   result.calendar.push({id:`groq-${i}-${j}`,date:row.date,endDate:iso(row.endDate)&&row.endDate>=row.date?row.endDate:undefined,eventType:type,title:title.slice(0,100),description:`Original: ${original.slice(0,160)}${evidence?` | Evidence: ${evidence.slice(0,110)}`:''}`,affectsClasses,sourceInfo:`Page ${i+1}: ${evidence}`,valid:true});
   if(row.affectsClasses===true&&!supported)result.warnings.push(`Page ${i+1}: “${title}” was marked as class-affecting without source evidence; confirm manually.`);
   if(row.reviewRequired===true)result.warnings.push(`Page ${i+1}: Confirm classification for “${title}”.`);
  }
  if(kind==='timetable' && Array.isArray(payload.groups))for(const g of payload.groups){
   if(typeof g==='string' && /^G\d+$/i.test(g) && !result.groups.includes(g.toUpperCase()))result.groups.push(g.toUpperCase());
  }
  if(kind==='timetable')for(const [j,row] of (Array.isArray(payload.sessions)?payload.sessions:[]).entries()){
   if(!Number.isInteger(row.weekday)||row.weekday<0||row.weekday>6||!hhmm(row.startTime)||!hhmm(row.endTime)||mins(row.endTime)<=mins(row.startTime)||typeof row.subjectCode!=='string'||!row.subjectCode.trim())continue;
   const sessionType:SessionType=allowedSessions.has(row.sessionType)?row.sessionType:'lecture';
   const draft:ParsedTimetableDraft={id:`groq-${i}-${j}`,rowNumber:j+1,subjectId:null,subjectName:String(row.subjectName||row.subjectCode),subjectCode:row.subjectCode.toUpperCase(),weekday:row.weekday,startTime:row.startTime,endTime:row.endTime,teachingDurationMinutes:mins(row.endTime)-mins(row.startTime),attendanceUnits:1,sessionType,valid:true};
   const groups:string[]=Array.isArray(row.groups)?row.groups.filter((g:unknown):g is string=>typeof g==='string'&&/^G\d+$/i.test(g)).map((g:string)=>g.toUpperCase()):[];
   for(const g of groups)if(!result.groups.includes(g))result.groups.push(g);
   result.sessions.push({draft,groups,evidence:typeof row.evidence==='string'?row.evidence:undefined});
   result.timetable.push(draft);
  }
 }
 result.groups.sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
 return result;
}
