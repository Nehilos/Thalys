(function(){
  'use strict';
  const CONFIG=Object.freeze({
    appName:'Thalys',
    appVersion:'0.39.0',
    cacheBust:'0390',
    sessionSchema:'v1',
    storageSchemaVersion:4,
    syncProtocolVersion:7,
    features:Object.freeze({
      indexedDbPrimary:true,
      driveOnlyProgressPhotos:true,
      autoSyncOnReconnect:true,
      capabilityLayer:true,
      deviceMediaLayer:true,
      voiceDictation:true
    })
  });
  window.ThalysConfig=CONFIG;
  window.THALYS_APP_VERSION=CONFIG.appVersion;
})();
