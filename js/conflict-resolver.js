(function () {
  'use strict';

  const APP_VERSION = '0.35';
  const PROTOCOL_VERSION = 3;

  function clone(value) {
    try { return structuredClone(value); }
    catch (_) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } }
  }
  function ts(value) { const n = Date.parse(value || 0); return Number.isFinite(n) ? n : 0; }
  function opTime(op) { return ts(op?.updatedAt || op?.createdAt); }
  function recordTime(record) { return ts(record?.updatedAt || record?.completedAt || record?.createdAt); }
  function sortOps(ops) { return [...(ops || [])].sort((a,b) => opTime(a) - opTime(b) || String(a.id||'').localeCompare(String(b.id||''))); }

  function keyOf(entity, item, index) {
    if (!item) return String(index);
    if (item.id != null) return String(item.id);
    if (entity === 'nutrition') return `${item.date||''}|${item.meal||''}|${item.name||''}|${item.grams||''}`;
    if (entity === 'bodyMetric') return String(item.date || index);
    if (entity === 'workoutPlan') return String(item.name || index);
    if (entity === 'workoutHistory') return `${item.date||''}|${item.planId||''}`;
    if (entity === 'meditation') return `${item.date||''}|${item.completedAt||item.minutes||''}`;
    return String(item.date || index);
  }

  function arrayField(entity) {
    return ({
      nutrition: 'nutrition', bodyMetric: 'bodyMetrics', workoutPlan: 'workoutPlans',
      workoutHistory: 'workoutHistory', meditation: 'meditation'
    })[entity] || null;
  }

  function applyArrayOperation(state, op, decisions) {
    const field = arrayField(op.entity); if (!field) return false;
    const arr = Array.isArray(state[field]) ? [...state[field]] : [];
    const id = String(op.entityId ?? op.payload?.id ?? '');
    let idx = arr.findIndex((item,i) => keyOf(op.entity,item,i) === id);
    if (op.action === 'delete') {
      if (idx >= 0) arr.splice(idx,1);
      state[field] = arr; decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-delete'}); return true;
    }
    const incoming = clone(op.payload);
    if (idx < 0) {
      arr.push(incoming); state[field] = arr; decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-add'}); return true;
    }
    const remote = arr[idx];
    // Pending local edits win unless the remote record carries a strictly newer explicit timestamp.
    if (recordTime(remote) > opTime(op)) {
      decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'remote-newer'}); return true;
    }
    arr[idx] = {...remote, ...incoming}; state[field] = arr;
    decisions.push({opId:op.id,entity:op.entity,entityId:id,resolution:'local-update'}); return true;
  }

  function applyOperation(state, op, touched, decisions) {
    if (!op || op.kind !== 'operation') return;
    const entity = op.entity;
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
    if (entity === 'workoutCompletion') {
      const date=String(op.date||op.entityId||''); if(!date)return;
      state.workoutCompletions={...(state.workoutCompletions||{})};
      if(op.action==='delete') delete state.workoutCompletions[date]; else state.workoutCompletions[date]=clone(op.payload);
      touched.fields.add('workoutCompletions'); decisions.push({opId:op.id,entity,date,resolution:'local-operation'}); return;
    }
    const simple = {settings:'settings',targets:'targets',profile:'profile',foodPresets:'presets'};
    const field=simple[entity]; if(field){ state[field]=clone(op.payload); touched.fields.add(field); decisions.push({opId:op.id,entity,resolution:'local-pending'}); }
  }

  async function resolve(cloudState, localState, pendingOperations) {
    const ops = sortOps((pendingOperations || []).filter(x => x?.kind === 'operation' && x?.status === 'pending'));
    const state = clone(cloudState || {});
    const touched = {fields:new Set(), waterDates:new Set()};
    const decisions=[];
    for (const op of ops) applyOperation(state,op,touched,decisions);
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

  window.ThalysConflictResolver = Object.freeze({resolve,overlayResolved,protocolVersion:PROTOCOL_VERSION});
})();
