/* ══════════════════════════════════════════
   TB TRACKER — app.js  v5
   ══════════════════════════════════════════ */

// ─── TEMPLATES (exact from TB book) ───
const TB = {
  // Canonical exercise names used in templates
  allExercises: ['Squat','Bench','Deadlift','Weighted Pull-up','Assisted Pull-up','Military Press'],
  prExercises:  ['Squat','Bench','Deadlift','Weighted Pull-up','Military Press'],

  templates: {
    operator: {
      name: 'Operator',
      daysPerWeek: 3,
      schedule: 'Every other day',
      sessions: ['A','A','B'],
      days: {
        A: ['Squat','Bench','Weighted Pull-up'],
        B: ['Squat','Bench','Deadlift']
      },
      weeks: [
        { w:1, sets:'3-5', setsNum:5, reps:5, pct:70 },
        { w:2, sets:'3-5', setsNum:5, reps:5, pct:80 },
        { w:3, sets:'3-4', setsNum:3, reps:3, pct:90 },
        { w:4, sets:'3-5', setsNum:5, reps:5, pct:75 },
        { w:5, sets:'3-5', setsNum:3, reps:3, pct:85 },
        { w:6, sets:'3-4', setsNum:2, reps:2, pct:95 },
      ]
    },
    zulu: {
      name: 'Zulu',
      daysPerWeek: 4,
      schedule: 'A/B alternating',
      sessions: ['A','B','A','B'],
      days: {
        A: ['Military Press','Squat','Weighted Pull-up'],
        B: ['Bench','Deadlift']
      },
      weeks: [
        { w:1, sets:'3', setsNum:3, reps:5, pct:70 },
        { w:2, sets:'3', setsNum:3, reps:5, pct:80 },
        { w:3, sets:'3', setsNum:3, reps:3, pct:90 },
        { w:4, sets:'3', setsNum:3, reps:5, pct:70 },
        { w:5, sets:'3', setsNum:3, reps:5, pct:80 },
        { w:6, sets:'3', setsNum:3, reps:3, pct:90 },
      ]
    },
    fighter: {
      name: 'Fighter',
      daysPerWeek: 2,
      schedule: '2 sessions per week',
      sessions: ['A','A'],
      days: {
        A: ['Squat','Bench','Military Press','Deadlift']
      },
      weeks: [
        { w:1, sets:'3-5', setsNum:5, reps:5, pct:70 },
        { w:2, sets:'3-5', setsNum:5, reps:5, pct:80 },
        { w:3, sets:'3-5', setsNum:5, reps:3, pct:90 },
        { w:4, sets:'3-5', setsNum:5, reps:5, pct:75 },
        { w:5, sets:'3-5', setsNum:3, reps:3, pct:85 },
        { w:6, sets:'3-5', setsNum:3, reps:3, pct:90 },
      ]
    },
    mass: {
      name: 'Mass',
      daysPerWeek: 3,
      schedule: 'Every other day',
      sessions: ['A','A','A'],
      days: {
        A: ['Squat','Bench','Military Press','Deadlift']
      },
      weeks: [
        { w:1, sets:'4', setsNum:4, reps:6, pct:70 },
        { w:2, sets:'4', setsNum:4, reps:6, pct:80 },
        { w:3, sets:'4', setsNum:4, reps:6, pct:85 },
        { w:4, sets:'4', setsNum:4, reps:6, pct:70 },
        { w:5, sets:'4', setsNum:4, reps:6, pct:80 },
        { w:6, sets:'4', setsNum:4, reps:3, pct:90 },
      ]
    }
  },

  TM_FACTOR: 0.9,
  roundTo(kg) { return Math.round(kg / 2.5) * 2.5; },

  // Bar weights
  barWeight(exercise) {
    if (exercise === 'Deadlift') return 25;           // trap bar
    if (exercise === 'Weighted Pull-up') return 0;
    if (exercise === 'Assisted Pull-up') return 0;
    return 20; // Squat, Bench, Military Press — standard bar
  },

  // Available plates (per side)
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],

  calcPlates(totalKg, exercise) {
    const bar = TB.barWeight(exercise);
    if (exercise === 'Weighted Pull-up' || exercise === 'Assisted Pull-up') return null;
    const remainder = totalKg - bar;
    if (remainder <= 0) return { bar, perSide: [], total: bar };
    const perSide = remainder / 2;
    const plates = [];
    let left = perSide;
    for (const p of TB.plates) {
      while (left >= p - 0.001) {
        plates.push(p);
        left -= p;
      }
    }
    return { bar, perSide: plates, total: totalKg };
  },

  formatPlates(info) {
    if (!info) return '';
    if (info.perSide.length === 0) return `Bar only (${info.bar} kg)`;
    // Group plates
    const counts = {};
    info.perSide.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const parts = Object.entries(counts).sort((a,b) => b[0]-a[0])
      .map(([p, n]) => n > 1 ? `${n}×${p}` : `${p}`);
    return `${info.bar} kg bar + ${parts.join(' + ')} per side`;
  }
};

// ─── DATABASE ───
let db;
async function initDB() {
  db = await idb.openDB('tb-tracker', 3, {
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

// ─── EXERCISE KEY MAPPING ───
function exKey(name) {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n === 'assistedpullup') return 'weightedpullup';
  return n;
}

// ─── ROUTING ───
const views = { Dashboard:'viewDashboard', Log:'viewLog', Progress:'viewProgress', Blocks:'viewBlocks' };
const subViews = { logStrength:'viewLogStrength', logRun:'viewLogRun', logBody:'viewLogBody',
  logPR:'viewLogPR', blockForm:'viewBlockForm', export:'viewExport' };
let currentView = 'Dashboard';
let viewHistory = [];

function navigateTo(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Hide stopwatch when leaving strength log
  if (currentView === 'logStrength' && name !== 'logStrength' && swVisible) hideStopwatch();
  const id = views[name] || subViews[name];
  if (!id) return;
  document.getElementById(id).classList.add('active');
  const isMain = !!views[name];
  const titles = { Dashboard:'Dashboard',Log:'Log Session',Progress:'Progress',Blocks:'Blocks',
    logStrength:'Log Strength',logRun:'Log Run',logBody:'Body Measurement',logPR:'Log 1RM PR',
    blockForm:'Block',export:'Export / Import' };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  const btn = document.getElementById('headerAction');
  if (name === 'Blocks') {
    btn.classList.remove('hidden'); btn.textContent = '⬇ Export';
    btn.onclick = () => navigateTo('export');
  } else if (!isMain) {
    btn.classList.remove('hidden'); btn.textContent = '← Back';
    btn.onclick = () => navigateTo(viewHistory.pop() || 'Dashboard');
  } else { btn.classList.add('hidden'); }
  document.querySelectorAll('#tabBar .tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  if (!isMain && !viewHistory.includes(currentView)) viewHistory.push(currentView);
  if (isMain) viewHistory = [];
  currentView = name;
  if (name === 'Dashboard') refreshDashboard();
  if (name === 'Progress') refreshProgress();
  if (name === 'Blocks') refreshBlocks();
  if (name === 'logStrength') initStrengthForm();
  if (name === 'Log') refreshLogbook();
}

function toast(msg, dur = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), dur);
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function daysAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday';
  return diff + 'd ago';
}
function getWeekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}
function isoWeek(dateStr) {
  const d = new Date(dateStr); d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}
