# GlamTrack CRM — Claude Knowledge Document
# Version: July 2026
# Purpose: Complete context reference for AI-assisted development of GlamTrack.
#          Use this document at the start of any new coding session to restore
#          full project context without needing to re-read the entire codebase.
#          Supersedes GLAMTRACK_KNOWLEDGE.md (June 2026).

---

## 1. PROJECT OVERVIEW

**GlamTrack** is a multi-tenant Salon Management CRM web application.

- **Frontend:** Vanilla JavaScript (ES Modules), Bootstrap 5.3, single-page application
- **Backend:** Google Firebase Firestore (NoSQL cloud database)
- **Hosting:** Netlify (https://glamtrack.netlify.app)
- **Email:** EmailJS (OTP delivery for SUPER_USER login)
- **PWA:** Service Worker (`sw.js`) + Web Manifest (`manifest.json`) for installability
- **React Native:** Expo-based mobile app (`GlamTrackRN/`) — PAUSED, PWA covers use case
- **Firebase Project ID:** `vault-050166`
- **Firebase API Key:** `AIzaSyDQO_LSnflOgA5H-Nz95eIksx94BhlZP_c`

**Architecture: MODULAR (July 2026)**
The monolithic `app.js` has been split into ES Modules under `modules/`:

| File | Lines | Responsibility |
|---|---|---|
| `modules/state.js` | ~130 | Firebase init, COL constants, all shared globals, cache helpers, setter functions |
| `modules/main.js` | ~1325 | Entry point — full DOMContentLoaded block + inlined initViewRouterLinks nav wiring |
| `modules/db.js` | ~80 | `removeCatalogDeleteButton`, `appendCatalogDeleteButton`, `fetchOwnerRecordByCode` |
| `modules/ui.js` | ~160 | `updatePackDiscountDisplay`, `updatePackSubServicesRunningSum`, `applyPackTypeUI`, `renderHomePage` |
| `modules/auth.js` | ~376 | Login, session watchdog, logout, `showActiveFrame`, `handleTelemetryAlert` |
| `modules/dashboard.js` | ~284 | GlamTrack analytics panels, `bindRealtimeAnalyticsStream` |
| `modules/catalog.js` | ~277 | Category/service/subservice/pack form handlers |
| `modules/customers.js` | ~646 | User profile form, modal helpers, `applyUserFormMode` |
| `modules/allotment.js` | ~715 | Sell package form, modify/delete handlers |
| `modules/visits.js` | ~865 | Customer visit form, visit history, staff dropdowns |
| `modules/refresh.js` | ~464 | Targeted refresh functions, `loadWorkspaceDropdownMappings` |

**`index.html`** loads `./modules/main.js` as `type="module"`.
**`app.js`** (monolithic) kept as backup only — NOT loaded.

**Other root files:**
| File | Purpose |
|---|---|
| `constants.js` | Sample seed data: SAMPLE_CATEGORIES, SAMPLE_SERVICES, SAMPLE_SUB_SERVICES |
| `errorMailer.js` | `reportRuntimeCrash()` — sends crash telemetry emails |
| `sw.js` | Service worker for PWA offline support (cache version: `glamtrack-v2`) |
| `manifest.json` | PWA manifest (name, icons, theme color #6f42c1 purple) |
| `privacy.html` | Public privacy policy page |
| `_redirects` | Netlify routing — silences Chrome DevTools 404 |
| `devtools-stub.json` | Empty JSON `{}` served for Chrome DevTools request |
| `modules/ES_MODULE_ERROR_CATALOGUE.md` | All ES module error types encountered + fixes |

---

## 2. CRITICAL MODULAR ARCHITECTURE RULES

### ES Module State Management
ALL mutable shared state lives in `state.js` as `export let`.
**Imported bindings are READ-ONLY** — never assign directly:

```js
// ❌ TypeError: Assignment to constant variable
activeSessionUser = userDoc;

// ✅ Use setter function from state.js
setActiveSessionUser(userDoc);
```

**Every state variable has a corresponding setter in `state.js`:**

| Variable | Setter |
|---|---|
| `activeSessionUser` | `setActiveSessionUser` |
| `salonOwnerNameContext` | `setSalonOwnerNameContext` |
| `realtimePacksUnsubscribe` | `setRealtimePacksUnsubscribe` |
| `sessionWatchdogTimer` | `setSessionWatchdogTimer` |
| `allotCurrentPackTotalAmount` | `setAllotCurrentPackTotalAmount` |
| `_allotExistingPacks` | `setAllotExistingPacks` |
| `_allotExistingIdx` | `setAllotExistingIdx` |
| `_postRegAllotMode` | `setPostRegAllotMode` |
| `_quickAddCustomerMode` | `setQuickAddCustomerMode` |
| `_utilizeStaffOptions` | `setUtilizeStaffOptions` |
| `utilizePrevUnpaidBalance` | `setUtilizePrevUnpaidBalance` |
| `_oldVisitPrevCalcCost` | `setOldVisitPrevCalcCost` |
| `_oldVisitPrevAddlAmt` | `setOldVisitPrevAddlAmt` |
| `_oldVisitLogDocRef` | `setOldVisitLogDocRef` |
| `_glamtrackFullExpiries` | `setGlamtrackFullExpiries` |
| `_glamtrackFullUnengaged` | `setGlamtrackFullUnengaged` |
| `_glamtrackFullPremium` | `setGlamtrackFullPremium` |
| `_quickAddCustomerModalInstance` | `setQuickAddCustomerModalInstance` |
| `_userProfileFormOriginalParent` | `setUserProfileFormOriginalParent` |
| `_userProfileFormOriginalNextSibling` | `setUserProfileFormOriginalNextSibling` |
| `_postRegAllotModalInstance` | `setPostRegAllotModalInstance` |
| `_allotFormOriginalParent` | `setAllotFormOriginalParent` |
| `_allotFormOriginalNextSibling` | `setAllotFormOriginalNextSibling` |
| `_utilizeOverrideConfirmed` | `setUtilizeOverrideConfirmed` |
| `_utilizeOverrideMeta` | `setUtilizeOverrideMeta` |

### Firestore DocumentReference Rule
State variables holding Firestore `DocumentReference` objects must be captured to a local `const` before passing to Firestore operations:

```js
// ❌ Firestore type check rejects ES module live bindings
await updateDoc(_oldVisitLogDocRef, { ... });

// ✅ Capture to local const first
const logDocRef = _oldVisitLogDocRef;
await updateDoc(logDocRef, { ... });
```

### main.js Structure
`main.js` contains the FULL DOMContentLoaded block (formerly split between `app.js` lines 165–609 AND `initViewRouterLinks` lines 744–1564). Both sections are inlined directly — no wrapper function. Must have exactly ONE `});` at the very end (the DOMContentLoaded close).

### Modularisation Checklist (run after any change)
```python
# 1. node --check on every module file
# 2. grep -c "^});" modules/main.js  → must be 1
# 3. grep "from from" modules/*.js   → must be 0
# 4. Check duplicate imports: Counter(all_imported_names) — flag v > 1
# 5. Check direct state assignments: varName\s*=\s*(?!=) in non-setter lines
# 6. Check missing state imports: state exports used in code but not imported
# 7. Check self-imports: module importing its own exports
```

---

## 3. COLLECTION NAME CONSTANTS (COL)

All Firestore collection names use `COL.X` constants from `state.js`:

```js
const COL = {
    USERS:        "users",
    SERVICES:     "services",
    SUB_SERVICES: "subServices",
    CATEGORIES:   "serviceCategories",
    COMMON_PACKS: "commonServicePacks",
    CUST_PACKS:   "customerServicePacks",
    VISIT_LOGS:   "serviceUtilizationLogs",
};
```
Never use bare string collection names — always `COL.X`.

---

## 4. IN-MEMORY CATALOG CACHE

`services` and `subServices` are cached to eliminate redundant Firestore reads:

```js
// Use these instead of getDocs(query(collection(db, COL.SERVICES), ...))
const srvSnap = await _getCachedServices();
const subSnap = await _getCachedSubServices();
```

**Cache invalidation (precise — call the RIGHT function):**
- After saving/deleting a **service** → `invalidateServicesCache()`
- After saving/deleting a **subService** → `invalidateSubServicesCache()`
- After batch seed (writes both) OR logout → `invalidateCatalogCache()`

**Never use raw getDocs on COL.SERVICES or COL.SUB_SERVICES** except inside `_getCachedServices()` / `_getCachedSubServices()` themselves.

---

## 5. USER ROLES

| Role | Description | Access |
|---|---|---|
| `SUPER_USER` | Platform administrator | Admin panel, Services, Packages, Users. OTP login via email. |
| `OWNER` | Salon owner — primary tenant | All menus including GlamTrack dashboard, Staff Registration |
| `MANAGER` | Salon manager | All menus except Staff Registration submenu |
| `STAFF` | Salon stylist/staff | Customer Visit only |
| `CUSTOMER` | Customer (stored in users collection, not a login role) | No login access |

**Effective Owner ID Rule (CRITICAL — used in ALL Firestore queries):**
```js
// Always use _ownerFilter() from state.js
const effectiveOwnerId = _ownerFilter();
// Never inline: (activeSessionUser.role === "OWNER") ? userNo : ownerUserNo
```

---

## 6. MULTI-TENANCY

Every Firestore document has `ownerUserNo` scoping it to one salon.
Global/default data uses `ownerUserNo = "000"`.

**Fallback pattern for services/subServices:**
```js
// Handled inside _getCachedServices() / _getCachedSubServices() automatically
```

---

## 7. FIRESTORE COLLECTIONS

### 7.1 `users` (COL.USERS)
Document ID: `{ownerUserNo}_USR_{userNo}`
Key fields: `ownerUserNo`, `userNo`, `role`, `name`, `email`, `password`, `phone`, `sex`, `active`, `registrationFee`, `registrationDate`, `startDate`, `expiryDate`, `createdAt`

### 7.2 `serviceCategories` (COL.CATEGORIES)
Document ID: `{ownerUserNo}_CAT_{categoryCode}`

### 7.3 `services` (COL.SERVICES)
Document ID: `{ownerUserNo}_SRV_{serviceCode}`
Global defaults: `ownerUserNo = "000"`

### 7.4 `subServices` (COL.SUB_SERVICES)
Document ID: `{ownerUserNo}_SUB_{subServiceCode}`
Key fields: `subServiceCode`, `subServiceName`, `serviceCode`, `rate`, `durationMinutes`, `sex` (F/M/U), `active`
Global defaults: `ownerUserNo = "000"`

### 7.5 `commonServicePacks` (COL.COMMON_PACKS)
Document ID: `{ownerUserNo}_PACK_{packCode}`
Key fields: `packCode`, `packName`, `packType` (Type1/Type2/Type3), `totalAmount`, `discountPct`, `subServicesArray`, `active`

### 7.6 `customerServicePacks` (COL.CUST_PACKS)
Document ID: `{ownerUserNo}_ALLOT_{timestamp}`
Key fields: `allotId`, `customerNo`, `customerName`, `packCode`, `packName`, `packType`, `subServicesArray`, `soldPrice`, `amountReceived`, `unpaidBalance`, `remainingBalance`, `startDate`, `expiryDate`, `lastVisitDate`, `status`, `createdAt`

**`lastVisitDate` is always explicitly set to `null` on new allotment creation** (added July 2026).

### 7.7 `serviceUtilizationLogs` (COL.VISIT_LOGS)
Document ID: `{ownerUserNo}_LOG_{timestamp}`
Key fields: `allotId`, `customerNo`, `customerName`, `visitDate`, `visitType`, `itemsRendered`, `serviceProviders` (array of `{userNo, role}` objects), `calculatedValueCost`, `addlAmtReceived`, `notes`, `recordedBy`, `recordedAt`

**CRITICAL:** `serviceProviders` is array of objects — NOT flat strings. Never use `array-contains`. Always filter client-side.

---

## 8. KEY BUSINESS RULES

### Delete Guards
| Entity | Guard | Collection |
|---|---|---|
| Sub-Service | Cannot delete if in any pack's `subServicesArray` | `commonServicePacks` |
| Customer | Cannot delete if sold a package | `customerServicePacks` |
| Staff/Manager | Cannot delete if in visit logs | `serviceUtilizationLogs` (client-side on `serviceProviders[].userNo`) |

### Balance Formulas (modify)
```
remainingBalance = old remainingBalance + (newSoldPrice − oldSoldPrice)
unpaidBalance    = max(0, old unpaidBalance + (oldAmtRcvd − newAmtRcvd))
lastVisitDate    = max(visitDate) across all logs for that allotId
```

---

## 9. UI PATTERNS

### Search Box + × Clear Button Pattern
All search boxes follow this pattern (implemented consistently across all forms):
- `position:relative` wrapper div
- `× button` (`btn-clear-{id}`) absolutely positioned inside right edge, `display:none` by default
- `input` event shows/hides × and filters dropdown
- × click: clears field, fires `input` event (restores all `_allOptions`), resets dropdown to `selectedIndex = 0`
- After form Reset: dispatches `input` event on search field to restore all options

**Search input → Dropdown pairs:**
| Search | Dropdown | × Button |
|---|---|---|
| `sub-select-search` | `sub-select-existing` | `btn-clear-sub-select-search` |
| `sub-parent-srv-search` | `sub-parent-srv` | `btn-clear-parent-srv-search` |
| `usr-select-search` | `usr-select-existing` | `btn-clear-usr-select-search` |
| `pack-select-search` | `pack-select-existing` | `btn-clear-pack-select-search` |
| `allot-customer-search` | `allot-customer-select` | `btn-clear-allot-customer-search` |
| `utilize-customer-search` | `utilize-customer-select` | `btn-clear-utilize-customer-search` |
| `pack-subservices-search` | `container-pack-subservices` (checkboxes) | `btn-clear-pack-subservices-search` |

**Hidden search boxes** (per requirement — elements exist in DOM but not visible):
- `allot-pack-search` — hidden, `allot-pack-select` used directly
- `utilize-pack-search` — hidden, `utilize-pack-select` used directly

### Checkbox Labels
```
subServiceName (serviceName) — ₹rate
```

### Reset→Cancel Pattern
Forms change Reset button to "Cancel" when a record is loaded for editing:
- `frm-adm-subservice` → `btn-reset-subservice`
- `frm-adm-user-profile` → `btn-reset-userprofile`
- `frm-adm-commonpack` → `btn-reset-commonpack`
- `frm-utilize-service-visit` → `btn-reset-utilize` (also changes to "Cancel" on Old Visit mode)

### Default Dates
- `utilize-visit-date` → today's date set on `nav-customer-visit` click and on `utilize-visit-new` radio change
- `allot-start-date` → today's date set when new pack selected (not in existing-pack mode)
- `usr-reg-date` → today's date set in `applyUserFormMode("CUSTOMER")` for new registrations

---

## 10. TARGETED REFRESH FUNCTIONS (refresh.js)

Use targeted functions instead of the full `refreshAllAdministrativeTables()` + `loadWorkspaceDropdownMappings()` pair:

| Function | Use after |
|---|---|
| `refreshCustomerDropdown()` | Saving/deleting a customer |
| `refreshUserProfileDropdown()` | Any user profile save |
| `refreshPackDropdowns()` | Saving/deleting a package |
| `refreshAllAdministrativeTables()` | Still used for table-only refreshes |
| `loadWorkspaceDropdownMappings()` | Full dropdown reload (used sparingly) |

---

## 11. PWA CONFIGURATION

- **Theme color:** `#6f42c1` (purple)
- **Cache version:** `glamtrack-v2` (updated for modular build)
- **Service Worker strategy:** Cache-first for static assets; Network-only for Firebase
- **Modules cached:** All 11 `modules/*.js` files pre-cached on install
- **Offline fallback:** `index.html` served for navigation requests
- **Privacy Policy:** `https://glamtrack.netlify.app/privacy.html`

---

## 12. KNOWN PATTERNS TO WATCH

1. **`_ownerFilter()` always** — never inline `role === "OWNER" ? userNo : ownerUserNo`
2. **COL constants always** — never bare string collection names
3. **Cache helpers always** — never raw `getDocs(collection(db, COL.SERVICES, ...))`
4. **Setters always** — never `stateVar = value` for imported state variables
5. **Local const for Firestore refs** — `const ref = _oldVisitLogDocRef; await updateDoc(ref, ...)`
6. **`serviceProviders` is array of objects** — never `array-contains`, always client-side filter
7. **`sex` field (not `gender`)** — F/M/O for users, F/M/U for subServices
8. **`lastVisitDate: null` explicitly** on new `customerServicePacks` creation
9. **main.js has exactly ONE `^});`** — check with `grep -c "^});" modules/main.js`
10. **`from from` typo** — check with `grep "from from" modules/*.js` after any import changes

---

## 13. CHANGELOG REFERENCE

| File | Covers |
|---|---|
| `CHANGELOG.md` | Changes [001–029] — project start to React Native build |
| `CHANGELOG_POST_RN.md` | Changes [030–045] — after React Native build |
| `modules/ES_MODULE_ERROR_CATALOGUE.md` | All 11 ES module error classes + fixes (July 2026) |

**July 2026 major changes (this document):**
- ES Module modularisation into 11 files
- COL collection name constants
- In-memory cache for services/subServices with precise invalidation
- Targeted refresh functions (refreshCustomerDropdown etc.)
- renderVisitHistory accepts packData parameter (eliminates redundant Firestore read)
- Unengaged customers optimisation (Step 2 only runs if Step 1 misses)
- lastVisitDate: null explicitly on allotment creation
- Customer Name column in visit history table
- Delete button on frm-allot-membership (alongside Modify)
- Post-delete and post-modify UI reset in allotment form
- soldPrice saved in Modify handler
- handleTelemetryAlert in all operational catch blocks

---

## 14. DEPLOYMENT CHECKLIST

```
Netlify root:
├── index.html          (loads ./modules/main.js)
├── app.js              (backup only — not loaded)
├── constants.js
├── errorMailer.js
├── sw.js               (glamtrack-v2)
├── manifest.json
├── _redirects
├── devtools-stub.json
├── privacy.html
├── icons/              (icon-72 to icon-512, ledger1.png)
└── modules/
    ├── state.js
    ├── main.js         (must have exactly ONE ^});)
    ├── db.js
    ├── ui.js
    ├── auth.js
    ├── dashboard.js
    ├── catalog.js
    ├── customers.js
    ├── allotment.js
    ├── visits.js
    └── refresh.js
```

---

*Document created: July 2026*
*Supersedes: GLAMTRACK_KNOWLEDGE.md (June 2026)*
