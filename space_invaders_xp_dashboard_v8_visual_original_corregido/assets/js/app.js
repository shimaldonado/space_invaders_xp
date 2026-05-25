const DATA = window.XP_DATA;
const STORE_KEY = 'space_invaders_xp_dashboard_v8_visual_original_corregido';
const SERVER_STATE_URL = (location.protocol === 'http:' || location.protocol === 'https:') ? '/api/state' : '';
let serverPersistenceEnabled = false;
let saveTimer = null;
const statusOrder = ['Por hacer', 'En curso', 'En revisión', 'Finalizado'];
const bugStatusOrder = ['Por hacer', 'En curso', 'Resuelto', 'Cerrado'];
const priorityOrder = ['Alta', 'Media', 'Baja'];
const testStatusOrder = ['Passed', 'Blocked', 'Skipped', 'Failed', 'Automation Passed', 'Automation Failed', 'Automation Error', 'Untested'];
let state = loadState();
let activeRole = state.team?.[0]?.id || 'maldonado';
let activePhase = Object.keys(state.phaseMeta || {})[0] || 'planificacion';

function baseState(){ return JSON.parse(JSON.stringify(DATA)); }
function normalizeState(obj){
  const base = baseState();
  const incoming = obj && typeof obj === 'object' ? obj : {};
  const st = {...base, ...incoming};

  // Merge profundo para evitar pantallas vacías por state.json/localStorage viejo o incompleto.
  st.integrations = {...(base.integrations || {}), ...(incoming.integrations || {})};
  st.jiraSummary = {...(base.jiraSummary || {}), ...(incoming.jiraSummary || {})};
  st.phaseMeta = {...(base.phaseMeta || {}), ...(incoming.phaseMeta || {})};
  st.roleMeta = {...(base.roleMeta || {}), ...(incoming.roleMeta || {})};
  st.reports = {...(base.reports || {}), ...(incoming.reports || {})};
  st.traceability = {...(base.traceability || {}), ...(incoming.traceability || {})};
  st.diagrams = {...(base.diagrams || {}), ...(incoming.diagrams || {})};

  st.hus = Array.isArray(st.hus) ? st.hus.map(h => ({
    ...h,
    hours: Number.isFinite(+h.hours) ? +h.hours : ((+h.points || 0) * 2),
    criteria: h.criteria || [],
    tasks: h.tasks || [],
    tests: h.tests || []
  })) : (base.hus || []);
  st.bugs = Array.isArray(st.bugs) ? st.bugs : (base.bugs || []);
  st.tests = Array.isArray(st.tests) ? st.tests : (base.tests || []);
  st.changes = Array.isArray(st.changes) ? st.changes : (base.changes || []);
  st.team = Array.isArray(st.team) ? st.team : (base.team || []);
  st.roles = Array.isArray(st.roles) ? st.roles : (base.roles || []);
  st.phases = Array.isArray(st.phases) ? st.phases : (base.phases || []);
  st.iterations = Array.isArray(st.iterations) ? st.iterations : (base.iterations || []);
  st.xpValues = Array.isArray(st.xpValues) ? st.xpValues : (base.xpValues || []);
  st.jiraIssues = Array.isArray(st.jiraIssues) ? st.jiraIssues : (base.jiraIssues || []);

  refreshDynamicMetrics(st);
  return st;
}

function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  if(raw){
    try { return normalizeState(JSON.parse(raw)); } catch(err){}
  }
  return normalizeState(baseState());
}
async function syncStateFromServer(){
  if(!SERVER_STATE_URL) return;
  try{
    const res = await fetch(SERVER_STATE_URL, { cache:'no-store' });
    if(res.ok){
      const serverState = await res.json();
      state = normalizeState(serverState);
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      serverPersistenceEnabled = true;
    }
  }catch(err){
    serverPersistenceEnabled = false;
    console.warn('No se pudo cargar el estado del servidor. Se usará localStorage.', err);
  }
}
function persistStateToServer(){
  if(!SERVER_STATE_URL) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async()=>{
    try{
      const res = await fetch(SERVER_STATE_URL, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(state)
      });
      serverPersistenceEnabled = res.ok;
    }catch(err){
      serverPersistenceEnabled = false;
      console.warn('No se pudo guardar en servidor. El cambio queda en localStorage de este equipo.', err);
    }
  }, 250);
}
function save(){
  refreshDynamicMetrics(state);
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  persistStateToServer();
  renderAll();
}

