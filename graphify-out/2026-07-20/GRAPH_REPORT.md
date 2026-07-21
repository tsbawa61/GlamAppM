# Graph Report - GlamAppModHome  (2026-07-19)

## Corpus Check
- 40 files · ~625,090 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 308 nodes · 870 edges · 26 communities (18 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- state.js
- catalog.js
- customers.js
- manifest.json
- sw.js
- Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).
- All errors below were encountered and resolved during the July 2026 modularisation.
- CLAUDE.md
- visits - Copy.js
- KiranPensionRefundCalculator_8_33_and_1_16_4a58eb4d.md
- TSBPensionRefundCalculator_8_33_and_1_16_53bc9f77.md
- Blank_PensionRefundCalculator_8_33_and_1_16_da22ec27.md
- NewPensionRefundCalculator_8_33_and_1_16_ec9e321c.md
- PensionRefundCalculator_8_33_and_1_16_4ef85471.md
- EPF Pension Calc Varrinder_a43481a0.md
- Pension Calc Anita Goyal_3af7479d.md
- Pension Calc Varrinder -3_ab0a5f5d.md
- TEMPLATE (23.11.2022) for Calculating Revised Pension, Differential Amount & Arrears of Pension Revision etc. Anita Goyal_e5e6284b.md
- TEMPLATE (23.11.2022) for Calculating Revised Pension, Differential Amount & Arrears of Pension Revision etc._b8087eda.md
- Pension Calc -anita G_a4100116.md
- EPF Pension Arrears Calc TSB_72a63443.md
- Pension Calculation-By Jivi_c0b625b2.md
- EPF Arrears Praveen Mahajan_25db1e7f.md
- EPF Arrears Varrinder mam_3a56b89e.md
- EPF Arrears Yash Namita_fa25a83e.md
- EPF Pension Calc TSB_f0d9ee1b.md

## God Nodes (most connected - your core abstractions)
1. `handleTelemetryAlert()` - 37 edges
2. `_ownerFilter()` - 18 edges
3. `refreshAllAdministrativeTables()` - 16 edges
4. `setAllotCurrentPackTotalAmount()` - 16 edges
5. `processUserADMFormSubmission()` - 15 edges
6. `setOldVisitPrevCalcCost()` - 15 edges
7. `setOldVisitPrevAddlAmt()` - 15 edges
8. `setOldVisitLogDocRef()` - 15 edges
9. `setUtilizePrevUnpaidBalance()` - 15 edges
10. `_getCachedSubServices()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `handleTelemetryAlert()` --calls--> `reportRuntimeCrash()`  [EXTRACTED]
  modules/auth.js → errorMailer.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_CATEGORIES`  [EXTRACTED]
  modules/auth.js → constants.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_SERVICES`  [EXTRACTED]
  modules/auth.js → constants.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_SUB_SERVICES`  [EXTRACTED]
  modules/auth.js → constants.js
- `handleAllotCustomerSelectChange()` --calls--> `handleTelemetryAlert()`  [EXTRACTED]
  modules/allotment.js → modules/auth.js

## Import Cycles
- None detected.

## Communities (26 total, 8 thin omitted)

### Community 1 - "state.js"
Cohesion: 0.12
Nodes (37): SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES, reportRuntimeCrash(), ACTIVITY_EVENTS, executeDynamicAutopopulateMenuTask(), performSessionLogoutAction(), processSecureProfileAuthentication() (+29 more)

### Community 4 - "catalog.js"
Cohesion: 0.22
Nodes (20): getHighestFieldOffset(), processCategoryADMFormSubmission(), processCommonPackADMFormSubmission(), processServiceADMFormSubmission(), processSubServiceFormSubmission(), renderCatalogSubServicesCheckboxes(), appendCatalogDeleteButton(), removeCatalogDeleteButton() (+12 more)

### Community 5 - "customers.js"
Cohesion: 0.13
Nodes (40): buildAllotExistingReason(), handleAllotCustomerSelectChange(), handleAllotModifyClick(), handleAllotPackSelectChange(), hideAllotExtraUIElements(), navigateAllotExistingPack(), processAccessControlFormSubmission(), processAllotmentFormSubmission() (+32 more)

### Community 6 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 8 - "Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026)."
Cohesion: 0.05
Nodes (37): 10. TARGETED REFRESH FUNCTIONS (refresh.js), 11. PWA CONFIGURATION, 12. KNOWN PATTERNS TO WATCH, 13. CHANGELOG REFERENCE, 14. DEPLOYMENT CHECKLIST, 1. PROJECT OVERVIEW, 2. CRITICAL MODULAR ARCHITECTURE RULES, 3. COLLECTION NAME CONSTANTS (COL) (+29 more)

