import { describe, expect, it, vi } from "vitest";
import { buildHomeSummary } from "./summary";
import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "./normalize";

describe("normalization", () => {
  it("falls back across different topic field names", () => {
    const item = normalizeTopic("topic-1", {
      subject: "조제실 변경 공지",
      body: "보관 위치가 변경되었습니다.",
      state: "open",
      assignee: "관리자"
    });

    expect(item.title).toBe("조제실 변경 공지");
    expect(item.description).toBe("보관 위치가 변경되었습니다.");
    expect(item.status).toBe("new");
    expect(item.source.path).toBe("topics/topic-1");
  });

  it("preserves drug source paths for each team", () => {
    const prescription = normalizeDrug("rx-1", { name: "전문약 A" }, "Q1");
    const otc = normalizeDrug("otc-1", { productName: "일반약 B" }, "Q2");

    expect(prescription.category).toBe("prescription");
    expect(prescription.source.path).toBe("teams/Q1/drugs/rx-1");
    expect(otc.category).toBe("otc");
    expect(otc.source.path).toBe("teams/Q2/drugs/otc-1");
  });

  it("maps real topic fields from Firestore", () => {
    const item = normalizeTopic("topic-real", {
      title: "카드용지 주문 방법",
      content: "알리미팜에서 카드용지를 신청한다.",
      status: "active",
      category: "기타",
      importance: "일반",
      createdBy: "ChatGPT",
      lastUpdatedAt: 1783250299175
    });

    expect(item.title).toBe("카드용지 주문 방법");
    expect(item.description).toBe("알리미팜에서 카드용지를 신청한다.");
    expect(item.status).toBe("new");
    expect(item.owner).toBe("ChatGPT");
    expect(item.updatedAt?.getTime()).toBe(1783250299175);
    expect(item.tags).toEqual(["기타", "일반"]);
  });

  it("maps real manual improvement fields from Firestore", () => {
    const item = normalizeManualImprove("manual-real", {
      title: "일반약 도매 주문 시간",
      status: "검토중",
      priority: "★★★★★",
      currentProblem: "주문 마감시간이 매뉴얼에 정리되어 있지 않음",
      confirmedFact: "오후 12시와 오후 7시에 주문을 전송한다.",
      proposal: "주문 매뉴얼에 전송 시간을 추가한다.",
      category: "주문",
      createdBy: "ChatGPT"
    });

    expect(item.title).toBe("일반약 도매 주문 시간");
    expect(item.description).toContain("주문 마감시간");
    expect(item.status).toBe("review");
    expect(item.owner).toBe("ChatGPT");
    expect(item.tags).toEqual(["주문", "★★★★★"]);
  });

  it("maps real drug fields from Firestore", () => {
    const item = normalizeDrug("drug-real", {
      name: "케프라액",
      exp: "2026-11-17",
      loc: "C2",
      qty: "1",
      addedBy: "혜미",
      addedAt: "2026-06-25T07:26:50.034Z"
    }, "Q1");

    expect(item.title).toBe("케프라액");
    expect(item.description).toBe("위치 C2 / 수량 1");
    expect(item.owner).toBe("혜미");
    expect(item.dueAt?.toISOString().startsWith("2026-11-17")).toBe(true);
    expect(item.createdAt?.toISOString()).toBe("2026-06-25T07:26:50.034Z");
  });

  it("uses expiry text for drugs without location and quantity", () => {
    const item = normalizeDrug("drug-no-location", {
      name: "소청연",
      exp: "2026-12-25",
      addedBy: "윤희"
    }, "Q2");

    expect(item.description).toBe("유효기간 2026-12-25");
  });

  it("maps pinned drug documents as priority items", () => {
    const item = normalizeDrug("drug-priority", {
      name: "편안한베이스 3포",
      exp: "2027-08-20",
      pinned: true
    }, "Q2");

    expect(item.isPriority).toBe(true);
    expect(item.tags).toContain("우선");
  });
});

describe("home summary", () => {
  it("counts action-focused buckets", () => {
    vi.setSystemTime(new Date("2026-07-07T00:00:00+09:00"));
    const now = new Date("2026-07-07T00:00:00+09:00");
    const items = [
      normalizeTopic("topic-1", { title: "변경", status: "open", updatedAt: "2026-06-28" }),
      normalizeManualImprove("manual-1", { title: "매뉴얼", status: "pending" }),
      normalizeDrug("rx-1", { name: "전문약", expiryDate: "2026-07-10" }, "Q1"),
      normalizeDrug("otc-1", { name: "일반약", expiryDate: "2026-07-15" }, "Q2"),
      normalizeDrug("old-1", { name: "초과", expiryDate: "2026-07-01" }, "Q2")
    ];

    const summary = buildHomeSummary(items, now);

    expect(summary.activeChanges).toBe(1);
    expect(summary.manualWaiting).toBe(1);
    expect(summary.prescriptionDueSoon).toBe(1);
    expect(summary.otcDueSoon).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.staleOpen).toBe(1);
  });
});
