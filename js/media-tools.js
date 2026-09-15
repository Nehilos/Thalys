
// Photo upload to Drive and index maintenance
async function handlePhotoUpload(event) {
  const file=event.target.files?.[0]; if(!file)return;
  if(!file.type.startsWith('image/')){showToast('Seleziona un’immagine valida');return;}
  try{
    const reader=new FileReader(); reader.onload=async function(evt){
      const base64=evt.target.result;
      appState.photos=Array.isArray(appState.photos)?appState.photos:[];
      const photo={id:'photo_'+Date.now(),date:document.getElementById('body-date')?.value||new Date().toISOString().split('T')[0],base64,updatedAt:new Date().toISOString()};
      appState.photos.unshift(photo);
      saveStateToLocal(); renderPhotos(); showToast(getAccessToken()?'Foto salvata localmente · invio a Drive…':'Foto salvata localmente ✓','fa-circle-check');
      if(getAccessToken()){
        try{
          await initializeDriveWorkspace();
          const folder=driveFolders?.photoFolderId || (await ensureFolderAfterConsent('foto',driveFolders.appFolderId,'La cartella foto non esiste. Vuoi crearla in Thalys App?'))?.id;
          if(folder){driveFolders.photoFolderId=folder;const name=`photo_${new Date().toISOString().replace(/[:.]/g,'')}_${file.name}`;const uploaded=await uploadDriveFile(name,file,file.type||'image/jpeg',folder,true);photo.driveFileId=uploaded.id;photo.driveName=name;photo.updatedAt=new Date().toISOString();saveStateToLocal();showToast('Foto salvata anche su Drive ✓','fa-cloud-arrow-up');}
        }catch(err){console.warn('Drive photo copy failed',err);showSyncError(classifyDriveError(err));}
      }
      event.target.value='';
    }; reader.readAsDataURL(file);
  }catch(err){console.error(err);showToast('Impossibile caricare la foto');}
}

async function legacySavePhotoIndexToDrive() {
  const { savesFolderId } = await getGymBroSaveFolders();
  await uploadOrUpdateFile('foto_index.json', new Blob([localStorage.getItem('photo_index')||'{}'], { type: 'application/json' }), 'application/json', savesFolderId);
}

function legacyRenderPhotoGallery(filterOpts) {
  const gallery = document.getElementById('photo-gallery');
  gallery.innerHTML = '';
  const photoIndex = JSON.parse(localStorage.getItem('photo_index') || '{}');
  const items = Object.values(photoIndex || {}).sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  items.forEach(item=>{
    const div = document.createElement('div');
    div.className = 'bg-slate-900/60 p-2 rounded-lg';
    const img = document.createElement('img');
    img.src = getDriveMediaUrl(item.id); // Legacy renderer; endpoint ownership stays in drive.js.
    img.alt = item.name;
    img.style.width = '100%';
    const btnRow = document.createElement('div');
    btnRow.className = 'flex justify-between mt-2';
    const openBtn = document.createElement('button'); openBtn.className='px-2 py-1 bg-cyan-600 text-black rounded text-xs'; openBtn.innerText='Apri'; openBtn.onclick = ()=> window.open(`https://drive.google.com/uc?export=view&id=${item.id}`,'_blank');
    const delBtn = document.createElement('button'); delBtn.className='px-2 py-1 bg-red-600 text-white rounded text-xs'; delBtn.innerText='Elimina'; delBtn.onclick = ()=> confirmAndTrashPhoto(item.id, item.name);
    btnRow.appendChild(openBtn); btnRow.appendChild(delBtn);
    div.appendChild(img); div.appendChild(btnRow);
    gallery.appendChild(div);
  });
}

function confirmAndTrashPhoto(fileId, name) {
  if (!confirm(`Eliminare la foto ${name}? Verrà spostata nel cestino.`)) return;
  moveFileToTrash(fileId).then(()=>{
    const idx = JSON.parse(localStorage.getItem('photo_index')||'{}'); delete idx[fileId]; localStorage.setItem('photo_index', JSON.stringify(idx)); savePhotoIndexToDrive(); renderPhotoGallery(); showToast('Foto spostata nel cestino');
  }).catch(err=>{ console.error(err); showToast('Errore eliminazione'); });
}

