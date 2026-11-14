/** Browser-only OCR fallback for image-only PDF pages. Requires an internet connection
 * to load Tesseract.js from the pinned CDN. No document is uploaded to a server. */
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type OcrEngine = { recognize: (image: HTMLCanvasElement, language: string) => Promise<{data:{text:string}}>; terminate:()=>Promise<unknown> };
type OcrLibrary = { createWorker: (language: string) => Promise<OcrEngine> };
declare global { interface Window { Tesseract?: OcrLibrary } }
let loadPromise: Promise<OcrLibrary> | undefined;
function loadOcr(): Promise<OcrLibrary> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!loadPromise) loadPromise = new Promise<OcrLibrary>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library did not initialize'));
    script.onerror = () => reject(new Error('Could not load OCR engine. Check internet connectivity.'));
    document.head.appendChild(script);
  }).catch((err: unknown) => { loadPromise = undefined; throw err; });
  return loadPromise!;
}
export async function readPdfPages(file: File, onProgress?: (status:string)=>void): Promise<Array<{page:number;text:string;items: Array<{x:number;y:number;width:number;height:number;text:string}>}>> {
  const loadingTask = pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())});
  const doc = await loadingTask.promise;
  const pages: Array<{page:number;text:string;items:Array<{x:number;y:number;width:number;height:number;text:string}>}> = [];
  let worker: OcrEngine | undefined;
  try {
    for(let i=1;i<=doc.numPages;i++) {
      onProgress?.(`Reading page ${i} of ${doc.numPages}`);
      const page=await doc.getPage(i);
      const content=await page.getTextContent();
      const items=content.items.filter((item):item is typeof item & {str:string;transform:number[];width:number;height:number}=>'str' in item && Boolean(item.str.trim())).map(item=>({x:item.transform[4]??0,y:item.transform[5]??0,width:item.width,height:item.height,text:item.str}));
      const text=items.map(item=>item.text).join(' ');
      if(text.trim().length >= 45) {pages.push({page:i,text,items});continue;}
      onProgress?.(`OCR scanning page ${i} of ${doc.numPages}`);
      if(!worker) worker=await (await loadOcr()).createWorker('eng');
      const viewport=page.getViewport({scale:2.5});
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d');
      if(!context) throw new Error('Canvas unavailable for OCR');
      await page.render({canvas,canvasContext:context,viewport}).promise;
      const result=await worker.recognize(canvas,'eng');
      pages.push({page:i,text:result.data.text,items:[]});
      canvas.width=0;canvas.height=0;
    }
  } finally { await worker?.terminate();await loadingTask.destroy(); }
  return pages;
}
