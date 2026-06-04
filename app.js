/* ══════════════════════════════════════════════════════
   WORKOUT TRACKER v5 — app.js
   API only — MySQL is the single source of truth
   ══════════════════════════════════════════════════════ */

// ── Config ─────────────────────────────────────────────
const API = 'https://your-railway-url.up.railway.app';

// ── State ──────────────────────────────────────────────
let db          = [];   // in-memory copy of what the API returns
let split       = { Mon:'', Tue:'', Wed:'', Thu:'', Fri:'', Sat:'', Sun:'' };
let syncLog     = [];
let progChart   = null;
let miniChart   = null;
let acFocusIdx  = -1;
let currentCat  = 'strength';
let calYear, calMonth;
let progCalYear, progCalMonth;

const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Split (still in localStorage — it's a preference not data) ──
function loadSplit() {
  try { const s = localStorage.getItem('wt_split'); if (s) split = JSON.parse(s); } catch(e) {}
}
function saveSplitData() {
  try { localStorage.setItem('wt_split', JSON.stringify(split)); } catch(e) {}
}

// ══════════════════════════════════════════════════════
// API CALLS
// ══════════════════════════════════════════════════════

// GET all workouts from the API
async function fetchWorkouts() {
  showBanner('Loading workouts…', 'loading');
  try {
    const res  = await fetch(`${API}/workouts`);
    const data = await res.json();
    db = data;
    hideBanner();
    refreshAll();
  } catch(e) {
    showBanner('Could not connect to the API. Is the server running?', 'error');
  }
}

// POST a new workout to the API
async function pushWorkout(entry) {
  try {
    const res = await fetch(`${API}/workouts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(entry)
    });
    const json = await res.json();
    if (!json.ok) throw new Error('API returned not ok');
    // Add to local in-memory db so UI updates instantly
    db.unshift(entry);
    refreshAll();
  } catch(e) {
    showBanner('Failed to save workout. Is the server running?', 'error');
  }
}

// DELETE a workout from the API
async function deleteWorkout(id) {
  try {
    await fetch(`${API}/workouts/${id}`, { method: 'DELETE' });
    // Remove from local in-memory db
    db = db.filter(e => e.id !== id);
    refreshAll();
  } catch(e) {
    showBanner('Failed to delete workout. Is the server running?', 'error');
  }
}

// ══════════════════════════════════════════════════════
// BANNER
// ══════════════════════════════════════════════════════
function showBanner(msg, type) {
  const el = document.getElementById('sync-banner');
  const colors = {
    loading: { bg:'#E6F1FB', border:'#85B7EB', text:'#0C447C', icon:'ti-loader' },
    success: { bg:'#EAF3DE', border:'#97C459', text:'#27500A', icon:'ti-circle-check' },
    error:   { bg:'#FCEBEB', border:'#F09595', text:'#A32D2D', icon:'ti-alert-circle' },
    info:    { bg:'#FAEEDA', border:'#EF9F27', text:'#633806', icon:'ti-info-circle' },
  };
  const c = colors[type] || colors.info;
  el.style.cssText = `display:flex;align-items:center;gap:8px;padding:9px 14px;margin-bottom:1rem;border-radius:8px;font-size:13px;background:${c.bg};border:0.5px solid ${c.border};color:${c.text};`;
  el.innerHTML = `<i class="ti ${c.icon}" style="font-size:15px;flex-shrink:0;${type==='loading'?'animation:spin 1s linear infinite;':''}"></i>
    ${msg}
    <button onclick="hideBanner()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:${c.text};font-size:16px;padding:0 2px;">
      <i class="ti ti-x"></i>
    </button>`;
  if (type === 'success') setTimeout(hideBanner, 3000);
}

function hideBanner() {
  document.getElementById('sync-banner').style.display = 'none';
}

const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }';
document.head.appendChild(spinStyle);

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
function today()    { return new Date().toISOString().slice(0, 10); }
function todayDayKey() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function calcStreak() {
  const days = [...new Set(db.map(e => e.date))].sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  let cur = new Date(); cur.setHours(0,0,0,0);
  for (let i = 0; i < days.length; i++) {
    const d    = new Date(days[i]);
    const diff = Math.round((cur - d) / (1000*60*60*24));
    if (diff <= 1) { streak++; cur = d; } else break;
  }
  return streak;
}
function getExercises(cat) {
  const seen = {};
  db.filter(e => !cat || e.cat === cat).forEach(e => {
    if (!seen[e.name.toLowerCase()]) seen[e.name.toLowerCase()] = e;
  });
  return Object.values(seen).sort((a,b) => a.name.localeCompare(b.name));
}
function badgeHTML(cat) { return `<span class="badge badge-${cat}">${cat}</span>`; }
function entryMetaStr(e) {
  if (e.cat === 'cardio') {
    const p = [];
    if (e.dist) p.push(`${e.dist} km`);
    if (e.dur)  p.push(`${e.dur} min`);
    if (e.pace) p.push(`${e.pace} /km`);
    return p.join(' · ') || '—';
  }
  if (e.cat === 'mobility') {
    const p = [];
    if (e.dur)   p.push(`${e.dur} min`);
    if (e.notes) p.push(e.notes);
    return p.join(' · ') || '—';
  }
  const p = [];
  if (e.sets && e.reps) p.push(`${e.sets}×${e.reps}`);
  if (e.weight) p.push(`${e.weight} kg`);
  if (e.dur)    p.push(`${e.dur} min`);
  return p.join(' · ') || '—';
}
function checkPR(entry) {
  if (entry.cat === 'cardio') {
    if (!entry.dist) return false;
    const same = db.filter(e => e.name.toLowerCase()===entry.name.toLowerCase() && e.id!==entry.id && e.dist);
    return same.length && entry.dist > Math.max(...same.map(e => e.dist));
  }
  if (!entry.weight) return false;
  const same = db.filter(e => e.name.toLowerCase()===entry.name.toLowerCase() && e.id!==entry.id && e.weight);
  return same.length && entry.weight > Math.max(...same.map(e => e.weight));
}
function entryHTML(e) {
  return `<div class="log-entry">
    <span class="log-name">${e.name}${checkPR(e)?'<span class="pr-pill">PR</span>':''}</span>
    ${badgeHTML(e.cat)}
    <span class="log-meta">${entryMetaStr(e)}</span>
    <span class="log-date">${e.date}</span>
    <button class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})" aria-label="Delete">
      <i class="ti ti-trash" style="font-size:12px;"></i>
    </button>
  </div>`;
}

// ══════════════════════════════════════════════════════
// REFRESH ALL VIEWS
// ══════════════════════════════════════════════════════
function refreshAll() {
  const tabs  = ['home','log','history','progress','sheets'];
  const idx   = [...document.querySelectorAll('.tab')].findIndex(b => b.classList.contains('active'));
  const active = tabs[idx] || 'home';
  if (active === 'home')     renderHome();
  if (active === 'log')      renderTodayLog();
  if (active === 'history')  { populateHistEx(); renderHistory(); }
  if (active === 'progress') { populateProgEx(); renderProgStats(); renderProgress(); renderProgCal(); }
}

// ── Tab switching ──────────────────────────────────────
function switchTab(t) {
  document.querySelectorAll('.tab').forEach((b,i) => {
    b.classList.toggle('active', ['home','log','history','progress','sheets'][i] === t);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === 'page-' + t);
  });
  if (t === 'home')     renderHome();
  if (t === 'history')  { populateHistEx(); renderHistory(); }
  if (t === 'progress') { populateProgEx(); renderProgStats(); renderProgress(); renderProgCal(); }
  if (t === 'sheets')   checkAPIStatus();
}

// ══════════════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════════════
function renderHome() {
  const dayKey = todayDayKey();
  const plan   = split[dayKey];
  document.getElementById('greeting-text').innerHTML = `${greeting()}, <span>Kalden!</span>`;
  document.getElementById('greeting-sub').textContent =
    plan ? `Today is ${DAY_FULL[DAYS.indexOf(dayKey)]} — ${plan} day. Let's go!`
         : 'Ready to crush it today?';
  document.getElementById('streak-num-home').textContent = calcStreak();
  renderCal('calendar', 'cal-month-label', calYear, calMonth);
  renderHomeStats();
  renderSplitDisplay();
  renderTodaysPlan();
  renderRecentSessions();
}

function renderHomeStats() {
  const total = db.length;
  const days  = new Set(db.map(e => e.date)).size;
  const vol   = db.filter(e=>e.cat==='strength').reduce((s,e)=>s+(e.sets*e.reps*e.weight),0);
  const km    = db.filter(e=>e.cat==='cardio').reduce((s,e)=>s+(e.dist||0),0);
  document.getElementById('home-stat-grid').innerHTML = `
    <div class="stat-card"><div class="stat-lbl">Sessions</div><div class="stat-val">${total}</div></div>
    <div class="stat-card"><div class="stat-lbl">Days trained</div><div class="stat-val">${days}</div></div>
    <div class="stat-card"><div class="stat-lbl">Volume</div><div class="stat-val">${(vol/1000).toFixed(1)}t</div></div>
    <div class="stat-card"><div class="stat-lbl">Cardio km</div><div class="stat-val">${km.toFixed(1)}</div></div>`;
}

// ── Calendar ───────────────────────────────────────────
function renderCal(containerId, labelId, year, month) {
  document.getElementById(labelId).textContent =
    new Date(year, month).toLocaleDateString('en-AU', { month:'long', year:'numeric' });
  const dayMap = {};
  db.forEach(e => {
    const d = new Date(e.date);
    if (d.getFullYear()===year && d.getMonth()===month) {
      if (!dayMap[e.date]) dayMap[e.date] = new Set();
      dayMap[e.date].add(e.cat);
    }
  });
  const firstDay    = new Date(year, month, 1).getDay();
  const offset      = firstDay===0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayStr    = today();
  let html = '<div class="cal-grid">';
  ['M','T','W','T','F','S','S'].forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });
  for (let i = 0; i < offset; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cats    = dayMap[dateStr];
    let cls = 'cal-day';
    if (dateStr === todayStr) cls += ' today';
    if (cats) {
      cls += ' has-session';
      if (cats.size > 1)            cls += ' mixed';
      else if (cats.has('strength')) cls += ' strength';
      else if (cats.has('cardio'))   cls += ' cardio';
      else                           cls += ' mobility';
    }
    html += `<div class="${cls}" title="${dateStr}">${d}</div>`;
  }
  html += '</div>';
  document.getElementById(containerId).innerHTML = html;
}

