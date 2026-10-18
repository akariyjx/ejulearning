export function notesHTML(q,esc){
  const n=q.notes;
  if(q.omitted||!n.example?.length)return `<h3>笔记参考</h3><div class="empty">${esc(n.notice||'原出版物未刊登原文，暂不能给出有原文依据的笔记范例。')}</div>`;
  return `<div class="note-intro"><span class="eyebrow">LISTENING NOTES</span><h3>${esc(n.task)} · 笔记参考</h3><p>${esc(n.guide)}</p></div>
  <section class="note-section"><div class="note-section-title"><span>01</span><h3>笔记范例</h3></div><p class="help">按“关键词＋缩写＋符号”记录，缩进表示同一条信息的展开，红色下划线标出关键条件。</p>${notebookHTML(n,esc)}${n.reference?`<p class="help">对应方法：${esc(n.reference)}</p>`:''}</section>
  <section class="note-section"><div class="note-section-title"><span>02</span><h3>逻辑抓取重点</h3></div>${n.preview?`<div class="preview-guide"><span class="pill">${esc(n.structure)} · ${esc(n.form)}</span>${[['先读图片','scan'],['预设要听的问题','questions'],['听关键词','listen']].map(([title,k])=>`<p><strong>${title}：</strong>${esc(n.preview[k])}</p>`).join('')}</div>`:''}${(n.logic||[]).map(l=>`<div class="note-block"><strong><span lang="ja">${esc(l.marker)}</span> · ${esc(l.title)}</strong><p>${esc(l.focus)}</p><div class="evidence" lang="ja">${esc(l.evidence)}</div></div>`).join('')}<p class="help">逻辑词是定位信号；仍要结合提问对象、条件和完整句意判断答案。</p></section>
  <section class="note-section"><div class="note-section-title"><span>03</span><h3>关键句式</h3></div>${(n.frames||[]).map(f=>`<div class="note-block"><strong lang="ja">${esc(f.jp)}</strong><p>${esc(f.meaning)}</p><div class="evidence" lang="ja">${esc(f.evidence)}</div><p>${esc(f.tip)}</p></div>`).join('')}</section>
  <p class="help">基于原文和此前教学整理生成，供听记对照；扫描识别文字可能有误，请结合原音核对。</p>`;
}
function notebookHTML(n,esc){
  if(!n.notebook)return `<div class="filled-notes">${n.example.map(s=>`<p>${esc(s)}</p>`).join('')}</div>`;
  return `<div class="notebook-example" lang="ja"><div class="notebook-title">${esc(n.notebook.title)}</div>${n.notebook.rows.map(r=>`<div class="notebook-row ${r.key?'note-key ':''}${r.reject?'note-reject':''}" style="--indent:${Math.min(2,Math.max(0,r.indent||0))}"><span>${esc(r.text).replace(/×/g,'<b class="note-cross">×</b>')}</span></div>`).join('')}</div><p class="help">${n.notebook.mode==='edited'?'本题关键词短记示范。':'依据原文抽取并缩写，保留数量与否定；可结合下方原句继续压缩。'}</p>`;
}
