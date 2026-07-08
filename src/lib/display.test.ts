import { describe, expect, it, vi } from "vitest";
import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "./normalize";
import { getDenseRowMeta, getDenseRowTimeLabel, getDetailDescription, getDetailRows, getDrugListFacts } from "./display";

describe("dense row display helpers", () => {
  it("shows drug location and quantity instead of owner on home rows", () => {
    const item = normalizeDrug("drug-1", {
      name: "케프라액",
      loc: "C2",
      qty: "1",
      addedBy: "혜미"
    }, "Q1");

    expect(getDenseRowMeta(item)).toBe("위치 C2 / 수량 1");
  });

  it("labels drug dates as expiry dates on home rows", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "케프라액",
      exp: "2026-11-17"
    }, "Q1");

    expect(getDenseRowTimeLabel(item)).toBe("132일 남음");
    vi.useRealTimers();
  });

  it("keeps non-drug rows focused on owner and due date", () => {
    const item = normalizeTopic("topic-1", {
      title: "카드용지 주문",
      owner: "ChatGPT",
      dueAt: "2026-11-17"
    });

    expect(getDenseRowMeta(item)).toBe("ChatGPT");
    expect(getDenseRowTimeLabel(item)).toBe("2026년 11월 17일");
  });

  it("builds drug detail rows around expiry, location, quantity, and source path", () => {
    const item = normalizeDrug("drug-1", {
      name: "케프라액",
      exp: "2026-11-17",
      loc: "C2",
      qty: "1",
      pinned: true,
      addedBy: "혜미"
    }, "Q1");

    expect(getDetailRows(item)).toEqual([
      { label: "구분", value: "전문약" },
      { label: "우선", value: "예" },
      { label: "유효기간", value: "2026년 11월 17일" },
      { label: "위치", value: "C2" },
      { label: "수량", value: "1" },
      { label: "담당", value: "혜미" },
      { label: "원본 경로", value: "teams/Q1/drugs/drug-1" }
    ]);
  });

  it("splits manual improvement details into problem, fact, and proposal rows", () => {
    const item = normalizeManualImprove("manual-1", {
      title: "일반약 도매 주문 시간",
      currentProblem: "주문 마감시간이 흩어져 있음",
      confirmedFact: "오후 12시와 오후 7시에 전송",
      proposal: "매뉴얼에 전송 시간을 추가",
      createdBy: "ChatGPT"
    });

    expect(getDetailRows(item)).toEqual([
      { label: "현재 문제", value: "주문 마감시간이 흩어져 있음" },
      { label: "확인된 사실", value: "오후 12시와 오후 7시에 전송" },
      { label: "개선 제안", value: "매뉴얼에 전송 시간을 추가" },
      { label: "담당", value: "ChatGPT" },
      { label: "원본 경로", value: "manual_improve/manual-1" }
    ]);
    expect(getDetailDescription(item)).toBeUndefined();
  });

  it("keeps the detail summary for regular change items", () => {
    const item = normalizeTopic("topic-1", {
      title: "카드용지 주문",
      content: "알리미팜에서 카드용지를 신청한다."
    });

    expect(getDetailDescription(item)).toBe("알리미팜에서 카드용지를 신청한다.");
  });

  it("orders drug list facts by priority, expiry, quantity, and location", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "케토톱",
      exp: "2026-09-11",
      loc: "앞매대",
      qty: "40매",
      pinned: true
    }, "Q2");

    expect(getDrugListFacts(item)).toEqual([
      { label: "우선", value: "우선" },
      { label: "남은", value: "65일 남음" },
      { label: "유효", value: "2026년 9월 11일" },
      { label: "수량", value: "40매" },
      { label: "위치", value: "앞매대" }
    ]);
    vi.useRealTimers();
  });
});