function calPrev()     { if(calMonth===0){calMonth=11;calYear--;}else calMonth--; renderCal('calendar','cal-month-label',calYear,calMonth); }
function calNext()     { if(calMonth===11){calMonth=0;calYear++;}else calMonth++; renderCal('calendar','cal-month-label',calYear,calMonth); }
function progCalPrev() { if(progCalMonth===0){progCalMonth=11;progCalYear--;}else progCalMonth--; renderProgCal(); }
function progCalNext() { if(progCalMonth===11){progCalMonth=0;progCalYear++;}else progCalMonth++; renderProgCal(); }
function renderProgCal() { renderCal('prog-calendar','prog-cal-month-label',progCalYear,progCalMonth); }

// ── Split ──────────────────────────────────────────────
function renderSplitDisplay() {
  const todayKey = todayDayKey();
  const hasAny   = DAYS.some(d => split[d]);
  if (!hasAny) {
    document.getElementById('split-display').innerHTML =
      '<p style="font-size:13px;color:var(--text3);padding:4px 0;">No split set yet. Hit "Edit split" to add yours.</p>';
    return;
  }
  let rows = '<table class="split-table">';
  DAYS.forEach((day, i) => {
    const isToday = day === todayKey;
    rows += `<tr class="${isToday?'split-today':''}">
      <td class="split-day-name">${DAY_FULL[i]}</td>
      <td class="split-day-value">${split[day]||'<span style="color:var(--text3);">Rest</span>'}</td>
    </tr>`;
  });
  rows += '</table>';
  document.getElementById('split-display').innerHTML = rows;
}

