import {apiFetch} from './transport.js';
import {WORDBOOK_KEY,ORIGINS,wordKey,emptyWordbook,validateWordbook,collectWord,editWord,mergeWordbooks} from './wordbook-core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let origins={},cachedRaw=null,cachedBook=null;
export async function loadWordOrigins(){try{const r=await apiFetch('data/word-origins.json');if(r.ok)origins=(await r.json()).words||{};}catch{}}
export function originFor(w){return w.origin||origins[w.id||w.jp]?.origin||'待确认';}
export function readWordbook(){try{const raw=localStorage.getItem(WORDBOOK_KEY)||'null';if(raw===cachedRaw&&cachedBook)return cachedBook;cachedRaw=raw;cachedBook=validateWordbook(JSON.parse(raw));return cachedBook;}catch{return emptyWordbook();}}
function write(book,notify){try{localStorage.setItem(WORDBOOK_KEY,JSON.stringify(book));window.dispatchEvent(new CustomEvent('eju-wordbook-change'));return true;}catch{notify('生词本未能保存，请先导出备份或检查浏览器空间。');return false;}}
export const exportWordbook=()=>readWordbook();
export function importWordbook(data,notify){if(data)return write(mergeWordbooks(readWordbook(),data),notify);return true;}
const label=q=>`${q.paper?.slice(0,4)} 年第 ${q.paper?.at(-1)} 回 · ${q.section==='聴解'?'听解':'听读解'} ${q.number}`;
export function wordbookButton(w,index){const saved=readWordbook().words[wordKey(w.id||w.jp)]?.marked;return `<button type="button" class="word-mark ${saved?'saved':''}" data-book-word="${index}" aria-label="${saved?'补充生词本例句':'标注不认识的词'} ${esc(w.jp)}">${saved?'★ 已收录':'☆ 不认识，收入生词本'}</button>`;}
export function saveUnknown(w,q,context,notify){
 const source={qid:q.id,label:label(q),surface:w.surface||w.forms?.[0]||w.jp,context:context||w.contexts?.[0]?.text||''};
 if(write(collectWord(readWordbook(),{...w,origin:originFor(w)},source),notify))notify('已收入生词本 · '+w.jp);
}
export function bindWordMarks(root,q,notify){root.querySelectorAll('[data-book-word]').forEach(b=>b.onclick=()=>{const w=q.words[Number(b.dataset.bookWord)];if(!w)return;saveUnknown(w,q,null,notify);b.classList.add('saved');b.textContent='★ 已收录';b.setAttribute('aria-label','补充生词本例句 '+w.jp);});}

