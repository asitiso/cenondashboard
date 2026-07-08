# Central Onnuri Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite React Firebase dashboard for Central Onnuri Pharmacy's current work queue, Firestore lists, drug expiry management, and global search.

**Architecture:** A React SPA uses a small normalization layer to convert differing Firestore documents into one UI item model. Firebase listeners are isolated in one hook, while screens reuse filtering and detail-panel components. Missing Firebase configuration activates mock mode for immediate UI review.

**Tech Stack:** Vite, React, TypeScript, Firebase Web SDK, Lucide React, Vitest, CSS.

## Global Constraints

- Judge features by whether they make staff clearly faster and less confused than the old workflow.
- First version includes Firebase login, four collection listeners, home summary cards, lists, drug tabs, global search, status filters, detail view, real-time updates, and error display.
- First version excludes AI auto-approval, auto-delete, auto-merge, official manual auto-editing, external SMS alerts, complex stats, and a separate search server.
- Preserve original Firestore source paths for prescription and OTC drug data.
- Use `onSnapshot` for Firestore reads.

---

### Task 1: Scaffold And Core Data Model

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `src/types.ts`
- Create: `src/lib/normalize.ts`
- Create: `src/lib/summary.ts`
- Create: `src/lib/normalize.test.ts`

**Interfaces:**
- Produces: `DashboardItem`, `ItemKind`, `ItemStatus`, `normalizeTopic`, `normalizeManualImprove`, `normalizeDrug`, `buildHomeSummary`.

- [x] Write tests for field fallback normalization and summary bucketing.
- [x] Implement the minimal normalization and summary modules.

### Task 2: Firebase And Mock Data

**Files:**
- Create: `src/lib/firebase.ts`
- Create: `src/lib/mockData.ts`
- Create: `src/hooks/useDashboardData.ts`

**Interfaces:**
- Consumes: normalization functions from Task 1.
- Produces: `useDashboardData()` returning items, auth state, mock mode, loading, and errors.

- [x] Add mock data with the same normalized shapes expected from Firestore.
- [x] Add Firebase config detection, auth helpers, and Firestore `onSnapshot` subscriptions.

### Task 3: Application UI

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `useDashboardData`, `buildHomeSummary`, and `DashboardItem`.
- Produces: navigable dashboard with home, changes, manual improvements, drug tabs, search, filters, detail panel, login, and errors.

- [x] Build dense operational layout with status badges and fast filters.
- [x] Add detail panel that keeps source path visible.
- [x] Add responsive styling focused on scanability.

### Task 4: Verification

**Files:**
- Modify: none unless verification finds an issue.

- [ ] Install dependencies.
- [ ] Run tests.
- [ ] Run production build.
- [ ] Start local dev server and report URL.
