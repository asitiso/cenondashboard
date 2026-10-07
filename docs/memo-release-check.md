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

This synthetic comparison did not show a repeatable slowdown.

The supplied Firebase configuration was then applied locally to project `todaysell-d4bbc`. With the same 1,200-product cached order snapshot, Chrome ran 25 searches in each of three runs. A test memo was edited and navigation to order search happened immediately while its real Firestore transaction was pending. A longer-lived session confirmed that a transaction eventually committed, and test documents were removed from `sticky_notes`.

| State | Median, three runs | p95, three runs |
| --- | ---: | ---: |
| Previous order build | 6.5–7.1 ms | 8.5–9.9 ms |
| Memo build, memo unopened | 6.4–6.9 ms | 8.9–10.1 ms |
| Memo build, save pending after navigation | 6.1–6.3 ms | 8.0–8.5 ms |
| Memo build, returned to memo then order | 5.9–6.4 ms | 7.3–8.8 ms |

No repeatable order-search delay was detected locally. Keep the no-slowdown gate for deployment.

**Deployment is still blocked.** The live project lacks the `sticky_notes` composite index on `pinned` descending and `updatedAt` descending: the memo list listener returned `The query requires an index`, leaving saved notes invisible in the list. The search composite index in `firestore.indexes.json` must also be provisioned and verified. Firebase CLI credentials were unavailable in this workspace, so no cloud index was created. Verify both indexes are ready and repeat the full memo flow before deploying the app. A live multi-PC revision conflict has not been exercised.

The project also accepted an unauthenticated REST delete of a test `sticky_notes` document. Before release, verify the intended staff access policy and enforce it in Firestore Security Rules; the public web config alone is not an access control. The existing dashboard currently bypasses its login panel, so enabling auth-only memo rules requires a deliberate product decision and an authenticated staff flow.

The local unit suite and production build are separate required checks. The source includes revision conflict tests and a freeze test proving save and unsubscribe are deferred past the navigation event.
