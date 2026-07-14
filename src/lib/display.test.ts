import { describe, expect, it, vi } from "vitest";
import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "./normalize";
import { getDenseRowMeta, getDenseRowTimeLabel, getDetailDescription, getDetailPresentation, getDetailRows, getDetailSections, getDrugListFacts, getDrugPriorityToggleLabel, shouldShowDenseStatusBadge, shouldShowStatusBadge } from "./display";

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
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
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
      { label: "먼저", value: "예" },
      { label: "상태", value: "긴급" },
      { label: "유효기간", value: "2026년 11월 17일" },
      { label: "위치", value: "C2" },
      { label: "수량", value: "1" },
      { label: "담당", value: "혜미" },
      { label: "원본 경로", value: "teams/Q1/drugs/drug-1" }
    ]);
    vi.useRealTimers();
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

  it("shows the stored change category in detail rows", () => {
    const item = normalizeTopic("topic-1", {
      title: "근무표 변경",
      category: "스케줄"
    });

    expect(getDetailRows(item)).toContainEqual({ label: "카테고리", value: "스케줄" });
  });

  it("keeps change status available in detail rows", () => {
    const active = normalizeTopic("active", { title: "유효", status: "active" });
    const done = normalizeTopic("done", { title: "완료", status: "done" });

    expect(getDetailRows(active)).toContainEqual({ label: "상태", value: "유효" });
    expect(getDetailRows(done)).toContainEqual({ label: "상태", value: "완료" });
  });

  it("orders drug list facts by first flag, status, expiry, quantity, and location", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "케토톱",
      exp: "2026-09-11",
      loc: "앞매대",
      qty: "40매",
      pinned: true
    }, "Q2");

    expect(getDrugListFacts(item)).toEqual([
      { label: "먼저", value: "먼저" },
      { label: "상태", value: "긴급" },
      { label: "남은", value: "65일 남음" },
      { label: "유효", value: "2026년 9월 11일" },
      { label: "수량", value: "40매" },
      { label: "위치", value: "앞매대" }
    ]);
    vi.useRealTimers();
  });

  it("does not show operational status badges for drug rows", () => {
    const drug = normalizeDrug("drug-1", { name: "약", exp: "2026-09-01" }, "Q1");
    const change = normalizeTopic("topic-1", { title: "변경", status: "active" });
    const manual = normalizeManualImprove("manual-1", { title: "매뉴얼", status: "pending" });

    expect(shouldShowStatusBadge(drug)).toBe(false);
    expect(shouldShowStatusBadge(change)).toBe(true);
    expect(shouldShowStatusBadge(manual)).toBe(true);
  });

  it("shows valid change status badges on dense home rows", () => {
    const change = normalizeTopic("topic-1", { title: "변경", status: "active" });
    const drug = normalizeDrug("drug-1", { name: "약", exp: "2026-09-01" }, "Q1");

    expect(shouldShowDenseStatusBadge(change)).toBe(true);
    expect(shouldShowDenseStatusBadge(drug)).toBe(false);
  });

  it("prioritizes change content in detail sections without showing source paths", () => {
    const item = normalizeTopic("topic-1", {
      title: "카드용지 주문 방법",
      content: "알리미팜에서 카드용지를 신청한다.",
      status: "active",
      category: "업무규칙",
      updatedAt: "2026-07-09"
    });

    const sections = getDetailSections(item);

    expect(sections[0]).toEqual({
      title: "내용",
      tone: "primary",
      rows: [{ label: "내용", value: "알리미팜에서 카드용지를 신청한다." }]
    });
    expect(sections.flatMap((section) => section.rows).some((row) => row.value.includes("topics/"))).toBe(false);
  });

  it("keeps manual details in problem, highlighted fact, and summary order", () => {
    const item = normalizeManualImprove("manual-1", {
      title: "일반약 주문 시간",
      currentProblem: "주문 마감시간이 매뉴얼에 없다.",
      confirmedFact: "오후 12시와 오후 7시에 전송한다.",
      proposal: "주문 매뉴얼에 전송 시간을 추가한다."
    });

    const sections = getDetailSections(item);

    expect(sections.map((section) => section.title)).toEqual(["현재 문제", "확인된 사실", "요약", "관리 정보"]);
    expect(sections[1]).toMatchObject({ title: "확인된 사실", tone: "highlight" });
    expect(sections[2]).toMatchObject({ title: "요약", tone: undefined });
    expect(sections[2].rows[0].value).toBe("주문 매뉴얼에 전송 시간을 추가한다.");
  });

  it("uses a readable document flow for manual improvement details", () => {
    const manual = normalizeManualImprove("manual-1", { title: "키즈존 외품 주문 가이드" });
    const change = normalizeTopic("topic-1", { title: "변경", content: "내용" });
    const drug = normalizeDrug("drug-1", { name: "약", exp: "2026-09-06" }, "Q1");

    expect(getDetailPresentation(manual)).toBe("manual-flow");
    expect(getDetailPresentation(change)).toBe("section-cards");
    expect(getDetailPresentation(drug)).toBe("section-cards");
  });

  it("prioritizes drug remaining days and expiry in detail sections without showing source paths", () => {
    vi.setSystemTime(new Date("2026-07-08T00:00:00+09:00"));
    const item = normalizeDrug("drug-1", {
      name: "마그오캡슐",
      exp: "2026-09-06",
      loc: "K1",
      qty: "3",
      pinned: true
    }, "Q1");

    const sections = getDetailSections(item);

    expect(sections[0]).toEqual({
      title: "유효기간",
      tone: "expiry",
      rows: [
        { label: "남은 일수", value: "60일 남음" },
        { label: "유효기간", value: "2026년 9월 6일" }
      ]
    });
    expect(sections.flatMap((section) => section.rows).some((row) => row.value.includes("teams/"))).toBe(false);
    vi.useRealTimers();
  });

  it("labels drug priority detail toggles by the next action", () => {
    const normal = normalizeDrug("drug-normal", { name: "약", exp: "2026-09-06" }, "Q1");
    const priority = normalizeDrug("drug-priority", { name: "약", exp: "2026-09-06", pinned: true }, "Q1");

    expect(getDrugPriorityToggleLabel(normal)).toBe("먼저 설정");
    expect(getDrugPriorityToggleLabel(priority)).toBe("먼저 해제");
    expect(getDrugPriorityToggleLabel(priority, true)).toBe("저장중");
  });
});
