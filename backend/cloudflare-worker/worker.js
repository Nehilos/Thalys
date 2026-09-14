// Thalys v0.44.0 free-first Cloudflare Worker.
// Scope: health, push subscription registry and optional Google server-side refresh sessions.
// Progress photos and Thalys application databases NEVER live here.

function json(data,status=200,origin='*'){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':origin,
    'access-control-allow-headers':'content-type,x-requested-with',
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'vary':'origin','cache-control':'no-store'
  }});
}
function allowedOrigins(env){return String(env.ALLOWED_ORIGIN||'').split(',').map(v=>v.trim()).filter(Boolean);}
function corsOrigin(request,env){const origin=request.headers.get('origin')||'';const allowed=allowedOrigins(env);return allowed.includes('*')?'*':allowed.includes(origin)?origin:'';}
function originAllowed(request,env){return !!corsOrigin(request,env);}
async function bodyJson(request){try{return await request.json();}catch(_){return {};}}
function enc(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function dec(value){let s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function textBytes(value){return new TextEncoder().encode(String(value||''));}
async function sha256(value){return enc(new Uint8Array(await crypto.subtle.digest('SHA-256',textBytes(value))));}
async function encryptionKey(env){const raw=dec(env.AUTH_ENCRYPTION_KEY||'');if(raw.length!==32)throw new Error('AUTH_ENCRYPTION_KEY_INVALID');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
async function encryptSecret(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const key=await encryptionKey(env);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,textBytes(value));return {cipher:enc(new Uint8Array(cipher)),iv:enc(iv)};}
async function decryptSecret(cipher,iv,env){const key=await encryptionKey(env);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:dec(iv)},key,dec(cipher));return new TextDecoder().decode(plain);}
function secureConfigured(env){return !!(env.DB&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.AUTH_ENCRYPTION_KEY&&allowedOrigins(env).length&& !allowedOrigins(env).includes('*'));}
async function googleTokenRequest(params){
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||'GOOGLE_TOKEN_ERROR'),{status:response.status,data});
  return data;
}
async function verifiedSession(body,env){
  if(!env.DB)return null;
  const id=String(body.sessionId||''),secret=String(body.sessionSecret||'');
  if(!id||!secret)return null;
  const row=await env.DB.prepare('SELECT * FROM google_sessions WHERE session_id=?').bind(id).first();
  if(!row)return null;
  if(String(row.session_hash)!==await sha256(secret))return null;
  return row;
}