function toggleSplitEdit() {
  const editor = document.getElementById('split-editor');
  const btn    = document.getElementById('split-edit-btn');
  const open   = editor.style.display === 'none';
  editor.style.display = open ? 'block' : 'none';
  btn.innerHTML = open ? '<i class="ti ti-x"></i>Cancel' : '<i class="ti ti-edit"></i>Edit split';
  if (open) buildSplitEditor();
}

function buildSplitEditor() {
  document.getElementById('split-rows').innerHTML = DAYS.map((day,i) => `
    <div class="split-row">
      <span class="split-row-day">${DAY_FULL[i]}</span>
      <input type="text" placeholder="e.g. Push / Rest / Legs"
        value="${split[day]||''}" id="split-input-${day}"/>
    </div>`).join('');
}

function saveSplit() {
  DAYS.forEach(day => {
    const el = document.getElementById('split-input-'+day);
    if (el) split[day] = el.value.trim();
  });
  saveSplitData();
  toggleSplitEdit();
  renderSplitDisplay();
  renderTodaysPlan();
}

function renderTodaysPlan() {
  const dayKey = todayDayKey();
  const plan   = split[dayKey];
  const el     = document.getElementById('todays-plan');
  if (!plan) {
    el.innerHTML = '<p class="todays-plan-empty">No plan set for today. Edit your split to add one.</p>';
    return;
  }
  el.innerHTML = `<div class="todays-plan-content">
    <i class="ti ti-calendar-event" style="font-size:28px;color:var(--accent);flex-shrink:0;"></i>
    <div>
      <div class="todays-plan-day">${DAY_FULL[DAYS.indexOf(dayKey)]}</div>
      <div class="todays-plan-name">${plan}</div>
    </div>
  </div>`;
}

