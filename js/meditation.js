// Thalys v0.28.4 - Meditation module
// Extracted from app-core.js without changing behavior.
// Owns meditation timer, breathing, mindfulness, body scan, gratitude and ambient sound UI.

let meditationTimer=null, meditationRemaining=300, meditationTotal=300;
    function openMeditationTimer(){setMeditationDuration(5);openModal('meditation-modal');renderMeditationStats();}
    function setMeditationDuration(minutes){meditationTotal=minutes*60;meditationRemaining=meditationTotal;clearInterval(meditationTimer);meditationTimer=null;const b=document.getElementById('med-start-btn');if(b)b.textContent='Avvia';updateMeditationTimerUI();}
    function updateMeditationTimerUI(){const e=document.getElementById('med-timer-display');if(e)e.textContent=`${String(Math.floor(meditationRemaining/60)).padStart(2,'0')}:${String(meditationRemaining%60).padStart(2,'0')}`;}
    function toggleMeditationTimer(){const b=document.getElementById('med-start-btn');if(meditationTimer){clearInterval(meditationTimer);meditationTimer=null;if(b)b.textContent='Riprendi';return;}if(meditationRemaining<=0)setMeditationDuration(Math.round(meditationTotal/60)||5);if(b)b.textContent='Pausa';meditationTimer=setInterval(()=>{meditationRemaining--;updateMeditationTimerUI();if(meditationRemaining<=0){clearInterval(meditationTimer);meditationTimer=null;if(b)b.textContent='Completata';completeMeditationSession(Math.round(meditationTotal/60));}},1000);}
    function resetMeditationTimer(){setMeditationDuration(Math.round(meditationTotal/60)||5);}
    function completeMeditationSession(minutes,forcedType=null){const date=new Date().toISOString().split('T')[0];const type=forcedType||document.getElementById('meditation-session-type')?.value||'Mindfulness';appState.meditation=Array.isArray(appState.meditation)?appState.meditation:[];appState.meditation.push({id:'med_'+Date.now(),date,minutes,type,completedAt:new Date().toISOString()});const wellness=appState.wellness.find(x=>x.date===date);if(wellness)wellness.meditationMinutes=(Number(wellness.meditationMinutes)||0)+minutes;else appState.wellness.push({id:'wellness_'+Date.now(),date,sleepHours:7,stress:4,recovery:7,mood:7,readiness:7,notes:'',meditationMinutes:minutes,meditationQuality:7,meditationType:type});saveStateToLocal();renderMeditationStats();renderMeditationPage();renderWellnessSummary();renderHomeDashboard();showToast(`Meditazione completata: ${minutes} min`,'fa-spa');closeModal('meditation-modal');}
    function renderMeditationStats(){const arr=Array.isArray(appState.meditation)?appState.meditation:[];const today=new Date().toISOString().split('T')[0];const week=[];for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);week.push(d.toISOString().split('T')[0]);}const todayMin=arr.filter(x=>x.date===today).reduce((s,x)=>s+Number(x.minutes||0),0);const weekMin=arr.filter(x=>week.includes(x.date)).reduce((s,x)=>s+Number(x.minutes||0),0);let streak=0;for(let i=0;i<365;i++){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;}document.getElementById('med-today-min')?.replaceChildren(document.createTextNode(todayMin));document.getElementById('med-week-min')?.replaceChildren(document.createTextNode(weekMin));document.getElementById('med-streak')?.replaceChildren(document.createTextNode(streak));const last=arr.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))[0];const le=document.getElementById('med-last-session');if(le)le.textContent=last?`Ultima: ${last.minutes} min · ${last.type} · ${new Date(last.completedAt).toLocaleString()}`:'Nessuna sessione registrata.';}


