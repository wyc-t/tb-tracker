/* ══════════════════════════════════════════
   TB TRACKER — app.js
   Tactical Barbell PWA — fully offline
   ══════════════════════════════════════════ */

// ─── TB TEMPLATE DEFINITIONS ───
const TB = {
  exercises: ['Back Squat','Trap Bar Deadlift','Bench Press','Pull-up'],
  templates: {
    operator: {
      name: 'Operator',
      desc: '3 exercises, 3×/wk',
      exercisesPerSession: 3,
      sessionsPerWeek: 3,
      weeks: [
        { w:1, sets:3, reps:'5', pct:70 },
        { w:2, sets:3, reps:'5', pct:80 },
        { w:3, sets:3, reps:'5', pct:90 },
        { w:4, sets:3, reps:'5', pct:75 },
        { w:5, sets:3, reps:'5', pct:85 },
        { w:6, sets:3, reps:'5', pct:95 },
      ]
    },
    zulu: {
      name: 'Zulu',
      desc: '4 exercises, 4×/wk, 2 per session',
      exercisesPerSession: 2,
      sessionsPerWeek: 4,
      weeks: [
        { w:1, sets:3, reps:'5', pct:70 },
        { w:2, sets:3, reps:'5', pct:80 },
        { w:3, sets:3, reps:'5', pct:90 },
        { w:4, sets:3, reps:'5', pct:75 },
        { w:5, sets:3, reps:'5', pct:85 },
        { w:6, sets:3, reps:'5', pct:95 },
      ]
    },
    greyMan: {
      name: 'Grey Man',
      desc: '2 exercises, 3×/wk, low volume',
      exercisesPerSession: 2,
      sessionsPerWeek: 3,
      weeks: [
        { w:1, sets:2, reps:'5', pct:70 },
        { w:2, sets:2, reps:'5', pct:80 },
        { w:3, sets:2, reps:'5', pct:90 },
        { w:4, sets:2, reps:'5', pct:75 },
        { w:5, sets:2, reps:'5', pct:85 },
        { w:6, sets:2, reps:'5', pct:95 },
      ]
    },
    operatorX: {
      name: 'Operator-X',
      desc: '3 exercises, 3×/wk, extra volume',
      exercisesPerSession: 3,
      sessionsPerWeek: 3,
      weeks: [
        { w:1, sets:4, reps:'5', pct:70 },
        { w:2, sets:4, reps:'5', pct:80 },
        { w:3, sets:3, reps:'3+', pct:90 },
        { w:4, sets:4, reps:'5', pct:75 },
        { w:5, sets:4, reps:'5', pct:85 },
        { w:6, sets:3, reps:'3+', pct:95 },
      ]
    }
  },
  tmFactor: 0.9,
  roundTo(kg) { return Math.round(kg / 2.5) * 2.5; }
};