function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatSec(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
}

async function getLatestBodyweight() {
  const all = await db.getAll('bodyMeasurements');
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all[0]?.weight || null;
}

function computeTrainingWeight(oneRM, pct, useTM) {
  if (useTM) {
    const tm = oneRM * TB.TM_FACTOR;
    return TB.roundTo(tm * pct / 100);
  }
  return TB.roundTo(oneRM * pct / 100);
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════
async function refreshDashboard() {
  const blocks = await db.getAll('blocks');
  const active = blocks.find(b => b.active) || blocks[blocks.length - 1];
  document.getElementById('dashBlockName').textContent = active ? active.name : 'No block yet';
  document.getElementById('dashTemplate').textContent = active
    ? (TB.templates[active.template]?.name || active.template) : 'Create one in Blocks tab';

  const sessions = await db.getAll('sessions');
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('dashLastLift').textContent = sessions[0] ? daysAgo(sessions[0].date) : '—';

  const runs = await db.getAll('runs');
  runs.sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('dashLastRun').textContent = runs[0] ? daysAgo(runs[0].date) : '—';

  const weekStart = getWeekStart();
  const weekKm = runs.filter(r => r.date >= weekStart).reduce((s, r) => s + (parseFloat(r.distance) || 0), 0);
  document.getElementById('dashWeekKm').textContent = weekKm.toFixed(1);

  // PRs
  const prs = await db.getAll('prLog');
  const prContainer = document.getElementById('dashPRs');
  prContainer.innerHTML = '';
  // Group PRs by exercise, sort each group by date ascending
  const prByEx = {};
  prs.forEach(p => {
    if (!prByEx[p.exercise]) prByEx[p.exercise] = [];
    prByEx[p.exercise].push(p);
  });
  Object.keys(prByEx).forEach(ex => prByEx[ex].sort((a, b) => a.date.localeCompare(b.date)));

  TB.prExercises.forEach(ex => {
    const entries = prByEx[ex] || [];
    const latest = entries[entries.length - 1] || null;
    const prev = entries.length >= 2 ? entries[entries.length - 2] : null;
    let pctHtml = '';
    if (latest && prev && prev.load > 0) {
      const pct = ((latest.load - prev.load) / prev.load * 100);
      const sign = pct >= 0 ? '+' : '';
      const col = pct > 0 ? 'var(--green, #4caf7a)' : pct < 0 ? 'var(--red, #e05555)' : '#8b8a96';
      pctHtml = `<div class="pr-pct" style="color:${col};font-size:.75rem;margin-top:.1rem">${sign}${pct.toFixed(1)}%</div>`;
    }
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.innerHTML = `<div class="pr-name">${ex}</div>
      <div class="pr-val">${latest ? latest.load + ' kg' : '—'}</div>
      <div class="pr-date">${latest ? latest.date : ''}</div>${pctHtml}`;
    prContainer.appendChild(card);
  });

  // Body
  const body = await db.getAll('bodyMeasurements');
  body.sort((a, b) => b.date.localeCompare(a.date));
  const latest = body[0];
  const bodyEl = document.getElementById('dashBody');
  if (latest) {
    let parts = [`<strong>${latest.weight || '?'} kg</strong> — ${latest.date}`];
    ['neck','chest','waist','hips','leftArm','rightArm','leftThigh','rightThigh']
      .forEach((f, i) => { if (latest[f]) parts.push(`${['Neck','Chest','Waist','Hips','L Arm','R Arm','L Thigh','R Thigh'][i]}: ${latest[f]} cm`); });
    bodyEl.innerHTML = `<span class="dash-label">Latest</span><span class="dash-val" style="font-size:.9rem;line-height:1.6">${parts.join('<br>')}</span>`;
  } else {
    bodyEl.innerHTML = '<span class="dash-val" style="font-size:.85rem;opacity:.5">No measurements yet</span>';
  }

  // Recent — last 7 days only
  const recentEl = document.getElementById('dashRecent');
  recentEl.innerHTML = '';
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const combined = [
    ...sessions.filter(s => s.date >= cutoffStr).map(s => ({ type: `W${s.week||'?'} D${s.day||'?'}`, date: s.date, detail: summariseSession(s) })),
    ...runs.filter(r => r.date >= cutoffStr).map(r => ({ type: r.type || 'Run', date: r.date, detail: summariseRun(r) }))
  ];
  combined.sort((a, b) => b.date.localeCompare(a.date));
  if (combined.length === 0) {
    recentEl.innerHTML = '<div class="empty-state">No sessions in the last 7 days</div>';
  } else {
    combined.slice(0, 5).forEach(c => {
      const d = document.createElement('div'); d.className = 'recent-item';
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

function summariseRun(r) {
  if (r.mode === 'program' && r.setGroups && r.setGroups.length > 0) {
    const parts = r.setGroups.map(g => {
      let s = `${g.sets}×${g.distance}m`;
      // Handle the new data structure
      if (g.timeVal) {
         if (g.timeMode === 'total' || (g.timeMode === '400m' && g.distance < 400))
           s += ` in ${formatSec(g.timeVal)}`;
         else s += ` @${formatSec(g.timeVal)}/400m`;
      } 
       // Fallback for older runs saved before the update
      else if (g.lapTime) {
         s += ` @${formatSec(g.lapTime)}`;
      }
       
      if (g.rest) s += ` (r${formatSec(g.rest)})`;
      return s;
    });
    return parts.join(' + ') + (r.distance ? ` · ${r.distance} km` : '');
  }
  let s = `${r.distance || 0} km`;
  if (r.duration) s += ` · ${r.duration} min`;
  if (r.distance > 0 && r.duration > 0) s += ` · ${(r.duration / r.distance).toFixed(2)} min/km`;
  return s;
}

// ═══════════════════════════════════════════
//  LOG STRENGTH SESSION
// ═══════════════════════════════════════════
async function initStrengthForm() {
  document.getElementById('strDate').value = today();
  const blocks = await db.getAll('blocks');
  const sel = document.getElementById('strBlock');
  sel.innerHTML = '';
  blocks.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.name;
    if (b.active) opt.selected = true;
    sel.appendChild(opt);
  });
  if (blocks.length === 0) sel.innerHTML = '<option value="">No blocks — create one first</option>';

  document.getElementById('strExercises').innerHTML = '';

  // Sync TM checkbox with active block
  const active = blocks.find(b => b.active);
  if (active) document.getElementById('strUseTM').checked = !!active.useTM;

  await updateDaySelector();
  updateStrengthSuggestion();

  sel.onchange = async () => {
    const bl = await db.get('blocks', sel.value);
    if (bl) document.getElementById('strUseTM').checked = !!bl.useTM;
    await updateDaySelector();
    updateStrengthSuggestion();
  };
  document.getElementById('strWeek').onchange = () => updateStrengthSuggestion();
  document.getElementById('strDay').onchange = () => updateStrengthSuggestion();
  document.getElementById('strUseTM').onchange = () => updateStrengthSuggestion();
  document.getElementById('strAutoFillBtn').onclick = () => autoFillSession();
}

async function updateDaySelector() {
  const blockId = document.getElementById('strBlock').value;
  const label = document.getElementById('strDayLabel');
  if (!blockId) { label.classList.add('hidden'); return; }
  const block = await db.get('blocks', blockId);
  if (!block) { label.classList.add('hidden'); return; }
  const tpl = TB.templates[block.template];
  if (!tpl) { label.classList.add('hidden'); return; }
  const days = block.dayExercises || tpl.days;
  if (days.B) { label.classList.remove('hidden'); }
  else { label.classList.add('hidden'); }
}

async function updateStrengthSuggestion() {
  const blockId = document.getElementById('strBlock').value;
  const weekNum = parseInt(document.getElementById('strWeek').value);
  const dayType = document.getElementById('strDay').value;
  const useTM = document.getElementById('strUseTM').checked;
  const suggEl = document.getElementById('strSuggestion');

  if (!blockId) { suggEl.classList.add('hidden'); return; }
  const block = await db.get('blocks', blockId);
  if (!block) { suggEl.classList.add('hidden'); return; }
  const tpl = TB.templates[block.template];
  if (!tpl) { suggEl.classList.add('hidden'); return; }
  const wk = tpl.weeks.find(w => w.w === weekNum);
  if (!wk) { suggEl.classList.add('hidden'); return; }

  const days = block.dayExercises || tpl.days;
  const dayEx = days[dayType] || days.A || [];
  const orm = block.oneRepMaxes || {};
  const bw = await getLatestBodyweight();

  const lines = [];
  lines.push(`<strong>${tpl.name} — Week ${weekNum}, Day ${dayType}</strong>`);
  lines.push(`<strong>${wk.sets} sets × ${wk.reps} reps @ ${wk.pct}%${useTM ? ' TM' : ' 1RM'}</strong>`);
  lines.push('');

  for (const ex of dayEx) {
    const key = exKey(ex);
    const val = orm[key];
    if (!val) { lines.push(`${ex}: ${wk.sets} × ${wk.reps} — <em>1RM not set</em>`); continue; }
    const load = computeTrainingWeight(val, wk.pct, useTM);

    if (ex === 'Assisted Pull-up' && bw) {
      const assist = TB.roundTo(bw - load);
      lines.push(`${ex}: <strong>${wk.setsNum} × ${wk.reps} @ ${load} kg</strong> → assist <strong>${assist > 0 ? assist : 0} kg</strong>`);
    } else {
      let line = `${ex}: <strong>${wk.setsNum} × ${wk.reps} @ ${load} kg</strong>`;
      const plates = TB.calcPlates(load, ex);
      if (plates && plates.perSide.length > 0) line += `<br><span style="font-size:.7rem;opacity:.7">  ${TB.formatPlates(plates)}</span>`;
      lines.push(line);
    }
  }
  suggEl.innerHTML = lines.join('<br>');
  suggEl.classList.remove('hidden');
}

function getDayExercises(block, tpl, dayType) {
  const days = block.dayExercises || tpl.days;
  return days[dayType] || days.A || [];
}

async function autoFillSession() {
  const blockId = document.getElementById('strBlock').value;
  if (!blockId) { toast('Select a block first'); return; }
  const block = await db.get('blocks', blockId);
  if (!block) return;
  const tpl = TB.templates[block.template];
  if (!tpl) return;
  const weekNum = parseInt(document.getElementById('strWeek').value);
  const dayType = document.getElementById('strDay').value;
  const useTM = document.getElementById('strUseTM').checked;
  const wk = tpl.weeks.find(w => w.w === weekNum);
  if (!wk) return;

  const dayEx = getDayExercises(block, tpl, dayType);
  const orm = block.oneRepMaxes || {};
  const bw = await getLatestBodyweight();

  document.getElementById('strExercises').innerHTML = '';

  for (const exName of dayEx) {
    const key = exKey(exName);
    const val = orm[key];
    let load = val ? computeTrainingWeight(val, wk.pct, useTM) : 0;

    const tplEl = document.getElementById('tplExercise').content.cloneNode(true);
    const entry = tplEl.querySelector('.exercise-entry');
    entry.querySelector('.ex-name').value = exName;
    entry.querySelector('.btn-remove-ex').addEventListener('click', () => entry.remove());
    entry.querySelector('.btn-add-set').addEventListener('click', () => addSetRow(entry));

    for (let i = 0; i < wk.setsNum; i++) {
      const setTpl = document.getElementById('tplSet').content.cloneNode(true);
      const row = setTpl.querySelector('.set-row');
      row.querySelector('.set-num').textContent = i + 1;
      row.querySelector('.set-reps').value = wk.reps;
      if (load > 0) row.querySelector('.set-load').value = load;
      row.querySelector('.btn-remove-set').addEventListener('click', () => { row.remove(); renumberSets(entry); });
      // Update plate info on load change
      row.querySelector('.set-load').addEventListener('input', () => updatePlateInfo(entry));
      entry.querySelector('.sets-list').appendChild(row);
    }

    // Plate info
    const plateEl = entry.querySelector('.plate-info');
    if (exName === 'Assisted Pull-up' && bw && load > 0) {
      const assist = TB.roundTo(bw - load);
      plateEl.innerHTML = `<span class="plate-text">BW ${bw} kg − ${load} kg = <strong>assist ${assist > 0 ? assist : 0} kg</strong></span>`;
    } else if (load > 0) {
      const plates = TB.calcPlates(load, exName);
      if (plates) plateEl.innerHTML = `<span class="plate-text">${TB.formatPlates(plates)}</span>`;
    }

    entry.querySelector('.ex-name').addEventListener('change', () => updatePlateInfo(entry));
    document.getElementById('strExercises').appendChild(entry);
  }
  showStopwatch();
  toast('Program loaded ✓');
}

async function updatePlateInfo(entry) {
  const exName = entry.querySelector('.ex-name').value;
  const firstLoad = entry.querySelector('.set-load');
  const load = firstLoad ? parseFloat(firstLoad.value) || 0 : 0;
  const plateEl = entry.querySelector('.plate-info');
  if (load <= 0) { plateEl.innerHTML = ''; return; }

  if (exName === 'Assisted Pull-up') {
    const bw = await getLatestBodyweight();
    if (bw) {
      const assist = TB.roundTo(bw - load);
      plateEl.innerHTML = `<span class="plate-text">BW ${bw} kg − ${load} kg = <strong>assist ${assist > 0 ? assist : 0} kg</strong></span>`;
    } else {
      plateEl.innerHTML = `<span class="plate-text">Log bodyweight to see assistance</span>`;
    }
  } else {
    const plates = TB.calcPlates(load, exName);
    if (plates) plateEl.innerHTML = `<span class="plate-text">${TB.formatPlates(plates)}</span>`;
    else plateEl.innerHTML = '';
  }
}

function addExerciseEntry(preselect) {
  const tpl = document.getElementById('tplExercise').content.cloneNode(true);
  const entry = tpl.querySelector('.exercise-entry');
  if (preselect) entry.querySelector('.ex-name').value = preselect;
  entry.querySelector('.btn-remove-ex').addEventListener('click', () => entry.remove());
  entry.querySelector('.btn-add-set').addEventListener('click', () => addSetRow(entry));
  for (let i = 0; i < 3; i++) addSetRow(entry);
  entry.querySelector('.ex-name').addEventListener('change', () => updatePlateInfo(entry));
  document.getElementById('strExercises').appendChild(entry);
}

function addSetRow(entry) {
  const tpl = document.getElementById('tplSet').content.cloneNode(true);
  const row = tpl.querySelector('.set-row');
  const list = entry.querySelector('.sets-list');
  row.querySelector('.set-num').textContent = list.children.length + 1;
  row.querySelector('.btn-remove-set').addEventListener('click', () => { row.remove(); renumberSets(entry); });
  row.querySelector('.set-load').addEventListener('input', () => updatePlateInfo(entry));
  list.appendChild(row);
}

function renumberSets(entry) {
  entry.querySelectorAll('.set-row').forEach((r, i) => r.querySelector('.set-num').textContent = i + 1);
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
  await db.put('sessions', {
    id: uid(), blockId,
    date: document.getElementById('strDate').value || today(),
    week: parseInt(document.getElementById('strWeek').value),
    day: document.getElementById('strDay').value || 'A',
    exercises,
    notes: document.getElementById('strNotes').value.trim()
  });
  toast('Session saved ✓');
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  LOG RUN
// ═══════════════════════════════════════════
let runMode = 'general';
document.querySelectorAll('.run-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.run-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.run-mode').forEach(m => m.classList.remove('active'));
    btn.classList.add('active'); runMode = btn.dataset.mode;
    document.getElementById(runMode === 'general' ? 'runGeneral' : 'runProgram').classList.add('active');
    if (runMode === 'program' && document.getElementById('runSetGroups').children.length === 0) addRunSetGroup();
  });
});
document.getElementById('addRunSetGroup').addEventListener('click', () => addRunSetGroup());

