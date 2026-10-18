import {apiFetch,mediaAttributes,hydrateMedia,waitMedia,isRemote} from './transport.js';
import {refreshConfirmedVocabulary} from './vocabulary.js';
import {wordbookButton,saveUnknown} from './wordbook.js';
import {shouldShowOriginal,hintHTML,sanitizeHint} from './sentence-hints.js';
const KEY='eju-listening:intensive:v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=null;
function read(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');return d&&typeof d==='object'&&!Array.isArray(d)?d:{};}catch{return {};}}
function store(key,state,notify){try{const all=read();all[key]=state;localStorage.setItem(KEY,JSON.stringify(all));}catch{notify('精听记录未能保存，请检查浏览器存储空间。');}}
export function exportIntensive(){return {version:1,questions:read()};}
export function importIntensive(data){
  if(!data||data.version!==1||!data.questions)return;
  const all=read();
  for(const [key,s] of Object.entries(data.questions)){
    if(!/^20\d{2}-[12]-[LR]-\d{1,2}$/.test(key)||!s||!/^[a-f0-9]{16}$/.test(s.fingerprint||'')||!s.answers)continue;
    const clean={fingerprint:s.fingerprint,index:Number.isInteger(s.index)?s.index:0,scope:s.scope==='all'?'all':'body',answers:{}};
    for(const [n,a] of Object.entries(s.answers)){
      if(!/^\d{1,3}$/.test(n)||!a||typeof a.draft!=='string')continue;
      clean.answers[n]={draft:a.draft.slice(0,1200),at:typeof a.at==='string'?a.at:'',self:a.self==='match'?'match':null,revealed:a.revealed===true};
      if(a.result&&typeof a.result.text==='string'&&a.result.feedback&&['match','review','retry'].includes(a.result.feedback.status)){
        const text=a.result.text.slice(0,3000);
        const words=(Array.isArray(a.result.words)?a.result.words:[]).filter(w=>w&&Number.isInteger(w.start)&&Number.isInteger(w.end)&&w.start>=0&&w.end>w.start&&w.end<=text.length&&typeof w.meaning==='string').slice(0,100).map(w=>({start:w.start,end:w.end,surface:text.slice(w.start,w.end),jp:String(w.jp||'').slice(0,100),reading:String(w.reading||'').slice(0,100),meaning:w.meaning.slice(0,300),tip:String(w.tip||'').slice(0,300)}));
        clean.answers[n].result={text,feedback:{status:a.result.feedback.status,title:String(a.result.feedback.title||'核对结果').slice(0,80),message:String(a.result.feedback.message||'').slice(0,500)},words,hint:sanitizeHint(a.result.hint)};
      }
    }
    if(all[key]?.fingerprint===clean.fingerprint){
      for(const [n,a] of Object.entries(all[key].answers||{}))if(!clean.answers[n]||a.at>clean.answers[n].at)clean.answers[n]=a;
    }
    all[key]=clean;
  }
  localStorage.setItem(KEY,JSON.stringify(all));
}
export function unmountIntensive(){if(active){active.abort.abort();clearTimeout(active.timer);active.root.querySelectorAll('audio').forEach(a=>a.pause());active=null;}}

export function mountIntensive(root,q,notify){
  unmountIntensive();const ctx={root,q,notify,abort:new AbortController(),timer:null,data:null,state:null,busy:false};active=ctx;
  if(q.omitted||!q.body||!q.audio){root.innerHTML='<div class="empty">本题缺少已刊登原文或音频，暂不能逐句精听。<br>可继续使用已有题图及复习资料。</div>';return;}
  const key=`${q.paper}-${q.section==='聴解'?'L':'R'}-${q.number}`;ctx.key=key;
  root.innerHTML=`<div class="intensive-intro"><span class="eyebrow">LISTEN CLOSER</span><h3>把一段听力，听成自己的句子。</h3><p>听一句，写一句，再核对。可以用意思相近的日语表达，标点和空格不影响核对。</p><div class="intensive-steps"><span><b>01</b> 单句重听</span><span><b>02</b> 输入并确认</span><span><b>03</b> 对照原文、查生词</span></div><button class="btn primary" id="begin-intensive">开始逐句精听 →</button><p class="help">首次打开本题需准备逐句音频，通常需要十几秒至一分钟；完成后自动缓存。精听不增加真题刷题次数。</p></div>`;
  root.querySelector('#begin-intensive').onclick=()=>begin(ctx);
}
async function api(ctx,url,body){
  const r=await apiFetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:ctx.abort.signal});
  let data;try{data=await r.json();}catch{throw Error('精听后端暂时不可用，请稍后重试或联系老师。');}
  if(!r.ok)throw Error(data.error||'精听服务暂时不可用');return data;
}
async function begin(ctx){
  if(active!==ctx)return;
  ctx.root.innerHTML='<div class="intensive-loading" role="status"><h3>正在准备逐句音频</h3><progress max="100" value="0"></progress><p>正在连接精听引擎…</p><small>可以先做其他题；生成结果会保存在网站服务中。</small></div>';
  try{const job=await api(ctx,'/api/intensive/prepare',{key:ctx.key});await receive(ctx,job);}catch(e){failed(ctx,e);}
}
async function receive(ctx,job){
  if(active!==ctx)return;
  if(job.status==='error')throw Error(job.error||'本题切分失败，请重试。');
  if(job.status==='ready'){
    ctx.data=job.data;const old=read()[ctx.key];
    ctx.state=old?.fingerprint===job.data.fingerprint?old:{fingerprint:job.data.fingerprint,scope:'body',index:0,answers:{}};
    if(!ctx.state.answers)ctx.state.answers={};
    for(const a of Object.values(ctx.state.answers))if(a.result)a.result=refreshConfirmedVocabulary(a.result,ctx.q);
    const visible=visibleSentences(ctx);if(!visible.some(s=>s.index===ctx.state.index))ctx.state.index=visible[0]?.index||0;
    draw(ctx);return;
  }
  ctx.root.querySelector('progress').value=job.percent||0;ctx.root.querySelector('.intensive-loading p').textContent=`${job.stage||'等待处理'} · ${job.percent||0}%`;
  ctx.timer=setTimeout(async()=>{try{await receive(ctx,await api(ctx,`/api/intensive/status?key=${encodeURIComponent(ctx.key)}`));}catch(e){failed(ctx,e);}},900);
}
function failed(ctx,e){
  if(active!==ctx||e.name==='AbortError')return;
  ctx.root.innerHTML=`<div class="empty"><p>${esc(e.message)}</p><button class="btn" id="retry-intensive">重新准备</button></div>`;
  ctx.root.querySelector('#retry-intensive').onclick=()=>begin(ctx);
}
function visibleSentences(ctx){const all=ctx.data.sentences;return ctx.state.scope==='all'?all:all.filter(s=>s.kind==='正文');}
function save(ctx){store(ctx.key,ctx.state,ctx.notify);}
function wordMarkup(result){
  let html='',pos=0;
  for(const [i,w] of (result.words||[]).entries()){
    if(w.start<pos||w.end>result.text.length)continue;
    html+=esc(result.text.slice(pos,w.start))+`<button type="button" class="vocab-hit" data-vocab="${i}" aria-label="查看 ${esc(w.surface)} 的意思" aria-expanded="false">${esc(result.text.slice(w.start,w.end))}</button>`;pos=w.end;
  }
  return html+esc(result.text.slice(pos));
}
function draw(ctx){
  if(active!==ctx)return;ctx.root.querySelectorAll('audio').forEach(a=>a.pause());
  const {state,data}=ctx,list=visibleSentences(ctx),s=data.sentences[state.index],record=state.answers[s.index]||{};
  const position=list.findIndex(u=>u.index===s.index),done=list.filter(u=>state.answers[u.index]?.result).length;
  const matched=list.filter(u=>{const a=state.answers[u.index];return a?.self==='match'||a?.result?.feedback?.status==='match';}).length;
  ctx.root.innerHTML=`<div class="intensive-head"><div><span class="eyebrow">SENTENCE BY SENTENCE</span><h3>逐句精听 <span class="pill">已核对 ${done} / ${list.length}</span></h3></div><label class="field">范围 <select id="intensive-scope"><option value="body" ${state.scope==='body'?'selected':''}>只练正文</option><option value="all" ${state.scope==='all'?'selected':''}>含提问与选项</option></select></label></div>
    <div class="sentence-strip" aria-label="精听句子列表">${list.map((u,i)=>{const a=state.answers[u.index];return `<button class="${u.index===s.index?'current ':''}${a?.result?(a.self==='match'||a.result.feedback.status==='match'?'done':'needs-review'):''}" data-sentence="${u.index}" aria-label="第 ${i+1} 句${a?.result?'，已核对':''}" ${ctx.busy?'disabled':''}>${i+1}${a?.result?'<small>✓</small>':''}</button>`;}).join('')}</div>
    <section class="sentence-work"><div class="sentence-heading"><strong>${esc(s.kind)} · 第 ${position+1} / ${list.length} 句</strong><span>${s.speaker?esc(s.speaker)+' · ':''}${s.duration.toFixed(1)} 秒</span></div>
    <audio id="sentence-audio" controls preload="metadata" ${mediaAttributes(s.audio)} aria-label="本句精听音频"></audio><div class="sentence-tools"><button class="btn" id="sentence-replay">↻ 重听本句</button><label><input type="checkbox" id="sentence-loop" ${ctx.loop?'checked':''}> 循环</label><label>速度 <select id="sentence-speed" aria-label="精听速度">${[.7,.85,1,1.15].map(v=>`<option value="${v}" ${(ctx.speed||1)===v?'selected':''}>${v}×</option>`).join('')}</select></label><button class="context-link" id="sentence-context">前后多听一点</button></div>
    <div id="context-player" hidden><audio controls preload="none" ${mediaAttributes(ctx.q.audio)} aria-label="本句前后上下文"></audio><p class="help">连同本句前后各约 0.8 秒重听，方便确认句首与句尾。</p></div>
    ${s.confidence<.65?'<p class="cut-notice">这句的原文与语音对齐可信度偏低，请配合“前后多听一点”核对。</p>':''}
    <form id="sentence-form"><label class="dictation-label" for="sentence-input">写下你听到的句子</label><textarea id="sentence-input" lang="ja" rows="3" maxlength="1200" placeholder="先听再写，可以用意思相近的日语表达…" ${ctx.busy?'disabled':''}>${esc(record.draft||'')}</textarea><div class="sentence-submit"><small>允许近义表达；注意否定、数字和先后关系。</small><button class="btn primary" id="sentence-check" ${ctx.busy?'disabled':''}>${ctx.busy?'正在核对意思…':record.result?'再次确认答案':'确认答案，查看原文'}</button></div></form>
    <div id="sentence-result" aria-live="polite">${record.result?`<section class="dictation-feedback ${record.self==='match'?'match':record.result.feedback.status}"><strong>${record.self==='match'?'已自行确认：意思接近':esc(record.result.feedback.title)}</strong><p>${esc(record.result.feedback.message)}</p></section>${record.result.feedback.status!=='match'?hintHTML(record.result):''}${shouldShowOriginal(record)?`<div class="sentence-original"><div class="original-heading"><strong>本句原文</strong><small>红色词语可点击查看释义</small></div><p lang="ja">${wordMarkup(record.result)}</p><div id="word-definition" hidden></div>${record.restored?'<p class="help">此记录来自备份；再次确认可重新加载生词释义。</p>':''}</div>`:`<div class="hint-actions"><button class="btn" id="show-sentence-original">对照原文与生词</button><p class="help">可以先参考句式提示再听、修改输入，或展开原文核对。</p></div>`}<div class="self-check"><button class="btn" id="sentence-reset">隐藏原文，重练这句</button>${record.result.feedback.status!=='match'&&record.self!=='match'&&shouldShowOriginal(record)?'<button class="context-link" id="sentence-self">对照后，我确认意思接近</button>':''}</div>`:''}</div></section>
    <div class="sentence-nav"><button class="btn" id="sentence-prev" ${position===0||ctx.busy?'disabled':''}>← 上一句</button><span>已核对 ${done} 句 · 意思接近 ${matched} 句</span><button class="btn primary" id="sentence-next" ${position===list.length-1||ctx.busy?'disabled':''}>下一句 →</button></div>
    ${done===list.length?'<div class="intensive-complete">这一轮逐句核对已完成。可以回到有疑问的句子继续重听，也可以切换到“含提问与选项”继续练习。</div>':''}
    <p class="help intensive-footnote">语义核对是学习辅助，不计入真题正确率。原文沿用扫描识别稿，自动切点和文字可能有误；请结合原音对照，自行确认可修正系统判断。草稿与核对记录自动保存在本浏览器。</p>`;
  hydrateMedia(ctx.root);const audio=ctx.root.querySelector('#sentence-audio');audio.playbackRate=ctx.speed||1;audio.loop=!!ctx.loop;
  const context=ctx.root.querySelector('#context-player audio');
  audio.onplay=()=>{document.querySelector('#question-audio')?.pause();context.pause();};
  const go=index=>{state.index=index;save(ctx);draw(ctx);};
  ctx.root.querySelectorAll('[data-sentence]').forEach(b=>b.onclick=()=>go(Number(b.dataset.sentence)));
  ctx.root.querySelector('#intensive-scope').disabled=ctx.busy;
  ctx.root.querySelector('#intensive-scope').onchange=e=>{state.scope=e.target.value;const v=visibleSentences(ctx);if(!v.some(u=>u.index===state.index))state.index=v[0].index;save(ctx);draw(ctx);};
  ctx.root.querySelector('#sentence-prev').onclick=()=>go(list[position-1].index);
  ctx.root.querySelector('#sentence-next').onclick=()=>go(list[position+1].index);
  ctx.root.querySelector('#sentence-speed').onchange=e=>{ctx.speed=Number(e.target.value);audio.playbackRate=ctx.speed;context.playbackRate=ctx.speed;};
  ctx.root.querySelector('#sentence-loop').onchange=e=>{ctx.loop=e.target.checked;audio.loop=ctx.loop;};
  ctx.root.querySelector('#sentence-replay').onclick=async()=>{try{await waitMedia(audio);if(!audio.isConnected)return;audio.currentTime=0;await audio.play();}catch{ctx.notify('请点击本句音频播放按钮，或重试加载。');}};
  ctx.root.querySelector('#sentence-context').onclick=async()=>{audio.pause();document.querySelector('#question-audio')?.pause();ctx.root.querySelector('#context-player').hidden=false;try{await waitMedia(context);if(!context.isConnected)return;context.currentTime=Math.max(0,s.start-.8);context.playbackRate=ctx.speed||1;await context.play();}catch{ctx.notify('请点击上下文音频播放按钮，或重试加载。');}};
  context.ontimeupdate=()=>{if(context.currentTime>=Math.min(data.duration,s.end+.8))context.pause();};
  context.onplay=()=>{audio.pause();document.querySelector('#question-audio')?.pause();if(context.currentTime>=s.end+.8||context.currentTime<s.start-.8)context.currentTime=Math.max(0,s.start-.8);};
  ctx.root.querySelector('#sentence-input').oninput=e=>{state.answers[s.index]={...record,draft:e.target.value,at:new Date().toISOString()};save(ctx);};
  ctx.root.querySelector('#sentence-form').onsubmit=async e=>{
    e.preventDefault();if(ctx.busy)return;const answer=ctx.root.querySelector('#sentence-input').value.trim();
    if(!answer){ctx.notify('先写下听到的句子，再确认答案。');ctx.root.querySelector('#sentence-input').focus();return;}
    state.answers[s.index]={...state.answers[s.index],draft:answer,at:new Date().toISOString()};save(ctx);ctx.busy=true;draw(ctx);
    try{const result=await api(ctx,'/api/intensive/check',{key:ctx.key,index:s.index,answer,fingerprint:data.fingerprint});
      state.answers[s.index]={draft:answer,result:refreshConfirmedVocabulary(result,ctx.q),at:new Date().toISOString()};save(ctx);
    }catch(err){if(err.name!=='AbortError')ctx.notify(err.message);}finally{ctx.busy=false;if(active===ctx)draw(ctx);}
  };
  ctx.root.querySelector('#show-sentence-original')?.addEventListener('click',()=>{state.answers[s.index].revealed=true;save(ctx);draw(ctx);});
  ctx.root.querySelector('#sentence-reset')?.addEventListener('click',()=>{state.answers[s.index]={draft:'',at:new Date().toISOString()};save(ctx);draw(ctx);ctx.root.querySelector('#sentence-input').focus();});
  ctx.root.querySelector('#sentence-self')?.addEventListener('click',()=>{state.answers[s.index].self='match';state.answers[s.index].at=new Date().toISOString();save(ctx);draw(ctx);});
  ctx.root.querySelectorAll('[data-vocab]').forEach(b=>b.onclick=()=>{
    const w=record.result.words[Number(b.dataset.vocab)],box=ctx.root.querySelector('#word-definition');
    const same=b.getAttribute('aria-expanded')==='true';ctx.root.querySelectorAll('[data-vocab]').forEach(el=>el.setAttribute('aria-expanded','false'));
    if(same){box.hidden=true;return;}b.setAttribute('aria-expanded','true');box.hidden=false;
    box.innerHTML=`<div class="word-popup"><strong lang="ja">${esc(w.jp)}</strong><span lang="ja">${esc(w.reading)}</span><p>${esc(w.meaning)}</p>${w.category?`<small>${esc(w.category)}${w.group?' · '+esc(w.group):''}</small>`:''}${w.tip?`<small>${esc(w.tip)}</small>`:''}${wordbookButton(w,Number(b.dataset.vocab))}<button class="context-link" id="word-close">收起释义</button></div>`;
    box.querySelector('[data-book-word]').onclick=e=>{saveUnknown(w,ctx.q,record.result.text,ctx.notify);e.currentTarget.textContent='★ 已收录';e.currentTarget.classList.add('saved');};
    box.querySelector('#word-close').onclick=()=>{box.hidden=true;b.setAttribute('aria-expanded','false');b.focus();};
  });
  save(ctx);
}
