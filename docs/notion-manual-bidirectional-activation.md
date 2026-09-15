# 매뉴얼 개선 Firebase ↔ Notion 양방향 동기화 활성화

이 문서는 구현된 양방향 동기화를 실제 운영에 켜는 1회 절차다.

## 최종 흐름

- 약국업무비서 / 대시보드 → Firestore `manual_improve` → Cloud Function → Notion
- Notion `관리자 편집` → Notion webhook → Cloud Function → Firestore `manual_improve` → 기존 dashboard `onSnapshot()` → 대시보드
- 직원은 Notion `직원용 빠른 찾기`를 사용한다.

전체 `manual_improve` 컬렉션을 주기적으로 폴링하지 않는다.

## 1. Notion Integration 준비

Notion API integration이 `매뉴얼 개선 · 동기화 DB`에 접근할 수 있도록 연결한다.

필요 권한:

- Read content
- Update content
- Insert content

Data source ID:

```text
d2a8faa8-5de1-4104-882c-2ab274afe0e4
```

## 2. Firebase Functions secret 설정

저장소 루트에서 Firebase CLI로 아래 secret을 한 번 설정한다.

```bash
firebase functions:secrets:set NOTION_API_KEY
firebase functions:secrets:set NOTION_DATA_SOURCE_ID
firebase functions:secrets:set NOTION_WEBHOOK_KEY
```

값:

- `NOTION_API_KEY`: 위 Notion integration token
- `NOTION_DATA_SOURCE_ID`: `d2a8faa8-5de1-4104-882c-2ab274afe0e4`
- `NOTION_WEBHOOK_KEY`: 충분히 긴 임의 문자열. Git에 저장하지 않는다.

## 3. Functions 배포

```bash
firebase deploy --only functions:syncManualImproveToNotion,functions:notionManualWebhook
```

배포 후 `notionManualWebhook` HTTPS URL을 기록한다.

## 4. Notion webhook 구독

Webhook URL에는 2단계의 첫 번째 보호막으로 private query key를 붙인다.

```text
<notionManualWebhook HTTPS URL>?key=<NOTION_WEBHOOK_KEY>
```

구독 이벤트:

- `page.created`
- `page.properties_updated`

Notion이 최초 verification payload를 POST하면 함수가 `verification_token`을 다음 문서에 저장한다.

```text
_sync_manual_improve_notion_config/webhook
```

같은 URL을 GET하면 저장된 verification token을 확인할 수 있다.

```text
GET <notionManualWebhook HTTPS URL>?key=<NOTION_WEBHOOK_KEY>
```

그 token으로 Notion webhook verification을 완료한다.

이후 실제 webhook은 `X-Notion-Signature` HMAC-SHA256 검증을 통과해야 처리된다.

## 5. 왕복 동기화 확인

### 대시보드 → Notion

1. 대시보드의 매뉴얼 개선 항목 하나를 수정한다.
2. Firestore `manual_improve/{id}`가 변경된다.
3. Notion 같은 `Firebase ID` 항목이 갱신되는지 확인한다.

### Notion → 대시보드

1. Notion `관리자 편집` 보기에서 `현재 문제` 같은 업무 필드를 수정한다.
2. Notion webhook이 해당 page ID를 전달한다.
3. 함수가 최신 Notion page 한 건을 가져와 같은 Firestore 문서를 수정한다.
4. 기존 dashboard `onSnapshot()`이 Firestore 변경을 받아 화면을 갱신한다.

동기화 왕복은 `_sync_manual_improve_notion/{firebaseId}`의 canonical hash로 차단한다.

## 6. 기존 데이터 최초 전체 이관

기존 `manual_improve` 전체는 실시간 trigger를 배포했다고 자동으로 과거 이벤트가 발생하지 않으므로 1회 backfill이 필요하다.

운영 `(default)` Firestore를 전수 조회하는 대신 **임시 clone DB**를 만들고 clone만 읽는다.

clone의 `manual_improve`를 JSONL로 추출:

```bash
cd functions
npm run export:manual-clone -- \
  --project todaysell-d4bbc \
  --database <TEMP_CLONE_DATABASE_ID> \
  --out /tmp/manual-improve.jsonl
```

그 JSONL을 Notion으로 1회 backfill:

```bash
NOTION_API_KEY='<integration token>' \
NOTION_DATA_SOURCE_ID='d2a8faa8-5de1-4104-882c-2ab274afe0e4' \
npm run backfill:notion -- /tmp/manual-improve.jsonl
```

`export:manual-clone`은 database ID가 `(default)`이면 실행을 거부한다.

Backfill 완료 후 임시 clone은 삭제한다.

## 편집 규칙

Notion `관리자 편집`에서 수정하는 필드:

- 업무명
- 분류
- 상태
- 우선순위
- 직원용 한줄 요약
- 현재 문제
- 확인된 사실
- 개선 제안

직접 수정하지 않는 시스템 필드:

- Firebase ID
- 동기화 상태
- 마지막 동기화
- 원본 수정일
- 작성 경로

## 삭제 정책

현재 자동 삭제 동기화는 하지 않는다.

- Firebase에서 삭제해도 Notion을 자동 휴지통 처리하지 않는다.
- Notion에서 휴지통 처리해도 Firebase 문서를 자동 삭제하지 않는다.

생성·수정 양방향 동기화가 안정적으로 운영된 뒤 삭제 정책은 별도로 추가한다.
