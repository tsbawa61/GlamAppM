# Graph Report - E:\GlamTrack\GlamAppModular\GlamAppModHome  (2026-07-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 206 nodes · 714 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- main.js
- state.js
- auth.js
- allotment.js
- catalog.js
- customers.js
- manifest.json
- sw.js
- Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).
- All errors below were encountered and resolved during the July 2026 modularisation.
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `handleTelemetryAlert()` - 30 edges
2. `refreshAllAdministrativeTables()` - 16 edges
3. `processUserADMFormSubmission()` - 15 edges
4. `setAllotCurrentPackTotalAmount()` - 15 edges
5. `Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).` - 15 edges
6. `All errors below were encountered and resolved during the July 2026 modularisation.` - 15 edges
7. `_ownerFilter()` - 14 edges
8. `setAllotExistingIdx()` - 13 edges
9. `setQuickAddCustomerMode()` - 13 edges
10. `loadWorkspaceDropdownMappings()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `handleTelemetryAlert()` --calls--> `reportRuntimeCrash()`  [EXTRACTED]
  modules/auth.js → errorMailer.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_CATEGORIES`  [EXTRACTED]
  modules/auth.js → constants.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_SERVICES`  [EXTRACTED]
  modules/auth.js → constants.js
- `executeDynamicAutopopulateMenuTask()` --references--> `SAMPLE_SUB_SERVICES`  [EXTRACTED]
  modules/auth.js → constants.js
- `processUserADMFormSubmission()` --calls--> `resetAllotExistingPackUI()`  [EXTRACTED]
  modules/customers.js → modules/allotment.js

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.16
Nodes (28): processAccessControlFormSubmission(), handleTelemetryAlert(), processChangePasswordSubmission(), openGlamtrackModal(), scrollToGlamtrackSection(), appendCatalogDeleteButton(), setupMediaPreviewListener(), setOldVisitLogDocRef() (+20 more)

### Community 1 - "state.js"
Cohesion: 0.22
Nodes (16): bindRealtimeAnalyticsStream(), renderGlamtrackExpiries(), renderGlamtrackPremium(), renderGlamtrackUnengaged(), _allotExistingPacks, COL, db, FIREBASE_CONFIG (+8 more)

### Community 2 - "auth.js"
Cohesion: 0.20
Nodes (19): SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES, reportRuntimeCrash(), ACTIVITY_EVENTS, executeDynamicAutopopulateMenuTask(), performSessionLogoutAction(), processSecureProfileAuthentication() (+11 more)

### Community 3 - "allotment.js"
Cohesion: 0.33
Nodes (14): buildAllotExistingReason(), handleAllotCustomerSelectChange(), handleAllotModifyClick(), handleAllotPackSelectChange(), hideAllotExtraUIElements(), navigateAllotExistingPack(), processAllotmentFormSubmission(), resetAllotExistingPackUI() (+6 more)

### Community 4 - "catalog.js"
Cohesion: 0.25
Nodes (19): getHighestFieldOffset(), processCategoryADMFormSubmission(), processCommonPackADMFormSubmission(), processServiceADMFormSubmission(), processSubServiceFormSubmission(), renderCatalogSubServicesCheckboxes(), removeCatalogDeleteButton(), loadWorkspaceDropdownMappings() (+11 more)

### Community 5 - "customers.js"
Cohesion: 0.17
Nodes (23): applyUserFormMode(), closeQuickAddCustomerModal(), _getPostRegAllotModalInstance(), _getQuickAddCustomerModalInstance(), openPostRegAllotModal(), openQuickAddCustomerModal(), processUserADMFormSubmission(), _refreshUserTableForMode() (+15 more)

### Community 6 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 8 - "Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026)."
Cohesion: 0.05
Nodes (37): 10. TARGETED REFRESH FUNCTIONS (refresh.js), 11. PWA CONFIGURATION, 12. KNOWN PATTERNS TO WATCH, 13. CHANGELOG REFERENCE, 14. DEPLOYMENT CHECKLIST, 1. PROJECT OVERVIEW, 2. CRITICAL MODULAR ARCHITECTURE RULES, 3. COLLECTION NAME CONSTANTS (COL) (+29 more)

### Community 9 - "All errors below were encountered and resolved during the July 2026 modularisation."
Cohesion: 0.11
Nodes (17): All errors below were encountered and resolved during the July 2026 modularisation., ERROR CLASS 10 — `ReferenceError: X is not defined` (state variable, not function), ERROR CLASS 11 — `Expected type 'ug', but it was: a custom Object object` (Firestore), ERROR CLASS 11 — `FirebaseError: Expected type 'ug', but it was: a custom Object object`, ERROR CLASS 1 — `Unexpected end of input`, ERROR CLASS 2 — `Identifier 'X' has already been declared`, ERROR CLASS 3 — `Assignment to constant variable`, ERROR CLASS 4 — `X is not defined` (ReferenceError) (+9 more)

## Knowledge Gaps
- **61 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `display` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleTelemetryAlert()` connect `main.js` to `state.js`, `auth.js`, `allotment.js`, `catalog.js`, `customers.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `All errors below were encountered and resolved during the July 2026 modularisation.` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._