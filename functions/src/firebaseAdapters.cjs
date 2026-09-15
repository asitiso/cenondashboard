const MANUAL_COLLECTION = 'manual_improve';
const SYNC_COLLECTION = '_sync_manual_improve_notion';
const CONFIG_COLLECTION = '_sync_manual_improve_notion_config';

function createManualRepo({ db, serverTimestamp }) {
  if (!db) throw new Error('db is required');
  if (typeof serverTimestamp !== 'function') throw new Error('serverTimestamp is required');
  const col = db.collection(MANUAL_COLLECTION);
  return {
    async get(id) {
      const snap = await col.doc(id).get();
      return { exists: snap.exists, data: snap.exists ? (snap.data() || {}) : null };
    },
    async create(data) {
      const ts = serverTimestamp();
      const ref = await col.add({ ...data, createdAt: ts, updatedAt: ts });
      return ref.id;
    },
    async update(id, patch) {
      await col.doc(id).update({ ...patch, updatedAt: serverTimestamp() });
    },
    async set(id, data) {
      const ts = serverTimestamp();
      await col.doc(id).set({ ...data, createdAt: ts, updatedAt: ts }, { merge: true });
    }
  };
}

function createSyncStateStore({ db, serverTimestamp }) {
  if (!db) throw new Error('db is required');
  if (typeof serverTimestamp !== 'function') throw new Error('serverTimestamp is required');
  const col = db.collection(SYNC_COLLECTION);
  return {
    async get(id) {
      const snap = await col.doc(id).get();
      return snap.exists ? (snap.data() || {}) : null;
    },
    async set(id, state) {
      await col.doc(id).set({ ...state, updatedAt: serverTimestamp() }, { merge: true });
    }
  };
}

function createWebhookTokenStore({ db, serverTimestamp }) {
  if (!db) throw new Error('db is required');
  if (typeof serverTimestamp !== 'function') throw new Error('serverTimestamp is required');
  const ref = db.collection(CONFIG_COLLECTION).doc('webhook');
  let cached = null;
  return {
    async get() {
      if (cached) return cached;
      const snap = await ref.get();
      cached = snap.exists ? (snap.data()?.verificationToken || null) : null;
      return cached;
    },
    async set(token) {
      if (!token) throw new Error('verification token is required');
      cached = token;
      await ref.set({ verificationToken: token, updatedAt: serverTimestamp() }, { merge: true });
    }
  };
}

module.exports = { createManualRepo, createSyncStateStore, createWebhookTokenStore, MANUAL_COLLECTION, SYNC_COLLECTION, CONFIG_COLLECTION };
