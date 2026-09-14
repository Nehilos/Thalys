// Thalys free-first backend scaffold for Cloudflare Workers.
// It stores ONLY Push subscription metadata in D1.
// Photos and application databases remain on Google Drive / IndexedDB.

function json(data,status=200,origin='*'){
  return new Response(JSON.stringify(data),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':origin,
    'access-control-allow-headers':'content-type',
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'cache-control':'no-store'
  }});
}
function corsOrigin(request,env){
  const allowed=String(env.ALLOWED_ORIGIN||'*').trim();
  if(allowed==='*')return '*';
  const origin=request.headers.get('origin')||'';
  return origin===allowed?origin:allowed;
}
async function bodyJson(request){try{return await request.json();}catch(_){return {};}}

export default {
  async fetch(request,env){
    const u=new URL(request.url);
    const origin=corsOrigin(request,env);
    if(request.method==='OPTIONS')return json({ok:true},204,origin);

    if(u.pathname==='/health'&&request.method==='GET'){
      return json({ok:true,service:'thalys-free-backend',provider:'cloudflare-workers-free',photos:'google-drive-only',appData:'google-drive-plus-indexeddb'},200,origin);
    }

    if(u.pathname==='/push/subscriptions'&&request.method==='POST'){
      if(!env.DB)return json({ok:false,error:'D1_NOT_CONFIGURED'},503,origin);
      const body=await bodyJson(request);
      const sub=body.subscription||{};
      const endpoint=String(sub.endpoint||'');
      const p256dh=String(sub.keys?.p256dh||'');
      const auth=String(sub.keys?.auth||'');
      if(!endpoint||!p256dh||!auth)return json({ok:false,error:'INVALID_SUBSCRIPTION'},400,origin);
      await env.DB.prepare(`INSERT INTO push_subscriptions(endpoint,p256dh,auth,device_id,app_version,updated_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,device_id=excluded.device_id,app_version=excluded.app_version,updated_at=excluded.updated_at`)
        .bind(endpoint,p256dh,auth,String(body.deviceId||''),String(body.appVersion||''),new Date().toISOString()).run();
      return json({ok:true},200,origin);
    }

    if(u.pathname==='/push/subscriptions/remove'&&request.method==='POST'){
      if(!env.DB)return json({ok:false,error:'D1_NOT_CONFIGURED'},503,origin);
      const body=await bodyJson(request);
      const endpoint=String(body.endpoint||'');
      if(!endpoint)return json({ok:false,error:'ENDPOINT_REQUIRED'},400,origin);
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run();
      return json({ok:true},200,origin);
    }

    if(u.pathname==='/auth/google/refresh'){
      // Intentionally not implemented yet: proper refresh-token support requires
      // migrating Google sign-in to an authorization-code flow and storing the
      // refresh token server-side. The current browser login remains unchanged.
      return json({ok:false,error:'GOOGLE_REFRESH_NOT_CONFIGURED'},501,origin);
    }

    return json({ok:false,error:'NOT_FOUND'},404,origin);
  }
};