function resetDemo(){
  if(!confirm('¿Deseas restaurar los datos base y recuperar el estado original?')) return;
  localStorage.removeItem(STORE_KEY);
  state = normalizeState(baseState());
  activeRole = state.team?.[0]?.id || 'maldonado';
  activePhase = Object.keys(state.phaseMeta || {})[0] || 'planificacion';
  save();
  toast('Los datos base fueron restaurados y guardados.');
}
function qs(sel){ return document.querySelector(sel); }
function byId(id){ return document.getElementById(id); }
function escapeHtml(str){ return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function normalizeText(str){ return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function pct(n,d){ return d ? Math.round((n/d)*100) : 0; }
function statusWeight(status){ return ({'Finalizado':1,'En revisión':0.8,'En curso':0.5,'Por hacer':0})[status] ?? 0; }
function huIterationId(h){ return h.iteration ? String(h.iteration) : (h.iterationId ? String(h.iterationId) : (h.iterationNum ? 'it' + h.iterationNum : '')); }
function testIterationId(t){ return t.iterationId ? String(t.iterationId) : (t.iteration ? 'it' + t.iteration : ''); }
function computeHuPointTotals(source = state){
  const totals = {total:0, done:0, review:0, inProgress:0, todo:0, weighted:0};
  (source.hus || []).forEach(h => {
    const points = +h.points || 0;
    totals.total += points;
    totals.weighted += points * statusWeight(h.status);
    if(h.status === 'Finalizado') totals.done += points;
    else if(h.status === 'En revisión') totals.review += points;
    else if(h.status === 'En curso') totals.inProgress += points;
    else totals.todo += points;
  });
  totals.weighted = Math.round(totals.weighted * 10) / 10;
  totals.donePct = pct(totals.done, totals.total);
  totals.progressPct = pct(totals.weighted, totals.total);
  return totals;
}
function refreshDynamicMetrics(source = state){
  if(!source) return;
  source.jiraSummary = source.jiraSummary || {};
  source.jiraSummary.huPointTotals = computeHuPointTotals(source);
  source.jiraSummary.weightedProgress = source.jiraSummary.huPointTotals.progressPct;
}
function huPointTotals(){
  refreshDynamicMetrics(state);
  return state.jiraSummary.huPointTotals;
}

function totalPoints(){ return huPointTotals().total || 0; }
function completedPoints(){ return huPointTotals().done || 0; }
function progressPoints(){ return huPointTotals().weighted || 0; }
function totalHours(){ return state.hus.reduce((acc,h)=>acc + (+h.hours || 0), 0); }
function completedHours(){ return state.hus.filter(h=>h.status==='Finalizado').reduce((acc,h)=>acc + (+h.hours || 0), 0); }
function currentVelocity(){
  const completed = completedPoints();
  const iterations = state.iterations?.length || 1;
  return Math.round(completed / iterations);
}
function pointsByStatus(){
  const totals = huPointTotals();
  const res = {};
  statusOrder.forEach(s=>res[s]=0);
  res['Finalizado'] = totals.done || 0;
  res['En revisión'] = totals.review || 0;
  res['En curso'] = totals.inProgress || 0;
  res['Por hacer'] = Math.max(0, (totals.total || 0) - (res['Finalizado']||0) - (res['En revisión']||0) - (res['En curso']||0));
  return res;
}
function testSummary(){
  const s = {};
  testStatusOrder.forEach(t=>s[t]=0);
  state.tests.forEach(t=>s[t.status || 'Untested'] = (s[t.status || 'Untested'] || 0) + 1);
  return s;
}
function qualityCounts(){
  const sum = testSummary();
  return {
    passed: (sum['Passed'] || 0) + (sum['Automation Passed'] || 0),
    failed: (sum['Failed'] || 0) + (sum['Automation Failed'] || 0),
    blocked: sum['Blocked'] || 0,
    skipped: sum['Skipped'] || 0,
    automationError: sum['Automation Error'] || 0,
  };
}
function bugsOpenCount(){ return state.bugs.filter(b => !['Cerrado','Resuelto'].includes(b.status)).length; }

function artifactTarget(label){
  const t = normalizeText(label || '');
  if(t.includes('linea') || t.includes('entrega') || t.includes('velocidad') || t.includes('iteracion') || t.includes('estimacion')) return 'iteraciones';
  if(t.includes('metrica') || t.includes('seguimiento') || t.includes('tablero') || t.includes('progreso')) return 'resumen';
  if(t.includes('backlog') || t.includes('historia') || t.includes('criterio') || t.includes('validacion')) return 'historias';
  if(t.includes('caso') || t.includes('testrail') || t.includes('prueba') || t.includes('aceptacion') || t.includes('evidencia')) return 'pruebas';
  if(t.includes('bug') || t.includes('defecto')) return 'bugs';
  if(t.includes('trazabilidad') || t.includes('matriz')) return 'trazabilidad';
  if(t.includes('diagrama') || t.includes('crc') || t.includes('diseno')) return 'diagramas';
  if(t.includes('integracion') || t.includes('repositorio') || t.includes('continua')) return 'integraciones';
  if(t.includes('cambio') || t.includes('codigo') || t.includes('refactor') || t.includes('regla') || t.includes('estandar')) return 'cambios';
  return 'resumen';
}
function renderArtifactLink(label){
  const target = artifactTarget(label);
  return `<button type="button" class="pill clickable artifact-link" onclick="activateSection('${target}')">${escapeHtml(label)}</button>`;
}

function teamProgress(member){
  const assigned = (state.jiraIssues || []).filter(x => x.assignee === member.name);
  const stories = (state.hus || []).filter(h => h.owner === member.name);
  const points = stories.reduce((acc,h)=>acc + (+h.points || 0), 0);
  const done = stories.filter(h=>h.status==='Finalizado').reduce((acc,h)=>acc + (+h.points || 0), 0);
  const percent = member.progressPct ?? (assigned.length ? Math.round(assigned.reduce((acc,x)=>acc+statusWeight(x.status),0)*100/assigned.length) : pct(done, points));
  return { assigned, stories, points, done, percent, workloadPct: member.workloadPct ?? 0, issueCount: member.jiraIssueCount ?? assigned.length };
}
function iterationStats(){
  return (state.iterations || []).map(it => {
    const stories = state.hus.filter(h => huIterationId(h) === it.id);
    const planned = stories.reduce((acc,h)=>acc + (+h.points || 0), 0) || (+it.plannedPoints || 0);
    const done = stories.filter(h=>h.status==='Finalizado').reduce((acc,h)=>acc + (+h.points || 0), 0);
    const progress = Math.round(stories.reduce((acc,h)=>acc + (+h.points || 0)*statusWeight(h.status), 0) * 10) / 10;
    const tests = (state.tests||[]).filter(t=>testIterationId(t)===it.id);
    const passed = tests.filter(t=>t.status==='Passed').length;
    return { ...it, stories, planned, done, progress, percent: pct(progress, planned), donePercent: pct(done, planned), testCount:tests.length, passRate:tests.length ? pct(passed, tests.length) : (it.testRail?.passRate||0) };
  });
}

function statusClass(status){
  return {
    'Finalizado':'ok',
    'En revisión':'warn',
    'En curso':'info',
    'Por hacer':'muted',
    'Passed':'ok',
    'Automation Passed':'ok',
    'Failed':'danger',
    'Automation Failed':'danger',
    'Automation Error':'danger',
    'Blocked':'warn',
    'Skipped':'muted',
    'Untested':'muted',
    'Resuelto':'ok',
    'Cerrado':'ok',
    'Alta':'danger',
    'Media':'warn',
    'Baja':'info'
  }[status] || 'muted';
}
function severityClass(sev){ return sev === 'Alta' ? 'danger' : sev === 'Media' ? 'warn' : 'info'; }
function toast(msg){
  let el = document.querySelector('.toast');
  if(!el){
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(()=>{ el.style.display='none'; }, 2200);
}


function activateSection(sectionId){
  const cleanId = String(sectionId || 'resumen').replace('#','');
  const section = document.getElementById(cleanId) ? cleanId : 'resumen';
  document.querySelectorAll('main .section').forEach(el => el.classList.toggle('active-section', el.id === section));
  document.querySelectorAll('.sidebar .nav a[href^="#"]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + section);
  });
  if(location.hash !== '#' + section){
    history.replaceState(null, '', '#' + section);
  }
  const content = document.querySelector('.content');
  if(content) content.scrollTo({top:0, behavior:'smooth'});
}
function initSectionNavigation(){
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', ev => {
      const id = a.getAttribute('href').slice(1);
      if(document.getElementById(id)){
        ev.preventDefault();
        activateSection(id);
      }
    });
  });
  activateSection((location.hash || '#resumen').slice(1));
}

