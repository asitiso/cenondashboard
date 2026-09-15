const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createNotionMirror } = require('./notionMirror.cjs');
const { dispatchManualWrite } = require('./firestoreDispatch.cjs');
const { dispatchNotionPage } = require('./notionDispatch.cjs');
const { handleNotionWebhook } = require('./notionWebhookHandler.cjs');
const { createManualRepo, createSyncStateStore, createWebhookTokenStore } = require('./firebaseAdapters.cjs');

initializeApp();
const db = getFirestore();
const serverTimestamp = () => FieldValue.serverTimestamp();
const repo = createManualRepo({ db, serverTimestamp });
const stateStore = createSyncStateStore({ db, serverTimestamp });
const tokenStore = createWebhookTokenStore({ db, serverTimestamp });

const notionApiKey = defineSecret('NOTION_API_KEY');
const notionDataSourceId = defineSecret('NOTION_DATA_SOURCE_ID');
const notionWebhookKey = defineSecret('NOTION_WEBHOOK_KEY');

function mirror() {
  return createNotionMirror({ apiKey: notionApiKey.value(), dataSourceId: notionDataSourceId.value() });
}

exports.syncManualImproveToNotion = onDocumentWritten(
  { document: 'manual_improve/{improveId}', secrets: [notionApiKey, notionDataSourceId], retry: true },
  async (event) => {
    const result = await dispatchManualWrite({
      mirror: mirror(), stateStore, id: event.params.improveId, after: event.data?.after
    });
    console.log('manual_improve Firebase -> Notion sync', {
      improveId: event.params.improveId, action: result.action, pageId: result.pageId || null
    });
  }
);

function queryKey(req) {
  const value = req.query?.key;
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

exports.notionManualWebhook = onRequest(
  { secrets: [notionApiKey, notionDataSourceId, notionWebhookKey], timeoutSeconds: 30 },
  async (req, res) => {
    const expectedKey = notionWebhookKey.value();
    const providedKey = queryKey(req);
    if (providedKey !== expectedKey) {
      res.status(401).json({ ok: false, action: 'invalid-webhook-key' });
      return;
    }

    if (req.method === 'GET') {
      const token = await tokenStore.get();
      if (!token) {
        res.status(404).json({ ok: false, action: 'verification-token-not-received' });
        return;
      }
      res.status(200).json({ ok: true, verification_token: token });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, action: 'method-not-allowed' });
      return;
    }

    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody.toString('utf8')
      : typeof req.rawBody === 'string'
        ? req.rawBody
        : '';

    try {
      const result = await handleNotionWebhook({
        rawBody,
        body: req.body,
        headers: req.headers,
        expectedWebhookKey: expectedKey,
        providedWebhookKey: providedKey,
        tokenStore,
        dispatch: (pageId) => dispatchNotionPage({ mirror: mirror(), repo, stateStore, pageId })
      });
      res.status(result.status).json({ ok: result.status < 300, action: result.action, firebaseId: result.firebaseId || null });
    } catch (error) {
      console.error('Notion -> manual_improve sync failed', error);
      res.status(500).json({ ok: false, action: 'sync-error' });
    }
  }
);
