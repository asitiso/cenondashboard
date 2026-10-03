import { buildSnapshot } from "./core";
import { parseCatalog, parsePurchase } from "./importers";
import type { ImportPayload } from "./types";
self.onmessage = (event: MessageEvent<ImportPayload>) => {
  try {
    const p = event.data;
    self.postMessage({ progress: "매입자료를 읽고 있습니다…" });
    const rows = parsePurchase(p.purchase);
    self.postMessage({
      progress: `${rows.length.toLocaleString()}행을 상품별로 정리하고 있습니다…`,
    });
    const catalogs = [
      ...(p.dispensing
        ? parseCatalog(p.dispensing, "dispensing")
        : (p.previous?.catalogs.filter((c) => c.usage === "dispensing") ?? [])),
      ...(p.retail
        ? parseCatalog(p.retail, "retail")
        : (p.previous?.catalogs.filter((c) => c.usage === "retail") ?? [])),
    ];
    self.postMessage({
      result: buildSnapshot(rows, catalogs, p.asOf, p.previous, p.overrides),
    });
  } catch (e) {
    self.postMessage({
      error:
        e instanceof Error
          ? e.message
          : "파일을 읽지 못했습니다. PMIT에서 CSV 또는 엑셀로 다시 내보내 주세요.",
    });
  }
};
