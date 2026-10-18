import {mediaURL} from './transport.js';
import {createFocusState,unansweredFocus} from './focus-core.js';
import {imageViewerHTML,mountImageViewers} from './image-viewer.js';
import {accountHTML,bindAccount} from './access.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=q=>`${q.paper.slice(0,4)} 年第 ${q.paper.at(-1)} 回 · ${q.section==='聴解'?'听解':'听读解'} ${q.number}`;
let active=null;
export function unmountFocus(){if(active){const ctx=active;active=null;ctx.root.querySelectorAll('audio').forEach(a=>{ctx.session.focus.elapsed=a.currentTime||0;a.pause();});ctx.save();document.body.classList.remove('is-focus');}}
export function mountFocus(root,options){
 unmountFocus();const ctx={root,...options,busy:false};active=ctx;if(!ctx.session.focus)ctx.session.focus=createFocusState();document.body.classList.add('is-focus');draw(ctx);
}
function draw(ctx){
 if(active!==ctx)return;const f=ctx.session.focus;ctx.root.querySelectorAll('audio').forEach(a=>a.pause());
 const answered=Object.keys(f.drafts).length,submitted=Object.values(ctx.session.answers),right=submitted.filter(a=>a.right===true).length,graded=submitted.filter(a=>a.right!==null).length;
 ctx.root.innerHTML=`<main class="focus-shell"><header class="focus-top"><a href="#year">聴くラボ</a><span class="pill">专注模式</span>${accountHTML()}<button class="btn ghost" id="focus-exit">保存并退出</button></header><section class="focus-title"><span class="eyebrow">${esc(ctx.session.title)}</span><h1>${f.phase==='listening'?'连续听完，再一起核对。':f.phase==='answering'?'完成答题卡，再统一提交。':'这一组，已经核对完成。'}</h1><p id="focus-summary">${ctx.pool.length} 题 · 已选择 ${answered} 题${f.phase==='review'?` · 已提交 ${submitted.length} 题 · ${graded?`答对 ${right} / ${graded}`:'未评分'}`:' · 提交前不显示答案与复习资料'}</p></section>
 ${f.phase==='listening'?`<section class="focus-player"><div class="focus-player-top"><strong id="focus-now"></strong><span id="focus-position"></span></div><audio id="focus-audio" controls preload="auto" aria-label="专注模式连续播放音频"></audio><div class="toolbar"><button class="btn primary" id="focus-play">开始连播</button><button class="btn" id="focus-previous">上一题</button><button class="btn" id="focus-next">下一题</button><label class="field">速度 <select id="focus-speed">${[.75,1,1.25,1.5].map(v=>`<option value="${v}" ${f.speed===v?'selected':''}>${v}×</option>`).join('')}</select></label><button class="context-link" id="focus-card">结束连听，进入答题卡</button></div><p class="help" id="focus-play-status">音频依次连播，题图随音频切换。可边听边选答案，整组结束后统一核对。</p></section><div id="focus-current"></div>`:
 `<section class="focus-answer-sheet"><h2>${f.phase==='review'?'整组对答案':'答题卡'}</h2>${ctx.pool.map((q,i)=>{const a=ctx.session.answers[q.id];return `<article class="focus-answer-row ${a?a.right===null?'ungraded':a.right?'right':'wrong':''}"><div><strong>${i+1}. ${esc(label(q))}</strong><small>${f.phase==='review'?a?`你的答案 ${a.answer} · ${a.right===null?'标准答案未刊登':a.right?'✓ 答对':'答错'}${ctx.corrects?.[q.id]?` · 正确 ${ctx.corrects[q.id]}`:''}`:'本题留空，未计刷题次数':!q.audio?'缺音频，可留空':q.gradable===false?'标准答案未刊登，可留空':!f.listened.includes(q.id)?'尚未完整听过，可返回重听':'选择你听到的答案'}</small></div>${f.phase==='review'?a?`<div class="toolbar"><button class="btn" data-focus-review="${i}">复习本题</button><button class="btn primary" data-focus-intensive="${i}">逐句精听</button></div>`:'' : `<div class="focus-answer-choices" role="group" aria-label="第 ${i+1} 题答案">${[1,2,3,4].map(n=>`<button class="${f.drafts[q.id]===n?'selected':''}" data-focus-draft="${i}:${n}" aria-pressed="${f.drafts[q.id]===n}" aria-label="第 ${i+1} 题选项 ${n}" ${ctx.busy?'disabled':''}>${n}</button>`).join('')}</div>`}</article>`;}).join('')}</section><div class="focus-sheet-actions">${f.phase==='answering'?`<button class="btn" id="focus-return-listening" ${ctx.busy?'disabled':''}>返回连听</button><span id="focus-missing" class="help">${unansweredFocus(ctx.session,ctx.pool).length?`还有 ${unansweredFocus(ctx.session,ctx.pool).length} 道可评分题未选答案`:'答题卡已填好'}</span><button class="btn primary" id="focus-submit" ${ctx.busy||unansweredFocus(ctx.session,ctx.pool).length?'disabled':''}>${ctx.busy?'正在统一核对…':'提交整组答案'}</button>`:'<button class="btn primary" id="focus-repeat">专注重练这一组</button>'}</div>`}
 <p class="help focus-footer">答案草稿和播放位置自动保存。只有提交整组答案才累计刷题次数；连播、重听和精听均不加次数。</p></main>`;
 ctx.root.querySelector('#focus-exit').onclick=ctx.onExit;bindAccount(ctx.root,unmountFocus);
 ctx.root.querySelectorAll('[data-focus-review]').forEach(b=>b.onclick=()=>ctx.onReview(Number(b.dataset.focusReview),'原文'));
 ctx.root.querySelectorAll('[data-focus-intensive]').forEach(b=>b.onclick=()=>ctx.onReview(Number(b.dataset.focusIntensive),'逐句精听'));
 ctx.root.querySelector('#focus-repeat')?.addEventListener('click',ctx.onRepeat);
 ctx.root.querySelectorAll('[data-focus-draft]').forEach(b=>b.onclick=()=>{const [i,n]=b.dataset.focusDraft.split(':').map(Number);f.drafts[ctx.pool[i].id]=n;ctx.save();updateDraftSummary(ctx);b.parentElement.querySelectorAll('button').forEach(el=>{const chosen=el===b;el.classList.toggle('selected',chosen);el.setAttribute('aria-pressed',String(chosen));});const missing=unansweredFocus(ctx.session,ctx.pool).length;ctx.root.querySelector('#focus-missing').textContent=missing?`还有 ${missing} 道可评分题未选答案`:'答题卡已填好';ctx.root.querySelector('#focus-submit').disabled=!!missing;});
 ctx.root.querySelector('#focus-return-listening')?.addEventListener('click',()=>{f.phase='listening';ctx.save();draw(ctx);});
 ctx.root.querySelector('#focus-submit')?.addEventListener('click',async()=>{if(ctx.busy)return;ctx.busy=true;draw(ctx);try{ctx.session=await ctx.submit();ctx.corrects=ctx.session.focus.corrects;}catch(e){ctx.notify(e.message);}finally{ctx.busy=false;if(active===ctx)draw(ctx);}});
 if(f.phase==='listening')bindPlayer(ctx);
}
function updateDraftSummary(ctx){const el=ctx.root.querySelector('#focus-summary');if(el&&ctx.session.focus.phase!=='review')el.textContent=`${ctx.pool.length} 题 · 已选择 ${Object.keys(ctx.session.focus.drafts).length} 题 · 提交前不显示答案与复习资料`;}
function showQuestion(ctx){
 const f=ctx.session.focus,q=ctx.pool[f.playbackIndex],root=ctx.root;
 root.querySelector('#focus-now').textContent=label(q);root.querySelector('#focus-position').textContent=`${f.playbackIndex+1} / ${ctx.pool.length}`;
 root.querySelector('#focus-previous').disabled=f.playbackIndex===0;
 root.querySelector('#focus-current').innerHTML=`<section class="question-card focus-question">${q.image?imageViewerHTML(q,label(q)):'<div class="listen-hint">听解的提问和选项在音频中。记好题目问谁、问什么。</div>'}<div class="answer-label"><strong>本题答案草稿</strong><small>只保存，整组结束后再核对</small></div><div class="choices" role="group" aria-label="当前题目答案">${[1,2,3,4].map(n=>`<button class="choice ${f.drafts[q.id]===n?'selected':''}" aria-pressed="${f.drafts[q.id]===n}" data-current-draft="${n}">${n}</button>`).join('')}</div><details class="personal"><summary>我的听力笔记</summary><textarea aria-label="专注模式听力笔记" maxlength="10000">${esc(ctx.getNote(q.id))}</textarea></details></section>`;
 mountImageViewers(root.querySelector('#focus-current'));root.querySelectorAll('[data-current-draft]').forEach(b=>b.onclick=()=>{f.drafts[q.id]=Number(b.dataset.currentDraft);ctx.save();updateDraftSummary(ctx);b.parentElement.querySelectorAll('button').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});});
 root.querySelector('#focus-current textarea').oninput=e=>ctx.onNote(q.id,e.target.value);
}
function bindPlayer(ctx){
 const f=ctx.session.focus,audio=ctx.root.querySelector('#focus-audio');let lastSave=0;
 const status=text=>ctx.root.querySelector('#focus-play-status').textContent=text;
 const play=async()=>{if(ctx.mediaReady&&!(await ctx.mediaReady))return;return audio.play().then(()=>{if(active===ctx&&!audio.paused){ctx.root.querySelector('#focus-play').textContent='暂停连播';status('正在连播。当前题播放完后自动进入下一题。');}}).catch(()=>{if(active===ctx&&audio.paused){ctx.root.querySelector('#focus-play').textContent='继续连播';status('播放暂停，请点“继续连播”。');}});};
 const complete=()=>{audio.pause();f.phase='answering';f.elapsed=0;ctx.save();draw(ctx);window.scrollTo(0,0);};
 const load=(autoplay=false)=>{
  if(active!==ctx)return;
  while(!ctx.pool[f.playbackIndex]?.audio){const q=ctx.pool[f.playbackIndex];f.skipped[q.id]='原资料缺音频，已跳过';if(f.playbackIndex===ctx.pool.length-1){complete();return;}f.playbackIndex++;f.elapsed=0;}
  showQuestion(ctx);const q=ctx.pool[f.playbackIndex],resume=f.elapsed,generation=(ctx.mediaLoad||0)+1;ctx.mediaLoad=generation;status('正在加载本题音频…');ctx.mediaReady=mediaURL(q.audio).then(src=>{if(active!==ctx||generation!==ctx.mediaLoad)return false;audio.src=src;audio.playbackRate=f.speed;audio.onloadedmetadata=()=>{if(active!==ctx)return;if(resume<audio.duration)audio.currentTime=resume;};status(resume?'已恢复播放位置，点“继续连播”。':'点“开始连播”，可连续听完整组题目。');return true;}).catch(e=>{if(active===ctx)status(e.message);return false;});ctx.save();if(autoplay)play();
 };
 const next=(manual=false)=>{if(active!==ctx)return;const q=ctx.pool[f.playbackIndex];if(manual)f.skipped[q.id]='手动切换，可能未听完整';else if(!f.listened.includes(q.id))f.listened.push(q.id);const autoplay=!audio.paused||audio.ended;audio.pause();f.elapsed=0;if(f.playbackIndex===ctx.pool.length-1){complete();return;}f.playbackIndex++;load(autoplay);};
 audio.onended=()=>next();audio.ontimeupdate=()=>{f.elapsed=audio.currentTime;if(Date.now()-lastSave>1500){ctx.save();lastSave=Date.now();}};
 audio.onpause=()=>{if(active===ctx&&ctx.root.querySelector('#focus-play'))ctx.root.querySelector('#focus-play').textContent='继续连播';};
 audio.onerror=()=>{if(active!==ctx)return;audio.pause();f.skipped[ctx.pool[f.playbackIndex].id]='音频加载失败';ctx.save();status('本题音频加载失败。可重新播放或手动切换下一题；不会自动标为已听完。');};
 ctx.root.querySelector('#focus-play').onclick=()=>audio.paused?play():audio.pause();
 ctx.root.querySelector('#focus-next').onclick=()=>next(true);
 ctx.root.querySelector('#focus-previous').onclick=()=>{if(f.playbackIndex>0){const playing=!audio.paused;audio.pause();f.playbackIndex--;f.elapsed=0;load(playing);}};
 ctx.root.querySelector('#focus-speed').onchange=e=>{f.speed=Number(e.target.value);audio.playbackRate=f.speed;ctx.save();};
 ctx.root.querySelector('#focus-card').onclick=complete;load();
}
