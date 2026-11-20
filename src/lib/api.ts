import type {Session} from '../types';
async function json<T>(res:Response):Promise<T>{const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);return data as T}
export const api={list:()=>fetch('/api/sessions').then(r=>json<Session[]>(r)),get:(id:string)=>fetch(`/api/sessions/${id}`).then(r=>json<Session>(r)),start:(url:string)=>fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}).then(r=>json<Session>(r))};
