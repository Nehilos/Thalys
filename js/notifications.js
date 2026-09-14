(function(){
  'use strict';
  const state={registration:null};
  function supported(){return 'Notification' in window && 'serviceWorker' in navigator;}
  function permission(){return supported()?Notification.permission:'unsupported';}
  async function registration(){
    if(!supported())return null;
    if(state.registration)return state.registration;
    state.registration=await navigator.serviceWorker.ready;
    return state.registration;
  }
  async function refreshUI(){
    const p=permission();
    const el=document.getElementById('device-notification-status');
    if(el)el.textContent=p==='granted'?'Consentite':p==='denied'?'Negate':p==='default'?'Da chiedere':'Non supportate';
    const push=document.getElementById('device-push-status');
    if(push){
      const cap=!!window.ThalysCapabilities?.snapshot?.().push;
      push.textContent=!cap?'Non supportato':p==='granted'?'Pronto (server richiesto)':'Disponibile';
    }
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
  window.ThalysNotifications=Object.freeze({supported,permission,registration,refreshUI,requestPermission,show,test});
  window.requestThalysNotificationPermission=requestPermission;
  window.testThalysNotification=test;
})();
