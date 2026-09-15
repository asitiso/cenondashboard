# Firebase ↔ Notion 매뉴얼 개선 양방향 동기화 설계

## 목표

Firestore `manual_improve/{improveId}`와 Notion `매뉴얼 개선 · 동기화 DB`를 양방향으로 동기화한다. 대시보드나 약국업무비서에서 수정한 내용은 Notion으로, Notion 관리자 편집 보기에서 수정한 내용은 같은 Firestore 문서로 반영한다. 직원에게는 동일 데이터를 단순화한 `직원용 빠른 찾기` 화면으로 제공한다.

## 핵심 원칙

- Firebase와 Notion의 업무 필드는 양쪽에서 편집 가능하다.
- 대시보드는 기존 Firestore `onSnapshot()`을 그대로 사용하므로 Notion → Firebase 반영 뒤 별도 대시보드 동기화 코드는 필요하지 않다.
- `manual_improve` 전체 컬렉션을 반복 조회하거나 폴링하지 않는다.
- Firebase 변경은 Firestore document trigger의 해당 문서 snapshot만 사용한다.
- Notion 변경은 webhook이 알려 준 해당 page만 읽고, 연결된 Firebase 문서 한 건만 읽거나 쓴다.
- 동기화 메타데이터는 업무 문서에 섞지 않고 `_sync_manual_improve_notion/{firebaseId}`에 둔다.
- 업무 필드의 canonical SHA-256 hash가 같으면 반대편 write를 생략해 Firebase → Notion → Firebase 무한 왕복을 막는다.
- 삭제는 실수 방지를 위해 자동 양방향 삭제 대상에서 제외한다. 생성·수정만 자동 동기화한다.
- 기존 `content`, `proposedContent` 같은 구형 Firestore 필드는 읽기 호환하며 원본 필드를 삭제하지 않는다.

## 데이터 위치

Firebase project: `todaysell-d4bbc`

- 업무 데이터: `manual_improve/{improveId}`
- 동기화 상태: `_sync_manual_improve_notion/{improveId}`
- Notion webhook verification token: `_sync_manual_improve_notion_config/webhook`

Notion:

- Hub: `약국 업무비서 · 매뉴얼 개선`
- Database: `매뉴얼 개선 · 동기화 DB`
- Data source ID: `d2a8faa8-5de1-4104-882c-2ab274afe0e4`

## 양방향 업무 필드

- 업무명 ↔ `title`
- 분류 ↔ `category`
- 상태 ↔ `status`
- 우선순위 ↔ `priority`
- 직원용 한줄 요약 ↔ `staffSummary`
- 현재 문제 ↔ `currentProblem`
- 확인된 사실 ↔ `confirmedFact`
- 개선 제안 ↔ `proposal`

Notion의 `Firebase ID`, `동기화 상태`, `마지막 동기화`, `원본 수정일`, `작성 경로`는 시스템 관리 필드다. 직원용/관리자 편집 기본 화면에서는 기술 필드를 숨긴다.

## 직원용 UX

직원은 `직원용 빠른 찾기`를 기본으로 사용한다. 기술 필드나 동기화 구조를 노출하지 않고 업무명, 분류, 상태, 우선순위, 한줄 요약 중심으로 빠르게 찾는다.

관리자는 `관리자 편집` 보기에서 다음 업무 필드만 수정한다.

- 업무명
- 분류
- 상태
- 우선순위
- 직원용 한줄 요약
- 현재 문제
- 확인된 사실
- 개선 제안

## Firebase → Notion

Cloud Functions 2nd gen `onDocumentWritten('manual_improve/{improveId}')`를 사용한다.

1. 삭제 이벤트면 자동 삭제하지 않고 종료한다.
2. 변경 문서 snapshot을 canonical 업무 데이터로 변환한다.
3. SHA-256 hash를 계산한다.
4. `_sync_manual_improve_notion/{improveId}`의 `lastSyncedHash`와 같으면 Notion write를 생략한다.
5. 다르면 Notion에서 `Firebase ID == improveId`인 페이지를 한 건 조회한다.
6. 없으면 생성, 있으면 수정한다.
7. 성공 후 sync-state에 hash, source=`firebase`, Notion page ID를 기록한다.

