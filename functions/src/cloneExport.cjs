function decodeFirestoreValue(value = {}) {
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : value.integerValue;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return value.doubleValue;
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) return value.referenceValue;
  if (Object.prototype.hasOwnProperty.call(value, 'bytesValue')) return value.bytesValue;
  if (Object.prototype.hasOwnProperty.call(value, 'geoPointValue')) return value.geoPointValue;
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    return decodeFirestoreFields(value.mapValue.fields || {});
  }
  return null;
}

function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function fetchManualImproveFromClone({ projectId, databaseId, accessToken, fetchImpl = globalThis.fetch }) {
  if (!projectId) throw new Error('projectId is required');
  if (!databaseId) throw new Error('temporary clone databaseId is required');
  if (databaseId === '(default)') throw new Error('Refusing to read the production/default database; use a temporary clone database');
  if (!accessToken) throw new Error('accessToken is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents:runQuery`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'manual_improve' }],
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }]
      }
    })
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : []; } catch { throw new Error('Firestore clone query returned invalid JSON'); }
  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Firestore clone query failed: ${message}`);
  }
  if (!Array.isArray(payload)) throw new Error('Firestore clone query returned an unexpected response');

  const rows = [];
  for (const item of payload) {
    if (!item.document) continue;
    const encodedId = item.document.name.split('/').pop();
    rows.push({
      id: decodeURIComponent(encodedId),
      data: decodeFirestoreFields(item.document.fields || {})
    });
  }
  return rows;
}

module.exports = { decodeFirestoreValue, decodeFirestoreFields, fetchManualImproveFromClone };
