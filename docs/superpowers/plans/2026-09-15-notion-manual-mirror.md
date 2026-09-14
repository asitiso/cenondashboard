# Firebase → Notion Manual Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firestore `manual_improve` 변경을 추가 Firestore 조회 없이 Notion `매뉴얼 개선 미러`에 idempotent하게 반영하고, 백업본 JSONL로 기존 데이터를 1회 이관한다.

**Architecture:** Firebase Functions 2nd gen `onDocumentWritten`이 변경 snapshot을 받아 순수 `notionMirror` 모듈에 전달한다. 미러 모듈은 Firebase ID로 Notion 한 건만 조회해 create/update/trash를 수행하며, backfill 스크립트도 같은 upsert 함수를 재사용한다.

**Tech Stack:** Node.js 22, Cloud Functions for Firebase 2nd gen, native `fetch`, Node built-in test runner, Notion REST API 2026-03-11.

**Spec:** `docs/superpowers/specs/2026-09-15-notion-manual-mirror-design.md`

## Global Constraints

- Firebase `manual_improve`가 유일한 원본이다.
- 증분 동기화 코드에서 Firestore collection query를 호출하지 않는다.
- Notion 수정은 함수와 backfill을 통해서만 수행한다.
- Notion API token은 Firebase Secret Manager에만 저장한다.
- 모든 Notion 요청은 `Notion-Version: 2026-03-11`을 사용한다.
- 같은 Firebase ID의 이벤트 재실행은 Notion 중복 페이지를 만들지 않는다.

---

### Task 1: 순수 Notion 미러 모듈

**Files:**
- Create: `functions/src/notionMirror.cjs`
- Create: `functions/test/notionMirror.test.cjs`

**Interfaces:**
- Produces: `createNotionMirror({ apiKey, dataSourceId, fetchImpl?, now? })`
- Produces mirror methods: `normalizeManual(id, data)`, `upsertManual(id, data)`, `trashManual(id)`
- No Firebase SDK dependency.

- [ ] **Step 1: Write failing tests**

Cover these exact behaviors:

```js
node:test cases:
- normalizeManual maps unknown category to 기타
- normalizeManual maps 중간 priority to 중
- normalizeManual makes a 120-char-or-shorter summary from confirmedFact first
- upsertManual queries /v1/data_sources/{id}/query with rich_text equals Firebase ID
- upsertManual POSTs /v1/pages when query returns no result
- upsertManual PATCHes /v1/pages/{pageId} when a result exists
- trashManual PATCHes in_trash:true when a result exists
- trashManual does nothing when no result exists
- non-2xx Notion responses reject with endpoint/status details
- every request sends Notion-Version: 2026-03-11
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test functions/test/notionMirror.test.cjs
```

Expected: FAIL because `../src/notionMirror.cjs` does not exist.

- [ ] **Step 3: Implement the minimum mirror module**

Implement:

```js
const NOTION_VERSION = "2026-03-11";
const ALLOWED_CATEGORIES = new Set(["일반약", "조제", "고객응대", "주문·반품", "재고·발주", "동물약", "청구·보험", "매장관리", "안전관리", "비품관리", "직원교육", "응급상황", "기타"]);

function createNotionMirror({ apiKey, dataSourceId, fetchImpl = fetch, now = () => new Date() }) {
  // request(), queryByFirebaseId(), normalizeManual(), buildProperties(),
  // upsertManual(), trashManual()
}

module.exports = { createNotionMirror };
```

Notion property payload must set the exact Korean schema property names from the design spec.

- [ ] **Step 4: Run test and verify GREEN**

Run:

```bash
node --test functions/test/notionMirror.test.cjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add idempotent Notion manual mirror client`

---

### Task 2: Firestore event wrapper

**Files:**
- Create: `functions/src/index.cjs`
- Create: `functions/package.json`
- Create: `firebase.json`
- Create: `.firebaserc`

**Interfaces:**
- Consumes: `createNotionMirror()` from Task 1.
- Produces: exported Cloud Function `syncManualImproveToNotion`.

- [ ] **Step 1: Add a contract test**

Extend `functions/test/notionMirror.test.cjs` with a small exported helper test if necessary so the event dispatch rule is explicit: after snapshot → upsert; missing after snapshot → trash.

