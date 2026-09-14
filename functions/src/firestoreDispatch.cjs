async function dispatchManualWrite({ mirror, id, after }) {
  if (!mirror) throw new Error('mirror is required');
  if (!id) throw new Error('Firestore document id is required');
  if (after && after.exists) {
    return mirror.upsertManual(id, after.data() || {});
  }
  return mirror.trashManual(id);
}

module.exports = { dispatchManualWrite };
