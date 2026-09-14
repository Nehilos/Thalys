// Thalys v0.29 - Nutrition domain extracted from app-core.js
// Food logging, water, nutrition targets, presets and nutrition rendering.

    function persistFoodDatabase(){appState.presets=sortFoodPresetsNewestFirst((appState.presets||[]).map(normalizeFoodPreset).filter(x=>x.name));saveStateToLocal({source:'nutrition-presets'}); }

    function shiftNutritionDate(days) {
      const input = document.getElementById('nutrition-date');
      const cur = new Date(input.value);
      cur.setDate(cur.getDate() + days);
      input.value = cur.toISOString().split('T')[0];
      renderNutrition();
      // Aggiorna grafici quando cambia la data
      updateAnalyticsCharts();
    }

    function normalizeVitaminCodes(value, group='id') {
      const allowed = group === 'lip' ? ['A','D','E','K'] : ['B1','B2','B3','B5','B6','B7','B9','B12','C'];
      const raw = String(value || '').toUpperCase().replace(/VITAMIN[AE]?/g,' ').replace(/[;,/|]+/g,' ').split(/\s+/).filter(Boolean);
      return [...new Set(raw.filter(x => allowed.includes(x)))].join(' ');
    }

    function mergeVitaminCodes(values, group='id') {
      return normalizeVitaminCodes((values || []).filter(Boolean).join(' '), group);
    }

    function updateFoodDosePreview(){
      const grams=Math.max(0,Number(document.getElementById('food-grams')?.value||0)); const r=grams/100;
      const n=id=>Number(document.getElementById(id)?.value||0); const kcal=Math.round(n('food-kcal')*r);
      const el=document.getElementById('food-dose-preview'); if(!el)return;
      el.innerHTML=`Dose ${grams||0} g → <b class="text-slate-200">${kcal} kcal</b> · P ${(n('food-p')*r).toFixed(1)}g · C ${(n('food-c')*r).toFixed(1)}g · G ${(n('food-f')*r).toFixed(1)}g · saturi ${(n('food-sat-fat')*r).toFixed(1)}g`;
    }

    function openFoodForMeal(meal){openModal('add-food-modal');setTimeout(()=>{const s=document.getElementById('food-meal');if(s)s.value=meal},0)}

    function saveFoodLog(e) {
      e.preventDefault();
      const date = document.getElementById('nutrition-date').value;
      const name = document.getElementById('food-name').value.trim();
      const meal = document.getElementById('food-meal').value;
      const grams = Math.max(0, parseFloat(document.getElementById('food-grams').value) || 0);
      const ratio = grams / 100;
      const base = id => parseFloat(document.getElementById(id)?.value) || 0;
      const p = base('food-p') * ratio, c = base('food-c') * ratio, f = base('food-f') * ratio;
      const satFat = base('food-sat-fat') * ratio, sugars = base('food-sugars') * ratio;
      const calcium = base('food-calcium') * ratio, magnesium = base('food-magnesium') * ratio, zinc = base('food-zinc') * ratio;
      const fiber = base('food-fiber') * ratio, salt = base('food-salt') * ratio;
      const iron = base('food-iron') * ratio, potassium = base('food-potassium') * ratio;
      const vitaminsId = normalizeVitaminCodes(document.getElementById('food-vitamins-id')?.value,'id');
      const vitaminsLip = normalizeVitaminCodes(document.getElementById('food-vitamins-lip')?.value,'lip');
      const baseKcal=base('food-kcal'); const kcal=baseKcal>0?Math.round(baseKcal*ratio):Math.round((p*4)+(c*4)+(f*9));
      const newLog={id:'food_'+Date.now(),date,name,meal,grams,p,c,f,satFat,sugars,calcium,magnesium,zinc,fiber,salt,iron,potassium,vitaminsId,vitaminsLip,kcal};
      appState.nutrition.push(newLog); saveStateToLocal(); closeModal('add-food-modal'); document.getElementById('add-food-form').reset();
      const gramsEl=document.getElementById('food-grams');if(gramsEl)gramsEl.value=100; updateFoodDosePreview(); renderNutrition(); updateAnalyticsCharts(); showToast('Alimento salvato ✓','fa-circle-check');
    }

    function deleteFoodLog(id) {
      appState.nutrition = appState.nutrition.filter(n => n.id !== id);
      saveStateToLocal();
      renderNutrition();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Alimento rimosso');
    }

    function getWaterTarget(date){
      const manual=Number(appState.settings?.waterTargetMl||0);
      if(manual>=500) return Math.round(manual/50)*50;
      const latest=(appState.bodyMetrics||[]).filter(x=>x.date<=date && Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      const kg=latest?.weight || appState.profile?.weight || 70;
      return Math.round(Math.max(1500,Math.min(4000,kg*35))/50)*50;
    }

    function openWaterTargetModal(){const date=document.getElementById('nutrition-date')?.value||homeSelectedDate||new Date().toISOString().split('T')[0];const el=document.getElementById('water-target-input');if(el)el.value=getWaterTarget(date);openModal('water-target-modal');}

    function setWaterTargetQuick(v){const el=document.getElementById('water-target-input');if(el)el.value=v;}

    function saveWaterTarget(){const el=document.getElementById('water-target-input');const v=Math.round((Number(el?.value)||0)/50)*50;if(v<500||v>8000)return showToast('Inserisci un target tra 500 e 8000 ml','fa-triangle-exclamation');appState.settings=appState.settings||{};appState.settings.waterTargetMl=v;saveStateToLocal();renderNutrition();renderHomeDashboard();closeModal('water-target-modal');showToast(`Target acqua salvato: ${v} ml`,'fa-glass-water');}

    function openNutritionInfo(){openModal('nutrition-info-modal');}

    function addWater(amountMs) {
      const date = document.getElementById('nutrition-date').value || homeSelectedDate || new Date().toISOString().split('T')[0];
      const current = appState.water[date] || 0;
      const updated = Math.max(0, current + amountMs);
      appState.water[date] = updated;
      appState.waterUpdatedAt = appState.waterUpdatedAt || {};
      appState.waterUpdatedAt[date] = new Date().toISOString();
      saveStateToLocal();
      renderNutrition();
      renderHomeDashboard();
      renderTodayDashboard();
      updateManualSyncUI();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
    }

    function nutritionScore(value,target,isMaximum=false){
      const v=Math.max(0,Number(value)||0),t=Math.max(.0001,Number(target)||1);
      if(isMaximum){
        if(v<=t)return 100;
        return Math.max(0,Math.min(100,(t/v)*100));
      }
      return Math.max(0,Math.min(100,(v/t)*100));
    }

    function nutritionNutrientDefinitions(target={},waterTarget=2500){
      return [
        {key:'kcal',label:'Calorie',target:Number(target.calories||2200),unit:'kcal',rgb:[244,63,94]},
        {key:'p',label:'Proteine',target:Number(target.p||150),unit:'g',rgb:[251,113,133]},
        {key:'c',label:'Carboidrati',target:Number(target.c||250),unit:'g',rgb:[251,191,36]},
        {key:'f',label:'Grassi',target:Number(target.f||70),unit:'g',rgb:[96,165,250]},
        {key:'satFat',label:'Grassi saturi',target:Number(target.satFat||20),unit:'g',maximum:true,rgb:[56,189,248]},
        {key:'sugars',label:'Zuccheri',target:Number(target.sugars||50),unit:'g',maximum:true,rgb:[167,139,250]},
        {key:'fiber',label:'Fibre',target:Number(target.fiber||30),unit:'g',rgb:[251,191,36]},
        {key:'calcium',label:'Calcio',target:Number(target.calcium||1000),unit:'mg',rgb:[34,211,238]},
        {key:'magnesium',label:'Magnesio',target:Number(target.magnesium||350),unit:'mg',rgb:[52,211,153]},
        {key:'zinc',label:'Zinco',target:Number(target.zinc||11),unit:'mg',rgb:[45,212,191]},
        {key:'iron',label:'Ferro',target:Number(target.iron||11),unit:'mg',rgb:[251,146,60]},
        {key:'potassium',label:'Potassio',target:Number(target.potassium||3500),unit:'mg',rgb:[163,230,53]},
        {key:'salt',label:'Sale',target:Number(target.salt||5),unit:'g',maximum:true,rgb:[232,121,249]},
        {key:'water',label:'Acqua',target:Number(waterTarget||2500),unit:'ml',rgb:[96,165,250]}
      ];
    }

    function computeWeeklyNutritionSummary(referenceDate){
      const target=appState.targets||{};
      const ref=referenceDate||document.getElementById('nutrition-date')?.value||currentLocalDateStr();
      const dates=[];
      for(let i=6;i>=0;i--){
        const d=new Date(ref+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));
      }
      const daySummaries=dates.map(date=>{
        const items=(appState.nutrition||[]).filter(item=>item.date===date);
        return {
          date,
          kcal:items.reduce((s,x)=>s+Number(x.kcal||0),0),
          p:items.reduce((s,x)=>s+Number(x.p||0),0),
          c:items.reduce((s,x)=>s+Number(x.c||0),0),
          f:items.reduce((s,x)=>s+Number(x.f||0),0),
          satFat:items.reduce((s,x)=>s+Number(x.satFat||0),0),
          sugars:items.reduce((s,x)=>s+Number(x.sugars||0),0),
          fiber:items.reduce((s,x)=>s+Number(x.fiber||0),0),
          calcium:items.reduce((s,x)=>s+Number(x.calcium||0),0),
          magnesium:items.reduce((s,x)=>s+Number(x.magnesium||0),0),
          zinc:items.reduce((s,x)=>s+Number(x.zinc||0),0),
          iron:items.reduce((s,x)=>s+Number(x.iron||0),0),
          potassium:items.reduce((s,x)=>s+Number(x.potassium||0),0),
          salt:items.reduce((s,x)=>s+Number(x.salt||0),0),
          water:Number(appState.water?.[date]||0),
          vitaminsId:mergeVitaminCodes(items.map(x=>x.vitaminsId),'id'),
          vitaminsLip:mergeVitaminCodes(items.map(x=>x.vitaminsLip),'lip'),
          hasFood:items.length>0
        };
      });
      const quantitative=nutritionNutrientDefinitions(target,getWaterTarget(ref));
      const allVitId=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsId),'id');
      const allVitLip=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsLip),'lip');
      const averages={};
      quantitative.forEach(n=>averages[n.key]=Number((daySummaries.reduce((s,d)=>s+Number(d[n.key]||0),0)/7).toFixed(n.unit==='mg'?1:2)));
      const scores=quantitative.map(n=>nutritionScore(averages[n.key],n.target,n.maximum));
      scores.push((allVitId?allVitId.split(/\s+/).filter(Boolean).length:0)/9*100);
      scores.push((allVitLip?allVitLip.split(/\s+/).filter(Boolean).length:0)/4*100);
      const compliance=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)||0;
      const missing=quantitative
        .map((n,i)=>({label:n.label,score:scores[i]}))
        .filter(x=>x.score<80)
        .sort((a,b)=>a.score-b.score)
        .slice(0,5)
        .map(x=>x.label.toLowerCase());
      const summary={
        compliance,
        isComplete:compliance>=70,
        missing,
        averages,
        daySummaries,
        vitaminsId:allVitId,
        vitaminsLip:allVitLip,
        trackedDays:daySummaries.filter(x=>x.hasFood).length,
        referenceDate:ref
      };
      appState.weeklyNutritionStatus={compliance:summary.compliance,isComplete:summary.isComplete,missing:summary.missing};
      return summary;
    }

    function renderNutritionAnalytics(weeklySummary,daily,vitId,vitLip,waterVal,waterTarget){
      const target=appState.targets||{};
      const defs=nutritionNutrientDefinitions(target,waterTarget);
      const scoreEl=document.getElementById('nutrition-week-score');
      if(scoreEl)scoreEl.textContent=`${weeklySummary.compliance}%`;

      const bars=document.getElementById('nutrition-week-bars');
      if(bars){
        bars.innerHTML=defs.map(n=>{
          const value=Number(weeklySummary.averages?.[n.key]||0);
          const score=Math.round(nutritionScore(value,n.target,n.maximum));
          const width=Math.max(2,Math.min(100,score));
          const cap=n.maximum?tr('max'):tr('target');
          return `<div class="rounded-xl bg-slate-950/45 p-2.5">
            <div class="flex items-center justify-between gap-2 text-[10px]">
              <span class="font-bold text-slate-200">${tr(n.label)}</span>
              <span class="text-slate-400">${Number(value.toFixed(n.unit==='mg'?1:1))} ${n.unit} <span class="text-slate-600">/ ${cap} ${n.target}</span></span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full transition-all" style="width:${width}%;background:rgb(${n.rgb.join(',')})"></div></div>
            <div class="mt-1 text-right text-[8px] font-bold ${score>=80?'text-emerald-300':score>=55?'text-amber-300':'text-rose-300'}">${score}%</div>
          </div>`;
        }).join('');
      }

      const weekVitId=weeklySummary.vitaminsId?weeklySummary.vitaminsId.split(/\s+/).filter(Boolean):[];
      const weekVitLip=weeklySummary.vitaminsLip?weeklySummary.vitaminsLip.split(/\s+/).filter(Boolean):[];
      const vitaminNote=document.getElementById('nutrition-week-vitamin-note');
      if(vitaminNote){
        vitaminNote.innerHTML=`<div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-2"><div class="font-bold text-indigo-300">${tr('Vitamine ID')} · ${weekVitId.length}/9</div><div class="mt-1 leading-relaxed">${weekVitId.join(' · ')||'—'}</div></div>
          <div class="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-2"><div class="font-bold text-yellow-300">${tr('Vitamine LIP')} · ${weekVitLip.length}/4</div><div class="mt-1 leading-relaxed">${weekVitLip.join(' · ')||'—'}</div></div>
        </div><div class="mt-2">${tr('Per le vitamine Thalys registra la presenza dichiarata, non la quantità: per questo sono mostrate come copertura e non come dose.')}</div>`;
      }

      const dailyData={...daily,water:Number(waterVal||0)};
      const dailyVitId=vitId?vitId.split(/\s+/).filter(Boolean):[];
      const dailyVitLip=vitLip?vitLip.split(/\s+/).filter(Boolean):[];
      const wheel=[
        ...defs.map(n=>({...n,score:Math.round(nutritionScore(dailyData[n.key],n.target,n.maximum))})),
        {key:'vitId',label:'Vitamine ID',score:Math.round(dailyVitId.length/9*100),rgb:[129,140,248]},
        {key:'vitLip',label:'Vitamine LIP',score:Math.round(dailyVitLip.length/4*100),rgb:[250,204,21]}
      ];
      const overall=Math.round(wheel.reduce((s,n)=>s+n.score,0)/wheel.length)||0;
      const center=document.getElementById('nutrient-donut-score');if(center)center.textContent=`${overall}%`;
      const donut=document.getElementById('macro-donut');
      if(donut){
        const step=100/wheel.length;
        donut.style.background=`conic-gradient(${wheel.map((n,i)=>{
          const alpha=(.20+.80*(n.score/100)).toFixed(2);
          return `rgba(${n.rgb.join(',')},${alpha}) ${(i*step).toFixed(2)}% ${((i+1)*step).toFixed(2)}%`;
        }).join(',')})`;
      }
      const legend=document.getElementById('nutrient-donut-legend');
      if(legend){
        legend.innerHTML=wheel.map(n=>`<div class="flex min-h-9 items-center gap-2 rounded-xl bg-slate-950/45 px-2.5 py-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:rgb(${n.rgb.join(',')})"></span>
          <span class="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-300">${tr(n.label)}</span>
          <span class="text-[9px] font-black ${n.score>=80?'text-emerald-300':n.score>=55?'text-amber-300':'text-rose-300'}">${n.score}%</span>
        </div>`).join('');
      }
    }

    function renderNutrition() {
      const selectedDate = document.getElementById('nutrition-date').value;
      const container = document.getElementById('meals-container');
      container.innerHTML = '';

      const dayLogs = appState.nutrition.filter(n => n.date === selectedDate);
      const waterVal = appState.water[selectedDate] || 0;
      document.getElementById('water-amount').textContent = waterVal;
      const waterTarget=getWaterTarget(selectedDate);const waterTargetEl=document.getElementById('water-target-display'); if(waterTargetEl) waterTargetEl.textContent=waterTarget;const waterBar=document.getElementById('water-progress-bar');if(waterBar)waterBar.style.width=`${Math.min(100,waterTarget>0?(waterVal/waterTarget)*100:0)}%`;
      const latestWeight=(appState.bodyMetrics||[]).filter(x=>x.date<=selectedDate&&Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]?.weight || appState.profile?.weight || 70;
      const smartProtein=Math.round(latestWeight*1.6), smartWater=getWaterTarget(selectedDate);
      const smart=document.getElementById('nutrition-smart-targets'); if(smart) smart.innerHTML=`<div class="flex items-center gap-2"><i class="fa-solid fa-wand-magic-sparkles text-cyan-400"></i><span class="text-xs font-bold text-white">Target pratici stimati</span><span class="text-[9px] text-slate-500">peso ${latestWeight} kg</span></div><div class="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Proteine</span><div class="font-black text-emerald-300">~${smartProtein} g/die</div><div class="text-[8px] text-slate-500">1,6 g/kg · allenamento di forza</div></div><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Acqua</span><div class="font-black text-blue-300">~${smartWater} ml/die</div><div class="text-[8px] text-slate-500">target impostato · modificabile</div></div></div>`;

      let totalKcal=0,totalP=0,totalC=0,totalF=0,totalSatFat=0,totalSugars=0,totalCalcium=0,totalMagnesium=0,totalZinc=0,totalFiber=0,totalSalt=0,totalIron=0,totalPotassium=0;
      dayLogs.forEach(l=>{totalKcal+=Number(l.kcal||0);totalP+=Number(l.p||0);totalC+=Number(l.c||0);totalF+=Number(l.f||0);totalSatFat+=Number(l.satFat||0);totalSugars+=Number(l.sugars||0);totalCalcium+=Number(l.calcium||0);totalMagnesium+=Number(l.magnesium||0);totalZinc+=Number(l.zinc||0);totalFiber+=Number(l.fiber||0);totalSalt+=Number(l.salt||0);totalIron+=Number(l.iron||0);totalPotassium+=Number(l.potassium||0);});
      const vitId=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsId),'id'),vitLip=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsLip),'lip');
      const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      setText('summary-calories',Math.round(totalKcal));setText('summary-p',Math.round(totalP));setText('summary-c',Math.round(totalC));setText('summary-f',Math.round(totalF));setText('summary-sat-fat',Number(totalSatFat.toFixed(1)));setText('summary-sugars',Number(totalSugars.toFixed(1)));setText('summary-calcium',Math.round(totalCalcium));setText('summary-magnesium',Math.round(totalMagnesium));setText('summary-zinc',Number(totalZinc.toFixed(1)));setText('summary-fiber',Number(totalFiber.toFixed(1)));setText('summary-salt',Number(totalSalt.toFixed(2)));setText('summary-iron',Number(totalIron.toFixed(1)));setText('summary-potassium',Math.round(totalPotassium));setText('summary-vitamins-id',vitId||'—');setText('summary-vitamins-lip',vitLip||'—');
      const target=appState.targets||{};const items=[['bar-p',totalP,target.p||150],['bar-c',totalC,target.c||250],['bar-f',totalF,target.f||70],['bar-sat-fat',totalSatFat,target.satFat||20],['bar-sugars',totalSugars,target.sugars||50],['bar-fiber',totalFiber,target.fiber||30],['bar-calcium',totalCalcium,target.calcium||1000],['bar-magnesium',totalMagnesium,target.magnesium||350],['bar-zinc',totalZinc,target.zinc||11],['bar-iron',totalIron,target.iron||11],['bar-potassium',totalPotassium,target.potassium||3500],['bar-salt',totalSalt,target.salt||5]];items.forEach(([id,v,t])=>{const e=document.getElementById(id);if(e)e.style.width=`${Math.min(100,t>0?(v/t)*100:0)}%`;});

      const weeklySummary = computeWeeklyNutritionSummary(selectedDate);
      const summaryCard = document.getElementById('nutrition-week-summary');
      if (summaryCard) {
        summaryCard.innerHTML = `
          <div class="text-[11px] text-slate-300">
            <div class="flex items-center justify-between gap-2">
              <div class="font-bold text-white">${tr('Riepilogo settimanale')}</div>
              <div class="text-[9px] text-slate-500">${weeklySummary.trackedDays}/7 ${tr('giorni registrati')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Equilibrio')}</div><div class="mt-1 text-xl font-black ${weeklySummary.compliance >= 70 ? 'text-emerald-300' : 'text-amber-300'}">${weeklySummary.compliance}%</div></div>
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Priorità')}</div><div class="mt-1 text-[10px] font-bold leading-relaxed text-slate-300">${weeklySummary.missing.join(' · ') || tr('Nessun deficit rilevato')}</div></div>
            </div>
          </div>`;
      }

      setText('summary-vitamins-id-count',`${vitId?vitId.split(/\s+/).filter(Boolean).length:0}/9`);
      setText('summary-vitamins-lip-count',`${vitLip?vitLip.split(/\s+/).filter(Boolean).length:0}/4`);
      renderNutritionAnalytics(
        weeklySummary,
        {kcal:totalKcal,p:totalP,c:totalC,f:totalF,satFat:totalSatFat,sugars:totalSugars,fiber:totalFiber,calcium:totalCalcium,magnesium:totalMagnesium,zinc:totalZinc,iron:totalIron,potassium:totalPotassium,salt:totalSalt},
        vitId,vitLip,waterVal,waterTarget
      );

      // Meal Groupings
      const meals = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
      meals.forEach(mealType => {
        const mealLogs = dayLogs.filter(l => l.meal === mealType);
        let mealKcal = 0;
        mealLogs.forEach(l => mealKcal += l.kcal);

        const card = document.createElement('div');
        card.className = "bg-darkcard border border-darkborder rounded-2xl p-4 space-y-3";
        card.innerHTML = `
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <span class="text-sm font-bold text-white flex items-center space-x-2">
              <i class="fa-solid fa-circle-dot text-[10px] text-emerald-400"></i>
              <span>${mealType}</span>
              <button type="button" onclick="openFoodForMeal('${mealType}')" class="meal-add-circle bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" aria-label="Aggiungi a ${mealType}"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </span>
            <span class="text-xs font-semibold text-emerald-400">${mealKcal} kcal</span>
          </div>

          <div class="space-y-2">
            ${mealLogs.length === 0 ? `<div class="text-[11px] text-slate-500 italic">${tk('nutrition.no_food','Nessun alimento')}</div>` : ''}
            ${mealLogs.map(l => `
              <div class="flex items-center justify-between text-xs bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <div>
                  <div class="font-bold text-slate-200">${l.name} <span class="text-[10px] text-slate-400 font-normal">(${l.grams}g)</span></div>
                  <div class="text-[10px] text-slate-400">P ${Number(l.p||0).toFixed(1)}g · C ${Number(l.c||0).toFixed(1)}g · G ${Number(l.f||0).toFixed(1)}g · Sat ${Number(l.satFat||0).toFixed(1)}g</div><div class="text-[9px] leading-relaxed text-slate-500">Ca ${Math.round(Number(l.calcium||0))}mg · Mg ${Math.round(Number(l.magnesium||0))}mg · Zn ${Number(l.zinc||0).toFixed(1)}mg · Fe ${Number(l.iron||0).toFixed(1)}mg · K ${Math.round(Number(l.potassium||0))}mg</div><div class="text-[9px] text-slate-500">Sale ${Number(l.salt||0).toFixed(2)}g · Vit ID ${l.vitaminsId||'—'} · Vit LIP ${l.vitaminsLip||'—'}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-300">${l.kcal} kcal</span>
                  <button onclick="deleteFoodLog('${l.id}')" class="text-slate-600 hover:text-red-400">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(card);
      });
    }

    function normalizeFoodPreset(item){return {
      name:String(item?.name||'').trim(),kcal:Number(item?.kcal)||0,p:Number(item?.p)||0,c:Number(item?.c)||0,f:Number(item?.f)||0,
      satFat:Number(item?.satFat ?? item?.saturatedFat)||0,sugars:Number(item?.sugars)||0,calcium:Number(item?.calcium)||0,magnesium:Number(item?.magnesium)||0,zinc:Number(item?.zinc)||0,
      fiber:Number(item?.fiber)||0,salt:Number(item?.salt)||0,iron:Number(item?.iron)||0,potassium:Number(item?.potassium)||0,
      vitaminsId:normalizeVitaminCodes(item?.vitaminsId ?? item?.vitaminsID ?? '', 'id'),vitaminsLip:normalizeVitaminCodes(item?.vitaminsLip ?? '', 'lip'),
      ...((item?.createdAt||item?.ts)?{createdAt:item.createdAt||item.ts}:{}),
      ...((item?.updatedAt||item?.createdAt||item?.ts)?{updatedAt:item.updatedAt||item.createdAt||item.ts}:{})
    };}

    function sortFoodPresetsNewestFirst(items){
      return (items||[]).map((raw,index)=>({preset:normalizeFoodPreset(raw),index})).sort((a,b)=>{
        const at=Date.parse(a.preset.createdAt||a.preset.updatedAt||0)||0, bt=Date.parse(b.preset.createdAt||b.preset.updatedAt||0)||0;
        if(at!==bt)return bt-at;
        return a.index-b.index;
      }).map(x=>x.preset);
    }

    let editingFoodPresetIndex=null;

    const PRESET_FIELD_MAP=[['preset-name','name'],['preset-kcal','kcal'],['preset-p','p'],['preset-c','c'],['preset-f','f'],['preset-sat-fat','satFat'],['preset-sugars','sugars'],['preset-calcium','calcium'],['preset-magnesium','magnesium'],['preset-zinc','zinc'],['preset-fiber','fiber'],['preset-salt','salt'],['preset-iron','iron'],['preset-potassium','potassium'],['preset-vitamins-id','vitaminsId'],['preset-vitamins-lip','vitaminsLip']];

    function toggleFoodPresetForm(force){
      const form=document.getElementById('food-preset-form'); if(!form)return;
      const show=typeof force==='boolean'?force:form.classList.contains('hidden');
      const shell=form.closest('.food-db-shell');
      form.classList.toggle('hidden',!show);
      shell?.classList.toggle('food-form-open',show);
      if(show && editingFoodPresetIndex===null){
        const name=document.getElementById('preset-name');
        setTimeout(()=>name?.focus(),80);
      }
    }

    function resetFoodPresetForm(){editingFoodPresetIndex=null;PRESET_FIELD_MAP.forEach(([id])=>{const e=document.getElementById(id);if(e)e.value='';});}

    function editFoodPreset(index){const p=normalizeFoodPreset(appState.presets[index]);editingFoodPresetIndex=index;toggleFoodPresetForm(true);PRESET_FIELD_MAP.forEach(([id,key])=>{const e=document.getElementById(id);if(e)e.value=p[key]??'';});showToast('Modalità modifica attiva');}

    function applyPresetToForm(){
      const idx=document.getElementById('preset-select')?.value; if(idx===''||idx==null)return; const p=normalizeFoodPreset(appState.presets?.[Number(idx)]); if(!p.name)return;
      const pairs=[['food-name','name'],['food-kcal','kcal'],['food-p','p'],['food-c','c'],['food-f','f'],['food-sat-fat','satFat'],['food-sugars','sugars'],['food-calcium','calcium'],['food-magnesium','magnesium'],['food-zinc','zinc'],['food-fiber','fiber'],['food-salt','salt'],['food-iron','iron'],['food-potassium','potassium'],['food-vitamins-id','vitaminsId'],['food-vitamins-lip','vitaminsLip']];
      pairs.forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=p[key]??'';}); updateFoodDosePreview();
    }

    function recalcFoodMacros(){ applyPresetToForm(); }

    function saveFoodPreset(e){
      e.preventDefault(); const raw={}; PRESET_FIELD_MAP.forEach(([id,key])=>raw[key]=document.getElementById(id)?.value||''); const now=new Date().toISOString();
      const existing=editingFoodPresetIndex===null?null:normalizeFoodPreset(appState.presets?.[editingFoodPresetIndex]);
      const p=normalizeFoodPreset({...raw,createdAt:existing?.createdAt||now,updatedAt:now}); if(!p.name)return;
      if(editingFoodPresetIndex===null)appState.presets.unshift(p);else appState.presets[editingFoodPresetIndex]=p; persistFoodDatabase();renderPresets();resetFoodPresetForm();toggleFoodPresetForm(false);renderNutrition();renderHomeDashboard();showToast('Alimento salvato ✓ · sincronizzazione avviata','fa-bookmark');
    }

    function deletePreset(index){if(!confirm(`Eliminare ${appState.presets[index]?.name||'questo alimento'}?`))return;appState.presets.splice(index,1);saveStateToLocal();renderPresets();}

    function renderPresets(){
      const list=document.getElementById('presets-list'),selectContainer=document.getElementById('preset-select-container'),select=document.getElementById('preset-select');if(!list||!select)return;
      appState.presets=sortFoodPresetsNewestFirst(appState.presets||[]);
      const search=(document.getElementById('food-preset-search')?.value||'').trim().toLocaleLowerCase('it');
      list.innerHTML='';select.innerHTML='<option value="">-- Seleziona un Preset --</option>';selectContainer?.classList.toggle('hidden',!(appState.presets||[]).length);
      let visible=0;
      (appState.presets||[]).forEach((raw,idx)=>{const p=normalizeFoodPreset(raw);appState.presets[idx]=p;const matches=!search||p.name.toLocaleLowerCase('it').includes(search);if(matches){visible++;const item=document.createElement('div');item.className='bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs';item.innerHTML=`<div class="flex justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-200">${p.name}</div><div class="text-[10px] text-slate-400">${p.kcal} kcal · P ${p.p}g · C ${p.c}g · G ${p.f}g · Sat ${p.satFat}g · Zuc ${p.sugars}g</div><div class="text-[10px] text-slate-500">Fibre ${p.fiber}g · Sale ${p.salt}g · Ca ${p.calcium}mg · Mg ${p.magnesium}mg · Zn ${p.zinc}mg · Fe ${p.iron}mg · K ${p.potassium}mg</div><div class="text-[10px] text-slate-500">Vit ID ${p.vitaminsId||'—'} · Vit LIP ${p.vitaminsLip||'—'} / 100g</div></div><div class="flex gap-1"><button onclick="editFoodPreset(${idx})" class="text-cyan-400 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="deletePreset(${idx})" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></div></div>`;list.appendChild(item);}
        const opt=document.createElement('option');opt.value=idx;opt.textContent=`${p.name} (${p.kcal} kcal/100g)`;select.appendChild(opt);});
      const empty=document.getElementById('food-preset-search-empty'); if(empty)empty.classList.toggle('hidden',visible!==0||!search);
      const count=document.getElementById('food-preset-search-count'); if(count)count.textContent=search?`${visible} risultati`:`${(appState.presets||[]).length} alimenti`;
    }

    function saveTargets(e) {
      e.preventDefault();
      appState.targets = {
        calories: parseInt(document.getElementById('target-input-kcal').value) || 2000,
        p: parseInt(document.getElementById('target-input-p').value) || 150,
        c: parseInt(document.getElementById('target-input-c').value) || 200,
        f: parseInt(document.getElementById('target-input-f').value) || 60,
        satFat: parseFloat(document.getElementById('target-input-sat-fat').value) || 20,
        sugars: parseInt(document.getElementById('target-input-sugars').value) || 50,
        calcium: parseInt(document.getElementById('target-input-calcium').value) || 1000,
        magnesium: parseInt(document.getElementById('target-input-magnesium').value) || 350,
        zinc: parseFloat(document.getElementById('target-input-zinc').value) || 11,
        fiber: parseInt(document.getElementById('target-input-fiber').value) || 30,
        salt: parseFloat(document.getElementById('target-input-salt').value) || 5,
        iron: parseFloat(document.getElementById('target-input-iron').value) || 11,
        potassium: parseInt(document.getElementById('target-input-potassium').value) || 3500
      };
      appState.targetsConfirmed=true;
      saveStateToLocal();refreshProfileMessageCompletion();
      loadTargetsUI();
      renderNutrition();
      closeModal('target-modal');
      showToast('Obiettivi aggiornati!');
    }

    function loadTargetsUI() {
      const t = appState.targets;
      document.getElementById('target-calories').textContent = t.calories;
      document.getElementById('target-p').textContent = t.p;
      document.getElementById('target-c').textContent = t.c;
      document.getElementById('target-f').textContent = t.f;
      document.getElementById('target-sat-fat').textContent = t.satFat || 20;
      document.getElementById('target-sugars').textContent = t.sugars || 50;
      document.getElementById('target-calcium').textContent = t.calcium || 1000;
      document.getElementById('target-magnesium').textContent = t.magnesium || 350;
      document.getElementById('target-zinc').textContent = t.zinc || 11;
      document.getElementById('target-fiber').textContent = t.fiber || 30;
      document.getElementById('target-salt').textContent = t.salt || 5;
      document.getElementById('target-iron').textContent = t.iron || 11;
      document.getElementById('target-potassium').textContent = t.potassium || 3500;

      document.getElementById('target-input-kcal').value = t.calories;
      document.getElementById('target-input-p').value = t.p;
      document.getElementById('target-input-c').value = t.c;
      document.getElementById('target-input-f').value = t.f;
      document.getElementById('target-input-sat-fat').value = t.satFat || 20;
      document.getElementById('target-input-sugars').value = t.sugars || 50;
      document.getElementById('target-input-calcium').value = t.calcium || 1000;
      document.getElementById('target-input-magnesium').value = t.magnesium || 350;
      document.getElementById('target-input-zinc').value = t.zinc || 11;
      document.getElementById('target-input-fiber').value = t.fiber || 30;
      document.getElementById('target-input-salt').value = t.salt || 5;
      document.getElementById('target-input-iron').value = t.iron || 11;
      document.getElementById('target-input-potassium').value = t.potassium || 3500;
    }
