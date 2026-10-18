import {apiFetch,clearAccess,loginURL} from './transport.js';
let current=null;
window.addEventListener('eju-auth-required',()=>{document.querySelectorAll('audio').forEach(a=>a.pause());clearAccess();location.replace(loginURL());});
window.addEventListener('pageshow',e=>{if(e.persisted)requireLogin().catch(()=>location.replace(loginURL()));});
export async function requireLogin(){
 const response=await apiFetch('/api/auth/session',{cache:'no-store'});if(!response.ok)throw Error('无法连接登录服务');const session=await response.json();
 if(!session.authenticated){location.replace(loginURL()+'?next='+encodeURIComponent(location.pathname+location.search+location.hash));return false;}
 current=session;return true;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function accountHTML(){return `<span class="account-controls"><span>${esc(current?.username||'学生内测')}</span><button type="button" data-logout>退出登录</button></span>`;}
export function bindAccount(root,beforeLogout=()=>{}){root.querySelectorAll('[data-logout]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{const r=await apiFetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error();beforeLogout();clearAccess();location.replace(loginURL());}catch{b.disabled=false;b.textContent='退出失败，重试';}});}
