export const PROGRESS_KEY='eju-listening:progress:v1';
export const SESSION_KEY='eju-listening:session:v1';
export function emptyProgress(){return {version:1,questions:{},notes:{}};}
export function getPool(questions,{paper='',section='',topic='',status='all',playableOnly=false,gradedOnly=false}={},progress=emptyProgress()){
  return questions.filter(q=>(!gradedOnly||q.gradable!==false)&&(!playableOnly||q.audio)&&(!paper||q.paper===paper)&&(!section||q.section===section)&&(!topic||q.topics.includes(topic))&&
    (status==='all'||(status==='new'?!progress.questions[q.id]?.count:progress.questions[q.id]?.lastCorrect===false)));
}
export function sample(pool,count,random=Math.random){
  if(!Number.isInteger(count)||count<1||count>pool.length)throw new Error(`题数请输入 1–${pool.length} 之间的整数`);
  const copy=[...pool];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy.slice(0,count);
}
export function recordAttempt(progress,id,answer,correct,attemptId,at=new Date().toISOString()){
  if(![1,2,3,4].includes(answer)||(correct!==null&&![1,2,3,4].includes(correct)))throw new Error('答案应为 1–4');
  const previous=progress.questions[id]||{count:0,correct:0,history:[]};
  if(previous.history.some(h=>h.attemptId===attemptId))return progress;
  const right=correct===null?null:answer===correct;
  return {...progress,questions:{...progress.questions,[id]:{count:previous.count+1,graded:(previous.graded??previous.count)+(correct===null?0:1),correct:previous.correct+(right?1:0),lastAnswer:answer,lastCorrect:right,lastAt:at,
    history:[...(previous.history||[]),{attemptId,answer,correct:right,at}].slice(-30)}}};
}
export function summary(progress){const rows=Object.values(progress.questions);return {unique:rows.filter(r=>r.count>0).length,total:rows.reduce((s,r)=>s+r.count,0),graded:rows.reduce((s,r)=>s+(r.graded??r.count),0),correct:rows.reduce((s,r)=>s+r.correct,0),wrong:rows.filter(r=>r.lastCorrect===false).length};}
export function validateProgress(data,ids){
  if(!data||data.version!==1||!data.questions||typeof data.questions!=='object'||Array.isArray(data.questions))throw new Error('不是本网站的有效进度文件');
  const clean=emptyProgress();
  for(const [id,r] of Object.entries(data.questions)){
    if(!ids.has(id))continue;
    const graded=r?.graded??r?.count;
    if(!r||!Number.isInteger(r.count)||r.count<1||r.count>1000000||!Number.isInteger(graded)||graded<0||graded>r.count||!Number.isInteger(r.correct)||r.correct<0||r.correct>graded||![1,2,3,4].includes(r.lastAnswer)||(r.lastCorrect!==null&&typeof r.lastCorrect!=='boolean')||typeof r.lastAt!=='string'||!Number.isFinite(Date.parse(r.lastAt)))throw new Error('进度文件中的刷题记录无效');
    clean.questions[id]={count:r.count,graded,correct:r.correct,lastAnswer:r.lastAnswer,lastCorrect:r.lastCorrect,lastAt:r.lastAt,
      history:(Array.isArray(r.history)?r.history:[]).filter(h=>h&&typeof h.attemptId==='string'&&[1,2,3,4].includes(h.answer)&&(h.correct===null||typeof h.correct==='boolean')&&typeof h.at==='string').slice(-30)};
  }
  for(const [id,n] of Object.entries(data.notes||{})){if(ids.has(id)&&typeof n==='string')clean.notes[id]=n.slice(0,10000);}
  return clean;
}
export function mergeProgress(current,incoming){
  const merged={version:1,questions:{...current.questions},notes:{...current.notes,...incoming.notes}};
  // A backup is a snapshot, not new submissions: never add its counts again.
  for(const [id,r] of Object.entries(incoming.questions)){const old=current.questions[id];if(!old||r.count>old.count||(r.count===old.count&&r.lastAt>old.lastAt))merged.questions[id]=r;}
  return merged;
}