// --- Food barcode scanning with Open Food Facts API ---
let barcodeCameraReader = null;
let barcodeCameraStream = null;
let barcodeScanActive = false;
let barcodeScanLoopTimer = null;
let barcodeFlashEnabled = false;
let barcodeDecodeInFlight = false;
let barcodeCameraControls = null;

function normalizeBarcodeValue(value) {
  if (!value) return '';
  const cleaned = String(value)
    .replace(/\s+/g, '')
    .replace(/[^0-9]/g, '');
  return cleaned;
}

function showBarcodeReadFeedback(code = '') {
  const status = document.getElementById('barcode-scan-status');
  const wrap = document.getElementById('barcode-camera-wrap');
  if (status) {
    status.textContent = code ? `Codice letto: ${code}` : 'Codice letto';
    status.classList.remove('hidden');
  }
  if (wrap) {
    wrap.classList.remove('border-slate-700');
    wrap.classList.add('border-emerald-400', 'ring-2', 'ring-emerald-400/80', 'shadow-[0_0_22px_rgba(16,185,129,0.35)]');
  }
  setTimeout(() => {
    if (status) {
      status.textContent = 'Codice letto';
      status.classList.add('hidden');
    }
    if (wrap) {
      wrap.classList.remove('border-emerald-400', 'ring-2', 'ring-emerald-400/80', 'shadow-[0_0_22px_rgba(16,185,129,0.35)]');
      wrap.classList.add('border-slate-700');
    }
  }, 1500);
}

async function toggleBarcodeFlash() {
  const flashBtn = document.getElementById('flash-camera-btn');
  if (!barcodeCameraStream) {
    showToast('Apri prima la fotocamera');
    return;
  }

  const track = barcodeCameraStream.getVideoTracks && barcodeCameraStream.getVideoTracks()[0];
  if (!track || !track.getCapabilities) {
    showToast('Flash non supportato su questo dispositivo');
    return;
  }

  const capabilities = track.getCapabilities();
  if (!capabilities || !('torch' in capabilities)) {
    showToast('Flash non supportato su questo dispositivo');
    return;
  }

  barcodeFlashEnabled = !barcodeFlashEnabled;
  try {
    await track.applyConstraints({
      advanced: [{ torch: barcodeFlashEnabled }]
    });
    if (flashBtn) {
      flashBtn.classList.toggle('bg-amber-500', barcodeFlashEnabled);
      flashBtn.classList.toggle('text-slate-950', barcodeFlashEnabled);
      flashBtn.classList.toggle('bg-slate-800', !barcodeFlashEnabled);
      flashBtn.classList.toggle('text-slate-200', !barcodeFlashEnabled);
      flashBtn.innerHTML = barcodeFlashEnabled
        ? '<i class="fa-solid fa-bolt mr-1"></i> Flash on'
        : '<i class="fa-solid fa-bolt mr-1"></i> Flash';
    }
  } catch (err) {
    console.warn('Torch not available', err);
    showToast('Flash non disponibile');
  }
}

function handleBarcodeScanResult(text) {
  const normalized = normalizeBarcodeValue(text);
  if (normalized && normalized.length >= 8) {
    const input = document.getElementById('barcode-input');
    if (input) input.value = normalized;
    showBarcodeReadFeedback(normalized);
    showToast(`Codice letto: ${normalized}`, 'fa-check-circle');

    if (barcodeCameraControls && typeof barcodeCameraControls.stop === 'function') {
      try { barcodeCameraControls.stop(); } catch (err) { console.warn('Could not stop barcode controls', err); }
    }

    setTimeout(() => {
      stopBarcodeCamera();
      submitBarcodeLookup();
    }, 700);
    return;
  }

  if (text) {
    console.warn('Scansione camera non valida per barcode prodotto:', text);
    const wrap = document.getElementById('barcode-camera-wrap');
    if (wrap) {
      wrap.classList.remove('border-slate-700');
      wrap.classList.add('border-red-400', 'ring-2', 'ring-red-400/80');
      setTimeout(() => {
        wrap.classList.remove('border-red-400', 'ring-2', 'ring-red-400/80');
        wrap.classList.add('border-slate-700');
      }, 600);
    }
  }
}