function addRunSetGroup() {
  const tpl = document.getElementById('tplRunSetGroup').content.cloneNode(true);
  const group = tpl.querySelector('.run-set-group');
  const container = document.getElementById('runSetGroups');
  group.querySelector('.run-set-title').textContent = 'Set Type ' + (container.children.length + 1);
  group.querySelector('.btn-remove-rsg').addEventListener('click', () => {
    group.remove();
    document.querySelectorAll('.run-set-group').forEach((g, i) => g.querySelector('.run-set-title').textContent = 'Set Type ' + (i + 1));
  });
  group.addEventListener('input', () => { // Catch both input and select changes
     const dist = parseInt(group.querySelector('.rsg-dist').value) || 0;
     const timeVal = parseInt(group.querySelector('.rsg-time').value) || 0;
     const timeMode = group.querySelector('.rsg-time-mode').value;
     const sets = parseInt(group.querySelector('.rsg-sets').value) || 0;
     const rest = parseInt(group.querySelector('.rsg-rest').value) || 0;

     if (!dist && !timeVal && !sets) { group.querySelector('.rsg-summary').textContent = ''; return; }

     const parts = [];
     parts.push(`${sets} × ${dist}m = ${(dist * sets / 1000).toFixed(2)} km`);

     if (timeVal > 0 && dist > 0) {
       let wt, paceDec;
    
       // For distances >= 400m, use 400m lap time to extrapolate; for < 400m, use time directly
       if (timeMode === '400m' && dist >= 400) {
         paceDec = (timeVal / 60) / 0.4;
         wt = (dist / 400) * timeVal;
       } else { // 'total' mode OR sub-400m distance (use entered time directly)
         wt = timeVal;
         paceDec = (timeVal / 60) / (dist / 1000);
       }

       const paceMin = Math.floor(paceDec);
       const paceSec = Math.round((paceDec - paceMin) * 60).toString().padStart(2, '0');
       parts.push(`Pace: ${paceMin}:${paceSec} min/km`);

       const rt = rest * Math.max(sets - 1, 0);
       const totalWork = wt * sets;
    
       let timeStr = `Total: ${formatSec(Math.round(totalWork + rt))} (work ${formatSec(Math.round(totalWork))}`;
       if (rest > 0) timeStr += `, rest ${formatSec(rt)}`;
       timeStr += `)`;
       parts.push(timeStr);
     }
  
     group.querySelector('.rsg-summary').innerHTML = parts.join('<br>');
   });
   group.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    const dist = parseInt(group.querySelector('.rsg-dist').value) || 0;
    const lap = parseInt(group.querySelector('.rsg-lap').value) || 0;
    const sets = parseInt(group.querySelector('.rsg-sets').value) || 0;
    const rest = parseInt(group.querySelector('.rsg-rest').value) || 0;
    if (!dist && !lap && !sets) { group.querySelector('.rsg-summary').textContent = ''; return; }
    const parts = [];
    parts.push(`${sets} × ${dist}m = ${(dist * sets / 1000).toFixed(2)} km`);
    if (lap > 0 && dist > 0) parts.push(`Pace: ${((lap/60)/(dist/1000)).toFixed(2)} min/km`);
    if (lap > 0 && rest > 0) {
      const wt = lap * sets, rt = rest * Math.max(sets - 1, 0);
      parts.push(`Total: ${formatSec(wt + rt)} (work ${formatSec(wt)}, rest ${formatSec(rt)})`);
    }
    group.querySelector('.rsg-summary').innerHTML = parts.join('<br>');
  }));
  container.appendChild(group);
}

