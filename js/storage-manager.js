(function () {
  'use strict';

  const CONFIG = Object.freeze({
    dbName: 'Thalys App',
    dbVersion: 2,
    schemaVersion: 4,
    syncProtocolVersion: 7,
    stores: Object.freeze({ files: 'files', meta: 'meta', snapshots: 'snapshots', syncQueue: 'sync_queue' })
  });

  const DEVICE_KEY = 'thalys_device_id';

  function makeDeviceId() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (_) {}
    return `thalys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function getDeviceId() {
    let id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (_) {}
    if (!id) {
      id = makeDeviceId();
      try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
    }
    return id;
  }

  function open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB non disponibile'));
      const request = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);
      request.onupgradeneeded = event => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CONFIG.stores.files)) db.createObjectStore(CONFIG.stores.files, { keyPath: 'name' });
        if (!db.objectStoreNames.contains(CONFIG.stores.meta)) db.createObjectStore(CONFIG.stores.meta, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(CONFIG.stores.snapshots)) db.createObjectStore(CONFIG.stores.snapshots, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(CONFIG.stores.syncQueue)) {
          const queue = db.createObjectStore(CONFIG.stores.syncQueue, { keyPath: 'id' });
          queue.createIndex('status', 'status', { unique: false });
          queue.createIndex('createdAt', 'createdAt', { unique: false });
        }
        const tx = event.target.transaction;
        if (tx && db.objectStoreNames.contains(CONFIG.stores.meta)) {
          const meta = tx.objectStore(CONFIG.stores.meta);
          meta.put({ key: 'schemaVersion', value: CONFIG.schemaVersion, updatedAt: new Date().toISOString() });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Apertura IndexedDB non riuscita'));
      request.onblocked = () => console.warn('Thalys IndexedDB upgrade bloccato da un altro tab');
    });
  }

  function put(storeName, value) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
      tx.onabort = () => { const error = tx.error; db.close(); reject(error); };
    }));
  }

  function get(storeName, key) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => { const value = request.result || null; db.close(); resolve(value); };
      request.onerror = () => { const error = request.error; db.close(); reject(error); };
    }));
  }



  const PRIMARY_STATE_ID = 'primary-state';

  async function readPrimaryState() {
    try {
      const record = await get(CONFIG.stores.snapshots, PRIMARY_STATE_ID);
      return record?.state && typeof record.state === 'object' ? record : null;
    } catch (error) {
      console.warn('Thalys IndexedDB primary state read', error);
      return null;
    }
  }

  function sanitizePrimaryState(state) {
    if (!state || typeof state !== 'object') return state;
    const clean = { ...state };
    if (Array.isArray(clean.photos)) {
      clean.photos = clean.photos.map(photo => {
        if (!photo || typeof photo !== 'object') return photo;
        const { base64, dataUrl, blobUrl, objectUrl, ...meta } = photo;
        return meta;
      });
    }
    return clean;
  }

  async function writePrimaryState(state, meta = {}) {
    if (!state || typeof state !== 'object') return null;
    const now = new Date().toISOString();
    const record = {
      id: PRIMARY_STATE_ID,
      state: sanitizePrimaryState(state),
      savedAt: now,
      source: String(meta.source || 'app'),
      deviceId: getDeviceId(),
      schemaVersion: CONFIG.schemaVersion,
      appVersion: (window.ThalysConfig?.appVersion || '0.48.6')
    };
    try {
      await put(CONFIG.stores.snapshots, record);
      return record;
    } catch (error) {
      console.warn('Thalys IndexedDB primary state write', error);
      return null;
    }
  }

  async function initialize() {
    if (!window.indexedDB) return { available: false, deviceId: getDeviceId() };
    const deviceId = getDeviceId();
    const db = await open();
    db.close();
    const now = new Date().toISOString();
    const existingPrimary = await readPrimaryState();
    if (existingPrimary?.state && Array.isArray(existingPrimary.state.photos) && existingPrimary.state.photos.some(photo => photo && typeof photo === 'object' && (photo.base64 || photo.dataUrl || photo.blobUrl || photo.objectUrl))) {
      await writePrimaryState(existingPrimary.state, { source: 'v0.38-strip-legacy-photo-cache' });
    }
    if (!existingPrimary) {
      try {
        const raw = localStorage.getItem('thalys_data') || localStorage.getItem('gymbro_data');
        const legacyState = raw ? JSON.parse(raw) : null;
        if (legacyState && typeof legacyState === 'object') await writePrimaryState(legacyState, { source: 'migration-localStorage' });
      } catch (error) { console.warn('Migrazione stato locale verso IndexedDB', error); }
    }
    const existing = await get(CONFIG.stores.meta, 'device');
    await put(CONFIG.stores.meta, {
      key: 'device',
      value: {
        deviceId,
        createdAt: existing?.value?.createdAt || now,
        lastSeenAt: now,
        userAgent: navigator.userAgent || ''
      },
      updatedAt: now
    });
    await put(CONFIG.stores.meta, { key: 'versions', value: { appVersion: (window.ThalysConfig?.appVersion || '0.48.6'), dbVersion: CONFIG.dbVersion, schemaVersion: CONFIG.schemaVersion, syncProtocolVersion: CONFIG.syncProtocolVersion }, updatedAt: now });
    window.dispatchEvent(new CustomEvent('thalys:storage-ready', { detail: { deviceId, dbVersion: CONFIG.dbVersion } }));
    return { available: true, deviceId, dbVersion: CONFIG.dbVersion };
  }

  window.ThalysStorage = Object.freeze({ CONFIG, open, get, put, getDeviceId, initialize, readPrimaryState, writePrimaryState, sanitizePrimaryState });
  window.THALYS_DEVICE_ID = getDeviceId();
  window.thalysStorageReady = initialize().catch(error => {
    console.warn('Thalys Storage Manager', error);
    return { available: false, deviceId: window.THALYS_DEVICE_ID, error };
  });
})();
