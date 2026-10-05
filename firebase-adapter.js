(() => {
  const cfg = window.APP_CONFIG?.FIREBASE_CONFIG;
  if (!cfg || !window.firebase) return;

  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let initialAuthResolved = false;
  const initialAuthReady = new Promise(resolve => {
    let unsubscribe = () => {};
    unsubscribe = auth.onAuthStateChanged(
      user => { initialAuthResolved = true; unsubscribe(); resolve(user || null); },
      () => { initialAuthResolved = true; unsubscribe(); resolve(null); }
    );
  });

  const nowIso = () => new Date().toISOString();
  const wrapError = (e) => ({ error: { message: e?.message || String(e) } });
  const mapUser = (u) => u ? ({ id: u.uid, uid: u.uid, email: u.email || '' }) : null;
  const docData = (doc) => doc?.exists ? ({ id: doc.id, ...doc.data() }) : null;

  async function ensureProfile(user, fullName = '') {
    if (!user) return null;
    const ref = db.collection('profiles').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const profile = {
        full_name: fullName || user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role: 'va',
        active: true,
        removed: false,
        agency_id: null,
        created_at: nowIso()
      };
      await ref.set(profile);
      return { id: user.uid, ...profile };
    }
    return { id: snap.id, ...snap.data() };
  }

  async function currentProfile() {
    const user = auth.currentUser;
    if (!user) return null;
    return ensureProfile(user);
  }

  function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    bytes.forEach(b => out += alphabet[b % alphabet.length]);
    return out;
  }

  async function uniqueInviteCode() {
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      const snap = await db.collection('agency_invites').doc(code).get();
      if (!snap.exists) return code;
    }
    throw new Error('Could not generate an invite code. Please try again.');
  }

  function toISODateLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function recurrenceNextDate(dateStr, recurrence) {
    if (!dateStr || !['Daily','Weekly','Monthly'].includes(recurrence)) return null;
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [y,m,d] = parts;
    if (recurrence === 'Monthly') {
      const next = new Date(y, m, 1, 12, 0, 0, 0);
      const lastDay = new Date(next.getFullYear(), next.getMonth()+1, 0).getDate();
      next.setDate(Math.min(d, lastDay));
      return toISODateLocal(next);
    }
    const next = new Date(y, m-1, d, 12, 0, 0, 0);
    next.setDate(next.getDate() + (recurrence === 'Weekly' ? 7 : 1));
    return toISODateLocal(next);
  }

  function recurringChildRef(task, taskId) {
    const seriesId = task.series_id || taskId;
    const nextIndex = (Number(task.recurrence_index) || 0) + 1;
    const safeSeries = String(seriesId).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
    return db.collection('tasks').doc(`rec_${safeSeries}_${nextIndex}`);
  }

  function recurringChildPayload(task, taskId, userId, nextDue) {
    return {
      agency_id: task.agency_id,
      account_id: task.account_id || null,
      title: task.title || '',
      assigned_to: task.assigned_to || null,
      received_by: task.received_by || null,
      source: task.source || 'Internal',
      status: 'Not Started',
      priority: task.priority || 'Medium',
      due_date: nextDue,
      recurring: true,
      recurrence: task.recurrence,
      description: task.description || '',
      completed_at: null,
      created_at: nowIso(),
      created_by: userId,
      generated_by_recurrence: true,
      recurrence_parent_id: taskId,
      series_id: task.series_id || taskId,
      recurrence_index: (Number(task.recurrence_index) || 0) + 1
    };
  }

  async function ensureNextRecurringTask(taskId, profile, userId) {
    const taskRef = db.collection('tasks').doc(taskId);
    return db.runTransaction(async tx => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) throw new Error('Task not found.');
      const task = taskSnap.data();
      if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
      if (!['owner','manager'].includes(profile.role) && task.assigned_to !== userId) throw new Error('This task is not assigned to your login.');
      if (task.status !== 'Completed' || task.recurring !== true) return null;
      const nextDue = recurrenceNextDate(task.due_date, task.recurrence);
      if (!nextDue) return null;
      const childRef = recurringChildRef(task, taskId);
      const childSnap = await tx.get(childRef);
      if (!childSnap.exists) tx.set(childRef, recurringChildPayload(task, taskId, userId, nextDue));
      return childRef.id;
    });
  }

  async function updateTaskStatusWithRecurrence(taskId, status, profile, userId) {
    const allowed = ['Not Started', 'In Progress', 'Awaiting', 'Waiting on Client', 'Blocked', 'Completed'];
    if (!allowed.includes(status)) throw new Error('Invalid task status.');
    const normalizedStatus = status === 'Waiting on Client' ? 'Awaiting' : status;
    const taskRef = db.collection('tasks').doc(taskId);
    return db.runTransaction(async tx => {
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists) throw new Error('Task not found.');
      const task = taskSnap.data();
      if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
      if (!['owner','manager'].includes(profile.role) && task.assigned_to !== userId) throw new Error('This task is not assigned to your login.');
      let childRef = null, childSnap = null, nextDue = null;
      if (normalizedStatus === 'Completed' && task.recurring === true) {
        nextDue = recurrenceNextDate(task.due_date, task.recurrence);
        if (nextDue) {
          childRef = recurringChildRef(task, taskId);
          childSnap = await tx.get(childRef);
        }
      }
      tx.update(taskRef, {
        status: normalizedStatus,
        completed_at: normalizedStatus === 'Completed' ? (task.completed_at || nowIso()) : null
      });
      if (childRef && !childSnap.exists) tx.set(childRef, recurringChildPayload(task, taskId, userId, nextDue));
      return childRef?.id || null;
    });
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.orderByField = null;
      this.orderAscending = true;
      this.mode = 'select';
    }
    select() { this.mode = 'select'; return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    order(field, opts = {}) { this.orderByField = field; this.orderAscending = opts.ascending !== false; return this; }
    async single() {
      try {
        const data = await this._select(true);
        if (!data) return { data: null, error: { message: 'Record not found' } };
        return { data, error: null };
      } catch (e) { return wrapError(e); }
    }
    async insert(payload) {
      try {
        const data = { ...(Array.isArray(payload) ? payload[0] : payload) };
        if (!data.created_at) data.created_at = nowIso();
        const ref = await db.collection(this.table).add(data);
        return { data: [{ id: ref.id, ...data }], error: null };
      } catch (e) { return wrapError(e); }
    }
    update(payload) {
      return new MutationBuilder(this.table, 'update', payload);
    }
    delete() {
      return new MutationBuilder(this.table, 'delete', null);
    }
    then(resolve, reject) {
      this._select(false).then(data => resolve({ data, error: null })).catch(e => resolve(wrapError(e)));
    }
    async _select(single) {
      const idFilter = this.filters.find(([f]) => f === 'id');
      if (idFilter) {
        const snap = await db.collection(this.table).doc(String(idFilter[1])).get();
        const row = docData(snap);
        if (!row) return single ? null : [];
        for (const [field, value] of this.filters) {
          if (field !== 'id' && row[field] !== value) return single ? null : [];
        }
        return single ? row : [row];
      }

      let q = db.collection(this.table);
      const profile = await currentProfile();
      if (['accounts', 'tasks', 'profiles'].includes(this.table) && profile?.agency_id) {
        q = q.where('agency_id', '==', profile.agency_id);
      }
      for (const [field, value] of this.filters) q = q.where(field, '==', value);
      const snap = await q.get();
      let rows = snap.docs.map(docData);
      if (this.orderByField) {
        const f = this.orderByField, dir = this.orderAscending ? 1 : -1;
        rows.sort((a,b) => String(a[f] ?? '').localeCompare(String(b[f] ?? '')) * dir);
      }
      return single ? (rows[0] || null) : rows;
    }
  }

  class MutationBuilder {
    constructor(table, mode, payload) {
      this.table = table;
      this.mode = mode;
      this.payload = payload;
    }
    async eq(field, value) {
      try {
        if (field === 'id') {
          const ref = db.collection(this.table).doc(String(value));
          if (this.mode === 'delete') await ref.delete();
          else await ref.update(this.payload);
          return { data: null, error: null };
        }
        let q = db.collection(this.table).where(field, '==', value);
        const profile = await currentProfile();
        if (['accounts','tasks','profiles'].includes(this.table) && profile?.agency_id) q = q.where('agency_id', '==', profile.agency_id);
        const snap = await q.get();
        const batch = db.batch();
        snap.docs.forEach(d => this.mode === 'delete' ? batch.delete(d.ref) : batch.update(d.ref, this.payload));
        await batch.commit();
        return { data: null, error: null };
      } catch (e) { return wrapError(e); }
    }
  }

  async function rpc(name, args = {}) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in first.');
      const profileRef = db.collection('profiles').doc(user.uid);
      const profile = await ensureProfile(user);

      if (name === 'create_agency') {
        if (profile.agency_id) throw new Error('You already belong to an agency.');
        const agencyRef = db.collection('agencies').doc();
        const inviteCode = await uniqueInviteCode();
        const batch = db.batch();
        batch.set(agencyRef, {
          name: String(args.p_name || '').trim(),
          owner_id: user.uid,
          invite_code: inviteCode,
          created_at: nowIso()
        });
        batch.set(db.collection('agency_invites').doc(inviteCode), {
          agency_id: agencyRef.id,
          agency_name: String(args.p_name || '').trim(),
          active: true,
          created_at: nowIso()
        });
        batch.update(profileRef, { agency_id: agencyRef.id, role: 'owner', active: true, removed: false });
        await batch.commit();
        return { data: agencyRef.id, error: null };
      }

      if (name === 'join_agency') {
        if (profile.agency_id) throw new Error('You already belong to an agency.');
        const code = String(args.p_invite_code || '').trim().toUpperCase();
        const invite = await db.collection('agency_invites').doc(code).get();
        if (!invite.exists || invite.data().active === false) throw new Error('Invalid or inactive invite code.');
        if (profile.removed === true || profile.active === false) throw new Error('Your agency access was removed or paused. Ask the agency owner to restore your access.');
        await profileRef.update({ agency_id: invite.data().agency_id, role: 'va', active: true, removed: false, join_code: code });
        return { data: invite.data().agency_id, error: null };
      }

      if (name === 'owner_update_member') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Only an active Owner or Manager can edit team members.');
        const targetRef = db.collection('profiles').doc(args.p_member_id);
        const target = await targetRef.get();
        if (!target.exists || target.data().agency_id !== profile.agency_id) throw new Error('Team member not found.');
        if (target.data().removed === true) throw new Error('This team member has already been removed.');
        const targetData = target.data();
        const isAgencyOwner = target.id === user.uid || targetData.role === 'owner';
        let patch;
        if (profile.role === 'owner') {
          patch = isAgencyOwner
            ? { full_name: args.p_full_name || targetData.full_name || '', role: 'owner', active: true }
            : { full_name: args.p_full_name || '', role: ['manager','va'].includes(args.p_role) ? args.p_role : 'va', active: !!args.p_active };
        } else {
          if (isAgencyOwner || targetData.role !== 'va') throw new Error('Managers can manage VAs, but only the Owner can change Manager or Owner roles.');
          patch = { full_name: args.p_full_name || '', role: 'va', active: !!args.p_active };
        }
        await targetRef.update(patch);
        return { data: true, error: null };
      }

      if (name === 'owner_remove_member') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Only an active Owner or Manager can remove team members.');
        const memberId = String(args.p_member_id || '').trim();
        if (!memberId) throw new Error('Team member ID is missing.');
        if (memberId === user.uid) throw new Error('The agency owner cannot remove their own login.');
        const targetRef = db.collection('profiles').doc(memberId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists || targetSnap.data().agency_id !== profile.agency_id) throw new Error('Team member not found.');
        const target = targetSnap.data();
        if (target.role === 'owner') throw new Error('The agency owner cannot be removed.');
        if (profile.role === 'manager' && target.role !== 'va') throw new Error('Managers can remove VAs only. Only the Owner can remove a Manager.');
        if (target.removed === true) return { data: true, error: null };

        const taskSnap = await db.collection('tasks').where('agency_id', '==', profile.agency_id).get();
        const batch = db.batch();
        taskSnap.docs.forEach(doc => {
          const task = doc.data();
          if (task.assigned_to === memberId && !['Complete','Completed'].includes(task.status)) batch.update(doc.ref, { assigned_to: null });
        });
        batch.update(targetRef, {
          active: false,
          removed: true,
          removed_at: nowIso(),
          removed_by: user.uid
        });
        await batch.commit();
        return { data: true, error: null };
      }

      if (name === 'owner_restore_member') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Only an active Owner or Manager can restore team members.');
        const memberId = String(args.p_member_id || '').trim();
        if (!memberId) throw new Error('Team member ID is missing.');
        if (memberId === user.uid) throw new Error('The agency owner cannot restore their own login as a VA.');
        const targetRef = db.collection('profiles').doc(memberId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists || targetSnap.data().agency_id !== profile.agency_id) throw new Error('Former team member not found.');
        const target = targetSnap.data();
        if (target.role === 'owner') throw new Error('The agency owner account cannot be restored as a VA.');
        if (profile.role === 'manager' && target.role !== 'va') throw new Error('Managers can restore VAs only. Only the Owner can restore a Manager.');
        if (target.removed !== true) return { data: true, error: null };
        await targetRef.update({
          active: true,
          removed: false,
          restored_at: nowIso(),
          restored_by: user.uid
        });
        return { data: true, error: null };
      }

      if (name === 'owner_delete_removed_member_record') {
        if (profile.role !== 'owner' || profile.active === false || profile.removed === true) throw new Error('Only the active Owner can permanently delete a former team record.');
        const memberId = String(args.p_member_id || '').trim();
        if (!memberId || memberId === user.uid) throw new Error('Invalid team member.');
        const targetRef = db.collection('profiles').doc(memberId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists) return { data: true, error: null };
        const target = targetSnap.data();
        if (target.agency_id !== profile.agency_id || target.role === 'owner' || target.removed !== true) throw new Error('Only a removed non-owner team record from your agency can be deleted.');
        await targetRef.delete();
        return { data: true, error: null };
      }

      if (name === 'get_account_login_access') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Account Login Access is available to Owners and Managers only.');
        const accountId = String(args.p_account_id || '').trim();
        const accountSnap = await db.collection('accounts').doc(accountId).get();
        if (!accountSnap.exists || accountSnap.data().agency_id !== profile.agency_id) throw new Error('Account not found.');
        const credSnap = await db.collection('account_credentials').doc(accountId).get();
        return { data: credSnap.exists ? { id: credSnap.id, ...credSnap.data() } : null, error: null };
      }

      if (name === 'save_account_login_access') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Account Login Access is available to Owners and Managers only.');
        const accountId = String(args.p_account_id || '').trim();
        const password = String(args.p_password || '');
        const loginName = String(args.p_login_name || '').trim();
        if (!password) throw new Error('Password is required.');
        const accountSnap = await db.collection('accounts').doc(accountId).get();
        if (!accountSnap.exists || accountSnap.data().agency_id !== profile.agency_id) throw new Error('Account not found.');
        const payload = {
          agency_id: profile.agency_id,
          account_id: accountId,
          account_name: accountSnap.data().account_name || '',
          login_name: loginName,
          password,
          updated_at: nowIso(),
          updated_by: user.uid
        };
        await db.collection('account_credentials').doc(accountId).set(payload, { merge: true });
        return { data: true, error: null };
      }

      if (name === 'delete_account_login_access') {
        if (!['owner','manager'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Account Login Access is available to Owners and Managers only.');
        const accountId = String(args.p_account_id || '').trim();
        const accountSnap = await db.collection('accounts').doc(accountId).get();
        if (!accountSnap.exists || accountSnap.data().agency_id !== profile.agency_id) throw new Error('Account not found.');
        const credRef = db.collection('account_credentials').doc(accountId);
        const credSnap = await credRef.get();
        if (credSnap.exists) await credRef.delete();
        return { data: true, error: null };
      }

      if (name === 'update_my_profile') {
        await profileRef.update({ full_name: args.p_full_name || '' });
        return { data: true, error: null };
      }

      if (name === 'update_my_task_status') {
        if (!['va','manager','owner'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Your account cannot update task status.');
        const taskId = String(args.p_task_id || '').trim();
        const status = String(args.p_status || '').trim();
        if (!taskId) throw new Error('Task ID is missing.');
        const nextId = await updateTaskStatusWithRecurrence(taskId, status, profile, user.uid);
        return { data: { next_task_id: nextId }, error: null };
      }

      if (name === 'ensure_next_recurrence') {
        if (!['va','manager','owner'].includes(profile.role) || profile.active === false || profile.removed === true) throw new Error('Your account cannot create recurring tasks.');
        const taskId = String(args.p_task_id || '').trim();
        if (!taskId) throw new Error('Task ID is missing.');
        const nextId = await ensureNextRecurringTask(taskId, profile, user.uid);
        return { data: { next_task_id: nextId }, error: null };
      }

      if (name === 'get_task_notes') {
        const taskId = String(args.p_task_id || '').trim();
        if (!taskId) throw new Error('Task ID is missing.');
        const taskSnap = await db.collection('tasks').doc(taskId).get();
        if (!taskSnap.exists) throw new Error('Task not found.');
        const task = taskSnap.data();
        if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
        if (!['owner','manager'].includes(profile.role) && task.assigned_to !== user.uid) throw new Error('Only agency leadership and the assigned VA can view these notes.');
        const snap = await db.collection('task_notes')
          .where('task_id', '==', taskId)
          .get();
        const rows = snap.docs.map(docData).sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        return { data: rows, error: null };
      }

      if (name === 'add_task_note') {
        const taskId = String(args.p_task_id || '').trim();
        const note = String(args.p_note || '').trim();
        if (!taskId) throw new Error('Task ID is missing.');
        if (!note) throw new Error('Write a note first.');
        if (note.length > 2000) throw new Error('Note is too long. Maximum 2000 characters.');
        const taskSnap = await db.collection('tasks').doc(taskId).get();
        if (!taskSnap.exists) throw new Error('Task not found.');
        const task = taskSnap.data();
        if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
        if (!['owner','manager'].includes(profile.role) && task.assigned_to !== user.uid) throw new Error('You can add notes only to tasks assigned to you.');
        const payload = {
          agency_id: profile.agency_id,
          task_id: taskId,
          author_id: user.uid,
          author_name: profile.full_name || user.email || 'User',
          note,
          created_at: nowIso()
        };
        const ref = await db.collection('task_notes').add(payload);
        return { data: { id: ref.id, ...payload }, error: null };
      }

      throw new Error(`Unknown operation: ${name}`);
    } catch (e) { return wrapError(e); }
  }

  const client = {
    auth: {
      async getSession() {
        if (!initialAuthResolved) await initialAuthReady;
        const user = auth.currentUser;
        return { data: { session: user ? { user: mapUser(user) } : null }, error: null };
      },
      onAuthStateChange(callback) {
        return auth.onAuthStateChanged(async (user) => {
          if (user) {
            try { await ensureProfile(user); } catch (e) { console.error(e); }
          }
          callback('AUTH_STATE_CHANGED', user ? { user: mapUser(user) } : null);
        });
      },
      async signInWithPassword({ email, password }) {
        try { await auth.signInWithEmailAndPassword(email, password); return { data: {}, error: null }; }
        catch (e) { return wrapError(e); }
      },
      async resetPasswordForEmail(email) {
        try { await auth.sendPasswordResetEmail(String(email || '').trim()); return { data: {}, error: null }; }
        catch (e) { return wrapError(e); }
      },
      async signUp({ email, password, options = {} }) {
        try {
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          const fullName = options?.data?.full_name || '';
          if (fullName) await cred.user.updateProfile({ displayName: fullName });
          await ensureProfile(cred.user, fullName);
          return { data: { user: mapUser(cred.user) }, error: null };
        } catch (e) { return wrapError(e); }
      },
      async signOut() {
        try { await auth.signOut(); return { error: null }; }
        catch (e) { return wrapError(e); }
      }
    },
    from(table) { return new QueryBuilder(table); },
    rpc
  };

  // The existing dashboard uses a Supabase-shaped data client internally.
  // This compatibility layer keeps the UI intact while Firestore/Auth power the data.
  window.supabase = { createClient: () => client };
  window.FIREBASE_BACKEND_READY = true;
})();