document.getElementById('runDate').value = today();
document.getElementById('formRun').addEventListener('submit', async e => {
  e.preventDefault();
  const run = { id: uid(), date: document.getElementById('runDate').value || today(),
    type: document.getElementById('runType').value, mode: runMode,
    notes: document.getElementById('runNotes').value.trim() };
  if (runMode === 'general') {
    run.distance = parseFloat(document.getElementById('runDist').value) || 0;
    run.duration = parseFloat(document.getElementById('runDur').value) || 0;
    run.avgHR = parseInt(document.getElementById('runHR').value) || null;
  } else {
    const setGroups = [];
    document.querySelectorAll('.run-set-group').forEach(g => {
      const dist = parseInt(g.querySelector('.rsg-dist').value) || 0;
      const timeVal = parseInt(g.querySelector('.rsg-time').value) || 0;
      const timeMode = g.querySelector('.rsg-time-mode').value;
      const sets = parseInt(g.querySelector('.rsg-sets').value) || 0;
      const rest = parseInt(g.querySelector('.rsg-rest').value) || 0;
      if (dist > 0 || sets > 0) setGroups.push({ distance: dist, timeVal, timeMode, sets, rest });
   });
    run.setGroups = setGroups;
    run.duration = parseFloat(document.getElementById('runProgDur').value) || 0;
    run.avgHR = parseInt(document.getElementById('runProgHR').value) || null;
    run.distance = Math.round(setGroups.reduce((s, g) => s + g.distance * g.sets / 1000, 0) * 100) / 100;
  }
  await db.put('runs', run);
  toast('Run saved ✓');
  document.getElementById('formRun').reset();
  document.getElementById('runDate').value = today();
  document.getElementById('runSetGroups').innerHTML = '';
  runMode = 'general';
  document.querySelectorAll('.run-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'general'));
  document.querySelectorAll('.run-mode').forEach(m => m.classList.toggle('active', m.id === 'runGeneral'));
  navigateTo('Dashboard');
});

// ═══════════════════════════════════════════
//  LOG BODY / PR
// ═══════════════════════════════════════════
document.getElementById('bodyDate').value = today();
document.getElementById('formBody').addEventListener('submit', async e => {
  e.preventDefault();
  await db.put('bodyMeasurements', {
    id: uid(), date: document.getElementById('bodyDate').value || today(),
    weight: parseFloat(document.getElementById('bodyWeight').value) || null,
    neck: parseFloat(document.getElementById('bodyNeck').value) || null,
    chest: parseFloat(document.getElementById('bodyChest').value) || null,
    waist: parseFloat(document.getElementById('bodyWaist').value) || null,
    hips: parseFloat(document.getElementById('bodyHips').value) || null,
    leftArm: parseFloat(document.getElementById('bodyLArm').value) || null,
    rightArm: parseFloat(document.getElementById('bodyRArm').value) || null,
    leftThigh: parseFloat(document.getElementById('bodyLThigh').value) || null,
    rightThigh: parseFloat(document.getElementById('bodyRThigh').value) || null,
  });
  toast('Measurement saved ✓');
  document.getElementById('formBody').reset();
  document.getElementById('bodyDate').value = today();
  navigateTo('Dashboard');
});

document.getElementById('prDate').value = today();
document.getElementById('formPR').addEventListener('submit', async e => {
  e.preventDefault();
  const load = parseFloat(document.getElementById('prLoad').value) || 0;
  if (load <= 0) { toast('Enter a load'); return; }
  await db.put('prLog', {
    id: uid(), exercise: document.getElementById('prExercise').value,
    date: document.getElementById('prDate').value || today(), load
  });
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
  const tab = document.querySelector('.tab-btn.active')?.dataset.ptab;
  if (tab === 'strength') await refreshStrengthProgress();
  else if (tab === 'running') await refreshRunningProgress();
  else if (tab === 'body') await refreshBodyProgress();
}

async function refreshStrengthProgress() {
  const ex = document.getElementById('progExercise').value;
  const sessions = await db.getAll('sessions');
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  const data = [];
  sessions.forEach(s => {
    const match = (s.exercises || []).find(e => e.name === ex);
    if (match) data.push({ date: s.date, load: match.sets.reduce((m, set) => Math.max(m, set.load || 0), 0) });
  });
  if (chartStr) chartStr.destroy();
  chartStr = new Chart(document.getElementById('chartStrength').getContext('2d'), {
    type: 'line',
    data: { labels: data.map(d => d.date), datasets: [{ label: ex + ' (best set kg)', data: data.map(d => d.load),
      borderColor: '#e8c547', backgroundColor: 'rgba(232,197,71,.15)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#e8c547' }] },
    options: chartOpts('kg')
  });
  const prs = (await db.getAll('prLog')).filter(p => p.exercise === ex);
  prs.sort((a, b) => b.date.localeCompare(a.date));
  const prEl = document.getElementById('prHistory');
  prEl.innerHTML = prs.length === 0 ? '<div class="empty-state">No PRs logged</div>' :
    '<table class="data-table"><thead><tr><th>Date</th><th>Load</th></tr></thead><tbody>'
    + prs.map(p => `<tr><td>${p.date}</td><td>${p.load} kg</td></tr>`).join('') + '</tbody></table>';
}

async function refreshRunningProgress() {
  const runs = await db.getAll('runs');
  runs.sort((a, b) => a.date.localeCompare(b.date));
  const weekMap = {};
  runs.forEach(r => { const ws = isoWeek(r.date); weekMap[ws] = (weekMap[ws] || 0) + (parseFloat(r.distance) || 0); });
  const weeks = Object.keys(weekMap).sort();
  if (chartMileage) chartMileage.destroy();
  chartMileage = new Chart(document.getElementById('chartMileage').getContext('2d'), {
    type: 'bar', data: { labels: weeks, datasets: [{ label: 'Weekly km', data: weeks.map(w => weekMap[w]),
      backgroundColor: 'rgba(91,141,239,.6)', borderColor: '#5b8def', borderWidth: 1 }] }, options: chartOpts('km') });
  const paceData = runs.filter(r => r.distance > 0 && r.duration > 0).map(r => ({ date: r.date, pace: +(r.duration / r.distance).toFixed(2) }));
  if (chartPace) chartPace.destroy();
  chartPace = new Chart(document.getElementById('chartPace').getContext('2d'), {
    type: 'line', data: { labels: paceData.map(d => d.date), datasets: [{ label: 'Pace (min/km)', data: paceData.map(d => d.pace),
      borderColor: '#4caf7a', backgroundColor: 'rgba(76,175,122,.15)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#4caf7a' }] },
    options: chartOpts('min/km') });
}

async function refreshBodyProgress() {
  const body = await db.getAll('bodyMeasurements');
  body.sort((a, b) => a.date.localeCompare(b.date));
  const bwData = body.filter(b => b.weight);
  if (chartBW) chartBW.destroy();
  chartBW = new Chart(document.getElementById('chartBodyweight').getContext('2d'), {
    type: 'line', data: { labels: bwData.map(d => d.date), datasets: [{ label: 'Bodyweight (kg)', data: bwData.map(d => d.weight),
      borderColor: '#e05555', backgroundColor: 'rgba(224,85,85,.15)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: '#e05555' }] },
    options: chartOpts('kg') });
  const histEl = document.getElementById('bodyHistory');
  if (body.length === 0) { histEl.innerHTML = '<div class="empty-state">No data</div>'; return; }
  const cols = ['Date','Weight','Neck','Chest','Waist','Hips','L Arm','R Arm','L Thigh','R Thigh'];
  const keys = ['date','weight','neck','chest','waist','hips','leftArm','rightArm','leftThigh','rightThigh'];
  histEl.innerHTML = '<table class="data-table"><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    + body.slice().reverse().map(b => '<tr>' + keys.map(k => `<td>${b[k] != null ? b[k] : '—'}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
}

function chartOpts(unit) {
  return { responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { color: '#8b8a96', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#8b8a96', maxRotation: 45, font: { size: 10 } }, grid: { color: '#2a2a3a' } },
      y: { ticks: { color: '#8b8a96', font: { size: 10 }, callback: v => v + ' ' + unit }, grid: { color: '#2a2a3a' } }
    }
  };
}

// ═══════════════════════════════════════════
//  BLOCKS
// ═══════════════════════════════════════════
async function refreshBlocks() {
  const blocks = await db.getAll('blocks');
  blocks.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const el = document.getElementById('blockList');
  if (blocks.length === 0) { el.innerHTML = '<div class="empty-state">No blocks yet.</div>'; return; }
  el.innerHTML = '';
  blocks.forEach(b => {
    const tpl = TB.templates[b.template];
    const orm = b.oneRepMaxes || {};
    const ormStr = Object.entries(orm).map(([k, v]) => `${k}: ${v}`).join(' · ');
    const days = b.dayExercises || (tpl ? tpl.days : {});
    const dayStr = days.A ? `Day A: ${days.A.join(', ')}` + (days.B ? `<br>Day B: ${days.B.join(', ')}` : '') : '';
    const div = document.createElement('div');
    div.className = 'block-item' + (b.active ? ' is-active' : '');
    div.innerHTML = `
      <div class="bi-name">${b.name}${b.active ? '<span class="bi-badge">Active</span>' : ''}</div>
      <div class="bi-template">${tpl ? tpl.name : b.template}${b.useTM ? ' (90% TM)' : ' (from 1RM)'}</div>
      <div class="bi-date">${b.startDate || '—'}</div>
      <div class="bi-tm">1RM: ${ormStr || 'not set'}</div>
      ${dayStr ? `<div class="bi-tm" style="margin-top:.2rem;font-size:.7rem">${dayStr}</div>` : ''}
      <div class="bi-actions">
        <button data-edit="${b.id}">Edit</button>
        ${!b.active ? `<button data-activate="${b.id}">Set Active</button>` : ''}
        <button data-delete="${b.id}" style="color:var(--red)">Delete</button>
      </div>`;
    el.appendChild(div);
  });
  el.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editBlock(btn.dataset.edit)));
  el.querySelectorAll('[data-activate]').forEach(btn => btn.addEventListener('click', async () => {
    const all = await db.getAll('blocks');
    for (const bl of all) { bl.active = bl.id === btn.dataset.activate; await db.put('blocks', bl); }
    toast('Block activated'); refreshBlocks();
  }));
  el.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this block?')) return;
    await db.delete('blocks', btn.dataset.delete); toast('Block deleted'); refreshBlocks();
  }));
}