function renderRecentSessions() {
  const el      = document.getElementById('recent-sessions');
  const entries = db.slice(0, 5);
  if (!entries.length) { el.innerHTML='<p class="todays-plan-empty">No sessions logged yet.</p>'; return; }
  el.innerHTML = entries.map(e=>`
    <div class="recent-row">
      <span class="recent-name">${e.name}</span>
      ${badgeHTML(e.cat)}
      <span class="recent-meta">${entryMetaStr(e)}</span>
      <span class="recent-date">${e.date}</span>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════
// LOG
// ══════════════════════════════════════════════════════
function setCat(cat) {
  currentCat = cat;
  document.getElementById('ex-cat').value = cat;
  ['strength','cardio','mobility'].forEach(c => {
    document.getElementById('pill-'+c).className = 'cat-pill'+(c===cat?' active-'+c:'');
    document.getElementById('fields-'+c).style.display = c===cat ? 'flex' : 'none';
  });
  onNameInput();
}

function calcPace() {
  const dist = parseFloat(document.getElementById('ex-dist').value)||0;
  const dur  = parseFloat(document.getElementById('ex-dur-c').value)||0;
  const el   = document.getElementById('ex-pace');
  if (dist>0&&dur>0) {
    const p=dur/dist, min=Math.floor(p), sec=Math.round((p-min)*60);
    el.value=`${min}:${sec.toString().padStart(2,'0')}`;
  } else { el.value=''; }
}

function onNameInput() {
  const val  = document.getElementById('ex-name').value.trim().toLowerCase();
  const list = document.getElementById('ac-list');
  acFocusIdx = -1;
  const exs     = getExercises(currentCat);
  const matches = val ? exs.filter(e=>e.name.toLowerCase().includes(val)) : exs;
  if (!exs.length||(!matches.length&&val)) { list.style.display='none'; return; }
  const icon = currentCat==='cardio'?'run':currentCat==='mobility'?'arrows-move':'barbell';
  list.innerHTML = matches.slice(0,8).map(e=>{
    const safe=e.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return`<div class="ac-item" data-name="${e.name}" data-cat="${e.cat}" onmousedown="pickAC('${safe}','${e.cat}')">
      <i class="ti ti-${icon}" style="font-size:14px;color:var(--text3);"></i>
      ${e.name}<span class="ac-cat">${e.cat}</span>
    </div>`;
  }).join('');
  list.style.display='block';
}

function pickAC(name, cat) {
  document.getElementById('ex-name').value=name;
  setCat(cat);
  document.getElementById('ac-list').style.display='none';
  acFocusIdx=-1;
  showExPanel(name);
  const first=document.querySelector('#fields-'+cat+' input:not([readonly])');
  if (first) first.focus();
}

function onNameKey(e) {
  const list=document.getElementById('ac-list');
  const items=list.querySelectorAll('.ac-item');
  if (e.key==='ArrowDown')  { e.preventDefault(); acFocusIdx=Math.min(acFocusIdx+1,items.length-1); items.forEach((el,i)=>el.classList.toggle('focused',i===acFocusIdx)); }
  else if (e.key==='ArrowUp') { e.preventDefault(); acFocusIdx=Math.max(acFocusIdx-1,-1); items.forEach((el,i)=>el.classList.toggle('focused',i===acFocusIdx)); }
  else if (e.key==='Enter'&&acFocusIdx>=0&&items[acFocusIdx]) { const el=items[acFocusIdx]; pickAC(el.dataset.name,el.dataset.cat); }
  else if (e.key==='Escape') { list.style.display='none'; }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap')) {
    const list=document.getElementById('ac-list');
    if (list) list.style.display='none';
  }
});

function showExPanel(name) {
  const entries=db.filter(e=>e.name.toLowerCase()===name.toLowerCase()).sort((a,b)=>b.date.localeCompare(a.date));
  const panel=document.getElementById('ex-panel');
  if (!entries.length) { panel.innerHTML=''; return; }
  const cat=entries[0].cat;
  let prLabel='',prVal='',chartPts=[];
  if (cat==='cardio') {
    const maxD=Math.max(...entries.map(e=>e.dist||0));
    prLabel='Best distance'; prVal=maxD?`${maxD} km`:'—';
    chartPts=entries.filter(e=>e.dist>0).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({x:e.date,y:e.dist}));
  } else if (cat==='mobility') {
    const maxD=Math.max(...entries.map(e=>e.dur||0));
    prLabel='Longest session'; prVal=maxD?`${maxD} min`:'—';
    chartPts=entries.filter(e=>e.dur>0).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({x:e.date,y:e.dur}));
  } else {
    const maxW=Math.max(...entries.map(e=>e.weight||0));
    prLabel='PR weight'; prVal=maxW?`${maxW} kg`:'—';
    chartPts=entries.filter(e=>e.weight>0).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({x:e.date,y:e.weight}));
  }
  const prHTML=prVal!=='—'?`<div class="mini-stat"><div class="mini-stat-label"><i class="ti ti-trophy" style="font-size:10px;color:var(--accent);"></i> ${prLabel}</div><div class="mini-stat-val">${prVal}</div></div>`:'';
  const histRows=entries.slice(0,6).map(e=>`<div class="hr"><span class="hr-date">${e.date}</span><span class="hr-detail">${entryMetaStr(e)}</span></div>`).join('');
  panel.innerHTML=`<div class="ex-panel-inner">
    <div class="ex-ph">
      <span class="ex-pname"><i class="ti ti-history" style="font-size:13px;margin-right:5px;color:var(--text3);"></i>${name}</span>
      <button class="ex-close" onclick="closeExPanel()" aria-label="Close"><i class="ti ti-x"></i></button>
    </div>
    <div class="mini-stats">
      <div class="mini-stat"><div class="mini-stat-label">Sessions</div><div class="mini-stat-val">${entries.length}</div></div>
      ${prHTML}
    </div>
    <div class="mini-chart-wrap"><canvas id="mini-chart" role="img" aria-label="Mini progress for ${name}">Progress over time.</canvas></div>
    <div class="section-label" style="margin-bottom:6px;">Recent sessions</div>
    <div class="hist-mini">${histRows}</div>
  </div>`;
  if (miniChart) { miniChart.destroy(); miniChart=null; }
  if (chartPts.length>=2) {
    miniChart=new Chart(document.getElementById('mini-chart'),{
      type:'line',
      data:{labels:chartPts.map(d=>d.x),datasets:[{data:chartPts.map(d=>d.y),borderColor:'#D85A30',backgroundColor:'rgba(216,90,48,0.07)',borderWidth:1.5,pointBackgroundColor:'#D85A30',pointRadius:3,fill:true,tension:0.35}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10},maxRotation:30,maxTicksLimit:5},grid:{color:'rgba(128,128,128,0.07)'}},y:{beginAtZero:false,ticks:{font:{size:10}},grid:{color:'rgba(128,128,128,0.07)'}}}}
    });
  } else {
    const c=document.getElementById('mini-chart'); c.style.display='none';
    const m=document.createElement('div'); m.style.cssText='font-size:12px;color:var(--text3);padding:8px 0;';
    m.textContent='Log 2+ sessions to see the chart.'; c.parentNode.insertBefore(m,c);
  }
}

function closeExPanel() {
  document.getElementById('ex-panel').innerHTML='';
  if (miniChart) { miniChart.destroy(); miniChart=null; }
}

async function addEntry() {
  const name=document.getElementById('ex-name').value.trim();
  const cat =document.getElementById('ex-cat').value;
  const date=document.getElementById('ex-date').value||today();
  if (!name) { showMsg('Enter an exercise name first.',true); return; }

  let entry={id:Date.now(),name,cat,date,sets:0,reps:0,weight:0,dur:0,dist:0,pace:'',notes:''};
  if (cat==='strength') {
    entry.sets  =parseInt(document.getElementById('ex-sets').value)||0;
    entry.reps  =parseInt(document.getElementById('ex-reps').value)||0;
    entry.weight=parseFloat(document.getElementById('ex-weight').value)||0;
    entry.dur   =parseFloat(document.getElementById('ex-dur-s').value)||0;
  } else if (cat==='cardio') {
    entry.dist=parseFloat(document.getElementById('ex-dist').value)||0;
    entry.dur =parseFloat(document.getElementById('ex-dur-c').value)||0;
    entry.pace=document.getElementById('ex-pace').value||'';
  } else {
    entry.dur  =parseFloat(document.getElementById('ex-dur-m').value)||0;
    entry.notes=document.getElementById('ex-notes').value.trim();
  }

  showMsg('Saving…');
  await pushWorkout(entry);
  showMsg('Saved! 💪');

  ['ex-name','ex-sets','ex-reps','ex-weight','ex-dur-s','ex-dist','ex-dur-c','ex-pace','ex-dur-m','ex-notes'].forEach(id=>{
    const el=document.getElementById(id); if (el) el.value='';
  });
  closeExPanel();
  renderTodayLog();
}

function showMsg(msg, err) {
  const el=document.getElementById('log-msg');
  el.textContent=msg; el.style.color=err?'var(--danger)':'var(--success)';
  if (err) setTimeout(()=>el.textContent='',2500);
}

async function deleteEntry(id) {
  await deleteWorkout(id);
  renderTodayLog();
  renderHistory();
  renderProgStats();
  renderProgress();
}

function renderTodayLog() {
  const t=db.filter(e=>e.date===today());
  const el=document.getElementById('today-list');
  if (!t.length) { el.innerHTML=''; return; }
  el.innerHTML=`<div class="section-label" style="margin-bottom:8px;">Today</div><div class="card">${t.map(entryHTML).join('')}</div>`;
}

// ══════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════
function populateHistEx() {
  const sel=document.getElementById('hist-ex'); const cur=sel.value;
  sel.innerHTML='<option value="">All exercises</option>'+
    getExercises().map(e=>`<option value="${e.name}"${e.name===cur?' selected':''}>${e.name}</option>`).join('');
}
function renderHistory() {
  const cat=document.getElementById('hist-cat').value;
  const ex =document.getElementById('hist-ex').value;
  let entries=[...db];
  if (cat) entries=entries.filter(e=>e.cat===cat);
  if (ex)  entries=entries.filter(e=>e.name===ex);
  const el=document.getElementById('history-list');
  if (!entries.length) { el.innerHTML='<div class="empty">No entries yet. Start logging!</div>'; return; }
  el.innerHTML=`<div class="card">${entries.map(entryHTML).join('')}</div>`;
}
function clearHistFilters() {
  document.getElementById('hist-cat').value='';
  document.getElementById('hist-ex').value='';
  renderHistory();
}

// ══════════════════════════════════════════════════════
// PROGRESS
// ══════════════════════════════════════════════════════
function populateProgEx() {
  const sel=document.getElementById('prog-ex'); const cur=sel.value;
  sel.innerHTML='<option value="">— pick an exercise —</option>'+
    getExercises().map(e=>`<option value="${e.name}"${e.name===cur?' selected':''}>${e.name}</option>`).join('');
}
function renderProgStats() {
  const total=db.length;
  const days =new Set(db.map(e=>e.date)).size;
  const vol  =db.filter(e=>e.cat==='strength').reduce((s,e)=>s+(e.sets*e.reps*e.weight),0);
  const km   =db.filter(e=>e.cat==='cardio').reduce((s,e)=>s+(e.dist||0),0);
  document.getElementById('prog-stat-grid').innerHTML=`
    <div class="stat-card"><div class="stat-lbl">Sessions</div><div class="stat-val">${total}</div></div>
    <div class="stat-card"><div class="stat-lbl">Days trained</div><div class="stat-val">${days}</div></div>
    <div class="stat-card"><div class="stat-lbl">Volume</div><div class="stat-val">${(vol/1000).toFixed(1)}t</div></div>
    <div class="stat-card"><div class="stat-lbl">Cardio km</div><div class="stat-val">${km.toFixed(1)}</div></div>`;
}
function renderProgress() {
  const ex   =document.getElementById('prog-ex').value;
  let metric =document.getElementById('prog-metric').value;
  const prHero=document.getElementById('pr-hero-section');
  const prMeta=document.getElementById('pr-meta-section');
  if (!ex) { if(progChart){progChart.destroy();progChart=null;} prHero.innerHTML=''; prMeta.innerHTML=''; return; }
  const entries=db.filter(e=>e.name===ex).sort((a,b)=>a.date.localeCompare(b.date));
  const cat=entries[0]?.cat||'strength';
  if (metric==='auto') metric=cat==='cardio'?'distance':cat==='mobility'?'duration':'weight';
  const byDate={};
  entries.forEach(e=>{ if(!byDate[e.date])byDate[e.date]=[]; byDate[e.date].push(e); });
  const labels=Object.keys(byDate).sort();
  const mLabel={weight:'Max weight (kg)',distance:'Distance (km)',duration:'Duration (min)',volume:'Volume (kg)',reps:'Total reps'};
  const data=labels.map(d=>{
    const rows=byDate[d];
    if(metric==='weight')   return Math.max(...rows.map(e=>e.weight||0));
    if(metric==='distance') return Math.max(...rows.map(e=>e.dist||0));
    if(metric==='duration') return Math.round(rows.reduce((s,e)=>s+e.dur,0));
    if(metric==='volume')   return Math.round(rows.reduce((s,e)=>s+(e.sets*e.reps*e.weight),0));
    if(metric==='reps')     return rows.reduce((s,e)=>s+(e.sets*e.reps),0);
    return 0;
  });
  let prHeroHTML='', prMetaHTML='';
  if (cat==='cardio') {
    const maxDist =Math.max(...entries.map(e=>e.dist||0));
    const prEntry =entries.slice().reverse().find(e=>e.dist===maxDist&&maxDist>0);
    const bestPace=entries.filter(e=>e.pace).sort((a,b)=>{
      const ts=p=>{const[m,s]=(p||'0:0').split(':');return parseInt(m)*60+parseInt(s||0);};
      return ts(a.pace)-ts(b.pace);
    })[0];
    if (prEntry) {
      prHeroHTML=`<div class="pr-hero"><div class="pr-hero-icon"><i class="ti ti-trophy"></i></div><div>
        <div class="pr-hero-label">Best distance — ${ex}</div>
        <div class="pr-hero-val">${maxDist} km</div>
        <div class="pr-hero-sub">Run on ${prEntry.date}${prEntry.dur?` · ${prEntry.dur} min`:''}${prEntry.pace?` · ${prEntry.pace} /km`:''}</div>
      </div></div>`;
      prMetaHTML=`<div class="pr-meta-grid">
        <div class="pr-meta-card"><div class="pr-meta-label">Total runs</div><div class="pr-meta-val">${entries.length}</div></div>
        <div class="pr-meta-card"><div class="pr-meta-label">Total distance</div><div class="pr-meta-val">${entries.reduce((s,e)=>s+(e.dist||0),0).toFixed(1)} km</div></div>
        ${bestPace?`<div class="pr-meta-card"><div class="pr-meta-label">Best pace</div><div class="pr-meta-val">${bestPace.pace} /km</div></div>`:''}
      </div>`;
    }
  } else {
    const maxW   =Math.max(...entries.map(e=>e.weight||0));
    const prEntry=entries.slice().reverse().find(e=>e.weight===maxW&&maxW>0);
    if (prEntry) {
      const firstW=entries.find(e=>e.weight>0);
      const imp   =firstW&&maxW>firstW.weight?((maxW-firstW.weight)/firstW.weight*100).toFixed(1):null;
      prHeroHTML=`<div class="pr-hero"><div class="pr-hero-icon"><i class="ti ti-trophy"></i></div><div>
        <div class="pr-hero-label">Personal record — ${ex}</div>
        <div class="pr-hero-val">${maxW} kg</div>
        <div class="pr-hero-sub">Set on ${prEntry.date}${prEntry.sets&&prEntry.reps?` · ${prEntry.sets}×${prEntry.reps} reps`:''}</div>
      </div></div>`;
      prMetaHTML=`<div class="pr-meta-grid">
        <div class="pr-meta-card"><div class="pr-meta-label">Sessions</div><div class="pr-meta-val">${entries.length}</div></div>
        <div class="pr-meta-card"><div class="pr-meta-label">First logged</div><div class="pr-meta-val">${entries[0]?.date||'—'}</div></div>
        <div class="pr-meta-card"><div class="pr-meta-label">Last logged</div><div class="pr-meta-val">${entries[entries.length-1]?.date||'—'}</div></div>
        ${imp?`<div class="pr-meta-card"><div class="pr-meta-label">Weight gain</div><div class="pr-meta-val" style="color:var(--success);">+${imp}%</div></div>`:''}
      </div>`;
    }
  }
  prHero.innerHTML=prHeroHTML; prMeta.innerHTML=prMetaHTML;
  const canvas=document.getElementById('prog-chart');
  canvas.setAttribute('aria-label',`Progress for ${ex} over ${labels.length} sessions`);
  if (progChart) progChart.destroy();
  progChart=new Chart(canvas,{
    type:'line',
    data:{labels,datasets:[{label:mLabel[metric]||metric,data,borderColor:'#D85A30',backgroundColor:'rgba(216,90,48,0.08)',borderWidth:2,pointBackgroundColor:'#D85A30',pointRadius:4,pointHoverRadius:6,fill:true,tension:0.35}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${mLabel[metric]||metric}: ${ctx.parsed.y}`}}},scales:{x:{ticks:{font:{size:11},maxRotation:40,autoSkip:true,maxTicksLimit:8},grid:{color:'rgba(128,128,128,0.08)'}},y:{beginAtZero:false,ticks:{font:{size:11}},grid:{color:'rgba(128,128,128,0.08)'}}}}
  });
}

// ══════════════════════════════════════════════════════
// API STATUS
// ══════════════════════════════════════════════════════
async function checkAPIStatus() {
  const dot  = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const total = document.getElementById('api-total');
  if (!dot) return;
  dot.style.background  = '#EF9F27';
  text.textContent = 'Checking…';
  try {
    const res  = await fetch(`${API}/workouts`);
    const data = await res.json();
    dot.style.background  = '#639922';
    text.textContent = 'Connected — API is running';
    total.textContent = `${data.length} workouts`;
  } catch(e) {
    dot.style.background  = '#A32D2D';
    text.textContent = 'Cannot reach API — is the server running?';
    total.textContent = '—';
  }
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
loadSplit();

const now = new Date();
calYear  = now.getFullYear(); calMonth  = now.getMonth();
progCalYear = now.getFullYear(); progCalMonth = now.getMonth();

document.getElementById('ex-date').value = today();
document.getElementById('ex-date').max   = today();

// Fetch all workouts from API on load
fetchWorkouts();
