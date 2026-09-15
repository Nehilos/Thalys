(function(){
  'use strict';
  const SESSION_ID_KEY='thalys_server_auth_session_id_v1';
  const SESSION_SECRET_KEY='thalys_server_auth_session_secret_v1';
  const SESSION_ACTIVE_KEY='thalys_server_auth_active_v1';
  const IDB_SESSION_META_KEY='server-auth-session-v1';
  let codeClient=null;
  let hydratePromise=null;
  let authorizePromise=null;
  let authorizeResolve=null;

  function backendCfg(){return window.ThalysConfig?.backend||{};}
  function enabled(){const c=backendCfg();return !!(window.ThalysBackend?.configured?.()&&c.googleCodeFlowEnabled===true&&c.googleCodeExchangePath);}
  function randomBytes(n=32){const b=new Uint8Array(n);crypto.getRandomValues(b);return b;}
  function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  async function mirrorSessionToIndexedDb(value){
    try{
      if(!window.ThalysStorage?.put)return;
      await window.ThalysStorage.put(window.ThalysStorage.CONFIG.stores.meta,{key:IDB_SESSION_META_KEY,value,updatedAt:new Date().toISOString()});
    }catch(err){console.warn('Server auth session mirror',err);}
  }
  async function hydrateSessionFromIndexedDb(){
    if(hydratePromise)return hydratePromise;
    hydratePromise=(async()=>{
      let current=session();
      if(current.sessionId&&current.sessionSecret)return current;
      try{
        await Promise.resolve(window.thalysStorageReady);
        const rec=await window.ThalysStorage?.get?.(window.ThalysStorage.CONFIG.stores.meta,IDB_SESSION_META_KEY);
        const v=rec?.value||{};
        if(v.sessionId&&v.sessionSecret){
          localStorage.setItem(SESSION_ID_KEY,String(v.sessionId));
          localStorage.setItem(SESSION_SECRET_KEY,String(v.sessionSecret));
          if(v.active===true)localStorage.setItem(SESSION_ACTIVE_KEY,'1');
          current=session();
        }
      }catch(err){console.warn('Server auth session hydrate',err);}
      return current;
    })().finally(()=>{hydratePromise=null;});
    return hydratePromise;
  }
  function markActive(active){
    try{if(active)localStorage.setItem(SESSION_ACTIVE_KEY,'1');else localStorage.removeItem(SESSION_ACTIVE_KEY);}catch(_){}
    const s=session();
    if(s.sessionId&&s.sessionSecret)mirrorSessionToIndexedDb({...s,active:!!active});
  }
  function cachedActive(){try{return localStorage.getItem(SESSION_ACTIVE_KEY)==='1';}catch(_){return false;}}
  function ensureSession(){
    let id=localStorage.getItem(SESSION_ID_KEY)||'';
    let secret=localStorage.getItem(SESSION_SECRET_KEY)||'';
    if(!id){id=(crypto.randomUUID?crypto.randomUUID():b64url(randomBytes(18)));localStorage.setItem(SESSION_ID_KEY,id);}
    if(!secret){secret=b64url(randomBytes(32));localStorage.setItem(SESSION_SECRET_KEY,secret);}
    mirrorSessionToIndexedDb({sessionId:id,sessionSecret:secret,active:cachedActive()});
    return {sessionId:id,sessionSecret:secret};
  }
  function session(){return {sessionId:localStorage.getItem(SESSION_ID_KEY)||'',sessionSecret:localStorage.getItem(SESSION_SECRET_KEY)||''};}
  function canRefresh(){const s=session();return enabled()&&!!(s.sessionId&&s.sessionSecret);}
  async function installAccessToken(data,silent=true){
    const token=String(data?.access_token||'');
    if(!token)return false;
    const expiresIn=Math.max(60,Number(data?.expires_in||3600));
    if(typeof window.installThalysDriveAccessToken==='function')window.installThalysDriveAccessToken(token,expiresIn);
    else if(window.gapi?.client){window.gapi.client.setToken({access_token:token});try{localStorage.setItem('thalys_drive_access_v1',JSON.stringify({access_token:token,expiresAt:Date.now()+expiresIn*1000}));}catch(_){}}
    if(typeof window.syncThalysDriveAfterServerToken==='function')return !!(await window.syncThalysDriveAfterServerToken(silent));
    return true;
  }
  async function refresh(silent=true){
    if(!canRefresh())return false;
    try{
      const s=session();
      const data=await window.ThalysBackend.refreshGoogleSession({sessionId:s.sessionId,sessionSecret:s.sessionSecret});
      markActive(true);
      return await installAccessToken(data,silent);
    }catch(err){
      const code=String(err?.data?.error||err?.message||'');
      if(['SERVER_SESSION_NOT_FOUND','SERVER_SESSION_UNAUTHORIZED','REFRESH_TOKEN_INVALID'].includes(code))clearSession(false);
      if(!silent)window.showToast?.('Sessione server non disponibile: uso accesso Google normale');
      return false;
    }
  }
  function buildCodeClient(){
    if(!enabled()||!window.google?.accounts?.oauth2?.initCodeClient)return null;
    const c=backendCfg();
    const scopes=String(c.googleScopes||window.THALYS_GOOGLE_SCOPES||'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
    codeClient=window.google.accounts.oauth2.initCodeClient({
      client_id:String(c.googleClientId||window.THALYS_GOOGLE_CLIENT_ID||''),
      scope:scopes,
      ux_mode:'popup',
      // Explicit login is intentionally authoritative: Google consent is requested
      // here only after install/update/logout so the backend receives a durable
      // refresh token and subsequent reconnects need no popup.
      prompt:'consent',
      include_granted_scopes:true,
      callback:async response=>{
        if(response?.error||!response?.code){
          window.showToast?.('Autorizzazione server Google non completata');
          if(authorizeResolve){authorizeResolve(false);authorizeResolve=null;authorizePromise=null;}
          return;
        }
        try{
          const s=ensureSession();
          const data=await window.ThalysBackend.exchangeGoogleCode({
            code:response.code,
            redirectUri:location.origin,
            sessionId:s.sessionId,
            sessionSecret:s.sessionSecret,
            deviceId:window.ThalysStorage?.deviceId?.()||''
          });
          // A server session is considered valid only when Google issued/stored the
          // persistent refresh token. This makes the single login popup authoritative.
          if(data?.refreshStored!==true)throw Object.assign(new Error('REFRESH_TOKEN_NOT_STORED'),{code:'REFRESH_TOKEN_NOT_STORED'});
          markActive(true);
          const ok=await installAccessToken(data,false);
          if(!ok)throw Object.assign(new Error('DRIVE_CONNECT_FAILED'),{code:'DRIVE_CONNECT_FAILED'});
          window.showToast?.('Google collegato · sessione server attiva','fa-shield-halved');
          await refreshUI();
          if(authorizeResolve){authorizeResolve(true);authorizeResolve=null;authorizePromise=null;}
          return true;
        }catch(err){
          console.error('Server auth code exchange',err);
          markActive(false);
          window.showToast?.('Impossibile completare la sessione Google persistente');
          await refreshUI();
          if(authorizeResolve){authorizeResolve(false);authorizeResolve=null;authorizePromise=null;}
          return false;
        }
      },
      error_callback:()=>{
        window.showToast?.('Finestra Google chiusa o non disponibile');
        if(authorizeResolve){authorizeResolve(false);authorizeResolve=null;authorizePromise=null;}
      }
    });
    return codeClient;
  }
  async function authorize(){
    if(!enabled()){window.showToast?.('Backend gratuito non ancora configurato');return false;}
    if(authorizePromise)return authorizePromise;
    ensureSession();
    const client=codeClient||buildCodeClient();
    if(!client){window.showToast?.('Google non pronto: riprova tra poco');return false;}
    authorizePromise=new Promise(resolve=>{authorizeResolve=resolve;});
    try{client.requestCode();}catch(err){
      console.error('Server auth popup',err);
      const resolve=authorizeResolve;authorizeResolve=null;authorizePromise=null;
      resolve?.(false);
    }
    return authorizePromise;
  }
  async function status(){
    if(!enabled())return {enabled:false,active:false};
    let s=session();
    if(!s.sessionId||!s.sessionSecret){s=await hydrateSessionFromIndexedDb();}
    if(!s.sessionId||!s.sessionSecret)return {enabled:true,active:false,missingLocalSession:true};
    try{
      const st=await window.ThalysBackend.googleSessionStatus({sessionId:s.sessionId,sessionSecret:s.sessionSecret});
      if(st?.active===true)markActive(true);
      else if(st?.active===false)markActive(false);
      return st;
    }catch(_){
      return {enabled:true,active:cachedActive(),error:true,transient:true};
    }
  }
  async function clearSession(removeRemote=true){
    const s=session();
    if(removeRemote&&enabled()&&s.sessionId&&s.sessionSecret){try{await window.ThalysBackend.deleteGoogleSession({sessionId:s.sessionId,sessionSecret:s.sessionSecret});}catch(_){}}
    localStorage.removeItem(SESSION_ID_KEY);localStorage.removeItem(SESSION_SECRET_KEY);localStorage.removeItem(SESSION_ACTIVE_KEY);
    try{if(window.ThalysStorage?.put)await window.ThalysStorage.put(window.ThalysStorage.CONFIG.stores.meta,{key:IDB_SESSION_META_KEY,value:{},updatedAt:new Date().toISOString()});}catch(_){}
    codeClient=null;await refreshUI();
  }
  async function refreshUI(){
    const el=document.getElementById('device-server-session-status');
    const btn=document.getElementById('device-server-session-btn');
    const c=backendCfg();
    if(btn)btn.classList.toggle('hidden',!enabled());
    if(!el)return;
    if(!c.enabled){el.textContent='Disattivata';return;}
    if(!c.googleCodeFlowEnabled){el.textContent='Pronta · non attiva';return;}
    const st=await status();
    if(st?.active&&st?.transient)el.textContent='Attiva · verifica in corso';
    else if(st?.active)el.textContent='Attiva';
    else if(st?.transient)el.textContent='Verifica connessione…';
    else el.textContent=st?.enabled?'Da attivare':'Non disponibile';
  }
  function cachedTokenExpiresAt(){
    try{return Number(JSON.parse(localStorage.getItem('thalys_drive_access_v1')||'null')?.expiresAt||0);}catch(_){return 0;}
  }
  let refreshTimer=null,refreshBusy=false;
  async function proactiveRefresh(){
    if(refreshBusy||!navigator.onLine)return false;
    await hydrateSessionFromIndexedDb();
    if(!canRefresh())return false;
    const expiresAt=cachedTokenExpiresAt();
    // Refresh only when the access token is missing or has less than 10 minutes left.
    if(expiresAt>Date.now()+10*60*1000)return true;
    refreshBusy=true;
    try{const ok=await refresh(true);await refreshUI();return ok;}finally{refreshBusy=false;}
  }
  // v0.48.2: when connectivity returns, explicitly restore the persistent
  // server-side Google session before Drive is considered reconnected.  This
  // intentionally bypasses the access-token expiry shortcut in proactiveRefresh:
  // a still-valid Drive token must not leave the server session UI/state stale.
  async function recoverAfterNetworkReturn(){
    if(refreshBusy||!navigator.onLine||!enabled())return false;
    await hydrateSessionFromIndexedDb();
    if(!canRefresh()){await refreshUI();return false;}
    refreshBusy=true;
    try{
      const st=await status();
      // If status could not be verified because of a transient network/backend
      // failure, a previously-active local session may still be refreshed safely.
      if(st?.active!==true&&!st?.transient){await refreshUI();return false;}
      const ok=await refresh(true);
      if(ok)markActive(true);
      await refreshUI();
      return !!ok;
    }finally{refreshBusy=false;}
  }
  function startRefreshSupervisor(){
    if(refreshTimer)clearInterval(refreshTimer);
    if(!enabled())return;
    setTimeout(proactiveRefresh,1500);
    refreshTimer=setInterval(proactiveRefresh,5*60*1000);
  }
  window.addEventListener('online',()=>setTimeout(async()=>{await recoverAfterNetworkReturn();},250),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(proactiveRefresh,250);});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(async()=>{await hydrateSessionFromIndexedDb();await refreshUI();},0));
  window.addEventListener('load',async()=>{if(enabled()){await hydrateSessionFromIndexedDb();buildCodeClient();startRefreshSupervisor();await refreshUI();}},{once:true});
  window.ThalysServerAuth=Object.freeze({enabled,canRefresh,authorize,refresh,proactiveRefresh,recoverAfterNetworkReturn,status,clearSession,refreshUI});
  window.enableThalysServerSession=authorize;
})();