// ─── BLOCK FORM: dynamic 1RM fields & day config ───
function getTemplateExercises(tplKey) {
  const tpl = TB.templates[tplKey];
  if (!tpl) return [];
  const all = new Set();
  Object.values(tpl.days).forEach(arr => arr.forEach(e => all.add(e)));
  return [...all];
}

function buildBlock1rmFields(tplKey, orm = {}) {
  const el = document.getElementById('block1rmFields');
  el.innerHTML = '';
  const exercises = getTemplateExercises(tplKey);
  exercises.forEach(ex => {
    const key = exKey(ex);
    const label = document.createElement('label');
    label.textContent = ex + ' 1RM';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = '0.5'; inp.inputMode = 'decimal';
    inp.className = 'block-1rm-input'; inp.dataset.exkey = key;
    inp.value = orm[key] || '';
    inp.addEventListener('input', updateBlockTMDisplay);
    label.appendChild(inp);
    el.appendChild(label);
  });
  updateBlockTMDisplay();
}

function buildBlockDayConfig(tplKey, dayExercises) {
  const tpl = TB.templates[tplKey];
  if (!tpl) return;
  const el = document.getElementById('blockDayConfig');
  el.innerHTML = '';
  const days = dayExercises || tpl.days;
  const allOpts = TB.allExercises.map(e => `<option>${e}</option>`).join('');

  Object.keys(tpl.days).forEach(dayKey => {
    const exList = days[dayKey] || tpl.days[dayKey] || [];
    const heading = document.createElement('p');
    heading.className = 'form-hint';
    heading.style.marginTop = '.5rem';
    heading.textContent = `Day ${dayKey} (${exList.length} exercises)`;
    el.appendChild(heading);
    exList.forEach((ex, i) => {
      const label = document.createElement('label');
      label.className = i > 0 ? 'inline-label' : '';
      const sel = document.createElement('select');
      sel.className = 'block-day-sel';
      sel.dataset.day = dayKey;
      sel.innerHTML = allOpts;
      sel.value = ex;
      label.appendChild(sel);
      el.appendChild(label);
    });
  });
}