function startBarcodeReaderLoop() {
  const video = document.getElementById('barcode-video');
  if (!video || !barcodeCameraStream || !barcodeScanActive) return;

  if (barcodeCameraControls && typeof barcodeCameraControls.stop === 'function') {
    try { barcodeCameraControls.stop(); } catch (err) {}
  }

  barcodeCameraControls = null;

  const decodeCallback = (result, error, controls) => {
    if (!barcodeScanActive) {
      if (controls && typeof controls.stop === 'function') {
        try { controls.stop(); } catch (err) {}
      }
      return;
    }

    if (result) {
      const text = result.getText ? result.getText() : '';
      barcodeCameraControls = controls || null;
      handleBarcodeScanResult(text);
      return;
    }

    if (error && error.name && error.name !== 'NotFoundException') {
      console.warn('Barcode decode warning:', error);
    }
  };

  try {
    if (barcodeCameraReader && typeof barcodeCameraReader.decodeFromStream === 'function') {
      barcodeCameraReader.decodeFromStream(barcodeCameraStream, video, decodeCallback);
      return;
    }

    if (barcodeCameraReader && typeof barcodeCameraReader.decodeFromVideoElement === 'function') {
      barcodeCameraReader.decodeFromVideoElement(video, decodeCallback);
      return;
    }

    const fallbackReader = new ZXing.BrowserMultiFormatReader();
    barcodeCameraReader = fallbackReader;
    fallbackReader.decodeFromStream(barcodeCameraStream, video, decodeCallback);
  } catch (err) {
    console.warn('Barcode decode loop setup failed, retrying with video fallback', err);
    try {
      if (barcodeCameraReader && typeof barcodeCameraReader.decodeFromVideoElement === 'function') {
        barcodeCameraReader.decodeFromVideoElement(video, decodeCallback);
      }
    } catch (fallbackErr) {
      console.warn('Barcode decode fallback also failed', fallbackErr);
    }
  }
}

async function startBarcodeCamera() {
  const video = document.getElementById('barcode-video');
  const emptyState = document.getElementById('barcode-camera-empty');
  const startBtn = document.getElementById('start-camera-btn');
  const stopBtn = document.getElementById('stop-camera-btn');

  if (barcodeScanActive && barcodeCameraStream) {
    return;
  }

  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('Per usare la fotocamera serve HTTPS o localhost. Apri l’app da un sito sicuro.');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Camera non disponibile sul tuo dispositivo');
    return;
  }

  if (!window.ZXing) {
    showToast('Scanner barcode non pronto, usa il codice manuale');
    return;
  }

  try {
    barcodeScanActive = true;
    barcodeFlashEnabled = false;
    barcodeScanLoopTimer = null;
    barcodeDecodeInFlight = false;
    barcodeCameraControls = null;

    barcodeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (video) {
      video.srcObject = barcodeCameraStream;
      video.classList.remove('hidden');
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => {});
    }
    if (emptyState) emptyState.classList.add('hidden');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');

    if (!barcodeCameraReader) {
      barcodeCameraReader = new ZXing.BrowserMultiFormatReader();
    }

    if (barcodeCameraReader && typeof barcodeCameraReader.reset === 'function') {
      try { barcodeCameraReader.reset(); } catch (err) {}
    }

    const flashBtn = document.getElementById('flash-camera-btn');
    if (flashBtn) {
      flashBtn.classList.remove('hidden');
      flashBtn.classList.remove('bg-amber-500', 'text-slate-950');
      flashBtn.classList.add('bg-slate-800', 'text-slate-200');
      flashBtn.innerHTML = '<i class="fa-solid fa-bolt mr-1"></i> Flash';
    }

    setTimeout(() => {
      if (barcodeScanActive) startBarcodeReaderLoop();
    }, 350);
  } catch (err) {
    console.error('Unable to access camera:', err);
    showToast('Impossibile usare la fotocamera. Inserisci il codice manualmente');
    barcodeScanActive = false;
  }
}

