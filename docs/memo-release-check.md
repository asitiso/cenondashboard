# MemoApp release check

MemoApp uses the separate `sticky_notes` top-level Firestore collection. The two composite indexes in `firestore.indexes.json` were created in the Standard `(default)` database of project `todaysell-d4bbc` on 2026-10-07 and both showed **Enabled** in Firebase Console. `firebase.json` links the index definitions for future CLI deployment. No order collection or order listener is involved.

## Search performance gate

The order files `src/order/core.ts`, `src/order/storage.ts`, `src/order/useOrderData.ts`, and `src/order/OrderApp.tsx` must remain unchanged by memo work. The order app remains mounted during dashboard use. MemoApp is a separate lazy chunk and is never loaded by order-only use.

On 2026-10-07, a production build was tested in headless Chrome with the same synthetic 1,200-product snapshot and 25 searches per run. Across three runs:

| State | Median input-to-result | p95 input-to-result |
| --- | ---: | ---: |
| Previous order build | 7.6–8.4 ms | 10.6–14.0 ms |
| Memo build, memo unopened | 7.2–8.6 ms | 10.1–11.1 ms |
| Memo build, opened then returned | 7.0–7.2 ms | 8.5–10.1 ms |

This synthetic comparison did not show a repeatable slowdown.

The supplied Firebase configuration was then applied locally to project `todaysell-d4bbc`. With the same 1,200-product cached order snapshot, Chrome ran 25 searches in each of three runs. A test memo was edited and navigation to order search happened immediately while its real Firestore transaction was pending. A longer-lived session confirmed that a transaction eventually committed, and test documents were removed from `sticky_notes`.

| State | Median, three runs | p95, three runs |
| --- | ---: | ---: |
| Previous order build | 6.5–7.1 ms | 8.5–9.9 ms |
| Memo build, memo unopened | 6.4–6.9 ms | 8.9–10.1 ms |
| Memo build, save pending after navigation | 6.1–6.3 ms | 8.0–8.5 ms |
| Memo build, returned to memo then order | 5.9–6.4 ms | 7.3–8.8 ms |

After both indexes became enabled, the browser flow created a memo, navigated immediately to order search, resumed the memo, found it by body and checklist text, and deleted it. The delete was verified against the exact test title on the server. The final performance comparison repeated 25 searches in each of three runs with the active indexes:

| State | Median, three runs | p95, three runs |
| --- | ---: | ---: |
| Previous order build | 6.9–7.2 ms | 9.9–12.0 ms |
| Memo build, memo unopened | 6.9 ms | 8.5–9.5 ms |
| Memo build, opened then returned | 6.0–6.5 ms | 7.9–9.0 ms |

A second three-run comparison measured real Firestore saves pending immediately after navigation:

| State | Median, three runs | p95, three runs |
| --- | ---: | ---: |
| Previous order build | 6.6–7.1 ms | 8.8–11.5 ms |
| Memo build, memo unopened | 6.8–7.2 ms | 9.1–9.4 ms |
| Memo build, save pending | 6.4–6.9 ms | 7.8–10.2 ms |

No repeatable order-search delay was detected locally. All performance test memos were removed. Keep the no-slowdown gate for any deployment and verify on the target staff PCs. A live multi-PC revision conflict was not exercised; repository tests cover revision mismatch handling.

The user confirmed that memo access is intended for anyone. No authentication requirement or Firestore Security Rules change was made. The project currently allows unauthenticated `sticky_notes` reads and writes; that behavior matches the confirmed access choice.

The local unit suite and production build are separate required checks. The source includes revision conflict tests and a freeze test proving save and unsubscribe are deferred past the navigation event.

## Current main integration before deployment

The memo-only commits were applied to GitHub `main` at `d530ba0` in a separate release branch. The newer order and purchase-analysis code remains untouched. The integrated build passed TypeScript, 141 tests (one existing real-data test skipped), and the Vite production build. A live `sticky_notes` flow passed create, immediate navigation to order search, save, body search, checklist search, and deletion; the exact test title had no remaining server document.

With both builds using the same Firebase configuration and cached 1,200-product order fixture, three paired runs of 25 searches gave a median of 8.0–8.6 ms for current `main`, 7.9–8.1 ms for memo unopened, and 7.3–7.5 ms after opening memo and returning. In five further paired runs with real memo saves pending, order-search medians were 7.5–14.8 ms on current `main`, 7.9–14.8 ms on memo unopened, and 6.9–15.2 ms with a save pending. The later runs slowed across all states on the test PC; there was no repeatable memo-specific delay. Keep the release gate tied to comparison on the target PCs, since these figures are local measurements.
