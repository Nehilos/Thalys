(function(){
  'use strict';
  function standalone(){
    try{return !!(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true);}catch(_){return false;}
  }
  function snapshot(){
    return Object.freeze({
      camera:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),
      microphone:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),
      notifications:'Notification' in window,
      serviceWorker:'serviceWorker' in navigator,
      push:('PushManager' in window)&&('serviceWorker' in navigator),
      share:typeof navigator.share==='function',
      fileSystemAccess:typeof window.showOpenFilePicker==='function',
      persistentStorage:!!(navigator.storage&&navigator.storage.persist),
      standalone:standalone(),
      secureContext:window.isSecureContext===true,
      platform:String(navigator.platform||''),
      userAgent:String(navigator.userAgent||'')
    });
  }
  async function permission(name){
    try{
      if(!navigator.permissions?.query)return 'unknown';
      const result=await navigator.permissions.query({name});
      return result?.state||'unknown';
    }catch(_){return 'unknown';}
  }
  window.ThalysCapabilities=Object.freeze({snapshot,permission,standalone});
  window.dispatchEvent(new CustomEvent('thalys:capabilities-ready',{detail:snapshot()}));
})();
