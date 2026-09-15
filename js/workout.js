/* Thalys v0.30 - Workout domain module */
    // WORKOUT LOGIC
    // ----------------------------------------------------
    function onWorkoutDateChange(date){ if(!date)return; homeSelectedDate=date; const hp=document.getElementById('home-date-picker'); if(hp)hp.value=date; updateDateLabels();renderWorkouts(); renderWorkoutPlans(); renderHomeDashboard(); }
    function shiftWorkoutDate(days){ const input=document.getElementById('workout-date'); if(!input?.value)return; const d=new Date(input.value+'T12:00:00'); d.setDate(d.getDate()+days); const iso=d.toISOString().split('T')[0]; if(input)input.value=iso; onWorkoutDateChange(iso); }

    function addPlanExerciseRow() {
      const container = document.getElementById('plan-exercises-container');
      if (!container) return;

      const row = document.createElement('div');
      row.className = 'plan-exercise-row grid grid-cols-2 gap-2 bg-slate-950/70 border border-slate-800 rounded-xl p-2';
      row.innerHTML = `
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-cyan-300 block mb-1">Giorno della settimana</label>
          <select class="plan-ex-day w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-2 py-2 text-[11px] text-white">
            <option value="Lunedì">Lunedì</option><option value="Martedì">Martedì</option><option value="Mercoledì">Mercoledì</option><option value="Giovedì">Giovedì</option><option value="Venerdì">Venerdì</option><option value="Sabato">Sabato</option><option value="Domenica">Domenica</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Nome esercizio</label>
          <input type="text" placeholder="Es. Panca piana" class="plan-ex-name w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Categoria</label>
          <select class="plan-ex-category w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white">
            <option value="Petto">Petto</option>
            <option value="Dorso">Dorso</option>
            <option value="Gambe">Gambe</option>
            <option value="Spalle">Spalle</option>
            <option value="Braccia">Braccia</option>
            <option value="Core">Core</option>
            <option value="Cardio">Cardio</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">RPE</label>
          <input type="number" min="1" max="10" value="8" class="plan-ex-rpe w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Peso in kg</label>
          <input type="number" min="0" step="0.5" value="10" class="plan-ex-weight w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Ripetizioni</label>
          <input type="number" min="1" value="8" class="plan-ex-reps w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
        <div class="col-span-2">
          <label class="text-[10px] uppercase tracking-[0.15rem] text-slate-400 block mb-1">Recupero in sec</label>
          <input type="number" min="0" value="90" class="plan-ex-recovery w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white" />
        </div>
      `;
      container.appendChild(row);
    }

    let editingWorkoutPlanId = null;
    function saveWorkoutPlan(e) {
      e.preventDefault();
      const name = document.getElementById('plan-name').value.trim();
const rows = document.querySelectorAll('#plan-exercises-container .plan-exercise-row');

      const exercises = Array.from(rows).map(row => {
        const nameValue = row.querySelector('.plan-ex-name').value.trim();
        if (!nameValue) return null;
        return {
          id: 'plan_ex_' + Date.now() + Math.random().toString(16).slice(2),
          name: nameValue,
          dayOfWeek: row.querySelector('.plan-ex-day')?.value || 'Lunedì',
          category: row.querySelector('.plan-ex-category').value,
          rpe: parseFloat(row.querySelector('.plan-ex-rpe').value) || 8,
          weight: parseFloat(row.querySelector('.plan-ex-weight').value) || 0,
          reps: parseInt(row.querySelector('.plan-ex-reps').value) || 0,
          recovery: parseInt(row.querySelector('.plan-ex-recovery').value) || 90
        };
      }).filter(Boolean);

      if (!name || exercises.length === 0) {
        showToast('Inserisci un nome e almeno un esercizio', 'fa-circle-exclamation');
        return;
      }

      if (editingWorkoutPlanId) {
        const idx = appState.workoutPlans.findIndex(p => p.id === editingWorkoutPlanId);
        if (idx >= 0) appState.workoutPlans[idx] = { ...appState.workoutPlans[idx], name, exercises, updatedAt: new Date().toISOString() };
      } else {
        appState.workoutPlans.push({ id: 'plan_' + Date.now(), name, exercises, updatedAt: new Date().toISOString() });
      }

      const wasEditing = !!editingWorkoutPlanId;
      editingWorkoutPlanId = null;
      saveStateToLocal();
      document.getElementById('workout-plan-form').reset();
      document.getElementById('plan-exercises-container').innerHTML = '';
      addPlanExerciseRow();
      renderWorkoutPlans();
      refreshProfileMessageCompletion();
      showToast(wasEditing ? 'Scheda modificata ✓' : 'Scheda salvata!', 'fa-clipboard-list');
    }

    function editWorkoutPlan(planId) {
      const plan = (appState.workoutPlans || []).find(p => p.id === planId);
      if (!plan) return;
      editingWorkoutPlanId = planId;
      const nameEl=document.getElementById('plan-name'), c=document.getElementById('plan-exercises-container');
      if(nameEl)nameEl.value=plan.name||'';
if(c)c.innerHTML='';
      (plan.exercises||[]).forEach(ex=>{ addPlanExerciseRow(); const row=c?.lastElementChild; if(!row)return; const set=(q,v)=>{const e=row.querySelector(q);if(e)e.value=v??'';}; set('.plan-ex-name',ex.name);set('.plan-ex-category',ex.category);set('.plan-ex-rpe',ex.rpe);set('.plan-ex-weight',ex.weight);set('.plan-ex-reps',ex.reps);set('.plan-ex-recovery',ex.recovery); });
      if(c && !c.children.length) addPlanExerciseRow();
      document.getElementById('workout-plan-form')?.scrollIntoView({behavior:'smooth',block:'start'});
      showToast(`Modifica scheda: ${plan.name}`, 'fa-pen');
    }

    function activateWorkoutPlan(planId) {
      appState.activeWorkoutPlanId=planId;
      saveStateToLocal();renderWorkouts();renderWorkoutPlans();renderHomeDashboard();
      const plan=appState.workoutPlans.find(item=>item.id===planId);
      refreshProfileMessageCompletion();
      showToast(plan?`Scheda attiva: ${plan.name}`:'Scheda attivata','fa-calendar-check');
    }

    function exportWorkoutPlan(planId) {
      const plan = appState.workoutPlans.find(item => item.id === planId);
      if (!plan) return;

      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name.toLowerCase().replace(/\s+/g, '_')}_schema.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Schema esportato', 'fa-file-export');
    }

    function deleteWorkoutPlan(planId) {
      const plan=(appState.workoutPlans||[]).find(x=>x.id===planId);if(!confirm(`Eliminare la scheda ${plan?.name||'selezionata'}?`))return;
      appState.workoutPlans = appState.workoutPlans.filter(item => item.id !== planId);
      if(appState.activeWorkoutPlanId===planId)appState.activeWorkoutPlanId=null;
      Object.keys(appState.workoutAssignments || {}).forEach(date => {
        if (appState.workoutAssignments[date] === planId) delete appState.workoutAssignments[date];
      });
      saveStateToLocal();
      renderWorkouts();
      renderWorkoutPlans();
      showToast('Scheda rimossa', 'fa-trash');
    }

    function importWorkoutPlanFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const imported = JSON.parse(reader.result);
            if (!imported || !imported.name || !Array.isArray(imported.exercises)) {
              throw new Error('Formato schema non valido');
            }
            appState.workoutPlans.push({
              id: imported.id || 'plan_' + Date.now(),
              name: imported.name,
              dayOfWeek: imported.dayOfWeek || imported.days?.[0] || 'Lunedì',
              exercises: imported.exercises.map(ex=>({...ex,dayOfWeek:ex.dayOfWeek||imported.dayOfWeek||'Lunedì'}))
            });
            saveStateToLocal();
            renderWorkoutPlans();
            showToast('Scheda importata', 'fa-file-import');
          } catch (err) {
            console.error(err);
            showToast('File schema non valido', 'fa-circle-exclamation');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    function renderWorkoutPlans() {
      const list = document.getElementById('workout-plans-list');
      if (!list) return;
      list.innerHTML = '';

      if (!appState.workoutPlans.length) {
        list.innerHTML = '<div class="text-[11px] text-slate-400 italic">Nessuna scheda salvata.</div>';
        return;
      }

      const selectedDate = document.getElementById('workout-date')?.value;
      appState.workoutPlans.forEach(plan => {
        const days=getPlanDays(plan);
        const activeOnSelected=appState.activeWorkoutPlanId===plan.id;

        const item = document.createElement('div');
        item.className = 'bg-slate-900/60 border border-slate-800 rounded-xl p-3';
        item.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-bold text-white text-sm">${plan.name}</div>
              <div class="text-[10px] text-slate-400">${days.join(' · ')} · ${plan.exercises.length} esercizi</div>
              ${activeOnSelected ? `<div class="text-[10px] text-emerald-400 mt-1">Scheda attiva ogni giorno</div>` : ''}
            </div>
            <div class="flex flex-wrap gap-1 justify-end">
              <button data-plan-id="${plan.id}" class="plan-activate-btn rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-bold text-slate-950">${activeOnSelected ? 'Attiva' : 'Rendi attiva'}</button>
              <button type="button" onclick="editWorkoutPlan('${plan.id}')" class="rounded-md bg-violet-700 px-2 py-1 text-[10px] font-bold text-white">Modifica</button>
              <button data-export-plan="${plan.id}" class="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200">Esporta</button>
              <button data-delete-plan="${plan.id}" class="rounded-md bg-rose-700 px-2 py-1 text-[10px] font-bold text-white">Elimina</button>
            </div>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('[data-plan-id]').forEach(btn => {
        btn.addEventListener('click', () => activateWorkoutPlan(btn.dataset.planId));
      });
      list.querySelectorAll('[data-export-plan]').forEach(btn => {
        btn.addEventListener('click', () => exportWorkoutPlan(btn.dataset.exportPlan));
      });
      list.querySelectorAll('[data-delete-plan]').forEach(btn => {
        btn.addEventListener('click', () => deleteWorkoutPlan(btn.dataset.deletePlan));
      });
    }

    function renderWorkouts() {
      const selectedDate = document.getElementById('workout-date').value;
      const container = document.getElementById('workout-list');
      container.innerHTML = '';

      const assignedPlan=getActiveWorkoutPlan();
      const assignedPlanId=assignedPlan?.id||null;
      const scheduledToday=assignedPlan?isPlanScheduledOnDate(assignedPlan,selectedDate):false;
      const todayPlanExercises=assignedPlan?getExercisesForDate(assignedPlan,selectedDate):[];
      if(assignedPlanId){
          const totalPlanVolume = todayPlanExercises.reduce((sum, ex) => sum + ((Number(ex.weight) || 0) * (Number(ex.reps) || 0)), 0);
          const planCard = document.createElement('div');
          planCard.className = 'bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-4 space-y-3 shadow-md';
          planCard.innerHTML = `
            <div class="flex justify-between items-start">
              <div>
                <div class="text-[10px] uppercase tracking-[0.2rem] text-cyan-300">Scheda attiva</div>
                <div class="text-lg font-bold text-white">${assignedPlan.name}</div>
              </div>
              <span class="rounded-full bg-emerald-500/15 border border-emerald-400/40 px-2 py-1 text-[10px] font-bold text-emerald-300">${getPlanDays(assignedPlan).map(d=>tr(d)).join(" · ")}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="text-[11px] text-slate-300">Volume previsto: <span class="text-cyan-400 font-bold">${totalPlanVolume} kg</span></div>
              ${scheduledToday?`<label class="flex items-center gap-2 rounded-xl bg-slate-950/70 border border-emerald-500/20 px-3 py-2 cursor-pointer">
                <input type="checkbox" ${isWorkoutPlanCompleted(selectedDate, assignedPlan.id) ? 'checked' : ''} onchange="toggleWorkoutPlanComplete('${selectedDate}','${assignedPlan.id}',this.checked)" class="w-4 h-4 accent-emerald-500">
                <span class="text-[10px] font-bold ${isWorkoutPlanCompleted(selectedDate, assignedPlan.id) ? 'text-emerald-300' : 'text-slate-300'}">Scheda completata</span>
              </label>`:`<span class="rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-400">${tk('workout.rest_scheduled','Riposo programmato')}</span>`}
            </div>
            <div class="space-y-2">
              ${(scheduledToday?todayPlanExercises:assignedPlan.exercises).map(ex => { const done=scheduledToday&&isWorkoutExerciseCompleted(selectedDate,assignedPlan.id,ex.id); return `
                <div class="bg-slate-900/70 border ${done?'border-emerald-500/30':'border-slate-800'} rounded-xl p-2 flex items-center gap-3 ${scheduledToday?'':'opacity-70'}">
                  <input type="checkbox" ${done?'checked':''} ${scheduledToday?'':'disabled'} onchange="toggleWorkoutExerciseComplete('${selectedDate}','${assignedPlan.id}','${ex.id}',this.checked)" class="w-5 h-5 shrink-0 accent-emerald-500" aria-label="Completato ${ex.name}">
                  <div class="min-w-0 flex-1">
                    <div class="flex justify-between items-center gap-2">
                      <span class="text-sm font-bold ${done?'text-emerald-300 line-through':'text-white'}">${ex.name}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 font-semibold border border-cyan-800/50">${ex.category}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-1">RPE ${ex.rpe} · ${ex.weight} kg · ${ex.reps} reps · Recupero ${ex.recovery}s</div>
                  </div>
                </div>
              `; }).join('')}
            </div>
            <div id="workout-gamification-${selectedDate}" class="rounded-2xl bg-slate-950/70 border border-slate-800 p-3"></div>
          `;
          container.appendChild(planCard);
          const gbox=document.getElementById(`workout-gamification-${selectedDate}`);
          if(gbox){
            if(!scheduledToday){
              gbox.innerHTML=`<div class="flex items-center gap-2 text-[10px] text-slate-400"><i class="fa-solid fa-moon text-violet-300"></i><span>${tk('workout.plan_stays_active','La scheda resta attiva ogni giorno. Oggi non ci sono esercizi programmati.')}</span></div>`;
            }else{
              const gc=getWorkoutCompletion(selectedDate,assignedPlan.id);
              const dayExercises=getExercisesForDate(assignedPlan,selectedDate);
              const done=dayExercises.filter(ex=>gc.exercises?.[ex.id]).length;
              const pct=Math.round(done/Math.max(1,dayExercises.length)*100);
              gbox.innerHTML=`<div class="flex items-center justify-between"><span class="text-[10px] uppercase tracking-widest text-slate-500">Progressione scheda</span><span class="text-sm font-black ${pct===100?'text-emerald-300':'text-cyan-300'}">${done}/${todayPlanExercises.length}</span></div><div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style="width:${pct}%"></div></div><div class="mt-2 text-[10px] text-slate-400">${pct===100?'🏆 Scheda completata!':'Ti mancano '+(todayPlanExercises.length-done)+' esercizi per completarla.'}</div>`;
            }
          }
      }

      const dayWorkouts = appState.workouts.filter(w => w.date === selectedDate);
      let dayVolume = 0;

      if (dayWorkouts.length === 0 && !assignedPlanId) {
        container.innerHTML = `
          <div class="text-center py-10 bg-darkcard/50 rounded-2xl border border-dashed border-slate-800">
            <i class="fa-solid fa-dumbbell text-3xl text-slate-600 mb-2"></i>
            <p class="text-xs text-slate-400">Nessun esercizio per questa data.</p>
            <button onclick="openWorkoutPlans()" class="mt-3 text-xs text-cyan-400 font-bold hover:underline">Apri Schede</button>
          </div>
        `;
      }

      dayWorkouts.forEach(ex => {
        let exVolume = 0;
        let maxWeight = 0;
        ex.sets.forEach(s => {
          exVolume += (s.weight * s.reps);
          if (s.weight > maxWeight) maxWeight = s.weight;
        });
        dayVolume += exVolume;

        const topSet = ex.sets[0] || { weight: 0, reps: 0 };
        const est1RM = Math.round(topSet.weight * (1 + topSet.reps / 30));

        const card = document.createElement('div');
        card.className = "bg-darkcard border border-darkborder rounded-2xl p-4 space-y-3 shadow-md";
        card.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-sm font-bold text-white">${ex.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-400 font-semibold border border-cyan-800/50">${ex.category}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">
                Vol: <span class="text-cyan-400 font-bold">${exVolume} kg</span> | 1RM stima: <span class="text-emerald-400 font-bold">${est1RM} kg</span> | RPE: ${ex.rpe}
              </div>
            </div>
            <button onclick="deleteExercise('${ex.id}')" class="text-slate-500 hover:text-rose-400 text-xs p-1">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>

          <div class="space-y-2 pt-1">
            ${ex.sets.map((s, idx) => `
              <div class="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 text-xs">
                <span class="w-12 font-bold text-slate-400 text-[11px]">Set ${idx + 1}</span>
                <div class="flex items-center space-x-2">
                  <input type="number" value="${s.weight}" step="0.5" onchange="updateSet('${ex.id}', ${idx}, 'weight', this.value)" class="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-semibold text-white">
                  <span class="text-slate-500 text-[10px]">kg</span>
                  <span class="text-slate-500 font-bold">×</span>
                  <input type="number" value="${s.reps}" onchange="updateSet('${ex.id}', ${idx}, 'reps', this.value)" class="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-semibold text-white">
                  <span class="text-slate-500 text-[10px]">reps</span>
                </div>
                <button onclick="removeSet('${ex.id}', ${idx})" class="text-slate-600 hover:text-red-400 px-1">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            `).join('')}
          </div>

          <div class="flex justify-between items-center pt-1">
            <button onclick="addSetToExercise('${ex.id}')" class="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1">
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>Aggiungi Serie</span>
            </button>
            <button onclick="setRestTimer(90); toggleTimerModal();" class="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1">
              <i class="fa-solid fa-stopwatch text-cyan-400"></i>
              <span>Timer 90s</span>
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      const dailyTotalVolumeEl = document.getElementById('daily-total-volume');
      if (dailyTotalVolumeEl) dailyTotalVolumeEl.textContent = `${dayVolume} kg`;
    }

    // ----------------------------------------------------
    // REST TIMER LOGIC
    // ----------------------------------------------------
    let timerInterval = null;
    let timerSeconds = 90;
    let timerRunning = false;

    function syncTimerInputs() {
      const minutesInput = document.getElementById('timer-minutes-input');
      const secondsInput = document.getElementById('timer-seconds-input');
      if (!minutesInput || !secondsInput) return;

      const minutes = Math.floor(timerSeconds / 60);
      const seconds = timerSeconds % 60;
      minutesInput.value = Math.max(0, minutes);
      secondsInput.value = Math.max(0, seconds);
    }

    function setRestTimer(sec) {
      timerSeconds = Math.max(0, Number(sec) || 0);
      updateTimerDisplay();
    }

    function applyCustomTimer() {
      const minutesInput = document.getElementById('timer-minutes-input');
      const secondsInput = document.getElementById('timer-seconds-input');
      if (!minutesInput || !secondsInput) return;

      const minutes = Math.max(0, Number(minutesInput.value) || 0);
      const seconds = Math.max(0, Math.min(59, Number(secondsInput.value) || 0));
      const totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 0) {
        showToast('Inserisci un tempo valido');
        return;
      }

      timerSeconds = totalSeconds;
      updateTimerDisplay();
    }

    function updateTimerDisplay() {
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      const timerDisplay = document.getElementById('timer-display');
      if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
      syncTimerInputs();
    }

    function toggleTimerStart() {
      const btn = document.getElementById('timer-start-btn');
      if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = 'Avvia';
        btn.className = "flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm";
      } else {
        timerRunning = true;
        btn.textContent = 'Pausa';
        btn.className = "flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm";
        document.getElementById('timer-badge').classList.remove('hidden');

        timerInterval = setInterval(() => {
          if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
          } else {
            clearInterval(timerInterval);
            timerRunning = false;
            btn.textContent = 'Completato!';
            document.getElementById('timer-badge').classList.add('hidden');
            playTimerSound();
            showToast('Tempo di recupero terminato!', 'fa-bell');
          }
        }, 1000);
      }
    }

    function resetTimer() {
      clearInterval(timerInterval);
      timerRunning = false;
      timerSeconds = 90;
      updateTimerDisplay();
      const timerBadge = document.getElementById('timer-badge');
      if (timerBadge) timerBadge.classList.add('hidden');
      const timerStartBtn = document.getElementById('timer-start-btn');
      if (timerStartBtn) {
        timerStartBtn.textContent = 'Avvia';
        timerStartBtn.className = 'flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm';
      }
    }

    function toggleTimerModal() {
      const modal = document.getElementById('modal-timer');
      if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        updateTimerDisplay();
      } else {
        modal.classList.add('hidden');
      }
    }

    function playTimerSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {
        console.log("Audio Web API restricted");
      }
    }

    function getActiveWorkoutPlan(){
      let plan=(appState.workoutPlans||[]).find(p=>p.id===appState.activeWorkoutPlanId)||null;
      if(!plan){
        const entries=Object.entries(appState.workoutAssignments||{}).sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
        const legacyId=entries[0]?.[1];
        plan=(appState.workoutPlans||[]).find(p=>p.id===legacyId)||null;
        if(plan)appState.activeWorkoutPlanId=plan.id;
      }
      return plan;
    }
    function getItalianWeekday(date){return ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][new Date(date+'T12:00:00').getDay()];}
    function getPlanDays(plan){return [...new Set((plan?.exercises||[]).map(ex=>ex.dayOfWeek||plan?.dayOfWeek||'Lunedì'))];}
    function getExercisesForDate(plan,date){if(!plan)return[];const wd=getItalianWeekday(date);return (plan.exercises||[]).filter(ex=>(ex.dayOfWeek||plan.dayOfWeek||'Lunedì')===wd);}
    function isPlanScheduledOnDate(plan,date){return getExercisesForDate(plan,date).length>0;}
    function getDayWorkoutPlan(date){const plan=getActiveWorkoutPlan();return isPlanScheduledOnDate(plan,date)?plan:null;}
    function getWorkoutCompletion(date,planId){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=appState.workoutCompletions[date];
      if(!c || c.planId!==planId) return {planId,exercises:{}};
      return c;
    }
    function isWorkoutExerciseCompleted(date,planId,exerciseId){ return !!getWorkoutCompletion(date,planId).exercises?.[exerciseId]; }
    function isWorkoutPlanCompleted(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return false;
      const dayExercises=getExercisesForDate(plan,date);if(!dayExercises.length)return false;
      const c=getWorkoutCompletion(date,planId); return dayExercises.every(ex=>!!c.exercises?.[ex.id]);
    }
    function updateWorkoutCompletion(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      const dayExercises=getExercisesForDate(plan,date),c=getWorkoutCompletion(date,planId);
      const done=dayExercises.filter(ex=>c.exercises?.[ex.id]).length;
      c.planId=planId; c.completedAt=dayExercises.length&&done===dayExercises.length?new Date().toISOString():null;
      appState.workoutCompletions[date]=c; saveStateToLocal(); renderWorkouts(); renderHomeDashboard(); updateAnalyticsCharts(); checkWorkoutMilestones(date);
    }
    function toggleWorkoutExerciseComplete(date,planId,exerciseId,checked){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=getWorkoutCompletion(date,planId); c.exercises=c.exercises||{}; c.exercises[exerciseId]=!!checked; appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Esercizio completato!':'Esercizio riaperto',checked?'fa-check':'fa-rotate-left');
    }
    function toggleWorkoutPlanComplete(date,planId,checked){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      appState.workoutCompletions=appState.workoutCompletions||{}; const c=getWorkoutCompletion(date,planId); c.exercises={}; plan.exercises.forEach(ex=>c.exercises[ex.id]=!!checked); appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Scheda completata! +100 XP':'Scheda segnata come incompleta',checked?'fa-trophy':'fa-rotate-left');
    }