function stopBarcodeCamera() {
  const video = document.getElementById('barcode-video');
  const emptyState = document.getElementById('barcode-camera-empty');
  const startBtn = document.getElementById('start-camera-btn');
  const stopBtn = document.getElementById('stop-camera-btn');
  const flashBtn = document.getElementById('flash-camera-btn');

  barcodeScanActive = false;
  barcodeDecodeInFlight = false;
  if (barcodeCameraControls && typeof barcodeCameraControls.stop === 'function') {
    try { barcodeCameraControls.stop(); } catch (err) {}
  }
  barcodeCameraControls = null;

  if (barcodeScanLoopTimer) {
    clearTimeout(barcodeScanLoopTimer);
    barcodeScanLoopTimer = null;
  }

  if (barcodeCameraStream) {
    const track = barcodeCameraStream.getVideoTracks && barcodeCameraStream.getVideoTracks()[0];
    if (track && track.getCapabilities && 'torch' in track.getCapabilities()) {
      try {
        track.applyConstraints({ advanced: [{ torch: false }] });
      } catch (err) {}
    }
    barcodeCameraStream.getTracks().forEach(track => track.stop());
    barcodeCameraStream = null;
  }

  barcodeFlashEnabled = false;

  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  if (emptyState) emptyState.classList.remove('hidden');
  if (startBtn) startBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');
  if (flashBtn) {
    flashBtn.classList.remove('bg-amber-500', 'text-slate-950');
    flashBtn.classList.add('bg-slate-800', 'text-slate-200');
    flashBtn.innerHTML = '<i class="fa-solid fa-bolt mr-1"></i> Flash';
  }

  if (barcodeCameraReader) {
    try {
      barcodeCameraReader.reset();
    } catch (err) {
      console.warn('Barcode reader reset warning', err);
    }
  }
}

function openScanProductModal() {
  const modal = document.getElementById('scan-product-modal');
  const input = document.getElementById('barcode-input');
  if (modal) modal.classList.remove('hidden');
  updateModalScrollLock();
  if (input) {
    setTimeout(() => input.focus(), 80);
  }
  stopBarcodeCamera();
}

function closeScanProductModal() {
  const modal = document.getElementById('scan-product-modal');
  if (modal) modal.classList.add('hidden');
  updateModalScrollLock();
  stopBarcodeCamera();
}

async function fetchOpenFoodFactsProduct(barcode) {
  const cleanCode = normalizeBarcodeValue(barcode);
  if (!cleanCode || cleanCode.length < 8) {
    return null;
  }

  const endpoints = [
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`,
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(cleanCode)}&search_simple=1&action=process&json=1`
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) continue;

      const data = await res.json();

      if (data && data.status === 1 && data.product) {
        return data.product;
      }

      if (data && data.products && data.products.length) {
        return data.products[0];
      }
    } catch (err) {
      console.warn('Open Food Facts fetch failed for', cleanCode, err);
    }
  }

  return null;
}

async function submitBarcodeLookup() {
  const input = document.getElementById('barcode-input');
  const barcode = normalizeBarcodeValue(input ? input.value : '');
  if (!barcode || barcode.length < 8) {
    showToast('Inserisci un codice a barre valido');
    return;
  }

  if (input) input.value = barcode;

  closeScanProductModal();
  showToast('Ricerca nutrizione in corso...');

  try {
    const product = await fetchOpenFoodFactsProduct(barcode);
    if (!product) {
      showToast('Prodotto non trovato. Controlla il codice a barre');
      return;
    }

    const productName = product.product_name || product.generic_name || product.abbreviated_product_name || `Prodotto ${barcode}`;
    const payload = {
      labels: [{ description: productName }],
      texts: [],
      product: product,
      nutriments: product.nutriments || {}
    };

    openNutritionProposalModal(payload);
  } catch (err) {
    console.error('Open Food Facts barcode lookup failed:', err);
    showToast('Errore nella ricerca del prodotto');
  }
}

async function scanFoodByBarcode() {
  openScanProductModal();
}

