import {wordbookButton,originFor} from './wordbook.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['专业术语与主题词','少见表达','进阶词','基础复习'];

export function renderWordReview(q){
  if(!q.words?.length)return `<h3>本题重点生词</h3><div class="empty">${q.omitted?'原文未刊登，无法可靠提取本题生词。':'本题暂无已核对的释义词条。'}</div>`;
  return `<h3>本题重点生词 <span class="pill">${q.words.length} 条</span></h3><p class="help">优先复习专业术语、少见表达与进阶词。展开“本题原句”查看实际词形及语境；同一词在本题只列一次。</p>`+categories.map(category=>{
    const words=q.words.filter(w=>(w.category||'基础复习')===category);
    if(!words.length)return '';
    return `<section class="vocabulary-group" aria-label="${category}"><div class="vocabulary-group-title"><h4>${category}</h4><span>${words.length} 条</span></div><div class="word-list">${words.map(w=>`<article class="word"><strong lang="ja">${esc(w.jp)}</strong><span class="reading" lang="ja">${esc(w.reading)}</span><span class="word-origin">${esc(originFor(w))}</span><p>${esc(w.meaning)}</p>${wordbookButton(w,q.words.indexOf(w))}${w.tip?`<small>${esc(w.tip)}</small>`:''}${w.contexts?.length?`<details class="word-context"><summary>本题原句${w.forms?.length>1?` · ${w.forms.length} 种词形`:''}</summary>${w.contexts.map(c=>`<div><span class="word-context-kind">${esc(c.kind)} · ${esc(c.surface)}</span><p lang="ja">${esc(c.text)}</p></div>`).join('')}</details>`:''}</article>`).join('')}</div></section>`;
  }).join('');
}

// Refresh previously confirmed/imported dictation using the same source-bound
// spans as the review. Keep drafts, judgement and completion timestamps intact.
export function refreshConfirmedVocabulary(result,q){
  if(!result)return result;
  const sentence=q.sentenceVocabulary?.find(s=>s.text===result.text);
  if(!sentence)return result;
  const entries=new Map(q.words.map(w=>[w.id,w]));let last=0;
  const words=sentence.words.flatMap(span=>{
    const w=entries.get(span.id);
    if(!w||span.start<last||span.end>result.text.length||result.text.slice(span.start,span.end)!==span.surface)return [];
    last=span.end;
    return [{...span,...Object.fromEntries(['jp','reading','meaning','tip','category','group'].map(k=>[k,w[k]||'']))}];
  });
  return {...result,words,vocabularyVersion:q.vocabularyVersion};
}
