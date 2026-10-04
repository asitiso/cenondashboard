# 주문·업무 찾기 Implementation Plan
> 실행: superpowers:executing-plans를 사용하여 현재 세션에서 순차 구현한다.
**Goal:** 승인한 화면을 실제 검색·저장·주문 기능과 연결한다.
**Architecture:** 기존 useOrderData/Firestore/IndexedDB/PurchaseImport를 유지하고 OrderApp의 UI를 작은 React 컴포넌트로 나눈다. 거래처별 최근 기록과 설정은 하위 호환 필드로 확장한다.
**Tech Stack:** React19, TypeScript, Vite6, Firebase11, SheetJS, Vitest, ZXing.
**Spec:** ../specs/2026-10-04-order-implementation.md
## Global Constraints
한국어, 기존 업무 대비 시간절약, 운영 대시보드 변경 금지, 원본 단가/날짜 보존, 할인/할증 보정 없음, 단위 추정 금지, 모바일 반응형.
## Review Focus
- 오래된 저가 거래처가 최근 매입처보다 위에 배치되지 않는다.
- 여러 포장 바코드 연결시 기존 코드가 지워지지 않는다.
- 폴더 자기/하위 이동 금지와 삭제 내용 보존.
- 가져오기 검색이 숨긴 선택을 지우지 않는다.
- 파일 오류/공유 충돌시 기존 자료 유지, 사이트 주소 비워도 검색 가능.
## Tasks
- [x] 1. types.ts/core.ts 및 workspace.ts: supplierHistory, 정렬/단위/가격상승, 바코드/폴더/가져오기 순수 함수. workspace.test.ts 실패→구현→통과.
- [x] 2. Favorites.tsx 및 ImportPanels.tsx: 중첩 편집, 포인터 드래그, 선택 유지/중복 건수/복귀. 위 순수 함수 사용.
- [x] 3. SearchCard.tsx/OrderApp.tsx/order.css: 확정 밀도, 거래처 범위, 비교표/이력, 연락처·단위·짧은 이름, 관리 하위 복귀, 글자/맨 위.
- [x] 4. BarcodeCamera.tsx 및 바코드 이벤트: 스캐너 전역 입력, 카메라 종료/실패/연결 처리.
- [x] 5. 실제 XLS로 개발 전용 snapshot 생성, Vitest 전체/TypeScript/빌드 및 실제 앱 검증. 민감 원본 파일은 제품 번들에 넣지 않는다.
## Ledger
사용자의 ‘실제구현으로 진행’은 누적 확정사항의 실행 승인이다. 목업만 수정하라는 과거 안내는 종료되었다. 배포는 아직 수행하지 않는다. 리뷰는 서브에이전트 없이 직접 수행한다.

## 완료 검증
실제 XLS 33,905행을 포함한 21파일 92검증 통과. 타입 검사·Vite 제품 빌드 통과. 실제 브라우저에서 상품 비교표의 최신 단가/날짜, 390px 긴 상품명 겹침 없음, 거래처 일부 검색→1,006개 품목 진입, 새로고침 뒤 자료·북마크 유지, 중첩 편집 닫기→관리 복귀, 새 사이트 거래처 미선택 기본값을 확인했다. 콘솔 오류/경고 없음. 운영 대시보드 본체 수정 없음. 물리적 스캐너·카메라, 공용 Firebase 연결·배포는 실제 환경 후속 검증이며 완료로 주장하지 않는다. 큰 번들 경고는 유지한다.