export default {
  async fetch(request,env){
    const u=new URL(request.url);
    const origin=corsOrigin(request,env);
    if(request.method==='OPTIONS')return origin?json({ok:true},204,origin):json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403,'null');
    if(!originAllowed(request,env) && u.pathname!=='/health')return json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403,'null');

    if(u.pathname==='/health'&&request.method==='GET'){
      return json({ok:true,service:'thalys-free-backend',contractVersion:'1',provider:'cloudflare-workers-free',photos:'google-drive-only',appData:'google-drive-plus-indexeddb',billingRequired:false,capabilities:{d1:!!env.DB,googleServerAuth:secureConfigured(env),pushRegistry:!!env.DB,vapid:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY)}},200,origin||'*');
    }

    if(u.pathname==='/push/subscriptions'&&request.method==='POST'){
      if(!env.DB)return json({ok:false,error:'D1_NOT_CONFIGURED'},503,origin);
      const body=await bodyJson(request),sub=body.subscription||{};
      const endpoint=String(sub.endpoint||''),p256dh=String(sub.keys?.p256dh||''),auth=String(sub.keys?.auth||'');
      if(!endpoint||!p256dh||!auth)return json({ok:false,error:'INVALID_SUBSCRIPTION'},400,origin);
      await env.DB.prepare(`INSERT INTO push_subscriptions(endpoint,p256dh,auth,device_id,app_version,updated_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,device_id=excluded.device_id,app_version=excluded.app_version,updated_at=excluded.updated_at`)
        .bind(endpoint,p256dh,auth,String(body.deviceId||''),String(body.appVersion||''),new Date().toISOString()).run();
      return json({ok:true},200,origin);
    }

    if(u.pathname==='/push/subscriptions/remove'&&request.method==='POST'){
      if(!env.DB)return json({ok:false,error:'D1_NOT_CONFIGURED'},503,origin);
      const body=await bodyJson(request),endpoint=String(body.endpoint||'');
      if(!endpoint)return json({ok:false,error:'ENDPOINT_REQUIRED'},400,origin);
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run();
      return json({ok:true},200,origin);
    }

    if(u.pathname==='/auth/google/code'&&request.method==='POST'){
      if(!secureConfigured(env))return json({ok:false,error:'GOOGLE_SERVER_AUTH_NOT_CONFIGURED'},503,origin);
      if((request.headers.get('x-requested-with')||'').toLowerCase()!=='xmlhttprequest')return json({ok:false,error:'CSRF_HEADER_REQUIRED'},400,origin);
      const body=await bodyJson(request);
      const code=String(body.code||''),redirectUri=String(body.redirectUri||''),sessionId=String(body.sessionId||''),sessionSecret=String(body.sessionSecret||'');
      if(!code||!redirectUri||!sessionId||!sessionSecret)return json({ok:false,error:'AUTH_CODE_FIELDS_REQUIRED'},400,origin);
      if(redirectUri!==(request.headers.get('origin')||''))return json({ok:false,error:'REDIRECT_ORIGIN_MISMATCH'},400,origin);
      try{
        const token=await googleTokenRequest({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'});
        let refreshStored=false;
        if(token.refresh_token){
          const encrypted=await encryptSecret(token.refresh_token,env),now=new Date().toISOString();
          await env.DB.prepare(`INSERT INTO google_sessions(session_id,session_hash,refresh_cipher,refresh_iv,device_id,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET session_hash=excluded.session_hash,refresh_cipher=excluded.refresh_cipher,refresh_iv=excluded.refresh_iv,device_id=excluded.device_id,updated_at=excluded.updated_at`)
            .bind(sessionId,await sha256(sessionSecret),encrypted.cipher,encrypted.iv,String(body.deviceId||''),now,now).run();
          refreshStored=true;
        }
        return json({ok:true,access_token:token.access_token,expires_in:token.expires_in||3600,scope:token.scope||'',refreshStored},200,origin);
      }catch(err){return json({ok:false,error:err?.data?.error||err?.message||'GOOGLE_CODE_EXCHANGE_FAILED'},err?.status||502,origin);}
    }

    if(u.pathname==='/auth/google/refresh'&&request.method==='POST'){
      if(!secureConfigured(env))return json({ok:false,error:'GOOGLE_SERVER_AUTH_NOT_CONFIGURED'},503,origin);
      const body=await bodyJson(request),row=await verifiedSession(body,env);
      if(!row)return json({ok:false,error:'SERVER_SESSION_UNAUTHORIZED'},401,origin);
      try{
        const refreshToken=await decryptSecret(row.refresh_cipher,row.refresh_iv,env);
        const token=await googleTokenRequest({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'});
        await env.DB.prepare('UPDATE google_sessions SET updated_at=? WHERE session_id=?').bind(new Date().toISOString(),String(body.sessionId||'')).run();
        return json({ok:true,access_token:token.access_token,expires_in:token.expires_in||3600,scope:token.scope||''},200,origin);
      }catch(err){
        const invalid=String(err?.data?.error||'')==='invalid_grant';
        if(invalid)await env.DB.prepare('DELETE FROM google_sessions WHERE session_id=?').bind(String(body.sessionId||'')).run();
        return json({ok:false,error:invalid?'REFRESH_TOKEN_INVALID':(err?.data?.error||err?.message||'GOOGLE_REFRESH_FAILED')},invalid?401:(err?.status||502),origin);
      }
    }

    if(u.pathname==='/auth/google/status'&&request.method==='POST'){
      if(!secureConfigured(env))return json({ok:true,enabled:false,active:false},200,origin);
      const body=await bodyJson(request),row=await verifiedSession(body,env);
      return json({ok:true,enabled:true,active:!!row},200,origin);
    }

    if(u.pathname==='/auth/google/logout'&&request.method==='POST'){
      if(!env.DB)return json({ok:true},200,origin);
      const body=await bodyJson(request),row=await verifiedSession(body,env);
      if(row)await env.DB.prepare('DELETE FROM google_sessions WHERE session_id=?').bind(String(body.sessionId||'')).run();
      return json({ok:true},200,origin);
    }

    return json({ok:false,error:'NOT_FOUND'},404,origin||'*');
  }
};
