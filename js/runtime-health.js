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
      notifications:!!window.ThalysNotifications,
      backend:window.ThalysBackend?.snapshot?.()||null,
      serverAuth:window.ThalysServerAuth?{enabled:window.ThalysServerAuth.enabled?.()||false,canRefresh:window.ThalysServerAuth.canRefresh?.()||false}:null,
      costPolicy:cfg.costPolicy||null,
      sync:{
        configuredProtocol:Number(cfg.syncProtocolVersion||0),
        resolverProtocol:Number(window.ThalysConflictResolver?.protocolVersion||0),
        resolverAppVersion:String(window.ThalysConflictResolver?.appVersion||''),
        dirty:localStorage.getItem('thalys_drive_dirty')==='1',
        pending:0
      },
      warnings:[]
    };
    try{report.sync.pending=Number(await window.ThalysSyncQueue?.countPending?.()||0);}catch(_){report.warnings.push('sync-pending-check-failed');}
    if(!window.indexedDB)report.warnings.push('indexeddb-unavailable');
    if(cfg.features?.deviceMediaLayer&&!window.ThalysDeviceMedia)report.warnings.push('device-media-unavailable');
    if(cfg.features?.notificationLayer&&!window.ThalysNotifications)report.warnings.push('notification-layer-unavailable');
    if(cfg.features?.backendBridge&&!window.ThalysBackend)report.warnings.push('backend-bridge-unavailable');
    if(cfg.features?.googleServerAuthBridge&&!window.ThalysServerAuth)report.warnings.push('server-auth-unavailable');
    if(cfg.costPolicy?.mode==='free-only'&&cfg.backend?.requiresBilling===true)report.warnings.push('paid-backend-blocked-by-policy');
    if(cfg.costPolicy?.progressPhotos!=='google-drive-only')report.warnings.push('photo-storage-policy-changed');
    if(window.ThalysStorage?.CONFIG?.syncProtocolVersion!==cfg.syncProtocolVersion)report.warnings.push('sync-protocol-version-mismatch');
    if(report.sync.resolverProtocol!==Number(cfg.syncProtocolVersion||0))report.warnings.push('resolver-protocol-version-mismatch');
    if(report.sync.resolverAppVersion&&report.sync.resolverAppVersion!==cfg.appVersion)report.warnings.push('resolver-app-version-mismatch');
    if(report.sync.dirty&&report.sync.pending===0)report.warnings.push('drive-dirty-without-pending-queue');
    if(!report.sync.dirty&&report.sync.pending>0)report.warnings.push('pending-queue-without-drive-dirty');
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
