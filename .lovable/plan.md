# Gotham OS — 5 New Modules

Big scope, so I want to confirm direction before building. Below is the build order I recommend, what ships in each phase, and what I'll need decisions on.

## Recommended sequence

Each phase is independently shippable and testable. I suggest one phase per turn so you can sanity-check the data shape and UI before the next layer lands on top.

### Phase 1 — Manager Daily Recap (Module 1)
- DB: `daily_recaps` (date, shift_id, manager_id, trailer_id, shift_score, crew jsonb, status: draft|submitted|reviewed|archived, 14 text sections for Ops/Inventory/Labor/Hospitality/Next-Shift) + RLS (managers write own, owners read/review all).
- Trigger: on `status='submitted'` → insert `alerts` row (type `manager_recap`, assigned_role `owner`).
- Server fns: `saveRecapDraft`, `submitRecap`, `listRecaps(scope, dateRange)`, `markRecapReviewed`.
- UI: `src/routes/_authenticated/operations.recap.tsx` form + dashboard (Today / Pending / Historical tabs). Add link in Operations.

### Phase 2 — Order Guide + Purchasing (Module 3)
- DB: extend `inventory_items` with `vendor`, `pack_size`, `minimum_qty`, `preferred_order_qty`, `estimated_cost`, `last_ordered_at`, `last_received_at`.
- UI: new "Order Guide" tab inside `inventory.tsx` showing the table with `Recommended Order = max(par - current, minimum)`; "Build Order" prefills the existing `OrderBuilderModal`. Receive flow updates `last_received_at`.
- Reuses the alert pipeline already shipped — no new tables.

### Phase 3 — Employee Accountability Score (Module 2)
- DB: `performance_events` (employee_id, category enum, delta int, reason, source_module, source_id, occurred_at) — append-only ledger. Score = `100 + sum(delta)` clamped 0–100, grouped by category.
- Triggers: late punch → -2; missing checklist task at shift close → -3; no-show shift → -10; approved time_correction → reverse penalty.
- Server fns: `getPerformanceScore(employeeId, range)`, `listTopPerformers`, `listNeedsCoaching`, weekly/monthly aggregation.
- UI: `src/routes/_authenticated/performance.tsx`. Employees see only themselves (RLS `employee_id = auth.uid()` OR `is_manager`).

### Phase 4 — Training + Certification (Module 5)
- DB: `training_modules` (category, title, sop_id, quiz jsonb, expires_after_days), `training_assignments` (employee_id, module_id, status, started_at, completed_at, certified_by, expires_at, score).
- Server fns: `assignTraining`, `startTraining`, `submitQuiz`, `signoffTraining` (manager+), `listMyCertifications`, `listEmployeeCertifications`.
- UI: `src/routes/_authenticated/training.tsx` (employee view: my modules) + manager assignment panel. Profile widget shows Training %.

### Phase 5 — Role-Based Dashboards (Module 4)
- No new tables. Replace `src/routes/_authenticated/index.tsx` (or create role-aware home) with a switch on `roleId` from `useRole()` rendering the tile set per role spec (Grill / Prep / Cashier / Shift Lead / Manager / Owner).
- Update `AppShell` nav to filter tabs per role (already partly role-gated; will tighten).

## Decisions I need from you

1. **Build order — do you want me to ship Phase 1 (Daily Recap) right now**, or a different starting phase?
2. **Shift Score (Module 1)** — manual 1–10 slider entered by the manager, or auto-computed from the day's metrics?
3. **Score baseline (Module 2)** — does everyone start each week at 100 and decay, or rolling 30-day window?
4. **Training quiz authoring** — owner/manager writes Q&A in-app, or for now just "Read SOP + checklist + manager signoff" (skip quiz engine)?

Reply with answers (or just "build phase 1, your call on the rest") and I'll start.
