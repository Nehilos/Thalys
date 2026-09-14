(function(){
  'use strict';
  const CONFIG=Object.freeze({
    appName:'Thalys',
    appVersion:'0.38.0',
    cacheBust:'0380',
    sessionSchema:'v1',
    storageSchemaVersion:4,
    syncProtocolVersion:7,
    features:Object.freeze({
      indexedDbPrimary:true,
      driveOnlyProgressPhotos:true,
      autoSyncOnReconnect:true,
      capabilityLayer:true
    })
  });
  window.ThalysConfig=CONFIG;
  window.THALYS_APP_VERSION=CONFIG.appVersion;
})();