function safeRender(name, fn){
  try{
    fn();
  }catch(error){
    console.error('Error renderizando ' + name, error);
  }
}
function renderAll(){
  refreshDynamicMetrics(state);
  [
    ['hero', renderHeroLinks],
    ['sidebar', renderSidebarProgress],
    ['kpis', renderKPIs],
    ['summary', renderSummaryCards],
    ['jira', renderJiraSummary],
    ['roles', renderRoles],
    ['role-detail', () => renderRoleDetail(activeRole)],
    ['values', renderXPValues],
    ['phases', renderPhases],
    ['phase-detail', () => renderPhaseDetail(activePhase)],
    ['hu-filters', renderHUFilters],
    ['hus', renderHUs],
    ['iterations', renderIterations],
    ['tests', renderTests],
    ['bugs', renderBugs],
    ['traceability', renderTraceability],
    ['changes', renderChanges],
    ['integrations', renderIntegrations],
    ['change-form', bindChangeForm]
  ].forEach(([name, fn]) => safeRender(name, fn));
}

function renderHeroLinks(){
  const jira = state.integrations.jira || '#';
  const testrail = state.integrations.testrail || '#';
  byId('jiraHeroLink').href = jira;
  byId('testrailHeroLink').href = testrail;
}
function renderSidebarProgress(){
  const total = totalPoints();
  const done = completedPoints();
  const advanced = progressPoints();
  const percent = pct(advanced, total);
  byId('sidebarProgress').textContent = percent + '%';
  byId('sidebarProgressBar').style.width = percent + '%';
  byId('sidebarProgressText').textContent = `${advanced} / ${total} pts con avance · ${done} finalizados`;
}
function renderKPIs(){
  const quality = qualityCounts();
  const totals = huPointTotals();
  const items = [
    { label:'HU', value: state.hus.length, extra:`${totals.total} puntos · ${totals.weighted} con avance` },
    { label:'Pruebas', value: state.tests.length, extra:`${quality.passed} passed · ${quality.failed} failed · ${quality.blocked} blocked` },
    { label:'Jira', value: state.jiraSummary?.totalIssues || (state.jiraIssues||[]).length, extra:`${state.jiraSummary?.byStatus?.Finalizado || 0} actividades finalizadas` },
    { label:'Avance ponderado', value: `${pct(totals.weighted, totals.total)}%`, extra:`${totals.done} pts finalizados · ${totals.review} en revisión` }
  ];
  byId('kpiGrid').innerHTML = items.map(i => `
    <div class="card kpi">
      <span class="muted">${i.label}</span>
      <strong>${i.value}</strong>
      <small class="muted">${i.extra}</small>
    </div>
  `).join('');
}
function renderJiraSummary(){
  const summary = state.jiraSummary || {};
  const testRail = state.testRailSummary || {};
  const issues = state.jiraIssues || [];
  const byStatus = summary.byStatus || statusOrder.reduce((acc,st)=>{ acc[st] = [...(state.hus||[]), ...issues].filter(x=>x.status===st).length; return acc; }, {});
  const total = summary.totalIssues || summary.total || Object.values(byStatus).reduce((a,b)=>a+(+b||0),0);
  const statusEl = byId('jiraStatusSummary');
  if(statusEl){
    statusEl.innerHTML = `
      <h3>Resumen tipo Jira</h3>
      <p class="lead">Actividades importadas desde Jira: ${total} en total. Avance ponderado: <b>${summary.issueProgressPct || 0}%</b>.</p>
      <div class="mini-stats">${statusOrder.map(st=>`<div><strong>${byStatus[st] || 0}</strong><span>${escapeHtml(st)}</span></div>`).join('')}</div>
      <div class="bar-stack">${statusOrder.map(st=>{ const w = total ? Math.max(1, ((byStatus[st] || 0) / total) * 100) : 0; return `<span style="width:${w}%" title="${escapeHtml(st)}: ${byStatus[st] || 0}"></span>`; }).join('')}</div>
      <p class="muted tiny">Tablero principal: ${(byStatus['Por hacer'] || 0)} por hacer, ${(byStatus['En curso'] || 0)} en curso, ${(byStatus['En revisión'] || 0)} en revisión y ${(byStatus['Finalizado'] || 0)} finalizadas. “En revisión” cuenta como avance, pero no como finalizado formal.</p>`;
  }
  const mixEl = byId('jiraTestRailSummary');
  if(mixEl){
    const p = summary.byPriority || {};
    const tr = testRail.byStatus || testRail || {};
    mixEl.innerHTML = `
      <h3>Jira + TestRail</h3>
      <p class="lead">Prioridades y resultados de pruebas enlazados al avance real.</p>
      <div class="metric-list">${Object.entries(p).map(([k,v])=>`<div><span>${escapeHtml(k)}</span><strong>${v}</strong></div>`).join('')}</div>
      <div class="mini-stats">
        <div><strong>${tr.Passed || tr.passed || 0}</strong><span>Passed</span></div>
        <div><strong>${tr.Failed || tr.failed || 0}</strong><span>Failed</span></div>
        <div><strong>${tr.Blocked || tr.blocked || 0}</strong><span>Blocked</span></div>
        <div><strong>${tr.Skipped || tr.skipped || 0}</strong><span>Skipped</span></div>
      </div>`;
  }
}

function renderSummaryCards(){
  const iterations = iterationStats();
  byId('iterationSummaryCard').innerHTML = `
    <h4>Avances por iteración</h4>
    <p class="muted">Las barras muestran avance ponderado: Finalizado 100%, En revisión 80%, En curso 50%, Por hacer 0%.</p>
    ${iterations.map(it => `
      <div class="metric-row">
        <div class="metric-label-row"><b>${it.name}</b><span>${it.percent}%</span></div>
        <div class="progress"><div class="bar" style="width:${it.percent}%"></div></div>
        <small class="muted">${it.progress}/${it.planned} pts con avance · ${it.done} pts finalizados · TestRail ${it.passRate}% passed</small>
      </div>
    `).join('')}
    <div class="mini-stats four">
      <div><b>${pointsByStatus()['Por hacer'] || 0}</b><span>Por hacer</span></div>
      <div><b>${pointsByStatus()['En curso'] || 0}</b><span>En curso</span></div>
      <div><b>${pointsByStatus()['En revisión'] || 0}</b><span>En revisión</span></div>
      <div><b>${pointsByStatus()['Finalizado'] || 0}</b><span>Finalizado</span></div>
    </div>
  `;

  const q = qualityCounts();
  const total = state.tests.length || 1;
  byId('qualitySummaryCard').innerHTML = `
    <h4>Resumen de calidad</h4>
    <div class="quality-bar">
      <span class="pass" style="width:${pct(q.passed,total)}%"></span>
      <span class="block" style="width:${pct(q.blocked,total)}%"></span>
      <span class="skip" style="width:${pct(q.skipped,total)}%"></span>
      <span class="fail" style="width:${pct(q.failed + q.automationError,total)}%"></span>
    </div>
    <p class="muted">${q.passed} Passed · ${q.failed} Failed · ${q.blocked} Blocked · ${q.skipped} Skipped · ${q.automationError} Automation Error</p>
    <div class="mini-stats two">
      <div><b>${state.hus.length}</b><span>HU</span></div>
      <div><b>${state.bugs.length}</b><span>Bugs</span></div>
      <div><b>${state.tests.length}</b><span>Pruebas</span></div>
      <div><b>${currentVelocity()}</b><span>Velocidad</span></div>
    </div>
  `;

  byId('peopleProgressCard').innerHTML = `
    <h4>Avance por persona</h4>
    ${state.team.map(member => {
      const p = teamProgress(member);
      return `
        <div class="person-progress">
          <div class="metric-label-row"><div><b>${escapeHtml(member.name)}</b> <span class="muted">${escapeHtml(member.role)}</span></div><span>${p.percent}%</span></div>
          <div class="progress"><div class="bar" style="width:${p.percent}%; background: ${member.color || '#67e8f9'}"></div></div>
          <small class="muted">Carga Jira ${p.workloadPct}% · ${p.issueCount} actividades · ${p.done}/${p.points} pts finalizados</small>
        </div>
      `;
    }).join('')}
  `;
}