function updateBlockTMDisplay() {
  const useTM = document.getElementById('blockUseTM').checked;
  const el = document.getElementById('blockTMDisplay');
  el.innerHTML = '';
  document.querySelectorAll('.block-1rm-input').forEach(inp => {
    const val = parseFloat(inp.value);
    if (val > 0) {
      const display = useTM ? TB.roundTo(val * TB.TM_FACTOR) + ' kg TM' : val + ' kg 1RM';
      el.innerHTML += `<span>${inp.dataset.exkey}: <strong>${display}</strong></span>`;
    }
  });
}

document.getElementById('blockTemplate').addEventListener('change', () => {
  const tplKey = document.getElementById('blockTemplate').value;
  buildBlock1rmFields(tplKey);
  buildBlockDayConfig(tplKey);
});
document.getElementById('blockUseTM').addEventListener('change', updateBlockTMDisplay);

document.getElementById('newBlockBtn').addEventListener('click', () => {
  document.getElementById('formBlock').reset();
  document.getElementById('blockEditId').value = '';
  document.getElementById('blockStart').value = today();
  document.getElementById('blockActive').checked = true;
  document.getElementById('blockUseTM').checked = false;
  const tplKey = document.getElementById('blockTemplate').value;
  buildBlock1rmFields(tplKey);
  buildBlockDayConfig(tplKey);
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
  document.getElementById('blockUseTM').checked = !!block.useTM;
  buildBlock1rmFields(block.template, block.oneRepMaxes || {});
  buildBlockDayConfig(block.template, block.dayExercises);
  navigateTo('blockForm');
}

document.getElementById('formBlock').addEventListener('submit', async e => {
  e.preventDefault();
  const editId = document.getElementById('blockEditId').value;
  const useTM = document.getElementById('blockUseTM').checked;

  const oneRepMaxes = {};
  document.querySelectorAll('.block-1rm-input').forEach(inp => {
    const val = parseFloat(inp.value);
    if (val > 0) oneRepMaxes[inp.dataset.exkey] = val;
  });

  const dayExercises = {};
  document.querySelectorAll('.block-day-sel').forEach(sel => {
    const day = sel.dataset.day;
    if (!dayExercises[day]) dayExercises[day] = [];
    dayExercises[day].push(sel.value);
  });

  const isActive = document.getElementById('blockActive').checked;
  if (isActive) {
    const all = await db.getAll('blocks');
    for (const bl of all) { if (bl.id !== editId && bl.active) { bl.active = false; await db.put('blocks', bl); } }
  }

  await db.put('blocks', {
    id: editId || uid(),
    name: document.getElementById('blockName').value.trim(),
    template: document.getElementById('blockTemplate').value,
    startDate: document.getElementById('blockStart').value || today(),
    active: isActive, useTM, oneRepMaxes, dayExercises
  });
  toast('Block saved ✓');
  navigateTo('Blocks');
});

// ═══════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════
document.getElementById('exportBtn').addEventListener('click', async () => {
  const stores = ['blocks','sessions','runs','bodyMeasurements','prLog','settings'];
  const data = {};
  for (const s of stores) data[s] = await db.getAll(s);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `tb-tracker-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  localStorage.setItem('tb_last_backup', Date.now().toString());
  document.getElementById('backupReminderModal').classList.add('hidden');
  toast('Exported ✓');
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const file = document.getElementById('importFile').files[0];
  if (!file) { toast('Select a file first'); return; }
  try {
    const data = JSON.parse(await file.text());
    for (const s of ['blocks','sessions','runs','bodyMeasurements','prLog','settings']) {
      if (data[s]) { const tx = db.transaction(s, 'readwrite'); await tx.store.clear();
        for (const item of data[s]) await tx.store.put(item); await tx.done; }
    }
    toast('Import complete ✓'); refreshDashboard();
  } catch (err) { toast('Import failed: ' + err.message); }
});

// ═══════════════════════════════════════════
//  LOGBOOK (Log tab — entry browser)
// ═══════════════════════════════════════════
let logbookFilter = 'all';
document.addEventListener('click', e => {
  const btn = e.target.closest('.logbook-filter');
  if (!btn) return;
  document.querySelectorAll('.logbook-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  logbookFilter = btn.dataset.filter;
  refreshLogbook();
});

async function refreshLogbook() {
  const sessions = (await db.getAll('sessions')).map(s => ({ ...s, _type: 'strength', _sort: s.date }));
  const runs = (await db.getAll('runs')).map(r => ({ ...r, _type: 'run', _sort: r.date }));
  const bodies = (await db.getAll('bodyMeasurements')).map(b => ({ ...b, _type: 'body', _sort: b.date }));
  const prs = (await db.getAll('prLog')).map(p => ({ ...p, _type: 'pr', _sort: p.date }));
  let all = [...sessions, ...runs, ...bodies, ...prs];
  if (logbookFilter !== 'all') all = all.filter(e => e._type === logbookFilter);
  all.sort((a, b) => b._sort.localeCompare(a._sort));

  const el = document.getElementById('logbook');
  if (all.length === 0) { el.innerHTML = '<div class="empty-state">No entries yet — log a session below</div>'; return; }
  el.innerHTML = '';
  all.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'lb-entry';
    const typeLabel = { strength: `W${entry.week||'?'} D${entry.day||'?'}`, run: entry.type || 'Run', body: 'Body', pr: 'PR' }[entry._type];
    const typeTag = { strength: 'Strength', run: 'Run', body: 'Body', pr: '1RM PR' }[entry._type];
    let summary = '';
    if (entry._type === 'strength') summary = summariseSession(entry);
    else if (entry._type === 'run') summary = summariseRun(entry);
    else if (entry._type === 'body') summary = `${entry.weight ? entry.weight + ' kg' : '—'}`;
    else if (entry._type === 'pr') summary = `${entry.exercise}: ${entry.load} kg`;
    const notes = entry.notes ? `<div class="lb-notes">${entry.notes}</div>` : '';
    div.innerHTML = `<div class="lb-top"><span class="lb-type">${typeTag} · ${typeLabel}</span><span class="lb-date">${entry.date}</span></div><div class="lb-summary">${summary}</div>${notes}`;
    div.addEventListener('click', () => openLogDetail(entry));
    el.appendChild(div);
  });
}

// ═══════════════════════════════════════════
//  LOG DETAIL MODAL + DELETE
// ═══════════════════════════════════════════
let modalEntry = null;
function openLogDetail(entry) {
  modalEntry = entry;
  const modal = document.getElementById('logDetailModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const storeMap = { strength: 'sessions', run: 'runs', body: 'bodyMeasurements', pr: 'prLog' };

  if (entry._type === 'strength') {
    title.textContent = `Strength — ${entry.date}`;
    let html = `<div class="md-section"><span class="md-label">Block</span> · Week ${entry.week || '?'} · Day ${entry.day || '?'}</div>`;
    (entry.exercises || []).forEach(ex => {
      const sets = ex.sets.map((s, i) => `Set ${i+1}: ${s.reps} × ${s.load} kg`).join('<br>');
      html += `<div class="md-ex"><strong>${ex.name}</strong><br>${sets}</div>`;
    });
    if (entry.notes) html += `<div class="md-notes">${entry.notes}</div>`;
    body.innerHTML = html;
  } else if (entry._type === 'run') {
    title.textContent = `Run — ${entry.date}`;
    let html = `<div class="md-section"><span class="md-label">Type</span> <span class="md-val">${entry.type || 'Run'}</span></div>`;
    if (entry.mode === 'program' && entry.setGroups) {
      entry.setGroups.forEach((g, i) => {
        let detail = `${g.sets}×${g.distance}m`;
        if (g.timeVal) detail += (g.timeMode === 'total' || (g.timeMode === '400m' && g.distance < 400))
          ? ` in ${formatSec(g.timeVal)}` : ` @${formatSec(g.timeVal)}/400m`;
        else if (g.lapTime) detail += ` @${formatSec(g.lapTime)}`;
        if (g.rest) detail += ` rest ${formatSec(g.rest)}`;
        html += `<div class="md-ex">Set Type ${i+1}: ${detail}</div>`;
      });
    }
    html += `<div class="md-section"><span class="md-label">Distance</span> <span class="md-val">${entry.distance || 0} km</span></div>`;
    if (entry.duration) html += `<div class="md-section"><span class="md-label">Duration</span> <span class="md-val">${entry.duration} min</span></div>`;
    if (entry.avgHR) html += `<div class="md-section"><span class="md-label">Avg HR</span> <span class="md-val">${entry.avgHR} bpm</span></div>`;
    if (entry.distance > 0 && entry.duration > 0) html += `<div class="md-section"><span class="md-label">Pace</span> <span class="md-val">${(entry.duration / entry.distance).toFixed(2)} min/km</span></div>`;
    if (entry.notes) html += `<div class="md-notes">${entry.notes}</div>`;
    body.innerHTML = html;
  } else if (entry._type === 'body') {
    title.textContent = `Body — ${entry.date}`;
    let html = '';
    if (entry.weight) html += `<div class="md-section"><span class="md-label">Bodyweight</span> <span class="md-val">${entry.weight} kg</span></div>`;
    const fields = [['neck','Neck'],['chest','Chest'],['waist','Waist'],['hips','Hips'],['leftArm','L Arm'],['rightArm','R Arm'],['leftThigh','L Thigh'],['rightThigh','R Thigh']];
    const measured = fields.filter(([k]) => entry[k]);
    if (measured.length > 0) {
      html += measured.map(([k, lbl]) => `<div class="md-section"><span class="md-label">${lbl}</span> <span class="md-val">${entry[k]} cm</span></div>`).join('');
    }
    body.innerHTML = html || '<div class="md-section">No data recorded</div>';
  } else if (entry._type === 'pr') {
    title.textContent = `1RM PR — ${entry.date}`;
    body.innerHTML = `<div class="md-section"><span class="md-label">Exercise</span> <span class="md-val">${entry.exercise}</span></div><div class="md-section"><span class="md-label">Load</span> <span class="md-val">${entry.load} kg</span></div>`;
  }
  modal.classList.remove('hidden');
}

document.getElementById('modalClose').addEventListener('click', () => document.getElementById('logDetailModal').classList.add('hidden'));
document.getElementById('logDetailModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

document.getElementById('modalDeleteBtn').addEventListener('click', async () => {
  if (!modalEntry) return;
  const storeMap = { strength: 'sessions', run: 'runs', body: 'bodyMeasurements', pr: 'prLog' };
  const store = storeMap[modalEntry._type];
  if (!store) return;
  if (!confirm('Delete this entry?')) return;
  await db.delete(store, modalEntry.id);
  document.getElementById('logDetailModal').classList.add('hidden');
  toast('Entry deleted');
  refreshLogbook();
  modalEntry = null;
});

// ═══════════════════════════════════════════
//  FLOATING STOPWATCH
// ═══════════════════════════════════════════
let swInterval = null, swRunning = false, swVisible = false;
let swStartEpoch = 0;   // Date.now() when the current run started
let swBaseSeconds = 0;  // seconds already elapsed before the current run (for stop/resume)
let sw2minScheduled = false;

function swElapsed() {
  // Always compute from wall-clock so backgrounded tabs don't drift
  return swRunning ? swBaseSeconds + Math.floor((Date.now() - swStartEpoch) / 1000) : swBaseSeconds;
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

// Ask the SW to schedule (or cancel) the notification so it fires even when
// the page is suspended. The SW keeps itself alive via waitUntil().
async function scheduleSWNotif(delayMs) {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({ type: 'SCHEDULE_SW_NOTIF', delay: delayMs });
  } catch (e) { console.warn('SW notif schedule failed', e); }
}
async function cancelSWNotif() {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({ type: 'CANCEL_SW_NOTIF' });
  } catch {}
}

function formatSW(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function updateSWDisplay() {
  const t = formatSW(swElapsed());
  document.getElementById('swTime').textContent = t;
  document.getElementById('swTimeSmall').textContent = t;
}
function showStopwatch() {
  swVisible = true;
  document.getElementById('floatingStopwatch').classList.remove('hidden');
}
function hideStopwatch() {
  swVisible = false;
  stopSW();
  swBaseSeconds = 0;
  sw2minScheduled = false;
  cancelSWNotif();
  updateSWDisplay();
  document.getElementById('floatingStopwatch').classList.add('hidden');
}
async function startSW() {
  if (swRunning) { stopSW(); return; }
  await requestNotificationPermission();
  swRunning = true;
  swStartEpoch = Date.now();
  document.getElementById('swStart').textContent = 'Stop';
  document.getElementById('swStart').classList.add('running');

  // Schedule SW notification for however many seconds remain until 2:00
  if (!sw2minScheduled && Notification.permission === 'granted') {
    const remaining = Math.max(0, 120 - swBaseSeconds);
    if (remaining > 0) {
      sw2minScheduled = true;
      await scheduleSWNotif(remaining * 1000);
    }
  }

  // Tick every second — only for display; time source is wall clock
  swInterval = setInterval(() => {
    updateSWDisplay();
  }, 1000);
}
function stopSW() {
  if (swRunning) swBaseSeconds = swElapsed(); // freeze elapsed at current wall-clock value
  swRunning = false;
  document.getElementById('swStart').textContent = 'Start';
  document.getElementById('swStart').classList.remove('running');
  if (swInterval) { clearInterval(swInterval); swInterval = null; }
  // Cancel pending SW notification since the timer is paused
  sw2minScheduled = false;
  cancelSWNotif();
}
function resetSW() {
  stopSW();
  swBaseSeconds = 0;
  sw2minScheduled = false;
  cancelSWNotif();
  updateSWDisplay();
}

document.getElementById('swStart').addEventListener('click', startSW);
document.getElementById('swReset').addEventListener('click', resetSW);
document.getElementById('swToggle').addEventListener('click', () => {
  document.getElementById('swToggle').style.display = 'none';
  document.getElementById('swExpanded').classList.remove('hidden');
});
document.getElementById('swMinimise').addEventListener('click', () => {
  document.getElementById('swExpanded').classList.add('hidden');
  document.getElementById('swToggle').style.display = '';
});

// ═══════════════════════════════════════════
//  NAVIGATION WIRING
// ═══════════════════════════════════════════
document.querySelectorAll('#tabBar .tab').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.view)));
document.querySelectorAll('.log-tile').forEach(btn => btn.addEventListener('click', () => {
  const target = btn.dataset.goto;
  const dateIds = { logStrength:'strDate', logRun:'runDate', logBody:'bodyDate', logPR:'prDate' };
  if (dateIds[target]) document.getElementById(dateIds[target]).value = today();
  navigateTo(target);
}));

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
async function seedDefaults() {
  const blocks = await db.getAll('blocks');
  if (blocks.length === 0) {
    await db.put('blocks', {
      id: uid(), name: 'Block 1', template: 'operator',
      startDate: today(), active: true, useTM: false,
      oneRepMaxes: {}, dayExercises: TB.templates.operator.days
    });
  }
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); }
    catch (e) { console.warn('SW registration failed:', e); }
  }
}

// ═══════════════════════════════════════════
//  BACKUP REMINDER
// ═══════════════════════════════════════════
function checkBackupReminder() {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const last = parseInt(localStorage.getItem('tb_last_backup') || '0', 10);
  if (Date.now() - last > THIRTY_DAYS_MS) {
    document.getElementById('backupReminderModal').classList.remove('hidden');
  }
}

document.getElementById('backupReminderDismiss').addEventListener('click', () => {
  // Snooze: set last_backup to now so it won't re-trigger for another 30 days
  localStorage.setItem('tb_last_backup', Date.now().toString());
  document.getElementById('backupReminderModal').classList.add('hidden');
});

document.getElementById('backupReminderExport').addEventListener('click', () => {
  // Trigger the real export button
  document.getElementById('backupReminderModal').classList.add('hidden');
  navigateTo('export');
  setTimeout(() => document.getElementById('exportBtn').click(), 150);
});

(async () => {
  await initDB();
  await seedDefaults();
  await registerSW();
  checkBackupReminder();
  navigateTo('Dashboard');
})();