// ─── DATABASE ───
let db;
async function initDB() {
  db = await idb.openDB('tb-tracker', 2, {
    upgrade(d, oldV) {
      if (oldV < 1) {
        d.createObjectStore('blocks', { keyPath: 'id' });
        d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('blockId', 'blockId');
        d.createObjectStore('runs', { keyPath: 'id' });
        d.createObjectStore('bodyMeasurements', { keyPath: 'id' });
        d.createObjectStore('prLog', { keyPath: 'id' });
        d.createObjectStore('settings', { keyPath: 'id' });
      }
    }
  });
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

// ─── ROUTING ───
const views = {
  Dashboard: 'viewDashboard',
  Log: 'viewLog',
  Progress: 'viewProgress',
  Blocks: 'viewBlocks',
};
const subViews = {
  logStrength: 'viewLogStrength',
  logRun: 'viewLogRun',
  logBody: 'viewLogBody',
  logPR: 'viewLogPR',
  blockForm: 'viewBlockForm',
  export: 'viewExport',
};

let currentView = 'Dashboard';
let viewHistory = [];

function navigateTo(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const id = views[name] || subViews[name];
  if (!id) return;
  document.getElementById(id).classList.add('active');

  const isMainView = !!views[name];
  const titles = {
    Dashboard:'Dashboard', Log:'Log Session', Progress:'Progress',
    Blocks:'Blocks', logStrength:'Log Strength', logRun:'Log Run',
    logBody:'Body Measurement', logPR:'Log 1RM PR', blockForm:'Block',
    export:'Export / Import'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  const actionBtn = document.getElementById('headerAction');
  if (name === 'Blocks') {
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '⬇ Export';
    actionBtn.onclick = () => navigateTo('export');
  } else if (!isMainView) {
    actionBtn.classList.remove('hidden');
    actionBtn.textContent = '← Back';
    actionBtn.onclick = () => {
      const prev = viewHistory.pop();
      navigateTo(prev || 'Dashboard');
    };
  } else {
    actionBtn.classList.add('hidden');
  }

  document.querySelectorAll('#tabBar .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === name);
  });

  if (!isMainView && !viewHistory.includes(currentView)) {
    viewHistory.push(currentView);
  }
  if (isMainView) viewHistory = [];
  currentView = name;

  // Hooks
  if (name === 'Dashboard') refreshDashboard();
  if (name === 'Progress') refreshProgress();
  if (name === 'Blocks') refreshBlocks();
  if (name === 'logStrength') initStrengthForm();
}

// ─── TOAST ───
function toast(msg, dur = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), dur);
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════
async function refreshDashboard() {
  const blocks = await db.getAll('blocks');
  const active = blocks.find(b => b.active) || blocks[blocks.length - 1];

  document.getElementById('dashBlockName').textContent = active ? active.name : 'No block yet';
  document.getElementById('dashTemplate').textContent = active
    ? TB.templates[active.template]?.name || active.template
    : 'Create one in Blocks tab';

  // Last lift
  const sessions = await db.getAll('sessions');
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  const lastLift = sessions[0];
  document.getElementById('dashLastLift').textContent = lastLift
    ? daysAgo(lastLift.date) : '—';

  // Last run
  const runs = await db.getAll('runs');
  runs.sort((a, b) => b.date.localeCompare(a.date));
  const lastRun = runs[0];
  document.getElementById('dashLastRun').textContent = lastRun
    ? daysAgo(lastRun.date) : '—';

  // Weekly km
  const weekStart = getWeekStart();
  const weekKm = runs
    .filter(r => r.date >= weekStart)
    .reduce((s, r) => s + (parseFloat(r.distance) || 0), 0);
  document.getElementById('dashWeekKm').textContent = weekKm.toFixed(1);

  // PRs
  const prs = await db.getAll('prLog');
  const prContainer = document.getElementById('dashPRs');
  prContainer.innerHTML = '';
  const bestPR = {};
  prs.forEach(p => {
    if (!bestPR[p.exercise] || p.load > bestPR[p.exercise].load) {
      bestPR[p.exercise] = p;
    }
  });
  TB.exercises.forEach(ex => {
    const pr = bestPR[ex];
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.innerHTML = `<div class="pr-name">${ex}</div>
      <div class="pr-val">${pr ? pr.load + ' kg' : '—'}</div>
      <div class="pr-date">${pr ? pr.date : ''}</div>`;
    prContainer.appendChild(card);
  });

  // Body
  const body = await db.getAll('bodyMeasurements');
  body.sort((a, b) => b.date.localeCompare(a.date));
  const latest = body[0];
  const bodyEl = document.getElementById('dashBody');
  if (latest) {
    let parts = [`<strong>${latest.weight || '?'} kg</strong> — ${latest.date}`];
    const fields = ['neck','chest','waist','hips','leftArm','rightArm','leftThigh','rightThigh'];
    const labels = ['Neck','Chest','Waist','Hips','L Arm','R Arm','L Thigh','R Thigh'];
    fields.forEach((f, i) => {
      if (latest[f]) parts.push(`${labels[i]}: ${latest[f]} cm`);
    });
    bodyEl.innerHTML = `<span class="dash-label">Latest</span><span class="dash-val" style="font-size:.9rem;line-height:1.6">${parts.join('<br>')}</span>`;
  } else {
    bodyEl.innerHTML = '<span class="dash-val" style="font-size:.85rem;opacity:.5">No measurements yet</span>';
  }

  // Recent sessions
  const recentEl = document.getElementById('dashRecent');
  recentEl.innerHTML = '';
  const combined = [
    ...sessions.slice(0, 5).map(s => ({ type: 'Strength', date: s.date, detail: summariseSession(s) })),
    ...runs.slice(0, 5).map(r => ({ type: r.type || 'Run', date: r.date, detail: `${r.distance || 0} km · ${r.duration || 0} min` }))
  ];
  combined.sort((a, b) => b.date.localeCompare(a.date));
  if (combined.length === 0) {
    recentEl.innerHTML = '<div class="empty-state">No sessions logged yet</div>';
  } else {
    combined.slice(0, 5).forEach(c => {
      const d = document.createElement('div');
      d.className = 'recent-item';
      d.innerHTML = `<span class="ri-type">${c.type}</span><span class="ri-date">${c.date}</span><div class="ri-detail">${c.detail}</div>`;
      recentEl.appendChild(d);
    });
  }
}

