(function(){
  'use strict';
  function cfg(){return window.ThalysConfig?.backend||{};}
  function costPolicy(){return window.ThalysConfig?.costPolicy||{};}
  function costSafe(){
    const c=cfg(),p=costPolicy();
    if(p.allowPaidServices===false && c.requiresBilling===true)return false;
    if(c.freeTierOnly===false && p.mode==='free-only')return false;
    return true;
  }
  function configured(){const c=cfg();return !!(c.enabled&&c.baseUrl&&costSafe());}
  function expectedContract(){return String(cfg().contractVersion||'1');}
  function validateHealthPayload(data){
    if(!data||data.ok!==true)return {ok:false,reason:'HEALTH_INVALID'};
    if(String(data.contractVersion||'')!==expectedContract())return {ok:false,reason:'BACKEND_CONTRACT_MISMATCH'};
    if(data.billingRequired!==false)return {ok:false,reason:'PAID_BACKEND_BLOCKED'};
    if(String(data.photos||'')!=='google-drive-only')return {ok:false,reason:'PHOTO_POLICY_MISMATCH'};
    return {ok:true};
  }
  function url(path){const base=String(cfg().baseUrl||'').replace(/\/+$/,'');const p=String(path||'').startsWith('/')?String(path):'/'+String(path||'');return base+p;}
  function desktopRuntime(){try{return window.matchMedia('(pointer:fine)').matches&&window.innerWidth>=768;}catch(_){return false;}}
  function isGoogleAuthPath(path){return String(path||'').startsWith('/auth/google/');}
  function requestUrl(path){
    if(desktopRuntime()&&isGoogleAuthPath(path)&&cfg().desktopGoogleProxyPath)return String(cfg().desktopGoogleProxyPath);
    return url(path);
  }
  async function request(path,options={}){
    if(!costSafe())throw Object.assign(new Error('PAID_BACKEND_BLOCKED'),{code:'PAID_BACKEND_BLOCKED'});
    if(!configured())throw Object.assign(new Error('BACKEND_NOT_CONFIGURED'),{code:'BACKEND_NOT_CONFIGURED'});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(options.timeoutMs||8000));
    try{
      const useDesktopProxy=desktopRuntime()&&isGoogleAuthPath(path)&&cfg().desktopGoogleProxyPath;
      const response=await fetch(requestUrl(path),{
        method:options.method||'GET',
        headers:{'Content-Type':'application/json',...(useDesktopProxy?{'X-Thalys-Backend-Path':String(path)}:{}),...(options.headers||{})},
        body:options.body===undefined?undefined:JSON.stringify(options.body),
        signal:controller.signal,
        credentials:'omit'
      });
      let data=null;try{data=await response.json();}catch(_){data=null;}
      if(!response.ok)throw Object.assign(new Error(data?.error||('HTTP_'+response.status)),{status:response.status,data});
      return data;
    }finally{clearTimeout(timer);}
  }
  async function health(){
    if(!configured())return {configured:false,ok:false,provider:cfg().provider||'none',costSafe:costSafe(),stage:cfg().deploymentStage||'off'};
    try{
      const data=await request(cfg().healthPath||'/health',{timeoutMs:5000});
      const check=validateHealthPayload(data);
      return {configured:true,ok:check.ok,provider:cfg().provider||'custom',costSafe:true,contractOk:check.ok,reason:check.reason||'',data};
    }catch(error){return {configured:true,ok:false,provider:cfg().provider||'custom',costSafe:true,error:String(error?.message||error)}}
  }
  async function pushConfig(){return request(cfg().pushConfigPath||'/push/config',{timeoutMs:5000});}
  async function registerPushSubscription(subscription){return request(cfg().pushSubscribePath||'/push/subscriptions',{method:'POST',body:{subscription,deviceId:window.ThalysStorage?.deviceId?.()||null,appVersion:window.ThalysConfig?.appVersion||''}});}
  async function unregisterPushSubscription(endpoint){return request(cfg().pushUnsubscribePath||'/push/subscriptions/remove',{method:'POST',body:{endpoint,deviceId:window.ThalysStorage?.deviceId?.()||null}});}
  async function testRemotePush(endpoint){return request(cfg().pushTestPath||'/push/test',{method:'POST',body:{endpoint,deviceId:window.ThalysStorage?.deviceId?.()||null}});}
  async function exchangeGoogleCode(payload={}){return request(cfg().googleCodeExchangePath||'/auth/google/code',{method:'POST',headers:{'X-Requested-With':'XmlHttpRequest'},body:payload});}
  async function refreshGoogleSession(payload={}){return request(cfg().googleRefreshPath||'/auth/google/refresh',{method:'POST',body:payload});}
  async function googleSessionStatus(payload={}){return request(cfg().googleStatusPath||'/auth/google/status',{method:'POST',body:payload});}
  async function deleteGoogleSession(payload={}){return request(cfg().googleLogoutPath||'/auth/google/logout',{method:'POST',body:payload});}
  function snapshot(){const c=cfg(),p=costPolicy();return {configured:configured(),provider:c.provider||'none',baseUrl:configured()?String(c.baseUrl):'',deploymentStage:c.deploymentStage||'off',contractVersion:expectedContract(),autoActivate:c.autoActivate===true,pushConfigured:!!configured(),refreshBridge:!!(configured()&&c.googleRefreshPath),googleCodeFlow:!!(configured()&&c.googleCodeFlowEnabled&&c.googleCodeExchangePath),freeOnly:p.mode==='free-only',costSafe:costSafe(),photos:p.progressPhotos||'google-drive-only'};}
  window.ThalysBackend=Object.freeze({configured,costSafe,snapshot,health,validateHealthPayload,pushConfig,registerPushSubscription,unregisterPushSubscription,testRemotePush,exchangeGoogleCode,refreshGoogleSession,googleSessionStatus,deleteGoogleSession});
})();