function openNutritionProposalModal(data, dataUrl) {
  const sourceEl = document.getElementById('recognize-source');
  const modal = document.getElementById('nutrition-proposal-modal');
  const nameInput = document.getElementById('prop-name');
  const kcalInput = document.getElementById('prop-kcal');
  const pInput = document.getElementById('prop-p');
  const cInput = document.getElementById('prop-c');
  const fInput = document.getElementById('prop-f');
  const satFatInput = document.getElementById('prop-sat-fat');
  const sugarsInput = document.getElementById('prop-sugars');
  const calciumInput = document.getElementById('prop-calcium');
  const magnesiumInput = document.getElementById('prop-magnesium');
  const zincInput = document.getElementById('prop-zinc');
  const fiberInput = document.getElementById('prop-fiber');
  const saltInput=document.getElementById('prop-salt'),ironInput=document.getElementById('prop-iron'),potassiumInput=document.getElementById('prop-potassium'),vitIdInput=document.getElementById('prop-vitamins-id'),vitLipInput=document.getElementById('prop-vitamins-lip');

  if (!sourceEl || !modal || !nameInput || !kcalInput || !pInput || !cInput || !fInput || !satFatInput || !sugarsInput || !calciumInput || !magnesiumInput || !zincInput || !fiberInput || !saltInput || !ironInput || !potassiumInput || !vitIdInput || !vitLipInput) {
    showToast('Modulo proposta nutrizione non disponibile');
    return;
  }

  sourceEl.innerHTML = '';

  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'w-24 h-24 object-contain rounded mb-2';
    sourceEl.appendChild(img);
  }

  const product = data && data.product ? data.product : null;
  const nutriments = product && product.nutriments ? product.nutriments : (data && data.nutriments ? data.nutriments : {});
  const productName = product && (product.product_name || product.generic_name) ? (product.product_name || product.generic_name) : (data && data.labels && data.labels[0] ? data.labels[0].description : 'Alimento');
  const labels = (data && data.labels ? data.labels : []).map(l => l.description).slice(0, 3).join(', ');

  if (labels) {
    sourceEl.append('Prodotto: ' + labels);
  } else if (productName) {
    sourceEl.append('Prodotto: ' + productName);
  }

  const kcalValue = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? nutriments['energy_100g'] ?? 0);
  const pValue = Number(nutriments['proteins_100g'] ?? nutriments['proteins'] ?? 0);
  const cValue = Number(nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates'] ?? 0);
  const fValue = Number(nutriments['fat_100g'] ?? nutriments['fat'] ?? 0);
  const satFatValue = Number(nutriments['saturated-fat_100g'] ?? nutriments['saturated-fat'] ?? nutriments['saturated_fat_100g'] ?? 0);
  const sugarsValue = Number(nutriments['sugars_100g'] ?? nutriments['sugars'] ?? nutriments['added-sugars_100g'] ?? 0);
  const mineralMg=(key)=>{const raw=Number(nutriments[`${key}_100g`] ?? nutriments[key] ?? 0);const unit=String(nutriments[`${key}_unit`] ?? nutriments[`${key}_100g_unit`] ?? 'g').toLowerCase();if(!raw)return 0;if(unit==='mg')return raw;if(unit==='µg'||unit==='ug')return raw/1000;return raw*1000;};
  const calciumValue = mineralMg('calcium');
  const magnesiumValue = mineralMg('magnesium');
  const zincValue = mineralMg('zinc');
  const fiberValue = Number(nutriments['fiber_100g'] ?? nutriments['fibre_100g'] ?? nutriments['fiber'] ?? nutriments['fibre'] ?? 0);
  const saltValue=Number(nutriments['salt_100g'] ?? nutriments['salt'] ?? 0);
  const ironValue=mineralMg('iron');
  const potassiumValue=mineralMg('potassium');
  const vitaminValue=(...keys)=>keys.some(k=>Number(nutriments[k]??0)>0);
  const vitIdValue=[vitaminValue('vitamin-b1_100g','thiamine_100g')&&'B1',vitaminValue('vitamin-b2_100g','riboflavin_100g')&&'B2',vitaminValue('vitamin-pp_100g','vitamin-b3_100g','niacin_100g')&&'B3',vitaminValue('vitamin-b5_100g','pantothenic-acid_100g')&&'B5',vitaminValue('vitamin-b6_100g')&&'B6',vitaminValue('biotin_100g','vitamin-b7_100g')&&'B7',vitaminValue('vitamin-b9_100g','folates_100g','folic-acid_100g')&&'B9',vitaminValue('vitamin-b12_100g')&&'B12',vitaminValue('vitamin-c_100g')&&'C'].filter(Boolean).join(' ');
  const vitLipValue=[vitaminValue('vitamin-a_100g')&&'A',vitaminValue('vitamin-d_100g')&&'D',vitaminValue('vitamin-e_100g')&&'E',vitaminValue('vitamin-k_100g')&&'K'].filter(Boolean).join(' ');

  nameInput.value = productName || '';
  kcalInput.value = kcalValue ? Math.round(kcalValue) : '';
  pInput.value = pValue ? Math.round(pValue) : '';
  cInput.value = cValue ? Math.round(cValue) : '';
  fInput.value = fValue ? Number(fValue.toFixed(1)) : '';
  satFatInput.value = satFatValue ? Number(satFatValue.toFixed(1)) : 0;
  sugarsInput.value = sugarsValue ? Number(sugarsValue.toFixed(1)) : '';
  calciumInput.value = calciumValue ? Math.round(calciumValue) : '';
  magnesiumInput.value = magnesiumValue ? Math.round(magnesiumValue) : '';
  zincInput.value = zincValue ? Number(zincValue.toFixed(2)) : '';
  fiberInput.value = fiberValue ? Number(fiberValue.toFixed(1)) : 0;
  saltInput.value=saltValue?Number(saltValue.toFixed(2)):0; ironInput.value=ironValue?Number(ironValue.toFixed(2)):0; potassiumInput.value=potassiumValue?Math.round(potassiumValue):0; vitIdInput.value=vitIdValue; vitLipInput.value=vitLipValue;

  openModal('nutrition-proposal-modal');
}

