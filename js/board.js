// Daily leaderboard. Online: one shared doc per player at scores/<id> (everyone reads, each
// player writes only their own). Offline / outside the viewer: personal bests in localStorage.

const LS = 'slaprot.v1';
function loadLocal() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function saveLocal(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} }

export function cleanTag(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export class Board {
  constructor(day) {
    this.day = day;
    this.rows = [];
    this.names = {};
    this.online = false;   // can read the shared board
    this.canWrite = false; // has an identity to write under
    this.uid = null;
    this.mine = null;
    this.status = 'local';
    this.local = loadLocal();
    if (this.local.day !== day) { this.local = { ...this.local, day, best: 0, kills: 0, runs: 0 }; saveLocal(this.local); }
    this.listeners = new Set();
  }
  get tag() { return this.local.tag || ''; }
  onChange(fn) { this.listeners.add(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  async init() {
    if (!window.claude || typeof window.claude.use !== 'function') { this.emit(); return; }
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db) { this.emit(); return; }
      this.db = db; this.user = user;
      this.uid = user ? await user.id() : null;
      this.online = true;
      this.canWrite = !!this.uid;
      this.status = this.canWrite ? 'online' : 'readonly';
      if (this.uid) {
        try {
          const snap = await db.doc('scores/' + this.uid).get();
          if (snap.exists) this.mine = { ...snap.data() };
        } catch {}
      }
      db.collection('scores').where('day', '==', this.day).orderBy('best', 'desc').limit(100).onSnapshot(
        (snap) => { this.rows = snap.docs.map(d => ({ id: d.id, ...d.data() })); this.resolve(); },
        () => { this.status = 'error'; this.emit(); },
      );
      this.emit();
    } catch { this.emit(); }
  }
  async resolve() {
    if (this.user && this.rows.length) {
      try { this.names = await this.user.profiles(this.rows.map(r => r.id)); } catch {}
    }
    this.emit();
  }
  nameFor(row) {
    const p = this.names[row.id];
    return cleanTag(row.tag) || (p && p.name) || 'Anonymous Slapper';
  }
  isMe(row) { return this.uid && row.id === this.uid; }
  myBest() {
    const online = this.mine && this.mine.day === this.day ? this.mine.best : 0;
    return Math.max(online || 0, this.local.best || 0);
  }
  myRuns() {
    const online = this.mine && this.mine.day === this.day ? this.mine.runs || 0 : 0;
    return Math.max(online, this.local.runs || 0);
  }
  rankOf(time) {
    let r = 1;
    for (const row of this.rows) if (!this.isMe(row) && row.best > time) r++;
    return r;
  }
  topRows(n = 10) { return this.rows.slice(0, n); }

  setTag(tag) {
    this.local.tag = cleanTag(tag); saveLocal(this.local);
    if (this.canWrite && this.mine && this.mine.day === this.day && this.mine.tag !== this.local.tag) {
      this.mine.tag = this.local.tag;
      this.db.doc('scores/' + this.uid).update({ tag: this.local.tag }).catch(() => {});
    }
  }

  async submit(time, kills) {
    const t = Math.floor(time * 100) / 100;
    const prevBest = this.myBest();
    this.local.runs = (this.local.runs || 0) + 1;
    if (t > (this.local.best || 0)) { this.local.best = t; this.local.kills = kills; }
    saveLocal(this.local);
    const improved = t > prevBest;
    if (!this.canWrite) return { improved, saved: false };
    const m = this.mine;
    const hist = { ...(m && m.hist) || {} };
    if (m && m.day && m.day !== this.day && m.best) hist[m.day] = { best: m.best, kills: m.kills || 0 };
    const keys = Object.keys(hist).sort(); while (keys.length > 30) delete hist[keys.shift()];
    const sameDay = m && m.day === this.day;
    const best = sameDay ? Math.max(m.best || 0, t) : t;
    const doc = {
      day: this.day,
      best,
      kills: sameDay && m.best >= t ? (m.kills || 0) : kills,
      runs: (sameDay ? m.runs || 0 : 0) + 1,
      tag: this.local.tag || '',
      at: Date.now(),
      hist,
    };
    try {
      await this.db.doc('scores/' + this.uid).set(doc);
      this.mine = doc;
      return { improved, saved: true };
    } catch (e) {
      if (e && e.code === 'invalid_argument') { this.canWrite = false; this.status = 'readonly'; this.emit(); }
      return { improved, saved: false, error: e && e.code };
    }
  }
}
