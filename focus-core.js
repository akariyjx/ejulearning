import {recordAttempt} from './core.js';
export function createFocusState(){return {phase:'listening',drafts:{},playbackIndex:0,elapsed:0,speed:1,listened:[],skipped:{}};}
export function validateFocusState(s,ids){
 const out=createFocusState();if(!s)return out;
 out.phase=['listening','answering','review'].includes(s.phase)?s.phase:'listening';
 out.playbackIndex=Number.isInteger(s.playbackIndex)&&s.playbackIndex>=0&&s.playbackIndex<ids.length?s.playbackIndex:0;
 out.elapsed=Number.isFinite(s.elapsed)&&s.elapsed>=0?Math.min(s.elapsed,1800):0;out.speed=[.75,1,1.25,1.5].includes(s.speed)?s.speed:1;
 for(const id of ids)if([1,2,3,4].includes(s.drafts?.[id]))out.drafts[id]=s.drafts[id];
 out.listened=[...new Set((Array.isArray(s.listened)?s.listened:[]).filter(id=>ids.includes(id)))];
 for(const [id,reason] of Object.entries(s.skipped||{}))if(ids.includes(id)&&typeof reason==='string')out.skipped[id]=reason.slice(0,200);
 if(out.phase==='review'){out.corrects={};for(const id of ids)if(s.corrects?.[id]===null||[1,2,3,4].includes(s.corrects?.[id]))out.corrects[id]=s.corrects[id];}
 return out;
}
export function unansweredFocus(session,pool){return pool.filter(q=>q.audio&&q.gradable!==false&&![1,2,3,4].includes(session.focus.drafts[q.id]));}
export function recordFocusBatch(progress,session,pool,correctById,at=new Date().toISOString()){
 if(session.focus.phase!=='answering')throw Error('请完成连听，再统一提交答案。');
 if(unansweredFocus(session,pool).length)throw Error('请先补齐答题卡中的答案。');
 let next=progress;const answers={};let submitted=0;
 for(const q of pool){const answer=session.focus.drafts[q.id];if(![1,2,3,4].includes(answer))continue;
  if(!(q.id in correctById))throw Error('部分答案资料未加载，请重试。');
  next=recordAttempt(next,q.id,answer,correctById[q.id],session.attempts[q.id],at);answers[q.id]={answer,right:correctById[q.id]===null?null:answer===correctById[q.id]};submitted++;
 }
 if(!submitted)throw Error('请至少选择一道题的答案。');
 return {progress:next,session:{...session,answers,focus:{...session.focus,phase:'review',corrects:{...correctById}}}};
}