function renderRoles(){
  byId('rolesGrid').innerHTML = state.team.map(member => {
    const p = teamProgress(member);
    const link = state.roleLinks?.[member.id] || 'roles/index.html';
    return `
      <button class="card story-card role-select-card ${activeRole===member.id?'active-card':''}" onclick="setRoleDetail('${member.id}')">
        <div class="role-head">
          <div class="avatar" style="background:${member.color || '#67e8f9'}">${escapeHtml(member.avatar || member.name[0])}</div>
          <div>
            <h4>${escapeHtml(member.name)}</h4>
            <div class="muted">${escapeHtml(member.role)}</div>
          </div>
        </div>
        <p>${escapeHtml(member.focus)}</p>
        <div class="progress"><div class="bar" style="width:${p.percent}%; background:${member.color || '#67e8f9'}"></div></div>
        <div class="story-footer">
          <span class="pill ${statusClass(p.percent>=80?'En revisión':'En curso')}">${p.workloadPct}% carga · ${p.percent}% avance</span>
          <a class="btn small" href="${link}" onclick="event.stopPropagation()">Abrir carpeta</a>
        </div>
      </button>
    `;
  }).join('');
}
function setRoleDetail(id){ activeRole = id; renderRoles(); renderRoleDetail(id); }
function renderRoleDetail(id){
  const member = state.team.find(m=>m.id===id) || state.team[0];
  const detail = state.roleDetails?.[id] || { done:[], artifacts:[] };
  const link = state.roleLinks?.[id] || 'roles/index.html';
  byId('roleDetail').innerHTML = `
    <div class="detail-header">
      <div>
        <h4>Detalle del rol: ${escapeHtml(member.name)} — ${escapeHtml(member.role)}</h4>
        <p class="muted">Responsabilidades y entregables asignados.</p>
      </div>
      <a class="btn small" href="${link}">Ver carpeta del rol</a>
    </div>
    <div class="grid cols-2">
      <div>
        <h4>¿Qué realizó?</h4>
        <ul class="checklist">${detail.done.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      <div>
        <h4>Artefactos / evidencias</h4>
        <div class="artifact-list">${detail.artifacts.map(item=>renderArtifactLink(item)).join('')}</div>
        <p class="muted section-gap-top">Fase principal: ${escapeHtml(member.phase || '')}</p>
      </div>
    </div>
  `;
}

function renderXPValues(){
  byId('xpValues').innerHTML = (state.xpValues || []).map(v => `
    <div class="card">
      <h4>${escapeHtml(v.name)}</h4>
      <p>${escapeHtml(v.desc)}</p>
    </div>
  `).join('');
}
function renderPhases(){
  const ids = Object.keys(state.phaseMeta || {});
  byId('phasesGrid').innerHTML = ids.map(id => {
    const meta = state.phaseMeta[id];
    return `
      <button class="card story-card ${activePhase===id?'active-card':''}" onclick="setPhaseDetail('${id}')">
        <h4>${escapeHtml(meta.name)}</h4>
        <p class="muted">${escapeHtml(meta.owners)}</p>
        <p>${escapeHtml(meta.goal)}</p>
        <div class="story-footer">
          <span class="pill">Fase XP</span>
          <a class="btn small" href="${state.phaseLinks?.[id] || 'artefactos/index.html'}" onclick="event.stopPropagation()">Abrir carpeta</a>
        </div>
      </button>
    `;
  }).join('');
}
function setPhaseDetail(id){ activePhase = id; renderPhases(); renderPhaseDetail(id); }
function renderPhaseDetail(id){
  const meta = state.phaseMeta[id];
  const detail = state.phaseDetails?.[id] || { done:[], artifacts:[] };
  byId('phaseDetail').innerHTML = `
    <div class="detail-header">
      <div>
        <h4>Carpeta de fase: ${escapeHtml(meta.name)}</h4>
        <p class="muted">Responsables: ${escapeHtml(meta.owners)}</p>
      </div>
      <a class="btn small" href="${state.phaseLinks?.[id] || 'artefactos/index.html'}">Ver carpeta de fase</a>
    </div>
    <p>${escapeHtml(meta.goal)}</p>
    <div class="grid cols-2">
      <div>
        <h4>Actividades realizadas</h4>
        <ul class="checklist">${detail.done.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      <div>
        <h4>Artefactos destacados</h4>
        <div class="artifact-list">${detail.artifacts.map(item=>renderArtifactLink(item)).join('')}</div>
      </div>
    </div>
  `;
}