function openMindInfo(type){
      const title=document.getElementById('mind-info-title');
      const content=document.getElementById('mind-info-content');
      if(!title||!content)return;

      const cards={
        breathing:{
          title:'Respirazione · come usarla',
          html:`
            <div class="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-3"><b class="text-cyan-200">A cosa serve</b><p class="mt-1">Ti dà un ritmo semplice da seguire quando vuoi rallentare, spostare l'attenzione dai pensieri alle sensazioni corporee e creare una pausa intenzionale.</p></div>
            <div><b class="text-white">Rilassamento 4–4</b><p class="mt-1">4 secondi inspira + 4 secondi espira. È la modalità più semplice per iniziare e per creare un ritmo regolare senza trattenere il respiro.</p></div>
            <div><b class="text-white">Quadrata 4–4–4–4</b><p class="mt-1">Inspira, trattieni, espira e trattieni a vuoto per 4 secondi ciascuno. È utile quando vuoi dare alla mente una sequenza precisa da seguire e aumentare la concentrazione sul ritmo.</p></div>
            <div><b class="text-white">4–7–8</b><p class="mt-1">4 secondi inspira, 7 trattieni, 8 espira. L'espirazione più lunga rende la pratica più lenta. Se il trattenimento è scomodo, torna al 4–4 senza forzarti.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Siediti comodo, lascia rilassate spalle e mandibola, respira senza riempire i polmoni al massimo e interrompi se avverti capogiri o disagio. La precisione perfetta dei secondi non è più importante del comfort.</p></div>`
        },
        mindfulness:{
          title:'Mindfulness · perché praticarla',
          html:`
            <div class="rounded-2xl border border-violet-500/20 bg-violet-500/8 p-3"><b class="text-violet-200">A cosa serve</b><p class="mt-1">Allena il ritorno intenzionale dell'attenzione al momento presente. Non significa eliminare i pensieri: significa accorgersi che la mente si è distratta e tornare a un'ancora.</p></div>
            <div><b class="text-white">Come funziona in Thalys</b><p class="mt-1">Scegli 1, 3 o 5 minuti. Ogni 20 secondi compare un nuovo suggerimento per riportarti a respiro, corpo, suoni o osservazione dei pensieri.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Leggi la frase senza trasformarla in un compito da eseguire perfettamente. Se ti distrai, è normale: nota la distrazione e torna semplicemente alla frase o al respiro.</p></div>`
        },
        bodyscan:{
          title:'Body Scan · guida',
          html:`
            <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3"><b class="text-emerald-200">A cosa serve</b><p class="mt-1">Ti aiuta a notare in modo sistematico tensione, pressione, temperatura e contatto nelle varie parti del corpo. È particolarmente adatto quando senti il corpo contratto o vuoi rallentare prima del riposo.</p></div>
            <div><b class="text-white">Come funziona</b><p class="mt-1">La mappa illumina Testa, Spalle/Petto, Braccia, Addome, Gambe e Piedi per 10 secondi ciascuno e ti propone un'indicazione specifica.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farlo bene</b><p class="mt-1">Non cercare per forza di rilassare una zona. Prima osservala. Se senti tensione, prova ad ammorbidirla durante l'espirazione; se non cambia, continua comunque alla zona successiva.</p></div>`
        },
        gratitude:{
          title:'Gratitudine · diario',
          html:`
            <div class="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3"><b class="text-amber-200">A cosa serve</b><p class="mt-1">È uno spazio per registrare intenzionalmente esperienze, persone o piccoli dettagli che vuoi ricordare. Non serve a negare le difficoltà della giornata.</p></div>
            <div><b class="text-white">Come funziona</b><p class="mt-1">Puoi usare lo spunto casuale quando non sai cosa scrivere. Ogni nota viene salvata con la data e resta disponibile nella sezione “I tuoi ricordi felici”.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Meglio una cosa specifica che una frase generica: invece di “sono grato per gli amici”, prova “la telefonata di Marco mentre tornavo a casa mi ha fatto sorridere”. Anche una sola frase è sufficiente.</p></div>`
        }
      };

      const c=cards[type]||cards.mindfulness;
      title.textContent=c.title;
      content.innerHTML=c.html;
      openModal('mind-info-modal');
    }

    // ===== MIND TOOLS: check-in, breathing, mindfulness, body scan, gratitude =====
    function hapticPulse(ms=100){try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate(ms)}catch(_){}}


    // ===== SUONI AMBIENTE MP3 REALI DAL REPOSITORY =====
    const THALYS_AMBIENT_TRACKS = {
      rain:        { label:'Pioggia',          file:'Pioggia.mp3' },
      rainforest:  { label:'Pioggia foresta',  file:'Pioggia%20foresta.mp3' },
      waves:       { label:'Onde',              file:'Onde.mp3' },
      stream:      { label:'Ruscello',          file:'Ruscello.mp3' },
      fire:        { label:'Fuoco',             file:'Fuoco.mp3' },
      desert:      { label:'Deserto',           file:'Deserto.mp3' },
      piano:       { label:'Relax Piano',       file:'Relax%20Piano.mp3' },
      white:       { label:'Rumore Bianco',     file:'Rumore%20Bianco.mp3' },
      pink:        { label:'Rumore Rosa',       file:'Rumore%20Rosa.mp3' }
    };

    let ambientAudio = null;
    let ambientCurrent = 'off';
    let ambientVolume = Number(localStorage.getItem('thalys_ambient_volume') || 35) / 100;
    let ambientCtx = null;
    let ambientSourceNode = null;
    let ambientGainNode = null;

    async function ensureAmbientGain(audio){
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx) return null;
      if(!ambientCtx) ambientCtx=new AudioCtx();
      if(ambientCtx.state==='suspended'){
        try{await ambientCtx.resume();}catch(_){}
      }
      if(ambientSourceNode){
        try{ambientSourceNode.disconnect();}catch(_){}
        ambientSourceNode=null;
      }
      ambientSourceNode=ambientCtx.createMediaElementSource(audio);
      if(!ambientGainNode){
        ambientGainNode=ambientCtx.createGain();
        ambientGainNode.connect(ambientCtx.destination);
      }
      ambientGainNode.gain.setValueAtTime(ambientVolume,ambientCtx.currentTime);
      ambientSourceNode.connect(ambientGainNode);
      audio.volume=1;
      return ambientGainNode;
    }

    function getAmbientTrackUrl(file){
      // Relative to index.html: works both on GitHub/Vercel and local hosting.
      return './' + file;
    }

    async function setAmbientSound(type){
      const track = THALYS_AMBIENT_TRACKS[type];
      if(!track){ stopAmbientSound(); return; }

      try{
        if(ambientAudio){
          ambientAudio.pause();
          ambientAudio.removeAttribute('src');
          ambientAudio.load();
        }

        const audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = Math.max(0, Math.min(1, ambientVolume));
        audio.src = getAmbientTrackUrl(track.file);
        audio.setAttribute('playsinline','');

        audio.addEventListener('error', () => {
          console.warn('Impossibile caricare la traccia:', track.file, audio.error);
          if(ambientAudio === audio){
            ambientCurrent = 'off';
            renderAmbientUI();
            showToast(`Audio non trovato: ${decodeURIComponent(track.file)}`, 'error');
          }
        }, { once:true });

        ambientAudio = audio;
        ambientCurrent = type;
        try{await ensureAmbientGain(audio);}catch(err){console.warn('Gain audio non disponibile, uso volume HTMLMediaElement',err);audio.volume=ambientVolume;}
        await audio.play();

        localStorage.setItem('thalys_ambient_sound', type);
        renderAmbientUI();
      }catch(err){
        console.warn('Ambient audio play error:', err);
        ambientCurrent = 'off';
        renderAmbientUI();

        if(err && err.name === 'NotAllowedError'){
          showToast('Tocca di nuovo il suono per avviarlo su iPhone', 'error');
        }else{
          showToast(`Non riesco ad avviare ${track.label}`, 'error');
        }
      }
    }

    function stopAmbientSound(){
      if(ambientAudio){
        try{
          ambientAudio.pause();
          ambientAudio.currentTime = 0;
          ambientAudio.removeAttribute('src');
          ambientAudio.load();
        }catch(_){}
      }
      ambientAudio = null;
      if(ambientSourceNode){try{ambientSourceNode.disconnect();}catch(_){} ambientSourceNode=null;}
      ambientCurrent = 'off';
      localStorage.setItem('thalys_ambient_sound','off');
      renderAmbientUI();
    }

    function setAmbientVolume(value){
      ambientVolume = Math.max(0, Math.min(1, Number(value || 0) / 100));
      localStorage.setItem('thalys_ambient_volume', String(Math.round(ambientVolume * 100)));
      if(ambientGainNode && ambientCtx){
        ambientGainNode.gain.setTargetAtTime(ambientVolume,ambientCtx.currentTime,.03);
      }else if(ambientAudio){
        try{ambientAudio.volume=ambientVolume;}catch(_){}
      }

      const label = document.getElementById('ambient-volume-label');
      if(label) label.textContent = `${Math.round(ambientVolume * 100)}%`;
    }

    function renderAmbientUI(){
      document.querySelectorAll('.ambient-sound-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ambient === ambientCurrent);
      });

      const status = document.getElementById('ambient-status');
      if(status){
        status.textContent = ambientCurrent === 'off'
          ? 'Nessun suono attivo'
          : `${THALYS_AMBIENT_TRACKS[ambientCurrent]?.label || ambientCurrent} attivo`;
      }

      const range = document.getElementById('ambient-volume');
      if(range) range.value = Math.round(ambientVolume * 100);

      const label = document.getElementById('ambient-volume-label');
      if(label) label.textContent = `${Math.round(ambientVolume * 100)}%`;
    }


    let meditationSelectedDate=currentLocalDateStr();
    function onMeditationDateChange(d){if(!d)return;meditationSelectedDate=d;renderMeditationPage()}
    function shiftMeditationDate(n){
      const d=new Date((meditationSelectedDate||currentLocalDateStr())+'T12:00:00');d.setDate(d.getDate()+n);
      meditationSelectedDate=d.toISOString().slice(0,10);const i=document.getElementById('meditation-date');if(i)i.value=meditationSelectedDate;renderMeditationPage();
    }
    function vibratePhase(){try{if(typeof navigator.vibrate==='function')navigator.vibrate(100)}catch(_){}}

    const EMOTION_MAP={stressato:{card:'mind-card-breathing',label:'Respirazione 4–7–8',tech:'478'},stanco:{card:'mind-card-bodyscan',label:'Body Scan'},confuso:{card:'mind-card-mindfulness',label:'Mindfulness'},triste:{card:'mind-card-gratitude',label:'Gratitudine'},calmo:{card:'mind-card-mindfulness',label:'Mindfulness'}};
    function selectEmotion(emotion){
      document.querySelectorAll('.emotion-chip').forEach(b=>b.classList.toggle('active',b.dataset.emotion===emotion));document.querySelectorAll('.mind-tool-card').forEach(c=>c.classList.remove('recommended'));
      const rec=EMOTION_MAP[emotion];document.getElementById(rec.card)?.classList.add('recommended');const box=document.getElementById('emotion-recommendation');if(box){box.classList.remove('hidden');box.innerHTML=`In base a come ti senti, prova <b>${rec.label}</b>. È solo un suggerimento: puoi scegliere qualsiasi pratica.`;}
      if(rec.tech)setBreathingTechnique(rec.tech);localStorage.setItem('thalys_emotion_'+new Date().toISOString().split('T')[0],emotion);setTimeout(()=>document.getElementById(rec.card)?.scrollIntoView({behavior:'smooth',block:'center'}),120);
    }

    const BREATH_TECHNIQUES={
      relax:{title:'Rilassamento 4–4',phases:[['Inspira',4,'inhale'],['Espira',4,'exhale']]},
      box:{title:'Quadrata · Anti Ansia',phases:[['Inspira',4,'inhale'],['Trattieni',4,'holdFull'],['Espira',4,'exhale'],['Trattieni',4,'holdEmpty']]},
      '478':{title:'Tecnica 4–7–8',phases:[['Inspira',4,'inhale'],['Trattieni',7,'holdFull'],['Espira',8,'exhale']]}
    };
    let mindBreathTechnique='relax',mindBreathTimer=null,mindBreathPhaseIndex=0,mindBreathSeconds=0;
    function setBreathingTechnique(key){if(!BREATH_TECHNIQUES[key])return;resetMindBreathing();mindBreathTechnique=key;document.querySelectorAll('.breath-tech-btn').forEach(b=>b.classList.toggle('active',b.dataset.tech===key));const title=document.getElementById('mind-breath-title');if(title)title.textContent=BREATH_TECHNIQUES[key].title;}
    function applyMindBreathPhase(){const phase=BREATH_TECHNIQUES[mindBreathTechnique].phases[mindBreathPhaseIndex],orb=document.getElementById('mind-breath-orb'),label=document.getElementById('mind-breath-phase'),sec=document.getElementById('mind-breath-seconds');if(!phase)return;mindBreathSeconds=phase[1];if(label)label.textContent=phase[0];if(sec)sec.textContent=mindBreathSeconds+' s';orb?.classList.remove('inhale','exhale');if(phase[2]==='inhale')orb?.classList.add('inhale');else if(phase[2]==='exhale')orb?.classList.add('exhale');orb?.style.setProperty('transition-duration',phase[1]+'s');hapticPulse(100);}
    function toggleMindBreathing(){const btn=document.getElementById('mind-breath-toggle');if(mindBreathTimer){clearInterval(mindBreathTimer);mindBreathTimer=null;if(btn)btn.textContent='Riprendi';return;}if(mindBreathSeconds<=0)applyMindBreathPhase();if(btn)btn.textContent='Pausa';mindBreathTimer=setInterval(()=>{mindBreathSeconds--;const sec=document.getElementById('mind-breath-seconds');if(sec)sec.textContent=Math.max(0,mindBreathSeconds)+' s';if(mindBreathSeconds<=0){mindBreathPhaseIndex=(mindBreathPhaseIndex+1)%BREATH_TECHNIQUES[mindBreathTechnique].phases.length;applyMindBreathPhase();}},1000);}
    function resetMindBreathing(){if(mindBreathTimer)clearInterval(mindBreathTimer);mindBreathTimer=null;mindBreathPhaseIndex=0;mindBreathSeconds=0;const orb=document.getElementById('mind-breath-orb');orb?.classList.remove('inhale');orb?.classList.add('exhale');const l=document.getElementById('mind-breath-phase');if(l)l.textContent='Pronto';const s=document.getElementById('mind-breath-seconds');if(s)s.textContent='—';const b=document.getElementById('mind-breath-toggle');if(b)b.textContent='Avvia';}

    const MINDFULNESS_PROMPTS=['Focalizzati sul momento presente.','Senti l’aria che entra.','Nota l’aria che esce.','Rilassa la mandibola e le spalle.','Osserva i pensieri e lasciali andare come nuvole.','Nota tre sensazioni del corpo.','Ascolta i suoni senza giudicarli.','Torna con gentilezza al respiro.','Senti il peso del corpo sostenuto.','Lascia spazio a ciò che provi senza doverlo cambiare.'];
    let mindfulnessTimer=null,mindfulnessDurationMin=1,mindfulnessTotal=60,mindfulnessRemaining=60;
    function setMindfulnessDuration(min){pauseMindfulness();mindfulnessDurationMin=min;mindfulnessTotal=min*60;mindfulnessRemaining=mindfulnessTotal;document.querySelectorAll('.mind-duration-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===min));updateMindfulnessUI();}
    function updateMindfulnessUI(){const t=document.getElementById('mindfulness-time'),ring=document.getElementById('mindfulness-ring'),prompt=document.getElementById('mindfulness-prompt');if(t)t.textContent=`${String(Math.floor(mindfulnessRemaining/60)).padStart(2,'0')}:${String(mindfulnessRemaining%60).padStart(2,'0')}`;if(ring)ring.style.setProperty('--progress',`${((mindfulnessTotal-mindfulnessRemaining)/mindfulnessTotal)*360}deg`);const elapsed=mindfulnessTotal-mindfulnessRemaining,idx=Math.floor(elapsed/20)%MINDFULNESS_PROMPTS.length;if(prompt)prompt.textContent=MINDFULNESS_PROMPTS[idx];}
    function toggleMindfulness(){if(mindfulnessTimer){pauseMindfulness();return;}if(mindfulnessRemaining<=0)mindfulnessRemaining=mindfulnessTotal;const b=document.getElementById('mindfulness-toggle');if(b)b.textContent='In corso…';mindfulnessTimer=setInterval(()=>{mindfulnessRemaining=Math.max(0,mindfulnessRemaining-1);updateMindfulnessUI();if(mindfulnessRemaining<=0){clearInterval(mindfulnessTimer);mindfulnessTimer=null;if(b)b.textContent='Completata';completeMeditationSession(mindfulnessDurationMin,'Mindfulness');}},1000);}
    function pauseMindfulness(){if(mindfulnessTimer)clearInterval(mindfulnessTimer);mindfulnessTimer=null;const b=document.getElementById('mindfulness-toggle');if(b)b.textContent=mindfulnessRemaining<mindfulnessTotal?'Riprendi':'Avvia';}
    function resetMindfulness(){pauseMindfulness();mindfulnessRemaining=mindfulnessTotal;updateMindfulnessUI();const b=document.getElementById('mindfulness-toggle');if(b)b.textContent='Avvia';}

    const BODY_SCAN_STEPS=[['scan-head','Testa','Rilascia la tensione dalla fronte e dalla mascella. Nota gli occhi e lascia che si ammorbidiscano.'],['scan-chest','Spalle e petto','Lascia scendere le spalle. Nota il respiro che muove naturalmente il petto.'],['scan-arms','Braccia','Scendi dalle spalle alle mani. Lascia che le braccia diventino pesanti.'],['scan-abdomen','Addome','Nota l’addome che si espande e si ritrae. Non serve controllare il respiro.'],['scan-legs','Gambe','Senti cosce, ginocchia e polpacci. Osserva pressione, calore e tensione.'],['scan-feet','Piedi','Porta l’attenzione fino alle dita. Nota il contatto e lascia andare ciò che resta.']];
    let bodyScanTimer=null,bodyScanElapsed=0;
    function renderBodyScan(){const idx=Math.min(BODY_SCAN_STEPS.length-1,Math.floor(bodyScanElapsed/10)),step=BODY_SCAN_STEPS[idx];document.querySelectorAll('.body-scan-zone').forEach(x=>x.classList.remove('active'));document.getElementById(step[0])?.classList.add('active');const title=document.getElementById('body-scan-zone-title'),guide=document.getElementById('body-scan-guide'),time=document.getElementById('body-scan-time');if(title)title.textContent=step[1];if(guide)guide.textContent=step[2];if(time)time.textContent=`00:${String(Math.max(0,60-bodyScanElapsed)).padStart(2,'0')}`;}
    function toggleBodyScan(){if(bodyScanTimer){pauseBodyScan();return;}if(bodyScanElapsed>=60)bodyScanElapsed=0;renderBodyScan();const b=document.getElementById('body-scan-toggle');if(b)b.textContent='In corso…';bodyScanTimer=setInterval(()=>{bodyScanElapsed++;renderBodyScan();if(bodyScanElapsed>=60){clearInterval(bodyScanTimer);bodyScanTimer=null;if(b)b.textContent='Completato';completeMeditationSession(1,'Body scan');}},1000);}
    function pauseBodyScan(){if(bodyScanTimer)clearInterval(bodyScanTimer);bodyScanTimer=null;const b=document.getElementById('body-scan-toggle');if(b)b.textContent=bodyScanElapsed?'Riprendi':'Avvia';}
    function resetBodyScan(){pauseBodyScan();bodyScanElapsed=0;document.querySelectorAll('.body-scan-zone').forEach(x=>x.classList.remove('active'));const t=document.getElementById('body-scan-zone-title');if(t)t.textContent='Pronto';const g=document.getElementById('body-scan-guide');if(g)g.textContent="Avvia e lascia che l'attenzione scenda lentamente dalla testa ai piedi.";const tm=document.getElementById('body-scan-time');if(tm)tm.textContent='01:00';}

    const GRATITUDE_PROMPTS=['Per quale piccola cosa sei grato oggi?','Chi ti ha fatto sorridere di recente?','Quale momento della giornata vorresti ricordare?','Quale gesto gentile hai ricevuto o fatto?','Quale parte del tuo corpo ti ha permesso di fare qualcosa che ami?','Che cosa hai imparato oggi?','Quale sapore, profumo o suono ti ha fatto stare bene?','C’è un luogo in cui oggi ti sei sentito al sicuro?'];let gratitudePromptIndex=0;
    function nextGratitudePrompt(){gratitudePromptIndex=(gratitudePromptIndex+1)%GRATITUDE_PROMPTS.length;const e=document.getElementById('gratitude-prompt');if(e)e.textContent=GRATITUDE_PROMPTS[gratitudePromptIndex];}
    function getGratitudeEntries(){try{return JSON.parse(localStorage.getItem('thalys_gratitude')||'[]')}catch(_){return[]}}
    let gratitudeSelectMode=false;
    const gratitudeSelectedIds=new Set();
    function saveGratitudeEntry(){const ta=document.getElementById('gratitude-text'),value=ta?.value?.trim();if(!value){showToast('Scrivi prima un pensiero di gratitudine');return;}const arr=getGratitudeEntries();arr.push({id:'grat_'+Date.now(),date:new Date().toISOString(),text:value});localStorage.setItem('thalys_gratitude',JSON.stringify(arr));if(ta)ta.value='';renderGratitudeHistory();showToast('Ricordo salvato ✓','fa-heart');}
    function updateGratitudeFilterUI(){const type=document.getElementById('gratitude-filter-type')?.value||'all';document.getElementById('gratitude-filter-date')?.classList.toggle('hidden',type!=='date');document.getElementById('gratitude-filter-month')?.classList.toggle('hidden',type!=='month');}
    function getFilteredGratitudeEntries(){const arr=getGratitudeEntries().sort((a,b)=>new Date(b.date)-new Date(a.date));const type=document.getElementById('gratitude-filter-type')?.value||'all';if(type==='date'){const d=document.getElementById('gratitude-filter-date')?.value;if(!d)return arr;return arr.filter(x=>String(x.date).slice(0,10)===d);}if(type==='month'){const m=document.getElementById('gratitude-filter-month')?.value;if(!m)return arr;return arr.filter(x=>String(x.date).slice(0,7)===m);}return arr;}
    function toggleGratitudeSelectMode(){gratitudeSelectMode=!gratitudeSelectMode;if(!gratitudeSelectMode)gratitudeSelectedIds.clear();document.getElementById('gratitude-export-actions')?.classList.toggle('hidden',!gratitudeSelectMode);document.getElementById('gratitude-select-all-btn')?.classList.toggle('hidden',!gratitudeSelectMode);const b=document.getElementById('gratitude-select-mode-btn');if(b)b.innerHTML=gratitudeSelectMode?'<i class="fa-solid fa-xmark mr-1"></i>Fine':'<i class="fa-solid fa-check-double mr-1"></i>Seleziona';renderGratitudeHistory();}
    function toggleGratitudeEntrySelection(id,checked){if(checked)gratitudeSelectedIds.add(id);else gratitudeSelectedIds.delete(id);}
    function selectAllVisibleGratitude(){getFilteredGratitudeEntries().forEach(x=>gratitudeSelectedIds.add(x.id));renderGratitudeHistory();}
    function openGratitudeNote(id){if(gratitudeSelectMode)return;const x=getGratitudeEntries().find(e=>e.id===id);if(!x)return;const d=document.getElementById('gratitude-note-date'),t=document.getElementById('gratitude-note-text');if(d)d.textContent=new Date(x.date).toLocaleString(currentLocale(),{dateStyle:'full',timeStyle:'short'});if(t)t.textContent=x.text;openModal('gratitude-note-modal');}
    function renderGratitudeHistory(){const box=document.getElementById('gratitude-history');if(!box)return;updateGratitudeFilterUI();const arr=getFilteredGratitudeEntries(),esc=s=>String(s).replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));box.innerHTML=arr.length?arr.map(x=>`<div class="gratitude-memory rounded-xl bg-slate-900/60 p-3 ${gratitudeSelectMode?'':'cursor-pointer'}" ${gratitudeSelectMode?'':`onclick="openGratitudeNote('${x.id}')"`}><div class="flex items-start gap-3">${gratitudeSelectMode?`<input type="checkbox" ${gratitudeSelectedIds.has(x.id)?'checked':''} onclick="event.stopPropagation()" onchange="toggleGratitudeEntrySelection('${x.id}',this.checked)" class="mt-1 h-5 w-5 shrink-0 accent-amber-500">`:''}<div class="min-w-0 flex-1"><div class="text-[9px] text-slate-500">${new Date(x.date).toLocaleString(currentLocale())}</div><div class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-200">${esc(x.text)}</div>${gratitudeSelectMode?'':'<div class="mt-1 text-[9px] font-bold text-amber-400">Tocca per aprire</div>'}</div></div></div>`).join(''):'<div class="text-[10px] text-slate-500">Nessun ricordo per questo filtro.</div>';}
    function downloadGratitudeEntries(entries,name='thalys_diario_gratitudine.txt'){if(!entries.length){showToast('Nessuna nota da esportare');return;}const content=entries.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(x=>`${new Date(x.date).toLocaleString(currentLocale())}\n${x.text}`).join('\n\n------------------------------\n\n');const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Diario esportato ✓','fa-file-arrow-down');}
    function exportSelectedGratitude(){downloadGratitudeEntries(getGratitudeEntries().filter(x=>gratitudeSelectedIds.has(x.id)),'thalys_gratitudine_selezionata.txt');}
    function exportFilteredGratitude(){downloadGratitudeEntries(getFilteredGratitudeEntries(),'thalys_gratitudine_filtrata.txt');}
    function exportGratitudeTxt(){downloadGratitudeEntries(getGratitudeEntries());}

    function startGuidedMeditation(type){const sel=document.getElementById('meditation-session-type');if(sel)sel.value=type;openMeditationTimer();}
    function renderMeditationPage(){
      const arr=Array.isArray(appState.meditation)?appState.meditation:[], today=meditationSelectedDate||currentLocalDateStr();
      const week=[];for(let i=0;i<7;i++){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-i);week.push(d.toISOString().split('T')[0]);}
      const todayMin=arr.filter(x=>x.date===today).reduce((s,x)=>s+Number(x.minutes||0),0),weekMin=arr.filter(x=>week.includes(x.date)).reduce((s,x)=>s+Number(x.minutes||0),0);
      let streak=0;for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;}
      [['med-page-today',todayMin],['med-page-week',weekMin],['med-page-streak',streak]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=v;});
      const h=document.getElementById('med-history');if(h){const items=arr.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)).slice(0,15);h.innerHTML=items.length?items.map(x=>`<div class="flex items-center justify-between rounded-xl bg-slate-900/60 p-3"><div><div class="text-xs font-bold text-white">${x.type}</div><div class="text-[9px] text-slate-500">${new Date(x.date+'T12:00:00').toLocaleDateString(currentLocale())}</div></div><div class="text-sm font-black text-violet-300">${x.minutes} min</div></div>`).join(''):'<div class="text-[10px] text-slate-500">Nessuna sessione ancora. La prima può durare solo 2 minuti.</div>';}
      const gp=document.getElementById('gratitude-prompt');if(gp&&!gp.textContent.trim())gp.textContent=GRATITUDE_PROMPTS[gratitudePromptIndex];
      const savedEmotion=localStorage.getItem('thalys_emotion_'+today);if(savedEmotion&&EMOTION_MAP[savedEmotion]&&!document.querySelector('.emotion-chip.active'))selectEmotion(savedEmotion);
      const mdi=document.getElementById('meditation-date');if(mdi)mdi.value=meditationSelectedDate||currentLocalDateStr();
      renderGratitudeHistory();updateMindfulnessUI();renderAmbientUI();
    }