export function openWordEditor(w,notify,{q=null,context='',onSaved=()=>{}}={}){
 document.querySelector('#word-editor')?.remove();const dialog=document.createElement('dialog');dialog.id='word-editor';dialog.className='word-editor';
 dialog.innerHTML=`<form><div class="dialog-heading"><h3>${q?'标注不认识的词':'编辑生词'}</h3><button type="button" class="context-link" data-close>关闭</button></div><label>日语词或短语<input name="jp" required maxlength="100" lang="ja" value="${esc(w.jp)}"></label><label>读音<input name="reading" maxlength="150" lang="ja" value="${esc(w.reading)}"></label><label>中文释义<textarea name="meaning" maxlength="600" rows="2" placeholder="词库未收录的词，可以自行补充释义。">${esc(w.meaning)}</textarea></label><label>词语分类<select name="origin">${ORIGINS.map(o=>`<option ${originFor(w)===o?'selected':''}>${o}</option>`).join('')}</select></label><p class="help">汉语词、和语词按词源整理；汉字写法不等于汉语词。分类可自行调整。</p><button class="btn primary" type="submit">保存到生词本</button></form>`;
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const form=new FormData(e.currentTarget),jp=String(form.get('jp')).trim();if(!jp)return;
  const entry={...w,jp,reading:String(form.get('reading')).trim(),meaning:String(form.get('meaning')).trim(),origin:String(form.get('origin'))};
  let book=readWordbook();const id=q&&w.custom&&jp!==w.jp?jp:w.id||jp;
  if(q)book=collectWord(book,{...entry,id}, {qid:q.id,label:label(q),context,surface:w.surface||jp});
  else if(jp!==w.jp)entry.jp=jp;
  book=editWord(book,id,{...entry,originManual:true});if(write(book,notify)){dialog.close();onSaved();notify('生词已保存');}
 };dialog.showModal();
}
export function bindSelectedWord(root,q,notify){
 const button=root.querySelector('#mark-selected-word'),textRoot=root.querySelector('.transcript');if(!button||!textRoot)return ()=>{};
 let selected='',context='';
 const changed=()=>{const s=window.getSelection();if(s?.rangeCount&&textRoot.contains(s.anchorNode)&&textRoot.contains(s.focusNode)){selected=s.toString().trim();context=s.anchorNode.parentElement?.closest('p')?.textContent||selected;button.disabled=!selected||selected.length>100;button.textContent=selected&&selected.length<=100?'标注：'+selected:'标注选中的词';}};
 document.addEventListener('selectionchange',changed);button.onpointerdown=e=>e.preventDefault();button.onclick=()=>{if(!selected)return;const found=q.words.find(w=>w.jp.split(/[／/]/).includes(selected)||w.forms?.includes(selected));openWordEditor(found||{jp:selected,id:selected,custom:true},notify,{q,context,onSaved:()=>bindWordMarks(root,q,notify)});};
 return ()=>document.removeEventListener('selectionchange',changed);
}
export function wordbookHTML({origin='all',status='all',search=''}={}){
 const all=Object.values(readWordbook().words).filter(w=>w.marked),visible=all.filter(w=>(origin==='all'||w.origin===origin)&&(status==='all'||w.status===status)&&[w.jp,w.reading,w.meaning].join(' ').toLowerCase().includes(search.toLowerCase()));
 return `<div class="wordbook-controls"><div class="segmented" aria-label="生词分类">${['all',...ORIGINS].map(o=>`<button data-origin="${o}" class="${origin===o?'active':''}">${o==='all'?'全部':o} <small>${all.filter(w=>o==='all'||w.origin===o).length}</small></button>`).join('')}</div><div class="toolbar"><input id="wordbook-search" type="search" placeholder="搜索日语、读音或中文" aria-label="搜索生词" value="${esc(search)}"><label class="field">复习状态 <select id="wordbook-status">${[['all','全部'],['learning','待复习'],['mastered','已掌握']].map(([v,t])=>`<option value="${v}" ${v===status?'selected':''}>${t}</option>`).join('')}</select></label></div></div><p class="help">共收录 ${all.length} 个词 · 当前显示 ${visible.length} 个。相同词条合并，保留来源题目和原句。</p>${visible.length?ORIGINS.map(o=>{const ws=visible.filter(w=>w.origin===o).sort((a,b)=>a.reading.localeCompare(b.reading,'ja'));return ws.length?`<section class="vocabulary-group"><div class="vocabulary-group-title"><h3>${o}</h3><span>${ws.length} 个</span></div><div class="word-list">${ws.map(w=>`<article class="word book-entry"><strong lang="ja">${esc(w.jp)}</strong><span class="reading" lang="ja">${esc(w.reading)}</span><p>${esc(w.meaning||'尚未填写释义')}</p><div class="book-actions"><button class="context-link" data-edit-word="${esc(w.id)}">编辑释义／分类</button><button class="btn" data-mastered="${esc(w.id)}">${w.status==='mastered'?'✓ 已掌握 · 改为待复习':'标记已掌握'}</button><button class="context-link" data-remove-word="${esc(w.id)}">移出</button></div>${w.sources.length?`<details class="word-context"><summary>来源与例句 · ${w.sources.length}</summary>${w.sources.map(s=>`<div><button class="context-link" data-word-source="${esc(s.qid)}">${esc(s.label)} →</button><p lang="ja">${esc(s.context)}</p></div>`).join('')}</details>`:''}</article>`).join('')}</div></section>`:'';}).join(''):'<div class="empty">这里还没有生词。<br>提交真题后，在“重点生词”中点☆，或在原文里选中词语进行标注。</div>'}`;
}
export function bindWordbookPage(root,{notify,onChange,onSource}){
 root.querySelectorAll('[data-edit-word]').forEach(b=>b.onclick=()=>openWordEditor(readWordbook().words[wordKey(b.dataset.editWord)],notify,{onSaved:onChange}));
 root.querySelectorAll('[data-mastered]').forEach(b=>b.onclick=()=>{const book=readWordbook(),w=book.words[wordKey(b.dataset.mastered)];if(write(editWord(book,w.id,{status:w.status==='mastered'?'learning':'mastered'}),notify))onChange();});
 root.querySelectorAll('[data-remove-word]').forEach(b=>b.onclick=()=>{if(write(editWord(readWordbook(),b.dataset.removeWord,{marked:false}),notify)){onChange();notify('已移出；可在原题再次标注。');}});
 root.querySelectorAll('[data-word-source]').forEach(b=>b.onclick=()=>onSource(b.dataset.wordSource));
}