function renderHUFilters(){
  const itSel = byId('huFilterIteration');
  const stSel = byId('huFilterStatus');
  if(itSel.options.length === 1){
    (state.iterations || []).forEach(it=>{
      const op = document.createElement('option');
      op.value = String(it.id);
      op.textContent = it.name;
      itSel.appendChild(op);
    });
  }
  if(stSel.options.length === 1){
    statusOrder.forEach(s=>{
      const op = document.createElement('option');
      op.value = s;
      op.textContent = s;
      stSel.appendChild(op);
    });
  }
  ['huSearch','huFilterIteration','huFilterStatus','testSearch'].forEach(id=>{
    const el = byId(id);
    if(el && !el.dataset.bound){ el.addEventListener('input', ()=>{ if(id==='testSearch') renderTests(); else renderHUs(); }); el.dataset.bound='1'; }
    if(el && el.tagName === 'SELECT' && !el.dataset.changeBound){ el.addEventListener('change', ()=>renderHUs()); el.dataset.changeBound='1'; }
  });
}
function filteredHUs(){
  const q = (byId('huSearch')?.value || '').trim().toLowerCase();
  const iteration = byId('huFilterIteration')?.value || 'all';
  const status = byId('huFilterStatus')?.value || 'all';
  return state.hus.filter(h => {
    const matchesQ = !q || [h.id,h.title,h.owner,h.epic].join(' ').toLowerCase().includes(q);
    const matchesIt = iteration === 'all' || huIterationId(h) === iteration;
    const matchesSt = status === 'all' || h.status === status;
    return matchesQ && matchesIt && matchesSt;
  });
}
function renderHUs(){
  const rows = filteredHUs();
  byId('huTableBody').innerHTML = rows.map(h => {
    const idx = state.hus.findIndex(x => x.id === h.id);
    return `
      <tr>
        <td><b>${escapeHtml(h.id)}</b><br><small class="muted">${escapeHtml(h.jiraKey || 'LOCAL')}</small></td>
        <td>${escapeHtml(h.title)}<br><small class="muted">${escapeHtml(h.epic)} · ${huIterationId(h).replace('it','Iteración ')}</small></td>
        <td>${escapeHtml(h.owner)}</td>
        <td>
          <select onchange="updateHU(${idx}, 'priority', this.value)">${priorityOrder.map(p=>`<option ${p===h.priority?'selected':''}>${p}</option>`).join('')}</select>
        </td>
        <td><input type="number" min="1" class="inline-input" value="${h.points}" onchange="updateHU(${idx}, 'points', this.value)"></td>
        <td><input type="number" min="1" class="inline-input" value="${h.hours}" onchange="updateHU(${idx}, 'hours', this.value)"></td>
        <td>
          <select onchange="updateHU(${idx}, 'status', this.value)">${statusOrder.map(s=>`<option ${s===h.status?'selected':''}>${s}</option>`).join('')}</select>
        </td>
        <td><button class="btn small" onclick="viewHU('${h.id}')">Ver</button></td>
      </tr>
    `;
  }).join('');

  const boardWrap = byId('huBoard');
  const issuesForBoard = (state.jiraIssues && state.jiraIssues.length)
    ? state.jiraIssues.filter(i => {
        const q = normalizeText(byId('huSearch')?.value || '');
        const statusFilter = byId('huStatusFilter')?.value || '';
        const iterationFilter = byId('huIterationFilter')?.value || '';
        const text = normalizeText(`${i.key} ${i.title} ${i.assignee || ''} ${(i.labels || []).join(' ')}`);
        return (!q || text.includes(q)) && (!statusFilter || i.status === statusFilter) && (!iterationFilter || String(i.iteration || '') === String(iterationFilter));
      })
    : rows.map(h => ({ key:h.jiraKey || h.id, type:'Historia', title:`${h.id} ${h.title}`, status:h.status, priority:h.priority, assignee:h.owner, iteration:huIterationId(h), labels:h.labels || [huIterationId(h)] }));
  boardWrap.innerHTML = statusOrder.map(status => {
    const list = issuesForBoard.filter(i=>i.status===status);
    return `
      <div class="kanban-col">
        <div class="kanban-col-head"><b>${status}</b><span>${list.length}</span></div>
        ${list.map(i=>`<div class="mini-card"><div class="row between tiny"><b>${escapeHtml(i.key)}</b><span class="pill">${escapeHtml(i.type || 'Historia')}</span></div><p>${escapeHtml(i.title)}</p><div class="tag-row">${(i.labels || []).slice(0,4).map(l=>`<span>${escapeHtml(l)}</span>`).join('')}</div><div class="story-meta"><span class="pill">${escapeHtml(i.assignee || 'Sin asignar')}</span><span class="pill ${statusClass(i.priority)}">${escapeHtml(i.priority || 'Media')}</span></div></div>`).join('') || '<p class="muted">Sin actividades</p>'}
      </div>
    `;
  }).join('');
}
function updateHU(index, field, value){
  const hu = state.hus[index];
  if(!hu) return;
  if(['points','hours'].includes(field)) value = Math.max(1, parseInt(value || 1, 10));
  hu[field] = value;
  const linkedIssue = (state.jiraIssues || []).find(i => i.huId === hu.id || i.key === hu.jiraKey);
  if(linkedIssue){
    if(field === 'status') linkedIssue.status = value;
    if(field === 'priority') linkedIssue.priority = value;
    if(field === 'iteration') linkedIssue.iteration = String(value);
    if(field === 'owner') linkedIssue.assignee = value;
  }
  save();
}
function viewHU(id){
  const h = state.hus.find(x=>x.id===id);
  if(!h) return;
  openModal(`Detalle ${h.id}`, `
    <div class="doc-content">
      <p><span class="pill">${escapeHtml(h.epic)}</span><span class="pill ${statusClass(h.status)}">${escapeHtml(h.status)}</span><span class="pill">${h.points} pts</span><span class="pill">${h.hours} horas</span></p>
      <h4>${escapeHtml(h.title)}</h4>
      <p><b>Como</b> ${escapeHtml(h.as)}<br><b>Quiero</b> ${escapeHtml(h.want)}<br><b>Para</b> ${escapeHtml(h.so)}</p>
      <h4>Criterios de aceptación</h4>
      <ul class="checklist">${(h.cas || []).map(c=>`<li>${escapeHtml(c)}</li>`).join('')}</ul>
      <h4>Gherkin</h4>
      <div class="gherkin">${escapeHtml(h.gherkin)}</div>
      <h4>Subtareas</h4>
      <ul class="checklist">${(h.subtasks || []).map(s=>`<li>${escapeHtml(typeof s==='string'?s:(s.key+' · '+s.title+' · '+s.status))}</li>`).join('')}</ul>
      <div class="hero-actions section-gap-top">
        <a class="btn" href="${h.url || state.integrations.jira || '#'}" target="_blank">Abrir en Jira</a>
        <button class="btn" onclick="closeModal()">Volver</button>
      </div>
    </div>
  `);
}
function openHUForm(){
  openModal('Nueva HU local', `
    <div class="grid cols-2">
      <div><label>Título</label><input id="newHuTitle" class="input" placeholder="Nueva historia de usuario"></div>
      <div><label>Épica</label><select id="newHuEpic">${state.epics.map(e=>`<option value="${e.id}">${e.id} - ${escapeHtml(e.title)}</option>`).join('')}</select></div>
      <div><label>Responsable</label><select id="newHuOwner">${state.team.map(m=>`<option>${escapeHtml(m.name)}</option>`).join('')}</select></div>
      <div><label>Iteración</label><select id="newHuIteration">${(state.iterations||[]).map(it=>`<option value="${it.id}">${escapeHtml(it.name)}</option>`).join('')}</select></div>
      <div><label>Prioridad</label><select id="newHuPriority">${priorityOrder.map(p=>`<option>${p}</option>`).join('')}</select></div>
      <div><label>Estado</label><select id="newHuStatus">${statusOrder.map(s=>`<option>${s}</option>`).join('')}</select></div>
      <div><label>Puntos</label><input id="newHuPoints" type="number" min="1" class="input" value="3"></div>
      <div><label>Horas</label><input id="newHuHours" type="number" min="1" class="input" value="6"></div>
    </div>
    <div class="section-gap-top"><label>Descripción (quiero)</label><textarea id="newHuWant" rows="2" class="input" placeholder="Qué quiere hacer el jugador"></textarea></div>
    <div class="section-gap-top"><label>Beneficio (para)</label><textarea id="newHuSo" rows="2" class="input" placeholder="Para qué lo necesita"></textarea></div>
    <div class="section-gap-top"><label>Criterios de aceptación (uno por línea)</label><textarea id="newHuCas" rows="4" class="input" placeholder="Criterio 1\nCriterio 2\nCriterio 3"></textarea></div>
    <div class="section-gap-top"><label>Gherkin</label><textarea id="newHuGherkin" rows="5" class="input" placeholder="Dado...\nCuando...\nEntonces..."></textarea></div>
    <div class="hero-actions section-gap-top">
      <button class="btn primary" id="saveNewHuBtn">Crear HU</button>
      <button class="btn" onclick="closeModal()">Volver</button>
    </div>
  `);
  byId('saveNewHuBtn').onclick = addHUFromForm;
}
function addHUFromForm(){
  const title = byId('newHuTitle').value.trim() || 'Nueva historia de usuario';
  const points = Math.max(1, parseInt(byId('newHuPoints').value || '3', 10));
  const hours = Math.max(1, parseInt(byId('newHuHours').value || String(points*2), 10));
  const cas = byId('newHuCas').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const id = 'HU-' + String(state.hus.length + 1).padStart(2,'0');
  state.hus.push({
    id,
    epic: byId('newHuEpic').value,
    title,
    as: 'Jugador',
    want: byId('newHuWant').value.trim() || title.toLowerCase(),
    so: byId('newHuSo').value.trim() || 'mejorar la experiencia del juego',
    owner: byId('newHuOwner').value,
    priority: byId('newHuPriority').value,
    points,
    hours,
    iteration: byId('newHuIteration').value,
    status: byId('newHuStatus').value,
    labels: ['hu','local'],
    files: 'Pendiente de definir',
    cas: cas.length ? cas : ['La funcionalidad se ejecuta correctamente.', 'El flujo se muestra en pantalla.', 'El cliente valida el resultado.'],
    gherkin: byId('newHuGherkin').value.trim() || `Dado que el jugador usa el sistema\nCuando ejecuta ${title}\nEntonces el juego responde según lo esperado.`,
    jiraKey: 'LOCAL',
    url: state.integrations.jira || '#',
    subtasks: ['Analizar', 'Implementar', 'Probar'],
    acceptance_status: 'Pendiente'
  });
  const created = state.hus[state.hus.length - 1];
  state.jiraIssues = state.jiraIssues || [];
  state.jiraIssues.push({
    key: created.jiraKey,
    type: 'Historia',
    title: `${created.id} ${created.title}`,
    status: created.status,
    priority: created.priority,
    assignee: created.owner,
    parentEpic: created.epic,
    huId: created.id,
    iteration: String(created.iteration),
    labels: [String(created.iteration), 'hu', 'local']
  });
  closeModal();
  save();
  toast('Se creó una nueva HU local y quedó guardada.');
}

