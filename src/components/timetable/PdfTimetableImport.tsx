import { useMemo, useState } from 'react';
import { groqSmartImport, type SmartTimetableSession } from '../../services/importers/groqDocumentIntelligence';
import type { Subject } from '../../types/domain';
import { readTimetablePdf, parseTimetablePage, type TimetablePdfPage } from '../../services/importers/pdfTimetableParser';
import type { ParsedTimetableDraft } from '../../services/importers/timetableMapper';
import { getWeekdayShortName } from '../../utils/weekdays';

const minutes = (time:string) => { const [h,m]=time.split(':').map(Number); return h*60+m; };
const groupPattern=/\bG\d+\b/gi;

export function PdfTimetableImport({subjects,onConfirm}:{subjects:Subject[];onConfirm:(rows:ParsedTimetableDraft[])=>void}) {
 const [useGroq,setUseGroq]=useState(true);
 const [warnings,setWarnings]=useState<string[]>([]);
 const [sessions,setSessions]=useState<SmartTimetableSession[]>([]);
 const [groups,setGroups]=useState<string[]>([]);
 const [group,setGroup]=useState('');
 const [busy,setBusy]=useState('');const [error,setError]=useState('');
 const [ready,setReady]=useState(false);
 const [fileName,setFileName]=useState('');
 const visible=useMemo(()=>sessions.filter(s=>!s.groups.length||!group||s.groups.includes(group)),[sessions,group]);
 const selectedGroupRequired=groups.length>1&&!group;
 const edit=(id:string,patch:Partial<ParsedTimetableDraft>)=>setSessions(old=>old.map(s=>s.draft.id===id?{...s,draft:{...s.draft,...patch}}:s));
 const remove=(id:string)=>setSessions(old=>old.filter(s=>s.draft.id!==id));
 async function upload(file:File|undefined){
  if(!file)return;
  setBusy('Reading document');setError('');setWarnings([]);setSessions([]);setGroups([]);setGroup('');setReady(false);setFileName(file.name);
  try {
   if(useGroq){
    const result=await groqSmartImport(file,'timetable',setBusy);
    setSessions(result.sessions);setGroups(result.groups);setGroup(result.groups.length===1?result.groups[0]!:'');setWarnings(result.warnings);
    if(!result.sessions.length)setError('No valid sessions detected. Try the local PDF parser or check the document.');
   }else{
    const pages:TimetablePdfPage[]=await readTimetablePdf(file,setBusy);
    if(pages.length!==1)throw new Error('Upload a single-page timetable PDF for your section.');
    const page=pages[0]!;
    const detected=[...new Set((page.text.match(groupPattern)||[]).map(g=>g.toUpperCase()))].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
    const all=detected.length?detected:[''];
    const byId=new Map<string,SmartTimetableSession>();
    // The local parser is a fallback for selectable-text PDFs; it may not reliably identify merged cells.
    for(const g of all){
     const parsed=parseTimetablePage(page,g,subjects);
     for(const row of parsed){
      const key=[row.weekday,row.startTime,row.endTime,row.subjectCode,row.sessionType].join('|');
      const existing=byId.get(key);
      if(existing){if(g&&!existing.groups.includes(g))existing.groups.push(g);}
      else byId.set(key,{draft:{...row,id:`local-${byId.size}`},groups:g?[g]:[]});
     }
    }
    const mapped=[...byId.values()];
    // Classes found in all groups are shared; only group-specific alternatives retain labels.
    for(const item of mapped)if(detected.length&&item.groups.length===detected.length)item.groups=[];
    setSessions(mapped);setGroups(detected);setGroup(detected.length===1?detected[0]!:'');
    setWarnings(['Local coordinate extraction is experimental. Check weekday, time and lab group carefully.']);
    if(!mapped.length)setError('No timetable sessions detected in selectable text. Try Groq Vision.');
   }
   setReady(true);
  }catch(e){setError(e instanceof Error?e.message:'Unable to read PDF');}
  finally{setBusy('');}
 }
 const invalid=visible.some(s=>!s.draft.subjectCode.trim()||!s.draft.subjectName.trim()||s.draft.weekday===null||minutes(s.draft.endTime)<=minutes(s.draft.startTime));
 return <div className="space-y-4">
  <div>
   <h4 className="text-sm font-semibold text-[var(--text-main)]">Intelligent PDF timetable import</h4>
   <p className="mt-1 text-xs text-[var(--text-muted)]">Upload a one-section PDF. BunkBuddy discovers lab groups automatically and lets you review every slot before saving.</p>
  </div>
  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={useGroq} onChange={e=>setUseGroq(e.target.checked)} disabled={Boolean(busy)}/> Use Groq Vision for intelligent extraction (sends document image to Groq)</label>
  <label className="inline-block cursor-pointer rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-main)]">{busy||'Upload one-section timetable PDF'}<input type="file" accept=".pdf" disabled={Boolean(busy)} className="hidden" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
  {fileName&&<p className="text-xs text-[var(--text-muted)]">{fileName}</p>}
  {error&&<p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p>}
  {warnings.map((w,i)=><p className="text-xs text-[var(--status-warning)]" key={i}>Review: {w}</p>)}
  {ready&&groups.length>1&&<div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-well)] p-3">
   <p className="text-sm font-semibold text-[var(--text-main)]">{groups.length} lab groups detected — choose yours</p>
   <div className="flex flex-wrap gap-2">{groups.map(g=><button type="button" key={g} aria-pressed={group===g} onClick={()=>setGroup(g)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${group===g?'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]':'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>{g}</button>)}</div>
   <p className="text-xs text-[var(--text-muted)]">Shared lectures are included for every group. Switching groups does not call Groq again.</p>
  </div>}
  {ready&&groups.length===0&&<p className="text-xs text-[var(--text-muted)]">No separate lab groups detected. Review the shared timetable below.</p>}
  {ready&&!selectedGroupRequired&&<>
   <p className="text-xs text-[var(--text-secondary)]">{visible.length} proposed slots. Edit incorrect subjects and times, or remove entries before importing.</p>
   <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border-subtle)]"><table className="w-full text-left text-xs text-[var(--text-main)]"><thead className="bg-[var(--bg-well)]"><tr>{['Day','Code','Subject','Start','End','Type','Remove'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(({draft:r})=><tr key={r.id} className="border-t border-[var(--border-subtle)]"><td className="p-2"><select aria-label="Weekday" className="bg-[var(--bg-card)]" value={r.weekday??1} onChange={e=>edit(r.id,{weekday:Number(e.target.value)})}>{[1,2,3,4,5,6,0].map(day=><option key={day} value={day}>{getWeekdayShortName(day)}</option>)}</select></td><td><input aria-label="Subject code" className="w-20 bg-transparent p-1" value={r.subjectCode} onChange={e=>edit(r.id,{subjectCode:e.target.value.toUpperCase(),subjectId:null})}/></td><td><input aria-label="Subject name" className="min-w-40 bg-transparent p-1" value={r.subjectName} onChange={e=>edit(r.id,{subjectName:e.target.value,subjectId:null})}/></td><td><input aria-label="Start time" type="time" value={r.startTime} onChange={e=>edit(r.id,{startTime:e.target.value,teachingDurationMinutes:Math.max(0,minutes(r.endTime)-minutes(e.target.value))})}/></td><td><input aria-label="End time" type="time" value={r.endTime} onChange={e=>edit(r.id,{endTime:e.target.value,teachingDurationMinutes:Math.max(0,minutes(e.target.value)-minutes(r.startTime))})}/></td><td><select aria-label="Session type" className="bg-[var(--bg-card)]" value={r.sessionType} onChange={e=>edit(r.id,{sessionType:e.target.value as ParsedTimetableDraft['sessionType']})}>{['lecture','lab','tutorial'].map(t=><option key={t}>{t}</option>)}</select></td><td><button type="button" aria-label="Remove row" className="p-2 text-[var(--status-danger)]" onClick={()=>remove(r.id)}>×</button></td></tr>)}</tbody></table></div>
   <button type="button" className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!visible.length||invalid} onClick={()=>{onConfirm(visible.map(s=>({...s.draft,valid:true})));setSessions([]);setGroups([]);setGroup('');setReady(false);}}>Import {visible.length} reviewed slots</button>
  </>}
 </div>;
}
