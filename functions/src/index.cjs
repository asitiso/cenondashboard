const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { createNotionMirror } = require('./notionMirror.cjs');
const { dispatchManualWrite } = require('./firestoreDispatch.cjs');

const notionApiKey = defineSecret('NOTION_API_KEY');
const notionDataSourceId = defineSecret('NOTION_DATA_SOURCE_ID');

exports.syncManualImproveToNotion = onDocumentWritten(
  {
    document: 'manual_improve/{improveId}',
    secrets: [notionApiKey, notionDataSourceId],
    retry: true
  },
  async (event) => {
    const mirror = createNotionMirror({
      apiKey: notionApiKey.value(),
      dataSourceId: notionDataSourceId.value()
    });

    const result = await dispatchManualWrite({
      mirror,
      id: event.params.improveId,
      after: event.data?.after
    });

    console.log('manual_improve Notion mirror sync', {
      improveId: event.params.improveId,
      action: result.action,
      pageId: result.pageId || null
    });
  }
);
