(() => {
  const cfg = window.APP_CONFIG?.FIREBASE_CONFIG;
  if (!cfg || !window.firebase) return;

  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();

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
        if (profile.role !== 'owner' || profile.active === false || profile.removed === true) throw new Error('Only the active agency owner can edit team members.');
        const targetRef = db.collection('profiles').doc(args.p_member_id);
        const target = await targetRef.get();
        if (!target.exists || target.data().agency_id !== profile.agency_id) throw new Error('Team member not found.');
        if (target.data().removed === true) throw new Error('This team member has already been removed.');
        const isAgencyOwner = target.id === user.uid || target.data().role === 'owner';
        const patch = isAgencyOwner
          ? { full_name: args.p_full_name || target.data().full_name || '', role: 'owner', active: true }
          : { full_name: args.p_full_name || '', role: args.p_role || 'va', active: !!args.p_active };
        await targetRef.update(patch);
        return { data: true, error: null };
      }

      if (name === 'owner_remove_member') {
        if (profile.role !== 'owner' || profile.active === false || profile.removed === true) throw new Error('Only the active agency owner can remove VAs.');
        const memberId = String(args.p_member_id || '').trim();
        if (!memberId) throw new Error('Team member ID is missing.');
        if (memberId === user.uid) throw new Error('The agency owner cannot remove their own login.');
        const targetRef = db.collection('profiles').doc(memberId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists || targetSnap.data().agency_id !== profile.agency_id) throw new Error('Team member not found.');
        const target = targetSnap.data();
        if (target.role === 'owner') throw new Error('The agency owner cannot be removed.');
        if (target.removed === true) return { data: true, error: null };

        const taskSnap = await db.collection('tasks').where('agency_id', '==', profile.agency_id).get();
        const batch = db.batch();
        taskSnap.docs.forEach(doc => {
          const task = doc.data();
          if (task.assigned_to === memberId && task.status !== 'Complete') batch.update(doc.ref, { assigned_to: null });
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

      if (name === 'update_my_profile') {
        await profileRef.update({ full_name: args.p_full_name || '' });
        return { data: true, error: null };
      }

      if (name === 'update_my_task_status') {
        if (profile.role !== 'va' && profile.role !== 'owner') throw new Error('Your account cannot update task status.');
        const taskId = String(args.p_task_id || '').trim();
        const status = String(args.p_status || '').trim();
        const allowed = ['Not Started', 'In Progress', 'Waiting on Client', 'Blocked', 'Complete'];
        if (!taskId) throw new Error('Task ID is missing.');
        if (!allowed.includes(status)) throw new Error('Invalid task status.');
        const taskRef = db.collection('tasks').doc(taskId);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) throw new Error('Task not found.');
        const task = taskSnap.data();
        if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
        if (profile.role !== 'owner' && task.assigned_to !== user.uid) throw new Error('This task is not assigned to your login.');
        const patch = {
          status,
          completed_at: status === 'Complete' ? (task.completed_at || nowIso()) : null
        };
        await taskRef.update(patch);
        return { data: true, error: null };
      }

      if (name === 'get_task_notes') {
        const taskId = String(args.p_task_id || '').trim();
        if (!taskId) throw new Error('Task ID is missing.');
        const taskSnap = await db.collection('tasks').doc(taskId).get();
        if (!taskSnap.exists) throw new Error('Task not found.');
        const task = taskSnap.data();
        if (!profile.agency_id || task.agency_id !== profile.agency_id) throw new Error('This task is outside your agency.');
        if (profile.role !== 'owner' && task.assigned_to !== user.uid) throw new Error('Only the owner and the assigned VA can view these notes.');
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
        if (profile.role !== 'owner' && task.assigned_to !== user.uid) throw new Error('You can add notes only to tasks assigned to you.');
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
