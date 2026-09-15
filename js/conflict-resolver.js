(function () {
  'use strict';

  const APP_VERSION = window.ThalysConfig?.appVersion || '0.48.2';
  const PROTOCOL_VERSION = Number(window.ThalysConfig?.syncProtocolVersion || 7);

  function clone(value) {
    try { return structuredClone(value); }
    catch (_) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } }
  }
  function ts(value) { const n = Date.parse(value || 0); return Number.isFinite(n) ? n : 0; }
  function opTime(op) { return ts(op?.updatedAt || op?.createdAt); }
  function recordTime(record) { return ts(record?.updatedAt || record?.completedAt || record?.createdAt); }
  function sortOps(ops) { return [...(ops || [])].sort((a,b) => opTime(a) - opTime(b) || String(a.id||'').localeCompare(String(b.id||''))); }


  function payloadAfter(op) {
    const p = op?.payload;
    if (p && typeof p === 'object' && Object.prototype.hasOwnProperty.call(p, 'after')) return clone(p.after);
    return clone(p);
  }
  function payloadBefore(op) {
    const p = op?.payload;
    if (p && typeof p === 'object' && Object.prototype.hasOwnProperty.call(p, 'before')) return clone(p.before);
    return null;
  }
  function same(a,b){ try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return a===b;} }
  function isPlainObject(v){ return !!v && typeof v==='object' && !Array.isArray(v); }
  function patchChangedFields(remote, before, after) {
    if (!isPlainObject(before) || !isPlainObject(after)) return clone(after);
    const out = {...(isPlainObject(remote) ? remote : {})};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (same(before[key], after[key])) continue;
      if (!Object.prototype.hasOwnProperty.call(after, key)) { delete out[key]; continue; }
      if (isPlainObject(before[key]) && isPlainObject(after[key])) out[key]=patchChangedFields(out[key],before[key],after[key]);
      else out[key] = clone(after[key]);
    }
    return out;
  }

  function keyOf(entity, item, index) {
    if (!item) return String(index);
    if (item.id != null) return String(item.id);
    if (entity === 'nutrition') return `${item.date||''}|${item.meal||''}|${item.name||''}|${item.grams||''}`;
    if (entity === 'bodyMetric') return String(item.date || index);
    if (entity === 'workoutPlan') return String(item.name || index);
    if (entity === 'workoutHistory') return `${item.date||''}|${item.planId||''}`;
    if (entity === 'meditation') return `${item.date||''}|${item.completedAt||item.minutes||''}`;
    if (entity === 'foodPreset') return String(item.name || index).trim().toLowerCase();
    return String(item.date || index);
  }

  function arrayField(entity) {
    return ({
      nutrition: 'nutrition', bodyMetric: 'bodyMetrics', workoutPlan: 'workoutPlans',
      workoutHistory: 'workoutHistory', meditation: 'meditation', foodPreset: 'presets'
    })[entity] || null;
  }

  function applyArrayOperation(state, op, decisions) {
    const field = arrayField(op.entity); if (!field) return false;
    const arr = Array.isArray(state[field]) ? [...state[field]] : [];
    const id = String(op.entityId ?? op.payload?.id ?? op.payload?.after?.id ?? '');
    let idx = arr.findIndex((item,i) => keyOf(op.entity,item,i) === id);
    if (op.action === 'delete') {
      if (idx >= 0) arr.splice(idx,1);
      state[field] = arr; decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-delete'}); return true;
    }
    const incoming = payloadAfter(op);
    const before = payloadBefore(op);
    if (idx < 0) {
      if (incoming != null) arr.push(incoming);
      state[field] = arr; decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-add'}); return true;
    }
    const remote = arr[idx];
    // For v0.35.2+ operations, merge only fields actually changed locally.
    // This preserves concurrent remote edits to other fields of the same record.
    if (before != null && incoming != null) {
      arr[idx] = patchChangedFields(remote, before, incoming);
      state[field] = arr;
      decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'field-merge'}); return true;
    }
    // Compatibility with old pending operations: local pending wins unless remote has
    // a strictly newer explicit timestamp.
    if (recordTime(remote) > opTime(op)) {
      decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'remote-newer'}); return true;
    }
    arr[idx] = {...remote, ...(incoming || {})}; state[field] = arr;
    decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-update-legacy'}); return true;
  }


  function applyTombstones(state, syncMeta, touched, decisions){
    const tombstones=syncMeta?.tombstones||{};
    for(const [key,tomb] of Object.entries(tombstones)){
      const field=arrayField(tomb?.entity); if(!field)continue;
      const arr=Array.isArray(state[field])?[...state[field]]:[];
      const id=String(tomb?.entityId??'');
      const idx=arr.findIndex((item,i)=>keyOf(tomb.entity,item,i)===id);
      if(idx>=0){arr.splice(idx,1);state[field]=arr;}
      touched.fields.add(field);
      decisions.push({entity:tomb.entity,entityId:id,resolution:'tombstone',deletedAt:tomb.deletedAt,revision:tomb.revision,key});
    }
  }

  function tombstoneKeyForOperation(op){ return `${String(op?.entity||'')}::${String(op?.entityId ?? op?.date ?? '')}`; }
  function applyOperation(state, op, touched, decisions, syncMeta) {
    if (!op || op.kind !== 'operation') return;
    const entity = op.entity;
    const tomb=syncMeta?.tombstones?.[tombstoneKeyForOperation(op)];
    if(tomb){
      const deletedAt=ts(tomb.deletedAt), operationAt=opTime(op);
      if(deletedAt>=operationAt){
        decisions.push({opId:op.id,entity,entityId:op.entityId,resolution:'blocked-by-newer-tombstone',deletedAt:tomb.deletedAt,operationAt:op.updatedAt||op.createdAt});
        return;
      }
    }
    if (entity === 'water') {
      const date = String(op.date || op.entityId || ''); if (!date) return;
      state.water = {...(state.water || {})}; state.waterUpdatedAt = {...(state.waterUpdatedAt || {})};
      const remote = Number(state.water[date] || 0);
      const delta = Number(op.payload?.delta);
      const after = Number(op.payload?.after);
      if (op.action === 'increment' && Number.isFinite(delta)) state.water[date] = Math.max(0, remote + delta);
      else if (Number.isFinite(after)) state.water[date] = Math.max(0, after);
      state.waterUpdatedAt[date] = op.updatedAt || op.createdAt || new Date().toISOString();
      touched.waterDates.add(date); touched.fields.add('water'); touched.fields.add('waterUpdatedAt');
      decisions.push({opId:op.id,entity,date,resolution:'delta-on-remote',remote,delta:Number.isFinite(delta)?delta:null,result:state.water[date]});
      return;
    }
    if (applyArrayOperation(state,op,decisions)) { touched.fields.add(arrayField(entity)); return; }
    if (entity === 'activeWorkoutPlan') {
      state.activeWorkoutPlanId = clone(op.payload?.after ?? null);
      touched.fields.add('activeWorkoutPlanId');
      decisions.push({opId:op.id,entity,resolution:'local-pending'}); return;
    }
    if (entity === 'workoutAssignments') {
      const before=payloadBefore(op)||{}, after=payloadAfter(op)||{};
      state.workoutAssignments=patchChangedFields(state.workoutAssignments||{},before,after);
      touched.fields.add('workoutAssignments');
      decisions.push({opId:op.id,entity,resolution:'field-merge'}); return;
    }
    if (entity === 'workoutCompletion') {
      const date=String(op.date||op.entityId||''); if(!date)return;
      state.workoutCompletions={...(state.workoutCompletions||{})};
      if(op.action==='delete') delete state.workoutCompletions[date];
      else {
        const before=payloadBefore(op), after=payloadAfter(op), remote=state.workoutCompletions[date];
        state.workoutCompletions[date]=before!=null?patchChangedFields(remote,before,after):clone(after);
      }
      touched.fields.add('workoutCompletions'); decisions.push({opId:op.id,entity,date,resolution:'local-operation'}); return;
    }
    const simple = {settings:'settings',targets:'targets',profile:'profile',foodPresets:'presets'};
    const field=simple[entity];
    if(field){
      const before=payloadBefore(op), after=payloadAfter(op);
      if (before != null && after != null && !Array.isArray(after)) state[field]=patchChangedFields(state[field],before,after);
      else state[field]=clone(after);
      touched.fields.add(field); decisions.push({opId:op.id,entity,resolution:before!=null?'field-merge':'local-pending'});
    }
  }

  async function resolve(cloudState, localState, pendingOperations, syncMeta = null) {
    const ops = sortOps((pendingOperations || []).filter(x => x?.kind === 'operation' && x?.status === 'pending'));
    const state = clone(cloudState || {});
    const touched = {fields:new Set(), waterDates:new Set()};
    const decisions=[];
    applyTombstones(state,syncMeta,touched,decisions);
    for (const op of ops) applyOperation(state,op,touched,decisions,syncMeta);
    const result={
      state,
      pendingCount:ops.length,
      touchedFields:[...touched.fields],
      touchedWaterDates:[...touched.waterDates],
      decisions,
      protocolVersion:PROTOCOL_VERSION,
      appVersion:APP_VERSION,
      resolvedAt:new Date().toISOString()
    };
    try { window.dispatchEvent(new CustomEvent('thalys:conflict-resolution',{detail:result})); } catch (_) {}
    return result;
  }

  function overlayResolved(mergedState, resolvedState, resolution) {
    const out = mergedState;
    const touched = new Set(resolution?.touchedFields || []);
    for (const field of touched) {
      if (field === 'water' || field === 'waterUpdatedAt') continue;
      out[field] = clone(resolvedState?.[field]);
    }
    if (resolution?.touchedWaterDates?.length) {
      out.water={...(out.water||{})}; out.waterUpdatedAt={...(out.waterUpdatedAt||{})};
      for(const date of resolution.touchedWaterDates){
        if(Object.prototype.hasOwnProperty.call(resolvedState?.water||{},date)) out.water[date]=resolvedState.water[date]; else delete out.water[date];
        if(Object.prototype.hasOwnProperty.call(resolvedState?.waterUpdatedAt||{},date)) out.waterUpdatedAt[date]=resolvedState.waterUpdatedAt[date];
      }
    }
    return out;
  }

  window.ThalysConflictResolver = Object.freeze({resolve,overlayResolved,protocolVersion:PROTOCOL_VERSION,appVersion:APP_VERSION});
})();
