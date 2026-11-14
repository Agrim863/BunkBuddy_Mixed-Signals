import type { Subject } from '../../types/domain';
import { mapRowsToTimetableDrafts, type ParsedTimetableDraft } from './timetableMapper';
import { readPdfPages } from './pdfOcr';

export interface TimetablePdfPage {page:number;section:string;items:Array<{x:number;y:number;width:number;height:number;text:string}>;text:string}
export async function readTimetablePdf(file:File,onProgress?:(s:string)=>void):Promise<TimetablePdfPage[]> {
 const pages=await readPdfPages(file,onProgress);
 return pages.map(p=>({ ...p, section: p.text.match(/(?:Section\s*[-:]\s*)(?:CSE-DA\s*\[)?(A\d+)/i)?.[1]?.toUpperCase() ?? `Page ${p.page}` }));
}
const SUBJECTS:Record<string,string>={DA201:'Design and Analysis of Algorithms',DA203:'Foundations of Data Science',DA205:'Linear Algebra',DA207:'Machine Learning',DA209:'Computer Organization and OS Design',CS203:'Object Oriented Design',CS205:'Design and Analysis of Algorithms',CS207:'Operating System Design',CS209:'Software Engineering'};
const DAYS=['MON','TUE','WED','THUR','FRI'];
function clock(hour:number) {return `${String(hour).padStart(2,'0')}:00`;}
/** Spatial extraction: the row labels and hour headers define a coordinate grid.
 * All extracted sessions remain editable because merged cells and lab alternatives are ambiguous. */
export function parseTimetablePage(page:TimetablePdfPage, group:string, subjects:Subject[]):ParsedTimetableDraft[] {
 const items=page.items;
 if(!items.length) return [];
 const dayLabels=DAYS.map((day,index)=>{
   const item=items.find(t=>t.text.trim().toUpperCase()===day);
   return item?{index,y:item.y}:null;
 }).filter((v):v is {index:number;y:number}=>v!==null).sort((a,b)=>b.y-a.y);
 if(dayLabels.length<3) return [];
 const hourLabels=items.filter(t=>/^\s*(?:8|9|10|11|12|1|2|3|4|5)\s*[-–]{1,2}\s*(?:9|10|11|12|1|2|3|4|5|6)\s*$/.test(t.text));
 const hours=hourLabels.sort((a,b)=>a.x-b.x);
 if(hours.length<7) return [];
 const startX=hours[0]!.x;
 const step=(hours[hours.length-1]!.x-startX)/(hours.length-1);
 const rows:Record<string,string>[]=[];
 for(let d=0;d<dayLabels.length;d++) {
   const label=dayLabels[d]!;
   const upper=d===0?label.y+55:(dayLabels[d-1]!.y+label.y)/2;
   const lower=d===dayLabels.length-1?label.y-55:(label.y+dayLabels[d+1]!.y)/2;
   const fragments=items.filter(t=>t.y<upper&&t.y>lower&&t.x>startX-5&&t.x<startX+step*10);
   // Cluster neighboring PDF text fragments into sessions, allowing multi-line descriptions.
   const clusters:Array<typeof fragments>=[];
   for(const fragment of fragments.sort((a,b)=>b.y-a.y||a.x-b.x)) {
     if(/^\s*(?:8|9|10|11|12|1|2|3|4|5)\s*[-–]/.test(fragment.text))continue;
     const previous=clusters.find(cluster=>cluster.some(c=>Math.abs(c.y-fragment.y)<29 && Math.abs(c.x-fragment.x)<Math.max(35,step*.65)));
     if(previous)previous.push(fragment);else clusters.push([fragment]);
   }
   for(const cluster of clusters) {
     const text=cluster.sort((a,b)=>b.y-a.y||a.x-b.x).map(t=>t.text).join(' ').replace(/\s+/g,' ').trim();
     const matches=[...text.matchAll(/(?:DA|CS)\s*[-–]?\s*(20[13579])/gi)];
     if(!matches.length)continue;
     const batchMarkers=[...text.matchAll(/\bG([123])\b/gi)].map(m=>m[1]);
     // If a cluster lists multiple lab alternatives, choose the code immediately preceding G1/G2/G3.
     const codeByGroup=new Map<string,string>();
     const segmentPattern=/((?:DA|CS)\s*[-–]?\s*20[13579])(?:(?!\b(?:DA|CS)\s*[-–]?\s*20[13579]).){0,160}?\bG([123])\b/gi;
     for(const match of text.matchAll(segmentPattern))codeByGroup.set(match[2]!,match[1]!.replace(/\s|[-–]/g,'').toUpperCase());
     if(batchMarkers.length && !batchMarkers.includes(group.slice(-1)))continue;
     const code=codeByGroup.get(group.slice(-1))??matches[0]![0].replace(/\s|[-–]/g,'').toUpperCase();
     const xs=cluster.map(c=>c.x);
     const left=Math.min(...xs);
     const right=Math.max(...cluster.map(c=>c.x+c.width));
     const from=Math.max(0,Math.min(9,Math.round((left-startX)/step)));
     const to=Math.max(from+1,Math.min(10,Math.ceil((right-startX)/step)));
     const startHour=8+from;
     const endHour=8+to;
     rows.push({subjectName:SUBJECTS[code]??code,subjectCode:code,weekday:String(label.index+1),startTime:clock(startHour),endTime:clock(endHour),attendanceUnits:'1',sessionType:/\blab\b/i.test(text)?'lab':/tutorial/i.test(text)?'tutorial':'lecture'});
   }
 }
 return mapRowsToTimetableDrafts(rows,{subjectName:'subjectName',subjectCode:'subjectCode',weekday:'weekday',startTime:'startTime',endTime:'endTime',attendanceUnits:'attendanceUnits',sessionType:'sessionType'},subjects);
}