const THALYS_WEEKDAYS=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
let planBuilderDay='Lunedì',planBuilderDraft={},planBuilderRest=new Set(),editingWorkoutPlanIdV7=null;
let planViewerIdV7=null,planViewerDayV7='Lunedì';

function normalizePlanExerciseV7(ex={}){
  return {id:ex.id||('plan_ex_'+Date.now()+'_'+Math.random().toString(16).slice(2)),name:String(ex.name||'').trim(),dayOfWeek:THALYS_WEEKDAYS.includes(ex.dayOfWeek)?ex.dayOfWeek:'Lunedì',category:ex.category||'Altro',series:Math.max(1,Math.round(Number(ex.series??ex.setsCount??ex.sets?.length??3)||3)),reps:Math.max(1,Math.round(Number(ex.reps)||8)),weight:Math.max(0,Number(ex.weight)||0),rpe:Math.min(10,Math.max(1,Number(ex.rpe)||8)),recovery:Math.max(0,Math.round(Number(ex.recovery)||90))};
}
function normalizeWorkoutPlanV7(plan={}){
  return {...plan,exercises:(plan.exercises||[]).map(normalizePlanExerciseV7).filter(x=>x.name),restDays:[...new Set((plan.restDays||[]).filter(d=>THALYS_WEEKDAYS.includes(d)))]};
}
function getPlanDays(plan){const p=normalizeWorkoutPlanV7(plan);return THALYS_WEEKDAYS.filter(d=>p.restDays.includes(d)||p.exercises.some(x=>x.dayOfWeek===d));}
function getExercisesForDate(plan,date){if(!plan)return[];const p=normalizeWorkoutPlanV7(plan),wd=getItalianWeekday(date);return p.restDays.includes(wd)?[]:p.exercises.filter(x=>x.dayOfWeek===wd);}
function isPlanRestDay(plan,date){if(!plan)return false;const p=normalizeWorkoutPlanV7(plan),wd=getItalianWeekday(date);return p.restDays.includes(wd)||(!p.exercises.some(x=>x.dayOfWeek===wd)&&getPlanDays(p).length>0);}