### Community 9 - "All errors below were encountered and resolved during the July 2026 modularisation."
Cohesion: 0.11
Nodes (17): All errors below were encountered and resolved during the July 2026 modularisation., ERROR CLASS 10 — `ReferenceError: X is not defined` (state variable, not function), ERROR CLASS 11 — `Expected type 'ug', but it was: a custom Object object` (Firestore), ERROR CLASS 11 — `FirebaseError: Expected type 'ug', but it was: a custom Object object`, ERROR CLASS 1 — `Unexpected end of input`, ERROR CLASS 2 — `Identifier 'X' has already been declared`, ERROR CLASS 3 — `Assignment to constant variable`, ERROR CLASS 4 — `X is not defined` (ReferenceError) (+9 more)

### Community 11 - "visits - Copy.js"
Cohesion: 0.11
Nodes (41): handleTelemetryAlert(), processChangePasswordSubmission(), setOldVisitLogDocRef(), setOldVisitPrevAddlAmt(), setOldVisitPrevCalcCost(), setUtilizeOverrideConfirmed(), setUtilizeOverrideMeta(), setUtilizePrevUnpaidBalance() (+33 more)

### Community 12 - "KiranPensionRefundCalculator_8_33_and_1_16_4a58eb4d.md"
Cohesion: 0.25
Nodes (7): Sheet: Calculation Sheet (1.16__Mem), Sheet: Calculation Sheet(8.33%), Sheet: Sheet3, Sheet: Summary (1.16%__Mem), Sheet: Summary (8.33%), Sheet: SWP, Sheet: Wage Entry

### Community 13 - "TSBPensionRefundCalculator_8_33_and_1_16_53bc9f77.md"
Cohesion: 0.25
Nodes (7): Sheet: Calculation Sheet (1.16__Mem), Sheet: Calculation Sheet(8.33%), Sheet: Sheet3, Sheet: Summary (1.16%__Mem), Sheet: Summary (8.33%), Sheet: SWP, Sheet: Wage Entry

### Community 14 - "Blank_PensionRefundCalculator_8_33_and_1_16_da22ec27.md"
Cohesion: 0.29
Nodes (6): Sheet: Calculation Sheet (1.16__Mem), Sheet: Calculation Sheet(8.33%), Sheet: Sheet3, Sheet: Summary (1.16%__Mem), Sheet: Summary (8.33%), Sheet: Wage Entry

### Community 15 - "NewPensionRefundCalculator_8_33_and_1_16_ec9e321c.md"
Cohesion: 0.29
Nodes (6): Sheet: Calculation Sheet (1.16__Mem), Sheet: Calculation Sheet(8.33%), Sheet: Sheet3, Sheet: Summary (1.16%__Mem), Sheet: Summary (8.33%), Sheet: Wage Entry

### Community 16 - "PensionRefundCalculator_8_33_and_1_16_4ef85471.md"
Cohesion: 0.29
Nodes (6): Sheet: Calculation Sheet (1.16__Mem), Sheet: Calculation Sheet(8.33%), Sheet: Sheet3, Sheet: Summary (1.16%__Mem), Sheet: Summary (8.33%), Sheet: Wage Entry

### Community 17 - "EPF Pension Calc Varrinder_a43481a0.md"
Cohesion: 0.40
Nodes (4): Sheet: Amount Cal, Sheet: Input, Sheet: Output & Statistics, Sheet: Pension Cal

### Community 18 - "Pension Calc Anita Goyal_3af7479d.md"
Cohesion: 0.40
Nodes (4): Sheet: Amount Cal, Sheet: Input, Sheet: Output & Statistics, Sheet: Pension Cal

### Community 19 - "Pension Calc Varrinder -3_ab0a5f5d.md"
Cohesion: 0.40
Nodes (4): Sheet: Amount Cal, Sheet: Input, Sheet: Output & Statistics, Sheet: Pension Cal

### Community 20 - "TEMPLATE (23.11.2022) for Calculating Revised Pension, Differential Amount & Arrears of Pension Revision etc. Anita Goyal_e5e6284b.md"
Cohesion: 0.40
Nodes (4): Sheet: Amount Cal, Sheet: Input, Sheet: Output & Statistics, Sheet: Pension Cal

### Community 21 - "TEMPLATE (23.11.2022) for Calculating Revised Pension, Differential Amount & Arrears of Pension Revision etc._b8087eda.md"
Cohesion: 0.40
Nodes (4): Sheet: Amount Cal, Sheet: Input, Sheet: Output & Statistics, Sheet: Pension Cal

### Community 22 - "Pension Calc -anita G_a4100116.md"
Cohesion: 0.50
Nodes (3): Sheet: Anita Goyal, Sheet: Sheet4, Sheet: TSB

## Knowledge Gaps
- **124 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `display` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleTelemetryAlert()` connect `visits - Copy.js` to `state.js`, `catalog.js`, `customers.js`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `_ownerFilter()` connect `catalog.js` to `state.js`, `visits - Copy.js`, `customers.js`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `state.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12070874861572536 - nodes in this community are weakly interconnected._
- **Should `customers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._
- **Should `Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `All errors below were encountered and resolved during the July 2026 modularisation.` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._