function summariseSession(s) {
  return (s.exercises || []).map(e => {
    const best = e.sets.reduce((m, set) => Math.max(m, set.load || 0), 0);
    return `${e.name}: ${e.sets.length}×${best} kg`;
  }).join(' · ');
}

function daysAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return diff + 'd ago';
}

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════
//  LOG STRENGTH SESSION
// ═══════════════════════════════════════════
async function initStrengthForm() {
  document.getElementById('strDate').value = today();

  // Populate block selector
  const blocks = await db.getAll('blocks');
  const sel = document.getElementById('strBlock');
  sel.innerHTML = '';
  blocks.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    if (b.active) opt.selected = true;
    sel.appendChild(opt);
  });
  if (blocks.length === 0) {
    sel.innerHTML = '<option value="">No blocks — create one first</option>';
  }

  // Clear exercises
  document.getElementById('strExercises').innerHTML = '';
  addExerciseEntry();

  // Show suggestion
  updateStrengthSuggestion();
  sel.addEventListener('change', updateStrengthSuggestion);
  document.getElementById('strWeek').addEventListener('change', updateStrengthSuggestion);
}

async function updateStrengthSuggestion() {
  const blockId = document.getElementById('strBlock').value;
  const weekNum = parseInt(document.getElementById('strWeek').value);
  const suggEl = document.getElementById('strSuggestion');

  if (!blockId) { suggEl.classList.add('hidden'); return; }
  const block = await db.get('blocks', blockId);
  if (!block) { suggEl.classList.add('hidden'); return; }

  const tpl = TB.templates[block.template];
  if (!tpl) { suggEl.classList.add('hidden'); return; }

  const weekDef = tpl.weeks.find(w => w.w === weekNum);
  if (!weekDef) { suggEl.classList.add('hidden'); return; }

  const lines = [];
  lines.push(`<strong>${tpl.name} — Week ${weekNum}: ${weekDef.sets}×${weekDef.reps} @ ${weekDef.pct}%</strong>`);
  const tm = block.trainingMaxes || {};
  TB.exercises.forEach(ex => {
    const key = exKey(ex);
    if (tm[key]) {
      const load = TB.roundTo(tm[key] * weekDef.pct / 100);
      lines.push(`${ex}: ${load} kg`);
    }
  });
  suggEl.innerHTML = lines.join('<br>');
  suggEl.classList.remove('hidden');
}

function exKey(name) {
  // Map assisted pull-up to same TM as pull-up
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  return n === 'assistedpullup' ? 'pullup' : n;
}