function renderIterations(){
  const stats = iterationStats();
  byId('timelineWrap').innerHTML = `
    <h4>Línea de tiempo e iteraciones</h4>
    <div class="timeline">
      ${stats.map(it => `
        <div class="time-item card nested-card">
          <div class="metric-label-row"><b>${escapeHtml(it.name)}</b><span class="pill">${it.planned} pts planificados</span></div>
          <p class="muted">${escapeHtml(it.scope || '')}</p>
          <div class="progress"><div class="bar" style="width:${it.percent}%"></div></div>
          <p>${it.progress}/${it.planned} pts con avance · ${it.done} finalizados · TestRail ${it.passRate}% passed</p>
        </div>
      `).join('')}
    </div>
  `;
  byId('deliveryPlan').innerHTML = `
    <h4>Plan de entregas</h4>
    ${stats.map(it=>`<div class="delivery-item">
      <div>
        <b>${escapeHtml(it.name)}</b><br>
        <small class="muted">${escapeHtml(it.scope || '')}</small><br>
        <small class="muted">Acciones por iteración: avanzar HU o reabrir por retrabajo XP.</small>
      </div>
      <span class="pill ${statusClass(it.status === 'Planificada' ? 'En revisión' : 'Finalizado')}">${escapeHtml(it.status || 'Planificada')}</span>
      <div class="row-actions">
        <button class="btn small" onclick="advanceIteration('${it.id}')">Avanzar iteración</button>
        <button class="btn small ghost" onclick="reopenIteration('${it.id}')">Reabrir / retrabajo</button>
      </div>
    </div>`).join('')}
  `;
}


