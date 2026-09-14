# Firebase → Notion 매뉴얼 개선 미러 설계

## 목표

Firestore `manual_improve/{improveId}`를 유일한 원본으로 유지하면서, 센트럴온누리약국 직원이 Notion에서 보기 좋은 형태로 매뉴얼 개선 내용을 확인할 수 있게 한다. 동기화 때문에 `manual_improve` 컬렉션 전체를 반복 조회하지 않는다.

## 원칙

- Firebase가 유일한 Source of Truth다.
- Notion은 읽기 전용 미러이며 원본 업무 데이터는 Notion에서 수정하지 않는다.
- 증분 동기화 경로에서는 Firestore 쿼리를 실행하지 않는다. Firestore trigger가 제공하는 변경 문서 snapshot만 사용한다.
- Notion 행은 `Firebase ID`로 식별하여 재시도에도 중복 생성되지 않는 idempotent upsert로 처리한다.
- 삭제된 Firebase 문서는 대응하는 Notion 페이지를 `in_trash=true`로 이동한다.
- 초기 전체 이관은 운영 컬렉션을 반복 스캔하지 않고 Firestore 백업/복원본 또는 그 복원본에서 만든 JSON snapshot을 사용한다.

## 현재 구조

프런트엔드 `src/hooks/useDashboardData.ts`는 `manual_improve` 전체 컬렉션에 `onSnapshot()`을 연결한다. 대시보드 자체의 기존 동작은 이번 작업에서 변경하지 않는다. 이번 기능은 별도 `functions/` 서버리스 백엔드로 추가한다.

Firebase 프로젝트 ID는 기존 프런트 설정과 동일한 `todaysell-d4bbc`를 사용한다.

## Notion 목적지

- Hub: `약국 업무비서 · 매뉴얼 개선`
- Database: `매뉴얼 개선 미러`
- Data source ID: `d2a8faa8-5de1-4104-882c-2ab274afe0e4`

미러 속성:

- `업무명`
- `분류`
- `상태`
- `우선순위`
- `직원용 한줄 요약`
- `현재 문제`
- `확인된 사실`
- `개선 제안`
- `작성 경로`
- `Firebase ID`
- `원본 수정일`
- `동기화 상태`
- `마지막 동기화`

직원용 보기는 기술 필드를 숨기고 `업무명 → 분류 → 한줄 요약 → 상태 → 우선순위` 중심으로 표시한다. 관리자는 별도 동기화 점검 보기에서 Firebase ID와 날짜를 확인한다.

## 동기화 아키텍처

Cloud Functions for Firebase 2nd gen의 `onDocumentWritten`을 `manual_improve/{improveId}`에 연결한다.

1. 생성/수정 이벤트
   - `event.data.after.data()`를 읽는다.
   - Firebase document ID를 `Firebase ID`로 사용한다.
   - Notion data source를 `Firebase ID == improveId` 조건으로 한 건만 조회한다.
   - 없으면 새 페이지를 만들고, 있으면 기존 페이지 속성을 갱신한다.
   - `동기화 상태=동기화완료`, `마지막 동기화=현재 시각`을 기록한다.
2. 삭제 이벤트
   - 같은 Firebase ID의 Notion 페이지를 조회한다.
   - 있으면 `PATCH /v1/pages/{pageId}`에 `in_trash: true`를 보낸다.
   - 없으면 성공으로 종료한다.
3. 실패
   - 함수가 예외를 다시 던져 Firebase의 2nd gen retry 정책이 재시도할 수 있게 한다.
   - upsert가 Firebase ID 기반이라 재실행해도 중복이 생기지 않는다.

## 값 정규화

Notion select 속성에 없는 값 때문에 전체 동기화가 실패하지 않도록 정규화한다.

- 분류: 허용 목록 밖 값은 `기타`
- 상태: `검토중`, `검토완료`, `반영완료`; 없거나 알 수 없으면 `검토중`
- 우선순위: `높음`, `중`, `보통`; `중간`은 `중`, 나머지 미지정 값은 `보통`
- 작성 경로: `createdBy == dashboard`이면 `대시보드`; `assistant`, `gpt`, `업무비서` 계열이면 `업무비서`; 나머지는 `기타`
- 직원용 한줄 요약: `confirmedFact → proposal → currentProblem → title` 순으로 첫 번째 비어 있지 않은 텍스트를 선택하고 공백을 정리한 뒤 120자로 제한한다.
- 원본 수정일: Firestore `updatedAt`, 없으면 `createdAt`; Timestamp를 ISO 8601로 변환한다.

## Notion API

- API version: `2026-03-11`
- 조회: `POST /v1/data_sources/{data_source_id}/query`
- 생성: `POST /v1/pages`
- 수정/휴지통: `PATCH /v1/pages/{page_id}`
- 인증 토큰은 `NOTION_API_KEY` secret으로 관리한다.
- data source ID는 `NOTION_DATA_SOURCE_ID` secret으로 관리한다.

## 초기 전체 이관

실시간 trigger는 배포 이후 변경부터 처리하므로 기존 문서에는 별도 1회 backfill이 필요하다.

운영 DB에 지속적인 전수 listener를 추가하지 않는다. Firestore 백업을 별도 복원 위치에 복원한 뒤 `manual_improve`만 JSON Lines(`.jsonl`)로 추출하고, `functions/scripts/backfill-from-jsonl.cjs`가 동일한 Notion upsert 함수를 재사용해 한 번 이관한다.

JSONL 한 줄 형식:

```json
{"id":"firestore-document-id","data":{"title":"...","currentProblem":"...","confirmedFact":"...","proposal":"...","category":"...","priority":"...","status":"...","createdBy":"...","updatedAt":"2026-09-15T00:00:00.000Z"}}
```

backfill은 운영 Firestore를 직접 조회하지 않는다.

## 보안

- Notion 토큰을 프런트 번들에 넣지 않는다.
- 토큰과 data source ID는 Firebase Secret Manager parameter로 함수에만 바인딩한다.
- Git 저장소에는 secret 값이 들어가지 않는다.

## 테스트

외부 네트워크 없이 테스트 가능한 순수 동기화 모듈을 분리한다.

- 값 정규화
- Notion property payload 생성
- Firebase ID로 조회
- 신규 생성
- 기존 수정
- 삭제 시 휴지통 처리
- Notion API 오류를 예외로 전달
- 모든 요청에 `Notion-Version: 2026-03-11` 포함

## 비범위

- 대시보드의 기존 `onSnapshot` 구조 최적화
- Notion → Firebase 역방향 동기화
- Notion에서 직원이 원본 내용을 수정하는 기능
- AI가 매뉴얼 내용을 새로 생성하거나 재작성하는 기능