- [ ] **Step 2: Run test and verify RED if helper is introduced**

```bash
node --test functions/test/notionMirror.test.cjs
```

- [ ] **Step 3: Add Firebase Functions configuration**

`functions/package.json`:

```json
{
  "name": "central-onnuri-functions",
  "private": true,
  "main": "src/index.cjs",
  "engines": { "node": "22" },
  "scripts": { "test": "node --test test/*.test.cjs" },
  "dependencies": { "firebase-functions": "^7.3.2" }
}
```

`firebase.json`:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  }
}
```

`.firebaserc`:

```json
{
  "projects": { "default": "todaysell-d4bbc" }
}
```

- [ ] **Step 4: Add the event function**

Use:

```js
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
```

Define `NOTION_API_KEY` and `NOTION_DATA_SOURCE_ID` secrets, bind both under `secrets`, set `retry: true`, and listen to `manual_improve/{improveId}`. Use only `event.data.after.data()` / `event.params.improveId`; do not query Firestore.

- [ ] **Step 5: Run unit tests**

```bash
node --test functions/test/notionMirror.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: sync manual improvements to Notion on write`

---

### Task 3: Backup-snapshot backfill

**Files:**
- Create: `functions/scripts/backfill-from-jsonl.cjs`
- Create: `functions/test/backfill.test.cjs`
- Create: `docs/notion-manual-mirror-backfill.md`

**Interfaces:**
- Consumes: `createNotionMirror()` from Task 1.
- Input: UTF-8 JSONL records `{ "id": string, "data": object }`.
- Secrets: `NOTION_API_KEY`, `NOTION_DATA_SOURCE_ID` environment variables when run manually.

- [ ] **Step 1: Write failing parser/runner tests**

Tests:

```js
- blank lines are ignored
- each valid line calls upsertManual(id, data) exactly once
- malformed JSON rejects with the 1-based line number
- missing id rejects with the line number
- runner can process records sequentially to respect Notion rate limits
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test functions/test/backfill.test.cjs
```

- [ ] **Step 3: Implement JSONL backfill**

The script must not import Firebase SDK and must not read live Firestore. It reads a file path argument, then reuses the same mirror upsert.

- [ ] **Step 4: Document the one-time bootstrap procedure**

`docs/notion-manual-mirror-backfill.md` must state:

1. create a Firestore backup without adding a live collection listener;
2. restore it to a temporary/off-production location;
3. extract only `manual_improve` into the documented JSONL form;
4. set Notion secrets locally for the one-time run;
5. run `node functions/scripts/backfill-from-jsonl.cjs <snapshot.jsonl>`;
6. compare source record count with Notion mirror count and review errors before enabling employee use.

- [ ] **Step 5: Run all pure tests**

```bash
node --test functions/test/*.test.cjs
```

Expected: all PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add backup-based Notion mirror backfill`

---

### Task 4: Verification and deployment handoff

**Files:**
- Modify only if verification finds an issue.

- [ ] **Step 1: Static guard scan**

Confirm `functions/` contains no `firebase-admin`, `getFirestore`, `collection`, `getDocs`, `onSnapshot`, or client Firestore query calls.

- [ ] **Step 2: Run pure tests**

```bash
node --test functions/test/*.test.cjs
```

Expected: all PASS.

- [ ] **Step 3: Verify repository config**

Confirm Firebase project alias is `todaysell-d4bbc`, runtime is Node 22, and no secret values are committed.

- [ ] **Step 4: Deployment commands for the authorized Firebase environment**

```bash
firebase functions:secrets:set NOTION_API_KEY
firebase functions:secrets:set NOTION_DATA_SOURCE_ID
firebase deploy --only functions:syncManualImproveToNotion
```

Set `NOTION_DATA_SOURCE_ID` to:

```text
d2a8faa8-5de1-4104-882c-2ab274afe0e4
```

- [ ] **Step 5: Post-deploy smoke test**

Create or edit one disposable `manual_improve` record through the existing dashboard, confirm exactly one Notion row with the same Firebase ID changes, then delete the disposable Firebase record and confirm the Notion row moves to trash.

- [ ] **Step 6: Run the backup-based backfill once**

Only after incremental sync is verified, import the historical backup snapshot and compare counts.