function addExerciseEntry(preselect) {
  const tpl = document.getElementById('tplExercise').content.cloneNode(true);
  const entry = tpl.querySelector('.exercise-entry');
  if (preselect) {
    entry.querySelector('.ex-name').value = preselect;
  }
  entry.querySelector('.btn-remove-ex').addEventListener('click', () => entry.remove());
  entry.querySelector('.btn-add-set').addEventListener('click', () => addSetRow(entry));
  // Start with 3 sets
  for (let i = 0; i < 3; i++) addSetRow(entry);

  // Auto-fill load from suggestion
  const blockId = document.getElementById('strBlock').value;
  const weekNum = parseInt(document.getElementById('strWeek').value);
  autoFillLoad(entry, blockId, weekNum);

  // Re-fill on exercise change
  entry.querySelector('.ex-name').addEventListener('change', () => {
    const bId = document.getElementById('strBlock').value;
    const wk = parseInt(document.getElementById('strWeek').value);
    autoFillLoad(entry, bId, wk);
  });

  document.getElementById('strExercises').appendChild(entry);
}

async function autoFillLoad(entry, blockId, weekNum) {
  if (!blockId) return;
  const block = await db.get('blocks', blockId);
  if (!block) return;
  const tpl = TB.templates[block.template];
  if (!tpl) return;
  const weekDef = tpl.weeks.find(w => w.w === weekNum);
  if (!weekDef) return;

  const exName = entry.querySelector('.ex-name').value;
  const key = exKey(exName);
  const tm = block.trainingMaxes || {};
  if (!tm[key]) return;

  const load = TB.roundTo(tm[key] * weekDef.pct / 100);
  entry.querySelectorAll('.set-load').forEach(inp => { inp.value = load; });
  entry.querySelectorAll('.set-reps').forEach(inp => {
    if (!inp.value) inp.value = weekDef.reps.replace('+', '');
  });
}

function addSetRow(entry) {
  const tpl = document.getElementById('tplSet').content.cloneNode(true);
  const row = tpl.querySelector('.set-row');
  const list = entry.querySelector('.sets-list');
  row.querySelector('.set-num').textContent = list.children.length + 1;
  row.querySelector('.btn-remove-set').addEventListener('click', () => {
    row.remove();
    renumberSets(entry);
  });
  list.appendChild(row);
}

function renumberSets(entry) {
  entry.querySelectorAll('.set-row').forEach((r, i) => {
    r.querySelector('.set-num').textContent = i + 1;
  });
}

document.getElementById('addExerciseBtn').addEventListener('click', () => addExerciseEntry());

