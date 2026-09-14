(function(){
  'use strict';
  function cfg(){return window.ThalysConfig?.backend||{};}
  function configured(){const c=cfg();return !!(c.enabled&&c.baseUrl);}
  function url(path){const base=String(cfg().baseUrl||'').replace(/\/+$/,'');const p=String(path||'').startsWith('/')?String(path):'/'+String(path||'');return base+p;}
  async function request(path,options={}){
    if(!configured())throw Object.assign(new Error('BACKEND_NOT_CONFIGURED'),{code:'BACKEND_NOT_CONFIGURED'});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(options.timeoutMs||8000));
    try{
      const response=await fetch(url(path),{
        method:options.method||'GET',
        headers:{'Content-Type':'application/json',...(options.headers||{})},
        body:options.body===undefined?undefined:JSON.stringify(options.body),
        signal:controller.signal,
        credentials:'omit'
      });
      let data=null;try{data=await response.json();}catch(_){data=null;}
      if(!response.ok)throw Object.assign(new Error(data?.error||('HTTP_'+response.status)),{status:response.status,data});
      return data;
    }finally{clearTimeout(timer);}
  }
  async function health(){if(!configured())return {configured:false,ok:false,provider:cfg().provider||'none'};try{return {configured:true,ok:true,provider:cfg().provider||'custom',data:await request(cfg().healthPath||'/health',{timeoutMs:5000})};}catch(error){return {configured:true,ok:false,provider:cfg().provider||'custom',error:String(error?.message||error)}}}
  async function registerPushSubscription(subscription){return request(cfg().pushSubscribePath||'/push/subscriptions',{method:'POST',body:{subscription,deviceId:window.ThalysStorage?.deviceId?.()||null,appVersion:window.ThalysConfig?.appVersion||''}});}
  async function unregisterPushSubscription(endpoint){return request(cfg().pushUnsubscribePath||'/push/subscriptions/remove',{method:'POST',body:{endpoint,deviceId:window.ThalysStorage?.deviceId?.()||null}});}
  async function refreshGoogleSession(payload={}){return request(cfg().googleRefreshPath||'/auth/google/refresh',{method:'POST',body:payload});}
  function snapshot(){const c=cfg();return {configured:configured(),provider:c.provider||'none',baseUrl:configured()?String(c.baseUrl):'',pushConfigured:!!(configured()&&c.vapidPublicKey),refreshBridge:!!(configured()&&c.googleRefreshPath)};}
  window.ThalysBackend=Object.freeze({configured,snapshot,health,registerPushSubscription,unregisterPushSubscription,refreshGoogleSession});
})();