function filteredTests(){
  const q = (byId('testSearch')?.value || '').trim().toLowerCase();
  return state.tests.filter(t => !q || [t.id,t.title,t.reference,t.section].join(' ').toLowerCase().includes(q));
}
function renderTests(){
  const q = qualityCounts();
  const total = state.tests.length || 1;
  byId('testRunSummary').innerHTML = `
    <h4>Resumen de ejecución</h4>
    <div class="quality-bar">
      <span class="pass" style="width:${pct(q.passed,total)}%"></span>
      <span class="block" style="width:${pct(q.blocked,total)}%"></span>
      <span class="skip" style="width:${pct(q.skipped,total)}%"></span>
      <span class="fail" style="width:${pct(q.failed + q.automationError,total)}%"></span>
    </div>
    <p class="muted">${q.passed} Passed · ${q.failed} Failed · ${q.blocked} Blocked · ${q.skipped} Skipped · ${q.automationError} Automation Error</p>
  `;

  byId('testsTableBody').innerHTML = filteredTests().map(t => {
    const idx = state.tests.findIndex(x => x.id === t.id);
    return `
      <tr>
        <td><b>${escapeHtml(t.id)}</b></td>
        <td>${escapeHtml(t.title)}<br><small class="muted">${escapeHtml(t.section || '')}</small></td>
        <td>${escapeHtml(t.reference)}</td>
        <td>${escapeHtml(t.priority)}</td>
        <td><select onchange="updateTestStatus(${idx}, this.value)">${testStatusOrder.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
        <td><button class="btn small" onclick="viewTest('${t.id}')">Ver</button></td>
      </tr>
    `;
  }).join('');
}
function updateTestStatus(index, value){
  const test = state.tests[index];
  if(!test) return;
  test.status = value;
  if(['Failed','Blocked','Automation Error'].includes(value) && !state.bugs.some(b => b.testrail === test.id)){
    state.bugs.push({
      id: `BUG-${String(state.bugs.length + 1).padStart(2,'0')}`,
      jiraKey: 'LOCAL',
      title: `Defecto detectado desde ${test.id}`,
      severity: value === 'Failed' ? 'Alta' : 'Media',
      status: 'Por hacer',
      linkedHU: test.reference || 'HU-00',
      owner: 'Diego',
      testrail: test.id,
      evidence: `Bug generado automáticamente por cambio de resultado a ${value}.`
    });
  }
  save();
  toast(`Prueba ${test.id} actualizada a ${value}.`);
}
function viewTest(id){
  const t = state.tests.find(x=>x.id===id);
  if(!t) return;
  openModal(`Detalle ${t.id}`, `
    <p><span class="pill">${escapeHtml(t.reference)}</span><span class="pill ${statusClass(t.status)}">${escapeHtml(t.status)}</span><span class="pill">${escapeHtml(t.priority)}</span></p>
    <h4>${escapeHtml(t.title)}</h4>
    <p><b>Tipo:</b> ${escapeHtml(t.type || '')}</p>
    <h4>Precondición</h4>
    <p>${escapeHtml(t.preconditions || '')}</p>
    <h4>Pasos / Gherkin</h4>
    <ol class="checklist">${(t.steps || []).map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <h4>Resultado esperado</h4>
    <p>${escapeHtml(t.expected || '')}</p>
    <div class="hero-actions section-gap-top">
      <a class="btn" href="${state.integrations.testrail || '#'}" target="_blank">Abrir TestRail</a>
      <button class="btn" onclick="closeModal()">Volver</button>
    </div>
  `);
}

