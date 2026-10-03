import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePurchase, parseCatalog } from "./importers";
function bytes(rows: unknown[][]) {
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(w, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
describe("file format and schema boundaries", () => {
  it("reads XLSX bytes even when upload has an xls filename and parses comma amounts", () => {
    const r = parsePurchase(
      bytes([
        ["일 자", "약 품 명", "제조업체", "거래처명", "단 가", "수량", "금 액"],
        ["2026-10-03", "품목", "", "백제", "5,610.00", "500.00", "280500"],
      ]),
    );
    expect(r[0]).toEqual({
      date: "2026-10-03",
      name: "품목",
      manufacturer: "",
      supplier: "백제",
      unitPrice: 5610,
      quantity: 500,
      amount: 280500,
      sourceRow: 2,
    });
  });
  it("rejects unrecognized columns and invalid dated rows instead of quietly erasing history", () => {
    expect(() => parsePurchase(bytes([["아무것"], ["123"]]))).toThrow("매입");
    expect(() =>
      parsePurchase(
        bytes([
          ["일자", "약품명", "제조업체", "거래처명", "단가", "수량", "금액"],
          ["2026-02-30", "품목", "", "백제", 1, 1, 1],
        ]),
      ),
    ).toThrow("날짜");
  });
  it("skips catalog names that are missing and keeps codes as text", () => {
    const r = parseCatalog(
      bytes([
        ["기간별 사용약품 현황"],
        [],
        ["약품코드", "약품명", "제조회사"],
        ["BA30003139", null, null],
        ["00123", "품목", "제약사"],
      ]),
      "retail",
    );
    expect(r).toEqual([
      { code: "00123", name: "품목", manufacturer: "제약사", usage: "retail" },
    ]);
  });
});
