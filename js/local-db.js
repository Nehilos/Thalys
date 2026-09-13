(function () {
  const DB_NAME = 'Thalys App';
  const DB_VERSION = 1;
  const STORE_NAME = 'files';
  const READY_KEY = 'thalys_offline_storage_ready_v2';

  function openLocalDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB non disponibile'));
    });
  }

  function localDocuments(state) {
    const s = state || {};
    const { consultations, aiConsults, photos, profilePhoto, ...appCore } = s;
    return {
      'app_state.json': appCore,
      'photos.json': s.photos || [],
      'profile_photo.json': s.profilePhoto || null,
      'nutrition_targets.json': s.targets || {},
      'workouts.json': s.workouts || [],
      'workout_history.json': s.workoutHistory || [],
      'meal_history.json': s.nutrition || [],
      'active_plan_history.json': s.activeWorkoutPlanHistory || [],
      'workout_plans.json': {
        plans: s.workoutPlans || [],
        activePlanId: s.activeWorkoutPlanId || null,
        assignments: s.workoutAssignments || {},
        completions: s.workoutCompletions || {}
      },
      'nutrition.json': s.nutrition || [],
      'alim_database.json': s.presets || [],
      'body_metrics.json': s.bodyMetrics || [],
      'wellness_data.json': s.wellness || [],
      'water.json': s.water || {},
      'messages.json': s.messages || [],
      'meditation.json': s.meditation || []
    };
  }

  function putLocalFile(db, name, data, savedAt) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ name, data, savedAt });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Salvataggio di ${name} non riuscito`));
      tx.onabort = () => reject(tx.error || new Error(`Salvataggio di ${name} annullato`));
    });
  }

  function getLocalFile(db, name) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(name);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error(`Lettura di ${name} non riuscita`));
    });
  }

  async function offlineStorageAlreadyExists() {
    if (localStorage.getItem(READY_KEY) === '1') return true;
    if (!window.indexedDB) return false;
    try {
      if (typeof indexedDB.databases === 'function') {
        const databases = await indexedDB.databases();
        if (!databases.some(database => database.name === DB_NAME)) return false;
      }
      const db = await openLocalDatabase();
      try {
        const manifest = await getLocalFile(db, 'thalys_manifest.json');
        const appState = await getLocalFile(db, 'app_state.json');
        const exists = !!(manifest?.data && appState?.data);
        if (exists) localStorage.setItem(READY_KEY, '1');
        return exists;
      } finally {
        db.close();
      }
    } catch (error) {
      console.warn('Verifica archivio offline', error);
      return false;
    }
  }

  const waitForPaint = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

  async function warmOfflineAppShell() {
    if (!window.caches || !window.isSecureContext) return 0;
    const urls = ['./', './index.html', './manifest.json', './css/thalys.css?v=016', './js/local-db.js?v=0281', './js/ui-foundation.js?v=0281', './js/drive.js?v=0281', './js/auth.js?v=0281', './js/app-core.js?v=0281', './js/body.js?v=0281', './js/meditation.js?v=0281', './js/app-enhancements.js?v=0281'];
    try{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('thalys-manual-offline-')&&k!=='thalys-manual-offline-v0.28.1').map(k=>caches.delete(k)));}catch(_){}
    const cache = await caches.open('thalys-manual-offline-v0.28.1');
    let saved = 0;
    for (const url of urls) {
      try { await cache.add(url); saved += 1; } catch (_) {}
    }
    return saved;
  }

  async function hydrateLocalMedia() {
    if (!(await offlineStorageAlreadyExists())) return false;
    for (let attempt = 0; attempt < 40 && !window.appState; attempt += 1) await waitForPaint(100);
    if (!window.appState) return false;
    const db = await openLocalDatabase();
    try {
      const photosRecord = await getLocalFile(db, 'photos.json');
      const profileRecord = await getLocalFile(db, 'profile_photo.json');
      if (Array.isArray(photosRecord?.data)) {
        const current = Array.isArray(window.appState.photos) ? window.appState.photos : [];
        const merged = new Map(photosRecord.data.map(photo => [photo.id, photo]));
        current.forEach(photo => {
          const stored = merged.get(photo.id) || {};
          merged.set(photo.id, { ...stored, ...photo, base64: photo.base64 || stored.base64 || '' });
        });
        window.appState.photos = [...merged.values()];
      }
      if (profileRecord?.data && !window.appState.profilePhoto?.dataUrl) window.appState.profilePhoto = profileRecord.data;
      if (typeof renderPhotos === 'function') renderPhotos();
      if (typeof renderProfilePhotoUI === 'function') renderProfilePhotoUI();
      return true;
    } finally {
      db.close();
    }
  }

  async function syncLocalDocuments(state, onProgress, paced = false) {
    const db = await openLocalDatabase();
    const docs = localDocuments(state);
    const savedAt = new Date().toISOString();
    const entries = [
      ...Object.entries(docs),
      ['thalys_manifest.json', { schemaVersion: 2, folderName: DB_NAME, savedAt, files: Object.keys(docs) }]
    ];
    try {
      for (let index = 0; index < entries.length; index += 1) {
        const [name, data] = entries[index];
        if (typeof onProgress === 'function') onProgress({ name, completed: index, total: entries.length });
        await putLocalFile(db, name, data, savedAt);
        if (typeof onProgress === 'function') onProgress({ name, completed: index + 1, total: entries.length });
        if (paced) await waitForPaint(80);
      }
      return { folderName: DB_NAME, fileCount: entries.length, savedAt };
    } finally {
      db.close();
    }
  }

  async function restoreLocalStateIfNeeded() {
    if (localStorage.getItem('thalys_data') || localStorage.getItem('gymbro_data')) return false;
    try {
      const db = await openLocalDatabase();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get('app_state.json');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (!record?.data || localStorage.getItem('thalys_local_restore_running') === '1') return false;
      localStorage.setItem('thalys_data', JSON.stringify(record.data));
      localStorage.setItem('thalys_local_restore_running', '1');
      location.reload();
      return true;
    } catch (error) {
      console.warn('Offline local restore', error);
      return false;
    }
  }

  async function prepareOfflineStorage() {
    const button = document.getElementById('prepare-offline-btn');
    const progressBox = document.getElementById('offline-progress-box');
    const progressBar = document.getElementById('offline-progress-bar');
    const progressPercent = document.getElementById('offline-progress-percent');
    const progressFile = document.getElementById('offline-progress-file');
    const result = document.getElementById('offline-setup-result');
    const closeButton = document.getElementById('offline-setup-close-btn');
    if (await offlineStorageAlreadyExists()) {
      await warmOfflineAppShell();
      closeOfflineSetupModal();
      if (typeof showToast === 'function') showToast('Archivio e file offline già pronti ✓', 'fa-database');
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparazione in corso…';
    }
    progressBox?.classList.remove('hidden');
    result?.classList.add('hidden');
    closeButton?.classList.add('hidden');
    try {
      for (let attempt = 0; attempt < 30 && !window.appState; attempt += 1) await waitForPaint(100);
      if (!window.appState) throw new Error('I database di Thalys non sono ancora pronti');
      const summary = await syncLocalDocuments(window.appState, ({ name, completed, total }) => {
        const percent = Math.round((completed / total) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressFile) progressFile.textContent = completed === total ? 'Verifica completata' : `Copia di ${name}`;
      }, true);
      const cachedFiles = await warmOfflineAppShell();
      let persistent = false;
      if (navigator.storage && navigator.storage.persist) {
        try { persistent = await navigator.storage.persist(); } catch (_) {}
      }
      localStorage.setItem(READY_KEY, '1');
      if (result) {
        result.textContent = `${summary.fileCount} archivi locali preparati nella cartella “${summary.folderName}”${cachedFiles ? ` e ${cachedFiles} file dell’app salvati per l’uso offline` : ''}.${persistent ? ' Archiviazione persistente attiva.' : ''}`;
        result.classList.remove('hidden');
      }
      if (button) button.classList.add('hidden');
      closeButton?.classList.remove('hidden');
      if (typeof showToast === 'function') showToast('Cartella locale “Thalys App” pronta ✓', 'fa-database');
    } catch (error) {
      console.error('Offline storage setup', error);
      if (progressFile) progressFile.textContent = `Errore: ${error?.message || 'preparazione non riuscita'}`;
      if (typeof showToast === 'function') showToast('Impossibile preparare “Thalys App”', 'fa-triangle-exclamation');
      if (button) {
        button.disabled = false;
        button.textContent = 'Riprova';
      }
    }
  }

  function closeOfflineSetupModal() {
    document.getElementById('offline-setup-modal')?.classList.add('hidden');
    if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
  }

  async function maybeShowOfflineSetup() {
    // v0.20: preparation is optional and must never block app startup.
    // The IndexedDB mirror is maintained automatically by saveStateToLocal.
    return offlineStorageAlreadyExists();
  }

  window.syncThalysLocalDocuments = state => syncLocalDocuments(state).catch(error => console.warn('Offline mirror', error));
  window.prepareOfflineStorage = prepareOfflineStorage;
  window.closeOfflineSetupModal = closeOfflineSetupModal;
  window.maybeShowOfflineSetup = maybeShowOfflineSetup;
  window.hydrateThalysLocalMedia = hydrateLocalMedia;
  restoreLocalStateIfNeeded().finally(() => localStorage.removeItem('thalys_local_restore_running'));
  window.addEventListener('DOMContentLoaded', () => hydrateLocalMedia().catch(error => console.warn('Ripristino media offline', error)), { once: true });
})();
