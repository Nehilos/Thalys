(function () {
  'use strict';

  const APP_VERSION = '0.33';
  const STORE = 'sync_queue';
  const GLOBAL_STATE_ID_PREFIX = 'state:';
  let writeChain = Promise.resolve();

  function storage() {
    return window.ThalysStorage || null;
  }

  function deviceId() {
    return window.THALYS_DEVICE_ID || storage()?.getDeviceId?.() || 'unknown-device';
  }

  function isoNow() { return new Date().toISOString(); }

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

  async function enqueueStateChangeNow(meta = {}) {
    try {
      if (window.thalysStorageReady) await window.thalysStorageReady;
      const id = GLOBAL_STATE_ID_PREFIX + deviceId();
      const previous = await getRecord(id);
      const now = isoNow();
      const record = {
        id,
        kind: 'state-change',
        entity: 'appState',
        action: 'upsert',
        status: 'pending',
        deviceId: deviceId(),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
        revision: (Number(previous?.revision) || 0) + 1,
        attempts: Number(previous?.attempts) || 0,
        lastAttemptAt: previous?.lastAttemptAt || null,
        lastError: null,
        appVersion: APP_VERSION,
        source: String(meta.source || 'saveStateToLocal')
      };
      await storage().put(STORE, record);
      try {
        localStorage.setItem('thalys_drive_dirty', '1');
        localStorage.setItem('thalys_sync_queue_pending', '1');
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-change', { detail: { pending: true, record } }));
      return record;
    } catch (error) {
      console.warn('Thalys Sync Queue enqueue', error);
      return null;
    }
  }

  function enqueueStateChange(meta = {}) {
    const task = writeChain.then(() => enqueueStateChangeNow(meta));
    writeChain = task.catch(() => null);
    return task;
  }

  async function flushWrites() {
    try { await writeChain; } catch (_) {}
    return true;
  }

  async function listByStatus(status = 'pending') {
    try {
      await flushWrites();
      if (window.thalysStorageReady) await window.thalysStorageReady;
      const s = storage();
      if (!s?.open) return [];
      const db = await s.open();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const index = store.index('status');
        const req = index.getAll(status);
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
        tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
      });
    } catch (error) {
      console.warn('Thalys Sync Queue list', error);
      return [];
    }
  }

  async function countPending() {
    return (await listByStatus('pending')).length;
  }

  async function hasPending() {
    return (await countPending()) > 0;
  }

  async function markPendingSynced(syncMeta = {}) {
    try {
      const pending = await listByStatus('pending');
      if (!pending.length) {
        try { localStorage.setItem('thalys_sync_queue_pending', '0'); } catch (_) {}
        return 0;
      }
      const syncedAt = isoNow();
      await withStore('readwrite', store => {
        pending.forEach(record => store.put({
          ...record,
          status: 'synced',
          syncedAt,
          lastAttemptAt: syncedAt,
          lastError: null,
          driveSyncAt: syncMeta.driveSyncAt || Date.now()
        }));
      });
      try { localStorage.setItem('thalys_sync_queue_pending', '0'); } catch (_) {}
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-change', { detail: { pending: false, synced: pending.length } }));
      return pending.length;
    } catch (error) {
      console.warn('Thalys Sync Queue acknowledge', error);
      return 0;
    }
  }

  async function noteSyncFailure(error) {
    try {
      const pending = await listByStatus('pending');
      if (!pending.length) return 0;
      const at = isoNow();
      const message = String(error?.message || error || 'Sync non riuscito').slice(0, 500);
      await withStore('readwrite', store => {
        pending.forEach(record => store.put({
          ...record,
          attempts: (Number(record.attempts) || 0) + 1,
          lastAttemptAt: at,
          lastError: message
        }));
      });
      return pending.length;
    } catch (queueError) {
      console.warn('Thalys Sync Queue failure tracking', queueError);
      return 0;
    }
  }

  async function pruneSynced(keep = 20) {
    try {
      const synced = await listByStatus('synced');
      if (synced.length <= keep) return 0;
      synced.sort((a, b) => Date.parse(b.syncedAt || b.updatedAt || 0) - Date.parse(a.syncedAt || a.updatedAt || 0));
      const remove = synced.slice(keep);
      await withStore('readwrite', store => remove.forEach(record => store.delete(record.id)));
      return remove.length;
    } catch (error) {
      console.warn('Thalys Sync Queue prune', error);
      return 0;
    }
  }

  async function initialize() {
    try {
      if (window.thalysStorageReady) await window.thalysStorageReady;
      const pending = await countPending();
      if (pending > 0) {
        try {
          localStorage.setItem('thalys_drive_dirty', '1');
          localStorage.setItem('thalys_sync_queue_pending', '1');
        } catch (_) {}
      }
      await pruneSynced(20);
      window.dispatchEvent(new CustomEvent('thalys:sync-queue-ready', { detail: { pending } }));
      return { available: true, pending };
    } catch (error) {
      console.warn('Thalys Sync Queue init', error);
      return { available: false, pending: 0, error };
    }
  }

  window.ThalysSyncQueue = Object.freeze({
    enqueueStateChange,
    flushWrites,
    listByStatus,
    countPending,
    hasPending,
    markPendingSynced,
    noteSyncFailure,
    pruneSynced,
    initialize
  });
  window.thalysSyncQueueReady = initialize();
})();