document.getElementById('formStrength').addEventListener('submit', async e => {
  e.preventDefault();
  const blockId = document.getElementById('strBlock').value;
  if (!blockId) { toast('Create a block first'); return; }

  const exercises = [];
  document.querySelectorAll('.exercise-entry').forEach(entry => {
    const name = entry.querySelector('.ex-name').value;
    const sets = [];
    entry.querySelectorAll('.set-row').forEach(row => {
      const reps = parseInt(row.querySelector('.set-reps').value) || 0;
      const load = parseFloat(row.querySelector('.set-load').value) || 0;
      if (reps > 0 || load > 0) sets.push({ reps, load });
    });
    if (sets.length > 0) exercises.push({ name, sets });
  });

  if (exercises.length === 0) { toast('Add at least one exercise'); return; }

  const session = {
    id: uid(),
    blockId,
    date: document.getElementById('strDate').value || today(),
    week: parseInt(document.getElementById('strWeek').value),
    exercises,
    notes: document.getElementById('strNotes').value.trim()
  };
  await db.put('sessions', session);
  toast('Session saved ✓');
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  LOG RUN
// ═══════════════════════════════════════════
document.getElementById('runDate').value = today();
document.getElementById('formRun').addEventListener('submit', async e => {
  e.preventDefault();
  const run = {
    id: uid(),
    date: document.getElementById('runDate').value || today(),
    type: document.getElementById('runType').value,
    distance: parseFloat(document.getElementById('runDist').value) || 0,
    duration: parseFloat(document.getElementById('runDur').value) || 0,
    avgHR: parseInt(document.getElementById('runHR').value) || null,
    notes: document.getElementById('runNotes').value.trim()
  };
  await db.put('runs', run);
  toast('Run saved ✓');
  document.getElementById('formRun').reset();
  document.getElementById('runDate').value = today();
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  LOG BODY MEASUREMENT
// ═══════════════════════════════════════════
document.getElementById('bodyDate').value = today();
document.getElementById('formBody').addEventListener('submit', async e => {
  e.preventDefault();
  const m = {
    id: uid(),
    date: document.getElementById('bodyDate').value || today(),
    weight: parseFloat(document.getElementById('bodyWeight').value) || null,
    neck: parseFloat(document.getElementById('bodyNeck').value) || null,
    chest: parseFloat(document.getElementById('bodyChest').value) || null,
    waist: parseFloat(document.getElementById('bodyWaist').value) || null,
    hips: parseFloat(document.getElementById('bodyHips').value) || null,
    leftArm: parseFloat(document.getElementById('bodyLArm').value) || null,
    rightArm: parseFloat(document.getElementById('bodyRArm').value) || null,
    leftThigh: parseFloat(document.getElementById('bodyLThigh').value) || null,
    rightThigh: parseFloat(document.getElementById('bodyRThigh').value) || null,
  };
  await db.put('bodyMeasurements', m);
  toast('Measurement saved ✓');
  document.getElementById('formBody').reset();
  document.getElementById('bodyDate').value = today();
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  LOG 1RM PR
// ═══════════════════════════════════════════
document.getElementById('prDate').value = today();
document.getElementById('formPR').addEventListener('submit', async e => {
  e.preventDefault();
  const pr = {
    id: uid(),
    exercise: document.getElementById('prExercise').value,
    date: document.getElementById('prDate').value || today(),
    load: parseFloat(document.getElementById('prLoad').value) || 0,
  };
  if (pr.load <= 0) { toast('Enter a load'); return; }
  await db.put('prLog', pr);
  toast('PR saved ✓');
  document.getElementById('formPR').reset();
  document.getElementById('prDate').value = today();
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════
let chartStr, chartMileage, chartPace, chartBW;

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ptab').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('progress' + capitalise(btn.dataset.ptab)).classList.add('active');
    refreshProgress();
  });
});

document.getElementById('progExercise').addEventListener('change', () => refreshProgress());

async function refreshProgress() {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.ptab;
  if (activeTab === 'strength') await refreshStrengthProgress();
  else if (activeTab === 'running') await refreshRunningProgress();
  else if (activeTab === 'body') await refreshBodyProgress();
}

async function refreshStrengthProgress() {
  const ex = document.getElementById('progExercise').value;
  const sessions = await db.getAll('sessions');
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  const data = [];
  sessions.forEach(s => {
    const match = (s.exercises || []).find(e => e.name === ex);
    if (match) {
      const bestLoad = match.sets.reduce((m, set) => Math.max(m, set.load || 0), 0);
      data.push({ date: s.date, load: bestLoad });
    }
  });

  if (chartStr) chartStr.destroy();
  const ctx = document.getElementById('chartStrength').getContext('2d');
  chartStr = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: ex + ' (best set kg)',
        data: data.map(d => d.load),
        borderColor: '#e8c547',
        backgroundColor: 'rgba(232,197,71,.15)',
        fill: true,
        tension: .3,
        pointRadius: 4,
        pointBackgroundColor: '#e8c547',
      }]
    },
    options: chartOpts('kg')
  });

  // PR history
  const prs = (await db.getAll('prLog')).filter(p => p.exercise === ex);
  prs.sort((a, b) => b.date.localeCompare(a.date));
  const prEl = document.getElementById('prHistory');
  if (prs.length === 0) {
    prEl.innerHTML = '<div class="empty-state">No PRs logged</div>';
  } else {
    prEl.innerHTML = '<table class="data-table"><thead><tr><th>Date</th><th>Load</th></tr></thead><tbody>'
      + prs.map(p => `<tr><td>${p.date}</td><td>${p.load} kg</td></tr>`).join('') + '</tbody></table>';
  }
}