function renderBugs(){
  byId('bugsTableBody').innerHTML = state.bugs.map((b, idx) => `
    <tr>
      <td><b>${escapeHtml(b.id)}</b><br><small class="muted">${escapeHtml(b.jiraKey || 'LOCAL')}</small></td>
      <td>${escapeHtml(b.title)}<br><small class="muted">${escapeHtml(b.evidence || '')}</small></td>
      <td>${escapeHtml(b.linkedHU || '')}</td>
      <td>${escapeHtml(b.testrail || '')}</td>
      <td><span class="pill ${severityClass(b.severity)}">${escapeHtml(b.severity)}</span></td>
      <td><select onchange="updateBugStatus(${idx}, this.value)">${bugStatusOrder.map(s=>`<option ${s===b.status?'selected':''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn small" onclick="viewBug(${idx})">Ver</button></td>
    </tr>
  `).join('');
}
function updateBugStatus(index, value){
  if(!state.bugs[index]) return;
  state.bugs[index].status = value;
  save();
  toast(`Bug ${state.bugs[index].id} actualizado.`);
}
function viewBug(index){
  const b = state.bugs[index];
  if(!b) return;
  openModal(`Detalle ${b.id}`, `
    <p><span class="pill ${severityClass(b.severity)}">${escapeHtml(b.severity)}</span><span class="pill ${statusClass(b.status)}">${escapeHtml(b.status)}</span></p>
    <h4>${escapeHtml(b.title)}</h4>
    <p><b>HU asociada:</b> ${escapeHtml(b.linkedHU || '')}</p>
    <p><b>Prueba asociada:</b> ${escapeHtml(b.testrail || '')}</p>
    <p><b>Responsable:</b> ${escapeHtml(b.owner || '')}</p>
    <h4>Evidencia</h4>
    <p>${escapeHtml(b.evidence || 'Sin evidencia registrada.')}</p>
    <div class="hero-actions section-gap-top">
      <a class="btn" href="${state.integrations.jira || '#'}" target="_blank">Abrir Jira</a>
      <button class="btn" onclick="closeModal()">Volver</button>
    </div>
  `);
}
function openBugForm(){
  openModal('Crear bug local', `
    <div class="grid cols-2">
      <div><label>Título</label><input id="newBugTitle" class="input" placeholder="Descripción breve del bug"></div>
      <div><label>HU afectada</label><select id="newBugHU">${state.hus.map(h=>`<option value="${h.id}">${h.id} - ${escapeHtml(h.title)}</option>`).join('')}</select></div>
      <div><label>Responsable</label><select id="newBugOwner">${state.team.map(m=>`<option>${escapeHtml(m.name)}</option>`).join('')}</select></div>
      <div><label>Severidad</label><select id="newBugSeverity"><option>Alta</option><option>Media</option><option>Baja</option></select></div>
      <div><label>Estado</label><select id="newBugStatus">${bugStatusOrder.map(s=>`<option>${s}</option>`).join('')}</select></div>
      <div><label>Referencia prueba</label><input id="newBugTest" class="input" placeholder="TC-HU..."></div>
    </div>
    <div class="section-gap-top"><label>Evidencia</label><textarea id="newBugEvidence" rows="4" class="input" placeholder="Qué ocurrió, cómo se reproduce, evidencia encontrada"></textarea></div>
    <div class="hero-actions section-gap-top">
      <button class="btn primary" id="saveNewBugBtn">Crear bug</button>
      <button class="btn" onclick="closeModal()">Volver</button>
    </div>
  `);
  byId('saveNewBugBtn').onclick = addBugFromForm;
}
function addBugFromForm(){
  state.bugs.push({
    id: `BUG-${String(state.bugs.length + 1).padStart(2,'0')}`,
    jiraKey: 'LOCAL',
    title: byId('newBugTitle').value.trim() || 'Bug local sin título',
    severity: byId('newBugSeverity').value,
    status: byId('newBugStatus').value,
    linkedHU: byId('newBugHU').value,
    owner: byId('newBugOwner').value,
    testrail: byId('newBugTest').value.trim() || 'N/A',
    evidence: byId('newBugEvidence').value.trim() || 'Sin evidencia registrada.'
  });
  closeModal();
  save();
  toast('Bug local creado.');
}

function renderChanges(){
  byId('changeWho').innerHTML = state.team.map(m=>`<option>${escapeHtml(m.name)}</option>`).join('');
  byId('changeHU').innerHTML = state.hus.map(h=>`<option value="${h.id}">${h.id}</option>`).join('');
  byId('changesFeed').innerHTML = state.changes.slice().reverse().map(ch => `
    <div class="time-item">
      <b>${escapeHtml(ch.date)} · ${escapeHtml(ch.who)}</b><br>
      <span class="muted">${escapeHtml(ch.hu)} · ${escapeHtml(ch.file)} · ${escapeHtml(ch.type)}</span>
      <p>${escapeHtml(ch.note)}</p>
    </div>
  `).join('') || '<p class="muted">Sin actividad registrada.</p>';
}
function bindChangeForm(){
  const form = byId('changeForm');
  if(form && !form.dataset.bound){
    form.addEventListener('submit', evt => {
      evt.preventDefault();
      const change = {
        date: new Date().toLocaleString('es-EC'),
        who: byId('changeWho').value,
        hu: byId('changeHU').value,
        file: byId('changeFile').value.trim(),
        type: byId('changeType').value,
        note: byId('changeNote').value.trim()
      };
      if(!change.file || !change.note){ toast('Completa archivo y nota.'); return; }
      state.changes.push(change);
      form.reset();
      save();
      toast('Cambio registrado.');
    });
    form.dataset.bound = '1';
  }
}

function renderTraceability(){
  const el = byId('traceBody');
  if(!el) return;
  el.innerHTML = state.hus.map(hu => {
    const tests = state.tests.filter(t => t.reference === hu.id);
    const bugs = state.bugs.filter(b => b.linkedHU === hu.id);
    const testText = tests.length
      ? tests.map(t => `<button class="linklike" onclick="viewTest('${escapeHtml(t.id)}')">${escapeHtml(t.id)}</button> <span class="pill ${statusClass(t.status)}">${escapeHtml(t.status)}</span>`).join('<br>')
      : '<span class="muted">Sin prueba</span>';
    const bugText = bugs.length
      ? bugs.map(b => `<button class="linklike" onclick="viewBug(${state.bugs.indexOf(b)})">${escapeHtml(b.id)}</button> <span class="pill ${severityClass(b.severity)}">${escapeHtml(b.severity)}</span>`).join('<br>')
      : '<span class="muted">Sin bug</span>';
    const criteria = (hu.cas || []).map((c, i) => `<span class="trace-criteria">CA${String(i+1).padStart(2,'0')}: ${escapeHtml(c)}</span>`).join('');
    return `
      <tr>
        <td><b>${escapeHtml(hu.epic || '')}</b></td>
        <td><b>${escapeHtml(hu.id)}</b><br>${escapeHtml(hu.title)}<br><small class="muted">Jira: ${escapeHtml(hu.jiraKey || 'LOCAL')}</small></td>
        <td><span class="pill ${statusClass(hu.status)}">${escapeHtml(hu.status)}</span></td>
        <td>${criteria}</td>
        <td>${testText}</td>
        <td>${bugText}</td>
        <td><small>${escapeHtml(hu.files || 'Proyecto Space Invaders')}</small></td>
      </tr>
    `;
  }).join('');
}

function renderIntegrations(){
  byId('jiraBase').value = state.integrations.jira || '';
  byId('testrailBase').value = state.integrations.testrail || '';
}
function saveLinks(){
  state.integrations.jira = byId('jiraBase').value.trim();
  state.integrations.testrail = byId('testrailBase').value.trim();
  save();
  toast('Enlaces guardados localmente.');
}

function openModal(title, content){
  byId('modalTitleWrap').innerHTML = `<h3>${escapeHtml(title)}</h3>`;
  byId('modalContent').innerHTML = content;
  byId('modalBack').style.display = 'flex';
}
function closeModal(){ byId('modalBack').style.display = 'none'; }
window.onclick = function(e){ if(e.target === byId('modalBack')) closeModal(); };

function addStatusChange(hu, type){
  state.changes = Array.isArray(state.changes) ? state.changes : [];
  state.changes.unshift({
    date: new Date().toLocaleString('es-EC'),
    who: String(hu.owner || '').split('+')[0].trim() || 'Equipo',
    hu: hu.id,
    file: hu.files || 'Dashboard XP',
    type,
    note: `${hu.id} quedó en estado ${hu.status}.`
  });
}
function advanceIteration(iterationId){
  const stories = state.hus.filter(h => huIterationId(h) === iterationId);
  const target = stories.find(h=>h.status==='Por hacer') || stories.find(h=>h.status==='En curso') || stories.find(h=>h.status==='En revisión');
  if(!target){ toast('No hay HU pendientes para avanzar en esta iteración.'); return; }
  const idx = statusOrder.indexOf(target.status);
  target.status = statusOrder[Math.min(idx + 1, statusOrder.length - 1)];
  addStatusChange(target, 'Avance de iteración');
  save();
  toast(`${target.id} cambió a ${target.status}.`);
}
function reopenIteration(iterationId){
  const stories = state.hus.filter(h => huIterationId(h) === iterationId);
  const target = stories.find(h=>h.status==='Finalizado') || stories.find(h=>h.status==='En revisión');
  if(!target){ toast('No hay HU finalizadas o en revisión para reabrir en esta iteración.'); return; }
  target.status = target.status === 'Finalizado' ? 'En revisión' : 'En curso';
  addStatusChange(target, 'Retrabajo XP');
  save();
  toast(`${target.id} fue reabierta a ${target.status}.`);
}
function simulateAdvance(){
  const active = (state.iterations || []).find(it => it.status !== 'Finalizado') || (state.iterations || [])[0];
  if(active) advanceIteration(active.id);
}


async function startDashboard(){
  await syncStateFromServer();
  activeRole = state.team?.[0]?.id || activeRole;
  activePhase = Object.keys(state.phaseMeta || {})[0] || activePhase;
  renderAll();
}
startDashboard();
initSectionNavigation();
window.activateSection = activateSection;
window.resetDemo = resetDemo;
window.setRoleDetail = setRoleDetail;
window.setPhaseDetail = setPhaseDetail;
window.updateHU = updateHU;
window.viewHU = viewHU;
window.openHUForm = openHUForm;
window.openBugForm = openBugForm;
window.updateTestStatus = updateTestStatus;
window.viewTest = viewTest;
window.updateBugStatus = updateBugStatus;
window.viewBug = viewBug;
window.simulateAdvance = simulateAdvance;
window.advanceIteration = advanceIteration;
window.reopenIteration = reopenIteration;
window.saveLinks = saveLinks;
window.closeModal = closeModal;

function saveSnapshot(){
  save();
  alert('Cambios guardados. Si ejecutas con npm start, se guardan en data/state.json y otras computadoras verán el cambio al recargar.');
}
