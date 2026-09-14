(function(){
  'use strict';
  async function check(){
    const cfg=window.ThalysConfig||{};
    const report={
      version:cfg.appVersion||'',
      generatedAt:new Date().toISOString(),
      online:navigator.onLine,
      storage:!!window.ThalysStorage,
      syncQueue:!!window.ThalysSyncQueue,
      conflictResolver:!!window.ThalysConflictResolver,
      capabilities:window.ThalysCapabilities?.snapshot?.()||null,
      deviceMedia:!!window.ThalysDeviceMedia,
      warnings:[]
    };
    if(!window.indexedDB)report.warnings.push('indexeddb-unavailable');
    if(cfg.features?.deviceMediaLayer&&!window.ThalysDeviceMedia)report.warnings.push('device-media-unavailable');
    if(window.ThalysStorage?.CONFIG?.syncProtocolVersion!==cfg.syncProtocolVersion)report.warnings.push('sync-protocol-version-mismatch');
    try{
      const versions=await window.ThalysStorage?.get?.(window.ThalysStorage.CONFIG.stores.meta,'versions');
      if(versions?.value?.appVersion&&versions.value.appVersion!==cfg.appVersion)report.warnings.push('stored-app-version-stale');
    }catch(_){report.warnings.push('storage-version-check-failed');}
    window.ThalysRuntimeHealth=report;
    window.dispatchEvent(new CustomEvent('thalys:health-ready',{detail:report}));
    return report;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(check,0),{once:true});
  else setTimeout(check,0);
})();