async function refreshRunningProgress() {
  const runs = await db.getAll('runs');
  runs.sort((a, b) => a.date.localeCompare(b.date));

  // Weekly mileage
  const weekMap = {};
  runs.forEach(r => {
    const ws = isoWeek(r.date);
    weekMap[ws] = (weekMap[ws] || 0) + (parseFloat(r.distance) || 0);
  });
  const weeks = Object.keys(weekMap).sort();

  if (chartMileage) chartMileage.destroy();
  chartMileage = new Chart(document.getElementById('chartMileage').getContext('2d'), {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [{ label: 'Weekly km', data: weeks.map(w => weekMap[w]),
        backgroundColor: 'rgba(91,141,239,.6)', borderColor: '#5b8def', borderWidth: 1 }]
    },
    options: chartOpts('km')
  });

  // Pace over time
  const paceData = runs.filter(r => r.distance > 0 && r.duration > 0).map(r => ({
    date: r.date,
    pace: r.duration / r.distance // min/km
  }));

  if (chartPace) chartPace.destroy();
  chartPace = new Chart(document.getElementById('chartPace').getContext('2d'), {
    type: 'line',
    data: {
      labels: paceData.map(d => d.date),
      datasets: [{ label: 'Pace (min/km)', data: paceData.map(d => +d.pace.toFixed(2)),
        borderColor: '#4caf7a', backgroundColor: 'rgba(76,175,122,.15)', fill: true, tension: .3,
        pointRadius: 4, pointBackgroundColor: '#4caf7a' }]
    },
    options: chartOpts('min/km')
  });
}

