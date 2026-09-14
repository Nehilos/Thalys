// Thalys v0.28.4 - Body module
// Owns profile/body metrics, BMI/BMR, avatar, measurement history and progress photos.

    // ----------------------------------------------------
    // BODY METRICS & PHOTOS LOGIC
    // ----------------------------------------------------

    function renderProfilePhotoUI(){
      const data=appState?.profilePhoto?.dataUrl||'';
      document.querySelectorAll('.profile-photo-img').forEach(img=>{
        if(data){img.src=data;img.classList.remove('hidden');}
        else{img.removeAttribute('src');img.classList.add('hidden');}
      });
      document.querySelectorAll('.profile-photo-fallback').forEach(el=>el.classList.toggle('hidden',!!data));
    }


    // v0.37.2: app-core starts with the compact localStorage mirror, where the heavy
    // custom photo is intentionally omitted. Re-render as soon as IndexedDB restores
    // the full state so offline startup never stays on an empty profile image.
    window.addEventListener('thalys:primary-state-ready',()=>{
      try{renderProfilePhotoUI();loadProfileUI();}catch(_){try{renderProfilePhotoUI();}catch(__){}}
    });

    function openProfilePhotoMenu(){
      openModal('profile-photo-modal');
      renderProfilePhotoUI();
    }

    function openProfilePhotoSettings(){
      openProfilePhotoMenu();
    }

    function resizeProfilePhoto(file){
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(new Error('Impossibile leggere la foto'));
        reader.onload=()=>{
          const img=new Image();
          img.onerror=()=>reject(new Error('Formato immagine non supportato'));
          img.onload=()=>{
            const size=320,canvas=document.createElement('canvas');
            canvas.width=size;canvas.height=size;
            const ctx=canvas.getContext('2d');
            const side=Math.min(img.naturalWidth,img.naturalHeight);
            const sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
            ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
            resolve(canvas.toDataURL('image/jpeg',.84));
          };
          img.src=reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async function handleProfilePhotoChange(event){
      const file=event?.target?.files?.[0];
      if(!file)return;
      if(!file.type.startsWith('image/')){showToast('Seleziona un file immagine','fa-triangle-exclamation');event.target.value='';return;}
      try{
        const dataUrl=await resizeProfilePhoto(file);
        appState.profilePhoto={dataUrl,updatedAt:new Date().toISOString()};
        saveStateToLocal();renderProfilePhotoUI();
        showToast('Foto profilo salvata · sincronizzazione avviata','fa-user-check');
      }catch(e){
        console.warn('Profile photo',e);
        showToast('Non riesco a elaborare questa foto','fa-triangle-exclamation');
      }finally{event.target.value='';}
    }

    function removeProfilePhoto(){
      appState.profilePhoto={dataUrl:'',updatedAt:new Date().toISOString()};
      saveStateToLocal();renderProfilePhotoUI();
      showToast('Foto profilo rimossa','fa-user');
    }

        function saveProfile(e) {
      e.preventDefault();
      appState.profile = {
        ...(appState.profile || {}),
        preferredName: String(document.getElementById('prof-input-preferred-name')?.value || '').trim().slice(0,40),
        gender: normalizeProfileGenderValue(document.getElementById('prof-input-gender').value),
        age: parseInt(document.getElementById('prof-input-age').value) || 25,
        height: parseInt(document.getElementById('prof-input-height').value) || 175,
        sleepHours: appState.profile?.sleepHours || 7,
        lifestyle: document.getElementById('prof-input-lifestyle').value || 'moderato', updatedAt:new Date().toISOString()
      };
      appState.profileConfigured=true;
      saveStateToLocal();
      loadProfileUI();
      renderBodyMetrics();
      aggiornaAvatarDaUltimaMisura();
      renderNutrition();
      renderHomeDashboard();
      updateAnalyticsCharts();
      if(typeof updateAuthUI==='function')updateAuthUI(typeof savedGoogleProfile==='function'?savedGoogleProfile():null);
      closeModal('profile-modal');
      showToast('Dati anagrafici salvati ✓','fa-circle-check');
    }

    function loadProfileUI() {
      const p = appState.profile;
      p.gender=normalizeProfileGenderValue(p.gender);
      document.getElementById('prof-gender').textContent = tr(p.gender === 'female' ? 'Donna' : 'Uomo');
      document.getElementById('prof-age').textContent = `${p.age} anni`;
      document.getElementById('prof-height').textContent = `${p.height} cm`;
      const profSleepEl = document.getElementById('prof-sleep');
      if (profSleepEl) profSleepEl.textContent = `${p.sleepHours || 7} h`;
      const profLifestyleEl = document.getElementById('prof-lifestyle');
      if (profLifestyleEl) profLifestyleEl.textContent = p.lifestyle || 'moderato';

      const preferredNameInput=document.getElementById('prof-input-preferred-name');
      if(preferredNameInput)preferredNameInput.value=p.preferredName||'';
      document.getElementById('prof-input-gender').value = p.gender;
      document.getElementById('prof-input-age').value = p.age;
      document.getElementById('prof-input-height').value = p.height;
      const profSleepInput=document.getElementById('prof-input-sleep'); if(profSleepInput)profSleepInput.value=p.sleepHours||7;
      document.getElementById('prof-input-lifestyle').value = p.lifestyle || 'moderato';
      renderProfilePhotoUI();
      aggiornaAvatarDaUltimaMisura();
      renderHomeAvatar();
    }

    function openMeasurementGuide(){
      const el=document.getElementById('measurement-info-content');
      if(el)el.innerHTML=`
        <div class="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3"><b class="text-cyan-300">Prima di iniziare</b><p class="mt-1">Usa un metro morbido, misura sempre nelle stesse condizioni, senza tirare il metro e senza gonfiare o trattenere il respiro. Per confrontare i risultati conta soprattutto la coerenza.</p></div>
        <div class="grid gap-2">
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Collo</b><p>Appena sotto la base del collo, metro orizzontale e pelle non compressa.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Spalle</b><p>Circonferenza intorno al punto più ampio delle spalle, braccia rilassate.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Petto</b><p>Metro orizzontale nel punto più ampio del torace, respirazione normale.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Vita</b><p>Scegli un punto ripetibile: spesso a metà tra ultima costa e cresta iliaca oppure nel punto più stretto. Usa sempre lo stesso metodo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Fianchi</b><p>Nel punto di massima circonferenza di glutei e fianchi, piedi vicini.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Bicipite</b><p>Misura il punto più largo del braccio. Scegli rilassato o contratto e mantieni sempre lo stesso metodo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Avambraccio</b><p>Nel punto più largo dell'avambraccio, braccio rilassato.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Coscia</b><p>Nel punto più largo oppure a una distanza fissa dall'inguine; segna mentalmente il punto per ripeterlo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Polpaccio</b><p>Nel punto più largo del polpaccio, in piedi e senza contrarre volontariamente.</p></div>
        </div>`;
      openModal('measurement-info-modal');
    }

    function showMeasurementInfo(type){
      const info={
        neck:['Collo','Misura appena sotto la base del collo, con il metro orizzontale e senza comprimere.'],
        shoulders:['Spalle','Per una misura ripetibile usa la circonferenza passando intorno alle spalle nel punto più ampio, braccia rilassate.'],
        chest:['Petto','Metro orizzontale nel punto di massima circonferenza del torace, respirando normalmente, senza gonfiare il petto.'],
        waist:['Vita','Misura la circonferenza del tronco nel punto indicato sempre nello stesso modo; per il trend estetico puoi usare il punto più stretto, ma sii coerente.'],
        hips:['Fianchi','Metro nel punto di massima circonferenza di glutei/fianchi, piedi vicini e postura naturale.'],
        biceps:['Bicipite','Braccio rilassato oppure contratto, ma scegli un metodo e usalo sempre nello stesso modo; misura la parte più larga.'],
        forearm:['Avambraccio','Misura la parte più larga dell’avambraccio, braccio rilassato.'],
        thigh:['Coscia','Misura la parte più larga della coscia, a metà tra anca e ginocchio oppure in un punto fisso che segni mentalmente.'],
        calf:['Polpaccio','Misura la parte più larga del polpaccio, in piedi e senza contrarre volontariamente.']
      };
      const x=info[type]||['Misura','Usa sempre lo stesso punto e non stringere il metro.']; const el=document.getElementById('measurement-info-content'); if(el)el.innerHTML=`<div class="text-lg font-black text-white mb-2">${x[0]}</div><p>${x[1]}</p>`; openModal('measurement-info-modal');
    }

    function bodyBalanceAdvice(log){
      if(!log)return [];
      const a=[]; const h=Number(appState.profile?.height||0); const waist=Number(log.waist||0), chest=Number(log.chest||0), hips=Number(log.hips||0);
      if(waist && h && waist/h>=.55)a.push('Vita relativamente alta rispetto all’altezza: se l’obiettivo è ridurre il grasso addominale, lavora su alimentazione complessiva, attività aerobica e forza; gli addominali rafforzano il core ma non riducono localmente il grasso.');
      if(chest&&waist&&chest<waist*1.05)a.push('Torace poco superiore alla vita: per un aspetto più atletico puoi dare priorità a dorso, petto e spalle con progressione di forza, mantenendo il controllo del peso se necessario.');
      if(hips&&waist&&hips<waist)a.push('Controlla che le misure siano state prese nello stesso punto: un rapporto anomalo può dipendere dalla tecnica di misura. Non usare una singola misura per giudicare il corpo.');
      if(!a.length)a.push('Le misure disponibili non mostrano un disequilibrio evidente con questa semplice analisi. Guarda il trend ogni 2–4 settimane, insieme a forza, peso e foto.');
      return a;
    }


    function openBodyIndexInfo(type){
      const title=document.getElementById('body-index-info-title');
      const content=document.getElementById('body-index-info-content');
      if(!title||!content)return;
      if(type==='bmi'){
        title.textContent='Come viene calcolato il BMI';
        content.innerHTML=`
          <div class="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3"><div class="font-black text-purple-200">BMI = peso (kg) ÷ altezza² (m)</div><div class="mt-1 text-slate-300">Esempio: 70 kg e 1,75 m → 70 ÷ (1,75 × 1,75) = 22,9.</div></div>
          <p>Il BMI è un indice di screening generale: non distingue massa muscolare, massa grassa e distribuzione del grasso. Per chi si allena molto va letto insieme a circonferenze, trend del peso, foto e composizione corporea.</p>
        `;
      }else{
        title.textContent='Come viene calcolato il BMR';
        content.innerHTML=`
          <div class="rounded-2xl border border-pink-500/20 bg-pink-500/10 p-3"><div class="font-black text-pink-200">Formula Mifflin–St Jeor</div><div class="mt-1">Uomo: 10×peso + 6,25×altezza − 5×età + 5<br>Donna: 10×peso + 6,25×altezza − 5×età − 161</div></div>
          <p>Il BMR stima l'energia che il corpo consuma a riposo per mantenere le funzioni vitali. Non è il fabbisogno calorico giornaliero totale: attività, lavoro, allenamento e digestione aumentano il consumo reale.</p>
        `;
      }
      openModal('body-index-info-modal');
    }



    // ===== AVATAR 2D DA ARTWORK SVG FORNITI =====
    let avatarShowMeasures=false;

    const AVATAR_REFERENCE={
      maschio:{altezza:178,collo:39,spalle:112,petto:102,bicipite:34,vita:84,fianchi:98,gamba:57,polpaccio:39},
      femmina:{altezza:165,collo:33,spalle:96,petto:90,bicipite:28,vita:72,fianchi:98,gamba:55,polpaccio:36}
    };

    function avatarClamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0))}
    function avatarScaleFrom(value,reference,min=.84,max=1.18){
      if(!Number(value)||!Number(reference))return 1;
      return avatarClamp(Number(value)/Number(reference),min,max);
    }
    function avatarLatestMeasurements(){
      const latest=[...(appState.bodyMetrics||[])].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||{};
      return {
        genere:(appState.profile?.gender==='female'?'femmina':'maschio'),
        altezza:Number(appState.profile?.height)||175,
        collo:Number(latest.neck)||38,
        spalle:Number(latest.shoulders)||110,
        petto:Number(latest.chest)||100,
        bicipite:Number(latest.biceps)||32,
        vita:Number(latest.waist)||85,
        fianchi:Number(latest.hips)||100,
        gamba:Number(latest.thigh)||55,
        polpaccio:Number(latest.calf)||38,
        data:latest.date||null
      };
    }
    function avatarCurrentActivity(){
      try{
        const d=homeSelectedDate||new Date().toISOString().split('T')[0];
        const g=getDayGamification(d);
        return g.total?Math.round(g.done/g.total*100):0;
      }catch(_){return 0}
    }
    function avatarSetArtwork(genere){
      const female=genere==='femmina';
      const artGroup=document.getElementById('avatar-artwork-whole');
      const symbol=document.getElementById(female?'avatar-female-art':'avatar-male-art');
      if(artGroup&&symbol){
        const wanted=female?'female':'male';
        if(artGroup.dataset.gender!==wanted || artGroup.childElementCount===0){
          artGroup.replaceChildren(...Array.from(symbol.children).map(node=>node.cloneNode(true)));
          artGroup.dataset.gender=wanted;
        }
        artGroup.setAttribute('transform',female
          ? 'translate(349 72) scale(.91) translate(-384 0)'
          : 'translate(-30 0)');
        artGroup.style.display='inline';
      }
      document.getElementById('avatar-gender-male')?.classList.toggle('active',!female);
      document.getElementById('avatar-gender-female')?.classList.toggle('active',female);
      const svg=document.getElementById('avatar-art-svg');
      if(svg)svg.dataset.gender=female?'female':'male';
    }

    function aggiornaAvatar(misure){
      const svg=document.getElementById('avatar-art-svg');
      if(!svg)return;

      // Single source of truth: profile.gender.
      const female=normalizeProfileGenderValue(appState.profile?.gender)==='female';
      const genere=female?'femmina':'maschio';
      const m={...avatarLatestMeasurements(),...(misure||{}),genere};

      avatarSetArtwork(genere);
      renderAvatarMeasures(m);
      renderAvatarMeasurementLabels(m);
    }

    function renderAvatarMeasures(m){
      const g=document.getElementById('avatar-measures-overlay');
      if(!g)return;

      const female=m.genere==='femmina';

      // Coordinates manually aligned to the actual supplied male/female illustrations.
      // [left edge, right edge, y, side for label]
      const P=female ? {
        headTop:89, feetBottom:1422, neck:[323,445,292,'right'],
        shoulders:[229,539,350,'right'],
        chest:[242,526,435,'right'],
        waist:[278,490,595,'right'],
        hips:[224,544,705,'right'],
        biceps:[153,221,500,'left'],
        thigh:[229,539,875,'left'],
        calf:[252,516,1200,'left']
      } : {
        headTop:78, feetBottom:1438, neck:[329,439,318,'right'],
        shoulders:[194,574,395,'right'],
        chest:[214,554,486,'right'],
        waist:[256,512,688,'right'],
        hips:[239,529,800,'right'],
        biceps:[137,218,528,'left'],
        thigh:[232,536,969,'left'],
        calf:[251,517,1250,'left']
      };

      // Apply the same visual correction used for the smaller female artwork.
      const tf=(x,y)=>{
        if(!female)return [x-30,y];
        const sx=.91, sy=.91, tx=349-384*sx, ty=72;
        return [tx+x*sx,ty+y*sy];
      };

      const rows=[
        [tr('Collo'),m.collo,P.neck],
        [tr('Spalle'),m.spalle,P.shoulders],
        [tr('Petto'),m.petto,P.chest],
        [tr('Vita'),m.vita,P.waist],
        [tr('Fianchi'),m.fianchi,P.hips],
        [tr('Bicipite'),m.bicipite,P.biceps],
        [tr('Coscia'),m.gamba,P.thigh],
        [tr('Polpaccio'),m.polpaccio,P.calf]
      ];

      let [hx,hy1]=tf(female?120:104,P.headTop);
      let [,hy2]=tf(female?120:104,P.feetBottom);
      const heightBoxX=Math.max(6,hx-6);
      let h=`<line x1="${hx}" y1="${hy1}" x2="${hx}" y2="${hy2}" class="avatar-art-measure-line" marker-start="url(#avatar-arrow)" marker-end="url(#avatar-arrow)"></line>
        <rect x="${heightBoxX}" y="${hy1+18}" width="118" height="62" rx="14" class="avatar-art-label-bg"></rect>
        <text x="${heightBoxX+59}" y="${hy1+42}" text-anchor="middle" class="avatar-art-label"><tspan x="${heightBoxX+59}" dy="0">${tr("Altezza")}</tspan><tspan x="${heightBoxX+59}" dy="24" font-size="24" font-weight="800">${Math.round(m.altezza)} cm</tspan></text>`;

      rows.forEach(([name,val,c])=>{
        let [x1,x2,y,side]=c;
        [x1,y]=tf(x1,y);
        [x2]=tf(x2,c[2]);
        const rx=side==='right'?618:8;
        const labelY=y-31;
        const boxW=136,boxH=62;
        h+=`<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" class="avatar-art-measure-line" marker-start="url(#avatar-arrow)" marker-end="url(#avatar-arrow)"></line>
          <rect x="${rx}" y="${labelY.toFixed(1)}" width="${boxW}" height="${boxH}" rx="14" class="avatar-art-label-bg"></rect>
          <text x="${rx+boxW/2}" y="${(labelY+22).toFixed(1)}" text-anchor="middle" class="avatar-art-label">
            <tspan x="${rx+boxW/2}" dy="0">${name}</tspan>
            <tspan x="${rx+boxW/2}" dy="25" font-size="24" font-weight="800">${Number(val||0).toFixed(1)} cm</tspan>
          </text>`;
      });

      g.innerHTML=h;
      g.classList.toggle('visible',avatarShowMeasures);
    }

    function renderAvatarMeasurementLabels(m){
      const el=document.getElementById('avatar-measurements');
      if(el){
        const values=[['Altezza',m.altezza],['Collo',m.collo],['Spalle',m.spalle],['Petto',m.petto],['Bicipite',m.bicipite],['Vita',m.vita],['Fianchi',m.fianchi],['Coscia',m.gamba],['Polpaccio',m.polpaccio]];
        el.innerHTML=values.map(([k,v])=>`<div class="avatar-measure-chip rounded-xl p-2"><div class="text-[9px] text-slate-500">${k}</div><div class="mt-0.5 text-[11px] font-black text-slate-200">${Number(v||0).toFixed(k==='Altezza'?0:1)} cm</div></div>`).join('');
      }
      const d=document.getElementById('avatar-last-date');
      if(d)d.textContent=m.data?new Date(m.data+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'short',year:'numeric'}):'Valori iniziali';
    }

    function aggiornaPensieroAvatar(percentualeAttivita){
      const p=avatarClamp(percentualeAttivita,0,100);
      let feeling='Mi sento giù 😔';
      let note='Oggi posso ancora iniziare';
      if(p>=100){feeling='Sono felicissimo! 🤩';note='Giornata completata al 100%';}
      else if(p>=70){feeling='Mi sento molto bene 😊';note='Ottimo ritmo, continua così';}
      else if(p>=40){feeling='Mi sento bene 🙂';note='Sto costruendo la giornata';}
      else if(p>0){feeling='Mi sento discreto 😐';note='Un passo alla volta';}

      const l1=document.getElementById('avatar-thought-line1');
      const l2=document.getElementById('avatar-thought-line2');
      const l3=document.getElementById('avatar-thought-line3');
      if(l1)l1.textContent=`Oggi ${Math.round(p)}%`;
      if(l2)l2.textContent=feeling;
      if(l3)l3.textContent=note;

      const copy=document.getElementById('avatar-mood-copy');
      if(copy)copy.innerHTML=`Oggi hai raggiunto <b class="text-white">${Math.round(p)}%</b> degli obiettivi giornalieri. La nuvoletta cambia automaticamente con i progressi della giornata selezionata.`;
    }

    function toggleAvatarMeasures(){
      avatarShowMeasures=!avatarShowMeasures;
      document.getElementById('avatar-measures-overlay')?.classList.toggle('visible',avatarShowMeasures);
      document.getElementById('avatar-measure-toggle')?.classList.toggle('active',avatarShowMeasures);
      appState.avatar={...(appState.avatar||{}),showMeasures:avatarShowMeasures};saveStateToLocal();
    }
    function setProfileGender(gender,{sync=true}={}){
      const value=normalizeProfileGenderValue(gender);
      appState.profile={...(appState.profile||{}),gender:value,updatedAt:new Date().toISOString()};

      const profileSelect=document.getElementById('prof-input-gender');
      if(profileSelect)profileSelect.value=value;

      // Ridisegno reale dei path SVG: immediato + doppio passaggio per Safari/iOS.
      const redrawGender=()=>{
        avatarSetArtwork(value==='female'?'femmina':'maschio');
        aggiornaAvatarDaUltimaMisura();
        renderHomeAvatar();
      };
      redrawGender();
      requestAnimationFrame(redrawGender);
      setTimeout(redrawGender,80);

      // Profile summary
      const profGender=document.getElementById('prof-gender');
      if(profGender)profGender.textContent=tr(value==='female'?'Donna':'Uomo');

      saveStateToLocal();
      if(sync)scheduleDriveSync(250);
    }
    function cambiaGenereAvatar(genere){
      setProfileGender(genere==='femmina'?'female':'male');
    }
    function aggiornaAvatarDaUltimaMisura(){
      avatarShowMeasures=!!appState.avatar?.showMeasures;
      document.getElementById('avatar-measure-toggle')?.classList.toggle('active',avatarShowMeasures);
      aggiornaAvatar(avatarLatestMeasurements());
    }
    function aggiornaAvatarDaControlli(){aggiornaAvatarDaUltimaMisura()}
    function initThalysAvatar(){aggiornaAvatarDaUltimaMisura()}
    function updateAvatarMood(){aggiornaPensieroAvatar(avatarCurrentActivity())}

        function saveBodyLog(e) {
      e.preventDefault();
      const date = document.getElementById('body-date').value;
      const weight = parseFloat(document.getElementById('body-weight').value) || 0;
      const bf = parseFloat(document.getElementById('body-fat').value) || null;
      const val = id => { const el=document.getElementById(id); const n=el?parseFloat(el.value):NaN; return Number.isFinite(n)?n:null; };
      const neck=val('body-neck'), shoulders=val('body-shoulders'), chest=val('body-chest'), waist=val('body-waist'), hips=val('body-hips'), biceps=val('body-biceps'), forearm=val('body-forearm'), thigh=val('body-thigh'), calf=val('body-calf');

      const newLog = { id: 'body_' + Date.now(), date, weight, bf, neck, shoulders, chest, waist, hips, biceps, forearm, thigh, calf, updatedAt:new Date().toISOString() };
      appState.bodyMetrics.push(newLog);
      // Sort logs chronologically
      appState.bodyMetrics.sort((a, b) => new Date(b.date) - new Date(a.date));

      saveStateToLocal();
      renderBodyMetrics();
      aggiornaAvatarDaUltimaMisura();
      renderNutrition();
      renderHomeDashboard();
      closeModal('add-body-modal');
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Misura salvata e sincronizzazione avviata ✓', 'fa-ruler-horizontal');
    }

    function deleteBodyLog(id) {
      appState.bodyMetrics = appState.bodyMetrics.filter(b => b.id !== id);
      saveStateToLocal();
      renderBodyMetrics();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Misurazione rimossa');
    }

    function renderBodyMetrics() {
      const container = document.getElementById('body-logs-container');
      container.innerHTML = '';

      if (appState.bodyMetrics.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-500 italic">Nessuna misurazione registrata.</div>`; const adviceEl=document.getElementById('body-balance-advice'); if(adviceEl) adviceEl.innerHTML='<div class="rounded-xl bg-slate-900/60 p-2">Inserisci una prima misurazione per ricevere indicazioni sul trend.</div>'; 
        document.getElementById('calc-bmi').textContent = '--';
        document.getElementById('calc-bmr').textContent = '--';
        aggiornaAvatarDaUltimaMisura();
        return;
      }

      const latest = appState.bodyMetrics[0]; // newest
      const adviceEl=document.getElementById('body-balance-advice'); if(adviceEl) adviceEl.innerHTML=bodyBalanceAdvice(latest).map(x=>`<div class="rounded-xl bg-slate-900/60 p-2">• ${x}</div>`).join('');

      // Calculate BMI
      const heightM = appState.profile.height / 100;
      const bmi = (latest.weight / (heightM * heightM)).toFixed(1);
      document.getElementById('calc-bmi').textContent = bmi;
      
      let status = 'Normopeso';
      if (bmi < 18.5) status = 'Sottopeso';
      else if (bmi >= 25 && bmi < 30) status = 'Sovrappeso';
      else if (bmi >= 30) status = 'Obesità';
      document.getElementById('calc-bmi-status').textContent = status;

      // Calculate BMR (Mifflin-St Jeor)
      // BMR = 10 * weight + 6.25 * height - 5 * age + (5 for male, -161 for female)
      const genderOffset = normalizeProfileGenderValue(appState.profile.gender) === 'male' ? 5 : -161;
      const bmr = Math.round((10 * latest.weight) + (6.25 * appState.profile.height) - (5 * appState.profile.age) + genderOffset);
      document.getElementById('calc-bmr').textContent = bmr;
      aggiornaAvatarDaUltimaMisura();

      // Render Logs History
      appState.bodyMetrics.forEach(log => {
        const item = document.createElement('div');
        item.className = "body-history-card bg-darkcard border border-darkborder rounded-2xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"; item.onclick = () => openBodyHistoryModal(log.date);
        item.innerHTML = `
          <div>
            <div class="font-bold text-white">${log.date} <span class="text-purple-400 ml-2">${log.weight} kg</span> ${log.bf ? `<span class="text-slate-400 font-normal">(${log.bf}% fat)</span>` : ''}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">
              ${log.chest ? `Petto: ${log.chest}cm ` : ''}
              ${log.waist ? `Vita: ${log.waist}cm ` : ''}
              ${log.hips ? `Fianchi: ${log.hips}cm ` : ''}
              ${log.biceps ? `Bicipite: ${log.biceps}cm ` : ''}${log.thigh ? `Coscia: ${log.thigh}cm ` : ''}${log.calf ? `Polpaccio: ${log.calf}cm` : ''}
            </div>
          </div>
          <button onclick="event.stopPropagation();deleteBodyLog('${log.id}')" class="min-w-[40px] min-h-[40px] text-slate-500 hover:text-red-400 p-2">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        container.appendChild(item);
      });
    }

    // Photo Upload Base64 Encoding Handler
    function handlePhotoUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64 = evt.target.result;
        const newPhoto = {
          id: 'photo_' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          base64: base64
        };
        appState.photos.unshift(newPhoto);
        saveStateToLocal();
        renderPhotos();
        showToast('Foto aggiunta alla galleria!', 'fa-camera');
      };
      reader.readAsDataURL(file);
    }

    function deletePhoto(id) {
      appState.photos = appState.photos.filter(p => p.id !== id);
      saveStateToLocal();
      renderPhotos();
      showToast('Foto eliminata');
    }

    function updatePhotoFilterUI(){const type=document.getElementById('photo-filter-type')?.value||'all';['date','month','year'].forEach(x=>document.getElementById('photo-filter-'+x)?.classList.toggle('hidden',type!==x));}
    function renderPhotos() {
      const gallery=document.getElementById('photo-gallery');if(!gallery)return;gallery.innerHTML='';
      const type=document.getElementById('photo-filter-type')?.value||'all',date=document.getElementById('photo-filter-date')?.value||'',month=document.getElementById('photo-filter-month')?.value||'',year=document.getElementById('photo-filter-year')?.value||'';
      const photos=(appState.photos||[]).filter(p=>type==='all'||(type==='date'&&p.date===date)||(type==='month'&&String(p.date||'').startsWith(month))||(type==='year'&&String(p.date||'').startsWith(String(year))));
      if(!photos.length){gallery.innerHTML='<div class="col-span-2 text-xs text-slate-500 italic">Nessuna foto per il filtro selezionato.</div>';return;}
      photos.forEach(photo=>{const div=document.createElement('div');div.className='relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-square';div.innerHTML=`<img src="${photo.base64}" alt="Progresso" class="w-full h-full object-cover"><div class="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1.5 text-[10px] text-slate-300 flex justify-between items-center"><span>${weekdayLabel(photo.date)}</span><button onclick="deletePhoto('${photo.id}')" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button></div>`;gallery.appendChild(div);});
    }

    function bodyMetricLabel(key){ return ({weight:'Peso',bf:'Massa grassa',neck:'Collo',shoulders:'Spalle',chest:'Petto',waist:'Vita',hips:'Fianchi',biceps:'Bicipite',forearm:'Avambraccio',thigh:'Coscia',calf:'Polpaccio'})[key] || key; }
    function openBodyHistoryModal(date=''){
      const f=document.getElementById('body-history-filter-date'); if(f)f.value=date||'';
      renderBodyHistoryDetails(); openModal('body-history-modal');
    }
    function clearBodyHistoryFilter(){ const f=document.getElementById('body-history-filter-date');if(f)f.value='';renderBodyHistoryDetails(); }
    function renderBodyHistoryDetails(){
      const c=document.getElementById('body-history-detail-list'); if(!c)return;
      const date=document.getElementById('body-history-filter-date')?.value||'';
      const rows=[...(appState.bodyMetrics||[])].filter(x=>!date||x.date===date).sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(!rows.length){c.innerHTML='<div class="rounded-2xl bg-slate-900/60 p-4 text-xs text-slate-500">Nessuna misurazione per il filtro scelto.</div>';return;}
      const keys=['weight','bf','neck','shoulders','chest','waist','hips','biceps','forearm','thigh','calf'];
      c.innerHTML=rows.map(log=>`<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"><div class="mb-3 flex items-center justify-between"><div class="font-bold text-white">${weekdayLabel(log.date)}</div><span class="text-[10px] text-slate-500">${log.date}</span></div><div class="grid grid-cols-2 gap-2">${keys.filter(k=>log[k]!==null&&log[k]!==undefined&&log[k]!==''&&Number(log[k])!==0).map(k=>`<div class="rounded-xl bg-slate-950/60 p-2"><div class="text-[9px] text-slate-500">${bodyMetricLabel(k)}</div><div class="text-sm font-black text-purple-300">${log[k]} ${k==='weight'?'kg':k==='bf'?'%':'cm'}</div></div>`).join('')}</div></div>`).join('');
    }

