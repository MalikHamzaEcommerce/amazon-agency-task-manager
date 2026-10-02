(() => {
  const cfg = window.APP_CONFIG || {};
  const hasFirebase = !!(cfg.FIREBASE_CONFIG && window.FIREBASE_BACKEND_READY && window.supabase);
  const sb = hasFirebase ? window.supabase.createClient() : null;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  const ICONS = {
    dashboard:'▦', accounts:'▣', tasks:'☑', my:'◉', team:'♙', calendar:'▤', reports:'◔', settings:'⚙'
  };

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
    filters: { account:'', assignee:'', status:'', priority:'', source:'' }
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
    const iso = (offset=0) => { const x=new Date(d); x.setDate(x.getDate()+offset); return x.toISOString().slice(0,10); };
    return [
      {id:'t1',account_id:'a1',title:'PPC campaign optimization',description:'Review spend and high ACOS terms',assigned_to:'va-ali',received_by:'demo-owner',source:'Email',status:'In Progress',priority:'High',due_date:iso(0),recurring:true,recurrence:'Weekly',created_at:new Date().toISOString()},
      {id:'t2',account_id:'a3',title:'Fix suppressed listings',description:'Resolve listing suppression',assigned_to:'va-sarah',received_by:'demo-owner',source:'WhatsApp',status:'Complete',priority:'Medium',due_date:iso(0),recurring:false,recurrence:'',created_at:new Date().toISOString(),completed_at:new Date().toISOString()},
      {id:'t3',account_id:'a2',title:'Update keywords',description:'Update backend search terms',assigned_to:'va-ahmed',received_by:'demo-owner',source:'Slack',status:'Waiting on Client',priority:'High',due_date:iso(1),recurring:false,recurrence:'',created_at:new Date().toISOString()},
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
  function today(){ return new Date().toISOString().slice(0,10); }
  function fmtDate(v){ if(!v) return '—'; const d=new Date(v+'T00:00:00'); return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function accountById(id){ return state.accounts.find(a=>a.id===id); }
  function memberById(id){ return state.team.find(m=>m.id===id); }
  function isOverdue(t){ return t.status!=='Complete' && t.due_date && t.due_date < today(); }
  function displayStatus(t){ return isOverdue(t) ? 'Overdue' : t.status; }
  function initials(name=''){ return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'U'; }
  function toast(msg){ const d=document.createElement('div'); d.className='toast'; d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2600); }

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
          <div class="quick"><div class="quick-title">Quick Add</div>
            <button class="primary" data-action="new-task">＋ New Task</button>
            <button class="purple" data-action="new-account">＋ New Account</button>
            <button data-action="invite-va">＋ New VA</button>
          </div>
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
      complete:tasks.filter(t=>t.status==='Complete').length,
      progress:tasks.filter(t=>t.status==='In Progress').length,
      notStarted:tasks.filter(t=>t.status==='Not Started').length,
      waiting:tasks.filter(t=>t.status==='Waiting on Client').length,
      overdue:tasks.filter(isOverdue).length
    };
  }

  function dashboardPage(){
    const c=metricCounts();
    const teamCounts=state.team.map(m=>({m,count:state.tasks.filter(t=>t.assigned_to===m.id && t.status!=='Complete').length})).sort((a,b)=>b.count-a.count);
    const sources={}; state.tasks.forEach(t=>sources[t.source]=(sources[t.source]||0)+1);
    const maxTeam=Math.max(1,...teamCounts.map(x=>x.count));
    const maxSource=Math.max(1,...Object.values(sources));
    const rows=filterTasks(state.tasks).slice(0,8);
    return `
      <div class="page-head"><div><h1>Dashboard</h1><p class="muted">Overview of all Amazon accounts, tasks and team activity</p></div><div class="actions"><button class="btn primary" data-action="new-task">＋ Add Task</button></div></div>
      <div class="grid kpi-grid">
        ${kpi('Total Tasks',c.total,'blue')}${kpi('Completed',c.complete,'green')}${kpi('In Progress',c.progress,'blue')}${kpi('Not Started',c.notStarted,'amber')}${kpi('Waiting on Client',c.waiting,'purple')}${kpi('Overdue',c.overdue,'red')}
      </div>
      <div class="grid widgets">
        <div class="card widget"><h3>Tasks by Status</h3>${statusBars()}</div>
        <div class="card widget"><h3>Tasks by VA</h3>${teamCounts.map(x=>`<div class="va-row"><span>${esc(x.m.full_name)}</span><div class="bar purple"><i style="width:${Math.round(x.count/maxTeam*100)}%"></i></div><b>${x.count}</b></div>`).join('')||'<div class="empty">No team yet</div>'}</div>
        <div class="card widget"><h3>Tasks by Source</h3>${Object.entries(sources).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<div class="source-row"><span>${esc(s)}</span><div class="bar green"><i style="width:${Math.round(n/maxSource*100)}%"></i></div><b>${n}</b></div>`).join('')||'<div class="empty">No sources yet</div>'}</div>
      </div>
      ${taskTableCard("Today's / Current Tasks", rows, true)}
      <div class="grid split" style="margin-top:14px">
        <div class="card panel"><div class="page-head"><div><h3 style="margin:0">Accounts Overview</h3></div><button class="btn" onclick="location.hash='#/accounts'">View All</button></div>${accountsMini()}</div>
        <div class="card panel"><div class="page-head"><div><h3 style="margin:0">Upcoming Deadlines</h3></div></div>${upcomingMini()}</div>
      </div>`;
  }
  function kpi(label,value,cls){ return `<div class="card kpi ${cls}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`; }
  function statusBars(){
    const labels=['Complete','In Progress','Not Started','Waiting on Client','Blocked'];
    const max=Math.max(1,...labels.map(s=>state.tasks.filter(t=>t.status===s).length));
    return labels.map((s,i)=>{ const n=state.tasks.filter(t=>t.status===s).length; const cl=['green','','amber','purple','red'][i]; return `<div class="status-row"><span>${s}</span><div class="bar ${cl}"><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`; }).join('');
  }
  function accountsMini(){
    const rows=state.accounts.slice(0,6).map(a=>`<tr><td><span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span></td><td>${esc(a.client_name||'—')}</td><td>${esc(a.marketplace||'—')}</td><td>${badge(a.status)}</td><td>${state.tasks.filter(t=>t.account_id===a.id).length}</td></tr>`).join('');
    return `<div class="table-wrap"><table class="data-table" style="min-width:650px"><thead><tr><th>Account</th><th>Client</th><th>Marketplace</th><th>Status</th><th>Tasks</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">No accounts</td></tr>'}</tbody></table></div>`;
  }
  function upcomingMini(){
    const list=state.tasks.filter(t=>t.status!=='Complete'&&t.due_date).sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,7);
    return list.map(t=>`<div class="metric-item"><div><b>${esc(t.title)}</b><div class="small muted">${esc(accountById(t.account_id)?.account_name||'No account')}</div></div><div style="text-align:right">${badge(t.priority)}<div class="small ${isOverdue(t)?'danger':'muted'}" style="margin-top:5px">${fmtDate(t.due_date)}</div></div></div>`).join('')||'<div class="empty">No upcoming deadlines</div>';
  }

  function accountsPage(){
    const rows=state.accounts.filter(a=>matchesGlobal([a.account_name,a.client_name,a.marketplace,a.status])).map(a=>{
      const all=state.tasks.filter(t=>t.account_id===a.id); const open=all.filter(t=>t.status!=='Complete').length;
      return `<tr><td><span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span></td><td>${esc(a.client_name||'—')}</td><td>${esc(a.marketplace||'—')}</td><td>${badge(a.status)}</td><td>${all.length}</td><td>${open}</td><td><button class="btn small" data-edit-account="${a.id}">Edit</button> <button class="btn small" data-account-tasks="${a.id}">Tasks</button></td></tr>`;
    }).join('');
    return `<div class="page-head"><div><h1>Accounts</h1><p class="muted">Manage all Amazon client accounts</p></div><button class="btn primary" data-action="new-account">＋ New Account</button></div>
      <div class="card table-card"><div class="table-toolbar"><h3>All Accounts</h3><div class="muted small">${state.accounts.length} accounts</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Account Name</th><th>Client</th><th>Marketplace</th><th>Status</th><th>Total Tasks</th><th>Open Tasks</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">No accounts found</td></tr>'}</tbody></table></div></div>`;
  }

  function taskFilters(){
    const vals=(arr,key)=>[...new Set(arr.map(x=>x[key]).filter(Boolean))].sort();
    return `<div class="filters">
      <select id="fAccount"><option value="">All Accounts</option>${state.accounts.map(a=>`<option value="${a.id}" ${state.filters.account===a.id?'selected':''}>${esc(a.account_name)}</option>`).join('')}</select>
      <select id="fAssignee"><option value="">All VAs</option>${state.team.map(m=>`<option value="${m.id}" ${state.filters.assignee===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select>
      <select id="fStatus"><option value="">All Status</option>${['Not Started','In Progress','Waiting on Client','Blocked','Complete'].map(v=>`<option ${state.filters.status===v?'selected':''}>${v}</option>`).join('')}</select>
      <select id="fPriority"><option value="">All Priority</option>${['High','Medium','Low'].map(v=>`<option ${state.filters.priority===v?'selected':''}>${v}</option>`).join('')}</select>
      <select id="fSource"><option value="">All Sources</option>${vals(state.tasks,'source').map(v=>`<option ${state.filters.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
    </div>`;
  }
  function filterTasks(input){
    return input.filter(t=>{
      const a=accountById(t.account_id), m=memberById(t.assigned_to);
      return (!state.filters.account||t.account_id===state.filters.account) && (!state.filters.assignee||t.assigned_to===state.filters.assignee) && (!state.filters.status||t.status===state.filters.status) && (!state.filters.priority||t.priority===state.filters.priority) && (!state.filters.source||t.source===state.filters.source) && matchesGlobal([t.title,t.description,t.source,t.status,t.priority,a?.account_name,a?.client_name,m?.full_name]);
    }).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  }
  function matchesGlobal(fields){ if(!state.search) return true; const q=state.search.toLowerCase(); return fields.some(v=>String(v||'').toLowerCase().includes(q)); }

  function taskTableCard(title,tasks,showFilters=false){
    return `<div class="card table-card"><div class="table-toolbar"><h3>${esc(title)}</h3>${showFilters?taskFilters():''}</div>${taskTable(tasks)}</div>`;
  }
  function taskTable(tasks){
    const rows=tasks.map((t,i)=>{ const a=accountById(t.account_id); const m=memberById(t.assigned_to); return `<tr>
      <td>${i+1}</td><td><span class="link" data-edit-task="${t.id}">${esc(t.title)}</span></td><td>${a?`<span class="link" data-open-account="${a.id}">${esc(a.account_name)}</span>`:'—'}</td><td>${esc(a?.client_name||'—')}</td><td>${m?`<span class="avatar" style="display:inline-grid;width:26px;height:26px;font-size:10px;margin-right:6px">${initials(m.full_name)}</span>${esc(m.full_name)}`:'Unassigned'}</td><td>${esc(t.source||'—')}</td><td>${badge(t.priority)}</td><td class="${isOverdue(t)?'danger':''}">${fmtDate(t.due_date)}</td><td>${badge(displayStatus(t))}</td><td><button class="btn small" data-edit-task="${t.id}">Edit</button></td></tr>`; }).join('');
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Task</th><th>Account</th><th>Client</th><th>Assigned To</th><th>Source</th><th>Priority</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="empty">No tasks found</td></tr>'}</tbody></table></div>`;
  }

  function tasksPage(my=false){
    let base=state.tasks;
    if(my) base=base.filter(t=>t.assigned_to===state.profile?.id);
    const rows=filterTasks(base);
    const c=metricCounts(base);
    return `<div class="page-head"><div><h1>${my?'My Tasks':'Tasks'}</h1><p class="muted">${my?'View tasks assigned to you':'Manage all tasks across accounts'}</p></div><button class="btn primary" data-action="new-task">＋ Add Task</button></div>
      ${my?`<div class="grid kpi-grid" style="grid-template-columns:repeat(5,1fr)">${kpi('My Total Tasks',c.total,'blue')}${kpi('Completed',c.complete,'green')}${kpi('In Progress',c.progress,'blue')}${kpi('Not Started',c.notStarted,'amber')}${kpi('Overdue',c.overdue,'red')}</div>`:''}
      <div class="card table-card"><div class="table-toolbar">${taskFilters()}<div class="muted small">${rows.length} tasks</div></div>${taskTable(rows)}</div>`;
  }

  function teamPage(){
    const rows=state.team.filter(m=>matchesGlobal([m.full_name,m.email,m.role])).map((m,i)=>{
      const all=state.tasks.filter(t=>t.assigned_to===m.id), open=all.filter(t=>t.status!=='Complete').length, overdue=all.filter(isOverdue).length, completeToday=all.filter(t=>t.status==='Complete' && (t.completed_at||'').slice(0,10)===today()).length;
      return `<tr><td>${i+1}</td><td><span class="avatar" style="display:inline-grid;width:28px;height:28px;font-size:10px;margin-right:7px">${initials(m.full_name)}</span><b>${esc(m.full_name||'Unnamed')}</b></td><td>${esc(m.email||'—')}</td><td>${badge(cap(m.role))}</td><td>${all.length}</td><td>${open}</td><td class="${overdue?'danger':''}">${overdue}</td><td>${completeToday}</td><td>${m.active?badge('Active'):badge('Paused')}</td>${state.profile?.role==='owner'?`<td><button class="btn small" data-edit-member="${m.id}">Edit</button></td>`:'<td>—</td>'}</tr>`;
    }).join('');
    return `<div class="page-head"><div><h1>Team / VAs</h1><p class="muted">Manage your team members and workload</p></div><button class="btn primary" data-action="invite-va">＋ New VA</button></div>
      <div class="card table-card"><div class="table-toolbar"><h3>Team Workload</h3><div class="muted small">${state.team.length} members</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Total Tasks</th><th>Open</th><th>Overdue</th><th>Completed Today</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="empty">No team members</td></tr>'}</tbody></table></div></div>`;
  }

  function calendarPage(){
    const now=new Date(); const year=now.getFullYear(), month=now.getMonth(); const first=new Date(year,month,1); const days=new Date(year,month+1,0).getDate(); const start=first.getDay();
    const cells=[]; for(let i=0;i<start;i++) cells.push('<div class="day"></div>');
    for(let day=1;day<=days;day++){
      const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const ts=state.tasks.filter(t=>t.due_date===iso);
      cells.push(`<div class="day"><div class="day-num">${day}</div>${ts.slice(0,4).map(t=>`<div class="cal-task" data-edit-task="${t.id}">${esc(t.title)}</div>`).join('')}${ts.length>4?`<div class="small muted">+${ts.length-4} more</div>`:''}</div>`);
    }
    return `<div class="page-head"><div><h1>Calendar</h1><p class="muted">View task deadlines by date</p></div><button class="btn primary" data-action="new-task">＋ Add Task</button></div><div class="card panel"><h3>${now.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h3><div class="calendar">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-head">${d}</div>`).join('')}${cells.join('')}</div></div>`;
  }

  function reportsPage(){
    const c=metricCounts();
    const byAccount=state.accounts.map(a=>{const ts=state.tasks.filter(t=>t.account_id===a.id);return {a,total:ts.length,complete:ts.filter(t=>t.status==='Complete').length,overdue:ts.filter(isOverdue).length}}).sort((x,y)=>y.total-x.total);
    const byPerson=state.team.map(m=>{const ts=state.tasks.filter(t=>t.assigned_to===m.id);return {m,total:ts.length,complete:ts.filter(t=>t.status==='Complete').length,overdue:ts.filter(isOverdue).length}}).sort((x,y)=>y.total-x.total);
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
        <div class="card panel"><h3>Agency</h3><div class="field"><label>Agency Name</label><input id="agencyName" value="${esc(state.agency?.name||'')}"></div><div class="field"><label>Invite Code for VAs</label><div class="code-box">${esc(state.agency?.invite_code||'Not available')}</div></div><p class="small muted">Share the live dashboard URL plus this invite code. Each VA should use their own login.</p>${state.profile?.role==='owner'?'<button class="btn primary" data-action="save-agency">Save Agency</button>':''}</div>
        <div class="card panel"><h3>Data & Security</h3><p class="muted">${state.demo?'Demo data is currently saved in this browser only. Connect Firebase for real multi-user storage.':'Live data is stored in Firebase Firestore. Authentication is handled by Firebase Auth.'}</p><p class="small"><b>Do not store</b> Seller Central passwords, OTP codes, bank credentials, or private API secrets in task notes.</p></div>
        <div class="card panel"><h3>Session</h3>${state.demo?'<button class="btn red" data-action="reset-demo">Reset Demo Data</button>':'<button class="btn red" data-action="signout">Sign Out</button>'}</div>
      </div>`;
  }

  function render(){
    let content='';
    if(!state.demo && !state.user){ renderAuth(); return; }
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

  function renderAuth(){
    app.innerHTML=`<div class="auth-page"><div class="auth-card"><h1>${esc(cfg.APP_NAME||'Amazon Account Task Manager')}</h1><p class="muted">Sign in to manage accounts, tasks and your VA team.</p><form id="authForm"><div class="field"><label>Email</label><input id="authEmail" type="email" required></div><div class="field"><label>Password</label><input id="authPassword" type="password" minlength="6" required></div><button class="btn primary" style="width:100%" type="submit">Sign In</button></form><button class="btn" style="width:100%;margin-top:8px" id="signupBtn">Create Account</button><div id="authMsg" class="small muted" style="margin-top:12px"></div></div></div>`;
    document.getElementById('authForm').onsubmit=async e=>{e.preventDefault(); const email=authEmail.value.trim(), password=authPassword.value; const {error}=await sb.auth.signInWithPassword({email,password}); authMsg.textContent=error?error.message:'Signed in';};
    document.getElementById('signupBtn').onclick=async()=>{ const email=authEmail.value.trim(), password=authPassword.value; if(!email||password.length<6){authMsg.textContent='Enter email and a password of at least 6 characters.';return;} const full_name=prompt('Your full name?')||''; const {error}=await sb.auth.signUp({email,password,options:{data:{full_name}}}); authMsg.textContent=error?error.message:'Account created. Check your email if confirmation is enabled, then sign in.'; };
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
    document.querySelectorAll('[data-edit-task]').forEach(x=>x.onclick=()=>taskModal(state.tasks.find(t=>t.id===x.dataset.editTask)));
    document.querySelectorAll('[data-edit-account]').forEach(x=>x.onclick=()=>accountModal(state.accounts.find(a=>a.id===x.dataset.editAccount)));
    document.querySelectorAll('[data-open-account]').forEach(x=>x.onclick=()=>{state.filters.account=x.dataset.openAccount; location.hash='#/tasks';});
    document.querySelectorAll('[data-account-tasks]').forEach(x=>x.onclick=()=>{state.filters.account=x.dataset.accountTasks; location.hash='#/tasks';});
    document.querySelectorAll('[data-edit-member]').forEach(x=>x.onclick=()=>memberModal(state.team.find(m=>m.id===x.dataset.editMember)));
    ['fAccount','fAssignee','fStatus','fPriority','fSource'].forEach(id=>{const el=document.getElementById(id); if(el)el.onchange=e=>{const key={fAccount:'account',fAssignee:'assignee',fStatus:'status',fPriority:'priority',fSource:'source'}[id];state.filters[key]=e.target.value;render();};});
    document.querySelector('[data-action="save-profile"]')?.addEventListener('click',saveProfile);
    document.querySelector('[data-action="save-agency"]')?.addEventListener('click',saveAgency);
    document.querySelector('[data-action="signout"]')?.addEventListener('click',()=>sb.auth.signOut());
    document.querySelector('[data-action="reset-demo"]')?.addEventListener('click',()=>{if(confirm('Reset all demo data?')){localStorage.removeItem('amazon-agency-demo-v2');location.reload();}});
  }

  function modal(title, body, foot=''){
    modalRoot.innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h3 style="margin:0">${esc(title)}</h3><button class="icon-btn" id="closeModal">×</button></div><div class="modal-body">${body}</div>${foot?`<div class="modal-foot">${foot}</div>`:''}</div></div>`;
    closeModal.onclick=closeModalFn; backdrop.onclick=e=>{if(e.target===backdrop)closeModalFn();};
  }
  function closeModalFn(){ modalRoot.innerHTML=''; }

  function taskModal(t=null){
    const edit=!!t; const x=t||{title:'',account_id:state.filters.account||'',assigned_to:'',received_by:state.profile?.id||'',source:'Internal',status:'Not Started',priority:'Medium',due_date:today(),description:'',recurring:false,recurrence:''};
    modal(edit?'Edit Task':'New Task',`<form id="taskForm">
      <div class="field"><label>Task</label><input id="taskTitle" value="${esc(x.title)}" required placeholder="e.g. PPC campaign optimization"></div>
      <div class="two"><div class="field"><label>Account</label><select id="taskAccount" required><option value="">Select account</option>${state.accounts.map(a=>`<option value="${a.id}" ${x.account_id===a.id?'selected':''}>${esc(a.account_name)} — ${esc(a.client_name||'')}</option>`).join('')}</select></div><div class="field"><label>Assigned To</label><select id="taskAssignee"><option value="">Unassigned</option>${state.team.filter(m=>m.active!==false).map(m=>`<option value="${m.id}" ${x.assigned_to===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Task Source</label><select id="taskSource">${['Email','Slack','WhatsApp','Upwork','Fiverr','Client Portal','Call','Internal','Other'].map(v=>`<option ${x.source===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Received By</label><select id="taskReceived"><option value="">Not set</option>${state.team.map(m=>`<option value="${m.id}" ${x.received_by===m.id?'selected':''}>${esc(m.full_name)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Status</label><select id="taskStatus">${['Not Started','In Progress','Waiting on Client','Blocked','Complete'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Priority</label><select id="taskPriority">${['High','Medium','Low'].map(v=>`<option ${x.priority===v?'selected':''}>${v}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label>Due Date</label><input id="taskDue" type="date" value="${esc(x.due_date||'')}"></div><div class="field"><label>Recurring</label><select id="taskRecurring"><option value="false" ${!x.recurring?'selected':''}>No</option><option value="true" ${x.recurring?'selected':''}>Yes</option></select></div></div>
      <div class="field"><label>Recurrence</label><select id="taskRecurrence"><option value="">None</option>${['Daily','Weekly','Monthly'].map(v=>`<option ${x.recurrence===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Notes / Description</label><textarea id="taskDescription" rows="4" placeholder="Details, client request, links...">${esc(x.description||'')}</textarea></div>
    </form>`,`${edit?'<button class="btn red" id="deleteTask">Delete</button>':''}<button class="btn" id="cancelTask">Cancel</button><button class="btn primary" id="saveTask">${edit?'Save Changes':'Create Task'}</button>`);
    cancelTask.onclick=closeModalFn; saveTask.onclick=()=>saveTaskData(t?.id); if(edit)deleteTask.onclick=()=>deleteTaskData(t.id);
  }

  async function saveTaskData(id){
    const data={
      account_id:taskAccount.value||null,title:taskTitle.value.trim(),assigned_to:taskAssignee.value||null,received_by:taskReceived.value||null,source:taskSource.value,status:taskStatus.value,priority:taskPriority.value,due_date:taskDue.value||null,recurring:taskRecurring.value==='true',recurrence:taskRecurrence.value||null,description:taskDescription.value.trim()
    };
    if(!data.title||!data.account_id){toast('Task and account are required');return;}
    if(state.demo){
      if(id){const i=state.tasks.findIndex(t=>t.id===id);state.tasks[i]={...state.tasks[i],...data,completed_at:data.status==='Complete'?(state.tasks[i].completed_at||new Date().toISOString()):null};}
      else state.tasks.push({id:'t'+Date.now(),...data,created_at:new Date().toISOString(),completed_at:data.status==='Complete'?new Date().toISOString():null});
      persistDemo();closeModalFn();render();toast('Task saved');return;
    }
    data.agency_id=state.profile.agency_id; data.created_by=state.user.id;
    const res=id?await sb.from('tasks').update(data).eq('id',id):await sb.from('tasks').insert(data);
    if(res.error){toast(res.error.message);return;} closeModalFn();await loadData();toast('Task saved');
  }
  async function deleteTaskData(id){ if(!confirm('Delete this task?'))return; if(state.demo){state.tasks=state.tasks.filter(t=>t.id!==id);persistDemo();closeModalFn();render();return;} const {error}=await sb.from('tasks').delete().eq('id',id); if(error)toast(error.message);else{closeModalFn();await loadData();} }

  function accountModal(a=null){
    const edit=!!a; const x=a||{account_name:'',client_name:'',marketplace:'Amazon US',status:'Active',notes:''};
    modal(edit?'Edit Account':'New Account',`<div class="field"><label>Account Name</label><input id="accName" value="${esc(x.account_name)}" placeholder="Amazon account / brand name"></div><div class="field"><label>Client Name</label><input id="accClient" value="${esc(x.client_name||'')}"></div><div class="two"><div class="field"><label>Marketplace</label><select id="accMarket">${['Amazon US','Amazon UK','Amazon CA','Amazon DE','Amazon AU','Amazon UAE','Amazon KSA','Other'].map(v=>`<option ${x.marketplace===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="accStatus">${['Active','Onboarding','Paused','Closed'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="field"><label>Notes</label><textarea id="accNotes" rows="4">${esc(x.notes||'')}</textarea></div>`,`${edit?'<button class="btn red" id="deleteAccount">Delete</button>':''}<button class="btn" id="cancelAccount">Cancel</button><button class="btn primary" id="saveAccount">${edit?'Save Changes':'Create Account'}</button>`);
    cancelAccount.onclick=closeModalFn; saveAccount.onclick=()=>saveAccountData(a?.id); if(edit)deleteAccount.onclick=()=>deleteAccountData(a.id);
  }
  async function saveAccountData(id){ const data={account_name:accName.value.trim(),client_name:accClient.value.trim(),marketplace:accMarket.value,status:accStatus.value,notes:accNotes.value.trim()}; if(!data.account_name){toast('Account name is required');return;} if(state.demo){if(id){const i=state.accounts.findIndex(a=>a.id===id);state.accounts[i]={...state.accounts[i],...data};}else state.accounts.push({id:'a'+Date.now(),...data});persistDemo();closeModalFn();render();toast('Account saved');return;} data.agency_id=state.profile.agency_id;data.created_by=state.user.id;const res=id?await sb.from('accounts').update(data).eq('id',id):await sb.from('accounts').insert(data);if(res.error)toast(res.error.message);else{closeModalFn();await loadData();toast('Account saved');} }
  async function deleteAccountData(id){ if(state.tasks.some(t=>t.account_id===id)&&!confirm('This account has tasks. Delete account anyway? Tasks will remain without an account.'))return;if(!confirm('Delete this account?'))return;if(state.demo){state.accounts=state.accounts.filter(a=>a.id!==id);state.tasks=state.tasks.map(t=>t.account_id===id?{...t,account_id:null}:t);persistDemo();closeModalFn();render();return;}const {error}=await sb.from('accounts').delete().eq('id',id);if(error)toast(error.message);else{closeModalFn();await loadData();} }

  function inviteModal(){
    modal('Add / Invite VA', state.demo?`<p>In Demo Mode, add a sample team member below.</p><div class="field"><label>Name</label><input id="newMemberName" placeholder="VA name"></div><div class="field"><label>Email</label><input id="newMemberEmail" type="email" placeholder="va@example.com"></div>`:`<p>Share your live dashboard URL with the VA. They should create their own account and then choose <b>Join Agency</b>.</p><div class="field"><label>Your Agency Invite Code</label><div class="code-box">${esc(state.agency?.invite_code||'')}</div></div><p class="small muted">This avoids sharing passwords. Each person gets their own login.</p>`, state.demo?'<button class="btn" id="cancelInvite">Cancel</button><button class="btn primary" id="saveInvite">Add VA</button>':'<button class="btn primary" id="cancelInvite">Done</button>');
    cancelInvite.onclick=closeModalFn;
    if(state.demo)saveInvite.onclick=()=>{const name=newMemberName.value.trim(),email=newMemberEmail.value.trim();if(!name)return;state.team.push({id:'m'+Date.now(),agency_id:'demo-agency',full_name:name,email,role:'va',active:true});persistDemo();closeModalFn();render();toast('VA added');};
  }

  function memberModal(m){
    if(!m)return;modal('Edit Team Member',`<div class="field"><label>Name</label><input id="memberName" value="${esc(m.full_name||'')}"></div><div class="field"><label>Email</label><input value="${esc(m.email||'')}" disabled></div><div class="field"><label>Role</label><select id="memberRole">${['owner','manager','va'].map(v=>`<option value="${v}" ${m.role===v?'selected':''}>${cap(v)}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="memberActive"><option value="true" ${m.active!==false?'selected':''}>Active</option><option value="false" ${m.active===false?'selected':''}>Paused</option></select></div>`,`<button class="btn" id="cancelMember">Cancel</button><button class="btn primary" id="saveMember">Save</button>`);cancelMember.onclick=closeModalFn;saveMember.onclick=()=>saveMemberData(m.id);
  }
  async function saveMemberData(id){const data={full_name:memberName.value.trim(),role:memberRole.value,active:memberActive.value==='true'};if(state.demo){const i=state.team.findIndex(m=>m.id===id);state.team[i]={...state.team[i],...data};if(state.profile.id===id)state.profile=state.team[i];persistDemo();closeModalFn();render();return;}const {error}=await sb.rpc('owner_update_member',{p_member_id:id,p_full_name:data.full_name,p_role:data.role,p_active:data.active});if(error)toast(error.message);else{closeModalFn();await loadData();toast('Team member updated');}}

  async function saveProfile(){const name=document.getElementById('setName').value.trim();if(state.demo){state.profile.full_name=name;const i=state.team.findIndex(m=>m.id===state.profile.id);if(i>=0)state.team[i].full_name=name;persistDemo();render();toast('Profile saved');return;}const {error}=await sb.rpc('update_my_profile',{p_full_name:name});if(error)toast(error.message);else{await loadData();toast('Profile saved');}}
  async function saveAgency(){const name=document.getElementById('agencyName').value.trim();if(!name)return;if(state.demo){state.agency.name=name;persistDemo();render();toast('Agency saved');return;}const {error}=await sb.from('agencies').update({name}).eq('id',state.agency.id);if(error)toast(error.message);else{await loadData();toast('Agency saved');}}

  async function loadData(){
    if(state.demo){seedDemo();render();return;}
    const {data:{session}}=await sb.auth.getSession(); state.user=session?.user||null;
    if(!state.user){state.profile=null;state.agency=null;state.accounts=[];state.tasks=[];state.team=[];render();return;}
    const {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',state.user.id).single();
    if(pErr){toast(pErr.message);return;} state.profile=profile;
    if(!profile.agency_id){state.agency=null;state.accounts=[];state.tasks=[];state.team=[profile];render();return;}
    const [agencyRes,accountsRes,tasksRes,teamRes]=await Promise.all([
      sb.from('agencies').select('*').eq('id',profile.agency_id).single(),
      sb.from('accounts').select('*').order('created_at',{ascending:false}),
      sb.from('tasks').select('*').order('created_at',{ascending:false}),
      sb.from('profiles').select('*').order('created_at',{ascending:true})
    ]);
    if(agencyRes.error)toast(agencyRes.error.message); state.agency=agencyRes.data;
    state.accounts=accountsRes.data||[];state.tasks=tasksRes.data||[];state.team=teamRes.data||[];
    render();
  }

  function routeFromHash(){const r=(location.hash.replace(/^#\//,'')||'dashboard').split('?')[0];state.route=navItems().some(([x])=>x===r)?r:'dashboard';render();}
  window.addEventListener('hashchange',routeFromHash);

  async function init(){
    if(state.demo){seedDemo();routeFromHash();return;}
    sb.auth.onAuthStateChange(async()=>{await loadData();});
    await loadData();
    routeFromHash();
  }

  init();
})();