async function refreshBodyProgress() {
  const body = await db.getAll('bodyMeasurements');
  body.sort((a, b) => a.date.localeCompare(b.date));

  const bwData = body.filter(b => b.weight);
  if (chartBW) chartBW.destroy();
  chartBW = new Chart(document.getElementById('chartBodyweight').getContext('2d'), {
    type: 'line',
    data: {
      labels: bwData.map(d => d.date),
      datasets: [{ label: 'Bodyweight (kg)', data: bwData.map(d => d.weight),
        borderColor: '#e05555', backgroundColor: 'rgba(224,85,85,.15)', fill: true, tension: .3,
        pointRadius: 4, pointBackgroundColor: '#e05555' }]
    },
    options: chartOpts('kg')
  });

  // Measurement table
  const histEl = document.getElementById('bodyHistory');
  if (body.length === 0) {
    histEl.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }
  const cols = ['Date','Weight','Neck','Chest','Waist','Hips','L Arm','R Arm','L Thigh','R Thigh'];
  const keys = ['date','weight','neck','chest','waist','hips','leftArm','rightArm','leftThigh','rightThigh'];
  let html = '<table class="data-table"><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  body.slice().reverse().forEach(b => {
    html += '<tr>' + keys.map(k => `<td>${b[k] != null ? b[k] : '—'}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  histEl.innerHTML = html;
}

function chartOpts(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#8b8a96', font: { size: 11 } } },
    },
    scales: {
      x: { ticks: { color: '#8b8a96', maxRotation: 45, font: { size: 10 } }, grid: { color: '#2a2a3a' } },
      y: { ticks: { color: '#8b8a96', font: { size: 10 }, callback: v => v + ' ' + unit }, grid: { color: '#2a2a3a' } }
    }
  };
}

function isoWeek(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ═══════════════════════════════════════════
//  BLOCKS
// ═══════════════════════════════════════════
async function refreshBlocks() {
  const blocks = await db.getAll('blocks');
  blocks.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const el = document.getElementById('blockList');
  if (blocks.length === 0) {
    el.innerHTML = '<div class="empty-state">No blocks yet. Create your first block to get started.</div>';
    return;
  }
  el.innerHTML = '';
  blocks.forEach(b => {
    const tpl = TB.templates[b.template];
    const tm = b.trainingMaxes || {};
    const tmStr = TB.exercises.map(ex => {
      const k = exKey(ex);
      return tm[k] ? `${ex}: ${tm[k]} kg` : null;
    }).filter(Boolean).join(' · ');

    const div = document.createElement('div');
    div.className = 'block-item' + (b.active ? ' is-active' : '');
    div.innerHTML = `
      <div class="bi-name">${b.name}${b.active ? '<span class="bi-badge">Active</span>' : ''}</div>
      <div class="bi-template">${tpl ? tpl.name : b.template}</div>
      <div class="bi-date">${b.startDate || '—'}</div>
      <div class="bi-tm">TM: ${tmStr || 'not set'}</div>
      <div class="bi-actions">
        <button data-edit="${b.id}">Edit</button>
        ${!b.active ? `<button data-activate="${b.id}">Set Active</button>` : ''}
        <button data-delete="${b.id}" style="color:var(--red)">Delete</button>
      </div>`;
    el.appendChild(div);
  });

  el.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => editBlock(btn.dataset.edit));
  });
  el.querySelectorAll('[data-activate]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const blocks = await db.getAll('blocks');
      for (const bl of blocks) {
        bl.active = bl.id === btn.dataset.activate;
        await db.put('blocks', bl);
      }
      toast('Block activated');
      refreshBlocks();
    });
  });
  el.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this block?')) return;
      await db.delete('blocks', btn.dataset.delete);
      toast('Block deleted');
      refreshBlocks();
    });
  });
}

document.getElementById('newBlockBtn').addEventListener('click', () => {
  document.getElementById('formBlock').reset();
  document.getElementById('blockEditId').value = '';
  document.getElementById('blockStart').value = today();
  document.getElementById('blockActive').checked = true;
  document.getElementById('blockTMDisplay').innerHTML = '';
  navigateTo('blockForm');
});

async function editBlock(id) {
  const block = await db.get('blocks', id);
  if (!block) return;
  document.getElementById('blockEditId').value = block.id;
  document.getElementById('blockName').value = block.name;
  document.getElementById('blockTemplate').value = block.template;
  document.getElementById('blockStart').value = block.startDate || '';
  document.getElementById('blockActive').checked = block.active;

  const tm = block.trainingMaxes || {};
  // Reverse-calc 1RM from TM
  document.getElementById('block1rmSquat').value = tm.backsquat ? Math.round(tm.backsquat / TB.tmFactor * 10) / 10 : '';
  document.getElementById('block1rmDeadlift').value = tm.trapbardeadlift ? Math.round(tm.trapbardeadlift / TB.tmFactor * 10) / 10 : '';
  document.getElementById('block1rmBench').value = tm.benchpress ? Math.round(tm.benchpress / TB.tmFactor * 10) / 10 : '';
  document.getElementById('block1rmPullup').value = tm.pullup ? Math.round(tm.pullup / TB.tmFactor * 10) / 10 : '';

  updateTMDisplay();
  navigateTo('blockForm');
}

// Live TM display
['block1rmSquat','block1rmDeadlift','block1rmBench','block1rmPullup'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateTMDisplay);
});

function updateTMDisplay() {
  const ids = [
    { id: 'block1rmSquat', label: 'Squat TM' },
    { id: 'block1rmDeadlift', label: 'Deadlift TM' },
    { id: 'block1rmBench', label: 'Bench TM' },
    { id: 'block1rmPullup', label: 'Pull-up TM' },
  ];
  const el = document.getElementById('blockTMDisplay');
  el.innerHTML = '';
  ids.forEach(({ id, label }) => {
    const val = parseFloat(document.getElementById(id).value);
    if (val > 0) {
      const tm = TB.roundTo(val * TB.tmFactor);
      el.innerHTML += `<span>${label}: <strong>${tm} kg</strong></span>`;
    }
  });
}

document.getElementById('formBlock').addEventListener('submit', async e => {
  e.preventDefault();
  const editId = document.getElementById('blockEditId').value;

  const trainingMaxes = {};
  const sq = parseFloat(document.getElementById('block1rmSquat').value);
  const dl = parseFloat(document.getElementById('block1rmDeadlift').value);
  const bp = parseFloat(document.getElementById('block1rmBench').value);
  const pu = parseFloat(document.getElementById('block1rmPullup').value);
  if (sq > 0) trainingMaxes.backsquat = TB.roundTo(sq * TB.tmFactor);
  if (dl > 0) trainingMaxes.trapbardeadlift = TB.roundTo(dl * TB.tmFactor);
  if (bp > 0) trainingMaxes.benchpress = TB.roundTo(bp * TB.tmFactor);
  if (pu > 0) trainingMaxes.pullup = TB.roundTo(pu * TB.tmFactor);

  const isActive = document.getElementById('blockActive').checked;

  // If setting active, deactivate others
  if (isActive) {
    const all = await db.getAll('blocks');
    for (const bl of all) {
      if (bl.id !== editId && bl.active) {
        bl.active = false;
        await db.put('blocks', bl);
      }
    }
  }

  const block = {
    id: editId || uid(),
    name: document.getElementById('blockName').value.trim(),
    template: document.getElementById('blockTemplate').value,
    startDate: document.getElementById('blockStart').value || today(),
    active: isActive,
    trainingMaxes,
  };
  await db.put('blocks', block);
  toast('Block saved ✓');
  navigateTo('Blocks');
});

// ═══════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════
document.getElementById('exportBtn').addEventListener('click', async () => {
  const stores = ['blocks','sessions','runs','bodyMeasurements','prLog','settings'];
  const data = {};
  for (const s of stores) {
    data[s] = await db.getAll(s);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tb-tracker-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exported ✓');
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const file = document.getElementById('importFile').files[0];
  if (!file) { toast('Select a file first'); return; }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const stores = ['blocks','sessions','runs','bodyMeasurements','prLog','settings'];
    for (const s of stores) {
      if (data[s]) {
        const tx = db.transaction(s, 'readwrite');
        await tx.store.clear();
        for (const item of data[s]) {
          await tx.store.put(item);
        }
        await tx.done;
      }
    }
    toast('Import complete ✓');
    refreshDashboard();
  } catch (err) {
    toast('Import failed: ' + err.message);
  }
});

// ═══════════════════════════════════════════
//  NAVIGATION WIRING
// ═══════════════════════════════════════════
document.querySelectorAll('#tabBar .tab').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

document.querySelectorAll('.log-tile').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.goto;
    // Set dates fresh
    const dateIds = { logStrength:'strDate', logRun:'runDate', logBody:'bodyDate', logPR:'prDate' };
    if (dateIds[target]) document.getElementById(dateIds[target]).value = today();
    navigateTo(target);
  });
});

// ═══════════════════════════════════════════
//  FIRST LAUNCH — seed default block
// ═══════════════════════════════════════════
async function seedDefaults() {
  const blocks = await db.getAll('blocks');
  if (blocks.length === 0) {
    await db.put('blocks', {
      id: uid(),
      name: 'Block 1',
      template: 'operator',
      startDate: today(),
      active: true,
      trainingMaxes: {}
    });
  }
}

// ═══════════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
(async () => {
  await initDB();
  await seedDefaults();
  await registerSW();
  navigateTo('Dashboard');
})();
