import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "./normalize";
import type { DashboardItem } from "../types";

export const mockItems: DashboardItem[] = [
  normalizeTopic("topic-stock-rule", {
    title: "입고 검수 체크 항목 변경",
    body: "냉장 의약품 입고 시 온도 확인 기록을 먼저 남기도록 순서를 조정했습니다.",
    status: "open",
    assignee: "김관리",
    tags: ["입고", "냉장"],
    updatedAt: "2026-07-07T08:20:00+09:00",
    dueAt: "2026-07-07T18:00:00+09:00"
  }),
  normalizeTopic("topic-counter-note", {
    subject: "복약 안내 문구 업데이트",
    memo: "고객 응대 문구가 바뀐 항목이 있어 확인 후 반영이 필요합니다.",
    state: "progress",
    owner: "박약사",
    tags: ["복약", "응대"],
    updatedAt: "2026-06-28T09:00:00+09:00",
    deadline: "2026-07-08T18:00:00+09:00"
  }),
  normalizeManualImprove("manual-price-check", {
    manualTitle: "가격표 확인 절차",
    proposal: "행사 종료 후 가격표 제거 누락을 막기 위한 확인 순서 추가 요청",
    reviewStatus: "pending",
    requester: "정직원",
    tags: "가격표,행사",
    createdAt: "2026-07-06T14:00:00+09:00"
  }),
  normalizeManualImprove("manual-return-box", {
    section: "반품 박스 위치",
    reason: "신입 직원이 위치를 자주 헷갈려 사진 기준 설명을 추가하면 좋겠습니다.",
    state: "waiting",
    writer: "이직원",
    createdAt: "2026-06-25T10:00:00+09:00"
  }),
  normalizeDrug("rx-atorva", {
    name: "아토르바정 10mg",
    location: "전문약 A-3, 유효기간 라벨 재확인 필요",
    expiryDate: "2026-07-09T00:00:00+09:00",
    status: "review",
    manager: "전문약 담당"
  }, "Q1"),
  normalizeDrug("rx-amoxi", {
    drugName: "아목시캡슐",
    memo: "기한 초과 재고 격리 확인 필요",
    expiresAt: "2026-07-01T00:00:00+09:00",
    owner: "박약사"
  }, "Q1"),
  normalizeDrug("otc-vitamin", {
    productName: "센트럴 비타민C",
    note: "매대 전면 2개, 창고 4개",
    expiration: "2026-07-15T00:00:00+09:00",
    state: "open",
    manager: "일반약 담당"
  }, "Q2"),
  normalizeDrug("otc-cold", {
    name: "콜드케어 시럽",
    memo: "장기 미처리. 수량 재확인 후 처리 필요",
    expiryDate: "2026-07-20T00:00:00+09:00",
    status: "progress",
    updatedAt: "2026-06-20T09:00:00+09:00"
  }, "Q2")
];
