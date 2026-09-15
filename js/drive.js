// Thalys v0.28.4 - Google Drive module
// Drive I/O, workspace, synchronization state and Drive connection status live here.

let driveSyncTimer = null, driveSyncRunning = false, driveSyncQueued = false, driveRefreshRunning = false;
let driveFolders = null, lastDriveSyncAt = Number(localStorage.getItem('thalys_last_drive_sync') || 0) || null, driveDirty = localStorage.getItem('thalys_drive_dirty')==='1';
let lastSyncError = null;

const DRIVE_DB_NAMES = ['thalys_manifest.json','app_state.json','nutrition_targets.json','workouts.json','workout_history.json','meal_history.json','active_plan_history.json','workout_plans.json','nutrition.json','alim_database.json','body_metrics.json','wellness_data.json','water.json','foto_index.json','foto_profilo.json','messages.json','meditation.json','gratitude.json','consultations.json','ai_consults.json','lang_it.json','lang_en.json','lang_es.json','lang_pt.json','lang_ro.json'];

function escapeDriveQuery(v){ return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function setDriveStatus(mode='idle', text){
  // v0.37.5: physical network state is authoritative for the visible source label.
  // A cached Google token while offline does NOT mean Drive is currently active.
  if(!navigator.onLine){ mode='idle'; text='Locale'; }
  const icon=document.getElementById('sync-icon'), label=document.getElementById('sync-text');
  if(mode==='saving'){ if(icon) icon.className='fa-solid fa-cloud-arrow-up text-amber-400'; if(label) label.textContent=text||'Salvataggio…'; }
  else if(mode==='error'){ if(icon) icon.className='fa-solid fa-cloud-exclamation text-rose-400'; if(label) label.textContent=text||'Sync errore'; }
  else if(mode==='ok'){ if(icon) icon.className='fa-solid fa-cloud-check text-emerald-400'; if(label) label.textContent=text||'Sincronizzato'; }
  else { if(icon) icon.className='fa-solid fa-cloud text-slate-500'; if(label) label.textContent=text||'Locale'; }
  if(typeof updateSyncStatus==='function') updateSyncStatus(navigator.onLine && (mode==='ok' || (typeof getAccessToken==='function' && !!getAccessToken())));
  const detail=document.getElementById('cloud-user-status');
  if(detail){ if(!navigator.onLine) detail.textContent='Locale · dati sul dispositivo'; else if(typeof getAccessToken==='function' && getAccessToken()) detail.textContent=text || (lastDriveSyncAt ? `Drive sincronizzato ${new Date(lastDriveSyncAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Google Drive · Thalys App attivo'); }
}

async function findDriveFolder(name,parentId=null){
      const q=parentId?`'${parentId}' in parents and name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`:`name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
      const r=await gapi.client.drive.files.list({q,fields:'files(id,name,modifiedTime)',pageSize:20}); return (r.result.files||[])[0]||null;
    }
    async function createDriveFolder(name,parentId=null){const resource={name,mimeType:'application/vnd.google-apps.folder'};if(parentId)resource.parents=[parentId];return (await gapi.client.drive.files.create({resource,fields:'id,name,modifiedTime'})).result;}
    async function ensureFolderAfterConsent(name,parentId=null,question){let f=await findDriveFolder(name,parentId);if(f)return f;if(!confirm(question||`Creare la cartella ${name} su Google Drive?`))return null;return createDriveFolder(name,parentId);}

    async function findDriveFile(name,parentId){const q=`'${parentId}' in parents and name='${escapeDriveQuery(name)}' and trashed=false`;const r=await gapi.client.drive.files.list({q,fields:'files(id,name,modifiedTime,size,version)',pageSize:10});return (r.result.files||[])[0]||null;}
    async function listDatabaseFiles(parentId){const r=await gapi.client.drive.files.list({q:`'${parentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,fields:'files(id,name,modifiedTime,size,version)',pageSize:100});return r.result.files||[];}
    async function uploadDriveFile(name,data,mime,parentId,createIfMissing=true){
      const token=getAccessToken();if(!token){const e=new Error('AUTH_REQUIRED');e.code='AUTH_REQUIRED';throw e;}
      if(!parentId){const e=new Error('FOLDER_MISSING');e.code='FOLDER_MISSING';throw e;}
      let existing=await findDriveFile(name,parentId);if(!existing&&!createIfMissing){const e=new Error('FILE_MISSING: '+name);e.code='FILE_MISSING';throw e;}
      // IMPORTANT: on PATCH Google Drive does not accept parents in multipart metadata.
      // Parents are only supplied when a new file is created.
      const metadata={name};if(!existing&&parentId)metadata.parents=[parentId];
      const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
      const payload=data instanceof Blob ? data : new Blob([typeof data==='string'?data:JSON.stringify(data)],{type:mime||'application/json'});
      form.append('file',payload,mime&&mime.startsWith('image/')?name:undefined);
      const url=existing?`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let r;
      try{r=await fetch(url,{method:existing?'PATCH':'POST',headers:{Authorization:`Bearer ${token}`},body:form});}
      catch(err){err.code=navigator.onLine?'NETWORK_ERROR':'OFFLINE';throw err;}
      if(!r.ok){
        let detail='';try{detail=await r.text();}catch(e){}
        const err=new Error(`Drive upload ${r.status}: ${detail||r.statusText}`);err.status=r.status;err.detail=detail;err.code=r.status===401?'AUTH_EXPIRED':r.status===403?'PERMISSION_DENIED':r.status===404?'NOT_FOUND':r.status===429?'RATE_LIMIT':r.status>=500?'GOOGLE_SERVER':'DRIVE_HTTP';throw err;
      }
      return r.json();
    }
    async function readDriveJSON(name,parentId){const f=await findDriveFile(name,parentId);if(!f)return null;const r=await gapi.client.drive.files.get({fileId:f.id,alt:'media'});let d=r.body;try{if(typeof d==='string')d=JSON.parse(d);}catch(e){throw new Error(`JSON non valido: ${name}`)}return d;}

    // v0.25: low-level Google Drive I/O is centralized here.
    async function listDriveImageFiles(parentId,pageSize=100){
      if(!parentId)return[];
      const q=`'${parentId}' in parents and trashed=false and mimeType contains 'image/'`;
      const resp=await gapi.client.drive.files.list({q,fields:'files(id,name,mimeType,createdTime,modifiedTime)',orderBy:'createdTime desc',pageSize});
      return resp.result.files||[];
    }
    async function downloadDriveFileBlob(fileId){
      const token=getAccessToken();if(!token){const e=new Error('AUTH_REQUIRED');e.code='AUTH_REQUIRED';throw e;}
      let r;try{r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});}catch(err){err.code=navigator.onLine?'NETWORK_ERROR':'OFFLINE';throw err;}
      if(!r.ok){const e=new Error(`Drive download ${r.status}`);e.status=r.status;e.code=r.status===401?'AUTH_EXPIRED':r.status===404?'NOT_FOUND':'DRIVE_HTTP';throw e;}
      return r.blob();
    }
    window.listDriveImageFiles=listDriveImageFiles;
    window.downloadDriveFileBlob=downloadDriveFileBlob;
    function getDriveMediaUrl(fileId){return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=`;}
    window.getDriveMediaUrl=getDriveMediaUrl;


    async function initializeDriveWorkspace(){
      if(!getAccessToken())return null;
      if(!driveFolders){
        let appFolder=await findDriveFolder('Thalys App');
        if(!appFolder){
          appFolder=await ensureFolderAfterConsent('Thalys App',null,'La cartella Thalys App non esiste su Google Drive. Vuoi crearla ora?');
          if(!appFolder){showToast('Cartella Thalys App non creata: i dati restano solo sul dispositivo');return null;}
          // Se esiste una vecchia struttura GymBro, proponi un'importazione una tantum senza usarla come cartella attiva.
          try{
            const legacyFolder=await findDriveFolder('GymBro App');
            if(legacyFolder && confirm('Ho trovato una vecchia cartella GymBro App. Vuoi tentare di importare i dati esistenti nella nuova Thalys App?')){
              localStorage.setItem('thalys_pending_legacy_import', legacyFolder.id);
            }
          }catch(e){ console.warn('Legacy folder check failed',e); }
        }
        let dbFolder=await findDriveFolder('database',appFolder.id);
        if(!dbFolder){dbFolder=await ensureFolderAfterConsent('database',appFolder.id,'La cartella Thalys App/database non esiste. Vuoi crearla?');}
        if(!dbFolder){driveFolders={appFolderId:appFolder.id,databaseFolderId:null,photoFolderId:null,backupFolderId:null};return driveFolders;}
        let photoFolder=await findDriveFolder('foto',appFolder.id);
        if(!photoFolder)photoFolder=await ensureFolderAfterConsent('foto',appFolder.id,'La cartella Thalys App/foto non esiste. Vuoi crearla?');
        let backupFolder=await findDriveFolder('backups',appFolder.id);
        if(!backupFolder)backupFolder=await ensureFolderAfterConsent('backups',appFolder.id,'La cartella Thalys App/backups non esiste. Vuoi crearla?');
        driveFolders={appFolderId:appFolder.id,databaseFolderId:dbFolder.id,photoFolderId:photoFolder?.id||null,backupFolderId:backupFolder?.id||null};
        try{await importPendingLegacyData();}catch(e){console.warn('Legacy import failed',e);}
        let files=await listDatabaseFiles(dbFolder.id);
        if(files.length===0){
          if(confirm('La cartella database è vuota. Vuoi inizializzare ora i database Thalys?')){await saveAllDatabasesToDrive(true);} else {showToast('Database non inizializzati: nessun dato Drive creato');}
        }
      }
      return driveFolders;
    }

    async function importPendingLegacyData(){
      const legacyId=localStorage.getItem('thalys_pending_legacy_import');if(!legacyId||!driveFolders?.databaseFolderId)return false;
      try{
        let source=await findDriveFolder('database',legacyId);if(!source)source=await findDriveFolder('salvataggi',legacyId);if(!source){localStorage.removeItem('thalys_pending_legacy_import');return false;}
        const files=await listDatabaseFiles(source.id);const names=new Set(files.map(f=>f.name));const legacy={};
        const load=async(name,key)=>{if(names.has(name))legacy[key]=await readDriveJSON(name,source.id);};
        await Promise.all([load('app_state.json','appState'),load('workouts.json','workouts'),load('workout_plans.json','plansPayload'),load('nutrition.json','nutrition'),load('alim_database.json','presets'),load('body_metrics.json','bodyMetrics'),load('wellness_data.json','wellness'),load('water.json','water'),load('meditation.json','meditation'),load('gratitude.json','gratitude')]);
        if(legacy.appState&&typeof legacy.appState==='object')Object.assign(legacy,legacy.appState);if(legacy.plansPayload){legacy.workoutPlans=legacy.plansPayload.plans||[];legacy.workoutAssignments=legacy.plansPayload.assignments||{};legacy.workoutCompletions=legacy.plansPayload.completions||{};}
        appState=mergeCloudIntoLocal(legacy);window.appState=appState;persistThalysStateLocally(appState);localStorage.setItem('thalys_foods',JSON.stringify(appState.presets||[]));localStorage.removeItem('thalys_pending_legacy_import');driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');showToast('Dati della vecchia app importati in Thalys ✓','fa-file-import');return true;
      }catch(e){console.warn(e);return false;}
    }
    function blobToDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}
    async function loadPhotosFromDriveFolder(){
      if(!getAccessToken()||!driveFolders?.appFolderId)return 0;
      const folder=await findDriveFolder('foto',driveFolders.appFolderId);if(!folder)return 0;driveFolders.photoFolderId=folder.id;
      const q=`'${folder.id}' in parents and trashed=false and mimeType contains 'image/'`;const resp=await gapi.client.drive.files.list({q,fields:'files(id,name,mimeType,createdTime,modifiedTime)',orderBy:'createdTime desc',pageSize:50});const files=resp.result.files||[];
      const existing=new Set((appState.photos||[]).map(x=>x.driveFileId).filter(Boolean));let added=0;
      for(const f of files){if(existing.has(f.id))continue;try{const rr=await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,{headers:{Authorization:`Bearer ${getAccessToken()}`}});if(!rr.ok)continue;const blob=await rr.blob();const base64=await blobToDataURL(blob);appState.photos=Array.isArray(appState.photos)?appState.photos:[];appState.photos.push({id:'drive_'+f.id,driveFileId:f.id,driveName:f.name,date:(f.createdTime||f.modifiedTime||new Date().toISOString()).slice(0,10),base64,updatedAt:f.modifiedTime||f.createdTime});existing.add(f.id);added++;}catch(e){console.warn('photo restore',f.name,e);}}
      return added;
    }
    function databasePayloads(){
      const {consultations:_consultations,aiConsults:_aiConsults,...appCore}=appState||{};
      return {
        'thalys_manifest.json':{app:'Thalys',schemaVersion:8,updatedAt:new Date().toISOString(),databaseVersion:6,syncProtocolVersion:7},
        'sync_meta.json':window.ThalysSyncQueue?.getSyncMetadata?window.ThalysSyncQueue.getSyncMetadata():{version:1,protocolVersion:Number(window.ThalysConfig?.syncProtocolVersion||7),records:{},tombstones:{}},
        'app_state.json':{...appCore,photos:[],profilePhoto:null},
        'workouts.json':appState.workouts||[],
        'workout_plans.json':{plans:appState.workoutPlans||[],activePlanId:appState.activeWorkoutPlanId||null,assignments:appState.workoutAssignments||{},completions:appState.workoutCompletions||{}},
        'nutrition.json':appState.nutrition||[],
        'alim_database.json':appState.presets||[],
        'body_metrics.json':appState.bodyMetrics||[],
        'wellness_data.json':appState.wellness||[],
        'water.json':appState.water||{},
        'foto_index.json':Object.fromEntries((appState.photos||[]).filter(p=>p.driveFileId).map(p=>[p.driveFileId,{id:p.driveFileId,name:p.driveName||'',date:p.date,updatedAt:p.updatedAt||null}])),
        'foto_profilo.json':appState.profilePhoto||null,
        'messages.json':appState.messages||[],
        'meditation.json':appState.meditation||[],
        'gratitude.json':appState.gratitude||[],
        'consultations.json':appState.consultations||[],
        'ai_consults.json':appState.aiConsults||[]
      };
    }
    async function saveAllDatabasesToDrive(force=false){
      if(window.thalysNetworkRecoveryPending && !force){driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();return false;}
      if(!getAccessToken()){
        lastSyncError={code:'AUTH_REQUIRED',message:'Non sei connesso a Google.'};
        showSyncError(lastSyncError); return false;
      }
      if(driveSyncRunning){driveSyncQueued=true;return false;}
      if(!navigator.onLine){lastSyncError={code:'OFFLINE',message:'Il dispositivo non è connesso a Internet.'};driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');setDriveStatus('error','Offline · dati locali protetti');updateManualSyncUI();return false;}
      if(!driveFolders?.databaseFolderId){
        try{await initializeDriveWorkspace();}catch(e){lastSyncError=classifyDriveError(e);showSyncError(lastSyncError);return false;}
        if(!driveFolders?.databaseFolderId){lastSyncError={code:'FOLDER_MISSING',message:'La cartella Thalys App/database non è disponibile.'};showSyncError(lastSyncError);return false;}
      }
      driveSyncRunning=true;setDriveStatus('saving','Salvataggio Drive…');
      try{
        if(window.ThalysSyncQueue?.flushWrites)await window.ThalysSyncQueue.flushWrites();
        const payloads=databasePayloads();
        // v0.36.4: publish sync metadata/tombstones before domain files.
        // This prevents another device from reading a newly-deleted database state with stale deletion metadata
        // (or an old database copy without knowing that the record is already tombstoned).
        if(Object.prototype.hasOwnProperty.call(payloads,'sync_meta.json')){
          await uploadDriveFile('sync_meta.json',JSON.stringify(payloads['sync_meta.json']),'application/json',driveFolders.databaseFolderId,true);
        }
        const finalFiles=new Set(['app_state.json','thalys_manifest.json']);
        const domainEntries=Object.entries(payloads).filter(([name])=>name!=='sync_meta.json'&&!finalFiles.has(name));
        // Publish dedicated domain databases first. Readers treat these as canonical, so they
        // must never observe a newer app_state paired with an older food/workout database.
        const results=await Promise.allSettled(domainEntries.map(async ([name,data])=>({name,result:await uploadDriveFile(name,JSON.stringify(data),'application/json',driveFolders.databaseFolderId,true)})));
        const failed=results.filter(r=>r.status==='rejected');
        if(failed.length){const first=failed[0].reason||new Error('Errore salvataggio');first.failedCount=failed.length;first.failedNames=results.map((r,i)=>r.status==='rejected'?domainEntries[i][0]:null).filter(Boolean);throw first;}
        // app_state and manifest are committed only after every canonical domain file succeeded.
        for(const name of ['app_state.json','thalys_manifest.json']){
          if(Object.prototype.hasOwnProperty.call(payloads,name)) await uploadDriveFile(name,JSON.stringify(payloads[name]),'application/json',driveFolders.databaseFolderId,true);
        }
        lastDriveSyncAt=Date.now();driveDirty=false;localStorage.setItem('thalys_drive_dirty','0');localStorage.setItem('thalys_last_drive_sync',String(lastDriveSyncAt));
        if(window.ThalysSyncQueue?.markPendingSynced)await window.ThalysSyncQueue.markPendingSynced({driveSyncAt:lastDriveSyncAt});
        lastSyncError=null;setDriveStatus('ok','Sincronizzato');updateManualSyncUI();return true;
      }catch(e){
        console.error('Drive save',e);driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');if(window.ThalysSyncQueue?.noteSyncFailure)window.ThalysSyncQueue.noteSyncFailure(e);lastSyncError=classifyDriveError(e);
        if(lastSyncError.code==='OFFLINE'||lastSyncError.code==='NETWORK_ERROR'){
          setDriveStatus('error','Offline · modifiche in attesa');updateManualSyncUI();return false;
        }
        setDriveStatus('error',lastSyncError.short||'Sync non riuscito');updateManualSyncUI();showSyncError(lastSyncError);return false;
      }finally{driveSyncRunning=false;if(driveSyncQueued){driveSyncQueued=false;scheduleDriveSync(300);}}
    }
    function scheduleDriveSync(delay=350){driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');if(!getAccessToken()||!navigator.onLine||window.thalysNetworkRecoveryPending){updateManualSyncUI();return;}if(driveSyncTimer)clearTimeout(driveSyncTimer);driveSyncTimer=setTimeout(()=>{if(!navigator.onLine||window.thalysNetworkRecoveryPending){updateManualSyncUI();return;}if(driveSyncRunning){driveSyncQueued=true;return;}saveAllDatabasesToDrive(false);},delay);}

    function isMeaningfulProfile(p){if(!p)return false;return Number(p.age)!==25||Number(p.height)!==175||Number(p.sleepHours)!==7||String(p.lifestyle||'moderato')!=='moderato'||String(p.gender||'male')!=='male';}
    function mergeByKey(localArr,cloudArr,keyFn){
      const map=new Map();(cloudArr||[]).forEach(x=>{if(x)map.set(keyFn(x),x)});(localArr||[]).forEach(x=>{if(!x)return;const k=keyFn(x);const old=map.get(k);if(!old){map.set(k,x);return;}const lt=Date.parse(x.updatedAt||x.completedAt||0)||0,ct=Date.parse(old.updatedAt||old.completedAt||0)||0;if(lt>=ct)map.set(k,{...old,...x});});return [...map.values()];
    }
    function mergeCloudIntoLocal(cloud){
      const local=appState||DEFAULT_STATE, c=cloud||{};
      const result={...DEFAULT_STATE,...c,...local};
      result.profile=isMeaningfulProfile(local.profile)?{...DEFAULT_STATE.profile,...c.profile,...local.profile}:{...DEFAULT_STATE.profile,...local.profile,...c.profile};
      const lp=local.profilePhoto||null,cp=c.profilePhoto||null;
      if(lp&&cp){const lt=Date.parse(lp.updatedAt||0)||0,ct=Date.parse(cp.updatedAt||0)||0;result.profilePhoto=lt>=ct?lp:cp;}
      else result.profilePhoto=lp||cp||null;
      result.targets={...DEFAULT_STATE.targets,...c.targets,...local.targets};result.settings={...DEFAULT_STATE.settings,...c.settings,...local.settings};
      result.workouts=mergeByKey(local.workouts,c.workouts,x=>x.id||`${x.date}|${x.name}`);
      result.nutrition=mergeByKey(local.nutrition,c.nutrition,x=>x.id||`${x.date}|${x.meal}|${x.name}|${x.grams}`);
      result.bodyMetrics=mergeByKey(local.bodyMetrics,c.bodyMetrics,x=>x.id||x.date);
      result.wellness=mergeByKey(local.wellness,c.wellness,x=>x.date||x.id);
      result.meditation=mergeByKey(local.meditation,c.meditation,x=>x.id||`${x.date}|${x.completedAt||x.minutes}`);
      result.gratitude=mergeByKey(local.gratitude,c.gratitude,x=>x.id||`${x.date}|${x.text||''}`);
      result.photos=mergeByKey(local.photos,c.photos,x=>x.id||`${x.date}|${String(x.base64||'').slice(-24)}`);
      // Dedicated Drive databases are canonical after the conflict resolver has replayed
      // any local pending operations. Do not let a stale local PC copy overwrite them.
      result.presets=Array.isArray(c.presets)?c.presets:(local.presets||[]);
      result.workoutPlans=Array.isArray(c.workoutPlans)?c.workoutPlans:(local.workoutPlans||[]);
      result.activeWorkoutPlanId=(c.activeWorkoutPlanId!==undefined&&c.activeWorkoutPlanId!==null)?c.activeWorkoutPlanId:(local.activeWorkoutPlanId||null);
      result.messages=mergeByKey(local.messages,c.messages,x=>x.id);
      result.consultations=mergeByKey(local.consultations,c.consultations,x=>x.id);
      result.aiConsults=mergeByKey(local.aiConsults,c.aiConsults,x=>x.id);result.workoutHistory=mergeByKey(local.workoutHistory,c.workoutHistory,x=>x.id||`${x.date}|${x.planId}`);result.activeWorkoutPlanHistory=mergeByKey(local.activeWorkoutPlanHistory,c.activeWorkoutPlanHistory,x=>x.id||`${x.planId}|${x.activatedAt}`);
      result.workoutAssignments={...(c.workoutAssignments||{})};
      result.workoutCompletions={...(c.workoutCompletions||{})};
      // Water is shared across devices. Prefer the newest per-day value when
      // timestamps are available. For data created by older versions (no timestamp),
      // Drive wins whenever this device has no unsaved local changes.
      const lw=local.water||{}, cw=c.water||{};
      const lm=local.waterUpdatedAt||{}, cm=c.waterUpdatedAt||{};
      result.water={}; result.waterUpdatedAt={};
      const waterDates=new Set([...Object.keys(cw),...Object.keys(lw)]);
      waterDates.forEach(date=>{
        const lt=Date.parse(lm[date]||0)||0, ct=Date.parse(cm[date]||0)||0;
        const chooseLocal=lt&&ct ? lt>=ct : lt&&!ct ? true : !lt&&ct ? false : driveDirty;
        result.water[date]=chooseLocal ? lw[date] : (Object.prototype.hasOwnProperty.call(cw,date)?cw[date]:lw[date]);
        const stamp=chooseLocal?lm[date]:cm[date]; if(stamp)result.waterUpdatedAt[date]=stamp;
      });
      return result;
    }
    async function loadDatabasesFromDrive(consolidate=false){
      if(!getAccessToken()||!driveFolders?.databaseFolderId)return false;
      setDriveStatus('saving','Lettura di tutti i database…');
      const files=await listDatabaseFiles(driveFolders.databaseFolderId);if(!files.length){throw Object.assign(new Error('FOLDER_MISSING'),{code:'FOLDER_MISSING'});}
      const byName=new Set(files.map(f=>f.name));
      let cloud={};
      const reads=[];
      const load=(name,key)=>{if(byName.has(name))reads.push(readDriveJSON(name,driveFolders.databaseFolderId).then(d=>{cloud[key]=d;}));};
      load('app_state.json','appState');load('sync_meta.json','syncMeta');load('workouts.json','workouts');load('workout_history.json','workoutHistory');load('meal_history.json','mealHistory');load('active_plan_history.json','activeWorkoutPlanHistory');load('nutrition.json','nutrition');load('alim_database.json','presets');load('body_metrics.json','bodyMetrics');load('wellness_data.json','wellness');load('water.json','water');load('meditation.json','meditation');load('gratitude.json','gratitude');load('workout_plans.json','plansPayload');load('foto_index.json','photoIndex');load('foto_profilo.json','profilePhoto');load('messages.json','messages');load('consultations.json','consultations');load('ai_consults.json','aiConsults');
      await Promise.all(reads);
      if(!byName.has('foto_profilo.json')){
        try{await uploadDriveFile('foto_profilo.json',JSON.stringify(appState.profilePhoto||null),'application/json',driveFolders.databaseFolderId,true);}
        catch(e){console.warn('Creazione foto_profilo.json',e);}
      }
      const dedicated={
        workouts:cloud.workouts, workoutHistory:cloud.workoutHistory, mealHistory:cloud.mealHistory,
        activeWorkoutPlanHistory:cloud.activeWorkoutPlanHistory, nutrition:cloud.nutrition, presets:cloud.presets,
        bodyMetrics:cloud.bodyMetrics, wellness:cloud.wellness, water:cloud.water, meditation:cloud.meditation, gratitude:cloud.gratitude,
        plansPayload:cloud.plansPayload, photoIndex:cloud.photoIndex, profilePhoto:cloud.profilePhoto,
        messages:cloud.messages, consultations:cloud.consultations, aiConsults:cloud.aiConsults
      };
      if(cloud.appState&&typeof cloud.appState==='object')Object.assign(cloud,cloud.appState);
      // Dedicated database files are canonical for their domain and must win over
      // duplicated copies inside app_state.json.
      for(const [key,value] of Object.entries(dedicated)) if(value!==undefined) cloud[key]=value;
      if(Array.isArray(dedicated.mealHistory)) cloud.nutrition=mergeByKey(cloud.nutrition||[],dedicated.mealHistory,x=>x.id||`${x.date}|${x.meal}|${x.name}|${x.grams}`);
      if(cloud.plansPayload){cloud.workoutPlans=cloud.plansPayload.plans||[];cloud.activeWorkoutPlanId=cloud.plansPayload.activePlanId||cloud.activeWorkoutPlanId||null;cloud.workoutAssignments=cloud.plansPayload.assignments||{};cloud.workoutCompletions=cloud.plansPayload.completions||cloud.workoutCompletions||{};}
      if(cloud.photoIndex&&typeof cloud.photoIndex==='object')localStorage.setItem('photo_index',JSON.stringify(cloud.photoIndex));
      let conflictResolution=null;
      try{
        if(window.ThalysSyncQueue?.flushWrites)await window.ThalysSyncQueue.flushWrites();
        const pendingOps=window.ThalysSyncQueue?.listPendingOperations?await window.ThalysSyncQueue.listPendingOperations():[];
        const syncMeta=window.ThalysSyncQueue?.mergeSyncMetadata?window.ThalysSyncQueue.mergeSyncMetadata(cloud.syncMeta):cloud.syncMeta;
        if((pendingOps.length||Object.keys(syncMeta?.tombstones||{}).length)&&window.ThalysConflictResolver?.resolve){
          conflictResolution=await window.ThalysConflictResolver.resolve(cloud,appState,pendingOps,syncMeta);
          cloud=conflictResolution.state||cloud;
        }
      }catch(e){console.warn('Conflict resolver fallback',e);conflictResolution=null;}
      appState=mergeCloudIntoLocal(cloud);
      if(conflictResolution&&window.ThalysConflictResolver?.overlayResolved){appState=window.ThalysConflictResolver.overlayResolved(appState,cloud,conflictResolution);}
      window.appState=appState;
      try{await loadPhotosFromDriveFolder();}catch(e){console.warn('Drive photo load failed',e);}
      persistThalysStateLocally(appState);localStorage.setItem('thalys_foods',JSON.stringify(appState.presets||[]));if(typeof syncThalysLocalDocuments==='function')syncThalysLocalDocuments(appState);
      renderAllViews();loadProfileUI();loadTargetsUI();renderPhotos();renderProfilePhotoUI();
      if(consolidate){driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');setDriveStatus('ok','Dati Drive caricati · consolidamento…');updateManualSyncUI();scheduleDriveSync(250);}else{setDriveStatus('ok','Dati Drive aggiornati');updateManualSyncUI();}return true;
    }
    async function refreshFromDrive(showToastOnSuccess=false,forceLoad=false){if(!getAccessToken())return false;if(window.thalysNetworkRecoveryPending&&!forceLoad)return false;if(driveDirty&&!forceLoad){scheduleDriveSync(200);return false;}if(driveRefreshRunning)return false;driveRefreshRunning=true;try{await initializeDriveWorkspace();await loadDatabasesFromDrive(forceLoad);if(showToastOnSuccess)showToast('Tutti i database Thalys caricati e consolidati ✓','fa-cloud-check');return true;}catch(e){console.warn('Drive refresh',e);lastSyncError=classifyDriveError(e);if(lastSyncError.code==='OFFLINE'||lastSyncError.code==='NETWORK_ERROR'){setDriveStatus('saving','Connessione instabile · modalità locale');updateManualSyncUI();return false;}setDriveStatus('error',lastSyncError.short);showSyncError(lastSyncError);return false;}finally{driveRefreshRunning=false;}}
    async function syncAllDatabasesFromDrive(){return refreshFromDrive(false);}

    async function loadFoodDatabaseImmediate(){
      if(!navigator.onLine||!getAccessToken()){if(typeof renderPresets==='function')renderPresets();return true;}
      return loadDatabasesFromDrive(false);
    }
    async function loadWorkoutPlansImmediate(){
      if(!navigator.onLine||!getAccessToken()){
        if(typeof renderWorkoutPlans==='function')renderWorkoutPlans();
        if(typeof renderWorkouts==='function')renderWorkouts();
        return true;
      }
      return loadDatabasesFromDrive(false);
    }
    async function openWorkoutPlans(){
      const gm=appState.messages?.find(m=>m.id==='profile_workout'&&m.status!=='done');if(gm)setTimeout(()=>showToast('Crea una scheda e rendila attiva','fa-clipboard-list'),350);
      openModal('workout-plans-modal');renderWorkoutPlans();if(!getAccessToken())return;
      const list=document.getElementById('workout-plans-list');const old=list?.innerHTML;if(list)list.innerHTML='<div class="p-4 text-center text-xs text-cyan-300"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Carico schede da Drive…</div>';
      try{await loadWorkoutPlansImmediate();renderWorkoutPlans();}catch(e){console.warn(e);if(list&&old)list.innerHTML=old;showSyncError(classifyDriveError(e));}
    }
    async function openFoodDatabase(){
      toggleFoodPresetForm(false);
      openModal('food-preset-modal');
      if(!getAccessToken()) return;
      const list=document.getElementById('presets-list');
      const old=list?.innerHTML;
      if(list) list.innerHTML='<div class="p-4 text-center text-xs text-cyan-300"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Carico database da Drive…</div>';
      try{await loadFoodDatabaseImmediate();renderPresets();}catch(e){console.warn(e);if(list&&old)list.innerHTML=old;showToast('Database locale disponibile; Drive non raggiungibile','fa-triangle-exclamation');}
    }
    function classifyDriveError(e){
      const raw=String(e?.message||e||'');
      const networkLike=!navigator.onLine || e?.name==='TypeError' || /failed to fetch|networkerror|network request failed|load failed/i.test(raw);
      const code=e?.code || (networkLike?(navigator.onLine?'NETWORK_ERROR':'OFFLINE'):(e?.status===401?'AUTH_EXPIRED':e?.status===403?'PERMISSION_DENIED':e?.status===404?'NOT_FOUND':e?.status===429?'RATE_LIMIT':e?.status>=500?'GOOGLE_SERVER':'UNKNOWN'));
      const map={
        OFFLINE:['Nessuna connessione','Sei offline. I dati restano salvati sul dispositivo e verranno sincronizzati appena torni online.'],
        NETWORK_ERROR:['Connessione instabile','Non riesco a raggiungere Google Drive. Controlla rete/VPN e riprova.'],
        AUTH_REQUIRED:['Accesso Google necessario','Accedi di nuovo a Google per autorizzare la sincronizzazione.'],
        AUTH_EXPIRED:['Sessione Google scaduta','Il token Google non è più valido. Riconnettiti e poi riprova.'],
        PERMISSION_DENIED:['Permesso Drive negato','Google ha negato l’accesso alla cartella/file. Riconnetti l’account e verifica i permessi OAuth.'],
        NOT_FOUND:['Cartella o file non trovato','La struttura Thalys su Drive potrebbe essere stata spostata o eliminata. Usa “Verifica struttura”.'],
        FOLDER_MISSING:['Struttura Thalys mancante','Manca Thalys App/database oppure non è accessibile. Posso verificarla e ricreare solo ciò che manca.'],
        RATE_LIMIT:['Limite Google temporaneo','Troppe richieste a Drive. Attendi qualche secondo e riprova.'],
        GOOGLE_SERVER:['Google Drive non disponibile','Google sta restituendo un errore server temporaneo. I dati locali restano protetti.'],
        UNKNOWN:['Sincronizzazione non riuscita','Si è verificato un errore non riconosciuto. I dati locali non vengono cancellati.']
      };
      const [title,message]=map[code]||map.UNKNOWN;return {code,title,message,short:title,detail:e?.detail||e?.message||'',failedNames:e?.failedNames||[]};
    }
    function showSyncError(err){
      if(!err)return;lastSyncError=err;const title=document.getElementById('sync-error-title'),msg=document.getElementById('sync-error-message'),detail=document.getElementById('sync-error-detail');
      if(title)title.textContent=err.title||'Problema sincronizzazione';if(msg)msg.textContent=err.message||'I dati locali restano protetti.';
      if(detail){const failed=err.failedNames?.length?`\nDatabase non salvati: ${err.failedNames.join(', ')}`:'';detail.textContent=`Codice: ${err.code||'UNKNOWN'}${failed}${err.detail?`\nDettaglio: ${String(err.detail).slice(0,600)}`:''}`;}
      openModal('sync-error-modal');
    }
    async function repairDriveStructure(){
      if(!getAccessToken()){closeModal('sync-error-modal');handleAuthClick();return;}
      try{driveFolders=null;setDriveStatus('saving','Verifica struttura…');const ws=await initializeDriveWorkspace();if(!ws?.databaseFolderId)throw Object.assign(new Error('FOLDER_MISSING'),{code:'FOLDER_MISSING'});closeModal('sync-error-modal');showToast('Struttura Thalys verificata ✓','fa-folder-check');await saveAllDatabasesToDrive(true);}catch(e){showSyncError(classifyDriveError(e));}
    }
    function reconnectGoogle(){closeModal('sync-error-modal');handleAuthClick();}
    async function retryLastSync(){closeModal('sync-error-modal');await saveAllDatabasesToDrive(true);}
    function updateManualSyncUI(){const t=document.getElementById('manual-sync-time');if(t)t.textContent=lastDriveSyncAt?'Ultima sincronizzazione riuscita: '+new Date(lastDriveSyncAt).toLocaleString():'Nessuna sincronizzazione riuscita in questa sessione';const st=document.getElementById('manual-sync-status');if(st){const connected=!!getAccessToken();const label=!connected?'Non connesso':driveDirty?'Modifiche da salvare':'Sincronizzato';st.textContent=label;st.className='text-[10px] px-2 py-1 rounded-full border '+(!connected?'bg-slate-500/10 text-slate-300 border-slate-500/20':driveDirty?'bg-amber-500/10 text-amber-300 border-amber-500/20':'bg-emerald-500/10 text-emerald-300 border-emerald-500/20');}}
    async function waitForDriveSyncIdle(timeout=12000){const start=Date.now();while(driveSyncRunning&&Date.now()-start<timeout)await new Promise(r=>setTimeout(r,150));return !driveSyncRunning;}
    async function manualSyncNow(){const st=document.getElementById('manual-sync-status');if(st)st.textContent='Salvataggio…';if(!getAccessToken()){showSyncError({code:'AUTH_REQUIRED',title:'Accesso Google necessario',message:'Accedi a Google prima di sincronizzare.',detail:''});updateManualSyncUI();return;}await waitForDriveSyncIdle();const ok=await saveAllDatabasesToDrive(true);updateManualSyncUI();if(ok)showToast('Tutti i database sono sincronizzati ✓','fa-cloud-check');}
    async function manualReloadFromDrive(){
      if(!getAccessToken()){showSyncError({code:'AUTH_REQUIRED',title:'Accesso Google necessario',message:'Accedi a Google prima di ricaricare i dati.',detail:''});return;}
      const ok=await refreshFromDrive(true,true);if(ok){renderAllViews();showToast('Dati Drive ricaricati senza cancellare i dati locali ✓','fa-cloud-arrow-down');}
    }

    async function listDriveFolderRecursive(folderId,prefix,zip){
      const r=await gapi.client.drive.files.list({q:`'${folderId}' in parents and trashed=false`,fields:'files(id,name,mimeType)',pageSize:1000});
      const token=getAccessToken();
      for(const f of(r.result.files||[])){
        if(f.mimeType==='application/vnd.google-apps.folder'){
          const sub=zip.folder(prefix+f.name);
          await listDriveFolderRecursive(f.id,'',sub);
        }else{
          try{
            const resp=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
            if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
            const blob=await resp.blob();
            zip.file(prefix+f.name,blob);
          }catch(e){console.warn('Backup skip',f.name,e)}
        }
      }
    }
    async function exportFullDriveBackup(){
      if(!getAccessToken())return showToast('Accedi a Google Drive');
      try{
        await initializeDriveWorkspace();const zip=new JSZip(),root=zip.folder('Thalys App');
        await listDriveFolderRecursive(driveFolders.appFolderId,'',root);
        const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}),a=document.createElement('a'),u=URL.createObjectURL(blob);
        a.href=u;a.download=`Thalys_App_${currentLocalDateStr()}.zip`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);showToast('Backup scaricato');
      }catch(e){console.error(e);showToast('Backup non riuscito')}
    }
    async function ensureImportFolderPath(parts){
      let parent=driveFolders.appFolderId;
      for(const name of parts){if(!name||name==='Thalys App')continue;let f=await findDriveFolder(name,parent);if(!f)f=await createDriveFolder(name,parent);parent=f.id}
      return parent;
    }
    async function uploadImportedFile(path,blob){
      const parts=path.split('/').filter(Boolean),name=parts.pop();if(!name)return;
      const parent=await ensureImportFolderPath(parts);
      await uploadDriveFile(name,blob,blob.type||'application/octet-stream',parent,true);
    }
    async function importDriveBackupZip(e){
      const f=e.target.files?.[0];if(!f)return;
      try{await initializeDriveWorkspace();const z=await JSZip.loadAsync(f);for(const[path,en]of Object.entries(z.files)){if(en.dir)continue;await uploadImportedFile(path.replace(/^Thalys App\//,''),await en.async('blob'))}await manualReloadFromDrive();showToast('Backup importato')}
      catch(x){console.error(x);showToast('Import non riuscito')}finally{e.target.value=''}
    }
    async function importDriveBackupFolder(e){
      const fs=[...(e.target.files||[])];if(!fs.length)return;
      try{await initializeDriveWorkspace();for(const f of fs)await uploadImportedFile((f.webkitRelativePath||f.name).replace(/^Thalys App\//,''),f);await manualReloadFromDrive();showToast('Cartella importata')}
      catch(x){console.error(x);showToast('Import non riuscito')}finally{e.target.value=''}
    }
    async function renameBackupFolderPrompt(){
      if(!getAccessToken())return showToast('Accedi a Google Drive');await initializeDriveWorkspace();
      const old=localStorage.getItem('thalys_backup_folder_name')||'backups',name=prompt('Nuovo nome cartella backup:',old)?.trim();if(!name||name===old)return;
      try{await gapi.client.drive.files.update({fileId:driveFolders.backupFolderId,resource:{name}});localStorage.setItem('thalys_backup_folder_name',name);document.getElementById('backup-folder-name-label').textContent=`Cartella backup Drive: ${name}`;showToast('Cartella rinominata')}
      catch(e){showToast('Rinomina non riuscita')}
    }

    async function manualSafeBackup(){if(!getAccessToken()){showToast('Accedi a Google prima del backup','fa-triangle-exclamation');return;}try{await saveAllDatabasesToDrive(true);await createManualBackup();updateManualSyncUI();}catch(e){console.error(e);showToast('Backup non riuscito','fa-triangle-exclamation');}}

    // Compatibilità interna con vecchi nomi di funzione; il percorso reale è sempre Thalys App.
    async function getGymBroSaveFolders(){await initializeDriveWorkspace();return {appFolderId:driveFolders?.appFolderId||null,savesFolderId:driveFolders?.databaseFolderId||null};}
    async function saveDatabaseToDrive(){return saveAllDatabasesToDrive(false);}
    async function saveWellnessToDrive(){return saveAllDatabasesToDrive(false);}
    async function loadFoodDatabaseFromDrive(){return loadDatabasesFromDriveSafe();}
    async function loadWellnessFromDrive(){return loadDatabasesFromDriveSafe();}
    async function loadDatabasesFromDriveSafe(){return loadDatabasesFromDrive(false);}
    window.saveDatabaseToDrive=saveDatabaseToDrive;window.saveWellnessToDrive=saveWellnessToDrive;window.loadFoodDatabaseFromDrive=loadFoodDatabaseFromDrive;window.loadWellnessFromDrive=loadWellnessFromDrive;

    function openCloudBackupList(){if(!getAccessToken())return openModal('cloud-modal');caricaDaDrive();}
    async function caricaDaDrive(){try{await initializeDriveWorkspace();if(!driveFolders?.databaseFolderId)return;const files=await listDatabaseFiles(driveFolders.databaseFolderId);const list=document.getElementById('backup-list-items');if(!list)return;list.innerHTML='';const snapshots=files.filter(f=>/^Thalys_(Backup|Autosave)_/i.test(f.name));if(!snapshots.length){list.innerHTML='<li class="text-slate-400">Nessun backup manuale trovato.</li>';}else snapshots.sort((a,b)=>new Date(b.modifiedTime)-new Date(a.modifiedTime)).forEach(f=>{const li=document.createElement('li');li.className='flex items-center justify-between bg-slate-900/60 p-2 rounded-lg';li.innerHTML=`<div><div class="font-semibold">${f.name}</div><div class="text-xs text-slate-400">${new Date(f.modifiedTime).toLocaleString()}</div></div><button class="px-2 py-1 rounded bg-cyan-600 text-black text-xs">Ripristina</button>`;li.querySelector('button').onclick=()=>loadBackupFile(f.id);list.appendChild(li);});document.getElementById('backup-list')?.classList.remove('hidden');}catch(e){console.error(e);showToast('Errore recupero backup');}}
    async function loadBackupFile(fileId){try{const r=await gapi.client.drive.files.get({fileId,alt:'media'});const d=typeof r.body==='string'?JSON.parse(r.body):r.body;if(d?.data){Object.assign(localStorage,d.data);appState=JSON.parse(localStorage.getItem('thalys_data')||JSON.stringify(DEFAULT_STATE));}else if(d?.workouts||d?.nutrition){appState={...DEFAULT_STATE,...d};}window.appState=appState;persistThalysStateLocally(appState);renderAllViews();showToast('Backup ripristinato','fa-rotate-left');}catch(e){console.error(e);showToast('Backup non valido');}}

    async function createManualBackup(){if(!getAccessToken())return showToast('Accedi a Google prima del backup');await initializeDriveWorkspace();if(!driveFolders?.backupFolderId){const f=await ensureFolderAfterConsent('backups',driveFolders.appFolderId,'La cartella backups non esiste. Vuoi crearla?');driveFolders.backupFolderId=f?.id||null;}if(!driveFolders?.backupFolderId)return;const stamp=new Date().toISOString().replace(/[-:T.]/g,'').slice(0,14);const payload={version:3,createdAt:new Date().toISOString(),data:appState};await uploadDriveFile(`Thalys_Backup_${stamp}.json`,JSON.stringify(payload),'application/json',driveFolders.backupFolderId,true);showToast('Backup manuale salvato su Drive','fa-cloud-arrow-up');}
    async function createAutosaveSnapshot(){if(!getAccessToken())return;await initializeDriveWorkspace();if(!driveFolders?.backupFolderId){const f=await ensureFolderAfterConsent('backups',driveFolders.appFolderId,'Vuoi creare la cartella backups per mantenere le versioni di sicurezza?');driveFolders.backupFolderId=f?.id||null;}if(!driveFolders?.backupFolderId)return;const stamp=new Date().toISOString().replace(/[-:T.]/g,'').slice(0,14);const payload={version:3,createdAt:new Date().toISOString(),data:appState};const r=await uploadDriveFile(`Thalys_Autosave_${stamp}.json`,JSON.stringify(payload),'application/json',driveFolders.backupFolderId,true);await trimBackups();return r;}
    async function trimBackups(){if(!driveFolders?.backupFolderId)return;const r=await gapi.client.drive.files.list({q:`'${driveFolders.backupFolderId}' in parents and trashed=false`,fields:'files(id,name,createdTime)',orderBy:'createdTime desc',pageSize:100});const files=r.result.files||[];const autos=files.filter(f=>/^Thalys_Autosave_/i.test(f.name));for(const f of autos.slice(10)){try{await gapi.client.drive.files.delete({fileId:f.id});}catch(e){}}}
    async function listTrashedFiles(){try{const r=await gapi.client.drive.files.list({q:'trashed=true',fields:'files(id,name,createdTime)',orderBy:'modifiedTime desc',pageSize:100});const list=document.getElementById('trash-list-items');if(!list)return;list.innerHTML='';(r.result.files||[]).forEach(f=>{const li=document.createElement('li');li.className='flex items-center justify-between bg-slate-900/60 p-2 rounded-lg';li.innerHTML=`<span class="text-xs">${f.name}</span><button class="px-2 py-1 rounded bg-emerald-600 text-black text-xs">Ripristina</button>`;li.querySelector('button').onclick=()=>restoreFile(f.id);list.appendChild(li);});document.getElementById('trash-list')?.classList.remove('hidden');}catch(e){showToast('Errore cestino Drive');}}
    async function restoreFile(id){try{await gapi.client.drive.files.update({fileId:id,resource:{trashed:false}});showToast('File ripristinato');listTrashedFiles();}catch(e){showToast('Errore ripristino');}}
    async function permanentlyDeleteFile(id){await gapi.client.drive.files.delete({fileId:id});}
    async function moveFileToTrash(id){return gapi.client.drive.files.update({fileId:id,resource:{trashed:true}});}
    async function salvaSuDrive(){await createManualBackup();}


    // v0.22: lightweight live water synchronization across open devices.
    // We poll only water.json metadata; the full database is not downloaded every few seconds.
    let lastSeenWaterDriveVersion=null, waterLiveRefreshRunning=false;
    async function refreshWaterFromDriveLive(){
      if(document.hidden||!navigator.onLine||!getAccessToken()||driveSyncRunning||driveRefreshRunning||driveDirty||waterLiveRefreshRunning)return false;
      try{
        if(!driveFolders?.databaseFolderId)await initializeDriveWorkspace();
        if(!driveFolders?.databaseFolderId)return false;
        waterLiveRefreshRunning=true;
        const f=await findDriveFile('water.json',driveFolders.databaseFolderId);if(!f)return false;
        const marker=String(f.version||f.modifiedTime||'');
        if(lastSeenWaterDriveVersion===null){lastSeenWaterDriveVersion=marker;return false;}
        if(marker===lastSeenWaterDriveVersion)return false;
        const remote=await readDriveJSON('water.json',driveFolders.databaseFolderId);
        lastSeenWaterDriveVersion=marker;
        if(!remote||typeof remote!=='object'||Array.isArray(remote))return false;
        appState.water={...remote};window.appState=appState;
        persistThalysStateLocally(appState);
        if(typeof syncThalysLocalDocuments==='function')syncThalysLocalDocuments(appState);
        try{renderNutrition();}catch(_){} try{renderHomeDashboard();}catch(_){} try{renderTodayDashboard();}catch(_){} try{updateAnalyticsCharts();}catch(_){}
        setDriveStatus('ok','Aggiornato da Drive');updateManualSyncUI();
        return true;
      }catch(e){console.warn('Live water sync',e);return false;}finally{waterLiveRefreshRunning=false;}
    }
    window.refreshWaterFromDriveLive=refreshWaterFromDriveLive;

    // v0.22: network recovery uses a read/merge/write cycle. This is important
    // when another device changed Drive while this device was offline: local pending
    // changes are merged with the newest Drive databases before anything is uploaded.
    let networkRecoveryRunning=false;
    let networkRecoveryPromise=null;
    let networkRecoveryRetryTimer=null;
    function scheduleNetworkRecoveryRetry(delay=1800){
      if(networkRecoveryRetryTimer)clearTimeout(networkRecoveryRetryTimer);
      if(!navigator.onLine||!getAccessToken())return;
      networkRecoveryRetryTimer=setTimeout(()=>{networkRecoveryRetryTimer=null;syncAfterNetworkRestore();},delay);
    }
    async function syncAfterNetworkRestore(){
      if(!navigator.onLine)return false;
      // v0.49.1: single-flight recovery. Auth, server-auth and the iOS reconnect
      // supervisor can all wake up on the same 'online' event. They must await the
      // same recovery instead of racing and treating 'already running' as failure.
      if(networkRecoveryPromise)return networkRecoveryPromise;
      if(!getAccessToken()){
        window.thalysNeedsDriveReconnectSync=true;
        setDriveStatus('error','Online · riconnessione Drive necessaria');
        updateManualSyncUI();
        return false;
      }
      networkRecoveryPromise=(async()=>{
        networkRecoveryRunning=true;
        window.thalysNetworkRecoveryPending=true;
        try{
          if(driveSyncTimer){clearTimeout(driveSyncTimer);driveSyncTimer=null;}
          await waitForDriveSyncIdle();
          setDriveStatus('saving','Connessione ripristinata · consolidamento…');
          await initializeDriveWorkspace();
          // Keep driveDirty as-is while reading: mergeCloudIntoLocal then preserves
          // offline edits while also importing newer/new remote records.
          await loadDatabasesFromDrive(false);
          driveDirty=true;
          localStorage.setItem('thalys_drive_dirty','1');
          const ok=await saveAllDatabasesToDrive(true);
          if(ok){
            lastSeenWaterDriveVersion=null;
            window.thalysNeedsDriveReconnectSync=false;
            window.thalysNetworkRecoveryPending=false;
            try{renderAllViews();}catch(_){}
            updateManualSyncUI();
            window.dispatchEvent(new CustomEvent('thalys:network-resync-complete'));
          }
          return !!ok;
        }catch(e){
          console.warn('Network recovery sync',e);
          driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');
          lastSyncError=classifyDriveError(e);
          // v0.36.4: connectivity during recovery is non-blocking. Keep local mode,
          // preserve pending changes and retry silently instead of opening an error modal.
          if(lastSyncError.code==='OFFLINE'||lastSyncError.code==='NETWORK_ERROR'){
            setDriveStatus('saving','Connessione instabile · dati locali protetti');
            updateManualSyncUI();
            window.thalysNetworkRecoveryPending=true;
            scheduleNetworkRecoveryRetry();
            return false;
          }
          setDriveStatus('error',lastSyncError.short||'Sync non riuscito');updateManualSyncUI();
          window.thalysNetworkRecoveryPending=false;
          return false;
        }finally{
          networkRecoveryRunning=false;
        }
      })();
      try{return await networkRecoveryPromise;}
      finally{networkRecoveryPromise=null;}
    }
    window.syncAfterNetworkRestore=syncAfterNetworkRestore;

    window.addEventListener('online',()=>{
      // Auth owns token restoration and then invokes the Drive recovery cycle.
      // Do not start a second recovery here or iOS can race two read/merge/write passes.
      setDriveStatus('saving','Riconnessione…');
    },{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&getAccessToken()&&navigator.onLine){if(window.thalysNeedsDriveReconnectSync)syncAfterNetworkRestore();else refreshFromDrive(false);}});
    window.addEventListener('focus',()=>{if(getAccessToken())refreshFromDrive(false);});
    setInterval(()=>{if(!document.hidden&&getAccessToken())refreshFromDrive(false);},30000);
    setInterval(()=>{refreshWaterFromDriveLive();},5000);

    window.addEventListener('load',()=>{setTimeout(()=>{if(window.google?.accounts?.oauth2&&!gisInited)gisLoaded();if(window.gapi&&!gapiInited)gapiLoaded();},150);setTimeout(()=>{try{const p=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');if(getAccessToken())updateAuthUI(p);}catch(e){}},1200);});
  


    // ===== v0.25: language synchronization with Drive (moved from app-core.js) =====
    async function fetchDriveLanguagePack(lang){
      if(!getAccessToken()||!driveFolders?.databaseFolderId)return null;
      try{return await readDriveJSON(LANG_FILES[lang],driveFolders.databaseFolderId);}catch(e){console.warn('Drive language pack',lang,e);return null;}
    }
    async function refreshCurrentLanguageFromDrive(){
      if(!getAccessToken()||!driveFolders?.databaseFolderId)return;
      try{
        const remote=await fetchDriveLanguagePack(appLanguage);
        if(remote&&typeof remote==='object'){
          remote.locale=remote.locale||APP_LOCALES[appLanguage];remote.phrases=remote.phrases||{};remote.words=remote.words||[];remote.keys=remote.keys||{};
          languageCache[appLanguage]=remote;languagePack=remote;
          try{localStorage.setItem(`thalys_lang_pack_${appLanguage}_v22`,JSON.stringify(remote))}catch(_){}
          renderAllViews();renderHelpTree(activeHelpKey);translateElementTree(document.body);
        }
      }catch(e){console.warn('Refresh language pack from Drive',e)}
    }

    async function ensureLanguagePacksOnDrive(){
      if(!getAccessToken()||!driveFolders?.databaseFolderId)return;
      try{
        const current=await listDatabaseFiles(driveFolders.databaseFolderId),names=new Set(current.map(f=>f.name));
        for(const lang of Object.keys(LANG_FILES)){
          try{
            const shipped=await fetchLocalLanguagePack(lang);
            let shouldUpload=!names.has(LANG_FILES[lang]);
            if(!shouldUpload){
              try{
                const remote=await readDriveJSON(LANG_FILES[lang],driveFolders.databaseFolderId);
                shouldUpload=Number(remote?.version||0)<Number(shipped?.version||0);
              }catch(_){shouldUpload=true}
            }
            if(shouldUpload)await uploadDriveFile(LANG_FILES[lang],JSON.stringify(shipped),'application/json',driveFolders.databaseFolderId,true);
          }catch(e){console.warn('Language pack Drive sync',lang,e)}
        }
      }catch(e){console.warn('Language pack Drive sync',e)}
    }


    // ===== v0.25: current Drive workspace/database implementation (moved from app-enhancements.js) =====
/* Drive database payload and single first-run consent */
function databasePayloadsLegacyV7(){const {consultations:_c,aiConsults:_a,workoutHistory:_wh,activeWorkoutPlanHistory:_ph,...core}=appState||{};return {'thalys_manifest.json':{app:'Thalys',schemaVersion:8,updatedAt:new Date().toISOString(),databaseVersion:6},'app_state.json':{...core,photos:[],profilePhoto:null},'workouts.json':appState.workouts||[],'workout_history.json':appState.workoutHistory||[],'meal_history.json':appState.nutrition||[],'active_plan_history.json':appState.activeWorkoutPlanHistory||[],'workout_plans.json':{plans:(appState.workoutPlans||[]).map(normalizeWorkoutPlanV7),activePlanId:appState.activeWorkoutPlanId||null,assignments:appState.workoutAssignments||{},completions:appState.workoutCompletions||{},activeHistory:appState.activeWorkoutPlanHistory||[]},'nutrition.json':appState.nutrition||[],'alim_database.json':appState.presets||[],'body_metrics.json':appState.bodyMetrics||[],'wellness_data.json':appState.wellness||[],'water.json':appState.water||{},'foto_index.json':Object.fromEntries((appState.photos||[]).filter(p=>p.driveFileId).map(p=>[p.driveFileId,{id:p.driveFileId,name:p.driveName||'',date:p.date,updatedAt:p.updatedAt||null}])),'foto_profilo.json':appState.profilePhoto||null,'messages.json':appState.messages||[],'meditation.json':appState.meditation||[],
        'gratitude.json':appState.gratitude||[],'consultations.json':appState.consultations||[],'ai_consults.json':appState.aiConsults||[]};}
const THALYS_REQUIRED_DB_V7=['thalys_manifest.json','app_state.json','nutrition_targets.json','workouts.json','workout_history.json','meal_history.json','active_plan_history.json','workout_plans.json','nutrition.json','alim_database.json','body_metrics.json','wellness_data.json','water.json','foto_index.json','foto_profilo.json','messages.json','meditation.json','gratitude.json','consultations.json','ai_consults.json','lang_it.json','lang_en.json','lang_es.json','lang_pt.json','lang_ro.json'];
async function ensureAllDriveDatabasesV7(initial=false){if(!driveFolders?.databaseFolderId)return[];const files=await listDatabaseFiles(driveFolders.databaseFolderId),have=new Set(files.map(x=>x.name)),missing=THALYS_REQUIRED_DB_V7.filter(x=>!have.has(x));if(!missing.length)return[];const p=databasePayloads(),made=[];for(const name of missing){try{let data=p[name];if(name.startsWith('lang_'))data=await (await fetch(`./lang/${name}?v=22`,{cache:'no-store'})).json();if(data===undefined)data=[];await uploadDriveFile(name,JSON.stringify(data),'application/json',driveFolders.databaseFolderId,true);made.push(name)}catch(e){console.warn(name,e)}}return made;}
async function initializeDriveWorkspaceLegacyV7(){if(!getAccessToken())return null;if(driveFolders?.databaseFolderId){const repaired=await ensureAllDriveDatabasesV7(false);if(repaired.length)showToast(`${tr('Ho ricreato i database mancanti')}: ${repaired.length}`,'fa-database');return driveFolders;}let root=await findDriveFolder('Thalys App'),fresh=false;if(!root){if(!confirm(tr('Thalys può creare una sola volta la propria cartella, tutti i database e le cartelle di servizio nel tuo Google Drive personale. Vuoi procedere?')))return null;root=await createDriveFolder('Thalys App',null);fresh=true;}let db=await findDriveFolder('database',root.id);if(!db)db=await createDriveFolder('database',root.id);let photos=await findDriveFolder('foto',root.id);if(!photos)photos=await createDriveFolder('foto',root.id);let backups=await findDriveFolder('backups',root.id);if(!backups)backups=await createDriveFolder('backups',root.id);driveFolders={appFolderId:root.id,databaseFolderId:db.id,photoFolderId:photos.id,backupFolderId:backups.id};const made=await ensureAllDriveDatabasesV7(fresh);if(fresh)showToast(tr('Struttura Thalys creata nel Drive ✓'),'fa-cloud-check');else if(made.length)showToast(`${tr('Ho ricreato i database mancanti')}: ${made.length}`,'fa-database');return driveFolders;}


// v0.37.8: the manual reconnect action must also recover Google libraries if the app booted offline.
reconnectGoogle=function(){
  try{closeModal('sync-error-modal');}catch(_){}
  if(typeof loginHandler==='function')return loginHandler();
  return handleAuthClick(false,true);
};