function saveRecognizedNutrition(e) {
  e.preventDefault();
  const name = document.getElementById('prop-name').value.trim();
  const kcal = parseInt(document.getElementById('prop-kcal').value) || 0;
  const p = parseInt(document.getElementById('prop-p').value) || 0;
  const c = parseInt(document.getElementById('prop-c').value) || 0;
  const f = parseFloat(document.getElementById('prop-f').value) || 0;
  const satFat = parseFloat(document.getElementById('prop-sat-fat').value) || 0;
  const sugars = parseFloat(document.getElementById('prop-sugars').value) || 0;
  const calcium = parseFloat(document.getElementById('prop-calcium').value) || 0;
  const magnesium = parseFloat(document.getElementById('prop-magnesium').value) || 0;
  const zinc = parseFloat(document.getElementById('prop-zinc').value) || 0;
  const fiber = parseFloat(document.getElementById('prop-fiber').value) || 0;
  const salt=parseFloat(document.getElementById('prop-salt').value)||0, iron=parseFloat(document.getElementById('prop-iron').value)||0, potassium=parseFloat(document.getElementById('prop-potassium').value)||0;
  const vitaminsId=normalizeVitaminCodes(document.getElementById('prop-vitamins-id').value,'id'), vitaminsLip=normalizeVitaminCodes(document.getElementById('prop-vitamins-lip').value,'lip');

  if (!name) {
    showToast('Inserisci un nome prodotto valido');
    return;
  }

  const existing = appState.presets.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.p = p;
    existing.c = c;
    existing.f = f;
    existing.satFat = satFat;
    existing.kcal = kcal;
    existing.sugars = sugars;
    existing.calcium = calcium;
    existing.magnesium = magnesium;
    existing.zinc = zinc;
    existing.fiber = fiber; existing.salt=salt; existing.iron=iron; existing.potassium=potassium; existing.vitaminsId=vitaminsId; existing.vitaminsLip=vitaminsLip; existing.updatedAt=new Date().toISOString();
  } else {
    { const now=new Date().toISOString(); appState.presets.unshift({ name, p, c, f, satFat, sugars, calcium, magnesium, zinc, fiber, salt, iron, potassium, vitaminsId, vitaminsLip, kcal, ts:now, createdAt:now, updatedAt:now }); }
  }

  persistFoodDatabase();
  renderPresets();
  renderNutrition();
  renderHomeDashboard();
  scheduleAutosave();
  const modal = document.getElementById('nutrition-proposal-modal');
  if (modal) modal.classList.add('hidden');
  updateModalScrollLock();
  e.target?.reset?.();
  setTimeout(() => showToast('Alimento salvato ✓','fa-circle-check'), 60);
}


// Drive trash/delete operations are centralized in js/drive.js (v0.25).

// Lightweight autosave: meaningful app changes call saveStateToLocal(); input events are not uploaded per keystroke.
