(function(){
  'use strict';
  const state={registration:null,subscription:null};
  function supported(){return 'Notification' in window && 'serviceWorker' in navigator;}
  function permission(){return supported()?Notification.permission:'unsupported';}
  async function registration(){
    if(!supported())return null;
    if(state.registration)return state.registration;
    state.registration=await navigator.serviceWorker.ready;
    return state.registration;
  }

  function pushSupported(){return supported()&&'PushManager' in window;}
  function vapidKey(){return String(window.ThalysConfig?.backend?.vapidPublicKey||'').trim();}
  function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));}
  async function getPushSubscription(){if(!pushSupported())return null;const reg=await registration();if(!reg)return null;state.subscription=await reg.pushManager.getSubscription();return state.subscription;}
  async function subscribeRemote(){
    if(!pushSupported()){window.showToast?.('Push non supportate su questo dispositivo');return false;}
    const perm=await requestPermission();if(perm!=='granted')return false;
    if(!window.ThalysBackend?.configured?.()||!vapidKey()){await refreshUI();window.showToast?.('Push remote pronte lato app: backend non ancora configurato');return false;}
    const reg=await registration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidKey())});
    state.subscription=sub;
    await window.ThalysBackend.registerPushSubscription(sub.toJSON());
    await refreshUI();window.showToast?.('Push remote attivate','fa-bell');return true;
  }
  async function unsubscribeRemote(){
    const sub=await getPushSubscription();if(!sub){await refreshUI();return true;}
    const endpoint=sub.endpoint;
    if(window.ThalysBackend?.configured?.()){try{await window.ThalysBackend.unregisterPushSubscription(endpoint);}catch(err){console.warn('Push backend unsubscribe',err);}}
    await sub.unsubscribe();state.subscription=null;await refreshUI();window.showToast?.('Push remote disattivate');return true;
  }

  async function refreshUI(){
    const p=permission();
    const el=document.getElementById('device-notification-status');
    if(el)el.textContent=p==='granted'?'Consentite':p==='denied'?'Negate':p==='default'?'Da chiedere':'Non supportate';
    const push=document.getElementById('device-push-status');
    if(push){
      const cap=pushSupported();
      let sub=null;try{sub=cap?await getPushSubscription():null;}catch(_){}
      const backend=window.ThalysBackend?.snapshot?.()||{configured:false,pushConfigured:false};
      push.textContent=!cap?'Non supportato':sub?'Attive':backend.pushConfigured?'Pronte da attivare':p==='granted'?'Client pronto · backend non configurato':'Disponibili';
    }
    const backendEl=document.getElementById('device-backend-status');
    if(backendEl){const b=window.ThalysBackend?.snapshot?.()||{configured:false,provider:'none'};backendEl.textContent=b.configured?('Configurato · '+b.provider):(b.deploymentStage==='prepared'?'Pronto al deploy':'Non configurato');}
    const costEl=document.getElementById('device-cost-status');
    if(costEl)costEl.textContent=window.ThalysConfig?.costPolicy?.mode==='free-only'?'Solo gratuito':'Configurabile';
    const photoEl=document.getElementById('device-photo-storage-status');
    if(photoEl)photoEl.textContent=window.ThalysConfig?.costPolicy?.progressPhotos==='google-drive-only'?'Solo Google Drive':'Configurabile';
    try{await window.ThalysServerAuth?.refreshUI?.();}catch(_){}
    return p;
  }
  async function requestPermission(){
    if(!supported()){window.showToast?.('Notifiche non supportate su questo dispositivo');return 'unsupported';}
    let p=Notification.permission;
    if(p==='default')p=await Notification.requestPermission();
    await refreshUI();
    if(p==='granted')window.showToast?.('Notifiche abilitate','fa-bell');
    else if(p==='denied')window.showToast?.('Permesso notifiche negato');
    return p;
  }
  async function show(title,options={}){
    if(Notification.permission!=='granted'){
      const p=await requestPermission();if(p!=='granted')return false;
    }
    const reg=await registration();if(!reg)return false;
    await reg.showNotification(title||'Thalys',{body:options.body||'',tag:options.tag||'thalys-local',renotify:false,data:{url:options.url||'./',...(options.data||{})}});
    return true;
  }
  async function test(){
    try{return await show('Thalys',{body:'Le notifiche sul dispositivo funzionano correttamente.',tag:'thalys-test'});}
    catch(err){console.warn('Thalys notification test',err);window.showToast?.('Impossibile mostrare la notifica');return false;}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshUI,0));
  window.ThalysNotifications=Object.freeze({supported,pushSupported,permission,registration,refreshUI,requestPermission,show,test,getPushSubscription,subscribeRemote,unsubscribeRemote});
  window.requestThalysNotificationPermission=requestPermission;
  window.testThalysNotification=test;
  window.enableThalysRemotePush=subscribeRemote;
  window.disableThalysRemotePush=unsubscribeRemote;
})();