## Notion → Firebase

Notion webhook에서 `page.created`, `page.properties_updated`를 수신한다.

1. webhook private query key를 먼저 검사한다.
2. 최초 verification payload의 `verification_token`은 별도 config 문서에 저장한다.
3. 이후 이벤트는 `X-Notion-Signature` HMAC-SHA256을 raw body 기준으로 검증한다.
4. webhook이 알려 준 Notion page 한 건을 최신 상태로 가져온다.
5. 대상 data source가 아니면 무시한다.
6. 업무 필드를 canonical 형태로 변환하고 hash를 계산한다.
7. `Firebase ID`가 있으면 해당 Firestore 문서 한 건만 읽는다.
8. Firebase와 이미 같은 업무 데이터면 write를 생략한다.
9. 다르면 sync-state에 hash/source=`notion`을 먼저 기록한 뒤 Firestore 문서를 update한다. 이어 발생하는 Firebase trigger는 같은 hash를 보고 Notion 재쓰기를 생략한다.
10. Notion에서 새 행을 만들었고 `Firebase ID`가 비어 있으면 `notion_<NotionPageId>` 형식의 결정적 문서 ID를 생성해 Firestore에 set하고, 그 ID를 Notion에 기록한다. webhook 재시도에도 중복 문서가 생기지 않는다.

## 충돌 규칙

양쪽에서 거의 동시에 수정할 경우 webhook/trigger가 처리할 때 가져온 최신 상태가 반영되는 last-write-wins 방식이다. 이벤트 payload 자체의 오래된 값을 신뢰하지 않고 각 대상의 최신 값을 읽는다.

## 구형 스키마 호환

기존 업무비서 데이터는 다음처럼 읽기 호환한다.

- `currentProblem`이 없으면 `content`
- `proposal`이 없으면 `proposedContent`
- 제목은 `title`, `manualTitle`, `section`, `subject` 순으로 허용
- 상태는 `status`, `reviewStatus`를 허용

동기화가 이루어져도 기타 구형/추가 Firestore 필드는 삭제하지 않는다. Notion에서 수정할 때 필요한 canonical 업무 필드만 merge/update한다.

## 초기 전체 이관

기존 문서 전체 최초 이관은 운영 `(default)` DB를 직접 전수 스캔하지 않는다. 임시 Firestore clone을 만든 뒤 clone의 `manual_improve`를 JSONL로 추출하고, 같은 Notion upsert 로직으로 1회 backfill한다.

실시간 동기화가 켜진 뒤에는 전체 backfill이나 전체 컬렉션 폴링을 반복하지 않는다.

## 보안

Firebase Functions secrets:

- `NOTION_API_KEY`
- `NOTION_DATA_SOURCE_ID`
- `NOTION_WEBHOOK_KEY`

Notion API token은 프런트 번들/Git 저장소에 넣지 않는다. Webhook endpoint URL에는 추측하기 어려운 `NOTION_WEBHOOK_KEY`를 query parameter로 사용하고, 실제 webhook body는 Notion verification token으로 HMAC 검증한다.

## 자동 삭제 정책

현재 자동 삭제 동기화는 비활성화한다.

- Firebase 문서 삭제 → Notion 자동 삭제하지 않음
- Notion 페이지 휴지통 → Firebase 자동 삭제하지 않음

삭제는 복구 비용이 크기 때문에 생성·수정 동기화가 안정화된 뒤 별도 정책으로 추가한다.

## 테스트 범위

- Firebase/Notion canonical shape와 동일 hash
- 구형 `content` / `proposedContent` 호환
- 동일 hash일 때 왕복 write 생략
- Firebase 변경 → Notion upsert
- Notion 변경 → Firebase update
- Notion 신규 행 → 결정적 Firebase ID 생성
- Notion webhook private key/HMAC 검증
- webhook verification token 저장/캐시
- sync metadata가 `manual_improve`와 분리됨
- Firebase write 실패 시 sync-state rollback
- 삭제 이벤트 자동 삭제 제외
