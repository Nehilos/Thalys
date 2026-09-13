/* Thalys v0.31 - Analytics domain module */
// ----------------------------------------------------
    // ANALYTICS & CHARTS (Chart.js)
    // ----------------------------------------------------
    function setAnalyticsDate(date){if(!date)return;analyticsSelectedDate=date;const p=document.getElementById('analytics-date-picker');if(p)p.value=date;const l=document.getElementById('analytics-date-label');if(l)l.textContent=weekdayLabel(date);renderWellnessSummary();updateAnalyticsCharts();}
    let chartEx = null;
    let chartWeight = null;
    let chartNutr = null;
    let chartWellness = null;
    let chartConsistency = null;
    let chartBodyMeasurements = null;

    function getWellnessSeries(range = 'week', metric = 'sleep') {
      const af=getAnalyticsFilter();
      const metricKey = metric === 'sleep' ? 'sleepHours' : metric;
      const entries = [...(appState.wellness || [])]
        .filter(e=>af.value==='all'||af.allowedDates.has(e.date))
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
      const endDate = new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T12:00:00');
      const iso=d=>d.toISOString().split('T')[0];
      const exactValue=date=>{const item=entries.find(e=>e.date===date);return item?Number(item[metricKey]||0):0;};
      if(range==='day'){
        const d=iso(endDate);return {labels:[new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})],values:[exactValue(d)]};
      }
      if(range==='week'){
        const dates=[];for(let i=6;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'short',day:'2-digit'})),values:dates.map(exactValue)};
      }
      if(range==='month'){
        const dates=[];for(let i=29;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})),values:dates.map(exactValue)};
      }
      const months=[];for(let i=11;i>=0;i--){months.push(new Date(endDate.getFullYear(),endDate.getMonth()-i,1));}
      return {labels:months.map(d=>d.toLocaleDateString(currentLocale(),{month:'short',year:'2-digit'})),values:months.map(d=>{const y=d.getFullYear(),m=d.getMonth();const batch=entries.filter(e=>{const x=new Date(e.date+'T12:00:00');return x.getFullYear()===y&&x.getMonth()===m;});return batch.length?Number((batch.reduce((a,e)=>a+Number(e[metricKey]||0),0)/batch.length).toFixed(1)):0;})};
    }

    function updateWellnessTrendChart() {
      const metric = document.getElementById('wellness-metric-filter')?.value || 'sleep';
      const range = document.getElementById('wellness-range-filter')?.value || 'week';
      const ctx = document.getElementById('wellnessTrendChart')?.getContext('2d');
      if (!ctx) return;

      const { labels, values } = getWellnessSeries(range, metric);
      const metricLabel = {
        sleep: 'Sonno (h)',
        stress: 'Stress (1-10)',
        recovery: 'Recupero (1-10)',
        mood: 'Umore (1-10)',
        readiness: 'Readiness (1-10)'
      }[metric] || 'Valore';

      const isSleep = metric === 'sleep';
      const yConfig = isSleep
        ? { min: 0, max: 12, ticks: { stepSize: 2, callback: (value) => `${value}h` } }
        : { min: 0, max: 10, ticks: { stepSize: 2, callback: (value) => `${value}` } };

      if (chartWellness) chartWellness.destroy();
      chartWellness = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: metricLabel,
            data: values,
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: {
              min: yConfig.min,
              max: yConfig.max,
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                stepSize: yConfig.ticks.stepSize,
                callback: yConfig.ticks.callback
              }
            }
          }
        }
      });
    }

    function getAnalyticsFilter(){
      const value=document.getElementById('chart-workout-filter')?.value||'all';
      const days=document.getElementById('chart-period-filter')?.value||'30';
      const end=new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T23:59:59'); const start=new Date(end);
      if(days!=='all') start.setDate(end.getDate()-Number(days)+1); else start.setTime(0);
      const periodDates=new Set(); for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) periodDates.add(d.toISOString().split('T')[0]);
      const allowedDates=new Set(value==='all' ? periodDates : (appState.workouts||[]).filter(w=>{
        if(!periodDates.has(w.date)) return false;
        const plan=(appState.workoutPlans||[]).find(p=>p.id===appState.workoutAssignments?.[w.date]);
        return w.category===value || plan?.name===value || w.name===value;
      }).map(w=>w.date));
      return {value,days,start,end,allowedDates,periodDates};
    }

    function populateAnalyticsFilter(){
      const select=document.getElementById('chart-workout-filter'); if(!select)return;
      const current=select.value||'all'; const values=new Set();
      (appState.workouts||[]).forEach(w=>{if(w.category)values.add(w.category);if(w.name)values.add(w.name); const p=appState.workoutPlans?.find(p=>p.id===appState.workoutAssignments?.[w.date]);if(p?.name)values.add(p.name);});
      select.innerHTML='<option value="all">Tutti gli allenamenti</option>'+[...values].sort().map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join('');
      if([...select.options].some(o=>o.value===current))select.value=current;
    }
    function updateAnalyticsCharts(){
      populateAnalyticsFilter();
      const f=getAnalyticsFilter(); const summary=document.getElementById('analytics-filter-summary');
      if(summary)summary.textContent=f.value==='all'?`Mostrati tutti i dati · periodo: ${f.days==='all'?'tutto':f.days+' giorni'}`:`Filtro: ${f.value} · ${f.allowedDates.size} giorni con allenamento`;
      updateExerciseChart(); updateWorkoutConsistencyChart(); updateWeightChart(); updateBodyMeasurementsChart(); updateNutritionChart(); updateWellnessTrendChart();
    }

    function updateExerciseChart(){
      const select=document.getElementById('chart-exercise-select'), ctx=document.getElementById('exerciseProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const pool=(appState.workouts||[]).filter(w=>f.value==='all'||f.allowedDates.has(w.date));
      const names=[...new Set(pool.map(w=>w.name))]; const current=select.value; select.innerHTML=names.length?names.map(n=>`<option value="${String(n).replace(/"/g,'&quot;')}">${n}</option>`).join(''):'<option value="">Nessun esercizio</option>'; if(names.includes(current))select.value=current;
      const exName=select.value; const filtered=pool.filter(w=>w.name===exName).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=filtered.map(w=>w.date), dataVolume=filtered.map(w=>(w.sets||[]).reduce((acc,s)=>acc+(Number(s.weight)||0)*(Number(s.reps)||0),0));
      if(chartEx)chartEx.destroy(); chartEx=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Volume totale (kg)',data:dataVolume,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,.15)',fill:true,tension:.3,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:(c)=>{const w=filtered[c.dataIndex];return w?.date===new Date().toISOString().split('T')[0]?'✓ Allenamento di oggi':'';}}}},scales:{x:{ticks:{color:'#64748b',font:{size:10}}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }
    function updateWorkoutConsistencyChart(){
      const ctx=document.getElementById('workoutConsistencyChart')?.getContext('2d');if(!ctx)return; const f=getAnalyticsFilter(); const labels=[],values=[];
      const days=f.days==='all'?30:Number(f.days); for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=d.toISOString().split('T')[0];labels.push(d.toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'}));const plan=getDayWorkoutPlan(iso);values.push(plan&&isWorkoutPlanCompleted(iso,plan.id)?1:((appState.workouts||[]).some(w=>w.date===iso)?0.6:0));}
      if(chartConsistency)chartConsistency.destroy(); chartConsistency=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Completamento',data:values,backgroundColor:values.map(v=>v===1?'rgba(16,185,129,.75)':v>0?'rgba(34,211,238,.55)':'rgba(71,85,105,.35)')} ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:1,ticks:{stepSize:.5,callback:v=>v===1?'Completato':v===.5?'Parziale':'—'}},x:{ticks:{color:'#64748b',font:{size:8},maxRotation:0}}}}});
    }

    function updateWeightChart() {
      const ctx = document.getElementById('weightProgressChart').getContext('2d');
      const f=getAnalyticsFilter(); const sorted = [...appState.bodyMetrics].filter(b=>f.value==='all'||f.allowedDates.has(b.date)).sort((a,b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map(b => b.date);
      const weights = sorted.map(b => b.weight);

      if (chartWeight) chartWeight.destroy();
      chartWeight = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Peso (kg)',
            data: weights,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: { ticks: { color: '#64748b', font: { size: 10 } } }
          }
        }
      });
    }

    function updateNutritionChart(){
      const ctx=document.getElementById('nutritionProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const dates=[...f.periodDates].sort(); const selected=dates.filter(d=>f.value==='all'||f.allowedDates.has(d));
      const kcalData=selected.map(d=>(appState.nutrition||[]).filter(n=>n.date===d).reduce((acc,l)=>acc+Number(l.kcal||0),0));
      if(chartNutr)chartNutr.destroy(); chartNutr=new Chart(ctx,{type:'bar',data:{labels:selected.map(d=>d.slice(5)),datasets:[{label:'Calorie assunte',data:kcalData,backgroundColor:'#10b981',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#64748b',font:{size:9},maxRotation:0}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }


    // Body history helpers moved to js/body.js in v0.28.
    function updateBodyMeasurementsChart(){
      const ctx=document.getElementById('bodyMeasurementsChart')?.getContext('2d'); if(!ctx)return;
      const selected=[...document.querySelectorAll('.body-chart-metric:checked')].map(x=>x.value);
      const f=getAnalyticsFilter();
      const rows=[...(appState.bodyMetrics||[])].filter(x=>f.periodDates.has(x.date)).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=rows.map(x=>x.date);
      const colors=['#e879f9','#22d3ee','#34d399','#f59e0b','#fb7185','#a78bfa','#60a5fa','#f472b6','#84cc16'];
      const datasets=selected.map((key,i)=>({label:bodyMetricLabel(key)+' (cm)',data:rows.map(r=>r[key]===null||r[key]===undefined?null:Number(r[key])),borderColor:colors[i%colors.length],backgroundColor:'transparent',spanGaps:true,tension:.28,pointRadius:3}));
      if(chartBodyMeasurements)chartBodyMeasurements.destroy();
      chartBodyMeasurements=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,labels:{color:'#cbd5e1',boxWidth:10,font:{size:9}}}},scales:{x:{ticks:{color:'#64748b',font:{size:9}}},y:{ticks:{color:'#64748b',font:{size:10},callback:v=>`${v} cm`}}}}});
    }

