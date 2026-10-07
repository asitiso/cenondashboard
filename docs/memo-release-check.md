# MemoApp release check

MemoApp uses the separate `sticky_notes` top-level Firestore collection. Deploy the two composite indexes in `firestore.indexes.json` before enabling the feature against a live Firebase project. No order collection or order listener is involved.

## Search performance gate

The order files `src/order/core.ts`, `src/order/storage.ts`, `src/order/useOrderData.ts`, and `src/order/OrderApp.tsx` must remain unchanged by memo work. The order app remains mounted during dashboard use. MemoApp is a separate lazy chunk and is never loaded by order-only use.

On 2026-10-07, a production build was tested in headless Chrome with the same synthetic 1,200-product snapshot and 25 searches per run. Across three runs:

| State | Median input-to-result | p95 input-to-result |
| --- | ---: | ---: |
| Previous order build | 7.6–8.4 ms | 10.6–14.0 ms |
| Memo build, memo unopened | 7.2–8.6 ms | 10.1–11.1 ms |
| Memo build, opened then returned | 7.0–7.2 ms | 8.5–10.1 ms |

This synthetic comparison did not show a repeatable slowdown. The environment has no Firebase configuration, so an actual memo save in flight and multi-PC conflict could not be measured end to end. **Do not deploy on the strength of this result alone.** Before release, use the same production order snapshot and Chrome machine to repeat the searches while a real `sticky_notes` save is pending, including navigation immediately after an edit. If the new version is meaningfully slower, withhold deployment and fix MemoApp without changing order search.

The local unit suite and production build are separate required checks. The source includes revision conflict tests and a freeze test proving save and unsubscribe are deferred past the navigation event.
