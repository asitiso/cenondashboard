import * as XLSX from "xlsx";
import type { CatalogItem, Purchase } from "./types";
function table(bytes: ArrayBuffer): unknown[][] {
  const w = XLSX.read(bytes, { type: "array", cellDates: true, dense: true });
  if (!w.SheetNames.length) throw new Error("읽을 수 있는 시트가 없습니다.");
  return XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
}
const text = (v: unknown) => String(v ?? "").trim();
const header = (v: unknown) => text(v).replace(/\s/g, "");
function number(v: unknown, row: number) {
  const value = Number(text(v).replace(/,/g, ""));
  if (!Number.isFinite(value) || text(v) === "")
    throw new Error(`${row}행의 숫자를 확인해 주세요.`);
  return value;
}
function date(v: unknown, row: number): string {
  const s =
    v instanceof Date
      ? v.toISOString().slice(0, 10)
      : text(v).replace(/[./]/g, "-");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s
  )
    throw new Error(`${row}행의 날짜를 확인해 주세요.`);
  return s;
}
export function parsePurchase(bytes: ArrayBuffer): Purchase[] {
  const rows = table(bytes);
  const h = rows.findIndex(
    (r) => r.map(header).includes("거래처명") && r.map(header).includes("금액"),
  );
  if (h < 0)
    throw new Error(
      "PMIT 매입 파일의 열을 찾지 못했습니다. 기간별 물품 매입현황을 선택해 주세요.",
    );
  const cols = rows[h].map(header);
  const required = [
    "일자",
    "약품명",
    "제조업체",
    "거래처명",
    "단가",
    "수량",
    "금액",
  ];
  if (required.some((x) => !cols.includes(x)))
    throw new Error("매입 파일의 필수 열이 없습니다.");
  return rows.slice(h + 1).flatMap((r, i) => {
    if (r.every((x) => text(x) === "")) return [];
    const get = (name: string) => r[cols.indexOf(name)];
    const line = h + i + 2;
    return [
      {
        date: date(get("일자"), line),
        name: text(get("약품명")),
        manufacturer: text(get("제조업체")),
        supplier: text(get("거래처명")),
        unitPrice: number(get("단가"), line),
        quantity: number(get("수량"), line),
        amount: number(get("금액"), line),
        sourceRow: line,
      },
    ];
  });
}
export function parseCatalog(
  bytes: ArrayBuffer,
  usage: CatalogItem["usage"],
): CatalogItem[] {
  const rows = table(bytes);
  const h = rows.findIndex(
    (r) =>
      r.map(header).includes("약품코드") && r.map(header).includes("약품명"),
  );
  if (h < 0)
    throw new Error("조제·판매 목록의 약품코드와 약품명 열을 찾지 못했습니다.");
  const cols = rows[h].map(header);
  return rows.slice(h + 1).flatMap((r) => {
    const name = text(r[cols.indexOf("약품명")]);
    const code = text(r[cols.indexOf("약품코드")]);
    return name && code
      ? [{ code, name, manufacturer: text(r[cols.indexOf("제조회사")]), usage }]
      : [];
  });
}
