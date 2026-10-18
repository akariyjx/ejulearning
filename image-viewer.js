import {mediaAttributes,isRemote,hydrateMedia} from './transport.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clampScale=n=>Math.max(25,Math.min(400,Number(n)||100));
export function imageViewerHTML(q,label){return `<figure class="question-image adjustable-image"><div class="image-zoom-tools"><button type="button" class="btn" data-zoom-minus aria-label="缩小题图">−</button><label>题图大小 <input type="range" min="25" max="400" step="1" value="100" aria-label="题图缩放比例"></label><output>100%</output><button type="button" class="btn" data-zoom-plus aria-label="放大题图">＋</button><button type="button" class="context-link" data-zoom-fit>整图</button><button type="button" class="context-link" data-zoom-width>适合宽度</button></div><div class="image-viewport" tabindex="0" aria-label="可缩放和拖动的题图"><img ${mediaAttributes(q.image)} alt="${esc(label)} 原始题图" draggable="false"></div><figcaption class="image-caption"><span>滑条缩放 · 拖动平移 · 双指缩放</span><a data-original-image ${isRemote()?'':`href="${esc(q.image)}"`} target="_blank" rel="noopener">打开原图 ↗</a></figcaption></figure>`;}
export function mountImageViewers(root){
 hydrateMedia(root);
 root.querySelectorAll('.adjustable-image').forEach(figure=>{
  const stage=figure.querySelector('.image-viewport'),img=stage.querySelector('img'),slider=figure.querySelector('input'),output=figure.querySelector('output');let zoom=100;const pointers=new Map();let pinching=null;
  const set=n=>{zoom=clampScale(n);img.style.width=zoom+'%';slider.value=zoom;output.textContent=Math.round(zoom)+'%';};
  const fit=()=>{if(!img.naturalWidth)return;set(Math.min(100,stage.clientHeight*img.naturalWidth/(stage.clientWidth*img.naturalHeight)*100));stage.scrollTop=stage.scrollLeft=0;};
  slider.oninput=()=>set(slider.value);figure.querySelector('[data-zoom-minus]').onclick=()=>set(zoom-10);figure.querySelector('[data-zoom-plus]').onclick=()=>set(zoom+10);figure.querySelector('[data-zoom-fit]').onclick=fit;figure.querySelector('[data-zoom-width]').onclick=()=>set(100);
  if(img.complete&&img.naturalWidth)fit();else img.addEventListener('load',fit,{once:true});
  stage.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();set(zoom+(e.deltaY<0?10:-10));}},{passive:false});
  stage.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinching={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};}};
  stage.onpointermove=e=>{const old=pointers.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,next);if(pointers.size===2&&pinching){const [a,b]=[...pointers.values()];set(pinching.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinching.distance));}else{stage.scrollLeft-=next.x-old.x;stage.scrollTop-=next.y-old.y;}};
  const up=e=>{pointers.delete(e.pointerId);pinching=null;};stage.onpointerup=up;stage.onpointercancel=up;stage.onlostpointercapture=up;
 });
}
