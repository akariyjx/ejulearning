export const WORDBOOK_KEY='eju-listening:wordbook:v1';
export const ORIGINS=['汉语词','和语词','外来词','混合表达','待确认'];
export const wordKey=jp=>'w:'+String(jp||'').normalize('NFKC').trim();
export const emptyWordbook=()=>({version:1,words:{}});
const safeText=(s,n)=>typeof s==='string'?s.slice(0,n):'';
export function validateWordbook(data){
 const clean=emptyWordbook();if(!data||data.version!==1||!data.words||typeof data.words!=='object'||Array.isArray(data.words))return clean;
 for(const r of Object.values(data.words)){
  if(!r||typeof r.id!=='string'||!r.id.trim()||r.id.length>100||typeof r.jp!=='string'||!r.jp.trim()||r.jp.length>150||!Number.isFinite(Date.parse(r.updatedAt)))continue;
  const sources=(Array.isArray(r.sources)?r.sources:[]).filter(s=>s&&/^20\d{2}-[12]-(聴解|聴読解)-\d{1,2}$/.test(s.qid)).slice(0,12).map(s=>({qid:s.qid,label:safeText(s.label,100),context:safeText(s.context,900),surface:safeText(s.surface,100)}));
  clean.words[wordKey(r.id)]={id:r.id,jp:r.jp,reading:safeText(r.reading,150),meaning:safeText(r.meaning,600),tip:safeText(r.tip,600),origin:ORIGINS.includes(r.origin)?r.origin:'待确认',originManual:!!r.originManual,marked:r.marked!==false,status:r.status==='mastered'?'mastered':'learning',createdAt:Number.isFinite(Date.parse(r.createdAt))?r.createdAt:r.updatedAt,updatedAt:r.updatedAt,sources};
 }
 return clean;
}
export function collectWord(book,w,source,at=new Date().toISOString()){
 const id=String(w.id||w.jp).normalize('NFKC').trim(),key=wordKey(id);if(!id||id.length>100)throw Error('请选择一个词或短语，长度不超过100字。');
 const old=book.words[key],sources=[...(old?.sources||[])];
 if(source&&!sources.some(s=>s.qid===source.qid&&s.context===source.context))sources.push(source);
 return {...book,words:{...book.words,[key]:{...old,id,jp:w.jp||id,reading:w.reading||old?.reading||'',meaning:w.meaning||old?.meaning||'',tip:w.tip||old?.tip||'',origin:old?.originManual?old.origin:w.origin||old?.origin||'待确认',originManual:!!old?.originManual,marked:true,status:old?.status||'learning',createdAt:old?.createdAt||at,updatedAt:at,sources:sources.slice(-12)}}};
}
export function editWord(book,id,changes,at=new Date().toISOString()){
 const key=wordKey(id),old=book.words[key];if(!old)return book;
 const merged={...old,...changes,id:old.id,updatedAt:at};return validateWordbook({...book,words:{...book.words,[key]:merged}});
}
export function mergeWordbooks(current,incoming){
 const clean=validateWordbook(incoming),words={...current.words};
 for(const [key,r] of Object.entries(clean.words)){
  const old=words[key];if(!old){words[key]=r;continue;}
  const latest=r.updatedAt>old.updatedAt?r:old;
  const sources=[...old.sources,...r.sources].filter((s,i,all)=>all.findIndex(a=>a.qid===s.qid&&a.context===s.context)===i).slice(-12);
  words[key]={...latest,sources};
 }
 return {version:1,words};
}
