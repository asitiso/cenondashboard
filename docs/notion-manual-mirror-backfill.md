# Notion 매뉴얼 미러 초기 전체 이관

## 목적

운영 Firestore `(default)`의 `manual_improve`를 직접 전수 조회하지 않고, 임시 clone 데이터베이스에서 전체 항목을 꺼내 Notion `매뉴얼 개선 미러`에 한 번 이관한다.

이후에는 Cloud Function `syncManualImproveToNotion`이 Firestore 변경 이벤트 snapshot만 사용하므로 전체 이관을 다시 실행하지 않는다.

## 준비

- Firebase/Google Cloud 프로젝트: `todaysell-d4bbc`
- Notion data source ID: `d2a8faa8-5de1-4104-882c-2ab274afe0e4`
- Firebase CLI 또는 gcloud CLI 로그인
- Notion integration token

## 1. 운영 DB를 임시 clone으로 복제

Firestore database clone은 PITR 데이터를 사용해 새 데이터베이스를 만들며, 원본과 별도 데이터베이스로 생성된다.

Firebase CLI 예시:

```bash
firebase firestore:databases:clone \
  'projects/todaysell-d4bbc/databases/(default)' \
  'projects/todaysell-d4bbc/databases/notion-manual-bootstrap'
```

`snapshot-time`을 지정하지 않으면 Firebase CLI가 현재 시각을 분 단위로 맞춘 snapshot을 선택한다. 이미 같은 이름의 데이터베이스가 있으면 다른 임시 이름을 사용한다.

> 임시 clone 생성에는 해당 프로젝트의 Firestore 데이터베이스 clone 권한이 필요하다.

## 2. clone의 manual_improve만 JSONL로 추출

운영 `(default)` DB를 실수로 읽지 않도록 export 스크립트는 `(default)`를 명시하면 즉시 실패한다.

```bash
node functions/scripts/export-manual-improve-from-clone.cjs \
  notion-manual-bootstrap \
  /tmp/manual-improve.jsonl
```

필요하면 프로젝트를 명시한다.

```bash
FIREBASE_PROJECT_ID=todaysell-d4bbc \
node functions/scripts/export-manual-improve-from-clone.cjs \
  notion-manual-bootstrap \
  /tmp/manual-improve.jsonl
```

스크립트는 `gcloud auth print-access-token`을 사용한다. 이미 발급한 토큰이 있으면 `GCLOUD_ACCESS_TOKEN` 환경변수로 전달할 수 있다.

JSONL 각 줄은 다음 형태다.

```json
{"id":"Firestore 문서 ID","data":{"title":"...","currentProblem":"...","confirmedFact":"...","proposal":"..."}}
```

## 3. Notion으로 1회 backfill

```bash
export NOTION_API_KEY='secret_...'
export NOTION_DATA_SOURCE_ID='d2a8faa8-5de1-4104-882c-2ab274afe0e4'
node functions/scripts/backfill-from-jsonl.cjs /tmp/manual-improve.jsonl
```

기본적으로 항목 사이에 750ms 간격을 둔다. 필요하면 다음처럼 조정한다.

```bash
NOTION_BACKFILL_DELAY_MS=1000 \
node functions/scripts/backfill-from-jsonl.cjs /tmp/manual-improve.jsonl
```

동일 Firebase ID가 이미 Notion에 있으면 새 행을 만들지 않고 업데이트한다. 같은 Firebase ID가 Notion에 둘 이상 있으면 자동으로 하나를 선택하지 않고 오류로 중단한다.

## 4. 검증

- export가 출력한 `manual_improve` 레코드 수를 기록한다.
- Notion `매뉴얼 개선 미러`의 `동기화 점검` 보기에서 Firebase ID 누락과 중복을 확인한다.
- 직원용 `빠른 찾기`에서 업무명, 분류, 한줄 요약, 상태, 우선순위가 읽기 쉽게 보이는지 확인한다.
- 1개 항목을 업무비서 또는 대시보드에서 수정해 증분 동기화가 같은 Firebase ID 행을 갱신하는지 확인한다.

## 5. 임시 clone 정리

전체 이관과 검증이 끝난 뒤 임시 데이터베이스가 더 이상 필요하지 않으면 삭제한다.

```bash
gcloud firestore databases delete --database=notion-manual-bootstrap
```

삭제 전 반드시 이름이 `(default)`가 아닌 임시 clone인지 다시 확인한다.

## 장애 시 원칙

- 운영 Firestore 전수 조회로 우회하지 않는다.
- Notion에서 원본 내용을 직접 고쳐 맞추지 않는다.
- Notion API 오류가 나면 원본 Firebase는 그대로 두고 재시도한다.
- 불일치가 발견되면 Firebase ID를 기준으로 원본과 미러를 비교한다.