/* Plan builder */
function resetPlanBuilderV7(){planBuilderDay='Lunedì';planBuilderDraft={};planBuilderRest=new Set();editingWorkoutPlanIdV7=null;THALYS_WEEKDAYS.forEach(d=>planBuilderDraft[d]=[]);}
function startNewWorkoutPlan(){resetPlanBuilderV7();document.getElementById('plan-builder-panel')?.classList.remove('hidden');document.getElementById('workout-plan-library')?.classList.add('hidden');const n=document.getElementById('plan-name');if(n)n.value='';renderPlanBuilderV7();}
function cancelPlanBuilder(){document.getElementById('plan-builder-panel')?.classList.add('hidden');document.getElementById('workout-plan-library')?.classList.remove('hidden');resetPlanBuilderV7();renderWorkoutPlans();}
function selectPlanBuilderDay(d){planBuilderDay=d;renderPlanBuilderV7();}
function togglePlanBuilderRest(v){if(v)planBuilderRest.add(planBuilderDay);else planBuilderRest.delete(planBuilderDay);renderPlanBuilderV7();}
function addPlanExerciseV7(ex={}){planBuilderRest.delete(planBuilderDay);planBuilderDraft[planBuilderDay] ||= [];planBuilderDraft[planBuilderDay].push(normalizePlanExerciseV7({...ex,dayOfWeek:planBuilderDay,name:ex.name||''}));renderPlanBuilderV7();}
function removePlanExerciseV7(day,i){planBuilderDraft[day]?.splice(i,1);renderPlanBuilderV7();}
function updatePlanDraftFieldV7(day,i,k,v){const ex=planBuilderDraft[day]?.[i];if(!ex)return;ex[k]=['series','reps','recovery'].includes(k)?Math.round(Number(v)||0):['weight','rpe'].includes(k)?Number(v)||0:v;}
function renderPlanBuilderV7(){
  const days=document.getElementById('plan-builder-days'),box=document.getElementById('plan-builder-exercises');if(!days||!box)return;
  days.innerHTML=THALYS_WEEKDAYS.map(d=>`<button type="button" onclick="selectPlanBuilderDay('${d}')" class="v7-day-btn ${d===planBuilderDay?'active':''}">${tr(d)}<div class="mt-1 text-[8px] opacity-60">${planBuilderRest.has(d)?'🌙 '+tr('Riposo'):(planBuilderDraft[d]?.length||0)+' '+tr('esercizi')}</div></button>`).join('');
  document.getElementById('plan-builder-day-title').textContent=tr(planBuilderDay);document.getElementById('plan-day-rest').checked=planBuilderRest.has(planBuilderDay);document.getElementById('plan-builder-add-btn')?.classList.toggle('hidden',planBuilderRest.has(planBuilderDay));
  if(planBuilderRest.has(planBuilderDay)){box.innerHTML=`<div class="min-h-52 flex items-center justify-center rounded-2xl bg-violet-500/5 text-center"><div><div class="text-4xl">🌙</div><div class="mt-3 font-black text-violet-200">${tr('Giorno di riposo')}</div></div></div>`;return;}
  const arr=planBuilderDraft[planBuilderDay]||[];
  box.innerHTML=arr.length?arr.map((x,i)=>`<div class="v7-ex-card"><div class="flex gap-2"><input value="${escapeHTML(x.name)}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'name',this.value)" placeholder="${tr('Nome esercizio')}" class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-[10px] text-white"><button type="button" onclick="removePlanExerciseV7('${planBuilderDay}',${i})" class="w-9 rounded-lg bg-rose-500/10 text-rose-300"><i class="fa-solid fa-trash"></i></button></div><div class="mt-2 grid grid-cols-2 gap-2">
  <label class="text-[8px] text-slate-500">${tr('Categoria')}<select onchange="updatePlanDraftFieldV7('${planBuilderDay}',${i},'category',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white">${['Petto','Dorso','Gambe','Spalle','Braccia','Core','Cardio','Altro'].map(c=>`<option ${c===x.category?'selected':''}>${c}</option>`).join('')}</select></label>
  <label class="text-[8px] text-slate-500">${tr('Serie')}<input type="number" min="1" value="${x.series}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'series',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white"></label>
  <label class="text-[8px] text-slate-500">${tr('Ripetizioni')}<input type="number" min="1" value="${x.reps}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'reps',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white"></label>
  <label class="text-[8px] text-slate-500">${tr('Peso kg')}<input type="number" min="0" step=".5" value="${x.weight}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'weight',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white"></label>
  <label class="text-[8px] text-slate-500">RPE<input type="number" min="1" max="10" value="${x.rpe}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'rpe',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white"></label>
  <label class="text-[8px] text-slate-500">${tr('Recupero sec')}<input type="number" min="0" value="${x.recovery}" oninput="updatePlanDraftFieldV7('${planBuilderDay}',${i},'recovery',this.value)" class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-[10px] text-white"></label></div></div>`).join(''):`<div class="rounded-2xl border border-dashed border-slate-800 p-5 text-center text-[10px] text-slate-500">${tr('Nessun esercizio. Aggiungine uno oppure imposta Riposo.')}</div>`;
}
function saveWorkoutPlanV7(e){e.preventDefault();const name=document.getElementById('plan-name')?.value.trim();if(!name)return showToast(tr('Inserisci il nome della scheda'));const exercises=THALYS_WEEKDAYS.flatMap(d=>planBuilderRest.has(d)?[]:(planBuilderDraft[d]||[])).filter(x=>x.name).map(normalizePlanExerciseV7),restDays=[...planBuilderRest];if(!exercises.length&&!restDays.length)return showToast(tr('Imposta almeno un allenamento o un giorno di riposo'));const old=(appState.workoutPlans||[]).find(x=>x.id===editingWorkoutPlanIdV7),p={...(old||{}),id:old?.id||('plan_'+Date.now()),name,exercises,restDays,schemaVersion:2,updatedAt:new Date().toISOString()};if(old)appState.workoutPlans[appState.workoutPlans.findIndex(x=>x.id===old.id)]=p;else appState.workoutPlans.push(p);saveStateToLocal();cancelPlanBuilder();renderWorkoutPlans();refreshConsultSelectors();showToast(old?tr('Scheda modificata ✓'):tr('Scheda salvata!'));}
function editWorkoutPlan(id){const p0=(appState.workoutPlans||[]).find(x=>x.id===id);if(!p0)return;resetPlanBuilderV7();editingWorkoutPlanIdV7=id;const p=normalizeWorkoutPlanV7(p0);p.exercises.forEach(x=>(planBuilderDraft[x.dayOfWeek] ||= []).push({...x}));planBuilderRest=new Set(p.restDays||[]);document.getElementById('plan-name').value=p.name;document.getElementById('plan-builder-panel')?.classList.remove('hidden');document.getElementById('workout-plan-library')?.classList.add('hidden');renderPlanBuilderV7();}
function renderWorkoutPlans(){const list=document.getElementById('workout-plans-list');if(!list)return;const ps=(appState.workoutPlans||[]).map(normalizeWorkoutPlanV7);list.innerHTML=ps.length?ps.map(p=>`<div class="rounded-2xl border ${p.id===appState.activeWorkoutPlanId?'border-emerald-500/35':'border-slate-800'} bg-slate-900/60 p-3"><button type="button" onclick="viewWorkoutPlan('${p.id}')" class="w-full text-left"><div class="flex justify-between"><b class="text-sm text-white">${escapeHTML(p.name)}</b>${p.id===appState.activeWorkoutPlanId?'<span class="text-[8px] font-black text-emerald-300">ATTIVA</span>':''}</div><div class="mt-1 text-[9px] text-slate-500">${p.exercises.length} ${tr('esercizi')} · ${p.restDays.length} ${tr('giorni riposo')} · ${tr('Tocca per visualizzare')}</div></button><div class="mt-2 flex gap-2"><button type="button" onclick="viewWorkoutPlan('${p.id}')" class="flex-1 rounded-lg bg-slate-800 py-2 text-[9px] font-bold text-cyan-300">${tr('Visualizza')}</button><button type="button" onclick="editWorkoutPlan('${p.id}')" class="rounded-lg bg-slate-800 px-3 text-[9px] text-violet-300">${tr('Modifica')}</button><button type="button" onclick="deleteWorkoutPlan('${p.id}')" class="rounded-lg bg-rose-500/10 px-3 text-rose-300"><i class="fa-solid fa-trash"></i></button></div></div>`).join(''):`<div class="p-5 text-center text-[10px] text-slate-500">${tr('Nessuna scheda salvata.')}</div>`;}
function viewWorkoutPlan(id,d='Lunedì'){planViewerIdV7=id;planViewerDayV7=d;renderPlanViewerV7();openModal('workout-plan-viewer-modal');}
function selectPlanViewerDayV7(d){planViewerDayV7=d;renderPlanViewerV7();}
function renderPlanViewerV7(){const raw=(appState.workoutPlans||[]).find(x=>x.id===planViewerIdV7);if(!raw)return;const p=normalizeWorkoutPlanV7(raw),ds=document.getElementById('plan-view-days'),box=document.getElementById('plan-view-content');document.getElementById('plan-view-title').textContent=p.name;ds.innerHTML=THALYS_WEEKDAYS.map(d=>`<button type="button" onclick="selectPlanViewerDayV7('${d}')" class="v7-day-btn ${d===planViewerDayV7?'active':''}">${tr(d)}<div class="mt-1 text-[8px] opacity-60">${p.restDays.includes(d)?'🌙 '+tr('Riposo'):p.exercises.filter(x=>x.dayOfWeek===d).length+' '+tr('esercizi')}</div></button>`).join('');const ex=p.exercises.filter(x=>x.dayOfWeek===planViewerDayV7);box.innerHTML=p.restDays.includes(planViewerDayV7)||!ex.length?`<div class="h-full flex items-center justify-center text-center"><div><div class="text-4xl">🌙</div><div class="mt-3 font-black text-violet-200">${tr('Giorno di riposo')}</div></div></div>`:ex.map(x=>`<div class="mb-2 rounded-xl bg-slate-900/75 p-3"><div class="flex justify-between"><b class="text-xs text-white">${escapeHTML(x.name)}</b><span class="text-[8px] text-cyan-300">${x.category}</span></div><div class="mt-2 text-[10px] text-slate-400"><b class="text-white">${x.series} ${tr('serie')}</b> × ${x.reps} reps · ${x.weight} kg · RPE ${x.rpe} · ${x.recovery}s</div></div>`).join('');document.getElementById('plan-view-edit').onclick=()=>{closeModal('workout-plan-viewer-modal');editWorkoutPlan(p.id)};document.getElementById('plan-view-export').onclick=()=>exportWorkoutPlan(p.id);const a=document.getElementById('plan-view-activate');a.textContent=p.id===appState.activeWorkoutPlanId?tr('Scheda attiva'):tr('Rendi attiva');a.disabled=p.id===appState.activeWorkoutPlanId;a.onclick=()=>{activateWorkoutPlan(p.id);renderPlanViewerV7()};}
function activateWorkoutPlan(id){const now=new Date().toISOString();appState.activeWorkoutPlanHistory=Array.isArray(appState.activeWorkoutPlanHistory)?appState.activeWorkoutPlanHistory:[];appState.activeWorkoutPlanHistory.filter(x=>!x.deactivatedAt&&x.planId!==id).forEach(x=>x.deactivatedAt=now);if(appState.activeWorkoutPlanId!==id){const p=(appState.workoutPlans||[]).find(x=>x.id===id);appState.activeWorkoutPlanHistory.push({id:'active_'+Date.now(),planId:id,planName:p?.name||'',activatedAt:now,deactivatedAt:null});}appState.activeWorkoutPlanId=id;saveStateToLocal();renderWorkouts();renderWorkoutPlans();renderHomeDashboard();showToast(`${tr('Scheda attiva')}: ${(appState.workoutPlans||[]).find(x=>x.id===id)?.name||''}`);}
function importWorkoutPlanFile(){const i=document.createElement('input');i.type='file';i.accept='application/json';i.onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x?.name||!Array.isArray(x.exercises))throw 0;appState.workoutPlans.push(normalizeWorkoutPlanV7({...x,id:x.id||('plan_'+Date.now())}));saveStateToLocal();renderWorkoutPlans();showToast(tr('Scheda importata'));}catch(_){showToast(tr('File schema non valido'));}};r.readAsText(f)};i.click();}

