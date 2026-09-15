(function () {
  'use strict';

  const APP_VERSION = window.ThalysConfig?.appVersion || '0.49.3';
  const PROTOCOL_VERSION = Number(window.ThalysConfig?.syncProtocolVersion || 7);
  const STORE = 'sync_queue';
  const GLOBAL_STATE_ID_PREFIX = 'state:';
  let writeChain = Promise.resolve();
  let sequence = 0;


  const SYNC_META_KEY = 'thalys_sync_metadata';
  function emptySyncMetadata(){ return {version:1,protocolVersion:PROTOCOL_VERSION,updatedAt:isoNow(),records:{},tombstones:{}}; }
  function getSyncMetadata(){
    try { const raw=JSON.parse(localStorage.getItem(SYNC_META_KEY)||'null'); return raw&&typeof raw==='object'?{...emptySyncMetadata(),...raw,records:{...(raw.records||{})},tombstones:{...(raw.tombstones||{})}}:emptySyncMetadata(); }
    catch(_){ return emptySyncMetadata(); }
  }
  function saveSyncMetadata(meta){
    const clean={...emptySyncMetadata(),...(meta||{}),updatedAt:isoNow(),records:{...(meta?.records||{})},tombstones:{...(meta?.tombstones||{})}};
    try{localStorage.setItem(SYNC_META_KEY,JSON.stringify(clean));}catch(_){}
    return clean;
  }
  function recordKey(op){ return `${String(op?.entity||'')}::${String(op?.entityId ?? op?.date ?? '')}`; }
  function noteRecordMetadata(records){
    if(!records?.length)return getSyncMetadata();
    const meta=getSyncMetadata();
    for(const op of records){
      if(op?.kind!=='operation')continue;
      const key=recordKey(op); if(!key||key==='::')continue;
      const prev=meta.records[key]||{}; const revision=(Number(prev.revision)||0)+1;
      if(op.action==='delete'){
        delete meta.records[key];
        meta.tombstones[key]={entity:op.entity,entityId:op.entityId,date:op.date||null,deletedAt:op.updatedAt||op.createdAt||isoNow(),deviceId:op.deviceId||deviceId(),revision,protocolVersion:PROTOCOL_VERSION};
      }else{
        meta.records[key]={entity:op.entity,entityId:op.entityId,date:op.date||null,updatedAt:op.updatedAt||op.createdAt||isoNow(),deviceId:op.deviceId||deviceId(),revision,protocolVersion:PROTOCOL_VERSION};
        const tomb=meta.tombstones[key];
        if(tomb && Date.parse(meta.records[key].updatedAt||0)>=Date.parse(tomb.deletedAt||0)) delete meta.tombstones[key];
      }
    }
    return saveSyncMetadata(meta);
  }
  function newerMeta(a,b,timeField){
    const ar=Number(a?.revision)||0, br=Number(b?.revision)||0;
    const at=Date.parse(a?.[timeField]||a?.updatedAt||0)||0, bt=Date.parse(b?.[timeField]||b?.updatedAt||0)||0;
    if(at!==bt)return at>bt?a:b; if(ar!==br)return ar>br?a:b;
    return String(a?.deviceId||'')>=String(b?.deviceId||'')?a:b;
  }
  function mergeSyncMetadata(remote){
    const local=getSyncMetadata(), r=remote&&typeof remote==='object'?remote:emptySyncMetadata();
    const out=emptySyncMetadata();
    for(const key of new Set([...Object.keys(r.records||{}),...Object.keys(local.records||{})])) out.records[key]=newerMeta(local.records?.[key],r.records?.[key],'updatedAt');
    for(const key of new Set([...Object.keys(r.tombstones||{}),...Object.keys(local.tombstones||{})])) out.tombstones[key]=newerMeta(local.tombstones?.[key],r.tombstones?.[key],'deletedAt');
    // A later live revision resurrects a record; a later/equal tombstone keeps it deleted.
    for(const key of new Set([...Object.keys(out.records),...Object.keys(out.tombstones)])){
      const rec=out.records[key], tomb=out.tombstones[key]; if(!rec||!tomb)continue;
      const rt=Date.parse(rec.updatedAt||0)||0, dt=Date.parse(tomb.deletedAt||0)||0;
      if(rt>dt) delete out.tombstones[key]; else delete out.records[key];
    }
    return saveSyncMetadata(out);
  }

  function storage() { return window.ThalysStorage || null; }
  function deviceId() { return window.THALYS_DEVICE_ID || storage()?.getDeviceId?.() || 'unknown-device'; }
  function isoNow() { return new Date().toISOString(); }
  function clone(value) { try { return structuredClone(value); } catch (_) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } } }
  function same(a,b){ try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return a===b;} }

  async function withStore(mode, callback) {
    const s = storage();
    if (!s?.open) throw new Error('ThalysStorage non disponibile');
    const db = await s.open();
    return new Promise((resolve, reject) => {
      let result;
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      try { result = callback(store, tx); }
      catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
      tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
    });
  }

  async function getRecord(id) {
    const s = storage();
    if (!s?.get) return null;
    return s.get(STORE, id);
  }

  function makeOperationId(entity, action) {
    sequence = (sequence + 1) % 1000000;
    return `op:${deviceId()}:${Date.now()}:${sequence}:${String(entity||'state')}:${String(action||'update')}`;
  }

  function baseRecord({id,kind='operation',entity='appState',action='update',source='saveStateToLocal',payload=null,entityId=null,date=null}) {
    const now = isoNow();
    return {
      id: id || makeOperationId(entity, action), kind, entity, entityId, date, action,
      payload: clone(payload), status: 'pending', deviceId: deviceId(),
      createdAt: now, updatedAt: now, revision: 1, attempts: 0,
      lastAttemptAt: null, lastError: null, appVersion: APP_VERSION, source: String(source || 'saveStateToLocal')
    };
  }

  async function putPendingRecords(records) {
    if (!records.length) return [];
    try {
      if (window.thalysStorageReady) await window.thalysStorageReady;
      await withStore('readwrite', store => records.forEach(record => store.put(record)));
      try {
        localStorage.setItem('thalys_drive_dirty', '1');
        localStorage.setItem('thalys_sync_queue_pending', '1');
      } catch (_) {}
      noteRecordMetadata(records);
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-change', { detail: { pending: true, records } }));
      return records;
    } catch (error) {
      console.warn('Thalys Sync Queue granular enqueue', error);
      return [];
    }
  }

  function entityKey(entity,x,index){
    if(x?.id!=null)return String(x.id);
    if(entity==='nutrition')return `${x?.date||''}|${x?.meal||''}|${x?.name||''}|${x?.grams||''}`;
    if(entity==='bodyMetric')return String(x?.date||index);
    if(entity==='workoutPlan')return String(x?.name||index);
    if(entity==='workoutHistory')return `${x?.date||''}|${x?.planId||''}`;
    if(entity==='meditation')return `${x?.date||''}|${x?.completedAt||x?.minutes||''}`;
    return String(x?.date||index);
  }
  function diffMapArray(previous, current, entity, source) {
    const p = new Map((Array.isArray(previous)?previous:[]).filter(Boolean).map((x,i)=>[entityKey(entity,x,i),x]));
    const c = new Map((Array.isArray(current)?current:[]).filter(Boolean).map((x,i)=>[entityKey(entity,x,i),x]));
    const out=[];
    c.forEach((value,id)=>{
      const old=p.get(id);
      if(!old) out.push(baseRecord({entity,entityId:id,date:value?.date||null,action:'add',payload:{after:value},source}));
      else if(!same(old,value)) out.push(baseRecord({entity,entityId:id,date:value?.date||null,action:'update',payload:{before:old,after:value},source}));
    });
    p.forEach((value,id)=>{ if(!c.has(id)) out.push(baseRecord({entity,entityId:id,date:value?.date||null,action:'delete',payload:{before:value,id,date:value?.date||null},source})); });
    return out;
  }

  function diffNamedArray(previous, current, entity, source) {
    const makeKey = x => String(x?.id || x?.name || '').trim().toLowerCase();
    const p = new Map((Array.isArray(previous)?previous:[]).filter(Boolean).map(x=>[makeKey(x),x]).filter(([k])=>k));
    const c = new Map((Array.isArray(current)?current:[]).filter(Boolean).map(x=>[makeKey(x),x]).filter(([k])=>k));
    const out=[];
    c.forEach((value,id)=>{
      const old=p.get(id);
      if(!old) out.push(baseRecord({entity,entityId:id,action:'add',payload:{after:value},source}));
      else if(!same(old,value)) out.push(baseRecord({entity,entityId:id,action:'update',payload:{before:old,after:value},source}));
    });
    p.forEach((value,id)=>{ if(!c.has(id)) out.push(baseRecord({entity,entityId:id,action:'delete',payload:{before:value,id},source})); });
    return out;
  }

  function buildGranularOperations(previousState, currentState, meta = {}) {
    if (!previousState || !currentState) return [];
    const source = meta.source || 'saveStateToLocal';
    const ops=[];

    // Water: preserve the actual delta where possible; this is important for multi-device merge later.
    const pw=previousState.water||{}, cw=currentState.water||{};
    new Set([...Object.keys(pw),...Object.keys(cw)]).forEach(date=>{
      const before=Number(pw[date]||0), after=Number(cw[date]||0);
      if(before===after)return;
      const delta=after-before;
      ops.push(baseRecord({entity:'water',entityId:date,date,action:delta!==0?'increment':'set',payload:{before,after,delta,updatedAt:currentState.waterUpdatedAt?.[date]||isoNow()},source}));
    });

    ops.push(...diffMapArray(previousState.nutrition,currentState.nutrition,'nutrition',source));
    ops.push(...diffMapArray(previousState.bodyMetrics,currentState.bodyMetrics,'bodyMetric',source));
    ops.push(...diffMapArray(previousState.workoutPlans,currentState.workoutPlans,'workoutPlan',source));
    ops.push(...diffMapArray(previousState.workoutHistory,currentState.workoutHistory,'workoutHistory',source));
    ops.push(...diffMapArray(previousState.meditation,currentState.meditation,'meditation',source));
    ops.push(...diffMapArray(previousState.gratitude,currentState.gratitude,'gratitude',source));

    if(!same(previousState.activeWorkoutPlanId,currentState.activeWorkoutPlanId)) {
      ops.push(baseRecord({entity:'activeWorkoutPlan',entityId:'active',action:'update',payload:{before:previousState.activeWorkoutPlanId||null,after:currentState.activeWorkoutPlanId||null},source}));
    }
    if(!same(previousState.workoutAssignments,currentState.workoutAssignments)) {
      ops.push(baseRecord({entity:'workoutAssignments',entityId:'assignments',action:'update',payload:{before:previousState.workoutAssignments||{},after:currentState.workoutAssignments||{}},source}));
    }

    const completionDates = new Set([...Object.keys(previousState.workoutCompletions||{}),...Object.keys(currentState.workoutCompletions||{})]);
    completionDates.forEach(date=>{
      const before=previousState.workoutCompletions?.[date]; const after=currentState.workoutCompletions?.[date];
      if(same(before,after))return;
      ops.push(baseRecord({entity:'workoutCompletion',entityId:date,date,action:after==null?'delete':before==null?'add':'update',payload:after==null?{before,date}:before==null?{after}:{before,after},source}));
    });

    if(!same(previousState.settings,currentState.settings)) ops.push(baseRecord({entity:'settings',entityId:'settings',action:'update',payload:{before:previousState.settings||{},after:currentState.settings||{}},source}));
    if(!same(previousState.targets,currentState.targets)) ops.push(baseRecord({entity:'targets',entityId:'nutrition-targets',action:'update',payload:{before:previousState.targets||{},after:currentState.targets||{}},source}));
    if(!same(previousState.profile,currentState.profile)) ops.push(baseRecord({entity:'profile',entityId:'profile',action:'update',payload:{before:previousState.profile||{},after:currentState.profile||{}},source}));
    ops.push(...diffNamedArray(previousState.presets,currentState.presets,'foodPreset',source));

    return ops;
  }

  async function enqueueGranularChangesNow(previousState, currentState, meta = {}) {
    return putPendingRecords(buildGranularOperations(previousState,currentState,meta));
  }
  function enqueueGranularChanges(previousState,currentState,meta={}) {
    const prev=clone(previousState), cur=clone(currentState);
    const task=writeChain.then(()=>enqueueGranularChangesNow(prev,cur,meta));
    writeChain=task.catch(()=>null); return task;
  }

  async function enqueueStateChangeNow(meta = {}) {
    try {
      if (window.thalysStorageReady) await window.thalysStorageReady;
      const id = GLOBAL_STATE_ID_PREFIX + deviceId();
      const previous = await getRecord(id);
      const now = isoNow();
      const record = {
        id, kind: 'state-change', entity: 'appState', action: 'upsert', status: 'pending', deviceId: deviceId(),
        createdAt: previous?.createdAt || now, updatedAt: now, revision: (Number(previous?.revision) || 0) + 1,
        attempts: Number(previous?.attempts) || 0, lastAttemptAt: previous?.lastAttemptAt || null, lastError: null,
        appVersion: APP_VERSION, source: String(meta.source || 'saveStateToLocal')
      };
      await storage().put(STORE, record);
      try { localStorage.setItem('thalys_drive_dirty','1'); localStorage.setItem('thalys_sync_queue_pending','1'); } catch (_) {}
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-change', { detail: { pending: true, record } }));
      return record;
    } catch (error) { console.warn('Thalys Sync Queue enqueue', error); return null; }
  }
  function enqueueStateChange(meta = {}) { const task=writeChain.then(()=>enqueueStateChangeNow(meta)); writeChain=task.catch(()=>null); return task; }

  async function flushWrites() { try { await writeChain; } catch (_) {} return true; }

  async function listByStatus(status = 'pending') {
    try {
      await flushWrites(); if (window.thalysStorageReady) await window.thalysStorageReady;
      const s=storage(); if(!s?.open)return []; const db=await s.open();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly'), store=tx.objectStore(STORE), index=store.index('status'), req=index.getAll(status);
        req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]); req.onerror=()=>reject(req.error);
        tx.oncomplete=()=>db.close(); tx.onerror=()=>{const e=tx.error;db.close();reject(e)}; tx.onabort=()=>{const e=tx.error;db.close();reject(e)};
      });
    } catch(error){console.warn('Thalys Sync Queue list',error);return [];}
  }
  async function listPendingOperations(){ return (await listByStatus('pending')).filter(x=>x.kind==='operation'); }
  async function countPending(){return (await listByStatus('pending')).length;}
  async function hasPending(){return (await countPending())>0;}

  async function markPendingSynced(syncMeta = {}) {
    try {
      const pending=await listByStatus('pending'); if(!pending.length){try{localStorage.setItem('thalys_sync_queue_pending','0')}catch(_){} return 0;}
      const syncedAt=isoNow();
      await withStore('readwrite',store=>pending.forEach(record=>store.put({...record,status:'synced',syncedAt,lastAttemptAt:syncedAt,lastError:null,driveSyncAt:syncMeta.driveSyncAt||Date.now()})));
      try{localStorage.setItem('thalys_sync_queue_pending','0')}catch(_){}
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-change',{detail:{pending:false,synced:pending.length}})); return pending.length;
    }catch(error){console.warn('Thalys Sync Queue acknowledge',error);return 0;}
  }

  async function noteSyncFailure(error) {
    try {
      const pending=await listByStatus('pending'); if(!pending.length)return 0; const at=isoNow(); const message=String(error?.message||error||'Sync non riuscito').slice(0,500);
      await withStore('readwrite',store=>pending.forEach(record=>store.put({...record,attempts:(Number(record.attempts)||0)+1,lastAttemptAt:at,lastError:message})));
      return pending.length;
    }catch(queueError){console.warn('Thalys Sync Queue failure tracking',queueError);return 0;}
  }

  async function pruneSynced(keep = 120) {
    try {
      const synced=await listByStatus('synced'); if(synced.length<=keep)return 0;
      synced.sort((a,b)=>Date.parse(b.syncedAt||b.updatedAt||0)-Date.parse(a.syncedAt||a.updatedAt||0)); const remove=synced.slice(keep);
      await withStore('readwrite',store=>remove.forEach(record=>store.delete(record.id))); return remove.length;
    }catch(error){console.warn('Thalys Sync Queue prune',error);return 0;}
  }

  async function initialize() {
    try {
      if(window.thalysStorageReady)await window.thalysStorageReady; const pending=await countPending();
      if(pending>0){try{localStorage.setItem('thalys_drive_dirty','1');localStorage.setItem('thalys_sync_queue_pending','1')}catch(_){}}
      await pruneSynced(120); window.dispatchEvent(new CustomEvent('thalys:sync-queue-ready',{detail:{pending}})); return {available:true,pending};
    }catch(error){console.warn('Thalys Sync Queue init',error);return {available:false,pending:0,error};}
  }

  window.ThalysSyncQueue=Object.freeze({enqueueStateChange,enqueueGranularChanges,buildGranularOperations,flushWrites,listByStatus,listPendingOperations,countPending,hasPending,markPendingSynced,noteSyncFailure,pruneSynced,initialize,getSyncMetadata,mergeSyncMetadata,recordKey});
  window.thalysSyncQueueReady=initialize();
})();
