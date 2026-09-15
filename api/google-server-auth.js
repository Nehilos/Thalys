const WORKER_BASE_URL = process.env.THALYS_GOOGLE_WORKER_URL || 'https://thalys.thalys-app.workers.dev';
const ALLOWED_PATHS = new Set([
  '/auth/google/code',
  '/auth/google/refresh',
  '/auth/google/status',
  '/auth/google/logout'
]);

function send(res,status,payload){
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  const path=String(req.headers['x-thalys-backend-path']||'');
  if(!ALLOWED_PATHS.has(path))return send(res,400,{ok:false,error:'INVALID_BACKEND_PATH'});

  let origin='';
  try{origin=new URL(String(req.headers.origin||req.headers.referer||'')).origin;}catch(_){origin=String(req.headers.origin||'').replace(/\/$/,'');}
  let body = req.body;
  if(typeof body==='string'){
    try{body=JSON.parse(body);}catch(_){return send(res,400,{ok:false,error:'INVALID_JSON'});}
  }
  body = body && typeof body==='object' ? body : {};

  // For the authorization-code exchange, the redirect URI must stay identical to the
  // browser origin used by Google. Prefer the explicit value supplied by Thalys.
  const forwardedOrigin = String(body.redirectUri || origin || '').replace(/\/$/,'');

  try{
    const headers={'Content-Type':'application/json'};
    if(path==='/auth/google/code')headers['X-Requested-With']='XmlHttpRequest';
    if(forwardedOrigin)headers['Origin']=forwardedOrigin;

    const upstream=await fetch(WORKER_BASE_URL.replace(/\/+$/,'')+path,{
      method:'POST',
      headers,
      body:JSON.stringify(body),
      redirect:'manual'
    });
    const text=await upstream.text();
    let payload;
    try{payload=JSON.parse(text);}catch(_){payload={ok:false,error:'WORKER_INVALID_RESPONSE',status:upstream.status,body:text.slice(0,300)};}
    return send(res,upstream.status,payload);
  }catch(err){
    return send(res,502,{ok:false,error:'WORKER_FETCH_FAILED',detail:String(err?.message||err),worker:WORKER_BASE_URL});
  }
}