/* Active workout and history */
function recordCompletedWorkoutDayV7(date,plan){const p=normalizeWorkoutPlanV7(plan),ex=getExercisesForDate(p,date);if(!ex.length)return;appState.workoutHistory=Array.isArray(appState.workoutHistory)?appState.workoutHistory:[];const id=`${date}|${p.id}`,rec={id,date,planId:p.id,planName:p.name,weekday:getItalianWeekday(date),completedAt:new Date().toISOString(),exercises:ex.map(x=>({...x,sets:Array.from({length:x.series},(_,i)=>({set:i+1,weight:x.weight,reps:x.reps}))}))},old=appState.workoutHistory.find(x=>x.id===id);if(old)Object.assign(old,rec);else appState.workoutHistory.push(rec);appState.workouts=(appState.workouts||[]).filter(x=>!(x.source==='plan'&&x.date===date&&x.planId===p.id));rec.exercises.forEach(x=>appState.workouts.push({id:`wh_${date}_${p.id}_${x.id}`,date,planId:p.id,planName:p.name,name:x.name,category:x.category,rpe:x.rpe,recovery:x.recovery,series:x.series,sets:x.sets.map(s=>({weight:s.weight,reps:s.reps})),source:'plan',completedAt:rec.completedAt}));}
function removeCompletedWorkoutDayV7(date,id){appState.workoutHistory=(appState.workoutHistory||[]).filter(x=>!(x.date===date&&x.planId===id));appState.workouts=(appState.workouts||[]).filter(x=>!(x.source==='plan'&&x.date===date&&x.planId===id));}
function updateWorkoutCompletion(date,id){const p=(appState.workoutPlans||[]).find(x=>x.id===id);if(!p)return;const ex=getExercisesForDate(p,date),c=getWorkoutCompletion(date,id),done=ex.filter(x=>c.exercises?.[x.id]).length;c.planId=id;c.completedAt=ex.length&&done===ex.length?new Date().toISOString():null;appState.workoutCompletions[date]=c;if(c.completedAt)recordCompletedWorkoutDayV7(date,p);else removeCompletedWorkoutDayV7(date,id);saveStateToLocal();renderWorkouts();renderHomeDashboard();updateAnalyticsCharts();checkWorkoutMilestones(date);}
function toggleWorkoutPlanComplete(date,id,on){const p=(appState.workoutPlans||[]).find(x=>x.id===id);if(!p)return;const c=getWorkoutCompletion(date,id);c.exercises={};getExercisesForDate(p,date).forEach(x=>c.exercises[x.id]=!!on);appState.workoutCompletions[date]=c;updateWorkoutCompletion(date,id);}
function renderWorkouts(){const date=document.getElementById('workout-date')?.value||currentLocalDateStr(),box=document.getElementById('workout-list');if(!box)return;box.innerHTML='';const raw=getActiveWorkoutPlan();if(!raw){box.innerHTML=`<div class="p-8 text-center rounded-3xl border border-dashed border-slate-800"><div class="text-sm font-black">${tr('Nessuna scheda attiva')}</div><button type="button" onclick="openWorkoutPlans()" class="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950">${tr('Apri Schede')}</button></div>`;return;}const p=normalizeWorkoutPlanV7(raw),day=getItalianWeekday(date),ex=getExercisesForDate(p,date);if(isPlanRestDay(p,date)){box.innerHTML=`<div class="rounded-3xl border border-violet-500/20 bg-slate-950 p-4"><div class="text-[9px] text-cyan-300">${tr('Scheda attiva')}</div><div class="text-lg font-black">${escapeHTML(p.name)} 🌙</div><div class="py-10 text-center"><div class="text-5xl">🌙</div><div class="mt-3 text-xl font-black text-violet-200">${tr('Giorno di riposo')}</div></div></div>`;return;}const c=getWorkoutCompletion(date,p.id),done=ex.filter(x=>c.exercises?.[x.id]).length,pct=Math.round(done/Math.max(1,ex.length)*100);box.innerHTML=`<div class="rounded-3xl border border-cyan-500/25 bg-slate-950 p-4"><div class="text-[9px] text-cyan-300">${tr('Scheda attiva')}</div><div class="text-lg font-black">${escapeHTML(p.name)}</div><div class="mt-1 text-[9px] text-slate-500">${tr(day)}</div><div class="mt-3 space-y-2">${ex.map(x=>{const ok=!!c.exercises?.[x.id];return `<label class="flex gap-3 rounded-2xl border ${ok?'border-emerald-500/30':'border-slate-800'} bg-slate-900/70 p-3"><input type="checkbox" ${ok?'checked':''} onchange="toggleWorkoutExerciseComplete('${date}','${p.id}','${x.id}',this.checked)" class="h-5 w-5 accent-emerald-500"><div class="flex-1"><b class="${ok?'line-through text-emerald-300':'text-white'}">${escapeHTML(x.name)}</b><div class="mt-1 text-[10px] text-slate-400"><b>${x.series} ${tr('serie')}</b> × ${x.reps} reps · ${x.weight} kg · RPE ${x.rpe} · ${x.recovery}s</div></div></label>`}).join('')}</div><label class="mt-3 flex justify-between rounded-xl bg-slate-900 p-3 text-[10px] font-bold"><span>${pct===100?'🏆 '+tr('Allenamento completato'):`${done}/${ex.length} ${tr('esercizi completati')}`}</span><input type="checkbox" ${pct===100?'checked':''} onchange="toggleWorkoutPlanComplete('${date}','${p.id}',this.checked)" class="accent-emerald-500"></label></div>`;}
function openWorkoutHistory(){const d=document.getElementById('workout-history-date');if(d)d.value=currentLocalDateStr();renderWorkoutHistory();openModal('workout-history-modal');}
function setWorkoutHistoryDate(d){const e=document.getElementById('workout-history-date');if(e)e.value=d;renderWorkoutHistory();}
function renderWorkoutHistory(){const box=document.getElementById('workout-history-list');if(!box)return;const d=document.getElementById('workout-history-date')?.value||'',rows=[...(appState.workoutHistory||[])].filter(x=>!d||x.date===d).sort((a,b)=>String(b.date).localeCompare(String(a.date)));box.innerHTML=rows.length?rows.map(r=>`<div class="rounded-2xl bg-slate-900/65 p-3"><div class="flex justify-between"><b>${escapeHTML(r.planName)}</b><span class="text-[9px] text-emerald-300">${r.date}</span></div><div class="mt-2 space-y-1">${(r.exercises||[]).map(x=>`<div class="rounded-xl bg-slate-950 p-2 text-[9px]"><b>${escapeHTML(x.name)}</b><div class="text-slate-500">${x.series||x.sets?.length||0} ${tr('serie')} × ${x.reps} · ${x.weight} kg · RPE ${x.rpe} · ${x.recovery}s</div></div>`).join('')}</div></div>`).join(''):`<div class="p-5 text-center text-[10px] text-slate-500">${tr('Nessun allenamento completato per il filtro scelto.')}</div>`;}

