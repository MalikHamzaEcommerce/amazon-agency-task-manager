(() => {
  const cfg = window.APP_CONFIG || {};
  const hasFirebase = !!(cfg.FIREBASE_CONFIG && window.FIREBASE_BACKEND_READY && window.supabase);
  const sb = hasFirebase ? window.supabase.createClient() : null;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  const ICONS = {
    dashboard:'▦', accounts:'▣', tasks:'☑', my:'◉', team:'♙', calendar:'▤', reports:'◔', settings:'⚙'
  };
  const TASK_STATUSES = ['Not Started','In Progress','Awaiting','Blocked','Completed'];
  const TASK_PRIORITIES = ['High','Medium','Low'];
  const TASK_SOURCES = ['Email','Slack','WhatsApp','Upwork','Fiverr','Client Portal','Call','Internal','Other'];

  const state = {
    demo: !hasFirebase,
    user: null,
    profile: null,
    agency: null,
    accounts: [],
    tasks: [],
    team: [],
    route: 'dashboard',
    search: '',
    filters: { account:'', assignee:'', status:'', priority:'', source:'', dateMode:'', date:'' },
    dashboardMemberId: '',
    dashboardMemberDateMode: 'today',
    dashboardMemberDate: '',
    calendarMonth: ''
  };

  const DEMO = {
    agency: { id:'demo-agency', name:'Apex Amazon Agency', invite_code:'APEXVA2026', owner_id:'demo-owner' },
    profile: { id:'demo-owner', agency_id:'demo-agency', full_name:'Ahmed Raza', email:'owner@example.com', role:'owner', active:true },
    team: [
      {id:'demo-owner',agency_id:'demo-agency',full_name:'Ahmed Raza',email:'owner@example.com',role:'owner',active:true},
      {id:'va-ali',agency_id:'demo-agency',full_name:'Ali',email:'ali@example.com',role:'va',active:true},
      {id:'va-sarah',agency_id:'demo-agency',full_name:'Sarah',email:'sarah@example.com',role:'va',active:true},
      {id:'va-ahmed',agency_id:'demo-agency',full_name:'Ahmed',email:'ahmed@example.com',role:'va',active:true}
    ],
    accounts: [
      {id:'a1',account_name:'ABC Supplements',client_name:'John',marketplace:'Amazon US',status:'Active',notes:''},
      {id:'a2',account_name:'XYZ Home',client_name:'Sarah',marketplace:'Amazon UK',status:'Active',notes:''},
      {id:'a3',account_name:'HomePro',client_name:'David',marketplace:'Amazon US',status:'Active',notes:''},
      {id:'a4',account_name:'Beauty Plus',client_name:'Emily',marketplace:'Amazon CA',status:'Onboarding',notes:''},
      {id:'a5',account_name:'Kids Kingdom',client_name:'Michael',marketplace:'Amazon US',status:'Active',notes:''}
    ],
    tasks: []
  };

  function demoTasks(){
    const d = new Date();
    const iso = (offset=0) => { const x=new Date(d); x.setHours(12,0,0,0); x.setDate(x.getDate()+offset); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    return [
      {id:'t1',account_id:'a1',title:'PPC campaign optimization',description:'Review spend and high ACOS terms',assigned_to:'va-ali',received_by:'demo-owner',source:'Email',status:'In Progress',priority:'High',due_date:iso(0),recurring:true,recurrence:'Weekly',created_at:new Date().toISOString()},
      {id:'t2',account_id:'a3',title:'Fix suppressed listings',description:'Resolve listing suppression',assigned_to:'va-sarah',received_by:'demo-owner',source:'WhatsApp',status:'Completed',priority:'Medium',due_date:iso(0),recurring:false,recurrence:'',created_at:new Date().toISOString(),completed_at:new Date().toISOString()},
      {id:'t3',account_id:'a2',title:'Update keywords',description:'Update backend search terms',assigned_to:'va-ahmed',received_by:'demo-owner',source:'Slack',status:'Awaiting',priority:'High',due_date:iso(1),recurring:false,recurrence:'',created_at:new Date().toISOString()},
      {id:'t4',account_id:'a4',title:'Review account health',description:'Check policy and account health alerts',assigned_to:'demo-owner',received_by:'demo-owner',source:'Client Portal',status:'In Progress',priority:'Medium',due_date:iso(-1),recurring:true,recurrence:'Daily',created_at:new Date().toISOString()},
      {id:'t5',account_id:'a5',title:'Create A+ content',description:'Prepare module brief',assigned_to:'va-ali',received_by:'demo-owner',source:'Email',status:'Not Started',priority:'Low',due_date:iso(2),recurring:false,recurrence:'',created_at:new Date().toISOString()},
      {id:'t6',account_id:'a1',title:'Inventory alert check',description:'Review low-stock SKUs',assigned_to:'va-sarah',received_by:'demo-owner',source:'Internal',status:'Not Started',priority:'High',due_date:iso(0),recurring:true,recurrence:'Daily',created_at:new Date().toISOString()},
      {id:'t7',account_id:'a2',title:'Competitor price review',description:'Check top 5 competitors',assigned_to:'va-ahmed',received_by:'demo-owner',source:'Upwork',status:'Blocked',priority:'Medium',due_date:iso(-2),recurring:false,recurrence:'',created_at:new Date().toISOString()}
    ];
  }

  function seedDemo(){
    const saved = localStorage.getItem('amazon-agency-demo-v2');
    if (saved){
      try { const x=JSON.parse(saved); Object.assign(state, x, {demo:true,route:state.route,search:'',filters:state.filters}); return; } catch(e){}
    }
    state.user={id:'demo-owner',email:'owner@example.com'};
    state.profile=DEMO.profile;
    state.agency=DEMO.agency;
    state.accounts=DEMO.accounts;
    state.team=DEMO.team;
    state.tasks=demoTasks();
    persistDemo();
  }

  function persistDemo(){
    if (!state.demo) return;
    localStorage.setItem('amazon-agency-demo-v2', JSON.stringify({user:state.user,profile:state.profile,agency:state.agency,accounts:state.accounts,tasks:state.tasks,team:state.team}));
  }

  function esc(v=''){ return String(v ?? '').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }
  function slug(v=''){ return String(v).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
  function toISODateLocal(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function today(){ return toISODateLocal(new Date()); }
  function shiftedDate(days=0){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+days); return toISODateLocal(d); }
  function fmtDate(v){ if(!v) return '—'; const d=new Date(v+'T00:00:00'); return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function recurrenceNextDate(dateStr, recurrence){
    if(!dateStr || !['Daily','Weekly','Monthly'].includes(recurrence)) return null;
    const parts=String(dateStr).split('-').map(Number); if(parts.length!==3||parts.some(Number.isNaN)) return null;
    const [y,m,d]=parts;
    if(recurrence==='Monthly'){
      const nextMonthStart=new Date(y,m,1,12,0,0,0);
      const lastDay=new Date(nextMonthStart.getFullYear(),nextMonthStart.getMonth()+1,0).getDate();
      nextMonthStart.setDate(Math.min(d,lastDay));
      return toISODateLocal(nextMonthStart);
    }
    const x=new Date(y,m-1,d,12,0,0,0); x.setDate(x.getDate()+(recurrence==='Weekly'?7:1)); return toISODateLocal(x);
  }
  function dateFromMode(mode, custom=''){
    if(mode==='today') return today();
    if(mode==='yesterday') return shiftedDate(-1);
    if(mode==='tomorrow') return shiftedDate(1);
    if(mode==='custom') return custom||'';
    return '';
  }
  function accountById(id){ return state.accounts.find(a=>a.id===id); }
  function memberById(id){ return state.team.find(m=>m.id===id); }
  function visibleTeam(){ return state.team.filter(m=>m.removed!==true); }
  function removedTeam(){ return state.team.filter(m=>m.removed===true); }
  function activeTeam(){ return visibleTeam().filter(m=>m.active!==false); }
  function normalizeTaskStatus(v=''){
    const s=String(v||'').trim();
    if(s==='Complete') return 'Completed';
    if(s==='Not Start') return 'Not Started';
    if(s==='Waiting on Client' || s==='Awaiting') return 'Awaiting';
    return s || 'Not Started';
  }
  function isCompletedTask(t){ return normalizeTaskStatus(t?.status)==='Completed'; }
  function isOverdue(t){ return !isCompletedTask(t) && t.due_date && t.due_date < today(); }
  function completedToday(t){
    if(!isCompletedTask(t)) return false;
    const completed=(t.completed_at||'').slice(0,10);
    return completed ? completed===today() : t.due_date===today();
  }
  function displayStatus(t){ return isOverdue(t) ? 'Overdue' : normalizeTaskStatus(t.status); }
  function taskStatusClass(t){ return `status-${slug(displayStatus(t))}`; }
  function initials(name=''){ return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'U'; }
  function toast(msg){ const d=document.createElement('div'); d.className='toast'; d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2600); }
  function isOwnerUser(){ return state.profile?.role === 'owner'; }
  function isManagerUser(){ return state.profile?.role === 'manager'; }
  function hasFullAccess(){ return isOwnerUser() || isManagerUser(); }
  function canManageMember(m){
    if(!m) return false;
    const isAgencyOwner=m.id===state.agency?.owner_id || m.role==='owner';
    if(isAgencyOwner) return isOwnerUser() && m.id===state.profile?.id;
    if(isOwnerUser()) return true;
    return isManagerUser() && m.role==='va' && m.removed!==true;
  }
  function canRemoveMember(m){
    if(!m || m.id===state.agency?.owner_id || m.role==='owner') return false;
    return isOwnerUser() || (isManagerUser() && m.role==='va');
  }
  function canRestoreMember(m){
    if(!m || m.id===state.agency?.owner_id || m.role==='owner') return false;
    return isOwnerUser() || (isManagerUser() && m.role==='va');
  }
  function canUpdateTask(t){ return hasFullAccess() || (state.profile?.role === 'va' && t?.assigned_to === state.profile?.id); }
  function dashboardCurrentScope(){ return state.tasks.filter(t=>!isCompletedTask(t) || completedToday(t)); }
  function buildRecurringChild(t, id){
    if(!t?.recurring || !t?.recurrence || !t?.due_date || !isCompletedTask(t)) return null;
    const nextDue=recurrenceNextDate(t.due_date,t.recurrence); if(!nextDue) return null;
    const seriesId=t.series_id||t.id;
    return {
      id,
      agency_id:t.agency_id||state.profile?.agency_id||state.agency?.id||null,
      account_id:t.account_id||null,
      title:t.title||'',
      assigned_to:t.assigned_to||null,
      received_by:t.received_by||null,
      source:t.source||'Internal',
      status:'Not Started',
      priority:t.priority||'Medium',
      due_date:nextDue,
      recurring:true,
      recurrence:t.recurrence,
      description:t.description||'',
      completed_at:null,
      created_at:new Date().toISOString(),
      created_by:state.profile?.id||state.user?.id||null,
      generated_by_recurrence:true,
      recurrence_parent_id:t.id,
      series_id:seriesId,
      recurrence_index:(Number(t.recurrence_index)||0)+1
    };
  }
  function ensureNextRecurringDemo(t){
    if(!t?.id || !isCompletedTask(t) || !t.recurring) return null;
    const nextDue=recurrenceNextDate(t.due_date,t.recurrence); if(!nextDue) return null;
    const seriesId=t.series_id||t.id;
    const nextIndex=(Number(t.recurrence_index)||0)+1;
    const existing=state.tasks.find(x=>x.id!==t.id && x.series_id===seriesId && Number(x.recurrence_index)===nextIndex && x.generated_by_recurrence===true);
    if(existing) return existing;
    const safeSeries=String(seriesId).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
    const id=`rec_${safeSeries}_${nextIndex}`;
    const child=buildRecurringChild(t,id); if(!child) return null;
    state.tasks.push(child); return child;
  }

  function navItems(){
    return [
      ['dashboard','Dashboard'],['accounts','Accounts'],['tasks','Tasks'],['my-tasks','My Tasks'],['team','Team / VAs'],['calendar','Calendar'],['reports','Reports'],['settings','Settings']
    ];
  }

  function shell(content){
    const profile = state.profile || {full_name:'User',role:'va'};
    return `
      ${state.demo?'<div class="demo-banner">Demo Mode: sample data is stored only in this browser. Connect Firebase to make it multi-user and persistent.</div>':''}
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand"><div class="brand-mark">a<span>⌣</span></div><div><div class="brand-title">Amazon</div><div class="brand-sub">Account Task Manager</div></div></div>
          <nav class="nav">${navItems().map(([r,l])=>`<a href="#/${r}" class="${state.route===r?'active':''}"><span>${ICONS[r==='my-tasks'?'my':r]||'•'}</span>${l}</a>`).join('')}</nav>
          ${hasFullAccess()?`<div class="quick"><div class="quick-title">Quick Add</div>
            <button class="primary" data-action="new-task">＋ New Task</button>
            <button class="purple" data-action="new-account">＋ New Account</button>
            <button data-action="invite-va">＋ New VA</button>
          </div>`:''}
        </aside>
        <main class="main">
          <header class="topbar">
            <div class="search"><input id="globalSearch" value="${esc(state.search)}" placeholder="Search accounts, tasks, clients..." /></div>
            <div class="top-user"><div class="avatar">${initials(profile.full_name)}</div><div><div style="font-weight:700;font-size:13px">${esc(profile.full_name||profile.email)}</div><div class="small muted">${esc(cap(profile.role))}</div></div></div>
          </header>
          <section class="content">${content}</section>
        </main>
      </div>`;
  }

  function cap(s=''){ return String(s).replace(/\b\w/g,m=>m.toUpperCase()); }
  function badge(v){ return `<span class="badge ${slug(v)}">${esc(v)}</span>`; }

  function metricCounts(tasks=state.tasks){
    return {
      total:tasks.length,
      complete:tasks.filter(isCompletedTask).length,
      progress:tasks.filter(t=>normalizeTaskStatus(t.status)==='In Progress').length,
      notStarted:tasks.filter(t=>normalizeTaskStatus(t.status)==='Not Started').length,
      awaiting:tasks.filter(t=>normalizeTaskStatus(t.status)==='Awaiting').length,
      overdue:tasks.filter(isOverdue).length
    };
  }

  function dashboardPage(){
    const scope=dashboardCurrentScope();
    const c=metricCounts(scope);
    const teamCounts=activeTeam().map(m=>({m,count:state.tasks.filter(t=>t.assigned_to===m.id && !isCompletedTask(t)).length})).sort((a,b)=>b.count-a.count);
    const sources={}; scope.forEach(t=>sources[t.source]=(sources[t.source]||0)+1);
    const maxTeam=Math.max(1,...teamCounts.map(x=>x.count));
    const maxSource=Math.max(1,...Object.values(sources));
    const currentRows=state.tasks.filter(t=>!isCompletedTask(t) || !t.due_date || t.due_date>=today());
    const rows=filterTasks(currentRows).slice(0,8);
    return `
      <div class="page-head"><div><h1>Dashboard</h1><p class="muted">Overview of current Amazon account work and team activity</p></div>${hasFullAccess()?'<div class="actions"><button class="btn primary" data-action="new-task">＋ Add Task</button></div>':''}</div>
      <div class="grid kpi-grid">
        ${kpi('Current Tasks',c.total,'blue')}${kpi('Completed Today',c.complete,'green')}${kpi('In Progress',c.progress,'blue')}${kpi('Not Started',c.notStarted,'amber')}${kpi('Awaiting',c.awaiting,'purple')}${kpi('Overdue',c.overdue,'red')}
      </div>
      <div class="grid widgets">
        <div class="card widget"><h3>Tasks by Status</h3>${statusBars(scope)}</div>
        <div class="card widget"><h3>Tasks by VA</h3>${teamCounts.map(x=>`<div class="va-row"><button class="va-name-button" data-va-dashboard="${x.m.id}" title="View ${esc(x.m.full_name)} task details">${esc(x.m.full_name)}</button><div class="bar purple"><i style="width:${Math.round(x.count/maxTeam*100)}%"></i></div><b>${x.count}</b></div>`).join('')||'<div class="empty">No team yet</div>'}</div>
        <div class="card widget"><h3>Tasks by Source</h3>${Object.entries(sources).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<div class="source-row"><span>${esc(s)}</span><div class="bar green"><i style="width:${Math.round(n/maxSource*100)}%"></i></div><b>${n}</b></div>`).join('')||'<div class="empty">No sources yet</div>'}</div>
      </div>
      ${state.dashboardMemberId?vaDashboardPanel():''}
      ${taskTableCard("Today's / Current Tasks", rows, true)}
      <div class="grid split" style="margin-top:14px">
        <div class="card panel"><div class="page-head"><div><h3 style="margin:0">Accounts Overview</h3></div><button class="btn" onclick="location.hash='#/accounts'">View All</button></div>${accountsMini()}</div>
        <div class="card panel"><div class="page-head"><div><h3 style="margin:0">Upcoming Deadlines</h3></div></div>${upcomingMini()}</div>
      </div>`;
  }

  function vaDashboardPanel(){
    const m=activeTeam().find(x=>x.id===state.dashboardMemberId);
    if(!m){ state.dashboardMemberId=''; return ''; }
    const mode=state.dashboardMemberDateMode||'today';
    const date=dateFromMode(mode,state.dashboardMemberDate);
    let tasks=state.tasks.filter(t=>t.assigned_to===m.id);
    if(date) tasks=tasks.filter(t=>t.due_date===date);
    tasks=tasks.slice().sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999') || String(a.title||'').localeCompare(String(b.title||'')));
    const counts={
      assigned:tasks.length,
      completed:tasks.filter(isCompletedTask).length,
      pending:tasks.filter(t=>!isCompletedTask(t)).length,
      awaiting:tasks.filter(t=>normalizeTaskStatus(t.status)==='Awaiting').length,
      overdue:tasks.filter(isOverdue).length
    };
    const label=date?fmtDate(date):'All Dates';
    return `<div class="card va-detail-panel">
      <div class="va-detail-head"><div><h3>${esc(m.full_name)} — ${esc(label)}</h3><div class="muted small">Assigned task detail and completion snapshot</div></div><button class="btn" data-va-dashboard-close>× Close</button></div>
      <div class="va-detail-controls"><select id="vaDateMode"><option value="" ${mode===''?'selected':''}>All Dates</option><option value="today" ${mode==='today'?'selected':''}>Today</option><option value="yesterday" ${mode==='yesterday'?'selected':''}>Yesterday</option><option value="tomorrow" ${mode==='tomorrow'?'selected':''}>Tomorrow</option><option value="custom" ${mode==='custom'?'selected':''}>Select Date</option></select>${mode==='custom'?`<input id="vaCustomDate" type="date" value="${esc(state.dashboardMemberDate||'')}">`:''}</div>
      <div class="va-stat-grid"><div class="va-stat"><span>Assigned</span><b>${counts.assigned}</b></div><div class="va-stat"><span>Completed</span><b>${counts.completed}</b></div><div class="va-stat"><span>Pending</span><b>${counts.pending}</b></div><div class="va-stat"><span>Awaiting</span><b>${counts.awaiting}</b></div><div class="va-stat"><span>Overdue</span><b>${counts.overdue}</b></div></div>
      ${taskTable(tasks)}
    </div>`;
  }

  function kpi(label,value,cls){ return `<div class="card kpi ${cls}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`; }
  function statusBars(tasks=state.tasks){
    const labels=['Completed','In Progress','Not Started','Awaiting','Blocked'];
    const max=Math.max(1,...labels.map(s=>tasks.filter(t=>normalizeTaskStatus(t.status)===s).length));
    return labels.map((s,i)=>{ const n=tasks.filter(t=>normalizeTaskStatus(t.status)===s).length; const cl=['green','','amber','purple','red'][i]; return `<div class="status-row"><span>${s}</span><div class="bar ${cl}"><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`; }).join('');
  }

  function accountsMini(){
    const rows=state.accounts.slice(0,6).map(a=>`<tr><td><span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span></td><td>${esc(a.client_name||'—')}</td><td>${esc(a.marketplace||'—')}</td><td>${badge(a.status)}</td><td>${state.tasks.filter(t=>t.account_id===a.id).length}</td></tr>`).join('');
    return `<div class="table-wrap"><table class="data-table" style="min-width:650px"><thead><tr><th>Account</th><th>Client</th><th>Marketplace</th><th>Status</th><th>Tasks</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">No accounts</td></tr>'}</tbody></table></div>`;
  }
  function upcomingMini(){
    const list=state.tasks.filter(t=>!isCompletedTask(t)&&t.due_date).sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,7);
    return list.map(t=>`<div class="metric-item"><div><b>${esc(t.title)}</b><div class="small muted">${esc(accountById(t.account_id)?.account_name||'No account')}</div></div><div style="text-align:right">${badge(t.priority)}<div class="small ${isOverdue(t)?'danger':'muted'}" style="margin-top:5px">${fmtDate(t.due_date)}</div></div></div>`).join('')||'<div class="empty">No upcoming deadlines</div>';
  }

  function accountsPage(){
    const clientLabel=a=>(a?.client_name||'').trim() || 'Unassigned Client';
    const params=new URLSearchParams((location.hash.split('?')[1]||''));
    const selectedClient=params.get('client')||'';
    const clientNames=[...new Set(state.accounts.map(clientLabel))].sort((a,b)=>a.localeCompare(b));

    if(!selectedClient){
      const clients=clientNames.map(name=>{
        const accounts=state.accounts.filter(a=>clientLabel(a)===name);
        const taskIds=new Set(accounts.map(a=>a.id));
        const tasks=state.tasks.filter(t=>taskIds.has(t.account_id));
        const active=accounts.filter(a=>String(a.status||'').toLowerCase()==='active').length;
        const open=tasks.filter(t=>!isCompletedTask(t)).length;
        return {name,accounts,active,open};
      }).filter(c=>matchesGlobal([c.name,...c.accounts.flatMap(a=>[a.account_name,a.marketplace,a.status])]))
        .sort((a,b)=>a.name.localeCompare(b.name));
      const rows=clients.map(c=>`<tr class="clickable-row" data-view-client="${esc(c.name)}"><td><span class="link" data-view-client="${esc(c.name)}"><b>${esc(c.name)}</b></span></td><td>${c.accounts.length}</td><td>${c.active}</td><td>${c.open}</td><td><button class="btn small" data-view-client="${esc(c.name)}">View Accounts</button></td></tr>`).join('');
      return `<div class="page-head"><div><h1>Accounts</h1><p class="muted">Choose a client first, then view all Amazon accounts for that client.</p></div>${hasFullAccess()?'<button class="btn primary" data-action="new-account">＋ New Account</button>':''}</div>
        <div class="card table-card"><div class="table-toolbar"><div><h3>Clients</h3><div class="muted small">${clientNames.length} clients · ${state.accounts.length} accounts</div></div><div class="client-jump"><label for="clientJump" class="small muted">Quick select</label><select id="clientJump"><option value="">Select Client</option>${clientNames.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Client Name</th><th>Accounts</th><th>Active Accounts</th><th>Open Tasks</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">No clients found</td></tr>'}</tbody></table></div></div>`;
    }

    const accounts=state.accounts.filter(a=>clientLabel(a)===selectedClient).filter(a=>matchesGlobal([a.account_name,a.client_name,a.marketplace,a.status]));
    const rows=accounts.map(a=>{
      const all=state.tasks.filter(t=>t.account_id===a.id); const open=all.filter(t=>!isCompletedTask(t)).length;
      return `<tr><td><span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span></td><td>${esc(a.marketplace||'—')}</td><td>${badge(a.status)}</td><td>${all.length}</td><td>${open}</td><td>${hasFullAccess()?`<button class="btn small" data-edit-account="${a.id}">Edit</button> <button class="btn small" data-login-access="${a.id}">Login Access</button> `:''}<button class="btn small" data-account-tasks="${a.id}">Tasks</button></td></tr>`;
    }).join('');
    return `<div class="page-head client-account-head"><div><button class="btn back-btn" data-back-clients>← Back to Clients</button><h1>${esc(selectedClient)}</h1><p class="muted">${accounts.length} account${accounts.length===1?'':'s'} for this client</p></div>${hasFullAccess()?'<button class="btn primary" data-action="new-account">＋ New Account</button>':''}</div>
      <div class="card table-card"><div class="table-toolbar"><div><h3>${esc(selectedClient)} Accounts</h3><div class="muted small">Switch clients anytime without leaving the Accounts tab.</div></div><div class="client-jump"><label for="clientJump" class="small muted">Client</label><select id="clientJump"><option value="">All Clients</option>${clientNames.map(name=>`<option value="${esc(name)}" ${name===selectedClient?'selected':''}>${esc(name)}</option>`).join('')}</select></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Account Name</th><th>Marketplace</th><th>Status</th><th>Total Tasks</th><th>Open Tasks</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No accounts found for this client</td></tr>'}</tbody></table></div></div>`;
  }

  function taskFilters(){
    const vals=(arr,key)=>[...new Set(arr.map(x=>x[key]).filter(Boolean))].sort();
    const mode=state.filters.dateMode||'';
    return `<div class="filters">
      <select id="fAccount"><option value="">All Accounts</option>${state.accounts.map(a=>`<option value="${a.id}" ${state.filters.account===a.id?'selected':''}>${esc(a.account_name)}</option>`).join('')}</select>
      <select id="fAssignee"><option value="">All VAs</option>${visibleTeam().map(m=>`<option value="${m.id}" ${state.filters.assignee===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select>
      <select id="fStatus"><option value="">All Status</option>${TASK_STATUSES.map(v=>`<option value="${v}" ${state.filters.status===v?'selected':''}>${v}</option>`).join('')}</select>
      <select id="fPriority"><option value="">All Priority</option>${TASK_PRIORITIES.map(v=>`<option value="${v}" ${state.filters.priority===v?'selected':''}>${v}</option>`).join('')}</select>
      <select id="fSource"><option value="">All Sources</option>${vals(state.tasks,'source').map(v=>`<option value="${esc(v)}" ${state.filters.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
      <select id="fDateMode"><option value="" ${mode===''?'selected':''}>All Dates</option><option value="today" ${mode==='today'?'selected':''}>Today</option><option value="yesterday" ${mode==='yesterday'?'selected':''}>Yesterday</option><option value="tomorrow" ${mode==='tomorrow'?'selected':''}>Tomorrow</option><option value="custom" ${mode==='custom'?'selected':''}>Select Date</option></select>
      ${mode==='custom'?`<input id="fDateCustom" type="date" value="${esc(state.filters.date||'')}" aria-label="Select task date">`:''}
    </div>`;
  }
  function filterTasks(input){
    const selectedDate=dateFromMode(state.filters.dateMode,state.filters.date);
    return input.filter(t=>{
      const a=accountById(t.account_id), m=memberById(t.assigned_to);
      return (!state.filters.account||t.account_id===state.filters.account)
        && (!state.filters.assignee||t.assigned_to===state.filters.assignee)
        && (!state.filters.status||normalizeTaskStatus(t.status)===state.filters.status)
        && (!state.filters.priority||t.priority===state.filters.priority)
        && (!state.filters.source||t.source===state.filters.source)
        && (!selectedDate||t.due_date===selectedDate)
        && matchesGlobal([t.title,t.description,t.source,normalizeTaskStatus(t.status),t.priority,a?.account_name,a?.client_name,m?.full_name]);
    }).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999') || String(a.title||'').localeCompare(String(b.title||'')));
  }

  function matchesGlobal(fields){ if(!state.search) return true; const q=state.search.toLowerCase(); return fields.some(v=>String(v||'').toLowerCase().includes(q)); }

  function taskTableCard(title,tasks,showFilters=false){
    return `<div class="card table-card"><div class="table-toolbar"><h3>${esc(title)}</h3>${showFilters?taskFilters():''}</div>${taskTable(tasks)}</div>`;
  }
  function taskTable(tasks){
    const rows=tasks.map((t,i)=>{
      const a=accountById(t.account_id);
      const m=memberById(t.assigned_to);
      const action = hasFullAccess() ? 'Edit' : (t.assigned_to===state.profile?.id ? 'Details' : 'View');
      const currentStatus=normalizeTaskStatus(t.status);
      const assigneeOptions=activeTeam().slice();
      if(m && !assigneeOptions.some(x=>x.id===m.id)) assigneeOptions.push(m);
      const sourceOptions=[...new Set([...TASK_SOURCES,t.source].filter(Boolean))];
      const assignedCell=hasFullAccess()
        ? `<div class="inline-assignee">${m?`<span class="avatar mini-avatar">${initials(m.full_name)}</span>`:''}<select class="inline-control" data-inline-task="${t.id}" data-inline-field="assigned_to"><option value="">Unassigned</option>${assigneeOptions.map(x=>`<option value="${x.id}" ${t.assigned_to===x.id?'selected':''}>${esc(x.full_name)}</option>`).join('')}</select></div>`
        : (m?`<span class="avatar mini-avatar">${initials(m.full_name)}</span>${esc(m.full_name)}`:'Unassigned');
      const sourceCell=hasFullAccess()?`<select class="inline-control" data-inline-task="${t.id}" data-inline-field="source">${sourceOptions.map(v=>`<option value="${esc(v)}" ${t.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:esc(t.source||'—');
      const priorityCell=hasFullAccess()?`<select class="inline-control priority-inline" data-inline-task="${t.id}" data-inline-field="priority">${TASK_PRIORITIES.map(v=>`<option value="${v}" ${t.priority===v?'selected':''}>${v}</option>`).join('')}</select>`:badge(t.priority);
      const dateCell=hasFullAccess()?`<input class="inline-control inline-date ${isOverdue(t)?'danger':''}" data-inline-task="${t.id}" data-inline-field="due_date" type="date" value="${esc(t.due_date||'')}">`:`<span class="${isOverdue(t)?'danger':''}">${fmtDate(t.due_date)}</span>`;
      const canInlineStatus=hasFullAccess() || (state.profile?.role==='va' && t.assigned_to===state.profile?.id);
      const statusCell=canInlineStatus?`<div class="inline-status-wrap"><select class="inline-control status-inline" data-inline-task="${t.id}" data-inline-field="status">${TASK_STATUSES.map(v=>`<option value="${v}" ${currentStatus===v?'selected':''}>${v}</option>`).join('')}</select>${isOverdue(t)?'<span class="small danger">Overdue</span>':''}</div>`:badge(displayStatus(t));
      return `<tr class="task-row ${taskStatusClass(t)}">
      <td>${i+1}</td><td><span class="link" data-open-task="${t.id}">${esc(t.title)}</span>${t.generated_by_recurrence?'<div class="small muted">Recurring occurrence</div>':''}</td><td>${a?`<span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span>`:'—'}</td><td>${a?.client_name?`<span class="link" data-view-client="${esc(a.client_name)}">${esc(a.client_name)}</span>`:'—'}</td><td>${assignedCell}</td><td>${sourceCell}</td><td>${priorityCell}</td><td>${dateCell}</td><td>${statusCell}</td><td><button class="btn small" data-open-task="${t.id}">${action}</button></td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Task</th><th>Account</th><th>Client</th><th>Assigned To</th><th>Source</th><th>Priority</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="empty">No tasks found</td></tr>'}</tbody></table></div>`;
  }

  function tasksPage(my=false){
    let base=state.tasks;
    if(my) base=base.filter(t=>t.assigned_to===state.profile?.id);
    const rows=filterTasks(base);
    const c=metricCounts(base);
    return `<div class="page-head"><div><h1>${my?'My Tasks':'Tasks'}</h1><p class="muted">${my?'View tasks assigned to you':(hasFullAccess()?'Manage all tasks across accounts':'View agency tasks')}</p></div>${hasFullAccess()?'<button class="btn primary" data-action="new-task">＋ Add Task</button>':''}</div>
      ${my?`<div class="grid kpi-grid" style="grid-template-columns:repeat(5,1fr)">${kpi('My Total Tasks',c.total,'blue')}${kpi('Completed',c.complete,'green')}${kpi('In Progress',c.progress,'blue')}${kpi('Not Started',c.notStarted,'amber')}${kpi('Overdue',c.overdue,'red')}</div>`:''}
      <div class="card table-card"><div class="table-toolbar">${taskFilters()}<div class="muted small">${rows.length} tasks</div></div>${taskTable(rows)}</div>`;
  }

  function teamPage(){
    const teamMembers=visibleTeam();
    const rows=teamMembers.filter(m=>matchesGlobal([m.full_name,m.email,m.role])).map((m,i)=>{
      const all=state.tasks.filter(t=>t.assigned_to===m.id), open=all.filter(t=>!isCompletedTask(t)).length, overdue=all.filter(isOverdue).length, completeToday=all.filter(t=>isCompletedTask(t) && (t.completed_at||'').slice(0,10)===today()).length;
      return `<tr><td>${i+1}</td><td><span class="avatar" style="display:inline-grid;width:28px;height:28px;font-size:10px;margin-right:7px">${initials(m.full_name)}</span><b>${esc(m.full_name||'Unnamed')}</b></td><td>${esc(m.email||'—')}</td><td>${badge(cap(m.role))}</td><td>${all.length}</td><td>${open}</td><td class="${overdue?'danger':''}">${overdue}</td><td>${completeToday}</td><td>${m.active?badge('Active'):badge('Paused')}</td>${canManageMember(m)?`<td><button class="btn small" data-edit-member="${m.id}">Edit</button></td>`:'<td>—</td>'}</tr>`;
    }).join('');
    const former=removedTeam().filter(m=>matchesGlobal([m.full_name,m.email,m.role]));
    const formerRows=former.map((m,i)=>`<tr><td>${i+1}</td><td><span class="avatar" style="display:inline-grid;width:28px;height:28px;font-size:10px;margin-right:7px">${initials(m.full_name)}</span><b>${esc(m.full_name||'Unnamed')}</b></td><td>${esc(m.email||'—')}</td><td>${badge(cap(m.role||'va'))}</td><td>${fmtNoteTime(m.removed_at)||'—'}</td><td>${canRestoreMember(m)?`<button class="btn primary small" data-restore-member="${m.id}">Restore Access</button> `:''}${isOwnerUser()?`<button class="btn red small" data-delete-member-record="${m.id}">Delete Record</button>`:''}</td></tr>`).join('');
    const formerCard=hasFullAccess()?`<div class="card table-card" style="margin-top:18px"><div class="table-toolbar"><div><h3>Former / Removed Team Members</h3><div class="muted small">Restore access, or let the Owner permanently delete the removed Firestore team record.</div></div><div class="muted small">${former.length} removed</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Removed</th><th>Actions</th></tr></thead><tbody>${formerRows||'<tr><td colspan="6" class="empty">No removed VAs</td></tr>'}</tbody></table></div></div>`:'';
    return `<div class="page-head"><div><h1>Team / VAs</h1><p class="muted">${hasFullAccess()?'Manage your team members and workload':'View team workload'}</p></div>${hasFullAccess()?'<button class="btn primary" data-action="invite-va">＋ New VA</button>':''}</div>
      <div class="card table-card"><div class="table-toolbar"><h3>Team Workload</h3><div class="muted small">${teamMembers.length} members</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Total Tasks</th><th>Open</th><th>Overdue</th><th>Completed Today</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="empty">No team members</td></tr>'}</tbody></table></div></div>${formerCard}`;
  }

  function calendarPage(){
    const monthKey=state.calendarMonth||today().slice(0,7); state.calendarMonth=monthKey;
    const [year,monthNumber]=monthKey.split('-').map(Number); const month=monthNumber-1;
    const first=new Date(year,month,1); const days=new Date(year,month+1,0).getDate(); const start=first.getDay();
    const cells=[]; for(let i=0;i<start;i++) cells.push('<div class="day day-empty"></div>');
    for(let day=1;day<=days;day++){
      const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const ts=state.tasks.filter(t=>t.due_date===iso);
      cells.push(`<div class="day calendar-day-click" data-calendar-date="${iso}" title="Open tasks for ${esc(fmtDate(iso))}"><div class="day-num">${day}</div>${ts.slice(0,4).map(t=>`<div class="cal-task ${taskStatusClass(t)}" data-open-task="${t.id}" title="${esc(t.title)}">${esc(t.title)}</div>`).join('')}${ts.length>4?`<div class="small muted calendar-more">+${ts.length-4} more</div>`:''}</div>`);
    }
    const monthLabel=new Date(year,month,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
    return `<div class="page-head"><div><h1>Calendar</h1><p class="muted">Click any date to review historical or upcoming tasks, then filter by user.</p></div>${hasFullAccess()?'<button class="btn primary" data-action="new-task">＋ Add Task</button>':''}</div><div class="card panel"><div class="calendar-title-row"><button class="btn" data-calendar-shift="-1">← Previous</button><h3>${esc(monthLabel)}</h3><button class="btn" data-calendar-shift="1">Next →</button></div><div class="calendar">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-head">${d}</div>`).join('')}${cells.join('')}</div></div>`;
  }

  function shiftCalendarMonth(delta){
    const key=state.calendarMonth||today().slice(0,7); const [y,m]=key.split('-').map(Number);
    const d=new Date(y,m-1+Number(delta),1,12,0,0,0); state.calendarMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; render();
  }

  function calendarDayModal(date, assignee=''){
    const all=state.tasks.filter(t=>t.due_date===date).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    const tasks=assignee==='__unassigned__'?all.filter(t=>!t.assigned_to):(assignee?all.filter(t=>t.assigned_to===assignee):all);
    const completed=tasks.filter(isCompletedTask).length, overdue=tasks.filter(isOverdue).length, awaiting=tasks.filter(t=>normalizeTaskStatus(t.status)==='Awaiting').length;
    modal(`Tasks — ${fmtDate(date)}`,`
      <div class="calendar-day-toolbar"><div class="field" style="margin:0"><label>User</label><select id="calendarUserFilter"><option value="">All Users</option><option value="__unassigned__" ${assignee==='__unassigned__'?'selected':''}>Unassigned</option>${visibleTeam().map(m=>`<option value="${m.id}" ${assignee===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select></div><div class="calendar-day-summary"><span>${tasks.length} assigned</span><span>${completed} completed</span><span>${awaiting} awaiting</span><span>${overdue} overdue</span></div></div>
      <div class="calendar-day-list">${tasks.map(t=>{const m=memberById(t.assigned_to),a=accountById(t.account_id);return `<button class="calendar-day-task ${taskStatusClass(t)}" data-calendar-open-task="${t.id}"><span><b>${esc(t.title)}</b><small>${esc(a?.account_name||'No account')} · ${esc(m?.full_name||'Unassigned')}</small></span><span>${badge(displayStatus(t))}</span></button>`;}).join('')||'<div class="empty">No tasks for this user on this date.</div>'}</div>
    `,'<button class="btn primary" id="closeCalendarDay">Close</button>');
    closeCalendarDay.onclick=closeModalFn;
    calendarUserFilter.onchange=e=>calendarDayModal(date,e.target.value);
    document.querySelectorAll('#modal-root [data-calendar-open-task]').forEach(x=>x.onclick=()=>openTask(state.tasks.find(t=>t.id===x.dataset.calendarOpenTask)));
  }

  function reportsPage(){
    const c=metricCounts();
    const byAccount=state.accounts.map(a=>{const ts=state.tasks.filter(t=>t.account_id===a.id);return {a,total:ts.length,complete:ts.filter(isCompletedTask).length,overdue:ts.filter(isOverdue).length}}).sort((x,y)=>y.total-x.total);
    const byPerson=visibleTeam().map(m=>{const ts=state.tasks.filter(t=>t.assigned_to===m.id);return {m,total:ts.length,complete:ts.filter(isCompletedTask).length,overdue:ts.filter(isOverdue).length}}).sort((x,y)=>y.total-x.total);
    return `<div class="page-head"><div><h1>Reports</h1><p class="muted">Agency task and workload insights</p></div></div>
      <div class="grid kpi-grid" style="grid-template-columns:repeat(4,1fr)">${kpi('Total Tasks',c.total,'blue')}${kpi('Completed',c.complete,'green')}${kpi('In Progress',c.progress,'blue')}${kpi('Overdue',c.overdue,'red')}</div>
      <div class="grid report-grid">
        <div class="card panel"><h3>Account Performance</h3><div class="metric-list">${byAccount.map(x=>`<div class="metric-item"><div><b>${esc(x.a.account_name)}</b><div class="small muted">${esc(x.a.client_name||'')}</div></div><div class="small">${x.complete}/${x.total} complete · <span class="${x.overdue?'danger':''}">${x.overdue} overdue</span></div></div>`).join('')||'<div class="empty">No data</div>'}</div></div>
        <div class="card panel"><h3>Team Performance</h3><div class="metric-list">${byPerson.map(x=>`<div class="metric-item"><div><b>${esc(x.m.full_name)}</b><div class="small muted">${esc(cap(x.m.role))}</div></div><div class="small">${x.complete}/${x.total} complete · <span class="${x.overdue?'danger':''}">${x.overdue} overdue</span></div></div>`).join('')||'<div class="empty">No data</div>'}</div></div>
      </div>`;
  }

  function settingsPage(){
    return `<div class="page-head"><div><h1>Settings</h1><p class="muted">Agency, profile and access settings</p></div></div>
      <div class="grid settings-grid">
        <div class="card panel"><h3>Profile</h3><div class="field"><label>Name</label><input id="setName" value="${esc(state.profile?.full_name||'')}"></div><div class="field"><label>Email</label><input value="${esc(state.profile?.email||state.user?.email||'')}" disabled></div><div class="field"><label>Role</label><input value="${esc(cap(state.profile?.role||''))}" disabled></div><button class="btn primary" data-action="save-profile">Save Profile</button></div>
        <div class="card panel"><h3>Agency</h3><div class="field"><label>Agency Name</label><input id="agencyName" value="${esc(state.agency?.name||'')}" ${hasFullAccess()?'':'disabled'}></div>${hasFullAccess()?`<div class="field"><label>Invite Code for VAs</label><div class="code-box">${esc(state.agency?.invite_code||'Not available')}</div></div><p class="small muted">Share the live dashboard URL plus this invite code. Each VA should use their own login.</p><button class="btn primary" data-action="save-agency">Save Agency</button>`:'<p class="small muted">Agency settings and invite codes are available to owners and managers.</p>'}</div>
        <div class="card panel"><h3>Data & Security</h3><p class="muted">${state.demo?'Demo data is currently saved in this browser only. Connect Firebase for real multi-user storage.':'Live data is stored in Firebase Firestore. Authentication is handled by Firebase Auth.'}</p><p class="small"><b>Do not store</b> Seller Central passwords, OTP codes, bank credentials, or private API secrets in task notes.</p></div>
        <div class="card panel"><h3>Session</h3>${state.demo?'<button class="btn red" data-action="reset-demo">Reset Demo Data</button>':'<button class="btn red" data-action="signout">Sign Out</button>'}</div>
      </div>`;
  }

  function render(){
    let content='';
    if(!state.demo && !state.user){ renderAuth(); return; }
    if(!state.demo && state.user && state.profile && (state.profile.removed===true || state.profile.active===false)){ renderAccessBlocked(); return; }
    if(!state.demo && state.user && state.profile && !state.profile.agency_id){ renderOnboarding(); return; }
    switch(state.route){
      case 'accounts':content=accountsPage();break;
      case 'tasks':content=tasksPage(false);break;
      case 'my-tasks':content=tasksPage(true);break;
      case 'team':content=teamPage();break;
      case 'calendar':content=calendarPage();break;
      case 'reports':content=reportsPage();break;
      case 'settings':content=settingsPage();break;
      default:content=dashboardPage();
    }
    app.innerHTML=shell(content);
    bindCommon();
  }

  function renderAccessBlocked(){
    const removed=state.profile?.removed===true;
    app.innerHTML=`<div class="auth-page"><div class="auth-card"><h1>${removed?'Agency access removed':'Agency access paused'}</h1><p class="muted">${removed?'The agency owner removed this login from the team. Ask the owner to restore your access from Team / VAs → Former / Removed Team Members.':'The agency owner paused this login.'} Once access is restored, use the button below to enter again with the same email and password.</p><button class="btn primary" style="width:100%;margin-top:10px" id="checkAccessAgain">Check Access Again</button><button class="btn" style="width:100%;margin-top:10px" id="blockedSignout">Sign Out</button></div></div>`;
    document.getElementById('checkAccessAgain').onclick=async()=>{ await loadData(); };
    document.getElementById('blockedSignout').onclick=()=>sb.auth.signOut();
  }

  function renderAuth(){
    app.innerHTML=`<div class="auth-page"><div class="auth-card"><h1>${esc(cfg.APP_NAME||'Amazon Account Task Manager')}</h1><p class="muted">Sign in to manage accounts, tasks and your VA team.</p><form id="authForm"><div class="field"><label>Email</label><input id="authEmail" type="email" autocomplete="email" required></div><div class="field"><label>Password</label><div class="password-wrap"><input id="authPassword" type="password" minlength="6" autocomplete="current-password" required><button class="password-toggle" type="button" id="toggleAuthPassword" aria-label="Show password">Show</button></div></div><button class="btn primary" style="width:100%" type="submit">Sign In</button></form><div class="auth-actions"><button class="text-btn" type="button" id="forgotPasswordBtn">Forgot Password?</button></div><button class="btn" style="width:100%;margin-top:8px" id="signupBtn">Create Account</button><div id="authMsg" class="small muted" style="margin-top:12px"></div></div></div>`;
    const emailEl=document.getElementById('authEmail'), passwordEl=document.getElementById('authPassword'), msg=document.getElementById('authMsg');
    document.getElementById('authForm').onsubmit=async e=>{e.preventDefault(); const email=emailEl.value.trim(), password=passwordEl.value; const {error}=await sb.auth.signInWithPassword({email,password}); msg.textContent=error?error.message:'Signed in';};
    document.getElementById('toggleAuthPassword').onclick=()=>{const show=passwordEl.type==='password';passwordEl.type=show?'text':'password';toggleAuthPassword.textContent=show?'Hide':'Show';toggleAuthPassword.setAttribute('aria-label',show?'Hide password':'Show password');};
    document.getElementById('forgotPasswordBtn').onclick=async()=>{const email=emailEl.value.trim();if(!email){msg.textContent='Enter your email first, then click Forgot Password.';emailEl.focus();return;}const {error}=await sb.auth.resetPasswordForEmail(email);msg.textContent=error?error.message:`Password reset email sent to ${email}. Check your inbox and spam folder.`;};
    document.getElementById('signupBtn').onclick=async()=>{ const email=emailEl.value.trim(), password=passwordEl.value; if(!email||password.length<6){msg.textContent='Enter email and a password of at least 6 characters.';return;} const full_name=prompt('Your full name?')||''; const {error}=await sb.auth.signUp({email,password,options:{data:{full_name}}}); msg.textContent=error?error.message:'Account created. Check your email if confirmation is enabled, then sign in.'; };
  }

  function renderOnboarding(){
    app.innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Set up your agency</h1><p class="muted">Create a new agency as owner, or join your agency using an invite code.</p><div class="field"><label>Create Agency</label><input id="newAgency" placeholder="e.g. Apex Amazon Agency"></div><button class="btn primary" style="width:100%" id="createAgencyBtn">Create Agency</button><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><div class="field"><label>Join with Invite Code</label><input id="joinCode" placeholder="Invite code from agency owner"></div><button class="btn" style="width:100%" id="joinAgencyBtn">Join Agency</button><div id="onboardMsg" class="small muted" style="margin-top:12px"></div><button class="btn" style="width:100%;margin-top:16px" id="logoutOnboard">Sign Out</button></div></div>`;
    createAgencyBtn.onclick=async()=>{const name=newAgency.value.trim();if(!name)return;const {error}=await sb.rpc('create_agency',{p_name:name});onboardMsg.textContent=error?error.message:'Agency created';if(!error)await loadData();};
    joinAgencyBtn.onclick=async()=>{const code=joinCode.value.trim();if(!code)return;const {error}=await sb.rpc('join_agency',{p_invite_code:code});onboardMsg.textContent=error?error.message:'Joined agency';if(!error)await loadData();};
    logoutOnboard.onclick=()=>sb.auth.signOut();
  }

  function bindCommon(){
    const gs=document.getElementById('globalSearch'); if(gs) gs.oninput=e=>{state.search=e.target.value; render(); setTimeout(()=>document.getElementById('globalSearch')?.focus(),0);};
    document.querySelectorAll('[data-action="new-task"]').forEach(x=>x.onclick=()=>taskModal());
    document.querySelectorAll('[data-action="new-account"]').forEach(x=>x.onclick=()=>accountModal());
    document.querySelectorAll('[data-action="invite-va"]').forEach(x=>x.onclick=()=>inviteModal());
    document.querySelectorAll('[data-open-task]').forEach(x=>x.onclick=e=>{e.stopPropagation();openTask(state.tasks.find(t=>t.id===x.dataset.openTask));});
    document.querySelectorAll('[data-edit-task]').forEach(x=>x.onclick=e=>{e.stopPropagation();openTask(state.tasks.find(t=>t.id===x.dataset.editTask));});
    document.querySelectorAll('[data-edit-account]').forEach(x=>x.onclick=()=>accountModal(state.accounts.find(a=>a.id===x.dataset.editAccount)));
    document.querySelectorAll('[data-login-access]').forEach(x=>x.onclick=()=>accountLoginAccessModal(state.accounts.find(a=>a.id===x.dataset.loginAccess)));
    document.querySelectorAll('[data-view-client]').forEach(x=>x.onclick=e=>{e.stopPropagation(); const name=x.dataset.viewClient||''; if(name) location.hash='#/accounts?client='+encodeURIComponent(name);});
    document.querySelector('[data-back-clients]')?.addEventListener('click',()=>{location.hash='#/accounts';});
    const clientJump=document.getElementById('clientJump'); if(clientJump) clientJump.onchange=e=>{const name=e.target.value; location.hash=name?'#/accounts?client='+encodeURIComponent(name):'#/accounts';};
    document.querySelectorAll('[data-open-account]').forEach(x=>x.onclick=e=>{e.stopPropagation();state.filters.account=x.dataset.openAccount; location.hash='#/tasks';});
    document.querySelectorAll('[data-account-tasks]').forEach(x=>x.onclick=()=>{state.filters.account=x.dataset.accountTasks; location.hash='#/tasks';});
    document.querySelectorAll('[data-edit-member]').forEach(x=>x.onclick=()=>memberModal(state.team.find(m=>m.id===x.dataset.editMember)));
    document.querySelectorAll('[data-restore-member]').forEach(x=>x.onclick=()=>restoreMemberData(state.team.find(m=>m.id===x.dataset.restoreMember)));
    document.querySelectorAll('[data-delete-member-record]').forEach(x=>x.onclick=()=>deleteRemovedMemberRecord(state.team.find(m=>m.id===x.dataset.deleteMemberRecord)));
    ['fAccount','fAssignee','fStatus','fPriority','fSource'].forEach(id=>{const el=document.getElementById(id); if(el)el.onchange=e=>{const key={fAccount:'account',fAssignee:'assignee',fStatus:'status',fPriority:'priority',fSource:'source'}[id];state.filters[key]=e.target.value;render();};});
    const fDateMode=document.getElementById('fDateMode'); if(fDateMode)fDateMode.onchange=e=>{state.filters.dateMode=e.target.value;if(e.target.value!=='custom')state.filters.date='';render();};
    const fDateCustom=document.getElementById('fDateCustom'); if(fDateCustom)fDateCustom.onchange=e=>{state.filters.date=e.target.value;render();};
    document.querySelectorAll('[data-inline-task]').forEach(el=>el.onchange=e=>{e.stopPropagation();inlineUpdateTask(el.dataset.inlineTask,el.dataset.inlineField,el.value);});
    document.querySelectorAll('[data-calendar-shift]').forEach(x=>x.onclick=()=>shiftCalendarMonth(Number(x.dataset.calendarShift||0)));
    document.querySelectorAll('[data-calendar-date]').forEach(x=>x.onclick=e=>{if(e.target.closest('[data-open-task]'))return;calendarDayModal(x.dataset.calendarDate);});
    document.querySelectorAll('[data-va-dashboard]').forEach(x=>x.onclick=()=>{state.dashboardMemberId=x.dataset.vaDashboard;state.dashboardMemberDateMode=state.dashboardMemberDateMode||'today';render();});
    document.querySelector('[data-va-dashboard-close]')?.addEventListener('click',()=>{state.dashboardMemberId='';render();});
    const vaDateMode=document.getElementById('vaDateMode'); if(vaDateMode)vaDateMode.onchange=e=>{state.dashboardMemberDateMode=e.target.value;if(e.target.value!=='custom')state.dashboardMemberDate='';render();};
    const vaCustomDate=document.getElementById('vaCustomDate'); if(vaCustomDate)vaCustomDate.onchange=e=>{state.dashboardMemberDate=e.target.value;render();};
    document.querySelector('[data-action="save-profile"]')?.addEventListener('click',saveProfile);
    document.querySelector('[data-action="save-agency"]')?.addEventListener('click',saveAgency);
    document.querySelector('[data-action="signout"]')?.addEventListener('click',()=>sb.auth.signOut());
    document.querySelector('[data-action="reset-demo"]')?.addEventListener('click',()=>{if(confirm('Reset all demo data?')){localStorage.removeItem('amazon-agency-demo-v2');location.reload();}});
  }

  async function inlineUpdateTask(id, field, rawValue){
    const t=state.tasks.find(x=>x.id===id); if(!t)return;
    const statusOnly=field==='status';
    if(!hasFullAccess() && !(statusOnly && state.profile?.role==='va' && t.assigned_to===state.profile?.id)){toast('You do not have permission to change this field.');render();return;}
    let value=rawValue;
    if(['assigned_to','due_date'].includes(field) && value==='') value=null;
    if(field==='status') value=normalizeTaskStatus(value);
    if(state.demo){
      const patch={[field]:value};
      if(field==='status') patch.completed_at=value==='Completed'?(t.completed_at||new Date().toISOString()):null;
      Object.assign(t,patch); if(field==='status' && value==='Completed')ensureNextRecurringDemo(t); persistDemo();render();toast('Task updated');return;
    }
    if(field==='status' && !hasFullAccess()){
      const {error}=await sb.rpc('update_my_task_status',{p_task_id:id,p_status:value});
      if(error){toast(error.message);render();return;} await loadData();toast(value==='Completed'?'Task completed':'Task status updated');return;
    }
    const patch={[field]:value};
    if(field==='status') patch.completed_at=value==='Completed'?(t.completed_at||new Date().toISOString()):null;
    const {error}=await sb.from('tasks').update(patch).eq('id',id);
    if(error){toast(error.message);render();return;}
    let recurrenceError=null;
    if(field==='status' && value==='Completed' && t.recurring){const next=await sb.rpc('ensure_next_recurrence',{p_task_id:id});recurrenceError=next.error;}
    await loadData();toast(recurrenceError?`Task updated, but next recurring task was not created: ${recurrenceError.message}`:'Task updated');
  }

  function modal(title, body, foot=''){
    modalRoot.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h3 style="margin:0">${esc(title)}</h3><button class="icon-btn" id="closeModal">×</button></div><div class="modal-body">${body}</div>${foot?`<div class="modal-foot">${foot}</div>`:''}</div></div>`;
    closeModal.onclick=closeModalFn; backdrop.onclick=e=>{if(e.target===backdrop)closeModalFn();};
  }
  function closeModalFn(){ modalRoot.innerHTML=''; }

  function openTask(t){
    if(!t)return;
    if(hasFullAccess()) return taskModal(t);
    if(t.assigned_to===state.profile?.id) return vaTaskStatusModal(t);
    return taskViewModal(t);
  }

  function fmtNoteTime(v){
    if(!v) return '';
    const d=new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function taskNotesSection(t, canAdd=true){
    return `
      <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px"><div><b>Task Updates / Notes</b><div class="small muted">Append-only notes between agency leadership and the VA assigned to this task.</div></div></div>
        <div id="taskNotesList" class="small muted" style="min-height:44px">Loading notes...</div>
        ${canAdd?`<div class="field" style="margin-top:12px"><label>Add Note</label><textarea id="taskNoteInput" rows="3" maxlength="2000" placeholder="e.g. Need client access, issue found, work completed, approval required..."></textarea></div><button class="btn" id="addTaskNoteBtn" type="button">＋ Add Note</button>`:''}
      </div>`;
  }

  async function loadTaskNotes(t){
    const box=document.getElementById('taskNotesList');
    if(!box||!t?.id)return;
    if(state.demo){
      const notes=t.task_notes||[];
      box.innerHTML=notes.length?notes.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(n=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>${esc(n.author_name||'User')}</b> <span class="muted">· ${esc(fmtNoteTime(n.created_at))}</span></div><div style="margin-top:4px;white-space:pre-wrap">${esc(n.note||'')}</div></div>`).join(''):'<div class="muted">No notes yet.</div>';
      return;
    }
    const {data,error}=await sb.rpc('get_task_notes',{p_task_id:t.id});
    if(error){box.innerHTML=`<div class="danger">${esc(error.message)}</div>`;return;}
    const notes=data||[];
    box.innerHTML=notes.length?notes.map(n=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>${esc(n.author_name||'User')}</b> <span class="muted">· ${esc(fmtNoteTime(n.created_at))}</span></div><div style="margin-top:4px;white-space:pre-wrap">${esc(n.note||'')}</div></div>`).join(''):'<div class="muted">No notes yet.</div>';
  }

  async function addTaskNote(t){
    const input=document.getElementById('taskNoteInput');
    const note=(input?.value||'').trim();
    if(!note){toast('Write a note first.');return;}
    if(note.length>2000){toast('Note is too long. Maximum 2000 characters.');return;}
    if(state.demo){
      t.task_notes=t.task_notes||[];
      t.task_notes.push({id:'n'+Date.now(),note,author_id:state.profile?.id,author_name:state.profile?.full_name||'User',created_at:new Date().toISOString()});
      persistDemo(); input.value=''; await loadTaskNotes(t); toast('Note added'); return;
    }
    const {error}=await sb.rpc('add_task_note',{p_task_id:t.id,p_note:note});
    if(error){toast(error.message);return;}
    input.value=''; await loadTaskNotes(t); toast('Note added');
  }

  function taskViewModal(t){
    const a=accountById(t.account_id), m=memberById(t.assigned_to);
    modal('Task Details',`
      <div class="field"><label>Task</label><input value="${esc(t.title||'')}" disabled></div>
      <div class="two"><div class="field"><label>Account</label><input value="${esc(a?.account_name||'—')}" disabled></div><div class="field"><label>Assigned To</label><input value="${esc(m?.full_name||'Unassigned')}" disabled></div></div>
      <div class="two"><div class="field"><label>Status</label><input value="${esc(t.status||'')}" disabled></div><div class="field"><label>Priority</label><input value="${esc(t.priority||'')}" disabled></div></div>
      <div class="two"><div class="field"><label>Due Date</label><input value="${esc(fmtDate(t.due_date))}" disabled></div><div class="field"><label>Source</label><input value="${esc(t.source||'—')}" disabled></div></div>
      <div class="field"><label>Notes / Description</label><textarea rows="4" disabled>${esc(t.description||'')}</textarea></div>
    `,'<button class="btn primary" id="closeTaskView">Close</button>');
    closeTaskView.onclick=closeModalFn;
  }

  function vaTaskStatusModal(t){
    const a=accountById(t.account_id);
    modal('Update Task',`
      <div class="field"><label>Task</label><input value="${esc(t.title||'')}" disabled></div>
      <div class="two"><div class="field"><label>Account</label><input value="${esc(a?.account_name||'—')}" disabled></div><div class="field"><label>Due Date</label><input value="${esc(fmtDate(t.due_date))}" disabled></div></div>
      <div class="field"><label>Owner Instructions / Description</label><textarea rows="4" disabled>${esc(t.description||'')}</textarea></div>
      <div class="field"><label>Status</label><select id="vaTaskStatus">${TASK_STATUSES.map(v=>`<option ${normalizeTaskStatus(t.status)===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <p class="small muted">You can update the status and add notes on tasks assigned to you. Other task fields remain controlled by an Owner or Manager.</p>
      ${taskNotesSection(t,true)}
    `,'<button class="btn" id="cancelVaTask">Cancel</button><button class="btn primary" id="saveVaTask">Save Status</button>');
    cancelVaTask.onclick=closeModalFn;
    saveVaTask.onclick=()=>saveVaTaskStatus(t);
    addTaskNoteBtn.onclick=()=>addTaskNote(t);
    loadTaskNotes(t);
  }

  async function saveVaTaskStatus(t){
    if(!t || t.assigned_to!==state.profile?.id){ toast('This task is not assigned to your login.'); return; }
    const status=normalizeTaskStatus(vaTaskStatus.value);
    if(state.demo){t.status=status;t.completed_at=status==='Completed'?(t.completed_at||new Date().toISOString()):null;if(status==='Completed')ensureNextRecurringDemo(t);persistDemo();closeModalFn();render();toast(status==='Completed'?'Task marked completed':'Task status updated');return;}
    const {error}=await sb.rpc('update_my_task_status',{p_task_id:t.id,p_status:status});
    if(error){ toast(error.message); return; }
    closeModalFn(); await loadData(); toast(status==='Completed'?'Task marked completed. Next recurring task created when applicable.':'Task status updated');
  }

  function taskModal(t=null){
    if(!hasFullAccess()){ if(t) return openTask(t); toast('Only an owner or manager can create tasks.'); return; }
    const edit=!!t; const x=t||{title:'',account_id:state.filters.account||'',assigned_to:'',received_by:state.profile?.id||'',source:'Internal',status:'Not Started',priority:'Medium',due_date:today(),description:'',recurring:false,recurrence:''};
    const currentStatus=normalizeTaskStatus(x.status);
    modal(edit?'Edit Task':'New Task',`<form id="taskForm">
      <div class="field"><label>Task</label><input id="taskTitle" value="${esc(x.title)}" required placeholder="e.g. PPC campaign optimization"></div>
      <div class="two"><div class="field"><label>Account</label><select id="taskAccount" required><option value="">Select account</option>${state.accounts.map(a=>`<option value="${a.id}" ${x.account_id===a.id?'selected':''}>${esc(a.account_name)} — ${esc(a.client_name||'')}</option>`).join('')}</select></div><div class="field"><label>Assigned To</label><select id="taskAssignee"><option value="">Unassigned</option>${activeTeam().map(m=>`<option value="${m.id}" ${x.assigned_to===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Task Source</label><select id="taskSource">${[...new Set([...TASK_SOURCES,x.source].filter(Boolean))].map(v=>`<option value="${esc(v)}" ${x.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="field"><label>Assigned By</label><select id="taskReceived"><option value="">Not set</option>${activeTeam().map(m=>`<option value="${m.id}" ${x.received_by===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Status</label><select id="taskStatus">${TASK_STATUSES.map(v=>`<option value="${v}" ${currentStatus===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Priority</label><select id="taskPriority">${TASK_PRIORITIES.map(v=>`<option value="${v}" ${x.priority===v?'selected':''}>${v}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Due Date</label><input id="taskDue" type="date" value="${esc(x.due_date||'')}"></div><div class="field"><label>Recurring</label><select id="taskRecurring"><option value="false" ${!x.recurring?'selected':''}>No</option><option value="true" ${x.recurring?'selected':''}>Yes</option></select></div></div>
      <div class="field"><label>Recurrence</label><select id="taskRecurrence"><option value="">None</option>${['Daily','Weekly','Monthly'].map(v=>`<option value="${v}" ${x.recurrence===v?'selected':''}>${v}</option>`).join('')}</select><div class="small muted">When a recurring task is completed, this occurrence stays in history and a new Not Started occurrence is created with the next due date.</div></div>
      <div class="field"><label>Notes / Description</label><textarea id="taskDescription" rows="4" placeholder="Details, client request, links...">${esc(x.description||'')}</textarea></div>
      ${edit?taskNotesSection(t,true):''}
    </form>`,`${edit?'<button class="btn red" id="deleteTask">Delete</button>':''}<button class="btn" id="cancelTask">Cancel</button><button class="btn primary" id="saveTask">${edit?'Save Changes':'Create Task'}</button>`);
    cancelTask.onclick=closeModalFn; saveTask.onclick=()=>saveTaskData(t?.id); if(edit)deleteTask.onclick=()=>deleteTaskData(t.id);
    if(edit){ addTaskNoteBtn.onclick=()=>addTaskNote(t); loadTaskNotes(t); }
  }

  async function saveTaskData(id){
    const data={
      account_id:taskAccount.value||null,title:taskTitle.value.trim(),assigned_to:taskAssignee.value||null,received_by:taskReceived.value||null,source:taskSource.value,status:normalizeTaskStatus(taskStatus.value),priority:taskPriority.value,due_date:taskDue.value||null,recurring:taskRecurring.value==='true',recurrence:taskRecurrence.value||null,description:taskDescription.value.trim()
    };
    if(!data.title||!data.account_id){toast('Task and account are required');return;}
    if(data.recurring && !data.recurrence){toast('Choose Daily, Weekly, or Monthly recurrence.');return;}
    if(!data.recurring)data.recurrence=null;
    if(state.demo){
      let saved;
      if(id){const i=state.tasks.findIndex(t=>t.id===id);state.tasks[i]={...state.tasks[i],...data,completed_at:data.status==='Completed'?(state.tasks[i].completed_at||new Date().toISOString()):null};saved=state.tasks[i];}
      else {saved={id:'t'+Date.now(),...data,created_at:new Date().toISOString(),completed_at:data.status==='Completed'?new Date().toISOString():null};state.tasks.push(saved);}
      if(data.status==='Completed' && data.recurring)ensureNextRecurringDemo(saved);
      persistDemo();closeModalFn();render();toast('Task saved');return;
    }
    if(!hasFullAccess()){toast('Only an owner or manager can create or fully edit tasks.');return;}
    data.agency_id=state.profile.agency_id;
    const existing=id?state.tasks.find(t=>t.id===id):null;
    data.completed_at=data.status==='Completed'?(existing?.completed_at||new Date().toISOString()):null;
    if(!id) data.created_by=state.user.id;
    const res=id?await sb.from('tasks').update(data).eq('id',id):await sb.from('tasks').insert(data);
    if(res.error){toast(res.error.message);return;}
    const savedId=id || res.data?.[0]?.id;
    let recurrenceError=null;
    if(savedId && data.status==='Completed' && data.recurring){const next=await sb.rpc('ensure_next_recurrence',{p_task_id:savedId});recurrenceError=next.error;}
    closeModalFn();await loadData();toast(recurrenceError?`Task saved, but next recurring task was not created: ${recurrenceError.message}`:'Task saved');
  }

  async function deleteTaskData(id){ if(!hasFullAccess()){toast('Only an owner or manager can delete tasks.');return;} if(!confirm('Delete this task?'))return; if(state.demo){state.tasks=state.tasks.filter(t=>t.id!==id);persistDemo();closeModalFn();render();return;} const {error}=await sb.from('tasks').delete().eq('id',id); if(error)toast(error.message);else{closeModalFn();await loadData();} }

  function accountModal(a=null){
    if(!hasFullAccess()){toast('Only an owner or manager can create or edit accounts.');return;}
    const edit=!!a; const x=a||{account_name:'',client_name:'',marketplace:'Amazon US',status:'Active',notes:''};
    modal(edit?'Edit Account':'New Account',`<div class="field"><label>Account Name</label><input id="accName" value="${esc(x.account_name)}" placeholder="Amazon account / brand name"></div><div class="field"><label>Client Name</label><input id="accClient" value="${esc(x.client_name||'')}"></div><div class="two"><div class="field"><label>Marketplace</label><select id="accMarket">${['Amazon US','Amazon UK','Amazon CA','Amazon DE','Amazon AU','Amazon UAE','Amazon KSA','Other'].map(v=>`<option ${x.marketplace===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="accStatus">${['Active','Onboarding','Paused','Closed'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="field"><label>Notes</label><textarea id="accNotes" rows="4">${esc(x.notes||'')}</textarea></div>`,`${edit?'<button class="btn red" id="deleteAccount">Delete</button>':''}<button class="btn" id="cancelAccount">Cancel</button><button class="btn primary" id="saveAccount">${edit?'Save Changes':'Create Account'}</button>`);
    cancelAccount.onclick=closeModalFn; saveAccount.onclick=()=>saveAccountData(a?.id); if(edit)deleteAccount.onclick=()=>deleteAccountData(a.id);
  }
  async function saveAccountData(id){ const data={account_name:accName.value.trim(),client_name:accClient.value.trim(),marketplace:accMarket.value,status:accStatus.value,notes:accNotes.value.trim()}; if(!data.account_name){toast('Account name is required');return;} if(state.demo){if(id){const i=state.accounts.findIndex(a=>a.id===id);state.accounts[i]={...state.accounts[i],...data};}else state.accounts.push({id:'a'+Date.now(),...data});persistDemo();closeModalFn();render();toast('Account saved');return;} if(!hasFullAccess()){toast('Only an owner or manager can create or edit accounts.');return;}data.agency_id=state.profile.agency_id;if(!id)data.created_by=state.user.id;const res=id?await sb.from('accounts').update(data).eq('id',id):await sb.from('accounts').insert(data);if(res.error)toast(res.error.message);else{closeModalFn();await loadData();toast('Account saved');} }
  async function deleteAccountData(id){ if(!hasFullAccess()){toast('Only an owner or manager can delete accounts.');return;} if(state.tasks.some(t=>t.account_id===id)&&!confirm('This account has tasks. Delete account anyway? Tasks will remain without an account.'))return;if(!confirm('Delete this account?'))return;if(state.demo){state.accounts=state.accounts.filter(a=>a.id!==id);state.tasks=state.tasks.map(t=>t.account_id===id?{...t,account_id:null}:t);persistDemo();closeModalFn();render();return;}const credRes=await sb.rpc('delete_account_login_access',{p_account_id:id});if(credRes.error){toast(credRes.error.message);return;}const {error}=await sb.from('accounts').delete().eq('id',id);if(error)toast(error.message);else{closeModalFn();await loadData();} }

  async function accountLoginAccessModal(a){
    if(!hasFullAccess()){toast('Account Login Access is available to Owners and Managers only.');return;}
    if(!a)return;
    let saved=null;
    if(state.demo){ saved=a.login_access||null; }
    else {
      const {data,error}=await sb.rpc('get_account_login_access',{p_account_id:a.id});
      if(error){toast(error.message);return;}
      saved=data||null;
    }
    modal('Account Login Access',`<div class="small muted" style="margin-bottom:12px">Owner / Manager only. VAs cannot see or read this feature.</div>
      <div class="field"><label>Account Name</label><input value="${esc(a.account_name)}" disabled></div>
      <div class="field"><label>Login Email / Username</label><input id="accountLoginName" value="${esc(saved?.login_name||'')}" placeholder="Seller Central login email / username"></div>
      <div class="field"><label>Password</label><div style="display:flex;gap:8px"><input id="accountLoginPassword" type="password" value="${esc(saved?.password||'')}" placeholder="Account password" style="flex:1"><button class="btn" type="button" id="toggleAccountPassword">Show</button></div></div>
      <div class="small muted">This password is protected from VAs by Firestore rules, but it is still stored in your Firebase database. A dedicated password manager is safer for highly sensitive credentials.</div>`,
      `${saved?'<button class="btn red" id="clearAccountLogin">Delete Saved Access</button>':''}<button class="btn" id="cancelAccountLogin">Cancel</button><button class="btn primary" id="saveAccountLogin">Save Login Access</button>`);
    cancelAccountLogin.onclick=closeModalFn;
    toggleAccountPassword.onclick=()=>{const input=document.getElementById('accountLoginPassword');const show=input.type==='password';input.type=show?'text':'password';toggleAccountPassword.textContent=show?'Hide':'Show';};
    saveAccountLogin.onclick=async()=>{
      const login_name=accountLoginName.value.trim(), password=accountLoginPassword.value;
      if(!password){toast('Password is required.');return;}
      if(state.demo){a.login_access={login_name,password};persistDemo();closeModalFn();toast('Login access saved');return;}
      const {error}=await sb.rpc('save_account_login_access',{p_account_id:a.id,p_login_name:login_name,p_password:password});
      if(error)toast(error.message);else{closeModalFn();toast('Login access saved');}
    };
    if(saved) clearAccountLogin.onclick=async()=>{
      if(!confirm(`Delete saved login access for ${a.account_name}?`))return;
      if(state.demo){delete a.login_access;persistDemo();closeModalFn();toast('Saved login access deleted');return;}
      const {error}=await sb.rpc('delete_account_login_access',{p_account_id:a.id});
      if(error)toast(error.message);else{closeModalFn();toast('Saved login access deleted');}
    };
  }

  function inviteModal(){
    if(!hasFullAccess()){toast('Only an owner or manager can invite VAs.');return;}
    modal('Add / Invite VA', state.demo?`<p>In Demo Mode, add a sample team member below.</p><div class="field"><label>Name</label><input id="newMemberName" placeholder="VA name"></div><div class="field"><label>Email</label><input id="newMemberEmail" type="email" placeholder="va@example.com"></div>`:`<p>Share your live dashboard URL with the VA. They should create their own account and then choose <b>Join Agency</b>.</p><div class="field"><label>Your Agency Invite Code</label><div class="code-box">${esc(state.agency?.invite_code||'')}</div></div><p class="small muted">This avoids sharing passwords. Each person gets their own login.</p>`, state.demo?'<button class="btn" id="cancelInvite">Cancel</button><button class="btn primary" id="saveInvite">Add VA</button>':'<button class="btn primary" id="cancelInvite">Done</button>');
    cancelInvite.onclick=closeModalFn;
    if(state.demo)saveInvite.onclick=()=>{const name=newMemberName.value.trim(),email=newMemberEmail.value.trim();if(!name)return;state.team.push({id:'m'+Date.now(),agency_id:'demo-agency',full_name:name,email,role:'va',active:true});persistDemo();closeModalFn();render();toast('VA added');};
  }

  function memberModal(m){
    if(!m)return;
    if(!canManageMember(m)){toast('You do not have permission to manage this team member.');return;}
    const isAgencyOwner=m.id===state.agency?.owner_id || m.role==='owner';
    const ownerCanSetRole=isOwnerUser() && !isAgencyOwner;
    const roleField=isAgencyOwner
      ? `<div class="field"><label>Role</label><input value="Owner" disabled></div>`
      : ownerCanSetRole
        ? `<div class="field"><label>Role</label><select id="memberRole">${['manager','va'].map(v=>`<option value="${v}" ${m.role===v?'selected':''}>${cap(v)}</option>`).join('')}</select><div class="small muted" style="margin-top:6px">Managers have full operational access. Only the Owner can grant or remove the Manager role.</div></div>`
        : `<div class="field"><label>Role</label><input id="memberRole" value="VA" data-role-value="va" disabled><div class="small muted" style="margin-top:6px">Managers can manage VAs, but only the Owner can change roles.</div></div>`;
    const statusField=isAgencyOwner
      ? `<div class="field"><label>Status</label><input value="Active" disabled></div>`
      : `<div class="field"><label>Status</label><select id="memberActive"><option value="true" ${m.active!==false?'selected':''}>Active</option><option value="false" ${m.active===false?'selected':''}>Paused</option></select></div>`;
    const removeBtn=canRemoveMember(m)?`<button class="btn red" id="removeMember">Remove ${m.role==='manager'?'Manager':'VA'}</button>`:'';
    modal('Edit Team Member',`<div class="field"><label>Name</label><input id="memberName" value="${esc(m.full_name||'')}"></div><div class="field"><label>Email</label><input value="${esc(m.email||'')}" disabled></div>${roleField}${statusField}`,`${removeBtn}<button class="btn" id="cancelMember">Cancel</button><button class="btn primary" id="saveMember">Save</button>`);
    cancelMember.onclick=closeModalFn;
    saveMember.onclick=()=>saveMemberData(m.id,isAgencyOwner,m.role);
    if(canRemoveMember(m)) removeMember.onclick=()=>removeMemberData(m);
  }

  async function saveMemberData(id,isAgencyOwner=false,currentRole='va'){
    const roleValue=isAgencyOwner?'owner':(isOwnerUser()?memberRole.value:currentRole);
    const data={
      full_name:memberName.value.trim(),
      role:roleValue,
      active:isAgencyOwner?true:memberActive.value==='true'
    };
    if(state.demo){
      const i=state.team.findIndex(m=>m.id===id);
      state.team[i]={...state.team[i],...data};
      if(state.profile.id===id)state.profile=state.team[i];
      persistDemo();closeModalFn();render();return;
    }
    const {error}=await sb.rpc('owner_update_member',{p_member_id:id,p_full_name:data.full_name,p_role:data.role,p_active:data.active});
    if(error)toast(error.message);else{closeModalFn();await loadData();toast('Team member updated');}
  }

  async function removeMemberData(m){
    if(!canRemoveMember(m)){toast('You do not have permission to remove this team member.');return;}
    if(!m || m.id===state.agency?.owner_id || m.role==='owner'){toast('The agency owner cannot be removed.');return;}
    const openCount=state.tasks.filter(t=>t.assigned_to===m.id && !isCompletedTask(t)).length;
    const message=openCount
      ? `Remove ${m.full_name||'this team member'} from the agency? ${openCount} open task${openCount===1?'':'s'} will be unassigned. Completed task history and notes will be kept.`
      : `Remove ${m.full_name||'this team member'} from the agency? Their access will be revoked immediately. Completed task history and notes will be kept.`;
    if(!confirm(message))return;
    if(state.demo){
      const i=state.team.findIndex(x=>x.id===m.id);
      if(i>=0)state.team[i]={...state.team[i],active:false,removed:true,removed_at:new Date().toISOString(),removed_by:state.profile.id};
      state.tasks=state.tasks.map(t=>(t.assigned_to===m.id && !isCompletedTask(t))?{...t,assigned_to:null}:t);
      persistDemo();closeModalFn();render();toast('Team member removed');return;
    }
    const {error}=await sb.rpc('owner_remove_member',{p_member_id:m.id});
    if(error)toast(error.message);else{closeModalFn();await loadData();toast('Team member removed and access revoked');}
  }

  async function restoreMemberData(m){
    if(!canRestoreMember(m)){toast('You do not have permission to restore this team member.');return;}
    if(!m || m.role==='owner' || m.id===state.agency?.owner_id){toast('This account cannot be restored here.');return;}
    if(m.removed!==true){toast('This team member already has agency access.');return;}
    if(!confirm(`Restore agency access for ${m.full_name||m.email||'this team member'}? They can sign in again with the same email and password. Previously unassigned tasks will stay unassigned until you assign them again.`))return;
    if(state.demo){
      const i=state.team.findIndex(x=>x.id===m.id);
      if(i>=0)state.team[i]={...state.team[i],active:true,removed:false,restored_at:new Date().toISOString(),restored_by:state.profile.id};
      persistDemo();render();toast('Team member access restored');return;
    }
    const {error}=await sb.rpc('owner_restore_member',{p_member_id:m.id});
    if(error)toast(error.message);else{await loadData();toast('Team member access restored. They can use the same login again.');}
  }

  async function deleteRemovedMemberRecord(m){
    if(!isOwnerUser()){toast('Only the Owner can permanently delete a former team record.');return;}
    if(!m || m.role==='owner' || m.id===state.agency?.owner_id || m.removed!==true){toast('Only a removed non-owner team record can be deleted.');return;}
    if(!confirm(`Permanently delete the Firestore team record for ${m.full_name||m.email||'this member'}? This cannot be undone. Their historical task notes remain as audit history.`))return;
    if(!confirm('Final confirmation: delete this removed team record permanently?'))return;
    if(state.demo){state.team=state.team.filter(x=>x.id!==m.id);persistDemo();render();toast('Former team record deleted');return;}
    const {error}=await sb.rpc('owner_delete_removed_member_record',{p_member_id:m.id});
    if(error)toast(error.message);else{await loadData();toast('Former team record deleted from Firestore. Firebase Auth login is separate.');}
  }

  async function saveProfile(){const name=document.getElementById('setName').value.trim();if(state.demo){state.profile.full_name=name;const i=state.team.findIndex(m=>m.id===state.profile.id);if(i>=0)state.team[i].full_name=name;persistDemo();render();toast('Profile saved');return;}const {error}=await sb.rpc('update_my_profile',{p_full_name:name});if(error)toast(error.message);else{await loadData();toast('Profile saved');}}
  async function saveAgency(){if(!hasFullAccess()){toast('Only an owner or manager can edit agency settings.');return;}const name=document.getElementById('agencyName').value.trim();if(!name)return;if(state.demo){state.agency.name=name;persistDemo();render();toast('Agency saved');return;}const {error}=await sb.from('agencies').update({name}).eq('id',state.agency.id);if(error)toast(error.message);else{await loadData();toast('Agency saved');}}

  async function loadData(){
    if(state.demo){seedDemo();render();return;}
    const {data:{session}}=await sb.auth.getSession(); state.user=session?.user||null;
    if(!state.user){state.profile=null;state.agency=null;state.accounts=[];state.tasks=[];state.team=[];render();return;}
    const {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',state.user.id).single();
    if(pErr){toast(pErr.message);return;} state.profile=profile;
    if(profile.removed===true || profile.active===false){state.agency=null;state.accounts=[];state.tasks=[];state.team=[profile];render();return;}
    if(!profile.agency_id){state.agency=null;state.accounts=[];state.tasks=[];state.team=[profile];render();return;}
    const [agencyRes,accountsRes,tasksRes,teamRes]=await Promise.all([
      sb.from('agencies').select('*').eq('id',profile.agency_id).single(),
      sb.from('accounts').select('*').order('created_at',{ascending:false}),
      sb.from('tasks').select('*').order('created_at',{ascending:false}),
      sb.from('profiles').select('*').order('created_at',{ascending:true})
    ]);
    if(agencyRes.error)toast(agencyRes.error.message); state.agency=agencyRes.data;
    state.accounts=accountsRes.data||[];state.tasks=(tasksRes.data||[]).map(t=>({...t,status:normalizeTaskStatus(t.status)}));state.team=teamRes.data||[];
    render();
  }

  function routeFromHash(renderNow=true){
    const r=(location.hash.replace(/^#\//,'')||'dashboard').split('?')[0];
    state.route=navItems().some(([x])=>x===r)?r:'dashboard';
    if(renderNow)render();
  }
  window.addEventListener('hashchange',()=>routeFromHash(true));

  async function init(){
    routeFromHash(false);
    if(state.demo){seedDemo();render();return;}
    // Wait for Firebase Auth to restore the persisted session before the first render.
    // This prevents the sign-in page from flashing for already signed-in Owner/Manager/VA users.
    let firstAuthEvent=true;
    await new Promise(resolve=>{
      sb.auth.onAuthStateChange(async()=>{
        if(firstAuthEvent){firstAuthEvent=false;resolve();return;}
        routeFromHash(false);
        await loadData();
      });
    });
    await loadData();
  }

  init();
})();
