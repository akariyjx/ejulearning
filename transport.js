// GitHub Pages serves only UI. All learning data and media stay behind the API.
let config={backendOrigin:''},ready=null;
const blobs=new Map(),pending=new Map();let blobBytes=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeBackend(value){if(!value)return '';const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('后端地址需要使用HTTPS源地址');return u.origin;}
export async function loadSiteConfig(){if(!ready)ready=fetch(new URL('./site-config.json',import.meta.url),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('网站配置加载失败');const d=await r.json();config={backendOrigin:normalizeBackend(d.backendOrigin)};return config;});return ready;}
export const isRemote=()=>!!config.backendOrigin;
const key=()=>`eju-listening:access:${config.backendOrigin}`;
const token=()=>{try{return sessionStorage.getItem(key())||'';}catch{return '';}};
export function setAccess(value){if(!/^[A-Za-z0-9_-]{43}$/.test(value||''))throw Error('登录会话无效');sessionStorage.setItem(key(),value);}
export function clearAccess(){try{sessionStorage.removeItem(key());}catch{}for(const v of blobs.values())URL.revokeObjectURL(v.url);blobs.clear();blobBytes=0;}
export function loginURL(){return new URL('./login.html',import.meta.url).href;}
export function backendURL(resource,origin=config.backendOrigin||location.origin){const u=new URL(resource,origin+'/');if(u.origin!==origin)throw Error('资料地址不属于本网站');return u.href;}
export async function apiFetch(resource,options={}){
 await loadSiteConfig();const headers=new Headers(options.headers||{});if(isRemote()&&token())headers.set('Authorization','Bearer '+token());
 const response=await fetch(backendURL(resource),{...options,headers,credentials:isRemote()?'omit':'same-origin'});
 if(response.status===401&&!String(resource).startsWith('/api/auth/'))window.dispatchEvent(new Event('eju-auth-required'));
 return response;
}
export function mediaAttributes(resource){return `${isRemote()?'data-protected-src':'src'}="${esc(resource)}"`;}
function trimBlobs(){for(const [resource,v] of blobs){if(blobBytes<=32*1024*1024&&blobs.size<=24)break;if([...document.querySelectorAll('audio,img,a')].some(el=>el.src===v.url||el.href===v.url))continue;URL.revokeObjectURL(v.url);blobs.delete(resource);blobBytes-=v.size;}}
export async function mediaURL(resource){
 if(!isRemote())return resource;
 if(blobs.has(resource)){const hit=blobs.get(resource);blobs.delete(resource);blobs.set(resource,hit);return hit.url;}
 if(pending.has(resource))return pending.get(resource);
 const request=(async()=>{const response=await apiFetch(resource);if(!response.ok)throw Error(response.status===401?'请重新登录后加载音频或题图':'音频或题图加载失败，请重试');const blob=await response.blob(),url=URL.createObjectURL(blob);blobs.set(resource,{url,size:blob.size});blobBytes+=blob.size;trimBlobs();return url;})();
 pending.set(resource,request);try{return await request;}finally{pending.delete(resource);}
}
export function hydrateMedia(root){
 for(const el of root.querySelectorAll('[data-protected-src]')){
  const src=el.dataset.protectedSrc;
  el.mediaReady=mediaURL(src).then(url=>{if(el.isConnected&&el.dataset.protectedSrc===src){el.src=url;const link=el.closest('figure')?.querySelector('[data-original-image]');if(link)link.href=url;}return url;}).catch(e=>{if(el.isConnected){const text=document.createElement('p');text.className='error-message';text.textContent=e.message;el.after(text);}throw e;});el.mediaReady.catch(()=>{});
 }
}
export async function waitMedia(el){if(el?.mediaReady)await el.mediaReady;}
