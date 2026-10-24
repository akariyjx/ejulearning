/* Shared pure logic; no interaction with the existing exam progress. */
(function(root){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s\p{P}\p{S}]/gu,'');
  function accepts(card,input){
    const answer=normalize(input);if(!answer)return false;
    const candidates=[...(card.keys||[]),card.jp,card.rd,card.mean,...String(card.mean||'').split(/[、；;／/]/)];
    return candidates.some(value=>value&&normalize(value)===answer);
  }
  function matchingQuestionIds(card,{year='all',paper='all',section='all',question='all',questionMap={}}={}){
    return (card.questionIds||[]).filter(id=>{const q=questionMap[id];return q&&(year==='all'||String(q.year||q.paper?.slice(0,4))===String(year))&&(paper==='all'||q.paper===paper)&&(section==='all'||q.section===section)&&(question==='all'||q.id===question);});
  }
  function filterCards(cards,{library='focus',group='all',kind='all',search='',year='all',paper='all',section='all',question='all',questionMap={}}={}){
    const needle=normalize(search);
    const scoped=year!=='all'||paper!=='all'||section!=='all'||question!=='all';
    return cards.filter(c=>(library==='all'||c.library===library)&&(group==='all'||c.group===group)&&(kind==='all'||c.kind===kind)&&(!scoped||matchingQuestionIds(c,{year,paper,section,question,questionMap}).length>0)&&(!needle||[c.jp,c.rd,c.mean,c.theme,c.use,c.category].some(v=>normalize(v).includes(needle))));
  }
  function dedupeCards(cards){const seen=new Set();return [...cards].sort((a,b)=>(b.library==='corpus')-(a.library==='corpus')).filter(c=>{const key=normalize(c.jp);if(seen.has(key))return false;seen.add(key);return true;});}
  function pickCards(cards,amount,random=true){const list=[...cards];if(random)for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list.slice(0,amount==='all'?list.length:Math.max(1,Number(amount)||20));}
  function validateRecords(value,ids){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('进度格式无效');
    const records={};for(const [id,r]of Object.entries(value)){if(!ids.has(id))continue;if(!r||typeof r!=='object'||typeof r.wrong!=='boolean'||!Number.isSafeInteger(r.attempts)||r.attempts<0||r.attempts>10000000||!Number.isSafeInteger(r.correct)||r.correct<0||r.correct>r.attempts||!Number.isFinite(r.updatedAt)||r.updatedAt<0||r.updatedAt>Date.now()+300000)throw Error('进度内容无效');records[id]={attempts:r.attempts,correct:r.correct,wrong:r.wrong,updatedAt:r.updatedAt};}return records;
  }
  function mergeRecords(current,incoming){const result={...current};for(const[id,r]of Object.entries(incoming)){const old=result[id];if(!old||r.updatedAt>old.updatedAt||r.updatedAt===old.updatedAt&&r.attempts>old.attempts)result[id]={...r};}return result;}
  const api={normalize,accepts,filterCards,matchingQuestionIds,dedupeCards,pickCards,validateRecords,mergeRecords};root.RapidCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
